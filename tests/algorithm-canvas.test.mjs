import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyCanonicalWorkspaceUrl, parseBuilderSection, parseWorkspaceView } from "../app/dashboard/workspace-routing.ts";
import {
  DEFAULT_ASSET_CLASSES,
  inferAssetClassForSymbol,
  normalizeAssetClasses,
} from "../app/strategy/asset-classes.ts";
import { cloneGraph, defaultNodeParams, validateStrategyGraph, VALIDATION_OK_TITLE } from "../app/strategy/graph-types.ts";
import { connectNodes, createNode, removeNode } from "../app/strategy/graph-ops.ts";
import { incompatibilityReason, portsCompatible } from "../app/strategy/ports.ts";
import { createSeedGraph } from "../app/strategy/seed-graph.ts";

function baseGraph(overrides = {}) {
  return {
    schemaVersion: "2",
    id: "test-graph",
    name: "Test graph",
    interval: "day",
    pinnedAlgorithmVersions: {},
    nodes: [],
    edges: [],
    ...overrides,
  };
}

function node(id, kind, params = {}, position = { x: 40, y: 80 }) {
  return { id, kind, label: kind, params, position };
}

function edge(id, source, target, kind) {
  return { id, source, target, kind, sourcePort: "out", targetPort: "in" };
}

function exportImport(graph) {
  return cloneGraph(JSON.parse(`${JSON.stringify(graph, null, 2)}\n`));
}

function issueCodes(result, severity) {
  return result.issues.filter((issue) => issue.severity === severity).map((issue) => issue.code);
}

test("parseWorkspaceView maps builder and algorithm-canvas without breaking existing views", () => {
  assert.equal(parseWorkspaceView("builder"), "builder");
  assert.equal(parseWorkspaceView("algorithm-canvas"), "builder");
  assert.equal(parseWorkspaceView("investment"), "investment");
  assert.equal(parseWorkspaceView("sectors"), "sectors");
  assert.equal(parseWorkspaceView("intelligence"), "intelligence");
  assert.equal(parseWorkspaceView("health"), "health");
  assert.equal(parseWorkspaceView("market-intelligence"), "intelligence");
  assert.equal(parseWorkspaceView("unknown"), "investment");
  assert.equal(parseBuilderSection("canvas"), "canvas");
  assert.equal(parseBuilderSection("board"), "board");
  assert.equal(parseBuilderSection("json"), "json");
  assert.equal(parseBuilderSection(null), "canvas");

  const aliased = new URL("http://localhost/?view=algorithm-canvas");
  assert.deepEqual(applyCanonicalWorkspaceUrl(aliased), { view: "builder", rewritten: true });
  assert.equal(aliased.searchParams.get("view"), "builder");
  assert.equal(aliased.searchParams.get("section"), "canvas");

  const explicit = new URL("http://localhost/?view=builder&section=canvas");
  assert.deepEqual(applyCanonicalWorkspaceUrl(explicit), { view: "builder", rewritten: false });
  assert.equal(explicit.searchParams.get("section"), "canvas");
});

test("universe defaults to Equity and ETF asset classes", () => {
  assert.deepEqual([...DEFAULT_ASSET_CLASSES], ["Equity", "ETF"]);
  assert.deepEqual(defaultNodeParams("universe").assetClasses, ["Equity", "ETF"]);
  const seed = createSeedGraph(new Date("2026-08-16T00:00:00+05:30"));
  const universe = seed.nodes.find((item) => item.kind === "universe");
  assert.ok(universe);
  assert.deepEqual(universe.params.assetClasses, ["Equity", "ETF"]);
  assert.deepEqual(normalizeAssetClasses(universe.params.assetClasses), ["Equity", "ETF"]);
});

test("assetClasses persist on StrategyGraphV2 export and import", () => {
  const graph = baseGraph({
    nodes: [
      node("universe-1", "universe", { assetClasses: ["Equity", "ETF", "Cash"] }),
      node("entry-1", "entry_trigger"),
      node("exit-1", "exit_trigger"),
    ],
  });
  const imported = exportImport(graph);
  const universe = imported.nodes.find((item) => item.id === "universe-1");
  assert.deepEqual(universe.params.assetClasses, ["Equity", "ETF", "Cash"]);
});

test("empty or conflicting asset classes emit warnings", () => {
  const empty = validateStrategyGraph(baseGraph({
    nodes: [
      node("universe-1", "universe", { assetClasses: [] }),
      node("entry-1", "entry_trigger"),
      node("exit-1", "exit_trigger"),
    ],
  }));
  assert.equal(empty.ok, true);
  assert.ok(issueCodes(empty, "warning").includes("asset_class_empty"));

  const conflict = validateStrategyGraph(baseGraph({
    nodes: [
      node("universe-1", "universe", { assetClasses: ["Equity", "ETF"] }),
      node("entry-1", "entry_trigger"),
      node("exit-1", "exit_trigger"),
      node("alloc-1", "allocation", { weightagePct: 100, symbols: ["CASH"] }),
    ],
  }));
  assert.equal(conflict.ok, true);
  assert.ok(issueCodes(conflict, "warning").includes("asset_class_conflict"));
  assert.equal(inferAssetClassForSymbol("CASH"), "Cash");
  assert.equal(inferAssetClassForSymbol("NIFTYBEES"), "ETF");
});

test("validation errors when entry or exit triggers are missing", () => {
  const missingBoth = validateStrategyGraph(baseGraph());
  assert.equal(missingBoth.ok, false);
  assert.deepEqual(issueCodes(missingBoth, "error").sort(), ["missing_entry_trigger", "missing_exit_trigger"]);

  const missingEntry = validateStrategyGraph(baseGraph({
    nodes: [node("exit-1", "exit_trigger")],
  }));
  assert.equal(missingEntry.ok, false);
  assert.ok(issueCodes(missingEntry, "error").includes("missing_entry_trigger"));
  assert.ok(!issueCodes(missingEntry, "error").includes("missing_exit_trigger"));

  const missingExit = validateStrategyGraph(baseGraph({
    nodes: [node("entry-1", "entry_trigger")],
  }));
  assert.equal(missingExit.ok, false);
  assert.ok(issueCodes(missingExit, "error").includes("missing_exit_trigger"));
  assert.ok(!issueCodes(missingExit, "error").includes("missing_entry_trigger"));
});

test("validation warns for unwired exit, weight sum, and paper without risk_limit", () => {
  const unwired = validateStrategyGraph(createSeedGraph(new Date("2026-08-16T00:00:00+05:30")));
  assert.equal(unwired.ok, true);
  assert.ok(issueCodes(unwired, "warning").includes("exit_unwired"));

  const weights = validateStrategyGraph(baseGraph({
    nodes: [
      node("entry-1", "entry_trigger"),
      node("exit-1", "exit_trigger"),
      node("alloc-1", "allocation", { weightagePct: 20, symbols: [] }),
      node("alloc-2", "allocation", { weightagePct: 30, symbols: [] }),
    ],
    edges: [
      edge("e-entry-a1", "entry-1", "alloc-1", "trigger"),
      edge("e-entry-a2", "entry-1", "alloc-2", "trigger"),
    ],
  }));
  assert.equal(weights.ok, true);
  assert.ok(issueCodes(weights, "warning").includes("allocation_weights"));
  assert.match(weights.issues.find((issue) => issue.code === "allocation_weights").message, /50/);

  const paper = validateStrategyGraph(baseGraph({
    nodes: [
      node("entry-1", "entry_trigger"),
      node("exit-1", "exit_trigger"),
      node("alloc-1", "allocation", { weightagePct: 100, symbols: [] }),
      node("paper-1", "paper_action"),
    ],
    edges: [
      edge("e-entry-alloc", "entry-1", "alloc-1", "trigger"),
      edge("e-exit-alloc", "exit-1", "alloc-1", "trigger"),
      edge("e-alloc-paper", "alloc-1", "paper-1", "allocation"),
    ],
  }));
  assert.equal(paper.ok, true);
  assert.ok(issueCodes(paper, "warning").includes("missing_risk_limit"));
});

test("allocation weightagePct 20 survives export/import losslessly", async () => {
  const graph = baseGraph({
    description: "Weightage round-trip",
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    pinnedAlgorithmVersions: { "ref-1": "1.0.0" },
    nodes: [
      node("universe-1", "universe", { assetClasses: ["Equity", "ETF"] }, { x: 40, y: 80 }),
      node("kpi-1", "kpi", { kpiId: "rsi_14" }, { x: 280, y: 80 }),
      node("cmp-1", "comparator", { op: "<", value: 30 }, { x: 520, y: 80 }),
      node("entry-1", "entry_trigger", {}, { x: 760, y: 80 }),
      node("exit-1", "exit_trigger", {}, { x: 760, y: 240 }),
      node("alloc-1", "allocation", { weightagePct: 20, symbols: ["RELIANCE"] }, { x: 1000, y: 80 }),
      node("ref-1", "algorithm_reference", { algorithmId: "demo", version: "1.0.0" }, { x: 40, y: 240 }),
    ],
    edges: [
      edge("e-universe-kpi", "universe-1", "kpi-1", "series"),
      edge("e-kpi-cmp", "kpi-1", "cmp-1", "series"),
      edge("e-cmp-entry", "cmp-1", "entry-1", "boolean"),
      edge("e-entry-alloc", "entry-1", "alloc-1", "trigger"),
    ],
  });

  const imported = exportImport(graph);
  assert.equal(imported.schemaVersion, "2");
  assert.equal(imported.id, graph.id);
  assert.equal(imported.name, graph.name);
  assert.deepEqual(imported.pinnedAlgorithmVersions, graph.pinnedAlgorithmVersions);
  assert.deepEqual(imported.nodes.map((item) => item.id), graph.nodes.map((item) => item.id));
  assert.deepEqual(imported.edges, graph.edges);
  assert.deepEqual(imported.nodes.map((item) => item.position), graph.nodes.map((item) => item.position));
  assert.deepEqual(imported.nodes.map((item) => item.params), graph.nodes.map((item) => item.params));
  const allocation = imported.nodes.find((item) => item.id === "alloc-1");
  assert.equal(allocation.params.weightagePct, 20);
  assert.deepEqual(allocation.params.symbols, ["RELIANCE"]);

  const persistSource = await readFile(new URL("../app/strategy/persist.ts", import.meta.url), "utf8");
  assert.match(persistSource, /export function exportStrategyGraphJson/);
  assert.match(persistSource, /export function importStrategyGraphJson/);
  assert.match(persistSource, /JSON\.stringify\(cloneGraph\(graph\)/);
});

test("POST /api/strategies/validate uses the client validateStrategyGraph", async () => {
  const [route, alias, api] = await Promise.all([
    readFile(new URL("../app/api/strategies/validate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/strategies/validate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/strategy-api.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /export async function POST/);
  assert.match(route, /handleStrategyValidate/);
  assert.match(alias, /export async function POST/);
  assert.match(api, /import \{ validateStrategyGraph \} from "\.\/graph-types"/);
  assert.match(api, /validateStrategyGraph\(graph\)/);
});

test("KPI registry remains exactly 128", async () => {
  const [indexSource, registryJson] = await Promise.all([
    readFile(new URL("../packages/kpi-registry/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/kpi-registry/definitions/kpis.json", import.meta.url), "utf8"),
  ]);
  const registry = JSON.parse(registryJson);
  assert.match(indexSource, /export const KPI_REGISTRY_COUNT = 128/);
  assert.equal(registry.count, 128);
  assert.equal(registry.kpis.length, 128);
  assert.equal(new Set(registry.kpis.map((kpi) => kpi.id)).size, 128);
});

test("seed graph has a connected RSI chain ready to render", () => {
  const seed = createSeedGraph(new Date("2026-08-16T00:00:00+05:30"));
  assert.ok(seed.edges.length >= 3, "seed must include rendered-connectable edges");
  assert.ok(seed.edges.some((item) => item.source === "universe-1" && item.target === "kpi-rsi" && item.kind === "series"));
  assert.ok(seed.edges.some((item) => item.source === "kpi-rsi" && item.target === "cmp-rsi" && item.kind === "series"));
  assert.ok(seed.edges.some((item) => item.source === "cmp-rsi" && item.target === "entry-1" && item.kind === "boolean"));
  assert.ok(seed.nodes.some((item) => item.kind === "exit_trigger"));
  assert.ok(!seed.edges.some((item) => item.target === "exit-1"), "exit may start unwired");
});

test("connectNodes succeeds for compatible ports and fails for incompatible", () => {
  assert.equal(portsCompatible("universe", "kpi"), true);
  assert.equal(portsCompatible("kpi", "comparator"), true);
  assert.equal(portsCompatible("comparator", "entry_trigger"), true);
  assert.equal(portsCompatible("kpi", "entry_trigger"), false);
  assert.match(incompatibilityReason("kpi", "entry_trigger") ?? "", /series cannot connect to boolean/);

  let graph = baseGraph({
    nodes: [
      node("universe-1", "universe", { assetClasses: ["Equity", "ETF"] }),
      node("kpi-close", "kpi", { kpiId: "close" }),
      node("cmp-1", "comparator", { op: "<", value: 30 }),
      node("entry-1", "entry_trigger"),
      node("exit-1", "exit_trigger"),
    ],
  });
  graph = connectNodes(graph, "universe-1", "kpi-close");
  assert.ok(graph);
  graph = connectNodes(graph, "kpi-close", "cmp-1");
  assert.ok(graph);
  graph = connectNodes(graph, "cmp-1", "entry-1");
  assert.ok(graph);
  graph = connectNodes(graph, "cmp-1", "exit-1");
  assert.ok(graph);
  assert.equal(connectNodes(graph, "kpi-close", "entry-1"), null);
  assert.equal(connectNodes(graph, "universe-1", "entry-1"), null);
  assert.equal(connectNodes(graph, "kpi-close", "exit-1"), null);

  const result = validateStrategyGraph(graph);
  assert.equal(result.ok, true);
  assert.ok(!issueCodes(result, "warning").includes("exit_unwired"));
  assert.equal(result.stripTitle, VALIDATION_OK_TITLE);

  const afterDelete = removeNode(graph, "cmp-1");
  assert.equal(afterDelete.edges.length, 1);
  assert.ok(afterDelete.edges.every((item) => item.source !== "cmp-1" && item.target !== "cmp-1"));
});

test("AND group accepts two booleans into one entry", () => {
  let graph = baseGraph({
    nodes: [
      node("universe-1", "universe", { assetClasses: ["Equity", "ETF"] }),
      node("kpi-close", "kpi", { kpiId: "close" }),
      node("kpi-rsi", "kpi", { kpiId: "rsi_14" }),
      node("cmp-close", "comparator", { op: "<", value: 100 }),
      node("cmp-rsi", "comparator", { op: "<", value: 30 }),
      node("and-1", "logical_group", { op: "and" }),
      node("entry-1", "entry_trigger"),
      node("exit-1", "exit_trigger"),
    ],
  });
  graph = connectNodes(graph, "universe-1", "kpi-close");
  graph = connectNodes(graph, "universe-1", "kpi-rsi");
  graph = connectNodes(graph, "kpi-close", "cmp-close");
  graph = connectNodes(graph, "kpi-rsi", "cmp-rsi");
  graph = connectNodes(graph, "cmp-close", "and-1");
  graph = connectNodes(graph, "cmp-rsi", "and-1");
  graph = connectNodes(graph, "and-1", "entry-1");
  graph = connectNodes(graph, "cmp-rsi", "exit-1");
  assert.ok(graph);
  assert.equal(graph.edges.filter((item) => item.target === "and-1").length, 2);
  const result = validateStrategyGraph(graph);
  assert.equal(result.ok, true);
  assert.ok(!issueCodes(result, "warning").includes("exit_unwired"));
});

test("palette includes COMPARATOR and canvas keeps click-to-connect handles", async () => {
  const close = createNode("kpi", { x: 40, y: 80 }, [], { kpiId: "close" });
  assert.equal(close.kind, "kpi");
  assert.equal(close.params.kpiId, "close");

  const [palette, builder, css, overlay] = await Promise.all([
    readFile(new URL("../app/dashboard/builder/BuilderPalette.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/AlgorithmBuilder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/algorithm-builder.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/BuilderHelpOverlay.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(palette, /kind: "comparator"/);
  assert.match(palette, /COMPARATOR/);
  assert.match(builder, /beginLink/);
  assert.match(builder, /completeLink/);
  assert.match(builder, /incompatibilityReason/);
  assert.match(builder, /data-port="in"/);
  assert.match(builder, /data-port="out"/);
  assert.doesNotMatch(builder, /if \(linkDraft\) setLinkDraft\(null\);/);
  assert.match(css, /z-index:\s*5/);
  assert.match(css, /\.builder-port::before/);
  assert.match(overlay, /TUTORIAL_STEPS/);
  assert.match(overlay, /Do not show again/);
  assert.match(overlay, /Click an output handle/);
});
