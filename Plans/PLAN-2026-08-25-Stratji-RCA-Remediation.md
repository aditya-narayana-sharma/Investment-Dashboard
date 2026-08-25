# Plan — Stratji RCA remediation, AI evidence, Satya corpus/persona, and built-in algorithms

**Date:** 2026-08-25 · **Branch:** `claude/stratji-rca-algorithms-898d98` (on `AppKit`) · **Base SHA:** `ca5c7cb`
**Inputs:** `Project-Status/PROJECT-STATUS-2026-08-25.md` · `Code-Reviews/AUDIT-2026-08-25-stratji-rca.md` · `RCAs/RCA-2026-08-25-stratji-loading-refresh-auth-evidence.md`

**Operator decisions on record:** rebase onto `AppKit` ✅ (done) · artifacts before implementation ✅ (this document closes the artifact phase) · algorithms terminate in the **existing reviewed order ticket**, never auto-execute · candles from **yfinance primary, Kite fallback**.

**Baseline to preserve:** lint ✅ · build ✅ · **404 tests / 404 pass** via
`node --experimental-strip-types --import ./tests/helpers/register-ts-ext.mjs --test tests/*.test.mjs`

---

## Stage order

Stages are ordered so each one's verification is trustworthy. **W0 first**: while the app reloads itself (RC-1), no other symptom can be observed reliably.

| Stage | Contents | Rationale |
| --- | --- | --- |
| **W0** | RC-11 test gate, RC-1 self-reload | Make the gate real, then stop the app corrupting its own evidence |
| **W1** | RC-2 auth badge, RC-3 call budget, RC-4 refresh guard | The three remaining stability defects |
| **W2** | RC-5 evidence precision + AI ranking | Investment macro workbench correctness |
| **W3** | RC-6 Satya corpus, then A-7 split, then RC-7 persona | Corpus before costume; split before growth |
| **W4** | RC-10 algorithms | Requires W0's gate |
| **W5** | RC-8 news scoring, RC-9 Groww, motion layer | Independent |
| **W6** | RC-12 publish readiness | Last, gated on everything above |

---

## W0 — Make the gate real, stop the self-reload

### W0.1 — RC-11 · test reachability

- `package.json` `scripts.test` → `npm run build && node --experimental-strip-types --import ./tests/helpers/register-ts-ext.mjs --test tests/*.test.mjs && python3 -m unittest discover -s tests -p 'test_health_import.py'`
- Update `AGENTS.md` "Required run sequence" step 3 and the "Required UI verification" step 1 to name the full command.
- **Acceptance:** `npm test` reports 404 pass, 0 fail.

### W0.2 — RC-1 · service-worker update policy

`app/pwa-runtime.tsx`, `app/layout.tsx`, masthead in `app/page.tsx`.

- Remove the unconditional `window.location.reload()` from `onControllerChange`.
- Track first control acquisition: if `navigator.serviceWorker.controller` was `null` at registration time, the ensuing `controllerchange` is the initial claim — **never** reload for it.
- For a genuine later worker change, set `updateAvailable` state and render a dismissible **"New version — reload"** control in the masthead. The user chooses when.
- Do not register the worker in development.
- Leave `public/sw.js` offline-fallback behaviour unchanged; it is correct.
- **Acceptance:** clear site data → open `:3000` → **zero** self-reloads; 30-minute session with focus changes → zero reloads; banner appears and works when a real update ships.

---

## W1 — Remaining stability defects

### W1.1 — RC-2 · transport failure must not demand re-auth

`app/dashboard-refresh-merge.ts:198-208`.

- In `retainKiteOnFailure`, **preserve** `authStatus` rather than mapping `authenticated|partial → unknown`. `status:"snapshot"` with `authStatus:"authenticated"` already routes to `control:"cached", showAuthAction:false` — the honest rendering.
- The Authenticate control must require a **server-reported** `auth_required` / `unauthenticated` / `expired`, which arrive in the payload, not from a fetch rejection.
- Add "last confirmed HH:MM" to the cached tooltip using the retained `asOf`.
- **Tests:** extend `tests/kite-status-note.test.mjs` (or add `tests/kite-auth-retention.test.mjs`) asserting that a transport failure over a live snapshot yields `control:"cached"`, and that a payload-reported expiry still yields `control:"authenticate"`.
- **Acceptance:** stop `kite-mcp-server` mid-session → "Kite cached"; restart → "Kite authenticated"; genuine daily expiry → "Kite expired — re-auth".

### W1.2 — RC-3 · shared broker call budget

`app/page.tsx:544-552`, `app/sector-live-server.ts`, `app/kite-live-server.ts`.

- Load the **selected** sector first and await it; queue the remaining 12 at **concurrency 2** through a small shared queue.
- Have the queue consult `rateLimitedUntil` and stop enqueuing while penalised instead of generating more rejections.
- Add a per-refresh Kite call budget; when exceeded, defer non-selected sectors to `requestIdleCallback` (with a `setTimeout` fallback).
- **Acceptance:** cold start with 13 sectors → zero `too many requests` in `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`; selected workspace interactive first.

### W1.3 — RC-4 · refresh guard must honour the stronger request

`app/page.tsx:534-535`.

- Track the in-flight run's `forceContent`. If a forcing request arrives while a non-forcing run is in flight, chain a forcing pass after it and return that composite promise.
- Reflect a user-invoked refresh in `refreshing` even when it chains behind a silent run, so the button disables and the spinner is truthful.
- **Acceptance:** native launch (silent in flight) + immediate "Refresh all" → spinner shows, Mail/Podcasts genuinely force-refresh.

### W1.4 — RC-1/RC-2/RC-3 · loading-state contract (STAB-4)

- Formalise `initial` (skeletons) / `background` (no chrome change, no layout shift) / `user-invoked` (spinner).
- **Acceptance:** background refresh produces zero CLS.

---

## W2 — RC-5 · unique, accurate macro evidence

`app/macro-scenario-evidence.ts`, `app/local-llm-assist.ts`, `app/dashboard/InvestmentWorkspace.tsx`.

1. **Keep regex as recall.** Do not delete `kpiRules`/`scenarioRules`; they become the candidate generator.
2. **Add precision.** New `"macro-evidence"` task in `local-llm-assist.ts` reusing `local-llm-client.ts` (Anthropic/OpenAI/Ollama already supported with circuit-breaking — **add no SDK**). Strict JSON out: `{ itemKey, band, rangeSupport, relevance 0-1, groundingSpan }[]`. The model **re-ranks candidates only**; anything it cannot ground to a span is dropped, never invented.
3. **Cross-band exclusivity.** An item may be `supports-range` for at most one band of an event; other bands may show it only as `context`, visually de-emphasised and labelled.
4. **Retire the literal exclusions** (`maze of conflicts`, `chicken surplus`, `cuddly mascot`, `college major`, …) once ranking carries precision.
5. **Honest shortfall.** Respect `MIN_SCENARIO_EVIDENCE=4` / `MAX_SCENARIO_EVIDENCE=8`; if a band cannot reach 4 grounded items, show fewer **and say so**. Never pad from another band.
6. **Fallback.** No provider or open circuit → today's regex path, panel labelled `Rule-based (AI unavailable)`. Never block render on a model.
7. **Cache** by `hash(itemKey + eventKey + bandKey + model)` in a new `app/macro-evidence-cache.ts`.
- **Tests:** extend `tests/macro-scenario-evidence.test.mjs` and `tests/macro-evidence-summaries.test.mjs` with a **cross-band uniqueness** assertion over a fixture corpus, plus a fallback test with the provider disabled.
- **Acceptance:** Oil/War → the three bands show demonstrably different `supports-range` sets.

---

## W3 — Satya corpus, then structure, then persona

### W3.1 — RC-6 · mailbox PDFs (do this first; it is the operator's actual complaint)

- New `scripts/axis-mail-attachments.mjs`: JXA over `iCloud → Axis Research`, enumerate `mailAttachments`, save each `*.pdf` content-addressed to `artifacts/private/satya/axis-pdf/<sha256>.pdf`. Reuse the exact-account/exact-mailbox helpers in `scripts/content-digest-server.mjs:149-176`.
- `scripts/satya-axis-pdf-ingest.mjs`: index **both** the mailbox store and the existing local archive, deduplicated by SHA-256.
- OCR fallback behind `SATYA_OCR_ENABLED`; when unavailable record `extractionStatus:"ocr_unavailable"` rather than indexing empty text.
- Verify `classifyAxisCategory` (`app/satya/axis-categories.mjs`) covers **Axis Alpha, Axis Punch, Daily Morning Note, Result Updates**, and that `NON_RESEARCH_SUBJECT` in `scripts/axis-mail-filter.mjs` catches none of them.
- Coverage ledger (seen / attachments found / indexed / skipped-with-reason) in `scripts/satya-store.mjs`, surfaced in `SatyaBriefingRoom.tsx`.
- Backfill via `scripts/satya-backfill.sh`; assert counts in `tests/satya-corpus.test.mjs`.
- **Acceptance:** a PDF existing **only** as a mail attachment is cited by Satya; per-family counts non-zero; the ledger names anything skipped.

### W3.2 — A-7 · split before growing

- Extract the SVG rig to `app/dashboard/SatyaAvatar.tsx` and state mapping to `satya-avatar-state.ts`. `SatyaPresence.tsx` must drop below 1000 lines **before** W3.3 adds to it.

### W3.3 — RC-7 · full-body animated persona

- Full-body inline SVG rig (head, torso, two arms, two legs) with named groups — no runtime asset, no animation library.
- States from the existing `idle/listening/thinking/speaking/error` machine via CSS custom properties in `satya.css` (4 keyframes + a `prefers-reduced-motion` block already there to extend): idle breathing/blink, arm gesture while speaking, lean-in while listening, existing fig-8 retained for thinking.
- Two presentations: compact orb for the launcher, full-body in M-2 Briefing Room and the draft pop-out.
- `transform`/`opacity` only; one `will-change` per animated group; hard reduced-motion off-switch.
- **Acceptance:** all states render; macOS Reduce Motion stops every animation; host file under 1000 lines.

---

## W4 — RC-10 · Bollinger Expansion and Mean Comparison

**Gated on W0.1.** Do not add strategy code while its tests are outside the gate.

### W4.1 — Candle provider
- `scripts/fetch-daily-candles-yfinance.py` + `app/strategy/candle-provider.ts`, returning **≥260 daily sessions** (SMA-220 plus a 3-month lookback), mirroring the subprocess pattern of `scripts/fetch-sector-quotes-yfinance.py`.
- Kite `get_historical_data` only when the paid market-data entitlement is detected; `sector-live-server.ts` already documents that a Zerodha Personal app cannot serve it.
- Disk cache keyed `symbol + lastTradingDay` via `scripts/nse-trading-day.mjs`.

### W4.2 — Bollinger Band Expansion
Extend `app/strategy/tree-indicators.ts` (which already emits `bbands_upper_20/mid/lower/width_20` at `:609-612`):

| KPI | Meaning |
| --- | --- |
| `bb_upper_min_3m` | minimum upper band over the trailing 3 months |
| `bb_lower_max_3m` | maximum lower band over the trailing 3 months |
| `bb_width_min_3m` | minimum `upper − lower` — the contraction point |
| `bb_contraction_date` | session of maximum contraction |
| `bb_width_at_contraction` | price spread at maximum contraction |
| `bb_expansion_delta` | current `upper − lower` minus `bb_width_at_contraction` |
| `bb_expansion_pct` | `bb_expansion_delta / bb_width_at_contraction × 100` |
| `bb_expansion_state` | `contracting` / `squeeze` / `expanding` |

Signal on an upward width crossing out of the squeeze band past a configurable threshold; breakout direction from close vs `bbands_mid_20`.

### W4.3 — Mean Comparison
- Add `sma_220` beside `sma_20/50/200` (`:551-553`).
- Emit `mean_cross_state` (`bullish` when `sma_20 > sma_220`), `mean_cross_gap_pct`, `mean_cross_days_since_flip`.
- A fresh bullish flip raises a **BUY candidate** — never an order.

### W4.4 — Selection, allocation, order handoff
- Register both in the strategy library (`strategy-book.ts` / `composer-strategies.ts` shapes) so they appear in Y-2.
- Signals panel in `StrategiesWorkspace.tsx`: symbol, state, indicator values, as-of date, data source. **Blank, never inferred**, when candles are short.
- New `app/dashboard/strategies/AllocationPlanner.tsx`: multi-select signalled symbols; allocation by % of deployable capital or absolute ₹; quantity from live price; validated against margin via `app/kite-order-funds.ts`.
- Hand off through `KiteTicketPortal.tsx` to `KiteOrderTicket.tsx`. The typed-confirmation gate is **unchanged**; the planner pre-fills and never submits.
- Persist the **plan** (not the order) via `strategy-store.ts`.
- **Tests:** `tests/bollinger-expansion.test.mjs`, `tests/mean-comparison.test.mjs` — known-answer math on synthetic series — plus a guard test proving no order path is reachable without typed confirmation.
- **Compliance:** update `docs/stratji/COMPLIANCE-ALGO.md` for both strategies; extend the existing not-investment-advice disclaimer to Y-2.

---

## W5 — News scoring, Groww, motion

- **RC-8:** `classifySectorSentiment` → `sentimentScore ∈ [-1,1]` + `confidence` + per-sector relevance. Composite = Σ(relevance × sentiment × recency-decay × source-weight) with the decomposition shown. Surface per-vendor health for the 6 feeds in the freshness strip (per-feed `SectorNewsSourceState` is already computed). Optional LLM re-rank behind the W2 provider gate, deterministic scorer as fallback.
- **RC-9:** Groww → positions + order-book **read**, token lifecycle, Kite-compatible `status`/`authStatus`/`message`. **No Groww order path.** Then a unified Kite+Groww holdings view, merged by symbol without double-counting, each row attributed to its broker.
- **Motion:** new `app/motion.css` token layer (durations, easings, distances). New motion only where it carries meaning — workspace cross-fade on `?view=` change, KPI roll-ups, chart draw-in on first paint, freshness-state pulse, Kanban completion. `transform`/`opacity` only. **Every** new animation gets a `prefers-reduced-motion: reduce` off-switch; the six currently animation-free CSS files must not gain uncovered motion.

---

## W6 — RC-12 · publish readiness

| Item | Action |
| --- | --- |
| `LICENSE` | Add at root per `docs/stratji/LICENSE-AND-DISTRIBUTION.md`. **Blocking.** |
| `package.json` | Rename `site-creator-vinext-starter` → `stratji`; add description/repository/author/license. |
| `scripts/ensure-kite-server.sh:4` | Require `KITE_MCP_PROJECT_DIR`; fail with a setup message instead of defaulting to an operator path. |
| Bundle ids | Parameterise `com.adityasharma.portfolio-intelligence*`; document in `INSTALL.md`. |
| `.env.example` | Generate from the ~30 `process.env.*` names. `.gitignore` already covers `.env*`, `artifacts/private/`, `.firecrawl/`. |
| Secret scan | ✅ **clean** — tree + full history, pattern-based. Re-run immediately before going public. |
| macOS coupling | Feature-detect Mail/Reminders/Calendar/Notes/Podcasts/HealthKit; degrade to a documented `unavailable`; state the macOS requirement at the top of the README. |
| Health opt-in | Ship the Health workspace **disabled by default**; the Incognito toggle is a UI mask, not a collection switch. |
| Onboarding | First-run wizard in `IntegrationsWorkspace.tsx`: licence → broker credentials → optional mailbox scopes → optional LLM provider → health opt-in. |
| `docs/stratji/PRD.md` | Reconcile to the shipped 6-workspace nav (carried over from `Project-Status/PROJECT-STATUS.md`). |

---

## Verification, every stage

```bash
npm run lint && npm run build
node --experimental-strip-types --import ./tests/helpers/register-ts-ext.mjs --test tests/*.test.mjs
```

Plus the runtime reproductions in the RCA's "Runtime reproduction required" table — **no stability fix is Done on a source read alone.**

Per `AGENTS.md`, after any Sectoral Analytics or Market Intelligence change also confirm: `?view=intelligence` has zero `.sector-dimmed` / `.sector-intelligence-filter` descendants; M-3 is the only rendered complete earnings calendar; the S-2 industry toggle does not leak into Market Intelligence or S-3.
