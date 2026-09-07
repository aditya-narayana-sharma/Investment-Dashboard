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

## M-3 KPI Outcome Colors

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-ec96d1c6-7d4f-4f89-98f3-40dc213b41bc.png` (2,524 x 614 px; 13 August 2026 KPI table in Sepia before semantic outcome colors).
- Browser-rendered implementation: `artifacts/design-qa/m3-kpi-outcome-colors-final.png` (1,422 x 800 px viewport capture; Sepia, 13 August selected).
- Normalized focused comparison: `artifacts/design-qa/m3-kpi-outcome-colors-comparison.png` (1,422 x 692 px). The source was scaled to 1,422 px wide; the implementation was cropped to the matching KPI-table region and both were padded to equal 346 px comparison panels at 1x density.
- State: Market Intelligence M-3, 13 August 2026, three verified reported rows.

### Fidelity Review

- Fonts and typography: the existing Georgia heading, mono table labels, weights, wrapping, and density are unchanged. Outcome lines receive only the stronger existing 850 weight needed for semantic color readability.
- Spacing and layout rhythm: column widths, row heights, padding, borders, and header-only KPI-name structure are unchanged. The compact legend fits beside the company count without shifting the table.
- Colors and visual tokens: verified KPI `green`, `amber`, and `red` tone metadata maps to positive, neutral, and negative outcomes. Sepia uses dark accessible inks `rgb(7, 91, 50)`, `rgb(122, 87, 0)`, and `rgb(143, 29, 44)`; all three were confirmed as distinct computed colors.
- Image quality and asset fidelity: this table contains no raster or illustrative assets, and no new icons or placeholder imagery were introduced.
- Copy and content: all KPI values and comparison text remain unchanged. A `+VE / NEUTRAL / −VE` legend explains the colors, and each comparison exposes a matching semantic `aria-label`.

### Runtime Verification

- Exact 13 August outcome distribution: seven positive, two neutral, and three negative KPI comparisons.
- The table wrapper measured 1,368 px client width and 1,368 px scroll width, so the change introduced no horizontal overflow.
- KPI names remain header-only: zero `.kpi-row-label` descendants.
- Market Intelligence isolation remains intact: zero sector-filter/dimming descendants and zero disabled earnings controls.
- `npm run lint`, `npm run build`, and `node --test tests/earnings-day-kpi-slots.test.mjs tests/rendered-html.test.mjs` passed (24/24 tests).

### Findings And Comparison History

- P0: none.
- P1: none.
- P2 source gap: outcome text used one neutral ink, so positive, negative, and neutral results could not be scanned quickly.
- Fix: map source-backed tone metadata to semantic outcome classes, add Sepia-safe color overrides, accessible labels, and the compact legend.
- Post-fix evidence: the focused comparison shows unchanged table geometry and clearly differentiated green, amber, and red outcome lines.

final result: passed

## M-2 Axis Research PDF Actions — One Or None

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-0c649b6d-302e-40ec-a98c-39d58fc0300e.png` (six repeated full-width actions inside one mail card).
- Browser-rendered implementation: `artifacts/design-qa/axis-open-pdf-one-per-mail-final.png`.
- Same-input comparison: `artifacts/design-qa/axis-open-pdf-one-per-mail-comparison.png`.
- Live source snapshot: 18 Axis Research mails; 15 with explicit `Read Report` evidence; 3 with generic `Click Here` trackers only.

### Comparison And Corrections

1. The reference failure rendered every tracked anchor in a single Result Updates mail as an indistinguishable `Open PDF` action.
2. The corrected card renders only its primary report action, so each mail has a maximum of one button.
3. Generic `Click Here` tracking links no longer qualify as PDF/report evidence. Mails without an explicit report link render no PDF action.
4. The control retains the requested visible full-width treatment and remains positioned before the research bullets.

### Runtime Verification

- 18 rendered Axis mail cards.
- 15 rendered `Open PDF` buttons.
- Maximum buttons per mail: 1.
- Zero-button mails: RSI explainer, Ashok Leyland target-achieved notice, and AU Small Finance Bank call-closure notice.
- Market Intelligence contains zero `.sector-intelligence-filter` or `.sector-dimmed` descendants.
- `npm run lint`, `npm run build`, `node --test tests/axis-digest-links.test.mjs`, and `node --test tests/rendered-html.test.mjs` passed.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## Market Intelligence Axis Research PDF Actions

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-cf5fb7d1-2027-4869-8ea9-0bf655e1e914.png` (339 x 184 px).
- Focused implementation: `artifacts/design-qa/axis-open-pdf-button-final.png` (461 x 82 px).
- Expanded live view: `artifacts/design-qa/axis-open-pdf-expanded-final.png` (1161 x 935 px).
- Same-input comparison: `artifacts/design-qa/axis-open-pdf-comparison.png`.
- State: Sepia theme, Market Intelligence M-2 open, Daily Technical Outlook expanded, refreshed 11–14 August 2026 Axis mailbox window.

### Comparison History

1. Initial implementation
   - P1: the existing `Open PDF` link was a small secondary action rendered after all research bullets.
   - P1: long reports pushed the action below the visible portion of the fixed-height digest scroller, so expanding a topic did not guarantee that the PDF action could be seen.
2. First visual pass
   - Promoted matched Axis PDF links to a full-width, high-contrast cyan action with a two-pixel blue border, file icon, bold monospaced label, and visible keyboard focus treatment.
   - P1 remained: the stronger action was still below long research evidence and could remain outside the inner viewport.
3. Final placement
   - Moved the PDF action immediately below each Axis report title and badges, before all evidence bullets.
   - The representative button measured 420.67 x 42 px and was fully inside the 520 px-high Axis digest viewport immediately after expanding its topic.

### Runtime And Integrity Checks

- Refreshed Axis payload: 18 reports, seven PDF-backed rows, seven rendered `Open PDF` actions, six unique PDF URLs (one local Technical Outlook PDF is source evidence for two matching mails).
- Opening the representative action produced the inline dashboard PDF route for `Axis_TechnicalOutlook-2026-08-13.pdf`.
- Market Intelligence contains zero `.sector-intelligence-filter` or `.sector-dimmed` descendants.
- `npm run lint`, `npm run build`, and `node --test tests/rendered-html.test.mjs` passed.
- No missing icon, clipped label, low-contrast state, or visible runtime error remains in the verified browser state.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## I-2 Portfolio Concentration Map Label Visibility

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-c4a7afd1-ea1d-4c53-b43c-b18e972b44a9.png` (862 x 768, Dark).
- Browser-rendered implementation: `artifacts/qa/portfolio-map-viewport.png` (live Kite holdings, Sepia).
- Same-input comparison: `artifacts/qa/portfolio-map-comparison.png`.
- State: seven live Kite holdings; no treemap selection; same portfolio values and return classifications as the source.

### Comparison History

1. Source defect
   - P1: recursive half-splitting produced skinny tiles for BHARTIARTL, AXISBANK, and JSWENERGY.
   - P1: primary symbol and value rows used ellipsis, hiding valid live data.
2. Corrected implementation
   - Replaced the half-split packing step with aspect-ratio-aware squarification while preserving each holding's value-proportional area.
   - Primary symbol, weight, and value now use tile-container-responsive sizing and never apply ellipsis.
   - Secondary P&L remains hidden when tile geometry cannot support it; complete values remain in the accessible tooltip.

### Result And Measurements

- All seven symbols are complete: ADANIGREEN, ICICIBANK, ETERNAL, BHARTIARTL, AXISBANK, JSWENERGY, and LTF.
- Browser geometry checks report `scrollWidth <= clientWidth` for every primary symbol, weight, and current-value label.
- Compact tiles remain legible without changing market-value area, portfolio weight, colors, selection, or tooltips.
- The nested portfolio donut and Portfolio Activity data/markup were not changed.
- Browser console: no warnings or errors attributable to the treemap.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## I-2 70/30 Portfolio Width Adjustment

### Evidence

- Selected baseline: `artifacts/design-qa/i2-portfolio-layout-final.png`.
- Browser-rendered 70/30 implementation: `artifacts/design-qa/i2-portfolio-layout-70-30.png`.
- Desktop browser viewport: 1600 x 900, Sepia appearance, retained seven-holding snapshot.

### Result And Measurements

- Top row: Nested portfolio allocation is 991.4 px wide; Portfolio management is 424.9 px wide.
- Bottom row: Portfolio activity is 991.4 px wide; Portfolio concentration map is 424.9 px wide.
- Computed CSS track ratio is exactly 70.00% / 30.00% for both rows.
- All four Portfolio management cards have 0 px horizontal and vertical overflow in their existing 2x2 layout.
- Portfolio Activity, treemap, and the full I-2 grid have 0 px horizontal overflow.
- Existing responsive one-column stacking below 980 px remains unchanged.
- Existing donut markup remains protected by the regression hash.
- Browser console: no warnings or errors.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## I-2 Portfolio Layout Rearrangement

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-432918bd-34a7-4491-afa6-34b0db7dc7b8.png`.
- Browser-rendered implementation: `artifacts/design-qa/i2-portfolio-layout-final.png`.
- Same-input comparison: `artifacts/design-qa/i2-portfolio-layout-comparison.png`.
- Desktop browser viewport: 1600 x 900, Sepia appearance. Geometry and interaction were exercised against the retained seven-holding snapshot before the required service audit replaced the browser state with the source-unavailable view.

### Result And Measurements

- Top row: Nested portfolio allocation at 849.8 px wide and Portfolio management at 566.5 px wide, an exact 60/40 split of the 1416.3 px content tracks.
- Both top-row panels measure 760 px high and share the same top and bottom coordinates.
- Bottom row: Portfolio activity at 849.8 px wide and Portfolio concentration map at 566.5 px wide, matching the same 60/40 split.
- Both bottom-row panels share the same top and bottom coordinates and measure 382.4 px high.
- Portfolio activity has no horizontal table overflow at desktop; the document has 0 px horizontal overflow.
- The existing donut Pie components, ring order, labels, legend, audit box, and data markup remain protected by the unchanged regression hash.
- Selecting a treemap tile dims the other six tiles and highlights all seven matching table-column cells plus its header without changing the donut.
- Activity tabs still switch correctly; Orders rendered the current six rows.
- Responsive CSS uses one-column source order: allocation, management, activity, concentration. Below 620 px the existing mobile activity cards and one-column management-card layout remain active.
- Fresh browser console: no warnings or errors.
- Localhost and the private Tailscale URL both returned HTTP 200.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.
- Source audit remains degraded independently of this rendering change: Kite, Mail/Podcasts, Earnings, Health, and Pharma were not all live in the required startup audit.

final result: passed

## I-3 Risk Composition Equal-Height Utilization

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-fa62607f-d5c3-4412-9526-a700ccc6d355.png` (1513 × 1632 px, Sepia, ICICI Bank selected).
- Browser-rendered implementation: `artifacts/design-qa/i3-risk-equal-height-final.png` (1600 × 900 px viewport capture, Sepia, ICICI Bank selected).
- Same live desktop state: seven Kite holdings, two 50% columns, Risk composition at left and Portfolio / holdings risk at right.

### Comparison History

1. Source finding
   - P1 layout utilization: the left Risk composition content ended near the top half of its already equal-height panel, leaving a large visually empty region while the right panel used its full height.
2. Corrected implementation
   - Risk composition is now a full-height flex column.
   - The seven-row exposure driver map consumes the remaining shared height and distributes that height evenly across its rows.
   - Chart data, driver text, panel width, outer panel border and Portfolio / holdings risk markup remain unchanged.
3. Post-fix evidence
   - Desktop measurement: left 1387.37 px, right 1387.37 px; height difference 0 px; bottom-edge difference 0 px.
   - Driver-row heights: approximately 129.03 px each; no clipped text; document horizontal overflow 0 px.
   - iPhone portrait keeps the panels naturally stacked with no clipping or horizontal overflow.
   - iPhone landscape measured both panels at 510 px high in the paired layout with no clipping or horizontal overflow.

### Fidelity Surfaces

- Typography: unchanged; existing hierarchy, weights and wrapping preserved.
- Spacing/layout rhythm: blank lower-half void removed; driver rows now form an even vertical rhythm through the shared height.
- Colors/tokens: unchanged across Black, Dark and Sepia themes.
- Image/asset quality: no image assets are involved; existing Recharts and icon rendering preserved.
- Copy/content: unchanged and untruncated.
- Browser console: no warnings or errors in the verified live state.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed

## I-4 Analyst Call Matrix Grouping And Target Achievements

### Source And Scope

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-c04d8211-1a12-4c0d-a7a4-590d213d7769.png` (Analyst call matrix, Dark).
- Browser-rendered implementation: verified in the Codex in-app browser at `http://127.0.0.1:5050/?view=investment&section=i4` in Sepia.
- Source-backed Target Achieved contract: complete exact `iCloud → Axis Research` mailbox subject query plus the local Axis Research PDF archive.

### Visual And Interaction Result

- Plain `Buy`, `BUY`, `BUY CALL`, `FUNDAMENTAL BUY`, and `POSITIVE` labels resolve to one `BUY` category; Trading BUY and Technical BUY remain distinct strategies.
- Category headers retain the full-width compact dark band from the reference and now use an explicit chevron button with hover, focus and expanded/collapsed states.
- Industry, Performance, Posted-in-month and Analyst-call views all rendered group headers without horizontal overflow at the desktop viewport.
- Pointer collapse and keyboard activation were exercised in the browser. Automated tests additionally assert independent group state by filter.
- The Target achieved option is visually present in the existing compact Group-by selector. Closed calls are withheld from all active-call filters.

### Data Reconciliation

- The live local content API returned 48 Target Achieved events and 48 unique company/date identities.
- Historical company spellings and hyphenated names are normalized to verified NSE aliases before display; no synthetic ticker is sent to the quote service.
- Same-event Mail/PDF evidence merges without duplicating the row, and the PDF filename is retained when Mail is the preferred closure record.
- The live content API was `status=live`; localhost and the private Tailscale I-4 routes both returned HTTP 200.

### Findings

- P0: none.
- P1: none remaining.
- P2: the Codex in-app Browser runtime does not expose `window.fetch`, so it renders the bundled fallback data after hydration. Live feed delivery was therefore verified through the canonical Flask content API, while layout and interaction were verified in the browser. The browser console retained one historical stale-asset error from before the Vinext listener restart; the current document references the rebuilt asset successfully.

final result: passed

## I-3 Scenario-Specific Evidence

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-ab812c36-b4a1-43e7-8cbf-24c7ace3bff1.png`, `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-6a7d6fe7-bd1c-4349-8f12-065a60ca3b57.png`, and `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-07ad2b20-dbfa-4f14-9151-ef160b45f09b.png`.
- Browser-rendered implementation: `artifacts/scenario-evidence-focused.jpg`.
- Same-input comparison: `artifacts/scenario-evidence-comparison.jpg`.
- Source state dimensions: 2422 x 1810 px for the Controlled conflict screenshot. Implementation focused capture: 1735 x 960 px at the existing responsive dashboard density; both were normalized to 960 px high for the comparison.
- State: Crude + geopolitics selected; base scenario shown in the focused implementation. Automated source-pool checks cover supportive, base, and stress.

### Comparison History

1. Source behavior
   - P1: De-escalation, Controlled conflict, and Hormuz disruption repeated the same four broad event cards and the same two AI summaries.
   - Impact: changing the decision range appeared to change evidence even though only the framework text changed.
2. Scenario-scoped implementation
   - Added mutually exclusive supportive/base/stress matching for every macro event.
   - Filtered both evidence cards and AI summaries through the selected scenario range.
   - With the current Oil / war snapshot: De-escalation resolves only the Iran economic-pressure/de-escalation item; Controlled conflict resolves only the record Russian-crude-import item; Hormuz disruption reports no direct source evidence.
   - Broader event items are withheld instead of recycled into another range.

### Required Fidelity Surfaces

- Fonts and typography: existing scenario, evidence-header, source, and outcome-box typography is unchanged.
- Spacing and layout rhythm: the top scenario matrix, left regime rail, and right evidence area retain the existing geometry. Empty evidence uses the established centered empty state.
- Colors and visual tokens: green, gold, and red scenario tones and exact 30% outcome fills remain unchanged.
- Image quality and assets: no photographic assets are present; the existing Mail, Sparkles, and state icons remain unchanged.
- Copy and content: evidence headers now state the selected scenario and range, counts are scenario-specific, evidence bodies show only the matched source sentence, and the empty state explicitly explains that broader event evidence was withheld.

### Interaction And Runtime Checks

- Focused tests confirm one source item cannot enter more than one range.
- Current source reconciliation: supportive 1, base 1, stress 0.
- `npm run lint`, `npm run build`, `node --test tests/rendered-html.test.mjs`, and seven focused scenario/summary tests passed. Lint retains two pre-existing unused-import warnings and has zero errors.
- The served production bundle contains the scenario-specific implementation. The in-app browser currently exposes server-rendered markup without activating client-side scripts, so click-state capture was blocked; the three range-state transitions are covered by the focused scenario tests.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining in the evidence behavior or visual treatment.

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

## M-3 Earnings KPI Header Names

### Evidence

- Source visual truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-38902fba-eecb-46e6-8960-9a55bacce07f.png` (13 August 2026 table with generic `KPI 1`–`KPI 4` headers).
- Header-only refinement truth: `/var/folders/j4/hrp_cpj95f32wf_qpgc19pxh0000gn/T/codex-clipboard-ec96d1c6-7d4f-4f89-98f3-40dc213b41bc.png` (named headers with duplicated KPI names still present inside rows).
- Browser-rendered implementation: `artifacts/design-qa/m3-kpi-headers-only-final.png`.
- Same-input comparison: `artifacts/design-qa/m3-kpi-headers-only-comparison.png`.
- Verified state: Market Intelligence M-3, 13 August 2026, three reported company rows, Sepia theme.

### Comparison And Correction

1. P1 source defect: mixed-company days exposed opaque positional headers even though each source-backed cell had a verified metric name.
2. The corrected headers enumerate the distinct metric names present in each column: `Revenue / Group revenue`, `Profit / Operating EBITDA / Group EBITDA`, `Profit before tax / EBITDA margin`, and `Catering revenue / PAT / PBT before exceptional`.
3. P2 refinement: the first named-header iteration also repeated every KPI name inside each body cell. The final pass removes those row labels from populated and unpublished cells; KPI names now appear only in the table header.

### Runtime Verification

- Table wrapper measured 1,364 px client and scroll width; no horizontal overflow at the verified desktop viewport.
- Header cells had equal client and scroll widths; no truncation or clipping.
- The exact 13 August render contains zero `.kpi-row-label` descendants while preserving all three company rows, values, changes, and combined headers.
- Selecting Pharma in S-2 produced the expected S-2 dimming, then M-3 returned with zero sector-filter/dimming descendants and zero disabled earnings controls.
- Focused tests passed for mixed-sector 22 July, the exact 13 August table, and the no-row-label regression contract.
- `npm run lint`, `npm run build`, and `node --test tests/rendered-html.test.mjs` passed.

### Findings

- P0: none.
- P1: none remaining.
- P2: none remaining.

final result: passed
