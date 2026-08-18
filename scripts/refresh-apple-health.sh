#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HEALTH_DIR="${APPLE_HEALTH_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Health}"
EXPORT_DIR="${APPLE_HEALTH_EXPORT_DIR:-$HEALTH_DIR/apple_health_export}"
XML_PATH="$EXPORT_DIR/export.xml"
ARCHIVE_STATE="$ROOT_DIR/artifacts/private/apple-health-archive.json"
SNAPSHOT_PATH="${PORTFOLIO_HEALTH_SNAPSHOT_PATH:-$ROOT_DIR/artifacts/private/health-snapshot.json}"
DB_PATH="$ROOT_DIR/artifacts/private/apple-health.sqlite3"
OVERRIDES_PATH="$ROOT_DIR/artifacts/private/health-overrides.json"
LOCK_DIR="${TMPDIR:-/tmp}/portfolio-health-refresh.lock"

IF_CHANGED=0
if [[ "${1:-}" == "--if-changed" ]]; then
  IF_CHANGED=1
fi

health_export_unchanged() {
  /usr/bin/python3 - "$HEALTH_DIR" "$XML_PATH" "$DB_PATH" "$SNAPSHOT_PATH" <<'PY'
import sqlite3
import sys
from pathlib import Path

health_dir, xml_path, db_path, snapshot_path = map(Path, sys.argv[1:])
if not xml_path.exists() or not snapshot_path.exists() or not db_path.exists():
    raise SystemExit(1)
zips = sorted(health_dir.glob("*.zip"), key=lambda path: path.stat().st_mtime_ns, reverse=True)
if zips and zips[0].stat().st_mtime_ns > xml_path.stat().st_mtime_ns:
    raise SystemExit(1)
if snapshot_path.stat().st_mtime_ns < xml_path.stat().st_mtime_ns:
    raise SystemExit(1)
db = sqlite3.connect(db_path)
row = db.execute("SELECT size, mtime_ns FROM imports WHERE path=?", (str(xml_path),)).fetchone()
if not row:
    raise SystemExit(1)
stat = xml_path.stat()
if int(row[0]) != stat.st_size or int(row[1]) != stat.st_mtime_ns:
    raise SystemExit(1)
raise SystemExit(0)
PY
}

import_health_shortcut_if_present() {
  local candidates=(
    "$HEALTH_DIR/Health Stats.csv"
    "$HEALTH_DIR/Health Stats.numbers"
    "$HOME/Library/Mobile Documents/com~apple~Numbers/Documents/Health Stats.csv"
    "$HOME/Library/Mobile Documents/com~apple~Numbers/Documents/Health Stats.numbers"
    "$ROOT_DIR/artifacts/private/Health Stats.csv"
  )
  local input
  for input in "${candidates[@]}"; do
    if [[ -f "$input" ]]; then
      PYTHONPYCACHEPREFIX=/tmp/portfolio-health-pycache /usr/bin/python3 \
        "$ROOT_DIR/scripts/import_health_shortcut.py" \
        --input "$input" \
        --out "$OVERRIDES_PATH" \
        --merge \
        || printf 'Health Shortcut import skipped for %s\n' "$input"
      return 0
    fi
  done
  return 1
}

run_apple_health_import() {
  PYTHONPYCACHEPREFIX=/tmp/portfolio-health-pycache /usr/bin/python3 \
    "$ROOT_DIR/scripts/import_apple_health.py" \
    --xml "$XML_PATH" \
    --db "$DB_PATH" \
    --snapshot "$SNAPSHOT_PATH" \
    --archive-state "$ARCHIVE_STATE" \
    --overrides "$OVERRIDES_PATH"
}

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

if [[ "$IF_CHANGED" == "1" ]] && health_export_unchanged; then
  printf 'Apple Health export unchanged; skipped re-extract.\n'
  if import_health_shortcut_if_present; then
    mkdir -p "$ROOT_DIR/artifacts/private" /tmp/portfolio-health-pycache
    run_apple_health_import
  fi
  exit 0
fi

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

import_health_shortcut_if_present || true

run_apple_health_import
