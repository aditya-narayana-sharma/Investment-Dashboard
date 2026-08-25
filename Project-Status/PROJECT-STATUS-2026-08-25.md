# Project status — Stratji (Investment Dashboard)

**Generated-at:** 2026-08-25 14:31 IST (Asia/Kolkata)
**Root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard/.claude/worktrees/stratji-rca-algorithms-898d98`
**Branch:** `claude/stratji-rca-algorithms-898d98` (rebased onto `AppKit` this pass)
**SHA:** `ca5c7cb`
**Working tree:** clean
**This pass:** Operator sequence **step 1 of 3** (`$project-status` only). `$auditor` and `$rca-agent` follow as separate artifacts. No production-code edits in this step.

**Scope of the operator request:** RCA across all workspaces / sections / sub-sections / charts / data pipelines / animations / broker integrations / sector frameworks / news pipeline; add Bollinger Band Expansion and Mean Comparison strategies; make the app client-ready for GitHub distribution under licence.

---

## Pass provenance and honest limits

| Item | State |
| --- | --- |
| **Base-branch correction** | The worktree was branched from `main`, **42 commits behind `AppKit`**. `main` has 4 workspaces and no SATYA / Builder / Strategies / licensing. Rebased to `AppKit` `ca5c7cb` before any inventory was taken. Everything below describes `AppKit`. |
| **Live stack** | **Not running.** No listener on `:3000`, `:5050` or `:8080` during this pass. No Stratji.app window was attached. |
| **Consequence** | Every row below is **source-derived**, not screenshot- or runtime-verified. Rows that require a running stack to confirm are marked `⚠️ Needs runtime`. Do **not** read this document as a claim that the complete dashboard is current. |
| **Build/lint** | `npm install`, `npm run lint`, `npm run build` all pass at `ca5c7cb`. |
| **Tests** | **404 tests / 404 pass / 0 fail** across all 69 `tests/*.test.mjs` — but only with the full invocation (see TEST-1 below). |

---

## Surface inventory

### Workspaces — 6, from `WORKSPACE_VIEW_VALUES` (`app/dashboard/workspace-routing.ts:3`)

Integrations is chrome (`CHROME_VIEW_VALUES`), not a seventh workspace.

| Workspace | `?view=` | Sections (`WORKSPACE_SECTIONS:290`) | Default section |
| --- | --- | --- | --- |
| Investment | `investment` | I-1 Action Board · I-2 Portfolio · I-3 Risk · I-4 Axis picks | `i1` |
| Sectoral Analytics | `sectors` | S-1 Action Board · S-2 Industry Analytics · S-3 Decision Framework | `s1` |
| Market Intelligence | `intelligence` | M-1 Action Board · M-2 Satya · M-3 Earnings Calendar | `m1` |
| My Feed / Health | `health` | H-1 Action Board · H-2 Daily Optimism · H-3 Vital Metrics · H-4 Calendar + Reminders | `h1` |
| Builder | `builder` | B-1 Action Board · B-2 Canvas · B-3 JSON | `canvas` |
| Strategies | `strategies` | Y-1 Action Board · Y-2 Library | `y2` |

### Charts and visualisations — 24 Recharts mounts + custom SVG

| Host file | `ResponsiveContainer` | Chart types |
| --- | --- | --- |
| `SectorDecisionLab.tsx` | 9 | 3× Bar, 1× Line, 1× Radar (+ repeats) |
| `InvestmentWorkspace.tsx` | 5 | Bar, Pie |
| `InvestmentPanels.tsx` | 5 | Pie, Radar |
| `SectoralAnalytics.tsx` | 5 | 2× Scatter (bubble life-cycle / market-structure) |
| **Custom SVG (non-Recharts)** | — | Satya orb + `WaveformStrip` + `SatyaInfinityLoader` fig-8; `health-sparkline.ts`; `TreeCanvas.tsx` (827 lines) strategy graph; `EquityCurve.tsx`; donut label placement in `utils.ts` |

### API surface — 37 routes under `app/api/`

`axis-research/pdf` · `backtests` (+`book`, `campaign`, `run`) · `content/refresh` · `content/reminders/complete` · `dashboard/freshness` · `dashboard/refresh` · `earnings/snapshot` · `groww/snapshot` · `integrations` · `kite/`(`alert`,`gtt`,`instruments`,`login`,`order`,`snapshot`) · `license`(+`activate`,`razorpay`) · `llm/complete` · `quotes/yfinance`(+`search`) · `report-pdf` · `satya/`(`chat`,`sessions`,`sources`,`status`) · `sectors/`(`benchmarks`,`news`,`snapshot`) · `strategies/`(+`library-stats`,`live`,`preview`,`validate`) · `streak/export`

### Data pipelines

| Pipeline | Entry | Transport | Notes |
| --- | --- | --- | --- |
| Kite portfolio | `kite-live-server.ts` (903 L) | MCP JSON-RPC → external Go `kite-mcp-server` `:8080` | holdings/positions/orders/GTTs/margins; 350 ms serialised call chain; 5 s snapshot coalesce |
| Groww portfolio | `groww-live-server.ts` (65 L) | REST `api.groww.in` | **holdings only**; no positions/orders/quotes |
| Sector quotes | `sector-live-server.ts` (414 L) | Kite quotes + yfinance subprocess | 13 sectors; per-constituent daily history |
| Sector benchmarks | `sector-benchmark-server.ts` | yfinance | index levels + daily history |
| Sector news | `sector-news-server.ts` (290 L) | 6 RSS feeds | ET, FT, Bloomberg, Zerodha, Moneycontrol (via Google News), NDTV Profit |
| Content digest | `scripts/content-digest-server.mjs` (1505 L) `:3003` | osascript/JXA + sqlite3 | Mail (Newsletters, Axis Research), Reminders, Calendar, Notes, Podcasts |
| Earnings | `earnings-verify.ts` | Apple Calendar + manual verification | calendar rows are scheduling evidence only |
| Health | `health-import-server.ts` + `scripts/import_apple_health.py` | Apple Health export ZIP | `healthTargetDate` 20:00/02:00 IST window policy |
| Satya corpus | `scripts/satya-ingest.mjs`, `satya-axis-pdf-ingest.mjs`, `satya-store.mjs` | Mail + **local PDF folder** | see SATYA-1 |
| Strategy backtest | `app/strategy/tree-*.ts` | yfinance candles | `tree-indicators.ts` KPI registry |
| LLM | `local-llm-client.ts` (878 L) | Anthropic / OpenAI / Ollama | model discovery + circuit breaker |
| PDF export | `scripts/pdf-download-server.mjs` `:3002` | Chrome headless + Ghostscript | |

### Animations — 17 keyframes total

| File | `@keyframes` | `prefers-reduced-motion` |
| --- | --- | --- |
| `visual-overhaul.css` | 12 | ✅ |
| `dashboard/satya.css` | 4 | ✅ |
| `globals.css` | 1 (`spin`) | ✅ |
| `visual-overhaul-instruments.css` / `visual-overhaul-sepia.css` | 0 | ✅ |
| `native-chrome.css`, `globals-health.css`, `globals-investment.css`, `globals-sectors.css`, `hover-pop.css`, `algorithm-builder*.css` | 0 | ❌ none needed yet |

---

## Status counts

✅ Done **17** · ⚠️ In-Progress / Gap **18** · ❌ Not Implemented **16** · **51 rows**

---

## Canonical status table

| WORKSPACES | COMPREHENSIVE FEATURE LISTS | COMPREHENSIVE COMPLEX CHART + VISUALISATION LISTS | CURRENT IMPLEMENTATION STATUS | IMPLEMENTATION PLAN for PENDING / IN-PROGRESS TASKS |
| --- | --- | --- | --- | --- |
| Cross-cutting | **STAB-1** Service-worker update policy — app must not reload itself while in use | — | ❌ Not Implemented | **Target:** zero unprompted reloads. **Files:** `app/pwa-runtime.tsx:17,27-29`, `app/layout.tsx:76`. **Data-flow:** `registration.update()` polled every 5 min + on `visibilitychange`/`online`; any `controllerchange` calls `window.location.reload()`. **Acceptance:** rebuild while open → no reload; dismissible "New version" control instead. **Deps:** none. Direct cause of operator symptom "Randomly Refreshing while using the App". |
| Cross-cutting | **STAB-2** Transport failure must not demand Kite re-authentication | Kite auth badge / `live-feed-banner` | ⚠️ In-Progress | **Target:** a network blip shows "Kite cached", never "Authenticate Kite". **Files:** `app/dashboard-refresh-merge.ts:198-208` (`retainKiteOnFailure`), `app/kite-auth-presentation.ts:52-62`, called `app/page.tsx:412`. **Data-flow:** failure forces `authStatus:"authenticated"→"unknown"`; presentation's `status==="snapshot"` branch then returns `control:"authenticate"`. **Acceptance:** stop MCP mid-session → badge "Kite cached"; restart → "Kite authenticated". Direct cause of "Randomly authenticating after App loaded". |
| Cross-cutting | **STAB-3** Startup sector fan-out must respect the Kite call budget | S-2 quote-backed matrices | ⚠️ In-Progress | **Target:** cold start interactive without rate-limit. **Files:** `app/page.tsx:544-552`, `app/sector-live-server.ts` (`markRateLimited`), `app/kite-live-server.ts` (`KITE_CALL_MIN_GAP_MS=350`). **Data-flow:** 13 sectors, 12 fanned out via one `Promise.allSettled`, each fetching per-constituent quotes + history through a single 350 ms-gap serialised chain. **Acceptance:** zero `too many requests` in startup log. **Deps:** interacts with STAB-2 (rate-limit → retained snapshot → badge). |
| Cross-cutting | **STAB-4** Loading-state contract (initial vs background vs user-invoked) | `refreshing` spinner, skeletons | ⚠️ In-Progress | **Target:** background refresh causes no chrome change and no layout shift. **Files:** `app/page.tsx` (`refreshAll(forceContent, {silent})`), `app/dashboard/shared-ui.tsx`. **Data-flow:** `silent` already exists for the native path but is not applied to any web-side background refresh. **Acceptance:** zero CLS on background refresh. |
| Cross-cutting | **STAB-5** Adopt-live launch (no kill of a healthy data plane) | Stratji splash | ✅ Done | Shipped in `550f0c1`. `kickoffAtLaunch` (`apple-app/Stratji/FlaskServiceSupervisor.swift:71-87`) returns after `adoptLiveGatewayWithoutRecycle()` when `isReachable()`. Always-stop test assertion flipped. |
| Cross-cutting | **STAB-6** Kite daily-token persistence across MCP session loss | — | ✅ Done | Handled outside this repo: Go `kite-mcp-server` persists `~/.kite-mcp/daily-access-token.json` and re-applies it to each new MCP session (`kc/manager.go:210-213`). Dashboard-side `clearPersistedKiteSession()` on 400/404 (`app/kite-live-server.ts:167`) is correct — it drops a dead MCP session id, not the broker token. |
| Cross-cutting | **TEST-1** Documented test command must run the suite it claims to | — | ❌ Not Implemented | **Target:** `npm test` runs all 69 files. **Files:** `package.json` `scripts.test`. **Data-flow:** current script runs **5 of 69** files and omits `--import ./tests/helpers/register-ts-ext.mjs`; without the hook, extensionless TS imports fail `ERR_MODULE_NOT_FOUND` and look like broken code. **Acceptance:** `npm test` → 404 pass. All strategy/builder coverage is currently invisible to CI. |
| Cross-cutting | **CQ-1** 1000-line rule | — | ⚠️ In-Progress | `SatyaPresence.tsx` 1161 · `satya-client.ts` 1028 · `algorithm-builder.css` 1005 · `satya.css` 996 · `visual-overhaul.css` 964 · `page.tsx` 959 · `kite-live-server.ts` 903. Flagged by the prior audit; unchanged. |
| Investment | I-1 Daily Action Board (three-lane, canonical) | `DailyKanbanBoard` | ✅ Done | Per `AGENTS.md` this is the only action-board implementation across all workspaces. |
| Investment | I-2 Portfolio — holdings, donut allocations, market-cap/sector/sub-sector | 2× Pie (contiguous donut), Bar | ✅ Done | `buildContiguousAllocations` + `sortDonutHoldings`. |
| Investment | I-3 Risk — 6-axis risk radar, exposure driver map | Radar, Bar | ✅ Done | `portfolioRiskProfiles`, `exposureFactors`. |
| Investment | I-4 Axis picks — CMP vs target progress, category strip | progress meters | ✅ Done | `axisProgressToTarget` uses real mail/live prices only. |
| Investment | **MACRO-1** Macro scenario evidence must be unique per band | `macro-selected-evidence`, `FlowsEvidencePanel` | ⚠️ In-Progress | **Target:** each of the 3 bands per event shows a distinct `supports-range` set. **Files:** `app/macro-scenario-evidence.ts:34-91` (`scenarioRules`), `:124-142` (`scenarioBandForItem`), `:174` (`assembleScenarioEvidence`). **Data-flow:** band split **does** exist, but selection is hand-tuned regex with literal exclusion hacks (`maze of conflicts`, `chicken surplus`, `cuddly mascot`); items matching no band rule are dropped, so thin bands collapse onto shared framework text — the operator's "same source for ALL 3 Oil/War scenarios". **Acceptance:** cross-band uniqueness test over a fixture corpus. |
| Investment | **MACRO-2** AI-assisted evidence sorting | — | ❌ Not Implemented | **Target:** LLM re-ranks the regex candidate set and assigns band + relevance with a cited span; never invents. **Files:** new task in `app/local-llm-assist.ts`, consumed by `macro-scenario-evidence.ts`. **Deps:** reuse `local-llm-client.ts` (Anthropic/OpenAI/Ollama already supported) — do not add an SDK. Must fall back to the regex path and label `Rule-based (AI unavailable)`. |
| Sectors | S-1 Action Board | `DailyKanbanBoard` | ✅ Done | |
| Sectors | S-2 Industry Analytics — 13-sector impact matrix, life-cycle and market-structure bubbles, rankings, company composition | 2× Scatter with collision-avoiding `SmartBubbleLabel` | ✅ Done | `selectedSectorId` is S-2-only per `AGENTS.md`. |
| Sectors | S-3 Decision Framework — PESTEL, Porter, CAGE, life-cycle, investability radar | 3× Bar, Line, Radar | ✅ Done | `buildInvestabilityFactors` (6 equally weighted factors) + `investabilityComposite`. |
| Sectors | **NEWS-1** Sector news sentiment depth | digest badges | ⚠️ In-Progress | **Target:** magnitude + confidence + per-sector relevance, not a ±1 tally. **Files:** `app/sector-news-server.ts:65-72` (`classifySectorSentiment`). **Data-flow:** counts regex hits in two arrays; returns Positive/Neutral/Negative only. **Acceptance:** `sentimentScore ∈ [-1,1]` + `confidence` exposed. |
| Sectors | **NEWS-2** Composite news score per sector | — | ❌ Not Implemented | **Target:** Σ(relevance × sentiment × recency-decay × source-weight) with visible decomposition. **Files:** `sector-news-server.ts`, `sector-news-types.ts`. |
| Sectors | **NEWS-3** Per-vendor feed health in the freshness strip | `source-freshness-strip` | ⚠️ In-Progress | **Target:** show which of the 6 RSS vendors are live/stale/failed. **Files:** `sector-news-server.ts` already computes `SectorNewsSourceState` per feed and a `live/partial/unavailable` roll-up; it is not surfaced per-vendor in the strip. **Acceptance:** 6 vendor rows visible. |
| Intelligence | M-1 Action Board | `DailyKanbanBoard` | ✅ Done | |
| Intelligence | M-2 Satya — chat, retrieval, citations, speech, draft pop-out, smart suggestions | Satya orb SVG, `WaveformStrip`, fig-8 loader, citation icons | ✅ Done | `app/satya/` (chat 577 L, retrieve 590 L, speech 225 L), `SatyaPresence.tsx` 1161 L, 7 test files. |
| Intelligence | **SATYA-1** Axis Research **mailbox** PDFs in the corpus | corpus coverage | ❌ Not Implemented | **Target:** every Axis PDF that exists as a Mail attachment is indexed and citable. **Files:** `scripts/satya-axis-pdf-ingest.mjs:2-4,31-32,173`. **Data-flow:** ingest reads a **local folder** (`AXIS_PDF_ARCHIVE_PATH` → `~/Downloads/Axis Research`) and extracts **text-layer only**. It never enumerates `mailAttachments` on the `iCloud → Axis Research` mailbox. **Acceptance:** ask Satya about a PDF that exists only as a mail attachment → cited. Direct cause of operator symptom "ALL Axis Research PDFs from MAILBOX are NOT INCLUDED". |
| Intelligence | **SATYA-2** OCR fallback for scanned/image Axis PDFs | — | ❌ Not Implemented | **Target:** image-only PDFs index instead of silently producing empty text. **Files:** `satya-axis-pdf-ingest.mjs`, `scripts/extract-axis-pdf-recommendations.py`. **Acceptance:** `extractionStatus:"ocr_unavailable"` recorded rather than an empty index. |
| Intelligence | **SATYA-3** Full Axis family coverage (Alpha, Punch, Daily Morning Note, Result Updates) | — | ⚠️ In-Progress | **Target:** each family has a category and none is filtered out. **Files:** `app/satya/axis-categories.mjs` (396 L, `classifyAxisCategory`), `scripts/axis-mail-filter.mjs` (`NON_RESEARCH_SUBJECT` blocklist). **Acceptance:** per-family counts in the corpus catalog are non-zero. |
| Intelligence | **SATYA-4** Corpus coverage ledger (seen / found / indexed / skipped-with-reason) | — | ❌ Not Implemented | **Target:** "not included" is visible instead of silent. **Files:** `scripts/satya-store.mjs`, `SatyaBriefingRoom.tsx`. |
| Intelligence | **SATYA-5** Full-body animated cartoon persona | currently a head-only 64-unit SVG | ⚠️ In-Progress | **Target:** head + torso + arms + legs with idle/listening/thinking/speaking states. **Files:** `app/dashboard/SatyaPresence.tsx:144-202` (antenna tip + 2 eye circles only), `app/dashboard/satya.css` (4 keyframes + reduced-motion block to extend). **Acceptance:** full-body rig in M-2 and draft pop-out; compact orb retained for the launcher; Reduce Motion stops all of it. **Deps:** CQ-1 — extract the rig to `SatyaAvatar.tsx` rather than growing a 1161-line file. |
| Intelligence | M-3 Earnings Calendar — sole complete earnings location | `EarningsMonthCalendar.tsx` (378 L) | ✅ Done | Per `AGENTS.md`, never sector-gated; KPIs blank until IR/NSE publication. |
| Health | H-1…H-4 Action Board, Daily Optimism, Vital Metrics (4 direction columns), Calendar + Reminders | `health-sparkline.ts`, KPI tiles | ✅ Done | `healthTargetDate` window policy enforced; Body Measurements and Hearing excluded. |
| Health | **CLIENT-8** Health workspace ships enabled by default | — | ⚠️ In-Progress | **Target:** off until explicit first-run opt-in. **Data-flow:** the existing Incognito toggle is a **UI mask**, not a data-collection switch. **Acceptance:** fresh install performs no Health ingest until opted in. |
| Builder | B-1…B-3 Action Board, Canvas, JSON — visual strategy tree editor | `TreeCanvas.tsx` (827 L), `EquityCurve.tsx`, `KpiRegistryPanel` | ✅ Done | |
| Strategies | Y-1 Action Board · Y-2 Library — Composer-derived books, NSE stats, read-only tree | `ReadOnlyTree.tsx`, `LibraryLab.tsx` | ✅ Done | |
| Strategies | **ALGO-1** Bollinger Band Expansion | — | ❌ Not Implemented | **Target:** 3-month upper-band minima, lower-band maxima, width at maximum contraction, and breakout expansion delta. **Files:** `app/strategy/tree-indicators.ts` already emits `bbands_upper_20`/`mid`/`lower`/`width_20` at `:609-612` from `sma(closes,20)` + `stddev` — **extend, do not rebuild**. **New KPIs:** `bb_upper_min_3m`, `bb_lower_max_3m`, `bb_width_min_3m`, `bb_contraction_date`, `bb_width_at_contraction`, `bb_expansion_delta`, `bb_expansion_pct`, `bb_expansion_state`. **Acceptance:** known-answer tests on synthetic series. |
| Strategies | **ALGO-2** Mean Comparison (SMA 20 vs SMA 220) | — | ⚠️ In-Progress | **Target:** BUY candidate when SMA-20 crosses above SMA-220. **Files:** `tree-indicators.ts:551-553` already has `sma_20`/`50`/`200`; **`sma_220` is absent**. **New KPIs:** `sma_220`, `mean_cross_state`, `mean_cross_gap_pct`, `mean_cross_days_since_flip`. **Acceptance:** flip detection on fixture candles. |
| Strategies | **ALGO-3** ≥220-session daily candle provider | — | ❌ Not Implemented | **Target:** ≥260 daily candles per symbol. **Files:** new `scripts/fetch-daily-candles-yfinance.py` + `app/strategy/candle-provider.ts`. **Data-flow:** yfinance primary (free); Kite `get_historical_data` only when the paid entitlement is present — `sector-live-server.ts` already documents that a Zerodha Personal app cannot serve it. Cache by `symbol + lastTradingDay` via `nse-trading-day.mjs`. |
| Strategies | **ALGO-4** Stock selection + allocation prompt, then reviewed order ticket | new allocation planner | ❌ Not Implemented | **Target:** multi-select signalled symbols, allocate by % or ₹, derive quantity from live price, validate against margin. **Files:** new `app/dashboard/strategies/AllocationPlanner.tsx`; reuse `app/kite-order-funds.ts`, hand off through `KiteTicketPortal.tsx` to `KiteOrderTicket.tsx`. **Acceptance:** planner pre-fills only; a guard test proves no order path bypasses typed confirmation. **Never auto-executes.** |
| Integrations (chrome) | Broker + provider configuration | `IntegrationsWorkspace.tsx` | ✅ Done | |
| Integrations | **BROKER-1** Groww beyond holdings | — | ⚠️ In-Progress | **Target:** positions + order-book read, token lifecycle, and the same `status`/`authStatus`/`message` contract as Kite so the freshness strip treats both identically. **Files:** `app/groww-live-server.ts` (65 L, holdings only). **Read-only — no Groww order path.** |
| Integrations | **BROKER-2** Unified multi-broker portfolio | I-2 donuts | ❌ Not Implemented | **Target:** merge Kite + Groww holdings by symbol without double-counting, attributing each row to its broker. |
| Motion | **MOTION-1** Shared motion token layer | — | ❌ Not Implemented | **Target:** one `app/motion.css` (durations, easings, distances) so new motion is composed. **Constraint:** `transform`/`opacity` only. |
| Motion | **MOTION-2** New meaningful motion (workspace cross-fade, KPI roll-ups, chart draw-in, freshness pulse, Kanban completion) | — | ❌ Not Implemented | **Acceptance:** every new animation has a `prefers-reduced-motion: reduce` off-switch. Currently 6 CSS files have zero reduced-motion coverage because they have zero animations — that must stay true as motion is added. |
| Publish | **CLIENT-1** `LICENSE` file at repo root | — | ❌ Not Implemented | Blocking for publish. Must match `docs/stratji/LICENSE-AND-DISTRIBUTION.md`. |
| Publish | **CLIENT-2** `package.json` identity | — | ❌ Not Implemented | Name is still `site-creator-vinext-starter`. Set name/description/repository/author/license. |
| Publish | **CLIENT-3** Hardcoded operator path | — | ⚠️ In-Progress | `scripts/ensure-kite-server.sh:4` defaults `KITE_DIR` to `/Users/adityasharma/Documents/GitHub/kite-mcp-server`. Require the env var and fail with a setup message. |
| Publish | **CLIENT-4** Operator bundle identifiers | — | ⚠️ In-Progress | `com.adityasharma.portfolio-intelligence*` in launchd plists and the desktop installer. Parameterise. |
| Publish | **CLIENT-5** `.env.example` | — | ❌ Not Implemented | ~30 `process.env.*` names in use. `.gitignore` already excludes `.env*` and `artifacts/private/` ✅. |
| Publish | **CLIENT-6** Secret-history scan | — | ⚠️ In-Progress | `git log -p` across the 42 `AppKit` commits before the repo goes public. Blocking. |
| Publish | **CLIENT-7** macOS coupling degrades cleanly | — | ⚠️ In-Progress | Mail/Reminders/Calendar/Notes/Podcasts via `osascript`, HealthKit, `sqlite3` on Apple group containers. Feature-detect and degrade to a documented `unavailable`; state the macOS requirement in the README. |
| Publish | **CLIENT-9** First-run onboarding wizard | `IntegrationsWorkspace.tsx` | ⚠️ In-Progress | licence key → broker credentials → optional mailbox scopes → optional LLM provider → health opt-in. |
| Publish | **CLIENT-10** `docs/stratji/PRD.md` vs shipped nav | — | ⚠️ In-Progress | PRD still describes Health & Wellness / non-scrolling H-1–H-3; shipped nav is My Feed with 4 sections and H-3 scrolls. Carried over from `Project-Status/PROJECT-STATUS.md`. |
| Licensing | Licence gate, JWT, activation, Razorpay | `LicenseGate.tsx`, `license-server.ts`, `license-jwt.ts` | ✅ Done | `tests/license.test.mjs` green. Tier gating already applied to PDF export. |

---

## Conflicts / unknowns

- **CONFLICT (worktree base):** the Claude Code worktree was created from `main`, not `AppKit`. Any future worktree must be re-pointed before planning; `main` silently lacks half the product.
- **CONFLICT (test command):** `AGENTS.md` step 3 says "Run `npm run lint` and `npm run build`" and the required-UI-verification section names `node --test tests/rendered-html.test.mjs`. Neither runs the 64 remaining test files. TEST-1 above.
- **PLAUSIBLE (runtime):** STAB-1 through STAB-4 are source-derived. The reload storm, the auth badge flip and the rate-limit cascade should be reproduced against a running stack before the remediation is called Done.
- **UNKNOWN (Groww API):** whether the operator's Groww account has API access provisioned. `GROWW_ACCESS_TOKEN` is unset in this checkout, so BROKER-1 cannot be runtime-verified this pass.
- **OUT OF SCOPE this pass:** Kite/Mail/Health payload freshness. No source was refreshed; do not read this document as a freshness claim.

---

## Next steps in the operator sequence

1. **`$auditor`** → `Code-Reviews/AUDIT-2026-08-25-stratji-rca.md` — code-quality and correctness verdict over the same surface.
2. **`$rca-agent`** → `RCAs/RCA-2026-08-25-stratji-loading-refresh-auth-evidence.md` + `Plans/PLAN-2026-08-25-Stratji-RCA-Remediation.md`.
3. Implementation begins only after the operator reviews those artifacts.
