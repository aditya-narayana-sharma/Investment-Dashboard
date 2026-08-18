import assert from "node:assert/strict";
import test from "node:test";
import {
  sparkFilamentGapXs,
  sparkFilamentMissingDates,
  sparkFilamentPath,
  sparkFilamentPoints,
  sparkFilamentWindow,
} from "../app/dashboard/health-sparkline.ts";

test("sparkline window is a closed calendar range ending on the target date", () => {
  assert.deepEqual(sparkFilamentWindow("2026-07-25", 7), [
    "2026-07-19",
    "2026-07-20",
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
    "2026-07-24",
    "2026-07-25",
  ]);
});

test("missing dates stay gaps: omitted from the series, broken path, and tick slots", () => {
  const series = [
    { date: "2026-07-23", value: 5000 },
    { date: "2026-07-25", value: 10000 },
  ];
  const missing = sparkFilamentMissingDates(series, "2026-07-25", 7);
  assert.deepEqual(missing, ["2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-24"]);

  const path = sparkFilamentPath(series, { endDate: "2026-07-25", windowDays: 7 });
  assert.ok(path);
  assert.match(path, /^M/);
  assert.match(path, / M/);
  assert.doesNotMatch(path, / L/);

  const points = sparkFilamentPoints(series, { endDate: "2026-07-25", windowDays: 7 });
  assert.equal(points?.length, 2);
  assert.ok(points && points[1].x > points[0].x);
  assert.equal(sparkFilamentGapXs(missing, "2026-07-25", 7).length, missing.length);
});

test("adjacent measured days keep a connected segment and do not invent values", () => {
  const series = [
    { date: "2026-07-24", value: 5000 },
    { date: "2026-07-25", value: 10000 },
  ];
  const path = sparkFilamentPath(series, { endDate: "2026-07-25", windowDays: 7 });
  assert.ok(path);
  assert.equal((path.match(/M/g) ?? []).length, 1);
  assert.equal((path.match(/L/g) ?? []).length, 1);
  assert.deepEqual(sparkFilamentMissingDates(series, "2026-07-25", 7), [
    "2026-07-19",
    "2026-07-20",
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
  ]);
});

test("an empty or single-day series never fabricates neighbouring points", () => {
  assert.equal(sparkFilamentPath([], { endDate: "2026-07-25", windowDays: 7 }), null);
  const lone = sparkFilamentPoints([{ date: "2026-07-25", value: 42 }], { endDate: "2026-07-25", windowDays: 7 });
  assert.equal(lone?.length, 1);
  assert.equal(lone?.[0]?.date, "2026-07-25");
  assert.equal(lone?.[0]?.value, 42);
});
