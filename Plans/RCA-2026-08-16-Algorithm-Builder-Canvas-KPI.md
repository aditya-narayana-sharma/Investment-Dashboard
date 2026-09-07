# RCA — Algorithm Builder canvas, KPI boxes, and Composer.trade target UX

**Audit time:** 2026-08-16 11:51–12:00 IST  
**Scope:** Algorithm Canvas / Algorithm Builder (`?view=builder`, sections `board` | `canvas` | `json`). Focus: canvas + KPI boxes, then comparison to the attached Composer.trade Symphony editor screenshot.  
**Do not implement** the new editor from this document. Use `Plans/PLAN-2026-08-16-Algorithm-Builder-Symphony-Editor.md` as the implementation plan.

---

## Executive diagnosis

| Field | Value |
|---|---|
| Current health | **Degraded vs stated target UX.** The existing canvas is a working typed flowchart for StrategyGraphV2, not a broken page. It is the **wrong interaction model** for the Composer.trade tree-of-blocks editor the user attached. |
| Highest severity | **P1** (product-model mismatch: hierarchical blocks vs port-and-edge graph) |
| Confirmed root causes | (1) Canvas was built as a left-to-right node/port graph with KPI as first-class boxes; (2) StrategyGraphV2 has no tree children, Asset/Group/If-Else/Filter kinds, or weight *methods*; (3) KPI inspector/validation never completed the contract that *does* exist (`kpiId` + `weightagePct`). |
| Affected workspaces | Algorithm Canvas only (B-1 Action Board, B-2 Canvas, B-3 JSON). Other four workspaces are out of this product gap. |
| Data current through | Not applicable for canvas authoring. Strategy library recently wired to Supabase with SQLite fallback (uncommitted). Backtest API is **configure-only** (`ran: false`). |
| Main residual risk | Treating KPI-box polish as the fix. That would improve the current flowchart and still not produce the screenshot editor. |

**Project root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`  
**Branch / commit:** `Algorithm-Builder` @ `502d26d` plus uncommitted strategy-store/Supabase work  
**Comparison baseline:** working tree + commit `502d26d` (“Add Algorithm Canvas workspace…”) + Composer.trade screenshot  
**Canonical runtime:** Flask `http://localhost:5050/` returned HTTP 200 for `?view=builder&section=canvas`  
**Live canvas inspected:** **Partial.** HTTP 200 confirmed. In-browser DOM/screenshot of the local canvas **failed** (browser MCP tab could not stay open). Composer screenshot **was** inspected. Code paths below were read in full.  
**Private-data handling:** no tokens, strategy bodies from the live store, or account values included.

---

## What the screenshot is (evidence)

Attached file: `/Users/adityasharma/.cursor/projects/Users-adityasharma-Documents-GitHub-Investment-Dashboard/assets/image-3e8cd702-2e35-4f5a-b2d1-4837b6dae491.png`

Composer.trade **Symphony editor** (“Editor · Backtest”) is a **vertical nested tree**, not a free graph:

- Root title **Core Satellite**.
- Green **WEIGHT Specified** parent with **15% / 30% / 55%** labels on the downward branches (sleeves).
- **15%** → Group “Mini” → **WEIGHT Inverse Volatility 30d** → Asset `VNQ`.
- **30%** → stacked **Asset** leaves (`SPY`, `QQQ`, `EFA`, `IEI`, `VMBS`).
- **55%** → Group “Satellite-Bond” → blue **IF** (`Current Price of SPY > 200d Moving Average of Price SPY`) → Asset `SPY`, plus **ELSE** with **Add a Block**.
- Open **Add a Block** menu: **Asset**, **Group**, **Weight (Allocation)**, **If/Else (Condition)**, **Any/All (Multiple Conditions)**, **Filter**.
- Left sidebar: Save / Undo / Redo / Clean up; name + description; **Trading Frequency = Quarterly**; live Value / Net Deposits; Invest / Sell; Find & Replace.
- Right sidebar: compact equity curve + green **RUN** + “Jump to Backtest”.

KPI role in that UX: **operands inside an If condition** (“Current Price”, “200d Moving Average”), not standalone canvas boxes with ports.

---

## What the current canvas is (evidence)

| Surface | Current implementation | Evidence |
|---|---|---|
| Workspace | Fifth workspace. Nav **Algorithm Canvas**. Chrome title **Algorithm Builder**. Tabs Action Board / Canvas / JSON. | `app/dashboard/utils.ts` 577–582; `BuilderWorkspace.tsx` 12–16, 52–77; `page.tsx` 692 |
| Interaction | Drag palette → drop on 20px grid. Click **output port** then **input port**. Free `position {x,y}`. Bézier edges. | `AlgorithmBuilder.tsx` 208–280, 495–568; `ports.ts` 17–74 |
| Seed | Left-to-right: Universe → KPI RSI 14 → Comparator `< 30` → Entry. Exit present, unwired. | `seed-graph.ts` 16–58 |
| KPI boxes | Palette search of 128 registry KPIs. Drop creates `kind: "kpi"` node. Title defaults to `"KPI"`. Detail shows raw `kpiId`. Inspector shows `kpiId` as read-only `<code>`. | `BuilderPalette.tsx` 49–85; `graph-ops.ts` 24–60; `AlgorithmBuilder.tsx` 94–95; `BuilderInspector.tsx` 86–88 |
| Weightage | Contract has `KpiNodeParams.weightagePct` and `AllocationNodeParams.weightagePct`. UI edits **allocation only**. Seed KPI has `weightagePct: 100` with no control. | `packages/contracts/src/strategy.ts` 59–76, 365–376; `BuilderInspector.tsx` 54–65 vs 86–88; `seed-graph.ts` 28 |
| Validation | Requires `entry_trigger` + `exit_trigger`. Warns unwired exit, allocation Σ≠100, empty asset class. **Does not** check `kpiId` ∈ registry. | `validate.ts` 139–224; `ValidationCode` 140–150 |
| Backtest | Toolbar **Configure backtest**. API stores request, `ran: false`. No chart, no RUN. | `BuilderLibraryActions.tsx` 81–98; `strategy-api.ts` 93–104; `backtest-request.ts` 44–60 |
| Chrome | Top toolbar: Undo/Redo/Export/Import/Validate/Clear/Tutorial/Save/Configure. No name/description/frequency/live AUM. | `AlgorithmBuilder.tsx` 437–458 |

No `parentId`, `children`, `if_else`, `Asset`, `Filter`, or inverse-volatility weight method exists in strategy TypeScript. Grep across `*.ts` / `*.tsx` found none.

---

## Findings (severity order)

### [P1] Product model is a port-and-edge flowchart, not a tree of nested blocks

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** Algorithm Canvas → B-2 Canvas (and B-3 JSON as the same graph)  
- **Symptom:** User cannot build the screenshot strategy (WEIGHT Specified → 15/30/55% sleeves → Group / Asset / If-Else). They get floating boxes and colored wires.  
- **Reproduction:** Open `?view=builder&section=canvas`. Seed is Universe–KPI–Comparator–Entry left-to-right. Palette has UNIVERSE / COMPARATOR / ENTRY TRIGGER, not Asset / Group / If-Else / Filter. There is no “Add a Block” on a parent.  
- **Observation/evidence:** `AlgorithmBuilder.tsx` 523–568 renders `position` + ports. `ports.ts` 70–74 requires matching `EdgeKind`. Screenshot uses implicit parent→child nesting and sleeve % on the stem.  
- **Proximate mechanism:** UI is a graph editor over `StrategyGraphV2.nodes[]` + `edges[]`.  
- **Root cause:** The canvas was specified and shipped as a typed DAG (series/boolean/trigger/allocation ports). The desired product is a **hierarchical allocation tree** (Composer Symphony). Those are different editors.  
- **Trigger:** User attached the Composer screenshot as the desired Algorithm Builder.  
- **Contributing factors:** Tutorial (`BuilderHelpOverlay.tsx` 16–66) teaches “flowchart… click handles… colors must match,” which locks users into the graph mental model.  
- **User impact:** KPI-box tweaks will not produce the screenshot. Building Core Satellite is not possible in the current UI.  
- **Corrective action:** Introduce a tree document (or a tree view that compiles to/from StrategyGraphV2). Render nested blocks + contextual Add Block. Do not keep ports as the primary authoring surface. See implementation plan Phase 1–2.  
- **Verification:** Recreate the screenshot tree (Specified 15/30/55, Group, Asset list, If/Else with KPI operands) without drawing wires.  
- **Code:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard/app/dashboard/builder/AlgorithmBuilder.tsx` 136–214, 495–568; `/Users/adityasharma/Documents/GitHub/Investment Dashboard/app/strategy/ports.ts` 17–74; `/Users/adityasharma/Documents/GitHub/Investment Dashboard/packages/contracts/src/strategy.ts` 108–136  
- **Source:** Composer screenshot 2026-08-16  

### [P1] Block vocabulary does not match Asset / Group / Weight / If-Else / Any-All / Filter

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** B-2 palette + inspector + `NodeKind`  
- **Symptom:** Palette structure blocks are universe, comparator, entry/exit trigger, allocation, AND/OR, risk, paper, broker, rebalance. Screenshot menu is Asset, Group, Weight, If/Else, Any/All, Filter.  
- **Reproduction:** Read `STRUCTURE_BLOCKS` vs screenshot Add a Block menu.  
- **Observation/evidence:** `BuilderPalette.tsx` 9–20. `NodeKind` in `packages/contracts/src/strategy.ts` 13–25 has no `asset`, `group`, `if_else`, `filter`. `logical_group` is AND/OR of **boolean ports**, not a named nest. `allocation` is a single node with `weightagePct` + optional `symbols[]`, not a parent of weighted children. `universe` is asset-class chips, not a Filter over a list.  
- **Proximate mechanism:** Contract kinds were chosen for a trading-path DAG (universe → series → boolean → trigger → allocation → paper/broker).  
- **Root cause:** Block types were designed for signal wiring, not for a portfolio construction tree.  
- **User impact:** No Asset ticker leaf, no named Group, no If with ELSE child, no Filter, no Inverse Volatility weight method.  
- **Corrective action:** Add tree block kinds (or a parallel tree schema). Map later to engine nodes. Weight needs `method: specified | inverse_volatility` plus child percents. If/Else needs THEN/ELSE child slots. Asset needs `symbol` + display name.  
- **Verification:** Add Block menu matches the six screenshot types; Inverse Volatility 30d is selectable on a Weight block.  
- **Code:** `BuilderPalette.tsx` 9–20; `packages/contracts/src/strategy.ts` 13–25, 54–106  
- **Source:** Screenshot Add a Block popover  

### [P1] KPI boxes are the wrong abstraction for the target editor

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** B-2 KPI palette, KPI nodes, inspector  
- **Symptom:** KPIs are draggable **boxes** with series in/out ports. In the screenshot, “Current Price” and “200d Moving Average” live **inside** an If sentence.  
- **Reproduction:** Drop RSI 14. Result is a 176×76 node titled “KPI” with detail `rsi_14` and two series ports (`AlgorithmBuilder.tsx` 40–41, 94–95, 214; `ports.ts` 17–21, 47–49). Screenshot If block is one blue card containing the comparison.  
- **Observation/evidence:** Registry is 128 series KPIs (`packages/kpi-registry/index.ts` 3–38; `kpis.json` count 128, `rsi_14` at line 240). `KpiNodeParams` is `{ kpiId, weightagePct }` (`strategy.ts` 59–62). No condition-expression type. Comparator is a **separate** node with `op` + numeric `value` only — it cannot say “price of SPY vs 200d MA of SPY”.  
- **Proximate mechanism:** KPI = graph node that emits a series. Comparator = node that consumes one series and a constant.  
- **Root cause:** The 128-KPI registry was wired as palette **nodes**, not as **operands** of If/Else. Comparator cannot take two KPI/asset references.  
- **Contributing factors:** Inspector cannot even change `kpiId` after drop (`BuilderInspector.tsx` 86–88). Dropped label stays `"KPI"` (`graph-ops.ts` 24–25, 53–58).  
- **User impact:** Users hunt KPI boxes and wires instead of writing “IF close(SPY) > sma_200(SPY)”. Weightage on a KPI node has no meaning in the screenshot model (weights belong on sleeves).  
- **Corrective action:** Keep the 128-KPI registry. Re-home it as the If/Filter operand catalog. Stop treating KPI as a primary canvas block. Allow comparator/If to reference `{ kpiId, symbol }` on both sides.  
- **Verification:** Recreate screenshot IF without a standalone KPI box; operand picker lists registry KPIs.  
- **Code:** `BuilderPalette.tsx` 49–85; `BuilderInspector.tsx` 86–108; `packages/contracts/src/strategy.ts` 59–67; `packages/kpi-registry/definitions/kpis.json` 240–244  

### [P2] StrategyGraphV2 can only partially encode the screenshot; a schema or compile layer is required

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** Contract + persist + validate + JSON  
- **Symptom:** Even a perfect graph UI cannot losslessly store Core Satellite.  
- **Observation — what maps today:**

  | Screenshot concept | Current field | Fit |
  |---|---|---|
  | Strategy name / description | `graph.name`, `graph.description` | Maps. Not edited in canvas chrome. |
  | Trading frequency | `graph.interval` (`day`/`week`/`month`…) | Partial. No Quarterly label in UI. `rebalance.cadence` unused in inspector. |
  | Specified sleeve % | `allocation.weightagePct` | Partial. One number per node, not % on parent→child edges. Validator sums sibling allocations that share the same parents (`validate.ts` 46–105). |
  | Any/All | `logical_group` `and`/`or` | Partial. Boolean fan-in, not nested groups of assets. |
  | Simple threshold | `kpi` + `comparator` | Partial. Constant RHS only. |
  | Universe / class filter | `universe.assetClasses` (+ optional `symbols`) | Partial. No Filter block UI; symbols not editable in inspector. |
  | Undo/Redo | `GraphHistory` depth 50 | Maps. |
  | Save | `POST /strategies` | Maps (library, not “live symphony”). |
  | Backtest request | `buildBacktestRequest` | Partial. Configure + store only. |

- **Observation — what does not map without a product-model change:**

  | Screenshot concept | Why StrategyGraphV2 cannot hold it |
  |---|---|
  | Nested tree | Nodes have `position`, not `parentId` / `children`. Edges are typed ports, not “is-child-of”. |
  | Asset leaf | No `asset` kind. Tickers only as `symbols?: string[]` on universe/allocation. |
  | Named Group | No container kind. `logical_group` is a boolean op, not a folder. |
  | If/Else with ELSE | No then/else child slots. Exit is a separate `exit_trigger` node. |
  | Weight Inverse Volatility 30d | No weight *method*. Only a number. |
  | Sleeve % on branches | Edge has `kind` (series/boolean/trigger/allocation), not a percent. |
  | Filter | No filter expression over a universe. |
  | RUN equity curve | API explicitly `ran: false`. |
  | Live Value / Invest / Sell | Out of scope; paper/broker nodes are unsubmitted sinks. |

- **Root cause:** Schema v2 was frozen as a DAG of trading-path nodes (`strategy.ts` 1–5: “Do not bump schemaVersion; extend fields in a backward-compatible way”). The screenshot is a **portfolio tree + condition expressions**.  
- **Corrective action:** Prefer a new `SymphonyTree` (or `StrategyTreeV1`) that **compiles** to StrategyGraphV2 for validate/save/backtest, rather than overloading v2 nodes until they become a tree. Extending v2 in place is possible but will break the port validator and seed graph.  
- **Verification:** Round-trip the screenshot tree through JSON without losing ELSE emptiness, Inverse Vol method, or 15/30/55 labels.  
- **Code:** `packages/contracts/src/strategy.ts` 1–136; `validate.ts` 46–105, 139–151; `persist.ts` 99–157; `backtest-request.ts` 44–60  

### [P2] KPI inspector and drop path do not implement the existing KPI contract

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** B-2 inspector + drop  
- **Symptom:** After selecting the seed RSI box, user cannot change KPI, period, or weightage. Dropped KPIs are labelled “KPI”.  
- **Reproduction:** `createNode("kpi", …, { kpiId })` sets `label: "KPI"` (`graph-ops.ts` 24–58). Inspector KPI branch is a `<code>` dump (`BuilderInspector.tsx` 86–88). Weightage input is gated on `node.kind === "allocation"` only (54–65). Persist will default missing KPI `weightagePct` to 100 (`persist.ts` 105–107) but never defaults missing `kpiId`.  
- **Root cause:** Contract added `KpiNodeParams` and a 128-row registry; the inspector was only finished for universe / allocation / comparator / logical_group.  
- **User impact:** Even inside the *current* flowchart, KPI boxes are write-once via drag. JSON is the only editor for `kpiId` / `weightagePct`.  
- **Corrective action:** If the graph editor remains as an advanced view: searchable `kpiId` select from registry, show registry label on the node, optional weightage field, validate unknown `kpiId`. If the tree editor ships, do this work on If operands instead.  
- **Verification:** Drop “RSI 14” → node title “RSI 14”; inspector can switch to `macd_12_26_9`; unknown `kpiId` fails validate.  
- **Code:** `BuilderInspector.tsx` 54–88; `graph-ops.ts` 20–60; `persist.ts` 99–108; `validate.ts` 139–224 (no `unknown_kpi`)  

### [P2] Canvas chrome is a graph toolbar, not the screenshot authoring shell

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** B-2 chrome; B-3 JSON  
- **Symptom:** No left details column (name, description, trading frequency, live value, Invest/Sell, Clean up, Find & Replace). No right RUN preview. Save success text always says “to SQLite” even when `result.store` may be `supabase`. Backtest button says “No run.”  
- **Reproduction:** `AlgorithmBuilder.tsx` 437–458; `BuilderLibraryActions.tsx` 74, 81–94; `BuilderWorkspace.tsx` 69–77 mounts the graph inside a collapsible, not a 3-pane editor. `graph.interval` and `graph.name` are not bound to inputs.  
- **Root cause:** Chrome was built around graph tools (undo, snap, port legend, tutorial) plus library API hooks. Live investing and RUN were explicitly deferred (`configureBacktest` / `ran: false`).  
- **User impact:** The page does not look or behave like the screenshot even if blocks were renamed.  
- **Corrective action:** Re-shell B-2 as left details / center tree / right backtest preview. Bind name, description, interval. Keep Save. Do not fake RUN until an engine exists — show an honest empty/disabled preview rather than “Configured … No run” as the primary CTA. Fix save store label.  
- **Verification:** Layout matches the three-pane screenshot; frequency changes `graph.interval`; save message uses `result.store`.  
- **Code:** `AlgorithmBuilder.tsx` 437–458; `BuilderLibraryActions.tsx` 63–98; `BuilderWorkspace.tsx` 51–77; `strategy-api.ts` 93–104  

### [P2] Algorithm canvas behavioral tests do not run

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** `tests/algorithm-canvas.test.mjs`  
- **Symptom:** `node --experimental-strip-types --test tests/algorithm-canvas.test.mjs` throws `ERR_MODULE_NOT_FOUND` for `packages/contracts/src/strategy` imported from `app/strategy/asset-classes.ts`. Workspace source-string tests pass (3/3).  
- **Root cause:** Extensionless TS import in the contracts barrel; the canvas test imports live modules, the workspace test only `readFile`s sources.  
- **User impact:** Port/KPI/seed/validation regressions can ship unnoticed.  
- **Corrective action:** Import `strategy.ts` with an extension or register the existing `tests/helpers/register-ts-ext.mjs` in the canvas test.  
- **Verification:** The file’s existing tests (seed RSI chain, 128 KPIs, connectNodes, weightage round-trip) pass.  
- **Code:** `app/strategy/asset-classes.ts` 5–20; `tests/algorithm-canvas.test.mjs` 1–13; `tests/helpers/register-ts-ext.mjs`  

### [P3] Validation strip treats warnings as success styling; Validate button only flashes the title

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** B-2 inspector + toolbar  
- **Symptom:** Seed graph is `ok: true` with `exit_unwired` warning (`algorithm-canvas.test.mjs` 136–139). Inspector uses `validation.ok ? "ok" : "err"` (`BuilderInspector.tsx` 126), so the strip is green while a warning is listed. Toolbar Validate sets `connectHint` to `stripTitle` only (`AlgorithmBuilder.tsx` 447).  
- **Root cause:** `ok` means “no errors,” but CSS has no warning state.  
- **Corrective action:** Add `warn` class when `ok && issues.length`. Validate should surface `stripDetail` / first issue.  
- **Code:** `BuilderInspector.tsx` 126–135; `AlgorithmBuilder.tsx` 447; `validate.ts` 216–224  

### [P3] Graph-only UX defects (still real, lower than the product gap)

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** B-2  
- **Items:**  
  1. No edge delete — only node delete or JSON (`removeNode` strips incident edges; no edge click handler).  
  2. Palette is drag-only; no click-to-add (`BuilderPalette.tsx` 38–45, 74–78). Screenshot uses in-place Add a Block.  
  3. `algorithm_reference` exists in the contract and is not in the palette.  
  4. JSON panel calls `setState` during render when the graph changes (`BuilderJsonPanel.tsx` 20–24).  
  5. Editing is disabled below 1080px (`AlgorithmBuilder.tsx` 42, 155, 476) while JSON stays `disabled={false}` (`BuilderWorkspace.tsx` 77).  
- **Root cause:** Graph MVP stopped at drop + click-to-connect + inspector for four kinds.  
- **Corrective action:** Only spend time here if the graph remains an advanced view. Otherwise these die with the flowchart UI.  

---

## What works (do not “fix”)

| Claim | Evidence |
|---|---|
| Fifth workspace isolation; no industry filter / earnings / digest on builder | Grep of builder files: no `sector-dimmed` / `selectedSectorId`. `AGENTS.md` invariants match `BuilderWorkspace.tsx`. |
| Action Board is shared `DailyKanbanBoard` | `BuilderWorkspace.tsx` 65; `tests/algorithm-canvas-workspace.test.mjs` 60–78 passed |
| Routing aliases | `parseWorkspaceView("algorithm-canvas") === "builder"`; `?view=algorithm-canvas` forces `section=canvas` (`workspace-routing.ts` 30–84; tests passed) |
| Seed RSI chain is typed and connectable | `seed-graph.ts` 16–58; `portsCompatible("universe","kpi")` / `kpi→comparator` / `comparator→entry_trigger` |
| KPI registry is exactly 128 unique ids; `rsi_14` exists | `kpi-registry/index.ts` 36–38; `kpis.json` 3, 240 |
| Client and server validate share one function | `app/api/strategies/validate/route.ts`; `strategy-api.ts` 73–80 |
| Undo/redo, 20px snap, export/import JSON exist | `graph-ops.ts` 117–165; `persist.ts` 123–174; `SNAP_PX = 20` |
| Backtest does **not** silently run | `handleBacktestConfigure` returns `ran: false` — correct until an engine exists |
| HTTP canvas route is up | `GET http://localhost:5050/?view=builder&section=canvas` → 200 |

---

## Findings table (parent format)

| Workspace | Section | Sub-Section | Function/File Name | Identified Problem | Root Cause | Proposed Solution |
|---|---|---|---|---|---|---|
| Algorithm Canvas | B-2 Canvas | Interaction model | `AlgorithmBuilder.tsx` | Port-and-edge graph; no nested tree, no Add a Block | Product specified as typed DAG | Tree renderer + contextual Add Block; graph becomes compile/advanced view |
| Algorithm Canvas | B-2 Canvas | Block types | `BuilderPalette.tsx` `STRUCTURE_BLOCKS`; `strategy.ts` `NodeKind` | Missing Asset, Group, Weight methods, If/Else, Any/All, Filter | Kinds are trading-path nodes | New tree block kinds; map to engine later |
| Algorithm Canvas | B-2 Canvas | KPI boxes | `BuilderPalette.tsx`; `BuilderInspector.tsx`; `KpiNodeParams` | KPI is a box with ports; screenshot uses KPI as If operands | Registry wired as nodes | Re-home registry as If/Filter operand catalog |
| Algorithm Canvas | B-2 Canvas | Weight / sleeves | `allocation.weightagePct`; `validate.ts` `warnAllocationSleeves` | One weight field; no 15/30/55 branch labels; no Inverse Vol | Weight is a node param, not a parent method + child percents | Weight block with `method` + child `%` |
| Algorithm Canvas | B-2 Canvas | Conditions | `comparator` params `op`+`value` | Cannot express `price(SPY) > sma_200(SPY)` or ELSE | Comparator is series vs constant | If/Else with two `{kpiId,symbol}` sides + THEN/ELSE children |
| Algorithm Canvas | B-2 Canvas | KPI inspector | `BuilderInspector.tsx` 86–88 | `kpiId` read-only; no KPI weightage control | Inspector unfinished vs contract | Registry select + label; or skip if tree ships first |
| Algorithm Canvas | B-2 Canvas | KPI drop label | `graph-ops.ts` `defaultLabel` | Dropped node titled “KPI” | Label not taken from registry | `kpiById(kpiId).label` |
| Algorithm Canvas | B-2 Canvas | Validation | `validate.ts` | No `unknown_kpi`; warnings styled as OK | Validator is trigger/port-centric | `unknown_kpi` error; warn CSS; tree validators later |
| Algorithm Canvas | B-2 Canvas | Chrome | `AlgorithmBuilder.tsx` toolbar | No name/description/frequency/live AUM; no RUN panel | Graph-tool chrome | 3-pane shell; honest backtest preview |
| Algorithm Canvas | B-2 Canvas | Save | `BuilderLibraryActions.tsx` 74 | Always “Saved … to SQLite” | Hardcoded store name | Use `result.store` |
| Algorithm Canvas | B-2 Canvas | Backtest | `strategy-api.ts` `handleBacktestConfigure` | Configure only; no equity curve | Engine not implemented | Keep `ran:false`; do not label RUN until engine exists |
| Algorithm Canvas | B-3 JSON | Sync | `BuilderJsonPanel.tsx` 20–24 | `setState` during render | Naive graph→textarea sync | `useEffect` |
| Algorithm Canvas | Tests | Canvas unit | `tests/algorithm-canvas.test.mjs` | File fails to load (`ERR_MODULE_NOT_FOUND`) | Extensionless contracts import | Register TS hooks or add `.ts` |
| Algorithm Canvas | B-1 Board | Action Board | `DailyKanbanBoard` | None vs AGENTS.md | — | Keep shared board; do not replace with Composer chrome |
| Investment / Sectors / Intelligence / Health | — | — | — | No defect from this RCA | Isolated | Do not leak tree editor or industry filters |

---

## Scope and baseline

| Item | Value |
|---|---|
| Project root | `/Users/adityasharma/Documents/GitHub/Investment Dashboard` |
| Canonical runtime | `http://localhost:5050/` (HTTP 200) |
| Branch/commit | `Algorithm-Builder` / `502d26d3f9584ccf5804007cbc933905338bc039` |
| Comparison baseline | Current canvas + Composer.trade screenshot (user-stated desired editor) |
| Audit time | 2026-08-16 ~11:51 IST |
| URLs | `?view=builder&section=canvas` (also `board`, `json`; alias `?view=algorithm-canvas`) |
| Viewports | Desktop graph editor is the intended edit surface (`min-width: 1080px`). iPhone portrait/landscape **not** visually verified this pass. |
| Private-data | No credentials or live strategy rows quoted |
| Excluded / blocked | In-browser canvas screenshot (MCP tab failed). iPhone layouts. Live Supabase library contents. Actual backtest engine. |

---

## Change map

| Change group | Files | Affected surfaces | Risk | Tests |
|---|---|---|---|---|
| Shipped canvas (HEAD) | `app/dashboard/builder/*`, `BuilderWorkspace.tsx`, `app/strategy/graph-*.ts`, `ports.ts`, `validate.ts`, `seed-graph.ts`, `packages/kpi-registry/*`, `packages/contracts/src/strategy.ts` | B-2 / B-3 | High vs screenshot UX | `algorithm-canvas-workspace.test.mjs` pass; `algorithm-canvas.test.mjs` **does not load** |
| Uncommitted store | `strategy-store.ts`, `supabase-*.ts`, `persist.ts`, `strategy-api.ts`, migrate script | Save to library | Medium (save label lie; fallback) | `strategy-store-facade.test.mjs` (not re-run for this RCA) |
| User target (not in repo) | Composer screenshot | Desired B-2 | Product-model change | None |

---

## Workspace and section coverage

| Workspace | Section | Children | Collapsible | Sources | States tested | Result |
|---|---|---|---|---|---|---|
| Algorithm Canvas | B-1 Action Board | Shared 3-lane kanban | Yes | Static `kanbanItems.builder` | Code + workspace test | OK vs AGENTS.md |
| Algorithm Canvas | B-2 Canvas | Palette, graph, inspector, tutorial, library actions | Yes | Seed graph + KPI registry | Code; HTTP 200; **no live DOM** | Works as flowchart; **fails** screenshot UX |
| Algorithm Canvas | B-3 JSON | Textarea apply | Yes | Same `StrategyGraphV2` | Code | Round-trip helpers exist; render-setState smell |
| Other four workspaces | I/S/M/H | — | — | — | Not in scope | No leakage found in builder sources |

---

## Rendering and interaction

| Surface | Desktop | iPhone portrait | iPhone landscape | Console/API | Finding |
|---|---|---|---|---|---|
| B-2 graph | Designed ≥1080px; edit enabled | Read-only banner in CSS/media | Same | HTTP 200; DOM not captured | Opposite of screenshot tree |
| B-2 KPI list | 280px scroll, 128 items, drag-only | Disabled with canvas | Disabled | — | Wrong role vs If operands |
| B-2 inspector | Port legend + partial fields | Disabled | Disabled | — | No KPI select; no tree details |
| Composer screenshot | 3-pane tree | n/a | n/a | n/a | Target |

---

## Source freshness ledger

Canvas authoring is not a Kite/Mail/Health feed. Ledger for this scope:

| Source | Required-through | Observed-through | Ingested-at | Status | Evidence | Gap |
|---|---|---|---|---|---|---|
| KPI registry | 128 unique series ids | 128 / `rsi_14` present | repo | live (static) | `kpis.json` | None for count |
| Seed graph | Renderable RSI path | Present | repo | live (static) | `seed-graph.ts` | Exit unwired by design |
| Strategy library | Save/load | Code path only | uncommitted Supabase/SQLite | untested live | `strategy-api.ts` | Not exercised in browser |
| Backtest engine | RUN + equity curve | Configure-only | n/a | **unavailable** | `ran: false` | Entire RUN panel |
| Live investments | Value / deposits / Invest | None | n/a | **out of scope** | screenshot only | Do not fake |

---

## Cross-section reconciliation

| Entity/metric | Surfaces compared | Expected (screenshot) | Observed (dashboard) | Difference | Cause |
|---|---|---|---|---|---|
| Weight 15/30/55 | Screenshot vs allocation node | % on parent branches | One `weightagePct` on allocation; KPI also has unused weight | Different model | DAG params vs tree edges |
| RSI / MA | Screenshot If vs KPI box | Operand in IF sentence | Standalone `kpi` node + constant comparator | Different model | Series-port design |
| Frequency | Screenshot Quarterly vs `interval` | Visible dropdown | `DEFAULT_INTERVAL` `"day"`, no chrome | Hidden field | Inspector gap |
| Backtest | RUN vs Configure | Chart + RUN | “Configured … No run.” | Intentional stub | No engine |
| Workspace isolation | Builder vs S-2 | No industry filter | None in builder sources | Match | Correct |

---

## Verification results

| Check | Command/action | Result | Evidence |
|---|---|---|---|
| Inventory scan | `scan_dashboard.py` | 5 workspaces including `builder` | `/tmp/dashboard-rca/rca-inventory.md` |
| Canvas HTTP | `curl localhost:5050/?view=builder&section=canvas` | 200 | This audit |
| Browser canvas | MCP navigate | **Blocked** | Tab create/navigate failed |
| Composer screenshot | Read attached PNG | Inspected | `assets/image-3e8cd702-…png` |
| Workspace tests | `node --test tests/algorithm-canvas-workspace.test.mjs` | 3 pass | This audit |
| Canvas unit tests | `node --experimental-strip-types --test tests/algorithm-canvas.test.mjs` | **Fail to load** | `ERR_MODULE_NOT_FOUND` contracts |
| Isolation | Grep builder for sector filter | Clean | This audit |

---

## Recommended next implementation slice (do not start from this RCA)

**Do not polish KPI boxes as the primary next PR.** That optimizes the wrong editor.

**Slice 0 (unblocks tests, small):** Make `tests/algorithm-canvas.test.mjs` load.

**Slice 1 (product contract, no visual rewrite yet):** Write `StrategyTreeV1` (or `SymphonyTree`) with block kinds `asset | group | weight | if_else | any_all | filter`, child arrays, weight method + percents, If operands `{ kpiId, symbol }`. Define compile → today’s StrategyGraphV2 for save/validate. Keep schemaVersion `"2"` on the compiled graph.

**Slice 2 (first visible editor):** Replace B-2 center pane with a vertical tree renderer + Add a Block menu + left name/description/frequency. Seed a Core-Satellite-shaped demo (Indian symbols, not US ETFs). Keep B-3 as compiled JSON. Keep B-1 `DailyKanbanBoard`.

**Slice 3:** Bind 128-KPI registry to If/Filter operands. Drop KPI-as-node from the primary palette.

**Slice 4:** Right preview stays honest: “Backtest not run” until an engine exists. Do not ship a fake RUN chart.

Full steps: `Plans/PLAN-2026-08-16-Algorithm-Builder-Symphony-Editor.md`.

---

## Residual risks and open questions

- **Blocked evidence:** Live DOM of local canvas (MCP). Confirm visually after Slice 2.  
- **Unverified:** Whether the user wants US-style Asset leaves (tickers) immediately, or Indian Equity/ETF via existing `ASSET_CLASSES`. Recommend Indian symbols + existing universe filter.  
- **Unverified:** Live Invest/Sell — do **not** implement; paper/broker sinks already exist as unsubmitted.  
- **Monitoring:** If graph editor is kept as advanced JSON/graph, KPI inspector defects remain user-facing until Slice 3.  
- **Follow-up:** After Slice 1 contract review, implement Slice 2 only.

---

## Remediation plan (summary)

| Priority | Action | Owner surface | Dependency | Acceptance test |
|---|---|---|---|---|
| P1 | Adopt tree document + compile-to-v2 | contract | Product sign-off | Screenshot tree round-trips |
| P1 | Tree UI + Add Block | UX | Tree document | Build 15/30/55 + If/Else without wires |
| P1 | KPI registry → If operands | UX + registry | Tree If block | IF close(SYMBOL) > sma_200(SYMBOL) |
| P2 | 3-pane chrome; fix save store label | UX | None | Frequency + name visible; save text truthful |
| P2 | Fix canvas unit test loader | tests | None | `algorithm-canvas.test.mjs` runs |
| P2 | KPI inspector (only if graph stays visible) | UX | — | Select + label + unknown_kpi |
| P3 | Validation warn styling; JSON useEffect | UX | — | Seed warning is amber |
| P3 | Do not fake RUN / live AUM | process | Engine / broker | Preview says not run |
