import assert from "node:assert/strict";
import test from "node:test";
import { emptySnapshot } from "../app/live-types.ts";
import { emptyBenchmarkSnapshot, emptySectorSnapshot } from "../app/sector-live-types.ts";
import { SMART_ACTIONS_LABEL } from "../app/dashboard/daily-action-policy.ts";
import {
  buildBuilderDailyActions,
  buildHealthDailyActions,
  buildInvestmentDailyActions,
  buildSectorDailyActions,
  buildStrategiesDailyActions,
} from "../app/dashboard/workspace-daily-actions.ts";

const emptyEarnings = {
  status: "unavailable",
  asOf: "test",
  analysisDate: "2026-08-24",
  events: [],
  message: "none",
};

const liveKite = {
  ...emptySnapshot,
  status: "live",
  authStatus: "authenticated",
  portfolio: { ...emptySnapshot.portfolio, topTwo: 71.2, value: 1_000_000 },
};

test("I-1 Smart Action names unavailable Kite and does not invent holdings", () => {
  const items = buildInvestmentDailyActions({
    snapshot: emptySnapshot,
    earningsSnapshot: emptyEarnings,
  });
  assert.ok(items.some((item) => item.id === "inv-kite-unavailable"));
  assert.ok(items.every((item) => item.sourceKind === "smart"));
  assert.ok(items.every((item) => item.sourceLabel === SMART_ACTIONS_LABEL));
  assert.doesNotMatch(items.map((item) => item.title).join(" "), /concentration|oil|INR/i);
  assert.ok(!items.some((item) => /ICICI|Eternal|71/.test(`${item.title} ${item.detail}`)));
});

test("I-1 live Kite mints concentration from the snapshot top-two weight", () => {
  const items = buildInvestmentDailyActions({
    snapshot: liveKite,
    earningsSnapshot: {
      ...emptyEarnings,
      status: "verified",
      events: [
        {
          date: "24 Aug",
          day: "24",
          symbol: "TESTCO",
          name: "Test Co",
          state: "Reported",
          portfolio: false,
          period: "Q1",
          reported: true,
          kpis: [{ label: "Revenue", value: "", change: "", tone: "amber" }],
        },
      ],
    },
  });
  const concentration = items.find((item) => item.id === "inv-concentration");
  assert.equal(concentration?.sourceKind, "source");
  assert.match(concentration?.detail ?? "", /71 percent/);
  assert.match(concentration?.numericAdvantage ?? "", /71\.2%/);
  assert.equal(items.find((item) => item.id === "inv-earnings")?.sourceLabel, "Earnings");
});

test("S-1 names sector status and does not invent companies", () => {
  const items = buildSectorDailyActions({
    sectorMarket: emptySectorSnapshot("pharma"),
    sectorMarketById: { pharma: emptySectorSnapshot("pharma") },
    benchmarks: emptyBenchmarkSnapshot(),
  });
  assert.ok(items.some((item) => item.id === "sec-breadth"));
  assert.match(items.find((item) => item.id === "sec-breadth")?.detail ?? "", /unavailable/);
  assert.ok(!items.some((item) => /ICICI|Eternal/.test(`${item.title} ${item.detail}`)));
});

test("H-1 Smart Action lists exact missing dates", () => {
  const items = buildHealthDailyActions({
    healthSnapshot: {
      schemaVersion: 1,
      status: "stale",
      source: "Apple Health",
      dataDate: "2026-07-16",
      capturedAt: "2026-07-16",
      message: "stale",
      categories: [],
      sources: [],
    },
    missingDates: ["2026-08-22", "2026-08-23"],
  });
  const missing = items.find((item) => item.id === "health-missing-dates");
  assert.equal(missing?.sourceKind, "smart");
  assert.equal(missing?.sourceLabel, SMART_ACTIONS_LABEL);
  assert.match(missing?.detail ?? "", /2026-08-22/);
  assert.match(missing?.detail ?? "", /2026-08-23/);
});

test("Canvas and Strategies boards stay short and source-backed", () => {
  const builder = buildBuilderDailyActions({
    tree: {
      treeVersion: "1",
      id: "t",
      name: "Test",
      interval: "day",
      children: [
        {
          id: "if-1",
          kind: "if_else",
          label: "Gate",
          params: { left: { kind: "value", value: 1 }, op: "gt", right: { kind: "value", value: 0 } },
          then: [],
          else: [],
        },
      ],
    },
  });
  assert.ok(builder.length <= 5);
  assert.ok(builder.some((item) => item.id === "builder-else"));
  const strategies = buildStrategiesDailyActions();
  assert.ok(strategies.length <= 5);
  assert.ok(strategies.every((item) => item.sourceKind === "source"));
});
