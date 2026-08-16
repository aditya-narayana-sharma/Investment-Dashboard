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
});
