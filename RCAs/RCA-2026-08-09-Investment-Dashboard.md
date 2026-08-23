# Investment Dashboard RCA — 2026-08-09

## Executive diagnosis

| Field | Value |
|---|---|
| Current health | **Degraded** |
| Highest severity | **P1** (Health falsely not live through operational target; startup audit failing) |
| Confirmed root causes | (1) Apple Health export eligibility capped at 2026-08-07 by overnight capture time; (2) runtime supervisor/Vinext restart storms + stale `service.pid`; (3) NSE 503 / Yahoo gaps for 3 factor benchmarks; (4) hardcoded SSR health fallback `2026-07-16` |
| Affected workspaces | Health & Wellness (primary); Sectoral Analytics S-3 (partial); all workspaces via freshness strip / startup audit; Investment SSR first paint |
| Data current through | Kite live 2026-08-09 12:31 IST; Mail/Podcasts/Calendar/Reminders live ~12:24 IST; Earnings verified through 2026-08-08; Sectors live; Health eligible through **2026-08-07** (required **2026-08-08**); Benchmarks partial |
| Main residual risk | Health remains stale until a post-20:00 IST (or later D-1-eligible) export lands; supervisor may re-enter EADDRINUSE loops on restart; browser visual audit blocked in this session |

**Audit time:** 2026-08-09 12:30–12:40 IST  
**Project root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`  
**Branch / commit:** `Visual-Overhaul` @ `7ee6bf1` (clean working tree)  
**Canonical runtime:** Flask `127.0.0.1:5050` → Vinext `127.0.0.1:3000`; content digest `127.0.0.1:3003`; Kite MCP `127.0.0.1:8080`  
**Comparison baseline:** current runtime + latest startup audit (`startup-refresh.log` finished 11:39 IST) + private snapshots (metadata only)  
**Private-data handling:** no tokens, mail bodies, health metric values, or PII included below  

---

## Findings (severity order)

### [P1] HealthKit operational snapshot stale vs D-1 target 2026-08-08

| Attribute | Detail |
|---|---|
| Status | Confirmed |
| Confidence | High |
| Affected | Health & Wellness → H-1 / H-2 / H-3 · `/_health/snapshot` · `/api/dashboard/freshness` · startup audit |
| Symptom | Startup audit fails on Health; Health tab badge `STALE`; freshness `status=stale` |
| Reproduction | At 12:31 IST, `GET http://127.0.0.1:5050/_health/snapshot` → `dataDate=2026-08-07`, `requiredThrough=2026-08-08`, `status=stale` |
| Observation | `startup-refresh.log`: HealthKit FAILED expected live through 2026-08-08; archive `verified_latest`; export.zip mtime 2026-08-08 01:31; exportCapturedAt `2026-08-08T01:24:19+05:30`; iPhone Mirroring / Livity / Lifesum / Guava Unavailable |
| Proximate mechanism | `build_snapshot` sets `eligible = health_target_context(export_captured_at)` then `completed = min(target, eligible)`. At 01:24 IST, policy is `D_OVERNIGHT` → eligible **2026-08-07**. Now (12:xx) policy is `D_MINUS_1` → target **2026-08-08**. `eligible < target` forces `stale` |
| Root cause | Newest validated Health archive was captured in the overnight window before 2026-08-08 could become the eligible operational day; no newer export has been ingested |
| Trigger | Startup / five-minute refresh audit after 02:00 IST on 2026-08-09 |
| Contributing factors | No iPhone Mirroring overrides; Health import terminated mid-run historically (`Terminated: 15`); XML reused from validated zip without advancing eligibility |
| User impact | H-2/H-3 KPIs and comparisons stop at 2026-08-07; complete-dashboard contract fails; cannot claim dashboard is fully current |
| Corrective action | Export a fresh Apple Health ZIP after 2026-08-08 20:00 IST (or any time that maps eligible ≥ 2026-08-08), place in iCloud Health folder, re-run `scripts/refresh-apple-health.sh` / startup refresh; optionally verify Aug 8 via iPhone Mirroring into `health-overrides.json` |
| Verification | `/_health/snapshot` → `status=live`, `dataDate`/`completedThrough` ≥ `requiredThrough` (= operational target); startup audit Failures=0 |
| Code | `/Users/adityasharma/Documents/GitHub/Investment Dashboard/scripts/import_apple_health.py` (~430–431, 593–608); `/Users/adityasharma/Documents/GitHub/Investment Dashboard/scripts/health_date_policy.py`; `/Users/adityasharma/Documents/GitHub/Investment Dashboard/scripts/refresh-dashboard-data.sh` |
| Source | `artifacts/private/health-snapshot.json`, `startup-refresh.log`, `apple-health-archive.json` |

### [P1] Runtime supervisor instability (Vinext restart storms, stale PID, historical TCC)

| Attribute | Detail |
|---|---|
| Status | Confirmed (historical + current PID drift) |
| Confidence | High |
| Affected | Infrastructure → `run-dashboard-service.sh` · Vinext · Flask gateway · content-digest ensure loop |
| Symptom | Thousands of `Upstream down; restarting Vinext` / `Startup refresh audit FAILED` lines; `EADDRINUSE` on `:3000`; asset `ENOENT` during rebuilds; `service.pid` points at dead PID while another supervisor lives |
| Reproduction | `grep -c` on logs: Upstream down ≈ 867; audit FAILED ≈ 201; EADDRINUSE ≈ 40; ENOENT ≈ 461. Live: supervisor PID **1439**, `service.pid` still **96906** (dead) |
| Observation | Vinext parent is npm child of supervisor; content-digest reparented to PID 1; launchd.err historically `Operation not permitted` on `run-dashboard-service.sh`; flask.log shows bind races `Address already in use` then later Serving |
| Proximate mechanism | Healthcheck treats brief Vinext unavailability as down → kill/restart while orphan listener still holds port → EADDRINUSE → loop; build mid-serve leaves hashed assets missing |
| Root cause | Supervisor lacks single-owner port/PID locking and treats transient upstream failures / rebuild windows as hard downtime without draining or verifying the listening PID it owns |
| Trigger | Upstream blips, rebuilds, overlapping launchd/manual starts, TCC denials |
| Contributing factors | Stale `service.pid`; content-digest “port occupied but health failed” races; Health refresh SIGTERM under load |
| User impact | Intermittent blank pages / missing CSS/JS; flaky Tailscale/local access; audit noise; hard to know which process is canonical |
| Corrective action | See implementation plan: atomic PID file, listen-owner checks before restart, rebuild drain, launchd Full Disk / Automation permissions, content-digest health race fix |
| Verification | Clean restart → one waitress, one vinext, matching `service.pid`; zero EADDRINUSE over 30 min; audit runs once per start |
| Code | `/Users/adityasharma/Documents/GitHub/Investment Dashboard/scripts/run-dashboard-service.sh` (96–120); `scripts/ensure-content-digest-server.sh` |
| Source | `~/Library/Logs/PortfolioIntelligence/{service,vinext,launchd.err,flask,content-digest}.log` |

### [P2] S-3 NSE factor benchmarks partial (3/7 histories missing)

| Attribute | Detail |
|---|---|
| Status | Confirmed |
| Confidence | High |
| Affected | Sectoral Analytics → S-3 Benchmarks & Decision Lab · `/api/sectors/benchmarks` |
| Symptom | `status=partial`; Decision Lab amber/partial pill |
| Observation | NIFTY Alpha 50 / NIFTY200 Alpha 30 / NIFTY100 Low Volatility 30: `freshness=unavailable`, hist=0; NSE API **503**; Yahoo 0–1 closes / no ticker |
| Root cause | Upstream NSE historical API unavailable for factor indices; Yahoo fallback insufficiently mapped for exact tickers |
| Corrective action | Retry NSE with backoff/cookies; add exact Yahoo tickers if they exist; cache last-good EOD series; surface per-index unavailable without failing whole S-3 |
| Verification | Bench `status=live` or documented partial with cached series labelled; S-3 charts render non-empty for all seven or explicit empty-state per index |
| Code | `scripts/fetch-sector-benchmarks-yfinance.py`; sector benchmarks API route |
| Source | `/tmp/bench.json` / live API 2026-08-09 |

### [P2] SSR / first-paint uses hardcoded Health fallback `2026-07-16`

| Attribute | Detail |
|---|---|
| Status | Confirmed |
| Confidence | High |
| Affected | All workspaces footer + Health badge before client refresh |
| Symptom | SSR HTML footer: `HealthKit data through 2026-07-16 · operational target · stale` while API has 2026-08-07 |
| Root cause | `page.tsx` initializes `useState(fallbackHealth)` and `fallbackHealth.dataDate` is a static July 16 placeholder in `utils.ts` |
| Corrective action | Server-read last validated snapshot for initial state, or use neutral `unavailable`/`loading` copy until refresh resolves; never show a fabricated historical date |
| Verification | View-source / SSR footer matches `/_health/snapshot` or shows explicit Loading/Unavailable without a fake date |
| Code | `app/dashboard/utils.ts` (`fallbackHealth`); `app/page.tsx` |

### [P3] Inventory scanner under-reports S-2 / S-3

| Attribute | Detail |
|---|---|
| Status | Confirmed |
| Confidence | High |
| Affected | RCA tooling / coverage matrix |
| Observation | `rca-inventory.md` lists only `S-1`; code has CollapsibleSection numbers via `SECTION_META.s2.number` / `s3` |
| Root cause | Scanner matches literal section number strings, not expression-bound numbers |
| Corrective action | Teach scanner to resolve `SECTION_META.*.number` or parse SECTION_META tables |

### [P3] Earnings overdue pending SBIN (7 Aug) — scheduling only

| Attribute | Detail |
|---|---|
| Status | Confirmed (by design) |
| Confidence | High |
| Affected | Market Intelligence → M-3 |
| Observation | Earnings `verified` through 2026-08-08; message notes overdue pending SBIN KPIs blank |
| Root cause | No verified IR/NSE KPI payload yet; calendar scheduling evidence retained |
| Corrective action | None for pipeline; optionally chase IR when published |

### [P3] Browser visual audit blocked this session

Cursor IDE browser MCP could not retain a navigable tab (`No browser tab available` after `browser_tabs` new). Desktop HTML/API smoke used instead. iPhone portrait/landscape and live chart resize **not visually verified** here.

---

## Findings matrix (requested columns)

| Workspace | Section | Sub-Section | Function/File Name | Identified Problem | Root Cause | Proposed Solution |
|---|---|---|---|---|---|---|
| Health & Wellness | H-1 Action Board | Operational freshness | `scripts/import_apple_health.py` `build_snapshot`; `scripts/refresh-dashboard-data.sh` | Startup audit fails; Health `stale` for target 2026-08-08 | Export captured 01:24 IST → overnight eligibility caps at 2026-08-07 | Fresh Health export after eligible window; re-import; optional mirroring overrides |
| Health & Wellness | H-2 Daily Optimism | Insights / actions | `app/health-insights.ts`; Health snapshot `actions` | Actions/insights anchored to 2026-08-07; mirroring sources Unavailable | Same eligibility cap + no overrides | Same as H-1; run Computer Use mirroring for Livity/Lifesum/Guava when needed |
| Health & Wellness | H-3 Vital Metrics | Category coverage | `health-snapshot.json` `categoryCoverage` / `coverage` | Nutrition & several KPIs `missing_target` even for completedThrough day; Cardio fitness / 6‑min walk sparse | Incomplete logging in export for those metrics; not invented | Show exact missing dates (already); fill via mirroring or accept unavailable |
| All | Freshness strip | `/api/dashboard/freshness` | `app/api/dashboard/freshness/route.ts` | Global freshness `status=stale` | Reflects Health snapshot status only | Fix Health eligibility/data; consider multi-source aggregate later |
| All | Runtime | Supervisor loop | `scripts/run-dashboard-service.sh` | Restart storms, EADDRINUSE, ENOENT assets, stale `service.pid` | Weak ownership/locking around Vinext restarts & rebuilds | PID/port ownership, drain, matching pidfile, launchd TCC |
| All | Content digest helper | Port 3003 | `scripts/ensure-content-digest-server.sh` | Historical “port occupied but health failed” | Ensure script exits 1 when listener is non-healthy without reclaim | Probe+restart unhealthy occupant; align with supervisor |
| Sectoral Analytics | S-1 | Action board | `SectorsWorkspace.tsx` + `DailyKanbanBoard` | No functional defect found in this audit | — | Keep shared three-lane board; no change |
| Sectoral Analytics | S-2 | Industry Analytics | `SectoralAnalytics.tsx` | Live sector quotes OK; dimming classes scoped to S-2 (code+tests) | — | Retain isolation tests |
| Sectoral Analytics | S-3 | Benchmarks & Decision Lab | `fetch-sector-benchmarks-yfinance.py`; `/api/sectors/benchmarks` | 3 factor indices unavailable (NSE 503 / Yahoo gap) | Upstream outage + incomplete Yahoo mapping | Retry/cache/ticker map; per-index empty states |
| Market Intelligence | M-1 | Action board | `IntelligenceWorkspace.tsx` | No defect beyond shared freshness | — | — |
| Market Intelligence | M-2 | Newsletters / Axis / Podcasts | `artifacts/private/content-snapshot.json` | Live; 62/70 newsletters, 11/15 Axis, 36 podcasts (0 transcripts, 33 descriptions) | Podcast transcripts unavailable locally | Keep description labelling (already); optional transcript pipeline |
| Market Intelligence | M-3 | Earnings | `/api/earnings/snapshot` | Verified through 2026-08-08; SBIN overdue pending blank KPIs | Unpublished results | Wait for IR/NSE; keep blank |
| Market Intelligence | M-4 | Calendar + Reminders | content snapshot | Live counts calendar 338 / reminders 1819 | — | — |
| Investment | I-1–I-4 | Kite / Axis | `/api/kite/snapshot` | Live authenticated as of 12:31 IST | — | Monitor ~06:00 IST daily session boundary |
| Investment / All | SSR first paint | `fallbackHealth` | `app/dashboard/utils.ts`, `app/page.tsx` | Footer shows 2026-07-16 until hydrate | Hardcoded fallback snapshot | Load real snapshot server-side or neutral loading state |
| Tooling | RCA inventory | Sections | `scan_dashboard.py` | Misses S-2/S-3 | Expression-bound section numbers | Improve scanner |
| Cross-cutting | PDF | Export contract | `app/api/report-pdf/route.ts` | Not re-run in this audit | — | Before PDF: refresh Kite/Mail/earnings/sectors per AGENTS.md |
| Cross-cutting | CI | GitHub Actions | `gh` unavailable in environment | CI status not retrieved | Tooling gap | Run `gh run list` locally / enable auth |

---

## Source freshness ledger

| Source | Expected cadence | Required-through | Observed-through | Ingested-at | Status | Evidence | Gap |
|---|---|---|---|---|---|---|---|
| Kite portfolio | ≤5 min while session valid | Session live | 2026-08-09 12:31 IST | API live | **live** / authenticated | `/api/kite/snapshot` | None (expires ~2026-08-10 06:00 IST) |
| Mail (iCloud→Newsletters) | On refresh | Latest digest | displayed 62 / observed 70 | 2026-08-09 12:24 IST | **live** | content-snapshot `sources.newsletters` | 8 filtered/non-displayed |
| Axis Research (iCloud→Axis Research) | On refresh | Latest digest | 11 / 15 | 2026-08-09 12:24 IST | **live** | content-snapshot | 4 filtered |
| Podcasts | On refresh | Latest episodes | 36 (33 descriptions) | 2026-08-09 12:24 IST | **live** | content-snapshot | 0 transcripts; 3 without substantive evidence |
| Calendar | On refresh | Through D-1 + upcoming | 338 events | 2026-08-09 12:24 IST | **live** | content-snapshot | — |
| Reminders (Job 🔍 / Earnings lists in product) | On refresh | Current lists | 1819 | 2026-08-09 12:24 IST | **live** | content-snapshot | Scope of all lists vs exact two lists not re-proved via Computer Use |
| Earnings | Verified through latest completed IST day | 2026-08-08 | verified contract 2026-08-08 | API | **verified** | `/api/earnings/snapshot` | SBIN 7 Aug pending KPIs blank |
| Sector snapshots (11) | Live quotes | Session | live ~12:32 IST (pharma sampled) | API | **live** | startup audit + sample | Full 11 not re-fetched individually this pass (audit OK at 11:39) |
| Sector news | live\|partial | — | accepted by audit | audit 11:39 | **live** (audit) | startup-refresh.log | — |
| NSE benchmarks | live\|partial | EOD histories | 4/7 | 2026-08-09 07:02Z | **partial** | `/api/sectors/benchmarks` | Alpha 50, 200 Alpha 30, 100 Low Vol 30 |
| Apple Health export | Eligible ≥ operational target | 2026-08-08 | eligible 2026-08-07 | snapshot 12:27 IST | **stale** | `/_health/snapshot` | Need newer export / mirroring |
| Health note ` Health Daily` | Operational day | — | status live count 1 | content snapshot | **live** (note present) | content-snapshot `healthNote` | Not a substitute for HealthKit KPIs |
| Startup audit aggregate | Every start | All sources | Failures=1 | 11:39 IST | **failed** | startup-audit.json | Health only |

---

## Workspace / section coverage

| Workspace | Section | Children | Collapsible | Sources | States tested | Result |
|---|---|---|---|---|---|---|
| Investment | I-1 | DailyKanbanBoard | Yes | Actions / content | SSR collapsed; API kite live | OK structurally; SSR kite unavailable until hydrate |
| Investment | I-2 | Holdings/orders/… | Yes | Kite | API live | OK |
| Investment | I-3 | Risk charts | Yes | Kite + macro | Tests pass; charts not visually resized | Code OK / visual blocked |
| Investment | I-4 | Axis picks | Yes | Axis PDF recs | as-of 2026-08-09 in SSR | OK |
| Sectors | S-1 | Kanban | Yes | Actions | Code | OK |
| Sectors | S-2 | Pulse/companies/rankings pages | Yes | Sector market + news | API live; isolation tests pass | OK |
| Sectors | S-3 | Decision lab pages | Yes | Benchmarks | partial | Degraded |
| Intelligence | M-1–M-4 | Digests, earnings, cal/reminders | Yes | Content + earnings | API/snapshot live/verified; isolation tests | OK (SBIN pending note) |
| Health | H-1–H-3 | Kanban, optimism, vitals | Yes | HealthKit | stale | Degraded |

---

## Cross-section reconciliation

| Entity/metric | Surfaces | Expected | Observed | Difference | Cause |
|---|---|---|---|---|---|
| Health dataDate | API vs SSR footer | Same validated date | API 2026-08-07 vs SSR 2026-07-16 | Fake fallback | `fallbackHealth` |
| Health status | Freshness API vs Health badge | Both stale | Both stale | None | Consistent |
| Startup audit vs live Health | Audit file vs snapshot | Match failure | Both Health stale | None | Consistent |
| Benchmarks | S-3 pill vs API | partial | partial | None | Consistent |
| Kite | API vs SSR header | Live after hydrate | API live; SSR Unavailable | Timing | Client refresh |

---

## Verification results

| Check | Command/action | Result | Evidence |
|---|---|---|---|
| Inventory scan | `scan_dashboard.py` | OK (under-counts S-2/S-3) | `/tmp/dashboard-rca/` |
| Startup audit log | read `startup-refresh.log` | Failures=1 Health | 11:39 IST |
| Live Flask health | `GET /_flask/health` | 200 ok | upstream :3000 |
| Kite | `GET /api/kite/snapshot` | live authenticated | 12:31 IST |
| Earnings | `GET /api/earnings/snapshot` | verified | through 2026-08-08 |
| Health | `GET /_health/snapshot` | stale | dataDate 2026-08-07 |
| Benchmarks | `GET /api/sectors/benchmarks` | partial | 4/7 |
| Content digest | `GET :3003/health` | ok | — |
| Lint | `npm run lint` | pass | exit 0 |
| Focused tests | `node --test` health-date + freshness-isolation + rendered-html | 29 pass | ~2s |
| Browser MCP | navigate workspaces | **Blocked** | no retained tab |
| CI | `gh run list` | **Unavailable** | tooling |

---

## Change map

| Change group | Files | Affected surfaces | Risk | Tests |
|---|---|---|---|---|
| Branch HEAD Visual-Overhaul `7ee6bf1` | Shipped I-3/M-4 density, podcast description fallbacks, NSE EOD benchmarks | Investment, Intelligence, S-3 | Medium (benchmarks still partial upstream) | rendered-html / sector tests green |
| Working tree | Clean | — | — | — |
| Runtime private state | health/content/kite snapshots, logs | Freshness | High for Health staleness | startup audit |
| `main` vs origin | local main ahead 1 behind 2 | merge drift risk | Process | — |

---

## Residual risks and open questions

- Blocked: interactive desktop/iPhone viewport chart QA; Tailscale URL probe; full Computer Use of Mail/Reminders/Notes/Mirroring; CI status.
- Unverified: whether Reminders snapshot is limited to exact `Job 🔍` + `Earnings` lists vs all lists.
- Monitoring: Health eligibility after next export; Vinext restart rate; NSE factor index 503 recovery; Kite 06:00 IST re-auth.
- Follow-up date: same day after new Health export (target evening 2026-08-09 20:00 IST+).
