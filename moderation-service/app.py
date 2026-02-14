import os
import json
import hashlib
import time
from datetime import datetime
from typing import Dict, Optional, Tuple
from collections import OrderedDict
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from llama_cpp import Llama
from pydantic import BaseModel, Field
import logging
from logging.handlers import RotatingFileHandler

app = Flask(__name__)
CORS(app)

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per minute", "1000 per hour"]
)

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')

file_handler = RotatingFileHandler(
    'logs/moderation.jsonl',
    maxBytes=10485760,
    backupCount=10
)
file_handler.setFormatter(logging.Formatter('%(message)s'))
file_handler.setLevel(logging.INFO)

app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)

# Load configuration
with open('moderation-rules.json', 'r') as f:
    CONFIG = json.load(f)


# =========================
# LRU Cache
# =========================
class LRUCache:
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.cache = OrderedDict()
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Dict]:
        if key in self.cache:
            entry_time, value = self.cache[key]
            if time.time() - entry_time < self.ttl_seconds:
                self.cache.move_to_end(key)
                self.hits += 1
                return value
            else:
                del self.cache[key]
        self.misses += 1
        return None

    def set(self, key: str, value: Dict):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = (time.time(), value)
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)

    def stats(self) -> Dict:
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.2f}%"
        }


cache = LRUCache(
    max_size=CONFIG['cache_settings']['max_size'],
    ttl_seconds=CONFIG['cache_settings']['ttl_seconds']
)


# =========================
# Pydantic Models
# =========================
class ModerationRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    user_id: Optional[str] = None
    content_type: str = Field(default="post", pattern="^(post|chat|comment|profile)$")


class ModerationResponse(BaseModel):
    category: str
    severity: int = Field(..., ge=0, le=9)
    reason: str
    confidence: str
    is_blocked: bool
    model_used: str
    cache_hit: bool
    timestamp: str


# =========================
# Phi-3 Model Setup
# =========================
llama_model: Optional[Llama] = None

MODERATION_PROMPT = """You are a STRICT, highly progressive, safety-first content moderation system
for a social media platform. Your goal is to create an extremely inclusive,
supportive, and non-toxic space with zero tolerance for hate, harassment,
or discrimination.

Rate this social media message with a severity score from 0 to 9:

- 0: Positive, supportive, or identity-affirming content.
- 1: Neutral, everyday conversation.
- 2: Mildly opinionated but respectful disagreement.
- 3: Edgy humor or sarcasm without targeting groups.
- 4: Dismissive language, passive-aggressive tone.
- 5: Microaggressions, insensitive remarks, heated language.
- 6: Light personal attacks, mockery of identities, dismissing discrimination.
- 7: Targeted hostility, slurs in reclaimed context, dogwhistles.
- 8: Explicit hate speech, dehumanization, stereotyping of protected groups.
- 9: Threats, calls for violence, severe harassment of marginalized groups.

Content policies:

- Supportive, neutral, or harmless content. Respectful disagreement without
  personal attacks. Inclusive language, identity-affirming statements,
  critical discussion of ideas or systems (not people as groups) = low scores (0-2).

- Content that is not outright hateful or violent but is still problematic,
  including: sarcasm or mockery about identities, microaggressions,
  dismissive attitudes toward discrimination ("it's not that bad", "people are
  too sensitive"), light personal attacks not tied to protected groups,
  casual use of slurs in clearly self-referential or reclaimed contexts by
  members of that group, or heated language that risks escalating = mid scores (3-6).

- Any form of hate, harassment, or demeaning language targeting a person
  or group, ESPECIALLY protected or marginalized groups (race, ethnicity,
  nationality, religion, gender, gender identity, sexual orientation,
  disability, serious disease, immigration status, body size, age, etc.).
  This includes:
  - Slurs (even "jokes" or "ironic").
  - Stereotypes, demeaning tropes, or dogwhistles.
  - Misgendering or deadnaming, or denying the validity of identities.
  - Calls for exclusion, segregation, removal of rights, or "go back where
    you came from".
  - Content that blames or mocks victims of discrimination.
  - Dehumanization ("vermin", "animals", "subhuman", etc.).
  - Threats, wishing harm, or celebrating harm.
  - Sexual or violent content that is degrading, non-consensual,
    or targets protected groups = high scores (7-9).

Rules and principles:

- When in doubt, round UP to the higher severity.
- When in doubt and any protected group, identity, or historically marginalized
  group is involved, choose a score of 7 or higher.
- Criticism of IDEAS (e.g. "this policy is bad", "this ideology is harmful")
  is fine as long as it does not attack people as a group (score 0-2).
- Identity-affirming statements by marginalized people (e.g. "we deserve equal
  rights", "trans women are women") are ALWAYS score 0.
- "Just joking", irony, or memes are NOT an excuse for hate or discrimination.
- Even indirect or subtle hostility toward protected groups should score 7+.

Message:

"{content}"

Reply with ONLY a single digit: 0, 1, 2, 3, 4, 5, 6, 7, 8, or 9.
"""



def load_llama_model():
    global llama_model
    if llama_model is None:
        model_path = os.getenv(
            'LLAMA_MODEL_PATH',
            './models/Phi-3-mini-4k-instruct-q4.gguf'
        )

        if os.path.exists(model_path):
            app.logger.info(f"Loading Phi-3 model from {model_path}")
            try:
                llama_model = Llama(
                    model_path=model_path,
                    n_ctx=1024,
                    n_threads=int(os.getenv("LLAMA_THREADS", "4")),
                    n_gpu_layers=0,
                    n_batch=256,
                    verbose=False
                )
                app.logger.info("Phi-3 loaded successfully")
            except Exception as e:
                app.logger.error(f"Failed to load Phi-3: {str(e)}")
                llama_model = None
        else:
            app.logger.warning(f"Model not found at {model_path}")
            llama_model = None

    return llama_model


# =========================
# Scoring Helpers
# =========================
SCORING = CONFIG['scoring']
THRESHOLDS = CONFIG['thresholds']


def severity_to_category(severity: int) -> str:
    return SCORING[str(severity)]['category']


def severity_to_reason(severity: int) -> str:
    return SCORING[str(severity)]['description']


def moderate_with_llama(content: str) -> Optional[Dict]:
    model = load_llama_model()
    if model is None:
        return None

    try:
        response = model.create_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content":
                        "You are an extremely strict, progressive content moderation classifier. "
                        "You prioritize safety, inclusivity, and protection of marginalized groups. "
                        "Reply with ONLY a single digit from 0 to 9."
                    ,
                },
                {
                    "role": "user",
                    "content": MODERATION_PROMPT.format(content=content[:500])
                }
            ],
            temperature=0.0,
            top_p=1.0,
            max_tokens=2
        )

        raw = response['choices'][0]['message']['content'].strip()
        app.logger.info(f"Phi-3 raw response: '{raw}'")

        # Extract the first digit found in the response
        severity = None
        for char in raw:
            if char.isdigit():
                severity = int(char)
                break

        if severity is None:
            # Fallback: try to interpret old-style ok/warn/block responses
            raw_lower = raw.lower()
            if raw_lower.startswith("block"):
                severity = THRESHOLDS['block']
            elif raw_lower.startswith("warn"):
                severity = THRESHOLDS['warn']
            else:
                severity = 0

        severity = max(0, min(9, severity))

        return {
            "category": severity_to_category(severity),
            "severity": severity,
            "reason": severity_to_reason(severity),
            "confidence": "medium"
        }

    except Exception as e:
        app.logger.error(f"Phi-3 moderation failed: {str(e)}")
        return None


def get_content_hash(content: str) -> str:
    return hashlib.md5(content.encode()).hexdigest()


def moderate_content(content: str, user_id: Optional[str] = None,
                     content_type: str = "post") -> Tuple[Dict, bool, str]:

    content_hash = get_content_hash(content)
    cached_result = cache.get(content_hash)

    if cached_result:
        return cached_result, True, "cache"

    result = moderate_with_llama(content)
    model_used = "phi-3-mini"

    if result is None:
        result = {
            'category': 'error',
            'severity': 0,
            'reason': 'Moderation unavailable',
            'confidence': 'low'
        }
        model_used = "none"

    result['model_used'] = model_used

    if result['category'] != 'error':
        cache.set(content_hash, result)

    return result, False, model_used


# =========================
# API Endpoints
# =========================
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "phi3_loaded": llama_model is not None,
        "cache": cache.stats()
    })


@app.route('/moderate', methods=['POST'])
@limiter.limit("100 per minute")
def moderate():
    try:
        data = request.get_json()
        mod_request = ModerationRequest(**data)

        start_time = time.time()
        result, cache_hit, model_used = moderate_content(
            mod_request.content,
            mod_request.user_id,
            mod_request.content_type
        )
        processing_time = (time.time() - start_time) * 1000

        is_blocked = result['severity'] >= THRESHOLDS['block']

        response = ModerationResponse(
            category=result['category'],
            severity=result['severity'],
            reason=result['reason'],
            confidence=result['confidence'],
            is_blocked=is_blocked,
            model_used=model_used,
            cache_hit=cache_hit,
            timestamp=datetime.utcnow().isoformat()
        )

        log_entry = {
            "timestamp": response.timestamp,
            "user_id": mod_request.user_id,
            "content_type": mod_request.content_type,
            "category": response.category,
            "severity": response.severity,
            "reason": response.reason,
            "confidence": response.confidence,
            "is_blocked": response.is_blocked,
            "model_used": response.model_used,
            "cache_hit": response.cache_hit,
            "processing_time_ms": round(processing_time, 2)
        }
        app.logger.info(json.dumps(log_entry))

        return jsonify({
            **response.model_dump(),
            "processing_time_ms": round(processing_time, 2)
        })

    except Exception as e:
        app.logger.error(f"Moderation error: {str(e)}")
        return jsonify({
            "error": "Internal moderation error",
            "details": str(e)
        }), 500


def warmup():
    """Load model and run a throwaway inference so the first real request is fast."""
    app.logger.info("Warming up: loading model...")
    model = load_llama_model()
    if model is not None:
        app.logger.info("Warming up: running warmup inference...")
        try:
            model.create_chat_completion(
                messages=[
                    {"role": "system", "content": "Reply with only a digit."},
                    {"role": "user", "content": "Rate: 'hello' — 0-9:"}
                ],
                temperature=0.0,
                max_tokens=2
            )
            app.logger.info("Warmup complete — model is hot")
        except Exception as e:
            app.logger.error(f"Warmup inference failed: {e}")
    else:
        app.logger.warning("Warmup skipped — model not available")


if __name__ == '__main__':
    warmup()
    app.run(host='0.0.0.0', port=5000, debug=False)