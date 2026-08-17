import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseWorkspaceView } from "../app/dashboard/workspace-routing.ts";
import { growBrokerAdapter, kiteBrokerAdapter, resolveBrokerAdapter } from "../app/integrations/broker/index.ts";
import { parseHoldingsCsv } from "../app/integrations/broker/csv.ts";
import { DEFAULT_INTEGRATIONS_CONFIG } from "../app/integrations/defaults.ts";
import { RESEARCH_CATALOG, researchProviderStatus } from "../app/integrations/research/index.ts";
import { parseIntegrationsConfig } from "../app/integrations/schema.ts";
import { testNotesAdapter } from "../app/integrations/notes/index.ts";
import { loadIntegrationsConfig, mailSourceSelectors, normalizeIntegrationsConfig } from "../scripts/integrations-config.mjs";

test("default integrations config matches today's hardcoded Apple and Kite sources", () => {
  const parsed = parseIntegrationsConfig({});
  assert.equal(parsed.broker.id, "kite");
  assert.deepEqual(parsed.newsletters, [{ account: "iCloud", mailbox: "Newsletters" }]);
  assert.equal(parsed.research[0]?.mailbox, "Axis Research");
  assert.deepEqual(parsed.reminders.lists, ["Job 🔍", "Earnings"]);
  assert.equal(parsed.calendars.earningsName, "Earnings");
  assert.equal(parsed.sectors.length, 11);
  assert.equal(parsed.googleTasks.enabled, false);
});

test("fixture config drives mailbox, reminder, and calendar selectors", () => {
  const fixture = parseIntegrationsConfig({
    newsletters: [{ account: "Work", mailbox: "Alpha Mail" }],
    research: [{ id: "hdfc", label: "HDFC", account: "Work", mailbox: "HDFC Research", pdfDir: "~/Downloads/HDFC", enabled: true }],
    reminders: { lists: ["Hiring", "Results"] },
    calendars: { earningsName: "Results" },
  });
  const dir = mkdtempSync(join(tmpdir(), "stratji-int-"));
  const path = join(dir, "integrations.json");
  writeFileSync(path, JSON.stringify(fixture));
  const previous = process.env.INTEGRATIONS_CONFIG_PATH;
  process.env.INTEGRATIONS_CONFIG_PATH = path;
  try {
    const loaded = loadIntegrationsConfig();
    const selectors = mailSourceSelectors(loaded);
    assert.equal(selectors.newsletterAccount, "Work");
    assert.equal(selectors.newsletterMailbox, "Alpha Mail");
    assert.equal(selectors.axisMailbox, "HDFC Research");
    assert.deepEqual(selectors.reminderLists, ["Hiring", "Results"]);
    assert.equal(selectors.earningsCalendarName, "Results");
  } finally {
    if (previous === undefined) delete process.env.INTEGRATIONS_CONFIG_PATH;
    else process.env.INTEGRATIONS_CONFIG_PATH = previous;
  }
});

test("invalid mailbox mapping stays unavailable without inventing a live source", () => {
  const normalized = normalizeIntegrationsConfig({ newsletters: [{ account: "Missing", mailbox: "No Such Box" }] });
  assert.equal(normalized.newsletters[0].mailbox, "No Such Box");
  assert.notEqual(normalized.newsletters[0].mailbox, "Newsletters");
});

test("Kite adapter is live; Grow is unavailable; CSV parse is cached-only", () => {
  assert.equal(resolveBrokerAdapter("kite").id, "kite");
  assert.equal(kiteBrokerAdapter.snapshotStatus, "live");
  assert.equal(kiteBrokerAdapter.orderPath, "/api/kite/order");
  assert.equal(growBrokerAdapter.snapshotStatus, "unavailable");
  assert.equal(growBrokerAdapter.orderPath, "");
  const rows = parseHoldingsCsv("symbol,qty,avg\nINFY,10,1500\n");
  assert.equal(rows[0]?.symbol, "INFY");
  assert.equal(rows[0]?.quantity, 10);
});

test("research catalog does not scrape paywalls and Axis stays live by default", () => {
  assert.ok(RESEARCH_CATALOG.some((row) => row.id === "et-prime"));
  assert.equal(researchProviderStatus(DEFAULT_INTEGRATIONS_CONFIG.research[0], RESEARCH_CATALOG[0]), "live");
  assert.equal(researchProviderStatus(undefined, RESEARCH_CATALOG.find((row) => row.id === "hdfc")), "unconfigured");
});

test("notes adapters refuse unconfigured Notion/OneNote/Google Tasks", () => {
  const config = parseIntegrationsConfig({});
  assert.equal(testNotesAdapter("notes:notion", config).status, "unconfigured");
  assert.equal(testNotesAdapter("notes:onenote", config).status, "unavailable");
  assert.equal(testNotesAdapter("tasks:google", config).status, "unavailable");
  assert.equal(testNotesAdapter("notes:apple", config).status, "unconfigured");
});

test("integrations view alias settings does not rename investment", () => {
  assert.equal(parseWorkspaceView("integrations"), "integrations");
  assert.equal(parseWorkspaceView("settings"), "integrations");
  assert.equal(parseWorkspaceView("investment"), "investment");
  assert.equal(parseWorkspaceView("portfolio-overview"), "investment");
});

test("rejected kits stay out of app runtime sources", async () => {
  const { readFile } = await import("node:fs/promises");
  const sources = await Promise.all([
    readFile(new URL("../app/dashboard/IntegrationsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/mac/PortfolioIntelligenceMacApp.swift", import.meta.url), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /ARKit|DriverKit|HomeKit|LiveKit/);
  }
});
