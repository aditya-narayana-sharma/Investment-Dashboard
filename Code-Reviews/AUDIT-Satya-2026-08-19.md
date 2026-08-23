# 🔍 AUDIT — Satya (uncommitted) · REQUEST CHANGES

## Remediations (recon 2026-08-19)

Reconciliation of backend `d62cc512`, native `a0ebd4b3`, and UI `479c0563`. Original findings below are unchanged.

| Original finding | Status |
| ---------------- | ------ |
| **[P1] No-match retrieval claims the corpus is empty** (`chat.ts`) | **Fixed.** Empty file/zero docs → `empty_corpus`. Populated corpus with zero FTS hits → `no_match` (no mail-refresh copy). Covered by `runSatyaChat` in `tests/satya-api.test.mjs`. |
| **[P1] Family filter after FTS `LIMIT 80`** (`satya-corpus.mjs`) | **Fixed.** Allowlisted `AND d.family IN (?,?,…)` is bound before `LIMIT 80`. Test: 81 newsletter hits + 1 podcast, `families: ["podcasts"]` returns the podcast. |
| **[P1] `IntelligenceDigest.tsx` >1000 lines + haystack classifier** | **Fixed.** File is **383 lines**. Grouping lives in `digest-newsletter-groups.ts`; untagged items call `classifySatyaFamily`. No `haystack.includes("axis")` matcher remains. |
| **[P1] Native PTT can start the mic after release** (Swift) | **Fixed.** `listenGeneration` + `wantsListening` on start/stop/cancel; `beginRecognition(generation:)` is skipped if the generation changed. Same gate in `speech.ts` / `speech-native.ts`. |
| **[P2] Two catalog builders will drift** | **Fixed.** `source-catalog.ts` re-exports `buildSatyaCatalog` from `source-catalog.mjs`; no TS clone of the builder. |
| **[P2] `SatyaPresence.tsx` protocol glued to two UIs** | **Fixed.** `satya-client.ts` owns `streamSatyaChat` / status / sources. SSE parser matches `{ event, data }` only (`SatyaPresence.tsx` 418 lines, `SatyaBriefingRoom.tsx` 212). |
| **[P2] `streamLocalLlm` is complete-then-chunk** | **Fixed for v1.** Emits one `onToken` with the full text. Provider HTTP streaming remains a follow-up. `chunkTextForSse` is unused by the live path. |
| **[P2] GET `/api/satya/sources` returns 90-day mail metadata** | **Fixed.** Response is `{ asOf, families }` (counts/labels only). Sender emails stay off the wire. |
| **[P2] Status/count opens the whole documents table** | **Fixed.** `countSatyaDocuments` is `SELECT COUNT(*) FROM documents`. |
| **[P2] Digest ingest failure is invisible** | **Fixed.** `recordSatyaIngestError` writes `corpus.ingestError`; `/api/satya/status` returns it and `stale: true`. Digest still succeeds. |
| **[P3] Axis MF subject match is unanchored** | **Fixed.** `AXIS_MF_SUBJECT_PREFIX` is `^` (optional Re/Fwd) Axis MF/AMC branding; mid-subject mentions from other senders stay `newsletter_other`. |
| **Presumptive: feature-check scatter / unused `classifySatyaFamily`** | **Fixed.** Digest grouping uses the canonical classifier; catalog `.ts` is a re-export. |
| **Presumptive: `empty_corpus` catch-all** | **Fixed.** See no-match row. |
| **Layout: move `scripts/satya-corpus.mjs` into `app/satya/`** | **Remaining (deferred).** Audit judo explicitly rejected this as a follow-up; 735-line SQLite module plus backfill CLI / digest ingest callers is a high-risk move, not a leftover bug. |
| **Follow-up: stream provider tokens** | **Remaining.** v1 chose a single token after complete. |
| **Follow-up: abort on `request.signal`** | **Fixed.** Chat route already passes `signal: request.signal` into `runSatyaChat`. |
| **Follow-up: `runSatyaChat` tests vs source-grep** | **Fixed for the P1s.** `tests/satya-api.test.mjs` executes `runSatyaChat` for empty vs no-match; family-window test is in `tests/satya-corpus.test.mjs`. Remaining source-grep is contract smoke, not a gap. |

Unrelated dashboard bug found while verifying claimed `thesisBullets is not defined` render failures: `InvestmentWorkspace.tsx` called `thesisBullets` with no import (pre-existing since `7d5cf5c`, not the IntelligenceDigest split). Import restored in this recon. Not a stale `dist` bundle.

**Scope:** DIFF mode, uncommitted Satya work only · dirty `AppKit` working tree · ~24 Satya-related files, ~+3.5k new source lines plus ~+538/−66 in existing files
**Coverage:** audited in full: `app/satya/`*, `app/api/satya/*`, `SatyaBriefingRoom.tsx`, `SatyaPresence.tsx`, `satya.css`, Satya scripts/tests, `flask_gateway.py` Satya proxy, `IntelligenceDigest.tsx` Satya grouping, `local-llm-assist.ts` / `local-llm-client.ts` Satya bits, Swift speech bridge + permissions, `AGENTS.md` Satya invariants. Sampled: `content-digest-server.mjs` ingest hook, `page.tsx` companion mount, Info.plist keys. Excluded by request: `AppDelegate.swift`, `FlaskServiceSupervisor.swift`, `native-launch-refresh.test.mjs`, appearance CSS (non-Satya).
**Assumptions:** Uncommitted work is the review surface (no merge-base Satya commits). Threat model is the documented one: Tailscale/LAN clients see the dashboard; chat/voice must stay author-Mac loopback.

## Verdict: **REQUEST CHANGES**

Satya is the right product shape — M-2 briefing + companion orb, two mailboxes, operator-only chat at both Flask and Next, empty-file refuse — but it is not mergeable as written. The retrieval path lies when FTS misses, family filters can drop the only relevant hits, family identity is implemented three different ways, and `IntelligenceDigest.tsx` just crossed 1000 lines. Passing unit tests are mostly classifier tables and source-grep; they would still pass after the bugs below.


| Dimension                 | Score      | Note                                                                                                                                      |
| ------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness & safety      | 5/10       | Empty-corpus lie; FTS family filter after LIMIT; native PTT continues after release                                                       |
| Security                  | 7/10       | Chat POST is correctly operator-gated (Flask + Next, LAN tests). GET sources/status expose 90-day catalog metadata to every paired client |
| Structural quality (judo) | 4/10       | Duplicate catalog `.ts`/`.mjs`; family matchers cloned into the digest UI; `SatyaPresence` is a protocol+UI blob                          |
| Layout & modularity       | 5/10       | `app/satya/` is the right home, then it imports `scripts/` and duplicates itself                                                          |
| Tests                     | 4/10       | 37 related tests pass; none execute `runSatyaChat`, the FTS family trap, or digest grouping fallbacks                                     |
| Legibility & docs         | 7/10       | AGENTS.md invariants are clear; SSE client over-parses a contract the server already types                                                |
| Operability               | 6/10       | Digest ingest failure is swallowed; count = load every SQLite row; backfill is 8×25 pages per run                                         |
| **Weighted**              | **5.3/10** |                                                                                                                                           |




## 🧨 Presumptive blockers

1. **1000-line rule** — `app/dashboard/IntelligenceDigest.tsx` **960 → 1079**. No waiver: the growth is feature logic that already has a home.
2. **Feature-check scatter** — Satya family identity now lives in `scripts/satya-classify.mjs`, `app/satya/source-catalog.ts`, `app/satya/source-catalog.mjs`, and a looser haystack in `IntelligenceDigest.tsx`.
3. **Ad-hoc branching in a busy flow** — `runSatyaChat` reuses `empty_corpus` for “FTS returned nothing,” which is a different failure.
4. **Canonical helper unused** — digest grouping does not call `classifySatyaFamily`; it reimplements a weaker matcher.



## 🥋 Code-judo assessment

**JUDO AVAILABLE** — one family module, one catalog builder, one chat client.

- Concepts today: classify (mjs) + catalog.ts + catalog.mjs + digest haystack + `SatyaPresence` SSE parser + `SatyaPresence` orb/sheet UI + `retrieve.ts` wrapping `scripts/satya-corpus.mjs`
- Proposed: `scripts/satya-classify.mjs` remains the classifier; delete `source-catalog.ts` and import `source-catalog.mjs` from retrieve; digest grouping calls `classifySatyaFamily` / `item.sourceFamily` only; split `app/satya/client.ts` (fetch/SSE) out of `SatyaPresence.tsx`
- What disappears: the `.ts` catalog clone, `resolveNewsletterFamily` haystack, dual SSE event-shape parsing, `empty_corpus` as a catch-all
- Behavior preserved: yes for grouping/classify if digest uses the canonical matcher · Effort: **DO IN THIS PR IF FEASIBLE** · Risk: low

Alternative considered and rejected: moving SQLite into `app/satya/` in this PR. Right direction, but it is a follow-up; the duplicate catalog files are the cheap win.

## Findings



### [P1] No-match retrieval claims the corpus is empty · `app/satya/chat.ts:273` · CONFIRMED

**What:** When FTS returns zero passages, chat emits `satyaRefusalMessage("empty_corpus")`.
**Why it matters:** Corpus has documents, user asks “zzzz-no-such-term” (already asserted to return `[]` in `tests/satya-api.test.mjs:88`). UI says: “The Satya corpus is empty or unavailable. I will not invent research. Refresh iCloud → Newsletters…” Operator then re-runs backfill for a miss, not an empty index. Same copy is used for a missing file (`chat.ts:249`), so the two states are indistinguishable.
**Evidence:**

```273:286:app/satya/chat.ts
  if (!passages.length) {
    const text = satyaRefusalMessage("empty_corpus");
    options.emit({ event: "token", data: { text } });
    // ...
    return { text, citations: [], provider: null, sessionId: session.id, refusal: "empty_corpus" };
  }
```

**Remedy:** Add `SatyaRefusalKind: "no_match"`. Copy: “No retrieved passage matched that question in the selected families. The extractive digest remains the source of truth.” Do not ask them to refresh mail. Behavior preserved: no (user-facing copy changes; correct). Effort: **DO NOW**. Test `runSatyaChat` with a one-doc corpus and a non-matching query.

### [P1] Family filter is applied after FTS `LIMIT 80` · `scripts/satya-corpus.mjs:354` · CONFIRMED

**What:** Search fetches 80 BM25 rows, then `.filter`s by `options.families` in JS.
**Why it matters:** Briefing chips default to all families, but the user can hold only `podcasts`. If 80 stronger newsletter hits occupy the FTS window, the podcast that actually answers the query never appears. Chat then hits the empty-corpus lie above. Companion (no family filter) is safe; briefing is not.
**Evidence:**

```354:376:scripts/satya-corpus.mjs
        WHERE documents_fts MATCH ?
        LIMIT 80
      `).all(match);
    // ...
    const scored = rows
      .filter((row) => !families.length || families.includes(row.family))
```

Existing tests insert one Axis doc and filter to `podcasts` (`tests/satya-api.test.mjs:89`) — that returns `[]` for the wrong reason (no podcast row), so they cannot catch this.
**Remedy:** Push family into SQL (`AND d.family IN (?,?,…)` with an allowlisted bind list from `SATYA_SOURCE_FAMILIES`). Then LIMIT. Behavior preserved: yes (strictly more correct). Effort: **DO NOW**. Test: 80+ newsletter hits + one podcast, `families: ["podcasts"]` must return the podcast.

### [P1] `IntelligenceDigest.tsx` crossed 1000 lines and grew a second family classifier · `app/dashboard/IntelligenceDigest.tsx:167` · CONFIRMED

**What:** File **960 → 1079**. New `resolveNewsletterFamily` ignores the canonical matcher when `sourceFamily` is missing (old snapshots) and uses `includes("axis") && includes("mutual")`, `/\bgroww\b/`, `/\bflipboard\b/` on `source + title`.
**Why it matters:** Catalog tests prove Groww IPO blasts and Flipboard non-tech must stay `newsletter_other`. The digest fallback puts them in the named groups. M-2 grouping then disagrees with Satya chips/retrieval. This is also the 1000-line presumptive blocker: the new logic does not belong in this file.
**Evidence:**

```193:215:app/dashboard/IntelligenceDigest.tsx
  const haystack = `${item.source} ${item.title}`.toLocaleLowerCase("en");
  if (haystack.includes("axis") && haystack.includes("mutual")) return "axis_mutual_fund";
  if (/\bgroww\b/.test(haystack)) return "groww_digest";
  if (/\bflipboard\b/.test(haystack)) return "flipboard_tech";
  return "newsletter_other";
```

**Remedy:** Ungrouped items call `classifySatyaFamily({ mailbox: "Newsletters", sender: item.source, subject: item.title })` from `satya-classify.mjs` (or a 20-line `app/satya/digest-families.ts` that only groups). Move `groupNewsletterItems` / `newsletterFamilyCounts` out of `IntelligenceDigest.tsx` so the file falls back under 1000. Behavior preserved: yes if grouping uses the canonical classifier (IPO/Flipboard culture stay Other). Effort: **DO IN THIS PR IF FEASIBLE**.

### [P1] Native push-to-talk can start the mic after the user released · `apple-app/Shared/StratjiSatyaSpeechBridge.swift:63` · CONFIRMED

**What:** `startListening` awaits TCC, then always calls `beginRecognition()` with no generation/cancel token.
**Why it matters:** First PTT hold opens the Speech/Mic prompt. User releases (JS posts `stop`) while the dialog is up. After grant, recognition starts and the engine keeps running until the next gesture. Voice is operator-Mac only; this is that path.
**Evidence:**

```63:77:apple-app/Shared/StratjiSatyaSpeechBridge.swift
        Task { [weak self] in
            let allowed = await Self.requestAccess()
            await MainActor.run {
                guard allowed else { ...; return }
                self.beginRecognition()
            }
        }
```

`stopListening` from the earlier `stop` message does not cancel this Task.
**Remedy:** `listenGeneration += 1` at start/stop; capture the generation in the Task; skip `beginRecognition` if it changed. Behavior preserved: yes. Effort: **DO NOW**.

### [P2] Two catalog builders will drift · `app/satya/source-catalog.ts` / `app/satya/source-catalog.mjs` · CONFIRMED

**What:** `buildSatyaCatalog` is copied (~90 lines) in TS and MJS. Tests import `.mjs`. `retrieve.ts` imports `.ts`.
**Why it matters:** The next catalog tweak will land in one file. Retrieve (API) and digest ingest (scripts) will disagree on sender status/counts.
**Remedy:** Delete the TS implementation; `retrieve.ts` already imports `scripts/satya-corpus.mjs` — import `buildSatyaCatalog` from `source-catalog.mjs` the same way. Keep `source-catalog.ts` only if it re-exports. Behavior preserved: yes. Effort: **DO NOW**.

### [P2] `SatyaPresence.tsx` is a protocol layer glued to two UIs · `app/dashboard/SatyaPresence.tsx:1` · CONFIRMED

**What:** 687-line client component owns SSE parsing (including a second event-shape dialect the server does not emit), status/sources fetch, speech binding, companion sheet, and briefing composer.
**Why it matters:** Next chat-contract change requires editing a React orb. `dispatchSatyaEvent` looks for `record.state` / `record.type` while the server sends `{ event: "status", data: { message } }` — it happens to fall through to `"thinking"`, which hides the mismatch.
**Remedy:** `app/satya/client.ts` for `streamSatyaChat` / `fetchSatyaStatus` / `fetchSatyaSources`. `SatyaPresence.tsx` only renders. Align the SSE parser with `SatyaSseEvent` — one shape. Behavior preserved: yes. Effort: **DO IN THIS PR IF FEASIBLE**.

### [P2] `streamLocalLlm` is complete-then-chunk, not a stream · `app/local-llm-client.ts:408` · CONFIRMED

**What:** Satya SSE waits for the full Claude/OpenAI/Gemini response, then emits 48-character slices.
**Why it matters:** After the “Drafting…” status event, the operator sees silence for the entire provider RTT, then a token flood. Flask’s 180s `urlopen` timeout is per socket op, so a slow first byte is OK, but the SSE contract is fake. Comment says “Provider HTTP streaming can replace the chunk step later” — that later is this feature’s UX.
**Remedy:** Either stream the provider or don’t call it a stream (single `token` with full text). Behavior preserved: visual timing changes. Effort: **FOLLOW-UP** unless chat feels broken in use.

### [P2] GET `/api/satya/sources` is ungated and returns 90-day mail metadata · `app/api/satya/sources/route.ts:8` · CONFIRMED

**What:** Catalog (senders, emails, 90-day counts) is JSON to any Flask client. Chat POST is operator-only; this GET is not. Status similarly returns corpus family counts.
**Why it matters:** M-2 digest already shows *recent* mail to Tailscale. This endpoint enumerates the *backfill* catalog, which the digest UI must not dump. Not a P0 given the private network, but it is a new PII surface the invariants did not authorize.
**Remedy:** Return family counts only (what the chips use), or gate the full catalog with `isLocalOperatorRequest`. Behavior preserved: chips still work. Effort: **DO NOW** for the counts-only response.

### [P2] Status/count opens the whole documents table · `app/satya/retrieve.ts:70` · CONFIRMED

**What:** `satyaCorpusDocumentCount` is `listSatyaDocuments(...).length`. Companion mount hits `/api/satya/status`, which calls this plus catalog-from-sqlite fallback (another full scan) plus `getSatyaMeta` (third `open/close`).
**Why it matters:** After 90-day backfill this is thousands of rows, three times, on every dashboard load. `catalogSeedsFromCorpus` already has the GROUP BY query; count should be `SELECT COUNT(*)`.
**Remedy:** `SELECT COUNT(*) FROM documents`. Behavior preserved: yes. Effort: **DO NOW**.

### [P2] Digest ingest failure is invisible · `scripts/content-digest-server.mjs:1318` · CONFIRMED

**What:** `ingestSatyaDigestRefresh` is try/catch `console.error`. Digest snapshot can be live while the corpus stays empty.
**Why it matters:** Chat then honestly refuses empty corpus while M-2 looks fine. No Satya stale flag, no catalog write, no audit row.
**Remedy:** Record ingest error on the content snapshot / Satya status (`corpus.ingestError`) so the briefing can show stale instead of “Grounded on the Satya corpus.” Behavior preserved: digest still succeeds. Effort: **FOLLOW-UP** if DO NOW is full; at least surface it on `/api/satya/status`.

### [P3] Axis MF subject match is unanchored, not a prefix · `scripts/satya-classify.mjs:101` · CONFIRMED

**What:** `matchesAxisMutualFund` is `nameOrDomain || subjectHit`. `AXIS_MF_SUBJECT` is unanchored `\baxis\s*(?:mutual fund|mf|amc)\b`. AGENTS.md says “subject prefix.”
**Why it matters:** A TLDR whose subject mentions Axis Mutual Fund becomes `axis_mutual_fund`. Groww/Flipboard require sender identity; Axis MF does not. De-escalated because the written invariant includes “subject prefix,” but the regex is not a prefix.
**Remedy:** Require sender/domain **or** `^`/`subject.startsWith` Axis MF branding. Behavior preserved: no. Effort: **FOLLOW-UP** unless you want the named family to be steal-proof in this PR.

## 📐 Metrics


| File                                   | Before | After | Δ    | Flag                               |
| -------------------------------------- | ------ | ----- | ---- | ---------------------------------- |
| `app/dashboard/IntelligenceDigest.tsx` | 960    | 1079  | +119 | **>1000 this PR**                  |
| `scripts/content-digest-server.mjs`    | 1762   | 1784  | +22  | already >1000; do not keep growing |
| `app/dashboard/SatyaPresence.tsx`      | 0      | 687   | +687 | new; over 250-line UI threshold    |
| `scripts/satya-corpus.mjs`             | 0      | 735   | +735 | yellow                             |
| `app/satya/chat.ts`                    | 0      | 343   | +343 |                                    |
| `flask_gateway.py`                     | 790    | 832   | +42  |                                    |
| `app/satya/source-catalog.ts`          | 0      | 120   | +120 | duplicate of `.mjs`                |
| `app/satya/source-catalog.mjs`         | 0      | 91    | +91  | canonical for scripts              |
| `tests/rendered-html.test.mjs`         | 2001   | 2050  | +49  | already >1000 (tests)              |


No new import cycle detected (`chat → retrieve → satya-corpus.mjs → source-catalog.mjs → classify`; digest UI does not import retrieve). `speech.ts` ↔ `speech-native.ts` is type-only. `app/` → `scripts/` is a layering leak, not a cycle.

## 🗺 Layout verdict

`app/satya/` + `app/api/satya/` is the right neighborhood and the companion lives on `page.tsx` without an M-5 tab. The map then lies: retrieval and catalog construction actually live under `scripts/`, with a TypeScript twin that Next uses. A stranger looking for “how do we classify a newsletter?” has four answers. After this change the repo is **harder** to navigate for Satya than a single classify+corpus module with thin route wrappers would have been.

## ✅ What's good here

- Operator chat is gated twice (`flask_gateway.py` `_operator_only_proxy` + `isLocalOperatorRequest` on the Next route) and LAN/paired-iPhone POST is tested.
- Backfill JXA pins `exactMailbox(..., "Newsletters"|"Axis Research")` — no third mailbox in that path. Podcasts are ingest-only supporting evidence.
- Empty *file* refuse, machine-drafted labeling, workspace numeric stripping, and “no M-5” are real and tested at the source-grep / classifier level.
- Exhaustive `switch` on refusal kinds and presence states.



## ❓ Open questions for the author

- Is fake SSE (complete-then-chunk) an accepted v1, or did you intend provider streaming before merge?
- Should `/api/satya/sources` ever return sender emails to Tailscale, or only family counts?
- Is Axis MF allowed to match on subject alone (current code) or only sender/domain + true prefix (AGENTS.md wording)?



## 📋 Follow-up tickets suggested

- Stream Claude/OpenAI/Gemini tokens instead of `chunkTextForSse`
- Move `scripts/satya-corpus.mjs` into `app/satya/` and leave a `scripts/` re-export for the backfill CLI
- Wire `request.signal` on the chat ReadableStream so abort cancels the provider call
- Replace source-grep “contract” tests with `runSatyaChat` + a fake `streamLocalLlm`

