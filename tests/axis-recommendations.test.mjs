import assert from "node:assert/strict";
import test from "node:test";
import { isAxisResearchMail } from "../scripts/axis-mail-filter.mjs";
import { extractAxisRecommendations, scopeThesisToCompany } from "../scripts/axis-recommendations.mjs";
import { extractAxisTargetAchievements, recommendationSymbol } from "../scripts/axis-recommendations.mjs";

test("CreditAccess Grameen resolves to its NSE ticker", () => {
  assert.equal(recommendationSymbol("CreditAccess Grameen"), "CREDITACC");
  assert.equal(recommendationSymbol("Credit Access Grameen"), "CREDITACC");
  assert.equal(recommendationSymbol("Manappuram Finance"), "MANAPPURAM");
});

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
  assert.equal(bySymbol.BANDHANBNK?.upside, "—");
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

test("Target Achieved Mail becomes closed-call evidence, not an active BUY", () => {
  const messages = [{
    source: "Axis Direct",
    time: "6 Aug, 12:39 PM",
    receivedAt: "2026-08-06T12:39:00+05:30",
    title: "Target Achieved: Cholamandalam - Axis Punch",
    summary: "The standing Cholamandalam Punch hit its target of Rs 1,945 and closed.",
  }];
  assert.equal(extractAxisRecommendations(messages).length, 0);
  const achieved = extractAxisTargetAchievements(messages);
  assert.equal(achieved.length, 1);
  assert.equal(achieved[0].symbol, "CHOLAFIN");
  assert.equal(achieved[0].call, "TARGET ACHIEVED");
  assert.equal(achieved[0].target, 1945);
  assert.equal(achieved[0].origin, "mail");
});

test("Target Achieved titles preserve hyphenated company names and NSE aliases", () => {
  const achieved = extractAxisTargetAchievements([
    {
      source: "Axis Direct",
      time: "18 Jun, 10:48 am",
      receivedAt: "2026-06-18T10:48:00+05:30",
      title: "Target Achieved: V-Mart Retail Ltd - Pick of the Week",
      summary: "V-Mart Retail Ltd reached the target price of Rs 790/share.",
    },
    {
      source: "Axis Direct",
      time: "14 May, 9:41 am",
      receivedAt: "2026-05-14T09:41:00+05:30",
      title: "Target Achieved: Mold-Tek Packaging Ltd - New Year Pick Call",
      summary: "Mold Tek Packaging Ltd reached the target price of Rs 670/share.",
    },
    {
      source: "Axis Direct",
      time: "7 Apr, 11:05 am",
      receivedAt: "2026-04-07T11:05:00+05:30",
      title: "Axis Punch - Target Achieved: Welspun Corp. Limited",
      summary: "Welspun Corp Limited reached the target price of Rs 875/share.",
    },
  ]);
  assert.deepEqual(achieved.map((item) => [item.symbol, item.target]), [
    ["VMART", 790],
    ["MOLDTKPAC", 670],
    ["WELCORP", 875],
  ]);
});

test("mergeAxisRecommendations prefers richer PDF calls and keeps category buckets", async () => {
  const { mergeAxisRecommendations } = await import("../scripts/axis-pdf-recommendations.mjs");
  const merged = mergeAxisRecommendations({
    pdfRecommendations: [
      { symbol: "BHARTIARTL", name: "Bharti Airtel", call: "BUY", target: 2530, cmp: 1978, horizon: "Result update", source: "Axis PDF", date: "6 Aug", dateKey: "2026-08-06", thesis: "Bharti Airtel: BUY", color: "#4c8fff", scores: [3, 3, 3, 3, 3, 3], bucket: "fundamental" },
      { symbol: "OBEROIRLTY", name: "Oberoi Realty", call: "TRADING BUY", target: 1985, cmp: 1807, horizon: "Axis Punch", source: "Axis PDF", date: "6 Aug", dateKey: "2026-08-06", thesis: "Oberoi Realty: TRADING BUY", color: "#42c878", scores: [3, 3, 3, 3, 3, 3], bucket: "trading" },
      { symbol: "FLUOROCHEM", name: "Gujarat Fluorochemicals", call: "TECHNICAL BUY", target: 5152, cmp: 4574, horizon: "Weekly technical setup", source: "Axis PDF", date: "25 Jul", dateKey: "2026-07-25", thesis: "FLUOROCHEM: TECHNICAL BUY", color: "#b38cff", scores: [3, 3, 3, 3, 3, 3], bucket: "technical" },
    ],
    mailRecommendations: [
      { symbol: "BHARTIARTL", name: "Bharti Airtel", call: "BUY", target: 2530, cmp: null, horizon: "Result update", source: "Axis Direct", date: "6 Aug", thesis: "Bharti Airtel: BUY", color: "#4c8fff", scores: [3, 3, 3, 3, 3, 3] },
    ],
  });
  const bySymbol = Object.fromEntries(merged.map((item) => [`${item.symbol}|${item.bucket}`, item]));
  assert.equal(bySymbol["BHARTIARTL|fundamental"]?.cmp, 1978);
  assert.equal(bySymbol["OBEROIRLTY|trading"]?.call, "TRADING BUY");
  assert.equal(bySymbol["FLUOROCHEM|technical"]?.call, "TECHNICAL BUY");
  assert.equal(merged.length, 3);
});

test("mergeAxisRecommendations collapses BUY vs TRADING BUY near-duplicates", async () => {
  const { mergeAxisRecommendations } = await import("../scripts/axis-pdf-recommendations.mjs");
  const merged = mergeAxisRecommendations({
    pdfRecommendations: [
      { symbol: "BHARTIARTL", name: "Bharti Airtel", call: "BUY", target: 2530, cmp: 1978, horizon: "Result update", source: "Axis PDF", date: "6 Aug", dateKey: "2026-08-06", thesis: "Bharti Airtel: BUY", color: "#4c8fff", scores: [3, 3, 3, 3, 3, 3], bucket: "fundamental" },
      { symbol: "BHARTIARTL", name: "Bharti Airtel", call: "TRADING BUY", target: 2530, cmp: 1964, horizon: "Axis Investment Picks", source: "Axis PDF", date: "6 Aug", dateKey: "2026-08-06", thesis: "Bharti Airtel: TRADING BUY", color: "#21b5c5", scores: [3, 3, 3, 3, 3, 3], bucket: "trading" },
      { symbol: "JSWENERGY", name: "JSW Energy", call: "BUY", target: 614, cmp: 500, horizon: "Axis Alpha", source: "Axis PDF", date: "11 Jun", dateKey: "2026-06-11", thesis: "JSW Energy: BUY", color: "#e3b844", scores: [3, 3, 3, 3, 3, 3], bucket: "fundamental" },
      { symbol: "JSWENERGY", name: "JSW Energy", call: "TRADING BUY", target: 630, cmp: 566, horizon: "Axis Investment Picks", source: "Axis PDF", date: "7 Aug", dateKey: "2026-08-07", thesis: "JSW Energy: TRADING BUY", color: "#e3b844", scores: [3, 3, 3, 3, 3, 3], bucket: "trading" },
    ],
  });
  const bharti = merged.filter((item) => item.symbol === "BHARTIARTL");
  assert.equal(bharti.length, 1);
  assert.equal(bharti[0].call, "TRADING BUY");
  assert.equal(bharti[0].bucket, "trading");

  const jsw = merged.filter((item) => item.symbol === "JSWENERGY");
  assert.equal(jsw.length, 2, "different target/date pairs stay distinct");
  assert.ok(jsw.some((item) => item.call === "TRADING BUY" && item.target === 630));
  assert.ok(jsw.some((item) => item.call === "BUY" && item.target === 614));
});

test("mergeHoldingTradingCalls does not duplicate live trading rows and collapses near-dups", async () => {
  const {
    mergeHoldingTradingCalls,
    dedupeAxisCallsBySymbol,
  } = await import("../app/axis-holding-trading-calls.ts");

  const live = [
    { symbol: "BHARTIARTL", name: "Bharti Airtel", call: "BUY", target: 2530, cmp: 1978, upside: "—", horizon: "Result update", source: "Axis PDF", date: "6 Aug", thesis: "Bharti Airtel: BUY", color: "#4c8fff", scores: [3, 3, 3, 3, 3, 3], dateKey: "2026-08-06", bucket: "fundamental", origin: "pdf" },
    { symbol: "BHARTIARTL", name: "Bharti Airtel", call: "TRADING BUY", target: 2530, cmp: 1960, upside: "—", horizon: "Axis Investment Picks", source: "Axis PDF", date: "7 Aug", thesis: "Bharti Airtel: TRADING BUY", color: "#21b5c5", scores: [3, 3, 3, 3, 3, 3], dateKey: "2026-08-07", bucket: "trading", origin: "pdf", evidenceFile: "Axis_MorningNote-2026-08-07.pdf" },
    { symbol: "JSWENERGY", name: "JSW Energy", call: "BUY", target: 614, cmp: 500, upside: "—", horizon: "Axis Alpha", source: "Axis PDF", date: "11 Jun", thesis: "JSW Energy: BUY", color: "#e3b844", scores: [3, 3, 3, 3, 3, 3], dateKey: "2026-06-11", bucket: "fundamental", origin: "pdf" },
    { symbol: "JSWENERGY", name: "JSW Energy", call: "TRADING BUY", target: 630, cmp: 566, upside: "—", horizon: "Axis Investment Picks", source: "Axis PDF", date: "7 Aug", thesis: "JSW Energy: TRADING BUY", color: "#e3b844", scores: [3, 3, 3, 3, 3, 3], dateKey: "2026-08-07", bucket: "trading", origin: "pdf", evidenceFile: "Axis_MorningNote-2026-08-07.pdf" },
    { symbol: "OBEROIRLTY", name: "Oberoi Realty", call: "TRADING BUY", target: 1985, cmp: 1807, upside: "—", horizon: "Axis Punch", source: "Axis PDF", date: "6 Aug", thesis: "Oberoi Realty: TRADING BUY", color: "#42c878", scores: [3, 3, 3, 3, 3, 3], dateKey: "2026-08-06", bucket: "trading", origin: "pdf" },
  ];

  const merged = mergeHoldingTradingCalls(live);
  const bharti = merged.filter((item) => item.symbol === "BHARTIARTL");
  assert.equal(bharti.length, 2, "different published dates stay distinct until matrix symbol dedupe");
  assert.equal(bharti.find((item) => item.bucket === "trading")?.dateKey, "2026-08-07", "newer live trading call must not be overwritten by hardcoded Aug-6 holding row");
  assert.equal(bharti.find((item) => item.bucket === "trading")?.evidenceFile, "Axis_MorningNote-2026-08-07.pdf");
  assert.equal(bharti.find((item) => item.bucket === "fundamental")?.call, "BUY");

  const jsw = merged.filter((item) => item.symbol === "JSWENERGY");
  assert.equal(jsw.length, 2);
  assert.equal(jsw.find((item) => item.bucket === "trading")?.dateKey, "2026-08-07");

  const matrix = dedupeAxisCallsBySymbol(merged);
  assert.equal(matrix.filter((item) => item.symbol === "BHARTIARTL").length, 1);
  assert.equal(matrix.filter((item) => item.symbol === "JSWENERGY").length, 1);
  assert.equal(matrix.find((item) => item.symbol === "BHARTIARTL")?.call, "TRADING BUY");
  assert.equal(matrix.find((item) => item.symbol === "JSWENERGY")?.call, "TRADING BUY");
  assert.equal(matrix.length, new Set(matrix.map((item) => item.symbol)).size);

  const sameDayNearDup = mergeHoldingTradingCalls([
    { symbol: "BHARTIARTL", name: "Bharti Airtel", call: "BUY", target: 2530, cmp: 1978, upside: "—", horizon: "Result update", source: "Axis PDF", date: "6 Aug", thesis: "Bharti Airtel: BUY", color: "#4c8fff", scores: [3, 3, 3, 3, 3, 3], dateKey: "2026-08-06", bucket: "fundamental", origin: "pdf" },
  ]);
  const injected = sameDayNearDup.filter((item) => item.symbol === "BHARTIARTL");
  assert.equal(injected.length, 1);
  assert.equal(injected[0].call, "TRADING BUY");
  assert.equal(injected[0].bucket, "trading");
});
