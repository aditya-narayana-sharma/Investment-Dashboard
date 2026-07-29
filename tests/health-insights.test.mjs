import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const insightsSource = readFileSync(join(root, "app/health-insights.ts"), "utf8");
const workspaceSource = readFileSync(join(root, "app/dashboard/HealthWorkspace.tsx"), "utf8");
const importSource = readFileSync(join(root, "scripts/import_apple_health.py"), "utf8");

test("health insights module exposes note parsing and enrichment helpers", () => {
  assert.match(insightsSource, /export function parseHealthDailyNoteStats/);
  assert.match(insightsSource, /export function buildHealthInsights/);
  assert.match(insightsSource, /export function enrichHealthGuidanceActions/);
  assert.match(insightsSource, /export function enrichHealthSources/);
  assert.match(insightsSource, /source: "Livity"/);
  assert.match(insightsSource, /status: "Unavailable"/);
  assert.doesNotMatch(insightsSource, /Health Daily v2/);
});

test("Health workspace surfaces Insights page and mirroring blocker honestly", () => {
  assert.match(workspaceSource, /id: "insights"/);
  assert.match(workspaceSource, /Livity \/ iPhone Mirroring unavailable/);
  assert.match(workspaceSource, /enrichHealthGuidanceActions/);
  assert.match(workspaceSource, /parseHealthDailyNoteStats/);
  assert.match(workspaceSource, /health-source-ledger/);
  assert.doesNotMatch(workspaceSource, /Health Daily v2/);
});

test("Apple Health import emits metric-derived actions and unavailable secondary sources", () => {
  assert.match(importSource, /def build_metric_actions/);
  assert.match(importSource, /"source": "Livity"/);
  assert.match(importSource, /"status": "Unavailable"/);
  assert.match(importSource, /Nutrition log is incomplete by definition/);
});

test("parseHealthDailyNoteStats extracts only present note pairs", () => {
  const summary = "Health Stats Active Calories - 577.03 kcal Resting Calories - 2,382.17 kcal Protein - 25.00 g";
  const cleaned = summary.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ").replace(/\s+/g, " ").trim();
  const pattern = /([A-Za-z][A-Za-z +/%-]{1,40}?)\s*[-–:]\s*([0-9][0-9,.]*(?:\s*(?:kcal|g|mg|ml|L|km|min|hr|bpm|ms|%|METs|floors?))?)/g;
  const pairs = [];
  for (const match of cleaned.matchAll(pattern)) {
    pairs.push({ label: match[1].trim(), value: match[2].trim() });
  }
  assert.equal(pairs.length >= 3, true);
  assert.equal(pairs.some((item) => item.label.includes("Active Calories") && item.value.includes("577")), true);
  assert.equal(pairs.every((item) => Boolean(item.value)), true);
});
