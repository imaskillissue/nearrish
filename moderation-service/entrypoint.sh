#!/bin/bash
set -e

MODEL_PATH="${LLAMA_MODEL_PATH:-/app/models/Phi-3-mini-4k-instruct-q4.gguf}"
MODEL_URL="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"
MIN_SIZE_BYTES=2000000000  # ~2GB minimum, actual is ~2.39GB

download_needed=false

if [ ! -f "$MODEL_PATH" ]; then
    download_needed=true
    echo "Model not found at $MODEL_PATH"
else
    file_size=$(stat -c%s "$MODEL_PATH" 2>/dev/null || stat -f%z "$MODEL_PATH" 2>/dev/null || echo "0")
    if [ "$file_size" -lt "$MIN_SIZE_BYTES" ]; then
        download_needed=true
        echo "Model file is incomplete (${file_size} bytes). Re-downloading..."
        rm -f "$MODEL_PATH"
    fi
fi

if [ "$download_needed" = true ]; then
    echo "============================================"
    echo "Downloading Phi-3 Mini Q4 (~2.2GB)..."
    echo "This may take a while on slow connections."
    echo "============================================"
    mkdir -p "$(dirname "$MODEL_PATH")"
    wget --progress=bar:force:noscroll -O "${MODEL_PATH}.tmp" "$MODEL_URL"
    mv "${MODEL_PATH}.tmp" "$MODEL_PATH"
    echo "Download complete!"
else
    echo "Model already present at $MODEL_PATH"
fi

exec python3 app.py
