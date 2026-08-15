import assert from "node:assert/strict";
import test from "node:test";

import { groupAnalystRows, normalizeAnalystCallLabel } from "../app/analyst-matrix-groups.ts";

const baseRow = {
  symbol: "TEST",
  house: "Axis Mail",
  rating: "BUY",
  target: 120,
  date: "12 Aug",
  thesis: "Source-backed test",
  mail: true,
};

test("plain BUY variants resolve to one matrix category", () => {
  assert.equal(normalizeAnalystCallLabel("Buy"), "BUY");
  assert.equal(normalizeAnalystCallLabel("BUY CALL"), "BUY");
  assert.equal(normalizeAnalystCallLabel("Fundamental Buy"), "BUY");
  assert.equal(normalizeAnalystCallLabel("Positive"), "BUY");
  assert.equal(normalizeAnalystCallLabel("TRADING BUY"), "TRADING BUY");
  assert.equal(normalizeAnalystCallLabel("TECHNICAL BUY"), "TECHNICAL BUY");

  const groups = groupAnalystRows([
    baseRow,
    { ...baseRow, symbol: "ALT", rating: "Buy" },
    { ...baseRow, symbol: "POS", rating: "Positive" },
  ], "calls", new Map(), []);
  assert.deepEqual(groups.map((group) => [group.label, group.rows.length]), [["BUY", 3]]);
});

test("Target achieved mode contains only explicit closed-call rows", () => {
  const rows = [
    baseRow,
    { ...baseRow, symbol: "CLOSED", rating: "TARGET ACHIEVED", targetAchieved: true },
  ];
  const groups = groupAnalystRows(rows, "target-achieved", new Map(), []);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].rows.map((row) => row.symbol), ["CLOSED"]);

  for (const mode of ["calls", "industries", "performance", "posted-month"]) {
    const activeSymbols = groupAnalystRows(rows, mode, new Map([["TEST", 100], ["CLOSED", 100]]), [])
      .flatMap((group) => group.rows.map((row) => row.symbol));
    assert.deepEqual(activeSymbols, ["TEST"], `${mode} must contain active calls only`);
  }
});
