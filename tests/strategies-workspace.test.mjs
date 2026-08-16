import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyCanonicalWorkspaceUrl,
  parseStrategiesSection,
  parseWorkspaceView,
} from "../app/dashboard/workspace-routing.ts";

test("parseWorkspaceView maps strategies and strategy-library", () => {
  assert.equal(parseWorkspaceView("strategies"), "strategies");
  assert.equal(parseWorkspaceView("strategy-library"), "strategies");
  assert.equal(parseWorkspaceView("builder"), "builder");
  assert.equal(parseStrategiesSection("y1"), "y1");
  assert.equal(parseStrategiesSection("library"), "y2");
  assert.equal(parseStrategiesSection(null), "y2");

  const aliased = new URL("http://localhost/?view=strategy-library");
  assert.deepEqual(applyCanonicalWorkspaceUrl(aliased), { view: "strategies", rewritten: true });
  assert.equal(aliased.searchParams.get("view"), "strategies");
  assert.equal(aliased.searchParams.get("section"), "y2");
});

test("Composer seed module stores nine StrategyTreeV1 reconstructions", async () => {
  const source = await readFile(new URL("../app/strategy/composer-strategies.ts", import.meta.url), "utf8");
  assert.match(source, /from "\.\/strategy-tree"/);
  assert.match(source, /export const COMPOSER_STRATEGIES/);
  assert.equal((source.match(/tree: treeDoc\(/g) ?? []).length, 9);
  assert.match(source, /id: "simons-kmlm"/);
  assert.match(source, /id: "holy-grail"/);
  assert.match(source, /COMPOSER_RESEARCH_AS_OF = "2026-08-16"/);
  assert.match(source, /COMPOSER_UNRECONSTRUCTED/);
  assert.match(source, /US-listed symbols published on Composer/);
});

test("Strategies workspace uses DailyKanbanBoard and shared TreeCanvas read-only", async () => {
  const [workspace, readOnly, types, page, utils] = await Promise.all([
    readFile(new URL("../app/dashboard/StrategiesWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/strategies/ReadOnlyTree.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8"),
  ]);

  assert.match(types, /type WorkspaceKey =[\s\S]*"strategies"/);
  assert.match(page, /workspace === "strategies"/);
  assert.match(page, /value === "strategy-library"/);
  assert.match(workspace, /<DailyKanbanBoard workspace="strategies"\s*\/>/);
  assert.match(workspace, /\{ id: "y1", label: "Action Board" \}/);
  assert.match(workspace, /\{ id: "y2", label: "Library" \}/);
  assert.doesNotMatch(workspace, /sector-dimmed|sector-intelligence-filter|EarningsMonthCalendar|digest-panel/);
  assert.match(readOnly, /from "\.\.\/builder\/TreeCanvas"/);
  assert.match(readOnly, /disabled/);
  assert.match(utils, /kanbanItems[\s\S]*\bstrategies\s*:/);
  assert.match(utils, /key: "strategies", label: "Strategies"/);
});
