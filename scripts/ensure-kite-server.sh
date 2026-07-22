#!/usr/bin/env bash
set -euo pipefail

KITE_DIR="${KITE_MCP_PROJECT_DIR:-/Users/adityasharma/Documents/GitHub/kite-mcp-server}"
KITE_URL="${KITE_MCP_SERVER_URL:-http://127.0.0.1:8080}"
LOG_DIR="${TMPDIR:-/tmp}/portfolio-live-dashboard"
BIN="$KITE_DIR/kite-mcp-server"

if curl -sf --max-time 2 "$KITE_URL/" >/dev/null 2>&1; then
  exit 0
fi

if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 8080 is occupied, but the Kite MCP health check failed." >&2
  exit 1
fi

if [[ ! -f "$KITE_DIR/.env" ]]; then
  echo "Kite MCP .env not found at $KITE_DIR/.env" >&2
  exit 1
fi

if [[ ! -x "$BIN" ]]; then
  if [[ -x "$KITE_DIR/start-server.sh" ]]; then
    # Build via the upstream launcher once, then run the binary directly.
    (cd "$KITE_DIR" && go build -o kite-mcp-server main.go) >>"$LOG_DIR/kite-mcp-server.log" 2>&1 || true
  fi
fi

if [[ ! -x "$BIN" ]]; then
  echo "Kite MCP binary not found at $BIN" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
set -a
# shellcheck disable=SC1091
source "$KITE_DIR/.env"
set +a
export APP_MODE=http
export APP_HOST=localhost
export APP_PORT=8080

nohup "$BIN" >>"$LOG_DIR/kite-mcp-server.log" 2>&1 &

for _ in {1..30}; do
  if curl -sf --max-time 2 "$KITE_URL/" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "Kite MCP server did not become ready. Check $LOG_DIR/kite-mcp-server.log" >&2
exit 1
