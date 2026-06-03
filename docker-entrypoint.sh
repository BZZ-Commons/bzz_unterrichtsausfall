#!/bin/sh
set -e

# Fail fast if any required secret file is missing
for secret in webuntis_school webuntis_username webuntis_password webuntis_base_url; do
  file="/run/secrets/$secret"
  if [ ! -f "$file" ]; then
    echo "Error: missing Docker secret: $secret (expected at $file)" >&2
    exit 1
  fi
done

WEBUNTIS_SCHOOL=$(cat /run/secrets/webuntis_school)
WEBUNTIS_USERNAME=$(cat /run/secrets/webuntis_username)
WEBUNTIS_PASSWORD=$(cat /run/secrets/webuntis_password)
WEBUNTIS_BASE_URL=$(cat /run/secrets/webuntis_base_url)
export WEBUNTIS_SCHOOL WEBUNTIS_USERNAME WEBUNTIS_PASSWORD WEBUNTIS_BASE_URL

exec "$@"
