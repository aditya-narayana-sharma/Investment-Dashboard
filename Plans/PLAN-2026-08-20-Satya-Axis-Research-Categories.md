# Plan — Satya Axis Research subject categories (28 + other)

**Verdict: NOT READY to implement.** Classifier + UI must not ship against empty/cached Axis as if the 28 buckets were live.

Checked **20 Aug 2026, 00:42 IST**. Do not commit from this pass. Do not invent KPIs.

---

## 1. Readiness evidence (re-checked this session)

| Signal | Value | Ready? |
|---|---|---|
| `content-snapshot.json` `sources.axisResearch.status` | **`cached`** | No |
| `count` / `displayedCount` | 17 / 14 | Partial retained window |
| `observedAt` | `2026-08-19T17:58:43.736Z` (~23:28 IST 19 Aug) | Yesterday’s last live-ish write |
| Snapshot message | `iCloud Axis Research timed out after 90s Retaining the last validated axisResearch snapshot.` | Full ingest still failing |
| Digest `asOf` / overall status | `20 Aug 2026, 12:41 am` / `partial` | Mail newsletters live; Axis not |
| Satya corpus `axis_research` count | **0** (109 other docs: 76 newsletter_other, 29 podcasts, 2 Axis MF, 1 Groww, 1 Flipboard) | Satya cannot retrieve Axis |
| `lastDigestIngestAt` | `2026-08-19T19:04:48.555Z` — ingest skips Axis when the mailbox read rejects | Expected: `ingestSatyaDigestRefresh({ axisResearch: null })` |
| Mail.app | PID 69349, ~4–5% CPU, up ~1h27m | Not hung, but JXA-saturated |
| Content digest `/health` | `{"status":"ok"}` after earlier port-3003 failures | Server up |
| Full Axis JXA (bodies + `source()` + historical Target Achieved) | Timed out again this session (90s). Startup listed `axis` completed because the **cached** row was retained. | Not a live mailbox read |
| Subject-only 30-day JXA | Killed at 25s (`PROBE_TIMEOUT`) | Unsafe for wide windows while Mail is warm |
| Subject-only **3-day** JXA | **Succeeded in 5.0s** — `totalCount=160`, sampled 80 subjects | Subjects classifiable; **not** `status=live` |

**READY would require:** Axis source `status=live` **or** a successful **digest-grade** mailbox read this session (bodies + filter + ingest), **and** subjects we can classify. A subject-only probe is evidence for the matcher, not a live digest.

Cached-only 14/17 from 16–19 Aug is **not** enough to claim live categories. The retained snapshot **can** match a handful of subjects (see §3), but Satya’s Axis family is empty, so briefing chips would be decorative.

### Why the full Axis read times out

`scripts/content-digest-server.mjs` `axisMailScript` (90s budget):

1. Lists the rolling 3-day window (`whose` dateReceived).
2. For **every** hit, calls `properties()`, `content` (4500 chars), attachment names, and `message.source()` for PDF anchors.
3. Then scans the **entire mailbox** for `subject contains "Target Achieved"` with the same heavy path.

This session’s 3-day window is **160 messages**, not the 17 last counted as Axis research. The mailbox is mixed: Substack, personal-loan, ads-account, Warp, COMEET, ISA Automation Summit, Axis login access codes, Options Greeks promos, plus duplicated Axis subjects (same “Top Conviction Ideas …” / “Result Updates …” row 4–14 times). `isAxisResearchMail` filters **after** the expensive read, so contaminants burn the 90s budget.

Newsletters can go live while Axis stays cached because Newsletters split list vs body and tolerate body timeout.

### Mail / JXA this session (do not start another full Axis read until idle)

- ~00:40 IST: Newsletters osascript still running, then Axis full script started (`Refreshing iCloud Axis Research…`).
- ~00:41 IST: full Axis read timed out; snapshot rewritten still `cached` / `observedAt` unchanged.
- ~00:42 IST: Mail idle enough for a 3-day **subject-only** probe (no content, no `source()`, no historical Target Achieved).

**Prerequisite before any category UI is honest:** make Axis listing cheap (sender/subject first, fetch bodies only for `isAxisResearchMail` hits, cap Target Achieved, dedupe Message-ID). Until that lands, 90-day Satya backfill will also stall on Axis.

---

## 2. Existing matcher vs requested 28

Do **not** invent a parallel matcher. Today there are **two copies** of the same 10-rule list:

- `scripts/axis-digest-links.mjs` `TOPIC_RULES` / `axisTopicGroup` (ingest + PDF archive switch)
- `app/dashboard/digest-newsletter-groups.ts` `AXIS_TOPIC_RULES` / `axisTopicFromTitle` (UI fallback)

Unmatched titles stem-split on `[-|:]` → that is how **Top Conviction Ideas** already groups in the digest **without a rule**.

User spelling: Greek **Α** in “Axis Αlpha” → treat as **Axis Alpha**. “Sector Oppportunity” → **Sector Opportunity**.

| # | Requested label | Canonical `id` | Existing `TOPIC_RULES` | Gap |
|---|---|---|---|---|
| 1 | Result Update | `result_update` | `Result Updates` — `\bresult updates?\b\|\bresult update\b` | Rename; too greedy vs #20 |
| 2 | Sector Update | `sector_update` | — | Missing |
| 3 | Auto Monthly Sales Volume | `auto_monthly_sales_volume` | — | Missing |
| 4 | Earnings Preview | `earnings_preview` | — | Missing; must not steal Result Preview |
| 5 | Axis Alpha | `axis_alpha` | `Axis Alpha` — `\baxis alpha\b` | Add NFKC + Greek `Α`/`α` |
| 6 | Company Update | `company_update` | `Company Update` — `company update` **or `annual analysis`** | Split #26 out |
| 7 | Axis Punch | `axis_punch` | **`Punch`** — `\baxis punch\b\|\bpunch\b` | Rename; `\bpunch\b` is too broad |
| 8 | Axis Top Picks | `axis_top_picks` | — | Missing; must not steal Top Conviction Ideas |
| 9 | Book Profits | `book_profits` | — | Missing |
| 10 | Call Closure | `call_closure` | — | Missing |
| 11 | Result Preview | `result_preview` | — | Missing; order vs #4 |
| 12 | Daily Derivatives Insights | `daily_derivatives_insights` | — | Missing; order vs weekly |
| 13 | Daily Morning Note | `daily_morning_note` | `Daily Morning Note` | Keep; already good |
| 14 | Daily Stock Derivative Lens | `daily_stock_derivative_lens` | — | Missing |
| 15 | Daily Technical Outlook | `daily_technical_outlook` | `Daily Technical Outlook` — also `\btechnical outlook\b` | Drop generic; it steals #18 |
| 16 | Sector Opportunity | `sector_opportunity` | — | Missing (`Oppportunity` typo) |
| 17 | Monthly Quant Report | `monthly_quant_report` | **`Monthly Quant`** — `monthly quant` / `quant report` | Rename |
| 18 | Monthly Technical Outlook & Picks | `monthly_technical_outlook_picks` | — | Stolen today by #15’s generic matcher |
| 19 | Pick of the Week | `pick_of_the_week` | `Pick of the Week` | Keep |
| 20 | Quarterly Result Updates | `quarterly_result_updates` | Collapsed into Result Updates | Needs a **more specific** rule **before** #1 |
| 21 | Sector Seasonality Report | `sector_seasonality_report` | — | Missing |
| 22 | Target Achieved | `target_achieved` | `Target Achieved` | Keep |
| 23 | Top Conviction Ideas | `top_conviction_ideas` | Stem fallback only | Add explicit rule |
| 24 | Weekly Derivatives Insights | `weekly_derivatives_insights` | — | Missing |
| 25 | Weekly Technical Picks | `weekly_technical_picks` | — | Missing |
| 26 | Axis Annual Analysis | `axis_annual_analysis` | Lumped into Company Update | Split |
| 27 | Important Update | `important_update` | — | Missing; do not swallow login/KYC |
| 28 | Live Webinars | `live_webinars` | **Dropped** by `\bwebinar\b` in `NON_RESEARCH_SUBJECT` + `PROMOTIONAL_MESSAGE` | Classify; exclude from **default** Satya retrieval |
| — | *(unmatched Axis research)* | `other_research` | Stem or `"Other research"` | Stable id + color |
| — | Event Updates / monetary policy | → `other_research` | Extra rule **not** in the 28 | Do not keep as a first-class chip |

### Cached snapshot (14 items) vs the 28

| `topicGroup` today | Count | Maps to | Notes |
|---|---|---|---|
| Top Conviction Ideas | 4 | `top_conviction_ideas` | Stem only today |
| Daily Technical Outlook | 3 | `daily_technical_outlook` | |
| Daily Morning Note | 3 | `daily_morning_note` | |
| Result Updates | 2 | `quarterly_result_updates` (subject is `Result Updates - Q1FY27: …`) | Not singular Result Update |
| Punch | 1 | `axis_punch` | `Axis Punch - SBI Cards…` |
| Build your retirement fund with Axis Direct NPS | 1 | **should not be a category** | `isNonResearchSubject` looks for `nps account`, not bare NPS |

**~22 of 28 categories have zero rows in the retained 3-day digest.** A 3-day subject probe also showed only Conviction / Technical Outlook / Morning Note / Result Updates (plus login codes, STARK, Options Greeks, and non-Axis junk). Shipping 28 colored groups now would be empty chrome.

### Suggested match order (most specific first)

Normalize subject: Unicode NFKC, map Greek `Α`/`α` → `A`/`a`, collapse whitespace, strip `Re:`/`Fwd:`.

Then test in this order (sketch, not implemented):

1. `live_webinars` — `\blive\s+webinars?\b|\bwebinar\b`
2. `quarterly_result_updates` — `\bquarterly result updates?\b` or `\bresult updates\b` (plural pack)
3. `monthly_technical_outlook_picks` — `\bmonthly technical outlook\b`
4. `daily_technical_outlook` — `\bdaily technical outlook\b` only
5. `daily_stock_derivative_lens` — `\bstock derivative lens\b`
6. `daily_derivatives_insights` — `\bdaily derivatives insights?\b`
7. `weekly_derivatives_insights` — `\bweekly derivatives insights?\b`
8. `weekly_technical_picks` — `\bweekly technical picks?\b`
9. `auto_monthly_sales_volume` — `\bauto monthly sales\b|\bmonthly sales volume\b`
10. `monthly_quant_report` — `\bmonthly quant\b|\bquant report\b`
11. `sector_seasonality_report` — `\bsector seasonality\b`
12. `sector_opportunity` — `\bsector opportunity\b`
13. `sector_update` — `\bsector update\b`
14. `earnings_preview` — `\bearnings preview\b`
15. `result_preview` — `\bresult preview\b`
16. `result_update` — `\bresult update\b` (singular)
17. `axis_annual_analysis` — `\b(?:axis )?annual analysis\b`
18. `company_update` — `\bcompany update\b`
19. `axis_top_picks` — `\baxis top picks?\b`
20. `top_conviction_ideas` — `\btop conviction ideas?\b`
21. `pick_of_the_week` — `\bpick of the week\b`
22. `axis_alpha` — `\baxis alpha\b` after Greek fold
23. `axis_punch` — `\baxis punch\b` (not bare `punch`)
24. `book_profits` — `\bbook profits?\b`
25. `call_closure` — `\bcall closure\b`
26. `target_achieved` — `\btarget achieved\b`
27. `daily_morning_note` — existing morning-note / trade-setup pattern
28. `important_update` — `\bimportant update\b` and Axis “Update -” research notes **after** KYC/login filters
29. else `other_research`

PDF archive matching in `matchAxisResearchPdf` currently `switch`es on labels `Punch`, `Monthly Quant`, `Daily Morning Note`, …. When labels become the 28 names, update that switch to **ids** (or keep a `pdfTopic` alias). Do not break dated MorningNote / TechnicalOutlook basename matching.

---

## 3. Data model

Canonical catalog (scripts import the `.mjs` twin; app imports `.ts` re-export):

```ts
type AxisResearchCategoryId =
  | "result_update" | "sector_update" | /* …28… */ | "live_webinars"
  | "other_research";

type AxisResearchCategory = {
  id: AxisResearchCategoryId;
  label: string;          // exact user labels
  matchers: RegExp[];     // subject-only
  colorToken: string;     // CSS var, e.g. --axis-cat-axis-punch
  defaultRetrieve: boolean; // false only for live_webinars
};
```

| Store | Field | Notes |
|---|---|---|
| `DigestItem` | `axisCategory: AxisResearchCategoryId` **and** keep `topicGroup` as the **label** for existing collapsibles | One classifier; two projections |
| Satya `documents` | `axis_category TEXT` (nullable; set for `family=axis_research`) | Index `(family, axis_category, received_at)` |
| Satya FTS | unchanged; filter is SQL on `documents` **before** `LIMIT` | Same pattern as `familySql` |
| Catalog JSON | optional `axisCategories: [{ id, label, count }]` | Family counts stay; no sender emails |

Unmatched Axis research → `other_research` (defined color). Non-Axis mail never gets an Axis category.

---

## 4. Satya retrieval

Mirror `families[]`:

- `POST /api/satya/chat` and `retrieveSatyaPassages` accept optional `axisCategories: AxisResearchCategoryId[]`.
- `searchSatyaCorpus`: `AND d.axis_category IN (…)` **after** family allow-list, **before** FTS window / `LIMIT 80`.
- Default when the client sends **no** `axisCategories`: all ids with `defaultRetrieve: true` (everything except `live_webinars`). Selecting Axis Research as a family without category chips still uses that default.
- Explicitly selecting **Live Webinars** includes `live_webinars`. Empty selection must not fall through to “all including webinars”.
- Machine-drafted answers remain non-numeric; extractive digest stays source of truth.
- Empty corpus still refuses. Populated corpus + zero FTS hits = no-match (do not ask to refresh mail).
- Operator-Mac only for chat (unchanged). Mailboxes remain **only** Newsletters + Axis Research.

Companion orb (`SatyaPresence`) should pass the same `axisCategories` as the briefing chips when the operator has focused them.

---

## 5. UI (only after Axis is live **or** a successful ingest this session)

Market Intelligence stays **unfiltered by S-2**. This is Axis-topic focus, not sector dimming. No `.sector-dimmed`, no industry banner on M-2.

### M-2 Axis Research panel

- Group with the 28 labels + `Other research`, color **accent** (left rail / chip border), not rainbow fills on the whole card.
- Multi-select category chips above the list. Unfiltered default = all research categories **except Live Webinars**.
- Keep PDF / Open in Mail actions. Do not invent recommendation KPIs.
- Freshness copy must still say **Cached** when `sources.axisResearch.status !== "live"`.

### Satya briefing + companion

- Keep existing **family** chips.
- When `axis_research` is selected, show the 28+other category chips (same multi-select / webinar default).
- Counts from corpus `GROUP BY axis_category`, not from the 14-row cached digest (otherwise chips lie).

### Color system

- One hue per category as `--axis-cat-*` in `app/dashboard/satya.css` (and dark/sepia tokens if those sheets override).
- Accessible on dark: accent ≥ 3:1 vs panel background; chip text stays `--ink`.
- Related families may share a **hue neighborhood** (dailies / weeklies / conviction / closures) but each id still has its own token. Do not hash 28 colors from `SENDER_GROUP_COLORS`.

---

## 6. Live Webinars exception

| Surface | Behavior |
|---|---|
| Classifier | Always assign `live_webinars` when the subject matches |
| M-2 digest **summaries** | AGENTS.md still forbids webinar/CTA promo in displayed bullets. Show the group (titles + date) with empty/stripped summary rather than “register now” copy |
| `isNonResearchSubject` | Stop treating **all** webinars as drop-on-floor; keep KYC / contract-note / login / NPS-account filters |
| `PROMOTIONAL_MESSAGE` / `isPromotionalMessage` | Must not delete the row before classification. Promo stripping applies to **bullets**, not to the category bucket |
| Satya index | Index title + sanitized non-CTA text with `axis_category=live_webinars` so an explicit chip can retrieve |
| Default Satya retrieval | **Exclude** `live_webinars` unless the operator selects that chip |
| Prompt | Webinar hits are invitations, not research truth |

---

## 7. Ingest / backfill (blockers, in order)

1. **Cheap Axis list path** (required for `status=live`): subject + sender + Message-ID + date first; body/`source()` only for Axis Direct/Securities research senders; dedupe Message-ID; do not pull 160 duplicate/contaminant bodies. Cap or separately timeout historical Target Achieved.
2. On live digest refresh, set `item.axisCategory = classifyAxisCategory(title)` next to `topicGroup`.
3. `upsertSatyaDocument` persist `axis_category`. Migrate existing SQLite with `ALTER TABLE … ADD COLUMN` (corpus is private/rebuildable; still migrate so a 90-day backfill is not mandatory to start).
4. `ingestSatyaDigestRefresh` only indexes Axis when the read **fulfilled** — that is why count is 0. After a live Axis read, digest ingest should populate Axis without waiting for backfill.
5. `scripts/satya-backfill.sh` (90 days) pages oldest-unseen → newest into corpus **only** (never dumps history into M-2). Classify category on insert. Do not run a heavy backfill until step 1 is fixed.
6. Extend `isNonResearchSubject` so NPS brokerage promos and login access codes never become `other_research` / `important_update`.

---

## 8. Tests

New `tests/axis-categories.test.mjs` (or extend `tests/axis-digest-links.test.mjs`):

- One **sample subject per** of the 28 ids + `other_research`.
- Order traps: `Monthly Technical Outlook & Picks` ≠ Daily Technical Outlook; `Axis Annual Analysis` ≠ Company Update; `Result Updates - Q1FY27…` → quarterly pack; `Result Update: …` → singular; `Axis Punch` ≠ bare “punch” in another phrase; Greek `Axis Αlpha`.
- Webinar subject classifies as `live_webinars` and is **absent** from default retrieve allow-list.
- Retrieval: `axisCategories: ["axis_punch"]` cannot return a morning-note row; default retrieve omits webinars; explicit webinar select includes them.
- PDF matcher still resolves dated MorningNote / TechnicalOutlook files after label rename.
- `tests/rendered-html.test.mjs`: M-2 has no sector-dimming; category chips are Axis-topic only.

Do not add tests that require a live mailbox.

---

## 9. File list (when READY)

| File | Change |
|---|---|
| `app/satya/axis-categories.ts` | Canonical catalog + `classifyAxisCategory` |
| `app/satya/axis-categories.mjs` | Twin for scripts (or `.ts` imported via existing strip-types helper — prefer one implementation) |
| `scripts/axis-digest-links.mjs` | Replace `TOPIC_RULES`; `axisTopicGroup` = category **label**; PDF switch on **id** |
| `app/dashboard/digest-newsletter-groups.ts` | Delete duplicate `AXIS_TOPIC_RULES`; import catalog |
| `scripts/axis-mail-filter.mjs` | Webinar classify-vs-drop; tighten NPS/login |
| `scripts/content-digest-server.mjs` | Cheap Axis list; set `axisCategory`; stop dropping webinar rows before classify |
| `scripts/satya-corpus.mjs` | Column + SQL filter + upsert |
| `scripts/satya-classify.mjs` | Do not treat webinar-only as skip-index if category is `live_webinars` |
| `app/content-types.ts` | `axisCategory` on `DigestItem`; optional chat field |
| `app/satya/retrieve.ts` / `app/satya/chat.ts` | `axisCategories[]` |
| `app/api/satya/chat/route.ts` / `app/dashboard/satya-client.ts` | Parse + send filter |
| `app/dashboard/SatyaBriefingRoom.tsx` / `SatyaPresence.tsx` | Category chips |
| `app/dashboard/IntelligenceDigest.tsx` / `digest-mail-groups.tsx` | Group + accent by category |
| `app/dashboard/satya.css` (+ theme sheets if needed) | `--axis-cat-*` accents |
| `tests/axis-categories.test.mjs` | Coverage table |
| `tests/axis-digest-links.test.mjs` | Update Punch / Quant labels |
| `tests/satya-api.test.mjs` / `tests/satya-corpus.test.mjs` | Filter + default webinar exclusion |
| `AGENTS.md` | Classify webinars; default Satya exclusion; still strip CTA from displayed summaries |

---

## 10. Implementation gate (do not skip)

Implement **only** when all of these are true:

1. `sources.axisResearch.status === "live"` (or this session’s digest-grade Axis read fulfilled, not subject-only).
2. Satya corpus `axis_research` count **> 0** after ingest (or a backfill that used the cheap list path).
3. Shared classifier exists and unit tests cover all 28 sample subjects.

Until then: keep this plan; do not half-implement 28 colored empty groups on the 14-row cached snapshot.
