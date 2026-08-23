import assert from "node:assert/strict";
import test from "node:test";
import { combineStrategyBook } from "../app/strategy/strategy-book.ts";

function ranCurve(id, equities) {
  return {
    status: "ran",
    ran: true,
    message: "Backtest ran on historical OHLCV.",
    warnings: [],
    missingSymbols: [],
    curve: equities.map((equity, index) => ({
      date: `2024-01-${String(index + 1).padStart(2, "0")}`,
      equity,
    })),
    totalReturnPct: null,
    annualizedReturnPct: null,
    sharpe: null,
    maxDrawdownPct: null,
    initialCash: 100_000,
    endingEquity: equities[equities.length - 1] ?? null,
  };
}

function unavailable(id) {
  return {
    status: "unavailable",
    ran: false,
    message: `Unavailable: ${id} missing OHLCV.`,
    warnings: [],
    missingSymbols: ["AAA"],
    curve: [],
    totalReturnPct: null,
    annualizedReturnPct: null,
    sharpe: null,
    maxDrawdownPct: null,
    initialCash: 100_000,
    endingEquity: null,
  };
}

test("combineStrategyBook 60/40 two-tree run produces one combined equity", () => {
  const book = combineStrategyBook([
    { id: "growth", name: "Growth", weight: 60, result: ranCurve("growth", [100_000, 110_000, 120_000]) },
    { id: "stable", name: "Stable", weight: 40, result: ranCurve("stable", [100_000, 100_000, 100_000]) },
  ]);
  assert.equal(book.ran, true);
  assert.equal(book.status, "ran");
  assert.equal(book.placesOrders, false);
  assert.equal(book.curve.length, 3);
  assert.equal(book.endingEquity, 112_000);
  assert.equal(book.totalReturnPct, 12);
  assert.deepEqual(book.missingIds, []);
});

test("combineStrategyBook does not invent KPIs when a leg did not run", () => {
  const book = combineStrategyBook([
    { id: "growth", weight: 60, result: ranCurve("growth", [100_000, 110_000, 120_000]) },
    { id: "missing", weight: 40, result: unavailable("missing") },
  ]);
  assert.equal(book.ran, false);
  assert.equal(book.placesOrders, false);
  assert.deepEqual(book.curve, []);
  assert.equal(book.totalReturnPct, null);
  assert.equal(book.annualizedReturnPct, null);
  assert.equal(book.sharpe, null);
  assert.deepEqual(book.missingIds, ["missing"]);
  assert.match(book.message, /missing/);
});
