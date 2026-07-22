import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildEarningsSnapshot, earningsEventDateKey } from "../app/earnings-verify.ts";
import { earningsCalendar } from "../app/portfolio-data.ts";

test("earnings verification requires sources and flags overdue pending rows", () => {
  const verified = buildEarningsSnapshot([
    {
      date: "10 Jul",
      day: "10",
      symbol: "DEMO",
      name: "Demo Co",
      state: "Reported",
      portfolio: false,
      period: "Q1 FY27",
      reported: true,
      kpis: [
        { label: "PAT", value: "₹1 Cr", change: "+1%" },
        { label: "Revenue", value: "₹2 Cr", change: "+2%" },
      ],
      summary: "ok",
      source: "https://example.com/results",
    },
    {
      date: "30 Jul",
      day: "30",
      symbol: "FUTURE",
      name: "Future Co",
      state: "Pending",
      portfolio: false,
      period: "Q1 FY27",
      reported: false,
      kpis: [{ label: "PAT", value: "", change: "" }],
    },
  ], "2026-07-22");
  assert.equal(verified.status, "verified");

  const missingSource = buildEarningsSnapshot([
    {
      date: "10 Jul",
      day: "10",
      symbol: "NOSRC",
      name: "No Source",
      state: "Reported",
      portfolio: false,
      period: "Q1 FY27",
      reported: true,
      kpis: [{ label: "PAT", value: "₹1", change: "+1%" }],
    },
  ], "2026-07-22");
  assert.equal(missingSource.status, "stale");
  assert.match(missingSource.message, /NOSRC/);

  const overdue = buildEarningsSnapshot([
    {
      date: "20 Jul",
      day: "20",
      symbol: "LATE",
      name: "Late Co",
      state: "Pending",
      portfolio: false,
      period: "Q1 FY27",
      reported: false,
      kpis: [{ label: "PAT", value: "", change: "" }],
    },
  ], "2026-07-22");
  assert.equal(overdue.status, "verified");
  assert.match(overdue.message, /Overdue pending/);
  assert.match(overdue.message, /LATE/);
});

test("earningsEventDateKey parses calendar labels into IST keys", () => {
  assert.equal(earningsEventDateKey({
    date: "20 Jul", day: "20", symbol: "X", name: "X", state: "Pending", portfolio: false, period: "Q1", reported: false, kpis: [],
  }, "2026-07-22"), "2026-07-20");
});

test("earnings labels resolve company names instead of opaque CAL codes", async () => {
  const sectorsWorkspace = await readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8");
  const utils = await readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8");
  assert.doesNotMatch(sectorsWorkspace, /CAL-\$/);
  assert.doesNotMatch(sectorsWorkspace, /`CAL-/);
  assert.match(sectorsWorkspace, /resolveEarningsIdentity/);
  assert.match(sectorsWorkspace, /\{event\.name\}/);
  assert.match(sectorsWorkspace, /\{event\.symbol\}/);
  assert.match(sectorsWorkspace, /NSE · \{selected\.symbol\}/);
  assert.match(utils, /export function resolveEarningsIdentity/);
  assert.match(utils, /TVSMOTORS:\s*"TVSMOTOR"/);
  assert.match(utils, /Never invent opaque codes like CAL-1/);
});

test("live earnings calendar uses contractual verification rather than unconditional verified", async () => {
  const route = await readFile(new URL("../app/api/earnings/snapshot/route.ts", import.meta.url), "utf8");
  assert.match(route, /buildEarningsSnapshot/);
  assert.doesNotMatch(route, /status:\s*"verified"/);

  const snapshot = buildEarningsSnapshot(earningsCalendar, "2026-07-22");
  assert.ok(snapshot.status === "verified" || snapshot.status === "stale");
  if (snapshot.status === "stale") {
    assert.match(snapshot.message, /not fully verified|pending after scheduled/i);
  }
});

test("S-2 receives selectedSectorIds while S-3 and S-4 stay unfiltered", async () => {
  const sectorsWorkspace = await readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(sectorsWorkspace, /<SectoralAnalytics selectedIds=\{selectedSectorIds\} onToggle=\{onToggleSector\} market=\{sectorMarket\} marketsBySector=\{sectorMarketById\} holdings=\{holdings\}\/>/);
  assert.match(sectorsWorkspace, /<SectorIntelligenceDigest content=\{content\} mailWindow=\{mailWindow\}\/>/);
  assert.match(sectorsWorkspace, /<EarningsCalendarWorkbench snapshot=\{earningsSnapshot\} content=\{content\}\/>/);
  assert.match(sectorsWorkspace, /<SectorDecisionFramework\/>/);

  assert.doesNotMatch(sectorsWorkspace, /SectorIntelligenceDigest[^\n]*selectedSectorId/);
  assert.doesNotMatch(sectorsWorkspace, /EarningsCalendarWorkbench[^\n]*selectedSectorId/);
  assert.doesNotMatch(sectorsWorkspace, /function SectorIntelligenceDigest\(\{[^}]*selectedSectorId/);
  assert.doesNotMatch(sectorsWorkspace, /function EarningsCalendarWorkbench\(\{[^}]*selectedSectorId/);

  const s3Start = sectorsWorkspace.indexOf('number="S-3"');
  const s4Start = sectorsWorkspace.indexOf('number="S-4"');
  const s3Block = sectorsWorkspace.slice(s3Start, s4Start);
  const s4Block = sectorsWorkspace.slice(s4Start);
  assert.doesNotMatch(s3Block, /sector-dimmed/);
  assert.doesNotMatch(s4Block, /sector-dimmed/);
  assert.doesNotMatch(s3Block, /selectedSectorIds/);
  assert.doesNotMatch(s4Block, /selectedSectorIds/);

  assert.match(css, /sector-dimmed/);
  assert.doesNotMatch(css, /sector-intelligence-filter/);
});

test("health POST auth and kite partial status contracts are present", async () => {
  const flask = await readFile(new URL("../flask_gateway.py", import.meta.url), "utf8");
  const kite = await readFile(new URL("../app/kite-live-server.ts", import.meta.url), "utf8");
  const contentServer = await readFile(new URL("../scripts/content-digest-server.mjs", import.meta.url), "utf8");
  const refreshScript = await readFile(new URL("../scripts/refresh-dashboard-data.sh", import.meta.url), "utf8");

  assert.match(flask, /_authorized_health_post/);
  assert.match(flask, /PORTFOLIO_HEALTH_TOKEN/);
  assert.match(flask, /status_code.?401|401/);
  assert.match(kite, /status: unavailable\.length \? "partial" : "live"/);
  assert.match(contentServer, /Restored from local cache at process start/);
  assert.match(refreshScript, /force=1/);
  assert.match(refreshScript, /startup-audit\.json/);
});
