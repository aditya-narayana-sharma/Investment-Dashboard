#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.adityasharma.portfolio-intelligence"
DOMAIN="gui/$(id -u)"
SOURCE_PLIST="$ROOT_DIR/scripts/$LABEL.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"

mkdir -p "$TARGET_DIR" "$LOG_DIR"

if [[ ! -x "$ROOT_DIR/.venv-flask/bin/waitress-serve" ]]; then
  "$ROOT_DIR/scripts/setup-flask-app.sh"
fi

launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
sleep 1
install -m 0644 "$SOURCE_PLIST" "$TARGET_PLIST"
launchctl bootstrap "$DOMAIN" "$TARGET_PLIST"
launchctl enable "$DOMAIN/$LABEL"
launchctl kickstart -k "$DOMAIN/$LABEL"

for _ in {1..75}; do
  if curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1; then
  printf 'Portfolio Intelligence did not become healthy.\n' >&2
  printf 'Check %s/vinext.log and %s/flask.log\n' "$LOG_DIR" "$LOG_DIR" >&2
  exit 1
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
APP_HOST="${LAN_IP:-$(scutil --get LocalHostName 2>/dev/null || printf 'localhost').local}"

printf '\nPortfolio Intelligence is running as a macOS login service.\n'
printf 'Mac:    http://localhost:5050/\n'
printf 'iPhone: http://%s:5050/\n' "$APP_HOST"
printf 'Install: http://%s:5050/install\n' "$APP_HOST"
printf 'Logs:   %s\n' "$LOG_DIR"
printf 'Stop:   npm run flask:stop\n\n'
