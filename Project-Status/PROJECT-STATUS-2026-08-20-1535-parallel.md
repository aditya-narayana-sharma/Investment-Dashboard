# Project status — Investment Dashboard (Stratji)

**Generated-at:** 2026-08-20 15:40 IST (Asia/Kolkata)  
**Root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`  
**Branch:** `AppKit`  
**SHA:** `cbb3356e846eabd64f713bec4c6431e81a8fec72`  
**Working tree:** dirty (uncommitted Satya split, Intelligence Satya, native outline, gated Streak/JWT/Groww, layout CSS, this status snapshot). Coded work is scored from the live tree; nothing here is Plan-as-Done.  
**Chats mined:** SearchConversations MCP **unavailable**. Transcripts grepped: [Auditor then RCA then status](299e4bb5-0713-4e54-bd0d-5d43cf6e7b08) including operator 15:32 IST three-area ask; [Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f); [iPhone without Tailscale](59fe97cc-1b42-4d17-87b6-c78322975823).  
**move_agent_to_root:** blocked (subagent); cwd already the named project root.  
**Excluded from walk:** `node_modules`, `.git`, `.next` / `.vinext` caches, `dist`/`build`, `__pycache__`, `.venv-flask`, Apple `DerivedData*`, `artifacts/private` payloads, large binaries.

**Workspace derivation:** six product surfaces from `app/dashboard/workspace-routing.ts` `WORKSPACE_VIEW_VALUES` + `AGENTS.md`. Integrations is chrome (`CHROME_VIEW_VALUES`), not a seventh workspace. Algorithm Canvas is workspace five (`?view=builder`), not a seventh.

**Prior 13:10 IST snapshot:** 67/67 Done is **kept** for those coded Satya / digest-wall / Streak / JWT / Groww / H-3 scroll rows after re-walk. This pass **adds** operator-required Algorithm Builder, multi-algo, and per-section space rows (row count expands; 7 rows are ⚠️/❌).

**Status counts:** ✅ Done **99** · ⚠️ In-Progress **4** · ❌ Not Implemented **3** · **106 rows**

---

## Conflicts / unknowns

- **CONFLICT (latest user wins):** `docs/stratji/PRD.md` still says non-scrolling H-1/H-2/H-3. User [Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f) 12:03 IST 20 Aug: H-3 must scroll. Code in `app/globals-health.css` follows the user. PRD not rewritten.
- **CONFLICT (docs vs nav):** PRD labels workspace 4 “Health & Wellness”; `AGENTS.md` / `utils.ts` nav is **My Feed** (`?view=health`).
- **CONFLICT (iPhone data plane):** Master plan still says iPhone is a Tailscale client. User [iPhone without Tailscale](59fe97cc-1b42-4d17-87b6-c78322975823) required a native LAN client. Code uses Bonjour + pairing; iOS Intelligence is M-1 / M-2 chips + open-on-Mac / M-3 (no digest walls).
- **CONFLICT (roadmap vs code):** `docs/stratji/ROADMAP.md` P1/P6 still say no Razorpay/JWT and Streak “stub only”. Code has HMAC+JWT activate and copy-only Streak JSON. Status follows **code**.
- **PLAUSIBLE (ops, not a missing feature):** RCA Health D-1 stale vs operational target. Labelling in code is correct; snapshot completeness is operator Health Shortcut export, not an unimplemented H-3.

## Shared foundations (pending rows only)

1. **SF-space — forced min-heights.** I-3/I-4 `.risk-chart` `min-height: 620px` (`visual-overhaul.css`) and S-2 `.sector-company-table table { min-width:1100px }` (`globals-investment.css`) are leftover oversized chrome. Reduce to content-fit (holdings-stack radar already uses 480px).
2. **SF-multi — one tree is the unit.** Sequential develop/backtest/Open-in-Builder/Streak-copy exists. Compare UI should land before any ensemble book. Do not invent a seventh workspace.
3. **SF-vol — Inverse Volatility.** Tree stores `method: inverse_volatility` and warns; `tree-backtest.ts` skips the sleeve. Executable weights need OHLCV vol.

Plans/docs used: `AGENTS.md`, `README.md`, `docs/stratji/PRD.md`, `docs/stratji/ROADMAP.md`, `Plans/STRATJI-Publish-Ready-Master-Plan.md`, `Plans/PLAN-2026-08-16-Algorithm-Builder-Symphony-Editor.md`, `Plans/RCA-2026-08-16-Builder-Strategies-Layout.md`, `Plans/AUDIT-AppKit-2026-08-20.md`, `Plans/RCA-2026-08-20.md`, `Plans/PLAN-2026-08-20-RCA-Remediation.md`, `Plans/PLAN-2026-08-20-Satya-Axis-Research-Categories.md`. Prior dated snapshot: `Plans/PROJECT-STATUS-2026-08-20.md` (13:10 IST).

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
| Investment | **Space I-1:** canonical three-lane kanban, `height:auto`, no workspace-specific compact variant | Shared `.canonical-action-board` (`globals-investment.css`) | ✅ Done | — |
| Investment | **Space I-2:** exclusive `hidden` section; collapsible content `overflow:auto`; no blank band under sticky I1–I4 | Instrument cluster + orbital + treemap (intended chart size) | ✅ Done | — |
| Investment | **Space I-3:** leftover oversized radar chrome | `.risk-panel.threat-flower:not(.holdings-stack) .risk-chart { min-height: 620px }` in `visual-overhaul.css` ~797–856 | ⚠️ In-Progress | **Target:** radar fits content (~320–480px) without a 620px void. **Files:** `app/visual-overhaul.css` threat-flower rules; keep `holdings-stack` 480px as the pattern. **Data-flow:** none. **Acceptance:** `?view=investment&section=i3` radar does not force a tall empty band; lint/build unchanged. **Order:** SF-space; independent of Satya. |
| Investment | **Space I-4:** leftover oversized recommended-risk radar (same 620px rule as I-3) | Axis `RiskRadar` panel uses non-holdings-stack threat-flower | ⚠️ In-Progress | Same as I-3; verify `?view=investment&section=i4`. Blocked-by: SF-space (same CSS). |
| Sectoral Analytics | S-1 Action Board (`?view=sectors&section=s1`) | — | ✅ Done | — |
| Sectoral Analytics | S-2 Pulse page: industry analytics, news columns | `SectorImpactMatrix` CSS heatmap + `.pulse-orb` | ✅ Done | — |
| Sectoral Analytics | S-2 Companies + Rankings pages (`page=companies` or `rankings`) | Rankings ladder (ordered lists, not a chart lib) | ✅ Done | — |
| Sectoral Analytics | S-2 Life-cycle page | recharts `ScatterChart` + `ZAxis` bubbles `SectoralAnalytics.tsx` ~370–390 | ✅ Done | — |
| Sectoral Analytics | S-2 Market-structure page | recharts `ScatterChart` bubbles ~416–437 | ✅ Done | — |
| Sectoral Analytics | S-2 MECE map | `.mece-matrix` + `.mece-loom` CSS | ✅ Done | — |
| Sectoral Analytics | S-2 industry toggle isolation (must not dim MI / S-3 / M-3) | — | ✅ Done | — |
| Sectoral Analytics | S-3 Benchmarks page (Pro `LicenseGate`) | recharts `LineChart` `SectorDecisionLab.tsx` ~197–205 | ✅ Done | — |
| Sectoral Analytics | S-3 Investability / PESTEL / Porter | recharts `RadarChart` ~235–242 | ✅ Done | — |
| Sectoral Analytics | S-3 Macro triggers | `TriggerDial` SVG rings + two vertical `BarChart`s | ✅ Done | — |
| Sectoral Analytics | S-3 local Decision Framework selector (does not mutate S-2) | — | ✅ Done | — |
| Sectoral Analytics | **Space S-1:** exclusive Action Board, canonical three-lane kanban | — | ✅ Done | — |
| Sectoral Analytics | **Space S-2:** exclusive pages + KPI `clamp`/ellipsis; leftover companies table `min-width:1100px` | Pulse heatmap/orbs; lifecycle/structure scatters; MECE CSS | ⚠️ In-Progress | **Target:** companies grid fits the S-2 pane (or a labeled inner horizontal scroll) without a 1100px forced page overflow. **Files:** `app/globals-investment.css` `.sector-company-table table`. **Data-flow:** none. **Acceptance:** `?view=sectors&section=s2&page=companies` no unexplained document-wide horizontal scroll; KPI tiles still unclipped. **Order:** SF-space. |
| Sectoral Analytics | **Space S-3:** exclusive full-section; charts sized by lab panels, not a second Kanban | Line / radar / TriggerDial | ✅ Done | — |
| Market Intelligence | M-1 Action Board: unique IST-day / last NSE-day actions from digest + earnings + corpus as-of ([Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f)) | — | ✅ Done | — |
| Market Intelligence | M-2 Satya briefing canvas: LLM chat, source chips (Axis / MF / Groww / Flipboard / Other / Podcasts / Earnings) | `SatyaBriefingRoom` → `SatyaPresence` glyph + `WaveformStrip` | ✅ Done | — |
| Market Intelligence | M-2 Axis Research 28 categories + `other_research`; default retrieve excludes `live_webinars` | Category chips in briefing | ✅ Done | — |
| Market Intelligence | M-2 compact citation cluster (mail / pdf / podcast / earnings) only inside replies | `SatyaCitationIcons` | ✅ Done | — |
| Market Intelligence | M-2 push-to-talk + TTS (operator Mac; no wake word) | Waveform while listening/speaking | ✅ Done | — |
| Market Intelligence | Satya FTS5 corpus: two mailboxes only, empty vs no-match refusals, `newsletter_other` auto-register | — | ✅ Done | — |
| Market Intelligence | Axis Research PDF archive ingest (`~/Downloads/Axis Research`) as Satya SoT | PDF open only via citation icons | ✅ Done | — |
| Market Intelligence | Operator-Mac-only `POST /api/satya/chat` (Flask loopback + Next local operator) | — | ✅ Done | — |
| Market Intelligence | Digest reading walls removed from Market Intelligence (AGENTS.md M-1/M-2/M-3 only; no M-4/M-5) | — | ✅ Done | — |
| Market Intelligence | Global Satya companion orb + CHATS popup + colored trigger | `SatyaPresence` companion SVG glyph + popup sheet | ✅ Done | — |
| Market Intelligence | Satya multi-turn follow-ups (“compare those two”) | Transcript UI | ✅ Done | — |
| Market Intelligence | M-3 Earnings Calendar sole complete calendar; Apple Calendar = schedule only; IR/NSE KPIs | `EarningsMonthCalendar` month grid | ✅ Done | — |
| Market Intelligence | Native Mac outline M-1 / M-2 Satya / M-3 (no M-4) | — | ✅ Done | — |
| Market Intelligence | **Space M-1:** exclusive Action Board, canonical three-lane | — | ✅ Done | — |
| Market Intelligence | **Space M-2:** full-width briefing (not digest walls); companion orb fixed, not a fifth section | Satya glyph + waveform | ✅ Done | — |
| Market Intelligence | **Space M-3:** exclusive earnings month grid; no sector-dimmed controls | `EarningsMonthCalendar` | ✅ Done | — |
| My Feed | H-1 Health action board (`?view=health&section=h1`) | — | ✅ Done | — |
| My Feed | H-2 Daily Optimism (insights / guidance / guardrails; Notes Health Daily deprecated) | — | ✅ Done | — |
| My Feed | H-3 Vital Metrics direction rows (favourable / context dependent / unfavourable); Body Measurements & Hearing excluded | Category-coloured KPI tiles (not a 4th unavailable column) | ✅ Done | — |
| My Feed | H-3 category pages: activity, sleep, heart, respiratory, mobility, nutrition | — | ✅ Done | — |
| My Feed | H-3 weekly/MTD comparison sparklines | `SparkFilament` SVG via `health-sparkline.ts` | ✅ Done | — |
| My Feed | H-4 Calendar + Reminders (Job 🔍 + Earnings lists; incomplete preserved) | — | ✅ Done | — |
| My Feed | H-4 Apple-style month calendar | `AppleMonthlyCalendar` CSS grid via `IntelligenceDigest` `view="calendar-reminders"` | ✅ Done | — |
| My Feed | Health Incognito (values, drill-downs, a11y, H-4 rows) | — | ✅ Done | — |
| My Feed | Operational IST date policy `healthTargetDate` (D_EVENING / D_OVERNIGHT / D_MINUS_1) | — | ✅ Done | — |
| My Feed | **Space H-1:** compact canonical three-lane (not a Health-only Kanban) | — | ✅ Done | — |
| My Feed | **Space H-2:** in-section `overflow-y:auto` on `.health-full-section` | — | ✅ Done | — |
| My Feed | **Space H-3:** in-section vertical scroll so Favourable tiles stay reachable ([NOT SCROLLING](c7ec1a5c-545b-4237-9f3b-966e8c72435f)) | SparkFilament in tiles | ✅ Done | — |
| My Feed | **Space H-4:** in-section scroll for calendar + reminder lists | Apple month grid | ✅ Done | — |
| Algorithm Canvas | B-1 Action Board (`?view=builder&section=board`) — shared `DailyKanbanBoard` only | — | ✅ Done | — |
| Algorithm Canvas | Nav label **Algorithm Canvas**; chrome title **Algorithm Builder** (`BuilderWorkspace.tsx` h2; `utils.ts` nav) | — | ✅ Done | — |
| Algorithm Canvas | Exclusive B-1 / B-2 / B-3 tabs (`hidden={activeSection !== …}`; default section `canvas`) | — | ✅ Done | — |
| Algorithm Canvas | B-2 Symphony nested strategy tree (Weight / Group / Asset / If-Else / Any-All / Filter; Add a Block) | `TreeCanvas` DOM tree `.symphony-tree` | ✅ Done | — |
| Algorithm Canvas | B-2 Composer-style 3-pane: Details / nested tree / Backtest overview + 8×16 KPI tiles | Bounded `.symphony-tree` `height: min(70dvh, 880px)` (`algorithm-builder-json.css` ~547) | ✅ Done | — |
| Algorithm Canvas | 128-KPI registry as If/Filter operands (not a primary tree block; Interrogate LLM stays gone) | `KpiRegistryPanel` in preview pane | ✅ Done | — |
| Algorithm Canvas | B-2 backtest equity curve only after `ran: true` | Custom SVG `EquityCurve` in `SymphonyEditor.tsx` | ✅ Done | — |
| Algorithm Canvas | B-2 advanced compiled graph (details toggle; read-only snapshot) | `AlgorithmBuilder` SVG edges/nodes | ✅ Done | — |
| Algorithm Canvas | B-3 lossless JSON (tree + compiled `StrategyGraphV2`) | `BuilderJsonPanel` textarea `max-height: min(64dvh, 640px)` | ✅ Done | — |
| Algorithm Canvas | Honest backtest: `ran: true` only after historical OHLCV engine (`tree-backtest.ts` ~275) | Equity curve is the viz | ✅ Done | — |
| Algorithm Canvas | Save / load library from canvas (`BuilderLibraryActions` + `persist.ts`); URL `?tree=` loads Composer or saved id | — | ✅ Done | — |
| Algorithm Canvas | Operator-confirmed Kite order / GTT / alert from tree preview (`TreeBrokerConfirm`); not unattended | — | ✅ Done | — |
| Algorithm Canvas | Indian Core-Satellite seed (`createSeedTree`); NSE/BSE first, not US SPY/QQQ clones | Seed tree in canvas | ✅ Done | — |
| Algorithm Canvas | Interrogate LLM removed (`LlmAssistPanel.tsx` deleted; tests `doesNotMatch(/Interrogate LLM/)`) | — | ✅ Done | — |
| Algorithm Canvas | Inverse Volatility sleeves: stored on the tree, **not executable** (compile + backtest skip with warning) | — | ⚠️ In-Progress | **Target:** `inverse_volatility` sleeves get real inverse-vol weights from OHLCV and participate in `ran: true`. **Files:** `app/strategy/tree-compile.ts`, `app/strategy/tree-backtest.ts`, `tests/algorithm-canvas.test.mjs`. **Data-flow:** sleeve child closes → lookback vol → inverse weights summing to 1; missing bars stay warnings not invented prices. **Acceptance:** seed Inverse Vol sleeve no longer skipped; KPIs change vs specified-weight; `ran` still false if OHLCV missing. **Order:** SF-vol; do not fake `ran`. |
| Algorithm Canvas | **Space B-1:** exclusive Action Board, canonical three-lane | — | ✅ Done | — |
| Algorithm Canvas | **Space B-2:** RCA 16 Aug unbounded 620px black canvas **fixed** on Symphony; tree bounded 70dvh/880px | Tree + EquityCurve; advanced graph opt-in | ✅ Done | — |
| Algorithm Canvas | **Space B-3:** JSON tab exclusive; textarea capped | — | ✅ Done | — |
| Strategies | Y-1 Action Board (`?view=strategies&section=y1`) | — | ✅ Done | — |
| Strategies | Y-2 Composer-public `StrategyTreeV1` library: **9** reconstructions (US logic → Nifty 500 names) | Compact 220px `ReadOnlyTree` previews | ✅ Done | — |
| Strategies | Y-2 honest unreconstructed list (`COMPOSER_UNRECONSTRUCTED`, 4 public pages without a tree) | — | ✅ Done | — |
| Strategies | Y-2 saved trees from Builder + **Open in Algorithm Canvas** (`?view=builder&section=canvas&tree=`) | — | ✅ Done | — |
| Strategies | Y-2 strategy detail dialog | `ReadOnlyTree` CSS vertical tree | ✅ Done | — |
| Strategies | Y-2 NSE tree-backtest stats overlay (yfinance cache `library-nse-stats`; `—` until run) | KPI tiles on cards (not a second equity-curve wall) | ✅ Done | — |
| Strategies | Y-2 sort by annualized / cumulative / Sharpe | — | ✅ Done | — |
| Strategies | Y-2 copy-only Streak scanner export (Ultra; `placesOrders` always false) | — | ✅ Done | — |
| Strategies | **Multi-algo as sequential singles:** develop one tree in Builder, save, open another, backtest one engine pass at a time | Per-tree EquityCurve only in Builder | ✅ Done | — |
| Strategies | **Side-by-side compare** of two algorithms (two curves / KPI columns in one view) | Dual equity curves — **no component** | ❌ Not Implemented | **Target:** operator picks two library/Composer ids and sees two KPI columns plus two honest curves. **Files:** `StrategiesWorkspace.tsx`, `strategies-workspace.css`; reuse `EquityCurve` / `runTreeBacktestOnServer`. **Data-flow:** two `StrategyTreeV1` → two OHLCV runs → no blended weights. **Acceptance:** compare dialog; blank `—` if a run did not `ran`. **Order:** SF-multi before ensemble. |
| Strategies | **Multi-algo ensemble / book** (weighted portfolio of several trees, one combined backtest) | Combined book curve — **absent** | ❌ Not Implemented | **Target:** optional book document with tree ids + weights; one combined equity curve. **Files:** new persist shape beside `StrategyTreeV1` (do not bump graph schemaVersion); Strategies Y-2 book UI; `tree-backtest.ts` aggregator. **Data-flow:** per-tree target weights → daily combined positions. **Acceptance:** `ran: true` only after OHLCV; missing tree named. **Order:** after compare; never a 7th workspace. |
| Strategies | **Multi-tree campaign / walk-forward sweep** across many algorithms | Sweep chart — **absent** | ❌ Not Implemented | **Target:** batch backtest of selected library trees with a shared window; table of honest KPIs. **Files:** API under `app/api/backtests` + Y-2 toolbar. **Data-flow:** same engine, many ids. **Acceptance:** no fabricated ranks; Streak still copy-only. **Order:** after compare; ensemble optional. |
| Strategies | **Space Y-1:** exclusive Action Board, canonical three-lane | — | ✅ Done | — |
| Strategies | **Space Y-2:** exclusive library; 2-col gallery; compact 220px tree (RCA 16 Aug giant black cards **fixed**) | Compact ReadOnlyTree | ✅ Done | — |
| Cross-cutting | Source freshness strip (no standalone startup-fail banner) | `PulseConstellation` CSS nodes (`page.tsx`) | ✅ Done | — |
| Cross-cutting | Local license Basic / Pro / Ultra (`LicenseGate`, feature map) | — | ✅ Done | — |
| Cross-cutting | In-repo Razorpay webhook HMAC + signed JWT activate (hosted merchant env-gated) | — | ✅ Done | — |
| Cross-cutting | Integrations / Settings chrome (`?view=integrations`, not a workspace; no Kanban) | — | ✅ Done | — |
| Cross-cutting | Appearance black / dark / sepia; buttons/text follow selected theme | — | ✅ Done | — |
| Cross-cutting | Pro PDF Investment Brief `/report` + `/api/report-pdf` | `PrintNestedDonut` SVG sunburst | ✅ Done | — |
| Cross-cutting | Native macOS Stratji AppKit (sidebar + WKWebView `nativeChrome=1`, Flask supervisor) | Satya speech bridge | ✅ Done | — |
| Cross-cutting | Native iOS six-workspace client (LAN/Bonjour pairing; not Tailscale-only) | Native holdings/metrics tiles (not web charts) | ✅ Done | — |
| Cross-cutting | iOS Market Intelligence = M-1/M-2 Satya/M-3 (no newsletter/Axis/podcast walls) | — | ✅ Done | — |
| Cross-cutting | Groww live snapshot when `GROWW_ACCESS_TOKEN` is set; **unavailable** without token (never invents qty) | — | ✅ Done | — |
| Cross-cutting | Flask gateway + `scripts/refresh-dashboard-data.sh` complete-refresh contract | — | ✅ Done | — |
| Cross-cutting | Six workspaces each mount the same `DailyKanbanBoard` (Integrations does not; **no** compact/single-lane variants) | — | ✅ Done | — |
| Cross-cutting | **Space chrome:** sticky I1–I4 / S1–S3 / M1–M3 / H1–H4 nav; hidden siblings occupy no space; heading `margin-top: 0` (no second empty band) | — | ✅ Done | — |
| Cross-cutting | **Space native Mac:** masthead/workspace tabs hidden; WKWebView full-height; section navs stay (`native-chrome.css`) | — | ✅ Done | — |
| Cross-cutting | **Space iPhone:** `compactWorkspaceBar` / compact outline (`NativeWorkspaceViews.swift`) | Native tiles, not web recharts | ✅ Done | — |
| Cross-cutting | Hover-pop allowlist on cards/chips only; whole panels/lanes/collapsibles stay still (`hover-pop.css`) | — | ✅ Done | — |

---

## Data-flow (short)

- **Investment:** Kite MCP → `app/kite-live-server.ts` → `/api/kite/snapshot` → `page.tsx` `loadKite` → `InvestmentWorkspace`. Axis CMP overlay from digest + quotes.
- **Sectors:** yfinance (`sector-live-server.ts`) + optional Kite MD + RSS news + NSE benchmarks → S-2/S-3. Narratives in `sector-data.ts` are static research copy.
- **Market Intelligence:** Mail/Podcasts digest (`content-digest-server.mjs`, two mailboxes) + Axis PDFs + verified earnings → Satya sqlite + M-1 actions + M-3 calendar. Chat POST operator-Mac only.
- **My Feed:** HealthKit ZIP + Health Shortcut overrides → `health-snapshot.json` via Flask `/_health/snapshot`. H-4 calendar/reminders from the same content digest (not a third mailbox).
- **Algorithm Canvas:** `StrategyTreeV1` in `SymphonyEditor` → `compileTreeToGraph` → persist library; `runTreeBacktestOnServer` / `tree-backtest.ts` walks OHLCV. Inverse-vol sleeves skipped until SF-vol.
- **Strategies:** Composer catalog (9 trees) + local library; NSE stats from yfinance cache; Open in Builder via `?tree=`; Streak is copy-only JSON (`placesOrders: false`). No ensemble book.
- **Exports:** `/report` refreshes Kite/content/sectors/earnings then local PDF renderer `:3002`.

---

## Three operator-requested areas (orientation)

1. **Algorithm builder** — shipped as workspace five (`?view=builder`, B-1/B-2/B-3). Symphony tree, honest backtest, lossless JSON, Interrogate LLM gone. Inverse Volatility is the only coded gap (stored, not run).
2. **Multi-algorithm development + backtesting** — sequential singles + 9 Composer reconstructions + saved trees + NSE stats + Streak copy-only **exist**. Side-by-side compare, ensemble book, and campaign/walk-forward **do not**.
3. **Space / compact layouts** — exclusive sections, canonical I-1 kanban, H-2–H-4 scroll, native chrome, Y-2 compact cards, B-2 bounded tree **exist**. Leftover oversized chrome: I-3/I-4 620px radar min-height and S-2 1100px company table.

---

## Self-audit

| Gate | Result |
| --- | --- |
| S1 Canonical columns | Pass |
| S2 Completeness | Pass — six workspaces + Algorithm Builder extras + multi-algo distinguish + per-section space I-1…Y-2 |
| S3 Tri-state only | Pass |
| S4 Evidence | Pass — paths in table / this header |
| S5 Plans on pending | Pass — 4 ⚠️ + 3 ❌ have plans |
| S6 No Plan-as-Done | Pass — uncommitted coded work scored from files; Inverse-vol/compare/ensemble not marked Done |
| S7 No implement/RCA/commit | Pass |
| S8 Root | Pass — writes under project `Plans/` + canvases dir; `move_agent_to_root` blocked for subagent |
| S9 Canvas | Pass — `project-status.canvas.tsx` |
| S10 Secrets | Pass |
| S11 Chat mining | Pass — SearchConversations unavailable; transcripts grepped |
| S12 Grain | Pass — not one row per workspace |
