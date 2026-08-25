import assert from "node:assert/strict";
import test from "node:test";
import { retainKiteOnFailure } from "../app/dashboard-refresh-merge.ts";
import { kiteAuthPresentation } from "../app/kite-auth-presentation.ts";
import { emptySnapshot } from "../app/live-types.ts";

/**
 * RC-2: a transport failure must never render an authentication prompt.
 * `retainKiteOnFailure` is reached from fetch rejections, timeouts and 503s —
 * none of which say anything about the broker session.
 */

const liveSnapshot = {
  ...emptySnapshot,
  status: "live",
  authStatus: "authenticated",
  asOf: "25 Aug 2026, 14:30",
  message: "Live holdings from Zerodha Kite Connect.",
  holdings: [{ symbol: "ICICIBANK" }],
};

test("a transport failure over a live snapshot renders Kite cached, not Authenticate", () => {
  const retained = retainKiteOnFailure(liveSnapshot, "Kite refresh failed (timeout).");

  assert.equal(retained.status, "snapshot", "retained data must be labelled as a snapshot");
  assert.equal(retained.authStatus, "authenticated", "a network failure must not erase session truth");

  const { control, showAuthAction } = kiteAuthPresentation(retained);
  assert.equal(control, "cached");
  assert.equal(showAuthAction, false, "a network blip must never offer a Zerodha login link");
});

test("a transport failure over a partial snapshot also stays cached", () => {
  const retained = retainKiteOnFailure(
    { ...liveSnapshot, status: "partial", unavailableSections: ["margins"] },
    "Kite refresh failed (503).",
  );

  assert.equal(retained.authStatus, "authenticated");
  assert.equal(kiteAuthPresentation(retained).showAuthAction, false);
});

test("a server-reported expiry still surfaces re-auth through the same path", () => {
  const retained = retainKiteOnFailure(
    { ...liveSnapshot, authStatus: "expired" },
    "Kite session expired at the daily ~06:00 IST boundary.",
  );

  assert.equal(retained.authStatus, "expired", "a real expiry must survive retention");
  const { control, showAuthAction } = kiteAuthPresentation(retained);
  assert.equal(control, "authenticate");
  assert.equal(showAuthAction, true);
});

test("a server-reported auth_required payload still surfaces re-auth", () => {
  const { control, showAuthAction } = kiteAuthPresentation({
    status: "auth_required",
    authStatus: "unauthenticated",
    authUrl: "https://kite.zerodha.com/connect/login?api_key=x",
    reauthSuggested: true,
  });
  assert.equal(control, "authenticate");
  assert.equal(showAuthAction, true);
});

test("a failure with no retained holdings is unavailable, not a login prompt", () => {
  const retained = retainKiteOnFailure(emptySnapshot, "Could not reach the Kite MCP server.");
  assert.equal(retained.status, "unavailable");
  assert.equal(retained.authStatus, "unavailable", "session truth is still not invented");
});

test("repeated transport failures never escalate into an auth prompt", () => {
  let snapshot = liveSnapshot;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    snapshot = retainKiteOnFailure(snapshot, `Kite refresh failed (attempt ${attempt}).`);
  }
  assert.equal(snapshot.authStatus, "authenticated");
  assert.equal(kiteAuthPresentation(snapshot).control, "cached");
});
