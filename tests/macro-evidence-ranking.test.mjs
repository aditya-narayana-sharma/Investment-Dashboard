import assert from "node:assert/strict";
import test from "node:test";
import {
  groundedSupportCount,
  isGroundedSpan,
  parseScenarioRanking,
  scenarioRankingCacheKey,
  scenarioRankingPrompt,
} from "../app/macro-evidence-ranking.ts";
import { assembleScenarioEvidence, stableItemKey } from "../app/macro-scenario-evidence.ts";

const oilFramework = {
  label: "Crude + geopolitics",
  evidence: "Import bill, INR and inflation are the principal India transmission channels.",
  sectors: "Support: telecom, domestic power",
  trigger: "Escalate controls if Brent remains above $90 for two weeks.",
  bands: {
    supportive: { label: "De-escalation", range: "Brent $70-75", summary: "Lower imported inflation.", action: "Stage additions." },
    base: { label: "Controlled conflict", range: "Brent $78-90", summary: "Elevated volatility.", action: "Stagger additions." },
    stress: { label: "Hormuz disruption", range: "Brent $100-120", summary: "Broad risk-off shock.", action: "Preserve liquidity." },
  },
};

const items = [
  {
    source: "Axis Research",
    time: "9:10 AM",
    receivedAt: "2026-08-25T03:40:00.000Z",
    title: "Crude eases as supply returns",
    summary: "Brent slipped to $72 a barrel after producers restored output, easing the import bill.",
    bullets: [],
  },
  {
    source: "Newsletter",
    time: "8:05 AM",
    receivedAt: "2026-08-25T02:35:00.000Z",
    title: "Hormuz shipping disrupted",
    summary: "Tanker traffic through Hormuz halted overnight and crude spiked toward $105 a barrel.",
    bullets: [],
  },
  {
    source: "Newsletter",
    time: "7:30 AM",
    receivedAt: "2026-08-25T02:00:00.000Z",
    title: "Oil markets in focus this quarter",
    summary: "A general look at crude oil demand patterns without a specific price call.",
    bullets: [],
  },
];

const [crudeEases, hormuz, generic] = items;

test("a grounding span must be verbatim and substantial", () => {
  assert.equal(isGroundedSpan("Brent slipped to $72 a barrel", crudeEases), true);
  assert.equal(isGroundedSpan("BRENT SLIPPED TO $72 A BARREL", crudeEases), true, "case must not matter");
  assert.equal(isGroundedSpan("oil", crudeEases), false, "a two-word span proves nothing");
  assert.equal(isGroundedSpan("Brent surged past $130 a barrel", crudeEases), false, "invented spans are rejected");
});

test("parseScenarioRanking keeps grounded verdicts and demotes ungrounded ones", () => {
  const index = parseScenarioRanking({
    rankings: [
      { itemKey: stableItemKey(crudeEases), band: "supportive", relevance: 0.9, groundingSpan: "Brent slipped to $72 a barrel" },
      { itemKey: stableItemKey(hormuz), band: "stress", relevance: 0.95, groundingSpan: "crude spiked toward $105 a barrel" },
      { itemKey: stableItemKey(generic), band: "base", relevance: 0.4, groundingSpan: "Brent held between $78 and $90" },
    ],
  }, items);

  assert.equal(index.get(stableItemKey(crudeEases)).band, "supportive");
  assert.equal(index.get(stableItemKey(hormuz)).band, "stress");
  assert.equal(index.get(stableItemKey(generic)).band, null, "an ungrounded band claim becomes context");
});

test("parseScenarioRanking ignores invented items and contradictory repeats", () => {
  const index = parseScenarioRanking({
    rankings: [
      { itemKey: "not|a|real|item", band: "stress", relevance: 1, groundingSpan: "Brent slipped to $72 a barrel" },
      { itemKey: stableItemKey(hormuz), band: "stress", relevance: 0.9, groundingSpan: "crude spiked toward $105 a barrel" },
      { itemKey: stableItemKey(hormuz), band: "supportive", relevance: 0.9, groundingSpan: "Tanker traffic through Hormuz halted overnight" },
    ],
  }, items);

  assert.equal(index.size, 1, "an unknown itemKey must never enter the index");
  assert.equal(index.get(stableItemKey(hormuz)).band, "stress", "the first verdict wins; no item spans two bands");
});

test("malformed or empty model output degrades to an empty index, not a throw", () => {
  assert.equal(parseScenarioRanking(null, items).size, 0);
  assert.equal(parseScenarioRanking({}, items).size, 0);
  assert.equal(parseScenarioRanking({ rankings: "nope" }, items).size, 0);
  assert.equal(parseScenarioRanking({ rankings: [null, 3, "x"] }, items).size, 0);
});

test("relevance is clamped into 0..1", () => {
  const index = parseScenarioRanking({
    rankings: [{ itemKey: stableItemKey(hormuz), band: "stress", relevance: 42, groundingSpan: "crude spiked toward $105 a barrel" }],
  }, items);
  assert.equal(index.get(stableItemKey(hormuz)).relevance, 1);
});

test("ranked bands present different range-support sets — the RC-5 regression", () => {
  const overrides = parseScenarioRanking({
    rankings: [
      { itemKey: stableItemKey(crudeEases), band: "supportive", relevance: 0.9, groundingSpan: "Brent slipped to $72 a barrel" },
      { itemKey: stableItemKey(hormuz), band: "stress", relevance: 0.95, groundingSpan: "crude spiked toward $105 a barrel" },
    ],
  }, items);

  const supportOf = (bandKey) => assembleScenarioEvidence(items, "oilWar", bandKey, oilFramework, overrides)
    .filter((card) => card.rangeSupport === "supports-range")
    .map((card) => card.title)
    .sort();

  const supportive = supportOf("supportive");
  const stress = supportOf("stress");
  const base = supportOf("base");

  assert.deepEqual(supportive, ["Crude eases as supply returns"]);
  assert.deepEqual(stress, ["Hormuz shipping disrupted"]);
  assert.deepEqual(base, [], "no item was grounded to the base range, so it claims none");

  // The defect being guarded: no title may be range-support in two bands.
  const all = [...supportive, ...stress, ...base];
  assert.equal(new Set(all).size, all.length, "an item supported more than one range");
});

test("omitting overrides preserves the existing regex behaviour exactly", () => {
  const withOverrides = assembleScenarioEvidence(items, "oilWar", "stress", oilFramework, new Map());
  const withoutOverrides = assembleScenarioEvidence(items, "oilWar", "stress", oilFramework);
  assert.deepEqual(
    withOverrides.map((card) => `${card.title}|${card.rangeSupport}`),
    withoutOverrides.map((card) => `${card.title}|${card.rangeSupport}`),
  );
});

test("groundedSupportCount reports real support, not framework padding", () => {
  const overrides = parseScenarioRanking({
    rankings: [
      { itemKey: stableItemKey(hormuz), band: "stress", relevance: 0.95, groundingSpan: "crude spiked toward $105 a barrel" },
    ],
  }, items);
  assert.equal(groundedSupportCount(items, "stress", overrides), 1);
  assert.equal(groundedSupportCount(items, "base", overrides), 0);

  const cards = assembleScenarioEvidence(items, "oilWar", "base", oilFramework, overrides);
  assert.ok(cards.length >= 4, "the panel still fills to the minimum");
  assert.equal(
    cards.filter((card) => card.rangeSupport === "supports-range").length,
    0,
    "but none of that padding is presented as range support",
  );
});

test("the cache key is stable across item order and separates models", () => {
  const a = scenarioRankingCacheKey(items, "oilWar", "claude");
  const b = scenarioRankingCacheKey([...items].reverse(), "oilWar", "claude");
  assert.equal(a, b, "reordering the same pool must hit the same cache entry");
  assert.notEqual(a, scenarioRankingCacheKey(items, "oilWar", "llama3"));
  assert.notEqual(a, scenarioRankingCacheKey(items, "rates", "claude"));
});

test("the prompt carries every candidate and all three bands, and nothing else", () => {
  const prompt = scenarioRankingPrompt(items, "oilWar", oilFramework);
  for (const item of items) assert.ok(prompt.includes(stableItemKey(item)), `missing ${item.title}`);
  for (const band of ["supportive", "base", "stress"]) assert.ok(prompt.includes(band));
  assert.ok(prompt.includes("Brent $100-120"));
});
