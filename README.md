# Investment Dashboard

## Startup data refresh

Every dashboard service start runs `scripts/refresh-dashboard-data.sh` after the Flask gateway is ready. The audit refreshes or verifies Kite, Mail and Podcasts, earnings, HealthKit D-1 coverage, and every configured sector. Results are written to `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`; failures remain visible as stale, cached, or unavailable data instead of being presented as live.

Persistent source and freshness rules for future maintenance are in `AGENTS.md`.

A local dark-theme portfolio dashboard running on
[vinext](https://github.com/cloudflare/vinext). It combines live Zerodha Kite
portfolio data with the latest Axis Research brief, newsletter digest, analyst
calls, macro scenarios, and local podcast notes.

## Prerequisites

- Node.js `>=22.13.0`
- Python 3.10 or newer for the private Flask app gateway

## Quick Start

```bash
npm install
npm run dev
npm run build
```

To run the complete dashboard as a private macOS and iPhone app through Flask:

```bash
npm run flask:setup
npm run iphone
```

The first command creates an isolated `.venv-flask` environment. The launcher
starts a local-only macOS background job for the current login session. Vinext
and Flask/Waitress bind to localhost, so private dashboard data is not exposed
to other devices or network interfaces.
The local-only launcher restores the Mac dashboard at `http://localhost:5050/` without exposing private data to the LAN. Tailscale Serve provides private iPhone and mobile-data access without exposing port `5050` to the public internet.

Install the Mac Dock app once with `npm run desktop` (creates `~/Applications/Portfolio Intelligence.app` and pins it). Alternatively open `http://localhost:5050/` in Safari and choose **File → Add to Dock**. For iPhone, run `npm run iphone` (Tailscale when signed in, otherwise same-Wi-Fi LAN), open the printed Install URL in Safari, then **Share → Add to Home Screen**. The guide is also at `/install`.

The primary full-featured iPhone client is the SwiftUI app in
`apple-app/InvestmentDashboard.xcodeproj`. It provides native onboarding,
Investment/Sectoral/Health workspace navigation, startup-audit and connection
status, HealthKit D-1 upload, offline recovery, and PDF sharing around one
persistent WKWebView. The Safari PWA remains a fallback installation path.
See `apple-app/README.md` for physical-device and TestFlight instructions.

After installing the native app, generate its single-use HealthKit pairing code
on the Mac:

```bash
npm run iphone:pair
```

The paired upload token is stored in the iPhone Keychain; the Mac stores only
its hash in the ignored private artifacts directory.

The iPhone refreshes all dashboard sources when it opens or returns to the
foreground, when connectivity returns, when **Refresh now** is pressed, and
every five minutes while active. Mac-side updates therefore appear on iPhone
without reinstalling the app. Keep the Mac awake. The Mac
remains the private application server; Kite credentials, Mail, Podcasts, Health
data, and MCP calls remain server-side.

## Workspace and filtering behavior

The dashboard has three persistent workspaces:

- **Investment**: action board, live Kite portfolio snapshot, macro scenarios,
  analyst calls, portfolio/Axis risk views, and Axis recommendations.
- **Sectoral Analytics**: sector action board, linked sector analytics, complete
  intelligence digest, and earnings/decision tools.
- **Health & Wellness**: private HealthKit coverage, modular category KPIs,
  comparisons, trends, action board, optimisation, and guardrails.

The industry selector in **S-2 Sectoral Analytics** is deliberately scoped to
S-2. Selecting an industry filters or dims only S-2 matrices, charts, rankings,
company composition, and linked analytical panels.

The following sections are always outside that filter boundary:

- **S-3 Live Intelligence Digest** always shows the complete refreshed
  Newsletter, Axis Research, Calendar, Reminders, Notes, and Podcast content.
  It must not show an industry-filter banner or exclude unmatched industries.
- **S-4 Earnings & Decision Framework** always keeps every tracked earnings
  event visible, enabled, and selectable. The S-2 industry choice must not dim,
  disable, hide, or reduce the earnings event set.
- The S-4 Decision Framework has its own local industry selector. Changing it
  updates only that framework and does not change S-2, S-3, or the earnings
  calendar.

This boundary is covered by rendered-dashboard tests. Any future sector filter
change must preserve full S-3/S-4 visibility on desktop, iPhone, and PDF flows.

### Access over mobile data

Install Tailscale on the Mac and iPhone and sign in to the same tailnet. Run
`npm run remote`; the launcher prints the Mac's stable `100.x.y.z` address
when Tailscale is connected. The native app defaults to the private Tailscale
Serve address `https://adis-mbp.tailfd8d7f.ts.net/`. The dashboard remains private to the tailnet instead
of being published to the open internet.

## Project Layout

- `app/`: dashboard workspaces, report route, live APIs, and data definitions
- `scripts/`: macOS launchers plus Kite, Mail, podcast, PDF, and Tailscale helpers
- `apple-app/InvestmentDashboard.xcodeproj`: native macOS and iOS wrapper app
- `integrations/kite-connect-mcp-typescript/`: retained TypeScript Kite MCP prototype
- `artifacts/reports/`: generated report artifacts retained with the project
- `notion/`: project summary and file-organization history

The production Kite integration remains the adjacent Go project at
`/Users/adityasharma/Documents/GitHub/kite-mcp-server`. Set
`KITE_MCP_PROJECT_DIR` to override that location.

The dashboard starts the local Kite MCP server automatically, then reads holdings,
positions, margins, orders, and GTTs through a server-only MCP session. The
browser refreshes `/api/kite/snapshot` immediately and every five minutes.
Holdings are the critical live read; positions, margins, orders, and GTTs use
failure-tolerant reads so one secondary Kite endpoint cannot blank the portfolio.
When live Kite is unavailable, the UI explicitly switches to the last validated
Kite snapshot and never labels it as live.

Use the dashboard's **Authenticate Kite** action only when the existing session
genuinely requires authentication. Complete the Zerodha login, return to the
dashboard, and press **Refresh now**. After one successful login, the daily
access token is kept until the next ~06:00 IST boundary (Zerodha's once-per-day
rule). The dashboard and local Kite MCP server reuse that token across restarts
and MCP session rotations; avoid additional same-day logins because Zerodha can
invalidate the previous access token for the same API key.

## Research Sources

- Primary knowledge base: `/Users/adityasharma/Downloads/Axis Research`
- Backbone: latest prior `Investment_Brief_YYYY-MM-DD` and
  `Newsletter_Digest_YYYY-MM-DD`
- Live source of truth: Kite holdings, positions, orders, GTTs, and margins
- Supplemental context: public web sources, Apple Mail digests, Apple Podcasts,
  and the local earnings calendar

The current baked research snapshot lives in `app/portfolio-data.ts`; live prices
and broker state are never sourced from that file while Kite is healthy.

Optional overrides:

```bash
KITE_MCP_PROJECT_DIR=/path/to/kite-mcp-server npm run dev
KITE_MCP_URL=http://127.0.0.1:8080/mcp npm run dev
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run flask:setup`: create the private Python environment and install Flask
- `npm run flask`: start the local-only macOS dashboard background job
- `npm run flask:stop`: stop the local-only dashboard background job
- `npm run iphone`: start the same local-only dashboard job
- `npm run remote`: start the gateway and print the private Tailscale URL
- `npm run build`: verify the vinext build output
- `npm test`: build and verify rendered dashboard behavior
- `node --test tests/rendered-html.test.mjs`: verify workspace structure,
  S-2 filter isolation, and S-3/S-4 visibility
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
