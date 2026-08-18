# AUDIT — AppKit · BLOCK

**Scope:** DIFF mode · trunk `origin/main` `c0a85491` → head `0296f52` · working tree had Pass B scratch at root · ~420 files in range (AppKit commits `7b3cf9d` + `0296f52` plus stacked Visual-Overhaul/Builder vs main)
**Coverage:** Pass A/B/C run in parallel. Read in full: Flask pairing+proxy, license/LLM/integrations routes, `isLoopbackRequest`, Stratji splash/supervisor/glass/settings/appearance/Kite, Health ZIP scripts, sector catalog, hover CSS, named tests. Sampled: Intelligence isolation, iOS sector refresh, Settings secrets fetch. Excluded: Plans/, binaries, CSS pixel review, full 420-file cartography.
**Assumptions:** Tailscale Serve onto `127.0.0.1:5050` and `npm run flask` (`0.0.0.0` after pair) are first-class. Health pairing token is not Health-POST-only.

## Verdict: **BLOCK**

Do not merge AppKit. The auto-hide glass bar, splash Health ZIP ingest, 13-industry picker, and type floor are real — but Flask-proxied Next still treats every allowed hop as loopback, so LLM keys and the license master key leak on Serve and paired LAN. Splash also ignores refresh exit status and never snapshots IT/Metals. Working chrome that ships secrets is a net negative.

| Dimension | Score | Note |
|---|---|---|
| Correctness & safety | 4/10 | Splash timeout=success; IT/Metals never refresh; Health Daily still required for Mail live |
| Security | 2/10 | Two P0 leaks on Flask-accepted hops; unauthenticated LLM complete |
| Structural quality (judo) | 4/10 | Hover denylist, triple native-chrome signals, leftover SKIP_HEALTH_ZIP |
| Layout & modularity | 4/10 | Shared/ is a Mac folder; catalog identity copied six times |
| Tests | 4/10 | Loopback test omits Flask Host hop; catalog test omits splash SECTORS |
| Legibility & docs | 6/10 | Named StratjiKiteAuth / AppearanceStore / health-sparkline.ts |
| Operability | 4/10 | Complete ingest can fail silently; incremental skips Health Stats.csv |
| **Weighted** | **3.8/10** | |

## Presumptive blockers

1. Security-sensitive paths (`/api/license`, `/api/integrations?secrets=1`, `/api/llm/complete`) have no real operator gate on Flask-accepted hops.
2. Host-OR `isLoopbackRequest` is true for every request Flask proxies to `127.0.0.1:3000`.
3. `PublicLicense.key` is serialized into SSR HTML and Settings.
4. Files crossed or blew past 1000 lines without a split (`globals.css`, `visual-overhaul.css`, Intelligence, Investment, algorithm-builder.css).
5. New special-case modes (hover allowlist+denylist+grid-on-tr; native-chrome triple class; SKIP_HEALTH_ZIP tombstone).

## Code-judo assessment

**JUDO AVAILABLE** — invert leftover modes into three booleans.

- Concepts today: hover allowlist + denylist + WKWebView `display:grid` on `tr`; `html.native-chrome-embed` + `data-native-chrome` + `.dashboard-app.native-chrome`; `PORTFOLIO_SKIP_HEALTH_ZIP` + `PORTFOLIO_REFRESH_MODE`
- Proposed: `.vo-pop` opt-in only; one embed class; `complete | incremental` only
- What disappears: SKIP env, three chrome selectors, table-row scale hacks if rows are not tables
- Behavior preserved: yes for Mac overlay + splash ZIP ingest · Effort: DO IN THIS PR IF FEASIBLE · Risk: medium (CSS)

Highest-leverage security judo (unchanged from 18 Aug): delete Host-based loopback; Flask `remote_addr` + hop-authenticated operator header; `PublicLicense` never carries `key`.

## Findings

### [P0] Flask-proxied Host-OR loopback still true — LLM keys leak · `app/local-llm-secrets.ts:213` · CONFIRMED

`isLoopbackRequest` is true if any of URL hostname, `X-Forwarded-Host`, or `Host` is loopback. Flask strips `Host` and urllib sends `Host: 127.0.0.1:3000`. Settings always `GET /api/integrations?secrets=1`.

Unpaired MagicDNS to `0.0.0.0:5050` is 401 without pairing. The leak **does** fire for Tailscale Serve onto loopback, paired LAN, and any hop Flask already accepted. Health pairing is treated as allow-all.

**Failure:** those clients receive raw OpenAI/Anthropic/Gemini/Cursor keys.

**Remedy:** Flask `_is_loopback_request()` on `remote_addr` + hop-authenticated header. Next trusts that header only from 127.0.0.1. Never return raw keys over HTTP.

### [P0] Master license key is public + unauthenticated write · `app/license.ts:265` · CONFIRMED

`PublicLicense.key` is filled from the master key. `GET /api/license` is ungated. `PUT { author: true }` copies `readMasterLicenseKey()` to disk. `layout.tsx` SSRs it; Settings renders it.

**Failure:** same Flask-accepted clients see the master key in HTML/JSON and can become Ultra.

**Remedy:** `PublicLicense` never includes `key`. Author writes require the operator gate. Settings reads the key from a loopback-only redacting endpoint or Keychain.

### [P1] `POST /api/llm/complete` has no operator gate · `app/api/llm/complete/route.ts:26` · CONFIRMED

Anyone Flask allowed can spend quota and exfiltrate Mail/earnings/builder context.

### [P1] Deprecated Health Daily still required and displayed · `scripts/content-digest-server.mjs:375` · CONFIRMED

AGENTS.md forbids Health Daily / v2. Digest still AppleScripts it and requires it for Mail/Podcasts `status=live`. Missing note fails Mail even when Newsletters are live. H-2 still renders the note.

### [P1] Complete splash treats refresh timeout/nonzero as success · `apple-app/Stratji/FlaskServiceSupervisor.swift:155` · CONFIRMED

`runRefreshScript` returns `true` after `process.terminate()` on timeout and after any `terminationStatus`. Splash sets `startupRefreshCompleted` and starts incremental ticks that skip ZIP.

### [P1] Splash never refreshes IT / Metals · `scripts/refresh-dashboard-data.sh:8` · CONFIRMED

Canonical catalog has 13 ids including `it` and `metals`. Splash `SECTORS` is the old 11. iOS iterates `NativeSectorCatalog.all`; Mac splash does not.

### [P1] Incremental Health skips Health Shortcut · `scripts/refresh-apple-health.sh:77` · CONFIRMED

`--if-changed` returns before `import_health_shortcut_if_present`. 5-minute ticks miss Health Stats.csv when the ZIP mtime is unchanged.

### [P1] Web Kite `redirect=1` swallowed by Flask `urlopen` · `app/kite-auth-presentation.ts:13` · CONFIRMED

AppKit fetches JSON and opens Safari. Web `/api/kite/login?redirect=1` 302s; urllib follows to Zerodha HTML on the dashboard origin.

### [P1] Tests lock in the broken loopback hop · `tests/integrations-workspace.test.mjs:386` · CONFIRMED

Tailscale case has no `Host: 127.0.0.1`. Green tests do not model Flask. Catalog tests never read splash `SECTORS`.

### [P1] Shared/ is a Mac app folder · `apple-app/Shared/StratjiSessionModel.swift:9` · CONFIRMED

Session + splash views call `FlaskServiceSupervisor` from Stratji/. iOS compiles an 800-line Mac bootstrap it never uses. Move SessionModel + NativeViews into `apple-app/Stratji/`.

### [P1] Industry catalog identity is copied, not owned · `app/sector-data.ts:333` · CONFIRMED

Same 13 ids in sector-data, sector-analytics-data, sector-company-data, utils, sector-news-server, NativeDashboardModels. Extract `app/sector-catalog.ts`.

### [P2] S-2 industry-breadth `tr:hover` still scales in WKWebView · `app/visual-overhaul.css:2209` · CONFIRMED

Analyst matrix was isolated; breadth table was not.

### [P2] Appearance is three stores and five writers · `apple-app/Shared/StratjiAppearanceStore.swift:49` · CONFIRMED

UserDefaults `stratji.appearance`, localStorage `dashboard-appearance`, integrations `appearance`. Extract `app/appearance.ts` key constants.

### [P2] Native chrome apologized for in CSS · `app/globals.css:193` · CONFIRMED

Extract `app/native-chrome.css`. Do not reserve padding for an overlay that no longer pushes the WebView.

### [P2] Health ZIP skip is an env rumor · `apple-app/Stratji/FlaskServiceSupervisor.swift:117` · CONFIRMED

Complete unsets SKIP; incremental uses `PORTFOLIO_REFRESH_MODE`. One contract in StratjiConfiguration.

### [P2] Audit report in repo root · `AUDIT-AppKit-2026-08-18.md:1` · CONFIRMED

Move to `artifacts/audits/2026-08-18/`. This report is under `artifacts/audits/2026-08-19/`.

## 1k-line table (Pass B vs main)

| File | Before → after |
|---|---|
| `app/globals.css` | 1065 → **4375** (further past) |
| `app/visual-overhaul.css` | 0 → **2444** (crossed) |
| `IntelligenceWorkspace.tsx` | 700 → **1180** (crossed) |
| `InvestmentWorkspace.tsx` | 482 → **1103** (crossed) |
| `algorithm-builder.css` | 0 → **1669** (crossed) |

`page.tsx` 503→957 and `StratjiSessionModel.swift` 0→836 are approaching the line.

## What this branch got right

- Complete splash no longer sets `PORTFOLIO_SKIP_HEALTH_ZIP=1`.
- Market Intelligence is not passed `selectedSectorIds`.
- Sparkline tests assert gap `M` lifts and no fabricated neighbors.
- Appearance WKUserScript at document-start.
- Auto-hide glass overlay (do not pin `webHost.top` to glass.bottom).
- Settings freshness chips wrap and bind live sources.

## Required before merge

1. Operator gate: Flask `remote_addr` + hop header; no keys on public license; LLM complete gated.
2. Remove Health Daily from digest + H-2; Mail live must not depend on it.
3. Splash `runRefreshScript` returns false on timeout/nonzero; honor `terminationStatus`.
4. Splash `SECTORS` = 13 catalog ids including `it` and `metals`.
5. Tests that model Flask `Host: 127.0.0.1` on a tailnet URL; catalog test that reads the shell `SECTORS` array.
6. (Quality, not merge-secret) collapse hover/chrome/SKIP modes; move SessionModel out of Shared; extract sector-catalog.ts.

Pass A: [8889535e](agent) · Pass B: [8ad8acd4](agent) · Pass C: [deca6114](agent) — orchestrator verified loopback, splash `return true`, and `SECTORS` missing `it`/`metals`.
