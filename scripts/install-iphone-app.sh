#!/usr/bin/env bash
# Start the Mac data plane for the native iPhone app (LAN + Bonjour).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT_DIR/scripts/start-remote-app.sh"
