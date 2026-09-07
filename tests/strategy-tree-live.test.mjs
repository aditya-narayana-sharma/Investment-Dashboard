import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSeedTree } from "../app/strategy/seed-tree.ts";
import { computeKpisFromOhlcv } from "../app/strategy/tree-indicators.ts";

const kpiRegistry = JSON.parse(readFileSync(new URL("../packages/kpi-registry/definitions/kpis.json", import.meta.url), "utf8"));
const KPI_REGISTRY_COUNT = kpiRegistry.count;
const kpiDefinitions = kpiRegistry.kpis;
import { resolveTreeInstruments, collectTreeSymbols } from "../app/strategy/tree-instruments.ts";
import { buildTreeAlertPreviews, buildTreeGttPreviews, buildTreeOrderPreviews } from "../app/strategy/tree-orders.ts";
import { lookupKpiValue } from "../app/strategy/tree-evaluate.ts";
import { buildTreeLivePreview, parseTreeLiveKpiSymbol } from "../app/strategy/tree-live.ts";

function holding(symbol, extras = {}) {
  return {
    symbol,
    name: extras.name ?? symbol,
    sector: "Test",
    subSector: "Test",
    marketCap: "Large cap",
    qty: extras.qty ?? 10,
    avg: 100,
    price: extras.price ?? 120,
    value: 1200,
    pnl: extras.pnl ?? 50,
    pnlPct: 5,
    dayPnl: 2,
    dayPct: 1,
    weight: 10,
    risk: "Review",
    stance: "Hold",
    oil: 1,
    flow: 1,
    quarter: "Q1",
    color: "#000",
    donutOrder: 1,
    classificationStatus: "verified",
  };
}

function kiteSnapshot(status, holdings = []) {
  return {
    status,
    authStatus: status === "live" ? "authenticated" : "unavailable",
    asOf: "16 Aug 2026, 12:00 pm",
    message: status === "live" ? "Live holdings." : "Kite unavailable.",
    portfolio: { invested: 0, value: 0, pnl: 0, pnlPct: 0, dayPnl: 0, dayPct: 0, topTwo: 0, equityMargin: 0 },
    holdings,
    positions: [],
    orders: [],
    gtts: [],
    alerts: [],
    marketCapAllocation: [],
    sectorAllocation: [],
    subSectorAllocation: [],
    classification: {
      industrySource: "test",
      marketCapSource: "test",
      industryUrl: "https://example.test",
      marketCapUrl: "https://example.test",
      asOf: "test",
      pendingSymbols: [],
    },
  };
}

test("Kite-primary symbol resolve is holdings ∪ watchlist and never invents names", () => {
  const holdings = [holding("RELIANCE"), holding("INFY")];
  const watchlist = {
    status: "live",
    message: "Live watchlist.",
    instruments: [
      { symbol: "TCS", tradingsymbol: "TCS", name: "Tata Consultancy", source: "watchlist" },
      { symbol: "RELIANCE", tradingsymbol: "RELIANCE", name: "Reliance duplicate", source: "watchlist" },
    ],
  };
  const instruments = resolveTreeInstruments(holdings, watchlist);
  assert.deepEqual(instruments.map((item) => item.symbol), ["INFY", "RELIANCE", "TCS"]);
  assert.equal(instruments.find((item) => item.symbol === "RELIANCE")?.source, "holding");
  assert.equal(instruments.find((item) => item.symbol === "TCS")?.source, "watchlist");
  assert.ok(!instruments.some((item) => item.symbol === "SPY"));
  assert.ok(!instruments.some((item) => item.name.includes("invent")));
});

test("unavailable watchlist still uses holdings and does not invent watchlist names", () => {
  const instruments = resolveTreeInstruments([holding("NIFTYBEES")], {
    status: "unavailable",
    message: "Unavailable: Kite MCP has no watchlist tool.",
    instruments: [],
  });
  assert.deepEqual(instruments.map((item) => item.symbol), ["NIFTYBEES"]);
});

test("yfinance OHLCV computes honest series and leaves short lookbacks blank", () => {
  const bars = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1000 + index,
  }));
  const computed = computeKpisFromOhlcv(bars);
  const byId = Object.fromEntries(computed.map((item) => [item.kpiId, item.value]));
  assert.equal(byId.close, 130);
  assert.ok(byId.sma_20 !== null);
  assert.equal(byId.sma_200, null);
  assert.ok(byId.bbands_upper_20 !== null);
  assert.ok(byId.bbands_lower_20 !== null);
  assert.ok(byId.rsi_14 !== null);
  assert.equal(byId.macd_12_26_9, null);
  const wmap = computed.find((item) => item.kpiId === "weighted_ma_price");
  assert.ok(wmap);
  assert.match(wmap.label, /Weighted MA of price/);
  const registryRows = computed.filter((item) => kpiDefinitions.some((kpi) => kpi.id === item.kpiId));
  assert.equal(registryRows.length, KPI_REGISTRY_COUNT);
  assert.equal(computed.find((item) => item.kpiId === "advance_decline")?.reason, "needs universe");
  assert.equal(computed.find((item) => item.kpiId === "pe_ttm")?.reason, "yfinance .info field missing");
  assert.equal(computed.find((item) => item.kpiId === "beta_60")?.reason, "needs RELIANCE benchmark history");
});

test("missing KPI stays null and unavailable — no fabricate", () => {
  const value = lookupKpiValue("pe_ttm", "NIFTYBEES", [], {}, undefined, "2026-08-16", "live");
  assert.equal(value.value, null);
  assert.equal(value.status, "unavailable");
  assert.equal(value.source, "yfinance");
});

test("order / GTT / alert payloads are built from tree params without a broker call", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  tree.children[0].children[2].node.children[0].params.right = { type: "number", value: 250 };
  const instruments = resolveTreeInstruments([
    holding("ITC", { qty: 40 }),
    holding("RELIANCE", { price: 1405, qty: 12 }),
  ], {
    status: "unavailable",
    message: "Unavailable",
    instruments: [],
  });
  const orders = buildTreeOrderPreviews(tree, instruments);
  const itc = orders.find((item) => item.symbol === "ITC");
  assert.ok(itc);
  assert.equal(itc.side, "BUY");
  assert.equal(itc.product, "CNC");
  assert.equal(itc.orderType, "MARKET");
  assert.equal(itc.confirmation, `BUY ${itc.quantity} ITC`);
  const gtts = buildTreeGttPreviews(tree, instruments);
  assert.equal(gtts[0].triggerPrice, 250);
  assert.equal(gtts[0].symbol, "RELIANCE");
  assert.equal(gtts[0].lastPrice, 1405);
  assert.match(gtts[0].confirmation, /RELIANCE/);
  const alerts = buildTreeAlertPreviews(tree, instruments);
  assert.equal(alerts[0].direction, "above");
  assert.equal(alerts[0].triggerPrice, 250);
  assert.equal(alerts[0].confirmation, "ALERT ABOVE RELIANCE 250");
});

test("live preview prefers Kite last price and yfinance secondaries without inventing quotes", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const preview = buildTreeLivePreview(tree, {
    kite: kiteSnapshot("live", [holding("RELIANCE", { price: 1405, qty: 12, pnl: 18 })]),
    watchlist: { status: "unavailable", message: "Unavailable: no watchlist tool.", instruments: [] },
    yfinance: [{
      symbol: "RELIANCE",
      asOf: "2026-08-14",
      source: "yfinance",
      ohlcv: Array.from({ length: 20 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        open: 1390,
        high: 1410,
        low: 1380,
        close: 1400,
        volume: 1000,
      })),
      fundamentals: {},
    }],
  });
  assert.equal(preview.status, "live");
  assert.equal(preview.kpis["close:RELIANCE"].value, 1405);
  assert.equal(preview.kpis["close:RELIANCE"].source, "kite");
  assert.equal(preview.kpis["sma_200:RELIANCE"].value, null);
  assert.equal(preview.kpis["sma_200:RELIANCE"].status, "unavailable");
  assert.equal(preview.nodes["asset-reliance"].instrument.lastPrice, 1405);
  assert.match(preview.watchlist.message, /Unavailable/);
  assert.ok(collectTreeSymbols(tree).includes("HDFCBANK"));
  assert.ok(!collectTreeSymbols(tree).some((symbol) => symbol.endsWith("BEES")));
  const relianceKpis = Object.keys(preview.kpis).filter((key) => key.endsWith(":RELIANCE"));
  assert.equal(relianceKpis.length, KPI_REGISTRY_COUNT);
  assert.equal(preview.kpis["advance_decline:RELIANCE"].status, "unavailable");
  assert.equal(preview.kpis["advance_decline:RELIANCE"].reason, "needs universe");
});

test("live preview evaluates an extra KPI-panel symbol without inventing values", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  assert.equal(parseTreeLiveKpiSymbol({ tree, kpiSymbol: "  reliance " }), "RELIANCE");
  assert.equal(parseTreeLiveKpiSymbol({ tree }), "");
  const preview = buildTreeLivePreview(tree, {
    kite: kiteSnapshot("live", [holding("NIFTYBEES", { price: 291.4, qty: 12 })]),
    watchlist: { status: "unavailable", message: "Unavailable: no watchlist tool.", instruments: [] },
    yfinance: [{
      symbol: "RELIANCE",
      asOf: "2026-08-14",
      source: "yfinance",
      ohlcv: Array.from({ length: 5 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        open: 1400,
        high: 1410,
        low: 1390,
        close: 1405,
        volume: 1000,
      })),
      fundamentals: {},
    }],
  }, ["RELIANCE"]);
  assert.equal(preview.kpis["close:RELIANCE"].value, 1405);
  assert.equal(preview.kpis["sma_200:RELIANCE"].value, null);
  assert.equal(preview.kpis["sma_200:RELIANCE"].status, "unavailable");
  assert.equal(preview.kpis["pe_ttm:RELIANCE"].value, null);
  const relianceKpis = Object.keys(preview.kpis).filter((key) => key.endsWith(":RELIANCE"));
  assert.equal(relianceKpis.length, KPI_REGISTRY_COUNT);
});
