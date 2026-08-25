import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  bollingerExpansionSignal,
  buildStrategySignals,
  buyCandidates,
  meanComparisonSignal,
} from "../app/strategy/builtin-signals.ts";
import { orderTicketPrefills, planAllocation } from "../app/strategy/allocation-planner.ts";

function barsFromCloses(closes) {
  return closes.map((close, index) => ({
    date: `2026-01-${String(index + 1).padStart(3, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));
}

const uptrend = barsFromCloses(Array.from({ length: 300 }, (_, index) => 100 + index));
const downtrend = barsFromCloses(Array.from({ length: 300 }, (_, index) => 500 - index));
const shortHistory = barsFromCloses(Array.from({ length: 50 }, () => 100));

test("a short history is reported ineligible with a reason, never guessed", () => {
  const signal = meanComparisonSignal("SHORTCO", shortHistory);
  assert.equal(signal.eligible, false);
  assert.equal(signal.action, "none");
  assert.equal(signal.state, "Unavailable");
  assert.deepEqual(signal.metrics, [], "an ineligible signal shows no numbers at all");
  assert.match(signal.reason, /needs 220 sessions/);
});

test("SMA 20 above SMA 220 is a BUY candidate; below is not", () => {
  const bull = meanComparisonSignal("BULLCO", uptrend);
  assert.equal(bull.eligible, true);
  assert.equal(bull.action, "buy_candidate");
  assert.match(bull.state, /Bullish|Fresh bullish cross/);

  const bear = meanComparisonSignal("BEARCO", downtrend);
  assert.equal(bear.action, "none");
  assert.match(bear.state, /Bearish/);
});

test("an expanding band that breaks downward is watched, not bought", () => {
  // Force a known expansion with a downside close.
  const signal = bollingerExpansionSignal("TESTCO", uptrend, "yfinance", {
    upperMin3m: 100, lowerMax3m: 90, widthMin3m: 5, contractionDate: "2026-01-050",
    widthAtContraction: 5, currentWidth: 20, expansionDelta: 15, expansionPct: 300,
    state: "expanding", breakoutDirection: "down", reason: null,
  });
  assert.equal(signal.action, "none", "a downside break must never be a BUY candidate");
  assert.match(signal.state, /downside/);
});

test("an upside expansion is a BUY candidate and a squeeze is a watch", () => {
  const shared = {
    upperMin3m: 100, lowerMax3m: 90, widthMin3m: 5, contractionDate: "2026-01-050",
    widthAtContraction: 5, currentWidth: 20, expansionDelta: 15, expansionPct: 300, reason: null,
  };
  const up = bollingerExpansionSignal("UPCO", uptrend, "yfinance", { ...shared, state: "expanding", breakoutDirection: "up" });
  assert.equal(up.action, "buy_candidate");

  const squeeze = bollingerExpansionSignal("SQCO", uptrend, "yfinance", {
    ...shared, currentWidth: 5, expansionDelta: 0, expansionPct: 0, state: "squeeze", breakoutDirection: null,
  });
  assert.equal(squeeze.action, "watch", "a squeeze is a watchlist entry, not a buy");
});

test("buildStrategySignals returns both strategies and buyCandidates filters correctly", () => {
  const signals = buildStrategySignals("BULLCO", uptrend);
  assert.equal(signals.length, 2);
  assert.deepEqual(signals.map((s) => s.strategy).sort(), ["bollinger_expansion", "mean_comparison"]);

  const ineligible = buildStrategySignals("SHORTCO", shortHistory);
  assert.equal(buyCandidates(ineligible).length, 0, "ineligible signals can never be candidates");
});

test("percent allocation sizes whole shares and never exceeds the budget", () => {
  const plan = planAllocation(
    [{ symbol: "AAA", price: 300, allocation: 50 }, { symbol: "BBB", price: 700, allocation: 50 }],
    { mode: "percent", deployableCapital: 100000, equityMargin: 500000, marginsKnown: true },
  );
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.lines[0].quantity, Math.floor(50000 / 300));
  assert.equal(plan.lines[1].quantity, Math.floor(50000 / 700));
  for (const line of plan.lines) {
    assert.ok(line.notional <= line.budget + 1e-9, "a line must never exceed its own budget");
    assert.equal(Number.isInteger(line.quantity), true, "fractional shares are impossible on NSE delivery");
  }
  assert.ok(plan.totalNotional <= plan.deployableCapital);
  assert.equal(plan.residual, Math.round((100000 - plan.totalNotional) * 100) / 100);
});

test("over-allocation past 100% is a blocking error", () => {
  const plan = planAllocation(
    [{ symbol: "AAA", price: 100, allocation: 70 }, { symbol: "BBB", price: 100, allocation: 60 }],
    { mode: "percent", deployableCapital: 100000, equityMargin: 500000, marginsKnown: true },
  );
  assert.ok(plan.errors.some((error) => /exceeds 100%/.test(error)));
  assert.deepEqual(orderTicketPrefills(plan), [], "an errored plan must never pre-fill an order ticket");
});

test("a missing price blocks that line instead of guessing one", () => {
  const plan = planAllocation(
    [{ symbol: "AAA", price: null, allocation: 50 }],
    { mode: "percent", deployableCapital: 100000, equityMargin: 500000, marginsKnown: true },
  );
  assert.equal(plan.lines[0].quantity, 0);
  assert.match(plan.lines[0].reason, /no live price/);
  assert.deepEqual(orderTicketPrefills(plan), []);
});

test("a budget below one share is refused rather than rounded up", () => {
  const plan = planAllocation(
    [{ symbol: "PRICEY", price: 50000, allocation: 1 }],
    { mode: "percent", deployableCapital: 100000, equityMargin: 500000, marginsKnown: true },
  );
  assert.equal(plan.lines[0].quantity, 0);
  assert.match(plan.lines[0].reason, /below one share/);
});

test("duplicate symbols and non-positive allocations are rejected", () => {
  const plan = planAllocation(
    [
      { symbol: "AAA", price: 100, allocation: 10 },
      { symbol: "aaa", price: 100, allocation: 10 },
      { symbol: "CCC", price: 100, allocation: 0 },
    ],
    { mode: "percent", deployableCapital: 100000, equityMargin: 500000, marginsKnown: true },
  );
  assert.match(plan.lines[1].reason, /duplicate/);
  assert.match(plan.lines[2].reason, /greater than zero/);
});

test("amount mode sizes in rupees and still flags exceeding capital", () => {
  const plan = planAllocation(
    [{ symbol: "AAA", price: 100, allocation: 90000 }, { symbol: "BBB", price: 100, allocation: 90000 }],
    { mode: "amount", deployableCapital: 100000, equityMargin: 500000, marginsKnown: true },
  );
  assert.equal(plan.lines[0].quantity, 900);
  assert.ok(plan.errors.some((error) => /exceeds deployable capital/.test(error)));
});

test("insufficient margin surfaces as a warning on the line", () => {
  const plan = planAllocation(
    [{ symbol: "AAA", price: 1000, allocation: 100 }],
    { mode: "percent", deployableCapital: 100000, equityMargin: 500, marginsKnown: true },
  );
  assert.equal(plan.lines[0].funds.insufficient, true);
  assert.match(plan.lines[0].funds.message, /Insufficient Funds/);
});

test("GUARD: no strategy module can reach a broker order path", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/strategy/builtin-signals.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/allocation-planner.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/expansion-indicators.ts", import.meta.url), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /placeKiteOrder|\/api\/kite\/order|place_order|placeGttOrder/,
      "a signal or planner module must never call an order path directly");
    assert.doesNotMatch(source, /fetch\s*\(/, "these modules must stay pure; no network calls");
  }
});

test("GUARD: the order route still requires exact typed confirmation", async () => {
  const route = await readFile(new URL("../app/api/kite/order/route.ts", import.meta.url), "utf8");
  assert.match(route, /confirmation/);
  assert.match(route, /confirmation_required/);
  // The comparison must remain an exact match, not a truthiness check.
  assert.match(route, /body\.confirmation\?\.trim\(\)\.toUpperCase\(\) !== expectedConfirmation/);
});
