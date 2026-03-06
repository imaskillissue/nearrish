#!/bin/sh
set -e

if curl -sf --connect-timeout 2 --max-time 3 \
    "http://model-runner.docker.internal/engines/llama.cpp/v1/models" > /dev/null 2>&1; then
    echo "[moderation] Docker Desktop model runner detected — using host inference"
    export MODEL_RUNNER_URL="http://model-runner.docker.internal/engines/llama.cpp/v1"
    export MODEL_PRIMARY="ai/llama3.2"
    export MODEL_FALLBACK="ai/smollm2"
else
    echo "[moderation] Model runner not available — waiting for Ollama..."
    until curl -sf --max-time 3 "http://ollama:11434/api/tags" > /dev/null 2>&1; do
        sleep 2
    done
    echo "[moderation] Ollama ready"
    export MODEL_RUNNER_URL="http://ollama:11434/v1"
    export MODEL_PRIMARY="llama3.2"
    export MODEL_FALLBACK="smollm2"
fi

exec uvicorn main:app --host 0.0.0.0 --port 8001
