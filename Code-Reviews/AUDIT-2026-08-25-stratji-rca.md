# `$auditor` — Stratji pre-remediation audit

**Date:** 2026-08-25 · **Branch:** `claude/stratji-rca-algorithms-898d98` (rebased onto `AppKit`) · **SHA:** `ca5c7cb`
**Mode:** Read-only. Operator sequence **step 2 of 3** (`$project-status` → **`$auditor`** → `$rca-agent`). No production-code edits.
**Prior artifact:** `Project-Status/PROJECT-STATUS-2026-08-25.md` (51 rows: 17 Done / 18 In-Progress / 16 Not Implemented).
**Live stack:** not running. Findings are source-derived; runtime-dependent claims are labelled.

**Verdict: REQUEST CHANGES** — weighted **6.4 / 10**.

Baseline quality is high: honest failure states, no fabricated data, `AGENTS.md` invariants respected, licence gating in place, LLM keys kept off the wire behind `isLoopbackRequest`/`isLocalOperatorRequest`. The failures are concentrated in **update/refresh lifecycle** and **test reachability**, not in domain logic.

| Dimension | Score | Note |
| --- | --- | --- |
| Correctness | 5 / 10 | Three lifecycle defects with direct user-visible symptoms (A-1, A-2, A-3). |
| Security / secrets | 9 / 10 | Working tree and full history scans clean; keys are loopback-gated. |
| Test integrity | 3 / 10 | The documented command runs 5 of 69 files (A-4). |
| Structure | 5 / 10 | Seven files at or over the 1000-line rule (A-7). |
| Data honesty | 9 / 10 | Blank-not-inferred discipline is consistently applied. |
| Publish readiness | 4 / 10 | No `LICENSE`, starter `package.json`, operator-hardcoded paths (A-8). |

---

## P0 findings

### A-1 — The app reloads itself; the update check actively hunts for reasons to

**Files:** `app/pwa-runtime.tsx:14-29`, `public/sw.js:1-4`, `app/layout.tsx:76`

`PwaRuntime` calls `window.location.reload()` on **any** `controllerchange`. `public/sw.js` does `install → self.skipWaiting()` and `activate → self.clients.claim()`.

Two distinct triggers, and the first is unconditional:

1. **Guaranteed, once per origin.** On the first load of an uncontrolled page, install + `clients.claim()` moves `navigator.serviceWorker.controller` from `null` to the new worker. That *is* a `controllerchange`. The page reloads itself during or just after initial load — every new origin pays this: `localhost:3000`, `localhost:5050`, the LAN host and the Tailscale host are four separate registrations.
2. **Conditional, and polled for.** `register(..., { updateViaCache: "none" })` forces a network fetch of `/sw.js`, and `checkForAppUpdate` runs it **every 5 minutes and on every `visibilitychange` and `online` event**. Any byte-different response — the Flask 503 offline shell, a proxy error page, a different upstream after a Stratji recycle — installs a "new" worker, which `skipWaiting`s, claims, fires `controllerchange`, and reloads **mid-session**.

Note what this finding is *not*: `public/sw.js` is a static asset with a hardcoded `APP_SHELL_VERSION = "portfolio-iphone-v2"`. It does **not** change per build, so an ordinary rebuild does not by itself trigger a reload.

**Impact:** matches two operator symptoms exactly — "Issues with Data Loading (ONLY WHILE LOADING the app)" from trigger 1, and "Randomly Refreshing while using the App" from trigger 2. A mid-session reload also discards in-flight refresh state, which feeds A-2.

**Required change:** never auto-reload a visible, in-use document. Record `updateAvailable` and surface a dismissible control. Do not register the worker at all in development.

---

### A-2 — A network blip demands Kite re-authentication

**Files:** `app/dashboard-refresh-merge.ts:198-208`, `app/kite-auth-presentation.ts:52-62`, caller `app/page.tsx:412`

```
authStatus: current.authStatus === "authenticated" || current.authStatus === "partial"
  ? "unknown" : current.authStatus
```

`retainKiteOnFailure` runs on **any** transport failure — timeout, 503, DNS blip, MCP restart. It sets `status:"snapshot"` and downgrades `authStatus` to `"unknown"`. `kiteAuthPresentation` then takes its `status === "snapshot"` branch; because authStatus is no longer `"authenticated"`, it falls through to `{ control: "authenticate", showAuthAction: true }` and renders a **login link**.

The broker session is untouched and the daily token is still valid. The UI invents an authentication problem out of a network problem.

The `"cached"` control immediately above it is the correct rendering for this state and is currently unreachable from the failure path.

**Impact:** the operator's "Kite Authentication randomly authenticating after Stratji App loaded". Compounded by A-1 (each reload re-runs the race) and A-3 (rate-limit is a transport failure).

**Required change:** preserve `authStatus` on transport failure. Only a **server-reported** `auth_required` / `unauthenticated` / `expired` may produce the Authenticate control.

---

### A-3 — Startup fans out 12 sectors into a single 350 ms-gap serialised call chain

**Files:** `app/page.tsx:544-552`, `app/kite-live-server.ts` (`KITE_CALL_MIN_GAP_MS = 350`, `callKiteTool`), `app/sector-live-server.ts` (`markRateLimited`, 60 s penalty)

`refreshAll` issues `Promise.allSettled(Object.keys(sectorCompanies).filter(≠primary).map(loadSectorMarket))` — 12 of 13 sectors at once — while every Kite call is funnelled through one promise chain with a 350 ms floor. Each sector fetches per-constituent quotes plus daily history.

There is no shared budget between the sector fan-out and the portfolio snapshot. The chain saturates, Zerodha rate-limits, `markRateLimited` imposes a 60 s penalty, `retainedSnapshot` is returned — and A-2 converts that into a login prompt.

**Impact:** slow, partial cold start, and it is the most likely real-world trigger for A-2.

**Required change:** load the selected sector first; queue the rest at low concurrency behind a shared token bucket that respects `rateLimitedUntil`.

---

## P1 findings

### A-4 — The documented test command runs 5 of 69 test files

**Files:** `package.json:28`, `tests/helpers/register-ts-ext.mjs`, `AGENTS.md:186` ("Required run sequence" step 3)

`npm test` runs `rendered-html` plus four `--experimental-strip-types` files. The other 64 are never invoked, and the script omits `--import ./tests/helpers/register-ts-ext.mjs`. Without that hook, every strategy/builder test dies at import with `ERR_MODULE_NOT_FOUND` on extensionless TS specifiers (`app/strategy/graph-types`), which reads as broken product code rather than a missing loader.

Correct invocation, verified this pass:

```
node --experimental-strip-types --import ./tests/helpers/register-ts-ext.mjs --test tests/*.test.mjs
→ 404 tests, 404 pass, 0 fail
```

**Impact:** all coverage for the workspace about to receive two new algorithms — `strategy-tree*`, `strategy-book`, `strategy-campaign`, `builder-universe`, `algorithm-canvas` — is invisible to the documented gate. A regression there ships green.

**Required change:** make `npm test` run the full suite with the hook, and update `AGENTS.md`.

---

### A-5 — "Refresh all" is a silent no-op while a background refresh is in flight

**Files:** `app/page.tsx:534-535`, callers at `:775`, `:787`, `:789`, `:828`

```
if (refreshInFlightRef.current) return refreshInFlightRef.current;
```

The guard returns the in-flight promise **regardless of the caller's arguments**. The native launch path calls `refreshAll(false, { silent: true })`; because `silent` skips `setRefreshing(true)`, the button's `disabled={refreshing}` stays **false**. The user clicks "Refresh all" (`forceContent = true`), receives the running non-forcing promise, sees no spinner, and Mail/Podcasts/content is never force-refreshed.

The control looks functional and does nothing. This is a distinct defect from A-1/A-3 and contributes independently to the operator's data-loading complaint.

**Required change:** if a non-forcing run is in flight and a forcing run is requested, either chain a forcing pass after it or promote the in-flight run; never silently discard the stronger request.

---

### A-6 — Macro scenario evidence selection is unmaintainable and fails open

**Files:** `app/macro-scenario-evidence.ts:34-91` (`kpiRules`, `scenarioRules`), `:124-142` (`scenarioBandForItem`), `:174` (`assembleScenarioEvidence`)

Per-band splitting exists and is the right shape. The selection mechanism is not: hand-tuned regex carrying literal content exclusions — `maze of conflicts`, `data fortress`, `herbal extract`, `chicken surplus`, `poultry companies`, `cuddly mascot`, `must-read tech news`, `college major`. These are single-article patches embedded in product code, and each one is evidence that the classifier has no notion of relevance.

`scenarioBandForItem` returns `null` when no band rule matches, and `scenarioEvidenceItems` then filters the item out entirely. Thin bands silently fall back to shared framework text, so all three bands of an event display the same content — the operator's "same source for ALL 3 Oil/War scenarios".

**Required change:** keep regex as **recall**, add a relevance-ranking layer for **precision**, and enforce cross-band exclusivity so an item is `supports-range` for at most one band.

---

### A-7 — Seven files at or over the 1000-line rule

`SatyaPresence.tsx` 1161 · `satya-client.ts` 1028 · `algorithm-builder.css` 1005 · `satya.css` 996 · `visual-overhaul.css` 964 · `page.tsx` 959 · `kite-live-server.ts` 903.

Flagged by the prior audit and unchanged. `SatyaPresence.tsx` is the one that matters here: the planned full-body persona rig would grow the largest file in the repo. Extract the SVG rig and its state mapping before adding to it.

---

### A-8 — Not publishable as-is

| Item | State |
| --- | --- |
| `LICENSE` at repo root | **absent** — blocking |
| `package.json` name | `site-creator-vinext-starter`; no description/repository/author/license |
| `scripts/ensure-kite-server.sh:4` | defaults `KITE_DIR` to `/Users/adityasharma/Documents/GitHub/kite-mcp-server` |
| Bundle identifiers | `com.adityasharma.*` in launchd plists, the installer, Auth0 registration and `defaults` domains. **Deliberately deferred:** these must match the code-signed `Info.plist`, and `LICENSE-AND-DISTRIBUTION.md` §3 says "or keep adityasharma until P7". A shell-level override would silently desync launchd and `defaults`. |
| `.env.example` | ~~absent~~ **CORRECTION: it existed and is tracked** (Supabase, licence key, LLM keys, Auth0). It was missing the Kite/Groww/Axis/Apple/service variables, which were appended. |
| `.gitignore` | ✅ excludes `.env*`, `artifacts/private/`, `.firecrawl/` |
| Secret scan | ✅ **clean** — working tree and full `git log -p` history, pattern-based (`sk-`, `ghp_`, `AKIA`, `xox[baprs]-`, PEM private keys) |

---

## P2 findings

- **A-9** `classifySectorSentiment` (`app/sector-news-server.ts:65-72`) is a ±1 regex tally with no magnitude or confidence; three-valued output cannot support a composite score.
- **A-10** `groww-live-server.ts` (65 lines) returns holdings only and does not mirror Kite's `status`/`authStatus`/`message` contract, so the freshness strip cannot treat the two brokers uniformly.
- **A-11** `scripts/satya-axis-pdf-ingest.mjs` extracts text-layer only and reads a local folder; a scanned Axis PDF indexes as empty with no recorded reason.
- **A-12** Six CSS files carry zero `prefers-reduced-motion` coverage. Correct today because they carry zero animations — a constraint the planned motion work must not break.

---

## What is explicitly **not** a finding

- **Kite daily-token handling on MCP 400/404.** `app/kite-live-server.ts:167` calls `clearPersistedKiteSession()`, which looks destructive but is correct: the dashboard persists only the **MCP session id**, while the external Go `kite-mcp-server` persists the broker token separately at `~/.kite-mcp/daily-access-token.json` and re-applies it to each new MCP session (`kc/manager.go:210-213`). Preserving the dead session id would be the bug.
- **Always-recycle launch.** Closed in `550f0c1`; `kickoffAtLaunch` adopts a live gateway (`apple-app/Stratji/FlaskServiceSupervisor.swift:71-87`).
- **Web hover impersonating selection.** Closed in `550f0c1`.
- **LLM keys on the wire.** `local-llm-secrets.ts` gates provider calls behind `isLoopbackRequest` / `isLocalOperatorRequest`.
- **Fabricated data.** No path was found that substitutes a static value for a failed live fetch. `axisProgressToTarget`, `buildInvestabilityFactors` and the earnings KPI slots all return null/blank rather than inferring.

---

## Required before merge

1. A-1, A-2, A-3 fixed and reproduced against a **running** stack.
2. A-4 fixed — `npm test` must run what it claims.
3. A-5 fixed.
4. A-6 addressed before any new evidence UI is built on top of it.
5. A-7 addressed for `SatyaPresence.tsx` **before** the persona work, not after.
6. A-8 completed before the repository is made public.

Next: `$rca-agent` → `RCAs/RCA-2026-08-25-stratji-loading-refresh-auth-evidence.md` + `Plans/PLAN-2026-08-25-Stratji-RCA-Remediation.md`.
