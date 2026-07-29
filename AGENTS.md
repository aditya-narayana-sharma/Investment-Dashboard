# Investment Dashboard Operating Instructions

## Complete refresh contract

Every start or restart must run `scripts/refresh-dashboard-data.sh` after the Flask gateway is reachable. A browser refresh is not a substitute for this startup audit.

The audit must validate payload semantics, not only HTTP success: Kite and sector snapshots require `status=live`, Mail and Podcasts require `status=live`, earnings requires `status=verified`, and Health requires `status=live` through the shared Asia/Kolkata operational target.

Treat the dashboard as current only after independently checking all of these sources:

- Kite: holdings, positions, orders, GTTs, margins, quotes, P&L, and classifications.
- Apple Mail: only `iCloud -> Newsletters` for the newsletter digest and only `iCloud -> Axis Research` for Axis research.
- Apple Reminders: read every item in the exact `Job 🔍` and `Earnings` lists. Preserve incomplete items as actionable; completed items are evidence only and must not be silently restored.
- Apple Calendar: read earnings and all other events through D-1, then group the dashboard summary by topic. Calendar entries are scheduling evidence, not proof that a result was published.
- Apple Notes: read only the exact ` Health Daily` note for wellness reconciliation. Never run, display, or reference `Health Daily v2`.
- iPhone Mirroring: verify Apple Health, Lifesum, and Guava through the Health operational target. Cover Activity, Sleep, Heart, Respiratory, Mobility, and Nutrition for each missing date, plus 7-day and 30-day comparisons. Body Measurements and Hearing remain excluded.
- Apple Podcasts: latest eligible episode descriptions or transcripts.
- Earnings: reported events through the latest completed day, using company investor relations or NSE first and reputable financial reporting as a cross-check. Keep unpublished KPI fields blank.
- Sectors: every configured sector snapshot, constituent price history, rankings, and freshness metadata.
- Health: use `healthTargetDate(nowIST)` everywhere. From 20:00-23:59 use the current date (`D_EVENING`); from 00:00-01:59 use the prior evening's date (`D_OVERNIGHT`); from 02:00-19:59 use the previous date (`D_MINUS_1`). Calculate 7-day and 30-day comparisons ending on that target. Never infer missing values; show exact missing dates and stale status.
- PDF: refresh Kite, Mail, earnings, and all sector snapshots immediately before export.

If any source fails, preserve the last validated snapshot, label it `Stale`, `Cached`, or `Unavailable`, and name the failed source. Never claim that the complete dashboard is updated when any audit row failed.

Do not render a standalone or persistent "Startup refresh audit failed" banner.
The audit remains mandatory, but its result is communicated through the compact
per-source freshness strip, relevant section states, and
`~/Library/Logs/PortfolioIntelligence/startup-refresh.log`. When every required
source passes, no failure warning remains visible.

Mail and Podcast digests must contain substantive research or editorial content
only. Exclude promotions, advertisements, registration and purchase calls to
action, follow/subscribe requests, contact details, phone numbers, email
addresses, and website links from displayed summaries. Deduplicate Podcasts by
normalized episode title. Label Podcast evidence as a transcript only when a
local transcript was actually available; otherwise label it as a description.

Before importing Apple Health, validate the newest ZIP in the configured iCloud
Health folder and confirm that it contains
`apple_health_export/export.xml`. Extract it atomically only when valid. If the
newest archive is corrupt or incomplete, retain the last validated extracted
XML and expose the archive failure as a fallback source state; never replace a
valid Health snapshot with a failed extraction.

## Required run sequence

1. Refresh source-backed files and earnings rows before building when newly reported data exists.
2. For a Codex-assisted run, use Computer Use to inspect Mail, Reminders, Calendar, Notes, and iPhone Mirroring before claiming those sources are current. A raw web-service restart cannot invoke Codex plugins; it must mark an unrefreshed saved snapshot stale.
3. Run `npm run lint` and `npm run build`.
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

- Keep the four top-level workspaces separate: Investment, Sectoral Analytics,
  Market Intelligence, and Health & Wellness. Preserve each workspace's
  collapsible state and URL selection
  (`?view=investment|sectors|intelligence|health`). Alias
  `?view=market-intelligence` resolves to Market Intelligence.
- Use `DailyKanbanBoard` as the only action-board implementation across all four
  workspaces. The Investment I-1 three-lane layout is canonical: summary header,
  `To Do Today`, `Monitor`, and `Completed Today` lanes, full action cards,
  compact completed rows, and compact empty lanes must remain visually
  identical. Do not add compact, single-lane, or workspace-specific variants.
- Every workspace must expose the same complete three-lane Daily Action Board:
  `To Do Today`, `Monitor`, and `Completed Today`. Do not split lanes across
  pages or replace them with oversized Kanban variants. Clicking an action
  moves it to Completed Today with strike-through styling; retain that state
  through the local day and clear completed items at local midnight.
- Keep Health & Wellness as a non-scrolling 2x2 console with H-1 Action Board,
  H-2 Health Status, H-3 Daily Guidance, and H-4 Vital Metrics. Dense Health
  content belongs on explicit URL-backed sub-pages, never in a vertically
  scrolling workspace. Incognito must gate thumbnail values, drill-down values,
  source/archive metadata, actions, recommendations, and accessibility text.
- The shared Sectoral Analytics industry toggle is an **S-2-only control**.
  `selectedSectorId` may drive S-2 matrices, charts, rankings, company
  composition, and linked analytical panels, but it must not be passed into
  Market Intelligence or S-4 components.
- **Market Intelligence (former S-3 Live Intelligence Digest) is always complete
  and unfiltered.** Render all refreshed items from the exact Newsletters and
  Axis Research mailboxes plus Calendar, active Reminders, Notes, Podcasts, and
  the full tracked earnings calendar inside Calendar + action feeds. Do not add
  an industry filter banner, sector-match count, excluded-industry message,
  dimming, or hidden records. Sectoral Analytics must not host a digest or
  Market Intelligence promo/cross-link; the digest lives only in the Market
  Intelligence workspace.
- **S-4 Earnings is always complete and interactive.** Every tracked earnings
  event remains visible, enabled, and selectable regardless of the S-2 industry
  selection. Do not add `sector-dimmed`, `sector-match`, `aria-disabled`, or
  sector-gated click behavior to earnings events.
- The S-4 Decision Framework may remain sector-specific only through its own
  local selector. Its state must not read or mutate the S-2 industry selection.
- Dimming classes and filter status UI are valid only inside S-2. When an S-2
  industry changes, verify Market Intelligence and S-4 contain zero dimmed
  descendants and zero disabled tabs.
- PDF/report generation remains independent of the currently selected S-2
  industry unless the report explicitly labels a chart as a selected-industry
  view.

## Required UI verification

After changing Sectoral Analytics or Market Intelligence behavior:

1. Run `npm run lint`, `npm run build`, and
   `node --test tests/rendered-html.test.mjs`.
2. Open `?view=sectors`, select a different S-2 industry, and confirm S-2 updates.
3. Open `?view=intelligence` and confirm Market Intelligence has no
   `.sector-intelligence-filter` or `.sector-dimmed` descendants, shows complete
   source counts, and includes earnings calendar rows inside Calendar + action
   feeds → Earnings. Confirm Sectoral Analytics has no S-3 digest/cross-link
   and no duplicate full digest.
4. Confirm S-4 has no `.sector-dimmed` descendants, no disabled earnings tabs,
   and all earnings events remain selectable.
5. Confirm the S-4 local Decision Framework selector changes only its own cards.
6. Verify both the localhost and private Tailscale URLs and check the browser
   console for errors.
