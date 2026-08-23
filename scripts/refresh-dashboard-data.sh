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
JOB_DIR="$(mktemp -d)"
trap 'rm -rf "$JOB_DIR"; rm -f "$COOKIE_JAR"' EXIT

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
  local jar="${CHECK_COOKIE_JAR:-$COOKIE_JAR}"
  local code
  local body
  local status
  local data_date
  local source_detail=""
  body="$(mktemp)"
  code="$(curl -sS --max-time "$max_time" -b "$jar" -c "$jar" -o "$body" -w '%{http_code}' "${BASE_URL}${path}" 2>/dev/null || true)"
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
  if [[ -n "${CHECK_RESULT_FILE:-}" ]]; then
    if [[ "$CHECK_OK" == "1" ]]; then
      printf '1\n' > "$CHECK_RESULT_FILE"
    else
      printf '0\t%s\n' "${name} (${status:-missing})" > "$CHECK_RESULT_FILE"
    fi
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

collect_job() {
  local job_id="$1"
  local file="$JOB_DIR/$job_id.result"
  local ok fail_name
  if [[ ! -f "$file" ]]; then
    FAILURES=$((FAILURES + 1))
    FAILED_NAMES+=("${job_id} (missing)")
    CHECK_OK=0
    return
  fi
  IFS=$'\t' read -r ok fail_name < "$file" || true
  if [[ "$ok" == "1" ]]; then
    CHECK_OK=1
  else
    FAILURES=$((FAILURES + 1))
    [[ -n "${fail_name:-}" ]] && FAILED_NAMES+=("$fail_name")
    CHECK_OK=0
  fi
}

run_check_bg() {
  local job_id="$1"
  shift
  (
    CHECK_COOKIE_JAR="$JOB_DIR/$job_id.cookies"
    : > "$CHECK_COOKIE_JAR"
    CHECK_RESULT_FILE="$JOB_DIR/$job_id.result"
    check_source "$@"
  ) &
}

run_check_any_bg() {
  local job_id="$1"
  shift
  (
    CHECK_COOKIE_JAR="$JOB_DIR/$job_id.cookies"
    : > "$CHECK_COOKIE_JAR"
    CHECK_RESULT_FILE="$JOB_DIR/$job_id.result"
    check_source_any "$@"
  ) &
}

REFRESH_MODE="${PORTFOLIO_REFRESH_MODE:-complete}"
if [[ "$REFRESH_MODE" != "incremental" ]]; then
  REFRESH_MODE="complete"
fi
HEALTH_SCRIPT="$(cd "$(dirname "$0")" && pwd)/refresh-apple-health.sh"

# Complete/load and Refresh-all must ingest Health ZIP + live Mail even if a parent
# exported PORTFOLIO_SKIP_* leftovers (IDE, launchd, prior incremental ticks).
if [[ "$REFRESH_MODE" == "complete" ]]; then
  while IFS= read -r skip_var; do
    unset "$skip_var"
  done < <(compgen -v | grep '^PORTFOLIO_SKIP_' || true)
fi

printf '%s dashboard refresh audit\n' "$([[ "$REFRESH_MODE" == "incremental" ]] && printf 'Incremental' || printf 'Complete')"
printf 'Started\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
printf 'Mode\t%s\tload-all-at-once then incremental ticks\n' "$REFRESH_MODE"
emit_progress service ok "Local Stratji service is up."

# content-digest-server emits distinct mail/axis/calendar/reminders/podcasts events while this curl runs.
# Mail osascript is bounded (~40s) and process-group killed; splash must not sit on Newsletters JXA.
# Incremental ticks keep the digest cache; complete / Refresh all force a live Apple pass.
CONTENT_QUERY="force=1&startup=$(date +%s)"
CONTENT_TIMEOUT="160"
if [[ "$REFRESH_MODE" == "incremental" ]]; then
  # Do not pass force=1 or startup — both make /api/content/refresh re-read Mail.app.
  CONTENT_QUERY="refresh=$(date +%s)"
  CONTENT_TIMEOUT="90"
fi

# Fire independent families concurrently. Flask waitress threads cover the HTTP fan-out.
# Mail+Axis stay sequential inside content-digest-server (Mail.app JXA cannot overlap).
emit_progress kite start "Refreshing Kite holdings, positions, orders, GTT, margins, and quotes…"
emit_progress calendar start "Refreshing Apple Calendar…"
emit_progress mail start "Refreshing iCloud Newsletters…"
emit_progress axis start "Refreshing Axis Research mailbox…"
emit_progress reminders start "Refreshing Apple Reminders…"
emit_progress podcasts start "Refreshing Apple Podcasts…"
emit_progress sectors start "Refreshing sector snapshots…" 0
emit_progress earnings start "Refreshing earnings calendar…"
emit_progress health start "Validating Apple Health export and importing…"

run_check_bg kite "Kite portfolio" "/api/kite/snapshot?startup=$(date +%s)" "live"
run_check_bg content "Mail and Podcasts" "/api/content/refresh?${CONTENT_QUERY}" "live" "false" "$CONTENT_TIMEOUT"

for sector in "${SECTORS[@]}"; do
  run_check_bg "sector-${sector}" "Sector: ${sector}" "/api/sectors/snapshot?sector=${sector}&startup=$(date +%s)" "live" "false" "120"
done
run_check_any_bg sector-news "Sector news" "/api/sectors/news?startup=$(date +%s)" "live|partial" "false" "60"
# S-3 Decision Lab depends on NSE benchmark histories; accept live or partial (definition-only residual gaps).
# Live sector quotes + catalog scores are the S-2 composite-scoring inputs.
run_check_any_bg sector-benchmarks "NSE benchmarks" "/api/sectors/benchmarks?startup=$(date +%s)" "live|partial" "false" "120"
run_check_bg earnings "Earnings calendar" "/api/earnings/snapshot?startup=$(date +%s)" "verified"

(
  CHECK_COOKIE_JAR="$JOB_DIR/health.cookies"
  : > "$CHECK_COOKIE_JAR"
  CHECK_RESULT_FILE="$JOB_DIR/health.result"
  if [[ "$REFRESH_MODE" == "incremental" ]]; then
    printf 'Health ZIP\tincremental\tre-extract only if the export mtime changed\n'
    "$HEALTH_SCRIPT" --if-changed || true
  else
    printf 'Health ZIP\tcomplete\tvalidate newest iCloud ZIP, extract export.xml, import snapshot\n'
    "$HEALTH_SCRIPT" || true
  fi
  check_source "HealthKit operational snapshot" "/_health/snapshot?startup=$(date +%s)" "live" "true"
) &

wait || true

collect_job kite
finish_stage kite "Kite snapshot received." "Kite snapshot stale or unavailable."

collect_job content
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

SECTOR_OK=1
for sector in "${SECTORS[@]}"; do
  collect_job "sector-${sector}"
  [[ "${CHECK_OK:-0}" == "1" ]] || SECTOR_OK=0
done
collect_job sector-news
[[ "${CHECK_OK:-0}" == "1" ]] || SECTOR_OK=0
collect_job sector-benchmarks
[[ "${CHECK_OK:-0}" == "1" ]] || SECTOR_OK=0
CHECK_OK="$SECTOR_OK"
if [[ "$SECTOR_OK" == "1" ]]; then
  emit_progress sectors ok "Sector snapshots received."
else
  emit_progress sectors failed "Sector snapshots stale or unavailable."
fi

collect_job earnings
finish_stage earnings "Earnings snapshot received." "Earnings snapshot stale or unverified."

collect_job health
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
