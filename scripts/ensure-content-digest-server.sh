#!/usr/bin/env bash
set -euo pipefail

CONTENT_URL="${CONTENT_DIGEST_URL:-http://127.0.0.1:3003}"
LOG_DIR="${TMPDIR:-/tmp}/portfolio-live-dashboard"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if curl -sf --max-time 2 "$CONTENT_URL/health" >/dev/null 2>&1; then
  exit 0
fi

if lsof -nP -iTCP:3003 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3003 is occupied, but the content digest health check failed." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
nohup node "$ROOT_DIR/scripts/content-digest-server.mjs" >>"$LOG_DIR/content-digest-server.log" 2>&1 &

for _ in {1..20}; do
  if curl -sf --max-time 2 "$CONTENT_URL/health" >/dev/null 2>&1; then
    exit 0
  fi
  sleep .25
done

echo "Content digest server did not become ready. Check $LOG_DIR/content-digest-server.log" >&2
exit 1
