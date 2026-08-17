# STRATJI — "Portfolio Intelligence" · Master System Prompt & Handoff Specification

> **Living bible (execute this instead):** [STRATJI-Publish-Ready-Master-Plan.md](STRATJI-Publish-Ready-Master-Plan.md) and the agent-executable [STRATJI-Platform-Master-Prompt.md](STRATJI-Platform-Master-Prompt.md), plus `docs/stratji/`. This file is a **historical 4-workspace as-built inventory** traced from an earlier Visual-Overhaul snapshot. Do not treat its “four workspaces / fourteen sections” count as current law — the product now has **six workspaces** plus Integration Page chrome.

> **Purpose of this document.** This is a complete, as-built handoff/documentation prompt for the local
> **Investment Dashboard** repo that Aditya refers to as **"STRATJI"** and that self-brands in code as the
> **"Portfolio Intelligence"** Mac/iPhone app. It is written so that a capable AI coding agent (Claude Code,
> Cursor) or a new engineer can (a) understand the whole system, (b) maintain and extend it without breaking
> its invariants, and (c) reconstruct any surface faithfully. It documents **every** workspace, section,
> sub-section/page, chart, visualization, KPI, data-pipeline stage, data-validation rule, and layout/design
> token that exists **today** in the repo.
>
> **Fidelity.** Everything in the numbered/lettered catalogs below is *as-built* — traced from the source on
> branch `Visual-Overhaul`. Forward-looking or gap notes are quarantined in blocks explicitly labelled
> **`SUGGESTION`** so they can never be mistaken for current behaviour.
>
> **Provenance.** Traced from `README.md`, `AGENTS.md`, `design-qa.md`, `Plans/STRATJI-Dashboard-Analysis.html`,
> `package.json`, `app/page.tsx`, `app/dashboard/*`, `app/report/*`, `app/api/*`, the `app/*-data.ts` /
> `app/*-server.ts` / `app/*-types.ts` modules, `app/globals.css`, `app/visual-overhaul.css`, `flask_gateway.py`,
> and the `tests/*` suites.

---

## 0. How to use this prompt

You are working on **STRATJI / Portfolio Intelligence**, a **local-first, single-user** research and portfolio
cockpit for Indian equities plus private wellness tracking. Before you change anything:

1. Treat the **invariants** in §4 and the **data-integrity contract** in §6 as inviolable. They are enforced by
   `tests/rendered-html.test.mjs` and `tests/freshness-and-isolation.test.mjs`; a change that violates them is a
   regression even if it "looks fine".
2. Never present stale, cached, or fabricated values as live. Every surface must expose a real
   **status** (`live` / `partial` / `snapshot` / `verified` / `stale` / `cached` / `unavailable` /
   `public_delayed` / `auth_required`) and name the failed source.
3. Keep the **four workspaces** and their **fourteen sections** structurally exactly as specified. Do not add,
   merge, split, or rename them without an explicit instruction.
4. When you produce or modify a chart/KPI/layout, conform to the **design system** in §7 (brutalist zero-radius,
   2px borders, hard offset shadows, Georgia serif headings, Geist/mono body, blue `#2563eb` accent, semantic
   green/amber/red, three appearance themes).
5. Run the verification sequence in §14 after any change to Sectoral Analytics, Market Intelligence, Health, or
   the report.

---

## 1. System overview & product identity

| Attribute | Value |
|---|---|
| Working title | **STRATJI** (Aditya's name; the literal string does **not** appear anywhere in the repo) |
| In-code brand | **Portfolio Intelligence** (masthead eyebrow), page title **"Investment Brief"** |
| Nature | Local-first, single-user portfolio + research + wellness cockpit |
| Primary users/devices | One user (Aditya), Mac (primary app server) + iPhone (native SwiftUI wrapper + Safari PWA) |
| Repo path | `/Users/adityasharma/Documents/GitHub/Investment Dashboard` (active branch seen: `Visual-Overhaul`) |
| Serving URL | `http://localhost:5050/` (Flask/Waitress), private iPhone via Tailscale Serve `https://…ts.net/` |
| Adjacent dependency | Go **Kite MCP server** at `/Users/adityasharma/Documents/GitHub/kite-mcp-server` (auto-started, server-only) |
| Core promise | Fuse **live Zerodha Kite** broker state with Axis Research, newsletter/podcast digests, an earnings calendar, macro scenarios, sector analytics, and Apple Health — with a hard rule against ever presenting stale or fabricated data as live |
| Print artifact | The **Portfolio Investment Brief** PDF, produced by `app/report` and exported via `app/api/report-pdf` |

The dashboard fuses five families of input: **broker** (Kite), **research mail** (Axis Research + Newsletters),
**audio** (Apple Podcasts), **calendar/tasks** (Apple Calendar + Reminders), and **health** (Apple Health /
HealthKit), plus supplemental **sector market data** (yfinance), **benchmarks** (NSE EOD), **sector news**, and a
**Firecrawl/web** layer.

---

## 2. Architecture & tech stack

| Layer | Technology / responsibility |
|---|---|
| **Front end** | **Next.js 16** on **vinext** (Cloudflare's Vite/RSC runtime) · **React 19** · **Recharts** (donuts, radars, bars, scatter, lines) · **lucide-react** icons · **Tailwind 4** + very large hand-written CSS (`globals.css`, `visual-overhaul.css`) · TypeScript. Single-page client component (`app/page.tsx`, `"use client"`). |
| **Serving shell** | **Flask + Waitress** gateway (`flask_gateway.py`) bound to `localhost:5050`, run as a macOS background job (`scripts/run-dashboard-service.sh`, launchd plist). Isolated `.venv-flask`. **Tailscale Serve** for private mobile access. Optional Cloudflare **D1/R2** bindings via `.openai/hosting.json`; **Drizzle** ORM present but `db/schema.ts` intentionally empty. |
| **Data spine** | Server-only **Kite MCP session** (adjacent Go server, auto-started). Reads holdings, positions, orders, GTTs, margins, quotes. `/api/kite/snapshot` refreshes on load + every 5 min. Holdings are the critical read; secondary reads are failure-tolerant. |
| **Research feeds** | Apple ecosystem via Computer-Use / `osascript` / local DBs: **Mail** (iCloud → Newsletters + Axis Research only), **Podcasts**, **Calendar**, **Reminders** (`Job 🔍` / `Earnings`), **Notes** (deprecated Health Daily), **Apple Health** (HealthKit export ZIP + "Health" Shortcut → Health Stats). Plus sector snapshots/benchmarks, **yfinance** quote fallback, **Firecrawl** web layer. Served through `scripts/content-digest-server.mjs`. |
| **Native apps** | SwiftUI **iOS/macOS wrapper** (`apple-app/`) around one persistent `WKWebView`: onboarding, source/connection freshness, operational-day HealthKit upload (single-use pairing token), offline recovery, PDF sharing. Safari PWA is the fallback install path (`public/manifest.webmanifest`, `sw.js`). |
| **Integrity** | Mandatory **startup refresh audit** (`scripts/refresh-dashboard-data.sh`) validates payload *semantics* (not just HTTP 200). Failures surface as Stale/Cached/Unavailable in a compact freshness strip — never as fake live values. Log at `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`. |

**Key npm scripts** (`package.json`): `dev`, `build`, `test` (build + rendered-html verification),
`flask:setup`, `flask`, `flask:stop`, `iphone`, `iphone:pair`, `desktop`, `remote`, `db:generate`,
`node --test tests/rendered-html.test.mjs`.

---

## 3. Repository map (the parts that matter)

```
app/
  page.tsx                     # SPA shell: workspace routing, global state, refresh orchestration, masthead, live banner, freshness strip
  layout.tsx, globals.css, visual-overhaul.css, pwa-runtime.tsx
  report/page.tsx              # Investment Brief PDF surface (cover + 8 sections)
  report/report.module.css     # A4 print styling
  dashboard/
    InvestmentWorkspace.tsx    # I-1..I-4
    SectorsWorkspace.tsx       # S shell (S-1..S-3 tabs, URL routing, status pills)
    SectoralAnalytics.tsx      # S-2 pages (pulse/companies/rankings/lifecycle/structure/mece)
    SectorDecisionLab.tsx      # S-3 pages (benchmarks/investability/pestel/porter/macro)
    IntelligenceWorkspace.tsx  # M-1..M-4 + SectorIntelligenceDigest
    HealthWorkspace.tsx        # H-1..H-3 + guidance/metrics workbenches
    AppleMonthlyCalendar.tsx   # M-4 month grid
    EarningsMonthCalendar.tsx  # M-3 month grid
    KiteOrderTicket.tsx / KiteGttTicket.tsx / KiteAlertTicket.tsx   # write tickets
    shared-ui.tsx              # WorkspaceSectionNav, DashboardTabs, CollapsibleSection, DailyKanbanBoard, AllocationLabel, HoldingLabel, HealthMasonryGrid, AppearanceToggle, HealthIncognitoToggle, RiskPill, HealthCategoryIcon
    visual-components.tsx      # PulseConstellation, InstrumentGauge, TriggerDial, SparkFilament, WaveformStrip, ExplainDwell
    utils.ts                   # macroEvents, exposureFactors, kanbanItems, workspaces, health direction columns, earnings merge/reconcile, inr formatter
    types.ts / useKiteInstrumentLookup.ts
  # DATA + SERVERS
  portfolio-data.ts            # baked research snapshot: holdings, analystCalls, axisRecommendations, scenarios, riskAxes, earningsCalendar, sources, axisArchiveAudit
  live-types.ts / content-types.ts / earnings-live-types.ts / health-live-types.ts / sector-live-types.ts / sector-news-types.ts / dashboard-types.ts
  kite-live-server.ts / kite-session-store.ts / kite-positions.ts / kite-auth-presentation.ts
  sector-data.ts / sector-company-data.ts / sector-analytics-data.ts / sector-investability.ts / sector-benchmark-server.ts / sector-benchmark-registry.ts / sector-live-server.ts / sector-news-server.ts
  fii-dii-flows.ts / macro-scenario-evidence.ts / analyst-matrix-groups.ts / axis-pick-metrics.ts / axis-holding-trading-calls.ts / thesis-bullets.ts / digest-bullets.ts / risk-explanations.ts
  health-data.ts / health-insights.ts / health-date-policy.ts / health-import-server.ts
  nse-trading-day.ts / earnings-verify.ts / calendar-earnings.ts / calendar-action-feeds.ts / calendar-holiday-feeds.ts / market-calendar.ts / portfolio-donut.ts / portfolio-concentration.mjs
  api/ …                       # 17 route handlers (see §5)
scripts/                       # macOS launchers, Kite/Mail/podcast/PDF/Tailscale helpers, health import, content automation
apple-app/                     # SwiftUI wrapper + HealthKit sync
tests/                         # node --test suites (see §14)
flask_gateway.py               # Flask/Waitress serving shell
config/ , drizzle/ , db/ , worker/ , public/
```

---

## 4. Global conventions & invariants

### 4.1 Workspace + section model

- Four persistent **workspaces**, selected by `?view=`:
  `investment` · `sectors` · `intelligence` (alias `market-intelligence`) · `health`.
  Defined in `utils.ts › workspaces` with label/note/icon:
  Investment (`CircleDollarSign`, "Portfolio, macro and research"),
  Sectoral Analytics (`Layers3`, "Sectors, frameworks and earnings"),
  Market Intelligence (`Newspaper`, "Mail, calendar and podcasts"),
  Health & Wellness (`HeartPulse`, "Private local wellness").
- **14 sections** total (4 · 3 · 4 · 3). Section is URL-addressable via `?view=…&section=…` and, for deep pages,
  `&page=…`. Back/Forward, reload, keyboard nav, and deep links all work (each workspace syncs on `popstate`).
- `DashboardTabs` (top nav, `.workspace-navigation.mode-dial`) renders the four workspaces with a live status
  **badge**: Investment → `LIVE`/`KITE`; Sectors → `S-2`; Intelligence → `FRESH`/`SYNC`; Health →
  `INCOGNITO`/`SYNCED`/`CACHED`/`PARTIAL`/`STALE`/`UNAVAILABLE`.
- `WorkspaceSectionNav` renders the per-workspace section tabs (roving-tabindex, arrow/Home/End keyboard support).
- Sections are rendered inside `CollapsibleSection` (number badge like `I-2`, title, note, optional header action
  pill, chevron collapse). Open state persists per section in `localStorage` (`portfolio-section-v2-<num>-open`),
  **default collapsed**; an explicit nav/tab selection dispatches `dashboard-expand-section` to open + scroll.

### 4.2 Canonical Daily Action Board (the first section of every workspace)

- Single implementation: `DailyKanbanBoard` (`shared-ui.tsx`). **Do not** create compact, single-lane, or
  workspace-specific variants — the Investment I-1 three-lane layout is the canonical visual contract that all
  four workspaces must match exactly.
- Three lanes: **To do today** · **Monitor** · **Completed today**. Clicking a card moves it to Completed with
  strike-through; state persists for the local day (`dashboard-kanban-<workspace>-v2`) and **resets at local
  midnight**.
- Content is static per workspace (`utils.ts › kanbanItems`), 4 cards each, each card = `{title, detail,
  numericAdvantage, strategicAdvantage, lane, tone}` where tone ∈ blue/amber/red/green. Summary header shows
  active/completed counts + today's date.

### 4.3 Isolation contract (test-enforced — do not break)

- The Sectoral **industry filter** (`selectedSectorId(s)`) is an **S-2-only** control. It may drive S-2 matrices,
  charts, rankings, company composition; it must **not** be passed into Market Intelligence or S-3.
- **Market Intelligence is always complete and unfiltered.** Exactly four sections M-1…M-4. No industry-filter
  banner, no sector-match count, no excluded-industry message, no dimming, no hidden records. Sectoral must not
  host a digest or a Market-Intelligence cross-link.
- **M-3 is the sole rendered complete earnings calendar.** Every tracked event stays visible/enabled/selectable
  regardless of S-2 selection. Apple Calendar earnings rows are scheduling evidence only; KPI values require
  independently verified IR/NSE results. Do not duplicate earnings in Sectoral or M-4; M-4 **excludes** the
  Earnings source calendar. No `sector-dimmed`/`sector-match`/`aria-disabled` on earnings.
- **M-4** contains exactly one inner Calendar collapsible (non-earnings) and one inner Reminders collapsible
  (Completed · Scheduled Important · Work / Job 🔍).
- **S-3 Decision Lab** uses its own local sector selector; it must not read or mutate the S-2 selection.
- Dimming classes and filter-status UI are valid **only** inside S-2. `tests/rendered-html.test.mjs` asserts zero
  stray dimmed/disabled descendants outside S-2 and complete M-3 earnings ownership.

### 4.4 Refresh cadence & orchestration (`app/page.tsx`)

- On mount, on `visibilitychange→visible`, on window `focus`, on `online`, on the custom
  `portfolio-native-refresh` event (fired by the SwiftUI wrapper), and on a **5-minute interval** → `refreshAll()`.
- `refreshAll()` fires fast early loaders in parallel (Kite, health, benchmarks, sector news, primary + all sector
  markets), then awaits the bundled `/api/dashboard/refresh` (90 s timeout) which returns `{sources, kite,
  content, earnings, health, benchmarks}`. On bundle failure it falls back to individual loaders. A single
  in-flight guard (`refreshInFlightRef`) dedupes concurrent refreshes.
- Per-symbol CMP for the analyst matrix: **Kite when held, else yfinance** (chunked 12/req via
  `/api/quotes/yfinance`), never invented.
- A 1-minute clock tick drives Kite token-expiry proximity ("Re-auth after ~<time>").

### 4.5 Appearance & privacy

- **Appearance** (`AppearanceToggle`): `black` (default) · `dark` · `sepia`, persisted in
  `localStorage['dashboard-appearance']` and applied via `document.documentElement.dataset.appearance`.
- **Health Incognito** (`HealthIncognitoToggle`): global toggle that gates *every* health value, drill-down,
  source/archive metadata, action, recommendation, and accessibility text behind a placeholder.

---

## 5. Data pipeline

### 5.1 API routes (`app/api/*`, 17 handlers)

| Route | Purpose |
|---|---|
| `GET /api/kite/snapshot` | Live portfolio snapshot (holdings/positions/orders/GTTs/margins/allocations/classification). Critical read. |
| `GET /api/kite/login` | Kite OAuth login (`?force=1&redirect=1`). |
| `POST /api/kite/order` | Place NSE cash order (reviewed ticket). |
| `POST /api/kite/gtt` | Create GTT / TSL. |
| `POST /api/kite/alert` | Create price alert. |
| `GET /api/kite/instruments` | Instrument lookup (symbol search, tick/lot size, price probe) for tickets. |
| `GET /api/quotes/yfinance?symbols=` | Delayed NSE quote fallback (CMP for non-held analyst symbols, sector prices). |
| `GET /api/content/refresh?force=1` | Mail (Newsletters + Axis Research), Podcasts, Calendar, Reminders, Health note digest. |
| `POST /api/content/reminders/complete` | Write-back: mark an Apple Reminder complete. |
| `GET /api/dashboard/refresh` | **Bundled** complete refresh → `{sources, kite, content, earnings, health, benchmarks}`. |
| `GET /api/dashboard/freshness` | Per-source freshness strip data. |
| `GET /api/earnings/snapshot` | Verified earnings snapshot (`status=verified` contract). |
| `GET /api/sectors/snapshot?sector=` | Per-sector market data (yfinance) + returns/rankings. |
| `GET /api/sectors/news` | Aggregated sector news + sentiment. |
| `GET /api/sectors/benchmarks` | NSE EOD benchmark indices + indexed history + squeeze width. |
| `GET /api/axis-research/pdf` | Serves matched local Axis Research PDFs inline. |
| `POST /api/report-pdf` | Accepts serialized report pages → returns a prepared PDF download URL. |

Health uses a separate gateway path `GET /_health/snapshot` (served by the health import server, not `/api`).

### 5.2 Source-of-truth & fallback rules

- **Kite** (`kite-live-server.ts`): holdings are the critical read; positions/margins/orders/GTTs are
  failure-tolerant so one blank secondary feed can't wipe the portfolio. On refresh failure the UI downgrades
  `live/partial → snapshot` + `authStatus: unknown` and appends "retaining the last validated values" — it never
  keeps a stale "authenticated" badge. Token boundary is Zerodha's daily ~06:00 IST rule (not a 12-h TTL);
  `tokenExpiresAt` drives the re-auth hint.
- **Sector market** (`sector-live-server.ts`): statuses `live` / `public_delayed` / `cached` / `auth_required` /
  `unavailable`; a late failure never overwrites a live snapshot for the header.
- **Benchmarks** (`sector-benchmark-server.ts` + registry): `live` = EOD; needs ≥2 verified closes to render a
  time series (a single latest print is never drawn as a line).
- **Content/Mail** (`content-digest-server.mjs`): exactly the iCloud `Newsletters` and `Axis Research` mailboxes.
  Displayed digests strip promotions, ads, registration/purchase CTAs, follow/subscribe requests, contact
  details, phone numbers, emails, and website links (`digest-bullets.ts › isDigestContentWorthy`, re-applied
  client-side as defense-in-depth). Podcasts deduped by normalized episode title; evidence labelled "transcript"
  only when a local transcript actually exists, else "description".
- **Health**: validates the newest iCloud Apple Health ZIP contains `apple_health_export/export.xml` before an
  atomic extract; a corrupt/incomplete newest archive is reported as a fallback source and the last validated
  export is retained. Daily reconciliation numbers (steps, walking speed, workout minutes, active/resting
  calories, nutrition) come from the **"Health" Apple Shortcut → Health Stats** export
  (`scripts/import_health_shortcut.py` → `artifacts/private/health-overrides.json`). Apple Notes "Health Daily /
  v2" are **deprecated** and must not be read/shown. HealthKit `export.xml` stays primary for Sleep/Heart/Respiratory.
- **No fabrication, ever.** Failed live values are never silently replaced with static ones; they render
  Stale/Cached/Unavailable with the failing source named.

### 5.3 Freshness model & strip

- `SourceFreshness[]` powers the `PulseConstellation` strip below the live banner: one clickable node per source
  with a `pulse-core` state class and a period label; clicking navigates to the owning workspace
  (`SOURCE_WORKSPACE` map in `visual-components.tsx`). Failed = `unavailable` / `stale` / `permission_required`.
- The startup audit intentionally shows **no** persistent "audit failed" banner; failures surface only through
  the strip, per-section states, and the log file.

---

## 6. Data validation & integrity rules

| Domain | Rule / module |
|---|---|
| **Startup audit** | `scripts/refresh-dashboard-data.sh` must validate payload *semantics*: Kite & sectors `status=live`, Mail & Podcasts `status=live`, Earnings `status=verified`, Health `status=live` to the shared Asia/Kolkata operational target. HTTP 200 alone is insufficient. |
| **Earnings** (`earnings-verify.ts`) | `buildEarningsSnapshot`: reported rows need an `http(s)` source URL **and** all KPI values filled → else **hard fail → `stale`**. Overdue pending rows are flagged as watch items but don't demote `verified` (calendar dates are scheduling evidence; KPIs stay blank until publication). `latestCompletedIstDateKey` = yesterday in IST. |
| **NSE trading day** (`nse-trading-day.ts`) | `NSE_EQUITY_HOLIDAYS_2026` set + weekend check → `isNseTradingDay`, `lastNseTradingDay` (looks back ≤21 days), `resolveAxisTradingAsOf` (labels "(last NSE trading day)" on weekend/holiday fallback). Keep in sync with `scripts/nse-trading-day.mjs`. |
| **Health operational date** (`health-date-policy.ts`) | `healthTargetContext`: **≥20:00 IST → D (evening cutoff)**; **00:00–01:59 → D-1 (overnight window)**; **02:00–19:59 → D-1**. All 7-/30-day comparisons anchor to that target; missing dates are shown exactly, never inferred. |
| **Health import** | Validate newest ZIP → confirm `export.xml` → atomic extract only when valid; records after the archive's eligible-through date are excluded from KPI cards/comparisons. |
| **Axis picks** (`axis-pick-metrics.ts`) | `axisImpliedUpsidePct = (target/CMP − 1)×100`; `resolveAxisCmp` order = **kite → yfinance → axis (PDF/mail)**; never fabricated. Progress-to-target = CMP ÷ target capped at 100% (or `(live−entry)/(target−entry)` when both entry+live exist). |
| **Analyst matrix** (`analyst-matrix-groups.ts`) | Dedupe by symbol (trading > technical > fundamental); plain BUY variants normalize to one BUY; Trading & Technical BUY stay distinct; "Target achieved" is a separate closed-call view from explicit Mail/PDF closure evidence, never an active recommendation. |
| **Investability** (`sector-investability.ts`) | 6 factors, each `null` when unsupported; composite = mean of *available* factors only; `factorMedian` across sectors. |
| **Freshness/isolation** | `tests/freshness-and-isolation.test.mjs` + `tests/rendered-html.test.mjs` assert the §4.3 isolation contract and status labelling. |
| **General** | Prefer primary sources with URLs + as-of dates; do not fabricate live/Mail/Podcast/financial/Health data; do not silently swap failed live values for static ones; current date-sensitive claims require source verification. |

---

## 7. Design system (layout / alignment / fonts / color-coding)

### 7.1 Aesthetic identity — "brutalist editorial dark"

- **Zero border-radius everywhere** (`* { border-radius:0 !important }`), **2px solid borders**
  (`--brutalist-border`), and **hard offset drop shadows** (`--brutalist-shadow: 4px 4px 0`, plus `-sm 2px 2px`,
  `-lg 6px 6px`, `-blue 3px 3px var(--blue)`). Buttons/links nudge `translate(1px,1px)` on `:active`.
- App is centered, `width:min(1480px,100%)`, with 2px left/right rules and safe-area padding.
- Panels (`.panel`, `.masthead`) use `--bg-panel`, 2px `--line` border, often a **4px blue top border** and a
  hard shadow.

### 7.2 Typography

| Role | Font / size |
|---|---|
| Headings (`h1/h2/h3`, masthead) | **Georgia serif**, heavy weight. Masthead `h1`: `800 42px/1.02 Georgia`, `-0.02em`. |
| Body | `--font-geist-sans` → `--font-mono` → system-ui (`.vinext/fonts/geist*`). |
| Mono (eyebrows, labels, status, KPIs, table headers) | `--font-mono` (ui-monospace / SF Mono / Menlo). Eyebrow `11px/900/uppercase/0.1em`, blue `#3b82f6`. |
| Chart ticks / labels | `--chart-tick` (~10px) and `--chart-label` (bold ~10–12px, weight 800 on axis labels). |
| Report (print) | Titles Georgia serif; body **Arial**; sizes in `pt`/`mm` (A4). |

### 7.3 Color tokens (three appearance themes)

Defined in `:root` and overridden by `html[data-appearance="dark"|"sepia"]` (`globals.css`).

| Token | **Black** (default) | **Dark** (GitHub blue) | **Sepia** (paper) |
|---|---|---|---|
| `--bg-page` | `#000000` | `#0d1117` | `#faf7f2` |
| `--bg-panel` | `#0a0a0a` | `#161b22` | `#fffdf9` |
| `--bg-control` | `#0a0a0a` | `#000000` | `#1a140f` |
| `--ink` (text) | `#ffffff` | `#e6edf3` | `#000000` |
| `--muted` | `#a1a1aa` | `#8b949e` | `#000000` |
| `--line` | `#27272a` | `#30363d` | `#d4c4a8` |
| `--chart-label` | `#ffffff` | `#e6edf3` | `#000000` |
| `--chart-tick` | `#9ba6b2` | `#8b949e` | `#000000` |

**Semantic accents (theme-independent):** blue `--blue #2563eb` (primary/accent, brand top-borders, links,
"Current" bars); green `--green #22c55e` (gain/positive/favourable); amber `--amber #eab308` (warning/context/
neutral-monitor); red `--red #ef4444` (loss/negative/unfavourable). Sepia rule: **all text on paper surfaces is
pure black**; non-black text only on dark chrome, colored data tiles, and semantic P&L.

### 7.4 Color-coding conventions (must stay consistent)

- **P&L / returns:** green = gain/positive, red = loss/negative; day-negative donut segments are shaded (lower
  opacity + red stroke). Portfolio-map tile color = unrealised return tone (`#137a43` gain / `#9a6b12` flat /
  `#a92f39` loss); tile size = weight.
- **Risk scores (1–5):** ≤2 green (`#42c878`), 3 amber (`#e6a11a`), 4–5 red (`#ff6b72`).
- **Macro/scenario bands:** supportive = green, base = amber, stress = red (`tone` on each band).
- **Sector identity:** each sector carries a fixed `color` (e.g. Pharma `#52d6a3`, Power `#ffd166`,
  Infrastructure `#ff9f6e`, Auto `#64b5ff`, Telecom `#b794f6`); surfaced via the `--sector` CSS var on tiles,
  chips, bubbles, and rankings.
- **Health categories:** category accent classes (`health-cat-heart/activity/nutrition/respiratory/sleep/
  mobility/other`); H-3 columns are green/amber/red by *comparison direction* while each tile keeps its category
  accent.
- **Status pills** (`.pill`): green (live/verified/active-done), amber (partial/cached/public_delayed/loading),
  red (unavailable/stale). Semantic classes `.positive`/`.negative`/`.warn`/`.amber-text`.

### 7.5 Layout / alignment patterns

- **Grids:** top nav 4-equal-column grid; I-2 portfolio uses a 70/30 analysis grid (`.portfolio-analysis-grid`);
  I-2 instrument cluster = 4 gauges; portfolio-management = 2×2 card grid; I-3 risk = two-column
  (`.investment-risk-grid`); exposure factor key + composition bar stacked; sector rankings = leaders/laggards
  duel; health H-3 = 3 direction columns of KPI tiles; decision-lab = chart + gate split.
- **Health console** is deliberately **non-scrolling** (`viewport-console-active`): dense content lives on
  URL-backed sub-pages sized to the viewport (`useLayoutEffect` height fitter), never a vertically scrolling
  workspace. Nutrition is split across two metric pages to stay scroll-free.
- Every chart uses `ResponsiveContainer`; tables use sticky/first-column metric layouts; mobile fallbacks exist
  for holdings (card list) and calendars.

---

## 8. Shared UI primitives (catalog)

| Component | File | What it renders |
|---|---|---|
| `DashboardTabs` | shared-ui | Top workspace nav (mode-dial), status badges, roving tabindex. |
| `WorkspaceSectionNav` | shared-ui | Per-workspace section tab row (prefix chip + label), keyboard nav. |
| `CollapsibleSection` | shared-ui | Numbered collapsible panel (persisted open state, header action slot). |
| `DailyKanbanBoard` | shared-ui | Canonical 3-lane action board (§4.2). |
| `AllocationLabel` / `HoldingLabel` | shared-ui | Donut ring labels (compacted names, %, U/Day P&L). |
| `HealthMasonryGrid` | shared-ui | H-3 vital metrics: weekly/MTD toggle → 3 direction columns of `biometric-capsule` tiles with `SparkFilament`. |
| `HealthMetricComparison` / `HealthCategoryIcon` / `RiskPill` | shared-ui | Trend arrow vs avg; per-category icons; risk pill (green/amber/red). |
| `AppearanceToggle` / `HealthIncognitoToggle` | shared-ui | Theme switch; privacy gate. |
| `PulseConstellation` | visual-components | Source-freshness strip (clickable nodes → workspace). |
| `InstrumentGauge` | visual-components | SVG ring gauge (value + ratio fill + tone + optional redline). Used for I-2 KPI cluster. |
| `TriggerDial` | visual-components | SVG dial with distance-to-trigger + tick. Used for S-3 macro triggers. |
| `SparkFilament` | visual-components | Interactive mini sparkline for a metric's measured daily series (never invents days). |
| `WaveformStrip` | visual-components | Decorative seeded waveform on podcast cards. |
| `ExplainDwell` | visual-components | Dwell-to-reveal explanation popover. |
| `KiteOrderTicket` / `KiteGttTicket` / `KiteAlertTicket` | dashboard | Reviewed write tickets with typed confirmation. |

---

## 9. Workspace-by-workspace deep dive

> Section numbering uses the in-app badges (I-1 … H-3). "Charts/KPIs" list *every* plotted or numeric element.

### 9.1 Investment workspace (`?view=investment`) — `InvestmentWorkspace.tsx`

Sections: `[{i1 Action Board},{i2 Portfolio},{i3 Risk},{i4 Axis picks}]`. Masthead above all workspaces:
eyebrow "PORTFOLIO INTELLIGENCE", `h1` "Investment Brief", sub "Quarter outlook, oil/geopolitical exposure,
flows and analyst positioning"; status panel (Kite Live/Partial/Snapshot/Authenticate/Unavailable, as-of,
AppearanceToggle, HealthIncognitoToggle, Export Report). Live-feed banner + Kite auth control + Refresh all.

#### I-1 · Investment action board
- Canonical `DailyKanbanBoard workspace="investment"` (§4.2). Cards: refresh Kite & validate holdings; review
  top-two concentration (<65%); monitor oil/INR/flows; update post-result theses.

#### I-2 · Portfolio (70/30 layout)
- **Instrument cluster** (4 `InstrumentGauge` cards): **Portfolio value** (neutral); **Unrealised P&L** (₹ + %,
  tone by sign); **Top-two concentration** (% + names, danger ≥65% with redline, warning ≥50%); **Available
  equity margin** (thin redline if < 5% of value).
- **Nested portfolio allocation** — 4-ring Recharts donut (`PieChart`, 4 concentric `Pie`s, 90°→−270°):
  inner = AMFI market-cap tier, lower-middle = industry, upper-middle = sub-sector, outer = holdings (fill =
  gain shade / red loss via `holdingOuterFill`, day-negative shaded, white/red stroke). Center overlay =
  unrealised ₹ + % and day ₹ + %. Ring key + classification-audit line (NSE + AMFI sources, pending symbols).
- **Portfolio management** — 2×2 cards: **Portfolio overview** (tone by P&L/day headline); **Risk mitigation**
  (max of high-risk / negative weight %); **Axis-linked upside** (weighted matched-target upside, coverage %);
  **Actions to maximise α**. Sources footline (Axis calls count, Newsletters count).
- **Portfolio activity** — segmented tabs `Holdings · Orders · Positions · GTTs · TSLs · Alerts`.
  - Holdings: transposed matrix (metric rows × holding columns) with per-column BUY/SELL buttons (open
    `KiteOrderTicket`), rows Qty/Avg/Last/Value/Unrealised/Day P&L/Weight; heat classes; mobile card fallback.
  - Orders/Positions/GTTs/TSLs/Alerts: activity rows + a "Create" bar opening the relevant ticket. GTTs split
    entry (`kind≠tsl`) vs TSLs (`kind==tsl`).
- **Portfolio concentration map** — squarified **treemap** (custom `layoutPortfolioMap`, aspect 1.46:1); tile
  size = weight, color = return tone; density tiers (micro/compact/roomy); hover/selected tooltip aside with full
  holding detail.

#### I-3 · Risk
- **Macro scenario lab** (`MacroScenarioBoard`): a Mail-source strip; a "weather altitude" indicator; **event
  tabs** (5 events, `utils.ts › macroEvents`): `oilWar` (Crude+geopolitics), `flows` (FII/DII), `rates`
  (INR+rates), `breadth` (Breadth+volatility), `earnings` (Earnings+rotation). For the selected event, **band
  tabs** supportive/base/stress (each with label/range/tone/summary/leaders/laggards/action). Detail panel:
  - For `flows`: **FlowsRegimePanel** with a FII-vs-DII **composition donut** (`PieChart`, center = Δ5D FII cash)
    + legend + `FlowsEvidencePanel` (primary web + Mail evidence).
  - Other events: regime card + selected-evidence list. Both show **AI-generated evidence summaries** classified
    positive/neutral/negative (`macro-scenario-evidence.ts` regex rule-base → scenario band). Decision-sequence
    method footline.
- **Risk composition** — stacked horizontal **BarChart** (`layout="vertical"`, domain 0–5) of 6 equal-weighted
  drivers (`exposureFactors`): **Oil/war**, **FII/flow** (EVENT group) + **Valuation**, **Liquidity**,
  **Volatility**, **Leverage/execution** (KPI group). Segment width = raw ÷ 6; total label = average `/5`.
  Group key + factor key + per-holding event/KPI driver map + method note.
- **Portfolio / holdings risk** — 6-axis **RadarChart** (`RiskRadar`, `explainSelected`): axes =
  `riskAxes` = **Valuation, Sector, Liquidity, Volatility, Event, Leverage**; selected holding vs current
  portfolio average; dot color by score band (green/amber/red); selector tabs; right-hand explanation aside
  (overview, per-axis text, live evidence: exposure/position/U&Day P&L/classification/sources).

#### I-4 · Axis picks (`as-of` label reflects NSE trading-day fallback)
- **Analyst call matrix** — grouped table (`analyst-matrix-groups.ts`), **Group by**: Analyst calls · Industries
  · Performance · Posted-in-month · Target achieved. Columns: Stock, Source/house, Call (pill), CMP, Target,
  Implied vs CMP, Published, What matters (thesis bullets). Collapsible group blocks with call-tone headers.
- **Axis recommendation workbench** (`AxisRecommendationWorkbench`): PDF-archive audit strip (files scanned,
  valid PDFs, mail-window calls, invalid payloads); **category tabs** Fundamental/Technical/Trading; pick list
  cards (CMP, target line with implied %, compact **progress-to-target meter**); click → modal detail
  (CMP+source, target, indicated upside, horizon, progress bar, thesis bullets, evidence). PDF-archive policy note.
- **Recommended risk radar** — same `RiskRadar` over deduplicated Axis calls vs "Axis list average".

### 9.2 Sectoral Analytics (`?view=sectors`) — `SectorsWorkspace.tsx` + `SectoralAnalytics.tsx` + `SectorDecisionLab.tsx`

Sections `[{s1 Action Board},{s2 Industry Analytics},{s3 Benchmarks & Decision Lab}]`. S-2 and S-3 have inner
page navs (`SectionPageNav`, arrow-key tablists) and header status pills (S-2 market status; S-3 EOD/benchmark
status). **11 tracked sectors** (`sector-data.ts`): **Pharma, Power, Infrastructure, Auto, Telecom, Banking,
NBFC, FMCG, Consumer, Energy, Defence** — each with color, pulse, stance, summary, KPIs, `mece[4]`, `pestel[6]`,
`porter[5]`, and 1–5 `scores`.

#### S-1 · Sectoral action board
- Canonical `DailyKanbanBoard workspace="sectors"` (refresh breadth/rankings; check KPI freshness; run selected
  sector through frameworks; fill pending earnings KPIs).

#### S-2 · Industry Analytics — pages `pulse · companies · rankings · lifecycle · structure · mece`
- **Industry filter toolbar** (`.sector-selector.sector-prism`): the *only* dimming/filter control; multi-select;
  dims non-selected. `data-sector-filter` reflects the active set. Deselect last → full view.
- **pulse:** sector lead card (stance/summary/composite), filter-status strip, **A · Sector map + impact matrix
  (MECE)** — the `SectorImpactMatrix` "shockwave board": one row/sector × 6 signal columns **Crude · USD/INR ·
  Rates · Monsoon · AI capex · Q1 earnings** with glyphs ▲ tailwind / ▼ headwind / ● two-way / — n/a, sub-sector
  chips, seismic stance bar, current read. Then **sector KPI grid** (`pulse-orb` cards from `sector.kpis` +
  MONITOR NEXT), or (unfiltered) a cross-industry KPI grid (Tracked companies, Advancers, Decliners, Industries
  advancing, Median 1M return, all-industry read). Then **News + sentiment** panel (source strip; 3 sentiment
  columns Positive/Neutral/Negative, ≤3 items each, ET/FT/Bloomberg/Zerodha/Moneycontrol/NDTV Profit).
- **companies:** company-composition workbench — breadth strip (Universe coverage, Advancers, Decliners, Median
  1M) + full company table (Company, Universe share, Live price, 1D/1W/1M/3M returns, Growth/Profitability/
  Margin/Quality 1–5 scores, Portfolio owned tag), paged 6/page. Unfiltered → cross-industry breadth table
  (Industry, Pulse, Composite, Tracked, Advancers, Decliners, Avg 1D, Market status).
- **rankings:** model toggle **Market performance / Fundamentals**; horizon select (1D/1W/1M/3M) or research
  metric select; leaders/laggards **ladder duel** (top-N each). Unfiltered = cross-industry leaders/laggards.
- **lifecycle:** **C · Company life-cycle map** — Recharts **ScatterChart** (bubble), X = life-cycle stage
  (Growth→Shakeout→Mature→Decline→Legacy), Y = expected revenue growth %, Z (bubble size) = universe weight;
  industry-colored bubbles + hollow industry anchors; white stroke = owned/focused; smart de-overlap labels;
  linked "company outliers vs industry stage" insight list.
- **structure:** **D · Company market-structure map** — ScatterChart, X = operating margin %, Y = profit-pool
  concentration /5, size = universe weight; reference lines at margin 20% / concentration 3.5; "value-chain sweet
  spot" insight list.
- **mece:** **MECE sector driver map** — per-sector decomposition into 4 non-overlapping lenses **Demand engines
  · Profit pool · Policy/structure · Valuation/risk** (loom for selected sector + full matrix with emoji bullets).

#### S-3 · Benchmarks & Decision Lab — pages `benchmarks · investability · pestel · porter · macro`
- **benchmarks:** select up to 3 indices; **LineChart** of indexed history (≥2 closes required, else "no
  chart-ready history"); per-index return grid (level + day/month/quarter/year, source, closes). `INDEX_COLORS`
  palette. Delayed/EOD never labelled live.
- **investability:** 6-axis **RadarChart** (`sector-investability.ts`): **Growth · Earnings delivery · Valuation
  support · Macro resilience · Breadth/momentum · Balance-sheet/execution** (each with transparent basis, `null`
  when unsupported) vs all-sector median; **Decision gate** panel → Allocate/Monitor/Reassess/Avoid
  (`decisionFromScore` thresholds 4 / 3.2 / 2.5) + factor grid + evidence band.
- **pestel:** 6-axis RadarChart (**Political, Economic, Social, Technology, Environmental, Legal**) vs median +
  decision gate.
- **porter:** 5-axis RadarChart (**Competitive intensity, Customer leverage, Supplier/input leverage,
  Substitution risk, New-entry risk**) vs median + gate.
- **macro:** **TriggerDial** row (distance-to-trigger dials, `macroDials`) + two **BarChart**s: "Distance to
  macro trigger" (Current vs Decision trigger, normalized to 100) and "Volatility squeeze width" (per-index band
  width %, live where available).

### 9.3 Market Intelligence (`?view=intelligence`) — `IntelligenceWorkspace.tsx`

Sections `[{m1 Action Board},{m2 Live Intelligence},{m3 Earnings Calendar},{m4 Calendar + Reminders}]`.
Always complete and unfiltered (§4.3).

#### M-1 · Action board
- Canonical `DailyKanbanBoard workspace="intelligence"` (refresh exact Mail sources; reconcile Calendar+Reminders;
  monitor reported earnings; review podcast freshness).

#### M-2 · Live Intelligence (`SectorIntelligenceDigest view="live"`) — 3 panels
- **Newsletter digest** (iCloud → Newsletters): sender-grouped collapsibles; per-item card (time, title,
  sentiment + tag badges, content bullets as evidence chips, source links); **Read Later** save toggle
  (localStorage `dashboard-saved-items-v1`) with All/Saved filter; "Show all/fewer" paging (40).
- **Axis Research** (iCloud → Axis Research): grouped by **topic** (Punch, Result Updates, Daily Technical
  Outlook, Morning Note, Axis Alpha, Event Updates, Monthly Quant, Pick of the Week, Company Update, …); **exactly
  one primary "Open PDF" action per card** (high-contrast), plus Open-in-Mail.
- **Podcast summaries**: sender-grouped; per-episode `WaveformStrip`, AI-summary bullets as **insight cards**
  (outcome + sentiment), evidence badge **transcript vs description** (never mislabeled), chapter markers +
  timestamp links when transcript-derived; explicit "summary not generated" reasons.

#### M-3 · Earnings Calendar (`MarketEarningsCalendar`) — the sole earnings location
- Header count (tracked events · independently verified reported · calendar-only pending). **Reconciliation
  strip:** discovered / new / updated / deduplicated / verified reported / pending-upcoming
  (`utils.ts › earningsReconciliationStats`). **EarningsMonthCalendar** month grid (stars matched dynamically to
  current Kite holdings; KPI slots per event; holiday-conflict flags via `market-calendar.ts`). Apple Calendar
  rows = scheduling evidence only; KPI values require IR/NSE verification (blank otherwise).

#### M-4 · Calendar + Reminders (`SectorIntelligenceDigest view="calendar-reminders"`)
- Exactly **one Calendar collapsible** (complete non-earnings events → `AppleMonthlyCalendar` month grid,
  source-coded chips) and **one Reminders collapsible** with three smart groups: **Completed** (evidence only,
  never restored) · **Scheduled Important** (due/flagged/urgent/priority/earnings; checkbox → write-back via
  `/api/content/reminders/complete`) · **Work / Job 🔍** (exact list; checkbox complete). Read-only except
  reminder checkboxes. **Excludes** the Earnings calendar.

### 9.4 Health & Wellness (`?view=health`) — `HealthWorkspace.tsx`

Sections `[{h1 Action Board},{h2 Daily Optimism},{h3 Vital Metrics}]`. Non-scrolling three-panel console;
`sub-pages` open a viewport-fitted paged view (`?view=health&section=h3&page=heart`). Incognito gates everything.

#### H-1 · Health action board
- Canonical `DailyKanbanBoard workspace="health"` inside an Incognito gate (verify operational target; reconcile
  weekly/monthly averages; resolve cross-app sleep variance; complete nutrition diary).

#### H-2 · Daily Optimism — pages `optimism · insights · guidance · guardrails`
- **optimism:** exact Health Daily optimism text (when present) + **Today's health brief** (prioritised
  `enrichHealthGuidanceActions`, critical first, tone dots) + provenance footnote.
- **insights:** Livity/iPhone-Mirroring-unavailable banner (no fabricated numbers), Health-Daily-shortcut stat
  snapshot (evidence only), metric-derived insight crystals.
- **guidance:** HealthKit daily coach lane (tone-coded actions).
- **guardrails:** interpretation caveats (`healthCaveats`) + medical-note ("wellness summary only, not medical
  advice").

#### H-3 · Vital Metrics (`HealthMasonryGrid`) — pages `metrics-overview · activity · sleep · heart · respiratory · mobility · nutrition-1 · nutrition-2`
- Weekly / Monthly(MTD) average toggle. KPIs grouped into **3 comparison-direction columns**: **Favourable ·
  Context dependent · Unfavourable** (`utils.ts › HEALTH_DIRECTION_COLUMNS`), each tile keeping its **Health
  category** accent. Metrics without a selected-period average render under Context dependent (no 4th column).
  Categories: **Activity, Sleep, Heart, Respiratory (+Mindfulness), Mobility, Nutrition** (from `health-data.ts`;
  **Body Measurements, Hearing, Medications excluded**). Each tile: label, value, `SparkFilament` history,
  comparison arrow vs avg, category + context. `metrics-overview` = per-category portal cards; category pages =
  compact masonry; nutrition split across two pages to stay scroll-free.

---

## 10. The Portfolio Investment Brief (PDF) — `app/report/page.tsx` + `report.module.css`

- **Purpose:** the print artifact of the whole platform (masthead "Export Report" → `/report?export=1`).
- **Gate:** the report is locked until **live Kite** (`status=live`), **Calendar=live**, **Earnings=verified**,
  and **Axis Research + Newsletters = live** all pass their freshness contracts. Otherwise a gate screen offers
  Authenticate / Retry with precise reasons (auth required, partial session, mail refresh needed).
- **Export pipeline:** refresh bundle + all sectors → validate freshness → auto-split overflowing pages →
  serialize page HTML → `POST /api/report-pdf` → prepared download (File System Access API save picker, with
  anchor/navigate fallbacks). Waits for `document.fonts.ready`.
- **Page format:** A4 `210mm × 297mm`, padding `16mm 15mm 13mm`; navy `#082a4a` page headers with a 2mm blue
  (`#2788c7`) top border; Georgia serif titles; Arial body; light `#dfe8f0` background; page numbers Georgia.
- **Structure — an unnumbered cover + 8 in-app-numbered sections (§1–§8):**
  - **Cover** — research date, mail-through date, INVESTMENT BRIEF title, portfolio value / unrealised P&L /
    top-two weight metrics, core-conclusion callout.
  - **§1 Portfolio at a glance** — metric row (Invested/Value/P&L/Margin); **PrintNestedDonut** (SVG 4-ring
    allocation, same rings as I-2); concentration diagnostic bars + risk flag; compact holdings table.
  - **§2 Position outlook for the quarter** — per-holding outlook table (view/support/break-risk/response from
    `outlookDetails`); most-insulated/flow-sensitive/oil-sensitive callouts; risk ladder (lower/medium/higher).
  - **§3 Macro shock map** — oil→INR→yields→multiples flow chain; per-holding US-Iran/Oil/FII/insulation table;
    scenario matrix; FII/DII context callout.
  - **§4 Analyst recommendations** — CMP-and-target calls table (paged 12/page, may span continuation pages);
    price-basis + weakest-signal + NSE source-role callouts.
  - **§5 Earnings, orders and GTTs** — latest verified portfolio result hero; latest orders + GTT register
    tables; liquidity-constraint callout.
  - **§6 Local research digest** — Axis + Newsletter highlights; podcast library (paged continuation pages);
    transcript limitation callout.
  - **§7 Sector impact and market dials** — cross-sector impact matrix (6 signal columns); macro dials + squeeze
    width bars.
  - **§8 Portfolio action framework** — 5 prioritised triggers (Concentration/Oil/Stress/Earnings/Flow) + source
    register + method-and-limitations.

---

## 11. Charts & visualizations — master catalog

| # | Chart / visual | Library / element | Where | Encodes |
|---|---|---|---|---|
| 1 | Nested allocation donut (4 rings) | Recharts `PieChart` ×4 `Pie` | I-2; report §2 (SVG) | market-cap→industry→sub-sector→holdings; color=gain/loss; shade=day loss |
| 2 | Portfolio concentration treemap | custom squarified layout | I-2 | size=weight, color=return tone |
| 3 | Instrument gauges ×4 | SVG ring (`InstrumentGauge`) | I-2 | value + ratio fill + tone + redline |
| 4 | FII/DII composition donut | Recharts `PieChart` | I-3 flows | net composition; center=Δ5D FII |
| 5 | Risk composition stacked bar | Recharts `BarChart` (vertical, stacked) | I-3 | 6 equal-weighted drivers, 0–5 |
| 6 | Holdings risk radar | Recharts `RadarChart` (`RiskRadar`) | I-3, I-4 | 6 risk axes vs average; dot color=band |
| 7 | Axis progress-to-target meter | ARIA meter bar | I-4 | CMP÷target capped 100% |
| 8 | Sector impact "shockwave" matrix | CSS grid glyphs | S-2 pulse; report §7 | ▲/▼/●/— per sector×6 signals |
| 9 | Pulse-orb KPI cards | CSS | S-2 pulse | per-sector KPIs + monitor |
| 10 | Company life-cycle bubble | Recharts `ScatterChart`+`ZAxis` | S-2 lifecycle | stage×growth×weight |
| 11 | Market-structure bubble | Recharts `ScatterChart`+`ZAxis` | S-2 structure | margin×concentration×weight |
| 12 | Leaders/laggards ladders | CSS ordered lists | S-2 rankings | ranked returns/scores |
| 13 | MECE loom + matrix | CSS | S-2 mece | 4 driver lenses/sector |
| 14 | Benchmark line chart | Recharts `LineChart` | S-3 benchmarks | indexed index history |
| 15 | Investability / PESTEL / Porter radars | Recharts `RadarChart` | S-3 | factor scores vs median |
| 16 | Macro trigger dials | SVG (`TriggerDial`) | S-3 macro | distance-to-trigger |
| 17 | Distance-to-trigger + squeeze bars | Recharts `BarChart` ×2 | S-3 macro | current vs trigger; band width |
| 18 | Earnings month calendar | custom grid | M-3 | events, stars=held, KPI slots |
| 19 | Apple month calendar | custom grid | M-4 | non-earnings events (source chips) |
| 20 | Waveform strip | CSS | M-2 podcasts | decorative |
| 21 | Health direction KPI tiles + SparkFilament | CSS + inline SVG | H-3 | value + trend + history |
| 22 | Health organ-portal preview cards | CSS | H-3 overview | per-category primary + supporting |
| 23 | Pulse constellation freshness strip | CSS | global | per-source state |
| 24 | Print nested donut / dials / bars | inline SVG + CSS | report | print-safe versions |

---

## 12. KPI master catalog

- **Portfolio (Kite):** invested, current value, unrealised P&L (₹, %), day P&L (₹, %), top-two concentration %,
  available equity margin, per-holding Qty/Avg/Last/Value/Unrealised/Day/Weight, high-risk weight %, negative
  weight %, Axis-covered value + coverage % + weighted Axis upside.
- **Risk drivers (0–5, equal-weighted):** Oil/war, FII/flow, Valuation, Liquidity, Volatility, Leverage/execution
  (composite index). **Risk radar axes (1–5):** Valuation, Sector, Liquidity, Volatility, Event, Leverage.
- **Axis picks:** CMP (kite→yfinance→axis), target, indicated upside %, progress-to-target %, horizon,
  archive audit (files scanned / valid PDFs / pages read / calls).
- **Sector (per company):** universe share %, live price, 1D/1W/1M/3M returns, Growth/Profitability/Margin/Quality
  (1–5). **Sector (aggregate):** composite /5, pulse, advancers/decliners, industries advancing, median 1M.
- **Investability factors (1–5, null-safe):** Growth, Earnings delivery, Valuation support, Macro resilience,
  Breadth/momentum, Balance-sheet/execution → composite + Allocate/Monitor/Reassess/Avoid gate.
- **Framework radars:** PESTEL (6), Porter (5); macro dials + squeeze width %.
- **Earnings:** discovered/new/updated/deduplicated/verified-reported/pending; per-event KPI slots (banking:
  PAT/NII/Asset quality/Margin; tech: Revenue-CC/Op margin/Deal wins/Guidance; else Revenue/Profit/Op margin/
  Guidance).
- **Health:** per-metric value + weekly & MTD average + delta + direction, grouped favourable/context/unfavourable
  across Activity/Sleep/Heart/Respiratory/Mobility/Nutrition; operational target date + policy.
- **Flows:** 5D FII net, 5D DII net, latest-session composition.

---

## 13. Native apps, serving & operations

- **Flask/Waitress** (`flask_gateway.py`) binds `localhost:5050`, launched as a macOS login-session background
  job (`scripts/run-dashboard-service.sh`, `scripts/com.adityasharma.portfolio-intelligence.plist`). Startup runs
  the refresh audit and writes `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`.
- **Tailscale Serve** exposes the dashboard privately to the tailnet (`https://…ts.net/`) — never the public LAN
  or internet. `npm run remote` prints the stable `100.x.y.z`.
- **SwiftUI wrapper** (`apple-app/`): one persistent `WKWebView`; native onboarding, source/connection freshness,
  operational-day HealthKit upload with a single-use pairing token (`npm run iphone:pair`; iPhone Keychain stores
  the token, Mac stores only its hash), offline recovery, PDF sharing. Refreshes on open/foreground/connectivity/
  Refresh-now/every-5-min; dispatches `portfolio-native-refresh`.
- **Kite auth:** one Zerodha login per trading day (~06:00 IST expiry); token reused across restarts and MCP
  session rotations; avoid extra same-day logins.
- **Install paths:** `npm run desktop` (Mac Dock app), Safari PWA (`/install`), TestFlight/device build
  (`apple-app/README.md`).

---

## 14. Testing & required verification

- **Suites** (`tests/*.mjs`, `node --test`): `rendered-html.test.mjs` (workspace structure, S-2 filter isolation,
  exclusive M-3 earnings ownership) · `freshness-and-isolation.test.mjs` · `axis-recommendations` ·
  `axis-pick-metrics` · `analyst-matrix-groups` · `digest-bullets` · `thesis-bullets` · `earnings-day-kpi-slots`
  · `calendar-earnings-reconciliation` · `calendar-action-feeds` · `calendar-holiday-feeds` · `fii-dii-flows` ·
  `macro-scenario-evidence` / `macro-evidence-summaries` · `risk-explanations` · `sector-investability` ·
  `nse-trading-day` · `portfolio-donut` · `holding-outer-fill` · `kite-positions` · `vital-metrics-direction` ·
  `health-date-policy` · `health-insights` · `podcast-masonry.playwright` · Python: `test_flask_gateway`,
  `test_health_import`, `test_sector_benchmark_fetcher`.
- **Required UI verification after Sectoral/Market-Intelligence changes** (`AGENTS.md`):
  1. `npm run lint`, `npm run build`, `node --test tests/rendered-html.test.mjs`.
  2. `?view=sectors` → change S-2 industry → confirm only S-2 updates.
  3. `?view=intelligence` → no `.sector-intelligence-filter`/`.sector-dimmed` descendants; complete source counts;
     M-1…M-4 present; complete earnings only in M-3; earnings excluded from M-4.
  4. Sectoral exposes S-1…S-3 only (no S-4/earnings/digest/promo).
  5. S-3 local selector changes only its own cards; M-3 has no dimmed/disabled controls.
  6. Verify both localhost and Tailscale URLs; check console for errors.

**SUGGESTION (verification):** add a Playwright visual-regression snapshot per section per theme (black/dark/
sepia) so the brutalist tokens and 70/30 / 3-column layouts can't silently drift; there is already a
`podcast-masonry.playwright.mjs` precedent and a rich `artifacts/design-qa/` reference set to diff against.

---

## 15. As-built gaps & marked suggestions

> All items below are **optional** improvement notes, clearly separated from the as-built spec above.

- **SUGGESTION (state/DB):** `db/schema.ts` and Drizzle are wired but empty. Read-Later, kanban completion, and
  appearance all live in `localStorage`, so they don't sync Mac↔iPhone. If cross-device continuity is wanted,
  persist these via a D1 table behind a new `/api/prefs` route.
- **SUGGESTION (CSS scale):** `globals.css` is ~305 KB and `visual-overhaul.css` ~62 KB with many `!important`
  brutalist resets. A token/utilities pass (or migrating repeated panel/nav patterns into Tailwind `@apply`
  components) would cut duplication and make theme edits safer.
- **SUGGESTION (write tickets):** order/GTT/alert tickets exist but the workflow depends on a live session; add a
  dry-run "preview only" mode and an explicit audit log surface (there is `artifacts/private/
  rca-kite-transactions-*.md` evidence but no in-app trade-audit view).
- **SUGGESTION (earnings verification):** `earnings-verify.ts` is a *contract* checker (URL + filled KPIs), not a
  live IR/NSE scraper — reported rows still depend on upstream population. A small verifier that fetches the NSE
  corporate-announcements feed would close the loop; keep the "scheduling evidence ≠ result" rule intact.
- **SUGGESTION (podcast summaries):** summaries require a configured private local model; when absent the UI
  correctly shows "not generated". Documenting the exact local summarizer config (model, endpoint) in `AGENTS.md`
  would make this reproducible on a fresh Mac.
- **SUGGESTION (accessibility):** radar/scatter charts rely on color for tone; add non-color encodings (shape or
  pattern) and verify the sepia theme's contrast on colored data tiles against WCAG AA.
- **SUGGESTION (data provenance in code):** `portfolio-data.ts` holds a baked research snapshot used as fallback;
  add a visible "fallback in use" watermark wherever it backs a live-labelled surface (the status model already
  supports this — it just isn't surfaced on every derived card).

---

## 16. Glossary

- **STRATJI** — Aditya's name for this repo/app (not in code). **Portfolio Intelligence** — the in-code brand.
- **Operational Health target** — the Asia/Kolkata date the health view is anchored to (8 PM roll; §6).
- **Isolation contract** — the rule that only S-2 filters/dims; M-1…M-4 and S-3 are always complete (§4.3).
- **Canonical action board** — the single 3-lane `DailyKanbanBoard` used by all four workspaces (§4.2).
- **Freshness strip / PulseConstellation** — the per-source live/stale indicator row (§5.3).
- **as-of / status** — every surface's real freshness (`live/partial/snapshot/verified/stale/cached/unavailable/
  public_delayed/auth_required`); never faked.

---

*Generated as an as-built handoff specification from a read-only pass over the Investment Dashboard repo
(branch `Visual-Overhaul`). All structural claims are traced to the source files listed in the provenance note.
Suggestions are explicitly labelled and are not part of the current implementation.*
