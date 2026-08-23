import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dispatchSatyaEvent } from "../app/dashboard/satya-client.ts";
import { getGrowwSnapshot } from "../app/groww-live-server.ts";
import { licenseJwtConfigured, signLicenseJwt, verifyLicenseJwt, verifyRazorpayWebhook } from "../app/license-jwt.ts";
import { followUpRetrieveQuery, untrustedConversationBlock } from "../app/satya/chat.ts";
import { compileStreakScanner } from "../app/streak-export.ts";

test("Streak export compiles symbols and never places orders", () => {
  const exported = compileStreakScanner({
    treeVersion: "1",
    id: "streak-test",
    name: "Streak test",
    interval: "day",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    children: [{
      id: "reliance",
      kind: "asset",
      params: { symbol: "RELIANCE" },
      children: [],
    }],
  });
  assert.equal(exported.venue, "zerodha-streak");
  assert.equal(exported.placesOrders, false);
  assert.ok(exported.symbols.includes("RELIANCE"));
  assert.ok(exported.checklist.some((line) => /does not place unattended orders/i.test(line)));
});

test("Razorpay webhook HMAC accepts a matching signature and rejects a bad one", () => {
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = "stratji-webhook-secret-16";
  try {
    const body = "{\"email\":\"op@local\",\"tier\":\"ultra\"}";
    const good = createHmac("sha256", "stratji-webhook-secret-16").update(body).digest("hex");
    assert.equal(verifyRazorpayWebhook(body, good), true);
    assert.equal(verifyRazorpayWebhook(body, "deadbeef"), false);
  } finally {
    if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
  }
});

test("license JWT round-trip when LICENSE_JWT_SECRET is set", () => {
  const previous = process.env.LICENSE_JWT_SECRET;
  process.env.LICENSE_JWT_SECRET = "stratji-test-secret-16";
  try {
    assert.equal(licenseJwtConfigured(), true);
    const token = signLicenseJwt({
      sub: "operator@local",
      tier: "ultra",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    assert.ok(token);
    const claims = verifyLicenseJwt(token);
    assert.equal(claims?.tier, "ultra");
    assert.equal(claims?.sub, "operator@local");
  } finally {
    if (previous === undefined) delete process.env.LICENSE_JWT_SECRET;
    else process.env.LICENSE_JWT_SECRET = previous;
  }
});

test("Groww snapshot is unavailable without a token and does not invent holdings", async () => {
  const previous = process.env.GROWW_ACCESS_TOKEN;
  delete process.env.GROWW_ACCESS_TOKEN;
  try {
    const snapshot = await getGrowwSnapshot();
    assert.equal(snapshot.status, "unavailable");
    assert.deepEqual(snapshot.holdings, []);
    assert.match(snapshot.message, /unconfigured/i);
  } finally {
    if (previous === undefined) delete process.env.GROWW_ACCESS_TOKEN;
    else process.env.GROWW_ACCESS_TOKEN = previous;
  }
});

test("SSE done does not re-dispatch citations already streamed", () => {
  const seen = [];
  const citation = {
    family: "axis_research",
    title: "Result Update",
    date: "2026-08-19",
    sender: "Axis",
    excerpt: "PAT",
    messageUrl: "message://1",
  };
  const handlers = {
    onCitation: (item) => seen.push(item.title),
    onDone: () => undefined,
  };
  const assembled = { text: "ok" };
  dispatchSatyaEvent("citation", JSON.stringify(citation), handlers, assembled);
  dispatchSatyaEvent("done", JSON.stringify({ citations: [citation], sessionId: "s1" }), handlers, assembled);
  assert.deepEqual(seen, ["Result Update"]);
});

test("follow-up query keeps prior titles as hints, labeled untrusted in the prompt block", () => {
  const messages = [
    { role: "user", content: "What did Axis say about HDFC Bank?" },
    { role: "assistant", content: "HDFC Bank result update is in the passages." },
    { role: "user", content: "compare those two" },
  ];
  assert.match(followUpRetrieveQuery(messages), /HDFC Bank/);
  assert.match(followUpRetrieveQuery(messages), /compare those two/);
  assert.match(untrustedConversationBlock(messages), /UNTRUSTED/);
  assert.match(untrustedConversationBlock(messages), /assistant:/);
});

test("Next retrieve and app/satya never import osascript or ingest backfill", async () => {
  const [retrieve, search] = await Promise.all([
    readFile(new URL("../app/satya/retrieve.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/satya/search.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(retrieve, /osascript/);
  assert.doesNotMatch(search, /osascript/);
  assert.doesNotMatch(retrieve, /runSatyaBackfill/);
  assert.doesNotMatch(search, /runSatyaBackfill/);
});
