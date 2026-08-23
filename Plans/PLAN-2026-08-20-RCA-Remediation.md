# Implementation plan — RCA remediation (2026-08-20)

**Source RCA:** `RCAs/RCA-2026-08-20.md`
**Prior auditor:** `Code-Reviews/AUDIT-AppKit-2026-08-20.md` (REQUEST CHANGES)
**Branch / baseline:** `AppKit` @ `cbb3356e846eabd64f713bec4c6431e81a8fec72` + dirty Satya tree
**Constraint:** This plan is documentation only until an implementation agent is asked to edit production code. Do not commit, push, restart services, or publish private data as part of writing this file.

**Goal:** Make Satya M-2 mergeable without breaking two-mailbox ingest, webinar default-exclusion, operator-Mac chat, empty vs no-match refusals, or DailyKanbanBoard / S-2 isolation invariants. Restore Health to `live` through the Asia/Kolkata operational target as an **ops** step, not a labelling workaround.

---

## Success criteria

1. `scripts/satya-corpus.mjs` no longer exists as a 1 024-line kitchen sink; Next `app/satya/retrieve.ts` does not import ingest/backfill/osascript.
2. `app/dashboard/digest-mail-groups.tsx` is gone; `rendered-html` asserts M-2 chips/citations, not digest walls.
3. M-2 family chip counts equal `GET /api/satya/sources` (no sender emails).
4. SSE `done` does not double-append citations; Axis category parse uses `isAxisResearchCategoryId`.
5. Companion default retrieval includes verified earnings the same way briefing chips do.
6. PDF ingest is either awaited before digest `live` or has an explicit `pdfIngest` status.
7. Health snapshot `status=live` with `dataDate === targetDate` for the then-current `healthTargetDate` (ops).
8. Tests: existing corpus/classify/speech/isolation/vitals stay green; satya-api keeps **forbidding** `Interrogate LLM`; flask tests 20/20 via `.venv-flask`.
9. Product invariants unchanged: Intelligence is M-1 / M-2 Satya / M-3 only; no digest reading walls; DailyKanbanBoard only; S-2 filter does not leak.

---

## Phase 0 — Do not regress what is already sound

**Keep as-is unless a later phase touches the file:**

- `IntelligenceWorkspace.tsx` section list `m1|m2|m3` and `DailyKanbanBoard workspace="intelligence"`.
- `workspace-routing.ts` rewrite `intelligence&section=m4` → My Feed H-4.
- `classifySatyaFamily` / Axis MF **prefix** / two-mailbox rules in `scripts/satya-classify.mjs`.
- `resolveAxisCategoryFilter` default omitting `live_webinars`.
- Flask `_operator_only_proxy` + Next `isLocalOperatorRequest` on `POST /api/satya/chat`.
- `GET /api/satya/sources` omitting senders.
- FTS token allowlist `[a-z0-9]+` cap 8.
- `satyaRefusalMessage` empty vs no-match copy (do not ask to refresh mail on zero FTS hits).
- Negative tests for `Interrogate LLM`.

**Ops (no code):** Run the **Health** Apple Shortcut for **2026-08-19**, import Health Stats via `scripts/import_health_shortcut.py`, then `scripts/refresh-apple-health.sh` / dashboard refresh. Re-check `/api/dashboard/freshness`: `status=live`, `requiredThrough` = `dataDate`. If the ZIP is newer but corrupt, keep last validated `export.xml`.

---

## Phase 1 — P1 merge blockers (do in this PR if feasible)

**Effort:** ~2 hours if the sqlite file path stays one location (`artifacts/private/satya/corpus.sqlite`). **Risk:** medium.

### 1.1 Split the corpus boulder

**Target layout (names may vary; jobs must not):**

| Module | Responsibility | Importers |
|---|---|---|
| `scripts/satya-store.mjs` | schema, `openSatyaCorpus`, upsert, meta, `recordSatyaIngestError` | ingest CLI, digest hook, tests |
| `app/satya/search.mjs` + `search.ts` re-export | FTS MATCH, axis SQL, scoring, `countSatyaDocuments`, catalog seeds **read** | `app/satya/retrieve.ts` only (and tests) |
| `scripts/satya-ingest.mjs` | `ingestSatyaDigestRefresh`, PDF orchestration call, backfill CLI / `osascript` | `content-digest-server.mjs`, `satya-backfill.sh` |

**Rules:**

- Chat/retrieve **must not** import `runSatyaBackfill`, `execFile("osascript")`, or catalog **writers**.
- Reuse the existing `.mjs` + `.ts` re-export pattern from `axis-categories` / `source-catalog`.
- Each new file &lt; 1 000 lines; prefer &lt; 500 for search.
- Preserve parameterized FTS and family/axis SQL-before-LIMIT.

**Acceptance:**

- `rg osascript app/satya app/api/satya` empty.
- `node --test tests/satya-corpus.test.mjs tests/satya-api.test.mjs tests/satya-catalog.test.mjs tests/axis-categories.test.mjs` pass.
- Empty corpus vs no-match still distinct.

### 1.2 Delete the digest-wall zombie and retarget tests

**Delete:** `app/dashboard/digest-mail-groups.tsx`

**Keep:** `app/dashboard/digest-newsletter-groups.ts` (M-1 actions, Axis category grouping, newsletter family counts for **actions**, not for M-2 chips after 2.1).

**Edit:**

- `tests/helpers/algorithm-canvas.mjs` — remove `digest-mail-groups.tsx` from `INTELLIGENCE_SOURCE_CANDIDATES`.
- `tests/rendered-html.test.mjs`:
  - Remove `NewsletterFamilyGroups` / `SenderDigestGroups` / `layout === "axis"` / `axis-open-pdf` / `Open in Podcasts` / `AI transcript summary` **as Intelligence-workspace requirements**.
  - Keep compact citation labels on **`satya-client.ts`** (`Open PDF`, `Open in Mail`) if those strings remain the icon `aria-label`s.
  - Keep forbids: `Newsletter digest` h3, M-4, `Interrogate LLM`, `sector-dimmed` in Intelligence.
  - Keep requires: `satya-axis-chip`, `SatyaBriefingRoom`, M-1/M-2/M-3, `DailyKanbanBoard workspace="intelligence"`.

**Acceptance:** `rg NewsletterFamilyGroups app/` empty. `node --test tests/rendered-html.test.mjs` pass. Live M-2 still has no digest walls (SSR already clean 2026-08-20).

### 1.3 Do not restore Interrogate LLM

No product copy change. Keep `doesNotMatch(/Interrogate LLM/)` in `satya-api` and `rendered-html`.

---

## Phase 2 — P2 correctness on M-2 / companion (same PR if cheap)

### 2.1 Chip counts = corpus API

**File:** `app/dashboard/SatyaBriefingRoom.tsx` (`sourceCounts` merge) · `app/dashboard/IntelligenceWorkspace.tsx` (`familyCounts` prop)

**Change:** Stop overlaying digest displayed lengths on `fetchedCounts`. Either:

- omit `familyCounts` from briefing, or
- merge `{ ...familyCounts, ...fetchedCounts }` so `/api/satya/sources` wins.

**Acceptance:** On a live Mac, Axis Research chip = sources `axis_research` count (234 on 2026-08-20, not displayed 24). No sender emails in the API.

### 2.2 SSE citation double-dispatch

**File:** `app/dashboard/satya-client.ts` `dispatchSatyaEvent` `done` branch

**Change:** Do not call `onCitation` from `done.data.citations` when stream `citation` events already ran. Optional: briefing `onCitation` dedupe by `messageUrl|pdfUrl|sourceUrl`.

**Acceptance:** New unit assertion in `tests/satya-api.test.mjs` (or satya-client test): 2 citation events + done with the same 2 citations → 2 handler calls.

### 2.3 Canonical Axis category predicate

**File:** `app/dashboard/satya-client.ts` `asAxisCategory`

**Change:** Replace the 29-way switch with `isAxisResearchCategoryId` from `app/satya/axis-categories.ts`.

**Acceptance:** `axis-categories` tests still pass; adding a category in `AXIS_RESEARCH_CATEGORIES` flows to `fetchSatyaSources` without editing `satya-client.ts`.

### 2.4 Companion earnings default

**Files:** `app/dashboard/satya-client.ts` (`satyaFocus` default) · `app/dashboard/SatyaPresence.tsx` `streamSatyaChat` families · optionally `app/satya/retrieve.ts` `wantEarnings`

**Change (pick one, document it):**

- **A (preferred):** Default focus families = briefing `SOURCE_CHIPS` (includes `earnings`).
- **B:** When `families` is `undefined`, treat earnings as included (same as “all default families”).

Do **not** send earnings into sqlite FTS (`corpusFamiliesOf` already strips it).

**Acceptance:** Companion POST from `?view=investment` with a verified-prints question retrieves earnings passages without visiting M-2 first. Briefing chip toggles still constrain retrieve.

### 2.5 History monkey-patch

**File:** `app/dashboard/SatyaPresence.tsx` companion `useEffect`

**Change:** Listen to `popstate` plus a tiny `stratji:navigate` (or existing) event. Have `selectSection` in Intelligence/Sectors/Health/Builder/Strategies dispatch it after `pushState`. Restore native `history.pushState`.

**Acceptance:** Slot id still follows `?section=`; unmount restores History; no wrap-on-wrap.

---

## Phase 3 — P2 pipeline / product follow-up (same PR if PDF is in the Satya SoT claim; else next)

### 3.1 Axis PDF ingest completion

**File:** `scripts/content-digest-server.mjs` after `ingestSatyaDigestRefresh`

**Options:**

1. `await ingestSatyaAxisPdfArchive(...)` before returning `status: live` (behavior change: digest slower).
2. Keep Mail live; add `corpus.pdfIngest: pending|ok|error` on `GET /api/satya/status` and briefing subtitle.

Prefer **2** if digest latency is already tight; prefer **1** if AGENTS “PDFs as SoT” must be true the moment Mail is live.

**Also:** serialize sqlite access (one writer) to reduce `SQLITE_BUSY` vs chat.

**Acceptance:** Fixture: mail item with PDF → either FTS `content_source=pdf` row exists when digest returns live, **or** status shows pending then ok/error without flipping Mail to live falsely.

### 3.2 Single-turn vs transcript

**Product decision required:**

- **Follow-up context:** append last N user/assistant texts to the **user prompt** as untrusted conversation, still retrieve only on the latest question (or latest+titles). Never treat model text as a number source.
- **Or** disable the composer until “New question” clears the transcript.

**Acceptance:** Follow-up “compare those two” either refuses with “no prior names in retrieved passages” or retrieves using titles from the prior turn **as query hints**, not as invented CMP.

### 3.3 Optional: mention backfill in startup docs

`scripts/satya-backfill.sh` stays **manual** (90-day, oldest-unseen → newest, corpus only — never a browsing wall). Add one line to AGENTS/README: startup digest ingest ≠ historical backfill. Do **not** dump backfill into M-2 UI.

---

## Phase 4 — P3 hygiene

| Item | Change | When |
|---|---|---|
| `SatyaPresence.tsx` 663 lines | Extract speech/PTT and task complete; companion becomes launcher | After Phase 2.5 |
| `content-digest-server.mjs` 1993 | No new classify/policy; ingest is a call | Ongoing |
| Investment I-4 docs | README/AGENTS list I-4 Axis picks **or** merge under I-3 | Docs-only PR ok |
| Freshness SSR | Seed `sourceFreshness` from first refresh payload if SSR has it | Optional |
| Market calendar node | Cadence label “config”, not live pulse | Optional |
| `FlaskServiceSupervisor.swift` 500 | Follow-up split; not merge-blocking | Later |
| `tests/rendered-html.test.mjs` 2172 | Stop adding Intelligence greps; prefer focused tests | With 1.2 |

---

## Phase 5 — Verification (implementation agent)

Run **without** claiming visual/freshness issues are fixed merely because CI is green.

```bash
# Targeted (must)
node --test tests/satya-api.test.mjs tests/satya-corpus.test.mjs tests/satya-catalog.test.mjs \
  tests/axis-categories.test.mjs tests/satya-speech.test.mjs tests/intelligence-daily-actions.test.mjs \
  tests/freshness-and-isolation.test.mjs tests/vital-metrics-direction.test.mjs tests/rendered-html.test.mjs

.venv-flask/bin/python -m unittest tests.test_flask_gateway -q

npx eslint app/satya app/api/satya app/dashboard/SatyaBriefingRoom.tsx \
  app/dashboard/SatyaPresence.tsx app/dashboard/satya-client.ts \
  app/dashboard/IntelligenceWorkspace.tsx --ignore-pattern dist --ignore-pattern .next
```

Then, when an implementation pass is allowed to use the build cache:

- `npm run lint` and `npm run build`
- Open `?view=intelligence` — M-1/M-2/M-3, Satya chips, **no** Newsletter/Axis/Podcast walls, **no** M-4, **no** `.sector-dimmed`
- Open `?view=sectors`, change S-2 industry — S-3 and M-3 undimmed
- Confirm localhost **and** Tailscale HTML
- Health strip: `stale` until D-1 exists, then `live` — never infer missing dates

**Do not** run `$auditor` again unless requested. **Do** run `$project-status` as the next sequenced step after this RCA.

---

## Build sequence (when coding starts)

1. Phase 1.1 split (store/search/ingest) with tests red/green on corpus.
2. Point `retrieve.ts` at search; confirm chat still refuses empty/no-match.
3. Phase 1.2 delete zombie + retarget greps.
4. Phase 2.1–2.4 (chips, SSE, category id, companion earnings).
5. Phase 2.5 History (touches every workspace `pushState` — keep diffs small).
6. Phase 3.1 PDF ingest status or await.
7. Phase 3.2 only after product choice on follow-ups.
8. Phase 4 docs.
9. Phase 5 full verification.
10. Operator Phase 0 Health D-1 import (can run in parallel anytime).

---

## Out of scope / do not do

- Do not add M-4/M-5 or restore digest walls as Market Intelligence UI.
- Do not index a third mailbox.
- Do not put sender emails on `/api/satya/sources`.
- Do not invent Health or earnings KPIs for missing dates.
- Do not compact or fork `DailyKanbanBoard`.
- Do not pass `selectedSectorIds` into Intelligence or S-3.
- Do not treat Satya answers as a source for numbers.
- Do not run `npx playwright install` or restart Flask unless a later agent is asked to do visual QA.
- Do not commit or push unless the user asks.

---

## Mapping from RCA severities

| RCA id | Phase |
|---|---|
| P1 corpus 1024 + retrieve→scripts | 1.1 |
| P1 digest-mail-groups + rendered-html pin | 1.2 |
| P1 Interrogate LLM tests (already green) | 1.3 hold |
| P1 Health D-1 stale | Phase 0 ops |
| P2 chips overlay | 2.1 |
| P2 SSE citations | 2.2 |
| P2 Axis switch | 2.3 |
| P2 companion earnings | 2.4 |
| P2 History patch | 2.5 |
| P2 PDF fire-and-forget | 3.1 |
| P2 single-turn transcript | 3.2 |
| P3 remainder | Phase 4 |
