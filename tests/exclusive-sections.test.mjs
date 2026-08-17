import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sidebar section clicks hide sibling workspace sections", async () => {
  const [sectors, investment, intelligence, health, css] = await Promise.all([
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const [source, label] of [
    [sectors, "SectorsWorkspace"],
    [investment, "InvestmentWorkspace"],
    [intelligence, "IntelligenceWorkspace"],
    [health, "HealthWorkspace"],
  ]) {
    assert.doesNotMatch(source, /scrollIntoView/, `${label} must not scroll stacked sections into view`);
    assert.match(source, /exclusive-section-workspace/, `${label} must use exclusive section chrome`);
  }

  assert.match(sectors, /hidden=\{activeSection !== "s2"\}/);
  assert.match(investment, /hidden=\{activeSection !== "i2"\}/);
  assert.match(intelligence, /hidden=\{activeSection !== "m2"\}/);
  assert.match(health, /hidden=\{activeTopSection !== "h2"\}/);
  assert.match(css, /display:none !important/);
  assert.doesNotMatch(css, /\.sector-workspace-shell\.sector-full-workspace\s*\{[^}]*overflow:visible;/s);
});
