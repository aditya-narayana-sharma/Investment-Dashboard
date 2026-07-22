#!/usr/bin/env bash
set -euo pipefail

LAN_IP="$(ifconfig en0 | awk '/inet / { print $2; exit }')"
APP_HOST="${LAN_IP:-Adis-MBP.local}"

printf 'Portfolio iPhone app: http://%s:3000/\n' "$APP_HOST"
printf 'Keep this Mac awake and on the same trusted Wi-Fi network.\n'

exec npm run dev:lan
