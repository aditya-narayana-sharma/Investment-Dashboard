#!/usr/bin/env bash
set -euo pipefail

KITE_DIR="${KITE_MCP_PROJECT_DIR:-/Users/adityasharma/Documents/GitHub/kite-mcp-server}"
KITE_URL="${KITE_MCP_SERVER_URL:-http://127.0.0.1:8080}"
LOG_DIR="${TMPDIR:-/tmp}/portfolio-live-dashboard"

if curl -sf --max-time 2 "$KITE_URL/" >/dev/null 2>&1; then
  exit 0
fi

if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 8080 is occupied, but the Kite MCP health check failed." >&2
  exit 1
fi

if [[ ! -x "$KITE_DIR/start-server.sh" ]]; then
  echo "Kite MCP launcher not found at $KITE_DIR/start-server.sh" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
nohup "$KITE_DIR/start-server.sh" >>"$LOG_DIR/kite-mcp-server.log" 2>&1 &

for _ in {1..30}; do
  if curl -sf --max-time 2 "$KITE_URL/" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "Kite MCP server did not become ready. Check $LOG_DIR/kite-mcp-server.log" >&2
exit 1
