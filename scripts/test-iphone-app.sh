#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT_DIR/apple-app/InvestmentDashboard.xcodeproj"
DERIVED_DATA="$ROOT_DIR/apple-app/DerivedData"
DESTINATION="${PORTFOLIO_IOS_TEST_DESTINATION:-platform=iOS Simulator,name=iPhone 16}"

if [[ "$(uname -s)" != "Darwin" ]] || ! command -v xcodebuild >/dev/null 2>&1; then
  printf 'Native iPhone tests require macOS with Xcode.\n' >&2
  exit 1
fi

xcodebuild \
  -project "$PROJECT" \
  -scheme InvestmentDashboard \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED_DATA" \
  test
