# STRATJI / Portfolio Intelligence — AI-Agent Independence Analysis & Remediation Plan

> **Question answered:** *Can the dashboard run independently of ChatGPT/Codex, Claude Code/Cowork, and Cursor?*
>
> **Verdict (short):** **Mostly yes, but not fully.** The dashboard **serves, renders, and refreshes all of its
> live mechanical data with zero AI-agent involvement** — Kite, Mail, Podcasts, Calendar, Reminders, sector
> market data, benchmarks, news, health, PDF export, all layouts and all charts run from real code (JXA,
> SQLite, Python, Node, Go MCP). However, a **research-and-verification layer** of baked datasets goes stale
> without a periodic AI-agent session, and the repo's own operating contract (`AGENTS.md` §"Required run
> sequence") explicitly requires a **Codex Computer-Use pass** before the dashboard may claim every source is
> current. This document classifies every pipeline, then gives a structured plan to remove the remaining
> dependencies and install autonomous refresh protocols for every workspace, section, sub-section, layout,
> integration, and chart.
>
> Companion document: `Plans/STRATJI-Master-System-Prompt.md` (full as-built spec — workspaces, sections,
> charts, KPIs, design system). This plan references it rather than repeating it.

---

# PART A — COMPLETE ANALYSIS

## A1. Functionality inventory (condensed)

4 workspaces / 14 sections / 30+ sub-pages; 24 chart types; 17 API routes + `/_health/snapshot`; Flask/Waitress
at `localhost:5050` + Tailscale Serve; SwiftUI iPhone wrapper; Investment Brief PDF (cover + §1–§8); mandatory
startup refresh audit; 3-theme brutalist design system. Full detail in the Master System Prompt.

## A2. Dependency classification — every pipeline, audited against the actual code

### A2.1 ✅ Fully autonomous today (no ChatGPT/Codex, no Claude, no Cursor)

| # | Pipeline | Mechanism (verified in source) | Trigger today |
|---|---|---|---|
| 1 | **Zerodha Kite** (holdings, positions, orders, GTTs, margins, quotes, order/GTT/alert placement, login) | Go **kite-mcp-server** auto-started; `app/kite-live-server.ts` server-only MCP session; token store | In-app: load + 5 min + focus/online |
| 2 | **Apple Mail — Newsletters** | `content-digest-server.mjs`: **JXA/osascript** against `Mail.app`, exact iCloud → `Newsletters` mailbox | `/api/content/refresh?force=1` |
| 3 | **Apple Mail — Axis Research** (incl. Message-ID → `message://` links, PDF attachment matching) | Same JXA path, exact iCloud → `Axis Research`; `axis-mail-filter.mjs` | Same |
| 4 | **Axis PDF call extraction** (I-4 workbench, targets, CMP, Target-Achieved) | `scripts/extract-axis-pdf-recommendations.py` — text-layer parsing of the local Axis archive; **no OCR, no LLM** | Content refresh |
| 5 | **Apple Podcasts** (episodes, descriptions, transcripts) | Direct **SQLite** read of `MTLibrary.sqlite` + cached **TTML** transcripts | Content refresh |
| 6 | **Apple Calendar** | Direct **SQLite** read of `Calendar.sqlitedb` | Content refresh |
| 7 | **Apple Reminders** (read + **write-back** complete) | Direct **SQLite** read of the Reminders store; EventKit Swift helper (`complete-reminder-eventkit.swift`) for completion | Content refresh / checkbox |
| 8 | **Sector market data** (S-2 prices, returns, rankings) | `fetch-sector-quotes-yfinance.py` via `/api/sectors/snapshot` | In-app refresh |
| 9 | **NSE benchmarks** (S-3 lines, returns, squeeze widths where live) | `fetch-sector-benchmarks-yfinance.py` + registry, EOD | In-app refresh |
| 10 | **Sector news + sentiment** | Pure **RSS** fetch (ET, FT, Bloomberg, Zerodha Z-Connect, Moneycontrol via Google News, NDTV Profit) + deterministic keyword sentiment | In-app refresh |
| 11 | **yfinance CMP fallback** | `/api/quotes/yfinance` chunked | In-app |
| 12 | **Apple Health import** | `refresh-apple-health.sh` → ZIP validation → `import_apple_health.py`; `import_health_shortcut.py` for Health-Stats overrides; iPhone HealthKit upload via paired native app | Startup audit + iPhone push |
| 13 | **Earnings *contract* check** | `earnings-verify.ts` (URL + filled-KPI validation, IST date math) | `/api/earnings/snapshot` |
| 14 | **Report + PDF export** | In-browser render → `POST /api/report-pdf` | User action |
| 15 | **Startup audit** | `refresh-dashboard-data.sh` — pure `curl` + `python3` semantic checks, logs to `startup-refresh.log` | Service start |
| 16 | **Serving/ops** | Flask/Waitress + launchd plist + Tailscale Serve | launchd |
| 17 | **All layouts, alignment, themes, chart configurations** | 100% static code (`globals.css`, `visual-overhaul.css`, Recharts props, custom SVG) — **nothing visual is agent-generated at runtime** | Build time |

### A2.2 ⚠️ Agent-dependent — these go stale or violate the freshness contract without an AI session

| # | Dependency | Evidence in repo | What breaks without an agent |
|---|---|---|---|
| D1 | **FII/DII flows snapshot** (I-3 Flows donut, 5D FII/DII, evidence cards) | `app/fii-dii-flows.ts` is a **hardcoded const** (`status:"cached"`) with hand-entered sessions + cited evidence; `.firecrawl/fii-dii/nse-cookies.txt` shows agent-run NSE fetch sessions | Flow figures freeze at the last agent refresh; the "Flows" macro event argues from stale prints |
| D2 | **Earnings *results* verification** (M-3 reported rows, KPI values, source URLs) | `portfolio-data.ts › earningsCalendar` — 33 `reported:true` rows with agent-verified IR/NSE URLs and KPI numbers; `AGENTS.md`: "company investor relations or NSE first, reputable financial reporting as a cross-check". `earnings-verify.ts` only *audits* the contract — there is **no live IR/NSE fetcher** | New results never move Pending→Reported; snapshot eventually reports `stale` when overdue-reported rows lack sources; M-3 KPI tables stop filling |
| D3 | **Sector research narratives** (S-2 stances/summaries/KPI cards, impact-matrix reads; S-3 evidence bands) | `sector-data.ts` contains dated market facts (e.g. "peak demand 270.8 GW May 2026", tariff roadmap) with source URLs; `.firecrawl/sector-refresh-2026-07-24/SOURCES.md` = agent research session | Narratives silently age; "REVIEWED THROUGH <today>" header keeps printing the current date over old research |
| D4 | **Macro dials & static squeeze widths** (S-3 macro page; report §7) | `sector-analytics-data.ts › macroDials`, `squeezeWidths` (static portion) — hand-refreshed levels (Brent, INR, 10Y, VIX…) | Dials show stale distances-to-trigger |
| D5 | **Baked portfolio research** (`portfolio-data.ts`: analystCalls, scenarios copy, outlookDetails, risk profiles, sources) | Static fallback + report content, agent-curated | Quarter-outlook copy and non-Axis analyst rows age |
| D6 | **iPhone-Mirroring / Livity health cross-verification** | `AGENTS.md` step 2: "For a Codex-assisted run, use **Computer Use** to inspect Mail, Reminders, Calendar, Notes, and iPhone Mirroring… A raw web-service restart cannot invoke Codex plugins; it must mark an unrefreshed saved snapshot stale." H-2 insights hard-code the "Livity unavailable this session" banner | The audit contract *by design* cannot be fully satisfied without an agent; health cross-checks are skipped |
| D7 | **Scheduled content refresh not installed** | `config/scheduler/content-refresh.cron` is a **placeholder** ("Project artifact only… does not install or mutate any OS scheduler") | Between dashboard opens, nothing refreshes Mail/Podcasts on a schedule — today the practical scheduler has been *you starting an agent session* |
| D8 | **Podcast AI summaries unconfigured** (not agent-dependent, but dormant) | Ollama-compatible adapter; `PODCAST_SUMMARIZER_MODEL` unset → `summarizer_not_configured` | M-2 shows "summary not generated" — the designed HuggingFace/local-LLM slot is empty |

### A2.3 ✅ Explicitly *not* dependencies (checked and cleared)

- **ChatGPT sign-in / `chatgpt-auth.ts` / `.openai/hosting.json` / OpenAI workspace headers** — optional
  Sites-hosting scaffolding from the vinext starter. The local Flask deployment never invokes SIWC; no route
  requires it. **vinext** itself is build tooling (Cloudflare's Vite runtime), not an OpenAI service.
- **Claude Code / Cowork / Cursor** — zero references in `app/`, `scripts/`, or config. `.cursor/plans/` holds
  planning notes only; nothing at runtime reads them. Claude/Cowork sessions (like this one) have been used to
  *author* code and briefs, never to *serve* the dashboard.
- **HuggingFace** — currently **no integration at all** (the `mcp__Hugging_Face__*` tools exist only in your
  Claude session, not the repo). It enters below as the *remediation* for D8.

## A3. Verdict

**The dashboard boots, serves, and live-refreshes ~85% of its surface with no AI product in the loop.**
The remaining 15% — FII/DII flows, earnings-result verification, sector/macro research narratives, the
health cross-verification audit step, and the uninstalled content scheduler — currently assumes a
ChatGPT-Codex (or equivalent agent) session as the "research analyst of last resort". Left alone for weeks,
the app would keep running but would honestly degrade: flows `cached`, earnings drifting toward `stale`,
narratives dated, podcast summaries absent. The remediation below converts each of those into an autonomous
pipeline with an explicit refresh protocol, and reserves AI agents for what they're genuinely best at
(optional narrative drafting — clearly labelled, never load-bearing).

---

# PART B — REMEDIATION PLAN

## B0. Design principles

1. **Preserve the integrity contract.** Every new pipeline must emit the same status vocabulary
   (`live/verified/cached/stale/unavailable`), name its source + as-of, and never fabricate. Blank-until-verified
   stays law for earnings KPIs.
2. **Move baked consts → versioned JSON snapshots.** Each agent-era hardcoded dataset becomes a JSON file under
   `artifacts/private/` written by a fetcher script, with `{status, asOf, dataDate, source, payload}` and a
   TypeScript loader that falls back to the last validated snapshot (exactly the Kite pattern).
3. **launchd, not agents, is the scheduler.** All cadences below install as `launchd` jobs (macOS-native,
   survives reboots; the repo already ships one plist as precedent). The cron file becomes real.
4. **Local LLM (HuggingFace via Ollama) is optional garnish.** Summaries/narrative drafts are generated locally,
   labelled "machine-drafted", and never substitute for numeric pipelines.
5. **No layout/chart changes needed for independence** — §B6 confirms and freezes them; only *data feeding*
   changes.

## B1. New/remediated data pipelines (fixing D1–D8)

### R1 · FII/DII flows — autonomous NSE pipeline (fixes D1)
- **New:** `scripts/fetch-fii-dii-flows.py` → NSE provisional cash-market endpoint
  (`nseindia.com/api/fiidiiTradeReact`; homepage-cookie bootstrap + retry, same pattern as the existing
  `.firecrawl` session but scripted; Moneycontrol/ET RSS rows kept as cross-check evidence only).
- **Output:** `artifacts/private/fii-dii-flows.json` — rolling **10 sessions** `{date, fiiNetCr, diiNetCr,
  buy/sell, provisional}` + evidence list. New route `GET /api/flows/snapshot`.
- **Code change:** `fii-dii-flows.ts` becomes types + loader (snapshot-first, baked const as final fallback
  labelled `cached`). I-3 FlowsRegimePanel/donut and report §3 read the loader — **zero visual change**.
- **Validation:** date must be latest completed NSE trading day (`nse-trading-day.ts`); numbers must parse as
  ₹ crore; provisional flag honored; on fetch failure retain last snapshot as `cached` and surface in the strip.
- **Cadence:** weekdays **18:30 + 20:30 IST** (provisional then revised), skip NSE holidays.

### R2 · Earnings results verification — autonomous NSE announcements pipeline (fixes D2)
- **New:** `scripts/fetch-nse-earnings.py` polling three NSE APIs with the tracked-symbol universe
  (holdings ∪ sector universes ∪ calendar symbols): **corporate announcements** (subject contains "Financial
  Results"), **board-meetings calendar** (auto-adds Pending rows → feeds M-3 discovery), and **financial-results/
  XBRL listing** (revenue/PAT where machine-readable).
- **Promotion rule (integrity-preserving):** a Pending event flips to **Reported** only when an official
  announcement PDF/XBRL for that symbol+period is found → `source` = the NSE URL. KPI **values** auto-fill only
  from parsed XBRL fields; anything not machine-readable lands in a **review queue**
  (`artifacts/private/earnings-review-queue.json`, surfaced as an M-3 "needs manual KPI entry" chip) — KPIs stay
  blank, never guessed. This keeps `earnings-verify.ts` passing `verified` autonomously.
- **Output/route:** `artifacts/private/earnings-events.json` merged by the existing
  `mergeEarningsCalendarEvents`; `earningsCalendar` in `portfolio-data.ts` demoted to seed/fallback.
- **Cadence:** results season (Jan/Apr/Jul/Oct ± 3 weeks) **4×/day** (09:00, 13:00, 17:30, 21:30 IST); off-season
  daily 18:00.

### R3 · Sector & macro research freshness (fixes D3–D5)
Two-tier fix — numeric facts become pipelines; prose becomes explicitly dated:
- **R3a Numeric:** `scripts/fetch-macro-dials.py` refreshes `macroDials` inputs (Brent via yfinance `BZ=F`,
  USDINR `INR=X`, India 10Y, India VIX `^INDIAVIX`, Nifty A/D from sector universes) →
  `artifacts/private/macro-dials.json`; squeeze widths already computed live from benchmarks — remove the static
  fallback rows once parity is confirmed. S-3 macro page + report §7 read the snapshot.
- **R3b Provenance stamps:** add `reviewedAsOf: "YYYY-MM-DD"` to every `SectorView` and to
  `sectorImpactRows`/`outlookDetails`. UI: S-2 lead line changes from "REVIEWED THROUGH <today>" to
  "NARRATIVE REVIEWED <reviewedAsOf> · MARKET DATA <live asOf>"; >21 days → amber `NARRATIVE AGING` chip; >45
  days → red. **This makes staleness honest instead of hidden — the core integrity fix.**
- **R3c Optional local-LLM drafts (HuggingFace, §B5):** weekly job feeds the sector's RSS items + latest Axis
  PDFs to the local model → drafts a *proposed* summary/stance diff into `artifacts/private/narrative-drafts/`,
  rendered nowhere; you accept/edit manually (or via any agent session, now optional). Machine drafts are always
  labelled and never auto-published.

### R4 · Health cross-verification without Computer Use (fixes D6)
- Replace the iPhone-Mirroring/Livity audit step with checks the code can already do: (a) HealthKit
  operational-date coverage per category (exists), (b) Shortcut-overrides freshness check
  (`health-overrides.json` date ≥ target date → else flag), (c) a **Shortcuts Automation** on the iPhone
  (daily 20:05 IST, no AI) that runs the "Health" shortcut so overrides arrive unattended.
- **Amend `AGENTS.md`:** demote step 2 from *required Codex Computer-Use* to *optional deep-audit*; the
  autonomous checks above become the required bar. Delete the hard-coded "Livity unavailable" banner in H-2
  insights in favour of the real overrides-freshness state.

### R5 · Podcast summarizer + HuggingFace integration (fixes D8) — the one *new* integration
- **Runtime:** Ollama (already the adapter's default endpoint `127.0.0.1:11434`).
- **Model from HuggingFace:** pull a GGUF instruct model — recommended `Qwen2.5-7B-Instruct` (Q4_K_M, ~4.7 GB,
  strong JSON compliance) or `Llama-3.1-8B-Instruct`; either via `ollama pull` or
  `huggingface-cli download <repo> --include "*Q4_K_M.gguf"` + an Ollama `Modelfile`.
- **Config:** set in the launchd plist so the content service inherits it:
  `PODCAST_SUMMARIZER_MODEL=qwen2.5:7b-instruct`, `PODCAST_SUMMARIZER_URL=http://127.0.0.1:11434/api/generate`
  (remote endpoints require the explicit `PODCAST_SUMMARIZER_ALLOW_REMOTE=1` — keep off).
- **Reuse the same endpoint** for R3c narrative drafts and (optional) newsletter tag/sentiment assistance —
  one local model serves all LLM garnish. `temperature:0.1`, JSON format, chunked — already implemented.
- **Config registry:** new `config/integrations.md` documenting every env var + a `.env.example`.

### R6 · Install the scheduler (fixes D7) — see protocol table §B2
- Convert `config/scheduler/content-refresh.cron` into real **launchd** plists installed by a new
  `scripts/install-schedulers.sh` (idempotent, prints what it installs):
  `…content-refresh` (hourly), `…flows` (18:30/20:30 wk), `…earnings` (seasonal matrix), `…macro-dials`
  (18:45 wk), `…narrative-draft` (Sun 10:00), `…health-refresh` (20:15 daily).

## B2. Master refresh-protocol table (data pipelines)

| Pipeline | Fetcher | Cadence (IST) | Also on | Validation gate | On failure |
|---|---|---|---|---|---|
| Kite snapshot | Go MCP + kite-live-server | In-app 5 min | open/focus/online | `status=live`, holdings>0 semantics | downgrade → `snapshot`, auth truth preserved |
| Mail (Newsletters + Axis) | JXA via content service | **launchd hourly** (07–22) | in-app refresh | exact-mailbox read, promo filter | last digest retained, source `stale` |
| Axis PDF calls | Python extractor | with content refresh | — | text-layer only, audit counts | skip file → `invalidFiles` |
| Podcasts (+AI summaries) | SQLite/TTML + Ollama | with content refresh | — | transcript-vs-description labelling | `summary not generated` reason |
| Calendar / Reminders | SQLite / EventKit | with content refresh | checkbox write-back | exact lists (`Job 🔍`, `Earnings`) | source `permission_required`/`stale` |
| **FII/DII flows (R1)** | `fetch-fii-dii-flows.py` | **18:30 + 20:30 wk** | in-app if >24h old | latest trading day, ₹cr parse | retain → `cached` |
| **Earnings results (R2)** | `fetch-nse-earnings.py` | **4×/day in season; 18:00 off** | in-app snapshot call | NSE URL + period match; XBRL-only autofill | pending stays pending; queue chip |
| Sector market (yfinance) | Python fetchers | In-app 5 min | startup audit | `live`/`public_delayed` semantics | `cached`/`unavailable`, never blank live |
| NSE benchmarks | Python fetcher | EOD **19:00 wk** + in-app | startup audit | ≥2 closes for series | `partial`/`cached` |
| Sector news | RSS | In-app 5 min | — | per-feed state | per-source `unavailable` |
| **Macro dials (R3a)** | `fetch-macro-dials.py` | **18:45 wk** | — | all tickers priced, dated | retain → `cached` |
| **Narrative drafts (R3c)** | local LLM job | **Sun 10:00** (draft only) | manual | never auto-published | no-op |
| Health (HealthKit + Shortcut) | import scripts + iPhone automation | **20:15 daily** + iPhone push | startup audit | ZIP valid, 8 PM operational-date policy | retain last validated, exact missing dates |

## B3. Refresh protocol — every workspace / section / sub-section

*(Legend: cadence = when its data re-derives; all sections also re-render on the global 5-min `refreshAll`.)*

### Investment (`?view=investment`)
| Section / sub | Data inputs | Refresh | Stale behaviour |
|---|---|---|---|
| **I-1 Action board** | static kanban + localStorage | midnight reset | n/a |
| **I-2** gauges, nested donut, management cards, activity tabs (Holdings/Orders/Positions/GTTs/TSLs/Alerts), treemap | Kite snapshot; Axis targets (Mail/PDF); classification | Kite 5 min; content hourly | `snapshot` banner; tickets disabled unless `live` |
| **I-3** macro scenario lab (5 events × 3 bands) | macroEvents (static framework — fine); Mail evidence; **flows via R1** | content hourly; flows 18:30/20:30 | flows `cached` labelled in donut note |
| **I-3** risk composition bar + holdings radar | Kite + risk profiles | Kite 5 min | waits for live positions |
| **I-4** analyst matrix / Axis workbench / recommended radar | Axis Mail+PDF, CMP kite→yfinance, **R2** for target-achieved closures | content hourly; quotes in-app | as-of shows NSE trading-day fallback |

### Sectoral Analytics (`?view=sectors`)
| Section / sub | Data inputs | Refresh | Stale behaviour |
|---|---|---|---|
| **S-1 Action board** | static | midnight | n/a |
| **S-2 pulse** (lead, impact matrix, KPI orbs, news) | sector narratives (**R3b stamps**), market breadth, RSS news | market 5 min; news 5 min; narrative weekly review | `NARRATIVE AGING` chip ≥21d |
| **S-2 companies / rankings** | yfinance universes + research scores | 5 min | `public_delayed`/`cached` pill |
| **S-2 lifecycle / structure / mece** | research-mapped anchors + scores (**R3b**) | weekly review | stamp shown |
| **S-3 benchmarks** | NSE EOD | 19:00 + in-app | `EOD`/`partial` pill, ≥2-closes rule |
| **S-3 investability / pestel / porter** | sector scores (**R3b**) + live breadth factor | breadth 5 min; scores weekly | null factors → "Unavailable" |
| **S-3 macro** | **R3a dials** + live squeeze | 18:45 wk | dials `cached` label |

### Market Intelligence (`?view=intelligence`)
| Section / sub | Data inputs | Refresh | Stale behaviour |
|---|---|---|---|
| **M-1 Action board** | static | midnight | n/a |
| **M-2** Newsletters / Axis / Podcasts | JXA Mail, SQLite Podcasts, **R5 summaries** | hourly + in-app | per-source counts + `stale` states |
| **M-3 Earnings** | Apple Calendar (scheduling) + **R2 verified results** | 4×/day season | pending rows stay pending; review-queue chip |
| **M-4 Calendar + Reminders** | SQLite + EventKit write-back | hourly + in-app | permission states surfaced |

### Health & Wellness (`?view=health`)
| Section / sub | Data inputs | Refresh | Stale behaviour |
|---|---|---|---|
| **H-1 Action board** | static (Incognito-gated) | midnight | n/a |
| **H-2** optimism / insights / guidance / guardrails | HealthKit snapshot + Shortcut overrides (**R4**) | 20:15 daily + iPhone push | overrides-freshness state replaces Livity banner |
| **H-3** overview + 7 metric pages | HealthKit categories, 7d/MTD averages | same; 8 PM operational-date roll | exact missing dates ribbon; never inferred |

### Report (`/report`)
All sources force-refreshed immediately before export (existing gate). Add R1/R2/R3a snapshots to the gate's
freshness map so the PDF can never print stale flows/dials/earnings as current.

## B4. Layouts, alignment & chart/plot configurations — status: **already independent; freeze, don't change**

- **Layouts/alignment:** every grid (4-tab nav, I-2 70/30, 2×2 management, 3-column health directions,
  ladder duels, non-scrolling health console with viewport fitter, A4 report geometry) is static CSS/TSX.
  No AI product touches rendering. **Remediation action: none required** — protect via the §B7 visual-regression
  suite so refactors can't drift them.
- **Charts:** all 24 chart types (Recharts donut/radar/bar/scatter/line + custom SVG treemap/gauges/dials/
  sparklines — full registry in the Master Prompt §11) are config-in-code: fixed domains (risk 0–5, radius
  ratios 18/31–73/96%, angles 90→−270, bubble Z 36–280, A/D reference lines at margin 20 / concentration 3.5,
  chart heights 286/480/620). **Only their *data props* change** under R1–R3; every axis, color rule, label
  placer, and tooltip formatter stays byte-identical. Add one `chart-config.md` doc freezing these constants as
  the review checklist for future chart PRs.

## B5. Integration configuration registry (target end-state)

| Integration | Mechanism | Config / permissions | Refresh |
|---|---|---|---|
| **Zerodha Kite** | Go kite-mcp-server (auto-start) + server-only MCP session | `KITE_MCP_PROJECT_DIR` / `KITE_MCP_URL`; daily ~06:00 IST re-auth (broker rule — cannot be automated away) | 5 min in-app |
| **Apple Mail** (Newsletters + Axis Research) | JXA via osascript | macOS **Automation** permission (Terminal/launchd → Mail); Mail.app running | hourly + in-app |
| **Apple Podcasts** | SQLite `MTLibrary.sqlite` + TTML cache | **Full Disk Access** for the service user | hourly |
| **Apple Calendar** | SQLite `Calendar.sqlitedb` | Full Disk Access | hourly |
| **Apple Reminders** | SQLite store (read) + EventKit Swift (write) | Full Disk Access + Reminders permission | hourly / on action |
| **Apple Health** | iCloud ZIP + HealthKit iPhone upload + "Health" Shortcut automation | pairing token (`npm run iphone:pair`); iPhone Shortcuts Automation 20:05 | 20:15 daily |
| **NSE (new)** | `fetch-fii-dii-flows.py`, `fetch-nse-earnings.py` (cookie-bootstrap headers) | none (public endpoints); polite rate limits + backoff | §B2 |
| **yfinance** | Python fetchers | none | 5 min / EOD |
| **HuggingFace (new)** | GGUF model → **Ollama** local endpoint | `HF_TOKEN` (only for gated models), `PODCAST_SUMMARIZER_MODEL`, `PODCAST_SUMMARIZER_URL`; document in `config/integrations.md` + `.env.example` | on content refresh; weekly drafts |
| **Tailscale** | Serve | tailnet login | always-on |

## B6. What AI agents remain *useful* for (but never required)

Deep narrative research beyond RSS (accepting R3c drafts), unusual-PDF KPI entry from the R2 review queue,
code changes, and the optional deep health audit. All become **conveniences invoked on demand**, with the
dashboard's freshness contract fully satisfiable by launchd + scripts alone.

## B7. Phased roadmap & acceptance tests

| Phase | Scope | Effort | Acceptance test |
|---|---|---|---|
| **P0 (immediate)** | R5 summarizer config; R6 scheduler install; R4b Shortcut automation | hours | Quit every AI app for 48h → Mail/Podcast digests advance hourly; podcast summaries generate; health target rolls at 8 PM |
| **P1** | R1 flows pipeline + `/api/flows/snapshot`; R3a macro dials | 1–2 days | Next trading day 18:35: flows donut shows today's provisional print, `live` badge, no agent ran |
| **P2** | R2 earnings pipeline + review queue; report gate extension | 2–4 days | A tracked company reports → row flips Reported with NSE URL autonomously; KPIs blank or XBRL-filled only; `earnings=verified` holds |
| **P3** | R3b provenance stamps + aging chips; R3c weekly drafts; AGENTS.md amendment; chart-config freeze doc + visual-regression snapshots | 2–3 days | `npm test` green; rendered-html isolation suite green; a 30-day-old narrative shows `NARRATIVE AGING`; AGENTS.md no longer *requires* Computer Use |

**Final acceptance ("independence certificate"):** with ChatGPT/Codex, Claude, and Cursor uninstalled for one
full trading week, the startup audit passes all rows (Kite live, Mail/Podcasts live, Earnings verified, Health
live, sectors live, flows live/cached-≤1-session), the freshness strip shows no silently stale source, and the
Investment Brief exports with every §1–§8 datum carrying a current as-of.

---

*As-built claims verified directly against source on 15 Aug 2026 (branch `Visual-Overhaul`): JXA/SQLite readers
in `scripts/content-digest-server.mjs`, Ollama adapter in `scripts/podcast-summarizer.mjs`, curl-based audit in
`scripts/refresh-dashboard-data.sh`, static `fiiDiiFlowsSnapshot`, baked `earningsCalendar` (33 reported rows),
placeholder cron in `config/scheduler/`, and the Codex Computer-Use requirement at `AGENTS.md:48`.*
