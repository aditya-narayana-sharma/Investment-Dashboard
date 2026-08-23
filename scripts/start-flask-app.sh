#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
PID_FILE="$LOG_DIR/service.pid"
LOCK_DIR="$LOG_DIR/service.start.lockdir"
NPM_BIN="${NPM_BIN:-/opt/homebrew/bin/npm}"
NPM_SCRIPT="${PORTFOLIO_NPM_SCRIPT:-start}"

mkdir -p "$LOG_DIR"

# Full stack ready: Flask returns HTTP 200 only when vinext upstream is 200.
healthy() {
  curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1
}

# Flask is serving /_flask/health. HTTP 503 means vinext is down, not that :5050 is free.
flask_bound() {
  local body
  body="$(curl -sS --max-time 8 http://127.0.0.1:5050/_flask/health 2>/dev/null || true)"
  printf '%s' "$body" | grep -q '"gateway": "flask"'
}

supervisor_alive() {
  local old_pid
  [[ -f "$PID_FILE" ]] || return 1
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null
}

wait_until_healthy() {
  local tries="${1:-180}"
  local _
  for _ in $(seq 1 "$tries"); do
    if healthy; then
      return 0
    fi
    sleep 1
  done
  return 1
}

port_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

wait_until_ports_free() {
  local tries="${1:-40}"
  local _
  for _ in $(seq 1 "$tries"); do
    if ! port_listening 3000 && ! port_listening 5050; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

# Vinext only. Never bind a second waitress on :5050.
start_vinext_only() {
  if curl -sf --max-time 3 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    return 0
  fi
  printf 'Flask gateway is up; starting Vinext only.\n'
  (
    cd "$ROOT_DIR"
    exec "$NPM_BIN" run "$NPM_SCRIPT" >>"$LOG_DIR/vinext.log" 2>&1
  ) &
  wait_until_healthy 180
}

acquire_start_lock() {
  local waited=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    if flask_bound; then
      if healthy; then
        printf 'Portfolio Intelligence is already running at http://localhost:5050/\n'
        exit 0
      fi
      if supervisor_alive && wait_until_healthy 180; then
        printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
        exit 0
      fi
    fi
    waited=$((waited + 1))
    if (( waited >= 180 )); then
      rmdir "$LOCK_DIR" 2>/dev/null || true
      if ! mkdir "$LOCK_DIR" 2>/dev/null; then
        printf 'Portfolio Intelligence start is already in progress. Check ~/Library/Logs/PortfolioIntelligence/.\n' >&2
        exit 1
      fi
      break
    fi
    sleep 1
  done
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
}

acquire_start_lock

if flask_bound; then
  if healthy; then
    printf 'Portfolio Intelligence is already running at http://localhost:5050/\n'
    exit 0
  fi
  if supervisor_alive; then
    printf 'Existing supervisor will restart Vinext if needed.\n'
    if wait_until_healthy 180; then
      printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
      exit 0
    fi
  fi
  printf 'Leftover Flask on :5050 is not ready; waiting for ports to free before a full start.\n'
  if wait_until_ports_free 40; then
    printf 'Ports :3000 and :5050 are free; starting a full stack.\n'
  elif flask_bound; then
    printf 'Flask gateway is up; not starting a second copy on :5050.\n'
    if start_vinext_only; then
      printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
      exit 0
    fi
    printf 'Flask is up but the dashboard document server did not become ready. Check ~/Library/Logs/PortfolioIntelligence/.\n' >&2
    exit 1
  fi
fi

if supervisor_alive; then
  # A supervisor is already starting. Wait for it instead of killing it.
  if wait_until_healthy 180; then
    printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
    exit 0
  fi
  if supervisor_alive; then
    printf 'Portfolio Intelligence is still starting in the background. Check ~/Library/Logs/PortfolioIntelligence/.\n' >&2
    exit 0
  fi
fi
rm -f "$PID_FILE"

# Headless: launchd / Stratji invoke this with /bin/bash and log redirection.
# Never `open` start-dashboard.command — Launch Services attaches Terminal.app.
# Stratji.app must not Process() this file from ~/Documents (TCC); the
# Application Support wrapper is the executable path.
nohup /bin/bash "$ROOT_DIR/scripts/run-dashboard-service.sh" \
  >>"$LOG_DIR/service.log" 2>&1 &
SERVICE_PID=$!
printf '%s\n' "$SERVICE_PID" >"$PID_FILE"

if wait_until_healthy 180; then
  printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
  exit 0
fi

if [[ -n "$SERVICE_PID" ]] && kill -0 "$SERVICE_PID" 2>/dev/null; then
  printf 'Portfolio Intelligence is still starting in the background. Check ~/Library/Logs/PortfolioIntelligence/.\n' >&2
  exit 0
fi

printf 'Portfolio Intelligence did not start. Check ~/Library/Logs/PortfolioIntelligence/.\n' >&2
exit 1
