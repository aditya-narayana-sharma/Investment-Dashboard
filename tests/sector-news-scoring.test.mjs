import assert from "node:assert/strict";
import test from "node:test";
import {
  RECENCY_HALF_LIFE_DAYS,
  SOURCE_WEIGHTS,
  recencyWeight,
  scoreSentiment,
  sectorNewsComposite,
} from "../app/sector-news-scoring.ts";

test("sentiment carries a signed magnitude, not just a label", () => {
  const strong = scoreSentiment("Stock surges to a record high after an upgrade");
  assert.equal(strong.label, "Positive");
  assert.ok(strong.score > 0.5, `expected a strong score, got ${strong.score}`);
  assert.ok(strong.confidence > 0);

  const weak = scoreSentiment("Shares rise modestly");
  assert.equal(weak.label, "Positive");
  assert.ok(weak.score <= strong.score, "a milder headline must not outscore a stronger one");
});

test("contradictory cues collapse confidence rather than picking a side loudly", () => {
  const mixed = scoreSentiment("Shares rally but profit falls and guidance is cut");
  assert.ok(Math.abs(mixed.score) < 0.5, "a contradictory headline must land near zero");
  assert.ok(mixed.confidence < 0.3, `contradiction must be low confidence, got ${mixed.confidence}`);
});

test("hedged language reduces confidence without flipping direction", () => {
  const plain = scoreSentiment("Stock rallies on optimism");
  const hedged = scoreSentiment("Stock may rally on optimism");
  assert.equal(hedged.label, plain.label);
  assert.ok(hedged.confidence < plain.confidence, "a hedge must cost confidence");
});

test("an uninformative headline is zero-confidence neutral, not a soft positive", () => {
  const neutral = scoreSentiment("Company announces board meeting date");
  assert.deepEqual(neutral, { label: "Neutral", score: 0, confidence: 0 });
  assert.deepEqual(scoreSentiment(""), { label: "Neutral", score: 0, confidence: 0 });
  assert.deepEqual(scoreSentiment(null), { label: "Neutral", score: 0, confidence: 0 });
});

test("recency decays on a stated half-life and missing dates are discounted", () => {
  const now = Date.parse("2026-08-25T00:00:00Z");
  const today = recencyWeight("2026-08-25T00:00:00Z", now);
  const oneHalfLife = recencyWeight(new Date(now - RECENCY_HALF_LIFE_DAYS * 86400000).toISOString(), now);
  assert.ok(Math.abs(today - 1) < 1e-9);
  assert.ok(Math.abs(oneHalfLife - 0.5) < 1e-9, "one half-life must halve the weight");
  assert.equal(recencyWeight(null, now), 0.5, "an undated item is discounted, not dropped");
  assert.equal(recencyWeight("not-a-date", now), 0.5);
});

test("every configured vendor has a weight and aggregators rank below wires", () => {
  for (const id of ["economic_times", "financial_times", "bloomberg", "zerodha", "moneycontrol", "ndtv_profit"]) {
    assert.ok(typeof SOURCE_WEIGHTS[id] === "number", `${id} has no weight`);
  }
  assert.ok(SOURCE_WEIGHTS.moneycontrol < SOURCE_WEIGHTS.bloomberg,
    "a Google-News syndication must not outweigh a primary wire");
});

test("the composite is weighted and fully decomposed", () => {
  const now = Date.parse("2026-08-25T00:00:00Z");
  const items = [
    {
      id: "a", sourceId: "bloomberg", sourceLabel: "Bloomberg", title: "Pharma stocks surge to a record high",
      url: "", publishedAt: "2026-08-25T00:00:00Z", summary: "upgrade", sentiment: "Positive", sectorIds: ["pharma"],
    },
    {
      id: "b", sourceId: "moneycontrol", sourceLabel: "Moneycontrol", title: "Pharma shares slump on weak demand",
      url: "", publishedAt: "2026-08-25T00:00:00Z", summary: "downgrade", sentiment: "Negative", sectorIds: ["pharma"],
    },
    {
      id: "c", sourceId: "bloomberg", sourceLabel: "Bloomberg", title: "Banks rally",
      url: "", publishedAt: "2026-08-25T00:00:00Z", summary: "", sentiment: "Positive", sectorIds: ["banking"],
    },
  ];

  const pharma = sectorNewsComposite("pharma", items, now);
  assert.equal(pharma.itemCount, 2, "only pharma-tagged items count");
  assert.equal(pharma.contributors.length, 2, "the decomposition must list every contributor");
  assert.ok(pharma.weightTotal > 0);
  for (const contributor of pharma.contributors) {
    assert.ok(Math.abs(contributor.weight - contributor.confidence * contributor.recency * contributor.sourceWeight) < 1e-3,
      "each contributor weight must equal confidence x recency x sourceWeight");
  }
  // Contributors are ordered strongest-first so the UI can show the driver.
  assert.ok(pharma.contributors[0].weight >= pharma.contributors[1].weight);
});

test("a sector with no qualifying items scores null, never a fabricated zero", () => {
  const composite = sectorNewsComposite("power", [], Date.now());
  assert.equal(composite.score, null);
  assert.equal(composite.itemCount, 0);
  assert.deepEqual(composite.contributors, []);
});

test("zero-confidence items cannot drag a composite toward neutral", () => {
  const now = Date.parse("2026-08-25T00:00:00Z");
  const noise = Array.from({ length: 20 }, (_, index) => ({
    id: `n${index}`, sourceId: "bloomberg", sourceLabel: "Bloomberg",
    title: "Company announces board meeting date", url: "",
    publishedAt: "2026-08-25T00:00:00Z", summary: "", sentiment: "Neutral", sectorIds: ["it"],
  }));
  const signal = {
    id: "s", sourceId: "bloomberg", sourceLabel: "Bloomberg", title: "IT stocks surge to a record high",
    url: "", publishedAt: "2026-08-25T00:00:00Z", summary: "upgrade", sentiment: "Positive", sectorIds: ["it"],
  };

  const composite = sectorNewsComposite("it", [...noise, signal], now);
  assert.equal(composite.contributors.length, 1, "zero-confidence noise must not contribute");
  assert.ok(composite.score > 0.5, "20 uninformative headlines must not dilute one real signal");
  assert.equal(composite.itemCount, 21, "but they are still counted and disclosed");
});
