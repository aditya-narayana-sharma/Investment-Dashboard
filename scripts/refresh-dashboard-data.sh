#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${DASHBOARD_PUBLIC_URL:-http://127.0.0.1:${PORTFOLIO_FLASK_PORT:-5050}}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_JSON="${PORTFOLIO_STARTUP_AUDIT_PATH:-$ROOT_DIR/artifacts/private/startup-audit.json}"
SECTORS=(pharma power infrastructure auto telecom banking nbfc fmcg consumer energy defence)
FAILURES=0
FAILED_NAMES=()
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

check_source() {
  local name="$1"
  local path="$2"
  local expected_status="$3"
  local require_d1="${4:-false}"
  local code
  local body
  local status
  local data_date
  body="$(mktemp)"
  code="$(curl -sS --max-time 90 -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o "$body" -w '%{http_code}' "${BASE_URL}${path}" 2>/dev/null || true)"
  status="$(/usr/bin/python3 -c 'import json,sys
try: print(json.load(open(sys.argv[1])).get("status", "missing"))
except Exception: print("invalid_json")' "$body")"
  data_date="$(/usr/bin/python3 -c 'import json,sys
try: print(json.load(open(sys.argv[1])).get("dataDate", ""))
except Exception: print("")' "$body")"

  local semantic_ok=false
  if [[ "$code" =~ ^2 && "$status" == "$expected_status" ]]; then
    semantic_ok=true
  fi
  if [[ "$semantic_ok" == true && "$require_d1" == true ]]; then
    local required_date
    required_date="$(date -v-1d '+%Y-%m-%d')"
    [[ "$data_date" < "$required_date" ]] && semantic_ok=false
  fi

  if [[ "$semantic_ok" == true ]]; then
    printf '%s\tOK\tHTTP %s · status=%s%s\n' "$name" "$code" "$status" "${data_date:+ · dataDate=$data_date}"
  else
    printf '%s\tFAILED\tHTTP %s · status=%s%s · expected=%s%s\n' "$name" "${code:-000}" "$status" "${data_date:+ · dataDate=$data_date}" "$expected_status" "$([[ "$require_d1" == true ]] && printf ' through D-1')"
    FAILURES=$((FAILURES + 1))
    FAILED_NAMES+=("${name} (${status:-missing})")
  fi
  rm -f "$body"
}

printf 'Complete dashboard refresh audit\n'
printf 'Started\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
"$(cd "$(dirname "$0")" && pwd)/refresh-apple-health.sh" >/dev/null 2>&1 || true
check_source "Kite portfolio" "/api/kite/snapshot?startup=$(date +%s)" "live"
check_source "Mail and Podcasts" "/api/content/refresh?force=1&startup=$(date +%s)" "live"
check_source "Earnings calendar" "/api/earnings/snapshot?startup=$(date +%s)" "verified"
check_source "HealthKit D-1 snapshot" "/_health/snapshot?startup=$(date +%s)" "live" "true"
for sector in "${SECTORS[@]}"; do
  check_source "Sector: ${sector}" "/api/sectors/snapshot?sector=${sector}&startup=$(date +%s)" "live"
done
printf 'Finished\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
printf 'Failures\t%s\n' "$FAILURES"

FAILED_CSV="$(IFS=', '; echo "${FAILED_NAMES[*]-}")"
mkdir -p "$(dirname "$AUDIT_JSON")"
/usr/bin/python3 - "$AUDIT_JSON" "$FAILURES" "$FAILED_CSV" <<'PY'
import json, sys
from datetime import datetime, timezone
path, failures, failed_csv = sys.argv[1], int(sys.argv[2]), sys.argv[3]
failed = [part.strip() for part in failed_csv.split(",") if part.strip()] if failed_csv else []
if failures == 0:
  message = "Complete dashboard refresh audit passed."
else:
  kite_hint = " Authenticate Kite to restore live portfolio and sector quotes." if any(item.lower().startswith("kite") for item in failed) else ""
  message = f"Startup refresh audit reported {failures} failed source check(s): {'; '.join(failed)}.{kite_hint} Inspect startup-refresh.log."
payload = {
  "status": "ok" if failures == 0 else "failed",
  "failures": failures,
  "failedSources": failed,
  "finishedAt": datetime.now(timezone.utc).isoformat(),
  "message": message,
}
with open(path, "w", encoding="utf-8") as handle:
  json.dump(payload, handle, indent=2)
  handle.write("\n")
PY

exit "$((FAILURES > 0))"
