# Workspace / UI / Layout Static Audit

## Verdict

**Needs revision.** The current tree is structurally complete across the four required workspaces and most isolation contracts are represented in source and tests, but static review found one confirmed Health Incognito privacy leak, one chart data-integrity defect, a direct Health layout-contract conflict, a failing layout regression test, and several accessibility/layout gaps. No files were modified.

## Scope and baseline

| Item | Evidence |
|---|---|
| Repository | `/Users/adityasharma/Documents/GitHub/Investment Dashboard` |
| Branch / HEAD | `Visual-Overhaul` / `0855923 Visual Overhaul` |
| Working tree | Clean at audit start |
| Change baseline | `HEAD^..HEAD`; 46 files, 7,221 insertions, 484 deletions |
| Main UI files | `app/page.tsx`, `app/dashboard/*.tsx`, `app/globals.css`, `app/visual-overhaul.css` |
| Static checks | `npm run lint` passed |
| Targeted tests | 41 tests: 40 passed, 1 failed (`risk-explanations.test.mjs`) |
| Evidence limits | Static source/built render checks only in this lane. No current-run browser screenshots or live desktop/iPhone geometry measurements; those must be supplied by the product-design/browser lane. |

## Complete workspace / section / subsection inventory

| Workspace / route | Top section | Subsections, views, and controls | Charts / tables / other visualizations | Layout and responsive implementation | Static health |
|---|---|---|---|---|---|
| Investment `?view=investment` | I-1 Investment action board | Shared `DailyKanbanBoard`; To Do Today / Monitor / Completed Today; local-day persistence and midnight reset | 3-lane action board | Equal-width 3-column desktop, 2+full-width done <=1080px, single-column <=760px (`shared-ui.tsx:381-430`, `globals.css:772`, `1104-1105`) | Structurally complete |
| Investment | I-2 Portfolio | Instrument cluster; management cards; Holdings / Orders / Positions / GTTs / TSLs; BUY/SELL order ticket; allocation legend; concentration selection | Nested 4-ring allocation donut; portfolio activity matrix + mobile cards; concentration treemap | Main portfolio analysis is equal 2-column stretch (`globals.css:288-290`), single column <=980px (`396-399`); donut has 620px minimum plot height (`291-292`) | Complete; large fixed minimum height is an empty-space risk |
| Investment | I-3 Risk | Macro event tabs; supportive/base/stress tabs; selected Mail evidence; holdings risk selector/explanation | FII/DII composition donut; stacked risk bar; driver matrix; holdings radar | Risk pair explicitly unequal width and content-height aligned (`globals.css:281`); radar is fixed 440px (`InvestmentWorkspace.tsx:85`, `globals.css:586`) | Complete; alignment/test defect below |
| Investment | I-4 Axis picks | Analyst call matrix; Fundamental / Technical / Trading categories; recommendation selector; target progress; recommended-risk selector | Analyst table; target meters; recommended radar | Axis selector/detail explicitly `.72fr/1.28fr` (`globals.css:767`); collapses to one column <=1080px | Complete; violates literal equal-width requirement |
| Sectoral Analytics `?view=sectors` | S-1 Sectoral action board | Shared 3-lane board | Action board | Shared canonical layout | Complete |
| Sectoral Analytics | S-2 Industry Analytics | Sector pulse; Companies; Rankings; Life cycle; Market structure; MECE map. Industry multi-select toolbar is local to this component. Company pagination; ranking model and horizon/metric controls; news sentiment columns | 12-row impact matrix; KPI orbs; company table; cross-industry breadth table; leader/laggard ladders; life-cycle scatter/bubbles; structure scatter/bubbles; MECE loom/matrix; sentiment columns | Full-width normal flow override (`globals.css:2052-2079`). Analytical split uses chart plus insight. Tables horizontally scroll. | Structurally complete; S-2 local filter isolation represented in tests |
| Sectoral Analytics | S-3 Benchmarks & Decision Lab | Benchmarks; Investability; PESTEL; Porter; Macro triggers. Local sector selector; up-to-three benchmark selector | Indexed benchmark line chart; return cards; 3 radar variants; trigger dials; two macro bar charts | Chart/evidence layout explicitly `1.65fr/.65fr` (`globals.css:1198`) and chart fixed 420px in full section (`2089-2099`); mobile one-column (`2126-2135`) | Complete; missing-to-zero chart defect below |
| Market Intelligence `?view=intelligence` | M-1 Action Board | Shared 3-lane board | Action board | Shared canonical layout | Complete |
| Market Intelligence | M-2 Live Intelligence | Newsletter view All/Read Later; sender collapsibles; Axis topic groups; Podcast sender groups; Show all/fewer | Two-column newsletter/Axis cards; full-width Podcast masonry | `digest-grid` 2 equal-width columns but natural heights (`globals.css:1124`); podcast uses 2-column CSS masonry with no >8px vertical gaps (`1814-1833`) and 1-column <=980px | Complete and compact-oriented |
| Market Intelligence | M-3 Earnings Calendar | Month navigation; day selection; reported/pending detail; reconciliation strip | 7-column calendar grid; KPI table and result summaries | Equal 7 calendar columns (`globals.css:787-800`); cells have 108px minimum, empty cells 72px; mobile still 7 columns with 92px cells (`1111`) | Exclusive owner confirmed in source/tests |
| Market Intelligence | M-4 Calendar + Reminders | Exactly one Calendar inner collapsible; one Reminders inner collapsible; Completed / Scheduled Important / Work-Job groups; Reminder completion | 4/3/2/1-column calendar source groups; three reminder group columns | Full-width single outer stack (`globals.css:1875-1894`); reminder groups equal width but natural unequal height (`2002-2006`) | Structural invariant satisfied |
| Health & Wellness `?view=health` | H-1 Health action board | Incognito gate; shared action board | Action board | Current overview uses normal document flow, not the required non-scrolling console | Structurally present; contract failure below |
| Health & Wellness | H-2 Daily Optimism | Overview embeds Optimism + guardrails; URL detail pages: Optimism, Insights, Guidance, Guardrails | Daily brief cards; note statistics; guidance lane; guardrails | Detail shell is viewport-fitted by JS (`HealthWorkspace.tsx:327-358`); overview is explicitly auto-height/overflow-visible (`globals.css:1679-1715`) | Privacy content gate present; source-strip leak outside gate |
| Health & Wellness | H-3 Vital Metrics | URL detail pages: Overview, Activity, Sleep, Heart, Respiratory, Mobility, Nutrition I, Nutrition II; weekly/monthly toggle | Three direction columns; category-colored metric tiles; per-metric spark filaments; category portals | Equal 3-column desktop (`globals.css:1043`, `1234-1242`), 2 columns <=1120px and 1 <=620px; detail compact mode scrolls internally | Complete; sparkline keyboard/a11y limitation |
| Print report `/report?export=1` | Fixed A4 pages | Cover, portfolio/holdings, risk, Axis calls, order/GTT, sector matrices, research, calendar, sources/limitations | Printable nested donut SVG, bar rows, tables, scenario grids | 210mm × 297mm fixed pages with hidden overflow (`report.module.css:19`); runtime overflow detector throws/fallbacks (`report/page.tsx:212-227`) | Static overflow guard exists; final PDF visual verification still required |

## Collapsibles and navigation inventory

| Surface | Implementation | Persistence / keyboard | Finding |
|---|---|---|---|
| All top sections | `CollapsibleSection` (`shared-ui.tsx:307-347`) | Defaults collapsed; persists `portfolio-section-v2-{number}-open`; button exposes `aria-expanded` + `aria-controls`; section-nav event expands target | Good base semantics |
| Workspace tabs | `DashboardTabs` (`shared-ui.tsx:229-291`) | Roving tabindex; Arrow/Home/End; URL + Back/Forward synchronization (`page.tsx:440-467`) | Good base semantics |
| Workspace section bars | `WorkspaceSectionNav` (`shared-ui.tsx:28-79`) | Roving tabindex and keyboard navigation | `role=tab` buttons lack `aria-controls`; rendered sections are not matching `role=tabpanel`. Semantics do not match the scroll-and-expand behavior. |
| S-2/S-3 page tabs | `SectionPageNav` (`SectorsWorkspace.tsx:87-130`) | Roving tabindex; linked `aria-controls`/tabpanel | Good |
| M-2 sender groups | Native `<details>/<summary>` (`IntelligenceWorkspace.tsx:290-306`) | Native disclosure semantics | Good; visual/current-run testing required |
| M-4 inner Calendar/Reminders | `IntelligenceFeedSection` (`IntelligenceWorkspace.tsx:423-455`) | `aria-expanded`, `aria-controls`, hidden content | Good |
| Health detail page nav | Prev/next plus role tabs (`HealthWorkspace.tsx:461-479`) | Arrow/Home/End at shell level; Escape returns overview | Functional, but screen-reader tab relationships need live DOM inspection |

## Chart and visual integrity matrix

| Visualization | Source | Static validation | Risk |
|---|---|---|---|
| Nested portfolio allocation | `InvestmentWorkspace.tsx:645-660` | Four full-circle pies, shared origin, explicit inner/industry/subsector/holding labels; protected by hash + allocation tests | Large 620px minimum can create excess space; Recharts canvas lacks explicit accessible name/description |
| Portfolio treemap | `InvestmentWorkspace.tsx:705-740` | Keyboard-focusable buttons; aria labels carry values; tooltip responds to focus as well as hover | Strong accessibility relative to other charts |
| FII/DII donut | `InvestmentWorkspace.tsx:106-147` | Full 360° pie and explicit figures/notes; calculation test exists | Container label exists but no explicit role/name on chart SVG |
| Risk composition bar | `InvestmentWorkspace.tsx:755-775` | X-axis 0–5, units/method visible, exact tooltips/labels | Recharts chart has no static accessible equivalent; fixed height |
| Holdings / recommended radars | `InvestmentWorkspace.tsx:71-101` | 0–5 radial axis; selected tab has matching panel and live explanation | Regression test fails on selector sizing/overflow contract |
| Life-cycle scatter | `SectoralAnalytics.tsx:326-370` | Both axes titled, growth unit %, tooltip and visible axis legend | Tooltip/marks are pointer-dependent; no keyboard-accessible point table |
| Market-structure scatter | `SectoralAnalytics.tsx:372-417` | Both axes titled with units; tooltip and visible legend | Same accessibility limitation |
| Indexed benchmark line | `SectorDecisionLab.tsx:127-156` | Uses `indexedHistory`, so mixed index levels are comparable; legend/tooltips present | No explicit y-axis unit/base label and no accessible data table |
| Investability / PESTEL / Porter radar | `SectorDecisionLab.tsx:159-204` | 0–5 scale and legend; adjacent evidence | **Material defect:** null scores and null medians are coerced to zero (`164-168`) even though the factor UI says Unavailable |
| Macro trigger bars | `SectorDecisionLab.tsx:207-257` | Normalized 0–100 axis and raw tooltip; squeeze width starts at zero | No explicit accessible chart descriptions/data table |
| Earnings calendar | `EarningsMonthCalendar.tsx:216-370` | Named `role=grid`, keyboard-focusable day buttons, labels, pending cells sealed; KPI table | No arrow-key grid navigation; a 7-column layout on 620px may be dense even with reduced padding |
| Health spark filaments | `visual-components.tsx:258-335` | Derived from per-metric measured history; `role=img` and date-span label | Daily values are revealed only by pointer; wrapper is not focusable and aria-label omits data points/first-last values |

## Findings ordered by severity

### 1. P0 / Confirmed / High confidence — Health Incognito leaks Health source metadata outside every gate

- **Symptom:** When Incognito is active, the global source-freshness constellation can still display the Apple Health export and Health Daily note source name, status/period, `title` message, and focus/hover popover message.
- **Observation:** `app/page.tsx:539-544` passes unsanitized `sourceFreshness` to `PulseConstellation` regardless of `healthIncognito`. `app/dashboard/visual-components.tsx:47-74` renders every source’s name, period, `title={source.message}`, and popover. The refresh API constructs the Health period with operational target and exact required/data date at `app/api/dashboard/refresh/route.ts:81-94`; it also includes the ` Health Daily note` source at `:61-68`.
- **Root cause:** Incognito gates are applied only inside Health workspace sections (`HealthWorkspace.tsx:433-458`) and footer text (`page.tsx:614`), not to the global freshness model/render.
- **Impact:** Violates the explicit invariant that Incognito gate source/archive metadata and accessibility text. This is privacy leakage even if biometric values themselves are hidden.
- **Commit:** Introduced by `0855923` for the Pulse constellation/global render; underlying health overview behavior predates it.
- **Fix/verify:** Filter or replace Health/Health-note freshness records while Incognito is active, including title/popover/accessible name. Add a render test that asserts no date, source/archive name, message, missing-date text, or Health value is present anywhere in the DOM/accessibility tree under Incognito.

### 2. P1 / Confirmed / High confidence — Investability chart converts unavailable evidence to a real zero

- **Symptom:** Missing momentum/balance evidence is plotted at 0/5 on the radar, visually implying worst possible performance.
- **Observation:** `app/sector-investability.ts:35-39,100-110` intentionally represents unavailable factors as `null`; its unit test explicitly requires null (`tests/sector-investability.test.mjs:55-69`). `app/dashboard/SectorDecisionLab.tsx:164-168` then maps `score: row.score ?? 0` and `median: row.median ?? 0` for charting, while adjacent text renders “Unavailable” (`:191-196`).
- **Root cause:** Chart-shape convenience overwrites missing semantics.
- **Impact:** Materially misleading investability/downside read, contradicting the “never convert missing evidence into zero” contract.
- **Commit:** Introduced by `0855923`.
- **Fix/verify:** Preserve null and omit/discontinue the polygon segment or render an explicit unavailable mark; do not include unavailable factors in visual score area. Add a chart transformation test using the existing missing-market fixture.

### 3. P2 / Confirmed / High confidence — Health overview directly contradicts the non-scrolling three-panel console contract

- **Symptom:** The default Health workspace is an auto-height normal document-flow stack of H-1/H-2/H-3 rather than a non-scrolling three-panel console.
- **Observation:** `HealthWorkspace.tsx:424-460` renders all three overview sections. `globals.css:1679-1715` explicitly says “Health uses normal full-width sections,” sets `height:auto`, `overflow:visible`, and adds vertical margins. This conflicts with `AGENTS.md:79-91`.
- **Root cause:** Commit `1d65e39` changed the overview model without updating the current invariant; `0855923` retained it.
- **Impact:** Dense content can create long scroll and whitespace; the layout does not meet the specified console behavior.
- **Fix/verify:** Restore a viewport-bounded three-panel overview while keeping dense details URL-backed. Add desktop, iPhone portrait, and landscape geometry assertions for no body scroll, visible H-1/H-2/H-3 panels, and no clipping.

### 4. P2 / Confirmed / High confidence — Current layout regression suite is not green

- **Symptom:** `risk panel uses selected tab semantics and remains content-sized` fails.
- **Observation:** Test requires a `.risk-selector` rule with `flex-wrap:wrap` and `overflow:visible` (`tests/risk-explanations.test.mjs:68-90`). Base CSS instead sets column, nowrap, `overflow:auto`, and `max-height:min(520px,70vh)` (`globals.css:569-582`). The visual override wraps only the recommended list and does not reset inherited overflow (`visual-overhaul.css:587-620`).
- **Impact:** The current commit fails a repository-owned regression contract; hidden/scrolling selector controls and inconsistent panel sizing are plausible.
- **Commit:** Conflicting rules introduced in `0855923`.
- **Fix/verify:** Reconcile the intended holdings stack vs recommended chips with explicit per-variant overflow and update the test only if the product contract intentionally changed. Then rerun the complete test suite.

### 5. P2 / Confirmed static deviation / High confidence — Multiple paired column layouts violate the stated same-height/same-width requirement

| Surface | Evidence | Static consequence |
|---|---|---|
| I-3 Risk composition + holdings radar | `globals.css:281` (`1.05fr/.95fr; align-items:start`) | Unequal width and natural unequal height |
| I-4 Axis list + detail | `globals.css:767` (`.72fr/1.28fr`) | Unequal width |
| I-3 Macro selected event/evidence | `globals.css:522,524` (`.7fr/1.8fr`, `1.05fr/1.2fr`) | Unequal width; only flow variant stretches height |
| S-2 chart + linked insight | `globals.css:1119` / analytical split definitions | Deliberate chart-dominant unequal width |
| S-3 chart + evidence/return cards | `globals.css:1198` (`1.65fr/.65fr`) | Unequal width |
| M-4 reminder groups | `globals.css:2002` (`align-items:start`) | Equal width but unequal height |
| Action-board lanes | `globals.css:772` (`align-items:start`) | Equal width but unequal height; contradicts literal equal-height requirement, although compact empty lanes avoid voids |

These may be intentional information-hierarchy choices, but they are not compliant with the user’s stated invariant. A live geometry test must distinguish intended primary/detail asymmetry from true alignment defects before remediation.

### 6. P2 / Confirmed / Medium-high confidence — Chart accessibility is largely pointer/visual only

- Recharts containers in `InvestmentWorkspace.tsx`, `SectoralAnalytics.tsx`, and `SectorDecisionLab.tsx` generally have no explicit role/name/description or keyboard-reachable data equivalent. Tooltips depend on hover/pointer.
- Health spark filaments have `role=img` but only announce the date range/count; the exact daily points exposed on pointer are unavailable to keyboard users (`visual-components.tsx:285-333`).
- Bubble/scatter points have pointer tooltips but no focus model (`SectoralAnalytics.tsx:331-398`).
- **Impact:** Screen-reader and keyboard users cannot recover the same quantitative information.
- **Fix/verify:** Provide chart summaries plus hidden/expandable data tables; make point exploration keyboard accessible where it materially changes interpretation.

### 7. P2 / Confirmed / High confidence — Workspace section bars use tab roles without tab-panel relationships

- `WorkspaceSectionNav` gives each button `role=tab` and `aria-selected` but no `aria-controls` (`shared-ui.tsx:55-76`). The targets are ordinary visible `.workspace-section` wrappers, not one selected `tabpanel`; clicking scrolls and expands a section rather than switching exclusive panels.
- **Impact:** Assistive technology receives an inaccurate tab interaction model.
- **Fix/verify:** Either use a navigation/list of buttons/links for scroll-and-expand behavior, or implement proper tabpanels and `aria-controls`/`aria-labelledby` relationships.

### 8. P3 / Confirmed / High confidence — Health Guidance renders non-functional buttons

- `HealthWorkspace.tsx:223-227` renders every guidance card as `<button>` with no handler, link, expanded state, or other action.
- **Impact:** False affordance and unnecessary keyboard stops.
- **Commit:** Button styling introduced by `0855923`.
- **Fix:** Use non-interactive articles/list items, or define an actual action with accessible outcome.

### 9. P3 / Confirmed coverage gap / High confidence — Geometry/responsive/privacy contracts are under-tested

- The only dedicated geometry helper is Podcast masonry (`tests/podcast-masonry.playwright.mjs:10-47`), and it is not invoked by `npm test` in `package.json`.
- `rendered-html.test.mjs` mostly regex-checks source/CSS contracts; it does not measure all workspace panel widths/heights, body scroll, sticky-header overlap, chart nonzero dimensions after expansion/switch/resize, or Incognito leakage across the whole page.
- There are no equivalent current-run desktop/iPhone portrait/iPhone landscape geometry assertions for all sections.
- **Impact:** CSS override regressions (as demonstrated by the risk failure and Health contract conflict) can merge despite broad source-level tests.

## Layout / compactness assessment

| Area | Compact/no-empty-space posture | Equal size posture | Assessment |
|---|---|---|---|
| Action boards | Compact empty lanes are rendered; no hard fixed lane height | Equal width, natural unequal height | Compact but fails literal equal-height requirement |
| I-2 portfolio | Equal 2-column stretch; treemap fills remaining row | Equal widths and stretch | Best-aligned paired layout; nested donut minimum 620px is a whitespace risk on sparse state |
| I-3 risk | Content-sized via `align-items:start` | Unequal width/height | Compact but not aligned |
| M-2 digests | Natural-height cards and CSS masonry specifically avoid voids | Main two columns equal width, card heights intentionally unequal | Good compactness; do not force equal height if it recreates blank voids |
| M-4 | Single full-width stack; calendar grids equal width | Reminder cards natural unequal height | Compact, but not literal equal height |
| S-2/S-3 | Full-width normal flow prevents clipped console content | Multiple chart/detail asymmetries | Complete content, inconsistent with equal-column invariant |
| Health overview | Auto-height visible content | Three sections are vertical, not 3-panel console | Fails required layout model |
| Health direction columns | Equal widths; columns content-sized in overview; compact detail internally scrolls | Equal width, potentially unequal height in overview due `align-items:start` | Mostly sound, but live geometry needed |
| PDF | Fixed A4 with overflow detector | Fixed page geometry | Static guard good; must visually render every page |

## Static test coverage mapping

| Contract | Existing test coverage | Gap |
|---|---|---|
| Four workspace navigation and section numbering | `rendered-html.test.mjs` | Does not prove runtime Back/Forward or active focus across every deep link |
| Collapsible default/persistence | `rendered-html.test.mjs` | Does not prove chart resize/nonzero dimensions after expansion |
| S-2 isolation / exclusive M-3 earnings | `freshness-and-isolation.test.mjs`, `rendered-html.test.mjs` | Strong static coverage; still needs DOM runtime selection check |
| Canonical action boards | `rendered-html.test.mjs` | No equal-height/width or midnight timer browser test |
| Health direction grouping and Incognito wrapper | `vital-metrics-direction.test.mjs` | Only local wrapper; misses global freshness strip and accessibility metadata |
| Chart calculations | Portfolio donut, FII/DII, investability unit tests | Missing chart transformation check for null→0 |
| Podcast compact masonry | Geometry helper exists | Not in standard test command and not run across target viewports |
| Risk content sizing | Dedicated regression test | Currently failing |
| PDF overflow | Static source assertion | No current-run rendered PDF screenshot/page-by-page comparison in this lane |

## Required remediation sequence

1. Block release/share until Incognito filters all global Health/Notes freshness metadata and accessibility text.
2. Preserve unavailable investability factors as unavailable in the radar visualization; add a missing-data chart test.
3. Reconcile and restore the Health non-scrolling three-panel console contract.
4. Resolve the failing risk-selector contract and run the full suite.
5. Define which paired panels truly require equal width/height versus primary/detail asymmetry; encode each approved geometry as browser assertions.
6. Correct workspace-section ARIA semantics and non-functional Guidance buttons.
7. Add accessible summaries/data tables for all material charts, then test keyboard and screen-reader exposure.
8. Run current desktop, iPhone portrait, iPhone landscape, and print captures for every workspace/section/subpage after remediation.

## Verification evidence

```text
npm run lint
PASS

node --test tests/rendered-html.test.mjs tests/portfolio-donut.test.mjs \
  tests/holding-outer-fill.test.mjs tests/vital-metrics-direction.test.mjs \
  tests/freshness-and-isolation.test.mjs tests/risk-explanations.test.mjs

41 tests: 40 pass, 1 fail
FAIL tests/risk-explanations.test.mjs:68
"risk panel uses selected tab semantics and remains content-sized"
Expected .risk-selector flex-wrap:wrap + overflow:visible
```

