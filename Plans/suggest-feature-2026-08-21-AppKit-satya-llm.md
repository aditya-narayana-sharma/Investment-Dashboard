# Implementation plan — Satya Assistant, LLM pipeline, research categories

**Date:** 2026-08-21 (IST)  
**Repo:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`  
**Branch:** `AppKit`  
**Job:** `$suggest-feature` after catalog selection **all** (SF-01 … SF-08)  
**Non-goals:** Unselected overflow (none). Do not restore M-2 digest walls, M-4, Interrogate LLM, or a freshness strip on the main canvas. Do not invent KPIs. Do not kill Flask `:5050`. Do not commit.

---

## 1. Meta

| ID | Title | Type |
|---|---|---|
| SF-01 | Chats as a real Assistant (search, rename, delete) | Enhancement |
| SF-02 | One session for M-2 canvas + companion Chats | Improvement |
| SF-03 | Honest LLM status; skip dead Claude/OpenAI ids | Improvement |
| SF-04 | Stream tokens live + show Ollama in Satya chrome | Enhancement |
| SF-05 | Knowledge-base health on M-2 | Improvement |
| SF-06 | Grouped Axis chips with counts and webinar-off | Improvement |
| SF-07 | Ask this category from a chip | Enhancement |
| SF-08 | Typed M-2 never TTS; never speak LLM errors | Improvement |

---

## 2. Current state

- **Chats:** Companion sheet (`SatyaPresence` `satya-chats`) lists `fetchSatyaSessions` titles. `GET /api/satya/sessions` has no PATCH/DELETE. LocalStorage cap 40. No search/rename.
- **Two threads:** M-2 `SatyaBriefingRoom` keeps `visitRef`; companion uses `getSatyaThread()`. History for retrieve concatenates both. `currentSatyaTurn` clears M-2 wall; Chats holds history.
- **LLM:** `completeLocalLlm` is Claude → OpenAI (`gpt-4.1-mini` … `gpt-3.5-turbo`) → Gemini → Ollama. `llmAssistAvailability` still prefers a stored Claude key (`Machine-drafted via Claude`). `streamLocalLlm` completes fully then one `onToken`. Typed M-2 sends `voice: true` and `speech.speak` on `onDone`.
- **Categories:** 28 Axis chips + families on M-2; companion buries them in `<details>`. Counts exist on M-2 chips. Webinars default-off in SQL (`DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS`) but the UI does not say so. Chips only toggle filters, not “ask this category.”

---

## 3. Target state

- **SF-01:** Chats list: search, rename title, delete (operator-Mac), newest first. New chat unchanged.
- **SF-02:** One `sessionId` + turns shared: M-2 shows current visit turn only; opening Chats shows full transcript; new M-2 ask continues that session without dumping the wall onto M-2.
- **SF-03:** After 401, skip that provider for the process until key fingerprint changes. After `model_not_found`/403, skip that model id. Status `provider` is the first still-callable provider (else Ollama if tags succeed). Never advertise Claude after 401.
- **SF-04:** Ollama `/api/chat` (or generate) **streams** NDJSON into SSE `token` events. Satya status/chrome shows Ollama when it is the live provider (or “on-device unavailable”).
- **SF-05:** M-2 header shows corpus `documentCount`, family totals, ingestError, empty_corpus vs no_match copy (not “refresh mail”).
- **SF-06:** Axis chips grouped (existing category groups in `axis-categories.mjs` if present; else by `defaultRetrieve` / webinar). Counts on chips. Visible “Webinars off unless selected.”
- **SF-07:** Secondary control on a category chip (or long-press / “Ask”) sets retrieve to that category and submits a grounded summarize prompt for it.
- **SF-08:** Typed M-2 and typed companion composer: `voice: false`. PTT: `voice: true`. `onError` never calls `speak`. TTS only after a successful grounded answer when voice was requested.

---

## 4. Work breakdown

### Assignment A — LLM pipeline (SF-03, SF-04)

**Writes:** `app/local-llm-client.ts`, `app/local-llm-secrets.ts`, `app/api/satya/status/route.ts`, `app/satya/chat.ts` (stream path only; persist stays), `tests/local-llm-assist.test.mjs`, `tests/satya-api.test.mjs` (status/provider cases)

**Tasks:** Circuit-break maps; filter `completionProvidersInPreferenceOrder` / `llmAssistAvailability`; Ollama stream into `streamLocalLlm`; status JSON `ollama` / `skipped`; tests for skip-401 and operator-safe error copy.

### Assignment B — Satya Assistant UI (SF-01, SF-02, SF-05, SF-06, SF-07, SF-08)

**Writes:** `app/dashboard/SatyaPresence.tsx`, `app/dashboard/SatyaBriefingRoom.tsx`, `app/dashboard/satya-client.ts`, `app/dashboard/satya.css`, `app/dashboard/satya-suggestions.ts` (if needed), `app/api/satya/sessions/route.ts` (+ `app/satya/chat.ts` session rename/delete helpers — **mutex with A on `chat.ts`**)

**Coalesce:** `app/satya/chat.ts` is a mutex. **Assignment A must not edit persist/list/delete/rename.** Assignment B owns session CRUD in `chat.ts` (`deleteSatyaSession`, `renameSatyaSession`). Assignment A only touches `runSatyaChat` streaming/`onToken` if required — **prefer A only changes `local-llm-client.ts` `streamLocalLlm` so `chat.ts` stays B-owned.** A already emits tokens via `onToken`; B does not need to edit `runSatyaChat` if A streams inside `streamLocalLlm`.

**Revised mutex:** A does **not** write `app/satya/chat.ts`. B writes session APIs there.

---

## 5. Parallel DAG

| id | wave | writes | depends_on |
|---|---|---|---|
| A-pipeline | 1 | `local-llm-client.ts`, `local-llm-secrets.ts`, `api/satya/status/route.ts`, `tests/local-llm-assist.test.mjs`, `tests/satya-api.test.mjs` (status) | — |
| B-ui | 1 | `SatyaPresence.tsx`, `SatyaBriefingRoom.tsx`, `satya-client.ts`, `satya.css`, `api/satya/sessions/route.ts`, `satya/chat.ts` (session CRUD only), `tests/satya-speech.test.mjs`, `tests/rendered-html.test.mjs` (Satya chips), `tests/satya-api.test.mjs` (sessions) | — |

`tests/satya-api.test.mjs` is a mutex if both write it. **A owns status tests appended carefully; B owns session tests.** Parent integrates if conflict: **A writes `tests/local-llm-assist.test.mjs` only; B writes `tests/satya-api.test.mjs` and `tests/satya-speech.test.mjs`.** Status tests that need HTTP go in `satya-api` → **B adds one status assertion if A documents the JSON shape in a comment; A puts availability unit tests in local-llm-assist.**

---

## 6. Ownership coalescing

- `chat.ts` persist/list: B only.
- `streamLocalLlm`: A only (`chat.ts` already calls it).
- `satya-api.test.mjs`: B only. A uses `local-llm-assist.test.mjs`.

---

## 7. Acceptance

- Chats: search filters titles; rename persists; delete removes operator-Mac session; M-2 wall still current-turn only.
- Same `sessionId` continues from Chats into next M-2 ask without stacking old bubbles on M-2.
- After simulated Claude 401, status does not say Claude; OpenAI 403 model skipped; Ollama attempted.
- Ollama stream: more than one SSE token event before `done` in a unit test with a fake fetch stream.
- M-2 shows documentCount / ingestError; empty vs no_match copy unchanged (“do not refresh mail”).
- Axis chips grouped; webinar default-off labeled; counts shown; Ask-this-category sets filter + prompt.
- Typed send `voice: false`; PTT `voice: true`; errors not spoken.

---

## 8. Verification

```
node --test tests/local-llm-assist.test.mjs tests/satya-api.test.mjs tests/satya-speech.test.mjs tests/rendered-html.test.mjs
npx eslint app/local-llm-client.ts app/local-llm-secrets.ts app/dashboard/SatyaPresence.tsx app/dashboard/SatyaBriefingRoom.tsx app/dashboard/satya-client.ts app/satya/chat.ts
```

Do not kill Flask `:5050`.

---

## 9. Risks

- Streaming abort must cancel Ollama fetch.
- Delete must not wipe `sessions.json` on LAN 403.
- Circuit-break must clear when Settings save a new key (fingerprint last-4 hash, never log the key).

---

## 10. Definition of done

All eight SF IDs have code + tests as above. Uncommitted. Operator-Mac chat POST unchanged.
