# RCA — Stratji loading, self-refresh, Kite auth flapping, and macro evidence duplication

**Date:** 2026-08-25 · **Audit time:** 14:31 IST (Asia/Kolkata) · `healthTargetDate` window **D_MINUS_1** (02:00–19:59 → **2026-08-24**)
**Mode:** Read-only. Operator sequence **step 3 of 3** (`$project-status` → `$auditor` → **`$rca-agent`**). No production-code edits, commits, or service restarts.
**Branch:** `claude/stratji-rca-algorithms-898d98` (rebased onto `AppKit`) · **SHA:** `ca5c7cb` · **Tree:** clean

**Incident class:** operator-reported instability in (1) data loading at startup, (2) unprompted mid-session refreshes, (3) unprompted Kite re-authentication, and (4) macro-scenario evidence that is neither unique nor accurate per scenario.

**Prior artifacts (cited, not re-run):**
- `$project-status`: `Project-Status/PROJECT-STATUS-2026-08-25.md` — 51 rows, 17 Done / 18 In-Progress / 16 Not Implemented.
- `$auditor`: `Code-Reviews/AUDIT-2026-08-25-stratji-rca.md` — verdict **REQUEST CHANGES**, weighted 6.4/10, findings A-1…A-12.

**Live stack:** **not running** during this pass — no listener on `:3000`, `:5050` or `:8080`; Stratji.app was not launched. Every root cause below is derived from source and control flow. Each carries an explicit runtime reproduction step that must pass before remediation is called Done.

**Baseline:** `npm run lint` ✅ · `npm run build` ✅ · full suite **404 tests / 404 pass / 0 fail** (with the `register-ts-ext` hook; see RC-4).

---

## Executive diagnosis

- **Current health:** `Degraded` — lifecycle and update-policy defects. Domain logic, KPI math and data-honesty discipline are **not** implicated.
- **Highest severity:** **P0**, no P0 data loss. No fabricated-data path was found.
- **Confirmed root causes (top 5):**
  1. **The app is instructed to reload itself.** `PwaRuntime` reloads on any `controllerchange`; `sw.js` `skipWaiting` + `clients.claim()` guarantees exactly that on first control acquisition, and a 5-minute + focus + online poll actively re-fetches `/sw.js` looking for more.
  2. **Transport failure is rendered as an authentication failure.** `retainKiteOnFailure` erases `authStatus`, and `kiteAuthPresentation` converts the erased value into a login prompt.
  3. **Startup saturates the broker call chain.** 12 concurrent sector loads share one 350 ms-gap serialised chain with the portfolio snapshot, producing the rate-limit that root cause 2 then mistranslates.
  4. **The strongest refresh request loses.** `refreshAll`'s in-flight guard ignores its own arguments, so a user-initiated forcing refresh is silently answered by a background non-forcing one.
  5. **Evidence selection fails open.** Per-band regex returns `null` for unmatched items, which are then dropped; thin bands collapse onto shared framework text, so all three bands of an event read identically.
- **Affected workspaces:** all six via shared chrome and refresh (RC-1…RC-4); Investment I-1/macro workbench via RC-5; Market Intelligence M-2 via RC-6.
- **Data current through:** this pass refreshed **no** source. Do not read this document as a freshness claim.
- **Main residual risk:** RC-1 and RC-2 are mutually amplifying. Fixing either alone leaves the symptom partially present — a reload still races the snapshot (RC-1 without RC-2), and a rate-limit still prompts for login (RC-2 without RC-3).

**This is not:** a Zerodha token-expiry defect (the Go MCP server re-applies the daily token to new sessions); an always-recycle launch defect (closed in `550f0c1`); a hover-as-selection defect (closed in `550f0c1`); or a fabricated-data defect.

---

## Findings — required table

| Workspace | Section | Sub-Section | Function/File Name | Identified Problem | Root Cause | Proposed Solution |
| --- | --- | --- | --- | --- | --- | --- |
| Cross-cutting | Chrome | PWA update | `app/pwa-runtime.tsx:14-29`; `public/sw.js:1-4`; `app/layout.tsx:76` | **RC-1.** App reloads itself during initial load, and again at unpredictable times mid-session. | `onControllerChange` calls `window.location.reload()` unconditionally. `sw.js` does `install → skipWaiting()` and `activate → clients.claim()`, so the **first** uncontrolled load moves `controller` `null → worker`, which *is* a `controllerchange` — a guaranteed self-reload per origin (`:3000`, `:5050`, LAN, Tailscale are four). Separately, `updateViaCache:"none"` + `registration.update()` on a 5-min timer and on every `visibilitychange`/`online` re-fetches `/sw.js`; any byte-different response (Flask 503 shell, proxy error page, changed upstream after a recycle) installs a "new" worker that skip-waits, claims, and reloads mid-session. `sw.js` is static with a fixed `APP_SHELL_VERSION`, so ordinary rebuilds are **not** a trigger. | Never auto-reload a visible document. Set `updateAvailable` and render a dismissible "New version — reload" control. Skip registration entirely in dev. Keep the offline fallback behaviour unchanged. |
| Cross-cutting | Live feed banner | Kite auth badge | `app/dashboard-refresh-merge.ts:198-208`; `app/kite-auth-presentation.ts:52-62`; caller `app/page.tsx:412` | **RC-2.** "Authenticate Kite" appears after the app has loaded and the session is valid. | `retainKiteOnFailure` fires on **any** transport failure and downgrades `authStatus` `"authenticated" → "unknown"`. `kiteAuthPresentation`'s `status === "snapshot"` branch returns `"cached"` **only** when authStatus is still `"authenticated"`; the just-erased value falls through to `{control:"authenticate", showAuthAction:true}`. A network problem is rendered as an auth problem, and the correct `"cached"` control is unreachable from the failure path. | Preserve `authStatus` on transport failure — `status:"snapshot"` alone already yields the honest "Kite cached". Reserve the Authenticate control for a **server-reported** `auth_required`/`unauthenticated`/`expired`. Add a "last confirmed HH:MM" tooltip. |
| Cross-cutting | Startup | Sector fan-out | `app/page.tsx:544-552`; `app/kite-live-server.ts` (`KITE_CALL_MIN_GAP_MS=350`, `callKiteTool`); `app/sector-live-server.ts` (`markRateLimited`) | **RC-3.** Slow, partial cold start; intermittent Zerodha rate-limit. | 12 of 13 sectors are launched concurrently in one `Promise.allSettled`, each fetching per-constituent quotes plus daily history, while **every** Kite call is funnelled through a single promise chain with a 350 ms floor — shared with the portfolio snapshot and with no cross-cutting budget. Saturation → `too many requests` → `markRateLimited` 60 s penalty → `retainedSnapshot` → RC-2 renders a login prompt. | Load the selected sector first; queue the remainder at concurrency 2 behind a shared token bucket honouring `rateLimitedUntil`. Add a per-refresh Kite call budget; defer non-selected sectors to idle when exceeded. |
| Cross-cutting | Masthead | Refresh all | `app/page.tsx:534-535`, callers `:775,:787,:789,:828` | **RC-4.** "Refresh all" appears to work but does nothing. | `if (refreshInFlightRef.current) return refreshInFlightRef.current;` ignores the caller's arguments. The native path runs `refreshAll(false,{silent:true})`; `silent` skips `setRefreshing(true)`, so `disabled={refreshing}` stays false and the button is clickable. The click's `forceContent=true` is discarded and the running non-forcing promise is returned — no spinner, no Mail/Podcast force refresh. | Do not discard a stronger request. If a non-forcing run is in flight and a forcing run is asked for, chain a forcing pass after it (or promote the in-flight run) and reflect it in `refreshing`. |
| Investment | I-1 / macro workbench | Scenario evidence | `app/macro-scenario-evidence.ts:34-91,124-142,174` | **RC-5.** All three bands of an event (notably Oil/War: De-escalation / Controlled conflict / Hormuz disruption) present the same sources. | Per-band structure is correct (`Record<MacroEventKey, Record<MacroBandKey, ScenarioRule>>`), but selection is hand-tuned regex whose precision is patched with literal single-article exclusions (`maze of conflicts`, `chicken surplus`, `cuddly mascot`, `college major`). `scenarioBandForItem` returns `null` on no match and `scenarioEvidenceItems` then **drops** the item, so a band that cannot reach `MIN_SCENARIO_EVIDENCE = 4` falls back to shared framework prose — identical across bands. Failure is silent. | Keep regex for **recall**; add a relevance-ranking layer for **precision** that assigns band + score and must cite a grounding span. Enforce **cross-band exclusivity**: `supports-range` in at most one band, `context` (de-emphasised, labelled) elsewhere. When a band cannot reach 4 grounded items, show fewer and say so — never pad from another band. Fall back to today's regex path labelled `Rule-based (AI unavailable)`; never block render on a model. |
| Market Intelligence | M-2 Satya | Corpus ingest | `scripts/satya-axis-pdf-ingest.mjs:2-4,31-32,173`; `scripts/axis-mail-filter.mjs`; `app/satya/axis-categories.mjs` | **RC-6.** Axis Research PDFs that exist in the mailbox are absent from Satya. | Ingest indexes a **local folder** (`AXIS_PDF_ARCHIVE_PATH` → `~/Downloads/Axis Research`) and never enumerates `mailAttachments` on `iCloud → Axis Research`. Any PDF that only ever arrived as an attachment is invisible. Compounding: extraction is **text-layer only**, so a scanned/image PDF indexes as empty; and there is no ledger, so both failures are silent. Family coverage (Axis Alpha, Axis Punch, Daily Morning Note, Result Updates) is unverified against `classifyAxisCategory` and the `NON_RESEARCH_SUBJECT` blocklist. | Add a JXA attachment extractor over the exact mailbox, saving to a content-addressed store; ingest **both** sources deduplicated by SHA-256. Add a gated OCR fallback recording `extractionStatus:"ocr_unavailable"` rather than indexing nothing. Verify a category exists per Axis family and that none is caught by the blocklist. Surface a coverage ledger (seen / found / indexed / skipped-with-reason) in M-2. |
| Market Intelligence | M-2 Satya | Persona | `app/dashboard/SatyaPresence.tsx:144-202`; `app/dashboard/satya.css` | **RC-7.** Satya has no body. (Correction to the first draft: the head glyph is richer than stated — ears, glasses, brows, mouth and blink lids already existed. The gap is the body and its state motion, not the face.) | The persona is a single 64-unit SVG containing an antenna tip and two eye circles. There is no rig and no state-driven motion vocabulary beyond the fig-8 loader. | Extend to a full-body inline SVG rig (head/torso/arms/legs) with named groups, driven from the existing `idle/listening/thinking/speaking/error` machine via CSS custom properties. Compositor-only (`transform`/`opacity`), hard `prefers-reduced-motion` off-switch. **Extract the rig to `SatyaAvatar.tsx` first** — the host file is already 1161 lines (A-7). |
| Sectors | S-2 | News sentiment | `app/sector-news-server.ts:65-72` | **RC-8.** Sentiment is too coarse to aggregate. | `classifySectorSentiment` counts regex hits in two arrays and returns Positive/Neutral/Negative on a ±1 margin. No magnitude, no confidence, no per-sector relevance — a three-valued output cannot support a weighted composite. | Emit `sentimentScore ∈ [-1,1]` plus `confidence` and a per-sector relevance weight. Composite = Σ(relevance × sentiment × recency-decay × source-weight) over the 6 feeds, with the decomposition shown, never a bare number. Surface per-vendor feed health in the freshness strip (the per-feed `SectorNewsSourceState` is already computed but not exposed). |
| Integrations | Brokers | Groww | `app/groww-live-server.ts` | **RC-9.** Groww is not a peer of Kite. | 65 lines, holdings only; no positions, orders, quotes, or token lifecycle, and it does not mirror Kite's `status`/`authStatus`/`message` contract, so the freshness strip cannot treat the brokers uniformly. | Extend to positions + order-book **read**, add token lifecycle and expiry surfacing, and adopt the Kite snapshot contract. **Read-only — no Groww order path.** Then merge Kite + Groww holdings by symbol without double-counting, attributing each row to its broker. |
| Strategies | Y-2 Library | Indicators | `app/strategy/tree-indicators.ts:551-553,609-612` | **RC-10.** The two operator-requested strategies do not exist. | `bbands_upper_20/mid/lower/width_20` and `sma_20/50/200` exist, but there is no 3-month band-extremum or contraction/expansion analysis, no `sma_220`, no candle provider guaranteeing ≥220 sessions, and no selection/allocation path. | Extend `tree-indicators.ts` (do not rebuild): add `bb_upper_min_3m`, `bb_lower_max_3m`, `bb_width_min_3m`, `bb_contraction_date`, `bb_width_at_contraction`, `bb_expansion_delta`, `bb_expansion_pct`, `bb_expansion_state`; add `sma_220`, `mean_cross_state`, `mean_cross_gap_pct`, `mean_cross_days_since_flip`. Add a ≥260-session daily candle provider (yfinance primary, Kite historical only where the paid entitlement exists). Selection + allocation planner pre-fills the existing `KiteOrderTicket` typed-confirmation flow; **never auto-executes**. |
| Cross-cutting | CI / gate | Test reachability | `package.json:28`; `tests/helpers/register-ts-ext.mjs`; `AGENTS.md:186` | **RC-11.** The gate does not test what it claims. | `npm test` runs 5 of 69 files and omits `--import ./tests/helpers/register-ts-ext.mjs`. Without the hook, extensionless TS specifiers fail `ERR_MODULE_NOT_FOUND`, which reads as broken product code. All strategy/builder coverage is therefore outside the documented gate — precisely where RC-10 adds code. | Make `npm test` run the full suite with the hook (verified 404/404) and update `AGENTS.md`. Fix this **before** RC-10 lands. |
| Publish | Distribution | Repo hygiene (see AUDIT A-8 corrections: `.env.example` existed; bundle-id rename deferred to P7) | `package.json`; `scripts/ensure-kite-server.sh:4`; launchd plists | **RC-12.** Not publishable. | No root `LICENSE`; `package.json` still `site-creator-vinext-starter`; `KITE_DIR` defaults to an operator-specific absolute path; `com.adityasharma.*` bundle identifiers; no `.env.example` for ~30 env names; Health ingest enabled by default. | Add `LICENSE` per `docs/stratji/LICENSE-AND-DISTRIBUTION.md`; set package identity; require `KITE_MCP_PROJECT_DIR` with a clear failure; parameterise bundle ids; generate `.env.example`; gate Health behind first-run opt-in. Secret scan is ✅ **clean** (tree + full history, pattern-based). |

---

## Severity and sequencing

| ID | Severity | Blocks | Fix before |
| --- | --- | --- | --- |
| RC-1 | **P0** | usability of every workspace | anything else — it corrupts the evidence for other fixes |
| RC-2 | **P0** | trust in the auth badge | — |
| RC-3 | **P1** | cold-start quality; triggers RC-2 | — |
| RC-4 | **P1** | manual recovery from any stale state | — |
| RC-11 | **P1** | safe change in Builder/Strategies | RC-10 |
| RC-5 | **P1** | Investment macro workbench correctness | any new evidence UI |
| RC-6 | **P1** | Satya answer completeness | RC-7 |
| RC-7 | P2 | — | after `SatyaPresence.tsx` split (A-7) |
| RC-8, RC-9 | P2 | — | — |
| RC-10 | P1 (feature) | — | after RC-11 |
| RC-12 | **Blocking for publish** | GitHub release | public repo |

---

## Runtime reproduction required before any remediation is called Done

This pass did not run the stack. Each root cause needs its check:

| ID | Reproduction |
| --- | --- |
| RC-1 | Clear site data, open `:3000`, watch the Network/Application panel: expect one self-reload as the worker claims. Then leave the tab open ≥30 min, switching focus, and count reloads. |
| RC-2 | With a live session, stop `kite-mcp-server`; observe the badge. Expected today: "Authenticate Kite". Required after fix: "Kite cached", returning to "Kite authenticated" on restart. |
| RC-3 | Cold start with all 13 sectors; grep `~/Library/Logs/PortfolioIntelligence/startup-refresh.log` for `too many requests`. |
| RC-4 | Launch native (silent refresh in flight), immediately click "Refresh all"; confirm no spinner and no content force-refresh. |
| RC-5 | `?view=investment`, Oil/War, switch all three bands and diff the `supports-range` sets. |
| RC-6 | Identify an Axis PDF present only as a mail attachment; confirm Satya cannot cite it today. |

---

## Remediation plan

`Plans/PLAN-2026-08-25-Stratji-RCA-Remediation.md`.
