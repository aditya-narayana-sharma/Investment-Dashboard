#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FLASK_PORT="${PORTFOLIO_FLASK_PORT:-5050}"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
TAILSCALE_STATUS="$(tailscale status --json 2>/dev/null || true)"
TAILSCALE_DNS_NAME="$(printf '%s' "$TAILSCALE_STATUS" | /usr/bin/jq -er '.Self.DNSName // empty' 2>/dev/null || true)"
TAILSCALE_DNS_NAME="${TAILSCALE_DNS_NAME%.}"
if [[ -z "$TAILSCALE_IP" || -z "$TAILSCALE_DNS_NAME" ]]; then
  printf 'Tailscale is not connected. Open Tailscale and sign in first.\n' >&2
  exit 1
fi

if ! curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
  "$ROOT_DIR/scripts/start-flask-app.sh"
fi

if ! curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
  printf 'Portfolio Intelligence did not become healthy.\n' >&2
  printf 'Check %s/service.log and %s/vinext.log\n' "$LOG_DIR" "$LOG_DIR" >&2
  exit 1
fi

tailscale serve --bg --yes "http://127.0.0.1:$FLASK_PORT" >/dev/null

printf '\nPortfolio Intelligence is running.\n'
printf 'Mac:    http://localhost:%s/\n' "$FLASK_PORT"
printf 'Remote: https://%s/\n' "$TAILSCALE_DNS_NAME"
printf 'Mobile-data access is active through Tailscale.\n'
printf 'Logs:   %s\n' "$LOG_DIR"
printf 'Keep the Mac awake and logged in for remote access.\n\n'
