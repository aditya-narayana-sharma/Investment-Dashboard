#!/usr/bin/env bash
set -euo pipefail

# Resolve the Kite MCP checkout without hardcoding an operator's home directory.
# Order: explicit env var, then a sibling of this repository (the documented
# layout), then fail with setup instructions rather than a confusing ENOENT.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SIBLING_KITE_DIR="$(cd "$REPO_ROOT/.." && pwd)/kite-mcp-server"

# Inside a git worktree, REPO_ROOT is .claude/worktrees/<name>, whose sibling is
# not the checkout root. Resolve the main working tree and try its sibling too.
MAIN_SIBLING_KITE_DIR=""
if GIT_COMMON_DIR="$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null)"; then
  case "$GIT_COMMON_DIR" in
    /*) ;;
    *) GIT_COMMON_DIR="$REPO_ROOT/$GIT_COMMON_DIR" ;;
  esac
  if MAIN_ROOT="$(cd "$GIT_COMMON_DIR/.." 2>/dev/null && pwd)"; then
    MAIN_SIBLING_KITE_DIR="$(cd "$MAIN_ROOT/.." && pwd)/kite-mcp-server"
  fi
fi

KITE_DIR="${KITE_MCP_PROJECT_DIR:-}"
if [[ -z "$KITE_DIR" && -d "$SIBLING_KITE_DIR" ]]; then
  KITE_DIR="$SIBLING_KITE_DIR"
fi
if [[ -z "$KITE_DIR" && -n "$MAIN_SIBLING_KITE_DIR" && -d "$MAIN_SIBLING_KITE_DIR" ]]; then
  KITE_DIR="$MAIN_SIBLING_KITE_DIR"
fi
if [[ -z "$KITE_DIR" ]]; then
  cat >&2 <<MSG
KITE_MCP_PROJECT_DIR is not set and no Kite MCP checkout was found at:
  $SIBLING_KITE_DIR

Stratji needs a local Zerodha Kite MCP server to serve live portfolio data.
Clone it beside this repository, or point Stratji at it explicitly:

  export KITE_MCP_PROJECT_DIR="\$HOME/path/to/kite-mcp-server"

See docs/stratji/INSTALL.md and .env.example.
MSG
  exit 1
fi
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
