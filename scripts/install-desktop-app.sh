#!/usr/bin/env bash
# Install Stratji as a macOS app in ~/Applications and pin it to the Dock.
#
# Product path: native AppKit Stratji.app (WKWebView at http://127.0.0.1:5050/).
# Chrome/Edge --app is an explicit fallback only: --chrome or npm run desktop:chrome.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=apple-toolchain.sh
source "$ROOT_DIR/scripts/apple-toolchain.sh"

APP_NAME="Stratji"
APP_DIR="$HOME/Applications/${APP_NAME}.app"
FALLBACK_BUNDLE_ID="com.adityasharma.portfolio-intelligence.desktop"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"
ICON_SRC="$ROOT_DIR/public/app-icon-512.png"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
SUPPORT_DIR="$HOME/Library/Application Support/Stratji"
DASHBOARD_URL="${STRATJI_DASHBOARD_URL:-${PORTFOLIO_DESKTOP_URL:-http://127.0.0.1:5050/}}"
FORCE_CHROME=0

for arg in "$@"; do
  case "$arg" in
    --chrome|--fallback)
      FORCE_CHROME=1
      ;;
    -h|--help)
      printf 'Usage: %s [--chrome]\n' "$(basename "$0")"
      printf '  (default) Build and launch native Stratji.app. Fails if Xcode cannot build it.\n'
      printf '  --chrome  Skip the native target and install the Chrome --app wrapper.\n'
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$arg" >&2
      exit 1
      ;;
  esac
done

if [[ "${STRATJI_DESKTOP_FALLBACK:-}" == "chrome" ]]; then
  FORCE_CHROME=1
fi

install_chrome_fallback() {
  mkdir -p "$HOME/Applications" "$LOG_DIR" "$SUPPORT_DIR"
  printf '%s\n' "$ROOT_DIR" >"$SUPPORT_DIR/repo-root"
  ensure_flask_ready "$ROOT_DIR"

  printf 'Installing Chrome --app fallback for Stratji at %s\n' "$APP_DIR"
  mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
  cat > "$MACOS_DIR/${APP_NAME}" <<EOF
#!/bin/bash
set -euo pipefail
ROOT_DIR=$(printf '%q' "$ROOT_DIR")
LOG_DIR=\$HOME/Library/Logs/PortfolioIntelligence
mkdir -p "\$LOG_DIR"

if ! curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1; then
  /bin/bash "\$ROOT_DIR/scripts/start-flask-app.sh" >>"\$LOG_DIR/desktop-app.log" 2>&1 || true
fi

URL=$(printf '%q' "$DASHBOARD_URL")
if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -na "Google Chrome" --args --app="\$URL" --new-window
elif [[ -d "/Applications/Microsoft Edge.app" ]]; then
  open -na "Microsoft Edge" --args --app="\$URL" --new-window
else
  open "\$URL"
fi
EOF
  chmod +x "$MACOS_DIR/${APP_NAME}"

  cat > "$CONTENTS/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>${APP_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>${FALLBACK_BUNDLE_ID}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

  write_app_icon_icns "$ICON_SRC" "$RESOURCES_DIR/AppIcon.icns"
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_DIR" >/dev/null 2>&1 || true
  pin_app_to_dock "$APP_DIR" "$APP_NAME" "$FALLBACK_BUNDLE_ID"
  open -a "$APP_NAME" || open "$APP_DIR"
  printf '\n%s installed (Chrome --app fallback — not the native Stratji product).\n' "$APP_NAME"
  printf 'App:  %s\n' "$APP_DIR"
  printf 'URL:  %s\n' "$DASHBOARD_URL"
  printf 'Install native Stratji.app with: npm run desktop\n\n'
}

if [[ "$FORCE_CHROME" -eq 1 ]]; then
  install_chrome_fallback
  exit 0
fi

exec "$ROOT_DIR/scripts/install-stratji-macos.sh"
