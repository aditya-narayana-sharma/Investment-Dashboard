# RCA — Algorithm Builder + Strategies layout (Composer-informed)

**Audit time:** 2026-08-16 Asia/Kolkata  
**Baseline:** working tree on `Algo-Builder+Strategy` (uncommitted builder/KPI work) plus last commit `12fdc3c`.  
**Do not treat this as a rewrite of** `Plans/PLAN-2026-08-16-Algorithm-Builder-Symphony-Editor.md`.

## Executive diagnosis

- Current health: `Degraded` (chrome and nav work; Builder/Strategies panes were unbounded)
- Highest severity: `P2`
- Confirmed root causes: CSS grid stretch + 620px black canvas; exclusive tabs not applied; ReadOnlyTree reused the full editor canvas; JSON textarea unstyled
- Affected workspaces: Algorithm Canvas (`builder`), Strategies
- Data current through: not a freshness outage — layout/RCA only
- Main residual risk: live `/api/strategies/live` yfinance failures still show honest `—` tiles; no fabricated curves

## Findings table

| Workspace | Section | Sub-Section | Function/File Name | Identified Problem | Root Cause | Proposed Solution |
|---|---|---|---|---|---|---|
| Algorithm Canvas | B-2 Canvas | Tree pane | `algorithm-builder.css` `.builder-canvas` / `.symphony-root` | Giant black void; stray lines / nodes appear off-right | Canvas used graph-editor min-height 620px + `#07090c` grid; CSS grid stretched to 128-KPI column; `symphony-root { min-width: min(100%, 1100px) }` overflowed | Bounded 3-pane (`min(78dvh, 880px)`), panel background, `min-width: 0`, preview scrolls independently |
| Algorithm Canvas | B-2 Canvas | KPI registry | `KpiRegistryPanel.tsx` | Registry not in a formed space; stretched the center void | Per-bucket 2-col lists of 128 KPIs lived in the same grid row as the tree | 8×16 tile grid in the right Backtest overview pane; `—` when missing |
| Algorithm Canvas | B-1 / B-2 / B-3 | Section tabs | `BuilderWorkspace.tsx` | Canvas + JSON + board stacked; raw JSON exploded height | All three collapsibles rendered; JSON textarea had no max-height | Exclusive `hidden` on inactive sections; JSON only on JSON tab; textarea `max-height: min(64dvh, 640px)` |
| Algorithm Canvas | Chrome | Title | `SymphonyEditor.tsx` | Duplicate “Algorithm Builder” vs workspace chrome | Editor repeated workspace title | Workspace chrome keeps **Algorithm Builder**; editor eyebrow is `EDITOR · TREE` |
| Strategies | Y-2 Library | Cards | `ReadOnlyTree.tsx` + `strategies-workspace.css` | Huge black rectangles / tiny unreadable trees; page looks repeated | Each card mounted full `TreeCanvas` with builder-canvas min-height and 1100px root | Compact 220px preview; 2-col gallery; 6-up OOS stat tiles (Composer Backtest Overview) |
| Strategies | Y-1 / Y-2 | Tabs | `StrategiesWorkspace.tsx` | Action Board + Library stacked on one long scroll | Both sections always mounted visible | Exclusive section visibility (`y1` \| `y2`) |
| Both | URL | Workspace switch | `page.tsx` | Screenshot looked like both workspaces on one page | Not a dual-mount (page still `workspace ===`); stacking was intra-workspace sections + vision on a 300×1024 JPEG | Keep six workspaces exclusive; section tabs switch panes like Composer Editor vs Backtest |
| Algorithm Canvas | B-2 | Live KPIs | `SymphonyEditor.tsx` live fetch | Possible `Error: [object Object]` in blurry shot | Not reproduced in current stringify paths (`error instanceof Error`); vision hallucination on 300px JPEG more likely | Keep honest `payload.message` strings; tiles stay `—` |

## Composer mapping (public docs only)

| Composer surface | This dashboard |
|---|---|
| Symphony editor: left details, center nested blocks in a bounded pane, right backtest preview | `symphony-zones`: Details / `TreeCanvas` / Backtest overview + 8×16 KPI tiles |
| Add a Block · Weight / If-Else / Any-All / Filter / Group / Asset | Unchanged `TreeCanvas` block menu |
| Backtest Overview: return / ann. / max DD cards; curve only after run | `symphony-backtest-stats` + `EquityCurve` only when `ran=true` |
| Discover / strategy page: OOS stats + compact logic | Strategies library cards; 9 Composer-public reconstructions; no live 128-KPI fetch per card |
| Editor vs Backtest as separate views | Action Board / Canvas / JSON and Action Board / Library are exclusive tabs |

## Verification

- `npm run lint`
- `npm run build`
- `http://127.0.0.1:5050/?view=builder&section=canvas`
- `http://127.0.0.1:5050/?view=strategies&section=y2`
