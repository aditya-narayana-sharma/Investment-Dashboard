#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${DASHBOARD_PUBLIC_URL:-http://127.0.0.1:${PORTFOLIO_FLASK_PORT:-5050}}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_JSON="${PORTFOLIO_STARTUP_AUDIT_PATH:-$ROOT_DIR/artifacts/private/startup-audit.json}"
PROGRESS_PY="$ROOT_DIR/scripts/write-startup-progress.py"
SECTORS=(it pharma power infrastructure auto telecom banking nbfc fmcg consumer energy metals defence)
FAILURES=0
FAILED_NAMES=()
HEALTH_REQUIRED_DATE="$(/usr/bin/python3 "$ROOT_DIR/scripts/health_date_policy.py" --date-only)"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

emit_progress() {
  local stage="$1"
  local state="$2"
  local label="$3"
  local fraction="${4:-}"
  printf 'PROGRESS\t%s\t%s\t%s\n' "$stage" "$state" "$label"
  if [[ -n "$fraction" ]]; then
    /usr/bin/python3 "$PROGRESS_PY" "$ROOT_DIR" "$stage" "$state" "$label" "$fraction" >/dev/null 2>&1 || true
  else
    /usr/bin/python3 "$PROGRESS_PY" "$ROOT_DIR" "$stage" "$state" "$label" >/dev/null 2>&1 || true
  fi
}

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
    CHECK_OK=1
  else
    printf '%s\tFAILED\tHTTP %s · status=%s%s%s · expected=%s%s\n' "$name" "${code:-000}" "$status" "${data_date:+ · dataDate=$data_date}" "${source_detail:+ · $source_detail}" "$expected_pattern" "$([[ "$require_d1" == true ]] && printf ' through operational target %s' "$HEALTH_REQUIRED_DATE")"
    FAILURES=$((FAILURES + 1))
    FAILED_NAMES+=("${name} (${status:-missing})")
    CHECK_OK=0
  fi
  rm -f "$body"
}

finish_stage() {
  local stage="$1"
  local ok_label="$2"
  local fail_label="$3"
  if [[ "${CHECK_OK:-0}" == "1" ]]; then
    emit_progress "$stage" ok "$ok_label"
  else
    emit_progress "$stage" failed "$fail_label"
  fi
}

REFRESH_MODE="${PORTFOLIO_REFRESH_MODE:-complete}"
HEALTH_SCRIPT="$(cd "$(dirname "$0")" && pwd)/refresh-apple-health.sh"

printf '%s dashboard refresh audit\n' "$([[ "$REFRESH_MODE" == "incremental" ]] && printf 'Incremental' || printf 'Complete')"
printf 'Started\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
emit_progress service ok "Local Stratji service is up."

emit_progress kite start "Refreshing Kite holdings, positions, orders, GTT, margins, and quotes…"
check_source "Kite portfolio" "/api/kite/snapshot?startup=$(date +%s)" "live"
finish_stage kite "Kite snapshot received." "Kite snapshot stale or unavailable."

# content-digest-server emits distinct mail/axis/calendar/reminders/podcasts events while this curl runs.
# Mail osascript is bounded (~50s); do not let splash sit on a lumped Mail caption for the whole Apple pass.
# Incremental ticks keep the digest cache; complete / Refresh all force a live Apple pass.
CONTENT_FORCE="force=1&"
CONTENT_TIMEOUT="160"
if [[ "$REFRESH_MODE" == "incremental" ]]; then
  CONTENT_FORCE=""
  CONTENT_TIMEOUT="90"
fi
check_source "Mail and Podcasts" "/api/content/refresh?${CONTENT_FORCE}startup=$(date +%s)" "live" "false" "$CONTENT_TIMEOUT"
MAIL_STATE="ensure"
if [[ "${CHECK_OK:-0}" != "1" ]]; then
  MAIL_STATE="ensure-failed"
fi
if [[ "$MAIL_STATE" == "ensure" ]]; then
  emit_progress calendar ensure "Apple Calendar received."
  emit_progress mail ensure "iCloud Newsletters received."
  emit_progress axis ensure "Axis Research mailbox received."
  emit_progress reminders ensure "Apple Reminders received."
  emit_progress podcasts ensure "Apple Podcasts received."
else
  emit_progress calendar ensure-failed "Apple Calendar stale or unavailable."
  emit_progress mail ensure-failed "iCloud Newsletters stale or unavailable."
  emit_progress axis ensure-failed "Axis Research mailbox stale or unavailable."
  emit_progress reminders ensure-failed "Apple Reminders stale or unavailable."
  emit_progress podcasts ensure-failed "Apple Podcasts stale or unavailable."
fi

sector_count="${#SECTORS[@]}"
emit_progress sectors start "Refreshing sector snapshots…" 0
index=0
for sector in "${SECTORS[@]}"; do
  check_source "Sector: ${sector}" "/api/sectors/snapshot?sector=${sector}&startup=$(date +%s)" "live" "false" "120"
  index=$((index + 1))
  emit_progress sectors start "Sector ${sector} (${index}/${sector_count})" "$(/usr/bin/python3 -c "print(round($index / ($sector_count + 2), 4))")"
done
check_source_any "Sector news" "/api/sectors/news?startup=$(date +%s)" "live|partial" "false" "60"
index=$((index + 1))
emit_progress sectors start "Sector news (${index}/$((sector_count + 2)))" "$(/usr/bin/python3 -c "print(round($index / ($sector_count + 2), 4))")"
# S-3 Decision Lab depends on NSE benchmark histories; accept live or partial (definition-only residual gaps).
check_source_any "NSE benchmarks" "/api/sectors/benchmarks?startup=$(date +%s)" "live|partial" "false" "120"
if [[ "${CHECK_OK:-0}" == "1" ]]; then
  emit_progress sectors ok "Sector snapshots received."
else
  emit_progress sectors failed "Sector snapshots stale or unavailable."
fi

emit_progress earnings start "Refreshing earnings calendar…"
check_source "Earnings calendar" "/api/earnings/snapshot?startup=$(date +%s)" "verified"
finish_stage earnings "Earnings snapshot received." "Earnings snapshot stale or unverified."

emit_progress health start "Validating Apple Health export and importing…"
if [[ "${PORTFOLIO_SKIP_HEALTH_ZIP:-0}" == "1" ]]; then
  printf 'Health ZIP\tskipped\tPORTFOLIO_SKIP_HEALTH_ZIP=1 (hot-path override; splash complete must not set this)\n'
elif [[ "$REFRESH_MODE" == "incremental" ]]; then
  printf 'Health ZIP\tincremental\tre-extract only if the export mtime changed\n'
  "$HEALTH_SCRIPT" --if-changed || true
else
  printf 'Health ZIP\tcomplete\tvalidate newest iCloud ZIP, extract export.xml, import snapshot\n'
  "$HEALTH_SCRIPT" || true
fi
check_source "HealthKit operational snapshot" "/_health/snapshot?startup=$(date +%s)" "live" "true"
finish_stage health "Health snapshot received." "Health snapshot stale or unavailable."

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
