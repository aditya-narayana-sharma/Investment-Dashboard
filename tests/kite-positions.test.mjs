import assert from "node:assert/strict";
import test from "node:test";
import { netPositionsFromKitePayload } from "../app/kite-positions.ts";

function position(overrides = {}) {
  return {
    exchange: "NSE",
    tradingsymbol: "ETERNAL",
    product: "CNC",
    quantity: 6,
    average_price: 313,
    last_price: 315.7,
    pnl: 16.2,
    ...overrides,
  };
}

test("uses only the explicit Kite net book", () => {
  const day = position({ quantity: 2, book: "day" });
  const net = position({ quantity: 8, book: "net" });
  assert.deepEqual(netPositionsFromKitePayload({ day: [day], net: [net] }), [net]);
});

test("collapses the MCP adapter's flattened Day and Net copies", () => {
  const day = position({ book: "day" });
  const net = position({ book: "net" });
  const rows = netPositionsFromKitePayload([day, net]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].book, "net");
  assert.equal(rows[0].quantity, 6);
});

test("keeps one Net-preferred row for each distinct instrument and product", () => {
  const rows = netPositionsFromKitePayload([
    position({ quantity: 2, book: "day" }),
    position({ tradingsymbol: "AXISBANK", quantity: 4, book: "day" }),
    position({ quantity: 8, book: "net" }),
    position({ tradingsymbol: "AXISBANK", quantity: 7, book: "net" }),
    position({ product: "MIS", quantity: -3, book: "net" }),
  ]);
  assert.deepEqual(rows.map((row) => [row.tradingsymbol, row.product, row.quantity]), [
    ["ETERNAL", "CNC", 8],
    ["AXISBANK", "CNC", 7],
    ["ETERNAL", "MIS", -3],
  ]);
});
