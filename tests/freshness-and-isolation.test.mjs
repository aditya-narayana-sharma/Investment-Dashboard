import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildEarningsSnapshot, earningsEventDateKey } from "../app/earnings-verify.ts";
import { kiteAuthPresentation } from "../app/kite-auth-presentation.ts";
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
  const intelligenceWorkspace = await readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8");
  const utils = await readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8");
  assert.doesNotMatch(sectorsWorkspace, /CAL-\$/);
  assert.doesNotMatch(sectorsWorkspace, /`CAL-/);
  assert.doesNotMatch(intelligenceWorkspace, /CAL-\$/);
  assert.doesNotMatch(intelligenceWorkspace, /`CAL-/);
  assert.match(utils, /resolveEarningsIdentity/);
  assert.match(utils, /mergeEarningsCalendarEvents/);
  assert.match(intelligenceWorkspace, /mergeEarningsCalendarEvents/);
  assert.match(intelligenceWorkspace, /EarningsMonthCalendar/);
  assert.doesNotMatch(sectorsWorkspace, /EarningsMonthCalendar|EarningsCalendar/);
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

test("tracked earnings are source-verified through the completed 2026-08-13 IST day", () => {
  const snapshot = buildEarningsSnapshot(earningsCalendar, "2026-08-13");
  const irfc = snapshot.events.find((event) => event.symbol === "IRFC");
  const augustPending = snapshot.events.filter((event) => !event.reported && (event.dateKey ?? "").startsWith("2026-08"));
  assert.equal(snapshot.status, "verified");
  assert.equal(snapshot.analysisDate, "2026-08-13");
  assert.equal(snapshot.events.filter((event) => event.reported).length, 33);
  assert.equal(augustPending.length, 0);
  assert.ok(augustPending.every((event) => event.kpis.every((kpi) => !kpi.value.trim())));
  assert.equal(irfc?.reported, true);
  assert.match(irfc?.source ?? "", /^https:\/\/irfc\.co\.in\/investors\/financial-information/);
  assert.ok(irfc?.kpis.every((kpi) => kpi.value.trim()));
});

test("dashboard refresh verifies earnings through latest completed IST day, not the in-progress day", async () => {
  const route = await readFile(new URL("../app/api/dashboard/refresh/route.ts", import.meta.url), "utf8");
  assert.match(route, /latestCompletedIstDateKey/);
  assert.match(route, /buildEarningsSnapshot\(earningsCalendar, earningsThrough\)/);
  assert.match(route, /through \$\{earningsThrough\}/);
  assert.doesNotMatch(route, /buildEarningsSnapshot\(earningsCalendar, istDate\(\)\)/);
});

test("S-2 stays local while exclusive Market Intelligence M-3 earnings remains unfiltered", async () => {
  const sectorsWorkspace = await readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8");
  const intelligenceWorkspace = await readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(sectorsWorkspace, /<SectoralAnalytics selectedIds=\{selectedSectorIds\} onToggle=\{onToggleSector\} market=\{sectorMarket\} marketsBySector=\{sectorMarketById\} news=\{sectorNews\} holdings=\{holdings\} page=\{activePages\.s2 as SectorAnalyticsPage\}\/>/);
  assert.match(sectorsWorkspace, /aggregateSectorMarketStatus/);
  assert.doesNotMatch(sectorsWorkspace, /intelligence-crosslink/);
  assert.doesNotMatch(sectorsWorkspace, /onOpenIntelligence/);
  assert.doesNotMatch(sectorsWorkspace, /S-4|s4|Earnings|EarningsMonthCalendar/);
  assert.doesNotMatch(sectorsWorkspace, /<SectorIntelligenceDigest/);
  assert.match(intelligenceWorkspace, /function SectorIntelligenceDigest/);
  assert.match(intelligenceWorkspace, /function MarketEarningsCalendar/);
  assert.match(intelligenceWorkspace, /mergeEarningsCalendarEvents/);
  assert.match(intelligenceWorkspace, /data-earnings-owner="m3"/);
  assert.doesNotMatch(intelligenceWorkspace, /calendar-earnings-feed/);
  assert.match(intelligenceWorkspace, /EarningsMonthCalendar/);
  assert.match(intelligenceWorkspace, /number="M-1" title="Action Board"/);
  assert.match(intelligenceWorkspace, /number="M-2" title="Live Intelligence"/);
  assert.match(intelligenceWorkspace, /number="M-3" title="Earnings Calendar"/);
  assert.match(intelligenceWorkspace, /number="M-4" title="Calendar \+ Reminders"/);
  assert.match(intelligenceWorkspace, /workspace="intelligence"/);
  assert.match(sectorsWorkspace, /<SectorDecisionLab[\s\S]*page=\{activePages\.s3 as SectorDecisionPage\}[\s\S]*benchmarks=\{benchmarks\}[\s\S]*marketsBySector=\{sectorMarketById\}[\s\S]*\/>/);
  assert.doesNotMatch(intelligenceWorkspace, /showAllEarnings/);
  assert.doesNotMatch(sectorsWorkspace, /earnings-rail/);

  assert.doesNotMatch(intelligenceWorkspace, /SectorIntelligenceDigest[^\n]*selectedSectorId/);
  assert.doesNotMatch(intelligenceWorkspace, /function SectorIntelligenceDigest\(\{[^}]*selectedSectorId/);
  assert.doesNotMatch(sectorsWorkspace, /sector-dimmed/);
  assert.doesNotMatch(sectorsWorkspace, /sector-intelligence-filter/);
  assert.doesNotMatch(intelligenceWorkspace, /sector-dimmed/);
  assert.doesNotMatch(intelligenceWorkspace, /sector-intelligence-filter/);
  assert.doesNotMatch(intelligenceWorkspace, /selectedSectorId/);

  assert.match(page, /IntelligenceWorkspace/);
  assert.match(page, /workspace === "intelligence"/);
  assert.match(page, /value === "market-intelligence"/);
  assert.doesNotMatch(page, /<IntelligenceWorkspace[\s\S]*selectedSector/);
  assert.doesNotMatch(page, /onOpenIntelligence/);

  const m3Render = intelligenceWorkspace.split("\n").find((line) => line.includes("data-earnings-owner=\"m3\""));
  assert.ok(m3Render);
  assert.doesNotMatch(m3Render, /sector-dimmed|aria-disabled|selectedSectorIds/);

  assert.match(css, /sector-dimmed/);
  assert.doesNotMatch(css, /sector-intelligence-filter/);
  assert.doesNotMatch(css, /intelligence-crosslink/);
});

test("valid Kite auth with a non-auth subsource failure never offers re-authentication", () => {
  assert.deepEqual(kiteAuthPresentation({
    status: "partial",
    authStatus: "authenticated",
    unavailableSections: ["margins"],
    // Simulate stale fields from an older response after a successful login.
    authUrl: "https://example.invalid/stale-login",
    reauthSuggested: true,
  }), {
    control: "partial",
    showAuthAction: false,
  });

  assert.deepEqual(kiteAuthPresentation({
    status: "unavailable",
    authStatus: "unavailable",
  }), {
    control: "unavailable",
    showAuthAction: false,
  });
});

test("explicit invalid Kite auth still offers authentication", () => {
  assert.deepEqual(kiteAuthPresentation({
    status: "auth_required",
    authStatus: "expired",
    authUrl: "https://example.invalid/login",
  }), {
    control: "authenticate",
    showAuthAction: true,
  });
});

test("health POST auth and kite partial status contracts are present", async () => {
  const flask = await readFile(new URL("../flask_gateway.py", import.meta.url), "utf8");
  const kite = await readFile(new URL("../app/kite-live-server.ts", import.meta.url), "utf8");
  const healthServer = await readFile(new URL("../app/health-import-server.ts", import.meta.url), "utf8");
  const dashboardRefresh = await readFile(new URL("../app/api/dashboard/refresh/route.ts", import.meta.url), "utf8");
  const contentServer = await readFile(new URL("../scripts/content-digest-server.mjs", import.meta.url), "utf8");
  const refreshScript = await readFile(new URL("../scripts/refresh-dashboard-data.sh", import.meta.url), "utf8");

  assert.match(flask, /_authorized_health_post/);
  assert.match(flask, /PORTFOLIO_HEALTH_TOKEN/);
  assert.match(flask, /status_code.?401|401/);
  assert.match(kite, /status: unavailable\.length \? "partial" : "live"/);
  assert.match(kite, /authStatus: "authenticated"/);
  assert.match(kite, /reauthSuggested: false/);
  assert.match(kite, /unavailable\.push\("classifications"\)/);
  assert.doesNotMatch(kite, /Try one re-authentication/);
  assert.match(kite, /tokenExpiresAt: expiresAt/);
  assert.match(kite, /retainedSnapshot/);
  assert.match(kite, /authStatusForFailure/);
  assert.match(kite, /nextKiteDailyExpiry/);
  assert.match(contentServer, /Restored from local cache at process start/);
  assert.match(healthServer, /refresh-apple-health\.sh/);
  assert.match(dashboardRefresh, /refreshAppleHealth/);
  assert.doesNotMatch(dashboardRefresh, /readAppleHealthSnapshot/);
  assert.match(refreshScript, /health_date_policy\.py/);
  assert.match(refreshScript, /force=1/);
  assert.match(refreshScript, /startup-audit\.json/);
  assert.match(refreshScript, /unavailable=/);
});

test("Health snapshot loads before the bundled dashboard refresh completes", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const healthEarly = loadHealth\(\);/);
  assert.match(page, /Promise\.allSettled\(\[kiteEarly, healthEarly,/);
});
