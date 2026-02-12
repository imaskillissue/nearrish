#!/bin/bash

# Model Download Script for Moderation Service
# This script downloads the Llama model for content moderation

set -e

MODELS_DIR="./models"
MODEL_NAME="Phi-3-mini-4k-instruct-q4.gguf"
MODEL_URL="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"

echo "==================================="
echo "Moderation Model Download Script"
echo "==================================="
echo ""

# Create models directory
if [ ! -d "$MODELS_DIR" ]; then
    echo "Creating models directory..."
    mkdir -p "$MODELS_DIR"
fi

# Check if model already exists
if [ -f "$MODELS_DIR/$MODEL_NAME" ]; then
    echo "✓ Model already exists: $MODELS_DIR/$MODEL_NAME"
    echo ""
    echo "File size: $(du -h "$MODELS_DIR/$MODEL_NAME" | cut -f1)"
    echo ""
    read -p "Do you want to re-download? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
fi

echo "Downloading model: $MODEL_NAME"
echo "Source: $MODEL_URL"
echo "Size: ~2.5 GB"
echo ""

# Download with progress bar
if command -v wget &> /dev/null; then
    wget --show-progress -O "$MODELS_DIR/$MODEL_NAME" "$MODEL_URL"
elif command -v curl &> /dev/null; then
    curl -L --progress-bar -o "$MODELS_DIR/$MODEL_NAME" "$MODEL_URL"
else
    echo "Error: Neither wget nor curl is installed."
    echo "Please install wget or curl and try again."
    exit 1
fi

echo ""
echo "✓ Download complete!"
echo ""
echo "Model saved to: $MODELS_DIR/$MODEL_NAME"
echo "File size: $(du -h "$MODELS_DIR/$MODEL_NAME" | cut -f1)"
echo ""
echo "You can now start the moderation service with:"
echo "  docker-compose up --build"
echo ""
echo "==================================="
echo "Alternative Models (Optional)"
echo "==================================="
echo ""
echo "If you want better quality and have more RAM/CPU:"
echo ""
echo "Llama 3.2 1B (better, ~600MB):"
echo "  wget -O $MODELS_DIR/llama-3.2-1b.gguf \\"
echo "    https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf"
echo ""
echo "Llama 3.2 3B (best, ~2GB, requires 4GB RAM):"
echo "  wget -O $MODELS_DIR/llama-3.2-3b.gguf \\"
echo "    https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
echo ""
echo "Don't forget to update LLAMA_MODEL_PATH in .env!"
echo ""
