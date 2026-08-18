import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  GLOBAL_CSS_CANDIDATES,
  INTELLIGENCE_SOURCE_CANDIDATES,
  readJoined,
} from "./helpers/algorithm-canvas.mjs";
import test from "node:test";
import { buildEarningsSnapshot, earningsEventDateKey } from "../app/earnings-verify.ts";
import { kiteAuthPresentation, kiteLoginHref } from "../app/kite-auth-presentation.ts";
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
  const intelligenceWorkspace = await readJoined(INTELLIGENCE_SOURCE_CANDIDATES);
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

test("bundled dashboard refresh can force Mail Calendar Reminders and Podcasts", async () => {
  const route = await readFile(new URL("../app/api/dashboard/refresh/route.ts", import.meta.url), "utf8");
  const flask = await readFile(new URL("../flask_gateway.py", import.meta.url), "utf8");
  const script = await readFile(new URL("../scripts/refresh-dashboard-data.sh", import.meta.url), "utf8");
  assert.match(route, /forceContent = requestUrl.searchParams.get\("force"\) === "1"/);
  assert.match(route, /force=\$\{forceContent \? "1" : "0"\}/);
  assert.match(route, /forceContent \? 160_000 : 75_000/);
  assert.match(route, /readAppleHealthSnapshot/);
  assert.doesNotMatch(route, /refreshAppleHealth/);
  assert.match(flask, /api\/dashboard\/refresh/);
  assert.match(flask, /force_content/);
  assert.match(flask, /X-Stratji-Local-Operator/);
  assert.match(flask, /_operator_only_proxy/);
  assert.match(flask, /api\/llm\/complete/);
  assert.match(script, /PORTFOLIO_SKIP_HEALTH_ZIP/);
  assert.match(script, /PORTFOLIO_REFRESH_MODE:-complete/);
  assert.match(script, /--if-changed/);
});

test("S-2 stays local while exclusive Market Intelligence M-3 earnings remains unfiltered", async () => {
  const sectorsWorkspace = await readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8");
  const intelligenceWorkspace = await readJoined(INTELLIGENCE_SOURCE_CANDIDATES);
  const analytics = await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readJoined(GLOBAL_CSS_CANDIDATES);

  assert.match(sectorsWorkspace, /<SectoralAnalytics selectedIds=\{selectedSectorIds\} onToggle=\{onToggleSector\} market=\{sectorMarket\} marketsBySector=\{sectorMarketById\} news=\{sectorNews\} holdings=\{holdings\} page=\{activePages\.s2 as SectorAnalyticsPage\} benchmarks=\{benchmarks\}\/>/);
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
  assert.match(analytics, /alignSectorImpactRows\(sectors\)/);
  assert.doesNotMatch(analytics, /aria-disabled=\{!selectable\}/);

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
    control: "authenticate",
    showAuthAction: true,
  });
});

test("unavailable or unknown cached Kite still offers Authenticate Kite", () => {
  assert.deepEqual(kiteAuthPresentation({
    status: "snapshot",
    authStatus: "unknown",
  }), {
    control: "authenticate",
    showAuthAction: true,
  });
  assert.deepEqual(kiteAuthPresentation({
    status: "snapshot",
    authStatus: "authenticated",
  }), {
    control: "cached",
    showAuthAction: false,
  });
  assert.equal(kiteLoginHref(undefined), "/api/kite/login?force=1");
  assert.doesNotMatch(kiteLoginHref(undefined), /redirect=1/);
  assert.equal(kiteLoginHref("https://kite.zerodha.com/connect/login"), "https://kite.zerodha.com/connect/login");
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
  assert.match(dashboardRefresh, /readAppleHealthSnapshot/);
  assert.doesNotMatch(dashboardRefresh, /refreshAppleHealth/);
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

test("refresh merge applies only newer successful source payloads", async () => {
  const {
    isAtLeastAsFresh,
    mergeContentSnapshot,
    mergeEarningsSnapshot,
    mergeHealthSnapshot,
    mergeKiteSnapshot,
    mergeSectorMarketSnapshot,
    mergeSourceFreshness,
    mergeYfinanceQuotes,
    retainHealthOnFailure,
    retainKiteOnFailure,
  } = await import("../app/dashboard-refresh-merge.ts");
  const { emptySnapshot } = await import("../app/live-types.ts");

  assert.equal(isAtLeastAsFresh("2026-08-17", "2026-08-16"), true);
  assert.equal(isAtLeastAsFresh("2026-08-16", "2026-08-17"), false);
  assert.equal(isAtLeastAsFresh("Bundled fallback", "2026-08-17"), true);

  const liveKite = {
    ...emptySnapshot,
    status: "live",
    authStatus: "authenticated",
    asOf: "2026-08-17T17:40:00.000Z",
    message: "Live",
    holdings: [{ ...emptySnapshot.holdings[0], symbol: "INFY", qty: 1, price: 10, value: 10, pnl: 0, pnlPct: 0, dayPnl: 0, dayPct: 0, weight: 1, name: "Infosys", sector: "IT", subSector: "IT", marketCap: "Large", avg: 10, risk: "low", stance: "Hold", oil: 1, flow: 1, quarter: "", color: "#0f0", donutOrder: 1, classificationStatus: "verified" }],
  };
  const olderLiveKite = { ...liveKite, asOf: "2026-08-17T17:30:00.000Z", holdings: [{ ...liveKite.holdings[0], price: 9 }] };
  const failedKite = { ...emptySnapshot, status: "unavailable", asOf: "2026-08-17T17:45:00.000Z", message: "Kite down" };

  assert.equal(mergeKiteSnapshot(liveKite, olderLiveKite).holdings[0].price, 10);
  assert.equal(mergeKiteSnapshot(liveKite, failedKite).status, "live");
  assert.equal(retainKiteOnFailure(liveKite, "timeout").status, "snapshot");
  assert.equal(retainKiteOnFailure(liveKite, "timeout").holdings[0].symbol, "INFY");

  const liveMail = {
    status: "live",
    asOf: "2026-08-17T17:40:00.000Z",
    newsletters: [{ source: "Mail", time: "10:00", title: "Live letter", summary: "Keep me" }],
    axisResearch: [{ source: "Axis", time: "10:00", title: "Live axis", summary: "Axis keep" }],
    podcasts: [{ source: "Podcast", time: "10:00", title: "Live pod", summary: "Pod keep" }],
    reminders: [],
    calendar: [],
    healthNote: null,
    investment: {
      policy: "live",
      analysisWindowStart: "2026-08-15",
      analysisDate: "2026-08-17",
      axisLookbackDays: 3,
      latestAxisAt: "2026-08-17",
      latestNewsletterAt: "2026-08-17",
      axisRecommendations: [{ symbol: "INFY", name: "Infosys", call: "BUY", target: 1, cmp: 1, upside: "", horizon: "", source: "Axis", date: "2026-08-17", thesis: "", color: "", scores: [3, 3, 3, 3, 3, 3] }],
      macroEvidence: [],
    },
    sources: {
      newsletters: { status: "live", count: 1, observedAt: "2026-08-17T17:40:00.000Z" },
      axisResearch: { status: "live", count: 1, observedAt: "2026-08-17T17:40:00.000Z" },
      podcasts: { status: "live", count: 1, observedAt: "2026-08-17T17:40:00.000Z" },
      reminders: { status: "live", count: 0, observedAt: "2026-08-17T17:40:00.000Z" },
      calendar: { status: "live", count: 0, observedAt: "2026-08-17T17:40:00.000Z" },
      healthNote: { status: "live", count: 0, observedAt: "2026-08-17T17:40:00.000Z" },
    },
  };
  const failedMail = {
    ...liveMail,
    asOf: "2026-08-17T17:50:00.000Z",
    newsletters: [],
    status: "unavailable",
    sources: {
      ...liveMail.sources,
      newsletters: { status: "error", count: 0, observedAt: "2026-08-17T17:50:00.000Z", message: "Mail.app failed" },
    },
  };
  const mergedMail = mergeContentSnapshot(liveMail, failedMail);
  assert.equal(mergedMail.newsletters[0].title, "Live letter");
  assert.equal(mergedMail.axisResearch[0].title, "Live axis");
  assert.equal(mergedMail.sources.newsletters.status, "cached");
  assert.equal(mergedMail.status, "partial");
  assert.match(mergedMail.sources.newsletters.message ?? "", /Retaining the last validated snapshot/);

  const newerKite = { ...liveKite, asOf: "2026-08-17T17:55:00.000Z", holdings: [{ ...liveKite.holdings[0], price: 12 }] };
  assert.equal(mergeKiteSnapshot(liveKite, newerKite).holdings[0].price, 12);
  assert.equal(mergeContentSnapshot(liveMail, failedMail).podcasts[0].title, "Live pod");

  const verifiedEarnings = { status: "verified", asOf: "2026-08-17T12:00:00.000Z", analysisDate: "2026-08-16", events: [{ date: "16 Aug", day: "16", symbol: "IRFC", name: "IRFC", state: "Reported", portfolio: false, period: "Q1", reported: true, kpis: [] }], message: "ok" };
  const staleEarnings = { ...verifiedEarnings, status: "stale", asOf: "2026-08-17T18:00:00.000Z", message: "failed", events: [] };
  assert.equal(mergeEarningsSnapshot(verifiedEarnings, staleEarnings).status, "verified");
  assert.equal(mergeEarningsSnapshot(verifiedEarnings, staleEarnings).events[0].symbol, "IRFC");

  const liveHealth = {
    schemaVersion: 1,
    status: "live",
    source: "Apple Health",
    dataDate: "2026-08-16",
    capturedAt: "2026-08-17T03:10:00+05:30",
    message: "ok",
    categories: [{ name: "Activity", note: "", tone: "green", metrics: [{ id: "steps", label: "Steps", value: "1", unit: "", tone: "green" }] }],
    sources: [],
  };
  const staleHealth = { ...liveHealth, status: "stale", dataDate: "2026-07-16", capturedAt: "2026-08-17T18:00:00+05:30", categories: [] };
  assert.equal(mergeHealthSnapshot(liveHealth, staleHealth).dataDate, "2026-08-16");
  assert.equal(retainHealthOnFailure(liveHealth, "zip failed").status, "stale");
  assert.equal(retainHealthOnFailure(liveHealth, "zip failed").categories[0].metrics.length, 1);

  const liveSector = { status: "live", sectorId: "pharma", asOf: "2026-08-17T17:40:00.000Z", message: "ok", companies: [{ symbol: "SUNPHARMA", price: 1, previousClose: 1, returns: { day: 0, week: 0, month: 0, quarter: 0 } }] };
  const failedSector = { status: "unavailable", sectorId: "pharma", asOf: "2026-08-17T17:50:00.000Z", message: "down", companies: [] };
  assert.equal(mergeSectorMarketSnapshot(liveSector, failedSector).status, "live");
  assert.equal(mergeSectorMarketSnapshot(liveSector, failedSector).companies[0].price, 1);

  const freshness = mergeSourceFreshness(
    [{ source: "Kite", state: "live", observedAt: "a", period: "5 minutes", required: true, message: "ok" }],
    [{ source: "Kite", state: "unavailable", observedAt: "b", period: "5 minutes", required: true, message: "down" }, { source: "Apple Health export", state: "live", observedAt: "c", period: "d", required: true, message: "ok" }],
  );
  assert.equal(freshness.find((row) => row.source === "Kite")?.state, "unavailable");
  assert.equal(freshness.find((row) => row.source === "Apple Health export")?.state, "live");

  const quotes = mergeYfinanceQuotes(new Map([["INFY", 10]]), new Map());
  assert.equal(quotes.get("INFY"), 10);
  assert.equal(mergeYfinanceQuotes(quotes, new Map([["INFY", 11]])).get("INFY"), 11);
});

test("dashboard refresh patches sources independently and keeps workspaces mounted", async () => {
  const [page, sharedUi] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /mergeKiteSnapshot/);
  assert.match(page, /mergeContentSnapshot/);
  assert.match(page, /mergeEarningsSnapshot/);
  assert.match(page, /mergeHealthSnapshot/);
  assert.match(page, /mergeSectorMarketSnapshot/);
  assert.match(page, /mergeSourceFreshness/);
  assert.match(page, /setStayMounted\(true\)/);
  assert.match(page, /hidden=\{workspace !== "investment"\}/);
  assert.match(page, /sectorMarketsLoading=\{!hasUsableSectorMarket\}/);
  assert.doesNotMatch(page, /sectorMarketsLoading=\{refreshing/);
  assert.doesNotMatch(page, /setHealthSnapshot\(fallbackHealth\)/);
  assert.doesNotMatch(page, /setContent\(data\)/);
  assert.doesNotMatch(page, /setEarningsSnapshot\(data\)/);
  assert.match(sharedUi, /hidden=\{!open\}/);
  assert.doesNotMatch(sharedUi, /\{open && <div className="collapsible-content"/);
});
