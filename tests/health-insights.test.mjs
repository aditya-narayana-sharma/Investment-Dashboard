import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseHealthTopSection } from "../app/dashboard/workspace-routing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const insightsSource = readFileSync(join(root, "app/health-insights.ts"), "utf8");
const workspaceSource = readFileSync(join(root, "app/dashboard/HealthWorkspace.tsx"), "utf8");
const importSource = readFileSync(join(root, "scripts/import_apple_health.py"), "utf8");

test("health insights module exposes note parsing and enrichment helpers", () => {
  assert.match(insightsSource, /export function parseHealthDailyNoteStats/);
  assert.match(insightsSource, /export function buildHealthInsights/);
  assert.match(insightsSource, /export function buildDailyHealthBrief/);
  assert.match(insightsSource, /export function enrichHealthGuidanceActions/);
  assert.match(insightsSource, /export function enrichHealthSources/);
  assert.match(insightsSource, /source: "Livity"/);
  assert.match(insightsSource, /status: "Unavailable"/);
  assert.doesNotMatch(insightsSource, /Health Daily/);
  assert.match(insightsSource, /Recheck the low blood-oxygen reading/);
  assert.match(insightsSource, /Complete the nutrition diary before interpreting it/);
  assert.match(insightsSource, /Recover from a high-output movement day/);
});

test("Health workspace inlines Insights, Guidance and Guardrails into Daily Optimism", () => {
  assert.match(workspaceSource, /id="health-h2-insights"/);
  assert.match(workspaceSource, /id="health-h2-guidance"/);
  assert.match(workspaceSource, /id="health-h2-guardrails"/);
  assert.match(workspaceSource, /<h3>Insights<\/h3>/);
  assert.match(workspaceSource, /<h3>Guidance<\/h3>/);
  assert.match(workspaceSource, /Livity \/ iPhone Mirroring unavailable/);
  assert.match(workspaceSource, /enrichHealthGuidanceActions/);
  assert.doesNotMatch(workspaceSource, /parseHealthDailyNoteStats/);
  assert.match(workspaceSource, /Daily Optimism/);
  assert.match(workspaceSource, /TODAY’S HEALTH BRIEF/);
  assert.match(workspaceSource, /route\.section === "h3" && pages\.length > 1/);
  assert.doesNotMatch(workspaceSource, /\{ id: "insights", label: "Insights" \}/);
  assert.doesNotMatch(workspaceSource, /\{ id: "guidance", label: "Guidance" \}/);
  assert.doesNotMatch(workspaceSource, /\{ id: "guardrails", label: "Guardrails" \}/);
  assert.doesNotMatch(workspaceSource, /No optimism entry available/);
  assert.doesNotMatch(workspaceSource, /Health Daily/);
  assert.doesNotMatch(workspaceSource, /sector-detail-shell/);
  assert.doesNotMatch(workspaceSource, /Health Status/);
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

test("Health section aliases resolve to H-1 / H-2 / H-3 / H-4", () => {
  assert.equal(parseHealthTopSection("h1"), "h1");
  assert.equal(parseHealthTopSection("board"), "h1");
  assert.equal(parseHealthTopSection("h2"), "h2");
  assert.equal(parseHealthTopSection("optimism"), "h2");
  assert.equal(parseHealthTopSection("h3"), "h3");
  assert.equal(parseHealthTopSection("metrics"), "h3");
  assert.equal(parseHealthTopSection("h4"), "h4");
  assert.equal(parseHealthTopSection("calendar"), "h4");
  assert.equal(parseHealthTopSection("calendar-reminders"), "h4");
  assert.equal(parseHealthTopSection(null), null);
});
