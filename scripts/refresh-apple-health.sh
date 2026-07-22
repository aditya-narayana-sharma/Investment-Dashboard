#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPORT_DIR="${APPLE_HEALTH_EXPORT_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Health/apple_health_export}"
XML_PATH="$EXPORT_DIR/export.xml"

if [[ ! -f "$XML_PATH" ]]; then
  printf 'Apple Health export not found: %s\n' "$XML_PATH" >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/artifacts/private" /tmp/portfolio-health-pycache
PYTHONPYCACHEPREFIX=/tmp/portfolio-health-pycache /usr/bin/python3 \
  "$ROOT_DIR/scripts/import_apple_health.py" \
  --xml "$XML_PATH" \
  --db "$ROOT_DIR/artifacts/private/apple-health.sqlite3" \
  --snapshot "$ROOT_DIR/artifacts/private/health-snapshot.json"
