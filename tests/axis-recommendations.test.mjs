import assert from "node:assert/strict";
import test from "node:test";
import { isAxisResearchMail } from "../scripts/axis-mail-filter.mjs";
import { extractAxisRecommendations, scopeThesisToCompany } from "../scripts/axis-recommendations.mjs";

test("Axis Research digest excludes OTP, security, webinar and marketing mail", () => {
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <research@axisdirect.in>", subject: "Q1FY27 Result Updates" }), true);
  assert.equal(isAxisResearchMail({ sender: "Axis Securities Research <equity@axissecurities.in>", subject: "Daily Technical Outlook" }), true);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <research@axisdirect.in>", subject: "Daily Morning Note & Trade Setup for the Day - July 22, 2026" }), true);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <service@axisdirect.in>", subject: "966526 is your access code to log in" }), false);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <service@axisdirect.in>", subject: "New device Security Alert!" }), false);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <research@axisdirect.in>", subject: "LIVE Webinar: Simplifying the World of Options Trading | Register Now" }), false);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <service@axisdirect.in>", subject: "Learn Account Offer Benefits" }), false);
});

test("extractAxisRecommendations scopes multi-company digests per symbol", () => {
  const recommendations = extractAxisRecommendations([
    {
      source: "Axis Direct",
      time: "22 Jul, 1:26 pm",
      title: "Q1FY27 Result Updates - July 22, 2026",
      summary: "Q1FY27 Result Updates Bandhan Bank Ltd: BUY, TP ₹235 · BUY recommendation on the stock. Read Report Indian Hotels Company Ltd: BUY, TP ₹830 · BUY Read Report Bajaj Auto Ltd: BUY, TP ₹11,880.",
    },
    {
      source: "Axis Direct",
      time: "20 Jul, 3:13 pm",
      title: "Axis Alpha: Global Health Ltd - BUY",
      summary: "We recommend a BUY on Global Health Ltd with a Target Price of Rs 1,460/share.",
    },
    {
      source: "Axis Direct",
      time: "22 Jul, 9:24 am",
      title: "Axis Alpha - Hit Stop Loss - Bandhan Bank Ltd",
      summary: "Call Closure - Axis Alpha Call We recommended Bandhan Bank Ltd as an Axis Alpha Call.",
    },
  ]);

  const bySymbol = Object.fromEntries(recommendations.map((item) => [item.symbol, item]));
  assert.equal(bySymbol.BANDHANBNK?.call, "BUY");
  assert.equal(bySymbol.BANDHANBNK?.target, 235);
  assert.match(bySymbol.BANDHANBNK.thesis, /Bandhan Bank/i);
  assert.doesNotMatch(bySymbol.BANDHANBNK.thesis, /Indian Hotels|Bajaj Auto/i);

  assert.equal(bySymbol.INDHOTEL?.call, "BUY");
  assert.equal(bySymbol.INDHOTEL?.target, 830);
  assert.doesNotMatch(bySymbol.INDHOTEL.thesis, /Bandhan Bank|Bajaj Auto/i);

  assert.equal(bySymbol["BAJAJ-AUTO"]?.call, "BUY");
  assert.equal(bySymbol["BAJAJ-AUTO"]?.target, 11880);
  assert.doesNotMatch(bySymbol["BAJAJ-AUTO"].thesis, /Bandhan Bank|Indian Hotels/i);

  assert.equal(bySymbol.MEDANTA?.call, "BUY");
  assert.equal(bySymbol.MEDANTA?.target, 1460);
  assert.match(bySymbol.INDHOTEL.thesis, /^Indian Hotels/i);
  assert.match(bySymbol["BAJAJ-AUTO"].thesis, /^Bajaj Auto/i);
});

test("scopeThesisToCompany keeps only the selected company fragment", () => {
  const mashup = "Bandhan Bank Ltd: BUY, TP ₹235 · BUY recommendation on the stock. Read Report Indian Hotels Company Ltd: BUY, TP ₹830 · BUY Read Report Bajaj Auto Ltd: BUY, TP ₹11,880.";
  const scoped = scopeThesisToCompany(mashup, "Bandhan Bank", { call: "BUY", target: 235 });
  assert.match(scoped, /Bandhan Bank/i);
  assert.doesNotMatch(scoped, /Indian Hotels|Bajaj Auto/i);
});
