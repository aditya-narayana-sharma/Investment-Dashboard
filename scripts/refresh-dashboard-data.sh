#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${DASHBOARD_PUBLIC_URL:-http://127.0.0.1:${PORTFOLIO_FLASK_PORT:-5050}}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_JSON="${PORTFOLIO_STARTUP_AUDIT_PATH:-$ROOT_DIR/artifacts/private/startup-audit.json}"
SECTORS=(pharma power infrastructure auto telecom banking nbfc fmcg consumer energy defence)
FAILURES=0
FAILED_NAMES=()
HEALTH_REQUIRED_DATE="$(/usr/bin/python3 "$ROOT_DIR/scripts/health_date_policy.py" --date-only)"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

check_source() {
  local name="$1"
  local path="$2"
  local expected_status="$3"
  local require_d1="${4:-false}"
  local max_time="${5:-90}"
  check_source_any "$name" "$path" "$expected_status" "$require_d1" "$max_time"
}

check_source_any() {
  local name="$1"
  local path="$2"
  local expected_pattern="$3"
  local require_d1="${4:-false}"
  local max_time="${5:-90}"
  local code
  local body
  local status
  local data_date
  local source_detail=""
  body="$(mktemp)"
  code="$(curl -sS --max-time "$max_time" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o "$body" -w '%{http_code}' "${BASE_URL}${path}" 2>/dev/null || true)"
  if [[ -z "$code" || "$code" == "000" ]]; then
    status="unreachable"
    data_date=""
  else
    status="$(/usr/bin/python3 -c 'import json,sys
try: print(json.load(open(sys.argv[1])).get("status", "missing"))
except Exception: print("invalid_json")' "$body")"
    data_date="$(/usr/bin/python3 -c 'import json,sys
try: print(json.load(open(sys.argv[1])).get("dataDate", ""))
except Exception: print("")' "$body")"
    source_detail="$(/usr/bin/python3 -c 'import json,sys
try:
  payload=json.load(open(sys.argv[1]))
  parts=[]
  if payload.get("authStatus"): parts.append("auth=" + str(payload["authStatus"]))
  unavailable=payload.get("unavailableSections") or []
  if unavailable: parts.append("unavailable=" + ",".join(map(str, unavailable)))
  print(" · ".join(parts))
except Exception: print("")' "$body")"
  fi

  local semantic_ok=false
  if [[ "$code" =~ ^2 ]] && [[ "$status" =~ ^($expected_pattern)$ ]]; then
    semantic_ok=true
  fi
  if [[ "$semantic_ok" == true && "$require_d1" == true ]]; then
    [[ "$data_date" < "$HEALTH_REQUIRED_DATE" ]] && semantic_ok=false
  fi

  if [[ "$semantic_ok" == true ]]; then
    printf '%s\tOK\tHTTP %s · status=%s%s%s\n' "$name" "$code" "$status" "${data_date:+ · dataDate=$data_date}" "${source_detail:+ · $source_detail}"
  else
    printf '%s\tFAILED\tHTTP %s · status=%s%s%s · expected=%s%s\n' "$name" "${code:-000}" "$status" "${data_date:+ · dataDate=$data_date}" "${source_detail:+ · $source_detail}" "$expected_pattern" "$([[ "$require_d1" == true ]] && printf ' through operational target %s' "$HEALTH_REQUIRED_DATE")"
    FAILURES=$((FAILURES + 1))
    FAILED_NAMES+=("${name} (${status:-missing})")
  fi
  rm -f "$body"
}

printf 'Complete dashboard refresh audit\n'
printf 'Started\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
"$(cd "$(dirname "$0")" && pwd)/refresh-apple-health.sh" >/dev/null 2>&1 || true
check_source "Kite portfolio" "/api/kite/snapshot?startup=$(date +%s)" "live"
# Mail/Calendar force refresh can exceed 90s when Mail.app is slow; Calendar is SQLite-backed.
check_source "Mail and Podcasts" "/api/content/refresh?force=1&startup=$(date +%s)" "live" "false" "300"
check_source "Earnings calendar" "/api/earnings/snapshot?startup=$(date +%s)" "verified"
check_source "HealthKit operational snapshot" "/_health/snapshot?startup=$(date +%s)" "live" "true"
for sector in "${SECTORS[@]}"; do
  check_source "Sector: ${sector}" "/api/sectors/snapshot?sector=${sector}&startup=$(date +%s)" "live" "false" "120"
done
# S-2 news aggregation accepts live or partial when some publishers are blocked.
check_source_any "Sector news" "/api/sectors/news?startup=$(date +%s)" "live|partial" "false" "60"
# S-3 Decision Lab depends on NSE benchmark histories; accept live or partial (definition-only residual gaps).
check_source_any "NSE benchmarks" "/api/sectors/benchmarks?startup=$(date +%s)" "live|partial" "false" "120"
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
  kite_hint = ""
  if any("unreachable" in item.lower() for item in failed):
    kite_hint = " Gateway was unreachable (HTTP 000); restart Portfolio Intelligence before re-auditing sources."
  elif any(item.lower().startswith("kite") and "auth" in item.lower() for item in failed):
    kite_hint = " Authenticate Kite to restore live portfolio quotes."
  elif any(item.lower().startswith("kite") for item in failed):
    kite_hint = " Inspect Kite snapshot status in startup-refresh.log."
  elif any(item.lower().startswith("sector") for item in failed):
    kite_hint = " Sector quotes use yfinance; inspect .venv-flask yfinance install and network access."
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
