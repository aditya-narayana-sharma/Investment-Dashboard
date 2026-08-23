# 🔍 AUDIT — AppKit + dirty Satya tree · REQUEST CHANGES

**Scope:** DIFF mode vs trunk `origin/main`, **plus the entire dirty working tree** (staged + unstaged + untracked). Uncommitted Satya/intelligence files are in scope.
**Repo:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`
**Branch:** `AppKit` @ `cbb3356e846eabd64f713bec4c6431e81a8fec72` (`origin/AppKit` 0/0)
**Base / trunk:** `origin/main` @ `c0a85491e26dadcf2dfd9decf4d266d1827e1b1f` (merge-base = same SHA)
**Dirty tree:** 63 modified files `+1897/−1210`; ~35 untracked source files (~9.5k new lines). HEAD has **no unpushed Satya commits** — Satya lives only in the working tree.
**Date:** 2026-08-20 · **Flags:** none (`--fix` not applied; no production edits)

**Coverage:**
- **Audited in full:** all new `app/satya/**`, `app/api/satya/**`, `app/dashboard/Satya*.tsx`, `satya-*.ts(x)`, `scripts/satya-*`, Intelligence workspace/digest/daily-actions, Flask Satya proxy + operator header, Axis categories, classify, speech JS/Swift, Satya tests (`satya-api`, `satya-corpus`, `satya-catalog`, `satya-speech`, `axis-categories`, `intelligence-daily-actions`).
- **Sampled:** `scripts/content-digest-server.mjs` ingest hook, `scripts/refresh-dashboard-data.sh`, `apple-app/Stratji/FlaskServiceSupervisor.swift` delta, `tests/rendered-html.test.mjs` Satya/M-2 assertions, `app/page.tsx` companion mount.
- **Not re-litigated:** committed AppKit vs `origin/main` (437 files, `+73355/−4966`). That history is already on `origin/AppKit` and was covered by prior AppKit audits (`AUDIT-AppKit-2026-08-18.md`, commit `cbb3356`). This audit treats that committed delta as **inherited**, not as new Satya work.
- **Excluded:** CSS appearance churn except where it names Satya; private snapshots, mail bodies, health records, credentials (none cited).

**Assumptions:** Flask remains the LAN/Tailscale listener (`0.0.0.0:5050`); Next stays on `127.0.0.1:3000` per `scripts/run-dashboard-service.sh`. Operator-header spoofing against Next is therefore not a reachable LAN path.

**Tests executed (read-only):** `node --test tests/satya-api.test.mjs tests/axis-categories.test.mjs tests/satya-catalog.test.mjs tests/intelligence-daily-actions.test.mjs tests/satya-speech.test.mjs` → **33 pass, 2 fail**. `tests/satya-corpus.test.mjs` → **14/14 pass**.

## Verdict: **REQUEST CHANGES**

Satya as M-2 is the right product shape: three Intelligence sections, operator-Mac chat, two-mailbox ingest, webinar default-exclusion, and empty vs no-match refusals are real. It is **not mergeable as-is**. The working tree still carries a 1024-line ingest/search/backfill boulder, a dead digest-wall module that source-grep tests pin in place, an inverted `app/ → scripts/` import, and two unit tests that fail because they still demand the string `Interrogate LLM` after the UI/prompt dropped it. No P0 auth bypass or mailbox-invariant break survived falsification.

| Dimension | Score | Note |
|---|---|---|
| Correctness & safety | 6/10 | Corpus/retrieval/refusals work; UI tests contradict; chat is single-turn; PDF ingest is racy |
| Security | 8/10 | POST `/api/satya/chat` gated Flask+Next; `/sources` omits sender emails; FTS tokens allowlisted |
| Structural quality (judo) | 4/10 | Dead digest wall + 1k corpus module + search living inside ingest/backfill |
| Layout & modularity | 4/10 | `retrieve.ts` imports `scripts/satya-corpus.mjs`; zombie `digest-mail-groups.tsx` |
| Tests | 5/10 | Corpus/classify tests are real; `rendered-html` is joined-source theater; 2 satya-api failures |
| Legibility & docs | 7/10 | AGENTS.md invariants match the M-2 canvas; dual `.mjs`/`.ts` re-exports are the right pattern |
| Operability | 6/10 | `ingestError` on status is good; fire-and-forget PDF ingest; Flask SSE 180s cap |
| **Weighted** | **5.7/10** | |

## 🧨 Presumptive blockers

1. **1000-line rule:** new `scripts/satya-corpus.mjs` is **1024** lines (schema + FTS search + digest ingest + JXA backfill + CLI).
2. **Spaghetti leftover:** `app/dashboard/digest-mail-groups.tsx` is unmounted digest-wall UI kept so `tests/rendered-html.test.mjs` / `INTELLIGENCE_SOURCE_CANDIDATES` still match `NewsletterFamilyGroups`, `Open PDF`, `layout === "axis"`.
3. **Wrong layer:** `app/satya/retrieve.ts` imports the ingest/backfill script, so the Next chat path loads osascript backfill and catalog writers.
4. **CI gate:** `tests/satya-api.test.mjs` fails today (2 assertions). `rendered-html.test.mjs` asserts the opposite (`doesNotMatch /Interrogate LLM/`).

None of these is an unmitigated P0 security hole. They are P1 merge blockers.

## 🥋 Code-judo assessment

**JUDO AVAILABLE** — split Satya into three concepts instead of one 1024-line script plus a zombie digest wall.

- **Concepts today (7):** digest-wall UI (dead), newsletter grouping, FTS search, sqlite schema/upsert, digest ingest, JXA backfill, chat/SSE.
- **Proposed (4):** (1) `scripts/satya-corpus-store.mjs` schema/upsert/meta; (2) `app/satya/search.mjs` FTS retrieve used by chat; (3) `scripts/satya-ingest.mjs` digest+PDF+backfill CLI; (4) M-2 briefing + companion (already exist).
- **What disappears:** `digest-mail-groups.tsx`; Next importing osascript; source-grep tests that require digest walls to exist; duplicate `asAxisCategory` switch if it reads `AXIS_RESEARCH_CATEGORY_IDS`.
- **Behavior preserved:** yes for retrieval, ingest, operator gate, webinar default-exclusion.
- **Effort:** DO IN THIS PR IF FEASIBLE (split + delete + retarget tests < 2h). Risk: **med** (sqlite path must stay one file).

Rejected alternative: “leave corpus.mjs as the kitchen sink because scripts already do that.” The Next API importing it is what makes the boulder load-bearing in the wrong process.

**ALREADY MINIMAL (subset):** two-mailbox `classifySatyaFamily`, `resolveAxisCategoryFilter` defaulting webinars off, Flask `X-Stratji-Local-Operator` + Next `isLocalOperatorRequest`, empty vs no-match refusals. I considered a plugin/registry for families and it would be worse.

## Findings

### [P1] `scripts/satya-corpus.mjs` ships as a 1024-line new file · `scripts/satya-corpus.mjs:1` · CONFIRMED

**What:** This PR introduces a source file at 1024 lines (wc), crossing the 1000-line rule on day one.
**Why it matters:** A reader cannot hold schema, FTS MATCH construction, digest ingest, JXA backfill, and CLI in one working set. The Next chat route imports this module (`app/satya/retrieve.ts:12`), so backfill `execFile("osascript")` (`scripts/satya-corpus.mjs:914`) lives in the API process graph. Future ingest edits become chat-path risk.
**Evidence:** `wc -l` → 1024. Exports include `openSatyaCorpus`, `searchSatyaCorpus`, `ingestSatyaDigestRefresh`, `runSatyaBackfill`. CLI `if (isMain() && process.argv[2] === "backfill")` at `:1015`.
**Remedy:** Split along the jobs above. Chat may import **search + count + meta only**. Behavior preserved: yes. Effort: DO IN THIS PR IF FEASIBLE.

```
# after
app/satya/search.ts          → FTS + axis SQL + scoring   (used by retrieve/chat)
scripts/satya-store.mjs      → schema, upsert, meta
scripts/satya-ingest.mjs     → digest hook, PDF, backfill CLI
```

### [P1] Dead digest-wall module is still part of “Intelligence” · `app/dashboard/digest-mail-groups.tsx:293` · CONFIRMED

**What:** `SenderDigestGroups` / `NewsletterFamilyGroups` still implement Mail/Axis/Podcast digest walls (`Open PDF`, `Open in Mail`, `layout === "axis"`). No production file imports this module. `IntelligenceWorkspace.tsx` mounts `SatyaBriefingRoom` only (M-1/M-2/M-3).
**Why it matters:** AGENTS.md forbids digest walls in Market Intelligence. The file is not rendered, but `tests/helpers/algorithm-canvas.mjs:33` joins it into `INTELLIGENCE_SOURCE_CANDIDATES`, so `tests/rendered-html.test.mjs:301` (`NewsletterFamilyGroups`), `:379–396` (`axis-open-pdf`, `Open in Podcasts`, `AI transcript summary`), and the mega `page` blob at `:1074` still **require the zombie to exist**. Deleting it “fails CI” without the walls coming back. That is test theater pinning architectural drift.
**Evidence:** `rg digest-mail-groups` → only the test helper and a plan file. `app/page.tsx` has no `NewsletterFamilyGroups`. `IntelligenceWorkspace.tsx:15-19` sections are `m1|m2|m3` only.
**Remedy:** Delete `digest-mail-groups.tsx`. Keep `digest-newsletter-groups.ts` (used for M-1 actions + chip counts). Retarget `rendered-html` assertions at `SatyaBriefingRoom` / `satya-axis-chip` / H-4 calendar. Behavior preserved: yes (nothing mounts it). Effort: DO NOW.

### [P1] Satya unit tests fail and contradict rendered-html · `tests/satya-api.test.mjs:41` · CONFIRMED

**What:** Two assertions still require the string `Interrogate LLM`. The prompt and refusal copy no longer contain it. `tests/rendered-html.test.mjs:259` asserts `doesNotMatch(satyaSources, /Interrogate LLM/)`.
**Why it matters:** `node --test tests/satya-api.test.mjs` fails. Shipping with a red unit file is a CI gate break. The two tests encode opposite contracts.
**Evidence:** Executed 2026-08-20. Failures:

- `:41` expected `/Interrogate LLM on Algorithm Canvas/` against `llmAssistSystemPrompt("satya")` which says “point them to Satya there” (`app/local-llm-assist.ts:82`).
- `:55` expected `/Interrogate LLM/` against `satyaRefusalMessage("builder")` at `app/satya/chat.ts:134`.

**Remedy:** Point the unit tests at the current refusal/prompt strings (`Algorithm Canvas`, `StrategyTreeV1`). Do not restore “Interrogate LLM” on M-2. Behavior preserved: yes. Effort: DO NOW.

### [P1] Retrieval layer imports the ingest/backfill script · `app/satya/retrieve.ts:12` · CONFIRMED

**What:** `searchSatyaCorpus`, `countSatyaDocuments`, and catalog seeds are imported from `../../scripts/satya-corpus.mjs`.
**Why it matters:** Domain retrieve now depends on a script that walks the repo root, writes `catalog.json`, and shells out to Mail. Cycle risk and Vinext/Next bundling of JXA. The comment at `scripts/satya-corpus.mjs:70-73` already admits a prior `dist/server` empty-corpus bug — that is the smell of this coupling.
**Remedy:** Same split as finding 1. `retrieve.ts` should import a search module under `app/satya/`. Scripts import the store, not the reverse. Behavior preserved: yes. Effort: DO IN THIS PR IF FEASIBLE.

### [P2] SSE `done` re-emits citations the stream already sent · `app/dashboard/satya-client.ts:194` · CONFIRMED

**What:** `runSatyaChat` emits one `citation` event per passage (`app/satya/chat.ts:313-315`) then `done.data.citations` (`:348-356`). `dispatchSatyaEvent` `done` walks `record.citations` and calls `onCitation` again.
**Why it matters:** `SatyaBriefingRoom` appends every citation (`SatyaBriefingRoom.tsx:170-174`). Compact icons collapse by kind (`compactCitationLinks`), so the operator usually sees one mail/pdf/podcast/earnings control — but state doubles, and any future per-title list would duplicate. Failure scenario: 4 passages → 8 `onCitation` calls → 8 entries in `turn.citations`.
**Remedy:** `done` must not re-dispatch citations (or the UI must replace, not append). Behavior preserved: yes (icons stay). Effort: DO NOW.

### [P2] Axis category IDs are duplicated as a client switch · `app/dashboard/satya-client.ts:68` · CONFIRMED

**What:** `asAxisCategory` hard-codes all 29 ids. Canonical list is `AXIS_RESEARCH_CATEGORIES` in `app/satya/axis-categories.mjs:27`.
**Why it matters:** Adding a 30th category updates chips and SQL but silently drops counts/filters in `fetchSatyaSources` until this switch is edited. Same knowledge in two places that must change together.
**Remedy:** `isAxisResearchCategoryId` from the canonical module. Behavior preserved: yes. Effort: DO NOW.

### [P2] Axis PDF ingest is fire-and-forget after digest returns live · `scripts/content-digest-server.mjs:1528` · CONFIRMED

**What:** Mail/podcast ingest is synchronous (`ingestSatyaDigestRefresh` `:1518`). PDF archive ingest is `.catch` on a promise (`:1528-1536`) and can `recordSatyaIngestError` **after** the digest snapshot is already `live`.
**Why it matters:** Operator asks Satya about a PDF that mail just referenced; FTS has no PDF row yet; answer is no-match or mail-only. A later PDF failure flips `corpus.ingestError` while Mail status stays live. Concurrent `DatabaseSync` open/close from chat search vs ingest can also `SQLITE_BUSY`.
**Remedy:** Await PDF ingest before returning the snapshot, or expose `pdfIngest: pending|ok|error` on Satya status without flipping Mail live. Behavior preserved: no (status timing changes) — justify separately. Effort: FOLLOW-UP if this PR is chat-only; DO IN THIS PR IF FEASIBLE if PDF is in the Satya SoT claim.

### [P2] Chat is single-turn; the UI pretends it is a transcript · `app/dashboard/satya-client.ts:244` · CONFIRMED

**What:** `streamSatyaChat` POSTs `{ messages: [{ role: "user", content }] }` only. `runSatyaChat` uses `latestUserText` and never sends prior turns to the model (`app/satya/chat.ts:245,321`).
**Why it matters:** Briefing transcript shows “You / Satya” history. Follow-up “what about the second name?” has no prior passage in the prompt → no-match or a new FTS that ignores the thread. Failure scenario: user asks Axis result updates, then “compare those two” → retrieval on “compare those two” with stopwords stripped.
**Remedy:** Either send last N turns into the user prompt as untrusted context **without** treating them as evidence, or disable follow-ups until a new retrieval. Behavior preserved: no (product). Effort: FOLLOW-UP.

### [P2] Companion patches `history.pushState` globally · `app/dashboard/SatyaPresence.tsx:249` · CONFIRMED

**What:** Companion variant replaces `history.pushState` / `replaceState` for the component lifetime to sync workspace slots.
**Why it matters:** Two companions, or another feature that also wraps history, will clobber. Workspace section nav already `pushState`s (`IntelligenceWorkspace.tsx:71`). This is a surprising global for a local slot id.
**Remedy:** Listen to `popstate` plus a small custom event the section nav already causes, or `MutationObserver` on `location.search` via the existing `popstate` + nav callback. Do not monkey-patch History. Behavior preserved: yes. Effort: FOLLOW-UP.

### [P3] `content-digest-server.mjs` grew 1762 → 1993 · `scripts/content-digest-server.mjs` · CONFIRMED

**What:** Already over 1k; this tree added ~231 lines (Satya ingest hook + classify). Secondary threshold, not the new-file 1k tripwire.
**Why it matters:** Digest server remains the Mail/Podcast adapter. Satya ingest should be a call, not more inline policy.
**Remedy:** Keep the hook (`ingestSatyaDigestRefresh`) and move classify to `satya-classify.mjs` (already mostly there). Effort: FOLLOW-UP.

### [NOTE] Pre-existing: `tests/rendered-html.test.mjs` 2001 → 2151

Grep-the-joined-sources is inherited AppKit/Visual-Overhaul practice. This tree extends it. Do not blame Satya for inventing it; do stop feeding it zombie files (finding 2).

## Pass A — CODE-REVIEW

**Clean (verified):**
- Market Intelligence is M-1 Action Board, M-2 Satya, M-3 Earnings only (`IntelligenceWorkspace.tsx:15-19,94-140`). No M-4/M-5. `?view=intelligence&section=m4` rewrites to My Feed H-4 (`workspace-routing.ts:342-348`).
- `SectorIntelligenceDigest` is H-4 Calendar + Reminders only (`IntelligenceDigest.tsx:26-33`); HealthWorkspace is the only mount.
- Two-mailbox classify: Axis Research is mailbox-backed; named families match inside Newsletters; Axis MF is subject **prefix** (`scripts/satya-classify.mjs:42-43,138-154`). Tests pass.
- `live_webinars` classified and indexed, excluded from default SQL (`axis-categories.mjs:28-34,388-392`; `satya-corpus.test.mjs` “live_webinars index but are excluded” **pass**).
- Empty corpus vs no-match: distinct copy; no-match does not ask to refresh mail (`chat.ts:125-128`).
- POST chat: Flask `_operator_only_proxy` + `_is_loopback_request` (`flask_gateway.py:301,355,783`) and Next `isLocalOperatorRequest` (`app/api/satya/chat/route.ts:30`). Header is stripped from the client and set only on loopback (`flask_gateway.py:402,410-411`).
- `GET /api/satya/sources` returns family + axis category counts, not `senders` (`app/api/satya/sources/route.ts:18-29`).
- FTS MATCH is parameterized; tokens are `[a-z0-9]+` and capped at 8 (`satya-corpus.mjs:461-485,590-600`).
- Native speech generation token: Swift `listenGeneration` + JS `createSatyaListenGate`; tests pass.

**Not clean:** findings P1 tests, P2 citations/PDF/single-turn.

## Pass B — CODE-QUALITY

**Clean:** Axis category table is data, not a 28-way `if` in retrieve. `parseSatyaFamilies` / `parseAxisCategories` are allowlists. Exhaustive switches on refusals and presence state.

**Not clean:** judo above; `SatyaPresence.tsx` is a **new 663-line** component (orb, portal, PTT, workspace LLM tasks, briefing composer). Secondary threshold (component > 250). Briefing already owns chips + transcript; companion should be a launcher that calls `streamSatyaChat`, not a second chat orchestrator (`SatyaPresence.tsx:320-385`).

`asAxisCategory` switch and `digest-mail-groups.tsx` are spaghetti growth: feature checks in the wrong home.

## Pass C — CODE LAYOUT

**Layout verdict:** After this change the repo is **easier** to navigate for M-2 (new `app/satya/` and `app/api/satya/` match the domain name) and **harder** for Intelligence as a whole, because `digest-mail-groups.tsx` still sits beside `SatyaBriefingRoom.tsx` and tests treat both as “the Intelligence source.” `app/satya/retrieve.ts` → `scripts/satya-corpus.mjs` points the wrong way (delivery/domain importing ops). Dual `.ts` re-export of `.mjs` for axis-categories and source-catalog is the **correct** local pattern and should be reused for search, not copied as a second classifier.

**1000-line metrics (working tree vs HEAD for modified; 0→N for new):**

| File | Before | After | Δ | Flag |
|---|---|---|---|---|
| scripts/satya-corpus.mjs | 0 | 1024 | +1024 | **RED 1k new file** |
| scripts/content-digest-server.mjs | 1762 | 1993 | +231 | already >1k, grew |
| tests/rendered-html.test.mjs | 2001 | 2151 | +150 | test file >1k |
| app/dashboard/IntelligenceDigest.tsx | 960 | 192 | −768 | **good split** |
| app/page.tsx | 955 | 959 | +4 | still <1k |
| flask_gateway.py | 790 | 832 | +42 | |
| apple-app/.../FlaskServiceSupervisor.swift | 380 | 500 | +120 | crossed 500 |
| app/dashboard/SatyaPresence.tsx | 0 | 663 | +663 | new UI >250 |
| app/dashboard/satya-client.ts | 0 | 533 | +533 | crossed 500 |
| app/dashboard/digest-mail-groups.tsx | 0 | 341 | +341 | dead |

No new import cycle found beyond retrieve→scripts (scripts do not import retrieve). `axis-categories.ts` re-exports `.mjs` (good). `source-catalog.ts` the same.

## ✅ What's good here

- **M-2 really replaced the digest walls in the running UI.** `IntelligenceWorkspace` is three sections and `DailyKanbanBoard` only on M-1. That matches AGENTS.md, not a rename.
- **Operator-Mac chat is defense in depth**, not a Host header check. Flask sets `X-Stratji-Local-Operator` from `remote_addr`; Next requires it on Flask hops.
- **Webinar default-exclusion is SQL**, with a passing corpus test, not a comment. Empty vs no-match copy follows the “do not ask to refresh mail on zero FTS hits” rule.

## ❓ Open questions for the author

1. Is `digest-mail-groups.tsx` kept as a deliberate hidden library for a future non-Intelligence surface, or is it leftover from the M-2 cutover?
2. Should companion-orb questions before the operator opens M-2 include the earnings family (briefing default chips include it; `getSatyaFocus()` starts `{}` so `wantEarnings` is false)?
3. Should `scripts/satya-backfill.sh` be part of `refresh-dashboard-data.sh`, or remain a manual 90-day job? Today the startup audit does not mention it.

## 📋 Follow-up tickets suggested

- Split `satya-corpus.mjs` and stop Next from importing backfill.
- Delete `digest-mail-groups.tsx` and retarget `rendered-html` to the M-2 canvas.
- Await or status-separate Axis PDF ingest.
- Multi-turn Satya: retrieve on the latest question only, or pass prior turns as non-evidence context.
- Stop monkey-patching `history` in `SatyaPresence`.

## Approval-bar table (INSTRUCTION 9.3)

| Bar | Met? |
|---|---|
| No clear structural regression | **No** — zombie digest module + retrieve→scripts |
| No obvious missed judo | **No** — split/delete path is visible |
| No unjustified file-size explosion | **No** — new file at 1024 |
| No spaghetti growth | **No** — digest walls + duplicated category switch |
| No hacky abstraction | Partial — History patch is hacky; FTS allowlist is boring (good) |
| No unnecessary wrapper/cast churn | Yes |
| No architecture-boundary leak | **No** — app imports scripts |
| No missed obvious decomposition | **No** |
| No unmitigated P0/P1 correctness/security | Partial — no P0; **P1 tests fail** |
| Tests for new behavior and the bug being fixed | Partial — corpus tests yes; satya-api red; rendered-html pins dead UI |

## Self-audit checklist (INSTRUCTION 12)

- [x] Cited `file:line` re-read in the files, not only diffs.
- [x] Every finding has a failure scenario or change-cost.
- [x] Pass A/B/C each have findings or explicit clean statements.
- [x] Judo verdict present and is not a rename.
- [x] 1000-line counts from `wc -l` / `git show \| wc`.
- [x] No formatter/lint nits.
- [x] Deduped; within noise budget (11 findings, 4 P1, 5 P2, 1 P3, 1 NOTE).
- [x] Severities per rubric; security not downgraded.
- [x] P0–P2 remedies sanity-checked against real modules (`isAxisResearchCategoryId` exists; `INTELLIGENCE_SOURCE_CANDIDATES` lists the zombie).
- [x] Pre-existing AppKit vs `origin/main` labeled inherited.
- [x] Verdict matches findings (no APPROVE with open P1).
- [x] Coverage stated; committed 73k-line AppKit history not claimed as fully re-read.
- [x] Tone aimed at code.
- [x] Genuine positives included.

`--fix` was not requested. No production code was modified, committed, or pushed.
