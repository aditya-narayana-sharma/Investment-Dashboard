# Implementation Plan — Algorithm Builder as a Composer-style tree editor

Implements the proposed solutions in `Plans/RCA-2026-08-16-Algorithm-Builder-Canvas-KPI.md`.  
**Do not start a visual rewrite until Slice 1 (tree contract) is reviewed.**  
This plan does **not** implement the editor; it is the execution sequence.

Target UX (user-attached): Composer.trade Symphony editor — vertical nested blocks, WEIGHT Specified sleeves with percents, Group / Asset / If-Else / Any-All / Filter, Add a Block, left details, right backtest preview + RUN.

Current UX: StrategyGraphV2 port-and-edge flowchart with KPI boxes (`?view=builder&section=canvas`).

---

## Priority board

| Priority | Action | Owner surface | Dependency | Acceptance test |
|---|---|---|---|---|
| P2-0 | Fix `tests/algorithm-canvas.test.mjs` module load | tests | None | File runs; existing assertions pass |
| P1-1 | Specify `StrategyTreeV1` + compile-to-v2 | contract | Product sign-off on mapping table | Tree JSON ↔ compiled `schemaVersion: "2"` documented + tested |
| P1-2 | Tree canvas + Add a Block | UX | P1-1 | Recreate screenshot structure (Indian symbols) without ports |
| P1-3 | KPI registry as If/Filter operands | UX + registry | P1-2 | IF `close(SYMBOL) > sma_200(SYMBOL)`; no KPI box required |
| P2-4 | 3-pane chrome (details / tree / preview) | UX | P1-2 | Name, description, frequency visible; save uses `result.store` |
| P2-5 | Graph remains advanced (JSON / optional graph) | UX | P1-2 | B-3 still lossless; B-1 still `DailyKanbanBoard` |
| P3-6 | Honest backtest pane | UX + API | Engine (later) | No fake equity curve; no RUN until `ran` can be true |
| P3-7 | Graph-only KPI inspector (only if graph stays in primary UI) | UX | Skip if P1-3 ships first | Registry select + `unknown_kpi` |

---

## Decision that must stay true

1. **Five workspaces stay separate.** Tree editor lives only in Algorithm Canvas (`?view=builder`). No industry filters, earnings, or Market Intelligence digest.
2. **B-1 stays `DailyKanbanBoard`.** Do not replace the action board with Composer chrome.
3. **Do not bump `StrategyGraphV2.schemaVersion`.** Extend via a parallel tree document that compiles to v2, or add backward-compatible optional fields only if compile proves insufficient.
4. **Do not fake live Value / Invest / Sell / RUN.** Paper and broker sinks stay unsubmitted. Backtest stays `ran: false` until an engine exists.
5. **128-KPI registry stays the catalog.** Change *where* it is used (operands), not the count contract.
6. **Indian market first.** Seed uses NSE/BSE Equity + ETF (+ Cash), not US `SPY`/`QQQ` clones.

---

## Mapping law (Slice 1 must implement this table)

| Tree block | Tree fields | Compile target on StrategyGraphV2 | Notes |
|---|---|---|---|
| Document | `name`, `description`, `interval` | `graph.name`, `graph.description`, `graph.interval` | Frequency dropdown binds `interval` (`day`/`week`/`month`; label Quarterly → `month` or new cadence later) |
| Weight | `method: specified \| inverse_volatility`, `lookback?`, children with `%` | One `allocation` per sleeve + `weightagePct`; parent grouping via shared incoming trigger **or** `algorithm_reference` | Specified 15/30/55 must survive round-trip. Inverse Vol has no engine yet — store method, warn “not executable” |
| Asset | `symbol`, `label` | `allocation.symbols` / `universe.symbols` | First-class leaf in the tree; flattened on compile |
| Group | `label`, children | No v2 kind. Compile children only; keep group in tree JSON | v2 cannot store the folder — tree document is source of truth |
| If/Else | `left: {kpiId,symbol}`, `op`, `right: {kpiId,symbol}\|number`, `then[]`, `else[]` | `kpi` + `comparator` + `entry_trigger` / `exit_trigger` (then/else) | This is the lossy compile. Tree must be stored, not only v2 |
| Any/All | `op: and\|or`, children (conditions) | `logical_group` | Fits v2 well |
| Filter | `assetClasses`, optional rules | `universe` | Maps to existing universe params |
| KPI registry | operand pick list | `kpi.kpiId` when compiled | **Not** a primary tree block |

**Honesty:** Group, If/Else ELSE, Inverse Vol, and sleeve percents-on-edges **cannot** live only in today’s v2 without data loss. Therefore the **saved library record must store the tree** (plus compiled graph for the existing validator).

Suggested persist shape (do not invent a third schema version name in the UI):

```ts
type StrategyRecord = {
  tree: StrategyTreeV1;          // source of truth for the editor
  graph: StrategyGraphV2;        // compiled, schemaVersion "2"
};
```

`upsertStrategy` already stores a graph. Slice 1 should add an optional `tree` column/json field or wrap `graph.description` — **prefer an explicit `tree` field** on the store row, not a hack inside `description`.

---

## Phase 0 — Unblock tests (small, do first)

### 0.1 Load the canvas unit file

- Cause: `app/strategy/asset-classes.ts` re-exports `packages/contracts/src/strategy` without `.ts`.
- Fix options (pick one):
  1. Import `./strategy.ts` from the contracts barrel, or
  2. `node --import ./tests/helpers/register-ts-ext.mjs --experimental-strip-types --test tests/algorithm-canvas.test.mjs`
- Do **not** weaken assertions.

### 0.2 Acceptance

```bash
node --experimental-strip-types --import ./tests/helpers/register-ts-ext.mjs --test tests/algorithm-canvas.test.mjs tests/algorithm-canvas-workspace.test.mjs
```

Expect: seed RSI chain, 128 KPIs, `connectNodes`, weightage round-trip all pass.

---

## Phase 1 — Tree contract (no new visual editor yet)

### 1.1 Add `packages/contracts/src/strategy-tree.ts`

Types only, exhaustive switches, no React.

Required kinds: `asset`, `group`, `weight`, `if_else`, `any_all`, `filter`.  
Each node: `id`, `kind`, `label?`, `params`, `children: TreeNode[]`.  
Weight child wrapper: `{ percent?: number, node }`.  
If params: `{ left, op, right }` + `then` / `else` as children slots (or named child maps — pick one and test it).

### 1.2 Compiler `app/strategy/tree-compile.ts`

- `compileTreeToGraph(tree): StrategyGraphV2`
- `validateTree(tree)` — percents Σ≈100 per specified-weight parent; unknown `kpiId`; empty ELSE allowed (warning); Inverse Vol → warning `weight_method_unsupported`
- Keep `validateStrategyGraph` on the compiled graph (entry/exit may be synthesized from If then/else)

### 1.3 Seed

Replace *primary* demo with a Core-Satellite-shaped **tree** (e.g. 15% gold/REIT ETF sleeve, 30% equity assets, 55% bond If/Else using `close` vs `sma_200` on `NIFTYBEES` or a real NSE symbol).  
Keep `createSeedGraph()` as the compile output so B-3 and old tests still have a v2 graph.

### 1.4 Tests (new file)

`tests/strategy-tree.test.mjs`:

- 15+30+55 specified weights compile to allocation Σ 100
- If/Else with empty ELSE round-trips
- Unknown kpiId fails tree validate
- Compiled graph still `schemaVersion === "2"`
- Group labels survive tree JSON, may vanish on graph-only export (document that)

### 1.5 Acceptance

No UI change required. JSON of the screenshot-equivalent tree compiles and validates.

---

## Phase 2 — First visible tree editor (the screenshot center pane)

### 2.1 Layout

In `BuilderWorkspace` B-2 (or a new `SymphonyEditor.tsx` mounted instead of `AlgorithmBuilder` as the default):

```
[ Left details 240px ] [ Tree canvas 1fr ] [ Preview 260px ]
```

Do **not** reuse port handles. Vertical stem + branch percents. Nested cards.

### 2.2 Add a Block

Contextual `+ Add a Block` on every group / weight / if-then / else / filter. Menu:

1. Asset  
2. Group  
3. Weight (Allocation)  
4. If/Else (Condition)  
5. Any/All  
6. Filter  

No drag-from-left KPI list on this pane.

### 2.3 Block chrome

- Weight: method select (`Specified` | `Inverse Volatility 30d`); child % labels on the stem  
- Asset: symbol search (start with typed symbol + label; Kite instrument search can come later)  
- If: two operand pickers (KPI from registry + symbol) + operator; THEN / ELSE wells  
- Group: editable name  
- Filter: existing `ASSET_CLASSES` chips  

### 2.4 Selection

Clicking a block fills the left details (not a port legend). Delete removes the subtree.

### 2.5 Keep

- Undo/Redo (history of **tree**, not only graph)  
- Export/Import of the **tree** (and compiled graph)  
- Desktop-first; below 1080px read-only is acceptable for v1  
- Tutorial rewritten for tree (do not teach ports)

### 2.6 What to hide, not delete

- `AlgorithmBuilder` graph (ports, KPI boxes) behind an “Advanced graph” toggle or B-3 only  
- Do not delete `ports.ts` / `graph-ops.ts` until compile is trusted  

### 2.7 Acceptance (manual)

1. `?view=builder&section=canvas` shows a vertical tree, not Bézier wires.  
2. Recreate: Weight Specified 15/30/55 → Group + assets + If/Else.  
3. Add a Block works in ELSE.  
4. No industry filter / earnings on the page.  
5. `npm run lint` + tree tests + workspace tests.

---

## Phase 3 — KPI registry as operands (kills the KPI box)

### 3.1 Operand picker

Reuse `searchKpis` / `KPI_BUCKETS` inside If and Filter, not as canvas nodes.

Operand = `{ kpiId, symbol }`. Both sides of If can be KPI+symbol or the right side a number (keep today’s comparator as a subset).

### 3.2 Node display

If card text: `IF {left.label} of {symbol} {op} {right}`.  
Example: `IF Close of NIFTYBEES > SMA 200 of NIFTYBEES`.

### 3.3 Deprecate KPI-as-node in the primary palette

`STRUCTURE_BLOCKS` / KPI list disappear from the tree palette. Compiled graph may still emit `kind: "kpi"` nodes.

### 3.4 Optional graph-inspector fix (only if Advanced graph stays visible)

- `kpiById` select  
- `label` from registry on drop  
- `unknown_kpi` in `validate.ts`  
- Do **not** surface KPI `weightagePct` in the tree UI (weights belong on Weight blocks)

### 3.5 Acceptance

Screenshot IF is buildable. Dropping a KPI box is no longer the happy path.

---

## Phase 4 — Chrome parity (left / right), still honest

### 4.1 Left details (from screenshot, minus live brokerage)

| Control | Bind | Notes |
|---|---|---|
| Save changes | existing `saveStrategyToLibrary` | Message: `Saved X to ${result.store}` |
| Undo / Redo | tree history | Already exists for graph; move to tree |
| Clean up | auto-layout tree | New; snap vertical spacing |
| Name / Description | `tree.name` / `tree.description` | Also copy onto compiled graph |
| Trading frequency | `tree.interval` | Day / Week / Month (Quarterly = month or explicit later) |
| Find | search block labels/symbols | Nice-to-have after v1 |
| Value / Invest / Sell | **omit** | Do not stub dollar amounts |

### 4.2 Right preview

- Title: Backtest preview  
- If no engine: empty state + “Configure only — no run” (today’s API)  
- Button label: **Configure** until `ran` can be true; then **RUN**  
- Do not draw a fake equity curve  

### 4.3 Save payload

Persist `{ tree, graph: compile(tree) }` so library reload opens the tree, not a reconstructed guess from edges.

### 4.4 Acceptance

Save/reload preserves 15/30/55, Group names, empty ELSE, Inverse Vol method. Preview never looks live.

---

## Phase 5 — Validation and tests after UI lands

| Test | Asserts |
|---|---|
| `tests/strategy-tree.test.mjs` | Compile + validate + percent math |
| `tests/algorithm-canvas-workspace.test.mjs` | Still: DailyKanbanBoard, Algorithm Builder title, no compact board |
| New `tests/algorithm-tree-ui.test.mjs` | Source contains Add a Block kinds; no requirement that primary palette lists `kind: "kpi"` |
| `validateStrategyGraph` | Still rejects missing entry/exit on **compiled** graphs |
| Isolation | Builder sources still have zero `sector-dimmed` |

Run:

```bash
npm run lint
node --experimental-strip-types --import ./tests/helpers/register-ts-ext.mjs --test \
  tests/algorithm-canvas.test.mjs \
  tests/algorithm-canvas-workspace.test.mjs \
  tests/strategy-tree.test.mjs
```

Browser (after Slice 2): `http://localhost:5050/?view=builder&section=canvas` at desktop width. Confirm tree, Add a Block, If operands, no wires.

---

## Explicit non-goals (this program)

- Do not implement a Composer clone of live AUM, Watch, Share, or Invest/Sell.  
- Do not run a backtest engine in Slice 2–4.  
- Do not put the tree editor in Sectoral Analytics or Market Intelligence.  
- Do not add US-only demo assets as the default seed.  
- Do not spend a full sprint polishing KPI boxes, port colors, or the minimap.  
- Do not replace B-1 with a custom kanban.

---

## Suggested PR cuts

| PR | Contents | Risk |
|---|---|---|
| PR-0 | Test loader fix only | Low |
| PR-1 | `strategy-tree.ts` + compile + tests + store `tree` field | Medium (persist) |
| PR-2 | Tree UI + Add a Block + new seed | High (UX) |
| PR-3 | Operand picker + hide KPI boxes | Medium |
| PR-4 | 3-pane chrome + save label + honest preview | Low |

---

## Verification against the screenshot (Definition of Done)

The canvas is done for this RCA when a user can, without drawing wires:

1. Create WEIGHT Specified with 15 / 30 / 55 on the stems.  
2. Put a named Group under a sleeve.  
3. Add Asset leaves (Indian symbols).  
4. Add If/Else whose condition uses two KPI-registry operands (or KPI vs number).  
5. Use Add a Block inside ELSE.  
6. Optionally set Weight method Inverse Volatility (stored, warned if not executable).  
7. Save/reload without losing tree structure.  
8. See name + frequency on the left.  
9. See a preview pane that does not lie about a run.  
10. B-1 is still the shared Daily Action Board.

Until then, the Algorithm Builder remains a typed flowchart with unfinished KPI inspectors — a valid graph MVP, **not** the editor in the screenshot.
