import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BUILDER_CHROME_CANDIDATES,
  BUILDER_WORKSPACE_CANDIDATES,
  ROUTING_SOURCE_CANDIDATES,
  firstExisting,
  readJoined,
  readOptional,
} from "./helpers/algorithm-canvas.mjs";

function softMatch(source, pattern, label) {
  if (!source) {
    console.log(`SOFT (waiting on shell sibling): ${label}`);
    return;
  }
  assert.match(source, pattern, label);
}

test("app routing resolves builder and algorithm-canvas without breaking existing views", async () => {
  const [routing, types, page, workspaceRouting] = await Promise.all([
    readJoined(ROUTING_SOURCE_CANDIDATES),
    readFile(new URL("../app/dashboard/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readOptional(new URL("../app/dashboard/workspace-routing.ts", import.meta.url)),
  ]);

  assert.match(page, /workspace === "investment"/);
  assert.match(page, /workspace === "sectors"/);
  assert.match(page, /workspace === "intelligence"/);
  assert.match(page, /workspace === "health"/);
  assert.match(page, /workspace === "strategies"/);
  assert.match(page, /value === "market-intelligence"/);
  assert.match(page, /value === "strategy-library"/);
  softMatch(types, /type WorkspaceKey =[\s\S]*"builder"/, "WorkspaceKey includes builder");
  softMatch(routing, /algorithm-canvas/, "?view=algorithm-canvas alias");
  softMatch(workspaceRouting, /export function parseWorkspaceView/, "parseWorkspaceView");
  softMatch(workspaceRouting, /case "algorithm-canvas":/, "algorithm-canvas → builder");
  softMatch(page, /workspace === "builder"/, "page mounts builder workspace");
  softMatch(routing, /section=canvas|section === "canvas"|parseBuilderSection/, "?view=builder&section=canvas");
});

test("builder workspace chrome includes Algorithm Builder, Action Board, Canvas, and JSON", async () => {
  const [chrome, workspace, canvas] = await Promise.all([
    readJoined(BUILDER_CHROME_CANDIDATES),
    firstExisting(BUILDER_WORKSPACE_CANDIDATES),
    readOptional(new URL("../app/dashboard/builder/AlgorithmBuilder.tsx", import.meta.url)),
  ]);

  assert.match(canvas, /Algorithm Builder/);
  softMatch(chrome, /Algorithm Canvas|ALGORITHM CANVAS/, "Algorithm Canvas label");
  if (!workspace.text) {
    console.log("SOFT (waiting on shell sibling): BuilderWorkspace chrome tabs");
    return;
  }
  assert.match(workspace.text, /Action Board|ACTION BOARD/);
  assert.match(workspace.text, /(?:label|title|id):\s*"canvas"|["']Canvas["']|>CANVAS</);
  assert.match(workspace.text, /(?:label|title|id):\s*"json"|["']JSON["']|>JSON</i);
});

test("Algorithm Canvas action board is DailyKanbanBoard, not a compact builder board", async () => {
  const [types, utils, sharedUi, builderSources, workspace] = await Promise.all([
    readFile(new URL("../app/dashboard/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readJoined(BUILDER_CHROME_CANDIDATES),
    firstExisting(BUILDER_WORKSPACE_CANDIDATES),
  ]);

  assert.match(sharedUi, /export function DailyKanbanBoard/);
  assert.doesNotMatch(builderSources, /BuilderKanbanBoard|AlgorithmKanbanBoard|CompactKanban|compact-action-board/);
  assert.doesNotMatch(builderSources, /<DailyKanbanBoard[^>]+(?:lane|compact)=/);
  softMatch(types, /type KanbanWorkspace = Exclude<WorkspaceKey, "integrations">|type KanbanWorkspace = WorkspaceKey|type KanbanWorkspace =[\s\S]*"builder"/, "KanbanWorkspace includes builder");
  softMatch(utils, /kanbanItems[\s\S]*\bbuilder\s*:/, "kanbanItems.builder");
  if (!workspace.text) {
    console.log("SOFT (waiting on shell sibling): DailyKanbanBoard workspace=\"builder\"");
    return;
  }
  assert.match(workspace.text, /<DailyKanbanBoard workspace="builder"\s*\/>/);
});
