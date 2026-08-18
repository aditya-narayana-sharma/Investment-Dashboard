#!/usr/bin/env bash
# Register the user LaunchAgent that runs the Stratji / Portfolio Intelligence
# data plane. Stratji.app kickstarts this job instead of executing scripts
# from ~/Documents (TCC blocks that).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.adityasharma.portfolio-intelligence"
DOMAIN="gui/$(id -u)"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
SUPPORT_DIR="$HOME/Library/Application Support/Stratji"
TRAMPOLINE="$SUPPORT_DIR/run-service.sh"
NO_WAIT=0

for arg in "$@"; do
  case "$arg" in
    --no-wait) NO_WAIT=1 ;;
  esac
done

mkdir -p "$TARGET_DIR" "$LOG_DIR" "$SUPPORT_DIR"
printf '%s\n' "$ROOT_DIR" >"$SUPPORT_DIR/repo-root"
defaults write com.adityasharma.Stratji StratjiRepoRoot -string "$ROOT_DIR" >/dev/null 2>&1 || true

if [[ ! -x "$ROOT_DIR/.venv-flask/bin/waitress-serve" ]]; then
  "$ROOT_DIR/scripts/setup-flask-app.sh"
fi

cat >"$TRAMPOLINE" <<EOF
#!/bin/bash
set -euo pipefail
LOG_DIR="\$HOME/Library/Logs/PortfolioIntelligence"
START_SCRIPT="$SUPPORT_DIR/start-dashboard.command"
mkdir -p "\$LOG_DIR"
healthy() {
  curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1
}
while true; do
  if healthy; then
    sleep 12
    continue
  fi
  # Invoke with bash. Never \`open\` a .command file — Launch Services attaches Terminal.app.
  if [[ -f "\$START_SCRIPT" ]]; then
    /bin/bash "\$START_SCRIPT" >>"\$LOG_DIR/desktop-app.log" 2>&1 || true
  fi
  sleep 20
done
EOF
chmod 755 "$TRAMPOLINE"

cat >"$SUPPORT_DIR/start-dashboard.command" <<EOF
#!/bin/bash
# Headless wrapper. Invoke with /bin/bash — do not \`open\` this .command file.
set -euo pipefail
ROOT_DIR=\$(cat "$SUPPORT_DIR/repo-root" 2>/dev/null || true)
if [[ -z "\$ROOT_DIR" || ! -d "\$ROOT_DIR" ]]; then
  ROOT_DIR=$(printf '%q' "$ROOT_DIR")
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
exec /bin/bash "\$ROOT_DIR/scripts/start-flask-app.sh"
EOF
chmod 755 "$SUPPORT_DIR/start-dashboard.command"

cat >"$TARGET_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${TRAMPOLINE}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${SUPPORT_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ProcessType</key>
  <string>Background</string>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd.err.log</string>
</dict>
</plist>
EOF

if curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1; then
  launchctl bootstrap "$DOMAIN" "$TARGET_PLIST" >/dev/null 2>&1 || true
  launchctl enable "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
else
  launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
  sleep 1
  launchctl bootstrap "$DOMAIN" "$TARGET_PLIST"
  launchctl enable "$DOMAIN/$LABEL"
  launchctl kickstart "$DOMAIN/$LABEL"
fi

if [[ "$NO_WAIT" -eq 1 ]]; then
  printf 'Registered LaunchAgent %s (kickstarted, not waiting for health).\n' "$LABEL"
  exit 0
fi

for _ in {1..90}; do
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
