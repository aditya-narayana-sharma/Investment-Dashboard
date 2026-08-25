# Investment Dashboard Operating Instructions

## Complete refresh contract

Every start or restart must run `scripts/refresh-dashboard-data.sh` after the Flask gateway is reachable. A browser refresh is not a substitute for this startup audit.

The audit must validate payload semantics, not only HTTP success: Kite and sector snapshots require `status=live`, Mail and Podcasts require `status=live`, earnings requires `status=verified`, and Health requires `status=live` through the shared Asia/Kolkata operational target.

Treat the dashboard as current only after independently checking all of these sources:

- Kite: holdings, positions, orders, GTTs, margins, quotes, P&L, and classifications.
- Apple Mail: only `iCloud -> Newsletters` for the newsletter digest and only `iCloud -> Axis Research` for Axis research. Satya retrieval uses the same two-mailbox invariant — never a third mailbox. Named families inside Newsletters (sender display name, email domain, subject prefix) are Axis Mutual Fund (`axis_mutual_fund`; Axis MF / Axis AMC research, not Axis Direct brokerage promo or contract-note/KYC mail), Groww Digest (`groww_digest`), and Flipboard Tech Briefing (`flipboard_tech`). Remaining Newsletters senders auto-register as `newsletter_other` catalog rows on digest refresh.
- Apple Reminders: read every item in the exact `Job 🔍` and `Earnings` lists. Preserve incomplete items as actionable; completed items are evidence only and must not be silently restored.
- Apple Calendar: read earnings and all other events through D-1, then group the dashboard summary by topic. Calendar entries are scheduling evidence, not proof that a result was published.
- Health reconciliation: use the **"Health" Apple Shortcut** and its **Health Stats** export as the daily reconciliation source, imported via `scripts/import_health_shortcut.py` into `artifacts/private/health-overrides.json` (the file `scripts/import_apple_health.py --overrides` already consumes). Run the Shortcut for historical data; if a date is missing, run it again for that date. The Apple Notes Health Daily and Health Daily v2 notes are **deprecated** and must not be run, displayed, or referenced. HealthKit `export.xml` remains the primary detailed source for Sleep, Heart, and Respiratory.
- iPhone Mirroring: verify Apple Health, Lifesum, and Guava through the Health operational target. Cover Activity, Sleep, Heart, Respiratory, Mobility, and Nutrition for each missing date, plus 7-day and 30-day comparisons. Body Measurements and Hearing remain excluded.
- Apple Podcasts: latest eligible episode descriptions or transcripts.
- Earnings: reported events through the latest completed day, using company investor relations or NSE first and reputable financial reporting as a cross-check. Keep unpublished KPI fields blank.
- Sectors: every configured sector snapshot, constituent price history, rankings, and freshness metadata.
- Health: use `healthTargetDate(nowIST)` everywhere. From 20:00-23:59 use the current date (`D_EVENING`); from 00:00-01:59 use the prior evening's date (`D_OVERNIGHT`); from 02:00-19:59 use the previous date (`D_MINUS_1`). Calculate 7-day and 30-day comparisons ending on that target. Never infer missing values; show exact missing dates and stale status.
- PDF: refresh Kite, Mail, earnings, and all sector snapshots immediately before export.

If any source fails, preserve the last validated snapshot, label it `Stale`, `Cached`, or `Unavailable`, and name the failed source. Never claim that the complete dashboard is updated when any audit row failed.

Do not render a standalone or persistent "Startup refresh audit failed" banner.
The audit remains mandatory, but its result is communicated through Settings /
Integrations source freshness (not a strip on the main canvas), relevant section
states, and
`~/Library/Logs/PortfolioIntelligence/startup-refresh.log`. When every required
source passes, no failure warning remains visible.

Mail and Podcast digests must contain substantive research or editorial content
only. Exclude promotions, advertisements, registration and purchase calls to
action, follow/subscribe requests, contact details, phone numbers, email
addresses, and website links from displayed summaries. Deduplicate Podcasts by
normalized episode title. Label Podcast evidence as a transcript only when a
local transcript was actually available; otherwise label it as a description.

Satya indexes eligible Mail and Podcasts into `artifacts/private/satya/corpus.sqlite`
(FTS5) and writes `artifacts/private/satya/catalog.json` after a successful digest
read. Backfill (`scripts/satya-backfill.sh`, default 90 days via `SATYA_BACKFILL_DAYS`)
pages oldest-unseen → newest into that corpus only — it must not dump historical
mail into a Market Intelligence browsing wall. Startup digest ingest
(`ingestSatyaDigestRefresh`) is not that backfill; run `scripts/satya-backfill.sh`
separately. Podcasts are supporting evidence
(`podcasts`). Satya is M-2 (the full Live Intelligence canvas) plus a global
companion orb — not a fifth Market Intelligence section (no M-5). Machine-drafted
answers are never a source for numbers; Mail, Axis Research PDFs, podcasts, and
independently verified IR/NSE earnings KPIs remain the source of truth. Open PDF,
Mail, episode, and earnings links only inside Satya replies, as a combined compact
icon cluster (mail / pdf / podcast / earnings) — not a citation wall of titles or
URLs, and not digest-style “Open PDF” rows outside replies. Voice and
`POST /api/satya/chat` are operator-Mac only (localhost Flask gateway); LAN and
Tailscale clients cannot post chat. An empty corpus refuses rather than inventing
research; a populated corpus with zero FTS hits refuses as a no-match (do not
ask the operator to refresh mail). Retrieval uses only the two mailboxes above
plus indexed Axis PDFs, podcasts, and verified earnings prints (`earnings` family
when KPIs exist — unpublished fields stay blank). Filters selected families in SQL
before the FTS window. Axis Research subjects
classify into 28 named categories plus `other_research` (`app/satya/axis-categories`).
Satya retrieval accepts `axisCategories[]` (SQL before the FTS window); default is
every research category except `live_webinars`. Webinars are classified and indexed
but excluded from default retrieval unless the operator selects that chip. Displayed
webinar summaries still strip CTA/promo copy. Axis MF subject
matching is a prefix (`^` / leading Axis MF|AMC branding), not a mid-subject
mention from another sender. `GET /api/satya/sources` returns family counts and Axis
category counts only (no sender emails). Digest ingest failures are recorded on Satya status
(`corpus.ingestError`) instead of being swallowed.

Before importing Apple Health, validate the newest ZIP in the configured iCloud
Health folder and confirm that it contains
`apple_health_export/export.xml`. Extract it atomically only when valid. If the
newest archive is corrupt or incomplete, retain the last validated extracted
XML and expose the archive failure as a fallback source state; never replace a
valid Health snapshot with a failed extraction.

## Required run sequence

1. Refresh source-backed files and earnings rows before building when newly reported data exists.
2. For a Codex-assisted run, use Computer Use to inspect Mail, Reminders, Calendar, Notes, and iPhone Mirroring before claiming those sources are current. A raw web-service restart cannot invoke Codex plugins; it must mark an unrefreshed saved snapshot stale.
3. Run `npm run lint`, `npm run build`, and `npm test`.
   `npm test` runs the **complete** suite (`npm run test:node` → all
   `tests/*.test.mjs` under `--experimental-strip-types` plus the
   `tests/helpers/register-ts-ext.mjs` resolver hook, then the Python
   Health import tests). Never run `node --test` on these files without
   that hook: extensionless TypeScript imports such as
   `app/strategy/graph-types` fail with `ERR_MODULE_NOT_FOUND`, which
   looks like broken product code but is only a missing loader.
4. Start the canonical macOS service with `scripts/run-dashboard-service.sh`.
5. Inspect `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`.
6. Verify the Mac URL and Tailscale URL return the full dashboard.
7. Report exact stale or unavailable sources to the user.

## Data integrity

- Prefer primary sources and include source URLs and as-of dates.
- Do not fabricate live, Mail, Podcast, financial, or Health data.
- Do not silently replace failed live values with static values.
- Current date-sensitive claims require source verification.

## Workspace and industry-filter invariants

- Keep the six top-level workspaces separate: Investment, Sectoral Analytics,
  Market Intelligence, My Feed, Algorithm Canvas, and Strategies.
  Preserve each workspace's collapsible state and URL selection
  (`?view=investment|sectors|intelligence|health|builder|strategies`). Alias
  `?view=market-intelligence` resolves to Market Intelligence. Alias
  `?view=algorithm-canvas` resolves to Algorithm Canvas (`builder`) and the
  canvas section (`?view=builder&section=canvas`). Alias
  `?view=strategy-library` resolves to Strategies (`?view=strategies`). Alias
  `?view=feed` (and `?view=my-feed`) resolves to My Feed (`health`). Canonical
  My Feed URLs stay `?view=health`; `?view=health` remains a supported alias.
- Use `DailyKanbanBoard` as the only action-board implementation across all six
  workspaces. The Investment I-1 three-lane layout is canonical: summary header,
  `To Do Today`, `Monitor`, and `Completed Today` lanes, full action cards,
  compact completed rows, and compact empty lanes must remain visually
  identical. Do not add compact, single-lane, or workspace-specific variants.
- Every workspace must expose the same complete three-lane Daily Action Board:
  `To Do Today`, `Monitor`, and `Completed Today`. Do not split lanes across
  pages or replace them with oversized Kanban variants. Clicking an action
  moves it to Completed Today with strike-through styling; retain that state
  through the local day and clear completed items at local midnight.
- **Algorithm Canvas** (`?view=builder`, sections `board` | `canvas` | `json`)
  is a fifth workspace. Nav label is Algorithm Canvas; chrome title inside the
  workspace is Algorithm Builder. Tabs are Action Board, Canvas, and JSON.
  Action Board uses the shared `DailyKanbanBoard` only. Do not add industry
  filters, sector-dimming, earnings, or the Market Intelligence digest here.
- **Strategies** (`?view=strategies`, sections `y1` | `y2`, alias
  `?view=strategy-library`) is a sixth workspace. Nav label and chrome title
  are Strategies. Tabs are Action Board and Library. Action Board uses the
  shared `DailyKanbanBoard` only. The library shows Composer-public
  `StrategyTreeV1` reconstructions (US symbols as published). Do not add
  industry filters, sector-dimming, earnings, or the Market Intelligence
  digest here. Do not put Composer trees into My Feed, Sectors, or Intelligence.
- Keep **My Feed** (nav label; URL key `health`, alias `?view=feed`) as a
  URL-section console with H-1 Action Board, H-2 Daily Optimism, H-3 Vital
  Metrics, and H-4 Calendar + Reminders (`?view=health&section=h4`). H-1–H-3
  keep their HealthKit meaning and operational-day target. Dense Health content
  belongs on explicit URL-backed sub-pages. Adding H-4 changes the former
  three-panel console: Calendar + Reminders is the fourth exclusive section,
  not an industry-filtered feed. Incognito must gate thumbnail values,
  drill-down values, source/archive metadata, actions, recommendations,
  accessibility text, and H-4 calendar/reminder rows. H-3 Vital Metrics groups
  KPIs into three comparison-direction collapsible rows (favourable / context
  dependent / unfavourable), matching the Investment BUY / HOLD group pattern,
  while retaining original Health category colour accents on each tile.
  Metrics without a selected-period average remain visible under Context
  dependent (no dedicated unavailable column). Body Measurements and Hearing
  remain excluded. Do not add industry filters to My Feed.
- The shared Sectoral Analytics industry toggle is an **S-2-only control**.
  `selectedSectorId` may drive S-2 matrices, charts, rankings, company
  composition, and linked analytical panels, but it must not be passed into
  Market Intelligence or S-3 components.
- **Market Intelligence is always complete and unfiltered** and owns exactly
  three top-level sections: M-1 Action Board, M-2 Satya, and M-3 Earnings
  Calendar. Workspace URL stays `?view=intelligence`. Satya is the M-2 canvas
  (full-width LLM chat + push-to-talk with multi-select source chips: Axis 28
  research categories, newsletter families Axis MF / Groww / Flipboard / Other,
  Podcasts, and verified earnings KPIs). Newsletters, Axis Research mail and
  PDFs, Podcasts, and verified IR/NSE earnings KPIs remain Satya corpus /
  retrieval source of truth — do not render those as M-2 collapsible digest
  reading lists. Satya is not a fifth section (no M-5). Calendar + Reminders
  is not in this workspace. Do not add an industry filter banner, sector-match
  count, excluded-industry message, dimming, or hidden records. Sectoral
  Analytics must not host a digest or Market Intelligence promo/cross-link.
  M-1 intelligence actions are generated each IST day / last NSE trading day
  from the live digest snapshot, earnings snapshot, and Satya corpus as-of —
  not a static “overnight themes” catalog. If a source is stale, the action
  says so; never invent KPIs. Completed-today persistence is unchanged.
- **M-3 Earnings is the sole rendered complete earnings-calendar location.**
  Every tracked event remains visible, enabled, and selectable regardless of
  the S-2 industry selection. Apple Calendar Earnings rows are scheduling
  evidence only; only independently verified IR/NSE results may populate KPI
  values or reported state. Do not duplicate earnings in Sectoral Analytics,
  and do not add `sector-dimmed`, `sector-match`, `aria-disabled`,
  or sector-gated click behavior to earnings events.
- The S-3 Decision Framework may remain sector-specific only through its own
  local selector. Its state must not read or mutate the S-2 industry selection.
- Dimming classes and filter status UI are valid only inside S-2. When an S-2
  industry changes, verify Market Intelligence and S-3 contain zero unintended
  dimmed descendants and M-3 contains zero disabled earnings controls.
- PDF/report generation remains independent of the currently selected S-2
  industry unless the report explicitly labels a chart as a selected-industry
  view.

## Localhost vs Mac App (mandatory agent sequence)

When the work is **localhost** (`http://127.0.0.1:3000` or Flask `http://127.0.0.1:5050`) **versus Stratji.app** (WKWebView, native liquid-glass overlay, splash/hydrate, workspace/section chrome, Dock vs `apple-app/build/Stratji.app`), agents **must** run this sequence **in order** and **must not skip a step**:

1. **`$project-status`** — inventory both surfaces (web chrome vs native overlay). Status artifacts go in `Project-Status/`. Do not implement in this step.
2. **`$auditor`** — thermonuclear audit of the native/web chrome and launch path. Write under `Code-Reviews/`. Do not implement in this step.
3. **`$rca-agent`** — root-cause localhost vs Mac drift. Write under `RCAs/` and a remediation plan under `Plans/`.

Implement chrome or native fixes **only after** those three artifacts exist, and only when the operator asks to implement. Verify both localhost and Stratji.app. Do not treat Dock or `~/Applications/Stratji.app` as current if `apple-app/build/Stratji.app` is newer. Do not kill a healthy Flask listener on `:5050`.

## Required UI verification

After changing Sectoral Analytics or Market Intelligence behavior:

1. Run `npm run lint`, `npm run build`, and `npm test` (the complete suite —
   see "Required run sequence" step 3).
2. Open `?view=sectors`, select a different S-2 industry, and confirm S-2 updates.
3. Open `?view=intelligence` and confirm Market Intelligence has no
   `.sector-intelligence-filter` or `.sector-dimmed` descendants, shows Satya
   source chips (not Newsletter / Axis / Podcast digest walls), exposes M-1
   Action Board, M-2 Satya, and M-3 Earnings Calendar only, and has no M-4.
4. Confirm Sectoral Analytics exposes S-1 through S-3 only, with no S-4,
   earnings grid, digest, promo, or cross-link.
5. Confirm the S-3 local Decision Framework selector changes only its own cards,
   and M-3 has no dimmed or disabled earnings controls.
6. Verify both the localhost and private Tailscale URLs and check the browser
   console for errors.
