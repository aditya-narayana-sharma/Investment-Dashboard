# RCA Report — Stratji / Investment Dashboard LLM pipeline (Satya M-2 + companion)

**Date:** 2026-08-20 · **Audit time:** 17:20 IST (Asia/Kolkata) · `healthTargetDate` window **D_MINUS_1** (target **2026-08-19**)
**Mode:** Snapshot + dirty-tree RCA of the **entire LLM pipeline**. Read-only. No production code edits, commits, pushes, restarts, or private payloads published. Flask on `:5050` (PID 41814) was left running.
**Triggering incident:** Operator screenshot ~17:07 IST — Satya status “Drafting..” then red:

`LLM call failed (Claude HTTP 401 authentication_error; OpenAI HTTP 403 model_not_found; OpenAI HTTP 400 context_length_exceeded). Existing non-LLM digest, scores, and trees are`

(~38 repeated source icons: mail, Axis PDFs, podcasts, earnings). Badge-counts-per-category is a related UX defect, **not** the root cause of the three HTTP errors.
**Related prior RCA (architecture, morning):** `RCAs/RCA-2026-08-20.md` — Satya merge/ingest/test-theater. This document is the **LLM cascade** incident.
**In-flight remediations:** another agent may be landing skip-cloud + pack-context + badge counts on the dirty tree. Those edits are noted as **working-tree vs live vinext**. They do not change what failed at 17:07–17:08.

---

## Executive diagnosis

- **Current health:** `Degraded` (Satya drafting outage on large/survey turns; source-backed digest, scores, trees, and corpus unchanged)
- **Highest severity:** **P1** — M-2 / global companion cannot complete a retrieved-passage draft when the only callable model is `gpt-3.5-turbo` (16k window) and the prompt is a survey-sized retrieve
- **Confirmed root causes:**
  1. Stored Anthropic key is rejected (`HTTP 401 authentication_error`) on `claude-sonnet-4-6`. Availability still reports “Machine-drafted via Claude” because it only checks that a key **exists**.
  2. Stored OpenAI key is not entitled to `gpt-4.1-mini`, `gpt-4o-mini`, or `gpt-4o` (`HTTP 403 model_not_found` for each). Hardcoded `OPENAI_MODELS` prefers those IDs first.
  3. The only OpenAI model that key can call is `gpt-3.5-turbo`. Survey retrieve (up to 96 × ~900-char excerpts) exceeds its 16 385-token window → `HTTP 400 context_length_exceeded`. Smaller prompts earlier the same day **succeeded** on that model (`ok: true` × 29 in `vinext.log`).
  4. On-device Ollama did not save the turn: daemon is **not listening** on `127.0.0.1:11434`, `configured` does not include Ollama, and the **live** cascade never attempted Ollama (`vinext.log` has **zero** `Ollama` strings; `ok: false` attempts stop at `gpt-3.5-turbo`).
- **Affected workspaces:** Market Intelligence **M-2 Satya** (primary), global Satya companion (all six workspaces), plus companion `/api/llm/complete` slots (Investment composite, S-2 industry, S-3 framework, M-3 summarize, Algorithm Canvas builder, Strategies). Non-LLM KPI math, Kanban, S-2 isolation, and M-3 earnings grid are **not** the failing layer.
- **Data current through:** Incremental refresh **17:05:53 IST** — Kite **live**, Mail+Podcasts **live**, Earnings **verified**, Sectors **live**. Health **stale** (`dataDate=2026-08-18` vs required **2026-08-19**). **Complete dashboard is not current.** Satya corpus **501** documents (not empty; this was not an empty-corpus refusal).
- **Main residual risk:** Working-tree remediations (pack + operator-safe copy + always-append Ollama + citation badges) are **not what the 17:07 screenshot showed**. Live vinext last wrote `[llm-complete] ok: false` at **17:08:08** with **no Ollama attempt**. Until keys are rotated, model IDs match the key, packing is in the **running** process, and Ollama is actually up, large Satya asks keep dying on `gpt-3.5-turbo`.

---

## Parent summary (incident)

| Question | Answer |
|---|---|
| Actual root of **Claude HTTP 401** | `api.anthropic.com` rejected the stored key as `authentication_error` on first model `claude-sonnet-4-6`. Auth failures skip the rest of Claude. This is a **dead key**, not a Satya retrieve bug. Anthropic uses 404 for unknown models — 401 is the key. |
| Actual root of **OpenAI HTTP 403** | Same OpenAI key returned `model_not_found` for `gpt-4.1-mini`, then `gpt-4o-mini`, then `gpt-4o`. The account/project does not serve those IDs. 403 is treated as “missing model” so the cascade continues. |
| Actual root of **OpenAI HTTP 400** | After the three 403s, `gpt-3.5-turbo` is the leftover model (16k context). Satya had already retrieved a large passage set (citations painted ~38 unique URLs) and sent that prompt + reserved `max_tokens`. OpenAI returned `context_length_exceeded`. Earlier **short** turns the same day succeeded on `gpt-3.5-turbo` (`ok: true` after the same 401+403 prefix). |
| Why local didn’t save the turn | Ollama is **down** (`curl 127.0.0.1:11434` connection refused). Status `configured` = `OpenAI, Claude, Cursor` — no Ollama. Live `completeLocalLlm` **never called** Ollama (attempts array ends at `gpt-3.5-turbo`). Cursor keys are stored-only and never complete. `runSatyaChat` **throws without `persistSatyaSession`** on LLM failure. |
| Pipeline map | See **LLM pipeline map** below. |
| This RCA file | `/Users/adityasharma/Documents/GitHub/Investment Dashboard/RCAs/RCA-2026-08-20-LLM-Pipeline.md` |
| Implementation plan | `/Users/adityasharma/Documents/GitHub/Investment Dashboard/Plans/PLAN-2026-08-20-LLM-Pipeline-Remediation.md` |

---

## Five Whys

1. **Why did Satya turn red with that exact sentence?**  
   `completeLocalLlm` exhausted Claude + every OpenAI model ID, then returned `formatLlmFailureMessage(attempts)` as the SSE `error` payload. The client put that string in `.satya-briefing-error`. The trailing “unchanged.” is CSS-truncated. The sentence is leftover copy from `/api/llm/complete` (digest/scores/trees) — **not** a dump of digest bullets as the answer, but it **looks** like digest-fallback copy.

2. **Why was Claude first and why 401?**  
   Preference order is Claude → OpenAI → Gemini → (working-tree) Ollama. A Claude key is present, so it is preferred. `GET /api/satya/status` reports `provider: "Claude"` and `enabled: true` without probing the vendor. The vendor said 401.

3. **Why three OpenAI 403s before a 400?**  
   `OPENAI_MODELS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]`. `isMissingModel` treats 403 as “try next id”. The key cannot use the first three. Unique formatter collapses three 403s into one `OpenAI HTTP 403 model_not_found`.

4. **Why did `gpt-3.5-turbo` 400 only on this turn?**  
   Broad/survey retrieve budget is `limit: 96`, `excerptMax: 900`. Citations SSE-emit **before** packing. ~38 unique mail/pdf/podcast/earnings URLs match a large retrieve. 96 × ~900 chars ≈ 20k+ tokens, over the 16k window once `max_tokens` is reserved. Narrow questions earlier succeeded on the same leftover model.

5. **Why didn’t Ollama (or a packed retry) save it?**  
   No Ollama process, no `OLLAMA_MODEL` in configured providers, live cascade did not append Ollama. Working-tree `completionProvidersInPreferenceOrder` now always pushes Ollama, but that is **not** what `vinext.log` recorded at 17:08. Packing (`packSatyaPassages`, 14 000-char cap) exists in the dirty tree and in tests; the 400 proves the **running** prompt still overflowed 16k.

**Root cause (the condition that must change):** Completions treat “a cloud key exists” as “a working long-context model exists.” The cascade prefers a dead Claude key and three GPT-4-family IDs this OpenAI key cannot call, then sends a survey-sized Satya prompt to `gpt-3.5-turbo` with **no live on-device fallback**. Availability UI lies. Failures are rendered as an HTTP collage plus a citation icon wall on an empty “Drafting…” bubble.

---

## Findings (severity order)

### [P1] Satya draft cascade died: Claude 401 → GPT-4 family 403 × 3 → gpt-3.5-turbo 400; Ollama never ran

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** Market Intelligence → M-2 Satya → `POST /api/satya/chat` SSE · global companion
- **Symptom:** Red alert with the three HTTP clauses; empty assistant bubble stays “Drafting…”; ~38 source icons already painted.
- **Reproduction:** `~/Library/Logs/PortfolioIntelligence/vinext.log` last write **2026-08-20 17:08:08**. Three identical `ok: false` blocks. Same attempt list each time.
- **Observation/evidence:** Live `GET /api/satya/status` (operator Mac): `enabled: true`, `provider: "Claude"`, `configured: ["OpenAI","Claude","Cursor"]`, corpus `documentCount: 501`. `curl 127.0.0.1:11434/api/tags` **connection refused**. Flask `:5050` upstream `:3000` **200**. Log: `ok: true` 29 times (same 401+403 prefix, then `gpt-3.5-turbo` succeeded); `ok: false` 3 times (adds `gpt-3.5-turbo` 400). **Zero** Ollama log lines.
- **Proximate mechanism:** `completeLocalLlm` loops `completionProvidersInPreferenceOrder`, records attempts, returns failure message. `runSatyaChat` emits SSE `error` and **throws** (no session persist).
- **Root cause:** Key/model entitlement mismatch + survey prompt vs 16k leftover model + no live Ollama.
- **Trigger:** Operator Satya ask ~17:07 IST after retrieve painted many citations (survey/all-chips style).
- **Contributing factors:** Availability does not probe; hardcoded model IDs; `voice: true` hardcoded on written M-2 (changes budget/prompt, not the 401/403); vinext `ERR_STREAM_UNABLE_TO_PIPE` on SSE; dirty-tree vs production `vinext start`.
- **User impact:** Satya cannot answer large grounded asks. Operator sees vendor errors as if they were research. Source-backed digest/scores/trees correctly unchanged.
- **Corrective action:** See plan Phases 0–4. Rotate/replace Claude key; align OpenAI model IDs to what the key can call **or** stop calling dead IDs; pack prompt to the **actual** model window; run Ollama with `OLLAMA_MODEL` **or** skip cloud when Ollama is healthy; operator-safe SSE copy; badges not icon walls.
- **Verification:** Repeat the same survey prompt. Expect a machine-drafted answer **or** `Satya could not draft (…)` with **no** HTTP collage, **no** digest-fallback sentence, citations as 4 counted badges. `vinext.log` must show either a successful provider or an **Ollama** attempt.
- **Code:** `app/local-llm-client.ts:33-34,177-196,212-224,482-548` · `app/satya/chat.ts:229-236,466-492` · `app/local-llm-secrets.ts:211-225,227-255`
- **Source:** `vinext.log` 30733–30936 · status API 17:20 IST · Flask health `upstreamStatus: 200`

### [P1] Availability lies: “Machine-drafted via Claude” while Claude is 401

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** M-2 status line · `GET /api/satya/status` · `GET /api/llm/complete`
- **Symptom:** UI and API say Claude is the provider. Every live complete starts with Claude 401.
- **Root cause:** `llmAssistAvailability` / `selectPreferredLocalLlmProvider` only test `Boolean(anthropicApiKey)` (length ≥ 8, not placeholder). No vendor probe, no circuit breaker after 401.
- **Corrective action:** After 401/invalid_api_key, mark Claude unusable for the process (or until Settings save). Status must not prefer a known-dead provider. Probe is optional; **sticky skip after first 401** is enough.
- **Verification:** Status after a failed turn must not still claim Claude if the last Claude attempt was 401.
- **Code:** `app/local-llm-secrets.ts:196-255` · `app/api/satya/status/route.ts:9-28`

### [P1] Hardcoded OpenAI IDs burn three 403s before the only callable model

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** All `completeLocalLlm` callers (`/api/satya/chat`, `/api/llm/complete`, tests)
- **Symptom:** Every complete logs `gpt-4.1-mini` 403, `gpt-4o-mini` 403, `gpt-4o` 403, then `gpt-3.5-turbo`.
- **Root cause:** `OPENAI_MODELS` assumes a full GPT-4o/4.1 catalog. This key’s project only serves `gpt-3.5-turbo` (evidenced by 29 successful fallbacks).
- **Corrective action:** Prefer models the account listed (or a Settings allowlist). Remember `model_not_found` per key fingerprint for the process. Do not lead with `gpt-4.1-mini` if it 403s every call.
- **Verification:** Next complete logs at most **one** 403 per unknown id per process, then the working model (or Ollama).
- **Code:** `app/local-llm-client.ts:34,182-196,354-374`

### [P1] Survey retrieve + leftover 16k model = `context_length_exceeded`; packing is working-tree, not proven live

- **Status:** Confirmed (overflow) · Probable (live bundle lacked effective packing)
- **Confidence:** High / Medium on bundle drift
- **Affected:** `retrieveSatyaPassages` + `buildSatyaUserPrompt` + OpenAI `max_tokens`
- **Symptom:** 400 only on large citation sets; small asks OK on `gpt-3.5-turbo`.
- **Root cause:** Broad survey budget `limit: 96`, `excerptMax: 900` vs `gpt-3.5-turbo` 16 385 tokens. `satyaGenerationBudget` can reserve 2048 / 4096 / 8192 output tokens, shrinking the input ceiling further. Working tree adds `packSatyaPassages` (14 000-char cap) **after** citation emit; live 400 means the prompt that hit OpenAI still overflowed.
- **Corrective action:** Pack **before** the vendor call using the **selected model’s** input window minus `max_tokens`. Never send 96×900 to a 16k model. Cap `max_tokens` per model (3.5-turbo output cap is 4096; requesting 8192 is itself unsafe).
- **Verification:** Packed prompt token estimate + `max_tokens` < model context. Regression test already in `tests/satya-api.test.mjs` (`packSatyaPassages keeps category coverage under the documented input cap`).
- **Code:** `app/satya/retrieve.ts:176-289,349-404` · `app/satya/chat.ts:229-236,460-483`

### [P1] Failed LLM turns are not persisted; empty bubble + pre-emitted citations look like a broken answer

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** M-2 transcript · companion thread · `sessions.json`
- **Symptom:** “Drafting…” stays; icons remain; error is a separate red `<p>`. `streamSatyaChat` still calls `onDone` if SSE has no `done` event (`sawDone` false), which can race `onError` into `speaking`.
- **Root cause:** Citations emit before `streamLocalLlm`. Failure path throws. Client `onError` does not write the error into the assistant turn or clear citations.
- **Corrective action:** Emit citations with `done` (or only packed citations). On error, set assistant text to operator-safe copy **or** drop the empty bubble. Do not call `onDone` after `error`. Do not `speech.speak` the error collage.
- **Verification:** Failed turn shows one operator-safe sentence, four badges max, no “Drafting…”, no spoken HTTP codes.
- **Code:** `app/satya/chat.ts:460-492` · `app/dashboard/satya-client.ts:313-334` · `app/dashboard/SatyaBriefingRoom.tsx:162-209,316-329`

### [P2] Written M-2 always sends `voice: true`

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** `SatyaBriefingRoom.run` · companion `submitPrompt`
- **Symptom:** Keyboard asks use spoken prompt rules and `maxTokens: 2048`, not written 4096/8192.
- **Root cause:** Hardcoded `voice: true` instead of the push-to-talk flag.
- **Corrective action:** `voice: true` only for PTT / `satyaSpeech` final. Written composer `voice: false`.
- **Verification:** Network payload for “Ask Satya” has `voice: false`. PTT has `voice: true`.
- **Code:** `app/dashboard/SatyaBriefingRoom.tsx:169` · `app/dashboard/SatyaPresence.tsx:483`

### [P2] Citation icon wall (~38 repeats) — related UX, not the HTTP root

- **Status:** Confirmed as UX · **In-flight** badge helper exists in dirty tree
- **Confidence:** High
- **Affected:** M-2 citation strip
- **Symptom:** One icon per unique URL from `compactCitationLinks`. Survey retrieve → dozens of mail/pdf/podcast/earnings icons.
- **Root cause:** Citations are per-document; UI was per-link, not per-kind counts. Working tree `citationSourceBadges` + `SatyaCitationIcons` collapse to four badges — **if the running client bundle includes that file**.
- **Corrective action:** Keep badges; do not emit 96 citation SSE events if the UI only needs counts + first href. Optional: emit packed citations only.
- **Verification:** Failed or successful survey turn shows ≤4 badge controls with counts, not ~38 icons.
- **Code:** `app/dashboard/satya-client.ts:148-203` · `app/dashboard/satya-citation-icons.tsx:28-77`

### [P2] Vinext SSE `ERR_STREAM_UNABLE_TO_PIPE` during Satya chat

- **Status:** Confirmed in log · Possible contributor to truncated “are”
- **Confidence:** Medium
- **Affected:** `vinext start` production server piping Flask-proxied SSE
- **Symptom:** Many `Cannot pipe to a closed or destroyed stream` stacks around LLM completes.
- **Root cause:** Client abort / Flask stream close while vinext still pipes the Web Response.
- **Corrective action:** Treat abort as normal; do not fail the process. Ensure Flask 180s timeout covers survey `timeoutMs` 90–150s **plus** cloud 403 storms (those are fast).
- **Code:** Flask `UPSTREAM_TIMEOUT_SECONDS = 180` (`flask_gateway.py:26`) · vinext prod-server (dependency)

### [P2] Companion workspace tasks share the same broken cascade via `/api/llm/complete`

- **Status:** Confirmed mechanism · Not the 17:07 screenshot (that was Satya SSE + citation wall)
- **Confidence:** High
- **Affected:** Investment I-2 composite comments · S-2 industry · S-3 framework · M-3 summarize · Builder tree JSON · Strategies notes
- **Symptom:** Same Claude→OpenAI loop. Builder parse failures would 422 without applying a tree (fail-closed — good).
- **Root cause:** Single `completeLocalLlm`.
- **Corrective action:** Same key/model/Ollama fixes. Do not route M-2 corpus chat through `/api/llm/complete`. Do not paste digest walls into Satya chat on LLM failure (currently it does **not**; keep that).
- **Code:** `app/api/llm/complete/route.ts` · `app/dashboard/satya-client.ts:477-535` · `app/dashboard/satya-workspace.ts`

### [P3] Podcast digest summarizer is a **separate** cloud path (`scripts/local-llm-generate.mjs`)

- **Status:** Confirmed as another LLM caller
- **Confidence:** High
- **Affected:** Mail/Podcast refresh, not M-2 chat
- **Symptom:** First callable key wins; OpenAI body uses **only** `gpt-4.1-mini` (no 3.5 fallback). A 403 there would fail podcast LLM summaries while extractive digest remains source of truth.
- **Corrective action:** Reuse `completeLocalLlm` or the same model allowlist. Never treat summarizer output as KPI source.
- **Code:** `scripts/local-llm-generate.mjs:116-165` · `scripts/podcast-summarizer.mjs`

### [P3] Cursor key is stored and listed in `configured` but never completes

- **Status:** Confirmed (by design)
- **Confidence:** High
- **Affected:** Integrations Settings · status `configured`
- **Root cause:** Cursor is not a `CallableLlmProvider`. Operators may think Cursor would save Satya.
- **Corrective action:** Status copy: “Cursor stored; completions need Claude/OpenAI/Gemini/Ollama.” Already partially in `llmAssistAvailability` when Cursor is the **only** key; not when Claude+OpenAI are also present.
- **Code:** `app/local-llm-secrets.ts:206-218,239-246`

---

## Scope and baseline

- **Project root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`
- **Canonical runtime:** Flask `127.0.0.1:5050` → vinext `127.0.0.1:3000` (`vinext start`). Flask PID **41814** left running.
- **Branch/commit:** `AppKit` @ `cbb3356e846eabd64f713bec4c6431e81a8fec72` + **dirty tree** (Satya/LLM uncommitted)
- **Comparison baseline:** Working tree vs live vinext log vs `HEAD` (pre-Satya). Marked snapshot audit.
- **Audit time:** 2026-08-20 17:20 IST
- **URLs:** `http://127.0.0.1:5050/?view=intelligence&section=m2` (operator). LAN/Tailscale `POST /api/satya/chat` is 403 by Flask `_operator_only_proxy` + Next `isLocalOperatorRequest`.
- **Private-data handling:** No keys, mail bodies, health values, or sender emails in this report. Status booleans and family **counts** only.
- **Excluded/unavailable:** Did not rotate keys or start Ollama. Did not rebuild vinext. Did not claim Health/Kite/Mail “current” as a complete dashboard. Screenshot pixels not attached.

**In-flight (dirty tree, do not treat as live-verified):**

| Working-tree change | Live 17:08 evidence |
|---|---|
| `packSatyaPassages` / 14k char cap | `gpt-3.5-turbo` still 400 → running prompt overflowed 16k |
| `formatSatyaLlmOperatorMessage` as `completeLocalLlm` `message` | Screenshot is `formatLlmFailureMessage` (HTTP collage + digest/scores/trees sentence) |
| Always-append Ollama in `completionProvidersInPreferenceOrder` | Attempts array has **no** Ollama |
| `citationSourceBadges` in `SatyaCitationIcons` | Operator saw ~38 repeated icons |
| Corpus split (`satya-store` / `app/satya/search.mjs`; barrel `satya-corpus.mjs` 28 lines) | Orthogonal to this HTTP failure; morning architecture RCA |

---

## LLM pipeline map (as designed vs as failing)

```
Operator Mac (localhost Flask)
  SatyaBriefingRoom / SatyaPresence
    voice: true  (written composer incorrectly)
    streamSatyaChat → POST /api/satya/chat
      Flask: loopback ⇒ X-Stratji-Local-Operator: 1
             LAN/Tailscale ⇒ 403 operator-only
      Next: isLocalOperatorRequest
            readLocalLlmSecrets (integrations-config / .env / process env)
            llmAssistAvailability  → enabled because Claude+OpenAI keys exist
            runSatyaChat
              topic refuse | empty corpus | retrieve
              SSE citation × N     ← painted ~38 icons HERE (before LLM)
              status "Drafting from retrieved passages…"
              packSatyaPassages    ← working tree; live overflow says pack didn't save 16k
              streamLocalLlm = completeLocalLlm then fake-chunk SSE
                Claude claude-sonnet-4-6     → 401  SKIP provider
                OpenAI gpt-4.1-mini          → 403  next model
                OpenAI gpt-4o-mini           → 403  next model
                OpenAI gpt-4o                → 403  next model
                OpenAI gpt-3.5-turbo         → 400  SKIP provider (context)
                Gemini                       → not configured
                Ollama                       → LIVE: not attempted; HOST: nothing on :11434
              !ok → SSE error + throw (no persist)
              ok  → persist sessions.json + SSE done

Companion on I/S/B/Y workspaces:
  completeSatyaWorkspaceTask → POST /api/llm/complete
    same completeLocalLlm (no Satya retrieve; uses task context string)

Podcast digest (refresh, not chat):
  scripts/podcast-summarizer.mjs → configuredCloudLlm
    Claude sonnet-4-20250514 OR OpenAI gpt-4.1-mini only (no 3.5 cascade)
```

**Operator-Mac-only:** Flask `_operator_only_proxy` for `POST api/satya/chat`, `POST api/llm/complete`, `GET api/satya/sessions`. Next also gates those. LAN/Tailscale can `GET /api/satya/status` (enabled false, message “author Mac”) and `GET /api/satya/sources` (counts, no sender emails).

**Empty corpus vs no_match (not this incident):** corpus 501 docs. Empty → refuse + ask to refresh mailboxes. No FTS hits → no_match, do **not** ask to refresh mail. Numbers only from passages. Webinars classified/indexed, default retrieve **off** (`live_webinars.defaultRetrieve: false`). Two mailboxes only; Axis MF subject matcher is `^` prefix.

---

## Comprehensive findings table

| Workspace | Section | Sub-Section | Function/File Name | Identified Problem | Root Cause | Proposed Solution |
|---|---|---|---|---|---|---|
| Market Intelligence | M-2 Satya | SSE chat | `runSatyaChat` `app/satya/chat.ts` | Drafting then red HTTP collage; no saved answer | LLM cascade total failure; error path throws; citations already emitted | Operator-safe error; persist or clear bubble; citations with `done` / badges only |
| Market Intelligence | M-2 Satya | Composer | `SatyaBriefingRoom.tsx:169` | Written asks flagged `voice: true` | Hardcoded flag | Pass `voice` only from PTT |
| Market Intelligence | M-2 Satya | Citations | `compactCitationLinks` / `SatyaCitationIcons` | ~38 repeated icons | Per-URL icons; SSE one event per passage | `citationSourceBadges` (in-flight); emit packed set |
| Market Intelligence | M-2 Satya | Status | `GET /api/satya/status` | Says Claude while Claude 401s | Presence-of-key ≠ valid key | Circuit-break 401; status from last probe |
| Market Intelligence | M-1 | Action Board | `buildIntelligenceDailyActions` | Not the incident | Source-backed actions, not LLM | Keep; never fill from failed Satya text |
| Market Intelligence | M-3 | Earnings | `IntelligenceEarnings.tsx` companion `task: summarize` | Same cloud cascade if operator uses companion | `/api/llm/complete` shares `completeLocalLlm` | Same key/model/Ollama fix; KPIs stay IR/NSE |
| All six | Global companion orb | Chat | `SatyaPresence.tsx` `streamSatyaChat` | Same 401/403/400 | Same cascade | Same; don’t speak errors |
| All six | Global companion orb | Workspace assist | `completeSatyaWorkspaceTask` | Composite/industry/framework/builder/strategy share cascade | Single client | Keep fail-closed on trees; don’t invent scores |
| Investment | I-2 | Composite comments | `InvestmentWorkspace.tsx` `useSatyaTaskContext` `composite` | Comments can 502; scores must stay | LLM must not write KPIs | Already instructed; keep UNCHANGED **out of Satya chat copy** |
| Sectoral Analytics | S-2 | Industry assist | `SectoralAnalytics.tsx` `industry` | Same | Same | S-2 snapshot only; no Mail |
| Sectoral Analytics | S-3 | Framework assist | `SectorDecisionLab.tsx` `framework` | Same | Same | Local S-3 selector; no S-2 leak |
| Algorithm Canvas | Canvas | Builder JSON | `SymphonyEditor.tsx` `builder` | Invalid tree 422; canvas unchanged (good) | Parse fail-closed | Keep; NSE symbols only |
| Strategies | Library | Notes | `StrategiesWorkspace.tsx` `strategy` | Same cascade | Same | No invented backtest KPIs |
| My Feed | H-1–H-4 | Health | `classifySatyaRefusal` health | Out of scope (refuse) | By design | Keep refuse → My Feed; Health still **stale** D-1 |
| Integrations | Settings | LLM keys | `IntegrationsWorkspace.tsx` | Keys stored; Claude 401 / OpenAI 4.x 403 | No validation ping | Save-time dry-run; show last error type only |
| Runtime | Flask | Operator gate | `flask_gateway.py:351-374,402-420,788-826` | Correctly blocks LAN POST chat | TCP remote_addr, not Host | Keep |
| Runtime | vinext | SSE pipe | prod-server + `ERR_STREAM_UNABLE_TO_PIPE` | Stream errors around chat | Client/gateway close vs pipe | Swallow abort; don’t crash |
| Runtime | Ollama | `:11434` | `ollamaOrigin` / `resolveOllamaModels` | Local did not save | Daemon down; live cascade didn’t call it | Start Ollama + `OLLAMA_MODEL`; always try last **in the running process** |
| Ingest | Digest refresh | Podcast LLM | `podcast-summarizer.mjs` / `local-llm-generate.mjs` | Separate first-key-wins; OpenAI only `gpt-4.1-mini` | Duplicate client | Share allowlist; extractive digest remains SoT |
| Retrieve | Corpus | FTS | `app/satya/search.mjs` | Not the HTTP failure; 501 docs | — | Keep two-mailbox, webinar default-off, empty vs no_match |
| Retrieve | Pack | `packSatyaPassages` | Working-tree cap 14k chars | Live 400 ⇒ pack not effective in process that ran | Pack to **model** window; rebuild/reload vinext |
| Contracts | Axis MF | Prefix | `satya-classify.mjs:42-43,103-110` | Not this incident | `^` prefix + name/domain; no third mailbox | Keep |
| Leftover | Interrogate LLM | UI | `LlmAssistPanel.tsx` deleted; tests `doesNotMatch(/Interrogate LLM/)` | Not reproduced | Product moved to Satya | Keep negative tests |

---

## Change map

| Change group | Files | Affected surfaces | Risk | Tests |
|---|---|---|---|---|
| Uncommitted Satya/LLM | `app/satya/*`, `app/api/satya/*`, `app/local-llm-*.ts`, `app/dashboard/Satya*.tsx`, `satya-client.ts` | M-2, companion, chat APIs | P1 live drafting | `tests/satya-api.test.mjs`, `local-llm-assist.test.mjs` **42/42 pass** (working tree) |
| In-flight pack/badges/operator copy | `retrieve.ts`, `satya-citation-icons.tsx`, `local-llm-client.ts` | Prompt size, UX, SSE error text | Live vinext **behind** | Pack + badge + operator-safe tests exist |
| Flask operator SSE | `flask_gateway.py` | Mac-only POST chat | Correct | `tests/test_flask_gateway.py` |
| Deleted Interrogate panel | `app/dashboard/LlmAssistPanel.tsx` | No M-2 leftover wall | Low | `rendered-html` forbids Interrogate LLM |
| Runtime/private | `artifacts/private/satya/corpus.sqlite`, integrations-config (not read for secrets) | Corpus 501 | Do not publish | — |
| Ops freshness | startup-refresh.log 17:05:53 | Health stale D-1 | Unrelated to HTTP 401/403/400 | — |

---

## Workspace and section coverage (LLM surfaces)

| Workspace | Section | Children | Collapsible | LLM role | Result |
|---|---|---|---|---|---|
| Intelligence | M-1 | DailyKanbanBoard | yes | None (source-backed actions) | Not this incident |
| Intelligence | M-2 | SatyaBriefingRoom + chips + PTT | yes | **Primary chat retrieve→LLM** | **P1 fail 17:07** |
| Intelligence | M-3 | Earnings calendar | yes | Companion `summarize` only | Grid not LLM |
| Investment | I-1–I-4 | Kanban, portfolio, risk, Axis picks | yes | Companion `composite` | Scores not LLM |
| Sectors | S-1–S-3 | Kanban, analytics, decision lab | yes | Companion `industry` / `framework` | Filter isolation unchanged |
| My Feed | H-1–H-4 | Kanban, optimism, vitals, calendar | yes | Satya **refuses** vitals | Health snapshot **stale** |
| Builder | board/canvas/json | Kanban, Symphony, JSON | yes | Companion `builder` JSON | Fail-closed on parse |
| Strategies | y1/y2 | Kanban, library | yes | Companion `strategy` notes | No invented backtests |

Desktop/iPhone: LLM POST is operator-Mac only. iPhone/Tailscale cannot trigger this cascade (403). Citation wall is Mac M-2.

---

## Rendering and interaction (incident)

| Surface | Desktop (Mac) | iPhone / Tailscale | Console/API | Finding |
|---|---|---|---|---|
| M-2 composer | Drafting… then red alert | Chat POST 403 | SSE `error` + citations first | P1 |
| Citation strip | ~38 icons (screenshot) | N/A | One SSE `citation` per passage | P2 related |
| Error copy | HTTP collage + truncated UNCHANGED | N/A | `formatLlmFailureMessage` | Must not look like a research answer |
| Companion orb | Same cascade | Blocked POST | `/api/llm/complete` 403 off-loopback | P2 |
| Charts/KPI tiles | Unchanged | Unchanged | Non-LLM | Matches “digest, scores, and trees are unchanged” **factually**, wrong **UX copy for Satya** |

---

## Source freshness ledger (do not call the complete dashboard current)

| Source | Required-through | Observed-through | Ingested-at | Status | Evidence | Gap |
|---|---|---|---|---|---|---|
| Kite | live session | 17:05:53 IST live authenticated | startup-refresh incremental | live | log line 144 | none this tick |
| Mail Newsletters + Axis Research | live both mailboxes | 17:05:53 `Mail and Podcasts` live | same | live | log 140 | none this tick |
| Podcasts | live | bundled with Mail live | same | live | log 140 | none |
| Earnings | verified | 17:05:53 verified | same | verified | log 141 | unpublished KPIs blank (contract) |
| Sectors + NSE | live | 17:05:53 live | same | live | log 143–158 | none |
| Health | D-1 **2026-08-19** | **2026-08-18** | 16:54 IST snapshot | **stale** | log 142; `/api/dashboard/freshness` | missing operational D-1 |
| Satya corpus | populated FTS | 501 docs; pdfIngest ok | status API 17:20 | usable | not empty | webinars default-off retrieve |
| Claude API | valid key | 401 | vinext 17:08 | **auth fail** | log 30733–30737 | rotate key |
| OpenAI GPT-4 family | entitled models | 403 × 3 | same | **not entitled** | log 30739–30755 | allowlist / new key |
| OpenAI gpt-3.5-turbo | 16k fit | 400 on survey; 200 on small | same | **window** | log 30757–30762 vs 29 ok:true | pack + model window |
| Ollama | listening + model | connection refused | 17:20 curl | **down** | no :11434 | start daemon |

---

## Cross-section reconciliation

| Entity/metric | Surfaces compared | Expected | Observed | Difference | Cause |
|---|---|---:|---:|---:|---|
| Satya provider | status API vs vinext attempts | Claude drafts | Status Claude; every call 401 | Lie | No probe |
| OpenAI models | hardcoded list vs vendor | 4.1-mini/4o work | 403 then 3.5 | Entitlement | Allowlist |
| Passage count vs icons | retrieve 96 vs UI | Compact badges | ~38 icons | Per-URL | UX |
| Failed answer vs digest | Satya must not dump digest | Operator-safe refuse | HTTP + “digest, scores, trees” sentence | Wrong formatter reused from `/api/llm/complete` | Split Satya vs assist copy |
| Health D-1 | My Feed vs audit | 2026-08-19 | 2026-08-18 stale | Ops export | Unrelated to LLM HTTP |

---

## Verification results

| Check | Command/action | Result | Evidence |
|---|---|---|---|
| Flask health | `GET /_flask/health` | ok, upstream 200 | 17:20 IST; PID 41814 **not killed** |
| Satya status | `GET /api/satya/status` | enabled, Claude, no Ollama in configured, 501 docs | 17:20 |
| Ollama | `curl 127.0.0.1:11434/api/tags` | refused | 17:20 |
| vinext LLM log | read `vinext.log` | mtime 17:08:08; 29 ok / 3 fail; 0 Ollama | incident match |
| Working-tree tests | `node --test tests/local-llm-assist.test.mjs tests/satya-api.test.mjs tests/satya-speech.test.mjs` | **42/42 pass** | includes operator-safe copy + pack + Ollama-when-mocked |
| Live screenshot vs tests | compare | Live still used `formatLlmFailureMessage` as SSE text | deployment/process drift |
| Full `npm run lint` / `build` | not run this pass | — | Avoid restarting healthy Flask; RCA is read-only |
| Empty vs no_match | tests | pass | not this incident |
| Interrogate LLM leftover | tests `doesNotMatch` | pass | panel deleted |

---

## Remediation plan (summary)

Full sequenced plan: `Plans/PLAN-2026-08-20-LLM-Pipeline-Remediation.md`

| Priority | Action | Owner surface | Dependency | Acceptance test |
|---|---|---|---|---|
| P0 ops | Replace Anthropic key; confirm 200 on a 1-token ping | integrations-config | operator | Next complete log has no Claude 401 |
| P0 ops | Entitled OpenAI models **or** drop 4.x IDs; never lead with 403s | `OPENAI_MODELS` + Settings | same | At most one remembered 403 |
| P0 ops | Start Ollama + set `OLLAMA_MODEL`; or accept no local rescue | daemon :11434 | same | `configured` includes Ollama; fail path logs Ollama |
| P1 | Pack to **actual** model window; cap `max_tokens` per model | retrieve + client | reload vinext | Survey ask no 400 on 3.5 |
| P1 | Operator-safe Satya SSE; never HTTP collage / digest UNCHANGED in chat | `completeLocalLlm` message | — | Matches `formatSatyaLlmOperatorMessage` tests **in the running process** |
| P1 | Don’t emit icon walls; badges; `voice` only for PTT | BriefingRoom / Presence | — | ≤4 badges; `voice:false` on typed send |
| P2 | Circuit-break dead cloud; optionally skip cloud when Ollama healthy | secrets + client | Ollama up | Status doesn’t say Claude after 401 |
| P2 | SSE abort handling; don’t `onDone` after `error` | satya-client + vinext | — | No speaking of errors |
| P3 | Unify podcast summarizer model list | `local-llm-generate.mjs` | — | 403 on 4.1-mini falls back |

---

## Residual risks and open questions

- **Blocked evidence:** Did not print key prefixes or call Anthropic/OpenAI from this agent (would mutate billing / leak). Screenshot not stored. Exact operator prompt text not in logs (only attempts).
- **Unverified hypotheses:** Whether vinext `start` loaded dirty `app/*.ts` or an older graph — 400 + HTTP collage + no Ollama strongly indicate the **live graph ≠ current working-tree tests**. In-flight agent may close that gap after reload.
- **Skip-cloud:** Working tree still **calls cloud first**, then Ollama. True “skip cloud when local is healthy” is **not** implemented. Tests mock Ollama **after** cloud failures.
- **Monitoring:** Alert if last Claude attempt is 401 but status still says Claude; alert if Ollama down and only 3.5 remains.
- **Follow-up date:** 2026-08-21 after key rotation + Ollama + vinext reload, re-ask the same survey on M-2.
- **Health D-1:** Still stale; ops Shortcut for **2026-08-19**. Unrelated to this LLM P1 but blocks “dashboard current.”

---

## Guardrails honored

- Two mailboxes; Axis MF `^` prefix; webinars default-off retrieve — contracts hold; not causal.
- Empty corpus vs no_match — not this incident (501 docs).
- No invented KPIs; no “complete dashboard current.”
- Flask `:5050` not killed.
- No commit.
- No secrets in this file.
