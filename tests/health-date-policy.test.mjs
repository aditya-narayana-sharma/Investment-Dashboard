import assert from "node:assert/strict";
import test from "node:test";
import { healthTargetContext } from "../app/health-date-policy.ts";

const cases = [
  ["2026-07-26T19:59:00+05:30", "2026-07-25", "D_MINUS_1", "D-1"],
  ["2026-07-26T20:00:00+05:30", "2026-07-26", "D_EVENING", "D · evening cutoff"],
  ["2026-07-26T23:59:00+05:30", "2026-07-26", "D_EVENING", "D · evening cutoff"],
  ["2026-07-27T00:00:00+05:30", "2026-07-26", "D_OVERNIGHT", "D · overnight window"],
  ["2026-07-27T01:59:00+05:30", "2026-07-26", "D_OVERNIGHT", "D · overnight window"],
  ["2026-07-27T02:00:00+05:30", "2026-07-26", "D_MINUS_1", "D-1"],
  ["2026-07-27T21:00:00+05:30", "2026-07-27", "D_EVENING", "D · evening cutoff"],
];

test("Health operational date rolls at 20:00 IST and remains anchored overnight", () => {
  for (const [instant, targetDate, policy, label] of cases) {
    assert.deepEqual(healthTargetContext(new Date(instant)), { targetDate, policy, label });
  }
});
