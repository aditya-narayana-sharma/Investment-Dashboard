#!/usr/bin/env bash
# Build a Release iOS InvestmentDashboard.app and install it on a connected iPhone
# when one is available. Always writes an artifact under apple-app/build/.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=apple-toolchain.sh
source "$ROOT_DIR/scripts/apple-toolchain.sh"

PROJECT="$ROOT_DIR/apple-app/InvestmentDashboard.xcodeproj"
DERIVED_DATA="$ROOT_DIR/apple-app/DerivedData"
BUILD_DIR="$ROOT_DIR/apple-app/build"
LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
DEVICE_ID="${PORTFOLIO_IOS_DEVICE_ID:-}"
SCHEME="InvestmentDashboard"
BUNDLE_ID="com.adityasharma.InvestmentDashboard"

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'The native iPhone app must be built on macOS with Xcode.\n' >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$LOG_DIR"

if ! resolve_apple_toolchain; then
  print_xcode_required
  exit 1
fi

TEAM="$(resolve_development_team || true)"
LOG="$LOG_DIR/iphone-xcodebuild.log"
: >"$LOG"

printf 'Using Xcode at %s\n' "$DEVELOPER_DIR"
if [[ -n "$TEAM" ]]; then
  printf 'Development team: %s\n' "$TEAM"
fi

SIGN_ARGS=()
if [[ -n "$TEAM" ]]; then
  SIGN_ARGS+=(CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM")
fi

list_destinations() {
  apple_xcodebuild \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -showdestinations 2>/dev/null || true
}

pick_physical_iphone_id() {
  local tmp
  tmp="$(mktemp)"
  list_destinations >"$tmp"
  python3 - "$tmp" <<'PY'
import sys, re
text = open(sys.argv[1]).read()
physical = []
for raw in re.findall(r"\{([^}]+)\}", text):
    fields = {}
    for part in raw.split(","):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        fields[key.strip()] = value.strip()
    platform = fields.get("platform", "")
    ident = fields.get("id", "")
    name = fields.get("name", "")
    if platform != "iOS" or not ident:
        continue
    if "placeholder" in ident.lower() or name.lower() == "any ios device":
        continue
    physical.append(ident)
if physical:
    print(physical[0])
    raise SystemExit(0)
raise SystemExit(1)
PY
  local status=$?
  rm -f "$tmp"
  return "$status"
}

pick_iphone_simulator_destination() {
  local tmp
  tmp="$(mktemp)"
  list_destinations >"$tmp"
  python3 - "$tmp" <<'PY'
import sys, re
text = open(sys.argv[1]).read()
candidates = []
for raw in re.findall(r"\{([^}]+)\}", text):
    fields = {}
    for part in raw.split(","):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        fields[key.strip()] = value.strip()
    platform = fields.get("platform", "")
    ident = fields.get("id", "")
    name = fields.get("name", "")
    arch = fields.get("arch", "")
    osver = fields.get("OS", "")
    if platform != "iOS Simulator" or "placeholder" in ident.lower():
        continue
    if "iphone" not in name.lower():
        continue
    score = 0
    if arch == "arm64":
        score += 10
    if "pro" in name.lower():
        score += 2
    try:
        score += int(osver.split(".")[0])
    except Exception:
        pass
    candidates.append((score, ident, name, osver, arch))
if not candidates:
    raise SystemExit(1)
candidates.sort(reverse=True)
_, ident, name, osver, arch = candidates[0]
print(f"platform=iOS Simulator,id={ident}")
PY
  local status=$?
  rm -f "$tmp"
  return "$status"
}

if [[ -z "$DEVICE_ID" ]]; then
  if DEVICE_ID="$(pick_physical_iphone_id)"; then
    printf 'Auto-detected physical iPhone: %s\n' "$DEVICE_ID"
  else
    DEVICE_ID=""
    printf 'No physical iPhone connected (set PORTFOLIO_IOS_DEVICE_ID to override).\n'
  fi
fi

run_ios_build() {
  local destination="$1"
  local label="$2"
  printf 'Building %s (%s)...\n' "$SCHEME" "$destination"
  {
    printf '\n===== %s =====\n' "$label"
    apple_xcodebuild \
      -project "$PROJECT" \
      -scheme "$SCHEME" \
      -configuration Release \
      -destination "$destination" \
      -derivedDataPath "$DERIVED_DATA" \
      -allowProvisioningUpdates \
      "${SIGN_ARGS[@]}" \
      build
  } >>"$LOG" 2>&1
}

DESTINATION=""
KIND=""
if [[ -n "$DEVICE_ID" ]]; then
  DESTINATION="platform=iOS,id=$DEVICE_ID"
  KIND="device"
  set +e
  run_ios_build "$DESTINATION" "device:$DEVICE_ID"
  BUILD_STATUS=$?
  set -e
else
  BUILD_STATUS=1
fi

if [[ "$BUILD_STATUS" -ne 0 ]]; then
  DESTINATION="generic/platform=iOS"
  KIND="generic"
  set +e
  run_ios_build "$DESTINATION" "generic/platform=iOS"
  BUILD_STATUS=$?
  set -e
fi

if [[ "$BUILD_STATUS" -ne 0 ]]; then
  if SIM_DESTINATION="$(pick_iphone_simulator_destination)"; then
    DESTINATION="$SIM_DESTINATION"
    KIND="simulator"
    printf 'Physical/generic iOS build failed; retrying simulator %s.\n' "$SIM_DESTINATION" >&2
    set +e
    run_ios_build "$DESTINATION" "simulator:$SIM_DESTINATION"
    BUILD_STATUS=$?
    set -e
  fi
fi

if [[ "$BUILD_STATUS" -ne 0 ]]; then
  printf '\nNative iPhone app build failed.\n' >&2
  printf 'xcodebuild log: %s\n' "$LOG" >&2
  printf 'Last lines:\n' >&2
  tail -n 80 "$LOG" >&2 || true
  printf '\nXcode is available at %s.\n' "$DEVELOPER_DIR" >&2
  printf 'Next steps:\n' >&2
  printf '  1. Open apple-app/InvestmentDashboard.xcodeproj\n' >&2
  printf '  2. Select the InvestmentDashboard target → Signing & Capabilities\n' >&2
  printf '  3. Choose the Apple Development team already on this Mac (do not invent an Apple ID).\n' >&2
  if [[ -n "$TEAM" ]]; then
    printf '     Detected team: %s\n' "$TEAM" >&2
  fi
  printf '  4. Connect and trust a physical iPhone, enable Developer Mode, then:\n' >&2
  printf '       PORTFOLIO_IOS_DEVICE_ID="<udid>" npm run iphone:native\n' >&2
  printf '     UDID from: DEVELOPER_DIR="%s" xcrun devicectl list devices\n\n' "$DEVELOPER_DIR" >&2
  exit 1
fi

APP_PATH=""
for candidate in \
  "$DERIVED_DATA/Build/Products/Release-iphoneos/InvestmentDashboard.app" \
  "$DERIVED_DATA/Build/Products/Release-iphonesimulator/InvestmentDashboard.app"
do
  if [[ -d "$candidate" ]]; then
    APP_PATH="$candidate"
    break
  fi
done

if [[ -z "$APP_PATH" ]]; then
  APP_PATH="$(find "$DERIVED_DATA/Build/Products" -maxdepth 2 -name 'InvestmentDashboard.app' -type d -print -quit || true)"
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  printf 'xcodebuild succeeded but InvestmentDashboard.app was not produced under %s\n' "$DERIVED_DATA/Build/Products" >&2
  exit 1
fi

ARTIFACT="$BUILD_DIR/$(basename "$(dirname "$APP_PATH")")/InvestmentDashboard.app"
mkdir -p "$(dirname "$ARTIFACT")"
rm -rf "$ARTIFACT"
ditto "$APP_PATH" "$ARTIFACT"
rm -rf "$BUILD_DIR/InvestmentDashboard.app"
ditto "$APP_PATH" "$BUILD_DIR/InvestmentDashboard.app"

printf '\nRelease iOS artifact (%s):\n' "$KIND"
printf '  %s\n' "$ARTIFACT"
printf '  %s\n' "$BUILD_DIR/InvestmentDashboard.app"

INSTALLED=0
if [[ "$KIND" == "device" && -n "$DEVICE_ID" ]]; then
  printf 'Installing on device %s...\n' "$DEVICE_ID"
  if xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"; then
    INSTALLED=1
    printf '\nPortfolio Intelligence installed on the iPhone.\n'
  else
    printf '\nThe .app was built but devicectl install failed. Open Xcode, select the iPhone, and press Run.\n' >&2
  fi
else
  printf '\nNo physical iPhone install was performed.\n'
  printf 'This script does not upload to TestFlight.\n'
  printf 'Install on a phone:\n'
  printf '  1. Connect the iPhone, trust this Mac, and enable Developer Mode if prompted.\n'
  printf '  2. Open apple-app/InvestmentDashboard.xcodeproj, select InvestmentDashboard, choose your team.\n'
  printf '  3. Product → Destination → the iPhone, then Run.\n'
  printf '     or: PORTFOLIO_IOS_DEVICE_ID="<udid>" npm run iphone:native\n'
  printf '  4. Optional IPA (only if you have a distribution identity): Product → Archive in Xcode.\n'
fi

printf '\nNext steps after the app is on the iPhone:\n'
printf '  1. npm run remote          # LAN bind + Bonjour (no Tailscale)\n'
printf '  2. npm run iphone:pair     # pairing code on the Mac\n'
printf '  3. Open the app, pick the discovered Mac, enter the pairing code, grant Health access\n'
printf 'Bundle id: %s\n\n' "$BUNDLE_ID"

if [[ "$INSTALLED" -eq 1 ]]; then
  exit 0
fi
exit 0
