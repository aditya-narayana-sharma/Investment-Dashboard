#!/usr/bin/env bash
# Install Portfolio Intelligence as a macOS app in ~/Applications and pin it to the Dock.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Portfolio Intelligence"
APP_DIR="$HOME/Applications/${APP_NAME}.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"
ICON_SRC="$ROOT_DIR/public/app-icon-512.png"
ICONSET_DIR="$(mktemp -d)/AppIcon.iconset"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
DASHBOARD_URL="${PORTFOLIO_DESKTOP_URL:-http://127.0.0.1:5050/}"

mkdir -p "$HOME/Applications" "$MACOS_DIR" "$RESOURCES_DIR" "$LOG_DIR"

if [[ ! -x "$ROOT_DIR/.venv-flask/bin/waitress-serve" ]]; then
  "$ROOT_DIR/scripts/setup-flask-app.sh"
fi

# Ensure the local service is up before creating the Dock app.
if ! curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1; then
  "$ROOT_DIR/scripts/start-flask-app.sh"
fi

NATIVE_SRC="$ROOT_DIR/apple-app/mac/PortfolioIntelligenceMacApp.swift"
NATIVE_BIN="$MACOS_DIR/${APP_NAME}"

if [[ "$(uname -s)" == "Darwin" ]] && command -v swiftc >/dev/null 2>&1; then
  PORTFOLIO_DESKTOP_URL="$DASHBOARD_URL" swiftc -parse-as-library -O -o "$NATIVE_BIN" \
    -sdk "$(xcrun --sdk macosx --show-sdk-path 2>/dev/null || echo /)" \
    -framework AppKit -framework WebKit \
    "$NATIVE_SRC"
  chmod +x "$NATIVE_BIN"
else
  cat > "$NATIVE_BIN" <<EOF
#!/bin/bash
set -euo pipefail
ROOT_DIR=$(printf '%q' "$ROOT_DIR")
LOG_DIR=\$HOME/Library/Logs/PortfolioIntelligence
mkdir -p "\$LOG_DIR"
if ! curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1; then
  /bin/bash "\$ROOT_DIR/scripts/start-flask-app.sh" >>"\$LOG_DIR/desktop-app.log" 2>&1 || true
fi
URL=$(printf '%q' "$DASHBOARD_URL")
NATIVE="\$ROOT_DIR/apple-app/mac/.build/PortfolioIntelligence"
if [[ -x "\$NATIVE" ]]; then
  PORTFOLIO_DESKTOP_URL="\$URL" exec "\$NATIVE"
fi
echo "Native WKWebView app requires macOS swiftc. Falling back to the default browser (not Chrome --app)." >>"\$LOG_DIR/desktop-app.log"
open "\$URL"
EOF
  chmod +x "$NATIVE_BIN"
fi

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
  <string>com.adityasharma.portfolio-intelligence.desktop</string>
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

if [[ -f "$ICON_SRC" ]]; then
  mkdir -p "$ICONSET_DIR"
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$ICON_SRC" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
    sips -z $((size * 2)) $((size * 2)) "$ICON_SRC" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns" >/dev/null
  rm -rf "$(dirname "$ICONSET_DIR")"
fi

# Register with Launch Services and pin to Dock.
 /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_DIR" >/dev/null 2>&1 || true

python3 - "$APP_DIR" <<'PY'
import os, plistlib, subprocess, sys, pathlib
app = pathlib.Path(sys.argv[1]).resolve()
url = app.as_uri() + "/"
domain = "com.apple.dock"
raw = subprocess.check_output(["defaults", "export", domain, "-"], text=False)
data = plistlib.loads(raw)
apps = data.get("persistent-apps", [])

def is_our(tile):
    try:
        return tile.get("tile-data", {}).get("file-data", {}).get("_CFURLString", "").rstrip("/") == url.rstrip("/")
    except Exception:
        return False

apps = [tile for tile in apps if not is_our(tile)]
apps.append({
    "tile-type": "file-tile",
    "tile-data": {
        "file-data": {
            "_CFURLString": url,
            "_CFURLStringType": 15,
        },
        "file-label": "Portfolio Intelligence",
        "bundle-identifier": "com.adityasharma.portfolio-intelligence.desktop",
    },
})
data["persistent-apps"] = apps
tmp = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "portfolio-dock.plist"
tmp.write_bytes(plistlib.dumps(data, fmt=plistlib.FMT_BINARY))
subprocess.check_call(["defaults", "import", domain, str(tmp)])
subprocess.check_call(["killall", "Dock"])
print(f"Pinned to Dock: {app}")
PY

open -a "$APP_NAME" || open "$APP_DIR"

printf '\n%s installed.\n' "$APP_NAME"
printf 'App:  %s\n' "$APP_DIR"
printf 'Dock: pinned and launched\n'
printf 'URL:  %s\n\n' "$DASHBOARD_URL"
