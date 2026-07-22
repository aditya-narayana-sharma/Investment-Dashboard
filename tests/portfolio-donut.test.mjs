import assert from "node:assert/strict";
import test from "node:test";
import { buildContiguousAllocations, sortDonutHoldings } from "../app/portfolio-donut.ts";

const holdings = [
  { symbol: "ETERNAL", marketCap: "Large cap", sector: "E-Commerce", subSector: "Food Delivery & Quick Commerce", donutOrder: 20, value: 250, color: "#13a08f" },
  { symbol: "ADANIGREEN", marketCap: "Large cap", sector: "Power Generation", subSector: "Renewable Power", donutOrder: 40, value: 229, color: "#2aa889" },
  { symbol: "ICICIBANK", marketCap: "Large cap", sector: "Private Sector Bank", subSector: "Commercial Banking", donutOrder: 10, value: 298, color: "#2563a6" },
  { symbol: "AXISBANK", marketCap: "Large cap", sector: "Private Sector Bank", subSector: "Commercial Banking", donutOrder: 45, value: 64, color: "#4c8fff" },
  { symbol: "BHARTIARTL", marketCap: "Large cap", sector: "Telecom", subSector: "Wireless & Digital Services", donutOrder: 30, value: 101, color: "#7659c8" },
  { symbol: "JSWENERGY", marketCap: "Mid cap", sector: "Power Generation", subSector: "Integrated Power & Storage", donutOrder: 50, value: 58, color: "#df6651" },
];

test("donut sort keeps market-cap groups contiguous before sector groups", () => {
  const sorted = sortDonutHoldings(holdings);
  assert.deepEqual(sorted.map((item) => item.symbol), [
    "ETERNAL",
    "ADANIGREEN",
    "ICICIBANK",
    "AXISBANK",
    "BHARTIARTL",
    "JSWENERGY",
  ]);
});

test("contiguous allocations keep Private Bank aligned and split Power Gen by market cap", () => {
  const sorted = sortDonutHoldings(holdings);
  const sectors = buildContiguousAllocations(sorted, "sector", {
    "E-Commerce": "#13a08f",
    "Power Generation": "#2aa889",
    "Private Sector Bank": "#2563a6",
    Telecom: "#7659c8",
  });
  const subSectors = buildContiguousAllocations(sorted, "subSector", {});
  const marketCaps = buildContiguousAllocations(sorted, "marketCap", {});

  assert.deepEqual(sectors.map((item) => [item.name, Number(item.weight.toFixed(1))]), [
    ["E-Commerce", 25.0],
    ["Power Generation", 22.9],
    ["Private Sector Bank", 36.2],
    ["Telecom", 10.1],
    ["Power Generation", 5.8],
  ]);
  assert.equal(sectors.filter((item) => item.name === "Power Generation").length, 2);
  assert.deepEqual(subSectors.map((item) => item.name), [
    "Food Delivery & Quick Commerce",
    "Renewable Power",
    "Commercial Banking",
    "Wireless & Digital Services",
    "Integrated Power & Storage",
  ]);
  assert.deepEqual(marketCaps.map((item) => item.name), ["Large cap", "Mid cap"]);

  const privateBank = sectors.find((item) => item.name === "Private Sector Bank");
  const commercial = subSectors.find((item) => item.name === "Commercial Banking");
  assert.ok(privateBank && commercial);
  assert.equal(privateBank.weight.toFixed(1), commercial.weight.toFixed(1));
});
