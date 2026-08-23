import assert from "node:assert/strict";
import test from "node:test";
import {
  oosKpisFromCurve,
  runCampaignTrees,
  sliceBarsToWindow,
  walkForwardStart,
} from "../app/strategy/strategy-campaign.ts";

function bars(closes) {
  return closes.map((close, index) => ({
    date: `2024-01-${String(index + 1).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));
}

function assetTree(id, symbol) {
  return {
    id,
    name: id,
    source: "composer",
    tree: {
      treeVersion: "1",
      id,
      name: id,
      interval: "day",
      children: [{ id: `${id}-asset`, kind: "asset", params: { symbol }, children: [] }],
    },
  };
}

test("sliceBarsToWindow keeps only the shared campaign window", () => {
  const sliced = sliceBarsToWindow({
    AAA: bars([100, 110, 120, 130, 140]),
  }, "2024-01-02", "2024-01-04");
  assert.deepEqual(sliced.AAA.map((bar) => bar.date), ["2024-01-02", "2024-01-03", "2024-01-04"]);
});

test("runCampaignTrees reports — KPIs when a tree did not run", () => {
  const rows = runCampaignTrees(
    [assetTree("one", "AAA"), assetTree("two", "BBB")],
    { AAA: bars([100, 110, 120, 130, 140, 150]) },
    { walkForward: true },
  );
  const one = rows.find((row) => row.id === "one");
  const two = rows.find((row) => row.id === "two");
  assert.equal(one?.ran, true);
  assert.equal(typeof one?.annualizedReturnPct, "number");
  assert.equal(typeof one?.oosAnnualizedReturnPct, "number");
  assert.equal(two?.ran, false);
  assert.equal(two?.annualizedReturnPct, null);
  assert.equal(two?.oosAnnualizedReturnPct, null);
  assert.deepEqual(two?.curve, []);
  assert.match(two?.message ?? "", /BBB/);
});

test("walk-forward OOS KPIs stay blank without enough dates", () => {
  assert.equal(walkForwardStart(["2024-01-01", "2024-01-02"]), null);
  const oos = oosKpisFromCurve(
    [{ date: "2024-01-01", equity: 100_000 }],
    100_000,
    "2024-01-01",
  );
  assert.equal(oos.oosTotalReturnPct, null);
  assert.equal(oos.oosAnnualizedReturnPct, null);
});
