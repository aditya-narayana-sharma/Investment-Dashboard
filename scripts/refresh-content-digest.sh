#!/usr/bin/env bash
set -euo pipefail

CONTENT_URL="${CONTENT_DIGEST_URL:-http://127.0.0.1:3003}"
TIMEOUT_SECONDS="${CONTENT_REFRESH_TIMEOUT_SECONDS:-480}"

curl --fail --silent --show-error \
  --max-time "$TIMEOUT_SECONDS" \
  "${CONTENT_URL%/}/refresh?force=1" \
  >/dev/null
