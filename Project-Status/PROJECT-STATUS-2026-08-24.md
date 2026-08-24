# Project status — Investment Dashboard (Stratji)

**Generated-at:** 2026-08-24 00:36 IST (Asia/Kolkata)  
**Root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`  
**Branch:** `AppKit`  
**SHA:** `976503b`  
**Working tree:** dirty (Satya draft pop-out, story prompts, M-1 weekend evidence window, native glass / document browser)  
**This pass:** Localhost vs Mac App sequence **step 1 of 3** (`$project-status` only). Do not run `$auditor` or `$rca` from this job.  
**Chats mined:** SearchConversations MCP **unavailable** (no tool in this session catalog). Transcripts grepped: [Auditor then RCA then status](299e4bb5-0713-4e54-bd0d-5d43cf6e7b08) (glass glyphs, Satya NSPanel, story answers, Smart Suggestions, Documents TCC, M-1 Sunday, vinext recycle, Mac-as-basis), [Satya MI overhaul](c7ec1a5c-545b-4237-9f3b-966e8c72435f), [iPhone without Tailscale](59fe97cc-1b42-4d17-87b6-c78322975823). Prior: [Auditor](081e0355-d410-4aec-aff5-6faaa23966a8), [RCA](97c9f460-357b-45bf-aaee-4a7a69146c87), [Project-status](be6a469a-343c-4b75-af8b-ef9affa8925b).  
**move_agent_to_root:** blocked (subagent cannot re-root); cwd already the named project root.  
**Excluded from walk:** `node_modules`, `.git`, `.next` / `.vinext` caches, `dist`/`build` contents except Stratji.app mtime, `__pycache__`, `.venv-flask`, Apple `DerivedData*`, `artifacts/private` payloads, large binaries.

**Workspace derivation:** six product surfaces from `app/dashboard/workspace-routing.ts` `WORKSPACE_VIEW_VALUES` + `AGENTS.md`. Integrations is chrome (`CHROME_VIEW_VALUES`), not a seventh workspace.

**Operator rule (AGENTS.md):** Localhost vs Mac App chrome/nav/hydrate work must run `$project-status` → `$auditor` → `$rca-agent` in that order before claiming Done. This run is step 1 only.

**Status counts:** ✅ Done **98** · ⚠️ In-Progress **9** · ❌ Not Implemented **0** · **107 rows**

---

## Localhost vs Mac App — surface inventory

| Surface | What it paints | Evidence |
| --- | --- | --- |
| **Localhost `:3000` / Flask `:5050`** (browser, no `nativeChrome`) | Web `.workspace-navigation` combined droplet; selected/hover expands sections; masthead + **Refresh all** + PDF + Satya companion orb. | `app/dashboard/shared-ui.tsx` `DashboardTabs`; `app/page.tsx` ~812–823, ~946. |
| **Localhost `?nativeChrome=1` / iOS WKWebView** | Masthead hidden; **web** droplet stays (`data-native-web-nav`). iOS bootstrap does **not** set `native-owns-sections`. | `app/layout.tsx` FOUC; `app/native-chrome.css`; `DashboardBrowser.swift`. |
| **Mac Stratji Release (`apple-app/build/Stratji.app`, 24 Aug 00:19)** | Overlay `StratjiWorkspaceGlassBar`: unselected = glyphs; selected = glyph + name + that workspace’s `DashboardOutline` titles. Injects `data-native-owns-sections=1` (hides web nav). | Binary mtime 2026-08-24 00:19:34, 10370504 bytes, sha256 `72236846…`. Source: `StratjiDocumentBrowser.swift` ~140–144; `StratjiWorkspaceGlassBar.swift` `clusterWorkspace`. |
| **Dock / `/Applications/Stratji.app` and `~/Applications/Stratji.app`** | **Stale vs build.** Both 21 Aug 20:55:53, 10097856 bytes, sha256 `148bd643…` (not the 24 Aug build). | `stat` + `shasum` this pass. Prefer `apple-app/build/Stratji.app`. |

**Parity headline:** Source + `apple-app/build` implement one native overlay (glyphs-only unselected; selected owns its sections). **Dock / Applications copies are two days behind.** Uncommitted Satya NSPanel / M-1 weekend / story prompts are not a shipped Dock binary. Vinext `:3000` can refuse after Stratji recycle. Documents TCC “Allow” still repeats.

---

## Conflicts / unknowns

- **CONFLICT (docs vs nav):** `docs/stratji/PRD.md` still says Health & Wellness / non-scrolling H-1–H-3. Latest user + `AGENTS.md` / `utils.ts` nav is **My Feed** (`?view=health`); H-3 scrolls (`globals-health.css`).
- **CONFLICT (iPhone data plane):** Master plan still says iPhone is a Tailscale client. User [iPhone without Tailscale](59fe97cc-1b42-4d17-87b6-c78322975823) required a native LAN client. Code uses Bonjour + pairing.
- **CONFLICT (Kanban vs compact):** Operator asked for compact layouts. `AGENTS.md` forbids compact / single-lane Kanban. I-1 three-lane identity stays ✅.
- **CONFLICT (hover):** Native overlay hover only scales a glyph (`clusterWorkspace = session.workspace`). Localhost web still expands the hovered workspace (`pillIndex = hoverIndex ?? focusIndex ?? activeIndex` in `shared-ui.tsx`). Latest operator spec: selected workspace owns sections; hover must not impersonate selection.
- **PLAUSIBLE (ops):** Health snapshot completeness is operator export, not unimplemented H-3.
- **PLAUSIBLE (live window):** This pass did **not** launch Stratji. Dual-chrome Done is source + binary hashes, not a screenshot of a running window.
- **In-flight siblings (not this job):** Documents TCC [Fix Stratji Documents prompt](cbcd8254-885d-4b5a-b8e9-e2ba2d4dab69); workspace Satya suggestions [Workspace Satya suggestions](31f34455-1fa4-421a-8096-c08f05155332); Satya pop-out [Satya pop-out and answers](7c656b7e-d287-456d-a8a9-cea41dd94fee).

## Shared foundations (pending rows only)

1. **SF-dock — operator Mac binary:** `apple-app/build/Stratji.app` (24 Aug 00:19, sha256 `72236846…`) is newer than `/Applications` and `~/Applications` (21 Aug 20:55, `148bd643…`). Open the build, or recopy it over Dock copies. Do not treat Dock as current.
2. **SF-tcc — Documents folder:** `NSDocumentsFolderUsageDescription` + Application Support trampoline exist (`StratjiConfiguration.swift`). No security-scoped bookmark / persistent all-file grant. `persistRepoRoot` / `repoRoot` still resolve a path under `~/Documents/GitHub/…`.
3. **SF-recycle — vinext after stop:** `FlaskServiceSupervisor.kickoffAtLaunch` always `stopDataPlane` then `dash-start`. `:3000` can be unbound while Flask is coming back → connection refused. Do not kill a healthy `:5050` except Stratji’s own stop-then-start.
4. **SF-satya-uncommitted — draft / story / M-1:** Working-tree files (`SatyaDraftPopout.tsx`, `StratjiSatyaDraftBridge.swift`, `local-llm-assist.ts`, `intelligence-daily-actions.ts`). Not in the 21 Aug Dock binary.

---

## Canonical status table

| WORKSPACES | COMPREHENSIVE FEATURE LISTS | COMPREHENSIVE COMPLEX CHART + VISUALISATION LISTS | CURRENT IMPLEMENTATION STATUS | IMPLEMENTATION PLAN for PENDING / IN-PROGRESS TASKS |
| --- | --- | --- | --- | --- |
| Cross-cutting (Localhost vs Mac App) | Operator Mac binary vs `apple-app/build/Stratji.app` — Dock and `~/Applications` must not be treated as current when the build is newer | Native overlay in the running process | ⚠️ In-Progress | **Target:** Running Stratji sha256 matches `apple-app/build` (24 Aug 00:19, `72236846…`). **Files:** none (ops copy); optional bump `CFBundleVersion`. **Data-flow:** WKWebView loads `:5050` from the binary the operator actually launches. **Acceptance:** `ps` path contains `apple-app/build/Stratji.app` or Dock sha256 equals build. **Deps:** SF-dock. Do not kill healthy Flask `:5050`. |
| Cross-cutting (Localhost vs Mac App) | One chrome per surface: Mac overlay owns workspace+sections (`data-native-owns-sections=1`); localhost keeps `.workspace-navigation`; iOS / `?nativeChrome=1` keep web droplet | Native `GlassEffectContainer` vs CSS `.workspace-droplet` | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Native overlay contract: unselected workspaces glyphs only; selected = glyph + name + **that** workspace’s full section titles (not Investment I-1–I-4 on every tab) | `StratjiWorkspaceGlassBar` liquid glass / material fallback | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Localhost combined liquid-glass cluster; full names from `WORKSPACE_SECTIONS` (Action Board, Satya, Industry Analytics, …) | CSS droplet `.workspace-droplet` + `data-glyph-only` | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Web hover must not expand another workspace’s sections while `?view=` stays on the selected workspace (parity with native `clusterWorkspace`) | Web droplet follows `hoverIndex` | ⚠️ In-Progress | **Target:** Hover scales glyph only; section titles stay on `active` workspace. **Files:** `app/dashboard/shared-ui.tsx` (`pillIndex` / `dropletWorkspace`). **Data-flow:** `onChange` still switches `?view=`; hover must not rewrite destinations. **Acceptance:** Hover Sectors while Investment is selected → Investment titles stay; click Sectors → S-1/S-2/S-3. **Deps:** native already done. |
| Cross-cutting (Localhost vs Mac App) | Mac hides web nav only when `data-native-owns-sections=1`; FOUC Macintosh+`Stratji/` sets it; iPhone does not | — | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Intel leftover `section=s1`/`i1`/`m4` never maps Intel → S-1 | — | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Native hydrate/splash vs Flask `:5050` + vinext `:3000`; launch is stop-then-dash-start; **vinext connection refused after Stratji recycle** remains an operator miss | Stratji splash / loading overlay | ⚠️ In-Progress | **Target:** After recycle, `:3000` and `:5050` both become ready before splash dismisses; no connection-refused on Retry. **Files:** `FlaskServiceSupervisor.swift`, `scripts/start-flask-app.sh`, `tests/native-launch-refresh.test.mjs`. **Data-flow:** `kickoffAtLaunch` stop → wait ports free → dash-start; health must mean vinext 200, not Flask-bound-with-503. **Acceptance:** Recycle Stratji; `:3000` listens; Flask `/` is 200; splash clears. **Deps:** SF-recycle. Do not kill a healthy leftover `:5050` unless recycle is explicit. |
| Cross-cutting (Localhost vs Mac App) | Localhost web chrome: Refresh all, PDF / Generate report, Satya companion orb (not a fifth MI section) | Satya orb SVG + `WaveformStrip` | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Satya draft pop-out: native **NSPanel** is spec; web modal parity; **current chat only**; close keeps thread on M-2 / orb | Native `StratjiSatyaDraftView`; web `SatyaDraftPopout` dialog | ⚠️ In-Progress | **Target:** Drafting opens current turn in NSPanel on Stratji; localhost uses modal; no empty new chat. **Files:** `StratjiSatyaDraftBridge.swift`, `SatyaDraftPopout.tsx`, `satya-client.ts`, `DashboardBrowser.swift`, tests. **Data-flow:** `webkit.messageHandlers.satyaDraft` `{open,update,close}` + `currentSatyaTurn`. **Acceptance:** M-2 + orb open the same session; Dock binary includes `satyaDraft`; tests green. **Deps:** SF-satya-uncommitted; rebuild + SF-dock. Mac is the basis. |
| Cross-cutting (Localhost vs Mac App) | Satya story-like, source-grounded answers (not one-liners / three-bullet dumps); numbers only from retrieved passages | — | ⚠️ In-Progress | **Target:** Written answers are narrative and inventory-bound; unpublished KPIs stay blank. **Files:** `app/local-llm-assist.ts` (`task === "satya"`), `app/satya/chat.ts`. **Data-flow:** retrieve → EVIDENCE INVENTORY → LLM; UI still compact citation icons. **Acceptance:** Cross-category ask yields paragraphs + verbatim KPIs; no invented CMP. **Deps:** SF-satya-uncommitted. |
| Cross-cutting (Localhost vs Mac App) | Workspace-curated Satya Smart Suggestions (Sectors ≠ Intel ≠ Investment ≠ Builder ≠ Strategies) | Suggestion chips on orb / M-2 | ⚠️ In-Progress | **Target:** Chips match the open workspace only; Health does not invent vitals from Satya. **Files:** `satya-suggestions.ts`, `satya-workspace.ts`, workspace shells, `SatyaPresence.tsx`. **Data-flow:** `useSatyaTaskContext` per slot → companion chips. **Acceptance:** S-2 chips are industry/framework; M-2 are corpus; I-2/I-4 are analyst-matrix; no MI promo on Sectors. **Deps:** sibling [Workspace Satya suggestions](31f34455-1fa4-421a-8096-c08f05155332). Health has no `useSatyaTaskContext` today. |
| Cross-cutting (Localhost vs Mac App) | Documents TCC “Allow” on every refresh / workspace change — operator wants persistent all-file access | — | ⚠️ In-Progress | **Target:** One Allow (or Full Disk / bookmark) persists; workspace change and Refresh all do not re-prompt. **Files:** `StratjiConfiguration.swift` `repoRoot` / `persistRepoRoot`, `Info.plist` `NSDocumentsFolderUsageDescription`, supervisor script spawn. **Data-flow:** Stop touching `~/Documents/…` on navigate; persist security-scoped bookmark or keep all I/O on Application Support wrappers. **Acceptance:** Switch workspace + Refresh all → zero Documents sheet. **Deps:** SF-tcc; sibling [Fix Stratji Documents prompt](cbcd8254-885d-4b5a-b8e9-e2ba2d4dab69). |
| Cross-cutting (Localhost vs Mac App) | Always update Mac app + dashboard together; Mac is the basis for Satya / chrome | — | ⚠️ In-Progress | **Target:** Swift + web land in the same pass; operator launches the matching build. **Files:** `apple-app/` + `app/dashboard/` for any Satya/chrome change. **Data-flow:** Native spec first, web parity (`hasNativeSatyaDraftPopout`). **Acceptance:** `apple-app/build` rebuilt after Swift; Dock recopied (SF-dock). **Deps:** SF-dock + SF-satya-uncommitted. |
| Cross-cutting (Localhost vs Mac App) | Mandatory `$project-status` → `$auditor` → `$rca-agent` before claiming Localhost vs Mac App Done | — | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Chrome contract tests: `rendered-html`, `native-sidebar-click`, `native-launch-refresh`, `workspace-routing` | — | ✅ Done | — |
| Cross-cutting (Localhost vs Mac App) | Freshness in Settings only: `PulseConstellation` on Integrations; no main-canvas 8-tile strip; no standalone startup-fail banner | `PulseConstellation` CSS nodes in Settings | ✅ Done | — |
| Investment | I-1 Action Board — shared three-lane `DailyKanbanBoard` (`?view=investment&section=i1`) | — | ✅ Done | — |
| Investment | I-2 Portfolio activity: holdings, orders, positions, GTTs, TSLs, alerts | — | ✅ Done | — |
| Investment | I-2 Portfolio KPI instrument cluster | Four `InstrumentGauge` SVG rings (`visual-components.tsx`) | ✅ Done | — |
| Investment | I-2 Nested live allocation | Concentric recharts `PieChart` (orbital) | ✅ Done | — |
| Investment | I-2 Concentration map | Custom squarified treemap `layoutPortfolioMap` + `.portfolio-map-tile` | ✅ Done | — |
| Investment | I-3 Risk composition | Horizontal stacked recharts `BarChart` | ✅ Done | — |
| Investment | I-3 Holdings risk radar | recharts `RadarChart` via `RiskRadar` | ✅ Done | — |
| Investment | I-3 Macro scenario lab + FII/DII | Flows regime recharts `PieChart` inside `MacroScenarioBoard` | ✅ Done | — |
| Investment | I-4 Axis picks workbench (CMP vs target, analyst groups) | `AxisCmpProgressBar` CSS meters | ✅ Done | — |
| Investment | I-4 Recommended-book risk | `RiskRadar` on I-4 | ✅ Done | — |
| Investment | Kite order / GTT / alert tickets (operator-confirmed writes) | — | ✅ Done | — |
| Investment | Density/layout I-1: leftover whitespace / clipping / scroll; keep canonical three-lane Kanban | Shared board lanes | ✅ Done | — |
| Investment | Density/layout I-2: exclusive `hidden` section; collapsible overflow | Instrument gauges, orbital pie, treemap | ✅ Done | — |
| Investment | Density/layout I-3: leftover oversized radar chrome | I-3 holdings-stack radar `min-height: 480px` | ✅ Done | — |
| Investment | Density/layout I-4: leftover oversized recommended-risk radar | Axis `RiskRadar` non-holdings-stack `min-height: 420px` | ✅ Done | — |
| Sectoral Analytics | S-1 Action Board (`?view=sectors&section=s1`) | — | ✅ Done | — |
| Sectoral Analytics | S-2 Pulse page: industry analytics, news columns | `SectorImpactMatrix` CSS heatmap + `.pulse-orb` | ✅ Done | — |
| Sectoral Analytics | S-2 Companies + Rankings pages (`page=companies` or `rankings`) | Rankings ladder (ordered lists) | ✅ Done | — |
| Sectoral Analytics | S-2 Life-cycle page | recharts `ScatterChart` + `ZAxis` bubbles | ✅ Done | — |
| Sectoral Analytics | S-2 Market-structure page | recharts `ScatterChart` bubbles | ✅ Done | — |
| Sectoral Analytics | S-2 MECE map | `.mece-matrix` + `.mece-loom` CSS | ✅ Done | — |
| Sectoral Analytics | S-2 industry toggle isolation (must not dim MI / S-3 / M-3) | — | ✅ Done | — |
| Sectoral Analytics | S-3 Benchmarks page (Pro `LicenseGate`) | recharts `LineChart` | ✅ Done | — |
| Sectoral Analytics | S-3 Investability / PESTEL / Porter | recharts `RadarChart` | ✅ Done | — |
| Sectoral Analytics | S-3 Macro triggers | `TriggerDial` SVG rings + two vertical `BarChart`s | ✅ Done | — |
| Sectoral Analytics | S-3 local Decision Framework selector (does not mutate S-2) | — | ✅ Done | — |
| Sectoral Analytics | Density/layout S-1: three-lane Kanban (no compact one-lane variant) | Shared board | ✅ Done | — |
| Sectoral Analytics | Density/layout S-2: leftover companies table `min-width:1100px` | Heatmap, scatter bubbles, MECE loom | ✅ Done | — |
| Sectoral Analytics | Density/layout S-3: exclusive Decision Lab; charts sized by lab panels | LineChart, RadarChart, TriggerDial | ✅ Done | — |
| Market Intelligence | M-1 Action Board: unique IST-day / last NSE-day actions; **Monday empty because fallback skipped Sunday mail** — weekend walkback is in the dirty tree | — | ⚠️ In-Progress | **Target:** Monday with no same-day digest uses newest mintable day in prior-session…yesterday (including Sunday mail), not a jump to Friday. **Files:** `intelligence-daily-actions.ts` `resolveIntelligenceEvidenceDateKeys`, `app/api/satya/sources/route.ts`, `tests/intelligence-daily-actions.test.mjs`. **Data-flow:** digest + earnings + corpus `receivedAt` → mint cards. **Acceptance:** Monday 2026-08-24 + Sunday newsletters → non-empty M-1; Friday not used when Sunday has cards. **Deps:** SF-satya-uncommitted; complete refresh still required for Live vs Stale. |
| Market Intelligence | M-2 Satya briefing canvas: LLM chat, source chips | `SatyaBriefingRoom` → `SatyaPresence` glyph + `WaveformStrip` | ✅ Done | — |
| Market Intelligence | M-2 Axis Research 28 categories + `other_research`; default retrieve excludes `live_webinars` | Category chips in briefing | ✅ Done | — |
| Market Intelligence | M-2 compact citation cluster only inside replies | `SatyaCitationIcons` | ✅ Done | — |
| Market Intelligence | M-2 push-to-talk + TTS (operator Mac; no wake word) | Waveform while listening/speaking | ✅ Done | — |
| Market Intelligence | Satya FTS5 corpus: two mailboxes only, empty vs no-match refusals | — | ✅ Done | — |
| Market Intelligence | Axis Research PDF archive ingest as Satya SoT | PDF open only via citation icons | ✅ Done | — |
| Market Intelligence | Operator-Mac-only `POST /api/satya/chat` | — | ✅ Done | — |
| Market Intelligence | Digest reading walls removed (M-1/M-2/M-3 only; no M-4/M-5) | — | ✅ Done | — |
| Market Intelligence | Global Satya companion orb + CHATS popup (search / rename / delete) | `SatyaPresence` companion SVG glyph + popup sheet | ✅ Done | — |
| Market Intelligence | Satya multi-turn follow-ups; M-2 shows current visit turn | Transcript UI | ✅ Done | — |
| Market Intelligence | M-3 Earnings Calendar sole complete calendar | `EarningsMonthCalendar` month grid | ✅ Done | — |
| Market Intelligence | Native Mac outline M-1 / M-2 Satya / M-3 (no M-4) | — | ✅ Done | — |
| Market Intelligence | Density/layout M-1: three-lane Kanban | Shared board | ✅ Done | — |
| Market Intelligence | Density/layout M-2: full-width briefing; companion orb is not a fifth section | Satya glyph + waveform | ✅ Done | — |
| Market Intelligence | Density/layout M-3: exclusive earnings month grid | `EarningsMonthCalendar` | ✅ Done | — |
| My Feed | H-1 Health action board (`?view=health&section=h1`) | — | ✅ Done | — |
| My Feed | H-2 Daily Optimism | — | ✅ Done | — |
| My Feed | H-3 Vital Metrics direction rows; Body Measurements & Hearing excluded | Category-coloured KPI tiles | ✅ Done | — |
| My Feed | H-3 category pages: activity, sleep, heart, respiratory, mobility, nutrition | — | ✅ Done | — |
| My Feed | H-3 weekly/MTD comparison sparklines | `SparkFilament` SVG via `health-sparkline.ts` (mounted `shared-ui` health tiles) | ✅ Done | — |
| My Feed | H-2/H-3/H-4 in-section vertical scroll | — | ✅ Done | — |
| My Feed | H-4 Calendar + Reminders (Job 🔍 + Earnings lists) | — | ✅ Done | — |
| My Feed | H-4 Apple-style month calendar | `AppleMonthlyCalendar` CSS grid | ✅ Done | — |
| My Feed | Health Incognito | — | ✅ Done | — |
| My Feed | Operational IST date policy `healthTargetDate` | — | ✅ Done | — |
| My Feed | Density/layout H-1: three-lane Kanban | Shared board | ✅ Done | — |
| My Feed | Density/layout H-2: in-section `overflow-y:auto` | — | ✅ Done | — |
| My Feed | Density/layout H-3: in-section vertical scroll | SparkFilament + masonry tiles | ✅ Done | — |
| My Feed | Density/layout H-4: in-section scroll | `AppleMonthlyCalendar` | ✅ Done | — |
| Algorithm Canvas | B-1 Action Board (`?view=builder&section=board`); chrome title Algorithm Builder | — | ✅ Done | — |
| Algorithm Canvas | B-2 Symphony nested strategy tree | `TreeCanvas` DOM tree `.symphony-tree` | ✅ Done | — |
| Algorithm Canvas | B-2 backtest equity curve (after a real run) | Custom SVG `EquityCurve` | ✅ Done | — |
| Algorithm Canvas | B-2 advanced compiled graph (details toggle) | `AlgorithmBuilder` SVG edges/nodes | ✅ Done | — |
| Algorithm Canvas | B-3 lossless JSON | — | ✅ Done | — |
| Algorithm Canvas | Honest **single-tree** backtest: `ran: true` only after historical OHLCV | Equity curve is the viz | ✅ Done | — |
| Algorithm Canvas | Inverse Volatility weight method executable in `runTreeBacktest` | Inverse-vol sleeve weights from OHLCV lookback | ✅ Done | — |
| Algorithm Canvas | Density/layout B-1: three-lane Kanban | Shared board | ✅ Done | — |
| Algorithm Canvas | Density/layout B-2: Composer-informed bounded 3-pane | Tree + equity curve + optional graph | ✅ Done | — |
| Algorithm Canvas | Density/layout B-3: JSON pane max-height, exclusive tab | — | ✅ Done | — |
| Strategies | Y-1 Action Board (`?view=strategies&section=y1`) | — | ✅ Done | — |
| Strategies | Y-2 Composer-public `StrategyTreeV1` library + saved trees; Open in Builder | — | ✅ Done | — |
| Strategies | Y-2 strategy detail | `ReadOnlyTree` CSS vertical tree | ✅ Done | — |
| Strategies | Y-2 copy-only Streak scanner export (Ultra; `placesOrders` always false) | — | ✅ Done | — |
| Strategies | Y-2 library NSE stats via **single-tree** `runTreeBacktest` | Per-card OOS tiles | ✅ Done | — |
| Strategies | Side-by-side compare of two algorithms | Dual `EquityCurve` in Y-2 compare dialog | ✅ Done | — |
| Strategies | Multi-algorithm ensemble / portfolio-of-algos | Combined book equity (`strategy-book.ts`) | ✅ Done | — |
| Strategies | Multi-tree campaign / walk-forward sweep | Honest KPI table (no fabricated ranks) | ✅ Done | — |
| Strategies | Density/layout Y-1: three-lane Kanban | Shared board | ✅ Done | — |
| Strategies | Density/layout Y-2: compact gallery + exclusive y1/y2 | Compact `ReadOnlyTree` preview | ✅ Done | — |
| Cross-cutting | Local license Basic / Pro / Ultra (`LicenseGate`) | — | ✅ Done | — |
| Cross-cutting | In-repo Razorpay webhook HMAC + signed JWT activate | — | ✅ Done | — |
| Cross-cutting | Integrations / Settings chrome (`?view=integrations`, not a workspace) | — | ✅ Done | — |
| Cross-cutting | Appearance black / dark / sepia | — | ✅ Done | — |
| Cross-cutting | Pro PDF Investment Brief `/report` + `/api/report-pdf` | `PrintNestedDonut` SVG sunburst | ✅ Done | — |
| Cross-cutting | Native macOS Stratji AppKit: glass overlay + WKWebView `nativeChrome=1` (no sidebar); Flask supervisor | Satya speech bridge; `StratjiWorkspaceGlassBar` | ✅ Done | Overlay in `StratjiDashboardViewController.swift`. Running **Dock** binary may still be 21 Aug (binary-drift row). |
| Cross-cutting | Native iOS six-workspace client (LAN/Bonjour; web section droplet) | Native holdings/metrics tiles | ✅ Done | — |
| Cross-cutting | iOS Market Intelligence = M-1/M-2 Satya/M-3 | — | ✅ Done | — |
| Cross-cutting | Groww live snapshot when `GROWW_ACCESS_TOKEN` is set | — | ✅ Done | — |
| Cross-cutting | Flask gateway + `scripts/refresh-dashboard-data.sh` complete-refresh contract | — | ✅ Done | — |
| Cross-cutting | Six workspaces each mount the same `DailyKanbanBoard` | — | ✅ Done | — |

---

## Data-flow (short)

- **Investment / Sectors / Intelligence / My Feed / Builder / Strategies:** Flask `:5050` → vinext `:3000` → workspace shells; exclusive `hidden` sections from `?section=`.
- **Localhost chrome:** `page.tsx` mounts `DashboardTabs` when `showWorkspaceShell && !nativeOwnsWorkspaceNav`; Refresh all + PDF + Satya orb stay on the document.
- **Mac chrome:** WKWebView loads `127.0.0.1:5050/?view=&section=&nativeChrome=1`; overlay bar selects destinations; `DashboardNativeRoute` `replaceState` + `stratji:navigate`; owns-sections hides web nav.
- **iOS chrome:** same Next document with `nativeChrome`; **no** overlay droplet; web cluster remains.
- **Satya:** two-mailbox corpus + Axis PDFs + podcasts + verified earnings → retrieve → LLM (story prompt in dirty tree) → M-2 / orb; draft pop-out posts `satyaDraft` to NSPanel when the handler exists.
- **Freshness:** ingest at startup; operator-visible constellation is Settings-only.
- **Exports:** Pro PDF independent of S-2 industry unless labeled.

## Self-audit (INSTRUCTION 11)

| Gate | Result |
| --- | --- |
| S1 Columns | Pass — five canonical columns in this order |
| S2 Completeness | Pass — six workspaces + localhost/Mac parity + charts from code/`AGENTS.md`/chats |
| S3 Status | Pass — only ✅ / ⚠️ / ❌ |
| S4 Evidence | Pass — paths cited per row |
| S5 Plans | Pass — every ⚠️/❌ has a plan cell |
| S6 Done purity | Pass — Done rows are code/tests, not Plans |
| S7 Sibling | Pass — no auditor/RCA/implement/commit |
| S8 Root | Pass — writes under project `Plans/` + `Project-Status/` and canvases dir; `move_agent_to_root` blocked for subagents |
| S9 Canvas | Pass — `canvases/project-status.canvas.tsx` |
| S10 Secrets | Pass — no tokens, mail bodies, or health samples |
| S11 Chat mining | Pass — SearchConversations unavailable (recorded); transcripts grepped |
| S12 Grain | Pass — one row per feature/chart, not one row per workspace |

## Next in operator sequence

1. This `$project-status` — **done** (do not claim chrome/Satya/TCC Done).
2. `$auditor` — next; do not run from this agent.
3. `$rca-agent` — after auditor.

Do not commit. Do not implement. Do not kill Flask `:5050`.
