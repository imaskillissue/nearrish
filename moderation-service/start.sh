#!/bin/sh
set -e

use_ollama() {
    echo "[moderation] Waiting for Ollama..."
    until curl -sf --max-time 3 "http://ollama:11434/api/tags" > /dev/null 2>&1; do
        sleep 2
    done
    echo "[moderation] Ollama ready"
    export MODEL_RUNNER_URL="http://ollama:11434/v1"
    export MODEL_PRIMARY="qwen2.5:3b"
}

if [ "${FORCE_OLLAMA}" = "true" ]; then
    echo "[moderation] FORCE_OLLAMA set — skipping model runner detection"
    use_ollama
elif curl -sf --connect-timeout 2 --max-time 3 \
    "http://model-runner.docker.internal/engines/llama.cpp/v1/models" > /dev/null 2>&1; then
    echo "[moderation] Docker Desktop model runner detected — using host inference"
    export MODEL_RUNNER_URL="http://model-runner.docker.internal/engines/llama.cpp/v1"
    export MODEL_PRIMARY="ai/qwen2.5:3B-Q4_K_M"
else
    use_ollama
fi

exec uvicorn main:app --host 0.0.0.0 --port 8001
