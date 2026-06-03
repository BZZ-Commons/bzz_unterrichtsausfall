#!/bin/sh
# Populate ./secrets/ from .env (or .env.example as a guide).
# Usage: ./scripts/init-secrets.sh [.env file]
set -e

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Create it from .env.example first." >&2
  exit 1
fi

for var in WEBUNTIS_SCHOOL WEBUNTIS_USERNAME WEBUNTIS_PASSWORD WEBUNTIS_BASE_URL; do
  value=$(grep "^${var}=" "$ENV_FILE" | cut -d= -f2-)
  if [ -z "$value" ]; then
    echo "Warning: $var is empty in $ENV_FILE — skipping" >&2
    continue
  fi
  key=$(echo "$var" | tr '[:upper:]' '[:lower:]')
  printf '%s' "$value" > "secrets/$key"
  # Owned by the invoking user but readable only by uid 1001 (nextjs inside the container).
  # chown to 1001 so Docker's bind-mount preserves read access for the container process.
  chown 1001 "secrets/$key" 2>/dev/null || true
  chmod 600 "secrets/$key"
  echo "  wrote secrets/$key"
done

echo "Done. Verify with: docker compose up"
