import os
import json
import hashlib
import time
import logging
from collections import OrderedDict
from datetime import datetime
from logging.handlers import RotatingFileHandler
from typing import Optional

import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.panel import Panel

console = Console()

# =========================
# Logging
# =========================
if not os.path.exists("logs"):
    os.makedirs("logs")

file_handler = RotatingFileHandler(
    "logs/moderation.jsonl", maxBytes=10485760, backupCount=10
)
file_handler.setFormatter(logging.Formatter("%(message)s"))
file_handler.setLevel(logging.INFO)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.addHandler(file_handler)

# =========================
# Config
# =========================
MODEL_RUNNER_URL = os.getenv(
    "MODEL_RUNNER_URL",
    "http://model-runner.docker.internal/engines/llama.cpp/v1",
)
MODEL_PRIMARY = os.getenv("MODEL_PRIMARY", "ai/qwen2.5:3B-Q4_K_M")
MODEL_TIMEOUT = float(os.getenv("MODEL_TIMEOUT", "30"))  # seconds per request

# =========================
# App
# =========================
async def _warmup_model(model: str, client: httpx.AsyncClient, progress, task) -> bool:
    start = time.time()
    try:
        resp = await client.post(
            f"{MODEL_RUNNER_URL}/chat/completions",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "Reply with only a digit 0-4."},
                    {"role": "user", "content": "Rate: 'hello world' — 0-4:"},
                ],
                "max_tokens": 2,
                "temperature": 0.0,
            },
            headers={"Content-Type": "application/json"},
        )
        elapsed = time.time() - start
        progress.update(task, completed=100, description=f"[green]✓ {model}[/green] ({elapsed:.1f}s)")
        logger.info("Warmup complete for %s in %.1fs (status %s)", model, elapsed, resp.status_code)
        return resp.status_code == 200
    except Exception as e:
        elapsed = time.time() - start
        progress.update(task, completed=100, description=f"[red]✗ {model}[/red] failed: {e}")
        logger.warning("Warmup failed for %s: %s", model, e)
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    console.print(Panel.fit(
        "[bold cyan]Nearrish Moderation Service[/bold cyan]\n"
        f"[dim]Model:[/dim]   [yellow]{MODEL_PRIMARY}[/yellow]\n"
        f"[dim]Timeout:[/dim] [yellow]{MODEL_TIMEOUT:.0f}s[/yellow]",
        title="[bold white]Starting up[/bold white]",
        border_style="cyan"
    ))

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=30),
        TimeElapsedColumn(),
        console=console,
        transient=False,
    ) as progress:
        task1 = progress.add_task(f"[yellow]Loading {MODEL_PRIMARY}...[/yellow]", total=100)
        async with httpx.AsyncClient(timeout=120.0) as client:
            ok1 = await _warmup_model(MODEL_PRIMARY, client, progress, task1)

    if ok1:
        console.print(Panel.fit(
            "[bold green]Model is hot and ready to serve[/bold green] 🔥",
            border_style="green"
        ))
    else:
        console.print(Panel.fit(
            "[bold red]Warmup failed — model runner may not be ready[/bold red]",
            border_style="red"
        ))

    logger.info("Warmup complete. ok=%s", ok1)
    yield
    console.print("[dim]Moderation service shutting down.[/dim]")


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Scoring & Thresholds
# =========================
# 0-4 action-mapped scale. Each level has exactly one action.
SCORING = {
    0: {"category": "clean",         "action": "allow",    "description": "Clean — content is allowed"},
    1: {"category": "borderline",    "action": "allow",    "description": "Borderline — allowed, flagged for pattern monitoring"},
    2: {"category": "inappropriate", "action": "warn",     "description": "Inappropriate — user warned"},
    3: {"category": "harmful",       "action": "block",    "description": "Harmful — content blocked, account warned"},
    4: {"category": "severe",        "action": "escalate", "description": "Severe — content blocked, account flagged for review"},
}

THRESHOLDS = {"warn": 2, "block": 2, "escalate": 4}

# =========================
# LRU Cache
# =========================
class LRUCache:
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.cache: OrderedDict = OrderedDict()
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[dict]:
        if key in self.cache:
            entry_time, value = self.cache[key]
            if time.time() - entry_time < self.ttl_seconds:
                self.cache.move_to_end(key)
                self.hits += 1
                return value
            del self.cache[key]
        self.misses += 1
        return None

    def set(self, key: str, value: dict):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = (time.time(), value)
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)

    def stats(self) -> dict:
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.2f}%",
        }


cache = LRUCache(max_size=1000, ttl_seconds=3600)

# =========================
# Prompts
# =========================

# --- Post / comment moderation (with sentiment) ---
POST_SYSTEM_PROMPT = """Analyze this social media message in two steps.

Step 1 — one sentence: note whether the message contains a slur, a threat, or targets a group or person.
Step 2 — on a NEW line: reply with EXACTLY three tokens: digit sentiment topic

TOXICITY digit (default 0):
Score 0 — normal: greetings, questions, photos, opinions, personal stories, everyday talk.
Score 1 — slightly edgy or heated, not attacking any group.
Score 2 — stereotypes, microaggressions, insensitive generalizations.
Score 3 — slurs, dehumanization, targeted harassment, hate speech, strong insults directed at a group or person, content that demeans based on identity.
Score 4 — explicit threats of violence toward a person or group.
Rules: default is 0. "I am [identity]" is always 0. Criticism of ideas is always 0.

SENTIMENT word:
positive — upbeat, happy, supportive, enthusiastic, grateful
negative — angry, sad, frustrated, hostile, fearful, disgusted
neutral — factual, informational, ambiguous, mixed

TOPIC word (one or two words describing the main subject):
Use the most specific accurate label: basketball, cooking, travel, politics, racism, sexism, traffic, propaganda, transphobic, homophobic, slur, discrimination, harassment, music, gaming, weather, relationships, etc.
If no clear topic, use: general

Example output:
Contains a racial slur targeting a group.
3 negative racism"""

# --- Chat message moderation (with history context) ---
CHAT_SYSTEM_PROMPT = """Rate the LATEST chat message: 0, 1, 2, 3, or 4.

DEFAULT IS 0. Only increase if you see a clear reason.

Score 0 — normal conversation, greetings, support, personal stories, opinions.
Score 1 — slightly edgy, mildly heated, but not targeting anyone.
Score 2 — insensitive remark or microaggression. If history shows clear hostility toward one person, raise score by 1.
Score 3 — slurs, targeted harassment, dehumanizing language. If multiple prior users are attacking the same person (dogpiling), score 3 regardless of phrasing.
Score 4 — explicit threat of violence.

Rules:
- Rate only the LATEST message.
- Use history only to detect dogpiling or escalating harassment.
- If unsure, choose the LOWER score.
- "I am [identity]" or supportive statements are always 0.

Reply with ONE digit only: 0, 1, 2, 3, or 4."""

# --- Username / account creation moderation ---
USERNAME_SYSTEM_PROMPT = """Rate this username (already decoded from leetspeak): 0, 1, 2, 3, or 4.

Score 0 — normal, creative, or harmless: "CoolDude2000", "sunflower_dreams", "pizza_lover99", "xX_gamer_Xx".
Score 1 — mildly edgy but not targeting anyone.
Score 2 — subtly offensive or suggestive.
Score 3 — contains slurs, hate group codes (88, 1488, HH), or attacks an identity group: "WhitePower88", "KillGays", "TranniesAreSick".
Score 4 — explicit threat or extremist call to violence: "KillAllBlacks", "RapeEveryone", "AdolfHitler1488".

If the username is just a name, nickname, hobby, or random combination of words — score 0.

Reply with ONE digit only: 0, 1, 2, 3, or 4."""

# =========================
# Pydantic Models
# =========================

class ChatMessage(BaseModel):
    username: str
    text: str


class ModeratePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    user_id: Optional[str] = None
    content_type: str = Field(default="post")


class ModerateChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    history: list[ChatMessage] = Field(default_factory=list)
    username: Optional[str] = None
    user_id: Optional[str] = None


class ModerateUsernameRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    user_id: Optional[str] = None


class ModerationResponse(BaseModel):
    category: str
    action: str
    severity: int = Field(..., ge=0, le=4)
    sentiment: str
    topic: str
    reason: str
    is_blocked: bool
    is_warned: bool
    is_escalated: bool
    model_used: str
    cache_hit: bool
    timestamp: str
    processing_time_ms: float


# =========================
# Core inference
# =========================

async def _infer_raw(model: str, system_prompt: str, user_message: str, timeout: float, max_tokens: int = 4) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{MODEL_RUNNER_URL}/chat/completions",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.0,
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
    except httpx.TimeoutException:
        logger.warning("Model %s timed out after %.0fs", model, timeout)
        return None
    except httpx.HTTPError as e:
        logger.error("Model %s request failed: %s", model, e)
        return None

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    logger.debug("Model %s raw response: %r", model, raw)
    return raw


def _parse_digit(raw: str) -> Optional[int]:
    for char in raw:
        if char.isdigit():
            return max(0, min(4, int(char)))
    return None


def _parse_sentiment(raw: str) -> str:
    lower = raw.lower()
    if "pos" in lower:   return "positive"
    if "neg" in lower:   return "negative"
    return "neutral"


def _parse_topic(raw: str) -> str:
    """Extract topic from the third token onward, e.g. '0 positive basketball' → 'basketball'."""
    tokens = raw.lower().strip().split()
    # skip leading digit
    i = 0
    while i < len(tokens) and tokens[i].isdigit():
        i += 1
    # skip sentiment word
    if i < len(tokens) and any(s in tokens[i] for s in ("pos", "neg", "neu")):
        i += 1
    remaining = tokens[i:i + 2]
    topic = " ".join(remaining).strip(".,!?-")
    return topic if topic else "general"


async def call_model(system_prompt: str, user_message: str) -> Optional[int]:
    raw = await _infer_raw(MODEL_PRIMARY, system_prompt, user_message, MODEL_TIMEOUT, max_tokens=2)
    return _parse_digit(raw) if raw else None


async def call_model_with_sentiment(user_message: str) -> tuple[Optional[int], str, str]:
    """Single LLM call returning (severity, sentiment, topic). Uses combined prompt.
    The model outputs a reasoning line first, then 'digit sentiment topic' on the last line."""
    raw = await _infer_raw(MODEL_PRIMARY, POST_SYSTEM_PROMPT, user_message, MODEL_TIMEOUT, max_tokens=25)
    if raw is None:
        return None, "neutral", "general"
    # Digit and topic come from the last line (score line, after reasoning)
    # Sentiment is parsed from the full output — the reasoning often contains the key word
    lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]
    score_line = lines[-1] if lines else raw
    severity  = _parse_digit(score_line)
    sentiment = _parse_sentiment(raw)
    topic     = _parse_topic(score_line)
    return severity, sentiment, topic


_LEET: dict[int, str] = str.maketrans("013456789@$!|+", "oieashgqbaqsit")

def normalize_username(username: str) -> str:
    """Decode common leetspeak substitutions so the model sees plain text."""
    return username.translate(_LEET)


def build_result(severity: int, cache_hit: bool, start_time: float, sentiment: str = "neutral", topic: str = "general") -> dict:
    info = SCORING[severity]
    return {
        "category": info["category"],
        "action": info["action"],
        "severity": severity,
        "sentiment": sentiment,
        "topic": topic,
        "reason": info["description"],
        "is_blocked": severity >= THRESHOLDS["block"],
        "is_warned": severity >= THRESHOLDS["warn"],
        "is_escalated": severity >= THRESHOLDS["escalate"],
        "model_used": MODEL_PRIMARY,
        "cache_hit": cache_hit,
        "timestamp": datetime.utcnow().isoformat(),
        "processing_time_ms": round((time.time() - start_time) * 1000, 2),
    }


def log_result(result: dict, user_id: Optional[str], content_type: str):
    log_entry = {
        "timestamp": result["timestamp"],
        "user_id": user_id,
        "content_type": content_type,
        **{k: result[k] for k in ("category", "action", "severity", "reason", "is_blocked", "is_warned", "is_escalated", "cache_hit", "processing_time_ms")},
    }
    logger.info(json.dumps(log_entry))

    sev = result["severity"]
    color = ("green" if sev <= 1 else "yellow" if sev == 2 else "orange3" if sev == 3 else "bold red")
    blocked   = "[bold red] BLOCKED[/bold red]"         if result["is_blocked"] else ""
    escalated = "[bold magenta] ESCALATED[/bold magenta]" if result["is_escalated"] else ""
    warned    = "[yellow] WARNED[/yellow]"               if result["is_warned"] and not result["is_blocked"] else ""
    cache     = "[dim] (cache)[/dim]"                    if result["cache_hit"] else ""
    console.print(
        f"[dim]{result['timestamp'][11:19]}[/dim] "
        f"[{color}]severity={sev} {result['category'].upper()}[/{color}]"
        f"{blocked}{escalated}{warned}{cache} "
        f"[dim]{content_type} • {result['processing_time_ms']:.0f}ms[/dim]"
    )


# =========================
# Endpoints
# =========================

@app.post("/moderate", response_model=ModerationResponse)
async def moderate_post(req: ModeratePostRequest):
    """Moderate a post or comment."""
    start = time.time()
    cache_key = hashlib.md5(f"post_v3:{req.content}".encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    severity, sentiment, topic = await call_model_with_sentiment(f'Message: "{req.content[:5000]}"')
    if severity is None:
        raise HTTPException(status_code=502, detail="Model runner unavailable")

    result = build_result(severity, False, start, sentiment, topic)
    cache.set(cache_key, result)
    log_result(result, req.user_id, req.content_type)
    return result


@app.post("/moderate/chat", response_model=ModerationResponse)
async def moderate_chat(req: ModerateChatRequest):
    """Moderate a chat message with conversation history for context."""
    start = time.time()

    history_str = ""
    for msg in req.history[-10:]:
        history_str += f"{msg.username}: {msg.text}\n"

    user_message = (
        f"Conversation history:\n{history_str}\n"
        f"Latest message from {req.username or 'user'}: \"{req.message[:500]}\""
    )

    cache_key = hashlib.md5(f"chat_v3:{user_message}".encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    severity, sentiment, topic = await call_model_with_sentiment(user_message)
    if severity is None:
        raise HTTPException(status_code=502, detail="Model runner unavailable")

    result = build_result(severity, False, start, sentiment, topic)
    cache.set(cache_key, result)
    log_result(result, req.user_id, "chat")
    return result


@app.post("/moderate/username", response_model=ModerationResponse)
async def moderate_username(req: ModerateUsernameRequest):
    """Moderate a username at account creation."""
    start = time.time()
    cache_key = hashlib.md5(f"username:{req.username}".encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    normalized = normalize_username(req.username)
    severity = await call_model(USERNAME_SYSTEM_PROMPT, f'Username: "{normalized}"')
    if severity is None:
        raise HTTPException(status_code=502, detail="Model runner unavailable")

    result = build_result(severity, False, start)
    cache.set(cache_key, result)
    log_result(result, req.user_id, "username")
    return result


# =========================
# User analysis
# =========================

USER_ANALYSIS_SYSTEM_PROMPT = """You are a moderation analyst reviewing a user's activity on a social platform.
Based on the statistics and sample content provided, write a 4-6 sentence plain-English risk assessment.

Cover all of the following in your report:
1. Overall toxicity level and what it means for platform safety.
2. Sentiment pattern — whether the user's content is predominantly positive, neutral, or negative, and what that suggests.
3. If any sample content was provided, quote or closely paraphrase the most severe example and explain why it is problematic.
4. Breakdown of where the risk comes from (posts, comments, messages) based on block rates.
5. A concrete recommendation: monitor only, issue a warning, restrict posting, or escalate for review.

Be direct and specific. Name observable patterns (hate speech, harassment, negativity, spam, or positive contributions).
Do not use bullet points. Do not exceed 6 sentences."""


class AnalyseUserRequest(BaseModel):
    username: str
    avg_severity: float
    post_count: int
    blocked_posts: int
    comment_count: int
    blocked_comments: int
    message_count: int
    blocked_messages: int
    positive_count: int = 0
    neutral_count: int = 0
    negative_count: int = 0
    sample_content: list[str] = Field(default_factory=list)


class AnalyseUserResponse(BaseModel):
    summary: str


@app.post("/analyse/user", response_model=AnalyseUserResponse)
async def analyse_user(req: AnalyseUserRequest):
    """Generate a plain-English toxicity summary for a user based on their activity stats."""
    sample_text = ""
    if req.sample_content:
        sample_text = "\nFlagged content examples (up to 10):\n"
        for i, item in enumerate(req.sample_content[:10], 1):
            sample_text += f"  {i}. {item[:200]}\n"

    total_sentiment = req.positive_count + req.neutral_count + req.negative_count
    sentiment_line = ""
    if total_sentiment > 0:
        sentiment_line = (
            f"\nSentiment breakdown: {req.positive_count} positive, "
            f"{req.neutral_count} neutral, {req.negative_count} negative"
            f" ({req.negative_count * 100 // total_sentiment}% negative)"
        )

    user_message = (
        f"User: {req.username}\n"
        f"Posts: {req.post_count} total, {req.blocked_posts} blocked\n"
        f"Comments: {req.comment_count} total, {req.blocked_comments} blocked\n"
        f"Messages: {req.message_count} total, {req.blocked_messages} blocked\n"
        f"Average post severity: {req.avg_severity:.2f} / 4.0"
        f"{sentiment_line}"
        f"{sample_text}"
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{MODEL_RUNNER_URL}/chat/completions",
                json={
                    "model": MODEL_PRIMARY,
                    "messages": [
                        {"role": "system", "content": USER_ANALYSIS_SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 250,
                    "temperature": 0.3,
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error("User analysis request failed: %s", e)
            raise HTTPException(status_code=502, detail="Model runner unavailable")

    summary = resp.json()["choices"][0]["message"]["content"].strip()
    logger.info(json.dumps({"type": "user_analysis", "username": req.username, "summary": summary}))
    return {"summary": summary}


# =========================
# Health / stats
# =========================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_PRIMARY,
        "model_timeout_seconds": MODEL_TIMEOUT,
        "timestamp": datetime.utcnow().isoformat(),
        "cache": cache.stats(),
        "thresholds": THRESHOLDS,
        "scale": "0=clean 1=borderline 2=inappropriate 3=harmful 4=severe",
    }
