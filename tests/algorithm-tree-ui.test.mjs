import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("primary canvas is a vertical tree with Add a Block kinds and no wires", async () => {
  const [editor, canvas, workspace, css] = await Promise.all([
    readFile(new URL("../app/dashboard/builder/SymphonyEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/TreeCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/BuilderWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/algorithm-builder.css", import.meta.url), "utf8"),
  ]);

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
  assert.match(canvas, /data-stem-count/);
  assert.match(canvas, /symphony-if-wells/);
  assert.match(canvas, />Delete</);
  assert.doesNotMatch(editor, /Composer|Invest\/Sell|\$1,500/);
  assert.match(editor, /Configure only — no run/);
  assert.match(editor, /Run backtest/);
  assert.match(editor, /Load from library|onLoaded/);
  assert.match(editor, /Shortcuts/);
  assert.match(editor, /symphony-details/);
  assert.match(editor, /forceReadOnly/);
});

test("builder sources stay isolated from industry filters", async () => {
  const files = [
    "../app/dashboard/builder/SymphonyEditor.tsx",
    "../app/dashboard/builder/TreeCanvas.tsx",
    "../app/dashboard/BuilderWorkspace.tsx",
    "../app/strategy/tree-compile.ts",
    "../app/strategy/seed-tree.ts",
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
