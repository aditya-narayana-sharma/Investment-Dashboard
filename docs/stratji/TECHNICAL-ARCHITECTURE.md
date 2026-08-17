# Stratji Technical Architecture

**Status:** living. Labels: **AS-BUILT** / **TARGET** / **INVARIANT**.

## 1. Topology (INVARIANT)

```
iPhone (Tailscale WKWebView + HealthKit upload)
        │  HTTPS tailnet only
        ▼
User Mac (data plane)
  Stratji.app (AppKit TARGET) ── WKWebView ──► http://127.0.0.1:5050/
  Flask/Waitress gateway ──► Vinext/Next.js on 127.0.0.1:3000
  Kite MCP (Go, adjacent repo, server-only)
  Apple Mail / Calendar / Reminders / Podcasts / Health ZIP (local)
  yfinance (free market plane)
        │
        ▼  (never)
stratji.co.in  holds only marketing + license JWT (TARGET)
```

The Mac must be awake for live Kite/Apple refresh. A browser refresh is not a data refresh.

## 2. Stack (AS-BUILT)

| Layer | Technology |
| --- | --- |
| Front end | Next.js 16 on vinext, React 19, Recharts, lucide-react, Tailwind 4 + hand-written CSS |
| Serving | Flask + Waitress on `127.0.0.1:5050`, launchd, Tailscale Serve |
| Broker | Adjacent Go Kite MCP, `/api/kite/*` |
| Market | yfinance Python + `/api/quotes/yfinance`, sector snapshot servers |
| Content | `scripts/content-digest-server.mjs` (Mail, Podcasts, Calendar, Reminders) |
| Health | ZIP/XML import + HealthKit iPhone POST `/_health/snapshot` |
| Native iOS | SwiftUI + WKWebView in `apple-app/InvestmentDashboard` |
| Native Mac | **TARGET this slice:** AppKit `Stratji` target in the same Xcode project |
| DB | Drizzle present; `db/schema.ts` empty. Prefs in `localStorage` |

## 3. Routing

Workspace keys (`WorkspaceKey`) remain exactly six: `investment | sectors | intelligence | health | builder | strategies`.

Chrome view `integrations` is **not** a `WorkspaceKey` and is **not** a `KanbanWorkspace`.

Canonicalization:

- `portfolio`, `portfolio-overview` → `investment`
- `market-intelligence` → `intelligence`
- `algorithm-canvas` → `builder` (+ default `section=canvas`)
- `strategy-library` → `strategies` (+ default `section=y2`)
- `settings` → `integrations` (chrome; URL stays `integrations`)

Unknown workspace values still default to `investment` **except** when the chrome parser recognizes integrations first.

## 4. Local config (TARGET v1)

Conceptual path: `~/Library/Application Support/Stratji/config.json`.

v1 implementation: gitignored `artifacts/private/integrations-config.json` via `GET/PUT /api/integrations`.

Never commit secrets. Optional LLM keys are on-device summarization only and labelled machine-drafted.

## 5. Freshness contract (INVARIANT)

`scripts/refresh-dashboard-data.sh` after Flask is reachable. Semantic statuses:

- Kite and sector snapshots: `status=live`
- Mail and Podcasts: `status=live`
- Earnings: `status=verified`
- Health: `status=live` through shared Asia/Kolkata operational target

On failure: keep last validated snapshot; label Stale / Cached / Unavailable; name the failed source. No persistent “Startup refresh audit failed” banner.

## 6. Write safety (INVARIANT)

Kite orders, GTTs/TSLs, alerts, reminder complete, and future note-create require explicit reviewed confirmation. Integration Page connect/test/disconnect placeholders must not silently write broker orders.

## 7. Native process model (TARGET)

`Stratji.app` on launch:

1. Probe `http://127.0.0.1:5050/_flask/health`
2. If down, run `scripts/start-flask-app.sh` from the recorded repo root
3. Load WKWebView at `http://127.0.0.1:5050/`
4. Window title: **Stratji**

Fallback if `xcodebuild` is unavailable: documented Chrome `--app` wrapper (`scripts/install-desktop-app.sh`).

## 8. What must not leak

- S-2 `selectedSectorId` into Market Intelligence or S-3
- Earnings grids into Sectoral Analytics or M-4
- Health Daily notes as a Health source (deprecated)
- Broker tokens onto iPhone binary or stratji.co.in
