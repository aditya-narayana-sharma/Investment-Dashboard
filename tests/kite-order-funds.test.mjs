import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  INSUFFICIENT_BUY_FUNDS_MESSAGE,
  assertBuyOrderFunds,
  buyOrderFundsState,
  buyOrderRequiredFunds,
} from "../app/kite-order-funds.ts";

const MESSAGE = "Insufficient Funds - Add Funds to Place BUY orders";

test("BUY funds copy is exact and SELL never uses it", () => {
  assert.equal(INSUFFICIENT_BUY_FUNDS_MESSAGE, MESSAGE);

  const short = buyOrderFundsState({
    side: "BUY",
    quantity: 10,
    estimatedPrice: 100,
    equityMargin: 50.2,
    marginsKnown: true,
  });
  assert.equal(short.requiredFunds, 1000);
  assert.equal(short.insufficient, true);
  assert.equal(short.message, MESSAGE);

  const sell = buyOrderFundsState({
    side: "SELL",
    quantity: 10,
    estimatedPrice: 100,
    equityMargin: 0,
    marginsKnown: true,
  });
  assert.equal(sell.insufficient, false);
  assert.equal(sell.message, null);

  const funded = buyOrderFundsState({
    side: "BUY",
    quantity: 2,
    estimatedPrice: 100,
    equityMargin: 200,
    marginsKnown: true,
  });
  assert.equal(funded.insufficient, false);
  assert.equal(funded.message, null);
  assert.equal(funded.requiredFunds, 200);
});

test("unknown margin is not treated as zero and charges are added only when already computed", () => {
  const unknown = buyOrderFundsState({
    side: "BUY",
    quantity: 10,
    estimatedPrice: 100,
    equityMargin: 0,
    marginsKnown: false,
  });
  assert.equal(unknown.insufficient, false);
  assert.equal(unknown.message, null);

  const zeroMarginKnown = buyOrderFundsState({
    side: "BUY",
    quantity: 1,
    estimatedPrice: 10,
    equityMargin: 0,
    marginsKnown: true,
  });
  assert.equal(zeroMarginKnown.insufficient, true);
  assert.equal(zeroMarginKnown.message, MESSAGE);

  assert.equal(buyOrderRequiredFunds(2, 100), 200);
  assert.equal(buyOrderRequiredFunds(2, 100, 7.5), 207.5);
  assert.equal(buyOrderRequiredFunds(2, 100, 0), 200);
  assert.equal(buyOrderRequiredFunds(2, 0), 0);
  assert.equal(buyOrderRequiredFunds(0, 100), 0);

  const withCharges = buyOrderFundsState({
    side: "BUY",
    quantity: 1,
    estimatedPrice: 100,
    equityMargin: 105,
    marginsKnown: true,
    typicalCharges: 10,
  });
  assert.equal(withCharges.requiredFunds, 110);
  assert.equal(withCharges.insufficient, true);
  assert.equal(withCharges.message, MESSAGE);

  assert.throws(
    () => assertBuyOrderFunds({
      side: "BUY",
      quantity: 1,
      estimatedPrice: 500,
      equityMargin: 50.2,
      marginsKnown: true,
    }),
    { message: MESSAGE },
  );
  assert.doesNotThrow(() => assertBuyOrderFunds({
    side: "SELL",
    quantity: 1,
    estimatedPrice: 500,
    equityMargin: 0,
    marginsKnown: true,
  }));
});

test("order ticket and place_order path wire the BUY funds gate", () => {
  const ticket = readFileSync(new URL("../app/dashboard/KiteOrderTicket.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../app/kite-live-server.ts", import.meta.url), "utf8");
  const confirm = readFileSync(new URL("../app/dashboard/builder/TreeBrokerConfirm.tsx", import.meta.url), "utf8");

  assert.match(ticket, /INSUFFICIENT_BUY_FUNDS_MESSAGE/);
  assert.match(ticket, /buyOrderFundsState/);
  assert.match(ticket, /funds\.insufficient/);
  assert.doesNotMatch(ticket, /!funds\.(blocked|insufficient)/);
  assert.doesNotMatch(ticket, /kiteSessionLive && !funds/);
  assert.match(ticket, /kiteSessionLive && reviewed && confirmation/);
  assert.doesNotMatch(ticket, /side === "SELL"[\s\S]{0,80}INSUFFICIENT_BUY_FUNDS_MESSAGE/);
  assert.match(workspace, /equityMargin=\{portfolio\.equityMargin\}/);
  assert.match(workspace, /marginsKnown=\{isLive && !unavailable\.has\("margins"\)\}/);
  assert.match(server, /assertBuyOrderFunds/);
  assert.match(server, /resolveEquityMargin/);
  assert.match(server, /callKiteTool\("get_margins"\)/);
  assert.match(server, /order\.side === "BUY"/);
  assert.match(confirm, /INSUFFICIENT_BUY_FUNDS_MESSAGE/);
  assert.match(confirm, /treeBrokerFunds/);
  assert.match(confirm, /funds\.insufficient/);
  assert.doesNotMatch(confirm, /!funds\.(blocked|insufficient)/);
  assert.match(confirm, /reviewed && confirmation\.trim\(\)\.toUpperCase\(\) === expected/);
  assert.match(confirm, /case "order"/);
});
