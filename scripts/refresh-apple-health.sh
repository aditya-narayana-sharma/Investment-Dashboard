#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HEALTH_DIR="${APPLE_HEALTH_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Health}"
EXPORT_DIR="${APPLE_HEALTH_EXPORT_DIR:-$HEALTH_DIR/apple_health_export}"
XML_PATH="$EXPORT_DIR/export.xml"
ARCHIVE_STATE="$ROOT_DIR/artifacts/private/apple-health-archive.json"
SNAPSHOT_PATH="${PORTFOLIO_HEALTH_SNAPSHOT_PATH:-$ROOT_DIR/artifacts/private/health-snapshot.json}"
LOCK_DIR="${TMPDIR:-/tmp}/portfolio-health-refresh.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  printf 'Apple Health refresh already running; waiting for the validated snapshot.\n'
  for _ in {1..1500}; do
    [[ ! -d "$LOCK_DIR" ]] && exit 0
    sleep 1
  done
  printf 'Timed out waiting for the in-flight Apple Health refresh.\n' >&2
  exit 1
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

mkdir -p "$ROOT_DIR/artifacts/private" /tmp/portfolio-health-pycache
PYTHONPYCACHEPREFIX=/tmp/portfolio-health-pycache /usr/bin/python3 \
  "$ROOT_DIR/scripts/prepare_apple_health_export.py" \
  --health-dir "$HEALTH_DIR" \
  --export-xml "$XML_PATH" \
  --state "$ARCHIVE_STATE"

if [[ ! -f "$XML_PATH" ]]; then
  printf 'Apple Health export not found: %s\n' "$XML_PATH" >&2
  exit 1
fi

PYTHONPYCACHEPREFIX=/tmp/portfolio-health-pycache /usr/bin/python3 \
  "$ROOT_DIR/scripts/import_apple_health.py" \
  --xml "$XML_PATH" \
  --db "$ROOT_DIR/artifacts/private/apple-health.sqlite3" \
  --snapshot "$SNAPSHOT_PATH" \
  --archive-state "$ARCHIVE_STATE" \
  --overrides "$ROOT_DIR/artifacts/private/health-overrides.json"
