import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("primary canvas is a vertical tree with Add a Block kinds and no wires", async () => {
  const [editor, canvas, picker, panel, ops, workspace, canvasCss, jsonCss] = await Promise.all([
    readFile(new URL("../app/dashboard/builder/SymphonyEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/TreeCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/AssetInstrumentPicker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/KpiRegistryPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/tree-ops.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/BuilderWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/algorithm-builder.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/algorithm-builder-json.css", import.meta.url), "utf8"),
  ]);
  const css = `${canvasCss}\n${jsonCss}`;

  assert.match(workspace, /SymphonyEditor/);
  assert.doesNotMatch(workspace, /<AlgorithmBuilder/);
  assert.match(workspace, /defaultOpen/);
  assert.match(workspace, /<DailyKanbanBoard workspace="builder"\s*\/>/);
  assert.doesNotMatch(workspace, /sector-dimmed|selectedSectorId|Earnings/);
  assert.match(editor, /data-canvas-mode="tree"/);
  assert.match(editor, /Advanced graph/);
  assert.match(editor, /Add a Block|TreeCanvas/);
  assert.match(canvas, /Add a Block/);
  assert.match(canvas, /kind: "asset"/);
  assert.match(canvas, /kind: "group"/);
  assert.match(canvas, /kind: "weight"/);
  assert.match(canvas, /kind: "if_else"/);
  assert.match(canvas, /kind: "any_all"/);
  assert.match(canvas, /kind: "filter"/);
  assert.doesNotMatch(canvas, /kind: "kpi"/);
  assert.doesNotMatch(editor, /beginLink|completeLink|data-port="out"/);
  assert.doesNotMatch(canvas, /builder-edges|C \$\{mid\}|bezier/i);
  assert.match(canvas, /searchKpis/);
  assert.match(css, /symphony-tree/);
  assert.match(css, /symphony-percent/);
  assert.match(css, /symphony-add-block/);
  assert.match(css, /symphony-weight-children/);
  assert.match(css, /symphony-if-wells/);
  assert.match(canvas, /data-tree-orientation="vertical"/);
  assert.match(canvas, /data-orientation="vertical"/);
  assert.match(canvas, /data-stem-count/);
  assert.match(canvas, /symphony-if-wells/);
  assert.match(css, /\.symphony-children\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.symphony-weight-children[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\.symphony-if-wells\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.doesNotMatch(css, /min-width:\s*min\(100%,\s*1100px\)/);
  assert.doesNotMatch(css, /\.symphony-weight-children\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.doesNotMatch(css, /\.symphony-if-wells\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/s);
  assert.match(canvas, />Delete</);
  assert.match(canvas, /onAdd,\s*onDelete,\s*onToggleMenu/);
  assert.doesNotMatch(editor, /Composer|Invest\/Sell|\$1,500/);
  assert.match(editor, /ran=true only after a real engine pass/);
  assert.match(editor, /Run backtest/);
  assert.match(editor, /KpiRegistryPanel/);
  assert.match(editor, /className="builder-preview"[\s\S]*<KpiRegistryPanel/);
  assert.match(editor, /data-layout="details-backtest-above-tree"/);
  assert.match(editor, /symphony-selected/);
  assert.match(workspace, /builder-canvas-section/);
  assert.match(editor, /kpiSymbol/);
  assert.match(editor, /useState\(""\)/);
  assert.doesNotMatch(editor, /collectTreeSymbols\(tree\)\[0\]/);
  assert.match(panel, /AssetInstrumentPicker/);
  assert.match(panel, /data-testid="kpi-registry-filter"/);
  assert.match(panel, /data-testid="kpi-registry-filter-dropdown"/);
  assert.match(panel, /KPI_BUCKETS/);
  assert.match(panel, /toggleBucket/);
  assert.match(panel, /All \{KPI_REGISTRY_COUNT\}/);
  assert.match(panel, /No asset selected|Select instrument|KPI registry instrument/);
  assert.doesNotMatch(panel, /GOLDBEES|NIFTYBEES|JUNIORBEES/);
  assert.match(css, /kpi-registry-filter-trigger/);
  assert.match(canvas, /symphony-kpi-picker/);
  assert.match(canvas, /KPI_REGISTRY_COUNT/);
  assert.match(editor, /Load from library|onLoaded/);
  assert.match(editor, /Shortcuts/);
  assert.match(editor, /symphony-details/);
  assert.match(editor, /symphony-top/);
  assert.match(editor, /forceReadOnly/);
  assert.match(canvas, /AssetInstrumentPicker/);
  assert.match(picker, /data-testid="asset-instrument-dropdown"/);
  assert.match(picker, /aria-haspopup="listbox"/);
  assert.match(picker, /Select instrument/);
  assert.match(picker, /\$\{ticker\} · \$\{company\}/);
  assert.match(picker, /useKiteInstrumentSearch/);
  assert.match(picker, /useYfinanceInstrumentSearch/);
  assert.match(picker, /Holdings|holding|watchlist/);
  assert.match(picker, /Kite session missing — last known holdings\/watchlist/);
  assert.match(picker, /builderUniverse|isBeesSymbol/);
  assert.match(picker, /BUILDER_UNIVERSE_GROUP_LABELS/);
  assert.match(canvas, /treeAssetWarning/);
  assert.match(canvas, /className="symphony-kpi-trigger"/);
  assert.match(canvas, /className="symphony-kpi-menu"/);
  assert.match(css, /\.symphony-kpi-menu\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.symphony-asset-menu\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.symphony-operand\s*\{[^}]*overflow:\s*visible/s);
  assert.doesNotMatch(css, /\.symphony-operand\s*\{[^}]*max-height:\s*280px/s);
  assert.doesNotMatch(css, /\.symphony-operand\s*\{[^}]*overflow:\s*auto/s);
  const ifSentence = canvas.indexOf("symphony-if-sentence");
  const ifOperands = canvas.indexOf("symphony-if-operands");
  const ifBadge = canvas.indexOf("symphony-live-badge", ifSentence);
  assert.ok(ifSentence >= 0 && ifOperands > ifSentence);
  assert.ok(ifBadge > ifSentence && ifBadge < ifOperands);
  assert.doesNotMatch(picker, /setInterval/);
  assert.doesNotMatch(canvas, /Auto-refreshes every five minutes/);
  assert.doesNotMatch(picker, /Auto-refreshes every five minutes/);
  assert.doesNotMatch(canvas, /watchlist unavailable/);
  assert.doesNotMatch(canvas, /GOLDBEES|NIFTYBEES|JUNIORBEES/);
  assert.doesNotMatch(picker, /GOLDBEES|NIFTYBEES|JUNIORBEES/);
  assert.doesNotMatch(canvas, /placeholder="SYMBOL"|tree-live-symbols/);
  assert.match(ops, /params: \{ symbol: "" \}/);
  assert.match(css, /\.symphony-top \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.symphony-zones \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.algorithm-builder\.symphony-editor \.builder-zones\.symphony-zones \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.algorithm-builder:not\(\.symphony-editor\) \.builder-zones \{[\s\S]*grid-template-columns:\s*240px/);
  assert.doesNotMatch(css, /\.algorithm-builder \.builder-zones \{[^}]*grid-template-columns:\s*240px/);
  assert.match(css, /\.symphony-tree \{[\s\S]*width:\s*100%/);
  assert.match(css, /\.algorithm-builder\.symphony-editor \.symphony-tree\.builder-canvas \{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.algorithm-builder\.symphony-editor \.symphony-top \{[\s\S]*max-height:\s*min\(42dvh,\s*440px\)/);
  assert.match(css, /kpi-registry-grid \{[\s\S]*grid-template-columns: repeat\(8/);
  assert.match(css, /\.symphony-selected \{[\s\S]*grid-auto-rows:\s*min-content/);
  assert.match(css, /html\[data-appearance="sepia"\] \.symphony-block[\s\S]*color:\s*var\(--ink\)/);
  assert.match(css, /html\[data-appearance="sepia"\] \.symphony-group-name/);
  assert.match(css, /html\[data-appearance="sepia"\] \.symphony-block-head select/);
  assert.match(css, /html\[data-appearance="sepia"\] \.symphony-add-block/);
  assert.match(css, /html\[data-appearance="sepia"\] \.symphony-live-badge\[data-status="unavailable"\][\s\S]*--sepia-negative-ink/);
});

test("builder sources stay isolated from industry filters", async () => {
  const files = [
    "../app/dashboard/builder/SymphonyEditor.tsx",
    "../app/dashboard/builder/TreeCanvas.tsx",
    "../app/dashboard/builder/AssetInstrumentPicker.tsx",
    "../app/dashboard/builder/KpiRegistryPanel.tsx",
    "../app/dashboard/BuilderWorkspace.tsx",
    "../app/strategy/tree-compile.ts",
    "../app/strategy/seed-tree.ts",
    "../app/strategy/builder-universe.ts",
    "../app/strategy/tree-live.ts",
    "../app/strategy/tree-instruments.ts",
    "../app/strategy/tree-orders.ts",
    "../app/dashboard/builder/TreeBrokerConfirm.tsx",
  ];
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  for (const source of sources) {
    assert.doesNotMatch(source, /sector-dimmed|sector-intelligence-filter|selectedSectorId/);
  }
});
