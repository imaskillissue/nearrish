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
from rich.text import Text
from rich import print as rprint

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
MODEL_PRIMARY = os.getenv("MODEL_PRIMARY", "ai/llama3.2")
MODEL_FALLBACK = os.getenv("MODEL_FALLBACK", "ai/smollm2")
MODEL_TIMEOUT = float(os.getenv("MODEL_TIMEOUT", "30"))  # seconds per request
MODEL_NAME = MODEL_PRIMARY  # kept for health endpoint / logging

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
                    {"role": "system", "content": "Reply with only a digit."},
                    {"role": "user", "content": "Rate: 'hello' — 0-9:"},
                ],
                "max_tokens": 2,
                "temperature": 0.0,
            },
            headers={"Content-Type": "application/json"},
        )
        elapsed = time.time() - start
        progress.update(task, completed=100, description=f"[green]✓ {model}[/green] ({elapsed:.1f}s)")
        logger.info("Warmup complete for %s in %.1fs (status %s)", model, elapsed, resp.status_code)
        return True
    except Exception as e:
        elapsed = time.time() - start
        progress.update(task, completed=100, description=f"[red]✗ {model}[/red] failed: {e}")
        logger.warning("Warmup failed for %s: %s", model, e)
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    console.print(Panel.fit(
        "[bold cyan]Nearrish Moderation Service[/bold cyan]\n"
        f"[dim]Primary:[/dim]  [yellow]{MODEL_PRIMARY}[/yellow]\n"
        f"[dim]Fallback:[/dim] [yellow]{MODEL_FALLBACK}[/yellow]\n"
        f"[dim]Timeout:[/dim]  [yellow]{MODEL_TIMEOUT:.0f}s[/yellow]",
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

            task2 = progress.add_task(f"[yellow]Loading {MODEL_FALLBACK}...[/yellow]", total=100)
            ok2 = await _warmup_model(MODEL_FALLBACK, client, progress, task2)

    if ok1 and ok2:
        console.print(Panel.fit(
            "[bold green]Both models are hot and ready to serve[/bold green] 🔥",
            border_style="green"
        ))
    elif ok1 or ok2:
        console.print(Panel.fit(
            "[bold yellow]Partial warmup — one model available[/bold yellow]",
            border_style="yellow"
        ))
    else:
        console.print(Panel.fit(
            "[bold red]Warmup failed — model runner may not be ready[/bold red]",
            border_style="red"
        ))

    logger.info("Warmup complete. primary_ok=%s fallback_ok=%s", ok1, ok2)
    yield
    console.print("[dim]Moderation service shutting down.[/dim]")


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SCORING = {
    0: {"category": "clean",        "description": "Positive, supportive, or identity-affirming content"},
    1: {"category": "clean",        "description": "Neutral, everyday conversation"},
    2: {"category": "clean",        "description": "Mildly opinionated but respectful disagreement"},
    3: {"category": "questionable", "description": "Edgy humor or sarcasm without targeting groups"},
    4: {"category": "questionable", "description": "Dismissive language, passive-aggressive tone"},
    5: {"category": "inappropriate","description": "Microaggressions, insensitive remarks, heated language"},
    6: {"category": "inappropriate","description": "Light personal attacks, mockery of identities, dismissing discrimination"},
    7: {"category": "toxic",        "description": "Targeted hostility, slurs in reclaimed context, dogwhistles"},
    8: {"category": "toxic",        "description": "Explicit hate speech, dehumanization, stereotyping of protected groups"},
    9: {"category": "dangerous",    "description": "Threats, calls for violence, severe harassment of marginalized groups"},
}

THRESHOLDS = {"warn": 5, "block": 9}

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

# --- Post / comment moderation ---
POST_SYSTEM_PROMPT = """You are a STRICT, safety-first content moderation system for a social media platform.

Rate the message with a severity score from 0 to 9:
0: Positive, supportive, or identity-affirming content.
1: Neutral, everyday conversation.
2: Mildly opinionated but respectful disagreement.
3: Edgy humor or sarcasm without targeting groups.
4: Dismissive language, passive-aggressive tone.
5: Microaggressions, insensitive remarks, heated language.
6: Light personal attacks, mockery of identities, dismissing discrimination.
7: Targeted hostility, slurs in reclaimed context, dogwhistles.
8: Explicit hate speech, dehumanization, stereotyping of protected groups.
9: Threats, calls for violence, severe harassment of marginalized groups.

Rules:
- When in doubt, round UP to the higher severity.
- When any protected or marginalized group is involved and in doubt, score 7 or higher.
- "Just joking" or memes are NOT an excuse for hate.
- Criticism of IDEAS is fine (score 0-2). Attacks on people as a group score 7+.
- Identity-affirming statements by marginalized people are ALWAYS score 0.

Reply with ONLY a single digit: 0, 1, 2, 3, 4, 5, 6, 7, 8, or 9. No explanation."""

# --- Chat message moderation (with history context) ---
CHAT_SYSTEM_PROMPT = """You are a STRICT content moderation system for a real-time chat on a social platform.

You will receive a conversation history followed by the message to moderate.
Use the conversation context to catch escalating harassment, dogpiling, or threats
that might appear mild in isolation but are hostile in context.

Rate the LATEST message with a severity score from 0 to 9:
0: Positive, supportive, or identity-affirming content.
1: Neutral, everyday conversation.
2: Mildly opinionated but respectful disagreement.
3: Edgy humor or sarcasm without targeting groups.
4: Dismissive language, passive-aggressive tone.
5: Microaggressions, insensitive remarks, heated language.
6: Light personal attacks, mockery of identities, dismissing discrimination.
7: Targeted hostility, slurs in reclaimed context, dogwhistles, or clear escalation.
8: Explicit hate speech, dehumanization, stereotyping of protected groups.
9: Threats, calls for violence, severe harassment of marginalized groups.

Rules:
- When in doubt, round UP.
- If prior messages show escalating hostility, score the latest message higher than it would score alone.
- Coordinated harassment (multiple users targeting one) scores 7+.
- "Just joking" or memes are NOT an excuse for hate.

Reply with ONLY a single digit: 0, 1, 2, 3, 4, 5, 6, 7, 8, or 9. No explanation."""

# --- Username / account creation moderation ---
USERNAME_SYSTEM_PROMPT = """You are a strict username moderation system for a social platform.

Rate the username with a severity score from 0 to 9:
0: Normal, creative, or clearly harmless username.
1: Generic or slightly unusual but fine.
2: Borderline but not clearly problematic.
3: Mildly provocative or edgy but not targeted.
4: Suggestive or subtly offensive.
5: Moderately offensive, slur-adjacent, or impersonating real people.
6: Clear attempt to be offensive, mock identities, or evade prior bans.
7: Contains slurs, dogwhistles, or targeted hate toward groups.
8: Explicit hate, slurs targeting protected groups, or threats.
9: Severe: explicit threats, calls for violence, terrorist/extremist references.

Rules:
- When in doubt, round UP.
- Common words that happen to sound rude score 0-2.
- Obvious intentional hate scores 7+.
- Numbers replacing letters (e.g. 3=e, 1=i) to hide slurs still count.

Reply with ONLY a single digit: 0, 1, 2, 3, 4, 5, 6, 7, 8, or 9. No explanation."""

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
    severity: int = Field(..., ge=0, le=9)
    reason: str
    confidence: str
    is_blocked: bool
    is_warned: bool
    model_used: str
    cache_hit: bool
    timestamp: str
    processing_time_ms: float


# =========================
# Core inference
# =========================

async def _infer(model: str, system_prompt: str, user_message: str, timeout: float) -> Optional[int]:
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
                    "max_tokens": 2,
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
    for char in raw:
        if char.isdigit():
            return max(0, min(9, int(char)))
    return None


async def call_model(system_prompt: str, user_message: str) -> Optional[int]:
    # Try primary model first within the configured timeout
    result = await _infer(MODEL_PRIMARY, system_prompt, user_message, MODEL_TIMEOUT)
    if result is not None:
        return result

    # Primary timed out or failed — fall back to smaller model
    logger.warning("Falling back to %s", MODEL_FALLBACK)
    return await _infer(MODEL_FALLBACK, system_prompt, user_message, MODEL_TIMEOUT)


def build_result(severity: int, cache_hit: bool, start_time: float) -> dict:
    info = SCORING[severity]
    return {
        "category": info["category"],
        "severity": severity,
        "reason": info["description"],
        "confidence": "high",
        "is_blocked": severity >= THRESHOLDS["block"],
        "is_warned": severity >= THRESHOLDS["warn"],
        "model_used": MODEL_NAME,
        "cache_hit": cache_hit,
        "timestamp": datetime.utcnow().isoformat(),
        "processing_time_ms": round((time.time() - start_time) * 1000, 2),
    }


def log_result(result: dict, user_id: Optional[str], content_type: str):
    log_entry = {
        "timestamp": result["timestamp"],
        "user_id": user_id,
        "content_type": content_type,
        **{k: result[k] for k in ("category", "severity", "reason", "is_blocked", "is_warned", "cache_hit", "processing_time_ms")},
    }
    logger.info(json.dumps(log_entry))

    # Rich terminal output per request
    sev = result["severity"]
    color = ("green" if sev <= 2 else "yellow" if sev <= 4 else "orange3" if sev <= 6 else "red")
    blocked = "[bold red] BLOCKED[/bold red]" if result["is_blocked"] else ""
    warned  = "[yellow] WARNED[/yellow]"  if result["is_warned"] and not result["is_blocked"] else ""
    cache   = "[dim] (cache)[/dim]"        if result["cache_hit"] else ""
    console.print(
        f"[dim]{result['timestamp'][11:19]}[/dim] "
        f"[{color}]severity={sev} {result['category'].upper()}[/{color}]"
        f"{blocked}{warned}{cache} "
        f"[dim]{content_type} • {result['processing_time_ms']:.0f}ms[/dim]"
    )


# =========================
# Endpoints
# =========================

@app.post("/moderate", response_model=ModerationResponse)
async def moderate_post(req: ModeratePostRequest):
    """Moderate a post or comment."""
    start = time.time()
    cache_key = hashlib.md5(f"post:{req.content}".encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    severity = await call_model(POST_SYSTEM_PROMPT, f'Message: "{req.content[:5000]}"')
    if severity is None:
        raise HTTPException(status_code=502, detail="Model runner unavailable")

    result = build_result(severity, False, start)
    cache.set(cache_key, result)
    log_result(result, req.user_id, req.content_type)
    return result


@app.post("/moderate/chat", response_model=ModerationResponse)
async def moderate_chat(req: ModerateChatRequest):
    """Moderate a chat message with conversation history for context."""
    start = time.time()

    # Build context string from history (last 10 messages max)
    history_str = ""
    for msg in req.history[-10:]:
        history_str += f"{msg.username}: {msg.text}\n"

    user_message = (
        f"Conversation history:\n{history_str}\n"
        f"Latest message from {req.username or 'user'}: \"{req.message[:500]}\""
    )

    cache_key = hashlib.md5(f"chat:{user_message}".encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    severity = await call_model(CHAT_SYSTEM_PROMPT, user_message)
    if severity is None:
        raise HTTPException(status_code=502, detail="Model runner unavailable")

    result = build_result(severity, False, start)
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

    severity = await call_model(USERNAME_SYSTEM_PROMPT, f'Username: "{req.username}"')
    if severity is None:
        raise HTTPException(status_code=502, detail="Model runner unavailable")

    result = build_result(severity, False, start)
    cache.set(cache_key, result)
    log_result(result, req.user_id, "username")
    return result


# =========================
# User log analysis (future)
# =========================

# @app.post("/analyse/user")
# async def analyse_user(user_id: str):
#     """
#     Analyse a user's moderation history to detect patterns.
#     Ideas:
#     - Load all log entries for user_id from moderation.jsonl
#     - Compute: avg severity, total warns, total blocks, escalation trend
#     - Feed summary to model: "This user has posted X times, avg severity Y,
#       with Z blocks in the last 7 days. Assess risk level: low/medium/high."
#     - Return: { risk_level, avg_severity, warn_count, block_count, trend }
#     - Could trigger auto-shadowban or flag for human review at high risk
#     """
#     pass


# @app.get("/analyse/flagged")
# async def get_flagged_users():
#     """
#     Return users sorted by moderation risk score.
#     Ideas:
#     - Aggregate log entries by user_id
#     - Score = weighted sum of (severity * recency_weight) per user
#     - Useful for a moderation dashboard
#     """
#     pass


# =========================
# Health / stats
# =========================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_primary": MODEL_PRIMARY,
        "model_fallback": MODEL_FALLBACK,
        "model_timeout_seconds": MODEL_TIMEOUT,
        "timestamp": datetime.utcnow().isoformat(),
        "cache": cache.stats(),
        "thresholds": THRESHOLDS,
    }
