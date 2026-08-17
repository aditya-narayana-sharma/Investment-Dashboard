#!/usr/bin/env bash
# Build Release Stratji.app (AppKit + WKWebView) and install it for local use.
# Chrome --app is not this product. Use: npm run desktop:chrome
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=apple-toolchain.sh
source "$ROOT_DIR/scripts/apple-toolchain.sh"

APP_NAME="Stratji"
USER_APP_DIR="$HOME/Applications/${APP_NAME}.app"
SYSTEM_APP_DIR="/Applications/${APP_NAME}.app"
NATIVE_BUNDLE_ID="com.adityasharma.Stratji"
PROJECT="$ROOT_DIR/apple-app/InvestmentDashboard.xcodeproj"
DERIVED_DATA="$ROOT_DIR/apple-app/DerivedData"
BUILD_COPY="$ROOT_DIR/apple-app/build/Stratji.app"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
SUPPORT_DIR="$HOME/Library/Application Support/Stratji"
DASHBOARD_URL="${STRATJI_DASHBOARD_URL:-${PORTFOLIO_DESKTOP_URL:-http://127.0.0.1:5050/}}"
ICON_SRC="$ROOT_DIR/public/app-icon-512.png"
ICON_ICNS="$ROOT_DIR/apple-app/Stratji/Assets.xcassets/AppIcon.appiconset/Stratji.icns"
ENTITLEMENTS="$ROOT_DIR/apple-app/Stratji/Stratji.entitlements"

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'Stratji.app must be built on macOS.\n' >&2
  exit 1
fi

mkdir -p "$HOME/Applications" "$LOG_DIR" "$SUPPORT_DIR" "$ROOT_DIR/apple-app/build"
printf '%s\n' "$ROOT_DIR" >"$SUPPORT_DIR/repo-root"
defaults write com.adityasharma.Stratji StratjiRepoRoot -string "$ROOT_DIR" >/dev/null 2>&1 || true

ensure_flask_ready "$ROOT_DIR"
"$ROOT_DIR/scripts/install-macos-service.sh" --no-wait || true

if ! resolve_apple_toolchain; then
  print_xcode_required
  printf 'Chrome --app is not the Stratji product. Only if you explicitly want that wrapper:\n' >&2
  printf '  npm run desktop:chrome\n\n' >&2
  exit 1
fi

IDENTITY="$(resolve_codesign_identity)"
TEAM="$(resolve_development_team || true)"
LOG="$LOG_DIR/stratji-xcodebuild.log"

run_stratji_build() {
  local extra_args=("$@")
  apple_xcodebuild \
    -project "$PROJECT" \
    -scheme Stratji \
    -configuration Release \
    -destination 'platform=macOS' \
    -derivedDataPath "$DERIVED_DATA" \
    STRATJI_REPO_ROOT="$ROOT_DIR" \
    "${extra_args[@]}" \
    build
}

printf 'Building native Stratji.app with %s\n' "$XCODEBUILD"
printf 'Developer dir: %s\n' "$DEVELOPER_DIR"
printf 'Code sign identity: %s\n' "$IDENTITY"
if [[ -n "$TEAM" ]]; then
  printf 'Development team: %s\n' "$TEAM"
fi

set +e
if [[ "$IDENTITY" != "-" ]]; then
  SIGN_ARGS=(CODE_SIGN_IDENTITY="$IDENTITY" CODE_SIGN_STYLE=Manual)
  if [[ -n "$TEAM" ]]; then
    SIGN_ARGS+=(DEVELOPMENT_TEAM="$TEAM")
  fi
  run_stratji_build "${SIGN_ARGS[@]}" >"$LOG" 2>&1
  BUILD_STATUS=$?
else
  BUILD_STATUS=1
fi

if [[ "$BUILD_STATUS" -ne 0 ]]; then
  printf 'Development-identity build failed; retrying ad-hoc (codesign -).\n' >&2
  run_stratji_build CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES >"$LOG" 2>&1
  BUILD_STATUS=$?
fi

if [[ "$BUILD_STATUS" -ne 0 ]]; then
  printf 'Ad-hoc Stratji build failed; retrying with CODE_SIGNING_ALLOWED=NO.\n' >&2
  run_stratji_build CODE_SIGNING_ALLOWED=NO >"$LOG" 2>&1
  BUILD_STATUS=$?
fi
set -e

if [[ "$BUILD_STATUS" -ne 0 ]]; then
  printf '\nNative Stratji.app build failed.\n' >&2
  printf 'xcodebuild log: %s\n' "$LOG" >&2
  printf 'Last lines:\n' >&2
  tail -n 60 "$LOG" >&2 || true
  print_xcode_required
  printf 'Chrome --app is not the Stratji product. Only if you explicitly want that wrapper:\n' >&2
  printf '  npm run desktop:chrome\n\n' >&2
  exit 1
fi

BUILT="$(find "$DERIVED_DATA/Build/Products" -maxdepth 2 -name 'Stratji.app' -type d -print -quit || true)"
if [[ -z "$BUILT" || ! -d "$BUILT" ]]; then
  printf 'xcodebuild succeeded but Stratji.app was not found under %s\n' "$DERIVED_DATA/Build/Products" >&2
  exit 1
fi

rm -rf "$BUILD_COPY"
ditto "$BUILT" "$BUILD_COPY"
# ditto preserves the DerivedData bundle directory mtime, which can stay
# hours old on incremental rebuilds. Touch so Finder Get Info matches install.
touch "$BUILD_COPY"

# Running copies keep the old Swift shell in memory.
pkill -x Stratji >/dev/null 2>&1 || true
sleep 0.3
pkill -9 -x Stratji >/dev/null 2>&1 || true

install_bundle() {
  local dest="$1"
  rm -rf "$dest"
  mkdir -p "$(dirname "$dest")"
  ditto "$BUILD_COPY" "$dest"
  touch "$dest"
}

install_bundle "$USER_APP_DIR"

INSTALLED_SYSTEM=0
if install_bundle "$SYSTEM_APP_DIR" 2>/dev/null; then
  INSTALLED_SYSTEM=1
fi

install_app_icon() {
  local dest="$1"
  mkdir -p "$dest/Contents/Resources"
  if [[ -f "$ICON_ICNS" ]]; then
    cp "$ICON_ICNS" "$dest/Contents/Resources/AppIcon.icns"
  elif [[ ! -f "$dest/Contents/Resources/AppIcon.icns" ]]; then
    write_app_icon_icns "$ICON_SRC" "$dest/Contents/Resources/AppIcon.icns"
  fi
}

sign_installed() {
  local dest="$1"
  local sign_identity="$IDENTITY"
  local extra=()
  if [[ -f "$ENTITLEMENTS" ]]; then
    extra+=(--entitlements "$ENTITLEMENTS")
  fi
  /usr/libexec/PlistBuddy -c "Set :StratjiRepoRoot $ROOT_DIR" "$dest/Contents/Info.plist" >/dev/null 2>&1 \
    || /usr/libexec/PlistBuddy -c "Add :StratjiRepoRoot string $ROOT_DIR" "$dest/Contents/Info.plist" >/dev/null 2>&1 \
    || true
  install_app_icon "$dest"
  if ! codesign --force --deep --sign "$sign_identity" "${extra[@]}" "$dest" 2>/dev/null; then
    printf 'Signing with %s failed; using ad-hoc.\n' "$sign_identity" >&2
    codesign --force --deep --sign - "$dest"
    sign_identity="-"
  fi
  printf '%s\n' "$sign_identity"
}

USED_IDENTITY="$(sign_installed "$USER_APP_DIR")"
if [[ "$INSTALLED_SYSTEM" -eq 1 ]]; then
  sign_installed "$SYSTEM_APP_DIR" >/dev/null
fi

install_app_icon "$BUILD_COPY"
codesign --force --deep --sign "$USED_IDENTITY" --entitlements "$ENTITLEMENTS" "$BUILD_COPY" 2>/dev/null \
  || codesign --force --deep --sign - "$BUILD_COPY" >/dev/null

/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$USER_APP_DIR" >/dev/null 2>&1 || true
if [[ "$INSTALLED_SYSTEM" -eq 1 ]]; then
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$SYSTEM_APP_DIR" >/dev/null 2>&1 || true
fi
pin_app_to_dock "$USER_APP_DIR" "$APP_NAME" "$NATIVE_BUNDLE_ID"

printf '\n%s installed (native AppKit, WKWebView).\n' "$APP_NAME"
printf 'App:              %s\n' "$USER_APP_DIR"
if [[ "$INSTALLED_SYSTEM" -eq 1 ]]; then
  printf 'Also copied to:   %s\n' "$SYSTEM_APP_DIR"
else
  printf 'System copy:      skipped (/Applications is not writable; optional: sudo ditto "%s" "%s")\n' "$USER_APP_DIR" "$SYSTEM_APP_DIR"
fi
printf 'Build copy:       %s\n' "$BUILD_COPY"
printf 'URL:              %s\n' "$DASHBOARD_URL"
printf 'Window title:     Stratji\n'
printf 'Signing identity: %s\n' "$USED_IDENTITY"
printf 'Repo path:        %s\n\n' "$ROOT_DIR"
