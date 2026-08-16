import assert from "node:assert/strict";
import test from "node:test";
import { createSeedTree } from "../app/strategy/seed-tree.ts";
import { computeKpisFromOhlcv } from "../app/strategy/tree-indicators.ts";
import { resolveTreeInstruments, collectTreeSymbols } from "../app/strategy/tree-instruments.ts";
import { buildTreeAlertPreviews, buildTreeGttPreviews, buildTreeOrderPreviews } from "../app/strategy/tree-orders.ts";
import { lookupKpiValue } from "../app/strategy/tree-evaluate.ts";
import { buildTreeLivePreview } from "../app/strategy/tree-live.ts";

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
    holding("LIQUIDBEES", { qty: 40 }),
    holding("NIFTYBEES", { price: 291.4, qty: 12 }),
  ], {
    status: "unavailable",
    message: "Unavailable",
    instruments: [],
  });
  const orders = buildTreeOrderPreviews(tree, instruments);
  const liquid = orders.find((item) => item.symbol === "LIQUIDBEES");
  assert.ok(liquid);
  assert.equal(liquid.side, "BUY");
  assert.equal(liquid.product, "CNC");
  assert.equal(liquid.orderType, "MARKET");
  assert.equal(liquid.confirmation, `BUY ${liquid.quantity} LIQUIDBEES`);
  const gtts = buildTreeGttPreviews(tree, instruments);
  assert.equal(gtts[0].triggerPrice, 250);
  assert.equal(gtts[0].symbol, "NIFTYBEES");
  assert.equal(gtts[0].lastPrice, 291.4);
  assert.match(gtts[0].confirmation, /NIFTYBEES/);
  const alerts = buildTreeAlertPreviews(tree, instruments);
  assert.equal(alerts[0].direction, "above");
  assert.equal(alerts[0].triggerPrice, 250);
  assert.equal(alerts[0].confirmation, "ALERT ABOVE NIFTYBEES 250");
});

test("live preview prefers Kite last price and yfinance secondaries without inventing quotes", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const preview = buildTreeLivePreview(tree, {
    kite: kiteSnapshot("live", [holding("NIFTYBEES", { price: 291.4, qty: 12, pnl: 18 })]),
    watchlist: { status: "unavailable", message: "Unavailable: no watchlist tool.", instruments: [] },
    yfinance: [{
      symbol: "NIFTYBEES",
      asOf: "2026-08-14",
      source: "yfinance",
      ohlcv: Array.from({ length: 20 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        open: 280,
        high: 285,
        low: 275,
        close: 282,
        volume: 1000,
      })),
      fundamentals: {},
    }],
  });
  assert.equal(preview.status, "live");
  assert.equal(preview.kpis["close:NIFTYBEES"].value, 291.4);
  assert.equal(preview.kpis["close:NIFTYBEES"].source, "kite");
  assert.equal(preview.kpis["sma_200:NIFTYBEES"].value, null);
  assert.equal(preview.kpis["sma_200:NIFTYBEES"].status, "unavailable");
  assert.equal(preview.nodes["asset-niftybees"].instrument.lastPrice, 291.4);
  assert.match(preview.watchlist.message, /Unavailable/);
  assert.ok(collectTreeSymbols(tree).includes("GOLDBEES"));
});
