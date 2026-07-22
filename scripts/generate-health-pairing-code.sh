#!/usr/bin/env bash
set -euo pipefail

PORT="${PORTFOLIO_FLASK_PORT:-5050}"
URL="http://127.0.0.1:${PORT}/_health/pair/code"

if ! curl -sf --max-time 3 "http://127.0.0.1:${PORT}/_flask/health" >/dev/null; then
  printf 'Portfolio Intelligence is not healthy on localhost:%s.\n' "$PORT" >&2
  printf 'Start it first with: npm run flask:service\n' >&2
  exit 1
fi

response="$(curl -sf --max-time 10 -X POST "$URL")"
code="$(printf '%s' "$response" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])')"
expires="$(printf '%s' "$response" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["expiresAt"])')"

printf '\nHealthKit pairing code: %s\n' "$code"
printf 'Expires: %s\n' "$expires"
printf 'Enter this code in Portfolio Intelligence → Settings → HealthKit pairing.\n\n'
