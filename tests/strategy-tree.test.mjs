import assert from "node:assert/strict";
import test from "node:test";
import { parseStrategyTree } from "../packages/contracts/src/strategy-tree.ts";
import { compileTreeToGraph, validateTree } from "../app/strategy/tree-compile.ts";
import { createSeedTree } from "../app/strategy/seed-tree.ts";
import {
  COMPOSER_RESEARCH_AS_OF,
  COMPOSER_STRATEGIES,
  featuredComposerStrategy,
  sortComposerStrategies,
} from "../app/strategy/composer-strategies.ts";
import { applyLibraryNseStats } from "../app/strategy/library-nse-stats.ts";
import { addTreeBlock, emptyStrategyTree } from "../app/strategy/tree-ops.ts";
import { exportStrategyDocumentJson, importStrategyDocumentJson, importStrategyGraphJson } from "../app/strategy/persist.ts";
import { validateStrategyGraph } from "../app/strategy/graph-types.ts";

test("seed tree is Indian Core-Satellite with 15/30/55 specified weights", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  assert.equal(tree.treeVersion, "1");
  assert.equal(tree.name, "Core Satellite");
  assert.equal(tree.interval, "month");
  const root = tree.children[0];
  assert.equal(root.kind, "weight");
  assert.equal(root.params.method, "specified");
  assert.deepEqual(root.children.map((child) => child.percent), [15, 30, 55]);
  assert.equal(root.children[0].node.kind, "group");
  assert.equal(root.children[0].node.label, "Satellite-Quality");
  assert.equal(root.children[1].node.label, "Core-Equity");
  assert.equal(root.children[2].node.label, "Satellite-Defensive");
  const qualityWeight = root.children[0].node.children[0];
  assert.equal(qualityWeight.kind, "weight");
  assert.equal(qualityWeight.params.method, "inverse_volatility");
  assert.equal(qualityWeight.children[0].node.params.symbol, "HDFCBANK");
  assert.equal(root.children[1].node.children[0].params.symbol, "RELIANCE");
  assert.equal(root.children[1].node.children[1].params.symbol, "TCS");
  const gate = root.children[2].node.children[0];
  assert.equal(gate.kind, "if_else");
  assert.equal(gate.params.left.kpiId, "close");
  assert.equal(gate.params.left.symbol, "RELIANCE");
  assert.equal(gate.params.right.kpiId, "sma_200");
  assert.equal(gate.else.length, 0);
  assert.doesNotMatch(JSON.stringify(tree), /BEES/);
  assert.ok(!JSON.stringify(tree).includes("SPY"));
  assert.ok(!JSON.stringify(tree).includes("VNQ"));
});

test("15+30+55 specified weights compile to allocation Σ 100 and schemaVersion 2", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const graph = compileTreeToGraph(tree);
  assert.equal(graph.schemaVersion, "2");
  assert.equal(graph.id, tree.id);
  assert.equal(graph.name, tree.name);
  assert.ok(graph.tree);
  assert.equal(graph.tree.name, "Core Satellite");
  const allocations = graph.nodes.filter((node) => node.kind === "allocation");
  assert.equal(allocations.length, 3);
  const sum = allocations.reduce((total, node) => total + Number(node.params.weightagePct), 0);
  assert.equal(sum, 100);
  assert.deepEqual(allocations.map((node) => node.params.weightagePct).sort((a, b) => a - b), [15, 30, 55]);
  assert.ok(allocations.some((node) => node.params.symbols.includes("HDFCBANK")));
  assert.ok(allocations.some((node) => node.params.symbols.includes("RELIANCE")));
  assert.ok(allocations.some((node) => node.params.symbols.includes("ITC")));
  assert.ok(graph.nodes.some((node) => node.kind === "entry_trigger"));
  assert.ok(graph.nodes.some((node) => node.kind === "exit_trigger"));
  const validation = validateStrategyGraph(graph);
  assert.equal(validation.ok, true);
});

test("If/Else with empty ELSE round-trips on the tree and warns", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const parsed = parseStrategyTree(JSON.parse(JSON.stringify(tree)));
  const gate = parsed.children[0].children[2].node.children[0];
  assert.equal(gate.kind, "if_else");
  assert.equal(gate.else.length, 0);
  assert.equal(gate.then[0].params.symbol, "ITC");
  const result = validateTree(parsed);
  assert.equal(result.ok, true);
  assert.ok(result.issues.some((issue) => issue.code === "empty_else"));
  assert.ok(result.issues.some((issue) => issue.code === "weight_method_unsupported"));
});

test("unknown kpiId fails tree validate", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  tree.children[0].children[2].node.children[0].params.left.kpiId = "not_a_real_kpi";
  const result = validateTree(tree);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "unknown_kpi"));
});

test("group labels survive tree JSON and may vanish on graph-only export", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const json = JSON.stringify(tree);
  assert.match(json, /Satellite-Quality/);
  assert.match(json, /Core-Equity/);
  const graph = compileTreeToGraph(tree);
  const graphOnly = { ...graph };
  delete graphOnly.tree;
  const graphJson = JSON.stringify(graphOnly);
  assert.equal(graphJson.includes("Satellite-Quality"), false);
});

test("document persist embeds tree and still loads graph-only rows", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const graph = compileTreeToGraph(tree);
  const document = importStrategyDocumentJson(exportStrategyDocumentJson({ tree, graph }));
  assert.equal(document.tree.name, "Core Satellite");
  assert.equal(document.graph.schemaVersion, "2");
  assert.deepEqual(document.tree.children[0].children.map((child) => child.percent), [15, 30, 55]);

  const { tree: _tree, ...graphOnly } = graph;
  const imported = importStrategyGraphJson(graphOnly);
  assert.equal(imported.schemaVersion, "2");
  assert.equal(imported.name, graph.name);
  assert.equal(imported.tree, undefined);
});

test("Add a Block on ELSE appends a child without changing percents", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const next = addTreeBlock(tree, "if-trend", "asset", "else");
  const gate = next.children[0].children[2].node.children[0];
  assert.equal(gate.else.length, 1);
  assert.equal(gate.else[0].kind, "asset");
  assert.equal(gate.else[0].params.symbol, "");
  assert.deepEqual(next.children[0].children.map((child) => child.percent), [15, 30, 55]);
  assert.equal(emptyStrategyTree().children.length, 0);
});

test("Composer reconstructions parse as StrategyTreeV1 and validate", () => {
  assert.equal(COMPOSER_STRATEGIES.length, 9);
  assert.equal(COMPOSER_RESEARCH_AS_OF, "2026-08-16");
  for (const card of COMPOSER_STRATEGIES) {
    const parsed = parseStrategyTree(card.tree);
    assert.equal(parsed.treeVersion, "1");
    const validation = validateTree(card.tree);
    assert.equal(validation.ok, true, `${card.id}: ${validation.issues.map((issue) => issue.message).join("; ")}`);
    assert.ok(card.tree.children.length > 0);
    assert.equal(card.stats.annualizedReturnPct, undefined);
    assert.equal(card.stats.sharpe, undefined);
    assert.equal(card.stats.source, undefined);
    const serialized = JSON.stringify(card.tree);
    assert.doesNotMatch(serialized, /"TQQQ"|"SPY"|"SOXL"|"SOXX"|"UVXY"|"SQQQ"|"TECL"/);
    assert.doesNotMatch(serialized, /BEES/);
    assert.match(serialized, /RELIANCE|TCS|HDFCBANK|ITC|HINDUNILVR/);
  }
  assert.equal(featuredComposerStrategy().id, sortComposerStrategies(COMPOSER_STRATEGIES, "annualized")[0].id);
});

test("library NSE engine stats fill KPIs only after ran=true and never copy Composer US books", () => {
  const filled = applyLibraryNseStats(COMPOSER_STRATEGIES, {
    source: "yfinance",
    market: "NSE",
    asOf: "2026-08-14",
    computedAt: "2026-08-16T00:00:00.000Z",
    fetched: true,
    message: "Tree backtest on yfinance NSE daily history (1/9 ran).",
    strategies: {
      "holy-grail": {
        ran: true,
        annualizedReturnPct: 11.25,
        cumulativeReturnPct: 23.5,
        sharpe: 0.84,
        maxDrawdownPct: -12.4,
        calmar: 0.91,
        oosStart: "2024-08-16",
        oosEnd: "2026-08-14",
        source: "yfinance",
        market: "NSE",
        message: "Backtest ran on historical OHLCV.",
      },
      "rams-soxx": {
        ran: false,
        source: "yfinance",
        market: "NSE",
        message: "Unavailable: missing OHLCV for TCS.",
        missingSymbols: ["TCS"],
      },
    },
  });
  const holy = filled.find((card) => card.id === "holy-grail");
  const rams = filled.find((card) => card.id === "rams-soxx");
  const simons = filled.find((card) => card.id === "simons-kmlm");
  assert.equal(holy?.stats.source, "yfinance");
  assert.equal(holy?.stats.annualizedReturnPct, 11.25);
  assert.equal(holy?.stats.sharpe, 0.84);
  assert.notEqual(holy?.stats.annualizedReturnPct, 2000);
  assert.notEqual(holy?.stats.sharpe, 2.15);
  assert.equal(rams?.stats.annualizedReturnPct, undefined);
  assert.equal(rams?.stats.unavailableReason, "Unavailable: missing OHLCV for TCS.");
  assert.equal(simons?.stats.annualizedReturnPct, undefined);
});
