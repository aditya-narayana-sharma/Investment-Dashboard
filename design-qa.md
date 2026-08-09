# Design QA

## Evidence

- Source visual truth: `artifacts/design-qa/approved-dark-theme-reference.png`
- Browser-rendered implementation: `artifacts/design-qa/dashboard-desktop.png`
- Focused chart capture: `artifacts/design-qa/nested-allocation-chart.png`
- Full-view comparison: `artifacts/design-qa/dashboard-comparison.png`
- Focused chart comparison: `artifacts/design-qa/allocation-chart-comparison.png`
- Mobile capture: `artifacts/design-qa/dashboard-mobile.png`
- Desktop viewport: 994 x 835, live-layout state populated with a temporary in-memory QA fixture. The fixture was removed after capture; production remains live-Kite-only.
- Mobile check: 390 x 844 override (312 CSS px available inside the desktop app shell), no document overflow.

## Findings

- P0: none.
- P1: none.
- P2: none remaining.

The approved option 2 visual direction is present: black editorial bands, warm-white serif headings, cool-gray secondary text, blue structural accents, restrained borders, green gains, amber concentration, and red losses. The implementation keeps the existing dashboard hierarchy and live controls instead of introducing a new layout.

## Required Fidelity Surfaces

- Fonts and typography: the Georgia editorial display face and compact sans-serif UI hierarchy match the selected visual. Letter spacing remains zero; headings and dense table text wrap without clipping.
- Spacing and layout rhythm: desktop section order, metric strip, two-column analytics band, low-radius panels, and tight dividers match the reference. The narrower browser capture preserves the same proportions responsively.
- Colors and tokens: flat black surfaces and neutral gray borders replace the light theme. No gradients, glows, or decorative effects were introduced. Semantic gain/loss/warning colors remain consistent.
- Image quality and assets: the target contains no photographic assets. Existing Lucide interface icons remain sharp and consistent; no placeholder or hand-drawn image substitutes were added.
- Copy and content: live-Kite status, five-minute refresh, positions, GTTs, orders, analyst matrix, mail digests, research digest, and podcast summaries are unchanged.

## Donut Label Audit

- Outer ring labels are generated from each live holding object and contain symbol, portfolio weight, unrealised return, and day return.
- Middle and inner labels are generated from the same allocation slices used to draw their rings.
- All desktop labels are white with a dark stroke and are positioned inside their corresponding slice; label lines are disabled.
- The smallest slices use compact type, and inner-ring labels are biased toward the outer edge to avoid the center P&L summary.
- Ring radii are percentage-based so the chart scales instead of clipping at narrow widths. Mobile reduces the outer label to symbol plus weight and hides sub-6% inner/middle labels; the complete values remain available from the chart tooltip and positions table.

## Comparison History

1. Initial dark implementation
   - P2: inner-ring labels collided with the center P&L summary.
   - Fix: moved inner labels to 76% of ring thickness and reduced typography for sub-6% slices.
   - Post-fix evidence: `artifacts/design-qa/nested-allocation-chart.png`; Large, Small, and Mid labels are separated from the center values.

2. Responsive pass
   - P2: fixed pixel radii could clip the outer ring on mobile.
   - Fix: changed all three rings to proportional radii and added compact mobile label rules.
   - Post-fix evidence: browser DOM check reported `scrollWidth === innerWidth`; no horizontal page overflow. The browser screenshot command timed out after this final mobile-only adjustment, but the desktop chart capture and computed mobile geometry both confirm the ring remains within its panel.

## Interaction And Runtime Checks

- Scenario tabs: selected De-escalation and verified its heading/state.
- Positions control: switched to Orders & GTTs and verified the GTT register, then restored Holdings.
- Browser console: no errors or warnings.
- Automated checks: `npm run lint` and `npm test` passed.

## Follow-up Polish

- P3: a future mobile-specific chart view could expose a compact allocation legend below the rings so every sub-6% category is visible without requiring a tooltip.

final result: passed

## I-3 Macro Evidence Summary Rail

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-86a85721-3d00-4c6d-913c-7aca3566e4ba.png` (Oil / war), `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-5264c639-bbdb-4162-b46f-b15268c61eeb.png` (INR / rates), `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-7105ae50-b9bd-4121-a5ed-ef01413a45c8.png` (Breadth / VIX), and `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-44f17c95-d8fc-4cae-b2aa-9c7076d70a69.png` (Earnings).
- Current implementation: in-app browser pass at `http://127.0.0.1:5050/?view=investment&section=i3`, using the refreshed live Mail snapshot and each of the five macro-event tabs.
- Same-input comparison: source screenshots and the live implementation used the Base/amber decision range, Sepia paper surfaces, the same left regime card, and the same event-specific evidence columns.
- The browser auto-review quota blocked persistence of the final screenshot after the last text-only relevance filter. The prior visual pass covered the completed boxes, spacing, overflow, all three computed 30% fills, and tab switching; the final filter changes only which source sentence is shown.

### Comparison History

1. Source state
   - P1: the left regime card had a large unused region between its sector transmission line and its bottom trigger.
   - P1: the right evidence columns remained source-rich, but the decision rail did not synthesise that evidence.
2. Evidence summary implementation
   - Added a semantic bulleted `AI-generated evidence summaries` region inside the existing left card.
   - Every summary is derived from the currently selected event's matching Mail evidence; Flows additionally uses its existing primary/cross-check evidence set.
   - Positive, negative, and neutral outcomes render as green, red, and gold boxes with exact `rgba(..., 0.30)` backgrounds and visible written outcome labels.
3. Content-quality polish
   - P2: the first pass could select newsletter boilerplate such as browser-view prompts or generic greetings.
   - Fix: event-specific relevance expressions now select only substantive oil, flow, rate, breadth, or earnings sentences and drop an item when it contains no relevant sentence.

### Measurements And Interactions

- Oil / war, Flows, INR / rates, Breadth / VIX, and Earnings each switched to their own summary set in the in-app browser.
- The regime card reported `scrollHeight === clientHeight` for every tested event, with no clipping or internal scrolling.
- Computed fills were `rgba(34, 197, 94, 0.3)`, `rgba(239, 68, 68, 0.3)`, and `rgba(217, 160, 28, 0.3)`.
- Summary bullets expose `positive outcome`, `negative outcome`, or `neutral outcome` to assistive technology, so colour is not the only signal.
- Full lint, production build, focused summary tests, and the rendered-HTML suite passed.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## I-3 Portfolio / Holdings Risk Density Pass

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-dd5fd205-0511-4423-a64d-81bfbac0db92.png` (2198 x 1654, Sepia, ICICIBANK selected).
- Current implementation capture: `artifacts/design-qa/i3-risk-density-final.jpg` (2379 x 1826 browser capture, Sepia, ICICIBANK selected).
- Same-input comparison: `artifacts/design-qa/i3-risk-density-comparison.png`.
- Focused component evidence: `artifacts/design-qa/i3-risk-density-focused.png`.

### Comparison History

1. Source state
   - P1: the equal-height holdings card contained an unstructured empty lower-left region beneath the selector and radar.
   - P1: the Evidence section ended early, leaving the remainder of the matched card height visually unused.
2. Density correction
   - Added a source-derived six-axis comparison table showing the selected holding, current portfolio average, and exact risk delta.
   - Kept the required selector/radar left column and Overview/Axis explanations/Evidence right column.
   - Stretched the workbench through the matched card height and distributed the six evidence facts across the available evidence region.
3. Responsive polish
   - P2: full comparison headers produced 3 px of internal overflow in iPhone landscape.
   - Fix: compact semantic `abbr` headers (`Sel.`, `Avg.`, `Δ`) retain accessible titles and remove the overflow.

### Measurements And Interactions

- Desktop cards remain exactly equal: 707.1 x 881.8 CSS px each.
- Holdings workbench, visual column, and explanation each measure 790.2 px high with `clientHeight === scrollHeight`.
- Comparison table measures 300.6 x 188.4 px with no clipping.
- iPhone portrait stacks to one column; iPhone landscape keeps the two-column workbench.
- Document overflow is 0 px in desktop, portrait, and landscape checks.
- Comparison table reports `clientWidth === scrollWidth` in portrait and landscape.
- Holding selection, Overview, Axis explanations, live Evidence, and the existing radar remain interactive and source-backed.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## M-4 Apple Monthly Calendar

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-db56eca7-50f0-49c9-80e3-ff93d53f364b.png` (2196 x 1568 px).
- Browser-rendered implementation: `artifacts/design-qa/m4-month-calendar-sepia.png` (1500 x 1350 px focused crop).
- Full browser capture: `artifacts/design-qa/m4-calendar-full-sepia.png` (2944 x 2675 px).
- Mobile browser capture: `artifacts/design-qa/m4-month-calendar-mobile-sepia.png`.
- Same-input comparison: `artifacts/design-qa/m4-month-calendar-comparison.png` (2512 x 1000 px). Both sides were proportionally normalized to 1000 px high before comparison; the source is 1400 px wide and the implementation is 1112 px wide at that normalized density.
- Desktop CSS viewport: 1884 x 1326. Mobile CSS viewport: 390 x 844.
- State: Sepia theme, Market Intelligence M-4 expanded, Calendar expanded, Reminders collapsed, August 2026, 77 complete non-earnings Apple Calendar events.

### Full-View And Focused Comparison

- The M-4 section heading, Calendar + action feeds header, one Calendar collapsible, one Reminders collapsible, blue Calendar edge, paper surfaces, dark collapsible chrome, and compact source count remain aligned with the source.
- Intentional requested change: the long three-column source list is replaced with a Monday–Sunday monthly calendar. Each event is spatially placed on its date and source-coded through a compact color chip.
- Focused checks covered the month header, source legend, 42-cell grid, current/selected-day treatment, compact event labels, adjacent-month dates, selected-day strip, and collapsed Reminders boundary. No additional crop was needed because the focused implementation capture renders every one of these details legibly.

### Required Fidelity Surfaces

- Fonts and typography: existing Georgia section display type and mono dashboard labels are preserved. Month, weekday, date, source, time, and event text retain the dashboard hierarchy with compact optical weights and ellipsis for long event names.
- Spacing and layout rhythm: the requested full monthly grid replaces the tall list without changing M-4 ownership or surrounding section geometry. Desktop has 42 equal cells; mobile keeps a scrollable 760 px calendar rail and produces zero document overflow.
- Colors and visual tokens: F1, Astronomy, Work, Coursera/learning, Family, Hindu/India holidays, Personal, and deterministic fallback calendars have distinct palettes. Sepia uses light source tints with dark source-specific ink; no low-contrast white-on-paper event text remains.
- Image quality and asset fidelity: the reference has no photographic assets. The implementation uses the existing Lucide Calendar and Chevron icons; no placeholder, generated, or hand-drawn assets were introduced.
- Copy and content: all 77 refreshed non-earnings Calendar rows remain in M-4. August displays 38 events across four active calendars; September displays six active calendars. Earnings remains exclusively in M-3 under the dashboard contract.

### Interaction And Runtime Checks

- Previous, Next, and Today controls change the active month; August → September → August was verified.
- September refreshed the legend to Astronomy & Space, F1, Hindu Holidays, India Holidays, NSE Market Holidays, and US Market Holidays.
- Selecting the first event updated the compact day strip to `Thu, 6 Aug · 7:51 am · Moon at Last Quarter`.
- Desktop geometry: 1376.78 px calendar width, 42 cells, zero page overflow.
- Mobile geometry: 356.29 px visible calendar frame, 760 px horizontally scrollable grid, zero page overflow; Today hides at phone width while both chevrons remain available.
- Browser console: no errors or warnings.
- Automated checks: `npm run lint`, `npm run build`, and `node --test tests/rendered-html.test.mjs tests/freshness-and-isolation.test.mjs` passed.

### Findings And Comparison History

- P0: none.
- P1: none remaining. The source list's lack of monthly spatial context and calendar color separation is intentionally resolved by the requested month grid.
- P2: none remaining. The first browser comparison found no actionable typography, layout, color, content, interaction, or responsive defects.

final result: passed

## I-3 Risk Two-Column Workbench

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-2930ba9b-6cff-44b4-8b16-94bbfdfb85aa.png` (2152 x 1760, Sepia, BHARTIARTL selected).
- Browser-rendered implementation: `artifacts/design-qa/i3-risk-two-column-final.png` (723 x 843 capture, Sepia, BHARTIARTL selected).
- Same-input comparison: `artifacts/design-qa/i3-risk-two-column-comparison.png`.
- User-screen effective viewport: 722 x 842 CSS px. Responsive checks used iPhone portrait 390 x 844 (effective 354 x 767) and iPhone landscape 844 x 390 (effective 767 x 354).
- State: seven live Kite holdings; BHARTIARTL selected; selected-holding evidence is derived from the same live holding and classification snapshot as the radar.

### Comparison History

1. Source layout
   - P1: the radar occupied a full-width stage even though its useful footprint was roughly half the card, leaving large empty areas on both sides.
   - P1: explanations sat below the chart, making the card unnecessarily tall and separating the chart from its supporting evidence.
2. First split implementation
   - P1: the initial 760 px internal breakpoint stacked the workbench in the user's 722 px browser viewport.
   - Fix: lowered the internal stacking breakpoint to 520 px so this screen and iPhone landscape retain the two-column workbench while phone portrait stacks cleanly.
3. Focused polish
   - P2: the built-in Recharts legend collided with the Volatility label inside the narrower left column.
   - Fix: replaced it only in the holdings workbench with a compact external series key; the Axis recommendation radar remains unchanged.
   - P2: the new Evidence values were too pale in Sepia.
   - Fix: applied the existing paper-theme ink and blue tokens to evidence labels, values, links, and the series key.

### Result And Measurements

- Left column contains the complete company selector above the radar and risk scale.
- Right column contains Selected holding, Overview, Axis explanations, and Evidence.
- Evidence includes live value and weight, quantity, average and last price, unrealised and day P&L, classification, Kite timestamp, and linked NSE/AMFI classification sources.
- At the user viewport the workbench measured 639.46 px wide with 287.71 px and 337.76 px columns; both columns measured 628.84 px high and had no internal clipping.
- iPhone portrait stacks to one column with 0 px document overflow; iPhone landscape retains two columns with equal 588 px column heights and 0 px document overflow.
- Pointer selection changed ETERNAL and its evidence; Enter-key activation changed AXISBANK and its explanation; BHARTIARTL was restored.
- Browser console: no warnings or errors.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## I-3 Portfolio / Holdings Risk Layout

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-7f5932b3-2462-4818-93eb-33b413f9d7ab.png` (807 x 2048, Sepia, BHARTIARTL selected).
- Browser-rendered implementation: `artifacts/design-qa/i3-risk-panel-pair-sepia.png` (1309 x 1000 browser capture, Sepia, BHARTIARTL selected).
- Focused implementation: `artifacts/design-qa/i3-holdings-risk-final.png`.
- Same-input comparison: `artifacts/design-qa/i3-risk-reference-comparison.png`.
- Desktop browser override: 1440 x 1100; effective page viewport 1309 x 1000.
- Responsive overrides: iPhone portrait 390 x 844 (effective 354 x 767) and iPhone landscape 844 x 390 (effective 767 x 354).

### Comparison History

1. Initial reference
   - P1 layout: the selector occupied a tall left rail, while the radar and explanation were constrained to the right rail, producing a large unused area.
   - P1 sizing: the parent grid used unequal `1.05fr / .95fr` tracks and top-aligned cards.
2. Corrected implementation
   - Company selector is the first full-width row.
   - Radar is the middle full-width row.
   - Selected-holding overview and Axis explanations form the bottom band.
   - The I-3 parent uses two equal tracks and stretched panels. Measured desktop cards are 621.73 x 882.99 px on both sides.
3. Responsive pass
   - Portrait and landscape stack the two panels naturally.
   - Measured document horizontal overflow is 0 px at both iPhone overrides.

### Interaction And Runtime Checks

- Pointer selection changed the selected company and its matching explanation.
- Focus remained on the selected company button during keyboard testing; explicit Enter/Space activation is covered in the component.
- The live seven-holding dataset rendered in the corrected geometry.
- Browser console: no warnings or errors.
- No photographic or generated assets are involved; the existing Recharts radar and Lucide icon are preserved.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## Sectoral And Health Thumbnail Redesign

### Scope

- Replaced the sparse S-1 to S-4 previews with data-bearing, interactive thumbnail workbenches.
- Replaced the sparse H-1 to H-4 previews with operational-status, guidance, trend, and category summaries.
- Expanded the H-4 overview into six color-coded category cards with a primary KPI, up to six supporting KPIs, direction-aware seven-day comparisons, source context, and direct category navigation.

### Sectoral Acceptance

- S-1 shows current action counts, the highest-priority task, monitoring state, and completion progress.
- S-2 shows interactive industry tiles, breadth, leader/laggard context, and preserves the S-2-only dimming contract.
- S-3 shows benchmark return bars when available. When benchmark history is unavailable it shows explicit Investability, Porter, and Macro decision tools rather than empty or fabricated market data.
- S-4 shows month-scoped reported/pending progress, current events, and the next verified holding catalyst.
- Sector selection and final-selection reset were verified: one selection dims the other S-2 industries, while deselecting it restores every industry. S-3 and S-4 remain independent.

### Health Acceptance

- H-1 shows open actions, operational target, priority task, and comparison coverage.
- H-2 shows source status, operational target, category coverage, and archive integrity.
- H-3 shows daily context, evidence-backed guidance, and guardrail access.
- H-4 shows all six Health categories with current values and direction-aware seven-day trends.
- H-4 category drill-down was verified through the URL-backed Activity page.
- Health Incognito continues replacing private values, comparisons, sources, guidance, and actions with a hidden-state placeholder.

### Responsive Verification

- Desktop: Sectoral and Health overview cards fill the 2x2 console without internal or document overflow.
- Mobile console: 481 x 1042 effective browser viewport; both 2x2 workspaces end at 1034 px and retain zero horizontal and vertical document overflow.
- H-4 mobile overview: six cards fit a 2x3 grid; every card reports `clientWidth === scrollWidth` and `clientHeight === scrollHeight`.
- Delayed freshness/source updates are observed by each console and trigger a refit, preventing asynchronous content from clipping the second row.
- Browser console: no warnings or errors.

### Verification Commands

- `npm run lint`
- `npm run build`
- `node --test tests/rendered-html.test.mjs tests/freshness-and-isolation.test.mjs`

final result: passed
