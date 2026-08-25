import assert from "node:assert/strict";
import test from "node:test";
import { runWithConcurrency, supersedesInFlight, whenIdle } from "../app/dashboard/refresh-scheduling.ts";

test("runWithConcurrency never exceeds the limit and preserves order", async () => {
  let inFlight = 0;
  let peak = 0;
  const tasks = Array.from({ length: 12 }, (_, index) => async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return index;
  });

  const results = await runWithConcurrency(tasks, 2);
  assert.equal(peak, 2, `expected at most 2 concurrent tasks, saw ${peak}`);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("runWithConcurrency isolates failures instead of rejecting", async () => {
  const results = await runWithConcurrency([
    async () => "ok",
    async () => { throw new Error("sector refresh failed"); },
    async () => "also ok",
  ], 2);
  assert.deepEqual(results, ["ok", null, "also ok"]);
});

test("runWithConcurrency handles an empty list and a limit above the task count", async () => {
  assert.deepEqual(await runWithConcurrency([], 4), []);
  assert.deepEqual(await runWithConcurrency([async () => 1], 99), [1]);
});

test("runWithConcurrency treats a zero or negative limit as serial", async () => {
  let peak = 0;
  let inFlight = 0;
  const tasks = Array.from({ length: 4 }, () => async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 2));
    inFlight -= 1;
    return null;
  });
  await runWithConcurrency(tasks, 0);
  assert.equal(peak, 1);
});

test("whenIdle resolves outside a browser", async () => {
  await whenIdle();
});

test("a forcing request supersedes a background non-forcing run", () => {
  // The exact RC-4 scenario: native launch runs silent+non-forcing, operator
  // clicks Refresh all.
  assert.equal(
    supersedesInFlight({ forceContent: false, silent: true }, { forceContent: true, silent: false }),
    true,
  );
});

test("a user-visible request supersedes a silent run of equal force", () => {
  assert.equal(
    supersedesInFlight({ forceContent: true, silent: true }, { forceContent: true, silent: false }),
    true,
  );
});

test("a weaker or equal request does not supersede", () => {
  assert.equal(
    supersedesInFlight({ forceContent: true, silent: false }, { forceContent: false, silent: false }),
    false,
  );
  assert.equal(
    supersedesInFlight({ forceContent: true, silent: false }, { forceContent: true, silent: false }),
    false,
  );
  assert.equal(
    supersedesInFlight({ forceContent: false, silent: false }, { forceContent: false, silent: true }),
    false,
  );
});
