#!/usr/bin/env bash
# Start Portfolio Intelligence for iPhone install (Tailscale preferred, same-Wi-Fi LAN fallback).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FLASK_PORT="${PORTFOLIO_FLASK_PORT:-5050}"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
PID_FILE="$LOG_DIR/service.pid"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

restart_bound() {
  local bind_host="$1"
  "$ROOT_DIR/scripts/stop-flask-app.sh" >/dev/null 2>&1 || true
  sleep 1
  PORTFOLIO_BIND_HOST="$bind_host" "$ROOT_DIR/scripts/start-flask-app.sh"
}

if ! curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
  "$ROOT_DIR/scripts/start-flask-app.sh"
fi

if ! curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
  printf 'Portfolio Intelligence did not become healthy.\n' >&2
  printf 'Check %s/service.log and %s/vinext.log\n' "$LOG_DIR" "$LOG_DIR" >&2
  exit 1
fi

TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
TAILSCALE_STATUS="$(tailscale status --json 2>/dev/null || true)"
TAILSCALE_DNS_NAME="$(printf '%s' "$TAILSCALE_STATUS" | /usr/bin/jq -er '.Self.DNSName // empty' 2>/dev/null || true)"
TAILSCALE_DNS_NAME="${TAILSCALE_DNS_NAME%.}"

if [[ -n "$TAILSCALE_IP" && -n "$TAILSCALE_DNS_NAME" ]]; then
  if ! curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
    restart_bound "127.0.0.1"
  fi
  if tailscale serve --bg --yes "http://127.0.0.1:$FLASK_PORT" >/dev/null 2>&1; then
    INSTALL_URL="https://${TAILSCALE_DNS_NAME}/install"
    OPEN_URL="https://${TAILSCALE_DNS_NAME}/"
    MODE="tailscale"
  else
    MODE=""
  fi
else
  MODE=""
fi

if [[ -z "${MODE:-}" ]]; then
  # Same trusted Wi-Fi: bind Flask to all interfaces so the iPhone can reach the Mac.
  restart_bound "0.0.0.0"
  LAN_IP="$(lan_ip)"
  if [[ -z "$LAN_IP" ]]; then
    printf 'Could not determine Wi-Fi IP and Tailscale is not connected.\n' >&2
    printf 'Sign into Tailscale on this Mac, or join the same Wi-Fi as your iPhone.\n' >&2
    exit 1
  fi
  INSTALL_URL="http://${LAN_IP}:${FLASK_PORT}/install"
  OPEN_URL="http://${LAN_IP}:${FLASK_PORT}/"
  MODE="lan"
fi

printf '\nPortfolio Intelligence is ready for iPhone.\n'
printf 'Mode:    %s\n' "$MODE"
printf 'Mac:     http://localhost:%s/\n' "$FLASK_PORT"
printf 'iPhone:  %s\n' "$OPEN_URL"
printf 'Install: %s\n' "$INSTALL_URL"
printf '\nOn iPhone (Safari):\n'
printf '  1. Open the Install URL above\n'
printf '  2. Tap Share → Add to Home Screen → Add\n'
if [[ "$MODE" == "lan" ]]; then
  printf '\nLAN mode is active (same Wi-Fi only). Prefer Tailscale for mobile data.\n'
  printf 'Sign into Tailscale, then re-run: npm run iphone\n'
fi
printf 'Logs:    %s\n\n' "$LOG_DIR"

# Open the install guide on this Mac so the URL is easy to copy / AirDrop.
open "$INSTALL_URL" 2>/dev/null || open "http://127.0.0.1:${FLASK_PORT}/install" || true
