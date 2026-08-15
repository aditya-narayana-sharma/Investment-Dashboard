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

# channel-timeout must cover long Mail/Podcast force refreshes proxied through Flask.
DASHBOARD_UPSTREAM="$UPSTREAM_URL" "$VENV_DIR/bin/waitress-serve" \
  --listen="$BIND_HOST:$FLASK_PORT" --threads=8 --channel-timeout=360 \
  flask_gateway:app >>"$LOG_DIR/flask.log" 2>&1 &
FLASK_PID=$!

for _ in {1..30}; do
  if curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
    break
  fi
  kill -0 "$FLASK_PID" 2>/dev/null || exit 1
  sleep 1
done

# Re-assert helpers immediately before the audit so a raced restart cannot leave
# Kite MCP / content digest down while Flask is briefly healthy.
"$ROOT_DIR/scripts/ensure-kite-server.sh" >>"$LOG_DIR/kite.log" 2>&1 || true
"$ROOT_DIR/scripts/ensure-content-digest-server.sh" >>"$LOG_DIR/content-digest.log" 2>&1 || true

if curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
  set +e
  DASHBOARD_PUBLIC_URL="http://127.0.0.1:$FLASK_PORT" \
    "$ROOT_DIR/scripts/refresh-dashboard-data.sh" >"$LOG_DIR/startup-refresh.log" 2>&1
  AUDIT_EXIT=$?
  set -e
  if [[ "$AUDIT_EXIT" -ne 0 ]]; then
    printf 'Startup refresh audit FAILED (exit %s). Dashboard remains up; inspect the compact freshness strip and %s/startup-refresh.log\n' "$AUDIT_EXIT" "$LOG_DIR" | tee -a "$LOG_DIR/service.log"
  else
    printf 'Startup refresh audit passed.\n' | tee -a "$LOG_DIR/service.log"
  fi
else
  printf 'Flask gateway did not become ready for the startup refresh audit.\n' >"$LOG_DIR/startup-refresh.log"
  mkdir -p "$ROOT_DIR/artifacts/private"
  printf '%s\n' '{"status":"failed","failures":1,"finishedAt":"","message":"Flask gateway did not become ready for the startup refresh audit."}' >"$ROOT_DIR/artifacts/private/startup-audit.json"
fi

UPSTREAM_FAILURES=0
while kill -0 "$FLASK_PID" 2>/dev/null; do
  if ! curl -sf --max-time 8 "$UPSTREAM_URL/" >/dev/null 2>&1; then
    UPSTREAM_FAILURES=$((UPSTREAM_FAILURES + 1))
    if (( UPSTREAM_FAILURES < 3 )); then
      printf 'Upstream probe missed during load (%s/3); deferring restart.\n' "$UPSTREAM_FAILURES" >>"$LOG_DIR/service.log"
      sleep 5
      continue
    fi
    printf 'Upstream down; restarting Vinext.\n' >>"$LOG_DIR/service.log"
    if [[ -n "$VINEXT_PID" ]]; then
      kill "$VINEXT_PID" 2>/dev/null || true
      wait "$VINEXT_PID" 2>/dev/null || true
      VINEXT_PID=""
    fi
    "$NPM_BIN" run "$NPM_SCRIPT" >>"$LOG_DIR/vinext.log" 2>&1 &
    VINEXT_PID=$!
    for _ in {1..45}; do
      if curl -sf --max-time 3 "$UPSTREAM_URL/" >/dev/null 2>&1; then
        break
      fi
      kill -0 "$VINEXT_PID" 2>/dev/null || break
      sleep 1
    done
    UPSTREAM_FAILURES=0
  elif [[ -n "$VINEXT_PID" ]] && ! kill -0 "$VINEXT_PID" 2>/dev/null; then
    # Orphaned healthy listener (started outside this supervisor): keep serving.
    VINEXT_PID=""
    UPSTREAM_FAILURES=0
  else
    UPSTREAM_FAILURES=0
  fi
  "$ROOT_DIR/scripts/ensure-kite-server.sh" >>"$LOG_DIR/kite.log" 2>&1 || true
  "$ROOT_DIR/scripts/ensure-content-digest-server.sh" >>"$LOG_DIR/content-digest.log" 2>&1 || true
  sleep 5
done

exit 1
