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

MODERATION_PROMPT = """Classify this social media message into exactly one category.

Categories:
- ok: Normal, friendly, harmless content.
- warn: Rude, mildly offensive, contains swearing or insults.
- block: Hate speech, racism, threats, slurs, calls to harm people.

Rules:
- Identity statements are ALWAYS ok.
- Casual swearing without targeting = warn.
- Only block if attacking, threatening, or dehumanizing.

Message:
"{content}"

Reply with ONLY one word: ok, warn, or block
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
# Verdict Mapping
# =========================
VERDICT_MAP = {
    "ok": {"category": "clean", "severity": 0, "reason": "Content is fine"},
    "warn": {"category": "inappropriate", "severity": 5, "reason": "Contains mildly offensive language"},
    "block": {"category": "toxic", "severity": 9, "reason": "Contains hate speech or threats"},
}


def moderate_with_llama(content: str) -> Optional[Dict]:
    model = load_llama_model()
    if model is None:
        return None

    try:
        response = model.create_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "You are a strict moderation classifier. "
                               "Reply with only one word: ok, warn, or block."
                },
                {
                    "role": "user",
                    "content": MODERATION_PROMPT.format(content=content[:500])
                }
            ],
            temperature=0.0,
            top_p=1.0,
            max_tokens=5
        )

        raw = response['choices'][0]['message']['content'].strip().lower()
        app.logger.info(f"Phi-3 raw response: '{raw}'")

        verdict = "ok"
        if raw.startswith("block"):
            verdict = "block"
        elif raw.startswith("warn"):
            verdict = "warn"
        elif raw.startswith("ok"):
            verdict = "ok"

        result = dict(VERDICT_MAP[verdict])
        result["confidence"] = "medium"
        return result

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

        is_blocked = result['severity'] >= 9

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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)