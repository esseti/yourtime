#!/bin/bash

# Crea la cartella .yme nella home dell'utente
mkdir -p "$HOME/youtime"

# Crea il file .env.local vuoto dentro la cartella .yme
if [ ! -f "$HOME/.yourtime/.env.local" ]; then touch "$HOME/.yourtime/.env.local"; fi
docker rm -f yourtime || true

ENV_LOCAL_PATH="$HOME/.yourtime/.env.local"
docker run -d --name yourtime \
  --env-file "$ENV_LOCAL_PATH" \
  -v "$HOME/.yourtime/data:/app/data" \
  -v "$ENV_LOCAL_PATH:/app/.env.local:ro" \
  -p 3000:3000 \
  ghcr.io/esseti/yourtime:latest

