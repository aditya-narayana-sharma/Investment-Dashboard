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
