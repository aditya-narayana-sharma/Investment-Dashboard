import assert from "node:assert/strict";
import test from "node:test";
import {
  axisCategoryAskPrompt,
  defaultSatyaSuggestions,
  isSatyaCorpusSuggestionPrompt,
  NEVER_INVENT_CMP,
  satyaSuggestionsForWorkspace,
} from "../app/dashboard/satya-suggestions.ts";
import { classifySatyaRefusal } from "../app/satya/chat.ts";

const WORKSPACES = ["investment", "sectors", "intelligence", "health", "builder", "strategies"];

function assertCatalogLegal(catalog, extras = []) {
  for (const item of catalog.suggestions) {
    assert.equal(classifySatyaRefusal(item.prompt), null, `${catalog.workspace}:${item.id} must be Satya-legal`);
    assert.ok(item.label.trim(), `${item.id} needs a label`);
    const grounded = /retriev|axis|newsletter|podcast|earnings|unpublished|passages/i.test(item.prompt);
    assert.ok(grounded, `${item.id} should stay corpus-grounded`);
  }
  for (const prompt of extras) {
    assert.equal(classifySatyaRefusal(prompt), null, `extra prompt must be Satya-legal: ${prompt}`);
  }
}

test("each workspace has its own Satya Smart Suggestion catalog", () => {
  const catalogs = Object.fromEntries(WORKSPACES.map((workspace) => [workspace, satyaSuggestionsForWorkspace(workspace)]));

  assert.deepEqual(catalogs.investment.suggestions.map((item) => item.id).sort(), [
    "axis-picks-vs-holdings",
    "i1-research-actions",
    "i2-portfolio-research",
    "i3-risk-notes",
    "i4-axis-picks",
  ].sort());
  assert.match(catalogs.investment.suggestions[0].label, /I-1|research/i);
  assert.ok(catalogs.investment.suggestions.every((item) => /Investment|Axis picks|portfolio|I-[1-4]/i.test(item.label + item.prompt)));
  assert.equal(catalogs.investment.suggestions.some((item) => /HealthKit|Daily Optimism|StrategyTree|overnight newsletter/i.test(item.prompt)), false);

  assert.ok(catalogs.sectors.suggestions.every((item) => /S-2|industry|constituent|Decision Framework|rank/i.test(item.label + item.prompt)));
  assert.equal(catalogs.sectors.suggestions.some((item) => /overnight newsletter|I-1 ticket|HealthKit|canvas tree/i.test(item.prompt)), false);

  assert.ok(catalogs.intelligence.suggestions.some((item) => item.label === "Overnight newsletter themes"));
  assert.ok(catalogs.intelligence.suggestions.some((item) => item.label === "Verified earnings prints"));
  assert.equal(catalogs.intelligence.suggestions.some((item) => /sector-dimm|HealthKit|StrategyTree|Decision Framework/i.test(item.prompt)), false);

  assert.ok(catalogs.health.suggestions.every((item) => /H-[1-4]|My Feed|Daily Optimism|Calendar \+ Reminders/i.test(item.label)));
  assert.equal(catalogs.health.suggestions.some((item) => /heart rate|sleep score|HealthKit|vital/i.test(item.prompt)), false);
  assert.equal(catalogs.health.suggestions.some((item) => /I-1|StrategyTree|overnight newsletter themes/i.test(item.prompt)), false);

  assert.ok(catalogs.builder.note);
  assert.match(catalogs.builder.note, /will not draft or summarize canvas trees/i);
  assert.equal(catalogs.builder.suggestions.some((item) => /algorithm canvas|strategy tree|summarize my tree/i.test(item.prompt)), false);

  assert.ok(catalogs.strategies.suggestions.every((item) => /library|Y-2|quality|momentum|sleeve/i.test(item.label + item.prompt)));
  assert.equal(catalogs.strategies.suggestions.some((item) => /algorithm canvas|strategy tree|StrategyTreeV1/i.test(item.prompt)), false);

  for (const workspace of WORKSPACES) {
    assertCatalogLegal(catalogs[workspace]);
  }
});

test("section flavor stays inside the same workspace catalog", () => {
  const investmentRisk = satyaSuggestionsForWorkspace("investment", { section: "i3" });
  assert.equal(investmentRisk.suggestions[0].id, "i3-risk-notes");
  assert.equal(investmentRisk.workspace, "investment");

  const sectorsFramework = satyaSuggestionsForWorkspace("sectors", { section: "s3", subject: "IT Services" });
  assert.equal(sectorsFramework.suggestions[0].id, "framework-watch-notes");
  assert.match(sectorsFramework.suggestions[0].prompt, /IT Services/);
  assert.equal(sectorsFramework.suggestions.some((item) => /overnight newsletter/i.test(item.prompt)), false);

  const intelligenceEarnings = satyaSuggestionsForWorkspace("intelligence", { section: "m3" });
  assert.equal(intelligenceEarnings.suggestions[0].id, "verified-week");
  assert.ok(intelligenceEarnings.suggestions.some((item) => item.label === "Overnight newsletter themes"));

  const healthCalendar = satyaSuggestionsForWorkspace("health", { section: "h4" });
  assert.equal(healthCalendar.suggestions[0].id, "h4-calendar-research");
});

test("workspace catalogs and Axis category asks never trip Satya refusals", () => {
  const axisAsk = axisCategoryAskPrompt("Result Updates");
  assert.equal(classifySatyaRefusal(axisAsk), null);
  assert.equal(classifySatyaRefusal("what was my heart rate and sleep score?"), "health");
  assert.equal(classifySatyaRefusal("draft a strategy tree on algorithm canvas"), "builder");

  for (const workspace of WORKSPACES) {
    const catalog = satyaSuggestionsForWorkspace(workspace, { subject: "Banks" });
    assertCatalogLegal(catalog, [axisAsk]);
    for (const item of catalog.suggestions) {
      assert.equal(isSatyaCorpusSuggestionPrompt(item.prompt, catalog), true);
    }
    assert.equal(isSatyaCorpusSuggestionPrompt(axisAsk, catalog), true);
    assert.equal(isSatyaCorpusSuggestionPrompt("Draft a StrategyTreeV1 core-satellite", catalog), false);
  }
});

test("workspace catalogs do not leak foreign workspace language", () => {
  const sectors = satyaSuggestionsForWorkspace("sectors").suggestions.map((item) => `${item.label} ${item.prompt}`).join("\n");
  assert.doesNotMatch(sectors, /Overnight newsletter themes|I-1 research|HealthKit|StrategyTreeV1|Composer trees/);

  const intelligence = satyaSuggestionsForWorkspace("intelligence").suggestions.map((item) => `${item.label} ${item.prompt}`).join("\n");
  assert.doesNotMatch(intelligence, /Decision Framework|S-2 industry|Daily Optimism|StrategyTreeV1|I-3 risk/);

  const health = satyaSuggestionsForWorkspace("health").suggestions.map((item) => `${item.label} ${item.prompt}`).join("\n");
  assert.doesNotMatch(health, /Axis picks|StrategyTreeV1|overnight newsletter themes|Nifty 50/);

  const builder = satyaSuggestionsForWorkspace("builder").suggestions.map((item) => `${item.label} ${item.prompt}`).join("\n");
  assert.doesNotMatch(builder, /Daily Optimism|overnight newsletter|I-1 research|HealthKit/);

  const strategies = satyaSuggestionsForWorkspace("strategies").suggestions.map((item) => `${item.label} ${item.prompt}`).join("\n");
  assert.doesNotMatch(strategies, /Daily Optimism|HealthKit|I-1 research|overnight newsletter themes/);
});

test("assist-slot defaults reuse the workspace catalog and one CMP wording", () => {
  const ids = (items) => items.map((item) => item.id);
  assert.deepEqual(ids(defaultSatyaSuggestions("composite")), ids(satyaSuggestionsForWorkspace("investment", { section: "i4" }).suggestions));
  assert.deepEqual(ids(defaultSatyaSuggestions("industry")), ids(satyaSuggestionsForWorkspace("sectors", { section: "s2" }).suggestions));
  assert.deepEqual(ids(defaultSatyaSuggestions("framework")), ids(satyaSuggestionsForWorkspace("sectors", { section: "s3" }).suggestions));
  assert.deepEqual(ids(defaultSatyaSuggestions("satya")), ids(satyaSuggestionsForWorkspace("intelligence").suggestions));
  assert.deepEqual(ids(defaultSatyaSuggestions("builder")), ids(satyaSuggestionsForWorkspace("builder").suggestions));
  assert.deepEqual(ids(defaultSatyaSuggestions("strategy")), ids(satyaSuggestionsForWorkspace("strategies").suggestions));
  assert.match(NEVER_INVENT_CMP, /Never invent CMP/);
  assert.ok((satyaSuggestionsForWorkspace("investment", { section: "i4" }).suggestions.find((item) => item.id === "i4-axis-picks")?.prompt ?? "").includes(NEVER_INVENT_CMP));
  assert.doesNotMatch(satyaSuggestionsForWorkspace("sectors").suggestions.map((item) => item.prompt).join("\n"), /overnight newsletter|M-2|M-3/);
});
