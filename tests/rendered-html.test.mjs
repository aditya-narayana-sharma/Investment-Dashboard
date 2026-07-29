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
  assert.match(html, /Authenticate Kite/);
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
  assert.match(html, /Collapse Portfolio/);
  assert.match(html, /Collapse Risk/);
  assert.match(html, /Collapse Axis picks/);
  assert.doesNotMatch(html, /Company composition and performance/);
  assert.doesNotMatch(html, /Read-only wellness view/);
});

test("sector market route uses yfinance live quotes without creating a Kite session", async () => {
  const response = await render("/api/sectors/snapshot?sector=energy");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(["live", "cached", "auth_required", "unavailable"].includes(payload.status));
  assert.equal(payload.sectorId, "energy");
  assert.equal(payload.companies.length, 10);
  if (payload.status === "live") assert.ok(payload.companies.filter((company) => company.price !== null).length >= 8);
  assert.match(String(payload.message ?? ""), /yfinance/i);
  assert.equal(response.headers.get("set-cookie"), null);
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
      readFile(new URL("../app/dashboard/SectorDecisionLab.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/calendar-action-feeds.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/calendar-holiday-feeds.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/EarningsMonthCalendar.tsx", import.meta.url), "utf8"),
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
  assert.match(reportPage, /Kite is signed in, but the live snapshot is incomplete/);
  assert.match(reportPage, /Retry full Kite refresh/);
  assert.match(reportPage, /\/api\/kite\/login\?force=1/);
  assert.match(reportPage, /reauthSuggested/);

  assert.match(page, /setMacroEventKey/);
  assert.match(page, /setMacroBandKey/);
  assert.match(page, /setView/);
  assert.match(page, /portfolio-activity-tabs/);
  assert.match(page, /key: "holdings"/);
  assert.match(page, /key: "orders"/);
  assert.match(page, /key: "positions"/);
  assert.match(page, /key: "gtts"/);
  assert.match(page, /key: "tsls"/);
  assert.match(page, /5 \* 60 \* 1000/);
  assert.match(page, /\/api\/kite\/snapshot/);
  assert.match(page, /\/api\/content\/refresh/);
  assert.match(page, /force=1/);
  assert.match(page, /\/_health\/snapshot\?refresh=/);
  assert.match(page, /refreshAll/);
  assert.doesNotMatch(page, /startup-audit-banner/);
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
  assert.match(page, /Kite partial/);
  assert.match(page, /Kite cached/);
  assert.match(page, /Authenticate Kite/);
  assert.match(page, /Re-auth Kite/);
  assert.match(page, /\/api\/kite\/login\?force=1/);
  assert.match(page, /kiteAuthControl/);
  assert.match(page, /authStatus/);
  assert.match(page, /tokenExpiresAt/);
  assert.match(page, /nearTokenExpiry/);
  assert.match(page, /reauthSuggested/);
  assert.match(page, /snapshot\.authUrl/);
  assert.match(liveServer, /requestKiteLoginUrl/);
  assert.match(liveServer, /tokenExpiresAt/);
  assert.match(liveServer, /kiteDailyExpiryHint/);
  assert.match(liveServer, /reauthSuggested: marginsApiFault/);
  assert.match(reportPage, /06:00 IST/);
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
  assert.match(page, /new ResizeObserver\(fit\)/);
  assert.match(page, /workspace === "investment" &&/);
  assert.match(page, /workspace === "sectors" &&/);
  assert.match(page, /workspace === "intelligence" &&/);
  assert.match(page, /workspace === "health" &&/);
  assert.match(page, /IntelligenceWorkspace/);
  assert.match(page, /key: "intelligence"/);
  assert.doesNotMatch(page, /onOpenIntelligence/);
  assert.doesNotMatch(page, /intelligence-crosslink/);
  assert.doesNotMatch(page, /number="S-3"/);
  assert.match(page, /value === "market-intelligence"/);
  assert.match(page, /number="M-1" title="Market intelligence action board"/);
  assert.match(page, /number="M-2" title="Live intelligence digest"/);
  assert.match(page, /workspace="intelligence"/);
  assert.match(page, /number="S-1" title="Sectoral action board"/);
  assert.match(page, /number="H-1" title="Health action board"/);
  assert.doesNotMatch(page, /s1: \[\{ id: "board"/);
  assert.doesNotMatch(page, /h1: \[\{ id: "board"/);
  assert.match(page, /mergeEarningsCalendarEvents/);
  assert.match(page, /topic-feed-earnings/);
  assert.match(page, /Earnings calendar/);
  assert.match(page, /partitionCalendarActionFeeds/);
  assert.match(page, /partitionPersonalCalendarFeeds/);
  assert.match(page, /Hindu Holidays/);
  assert.match(page, /ariaLabel="India Holidays"|aria-label="India Holidays"/);
  assert.match(page, /✨ Astronomy & Space/);
  assert.match(page, /🏎️ F1/);
  assert.match(page, /💼 Work \+ 🔍 Jobs/);
  assert.match(page, /💸 Earnings/);
  assert.match(page, /🎸 Guitar Practice/);
  assert.match(page, /☀️ Daily/);
  assert.match(page, /🇮🇳 India Holidays/);
  assert.match(page, /🛕 Hindu Holidays/);
  assert.doesNotMatch(page, /\["Earnings","Work\/Jobs","Personal","Other"\]/);
  assert.match(page, /function EarningsMonthCalendar/);
  assert.match(page, /function dayKpiSlots/);
  assert.match(page, /showPerRowLabel/);
  assert.match(page, /event\.kpis\[column\.index\]/);
  assert.match(page, /earnings-month-grid/);
  assert.match(page, /KPI analysis/);
  assert.doesNotMatch(page, /event\.kpis\.find\(\(item\) => item\.label === label\)/);
  assert.match(page, /digest-panel-span/);
  assert.match(page, /digest-summary-bullets/);
  assert.match(page, /digestItemBullets/);
  assert.match(page, /earningsEventBullets/);
  assert.match(page, /showItemSummaries/);
  assert.match(globalCss, /digest-summary-bullets/);
  assert.match(contentServer, /summaryBullets\(/);
  assert.match(contentServer, /ZMTEPISODEDESCRIPTION/);
  assert.match(contentServer, /DIGEST_BULLET_MAX/);
  assert.match(contentServer, /content-only summary bullets/i);
  assert.match(globalCss, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(globalCss, /earnings-month-grid/);
  assert.match(globalCss, /kpi-row-label/);
  assert.match(globalCss, /topic-feed-earnings \{ min-width:0/);
  assert.match(globalCss, /topic-feed section\.topic-feed-earnings \{ grid-column:1\/-1/);
  assert.match(globalCss, /topic-feed section\.topic-feed-work \{ grid-column:1\/-1/);
  assert.doesNotMatch(globalCss, /topic-feed-scheduled,.topic-feed-completed,.topic-feed-daily,.topic-feed-repeats\{grid-column:1\/-1/);
  assert.match(globalCss, /\.topic-feed\{display:grid;align-items:start;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(globalCss, /@media\(max-width:1199px\)\{\.topic-feed\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(globalCss, /digest-panel-podcasts/);
  assert.match(globalCss, /topic-feed-check/);
  assert.match(globalCss, /rgba\(76,143,255,\.5\)/);
  assert.match(globalCss, /rgba\(227,194,106,\.5\)/);
  assert.match(globalCss, /rgba\(183,148,246,\.5\)/);
  assert.match(page, /topic-feed-work[\s\S]*?topic-feed-completed/);
  assert.match(page, /topic-feed-guitar[\s\S]*?topic-feed-india[\s\S]*?topic-feed-hindu[\s\S]*?topic-feed-earnings/);
  // Market Intelligence order: Newsletters | Axis → Podcasts → Calendar + action feeds
  assert.match(page, /Newsletter digest[\s\S]*?Axis Research[\s\S]*?digest-panel-podcasts[\s\S]*?digest-panel-span/);
  assert.match(page, /digest-panel-podcasts/);
  assert.match(page, /window\.localStorage\.setItem\(storageKey/);
  assert.match(page, /function CollapsibleSection/);
  assert.match(page, /aria-expanded=\{open\}/);
  assert.match(page, /healthIncognito/);
  assert.match(page, /Health statistics hidden/);
  assert.match(page, /function EarningsCalendarWorkbench/);
  assert.doesNotMatch(page, /function EarningsCalendarWorkbench\(\{ snapshot, content, selectedSectorId/);
  assert.doesNotMatch(page, /matchingEvents/);
  assert.doesNotMatch(page, /earnings-rail/);
  assert.doesNotMatch(page, /showAllEarnings/);
  assert.match(page, /export default function SectoralAnalytics/);
  assert.match(page, /Cross-industry breadth and common data/);
  assert.doesNotMatch(page, /All industries are visible/);
  assert.match(page, /Porter competitive pressure/);
  assert.match(page, /Top \{leaders\.length\} leaders/);
  assert.match(page, /Top \{laggards\.length\} laggards/);
  assert.match(page, /Fundamental values are transparent 1-5 research scores/);
  assert.match(page, /s2: \{ number: "S-2", title: "Industry Analytics"/);
  assert.match(page, /s3: \{ number: "S-3", title: "Benchmarks & Decision Lab"/);
  assert.match(page, /s4: \{ number: "S-4", title: "Earnings Calendar"/);
  assert.match(page, /number="S-1" title="Sectoral action board"/);
  assert.match(page, /number="I-1" title="Investment action board"/);
  assert.match(page, /number="I-2" title="Portfolio"/);
  assert.match(page, /number="I-3" title="Risk"/);
  assert.match(page, /number="I-4" title="Axis picks"/);
  assert.match(page, /Macro scenario lab/);
  assert.match(page, /macro-scenario-panel/);
  assert.match(page, /holdingOuterFill/);
  assert.ok(page.indexOf('number="I-1" title="Investment action board"') < page.indexOf('number="I-2" title="Portfolio"'));
  assert.ok(page.indexOf('number="I-2" title="Portfolio"') < page.indexOf('number="I-3" title="Risk"'));
  assert.ok(page.indexOf('number="I-3" title="Risk"') < page.indexOf('number="I-4" title="Axis picks"'));
  assert.ok(page.indexOf('number="I-3" title="Risk"') < page.indexOf("Macro scenario lab"));
  assert.doesNotMatch(page, /number="I-2" title="Investment desk"/);
  assert.doesNotMatch(page, /number="I-3" title="Macro scenario lab"/);
  assert.doesNotMatch(page, /number="I-5" title="Risk radar"/);
  assert.doesNotMatch(page, /number="I-6" title="Axis recommended stocks"/);
  assert.match(page, /className="panel analyst-matrix"/);
  assert.match(page, /className="analyst-table"/);
  assert.match(page, /data-label="What matters"/);
  assert.match(page, /thesisBullets\(/);
  assert.match(page, /ThesisBulletList/);
  assert.match(page, /mail-window calls/);
  assert.match(page, /Local evidence inventory/);
  assert.match(page, /last trading day/);
  assert.match(globalCss, /\.thesis-bullet-list/);
  assert.match(globalCss, /\.analyst-matrix/);
  assert.match(globalCss, /grid-template-areas:[\s\S]*"stock call"/);
  assert.match(page, /function AxisRecommendationWorkbench/);
  assert.match(page, /formatAxisTargetLine/);
  assert.match(page, /TARGET - \$\{label\} \(Axis Mail\)/);
  assert.match(page, /function axisProgressToTarget/);
  assert.match(page, /function AxisCmpProgressBar/);
  assert.match(page, /Progress to target/);
  assert.match(page, /CMP ÷ Axis target \(capped 100%\)/);
  assert.match(page, /axis-pick-cmp/);
  assert.match(globalCss, /\.axis-pick-list button \{[^}]*flex-direction:column/);
  assert.match(globalCss, /\.axis-target-line/);
  assert.match(globalCss, /\.axis-target-progress/);
  assert.match(globalCss, /\.axis-pick-cmp/);
  assert.doesNotMatch(page, /itemUpside === null \? item\.upside/);
  assert.doesNotMatch(page, /axis-upside-track/);
  assert.doesNotMatch(globalCss, /\.axis-upside-track/);
  assert.match(contentServer, /extractAxisRecommendations/);
  assert.match(contentServer, /from "\.\/axis-recommendations\.mjs"/);
  assert.match(page, /function SectorDecisionLab/);
  assert.match(page, /Investability decision radar/);
  assert.match(page, /Decision gate/);
  assert.match(page, /function DailyKanbanBoard/);
  assert.match(page, /className="kanban-board canonical-action-board"/);
  assert.match(page, /<DailyKanbanBoard workspace="investment"\/>/);
  assert.match(page, /<DailyKanbanBoard workspace="sectors"\/>/);
  assert.match(page, /<DailyKanbanBoard workspace="intelligence"\/>/);
  assert.match(page, /<DailyKanbanBoard workspace="health"\/>/);
  assert.doesNotMatch(page, /<DailyKanbanBoard[^>]+(?:lane|compact)=/);
  assert.doesNotMatch(globalCss, /\.kanban-board\.compact/);
  assert.match(globalCss, /\.canonical-action-board\{height:auto!important/);
  assert.match(page, /To do today/);
  assert.match(page, /Completed today/);
  assert.match(page, /resets at local midnight/);
  assert.match(page, /dashboard-kanban-\$\{workspace\}-v2/);
  assert.doesNotMatch(page, /current\.archived|state\.archived/);
  assert.match(page, /numericAdvantage/);
  assert.match(page, /SectorWorkspaceShell/);
  assert.match(page, /sector-overview-grid/);
  assert.match(page, /SECTION_PAGES/);
  assert.match(page, /pestelAxes\.map/);
  assert.match(page, /porterAxes\.map/);
  assert.doesNotMatch(page, /cageAxes\.map/);
  assert.match(page, /setSelectedKey/);
  assert.match(page, /selected\.kpis\.map/);
  assert.match(page, /resolveEarningsIdentity/);
  assert.doesNotMatch(page, /CAL-\$\{/);
  assert.doesNotMatch(page, /`CAL-/);
  assert.match(page, /blank-value/);
  assert.match(page, /KPI fields remain blank/);
  assert.match(page, /Object\.keys\(sectorCompanies\)/);
  assert.match(page, /refreshInFlightRef/);
  assert.match(page, /macro-event-tabs/);
  assert.match(page, /SELECTED \{event\.label\.toUpperCase\(\)\} RANGE/);
  assert.match(page, /mailItems\.length/);
  assert.match(reportPage, /overflowingPages/);
  assert.match(reportPage, /pdfOverflow|scrollHeight - page\.clientHeight/);
  assert.match(flaskGateway, /_authorized_health_post/);
  assert.match(flaskGateway, /PORTFOLIO_HEALTH_TOKEN/);
  assert.match(flaskGateway, /\/_startup\/audit/);
  assert.match(healthKitSync, /Authorization/);
  assert.match(healthKitSync, /HealthCredentialStore\.token\(\)/);
  assert.match(liveServer, /status: unavailable\.length \? "partial" : "live"/);
  assert.match(page, /skip-link/);
  assert.doesNotMatch(globalCss, /startup-audit-banner/);
  assert.doesNotMatch(packageJson, /html2canvas/);
  assert.doesNotMatch(packageJson, /html2pdf\.js/);
  assert.doesNotMatch(packageJson, /"jspdf"/);
  assert.doesNotMatch(globalCss, /@import "tailwindcss"/);
  assert.match(reportPage, /document\.head\.cloneNode\(true\)/);
  assert.match(reportPage, /querySelectorAll\("script"\)/);
  assert.match(reportPage, /JSON\.stringify\(\{ pages: pageDocuments \}\)/);
  assert.match(reportPage, /reportPages\.map\(\(page\) => page\.outerHTML\)\.join\(""\)/);
  assert.match(reportPage, /promptPdfDownload\(/);
  assert.match(reportPage, /choosePdfSaveHandle\(/);
  assert.match(reportPage, /showSaveFilePicker/);
  assert.match(reportPage, /anchor\.download = filename/);
  assert.match(reportPage, /window\.location\.assign\(downloadUrl\)/);
  assert.match(reportPage, /Download prepared PDF/);
  assert.match(reportPage, /Export Report/);
  assert.doesNotMatch(reportPage, /Refresh & Export/);
  assert.doesNotMatch(reportPage, /Saved to Downloads as/);
  assert.match(page, /Export Report/);
  assert.doesNotMatch(page, /Refresh & Export/);
  assert.match(reportDownloadRoute, /Content-Disposition/);
  assert.match(reportDownloadRoute, /attachment; filename=/);
  assert.match(reportDownloadRoute, /preparedPdfs\.size > 4/);
  assert.match(reportDownloadRoute, /savedToDownloads: false/);
  assert.match(reportDownloadRoute, /http:\/\/127\.0\.0\.1:3002\/render/);
  assert.match(reportDownloadServer, /--headless=new/);
  assert.match(reportDownloadServer, /--print-to-pdf=/);
  assert.match(reportDownloadServer, /-sDEVICE=pdfwrite/);
  assert.match(reportDownloadServer, /join\(workingDirectory, filename\)/);
  assert.doesNotMatch(reportDownloadServer, /homedir\(\),\s*"Downloads"/);
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
  assert.match(contentServer, /reminder\.ZCOMPLETED AS completed/);
  assert.match(contentServer, /reminderRecurrenceQuery/);
  assert.match(contentServer, /formatRepeatsOn\(/);
  assert.doesNotMatch(contentServer, /reminder\.ZCOMPLETED = 0/);
  assert.match(contentServer, /Scheduled Reminders/);
  assert.match(contentServer, /REMINDER_COMPLETED_CAP/);
  assert.match(contentServer, /classifyReminderTopic/);
  assert.match(page, /⏰ Scheduled/);
  assert.match(page, /✅ Completed/);
  assert.match(page, /☀️ Daily/);
  assert.match(page, /🔁 REPEATS ON/);
  assert.match(page, /🍿 Watchlist/);
  assert.match(page, /🔽 Download List/);
  assert.match(page, /All incomplete reminders from Daily and Log lists\./);
  assert.doesNotMatch(page, /Incomplete non-repeating items from Daily/);
  assert.match(page, /topic-feed-scheduled/);
  assert.match(page, /topic-feed-completed/);
  assert.match(page, /topic-feed-daily/);
  assert.match(page, /topic-feed-repeats/);
  assert.match(page, /topic-feed-watchlist/);
  assert.match(page, /topic-feed-download-list/);
  assert.match(page, /topic-feed-check/);
  assert.match(page, /\/api\/content\/reminders\/complete/);
  assert.match(page, /isScheduledRemindersCalendar/);
  assert.match(page, /isWatchlistReminderList/);
  assert.match(page, /isDownloadListReminderList/);
  assert.match(page, /isDailyReminderList\(item\.list\)/);
  assert.match(page, /\.\.\.dailyReminders,/);
  assert.doesNotMatch(page, /!isRepeatingReminder\(item\) && isDailyReminderList\(item\.list\)/);
  assert.match(page, /content bullets from mail body only/);
  assert.match(page, /title\/meta only \(no 5-bullet padding\)/);
  assert.match(contentServer, /\/reminders\/complete/);
  assert.match(contentServer, /completeReminderViaEventKit/);
  assert.match(contentServer, /completeReminderViaAppleScript/);
  assert.match(contentServer, /completeReminderInAppleReminders/);
  assert.match(contentServer, /complete-reminder-eventkit\.swift/);
  assert.doesNotMatch(contentServer, /sourceState\(reminders, reminderValue\.length, true\)/);
  assert.match(contentServer, /filter\(isAxisResearchMail\)/);
  assert.match(contentServer, /extractAxisRecommendations/);
  assert.match(contentServer, /macroEvidence/);
  assert.match(page, /Investment evidence refreshed from Mail for \{analysisWindowLabel\(content\)\}/);
  assert.match(page, /Axis Mail calls as-of \{axisAsOfLabel\} are prioritised/);
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
  assert.match(page, /Daily Optimism/);
  assert.match(page, /health-optimism-panel/);
  assert.match(page, /health-action-list/);
  assert.match(page, /Vital cadence/);
  assert.doesNotMatch(page, /Default comparison/);
  assert.doesNotMatch(page, /Daily optimisation/);
  assert.match(page, /healthNote=\{content\.healthNote\}/);
  assert.match(page, /dailyOptimism/);
  assert.match(contentServer, /function extractDailyOptimism/);
  assert.match(contentServer, /dailyOptimism:/);
  assert.doesNotMatch(page, /Health Daily v2/);
  {
    const healthWorkspace = await readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8");
    assert.match(healthWorkspace, /healthSnapshot\.status === "live" \? "SYNCED"/);
    assert.match(healthWorkspace, /healthSnapshot\.status === "cached" \? "CACHED"/);
    assert.match(healthWorkspace, /D · evening cutoff/);
    assert.match(healthWorkspace, /D · overnight window/);
    assert.match(healthWorkspace, /rejectedArchive/);
    assert.doesNotMatch(healthWorkspace, /Source reconciliation/);
    assert.doesNotMatch(healthWorkspace, /health-source-panel/);
    assert.doesNotMatch(healthWorkspace, /healthSnapshot\.sources/);
    const optimismAt = healthWorkspace.indexOf("Daily Optimism");
    const guidanceAt = healthWorkspace.indexOf("health-action-list");
    const masonryAt = healthWorkspace.indexOf("<HealthMasonryGrid");
    assert.ok(optimismAt >= 0 && guidanceAt >= 0 && masonryAt >= 0 && optimismAt < guidanceAt && guidanceAt < masonryAt, "Daily Optimism with rich guidance must render above Vital cadence / HealthMasonryGrid");
    assert.match(healthWorkspace, /HealthWorkspaceSection = "h2" \| "h3" \| "h4"/);
    assert.match(healthWorkspace, /number="H-1" title="Health action board"/);
    assert.match(healthWorkspace, /healthRouteFromUrl/);
    assert.match(healthWorkspace, /health-workspace-shell/);
    assert.match(healthWorkspace, /health-overview-console/);
    assert.match(healthWorkspace, /sector-overview-trio/);
    assert.match(healthWorkspace, /nutrition-1/);
    assert.match(healthWorkspace, /nutrition-2/);
    assert.match(healthWorkspace, /HealthIncognitoGate/);
    assert.match(globalCss, /\.health-metrics-overview/);
    assert.match(globalCss, /\.health-category-grid\.compact/);
    assert.match(globalCss, /\.viewport-console-active body\{overflow:hidden\}/);
    assert.match(globalCss, /\.sector-overview-grid\.sector-overview-trio/);
    assert.match(globalCss, /Typography floor: body UI/);
  }
  assert.match(flaskGateway, /@app\.route\("\/_health\/snapshot"/);
  assert.match(flaskGateway, /MAX_HEALTH_SNAPSHOT_BYTES/);
  assert.match(healthKitSync, /requestAuthorization/);
  assert.match(healthKitSync, /operational-day HealthKit aggregates/i);
  assert.match(healthKitSync, /HealthOperationalDatePolicy\.context/);
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
  assert.match(portfolioData, /LTF: .*sector: "Non Banking Financial Company"/);
  assert.match(portfolioData, /LTF: .*subSector: "Diversified Retail NBFC"/);
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
  assert.match(sectorServer, /loadYfinanceSectorQuotes/);
  assert.match(sectorServer, /getYfinanceSectorMarketSnapshot/);
  assert.match(sectorServer, /Prefer LTP first/);
  assert.match(sectorServer, /tool: "get_ltp"/);
  assert.match(sectorServer, /tool: "get_ohlc"/);
  assert.match(sectorServer, /tool: "get_quotes"/);
  assert.match(sectorServer, /quoteMode: attempt\.mode/);
  assert.match(sectorServer, /isInsufficientPermissionError/);
  assert.match(sectorServer, /rateLimitedUntil/);
  assert.match(sectorServer, /Kite Connect paid market-data permission is required/);
  assert.match(sectorServer, /callKiteTool\("get_historical_data"/);
  assert.match(sectorServer, /fetch-sector-quotes-yfinance\.py/);
  assert.match(sectorServer, /status: "live"/);
  assert.match(sectorServer, /Live yfinance NSE quotes/);
  assert.match(page, /LIVE YFINANCE/);
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
  assert.match(sectorData, /value: "270\.8 GW"/);
  assert.match(sectorData, /value: "₹257-259"/);
  assert.match(sectorData, /value: "5\.25%"/);
  assert.match(sectorData, /moneycontrol\.com/);
  assert.match(sectorData, /ndtvprofit\.com/);
  assert.match(sectorData, /US tariff path/);
  assert.match(sectorData, /Blinkit daily orders/);
  assert.match(globalCss, /\.workspace-navigation\s*\{/);
  assert.match(globalCss, /position:\s*sticky/);
  assert.match(globalCss, /\.sector-rank-grid/);
});

test("native iPhone shell exposes complete workspace, freshness, pairing and offline contracts", async () => {
  const [contentView, configuration, browser, status, shell, pairing, healthKit, flaskGateway, page] = await Promise.all([
    readFile(new URL("../apple-app/InvestmentDashboard/ContentView.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/PortfolioDashboardConfiguration.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardBrowser.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardStatus.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardShellViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/HealthPairing.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/HealthKitSync.swift", import.meta.url), "utf8"),
    readFile(new URL("../flask_gateway.py", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(configuration, /case investment[\s\S]*case sectors[\s\S]*case intelligence[\s\S]*case health/);
  assert.match(configuration, /URLQueryItem\(name: "view", value: rawValue\)/);
  assert.match(browser, /private\(set\) lazy var webView/);
  assert.match(browser, /portfolio-native-refresh/);
  assert.match(browser, /WKDownloadDelegate/);
  assert.match(status, /\/_flask\/health/);
  assert.match(status, /\/_startup\/audit/);
  assert.match(shell, /NativeWorkspacePicker/);
  assert.match(shell, /NativeFreshnessStrip/);
  assert.match(shell, /DashboardOfflineOverlay/);
  assert.match(shell, /DashboardOnboardingView/);
  assert.match(contentView, /HealthKitSyncCoordinator/);
  assert.match(pairing, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(healthKit, /HealthCredentialStore\.token\(\)/);
  assert.doesNotMatch(healthKit, /portfolio-local-health-token/);
  assert.match(flaskGateway, /@app\.post\("\/_health\/pair\/code"\)/);
  assert.match(flaskGateway, /@app\.post\("\/_health\/pair"\)/);
  assert.match(page, /portfolio-native-refresh/);
});
