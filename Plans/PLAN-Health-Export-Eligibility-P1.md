# Plan — Health Stale → Live (P1)

## Problem

Operational target (Asia/Kolkata D-1 at audit time) = **2026-08-08**.  
Snapshot `dataDate` / `eligibleThrough` = **2026-08-07** → `status=stale`.  
Startup audit fails solely on HealthKit.

## Mechanism

`scripts/import_apple_health.py`:

```python
eligible = health_target_context(export_captured_at)
completed = min(target.target_date, eligible.target_date)
# if eligible < target → status = stale
```

Newest ZIP exportCapturedAt **2026-08-08 01:24 IST** → overnight policy → eligible **2026-08-07**.

## Steps

1. Run `python3 scripts/health_date_policy.py` and note target.  
2. Export Apple Health **after** a timestamp whose policy target ≥ requiredThrough.  
3. Validate ZIP contains `apple_health_export/export.xml`.  
4. `scripts/refresh-apple-health.sh` then `scripts/refresh-dashboard-data.sh`.  
5. Confirm `/_health/snapshot` live and startup audit Failures=0.  
6. If Nutrition still missing for target day, add mirroring overrides for that date only.

## Acceptance

| Signal | Pass |
|---|---|
| `/_health/snapshot` | `status=live` |
| `dataDate` | ≥ `requiredThrough` |
| `startup-audit.json` | `failures: 0` |
| Health orbital badge | not STALE |

## Non-goals

Do not invent KPI values; do not loosen stale rules without product sign-off.
