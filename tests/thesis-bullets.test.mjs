import assert from "node:assert/strict";
import test from "node:test";
import { thesisBullets, scopeThesisText } from "../app/thesis-bullets.ts";

test("thesisBullets marks tone and scopes mashups to the selected symbol", () => {
  const mashup = "Bandhan Bank Ltd: BUY, TP ₹235 · BUY recommendation on the stock · Indian Hotels Company Ltd: BUY, TP ₹830 · Bajaj Auto Ltd: BUY, TP ₹11,880";
  const bullets = thesisBullets(mashup, { symbol: "BANDHANBNK", name: "Bandhan Bank", call: "BUY", limit: 4 });
  assert.ok(bullets.length >= 1);
  assert.equal(bullets[0].marker, "✅");
  assert.ok(bullets.every((bullet) => !/Indian Hotels|Bajaj Auto/i.test(bullet.text)));
  assert.match(bullets.map((bullet) => bullet.text).join(" "), /Bandhan|BUY|235/i);

  const risk = thesisBullets("Execution and leverage are key risks.", { symbol: "JSWENERGY", call: "Buy" });
  assert.equal(risk[0].marker, "⚠️");

  const sell = thesisBullets("Downgrade to SELL on valuation break risk.", { symbol: "X", call: "SELL" });
  assert.equal(sell[0].marker, "⛔️");
});

test("scopeThesisText drops competing company lines", () => {
  const scoped = scopeThesisText(
    "Bandhan Bank Ltd: BUY, TP ₹235 · Indian Hotels Company Ltd: BUY, TP ₹830",
    { symbol: "BANDHANBNK", name: "Bandhan Bank" },
  );
  assert.match(scoped, /Bandhan Bank/i);
  assert.doesNotMatch(scoped, /Indian Hotels/i);
});
