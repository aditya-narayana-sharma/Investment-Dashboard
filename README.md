# Investment Dashboard

Personal, local-first macOS console for a live Zerodha Kite book, sector research, Mail and Podcast intelligence, Apple Health, and Indian-market strategy trees. It is **not** a public SaaS.

The serving path is Flask/Waitress on `127.0.0.1:5050` in front of Vinext on `127.0.0.1:3000`. The Mac is the private application server. A browser refresh is not a data refresh.

Open a workspace with `?view=`:

| Workspace | `?view=` | Alias |
| --- | --- | --- |
| Investment | `investment` | — |
| Sectoral Analytics | `sectors` | — |
| Market Intelligence | `intelligence` | `market-intelligence` |
| Health & Wellness | `health` | — |
| Algorithm Canvas | `builder` | `algorithm-canvas` |
| Strategies | `strategies` | `strategy-library` |

Nav accents: Investment blue, Sectors teal, Intelligence purple, Health rose, Algorithm Canvas amber `#d97706`, Strategies lime `#65a30d`. Appearances include Black, **Dark**, and **Sepia**.

---

## What it is

Portfolio Intelligence is a private desktop dashboard that combines:

- Live Kite holdings, positions, orders, GTTs, margins, quotes, and P&L
- Sector snapshots, rankings, and a local Decision Framework
- Apple Mail (Newsletters + Axis Research), Apple Podcasts, Calendar, and Reminders
- Independently verified earnings, never inferred from a calendar invite
- Apple Health through an Asia/Kolkata operational date
- An Algorithm Builder tree editor and a Strategies library remapped onto Nifty 500 names

Failed sources keep the last validated snapshot and are labelled **Stale**, **Cached**, or **Unavailable**. The UI never presents a failed source as live.

---

## Six workspaces

The six workspaces stay separate. Each keeps its own collapsible state and URL selection. Industry filters, sector dimming, earnings grids, and the Market Intelligence digest do not leak across workspaces.

Every workspace uses the same complete three-lane **Daily Action Board**: `To Do Today`, `Monitor`, and `Completed Today`. Investment I-1 is the canonical layout (summary header, full action cards, compact completed rows, compact empty lanes). Clicking an action moves it to Completed Today with strike-through styling. That state lasts through the local day and clears at local midnight. There is no compact, single-lane, or workspace-specific Kanban variant — `DailyKanbanBoard` is the only action-board implementation.

### Investment (`?view=investment`)

Live book and research home.

- **I-1 Daily Action Board** — canonical three-lane Kanban.
- **I-2 Portfolio** — holdings, orders, positions, GTTs, trailing stops, alerts, and nested allocation from Kite. Holdings are the critical live read; secondary Kite endpoints are failure-tolerant so one miss cannot blank the book.
- **I-3 Risk / macro** — risk composition, holdings radar, and macro scenario lab, plus Axis-backed research views when the Mail snapshot is live.

When live Kite is unavailable, the workspace switches to the last validated snapshot and never labels it live.

### Sectoral Analytics (`?view=sectors`)

Scrollable, full-width collapsibles. This workspace owns **S-1 / S-2 / S-3 only** — no earnings grid, no digest, no Market Intelligence promo.

- **S-1 Action Board** — the shared three-lane board.
- **S-2 Industry Analytics** — pulse, companies, rankings, and structure. The industry toggle is **S-2-only**. `selectedSectorId` may drive S-2 matrices, charts, rankings, company composition, and linked analytical panels. It must not leak into Market Intelligence or S-3.
- **S-3 Benchmarks & Decision Lab** — reference indices, radars, and decision gates. Sector-specificity here uses S-3’s own local selector. That selector does not read or mutate the S-2 industry selection.

URLs such as `?view=sectors&section=s2&page=companies` preserve Back/Forward, reload, and selected analytical state.

### Market Intelligence (`?view=intelligence`)

Always **complete and unfiltered**. Four top-level sections, no industry-filter banner, no sector-match counts, no dimming, no hidden records.

- **M-1 Action Board** — the shared three-lane board.
- **M-2 Live Intelligence** — Newsletters, Axis Research, and Podcasts. Mail uses exactly `iCloud → Newsletters` and `iCloud → Axis Research`. Displayed digests keep research or editorial content only: no promotions, ads, registration or purchase CTAs, follow/subscribe asks, contact details, phone numbers, email addresses, or website links. Podcasts are deduplicated by normalized episode title and labelled as a transcript only when a local transcript was actually available; otherwise they are labelled as a description.
- **M-3 Earnings Calendar** — the **sole** rendered complete earnings calendar. Every tracked event stays visible, enabled, and selectable regardless of the S-2 industry. Apple Calendar Earnings rows are scheduling evidence only. KPI values and reported state come from independently verified IR/NSE (or reputable financial reporting as a cross-check). Unpublished KPI fields stay blank.
- **M-4 Calendar + Reminders** — exactly one inner Calendar collapsible for complete **non-earnings** calendars, and exactly one inner Reminders collapsible with **Completed**, **Scheduled Important**, and **Work / Job 🔍** groups. Completed reminders are evidence only and are never silently restored.

### Health & Wellness (`?view=health`)

Private, **non-scrolling** three-panel console. Dense Health content lives on explicit URL-backed sub-pages such as `?view=health&section=h3&page=heart`, never in a vertically scrolling workspace. Nutrition is split across two metric pages so desktop and iPhone views stay scroll-free.

- **H-1 Action Board** — the shared three-lane board.
- **H-2 Daily Optimism** — optimism, insights, guidance, and interpretation guardrails.
- **H-3 Vital Metrics** — KPIs grouped into three **collapsible rows**: favourable, context dependent, and unfavourable. Each tile keeps its original Health category colour accent (Activity, Sleep, Heart, Respiratory, Mobility, Nutrition). Metrics without a selected-period average remain visible under Context dependent — there is no dedicated unavailable column. **Body Measurements** and **Hearing** are excluded.

**Incognito** gates thumbnail values, drill-down values, source and archive metadata, actions, recommendations, and accessibility text.

Operational date uses `healthTargetDate` in Asia/Kolkata:

| Window (IST) | Policy | Target date |
| --- | --- | --- |
| 20:00–23:59 | `D_EVENING` | current calendar date |
| 00:00–01:59 | `D_OVERNIGHT` | prior evening’s date |
| 02:00–19:59 | `D_MINUS_1` | previous calendar date |

Seven-day and 30-day comparisons end on that target. Missing values are never inferred; missing dates and stale status are shown exactly.

HealthKit `export.xml` is the primary detailed source for Sleep, Heart, and Respiratory. Daily reconciliation (steps, walking speed, workout minutes, active and resting calories, nutrition) comes from the **"Health" Apple Shortcut** and its Health Stats export, imported via `scripts/import_health_shortcut.py`. The Apple Notes Health Daily / Health Daily v2 notes are deprecated and are not read, displayed, or referenced.

### Algorithm Canvas (`?view=builder`)

Fifth workspace. Nav label is **Algorithm Canvas**. Chrome title inside the workspace is **Algorithm Builder**. Tabs: **Action Board**, **Canvas**, **JSON**. Alias `?view=algorithm-canvas` opens this workspace on the canvas section.

- **Action Board** — shared `DailyKanbanBoard` only.
- **Canvas** — Details and Backtest sit **full-width above** a **full-width top→bottom nested tree**. Blocks nest under parents; there are no wires. The 128-KPI registry is the If/Filter operand catalog. Missing KPI values render as an honest `—`. The asset picker labels instruments as `TICKER · official NSE name`. The universe is **Nifty 500 equities**. There are **no \*BEES ETF sleeves**.
- **JSON** — round-trip `StrategyTreeV1` plus compiled `StrategyGraphV2`.

No industry filters, sector dimming, earnings, or Market Intelligence digest here. Deep-link a library tree with `?view=builder&section=canvas&tree=`.

### Strategies (`?view=strategies`)

Sixth workspace. Nav label and chrome title are **Strategies**. Tabs: **Action Board** and **Library**. Alias `?view=strategy-library`.

- **Action Board** — shared `DailyKanbanBoard` only.
- **Library** — nine Composer-logic reconstructions remapped to Nifty 500 names (RELIANCE, TCS, HDFCBANK, INFY, ITC, and other official NSE constituent names). Cards are **2×2 KPI tiles**; the full vertical tree opens only in the click dialog. Stats are honest NSE yfinance figures. Published US / Nasdaq out-of-sample books are **never copied**. Missing engine results stay `—`.

Composer trees do not appear in Health, Sectors, or Intelligence. The library is read-only; edit a reconstruction by opening it in Algorithm Canvas.

---

## Data integrity

Prefer primary sources. Include source URLs and as-of dates. Do not fabricate live Kite, Mail, Podcast, Health, earnings, or backtest values. Do not silently replace a failed live value with a static stand-in.

Every service start or restart runs `scripts/refresh-dashboard-data.sh` after Flask is reachable. The audit checks payload semantics, not only HTTP success:

- Kite and sector snapshots: `status=live`
- Mail and Podcasts: `status=live`
- Earnings: `status=verified`
- Health: `status=live` through the shared Asia/Kolkata operational target

Results land in `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`. Failures surface in the compact per-source freshness strip and the affected section. There is no standalone “Startup refresh audit failed” banner. When every required source passes, no failure warning remains visible.

Health ZIP import validates the newest iCloud archive for `apple_health_export/export.xml` before extraction. A corrupt newest ZIP is reported as a fallback source; the last validated extracted XML stays in use.

PDF export refreshes Kite, Mail, earnings, and all sector snapshots immediately before write.

Persistent source and freshness rules for maintainers live in `AGENTS.md`.

---

## Run the local dashboard

### Prerequisites

- Node.js `>=22.13.0`
- Python 3.10 or newer for the private Flask gateway
- macOS (Apple Mail, Reminders, Calendar, Podcasts, and Health import are Mac-side)

### Canonical macOS service

```bash
npm install
npm run flask:setup
scripts/run-dashboard-service.sh
```

`flask:setup` creates an isolated `.venv-flask`. The service starts Vinext on `127.0.0.1:3000` if needed, binds Waitress to **`127.0.0.1:5050` only**, then runs the startup audit. Open `http://127.0.0.1:5050/` (or `http://localhost:5050/`).

Equivalent npm wrappers:

```bash
npm run flask:service    # scripts/start-flask-app.sh → run-dashboard-service.sh
npm run flask            # same local-only job, then print Tailscale URL if connected
npm run flask:stop
npm run remote           # start the gateway and print the private Tailscale Serve URL
```

Logs: `~/Library/Logs/PortfolioIntelligence/` (`service.log`, `vinext.log`, `flask.log`, `startup-refresh.log`).

### Vinext only (UI without the Flask gateway)

```bash
npm run dev      # vinext dev (also starts Kite MCP, PDF, and content-digest helpers)
npm start        # vinext start --hostname 127.0.0.1
npm run build
```

`npm start` serves Vinext on loopback. The full private product — Mail, Podcasts, Health pairing, PDF download, and the startup audit — expects Flask in front of Vinext.

Optional Kite MCP location:

```bash
KITE_MCP_PROJECT_DIR=/path/to/kite-mcp-server npm run dev
KITE_MCP_URL=http://127.0.0.1:8080/mcp npm run dev
```

### Dock and iPhone

```bash
npm run desktop       # ~/Applications/Portfolio Intelligence.app
npm run iphone        # Tailscale when signed in; otherwise same-Wi-Fi LAN
npm run iphone:pair   # single-use HealthKit pairing code after the native app is installed
```

Alternatively open `http://localhost:5050/` in Safari and choose **File → Add to Dock**. The install guide is also at `/install`.

The primary iPhone client is the SwiftUI app in `apple-app/InvestmentDashboard.xcodeproj` (native onboarding, workspace navigation, source freshness, HealthKit upload, offline recovery, PDF sharing around one WKWebView). The Safari PWA is a fallback. See `apple-app/README.md`.

The iPhone refreshes dashboard sources on open, foreground, connectivity return, **Refresh now**, and every five minutes while active. Keep the Mac awake. Kite credentials, Mail, Podcasts, Health data, and MCP calls remain server-side. The pairing token lives in the iPhone Keychain; the Mac stores only its hash in the ignored private artifacts directory.

Install Tailscale on Mac and iPhone, sign in to the same tailnet, then `npm run remote`. Tailscale Serve publishes the loopback Flask port to the tailnet only — not to the open internet.

---

## Kite authentication

The dashboard starts the local Kite MCP server automatically, then reads holdings, positions, margins, orders, and GTTs through a server-only MCP session. The browser refreshes `/api/kite/snapshot` immediately and every five minutes.

Use **Authenticate Kite** only when the existing session genuinely requires login. Complete Zerodha login, return to the dashboard, and press **Refresh now**. After one successful login, the daily access token is kept until the next ~06:00 IST boundary (Zerodha’s once-per-day rule). This is not a fixed 12-hour timer. The dashboard and local Kite MCP reuse that token across restarts; avoid additional same-day logins because Zerodha can invalidate the previous access token for the same API key.

PDF export requires a live post-login snapshot. After the overnight boundary, re-auth once, then retry export.

---

## Testing

```bash
npm run lint
npm run build
npm test
```

`npm test` builds, then runs rendered-dashboard tests, calendar/earnings reconciliation, freshness and isolation, Health date policy, Phase 3 content automation, and Python Health-import unit tests.

Workspace structure, S-2 filter isolation, and exclusive M-3 earnings ownership:

```bash
node --test tests/rendered-html.test.mjs
```

---

## Privacy and security

- Local-only product. Flask Waitress binds `127.0.0.1` in the canonical service. Vinext `npm start` uses `--hostname 127.0.0.1`.
- Do not commit secrets, tokens, pairing codes, Mail bodies, or Health values.
- Private artifacts (`artifacts/private/`, Health snapshots, pairing hashes, startup-audit JSON) stay out of git.
- Incognito on Health hides values, metadata, actions, recommendations, and accessibility text.
- Remote access is Tailscale Serve to the loopback gateway, not a public bind.
- Research Mailboxes are read-only except Reminder checkboxes. Displayed Mail and Podcast summaries omit contact details and links.

---

## Project layout

- `app/` — six workspaces, live APIs, report route, Health and strategy surfaces
- `scripts/` — macOS launchers, startup audit, Kite/PDF/content helpers, Health import
- `flask_gateway.py` — Waitress reverse proxy to Vinext
- `apple-app/` — native macOS and iOS wrapper
- `packages/kpi-registry/` — the 128-KPI catalog used by Algorithm Builder
- `artifacts/reports/` — generated report artifacts retained with the project

This app does not use `wrangler.jsonc` for the local Mac product.
