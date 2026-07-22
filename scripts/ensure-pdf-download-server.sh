#!/usr/bin/env bash
set -euo pipefail

PDF_HELPER_URL="${PDF_DOWNLOAD_HELPER_URL:-http://127.0.0.1:3002}"
LOG_DIR="${TMPDIR:-/tmp}/portfolio-live-dashboard"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if curl -sf --max-time 2 "$PDF_HELPER_URL/health" >/dev/null 2>&1; then
  exit 0
fi

if lsof -nP -iTCP:3002 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3002 is occupied, but the PDF download helper health check failed." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
nohup node "$SCRIPT_DIR/pdf-download-server.mjs" >>"$LOG_DIR/pdf-download-server.log" 2>&1 &

for _ in {1..20}; do
  if curl -sf --max-time 2 "$PDF_HELPER_URL/health" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 0.25
done

echo "PDF download helper did not become ready. Check $LOG_DIR/pdf-download-server.log" >&2
exit 1
