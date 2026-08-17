#!/usr/bin/env bash
# Publish the Mac data plane to the native iPhone app on the same Wi-Fi.
# This is LAN + Bonjour. It does not use Tailscale.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FLASK_PORT="${PORTFOLIO_FLASK_PORT:-5050}"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
SUPPORT_DIR="$HOME/Library/Application Support/Stratji"
BIND_FILE="$SUPPORT_DIR/bind-host"

mkdir -p "$LOG_DIR" "$SUPPORT_DIR"
cd "$ROOT_DIR"

lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

printf '0.0.0.0\n' >"$BIND_FILE"
"$ROOT_DIR/scripts/stop-flask-app.sh" >/dev/null 2>&1 || true
sleep 1
PORTFOLIO_BIND_HOST="0.0.0.0" "$ROOT_DIR/scripts/start-flask-app.sh"

if ! curl -sf --max-time 3 "http://127.0.0.1:$FLASK_PORT/_flask/health" >/dev/null 2>&1; then
  printf 'Portfolio Intelligence did not become healthy on the LAN bind.\n' >&2
  printf 'Check %s/service.log and %s/vinext.log\n' "$LOG_DIR" "$LOG_DIR" >&2
  exit 1
fi

LAN_IP="$(lan_ip)"
printf '\nPortfolio Intelligence is ready for the native iPhone app.\n'
printf 'Mac:     http://localhost:%s/\n' "$FLASK_PORT"
if [[ -n "$LAN_IP" ]]; then
  printf 'LAN:     http://%s:%s/\n' "$LAN_IP" "$FLASK_PORT"
fi
printf 'Bonjour: Stratji._stratji._tcp.local\n'
printf 'Pairing: npm run iphone:pair\n'
printf 'Install: npm run iphone:native\n'
printf 'Keep the Mac awake on the same Wi-Fi as the iPhone.\n'
printf 'Logs:    %s\n\n' "$LOG_DIR"
