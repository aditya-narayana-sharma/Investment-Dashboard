import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeKiteStatusNote } from "../app/kite-status-note.ts";

const holdings = "Live holdings and non-duplicated CNC equity positions from Zerodha Kite Connect. Quantities include settled, T1 and MTF shares; pledged collateral is not double-counted. Use Refresh all to update.";
const clientWarning = "Latest refresh failed; retaining the last validated values.";

test("sanitizeKiteStatusNote keeps the holdings description and drops stacked refresh warnings", () => {
  const stacked = `${holdings} ${clientWarning} ${clientWarning} ${clientWarning}`;
  assert.equal(sanitizeKiteStatusNote(stacked), holdings);
});

test("sanitizeKiteStatusNote collapses a wall of identical failure sentences", () => {
  const wall = Array.from({ length: 45 }, () => clientWarning).join(" ");
  assert.equal(sanitizeKiteStatusNote(`${holdings} ${wall}`), holdings);
  assert.equal(sanitizeKiteStatusNote(wall), "");
});

test("sanitizeKiteStatusNote strips server retained-snapshot failure copy", () => {
  const serverNote = "Kite refresh failed (timeout). Retaining the last validated Kite snapshot until the next five-minute refresh.";
  assert.equal(sanitizeKiteStatusNote(`${holdings} ${serverNote}`), holdings);
  assert.equal(
    sanitizeKiteStatusNote("Zerodha rate limit reached; retaining the last validated Kite snapshot until the next five-minute refresh."),
    "",
  );
});
