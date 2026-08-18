#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
PID_FILE="$LOG_DIR/service.pid"
LOCK_DIR="$LOG_DIR/service.start.lockdir"

mkdir -p "$LOG_DIR"

healthy() {
  curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1
}

acquire_start_lock() {
  local waited=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    if healthy; then
      printf 'Portfolio Intelligence is already running at http://localhost:5050/\n'
      exit 0
    fi
    waited=$((waited + 1))
    if (( waited >= 75 )); then
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

if healthy; then
  printf 'Portfolio Intelligence is already running at http://localhost:5050/\n'
  exit 0
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    # A supervisor is already starting. Wait for it instead of killing it.
    for _ in {1..75}; do
      if healthy; then
        printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
        exit 0
      fi
      if ! kill -0 "$OLD_PID" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if healthy; then
      printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
      exit 0
    fi
  fi
  rm -f "$PID_FILE"
fi

# Headless: launchd / Stratji invoke this with /bin/bash and log redirection.
# Never `open` start-dashboard.command — Launch Services attaches Terminal.app.
# Stratji.app must not Process() this file from ~/Documents (TCC); the
# Application Support wrapper is the executable path.
nohup /bin/bash "$ROOT_DIR/scripts/run-dashboard-service.sh" \
  >>"$LOG_DIR/service.log" 2>&1 &
SERVICE_PID=$!
printf '%s\n' "$SERVICE_PID" >"$PID_FILE"

for _ in {1..90}; do
  if healthy; then
    printf 'Portfolio Intelligence is running at http://localhost:5050/\n'
    exit 0
  fi
  sleep 1
done

if [[ -n "$SERVICE_PID" ]] && kill -0 "$SERVICE_PID" 2>/dev/null; then
  printf 'Portfolio Intelligence is still starting in the background. Check ~/Library/Logs/PortfolioIntelligence/.\n' >&2
  exit 0
fi

printf 'Portfolio Intelligence did not start. Check ~/Library/Logs/PortfolioIntelligence/.\n' >&2
exit 1
