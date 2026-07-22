#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT_DIR/apple-app/InvestmentDashboard.xcodeproj"
DERIVED_DATA="$ROOT_DIR/apple-app/DerivedData"
DEVICE_ID="${PORTFOLIO_IOS_DEVICE_ID:-}"
SCHEME="InvestmentDashboard"

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'The native iPhone app must be built on macOS with Xcode.\n' >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1 || ! command -v xcrun >/dev/null 2>&1; then
  printf 'Xcode command-line tools are required.\n' >&2
  exit 1
fi

if [[ -z "$DEVICE_ID" ]]; then
  printf 'Set PORTFOLIO_IOS_DEVICE_ID to the paired iPhone identifier.\n' >&2
  printf 'Connected devices:\n' >&2
  xcrun devicectl list devices 2>/dev/null || true
  exit 1
fi

printf 'Building Portfolio Intelligence for iPhone %s...\n' "$DEVICE_ID"
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "platform=iOS,id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates \
  build

APP_PATH="$DERIVED_DATA/Build/Products/Release-iphoneos/InvestmentDashboard.app"
if [[ ! -d "$APP_PATH" ]]; then
  printf 'The signed app bundle was not produced at %s\n' "$APP_PATH" >&2
  exit 1
fi

printf 'Installing %s...\n' "$APP_PATH"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

printf '\nPortfolio Intelligence installed on the iPhone.\n'
printf 'Next steps:\n'
printf '  1. Run npm run remote on the Mac\n'
printf '  2. Run npm run iphone:pair for the HealthKit code\n'
printf '  3. Open the app and complete onboarding\n\n'
