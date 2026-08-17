# Stratji Integrations Catalog

**Status:** living. Labels: **AS-BUILT** / **TARGET** / **INVARIANT**.  
UI: `?view=integrations` (chrome, not a workspace). Alias `settings`.

Safety (INVARIANT): Connect / test / disconnect write local config only and do not place orders. Confirmed BUY/SELL and GTT from reviewed tickets ARE live Kite orders after typed confirmation. Secrets stay on-device. Stratji never silently auto-trades.

---

## 1. Pipeline cards

| Pipeline | AS-BUILT | TARGET | Typical statuses |
| --- | --- | --- | --- |
| Broker (Kite + Groww placeholder) | Kite MCP BYOK | Groww read+ticket | live / partial / stale / unavailable / auth_required / not_configured |
| Research reports | iCloud → Axis Research + local PDF archive | HDFC / SBI / ET-Prime / Moneycontrol **profiles** | same |
| Newsletters mailbox | iCloud → Newsletters, promo-stripped | User-named mailbox | same |
| Calendars | Apple Calendar; M-3 vs M-4 split | Extra Apple calendars; Google Calendar OAuth | same |
| Reminders | Apple lists `Job 🔍` + `Earnings`; EventKit complete | User-named lists; Google Tasks placeholder | same |
| Notes | Health Daily **deprecated** | Apple Notes / Obsidian / Notion / OneNote research-only | same |
| yfinance | Free quotes + sector snapshots | Unchanged (free for all) | same |
| Sectoral Analytics | 11 sectors, S-2 isolation | User add/remove sectors | same |
| Podcasts | Apple Podcasts SQLite/TTML | Optional Ollama drafts labelled machine-drafted | same |
| Health XML/ZIP | iCloud Health folder + Shortcut overrides | Wizard path | same |
| Tailscale | Serve to iPhone | Wizard URL | same |
| Optional Claude/ChatGPT keys | Unused at runtime | On-device summarization only | not_configured |

Each card stores `{ status, lastValidated, connected }` in local config. Connect / test / disconnect are **placeholders that write local config**, not live broker mutations.

---

## 2. First-run / settings wizard fields (P1)

Seed defaults are empty personal paths. Runtime prefers saved config, then env, then seed. Set **your** mailbox names and folders in Settings.

| Field | Env / key | Seed default |
| --- | --- | --- |
| Kite MCP project dir | `KITE_MCP_PROJECT_DIR` | *(empty — set your clone)* |
| Newsletters mailbox | `STRATJI_NEWSLETTERS_MAILBOX` | `Newsletters` |
| Research mailbox | `STRATJI_RESEARCH_MAILBOX` | `Axis Research` |
| Reminder list names | `STRATJI_REMINDER_LISTS` | `Job 🔍`, `Earnings` |
| Health ZIP folder | `APPLE_HEALTH_DIR` | *(empty — set your iCloud Health folder)* |
| Tailscale URL | `STRATJI_TAILSCALE_URL` | *(empty — optional, not required for Mac)* |

v1 persistence: `artifacts/private/integrations-config.json` (gitignored) via `/api/integrations`.

---

## 3. API playbook (step-by-step)

### 3A Kite Connect (AS-BUILT, BYOK)

1. Create a Zerodha Kite Connect app. Note API key + secret.
2. Clone or point `KITE_MCP_PROJECT_DIR` at the Go **kite-mcp-server** repo.
3. Put key/secret in that repo’s `.env` (never in Stratji git).
4. From Stratji root: `npm run flask:setup` then `scripts/run-dashboard-service.sh` (or Stratji.app, which starts Flask).
5. Open Portfolio Overview. If status is `auth_required`, use **Authenticate Kite**, complete Zerodha login, then **Refresh all**.
6. Daily token boundary is ~06:00 IST. Do not spam same-day logins.

### 3B yfinance (AS-BUILT, no key)

1. Python venv via `flask:setup` already installs yfinance.
2. Sectoral Analytics uses `/api/quotes/yfinance` and `scripts/fetch-sector-*-yfinance.py`.
3. Paid Kite MD is **never required**. If yfinance fails, label the sector snapshot stale/unavailable.

### 3C Optional LLM keys (TARGET, non-load-bearing)

1. On Integration Page, paste Anthropic or OpenAI key into the LLM card.
2. Keys write to the local config file with mode `0600` intent; they are not committed.
3. Use only for podcast/narrative **drafts**. Label output machine-drafted. Numbers stay source-backed.

### 3D Groww (TARGET placeholder)

1. Card exists. Status `not_configured`.
2. Do not implement live Groww API in this slice.
3. Future: same ticket UI, paper-first, behind this adapter.

---

## 4. MCP playbook (Kite runtime)

1. Confirm `KITE_MCP_PROJECT_DIR` on the Integration Page wizard.
2. `scripts/ensure-kite-server.sh` uses that env (seed default is Aditya’s path).
3. Health check: `http://127.0.0.1:8080/`.
4. Stratji talks to MCP **server-side only**. The browser never holds the Kite secret.
5. Optional Notion MCP is TARGET for notes and **must not** be required to boot.

Authoring-only MCPs (Cursor): Notion, Zapier, Figma, Hugging Face, Apify, GitHub, Cloudflare, Supabase, Lovable, Greptile. The Mac app runs if they are absent.

---

## 5. Skills playbook (agents maintaining the repo)

1. Load `refresh-investment-dashboard` before claiming sources are current.
2. Load `stratji-semantic-layer` before changing strategy tree contracts.
3. Load team-kit review/CI skills before shipping Sectoral or Intelligence diffs.
4. Firecrawl/Apify skills are optional fetchers and **never** a substitute for IR/NSE earnings proof.
5. Exhaustive-switch and no-inline-imports rules always apply.

---

## 6. Plugins playbook

1. Cursor plugins (Zapier, Firecrawl, Figma, etc.) are **authoring** tools.
2. Do not bake plugin credentials into the Stratji desktop app.
3. If a plugin write would send email or create a ticket, confirm with the user first.

---

## 7. Agents playbook

| Agent | Role |
| --- | --- |
| Dashboard steward | Preserve six-workspace isolation and brutalist chrome. |
| Refresh auditor | Semantic freshness, not HTTP 200. |
| Builder/compiler | `StrategyTreeV1` honesty; no fake RUN. |
| Native-app maintainer | AppKit Stratji + iOS WKWebView; do not break iOS. |
| Integrations-wizard author | Local config only; seed defaults; no secrets in git. |
| Optional local LLM | Drafts labelled machine-drafted. |

Computer Use is optional deep-audit of Mail/Reminders/Calendar, not a production scheduler.

---

## 8. Streak (Pro TARGET — copy-only in this slice)

1. Open Integration Page → Streak export checklist (or Strategies library stub).
2. Copy the white-box recipe + OPS/static-IP/Algo-ID reminders.
3. User deploys **in Zerodha Streak** and confirms there.
4. Stratji does **not** scrape Streak and does **not** place unattended orders.
5. Do not claim “Streak live trading works” until P6 ships a real export package.

---

## 9. Apple permission playbook (Plus)

1. In Stratji Settings → Apple apps, tap **Connect** for Mail, Calendar, Reminders, and Podcasts (Notes is optional research-only). First launch also shows a dismissible permissions sheet. This does not block the dashboard forever.
2. Calendar / Reminders: EventKit full-access prompt (`requestFullAccessToEvents` / `requestFullAccessToReminders`). Mail / Podcasts / Notes: Apple Events (`AEDeterminePermissionToAutomateTarget` + a lightweight AppleScript probe).
3. Status is **Connected**, **Permission required**, or **Denied**. Denied offers Open Privacy Settings (Calendars, Reminders, or Automation).
4. After grant, Stratji runs the same refresh pipelines as today (`content-digest-server`, EventKit reminder helper, Podcasts SQLite/TTML). Mail stays iCloud → Newsletters and iCloud → Axis Research. Reminders stay `Job 🔍` and `Earnings`. Calendar is scheduling evidence only (M-3 vs M-4 unchanged). Notes is never a Health source.
5. Full Disk Access may still be required for Calendar / Podcasts / Reminders SQLite group containers and Health ZIP import.
6. Health: validate newest ZIP contains `apple_health_export/export.xml`; atomic extract; keep last good XML if the newest archive is corrupt. Do not require iPhone for Mac Mail/Calendar/Reminders/Podcasts.
