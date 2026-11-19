#!/bin/sh
set -e

# Required runtime config, provided as environment variables.
# On deplo.io (production) they are injected by the platform;
# locally they come from `env_file: .env` (docker compose).
for var in WEBUNTIS_SCHOOL WEBUNTIS_USERNAME WEBUNTIS_PASSWORD WEBUNTIS_BASE_URL; do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    echo "Error: missing required environment variable: $var" >&2
    exit 1
  fi
done

exec "$@"
