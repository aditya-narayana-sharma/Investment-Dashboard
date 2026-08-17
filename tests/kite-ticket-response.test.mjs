import assert from "node:assert/strict";
import test from "node:test";
import { readKiteTicketResponse } from "../app/dashboard/kite-ticket-response.ts";

test("readKiteTicketResponse surfaces JSON broker messages", async () => {
  const response = new Response(JSON.stringify({ status: "failed", message: "Failed to place order: The market is closed" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
  const result = await readKiteTicketResponse(response, "Kite order");
  assert.equal(result.ok, false);
  assert.equal(result.message, "Failed to place order: The market is closed");
});

test("readKiteTicketResponse never collapses HTML or empty bodies to a bare failure", async () => {
  const html = new Response("<html><title>Gateway Timeout</title></html>", {
    status: 504,
    headers: { "content-type": "text/html" },
  });
  const htmlResult = await readKiteTicketResponse(html, "Kite order");
  assert.equal(htmlResult.ok, false);
  assert.match(htmlResult.message, /HTTP 504/);
  assert.match(htmlResult.message, /Gateway Timeout/);
  assert.doesNotMatch(htmlResult.message, /^Failed to place order$/);

  const empty = new Response("", { status: 401 });
  const emptyResult = await readKiteTicketResponse(empty, "Kite order");
  assert.match(emptyResult.message, /Kite session required/);
});
