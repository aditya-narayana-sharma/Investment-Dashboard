import assert from "node:assert/strict";
import test from "node:test";
import { scenarioEvidenceItems, scenarioEvidenceSentence } from "../app/macro-scenario-evidence.ts";

const deescalation = {
  source: "Bloomberg",
  time: "10 Aug",
  title: "Diplomacy over escalation",
  summary: "President Donald Trump signaled he is prepared to let economic pressure on Iran build rather than launch fresh military strikes.",
};
const controlled = {
  source: "Groww Digest",
  time: "10 Aug",
  title: "Russian crude oil imports at record high",
  summary: "India's imports of Russian crude oil rose to a record high while supply remained available.",
};
const disruption = {
  source: "Axis Research",
  time: "11 Aug",
  title: "Hormuz disruption stress test",
  summary: "A Strait of Hormuz shipping disruption would create an oil supply shock and a broad risk-off move.",
};
const unrelated = {
  source: "CFO Journal",
  time: "11 Aug",
  title: "Chicken surplus squeezes poultry companies",
  summary: "Poultry oversupply is a commodity market dynamic.",
};

const candidates = [deescalation, controlled, disruption, unrelated];

test("oil scenarios use mutually exclusive evidence pools", () => {
  assert.deepEqual(scenarioEvidenceItems(candidates, "oilWar", "supportive").map((item) => item.source), ["Bloomberg"]);
  assert.deepEqual(scenarioEvidenceItems(candidates, "oilWar", "base").map((item) => item.source), ["Groww Digest"]);
  assert.deepEqual(scenarioEvidenceItems(candidates, "oilWar", "stress").map((item) => item.source), ["Axis Research"]);
});

test("scenario summaries extract only a sentence supporting the selected range", () => {
  assert.match(scenarioEvidenceSentence(deescalation, "oilWar", "supportive"), /economic pressure on Iran/);
  assert.match(scenarioEvidenceSentence(controlled, "oilWar", "base"), /imports of Russian crude oil/);
  assert.match(scenarioEvidenceSentence(disruption, "oilWar", "stress"), /Hormuz shipping disruption/);
  assert.equal(scenarioEvidenceSentence(unrelated, "oilWar", "base"), "");
});

test("a range with no direct support returns no evidence instead of borrowing another range", () => {
  assert.deepEqual(scenarioEvidenceItems([deescalation, controlled], "oilWar", "stress"), []);
});

test("one source item cannot appear in more than one range", () => {
  for (const item of candidates) {
    const memberships = ["supportive", "base", "stress"].filter((band) => scenarioEvidenceItems([item], "oilWar", band).length);
    assert.ok(memberships.length <= 1, `${item.title} appeared in ${memberships.join(", ")}`);
  }
});
