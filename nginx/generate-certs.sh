#!/bin/bash
# Generate self-signed SSL certificates for local development
set -e

CERTS_DIR="$(dirname "$0")/certs"
mkdir -p "$CERTS_DIR"

if [ -f "$CERTS_DIR/server.crt" ] && [ -f "$CERTS_DIR/server.key" ]; then
    echo "Certificates already exist in $CERTS_DIR"
    exit 0
fi

echo "Generating self-signed SSL certificate..."

openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$CERTS_DIR/server.key" \
    -out "$CERTS_DIR/server.crt" \
    -subj "/C=FR/ST=IDF/L=Paris/O=42/OU=Nearrish/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Certificates generated successfully in $CERTS_DIR"
