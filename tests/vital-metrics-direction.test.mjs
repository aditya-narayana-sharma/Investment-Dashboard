import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { healthCategories } from "../app/health-data.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const utilsSource = readFileSync(join(root, "app/dashboard/utils.ts"), "utf8");
const sharedUiSource = readFileSync(join(root, "app/dashboard/shared-ui.tsx"), "utf8");
const workspaceSource = readFileSync(join(root, "app/dashboard/HealthWorkspace.tsx"), "utf8");
const globalCss = readFileSync(join(root, "app/globals.css"), "utf8");

test("direction helpers and category accents are exported from utils", () => {
  assert.match(utilsSource, /export function healthMetricDirectionBucket/);
  assert.match(utilsSource, /export function groupHealthMetricsByDirection/);
  assert.match(utilsSource, /export function healthCategoryAccentClass/);
  assert.match(utilsSource, /HEALTH_DIRECTION_COLUMNS/);
  assert.match(utilsSource, /const seen = new Set<string>\(\)/);
  assert.match(utilsSource, /if \(seen.has\(identity\)\) return/);
  assert.match(utilsSource, /health-cat-heart/);
  assert.match(utilsSource, /health-cat-activity/);
  assert.match(utilsSource, /health-cat-nutrition/);
  assert.match(utilsSource, /health-cat-respiratory/);
  assert.match(utilsSource, /health-cat-sleep/);
  assert.match(utilsSource, /health-cat-mobility/);
  assert.match(utilsSource, /Body Measurements/);
  assert.match(utilsSource, /Hearing/);
});

test("Vital Metrics UI uses three collapsible direction rows with category colour classes", () => {
  assert.match(sharedUiSource, /health-direction-grid/);
  assert.match(sharedUiSource, /health-direction-row/);
  assert.match(sharedUiSource, /health-direction-header/);
  assert.match(sharedUiSource, /aria-expanded/);
  assert.match(sharedUiSource, /new Set\(\["moderate", "bad"\]\)/);
  assert.match(sharedUiSource, /groupHealthMetricsByDirection/);
  assert.match(sharedUiSource, /HEALTH_DIRECTION_COLUMNS/);
  assert.match(sharedUiSource, /health-kpi-category/);
  assert.match(sharedUiSource, /\{column\.title\}/);
  assert.match(sharedUiSource, /SparkFilament tone=\{filamentTone\} series=\{entry\.metric\.history\?\.\[averagePeriod\]\} unit=\{healthMetricUnit\(entry\.metric\.value\)\}/);
  assert.match(sharedUiSource, /function healthMetricUnit/);
  assert.match(sharedUiSource, /directionColumns\.unavailable/);
  assert.match(sharedUiSource, /average-unavailable/);
  assert.match(sharedUiSource, /shown under Context dependent/);
  assert.match(sharedUiSource, /Green row · favourable direction/);
  assert.doesNotMatch(sharedUiSource, /health-direction-column/);
  assert.doesNotMatch(sharedUiSource, /Green column · favourable direction/);
  assert.match(utilsSource, /title: "Favourable direction"/);
  assert.match(utilsSource, /title: "Context dependent"/);
  assert.match(utilsSource, /title: "Unfavourable direction"/);
  assert.doesNotMatch(utilsSource, /title: "Average unavailable"/);
  assert.doesNotMatch(sharedUiSource, /health-category-grid/);
  assert.doesNotMatch(sharedUiSource, /Grey column · average unavailable/);
  assert.match(globalCss, /\.health-direction-grid/);
  assert.match(globalCss, /\.health-direction-row/);
  assert.match(globalCss, /\.health-direction-header/);
  assert.match(globalCss, /grid-template-columns:repeat\(auto-fill,minmax\(168px,1fr\)\)/);
  assert.doesNotMatch(globalCss, /\.health-direction-grid \{ display:grid; grid-template-columns:repeat\(3/);
  assert.match(globalCss, /\.health-cat-heart/);
  assert.match(globalCss, /\.health-cat-activity/);
  assert.match(globalCss, /\.average-unavailable/);
  assert.doesNotMatch(globalCss, /\.direction-unavailable/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.health-kpi-tile/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.health-kpi-tile > b/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.health-direction-header/);
});

test("SparkFilament renders from per-metric history and has no hardcoded shared path", () => {
  const visualSource = readFileSync(join(root, "app/dashboard/visual-components.tsx"), "utf8");
  const overhaulCss = readFileSync(join(root, "app/visual-overhaul.css"), "utf8");
  assert.match(visualSource, /export function sparkFilamentPath/);
  assert.match(visualSource, /export function sparkFilamentPoints/);
  assert.match(visualSource, /export function SparkFilament/);
  assert.match(visualSource, /series\?: Array<\{ date: string; value: number \}>/);
  assert.match(visualSource, /spark-filament-label/);
  assert.match(visualSource, /onPointerMove/);
  assert.match(visualSource, /onPointerLeave/);
  assert.doesNotMatch(visualSource, /M0 8 Q8 2 16 7 T32 6 T48 5 T64 7/);
  assert.match(overhaulCss, /vo-filament-draw/);
  assert.match(overhaulCss, /spark-filament-label/);
  assert.match(readFileSync(join(root, "app/health-data.ts"), "utf8"), /history\?: Partial<Record<HealthAveragePeriod, HealthMetricHistoryPoint\[\]>>/);
  assert.match(readFileSync(join(root, "scripts/import_apple_health.py"), "utf8"), /def daily_history\(/);
  assert.match(readFileSync(join(root, "scripts/import_apple_health.py"), "utf8"), /"history": history/);
});

test("Health console is H-1 / Daily Optimism H-2 / Vital Metrics H-3 without H-4 or Health Status", () => {
  assert.match(workspaceSource, /HealthWorkspaceSection = "h2" \| "h3"/);
  assert.match(workspaceSource, /\{ id: "h2", label: "Daily Optimism" \}/);
  assert.match(workspaceSource, /\{ id: "h3", label: "Vital Metrics" \}/);
  assert.match(workspaceSource, /number="H-2" title="Daily Optimism"/);
  assert.match(workspaceSource, /number="H-3" title="Vital Metrics"/);
  assert.match(workspaceSource, /id="health-h3"/);
  assert.doesNotMatch(workspaceSource, /Health Status/);
  assert.doesNotMatch(workspaceSource, /Daily Guidance/);
  assert.doesNotMatch(workspaceSource, /number="H-4"/);
  assert.doesNotMatch(workspaceSource, /id="health-h4"/);
  assert.match(workspaceSource, /HealthIncognitoGate/);
  assert.match(workspaceSource, /<HealthMasonryGrid categories=\{healthSnapshot\.categories\}\/>/);
});

function classifyTone(label, direction) {
  if (direction === "same") return "moderate";
  const higher = new Set([
    "Active energy", "Exercise minutes", "Stand", "Stand time", "Steps", "Walking + running", "Stairs climbed",
    "Time asleep", "Deep sleep", "REM sleep", "Core sleep", "Cardio recovery", "Cardio fitness",
    "Walking speed", "Step length", "Protein", "Fibre", "Potassium", "Water", "HRV",
  ]);
  const lower = new Set([
    "Resting heart rate", "Walking asymmetry", "Double support", "Awake", "Sodium", "Sugar", "Saturated fat",
  ]);
  if (higher.has(label)) return direction === "up" ? "good" : "bad";
  if (lower.has(label)) return direction === "down" ? "good" : "bad";
  return "moderate";
}

function groupByDirection(categories, period) {
  const columns = { good: [], moderate: [], bad: [], unavailable: [] };
  const excluded = new Set(["Body Measurements", "Hearing", "Body measurements", "Medications", "Medication"]);
  const order = ["Activity", "Sleep", "Heart", "Respiratory", "Mindfulness", "Mobility", "Nutrition"];
  const ranked = categories
    .filter((category) => !excluded.has(category.name))
    .map((category, fallbackIndex) => {
      const orderIndex = order.indexOf(category.name);
      return { category, categoryIndex: orderIndex < 0 ? order.length + fallbackIndex : orderIndex };
    })
    .sort((left, right) => left.categoryIndex - right.categoryIndex || left.category.name.localeCompare(right.category.name));

  for (const { category } of ranked) {
    for (const metric of category.metrics) {
      const average = metric.averages?.[period];
      const bucket = !average ? "unavailable" : classifyTone(metric.label, average.direction);
      columns[bucket].push(`${category.name}::${metric.label}`);
    }
  }
  return columns;
}

test("fixture metrics assign once across direction rows; unavailable and favourable cases hold", () => {
  const weekly = groupByDirection(healthCategories, "weekly");
  const all = [...weekly.good, ...weekly.moderate, ...weekly.bad, ...weekly.unavailable];
  assert.equal(new Set(all).size, all.length, "each metric appears exactly once");

  const expectedTotal = healthCategories
    .filter((category) => !["Body Measurements", "Hearing"].includes(category.name))
    .reduce((sum, category) => sum + category.metrics.length, 0);
  assert.equal(all.length, expectedTotal);

  assert.ok(weekly.good.includes("Heart::Resting heart rate"));
  assert.ok(weekly.unavailable.includes("Activity::Physical effort"));
  assert.ok(weekly.moderate.includes("Heart::Heart rate") || weekly.moderate.includes("Heart::HRV"));

  assert.equal(
    healthCategories.some((category) => ["Body Measurements", "Hearing"].includes(category.name)),
    false,
  );
});

test("Incognito gate still wraps Vital Metrics console content", () => {
  const h3Block = workspaceSource.slice(
    workspaceSource.indexOf('id="health-h3"'),
    workspaceSource.indexOf("sector-detail-shell"),
  );
  assert.match(h3Block, /HealthIncognitoGate/);
  assert.match(h3Block, /HealthMasonryGrid/);
  assert.match(h3Block, /Vital metrics hidden by Incognito/);
});
