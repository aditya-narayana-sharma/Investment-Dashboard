# Implementation plan — LLM pipeline remediation (Satya M-2 + companion)

**Source RCA:** `RCAs/RCA-2026-08-20-LLM-Pipeline.md`  
**Incident:** 2026-08-20 ~17:07 IST Satya “Drafting..” then  
`LLM call failed (Claude HTTP 401 authentication_error; OpenAI HTTP 403 model_not_found; OpenAI HTTP 400 context_length_exceeded). Existing non-LLM digest, scores, and trees are`  
**Branch / baseline:** `AppKit` @ `cbb3356e` + dirty Satya/LLM tree  
**Constraint:** Documentation until an implementation agent is asked to edit production code. Do not commit, push, restart, or kill healthy Flask on `:5050` as part of writing this file. Reload vinext only when the operator asks to apply code.

**In-flight (do not duplicate blindly):** another agent may already be landing pack-context, operator-safe SSE copy, always-append Ollama, and citation badges. Re-read `app/local-llm-client.ts`, `app/satya/retrieve.ts`, `app/dashboard/satya-citation-icons.tsx` before editing. **Live vinext at 17:08 did not show those behaviors.** After code lands, the running process must be the one that served the next operator ask.

**Goal:** Satya drafts from retrieved Mail / Axis PDFs / podcasts / verified earnings, or refuses in operator-safe language. Cloud 401/403/400 must not appear as a chat answer. Local Ollama must actually be attempted when cloud cannot serve a long-context model. Digest, scores, and trees stay source-backed. Two-mailbox, Axis MF prefix, webinar default-off, empty vs no_match, operator-Mac-only POST unchanged.

---

## Success criteria

1. Repeating the 17:07 survey-style M-2 ask yields a **machine-drafted** answer **or** `Satya could not draft (cloud LLM skipped; on-device LLM unavailable)` — **never** `Claude HTTP 401` / `model_not_found` / `context_length_exceeded` / `Existing non-LLM digest, scores, and trees`.
2. `GET /api/satya/status` does not advertise `provider: "Claude"` after a Claude 401 in this process (until a new key is saved).
3. OpenAI `model_not_found` IDs are not retried every turn; `gpt-3.5-turbo` (or a working 4.x model) is used only when the **packed** prompt + `max_tokens` fits that model’s window.
4. If Ollama is running with `OLLAMA_MODEL` (or `/api/tags` lists a ranked model), a cloud-dead turn **completes on Ollama** and is persisted. If Ollama is down, the fail path **logs** an Ollama attempt (`unavailable`), not silence.
5. M-2 citation strip is **≤4 badges with counts**, not ~38 repeated icons. Related UX; may ship with the same PR.
6. Typed M-2 send uses `voice: false`; push-to-talk uses `voice: true`.
7. Failed turns do not stay on “Drafting…” with a citation wall; `onDone` does not fire after SSE `error`; TTS does not speak HTTP errors.
8. `POST /api/satya/chat` and `POST /api/llm/complete` remain **operator-Mac only**. LAN/Tailscale stay 403.
9. Empty corpus vs no_match copy unchanged. Numbers only from passages. Webinars stay default-off retrieve. No digest reading walls in M-2. No `Interrogate LLM`.
10. Tests: `node --test tests/local-llm-assist.test.mjs tests/satya-api.test.mjs tests/satya-speech.test.mjs` stay green; add cases below. Flask tests still 20/20 via `.venv-flask` if that suite is touched.
11. Do not claim the complete dashboard is current while Health is stale through D-1 **2026-08-19**.

---

## Phase 0 — Operator / runtime (no product-contract change)

**Owner:** operator · **Blocks:** true long-context Claude/GPT-4 drafts

### 0.1 Anthropic key

The live key is rejected (`authentication_error` on `claude-sonnet-4-6`). Replace it in Settings (`/?view=integrations`) or `artifacts/private/integrations-config.json` / `~/Library/Application Support/Stratji/integrations-config.json`. Do not paste keys into git, RCA, or chat logs.

**Acceptance:** A tiny complete (existing `/api/llm/complete` ping or next Satya ask) logs Claude **200**, or Claude is **removed** from `configured` so it is not tried.

### 0.2 OpenAI entitlement

This key can call **`gpt-3.5-turbo`** (29 `ok: true` after 4.x 403s) and cannot call `gpt-4.1-mini` / `gpt-4o-mini` / `gpt-4o`. Either:

- put a key that can call a 128k model into Settings, **or**
- after Phase 1, stop leading with dead IDs so every turn does not pay three 403s.

### 0.3 Ollama (why local did not save)

`127.0.0.1:11434` was down at 17:20. `configured` had no Ollama. Start the local daemon, pull a ranked instruct model (`qwen2.5:7b-instruct` preferred in code), set `OLLAMA_MODEL` (env or integrations). Flask must stay on **5050**.

**Acceptance:** `curl -sS http://127.0.0.1:11434/api/tags` lists the model. Status `configured` includes `Ollama` **or** `/api/tags` success is enough for the always-append path after reload.

### 0.4 Reload the process that serves `:3000`

Dirty-tree pack/badges/operator-safe copy do not count until **this vinext** loads them. Coordinate with the operator before restarting vinext; do **not** kill Flask 41814 unless replacing the whole supervisor stack on request.

### 0.5 Health (unrelated but required for “dashboard current”)

Run the **Health** Shortcut for **2026-08-19**, import, refresh. LLM P1 can ship while Health is stale; do not relabel Health live.

---

## Phase 1 — Stop lying, stop 403 storms, fit the prompt to the model that will run

**Effort:** 2–4 hours · **Risk:** medium (prompt packing vs heading coverage)

### 1.1 Circuit-break dead cloud providers

**Files:** `app/local-llm-client.ts`, `app/local-llm-secrets.ts`, `app/api/satya/status/route.ts`

- After `isAuthFailure` (401 / `authentication_error` / `invalid_api_key`), skip that provider for the rest of the process (module-level set keyed by provider, cleared when `readLocalLlmSecrets` sees a different key fingerprint — e.g. last 4 chars hash, never log the key).
- After `model_not_found` / 403-as-missing, remember **(provider, model)** and do not retry that id until process restart or Settings save.
- `llmAssistAvailability` / status `provider` should be the **first provider not circuit-broken**, else Ollama if tags succeed, else `enabled` with message that cloud keys are stored but not callable.

**Acceptance:** Second Satya ask in one process does not log Claude 401 again if the first did. Status does not say Claude.

### 1.2 OpenAI model list vs this account

**Files:** `app/local-llm-client.ts`

- Keep a fallback list but **reorder** from last success / skip remembered 403 ids.
- Optional: Settings field `openaiModel` (already have `ollamaModel` pattern).
- Cap `max_tokens` per model: `gpt-3.5-turbo` output ≤ 4096; never request 8192 into a 16k window. Survey written budget must shrink **input** first, not blow the window.

**Acceptance:** vinext log for a survey ask: at most one 403 per dead id per process; if only 3.5 remains, `max_tokens` + packed chars fit 16 385.

### 1.3 Pack to the **actual** remaining model window

**Files:** `app/satya/retrieve.ts`, `app/satya/chat.ts`

Working tree already has `packSatyaPassages` / `SATYA_PROMPT_INPUT_CHAR_CAP = 14_000`. Verify the **running** path uses it **before** `completeLocalLlm`, and that the cap is a function of:

`input_char_cap ≈ (context_tokens - max_tokens - system_tokens) * 4`

For `gpt-3.5-turbo` + `max_tokens` 2048, 14k chars is plausible; 96×900 is not. If Claude/GPT-4o is actually callable, a larger cap is fine.

Keep one heading per populated family/Axis category (tests already require coverage). Never invent KPIs to fill dropped headings — omit empty headings (already in `satyaEvidenceOutline`).

**Acceptance:** `packedSatyaEvidenceChars(packed) + system + question + max_tokens` cannot exceed the leftover model window. Existing pack test stays green. Live survey ask no longer 400s on 3.5.

### 1.4 Skip-cloud when local can draft (optional, if the other agent did not)

**Files:** `app/local-llm-client.ts`, `app/local-llm-secrets.ts`

Today: cloud first, Ollama last. RCA: that burns 401/403/400 **then** never reached Ollama live.

Preferred when `OLLAMA_MODEL` or `/api/tags` is healthy:

- **Satya chat only:** try Ollama first **or** skip cloud after the process has seen Claude 401 + OpenAI 4.x 403.
- Do not skip cloud on a healthy Claude 200.

Workspace `/api/llm/complete` may keep cloud-first for short composite comments once keys work.

**Acceptance:** With Ollama up and Claude 401, Satya survey completes on Ollama without requiring OpenAI 400. Test already: `completeLocalLlm skips unusable cloud providers and uses on-device Ollama` (still hits cloud first in the mock — extend with a `preferOllama` flag if implementing true skip-cloud).

---

## Phase 2 — Satya UX and SSE contract

**Effort:** 1–2 hours · **Risk:** low

### 2.1 Operator-safe chat errors

**Files:** `app/local-llm-client.ts` (`formatSatyaLlmOperatorMessage` already the intended `completeLocalLlm.message` in working tree), `app/satya/chat.ts`

- Satya SSE `error.message` must be `formatSatyaLlmOperatorMessage`, never `formatLlmFailureMessage`.
- Keep `formatLlmFailureMessage` for **logs only** (`[llm-complete] detail`).
- `/api/llm/complete` JSON `message` for builder/composite may stay slightly more specific but must not dump secrets; do **not** reuse the digest/scores/trees sentence on **Satya chat**.

**Acceptance:** `tests/satya-api.test.mjs` “Satya LLM errors are operator-safe…” plus a live screenshot with no HTTP collage.

### 2.2 Citations and Drafting state

**Files:** `app/satya/chat.ts`, `app/dashboard/satya-client.ts`, `app/dashboard/SatyaBriefingRoom.tsx`, `app/dashboard/SatyaPresence.tsx`, `app/dashboard/satya-citation-icons.tsx`

- Prefer emitting citations on `done` (packed set) rather than 96 events before the LLM.
- UI: `citationSourceBadges` only (in-flight). Counts per mail / pdf / podcast / earnings.
- `onError`: write operator-safe text into the assistant turn **or** remove the empty assistant turn; `setError` for the alert is optional if the turn holds the copy.
- `streamSatyaChat`: if an `error` event was seen, **do not** call `onDone`.
- Do not `speech.speak` error text. `voice: true` only for PTT.

**Acceptance:** Failed turn: one sentence, ≤4 badges, no “Drafting…”, no spoken 401. Typed POST body `voice: false`.

### 2.3 Persist policy

**Files:** `app/satya/chat.ts` `persistSatyaSession`

Either persist the operator-safe refusal as an assistant turn (so Chats can resume) **or** drop the user turn. Do not leave sessions.json without the user ask if the UI kept it locally.

---

## Phase 3 — Other LLM callers (map, then align)

Do **not** route Satya M-2 through `/api/llm/complete`. Do **not** inject digest walls as the chat answer on failure.

| Caller | Path | Change |
|---|---|---|
| Satya M-2 + companion chat | `POST /api/satya/chat` → `runSatyaChat` → `streamLocalLlm` | Phases 1–2 |
| Workspace assist | `POST /api/llm/complete` → `completeLocalLlm` | Same circuit-break + model list; builder 422 fail-closed stays |
| Podcast summarizer | `scripts/podcast-summarizer.mjs` → `configuredCloudLlm` | After 403 on `gpt-4.1-mini`, fall through like `completeLocalLlm` or call it; extractive digest remains SoT |
| Cursor | stored only | Status copy when mixed with dead Claude: “Cursor does not complete” |

**Files:** `app/api/llm/complete/route.ts`, `scripts/local-llm-generate.mjs`, Integrations copy in `app/local-llm-secrets.ts` overlay notes.

---

## Phase 4 — Tests and reload verification

### 4.1 New / extended tests (working tree)

- Circuit-break: two `completeLocalLlm` calls, second must not hit `api.anthropic.com` after 401.
- Packed survey prompt + `max_tokens` 2048 fits a 16k budget helper (char/token estimate).
- `runSatyaChat` failure event is operator-safe; **no** `token` event with `HTTP 401` (already asserted).
- `voice` not part of retrieve tests; add a BriefingRoom/source grep or payload unit if there is a pure function. Prefer extracting `satyaGenerationBudget` tests for voice vs survey.
- `citationSourceBadges` already tested — keep.
- Negative: `doesNotMatch(/Interrogate LLM/)`, no `NewsletterFamilyGroups` walls in live M-2.

### 4.2 Live verification (after operator approves reload)

1. `GET /_flask/health` still ok (Flask not killed).
2. `GET /api/satya/status` — provider matches a **callable** layer.
3. M-2 survey ask (all default chips, webinars off) — draft **or** operator-safe refuse.
4. `~/Library/Logs/PortfolioIntelligence/vinext.log` — no 400 on 3.5 for that ask; Ollama line if cloud dead.
5. LAN URL: POST chat still 403.
6. Confirm M-1 Kanban, M-3 earnings, S-2 isolation unchanged (`tests/rendered-html.test.mjs`, `freshness-and-isolation.test.mjs` if time).

### 4.3 Commands

```bash
node --test tests/local-llm-assist.test.mjs tests/satya-api.test.mjs tests/satya-speech.test.mjs tests/satya-corpus.test.mjs
# if UI/routes touched:
npm run lint
npm run build   # only when operator wants vinext to pick up a production bundle
```

Do not run `scripts/run-dashboard-service.sh` in a way that fights PID 41814 unless replacing the stack on request.

---

## Phase 0 vs code — who does what

| Item | Ops (operator) | Code |
|---|---|---|
| New Anthropic key | yes | circuit-break so a dead key cannot keep being preferred |
| OpenAI 4.x access | yes or accept 3.5 | remember 403; pack to 16k |
| Ollama up | yes | always attempt last **in running process**; optional skip-cloud |
| Health D-1 | yes | none for this LLM P1 |

---

## Out of scope / do not regress

- Two mailboxes (`iCloud → Newsletters`, `iCloud → Axis Research`). Axis MF prefix `^`. `live_webinars` default retrieve off.
- Empty corpus message may mention refresh mailboxes; **no_match must not**.
- Machine-drafted text is never a source for numbers.
- DailyKanbanBoard only; Intelligence is M-1 / M-2 / M-3 only; no M-5; no digest walls.
- S-2 industry filter must not leak into Satya.
- Do not commit unless asked.

---

## Suggested implementation order (single PR if possible)

1. Phase 2.1 error copy (stops the scary screenshot even before keys are fixed).
2. Phase 1.3 packing + 1.2 max_tokens/model skip (stops 400 on 3.5).
3. Phase 1.1 circuit-break + status honesty.
4. Phase 2.2–2.3 citations / voice / onDone.
5. Phase 1.4 skip-cloud / Ollama-first for Satya once 0.3 is done.
6. Phase 3 podcast summarizer align.
7. Phase 4 tests + operator live ask.

**Done when:** the operator can re-ask the 17:07 question and get a grounded draft **or** a one-line Satya refuse, with counted source badges, and `vinext.log` no longer ends on `gpt-3.5-turbo` / `context_length_exceeded` without an Ollama attempt.
