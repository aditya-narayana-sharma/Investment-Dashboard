import assert from "node:assert/strict";
import test from "node:test";

import { axisImpliedUpsidePct, completeAxisPicks, resolveAxisCmp } from "../app/axis-pick-metrics.ts";

const base = {
  symbol: "TEST",
  name: "Test Company",
  call: "BUY",
  target: 125,
  cmp: 100,
  upside: "stale source text",
  horizon: "12 months",
  source: "Axis PDF",
  date: "12 Aug",
  thesis: "Test evidence",
  color: "#4c8fff",
  scores: [3, 3, 3, 3, 3, 3],
};

test("Axis upside is calculated only as target divided by CMP minus one", () => {
  assert.equal(axisImpliedUpsidePct(125, 100), 25);
  assert.ok(Math.abs(axisImpliedUpsidePct(90, 100) - (-10)) < 1e-10);
  assert.equal(axisImpliedUpsidePct(100, 0), null);
  assert.equal(axisImpliedUpsidePct(null, 100), null);
});

test("Axis CMP follows Kite, yfinance, then report evidence precedence", () => {
  assert.deepEqual(resolveAxisCmp(base, new Map([["TEST", 110]]), new Map([["TEST", 105]])), { cmp: 110, source: "kite" });
  assert.deepEqual(resolveAxisCmp(base, new Map(), new Map([["TEST", 105]])), { cmp: 105, source: "yfinance" });
  assert.deepEqual(resolveAxisCmp(base, new Map(), new Map()), { cmp: 100, source: "axis" });
});

test("only complete Axis picks render and stale upside prose is replaced", () => {
  const rows = completeAxisPicks([
    base,
    { ...base, symbol: "NO_TARGET", target: null },
    { ...base, symbol: "NO_CMP", cmp: null },
  ], new Map(), new Map());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].computedUpsidePct, 25);
  assert.equal(rows[0].upside, "+25.0%");
});
