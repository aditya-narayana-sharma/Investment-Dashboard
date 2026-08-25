import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  getGrowwSnapshot,
  mapGrowwHoldings,
  mapGrowwOrders,
  mapGrowwPositions,
  unavailableGrowwSnapshot,
} from "../app/groww-live-server.ts";

test("holdings map from either payload shape and drop unnamed rows", () => {
  assert.deepEqual(
    mapGrowwHoldings({ holdings: [{ trading_symbol: "itc", quantity: 10, value: 4500, average_price: 430 }] }),
    [{ symbol: "ITC", qty: 10, value: 4500, avg: 430 }],
  );
  assert.deepEqual(
    mapGrowwHoldings([{ tradingSymbol: "TCS", qty: 2, current_value: 8000 }]),
    [{ symbol: "TCS", qty: 2, value: 8000, avg: null }],
  );
  assert.deepEqual(mapGrowwHoldings({ holdings: [{ quantity: 5 }] }), [], "a row with no symbol is dropped");
  assert.deepEqual(mapGrowwHoldings(null), []);
});

test("positions and orders map without inventing missing fields", () => {
  const [position] = mapGrowwPositions({ positions: [{ symbol: "INFY", net_quantity: -3 }] });
  assert.equal(position.symbol, "INFY");
  assert.equal(position.qty, -3);
  assert.equal(position.product, "—", "a missing product is shown blank, not guessed");
  assert.equal(position.pnl, null, "missing P&L stays null rather than becoming zero");

  const [order] = mapGrowwOrders({ orders: [{ order_id: "G1", symbol: "SBIN", transaction_type: "buy", quantity: 1 }] });
  assert.equal(order.orderId, "G1");
  assert.equal(order.side, "BUY");
  assert.equal(order.status, "—");
  assert.equal(order.placedAt, null);
});

test("an unconfigured token is unauthenticated, not a fabricated empty portfolio", async () => {
  const previous = process.env.GROWW_ACCESS_TOKEN;
  delete process.env.GROWW_ACCESS_TOKEN;
  try {
    const snapshot = await getGrowwSnapshot();
    assert.equal(snapshot.status, "unavailable");
    assert.equal(snapshot.authStatus, "unauthenticated");
    assert.deepEqual(snapshot.holdings, []);
    assert.match(snapshot.message, /GROWW_ACCESS_TOKEN/);
    assert.deepEqual(snapshot.unavailableSections, ["holdings", "positions", "orders"]);
  } finally {
    if (previous === undefined) delete process.env.GROWW_ACCESS_TOKEN;
    else process.env.GROWW_ACCESS_TOKEN = previous;
  }
});

test("the snapshot mirrors the Kite contract fields", () => {
  const snapshot = unavailableGrowwSnapshot("test");
  for (const key of ["status", "authStatus", "asOf", "message", "unavailableSections"]) {
    assert.ok(key in snapshot, `Groww snapshot is missing the Kite-parity field ${key}`);
  }
});

test("GUARD: the Groww adapter is read-only", async () => {
  const source = await readFile(new URL("../app/groww-live-server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /method:\s*["']POST["']/i, "Groww must never POST an order");
  assert.doesNotMatch(source, /place_?order|placeOrder|\/order\/v1\/create/i);
  // Only GET helpers are permitted.
  assert.match(source, /read-only/i);
});
