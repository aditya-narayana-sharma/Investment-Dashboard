import assert from "node:assert/strict";
import test from "node:test";
import {
  extractAxisRecommendationsForTradingAsOf,
} from "../scripts/axis-recommendations.mjs";
import {
  isNseTradingDay,
  lastNseTradingDay,
  resolveAxisTradingAsOf,
} from "../scripts/nse-trading-day.mjs";

test("weekends resolve to the prior NSE trading day", () => {
  assert.equal(isNseTradingDay("2026-07-25"), false); // Saturday
  assert.equal(isNseTradingDay("2026-07-24"), true); // Friday
  assert.equal(lastNseTradingDay("2026-07-25"), "2026-07-24");
  assert.equal(lastNseTradingDay("2026-07-26"), "2026-07-24"); // Sunday
  const resolved = resolveAxisTradingAsOf("2026-07-25");
  assert.equal(resolved.tradingAsOf, "2026-07-24");
  assert.equal(resolved.usedLastTradingDay, true);
});

test("NSE holiday also walks back to the prior session", () => {
  assert.equal(isNseTradingDay("2026-08-15"), false); // Independence Day Saturday
  assert.equal(isNseTradingDay("2026-01-26"), false); // Republic Day
  assert.equal(lastNseTradingDay("2026-01-26"), "2026-01-23");
});

test("Axis recommended stocks prefer last trading day mails on weekends", () => {
  const messages = [
    {
      source: "Axis Research",
      time: "25 Jul, 8:03 am",
      receivedAt: "2026-07-25T02:33:38.000Z",
      title: "Pick of the Week - Max Healthcare Limited",
      summary: "Weekend feature only.",
    },
    {
      source: "Axis Research",
      time: "24 Jul, 1:36 pm",
      receivedAt: "2026-07-24T08:06:26.000Z",
      title: "Q1FY27 Result Updates - July 24, 2026",
      summary: "Ujjivan Small Finance Bank Ltd: BUY, TP ₹86. Bandhan Bank Ltd: BUY, TP ₹235.",
    },
  ];
  const scoped = extractAxisRecommendationsForTradingAsOf(messages, {
    calendarDate: "2026-07-25",
    lookbackDays: 3,
  });
  assert.equal(scoped.tradingAsOf, "2026-07-24");
  assert.equal(scoped.sourceDate, "2026-07-24");
  assert.ok(scoped.recommendations.some((item) => item.symbol === "UJJIVANSFB"));
  assert.equal(scoped.recommendations.some((item) => item.symbol === "MAXHEALTHCARE"), false);
});
