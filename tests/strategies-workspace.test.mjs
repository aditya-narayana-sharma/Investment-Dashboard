import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyCanonicalWorkspaceUrl,
  parseHealthH3Page,
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

test("health nutrition aliases resolve to the combined Nutrition page", () => {
  assert.equal(parseHealthH3Page("nutrition"), "nutrition");
  assert.equal(parseHealthH3Page("nutrition-1"), "nutrition");
  assert.equal(parseHealthH3Page("nutrition-2"), "nutrition");
  assert.equal(parseHealthH3Page("heart"), "heart");
  assert.equal(parseHealthH3Page(null), "metrics-overview");

  const aliased = new URL("http://localhost/?view=health&section=h3&page=nutrition-2");
  assert.deepEqual(applyCanonicalWorkspaceUrl(aliased), { view: "health", rewritten: true });
  assert.equal(aliased.searchParams.get("page"), "nutrition");

  const canonical = new URL("http://localhost/?view=health&section=h3&page=nutrition");
  assert.deepEqual(applyCanonicalWorkspaceUrl(canonical), { view: "health", rewritten: false });
  assert.equal(canonical.searchParams.get("page"), "nutrition");
});

test("Composer seed module stores nine StrategyTreeV1 reconstructions", async () => {
  const source = await readFile(new URL("../app/strategy/composer-strategies.ts", import.meta.url), "utf8");
  const cache = JSON.parse(await readFile(new URL("../app/strategy/library-nse-stats.cache.json", import.meta.url), "utf8"));
  assert.match(source, /from "\.\/strategy-tree"/);
  assert.match(source, /export const COMPOSER_STRATEGIES/);
  assert.equal((source.match(/tree: treeDoc\(/g) ?? []).length, 9);
  assert.match(source, /id: "simons-kmlm"/);
  assert.match(source, /id: "holy-grail"/);
  assert.match(source, /COMPOSER_RESEARCH_AS_OF = "2026-08-16"/);
  assert.match(source, /COMPOSER_UNRECONSTRUCTED/);
  assert.match(source, /Nifty 500 equity sleeves only/);
  assert.doesNotMatch(source, /BEES/i);
  assert.doesNotMatch(source, /US-listed symbols published on Composer/);
  assert.doesNotMatch(source, /annualizedReturnPct: \d/);
  assert.equal(cache.source, "yfinance");
  assert.equal(cache.market, "NSE");
  assert.doesNotMatch(JSON.stringify(cache), /BEES/i);
  assert.doesNotMatch(JSON.stringify(cache), /"annualizedReturnPct":\s*2000/);
});

test("Strategies workspace uses DailyKanbanBoard and compact vertical read-only trees", async () => {
  const [workspace, readOnly, css, types, page, utils] = await Promise.all([
    readFile(new URL("../app/dashboard/StrategiesWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/strategies/ReadOnlyTree.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/strategies/strategies-workspace.css", import.meta.url), "utf8"),
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
  assert.match(workspace, /defaultOpen/);
  assert.match(workspace, /expandDashboardSection\(dashboardSectionNumberFromNavId\(/);
  assert.match(workspace, /Live 128-KPI values are fetched on Algorithm Canvas/);
  assert.match(workspace, /yfinance NSE tree-backtest/);
  assert.match(workspace, /loadLibraryNseStats/);
  assert.match(workspace, /applyLibraryNseStats/);
  assert.doesNotMatch(workspace, /sector-dimmed|sector-intelligence-filter|EarningsMonthCalendar|digest-panel/);
  assert.doesNotMatch(readOnly, /TreeCanvas|algorithm-builder\.css|\/api\/strategies\/live/);
  assert.match(readOnly, /data-orientation="vertical"/);
  assert.match(readOnly, /strategy-vtree-stack/);
  assert.match(readOnly, /strategy-vtree-sleeves/);
  assert.match(readOnly, /strategy-vtree-wells/);
  assert.match(readOnly, /formatTickerName/);
  assert.match(css, /flex-direction:column/);
  assert.match(css, /\.strategy-vtree-stack/);
  assert.match(css, /\.strategy-vtree-sleeves/);
  assert.match(css, /\.strategy-vtree-wells/);
  assert.match(utils, /kanbanItems[\s\S]*\bstrategies\s*:/);
  assert.match(utils, /key: "strategies", label: "Strategies"/);
  assert.match(utils, /key: "builder", label: "Algorithm Canvas"[\s\S]*icon: GitBranch/);
  assert.match(utils, /key: "strategies", label: "Strategies", note: "NSE strategy library", icon: Library/);
  assert.doesNotMatch(utils, /NSE ETF strategy library/);
  assert.doesNotMatch(utils, /key: "strategies"[\s\S]*icon: GitBranch/);
});

test("Library gallery is KPI-only 2x2 cards; full tree opens in a dialog", async () => {
  const [workspace, css] = await Promise.all([
    readFile(new URL("../app/dashboard/StrategiesWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/strategies/strategies-workspace.css", import.meta.url), "utf8"),
  ]);

  const kpiGrid = workspace.slice(
    workspace.indexOf("function OverviewKpiGrid"),
    workspace.indexOf("function StrategyOverviewCard"),
  );
  const overview = workspace.slice(
    workspace.indexOf("function StrategyOverviewCard"),
    workspace.indexOf("function StrategyDetailDialog"),
  );
  const dialog = workspace.slice(workspace.indexOf("function StrategyDetailDialog"));

  assert.match(kpiGrid, /strategy-kpi-grid/);
  assert.match(overview, /<OverviewKpiGrid stats=\{stats\} \/>/);
  assert.doesNotMatch(overview, /ReadOnlyTree/);
  assert.doesNotMatch(workspace, /strategies-featured|data-featured/);
  assert.match(workspace, /Indian market only/);
  assert.match(workspace, /sorted\.map\(\(card\) =>/);
  const gallery = workspace.slice(
    workspace.indexOf("data-testid=\"strategies-gallery\""),
    workspace.indexOf("strategy-unreconstructed"),
  );
  assert.doesNotMatch(gallery, /ReadOnlyTree/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /<ReadOnlyTree tree=\{tree\} \/>/);
  assert.match(dialog, /unavailableReason/);
  assert.match(workspace, /source: "mine"/);
  assert.match(css, /\.strategy-kpi-grid \{[\s\S]*grid-template-columns:repeat\(2/);
  assert.match(css, /\.strategies-gallery \{[\s\S]*grid-template-columns:repeat\(2/);
  assert.match(css, /\.strategy-dialog \.strategy-readonly-tree \{[\s\S]*max-height:none/);
  assert.match(css, /background:color-mix\(in srgb, var\(--strategy-tone\) 40%, var\(--bg-app\)\)/);
  assert.match(css, /\.strategy-card:hover[\s\S]*box-shadow:/);
  assert.match(css, /\.strategy-card:focus-visible[\s\S]*box-shadow:/);
  for (const id of [
    "inverse-beta-baller",
    "wooden-arkk",
    "simons-kmlm",
    "kmlm-switcher-original",
    "tqqq-ftlt-v2",
    "holy-grail",
    "holier-grail",
    "tqqq-ftlt-reddit",
    "rams-soxx",
  ]) {
    assert.match(css, new RegExp(`\\[data-strategy-id="${id}"\\]`));
  }
  assert.match(overview, /strategy-card-asof/);
  assert.match(overview, /yfinance NSE · as-of/);
  assert.match(kpiGrid, /signedClass\(stats\?\.annualizedReturnPct\)/);
  assert.match(kpiGrid, /maxDdClass\(stats\?\.maxDrawdownPct\)/);
  assert.doesNotMatch(workspace, /annualizedReturnPct:\s*2000|Sharpe 2\.15|TQQQ\/SOXL/);
});

test("Library NSE stats route uses the existing tree backtest path", async () => {
  const [route, api, persist] = await Promise.all([
    readFile(new URL("../app/api/strategies/library-stats/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/strategy-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/persist.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /handleLibraryNseStats/);
  assert.match(api, /loadOrComputeLibraryNseStats/);
  assert.match(api, /runTreeBacktest\(tree, bars\)/);
  assert.match(persist, /LIBRARY_NSE_STATS_PATH = "\/api\/strategies\/library-stats"/);
  assert.doesNotMatch(api, /TQQQ|Composer published/);
});
