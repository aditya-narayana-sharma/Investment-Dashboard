import assert from "node:assert/strict";
import test from "node:test";
import { runTreeBacktest } from "../app/strategy/tree-backtest.ts";

function bars(symbol, closes) {
  return closes.map((close, index) => ({
    date: `2024-01-${String(index + 1).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));
}

function twoAssetTree() {
  return {
    treeVersion: "1",
    id: "bt-two-asset",
    name: "Two asset",
    interval: "day",
    children: [
      {
        id: "weight-root",
        kind: "weight",
        params: { method: "specified" },
        children: [
          {
            percent: 50,
            node: { id: "a", kind: "asset", params: { symbol: "AAA" }, children: [] },
          },
          {
            percent: 50,
            node: { id: "b", kind: "asset", params: { symbol: "BBB" }, children: [] },
          },
        ],
      },
    ],
  };
}

test("runTreeBacktest returns ran=true and a curve for complete OHLCV", () => {
  const result = runTreeBacktest(twoAssetTree(), {
    AAA: bars("AAA", [100, 110, 121]),
    BBB: bars("BBB", [100, 100, 100]),
  });
  assert.equal(result.status, "ran");
  assert.equal(result.ran, true);
  assert.ok(result.curve.length >= 2);
  assert.equal(typeof result.endingEquity, "number");
  assert.ok(result.endingEquity > 0);
  assert.equal(typeof result.totalReturnPct, "number");
  assert.ok(result.sharpe === null || typeof result.sharpe === "number");
  assert.equal(typeof result.annualizedReturnPct, "number");
  assert.equal(typeof result.maxDrawdownPct, "number");
});

test("runTreeBacktest Sharpe is finite when daily returns vary", () => {
  const result = runTreeBacktest(twoAssetTree(), {
    AAA: bars("AAA", [100, 110, 90, 130, 120, 150]),
    BBB: bars("BBB", [100, 101, 99, 102, 98, 100]),
  });
  assert.equal(result.ran, true);
  assert.equal(typeof result.sharpe, "number");
  assert.ok(Number.isFinite(result.sharpe));
});

test("runTreeBacktest does not set ran=true when a required series is missing", () => {
  const result = runTreeBacktest(twoAssetTree(), {
    AAA: bars("AAA", [100, 110, 121]),
  });
  assert.equal(result.status, "unavailable");
  assert.equal(result.ran, false);
  assert.deepEqual(result.curve, []);
  assert.deepEqual(result.missingSymbols, ["BBB"]);
  assert.match(result.message, /BBB/);
  assert.equal(result.sharpe, null);
});

test("runTreeBacktest requires KPI operand symbols, not only asset sleeves", () => {
  const tree = {
    treeVersion: "1",
    id: "bt-kpi-gate",
    name: "KPI gate",
    interval: "day",
    children: [
      {
        id: "gate",
        kind: "if_else",
        params: {
          left: { type: "kpi", kpiId: "close", symbol: "CCC" },
          op: ">",
          right: { type: "number", value: 10 },
        },
        then: [{ id: "a", kind: "asset", params: { symbol: "AAA" }, children: [] }],
        else: [{ id: "b", kind: "asset", params: { symbol: "BBB" }, children: [] }],
      },
    ],
  };
  const result = runTreeBacktest(tree, {
    AAA: bars("AAA", [100, 110, 121]),
    BBB: bars("BBB", [100, 100, 100]),
  });
  assert.equal(result.ran, false);
  assert.deepEqual(result.missingSymbols, ["CCC"]);
});

test("runTreeBacktest equal-weights group baskets to 100% instead of stacking 1x each child", () => {
  const tree = {
    treeVersion: "1",
    id: "bt-group",
    name: "Group basket",
    interval: "day",
    children: [
      {
        id: "basket",
        kind: "group",
        params: {},
        children: [
          { id: "a", kind: "asset", params: { symbol: "AAA" }, children: [] },
          { id: "b", kind: "asset", params: { symbol: "BBB" }, children: [] },
        ],
      },
    ],
  };
  const result = runTreeBacktest(tree, {
    AAA: bars("AAA", [100, 200]),
    BBB: bars("BBB", [100, 100]),
  });
  assert.equal(result.ran, true);
  assert.ok(result.totalReturnPct !== null && result.totalReturnPct < 60);
});

function inverseVolTree(lookbackDays = 5) {
  return {
    treeVersion: "1",
    id: "bt-invvol",
    name: "Inverse vol",
    interval: "day",
    children: [
      {
        id: "weight-inv",
        kind: "weight",
        label: "Inv vol sleeve",
        params: { method: "inverse_volatility", lookbackDays },
        children: [
          { node: { id: "a", kind: "asset", params: { symbol: "AAA" }, children: [] } },
          { node: { id: "b", kind: "asset", params: { symbol: "BBB" }, children: [] } },
        ],
      },
    ],
  };
}

function specifiedTree() {
  return twoAssetTree();
}

test("runTreeBacktest inverse_volatility produces weights when lookback bars exist", () => {
  const volatile = [100, 130, 80, 140, 70, 150, 60, 160, 50, 40];
  const stable = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101];
  const result = runTreeBacktest(inverseVolTree(5), {
    AAA: bars("AAA", volatile),
    BBB: bars("BBB", stable),
  });
  const equal = runTreeBacktest(specifiedTree(), {
    AAA: bars("AAA", volatile),
    BBB: bars("BBB", stable),
  });
  assert.equal(result.ran, true);
  assert.equal(result.status, "ran");
  assert.ok(!result.warnings.some((line) => /not executable/i.test(line)));
  assert.ok(!result.warnings.some((line) => /lookback bars missing/i.test(line)));
  assert.ok(result.curve.length >= 2);
  assert.ok(typeof result.endingEquity === "number");
  assert.notEqual(result.endingEquity, 100_000);
  assert.ok(equal.ran);
  assert.notEqual(result.endingEquity, equal.endingEquity);
});

test("runTreeBacktest inverse_volatility does not fabricate weights when lookback bars are missing", () => {
  const result = runTreeBacktest(inverseVolTree(30), {
    AAA: bars("AAA", [100, 110, 90]),
    BBB: bars("BBB", [100, 101, 102]),
  });
  assert.equal(result.ran, true);
  assert.ok(!result.warnings.some((line) => /not executable/i.test(line)));
  assert.ok(result.warnings.some((line) => /lookback/i.test(line)));
  assert.equal(result.endingEquity, 100_000);
  assert.equal(result.totalReturnPct, 0);
});

test("runTreeBacktest inverse_volatility stays unavailable when a required series is missing", () => {
  const result = runTreeBacktest(inverseVolTree(5), {
    AAA: bars("AAA", [100, 110, 90, 120, 80, 130, 70, 140]),
  });
  assert.equal(result.ran, false);
  assert.deepEqual(result.curve, []);
  assert.deepEqual(result.missingSymbols, ["BBB"]);
});
