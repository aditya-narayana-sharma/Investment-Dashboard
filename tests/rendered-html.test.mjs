import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isAxisResearchMail } from "../scripts/axis-mail-filter.mjs";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("Axis Research digest excludes misfiled and administrative mail", () => {
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <research@axisdirect.in>", subject: "Q1FY27 Result Updates" }), true);
  assert.equal(isAxisResearchMail({ sender: "Axis Securities Research <equity@axissecurities.in>", subject: "Daily Technical Outlook" }), true);
  assert.equal(isAxisResearchMail({ sender: "IndiGo <offers@goindigo.in>", subject: "Introducing Two-way point conversion" }), false);
  assert.equal(isAxisResearchMail({ sender: "Notion <team@makenotion.com>", subject: "Your workspace update" }), false);
  assert.equal(isAxisResearchMail({ sender: "Groww <updates@groww.in>", subject: "IPO is live" }), false);
  assert.equal(isAxisResearchMail({ sender: "Zerodha <updates@zerodha.com>", subject: "Account update" }), false);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <service@axisdirect.in>", subject: "Learn Account Offer Benefits" }), false);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <service@axisdirect.in>", subject: "966526 is your access code to log in" }), false);
  assert.equal(isAxisResearchMail({ sender: "Axis Direct <research@axisdirect.in>", subject: "LIVE Webinar: Options Trading | Register Now" }), false);
});

test("server-renders the portfolio dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Portfolio Intelligence<\/title>/i);
  assert.match(html, /Investment Brief/);
  assert.match(html, /Top-two concentration/);
  assert.match(html, /Live Kite data required/);
  assert.match(html, /All sources · 5 min/);
  assert.match(html, /Kite login unavailable/);
  assert.match(html, /Macro scenario lab/);
  assert.match(html, /Dashboard workspaces/);
  assert.match(html, /Sectoral Analytics/);
  assert.match(html, /Analyst call matrix/);
  assert.match(html, /Nested portfolio allocation/);
  assert.match(html, /Risk composition/);
  assert.match(html, /Equal-weighted event and KPI drivers/);
  assert.match(html, /Refresh Kite and validate holdings/);
  assert.match(html, /Monitor oil, INR and institutional flows/);
  assert.match(html, /Health incognito/);
  assert.match(html, /Hide health statistics/);
  assert.match(html, /Collapse Portfolio snapshot/);
  assert.doesNotMatch(html, /Company composition and performance/);
  assert.doesNotMatch(html, /Read-only wellness view/);
});

test("sector market route uses a source-labelled fallback without creating a Kite session", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("query2.finance.yahoo.com")) {
      return Response.json({
        chart: { result: [{ meta: { regularMarketPrice: 110 }, indicators: { quote: [{ close: Array.from({ length: 70 }, (_, index) => 90 + index * 0.25) }] } }] },
      });
    }
    return originalFetch(input, init);
  };
  try {
    const response = await render("/api/sectors/snapshot?sector=energy");
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, "public_delayed");
    assert.equal(payload.sectorId, "energy");
    assert.equal(payload.companies.length, 10);
    assert.equal(payload.companies.filter((company) => company.price !== null).length, 10);
    assert.equal(response.headers.get("set-cookie"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("server-renders the print report and keeps controls interactive", async () => {
  const [response, page, reportPage, reportCss, reportDownloadRoute, reportDownloadServer, contentRoute, contentServer, healthData, healthKitSync, flaskGateway, liveServer, liveRoute, packageJson, layout, manifest, serviceWorker, serviceScript, iphoneScript, portfolioData, sectorRoute, sectorServer, sectorCompanies, sectorData, globalCss] = await Promise.all([
    render("/report"),
    Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/types.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
    ]).then((parts) => parts.join("\n")),
    readFile(new URL("../app/report/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/report/report.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/report-pdf/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/pdf-download-server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/api/content/refresh/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/content-digest-server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/health-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/HealthKitSync.swift", import.meta.url), "utf8"),
    readFile(new URL("../flask_gateway.py", import.meta.url), "utf8"),
    readFile(new URL("../app/kite-live-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/kite/snapshot/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/run-dashboard-service.sh", import.meta.url), "utf8"),
    readFile(new URL("../scripts/start-iphone-app.sh", import.meta.url), "utf8"),
    readFile(new URL("../app/portfolio-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sectors/snapshot/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sector-live-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sector-company-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sector-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Refreshing Kite and current Mail research/);
  assert.match(html, /Latest Kite session required before PDF generation/);

  assert.match(page, /setMacroEventKey/);
  assert.match(page, /setMacroBandKey/);
  assert.match(page, /setView/);
  assert.match(page, /Orders &amp; GTTs/);
  assert.match(page, /5 \* 60 \* 1000/);
  assert.match(page, /\/api\/kite\/snapshot/);
  assert.match(page, /\/api\/content\/refresh/);
  assert.match(page, /force=1/);
  assert.match(page, /\/_health\/snapshot\?refresh=/);
  assert.match(page, /refreshAll/);
  assert.match(page, /\/_startup\/audit/);
  assert.match(page, /startup-audit-banner/);
  assert.match(page, /DIGEST_PAGE_SIZE/);
  assert.match(page, /isPartial/);
  assert.match(page, /hasPortfolio = isLive \|\| isPartial \|\| isSnapshot/);
  assert.match(page, /React\.lazy|lazy\(\(\) => import\("\.\/SectoralAnalytics"\)\)/);
  assert.match(page, /function DashboardTabs/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /event\.key === "Home"/);
  assert.match(page, /event\.key === "End"/);
  assert.match(page, /searchParams\.set\("view", next\)/);
  assert.match(page, /addEventListener\("popstate"/);
  assert.match(page, /tabList\.scrollLeft = Math\.max/);
  assert.match(page, /window\.dispatchEvent\(new Event\("resize"\)\)/);
  assert.match(page, /loadSectorMarket/);
  assert.match(page, /\/api\/sectors\/snapshot/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /addEventListener\("focus"/);
  assert.match(page, /addEventListener\("online"/);
  assert.match(page, /visibleNewsletters\.map|newsletters\.map/);
  assert.match(page, /visibleAxis\.map|axisResearch\.map/);
  assert.match(page, /visiblePodcasts\.map|podcasts\.map/);
  assert.match(page, /matchesSelectedSector/);
  assert.match(page, /data-sector-filter/);
  assert.match(page, /aria-pressed=/);
  assert.match(globalCss, /sector-dimmed/);
  assert.doesNotMatch(globalCss, /sector-intelligence-filter/);
  assert.match(page, /Kite authenticated/);
  assert.match(page, /Authenticate Kite/);
  assert.match(page, /snapshot\.authUrl/);
  assert.match(page, /No static positions are shown/);
  assert.match(page, /Shaded outer segment = negative day P&amp;L/);
  assert.match(page, /Verified industry and sub-sector/);
  assert.match(reportPage, /sub-sector from company disclosures/);
  assert.match(page, /AMFI market-cap tier/);
  assert.match(page, /COMPOSITE MONITORING INDEX/);
  assert.match(page, /Event transmission/);
  assert.match(page, /KPI watch/);
  assert.match(page, /raw score ÷ 6/);
  assert.match(page, /categories\.map/);
  assert.match(page, /health-kpi-grid/);
  assert.match(page, /health-kpi-tile/);
  assert.doesNotMatch(page, /ResizeObserver/);
  assert.match(page, /workspace === "investment" &&/);
  assert.match(page, /workspace === "sectors" &&/);
  assert.match(page, /workspace === "health" &&/);
  assert.match(page, /window\.localStorage\.setItem\(storageKey/);
  assert.match(page, /function CollapsibleSection/);
  assert.match(page, /aria-expanded=\{open\}/);
  assert.match(page, /healthIncognito/);
  assert.match(page, /Health statistics hidden/);
  assert.match(page, /function EarningsCalendarWorkbench/);
  assert.doesNotMatch(page, /function EarningsCalendarWorkbench\(\{ snapshot, content, selectedSectorId/);
  assert.doesNotMatch(page, /matchingEvents/);
  assert.match(page, /export default function SectoralAnalytics/);
  assert.match(page, /Cross-industry breadth and common data/);
  assert.doesNotMatch(page, /All industries are visible/);
  assert.match(page, /Porter competitive-pressure radar/);
  assert.match(page, /Top \{leaders\.length\} leaders/);
  assert.match(page, /Top \{laggards\.length\} laggards/);
  assert.match(page, /Fundamental values are transparent 1-5 research scores/);
  assert.match(page, /number="S-1" title="Sector action board"/);
  assert.match(page, /number="S-2" title="Sectoral analytics"/);
  assert.match(page, /number="I-1" title="Investment action board"/);
  assert.match(page, /number="I-2" title="Portfolio snapshot"/);
  assert.ok(page.indexOf('number="I-1" title="Investment action board"') < page.indexOf('number="I-2" title="Portfolio snapshot"'));
  assert.ok(page.indexOf('number="I-2" title="Portfolio snapshot"') < page.indexOf('number="I-3" title="Macro scenario lab"'));
  assert.ok(page.indexOf('number="I-3" title="Macro scenario lab"') < page.indexOf('number="I-4" title="Analyst call matrix"'));
  assert.match(page, /className="panel analyst-matrix"/);
  assert.match(page, /className="analyst-table"/);
  assert.match(page, /data-label="What matters"/);
  assert.match(page, /thesisBullets\(/);
  assert.match(page, /ThesisBulletList/);
  assert.match(page, /mail-window calls/);
  assert.match(page, /archive PDFs are evidence inventory only/);
  assert.match(globalCss, /\.thesis-bullet-list/);
  assert.match(globalCss, /\.analyst-matrix/);
  assert.match(globalCss, /grid-template-areas:[\s\S]*"stock call"/);
  assert.match(page, /function AxisRecommendationWorkbench/);
  assert.match(contentServer, /extractAxisRecommendations/);
  assert.match(contentServer, /from "\.\/axis-recommendations\.mjs"/);
  assert.match(page, /function SectorDecisionFramework/);
  assert.match(page, /function SectorDecisionFramework\(\)/);
  assert.match(page, /decision-sector-tabs/);
  assert.match(page, /function DailyKanbanBoard/);
  assert.match(page, /resets at local midnight/);
  assert.match(page, /dashboard-kanban-\$\{workspace\}-v2/);
  assert.doesNotMatch(page, /current\.archived|state\.archived/);
  assert.match(page, /numericAdvantage/);
  assert.match(page, /earnings-decision-stack/);
  assert.match(page, /sectorScoreLabels\.map/);
  assert.match(page, /pestelAxes\.map/);
  assert.match(page, /porterAxes\.map/);
  assert.doesNotMatch(page, /cageAxes\.map/);
  assert.match(page, /setSelectedKey/);
  assert.match(page, /selected\.kpis\.map/);
  assert.match(page, /resolveEarningsIdentity/);
  assert.doesNotMatch(page, /CAL-\$\{/);
  assert.doesNotMatch(page, /`CAL-/);
  assert.match(page, /blank-value/);
  assert.match(page, /KPI fields are intentionally blank/);
  assert.match(page, /Object\.keys\(sectorCompanies\)/);
  assert.match(page, /refreshInFlightRef/);
  assert.match(page, /macro-event-tabs/);
  assert.match(page, /SELECTED \{event\.label\.toUpperCase\(\)\} RANGE/);
  assert.match(page, /mail\?\.items\?\.length/);
  assert.match(reportPage, /overflowingPages/);
  assert.match(reportPage, /pdfOverflow|scrollHeight - page\.clientHeight/);
  assert.match(flaskGateway, /_authorized_health_post/);
  assert.match(flaskGateway, /PORTFOLIO_HEALTH_TOKEN/);
  assert.match(flaskGateway, /\/_startup\/audit/);
  assert.match(healthKitSync, /Authorization/);
  assert.match(healthKitSync, /X-Portfolio-Health-Token/);
  assert.match(liveServer, /status: unavailable\.length \? "partial" : "live"/);
  assert.match(page, /skip-link/);
  assert.match(globalCss, /startup-audit-banner/);
  assert.doesNotMatch(packageJson, /html2canvas/);
  assert.doesNotMatch(packageJson, /html2pdf\.js/);
  assert.doesNotMatch(packageJson, /"jspdf"/);
  assert.doesNotMatch(globalCss, /@import "tailwindcss"/);
  assert.match(reportPage, /document\.head\.cloneNode\(true\)/);
  assert.match(reportPage, /querySelectorAll\("script"\)/);
  assert.match(reportPage, /JSON\.stringify\(\{ pages: pageDocuments \}\)/);
  assert.match(reportPage, /reportPages\.map\(\(page\) => page\.outerHTML\)\.join\(""\)/);
  assert.match(reportPage, /window\.location\.assign\(prepared\.downloadUrl\)/);
  assert.match(reportPage, /Download prepared PDF/);
  assert.match(reportPage, /Saved to Downloads as/);
  assert.match(reportDownloadRoute, /Content-Disposition/);
  assert.match(reportDownloadRoute, /attachment; filename=/);
  assert.match(reportDownloadRoute, /preparedPdfs\.size > 4/);
  assert.match(reportDownloadRoute, /http:\/\/127\.0\.0\.1:3002\/render/);
  assert.match(reportDownloadServer, /--headless=new/);
  assert.match(reportDownloadServer, /--print-to-pdf=/);
  assert.match(reportDownloadServer, /-sDEVICE=pdfwrite/);
  assert.match(contentRoute, /127\.0\.0\.1:3003\/refresh/);
  assert.match(contentServer, /newsletterWindowMessages\(/);
  assert.match(contentServer, /exactMailbox\(account, "Newsletters"\)/);
  assert.match(contentServer, /function refreshOnce\(\)/);
  assert.match(contentServer, /if \(refreshInFlight\) return refreshInFlight/);
  assert.match(contentServer, /ANALYSIS_DATE.*istDateKey\(0\)/);
  assert.match(contentServer, /ANALYSIS_WINDOW_START.*istDateKey\(3\)/);
  assert.match(contentServer, /exactAccount\("iCloud"\)/);
  assert.match(contentServer, /exactMailbox\(account, "Axis Research"\)/);
  assert.match(contentServer, /mailbox\.messages\.whose/);
  assert.match(contentServer, /group\.com\.apple\.calendar\/Calendar\.sqlitedb/);
  assert.match(contentServer, /FROM CalendarItem i/);
  assert.match(contentServer, /settle\(readCalendar\)/);
  assert.doesNotMatch(contentServer, /Application\("Calendar"\)/);
  assert.match(contentServer, /settle\(readNewsletters\)/);
  assert.match(contentServer, /settle\(readAxisResearch\)/);
  assert.doesNotMatch(contentServer, /Promise\.allSettled\(\[readNewsletters\(\), readAxisResearch\(\)/);
  assert.doesNotMatch(contentServer, /\[newsletters, axisResearch, podcasts, reminders, calendar, healthNote\] = await Promise\.all/);
  assert.match(contentServer, /NEWSLETTER_DIGEST_LIMIT = 500/);
  assert.match(contentServer, /NEWSLETTER_BODY_BUDGET_MS/);
  assert.match(contentServer, /readNewsletterListing/);
  assert.match(contentServer, /readNewsletterBodies/);
  assert.match(contentServer, /displayedCount: newsletterValue\.items\.length/);
  assert.match(contentServer, /message\.properties\(\)/);
  assert.match(contentServer, /settle\(readPodcasts\)/);
  assert.match(contentServer, /group\.com\.apple\.reminders\/Container_v1\/Stores/);
  assert.match(contentServer, /execFileAsync\("sqlite3", \["-readonly", "-json", store, remindersQuery\]/);
  assert.match(contentServer, /reminder\.ZCOMPLETED = 0/);
  assert.doesNotMatch(contentServer, /sourceState\(reminders, reminderValue\.length, true\)/);
  assert.match(contentServer, /filter\(isAxisResearchMail\)/);
  assert.match(contentServer, /extractAxisRecommendations/);
  assert.match(contentServer, /macroEvidence/);
  assert.match(page, /Investment evidence refreshed from Mail for \{analysisWindowLabel\(content\)\}/);
  assert.match(page, /Axis Mail calls from \{analysisWindowLabel\(content\)\} are prioritised/);
  assert.match(contentServer, /ZMTEPISODE/);
  assert.match(contentServer, /Client ID\|Client Code\|Account ID/);
  assert.match(reportPage, /Portfolio_Investment_Brief_/);
  assert.match(reportPage, /data-pdf-pages/);
  assert.doesNotMatch(reportPage, /window\.print\(\)/);
  assert.match(reportCss, /\.report tbody tr:nth-child\(even\) td/);
  assert.doesNotMatch(reportCss, /(?:^|\n)tbody tr:nth-child\(even\) td/);
  assert.match(reportPage, /function PrintNestedDonut/);
  assert.match(reportPage, /Nested live portfolio allocation/);
  assert.match(reportPage, /Holdings · weight \+ U\/Day P&amp;L/);
  assert.match(reportPage, /Shaded = negative day P&amp;L/);
  assert.match(reportPage, /holdings\.map\(\(holding\) =>/);
  assert.match(healthData, / Health Daily Note/);
  assert.match(healthData, /Body measurements are intentionally excluded/);
  assert.match(healthData, /913 kcal/);
  assert.match(healthData, /10,495/);
  assert.match(healthData, /complete 16 Jul entry includes 4\.08 km\/h walking speed/);
  assert.match(healthData, /Walking speed.*2\.2-5\.9 km\/h/s);
  assert.match(healthData, /Step length.*42-101 cm/s);
  assert.match(healthData, /2,539 kcal/);
  assert.match(healthData, /monthly: \{ value: "663 kcal"/);
  assert.match(healthData, /Dietary cholesterol/);
  assert.match(healthData, /2,506 mg/);
  assert.match(healthData, /monthly: \{ value: "2,916 ml"/);
  assert.match(healthData, /Sleep score.*83 \/ 100/s);
  assert.match(healthData, /HRV.*18-89 ms/s);
  assert.match(healthData, /Resting heart rate.*71 bpm/s);
  assert.match(healthData, /Blood oxygen.*92-99%/s);
  assert.match(healthData, /Respiratory rate.*14-22 \/ min.*16 Jul/s);
  assert.match(healthData, /15\.5-17\.5 \/ min daily-average range/);
  assert.match(healthData, /14\.7-18\.5 \/ min daily-average range/);
  assert.match(healthData, /Exercise minutes/);
  assert.match(healthData, /HealthAveragePeriod/);
  assert.match(healthData, /averages: \{ weekly:/);
  assert.match(page, /function HealthMetricComparison/);
  assert.match(page, /health-average-period/);
  assert.match(page, /Compare health metrics with weekly or monthly average/);
  assert.match(page, /No \{periodLabel\} avg/);
  assert.match(page, /healthCurrent \? "SYNCED" : "STALE"/);
  assert.match(flaskGateway, /@app\.route\("\/_health\/snapshot"/);
  assert.match(flaskGateway, /MAX_HEALTH_SNAPSHOT_BYTES/);
  assert.match(healthKitSync, /requestAuthorization/);
  assert.match(healthKitSync, /latest completed-day HealthKit aggregates/i);
  assert.match(healthKitSync, /7-day and 30-day baselines/i);
  assert.doesNotMatch(page, /function HealthBaselineComparison/);
  assert.doesNotMatch(page, /healthHighlights\.map/);
  assert.doesNotMatch(page, /Water represents the logged Lifesum target/);
  assert.match(page, /isAnimationActive=\{false\}/);
  assert.match(page, /kite\/snapshot\?refresh=/);
  assert.match(page, /Latest refresh failed; retaining the last validated values/);
  assert.match(liveServer, /callKiteTool\("get_holdings"\)/);
  assert.match(liveServer, /callKiteTool\("get_positions"\)/);
  assert.match(liveServer, /callKiteTool\("get_orders"\)/);
  assert.match(liveServer, /callKiteTool\("get_gtts"\)/);
  assert.match(liveServer, /settledQty \+ t1Qty \+ mtfQty/);
  assert.match(liveServer, /product === "CNC"/);
  assert.doesNotMatch(liveServer, /number\(raw\.collateral_quantity\)/);
  assert.doesNotMatch(liveServer, /sector: "Other"/);
  assert.doesNotMatch(liveServer, /marketCap: "Unclassified"/);
  assert.match(liveServer, /Portfolio figures are hidden because live Kite data is unavailable/);
  assert.match(liveServer, /AUTH_URL_MAX_AGE_MS = 20 \* 60 \* 1000/);
  assert.match(liveServer, /authUrlCreatedAt = Date\.now\(\)/);
  assert.doesNotMatch(liveServer, /name\.startsWith\("get_"\)/);
  assert.match(liveServer, /if \(!rawBody\.trim\(\)\) return/);
  assert.match(await readFile(new URL("../app/kite-session-store.ts", import.meta.url), "utf8"), /HttpOnly; SameSite=Strict/);
  assert.match(liveRoute, /kiteSessionCookie/);
  assert.match(liveRoute, /Cache-Control.*no-store/);
  assert.match(packageJson, /ensure-kite-server\.sh/);
  assert.match(packageJson, /ensure-content-digest-server\.sh/);
  assert.match(packageJson, /"desktop": "\.\/scripts\/install-desktop-app\.sh"/);
  assert.match(packageJson, /"iphone": "\.\/scripts\/install-iphone-app\.sh"/);
  assert.match(packageJson, /"iphone:vinext": "\.\/scripts\/start-iphone-app\.sh"/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /app-icon-512\.png/);
  assert.match(serviceWorker, /cache: "no-store"/);
  assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /"Content-Type": "application\/json"/);
  assert.match(serviceWorker, /portfolio-iphone-v2/);
  assert.doesNotMatch(serviceWorker, /caches\.open/);
  assert.match(serviceScript, /waitress-serve/);
  assert.match(serviceScript, /--listen="\$BIND_HOST:\$FLASK_PORT"/);
  assert.match(iphoneScript, /npm run dev:lan/);
  assert.match(portfolioData, /symbol: "LTTS"/);
  assert.match(portfolioData, /securityClassifications/);
  assert.match(portfolioData, /ADANIGREEN: .*sector: "Power Generation".*marketCap: "Large cap"/);
  assert.match(portfolioData, /ADANIGREEN: .*donutOrder: 40/);
  assert.match(portfolioData, /ETERNAL: .*sector: "E-Commerce"/);
  assert.match(portfolioData, /BHARTIARTL: .*sector: "Telecom"/);
  assert.match(portfolioData, /JSWENERGY: .*sector: "Power Generation"/);
  assert.match(portfolioData, /ADANIGREEN: .*subSector: "Renewable Power"/);
  assert.match(portfolioData, /JSWENERGY: .*subSector: "Integrated Power & Storage"/);
  assert.match(portfolioData, /ETERNAL: .*subSector: "Food Delivery & Quick Commerce"/);
  assert.match(liveServer, /subSectorAllocation: buildContiguousAllocations\(donutHoldings, "subSector", subSectorColors\)/);
  assert.match(page, /data=\{subSectorAllocation\}.*ring="subsector"/);
  assert.match(reportPage, /subSectors=\{snapshot\.subSectorAllocation\}/);
  assert.match(liveServer, /sortDonutHoldings\(holdings\)/);
  assert.match(await readFile(new URL("../app/portfolio-donut.ts", import.meta.url), "utf8"), /buildContiguousAllocations/);
  assert.match(page, /sortDonutHoldings\(snapshot\.holdings\)/);
  assert.match(page, /data=\{donutHoldings\}.*startAngle=\{90\} endAngle=\{-270\} paddingAngle=\{0\}/);
  assert.match(reportPage, /ringSegments\(donutHoldings\.map/);
  assert.match(portfolioData, /marketCap: "AMFI January-June 2026 categorisation"/);
  assert.match(portfolioData, /symbol: "LTTS".*state: "Reported"/s);
  assert.match(portfolioData, /symbol: "TECHM".*state: "Reported"/s);
  assert.match(portfolioData, /ltts\.com\/press-release\/Q1FY27-results/);
  assert.match(portfolioData, /techmahindra\.com\/insights\/press-releases\/techmahindra-q1-fy27-results/);
  assert.match(sectorRoute, /getSectorMarketSnapshot/);
  assert.match(sectorRoute, /getPublicSectorMarketSnapshot/);
  assert.match(sectorRoute, /Cache-Control.*no-store/);
  assert.match(sectorRoute, /readCookie\(request, "kite_dashboard_session"\)/);
  assert.match(sectorRoute, /restoreKiteSession\(decodeURIComponent\(storedSession\), false\)/);
  assert.match(liveRoute, /kiteSessionCookie/);
  assert.match(liveServer, /persistKiteSession/);
  assert.match(liveServer, /adoptPersistedKiteSession/);
  assert.match(await readFile(new URL("../app/kite-session-store.ts", import.meta.url), "utf8"), /nextKiteDailyExpiry/);
  assert.doesNotMatch(sectorRoute, /Set-Cookie/);
  assert.match(page, /await loadSectorMarket\(primaryId\)/);
  assert.match(page, /Object\.keys\(sectorCompanies\)/);
  assert.match(page, /filter\(\(sectorId\) => sectorId !== primaryId\)/);
  assert.match(page, /toggleSector/);
  assert.match(page, /selectedSectorIds/);
  assert.match(page, /useState<string\[\]>\(\[\]\)/);
  assert.match(page, /data-sector-filter=\{filterActive \? selectedIds\.join/);
  assert.match(page, /ALL INDUSTRIES/);
  assert.match(page, /click a selected industry again/);
  assert.match(sectorServer, /kiteAuthLikelyValid/);
  assert.match(sectorServer, /loadKiteQuotes/);
  assert.match(sectorServer, /Prefer LTP first/);
  assert.match(sectorServer, /tool: "get_ltp"/);
  assert.match(sectorServer, /tool: "get_ohlc"/);
  assert.match(sectorServer, /tool: "get_quotes"/);
  assert.match(sectorServer, /quoteMode: attempt\.mode/);
  assert.match(sectorServer, /isInsufficientPermissionError/);
  assert.match(sectorServer, /rateLimitedUntil/);
  assert.match(sectorServer, /Kite Connect paid market-data permission is required/);
  assert.match(sectorServer, /callKiteTool\("get_historical_data"/);
  assert.match(sectorServer, /query2\.finance\.yahoo\.com\/v8\/finance\/chart/);
  assert.match(sectorServer, /status: "public_delayed"/);
  assert.match(sectorServer, /Public delayed market fallback/);
  assert.match(page, /PUBLIC DELAYED/);
  assert.match(sectorServer, /status: "cached"/);
  assert.match(sectorServer, /Zerodha rate limit reached/);
  assert.match(sectorCompanies, /NIFTY Pharma/);
  assert.match(sectorCompanies, /NIFTY 500 · Power industry/);
  assert.match(sectorCompanies, /Defence & Aerospace research universe/);
  assert.match(sectorCompanies, /company\("SUNPHARMA"/);
  assert.match(sectorCompanies, /company\("ICICIBANK"/);
  assert.match(sectorCompanies, /company\("KPIL"/);
  assert.match(sectorCompanies, /company\("TMPV"/);
  assert.match(sectorCompanies, /company\("HAL"/);
  assert.match(sectorCompanies, /company\("BEL"/);
  assert.match(sectorCompanies, /company\("MAZDOCK"/);
  assert.match(sectorCompanies, /company\("DATAPATTNS"/);
  assert.doesNotMatch(sectorCompanies, /company\("KALPATPOWR"/);
  assert.doesNotMatch(sectorCompanies, /company\("TATAMOTORS"/);
  assert.match(sectorData, /id: "defence"/);
  assert.match(sectorData, /value: "₹7\.85L Cr"/);
  assert.match(sectorData, /value: "245,444 MW"/);
  assert.match(sectorData, /value: "1,294\.46m"/);
  assert.match(sectorData, /value: "5\.25%"/);
  assert.match(globalCss, /\.workspace-navigation\s*\{/);
  assert.match(globalCss, /position:\s*sticky/);
  assert.match(globalCss, /\.sector-rank-grid/);
});
