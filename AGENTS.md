# Investment Dashboard Operating Instructions

## Complete refresh contract

Every start or restart must run `scripts/refresh-dashboard-data.sh` after the Flask gateway is reachable. A browser refresh is not a substitute for this startup audit.

The audit must validate payload semantics, not only HTTP success: Kite and sector snapshots require `status=live`, Mail and Podcasts require `status=live`, earnings requires `status=verified`, and Health requires `status=live` with `dataDate` through D-1.

Treat the dashboard as current only after independently checking all of these sources:

- Kite: holdings, positions, orders, GTTs, margins, quotes, P&L, and classifications.
- Apple Mail: only `iCloud -> Newsletters` for the newsletter digest and only `iCloud -> Axis Research` for Axis research.
- Apple Reminders: read every item in the exact `Job 🔍` and `Earnings` lists. Preserve incomplete items as actionable; completed items are evidence only and must not be silently restored.
- Apple Calendar: read earnings and all other events through D-1, then group the dashboard summary by topic. Calendar entries are scheduling evidence, not proof that a result was published.
- Apple Notes: read only the exact ` Health Daily` note for wellness reconciliation. Never run, display, or reference `Health Daily v2`.
- iPhone Mirroring: verify Apple Health, Lifesum, and Guava through D-1. Cover Activity, Sleep, Heart, Respiratory, Mobility, and Nutrition for each missing date, plus 7-day and 30-day comparisons. Body Measurements and Hearing remain excluded.
- Apple Podcasts: latest eligible episode descriptions or transcripts.
- Earnings: reported events through the latest completed day, using company investor relations or NSE first and reputable financial reporting as a cross-check. Keep unpublished KPI fields blank.
- Sectors: every configured sector snapshot, constituent price history, rankings, and freshness metadata.
- Health: Apple Health data through D-1 with 7-day and 30-day comparisons. Never infer missing health values; show exact missing dates and stale status.
- PDF: refresh Kite, Mail, earnings, and all sector snapshots immediately before export.

If any source fails, preserve the last validated snapshot, label it `Stale`, `Cached`, or `Unavailable`, and name the failed source. Never claim that the complete dashboard is updated when any audit row failed.

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

- Keep the three top-level workspaces separate: Investment, Sectoral Analytics,
  and Health & Wellness. Preserve each workspace's collapsible state and URL
  selection.
- The shared Sectoral Analytics industry toggle is an **S-2-only control**.
  `selectedSectorId` may drive S-2 matrices, charts, rankings, company
  composition, and linked analytical panels, but it must not be passed into S-3
  or S-4 components.
- **S-3 Live Intelligence Digest is always complete and unfiltered.** Render all
  refreshed items from the exact Newsletters and Axis Research mailboxes plus
  Calendar, active Reminders, Notes, and Podcasts. Do not add an industry filter
  banner, sector-match count, excluded-industry message, dimming, or hidden
  records to S-3.
- **S-4 Earnings is always complete and interactive.** Every tracked earnings
  event remains visible, enabled, and selectable regardless of the S-2 industry
  selection. Do not add `sector-dimmed`, `sector-match`, `aria-disabled`, or
  sector-gated click behavior to earnings events.
- The S-4 Decision Framework may remain sector-specific only through its own
  local selector. Its state must not read or mutate the S-2 industry selection.
- Dimming classes and filter status UI are valid only inside S-2. When an S-2
  industry changes, verify S-3 and S-4 contain zero dimmed descendants and zero
  disabled tabs.
- PDF/report generation remains independent of the currently selected S-2
  industry unless the report explicitly labels a chart as a selected-industry
  view.

## Required UI verification

After changing Sectoral Analytics behavior:

1. Run `npm run lint`, `npm run build`, and
   `node --test tests/rendered-html.test.mjs`.
2. Open `?view=sectors`, select a different S-2 industry, and confirm S-2 updates.
3. Confirm S-3 has no `.sector-intelligence-filter` or `.sector-dimmed`
   descendants and still shows complete source counts.
4. Confirm S-4 has no `.sector-dimmed` descendants, no disabled earnings tabs,
   and all earnings events remain selectable.
5. Confirm the S-4 local Decision Framework selector changes only its own cards.
6. Verify both the localhost and private Tailscale URLs and check the browser
   console for errors.
