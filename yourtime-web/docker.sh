#!/bin/bash
# docker build -t ghcr.io/esseti/yourtime:latest .
docker rm -f yourtime || true

ENV_LOCAL_PATH="$(pwd)/.env.local"

docker run -d --name yourtime \
  --env-file "$ENV_LOCAL_PATH" \
  -v "$(pwd)/data:/app/data" \
  -v "$ENV_LOCAL_PATH:/app/.env.local:ro" \
  -p 8888:3000 \
  ghcr.io/esseti/yourtime:latest