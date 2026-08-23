#!/usr/bin/env bash
set -euo pipefail

# Page iCloud → Newsletters and iCloud → Axis Research oldest-unseen → newest
# into the Satya FTS corpus. Does not write the M-2 content snapshot.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export SATYA_BACKFILL_DAYS="${SATYA_BACKFILL_DAYS:-90}"

exec node "$ROOT_DIR/scripts/satya-ingest.mjs" backfill
