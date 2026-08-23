#!/usr/bin/env bash
# Tear down the Stratji data plane: LaunchAgent, Flask :5050, Vinext :3000,
# and helper listeners started by run-dashboard-service.sh. Idempotent.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
PID_FILE="$LOG_DIR/service.pid"
LOCK_DIR="$LOG_DIR/service.start.lockdir"
LAUNCH_LABEL="com.adityasharma.portfolio-intelligence"
UID_NUM="$(id -u)"
LAUNCH_TARGET="gui/${UID_NUM}/${LAUNCH_LABEL}"

kill_pid_tree() {
  local pid="${1:-}"
  local child
  [[ -n "$pid" ]] || return 0
  kill -0 "$pid" 2>/dev/null || return 0
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_pid_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

wait_pid_gone() {
  local pid="${1:-}"
  local _
  [[ -n "$pid" ]] || return 0
  for _ in {1..20}; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.15
  done
  kill -9 "$pid" 2>/dev/null || true
}

kill_listeners_on_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  [[ -n "$pids" ]] || return 0
  local pid
  for pid in $pids; do
    kill_pid_tree "$pid"
    wait_pid_gone "$pid"
  done
}

wait_until_port_free() {
  local port="$1"
  local pids
  local _
  for _ in {1..40}; do
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
    [[ -z "$pids" ]] && return 0
    sleep 0.25
  done
  return 1
}

# Unload the watchdog first so KeepAlive cannot respawn the stack mid-stop.
launchctl bootout "$LAUNCH_TARGET" >/dev/null 2>&1 || true
launchctl disable "$LAUNCH_TARGET" >/dev/null 2>&1 || true
launchctl remove "$LAUNCH_LABEL" >/dev/null 2>&1 || true
launchctl remove com.adityasharma.portfolio-intelligence.session >/dev/null 2>&1 || true

if [[ -f "$PID_FILE" ]]; then
  SERVICE_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$SERVICE_PID" ]]; then
    kill_pid_tree "$SERVICE_PID"
    wait_pid_gone "$SERVICE_PID"
  fi
  rm -f "$PID_FILE"
fi

# Pattern-scoped leftovers (nohup helpers survive the supervisor PID).
pkill -f "$ROOT_DIR/scripts/run-dashboard-service.sh" >/dev/null 2>&1 || true
pkill -f "$ROOT_DIR/scripts/start-flask-app.sh" >/dev/null 2>&1 || true
pkill -f "$ROOT_DIR/scripts/content-digest-server.mjs" >/dev/null 2>&1 || true
pkill -f "$ROOT_DIR/scripts/pdf-download-server.mjs" >/dev/null 2>&1 || true
pkill -f "$ROOT_DIR/.venv-flask/bin/waitress-serve" >/dev/null 2>&1 || true
pkill -f "$ROOT_DIR/flask_gateway.py" >/dev/null 2>&1 || true

kill_listeners_on_port 5050
kill_listeners_on_port 3000
kill_listeners_on_port 3002
kill_listeners_on_port 3003

wait_until_port_free 5050 || true
wait_until_port_free 3000 || true

# Kite MCP is started by ensure-kite-server.sh for this dashboard only.
KITE_BIN="${KITE_MCP_PROJECT_DIR:-/Users/adityasharma/Documents/GitHub/kite-mcp-server}/kite-mcp-server"
if [[ -x "$KITE_BIN" ]]; then
  pkill -f "$KITE_BIN" >/dev/null 2>&1 || true
fi
KITE_PIDS="$(lsof -nP -iTCP:8080 -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -n "$KITE_PIDS" ]]; then
  for pid in $KITE_PIDS; do
    cmd="$(ps -o comm= -p "$pid" 2>/dev/null || true)"
    case "$cmd" in
      *kite-mcp*) kill_pid_tree "$pid"; wait_pid_gone "$pid" ;;
    esac
  done
fi

rmdir "$LOCK_DIR" 2>/dev/null || true

printf 'Portfolio Intelligence service stopped.\n'
