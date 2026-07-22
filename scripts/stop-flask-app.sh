#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
PID_FILE="$LOG_DIR/service.pid"

# Remove legacy launchd instances created by older dashboard versions.
launchctl remove com.adityasharma.portfolio-intelligence.session >/dev/null 2>&1 || true

if [[ -f "$PID_FILE" ]]; then
  SERVICE_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$SERVICE_PID" ]] && kill -0 "$SERVICE_PID" 2>/dev/null; then
    kill "$SERVICE_PID" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "$SERVICE_PID" 2>/dev/null || break
      sleep .25
    done
  fi
  rm -f "$PID_FILE"
fi

printf 'Portfolio Intelligence service stopped.\n'
