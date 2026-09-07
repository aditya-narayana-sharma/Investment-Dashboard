# Plan — Supervisor / Vinext Stability (P1)

## Problem

Logs show hundreds of Vinext restart cycles (`Upstream down`), `EADDRINUSE` on `:3000`, hashed asset `ENOENT` during churn, and a **stale `service.pid`** (file 96906 dead while supervisor 1439 alive). Historical launchd TCC denials (`Operation not permitted`).

## Steps

1. Make `service.pid` atomic and authoritative (write `$$` at supervisor start; refuse duplicates).  
2. Before Vinext restart: identify listener PID on `:3000`; only kill tracked child; adopt unexpected healthy listener.  
3. Add restart backoff + “assets ready” gate after spawn.  
4. Fix `ensure-content-digest-server.sh` to reclaim unhealthy known occupants on `:3003` with backoff.  
5. Repair LaunchAgent permissions / Full Disk Access; confirm `launchd.err.log` clean.  
6. Soak-test 30 minutes; assert zero new `EADDRINUSE`.

## Acceptance

- Exactly one listener each on 5050 / 3000 / 3003  
- `service.pid` == live `run-dashboard-service.sh`  
- Startup audit runs once per start without supervisor death  
- No asset ENOENT for current HTML references

## Files

- `scripts/run-dashboard-service.sh`  
- `scripts/ensure-content-digest-server.sh`  
- LaunchAgent plist (user Library)
