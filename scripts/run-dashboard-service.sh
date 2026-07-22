#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="${PORTFOLIO_FLASK_VENV:-$ROOT_DIR/.venv-flask}"
FLASK_PORT="${PORTFOLIO_FLASK_PORT:-5050}"
UPSTREAM_URL="${DASHBOARD_UPSTREAM:-http://127.0.0.1:3000}"
BIND_HOST="${PORTFOLIO_BIND_HOST:-127.0.0.1}"
NPM_SCRIPT="${PORTFOLIO_NPM_SCRIPT:-start}"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
NPM_BIN="${NPM_BIN:-/opt/homebrew/bin/npm}"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

if [[ ! -x "$VENV_DIR/bin/waitress-serve" ]]; then
  "$ROOT_DIR/scripts/setup-flask-app.sh" >>"$LOG_DIR/setup.log" 2>&1
fi

if [[ ! -x "$NPM_BIN" ]]; then
  printf 'npm was not found at %s\n' "$NPM_BIN" >&2
  exit 1
fi

VINEXT_PID=""
FLASK_PID=""

cleanup() {
  [[ -n "$FLASK_PID" ]] && kill "$FLASK_PID" 2>/dev/null || true
  [[ -n "$VINEXT_PID" ]] && kill "$VINEXT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

"$ROOT_DIR/scripts/ensure-kite-server.sh" >>"$LOG_DIR/kite.log" 2>&1
"$ROOT_DIR/scripts/ensure-pdf-download-server.sh" >>"$LOG_DIR/pdf-download.log" 2>&1
"$ROOT_DIR/scripts/ensure-content-digest-server.sh" >>"$LOG_DIR/content-digest.log" 2>&1
"$ROOT_DIR/scripts/refresh-apple-health.sh" >>"$LOG_DIR/apple-health.log" 2>&1 || true

if ! curl -sf --max-time 3 "$UPSTREAM_URL/" >/dev/null 2>&1; then
  "$NPM_BIN" run "$NPM_SCRIPT" >>"$LOG_DIR/vinext.log" 2>&1 &
  VINEXT_PID=$!
fi

for _ in {1..60}; do
  if curl -sf --max-time 3 "$UPSTREAM_URL/" >/dev/null 2>&1; then
    break
  fi
  if [[ -n "$VINEXT_PID" ]]; then
    kill -0 "$VINEXT_PID" 2>/dev/null || exit 1
  fi
  sleep 1
done

if ! curl -sf --max-time 3 "$UPSTREAM_URL/" >/dev/null 2>&1; then
  printf 'Dashboard upstream did not start. Check %s/vinext.log\n' "$LOG_DIR" >&2
  exit 1
fi

DASHBOARD_UPSTREAM="$UPSTREAM_URL" "$VENV_DIR/bin/waitress-serve" \
  --listen="$BIND_HOST:$FLASK_PORT" --threads=8 --channel-timeout=180 \
  flask_gateway:app >>"$LOG_DIR/flask.log" 2>&1 &
FLASK_PID=$!

for _ in {1..30}; do
  if curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/" >/dev/null 2>&1; then
    break
  fi
  kill -0 "$FLASK_PID" 2>/dev/null || exit 1
  sleep 1
done

if curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/" >/dev/null 2>&1; then
  DASHBOARD_PUBLIC_URL="http://127.0.0.1:$FLASK_PORT" \
    "$ROOT_DIR/scripts/refresh-dashboard-data.sh" >"$LOG_DIR/startup-refresh.log" 2>&1 || true
else
  printf 'Flask gateway did not become ready for the startup refresh audit.\n' >"$LOG_DIR/startup-refresh.log"
fi

while kill -0 "$FLASK_PID" 2>/dev/null; do
  if [[ -n "$VINEXT_PID" ]] && ! kill -0 "$VINEXT_PID" 2>/dev/null; then
    exit 1
  fi
  sleep 5
done

exit 1
