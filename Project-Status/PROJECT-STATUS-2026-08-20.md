# Project status — Investment Dashboard (Stratji)

**Generated-at:** 2026-08-20 15:40 IST (Asia/Kolkata)  
**Root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`  
**Branch:** `AppKit`  
**SHA:** `cbb3356e846eabd64f713bec4c6431e81a8fec72`  
**Working tree:** dirty (uncommitted Satya / MI / native / gated Streak-JWT-Groww; plus this artifact-folder reorg)  
**Chats mined:** SearchConversations MCP **unavailable**. Transcripts grepped: [Auditor then RCA then status](299e4bb5-0713-4e54-bd0d-5d43cf6e7b08) (operator `$project-status` + three first-class areas + artifact folders), [Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f), [iPhone without Tailscale](59fe97cc-1b42-4d17-87b6-c78322975823), [Axis mailbox ingest](7e2f4875-c603-49c4-98b4-269bad5c3917). Prior auditor/RCA: [Auditor](081e0355-d410-4aec-aff5-6faaa23966a8), [RCA](97c9f460-357b-45bf-aaee-4a7a69146c87).  
**move_agent_to_root:** blocked (subagent); cwd already the named project root.  
**Artifact folders (this run):** `RCAs/`, `Project-Status/`, `Plans/` (plans only), `Code-Reviews/`, `Suggested-Features/` (empty + `.gitkeep`). Canonical status path is **`Project-Status/PROJECT-STATUS.md`**. No `Plans/PROJECT-STATUS.md` remains. A parallel 15:40 draft that landed in `Plans/` was moved to `Project-Status/PROJECT-STATUS-2026-08-20-1535-parallel.md` (not a second source of truth).  
**Excluded from walk:** `node_modules`, `.git`, `.next` / `.vinext` caches, `dist`/`build`, `__pycache__`, `.venv-flask`, Apple `DerivedData*`, `artifacts/private` payloads, large binaries. Historical `artifacts/audits/*` run dumps were **not** relocated.

**Workspace derivation:** six product surfaces from `app/dashboard/workspace-routing.ts` `WORKSPACE_VIEW_VALUES` + `AGENTS.md`. Integrations is chrome (`CHROME_VIEW_VALUES`), not a seventh workspace. **Multi-Algorithm** and **Space / density** are first-class inventory *areas* (operator 20 Aug 15:32), not extra `?view=` keys.

**Status counts:** ✅ Done **84** · ⚠️ In-Progress **4** · ❌ Not Implemented **3** · **91 rows**

---

## Artifact moves (this run)

| From | To |
| --- | --- |
| `Plans/RCA-*.md`, `Plans/RCA-AppKit-P0-P2-Remediation.md` | `RCAs/` |
| `Plans/PROJECT-STATUS.md`, `Plans/PROJECT-STATUS-2026-08-20.md` | `Project-Status/` |
| Root `AUDIT-AppKit-*.md`, `AUDIT-Satya-*.md`, `Plans/AUDIT-AppKit-2026-08-20.md` | `Code-Reviews/` |
| (none found) | `Suggested-Features/.gitkeep` |
| `PLAN-*.md`, `IMPLEMENTATION-PLAN-*`, `STRATJI-*-Plan.md`, master prompts | stayed in `Plans/` |

Links updated in remaining Plans + `RCAs/RCA-2026-08-20.md`. `docs/stratji/*` and `AGENTS.md` / `README.md` had no old status/RCA paths.

---

## Conflicts / unknowns

- **CONFLICT (latest user wins):** `docs/stratji/PRD.md` still says non-scrolling H-1/H-2/H-3. User [Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f) 12:03 IST 20 Aug: H-3 must scroll. Code in `app/globals-health.css` follows the user. PRD not rewritten.
- **CONFLICT (docs vs nav):** PRD labels workspace 4 “Health & Wellness”; `AGENTS.md` / `utils.ts` nav is **My Feed** (`?view=health`).
- **CONFLICT (iPhone data plane):** Master plan still says iPhone is a Tailscale client. User [iPhone without Tailscale](59fe97cc-1b42-4d17-87b6-c78322975823) required a native LAN client. Code uses Bonjour + pairing; iOS Intelligence is M-1 / M-2 chips + open-on-Mac / M-3 (no digest walls).
- **CONFLICT (Kanban vs compact):** Operator asked for compact layouts across all sections. `AGENTS.md` forbids compact / single-lane Kanban. Status treats **I-1 three-lane identity as Done**; compact means leftover-whitespace / clipping / scroll on *content* sections, not a one-lane board.
- **PLAUSIBLE (ops, not a missing feature):** RCA Health D-1 `2026-08-19` stale vs operational target. Labelling in code is correct; snapshot completeness is operator export, not an unimplemented H-3.
- **PLAUSIBLE (space rows):** Content-section density marks are from CSS + prior layout RCA, not a 15:40 live pixel pass in the browser.

## Shared foundations (pending rows only)

1. **SF-invvol — Inverse Volatility engine:** `app/strategy/tree-backtest.ts` currently skips `method === "inverse_volatility"` sleeves with a warning. Implement lookback vol weights on the same OHLCV walk; keep honesty (no fake `ran: true` if bars missing).
2. **SF-ensemble — Strategy book:** No `ensemble` / `multi-algo` / portfolio-of-algos types exist (`rg` empty). Add a Strategies-only book document (N trees + book weights), combine single-tree curves, never a 7th workspace, never unattended Streak orders. A two-tree compare UI should land before a weighted book.
3. **SF-space — leftover oversized chrome:** I-3/I-4 `.risk-chart { min-height: 620px }` (`visual-overhaul.css` ~798–855) and S-2 `.sector-company-table table { min-width: 1100px }` (`globals-investment.css`). Reduce to content-fit; do **not** fork `DailyKanbanBoard`.

Satya split / digest-wall removal / iOS MI chips from the 13:10 snapshot are **Done in the working tree** (not leftover foundations).

Plans/docs used: `AGENTS.md`, `README.md`, `docs/stratji/PRD.md`, `docs/stratji/ROADMAP.md`, `Plans/STRATJI-Publish-Ready-Master-Plan.md`, `Code-Reviews/AUDIT-AppKit-2026-08-20.md`, `RCAs/RCA-2026-08-20.md`, `RCAs/RCA-2026-08-16-Algorithm-Builder-Canvas-KPI.md`, `RCAs/RCA-2026-08-16-Builder-Strategies-Layout.md`, `Plans/PLAN-2026-08-20-RCA-Remediation.md`, `Plans/PLAN-2026-08-16-Algorithm-Builder-Symphony-Editor.md`, `Plans/PLAN-2026-08-20-Satya-Axis-Research-Categories.md`.

---

## Canonical status table

| WORKSPACES | COMPREHENSIVE FEATURE LISTS | COMPREHENSIVE COMPLEX CHART + VISUALISATION LISTS | CURRENT IMPLEMENTATION STATUS | IMPLEMENTATION PLAN for PENDING / IN-PROGRESS TASKS |
| --- | --- | --- | --- | --- |
| Investment | I-1 Action Board — shared three-lane `DailyKanbanBoard` (`?view=investment&section=i1`) | — | ✅ Done | — |
| Investment | I-2 Portfolio activity: holdings, orders, positions, GTTs, TSLs, alerts | — | ✅ Done | — |
| Investment | I-2 Portfolio KPI instrument cluster | Four `InstrumentGauge` SVG rings (`visual-components.tsx`, mounted `InvestmentWorkspace.tsx` ~260–292) | ✅ Done | — |
| Investment | I-2 Nested live allocation | Concentric recharts `PieChart` (“orbital”) `InvestmentWorkspace.tsx` ~295–313 | ✅ Done | — |
| Investment | I-2 Concentration map | Custom squarified treemap `layoutPortfolioMap` + `.portfolio-map-tile` | ✅ Done | — |
| Investment | I-3 Risk composition | Horizontal stacked recharts `BarChart` `InvestmentWorkspace.tsx` ~442–457 | ✅ Done | — |
| Investment | I-3 Holdings risk radar | recharts `RadarChart` via `RiskRadar` (`InvestmentPanels.tsx`, mount ~491) | ✅ Done | — |
| Investment | I-3 Macro scenario lab + FII/DII | Flows regime recharts `PieChart` inside `MacroScenarioBoard` | ✅ Done | — |
| Investment | I-4 Axis picks workbench (CMP vs target, analyst groups) | `AxisCmpProgressBar` CSS meters | ✅ Done | — |
| Investment | I-4 Recommended-book risk | `RiskRadar` on I-4 (`InvestmentWorkspace.tsx` ~543) | ✅ Done | — |
| Investment | Kite order / GTT / alert tickets (operator-confirmed writes) | — | ✅ Done | — |
| Investment | Density/layout I-1: leftover whitespace / clipping / scroll; keep canonical three-lane Kanban | Shared board lanes | ✅ Done | — |
| Investment | Density/layout I-2: exclusive `hidden` section; collapsible overflow; no 620px threat-flower void on this pane | Instrument gauges, orbital pie, treemap | ✅ Done | — |
| Investment | Density/layout I-3: leftover oversized radar chrome | `.risk-panel.threat-flower:not(.holdings-stack) .risk-chart { min-height: 620px }` (`visual-overhaul.css` ~798–855) | ⚠️ In-Progress | **Target:** radar fits content (~320–480px); keep `holdings-stack` 480px pattern. **Files:** `app/visual-overhaul.css`. **Acceptance:** `?view=investment&section=i3` has no tall empty band. **Deps:** SF-space. |
| Investment | Density/layout I-4: leftover oversized recommended-risk radar (same 620px rule) | Axis `RiskRadar` uses non-holdings-stack threat-flower | ⚠️ In-Progress | Same CSS as I-3; verify `?view=investment&section=i4`. **Deps:** SF-space. |
| Sectoral Analytics | S-1 Action Board (`?view=sectors&section=s1`) | — | ✅ Done | — |
| Sectoral Analytics | S-2 Pulse page: industry analytics, news columns | `SectorImpactMatrix` CSS heatmap + `.pulse-orb` | ✅ Done | — |
| Sectoral Analytics | S-2 Companies + Rankings pages (`page=companies\|rankings`) | Rankings ladder (ordered lists, not a chart lib) | ✅ Done | — |
| Sectoral Analytics | S-2 Life-cycle page | recharts `ScatterChart` + `ZAxis` bubbles `SectoralAnalytics.tsx` ~370–390 | ✅ Done | — |
| Sectoral Analytics | S-2 Market-structure page | recharts `ScatterChart` bubbles ~416–437 | ✅ Done | — |
| Sectoral Analytics | S-2 MECE map | `.mece-matrix` + `.mece-loom` CSS | ✅ Done | — |
| Sectoral Analytics | S-2 industry toggle isolation (must not dim MI / S-3 / M-3) | — | ✅ Done | — |
| Sectoral Analytics | S-3 Benchmarks page (Pro `LicenseGate`) | recharts `LineChart` `SectorDecisionLab.tsx` ~197–205 | ✅ Done | — |
| Sectoral Analytics | S-3 Investability / PESTEL / Porter | recharts `RadarChart` ~235–242 | ✅ Done | — |
| Sectoral Analytics | S-3 Macro triggers | `TriggerDial` SVG rings + two vertical `BarChart`s | ✅ Done | — |
| Sectoral Analytics | S-3 local Decision Framework selector (does not mutate S-2) | — | ✅ Done | — |
| Sectoral Analytics | Density/layout S-1: three-lane Kanban (no compact one-lane variant) | Shared board | ✅ Done | — |
| Sectoral Analytics | Density/layout S-2: leftover companies table `min-width:1100px` (pulse/bubbles/MECE otherwise pane-bound) | Heatmap, scatter bubbles, MECE loom | ⚠️ In-Progress | **Target:** companies grid fits the S-2 pane or uses labeled inner horizontal scroll — not document-wide overflow. **Files:** `app/globals-investment.css` `.sector-company-table table`. **Acceptance:** `?view=sectors&section=s2&page=companies`; S-2 isolation unchanged. **Deps:** SF-space. |
| Sectoral Analytics | Density/layout S-3: exclusive Decision Lab; charts sized by lab panels | LineChart, RadarChart, TriggerDial | ✅ Done | — |
| Market Intelligence | M-1 Action Board: unique IST-day / last NSE-day actions from digest + earnings + corpus as-of ([Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f)) | — | ✅ Done | Corpus `recent` titles feed `buildIntelligenceDailyActions`; stale sources named; no invented KPIs. |
| Market Intelligence | M-2 Satya briefing canvas: LLM chat, source chips (Axis / MF / Groww / Flipboard / Other / Podcasts / Earnings) | `SatyaBriefingRoom` → `SatyaPresence` glyph + `WaveformStrip` | ✅ Done | Chips drive retrieval; no digest walls in SSR. No Interrogate LLM (`LlmAssistPanel` deleted; `rg` empty). |
| Market Intelligence | M-2 Axis Research 28 categories + `other_research`; default retrieve excludes `live_webinars` | Category chips in briefing | ✅ Done | `isAxisResearchCategoryId`; webinars indexed but off unless selected. |
| Market Intelligence | M-2 compact citation cluster (mail / pdf / podcast / earnings) only inside replies | `SatyaCitationIcons` | ✅ Done | SSE `citation` then `done` without double-append. |
| Market Intelligence | M-2 push-to-talk + TTS (operator Mac; no wake word) | Waveform while listening/speaking | ✅ Done | `window.satyaSpeech` + `StratjiSatyaSpeechBridge.swift`; LAN cannot POST chat. |
| Market Intelligence | Satya FTS5 corpus: two mailboxes only, empty vs no-match refusals, `newsletter_other` auto-register | — | ✅ Done | retrieve → `search.ts` only; split files < 1000 lines. |
| Market Intelligence | Axis Research PDF archive ingest (`~/Downloads/Axis Research`) as Satya SoT | PDF open only via citation icons | ✅ Done | Digest refresh awaits PDF ingest; `pdfIngest` on Satya status. |
| Market Intelligence | Operator-Mac-only `POST /api/satya/chat` (Flask loopback + Next local operator) | — | ✅ Done | Flask `_operator_only_proxy`. |
| Market Intelligence | Digest reading walls removed from Market Intelligence (AGENTS.md M-1/M-2/M-3 only) | — | ✅ Done | `digest-mail-groups.tsx` deleted. |
| Market Intelligence | Global Satya companion orb + CHATS popup + colored trigger ([Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f)) | `SatyaPresence` companion SVG glyph + popup sheet | ✅ Done | Default families include earnings; no “Interrogate LLM”. |
| Market Intelligence | Satya multi-turn follow-ups (“compare those two”) | Transcript UI | ✅ Done | Last N turns labeled UNTRUSTED; new FTS on the follow-up query. |
| Market Intelligence | M-3 Earnings Calendar sole complete calendar; Apple Calendar = schedule only; IR/NSE KPIs | `EarningsMonthCalendar` month grid | ✅ Done | — |
| Market Intelligence | Native Mac outline M-1 / M-2 Satya / M-3 (no M-4) | — | ✅ Done | `DashboardOutline.swift` titles Action Board / Satya / Earnings Calendar. |
| Market Intelligence | Density/layout M-1: three-lane Kanban (no compact one-lane variant) | Shared board | ✅ Done | — |
| Market Intelligence | Density/layout M-2: full-width briefing (not digest walls); companion orb is not a fifth section | Satya glyph + waveform | ✅ Done | — |
| Market Intelligence | Density/layout M-3: exclusive earnings month grid; no sector-dimmed controls | `EarningsMonthCalendar` | ✅ Done | — |
| My Feed | H-1 Health action board (`?view=health&section=h1`) | — | ✅ Done | — |
| My Feed | H-2 Daily Optimism (insights / guidance / guardrails; Notes Health Daily deprecated) | — | ✅ Done | — |
| My Feed | H-3 Vital Metrics direction rows (favourable / context dependent / unfavourable); Body Measurements & Hearing excluded | Category-coloured KPI tiles (not a 4th unavailable column) | ✅ Done | — |
| My Feed | H-3 category pages: activity, sleep, heart, respiratory, mobility, nutrition | — | ✅ Done | — |
| My Feed | H-3 weekly/MTD comparison sparklines | `SparkFilament` SVG via `health-sparkline.ts` | ✅ Done | — |
| My Feed | H-2/H-3/H-4 in-section vertical scroll when KPI cards overflow ([NOT SCROLLING](c7ec1a5c-545b-4237-9f3b-966e8c72435f)) | — | ✅ Done | `.health-full-section` + H-3 direction grid `overflow:visible` so Favourable tiles stay reachable. |
| My Feed | H-4 Calendar + Reminders (Job 🔍 + Earnings lists; incomplete preserved) | — | ✅ Done | — |
| My Feed | H-4 Apple-style month calendar | `AppleMonthlyCalendar` CSS grid via `IntelligenceDigest` `view="calendar-reminders"` | ✅ Done | — |
| My Feed | Health Incognito (values, drill-downs, a11y, H-4 rows) | — | ✅ Done | — |
| My Feed | Operational IST date policy `healthTargetDate` (D_EVENING / D_OVERNIGHT / D_MINUS_1) | — | ✅ Done | — |
| My Feed | Density/layout H-1: three-lane Kanban (no compact one-lane variant) | Shared board | ✅ Done | — |
| My Feed | Density/layout H-2: in-section `overflow-y:auto` on `.health-full-section` | — | ✅ Done | — |
| My Feed | Density/layout H-3: in-section vertical scroll so Favourable tiles stay reachable | SparkFilament + masonry tiles | ✅ Done | — |
| My Feed | Density/layout H-4: in-section scroll for calendar + reminder lists | `AppleMonthlyCalendar` | ✅ Done | — |
| Algorithm Canvas | B-1 Action Board (`?view=builder&section=board`); chrome title Algorithm Builder | — | ✅ Done | `BuilderWorkspace.tsx` header + exclusive `hidden` sections. |
| Algorithm Canvas | B-2 Symphony nested strategy tree (Add a Block: Asset / Group / Weight / If-Else / Any-All / Filter) | `TreeCanvas` DOM tree `.symphony-tree` | ✅ Done | `SymphonyEditor.tsx` + `TreeCanvas.tsx`; KPI registry as If operands, not primary blocks. |
| Algorithm Canvas | B-2 backtest equity curve (shown only after a real run) | Custom SVG `EquityCurve` in `SymphonyEditor.tsx` | ✅ Done | — |
| Algorithm Canvas | B-2 advanced compiled graph (details toggle) | `AlgorithmBuilder` SVG edges/nodes | ✅ Done | — |
| Algorithm Canvas | B-3 lossless JSON (tree + compiled graph) | — | ✅ Done | `BuilderJsonPanel`; textarea bounded (`algorithm-builder-json.css`). |
| Algorithm Canvas | Honest **single-tree** backtest: `ran: true` only after historical OHLCV (`POST /api/backtests/run` → `runTreeBacktest`) | Equity curve is the viz | ✅ Done | Missing bars → `ran: false`, no curve. Distinct from unimplemented multi-algo ensemble. |
| Algorithm Canvas | Inverse Volatility weight method stored in tree / seed but **not executable** | — | ⚠️ In-Progress | **Target:** Inverse-vol sleeves get lookback weights and participate in `runTreeBacktest` instead of being skipped. **Files:** `tree-backtest.ts` (~118), `tree-compile.ts` (`weight_method_unsupported`), `seed-tree.ts`. **Data:** same OHLCV map. **Acceptance:** warning gone when bars exist; skipped only if lookback bars missing (honest). **Deps:** SF-invvol. |
| Algorithm Canvas | Density/layout B-1: three-lane Kanban | Shared board | ✅ Done | — |
| Algorithm Canvas | Density/layout B-2: Composer-informed bounded 3-pane (details / tree / preview) | Tree + equity curve + optional graph | ✅ Done | `RCAs/RCA-2026-08-16-Builder-Strategies-Layout.md` solutions in `algorithm-builder.css` / exclusive canvas tab. |
| Algorithm Canvas | Density/layout B-3: JSON pane max-height, exclusive tab (no stacked explosion) | — | ✅ Done | — |
| Strategies | Y-1 Action Board (`?view=strategies&section=y1`) | — | ✅ Done | — |
| Strategies | Y-2 Composer-public `StrategyTreeV1` library + saved trees; Open in Builder | — | ✅ Done | — |
| Strategies | Y-2 strategy detail | `ReadOnlyTree` CSS vertical tree | ✅ Done | Compact preview + dialog tree (`strategies-workspace.css`). |
| Strategies | Y-2 copy-only Streak scanner export (Ultra; `placesOrders` always false) | — | ✅ Done | `POST /api/streak/export` + `compileStreakScanner`; Stratji never scrapes Streak and never places unattended orders. |
| Strategies | Y-2 library NSE stats via **single-tree** `runTreeBacktest` (yfinance bars; honest `—`) | Per-card OOS tiles (not a combined book curve) | ✅ Done | `library-nse-stats-server.ts`. This is one tree at a time — not an ensemble. |
| Strategies | Side-by-side compare of two algorithms (two curves / KPI columns) | Dual equity curves — no component | ❌ Not Implemented | **Target:** operator picks two library/Composer ids; two KPI columns + two honest curves (no blended weights). **Files:** `StrategiesWorkspace.tsx`, reuse `EquityCurve` / `runTreeBacktestOnServer`. **Acceptance:** compare dialog; `—` if a run did not `ran`. **Deps:** SF-ensemble (compare before book). |
| Strategies | Multi-algorithm ensemble / portfolio-of-algos: select N trees, book weights, **one combined backtest + combined equity curve** | Combined book equity (does not exist) | ❌ Not Implemented | **Target:** Strategies-only book of N saved/Composer trees with weights; one combined equity series; per-tree curves optional. **Files (new):** `app/strategy/strategy-book.ts` (types), persist/API, `StrategiesWorkspace.tsx` Y-2 (no new `?view=`). Reuse `runTreeBacktest` then combine. **Data:** existing library ids + OHLCV. **Acceptance:** 60/40 two-tree run produces one curve; missing legs `—` / unavailable, never invented; `placesOrders: false` unchanged. **Deps:** SF-ensemble. Not blocked by single-tree engine. |
| Strategies | Multi-tree campaign / walk-forward sweep across many algorithms | Sweep chart — absent | ❌ Not Implemented | **Target:** batch backtest of selected library trees with a shared window; table of honest KPIs. **Files:** `app/api/backtests` + Y-2 toolbar. **Acceptance:** no fabricated ranks; Streak still copy-only. **Deps:** after compare; ensemble optional. |
| Strategies | Density/layout Y-1: three-lane Kanban | Shared board | ✅ Done | — |
| Strategies | Density/layout Y-2: compact gallery + exclusive y1/y2 (layout RCA) | Compact `ReadOnlyTree` preview | ✅ Done | — |
| Cross-cutting | Source freshness strip (no standalone startup-fail banner) | `PulseConstellation` CSS nodes (`page.tsx` ~825) | ✅ Done | — |
| Cross-cutting | Local license Basic / Pro / Ultra (`LicenseGate`, feature map) | — | ✅ Done | — |
| Cross-cutting | In-repo Razorpay webhook HMAC + signed JWT activate (hosted merchant env-gated) | — | ✅ Done | `LICENSE_JWT_SECRET` HS256; `RAZORPAY_WEBHOOK_SECRET` HMAC; `GET/POST /api/license/razorpay`; `POST /api/license/activate`. Checkout URL stays `STRATJI_CHECKOUT_URL` / stratji.co.in. |
| Cross-cutting | Integrations / Settings chrome (`?view=integrations`, not a workspace; no Kanban) | — | ✅ Done | — |
| Cross-cutting | Appearance black / dark / sepia; buttons/text follow selected theme ([SEPIA THEME](c7ec1a5c-545b-4237-9f3b-966e8c72435f)) | — | ✅ Done | Satya chips/nav/tickets use `--btn-*` / `--ink` on sepia. |
| Cross-cutting | Pro PDF Investment Brief `/report` + `/api/report-pdf` | `PrintNestedDonut` SVG sunburst | ✅ Done | — |
| Cross-cutting | Native macOS Stratji AppKit (sidebar + WKWebView `nativeChrome=1`, Flask supervisor) | Satya speech bridge | ✅ Done | Six workspaces + Satya PTT on localhost Flask. |
| Cross-cutting | Native iOS six-workspace client (LAN/Bonjour pairing; not Tailscale-only) | Native holdings/metrics tiles (not web charts) | ✅ Done | Pairing + Tailscale migrate-away already in `PortfolioDashboardConfiguration`; chat POST stays loopback-only. |
| Cross-cutting | iOS Market Intelligence = M-1/M-2 Satya/M-3 (no newsletter/Axis/podcast walls) | — | ✅ Done | `NativeWorkspaceContent.swift` chips + “Open Satya briefing on Mac”; M-3 KPIs verified-only. |
| Cross-cutting | Groww live snapshot when `GROWW_ACCESS_TOKEN` is set | — | ✅ Done | `GET /api/groww/snapshot` is `unavailable` without a token and never invents quantities. Groww Digest mail remains the Satya family. |
| Cross-cutting | Flask gateway + `scripts/refresh-dashboard-data.sh` complete-refresh contract | — | ✅ Done | — |
| Cross-cutting | Six workspaces each mount the same `DailyKanbanBoard` (Integrations does not) | — | ✅ Done | — |

---

## Data-flow (short)

- **Investment:** Kite MCP → `app/kite-live-server.ts` → `/api/kite/snapshot` → `page.tsx` `loadKite` → `InvestmentWorkspace`. Axis CMP overlay from digest + quotes.
- **Sectors:** yfinance (`sector-live-server.ts`) + optional Kite MD + RSS news + NSE benchmarks → S-2/S-3. Narratives in `sector-data.ts` are static research copy.
- **Market Intelligence:** Mail/Podcasts digest (`content-digest-server.mjs`, two mailboxes) + Axis PDFs + verified earnings → Satya sqlite + M-1 actions + M-3 calendar. Chat POST operator-Mac only.
- **My Feed:** HealthKit ZIP + Health Shortcut overrides → `health-snapshot.json` via Flask `/_health/snapshot`. H-4 calendar/reminders from the same content digest (not a third mailbox).
- **Algorithm Canvas:** `StrategyTreeV1` in `SymphonyEditor` → compile `tree-compile.ts` → optional `AlgorithmBuilder` graph; backtest `POST /api/backtests/run` → `runTreeBacktest`. Inverse-vol sleeves currently skipped.
- **Strategies:** Composer catalog + local SQLite library; per-tree NSE stats; Streak JSON copy-only. No ensemble combiner.
- **Exports:** `/report` refreshes Kite/content/sectors/earnings then local PDF renderer `:3002`.

## Directory map (structure, exclusions listed in header)

Application: `app/` (Next routes + dashboard workspaces + `app/satya/` + `app/strategy/` + `app/api/`), `flask_gateway.py`, `scripts/`, `apple-app/` (Stratji macOS + iOS), `packages/contracts`, `tests/`. Docs: `docs/stratji/`, `AGENTS.md`, `README.md`. Operator artifacts now: `RCAs/`, `Project-Status/`, `Plans/`, `Code-Reviews/`, `Suggested-Features/`.

---

## Self-audit

| Gate | Result |
| --- | --- |
| S1 Canonical columns | Pass |
| S2 Completeness | Pass — six workspaces + chrome + three operator areas (Algorithm Builder, multi-algo vs single-tree, per-section density I-1…Y-2); 91 rows |
| S3 Tri-state only | Pass |
| S4 Evidence | Pass — paths in table / this header |
| S5 Plans on pending | Pass — 4 ⚠️ + 3 ❌ have plan cells |
| S6 No Plan-as-Done | Pass — ensemble is ❌; Health D-1 is ops; Inverse Vol is ⚠️ not Done |
| S7 No implement/RCA/commit | Pass — only folder moves + status artifacts + link edits |
| S8 Root | Pass — writes under project `Project-Status/` + canvases dir; `move_agent_to_root` blocked as subagent |
| S9 Canvas | Pass — `project-status.canvas.tsx` |
| S10 Secrets | Pass |
| S11 Chat mining | Pass — SearchConversations unavailable; transcripts grepped |
| S12 Grain | Pass — not one row per workspace; space rows are per section |
