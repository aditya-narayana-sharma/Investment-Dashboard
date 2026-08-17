import assert from "node:assert/strict";
import test from "node:test";

import { groupAnalystRows, normalizeAnalystCallLabel } from "../app/analyst-matrix-groups.ts";
import {
  activeMatrixCallKey,
  axisCallBucket,
  mergeActiveMatrixRowsIntoWorkbench,
  workbenchCallKey,
} from "../app/axis-holding-trading-calls.ts";

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

test("workbench merge covers every active matrix symbol and category", () => {
  const axisCards = [
    { symbol: "DLF", name: "DLF", call: "TECHNICAL BUY", target: 750, cmp: 686, upside: "—", horizon: "Weekly", source: "Axis PDF", date: "10 Jul", thesis: "Technical", color: "#e3b844", scores: [3, 3, 3, 3, 3, 3], bucket: "technical" },
    { symbol: "OBEROIRLTY", name: "Oberoi Realty", call: "TRADING BUY", target: 1985, cmp: 1807, upside: "—", horizon: "Axis Punch", source: "Axis PDF", date: "6 Aug", thesis: "Trading", color: "#42c878", scores: [3, 3, 3, 3, 3, 3], bucket: "trading" },
  ];
  const matrixRows = [
    { symbol: "DLF", house: "Axis PDF / iCloud Axis Research", rating: "TECHNICAL BUY", target: 750, date: "10 Jul", thesis: "Technical", mail: true },
    { symbol: "OBEROIRLTY", house: "Axis PDF / iCloud Axis Research", rating: "TRADING BUY", target: 1985, date: "6 Aug", thesis: "Trading", mail: true },
    { symbol: "AETHER", house: "HDFC Securities / NDTV Profit", rating: "Buy", target: 1429, date: "2 Jul", thesis: "Exclusive manufacturing", mail: false },
    { symbol: "CHOLAFIN", house: "Axis Mail", rating: "TARGET ACHIEVED", target: 1945, date: "6 Aug", thesis: "Closed", mail: true, targetAchieved: true },
  ];

  const cards = mergeActiveMatrixRowsIntoWorkbench(axisCards, matrixRows);
  const active = groupAnalystRows(matrixRows, "calls", new Map(), []).flatMap((group) => group.rows);
  assert.equal(active.some((row) => row.symbol === "CHOLAFIN"), false);
  for (const row of active) {
    assert.ok(cards.some((card) => workbenchCallKey(card) === activeMatrixCallKey(row)));
  }
  assert.ok(cards.some((card) => card.symbol === "DLF" && axisCallBucket(card) === "technical"));
  assert.ok(cards.some((card) => card.symbol === "OBEROIRLTY" && axisCallBucket(card) === "trading"));
  assert.ok(cards.some((card) => card.symbol === "AETHER" && axisCallBucket(card) === "fundamental"));
});
