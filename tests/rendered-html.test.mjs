import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isAxisResearchMail } from "../scripts/axis-mail-filter.mjs";
import { portfolioReturnTone } from "../app/portfolio-concentration.mjs";

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

test("portfolio concentration return colors keep neutral boundary values", () => {
  assert.equal(portfolioReturnTone(0.5001), "gain");
  assert.equal(portfolioReturnTone(0.5), "flat");
  assert.equal(portfolioReturnTone(0), "flat");
  assert.equal(portfolioReturnTone(-0.5), "flat");
  assert.equal(portfolioReturnTone(-0.5001), "loss");
});

test("Kite ticker orders require an exact reviewed confirmation before place_order", async () => {
  const [workspace, ticket, route, server, page] = await Promise.all([
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/KiteOrderTicket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/kite/order/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/kite-live-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, />BUY<\/button>.*>SELL<\/button>/);
  assert.match(workspace, /disabled=\{!isLive\}/);
  assert.match(ticket, /reviewed && confirmation\.trim\(\)\.toUpperCase\(\) === expected/);
  assert.match(ticket, /`Place \$\{selection\.side\} order`/);
  assert.match(route, /expectedConfirmation = `\$\{side\} \$\{quantity\} \$\{symbol\}`/);
  assert.match(server, /callKiteTool\("place_order"/);
  assert.match(page, /orders require an explicit reviewed order ticket and typed confirmation/);
});

test("nested portfolio allocation markup remains protected", async () => {
  const investmentWorkspace = await readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8");
  const start = investmentWorkspace.indexOf('<section className="panel chart-panel nested-chart-panel">');
  const end = investmentWorkspace.indexOf('<div className="portfolio-analysis-stack">', start);
  assert.ok(start >= 0 && end > start, "protected donut JSX boundaries must exist");
  const donutMarkup = investmentWorkspace.slice(start, end).replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(donutMarkup).digest("hex"), "68d6cfd01caad0bde086d7e973cc1ef820e5475f067954d5ec936bf567a7827b");
});

test("Podcast sender groups expose collapsible masonry and a Playwright geometry contract", async () => {
  const [intelligenceWorkspace, globalCss, geometryTest] = await Promise.all([
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("./podcast-masonry.playwright.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(intelligenceWorkspace, /layout\?: DigestGroupLayout/);
  assert.match(intelligenceWorkspace, /sender-group sender-group-collapsible/);
  assert.doesNotMatch(intelligenceWorkspace, /<details className="sender-group sender-group-collapsible"[^>]*\sopen[\s>]/);
  assert.match(intelligenceWorkspace, /<summary className="sender-group-header"[^>]*>/);
  assert.match(intelligenceWorkspace, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(intelligenceWorkspace, /layout="podcasts"/);
  assert.match(globalCss, /\.sender-groups-podcasts\s*\{[^}]*display:block;[^}]*column-count:2;[^}]*column-gap:8px;/s);
  assert.match(globalCss, /\.sender-groups-podcasts \.sender-group\s*\{[^}]*margin:0 0 8px;[^}]*break-inside:avoid;/s);
  assert.doesNotMatch(globalCss, /\.sender-groups-podcasts\s*\{[^}]*grid-template-columns/s);
  assert.match(globalCss, /@media\(max-width:980px\)\{\.sender-groups-podcasts\{column-count:1\}\}/);
  assert.match(
    globalCss,
    /\.sender-groups\.sender-groups-podcasts\s*\{[^}]*display:\s*block\s*!important;[^}]*column-count:\s*2;[^}]*column-gap:\s*8px;/s,
  );
  assert.match(
    globalCss,
    /\.sender-groups\.sender-groups-podcasts\s*>\s*\.sender-group\s*\{[^}]*display:\s*inline-block\s*!important;[^}]*margin:\s*0 0 8px;[^}]*break-inside:\s*avoid;/s,
  );
  assert.match(geometryTest, /getBoundingClientRect/);
  assert.match(geometryTest, /gap <= gutter \+ 0\.5/);
  assert.match(geometryTest, /current\.index > previous\.index/);
});

test("Market Intelligence digests collapse newsletters by sender and Axis by topic with source links", async () => {
  const [intelligenceWorkspace, contentServer, contentTypes, globalCss, pdfRoute] = await Promise.all([
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/content-digest-server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/content-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/axis-research/pdf/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(intelligenceWorkspace, /layout="axis"/);
  assert.match(intelligenceWorkspace, /axisTopicFromTitle|topicGroup/);
  assert.match(intelligenceWorkspace, /Open in Mail/);
  assert.match(intelligenceWorkspace, /Open PDF/);
  assert.match(intelligenceWorkspace, /Open in Podcasts/);
  assert.match(intelligenceWorkspace, /DigestSourceLinks/);
  assert.match(intelligenceWorkspace, /return "Description"/);
  assert.match(intelligenceWorkspace, /keyTakeaways/);
  assert.match(contentTypes, /messageUrl\?:/);
  assert.match(contentTypes, /pdfUrl\?:/);
  assert.match(contentTypes, /topicGroup\?:/);
  assert.match(contentServer, /mailMessageId\(/);
  assert.match(contentServer, /mailMessageUrl\(/);
  assert.match(contentServer, /matchAxisResearchPdf\(/);
  assert.match(contentServer, /axisTopicGroup\(/);
  assert.match(contentServer, /preferApplePodcastsEpisodeUrl\(/);
  assert.match(contentServer, /deduplicatePodcastEpisodes\(/);
  assert.match(pdfRoute, /application\/pdf/);
  assert.match(pdfRoute, /AXIS_PDF_ARCHIVE_PATH|Downloads\/Axis Research/);
  assert.match(globalCss, /\.digest-source-link\s*\{/);
});

test("Sectoral Analytics uses full-width collapsible sections without overview thumbnails", async () => {
  const [workspace, analytics, decisionLab, sharedUi, globalCss] = await Promise.all([
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorDecisionLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /className="sector-workspace-shell sector-full-workspace"/);
  assert.doesNotMatch(workspace, /SectorThumbnail|sector-overview-grid|sector-thumbnail/);
  assert.doesNotMatch(workspace, /classList\.add\("sector-console-active", "viewport-console-active"\)/);
  assert.doesNotMatch(workspace, /style\.height|window\.innerHeight|overflow:hidden/);

  for (const [number, title] of [
    ["S-1", "Sectoral action board"],
    ["S-2", "Industry Analytics"],
    ["S-3", "Benchmarks & Decision Lab"],
  ]) {
    assert.match(workspace, new RegExp(`(?:number="${number}"|number=\\{SECTION_META\\.${number.toLowerCase().replace("-", "")}\\.number\\})[\\s\\S]*?title=(?:"${title}"|\\{SECTION_META\\.${number.toLowerCase().replace("-", "")}\\.title\\})`));
  }
  assert.ok(workspace.indexOf('number="S-1"') < workspace.indexOf("number={SECTION_META.s2.number}"));
  assert.ok(workspace.indexOf("number={SECTION_META.s2.number}") < workspace.indexOf("number={SECTION_META.s3.number}"));
  assert.match(workspace, /<DailyKanbanBoard workspace="sectors"\/>/);
  assert.match(workspace, /<SectoralAnalytics selectedIds=\{selectedSectorIds\}/);
  assert.match(workspace, /<SectorDecisionLab page=\{activePages\.s3 as SectorDecisionPage\}/);
  assert.doesNotMatch(workspace, /S-4|s4|Earnings|EarningsMonthCalendar|EarningsCalendarWorkbench/);
  assert.match(workspace, /SECTOR_TOP_SECTIONS/);
  assert.match(workspace, /<WorkspaceSectionNav[\s\S]*label="Sectoral Analytics sections"/);
  assert.match(workspace, /\{ id: "s1", label: "Action Board" \}/);
  assert.match(workspace, /\{ id: "s2", label: "Industry Analytics" \}/);
  assert.match(workspace, /\{ id: "s3", label: "Benchmarks & Decision Lab" \}/);
  assert.match(sharedUi, /export function WorkspaceSectionNav/);
  assert.match(sharedUi, /role="tablist"/);
  assert.match(sharedUi, /aria-selected=\{selected\}/);
  assert.match(sharedUi, /event\.key === "ArrowRight"/);
  assert.match(globalCss, /\.workspace-section-nav\s*,\s*\.intelligence-section-nav\s*\{/);
  assert.match(globalCss, /\.workspace-section-nav button\.active\s*,\s*\.intelligence-section-nav button\.active/);

  assert.match(sharedUi, /aria-expanded=\{open\} aria-controls=\{contentId\}/);
  assert.match(workspace, /role="tab"[\s\S]*?aria-selected=\{activePage === item\.id\}[\s\S]*?aria-controls=\{`sector-\$\{section\}-panel`\}/);
  assert.match(workspace, /event\.key === "ArrowLeft"/);
  assert.match(workspace, /event\.key === "ArrowRight"/);
  assert.match(globalCss, /\.collapse-button:focus-visible\s*\{[^}]*outline:/s);
  assert.match(globalCss, /\.sector-inline-page-nav > div button:focus-visible\s*\{[^}]*outline:/s);

  assert.match(globalCss, /\.sector-workspace-shell\.sector-full-workspace\s*\{[^}]*height:auto;[^}]*overflow:visible;/s);
  assert.match(globalCss, /\.sector-full-workspace > \.workspace-section\s*\{[^}]*max-height:none;[^}]*overflow:visible;/s);
  assert.match(globalCss, /@media\(max-width:760px\)[\s\S]*?\.sector-full-section-body \.macro-decision-chart-layout\s*\{[^}]*grid-template-columns:1fr;/s);

  assert.match(analytics, /data-sector-filter=\{filterActive \? selectedIds\.join/);
  assert.match(decisionLab, /const \[sectorId, setSectorId\] = useState\("pharma"\)/);
  assert.match(workspace, /<SectorDecisionLab page=\{activePages\.s3 as SectorDecisionPage\} benchmarks=\{benchmarks\} marketsBySector=\{sectorMarketById\}\/>/);
  assert.doesNotMatch(workspace, /sector-dimmed|aria-disabled/);
  assert.doesNotMatch(workspace, /IntelligenceWorkspace|intelligence-crosslink|Live intelligence digest|Market Intelligence/);
});

test("Phase 3 Market Intelligence automation remains wired to local source paths", async () => {
  const [workspace, contentServer, podcastSummarizer, contentTypes, dashboardRefresh, globalCss, cron] = await Promise.all([
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/content-digest-server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/podcast-summarizer.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/content-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/refresh/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../config/scheduler/content-refresh.cron", import.meta.url), "utf8"),
  ]);
  assert.match(contentServer, /exactMailbox\(account, "Axis Research"\)/);
  assert.match(contentServer, /classifyAxisTags/);
  assert.match(contentServer, /classifyNewsletterSentiment/);
  assert.match(contentServer, /keyTakeaways: contentBullets/);
  assert.match(contentServer, /summarizePodcastTranscript\(transcript/);
  assert.match(podcastSummarizer, /chunkPodcastTranscript/);
  assert.match(podcastSummarizer, /configuredPodcastSummarizer/);
  assert.match(contentServer, /reminderVisual\(topic\)/);
  assert.match(contentTypes, /axisLastFetchedAt/);
  assert.match(dashboardRefresh, /axisResearchLastFetchedAt/);
  assert.match(workspace, /dashboard-saved-items-v1/);
  assert.match(workspace, /Read Later/);
  assert.match(workspace, /findEarningsHolidayConflicts/);
  assert.match(workspace, /Transcript summary/);
  assert.match(workspace, /Description evidence only — transcript summary not generated/);
  assert.doesNotMatch(workspace, /Episode description/);
  assert.match(workspace, /Open in Podcasts/);
  assert.match(globalCss, /font-size:12px/);
  assert.match(globalCss, /background:var\(--reminder-bg\)/);
  assert.match(cron, /0 \* \* \* \*/);
});

test("server-renders the portfolio dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Portfolio Intelligence<\/title>/i);
  assert.match(html, /Investment Brief/);
  assert.match(html, /All sources · 5 min/);
  assert.match(html, /Kite snapshot/);
  assert.match(html, /Dashboard workspaces/);
  assert.match(html, /Sectoral Analytics/);
  assert.match(html, /Health incognito/);
  assert.match(html, /Hide health statistics/);
  assert.match(html, /Dashboard appearance/);
  assert.match(html, />Black</);
  assert.match(html, />Dark</);
  assert.match(html, />Sepia</);
  // Sections start collapsed: headings + Expand controls remain, body content stays unmounted.
  assert.match(html, /collapsible-section collapsed/);
  assert.match(html, /Investment action board/);
  assert.match(html, /Expand Investment action board/);
  assert.match(html, /Expand Portfolio/);
  assert.match(html, /Expand Risk/);
  assert.match(html, /Expand Axis picks/);
  assert.doesNotMatch(html, /Collapse Portfolio/);
  assert.doesNotMatch(html, /Top-two concentration/);
  assert.doesNotMatch(html, /Nested portfolio allocation/);
  assert.doesNotMatch(html, /Macro scenario lab/);
  assert.doesNotMatch(html, /Analyst call matrix/);
  assert.doesNotMatch(html, /Company composition and performance/);
  assert.doesNotMatch(html, /Read-only wellness view/);
});

test("CollapsibleSection defaults to collapsed with v2 open-only persistence", async () => {
  const [sharedUi, investment, sectors, intelligence, health] = await Promise.all([
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(sharedUi, /portfolio-section-v2-\$\{number\}-open/);
  assert.match(sharedUi, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(sharedUi, /getItem\(storageKey\) === "true"/);
  assert.match(sharedUi, /dashboard-expand-section/);
  assert.match(sharedUi, /export function expandDashboardSection/);
  assert.match(sharedUi, /export function dashboardSectionNumberFromNavId/);
  assert.doesNotMatch(sharedUi, /getItem\(storageKey\) !== "false"/);
  assert.match(intelligence, /function IntelligenceFeedSection[\s\S]*?const \[open, setOpen\] = useState\(false\)/);
  for (const workspace of [investment, sectors, intelligence, health]) {
    assert.match(workspace, /expandDashboardSection\(dashboardSectionNumberFromNavId\(/);
  }
});

test("Market Intelligence defines M-1 through M-4 with exclusive M-3 earnings", async () => {
  const workspace = await readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8");
  for (const [number, title] of [
    ["M-1", "Action Board"],
    ["M-2", "Live Intelligence"],
    ["M-3", "Earnings Calendar"],
    ["M-4", "Calendar + Reminders"],
  ]) assert.match(workspace, new RegExp(`number="${number}" title="${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.equal((workspace.match(/data-earnings-owner="m3"/g) ?? []).length, 1);
  assert.match(workspace, /exactEarningsCalendarItems|mergeEarningsCalendarEvents/);
  assert.match(workspace, /!isEarningsCalendar\(item\.calendar\)/);
  assert.doesNotMatch(workspace, /calendar-earnings-feed/);
  assert.equal((workspace.match(/kind="calendar"/g) ?? []).length, 1);
  assert.equal((workspace.match(/kind="reminders"/g) ?? []).length, 1);
  assert.equal((workspace.match(/<ReminderBox/g) ?? []).length, 3);
  assert.match(workspace, /data-feed-section=\{kind\}/);
  assert.match(workspace, /data-reminder-group=\{label\}/);
  assert.match(workspace, /aria-expanded=\{open\}[\s\S]*aria-controls=\{contentId\}/);
  assert.match(workspace, /label=\{COMPLETED_FEED_LABEL\}/);
  assert.match(workspace, /label=\{SCHEDULED_FEED_LABEL\}/);
  assert.match(workspace, /label=\{WORK_JOBS_LABEL\}/);
  assert.match(workspace, /Apple Calendar entries are scheduling evidence only/);
  assert.match(workspace, /view="live"/);
  assert.match(workspace, /view="calendar-reminders"/);
  assert.match(workspace, /url\.searchParams\.set\("section", section\)/);
  assert.match(workspace, /<WorkspaceSectionNav[\s\S]*label="Market Intelligence sections"/);
  assert.match(workspace, /INTELLIGENCE_SECTIONS/);
  assert.doesNotMatch(workspace, /WATCHLIST_FEED_LABEL|DOWNLOAD_LIST_FEED_LABEL|sector-intelligence-filter|sector-dimmed/);
});

test("all four workspaces share consistent cyan section navigation bars", async () => {
  const [sharedUi, investment, sectors, intelligence, health, globalCss] = await Promise.all([
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(sharedUi, /export function WorkspaceSectionNav/);
  assert.match(sharedUi, /role="tablist"/);
  assert.match(sharedUi, /role="tab"/);
  assert.match(sharedUi, /aria-selected=\{selected\}/);
  assert.match(sharedUi, /event\.key === "ArrowLeft"/);
  assert.match(sharedUi, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(globalCss, /\.workspace-section-nav button span[\s\S]*color:#72aaff/);
  assert.match(globalCss, /\.workspace-section-nav button\.active[\s\S]*background:#182534/);
  assert.match(globalCss, /\.workspace-section-nav button:focus-visible/);

  for (const [source, label, sections] of [
    [investment, "Investment sections", [
      ['i1', "Action Board"],
      ['i2', "Portfolio"],
      ['i3', "Risk"],
      ['i4', "Axis picks"],
    ]],
    [sectors, "Sectoral Analytics sections", [
      ['s1', "Action Board"],
      ['s2', "Industry Analytics"],
      ['s3', "Benchmarks & Decision Lab"],
    ]],
    [intelligence, "Market Intelligence sections", [
      ['m1', "Action Board"],
      ['m2', "Live Intelligence"],
      ['m3', "Earnings Calendar"],
      ['m4', "Calendar + Reminders"],
    ]],
    [health, "Health & Wellness sections", [
      ['h1', "Action Board"],
      ['h2', "Daily Optimism"],
      ['h3', "Vital Metrics"],
    ]],
  ]) {
    assert.match(source, new RegExp(`<WorkspaceSectionNav[\\s\\S]*label="${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    for (const [id, title] of sections) {
      assert.match(source, new RegExp(`\\{ id: "${id}", label: "${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" \\}`));
    }
  }

  assert.match(investment, /id="investment-i1"/);
  assert.match(investment, /id="investment-i4"/);
  assert.match(sectors, /id="sector-s1"/);
  assert.match(sectors, /id="sector-s3"/);
  assert.match(intelligence, /id="intelligence-m1"/);
  assert.match(intelligence, /id="intelligence-m4"/);
  assert.match(health, /id="health-h1"/);
  assert.match(health, /id="health-h2"/);
  assert.match(health, /id="health-h3"/);
  assert.match(health, /searchParams\.set\("focus"/);
  assert.doesNotMatch(health, /id="health-h4"|\{ id: "h4"|number="H-4"|Health Status|Daily Guidance|HealthStatusOverview|HealthStatusWorkbench/);
  assert.doesNotMatch(sectors, /S-4|s4|EarningsMonthCalendar|sector-intelligence-filter|sector-dimmed/);
  assert.doesNotMatch(health, /health-overview-console|<HealthThumbnail/);
  assert.match(health, /health-full-workspace/);
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
  assert.doesNotMatch(reportPage, /reauthSuggested/);

  assert.match(page, /setMacroEventKey/);
  assert.match(page, /setMacroBandKey/);
  assert.match(page, /setView/);
  assert.match(page, /portfolio-activity-tabs/);
  assert.match(page, /key: "holdings"/);
  assert.match(page, /key: "orders"/);
  assert.match(page, /key: "positions"/);
  assert.match(page, /key: "gtts"/);
  assert.match(page, /key: "tsls"/);
  assert.match(page, /type PortfolioMapDatum = Pick<LiveHolding/);
  assert.match(page, /currentPortfolioValue > 0 \? holding\.value \/ currentPortfolioValue \* 100 : 0/);
  assert.match(page, /Portfolio concentration map/);
  assert.match(page, /Tile size = portfolio weight/);
  assert.match(page, /Color = unrealised return/);
  assert.match(page, /setSelectedHoldingSymbol\(\(current\) => current === symbol \? null : symbol\)/);
  assert.match(page, /aria-pressed=\{selected\}/);
  assert.match(page, /onMouseEnter=\{\(\) => setEngagedHoldingSymbol\(holding\.symbol\)\}/);
  assert.match(page, /className=\{activeHoldingSymbol === holding\.symbol \? "holding-column-active"/);
  assert.match(globalCss, /\.portfolio-analysis-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[^}]*align-items:stretch/s);
  assert.match(globalCss, /\.portfolio-analysis-stack\s*\{[^}]*grid-template-rows:auto minmax\(0,1fr\)/s);
  assert.match(globalCss, /\.portfolio-activity-mobile\s*\{\s*display:none/);
  assert.match(globalCss, /@media \(max-width:620px\)[\s\S]*\.portfolio-activity-table\s*\{\s*display:none;\s*\}[\s\S]*\.portfolio-activity-mobile\s*\{\s*display:grid/);
  assert.doesNotMatch(reportPage, /Portfolio concentration map/);
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
  assert.match(page, /items=\{visibleNewsletters\}/);
  assert.match(page, /items=\{visibleAxis\}/);
  assert.match(page, /visiblePodcasts\.map|podcasts\.map/);
  assert.match(page, /SenderDigestGroups/);
  assert.match(page, /groupDigestItems/);
  assert.match(page, /axisTopicFromTitle|topicGroup/);
  assert.match(page, /Open in Mail|Open in Podcasts|Open PDF/);
  assert.match(globalCss, /\.sender-group\s*\{/);
  assert.match(globalCss, /background:color-mix\(in srgb,var\(--sender-color\) 14%, var\(--bg-panel\)\)/);
  assert.doesNotMatch(globalCss, /background:color-mix\(in srgb,var\(--sender-color\) 30%,transparent\)/);
  assert.match(page, /matchesSelectedSector/);
  assert.match(page, /data-sector-filter/);
  assert.match(page, /aria-pressed=/);
  assert.match(globalCss, /sector-dimmed/);
  assert.doesNotMatch(globalCss, /sector-intelligence-filter/);
  assert.match(page, /Kite authenticated/);
  assert.match(page, /Kite partial/);
  assert.match(page, /Kite cached/);
  assert.match(page, /Authenticate Kite/);
  assert.doesNotMatch(page, /Re-auth Kite/);
  assert.match(page, /\/api\/kite\/login\?force=1/);
  assert.match(page, /kiteAuthControl/);
  assert.match(page, /authStatus/);
  assert.match(page, /tokenExpiresAt/);
  assert.match(page, /nearTokenExpiry/);
  assert.match(page, /showAuthAction/);
  assert.match(page, /snapshot\.authUrl/);
  assert.match(liveServer, /requestKiteLoginUrl/);
  assert.match(liveServer, /tokenExpiresAt/);
  assert.match(liveServer, /kiteDailyExpiryHint/);
  assert.match(liveServer, /reauthSuggested: false/);
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
  assert.match(page, /number="M-1" title="Action Board"/);
  assert.match(page, /number="M-2" title="Live Intelligence"/);
  assert.match(page, /number="M-3" title="Earnings Calendar"/);
  assert.match(page, /number="M-4" title="Calendar \+ Reminders"/);
  assert.match(page, /workspace="intelligence"/);
  assert.match(page, /number="S-1" title="Sectoral action board"/);
  assert.match(page, /number="H-1" title="Health action board"/);
  assert.doesNotMatch(page, /s1: \[\{ id: "board"/);
  assert.doesNotMatch(page, /h1: \[\{ id: "board"/);
  assert.match(page, /mergeEarningsCalendarEvents/);
  assert.match(page, /data-earnings-owner="m3"/);
  assert.doesNotMatch(page, /calendar-earnings-feed/);
  assert.match(page, /Earnings calendar/);
  assert.match(page, /partitionReminderSmartGroups/);
  assert.match(page, /sortCalendarItems/);
  assert.match(page, /groupCalendarItemsBySource/);
  assert.match(page, /calendarGroups\.map/);
  assert.match(page, /className="calendar-source-group"/);
  assert.match(page, /aria-labelledby=\{headingId\}/);
  assert.match(page, /group\.items\.map/);
  assert.match(page, /data-feed-section=\{kind\}/);
  assert.equal((page.match(/kind="calendar"/g) ?? []).length, 1);
  assert.equal((page.match(/kind="reminders"/g) ?? []).length, 1);
  assert.equal((page.match(/<ReminderBox/g) ?? []).length, 3);
  assert.match(page, /label=\{COMPLETED_FEED_LABEL\}/);
  assert.match(page, /label=\{SCHEDULED_FEED_LABEL\}/);
  assert.match(page, /label=\{WORK_JOBS_LABEL\}/);
  assert.match(page, /aria-expanded=\{open\}[\s\S]*?aria-controls=\{contentId\}/);
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
  assert.match(globalCss, /\.intelligence-feed-stack\s*\{[^}]*display:grid;/s);
  assert.match(globalCss, /\.intelligence-feed-stack\.topic-feed[\s\S]*?column-count:\s*auto\s*!important/s);
  assert.match(page, /intelligence-feed-stack agenda-ribbon triptych-command/);
  assert.doesNotMatch(page, /intelligence-feed-stack topic-feed agenda-ribbon/);
  assert.match(globalCss, /\.intelligence-feed-collapse:focus-visible\s*\{[^}]*outline:/s);
  assert.match(globalCss, /\.reminder-smart-groups\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(globalCss, /\.calendar-complete-feed\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\);/s);
  assert.match(globalCss, /\.calendar-complete-feed\s*\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto;/s);
  assert.match(globalCss, /max-width:1200px[^}]*\.calendar-complete-feed\s*\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(globalCss, /max-width:900px[^}]*\.calendar-complete-feed\s*\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(globalCss, /max-width:620px[^}]*\.calendar-complete-feed\s*\{\s*grid-template-columns:minmax\(0,1fr\)/s);
  assert.match(globalCss, /digest-panel-podcasts/);
  assert.match(globalCss, /topic-feed-check/);
  assert.match(page, /topic-feed-completed[\s\S]*?topic-feed-scheduled[\s\S]*?topic-feed-work/);
  // Market Intelligence order: Newsletters | Axis → Podcasts → Calendar + action feeds
  assert.match(page, /Newsletter digest[\s\S]*?Axis Research[\s\S]*?digest-panel-podcasts[\s\S]*?digest-panel-span/);
  assert.match(page, /digest-panel-podcasts/);
  assert.match(page, /window\.localStorage\.setItem\(storageKey/);
  assert.match(page, /function CollapsibleSection/);
  assert.match(page, /aria-expanded=\{open\}/);
  assert.match(page, /healthIncognito/);
  assert.match(page, /Health statistics hidden/);
  assert.match(page, /function MarketEarningsCalendar/);
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
  assert.doesNotMatch(page, /s4: \{ number: "S-4"/);
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
  assert.match(page, /archive calls/);
  assert.match(page, /mail-window/);
  assert.match(page, /PDF-archive policy/);
  assert.match(page, /last trading day/);
  assert.match(globalCss, /\.thesis-bullet-list/);
  assert.match(globalCss, /\.analyst-matrix/);
  assert.match(globalCss, /grid-template-areas:[\s\S]*"stock call"/);
  assert.match(page, /function AxisRecommendationWorkbench/);
  assert.match(page, /formatAxisTargetLine/);
  assert.match(page, /TARGET - \$\{label\} \(\$\{sourceLabel\}\)/);
  assert.match(page, /function axisProgressToTarget/);
  assert.match(page, /function AxisCmpProgressBar/);
  assert.match(page, /Progress to target/);
  assert.match(page, /CMP ÷ Axis target \(capped 100%\)|Kite CMP ÷ Axis target|yfinance CMP ÷ Axis target/);
  assert.match(page, /axis-pick-cmp/);
  assert.match(page, /mergeHoldingTradingCalls|axisHoldingTradingCalls|AXIS_HOLDING_TRADING_SYMBOLS/);
  assert.match(page, /ETERNAL|ICICIBANK|JSWENERGY|BHARTIARTL/);
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
  assert.equal((page.match(/className="workspace-section action-board-workspace-section"/g) ?? []).length, 4);
  assert.match(globalCss, /\.action-board-workspace-section\s*\{[^}]*max-height:none\s*!important;[^}]*overflow:visible\s*!important;/s);
  assert.match(globalCss, /\.sector-workspace-shell\s*>\s*\.action-board-workspace-section\s*\{[^}]*overflow:visible\s*!important;/s);
  assert.match(page, /To do today/);
  assert.match(page, /Completed today/);
  assert.match(page, /resets at local midnight/);
  assert.match(page, /dashboard-kanban-\$\{workspace\}-v2/);
  assert.doesNotMatch(page, /current\.archived|state\.archived/);
  assert.match(page, /numericAdvantage/);
  assert.match(page, /SectorWorkspaceShell/);
  assert.doesNotMatch(page, /SectorThumbnail/);
  assert.match(page, /SECTION_PAGES/);
  assert.match(page, /pestelAxes\.map/);
  assert.match(page, /porterAxes\.map/);
  assert.doesNotMatch(page, /cageAxes\.map/);
  assert.match(page, /const selectDay/);
  assert.match(page, /event\.kpis\[column\.index\]/);
  assert.match(page, /resolveEarningsIdentity/);
  assert.doesNotMatch(page, /CAL-\$\{/);
  assert.doesNotMatch(page, /`CAL-/);
  assert.match(page, /className="blank">n\/p/);
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
  assert.doesNotMatch(contentServer, /REMINDER_COMPLETED_CAP|\.slice\(0,\s*REMINDER_COMPLETED_CAP\)/);
  assert.match(contentServer, /isExcludedReminderList/);
  assert.match(contentServer, /🇩🇪♾🇮🇳/);
  assert.match(contentServer, /reminder\.ZPRIORITY/);
  assert.match(contentServer, /reminder\.ZFLAGGED/);
  assert.match(contentServer, /classifyReminderTopic/);
  assert.match(page, /Scheduled Important/);
  assert.match(page, /Work \/ Job 🔍/);
  assert.doesNotMatch(page, /WATCHLIST_FEED_LABEL|DOWNLOAD_LIST_FEED_LABEL|REPEATS_FEED_LABEL|DAILY_FEED_LABEL/);
  assert.match(page, /topic-feed-scheduled/);
  assert.match(page, /topic-feed-completed/);
  assert.match(page, /reminder-smart-groups/);
  assert.match(page, /topic-feed-check/);
  assert.match(page, /\/api\/content\/reminders\/complete/);
  assert.match(page, /isScheduledRemindersCalendar/);
  assert.match(page, /partitionReminderSmartGroups/);
  assert.match(page, /scheduledImportantReminders/);
  assert.match(page, /workJobReminders/);
  assert.match(page, /content bullets from mail body only/);
  assert.match(page, /Calendar and Reminders show title\/meta without 5-bullet padding/);
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
    assert.match(healthWorkspace, /resolveHealthSection/);
    assert.match(healthWorkspace, /LEGACY_STATUS_PAGES/);
    assert.doesNotMatch(healthWorkspace, /Source reconciliation/);
    assert.doesNotMatch(healthWorkspace, /health-source-panel/);
    assert.doesNotMatch(healthWorkspace, /healthSnapshot\.sources/);
    const optimismAt = healthWorkspace.indexOf('number="H-2" title="Daily Optimism"');
    const guidanceAt = healthWorkspace.indexOf('<HealthGuidanceWorkbench page="optimism"', optimismAt);
    const masonryAt = healthWorkspace.indexOf("<HealthMasonryGrid categories={healthSnapshot.categories}/>", optimismAt);
    assert.ok(optimismAt >= 0 && guidanceAt >= 0 && masonryAt >= 0 && optimismAt < guidanceAt && guidanceAt < masonryAt, "Daily Optimism with rich guidance must render above Vital cadence / HealthMasonryGrid");
    assert.match(healthWorkspace, /HEALTH_TOP_SECTIONS/);
    assert.match(healthWorkspace, /<WorkspaceSectionNav[\s\S]*label="Health & Wellness sections"/);
    assert.match(healthWorkspace, /HealthWorkspaceSection = "h2" \| "h3"/);
    assert.match(healthWorkspace, /number="H-1" title="Health action board"/);
    assert.match(healthWorkspace, /healthRouteFromUrl/);
    assert.match(healthWorkspace, /health-workspace-shell/);
    assert.doesNotMatch(healthWorkspace, /health-overview-console/);
    assert.doesNotMatch(healthWorkspace, /<HealthThumbnail/);
    assert.doesNotMatch(healthWorkspace, /Health Status|Daily Guidance|number="H-4"|HealthStatusOverview|HealthStatusWorkbench|id="health-h4"|\{ id: "h4"/);
    assert.match(healthWorkspace, /number="H-2" title="Daily Optimism"/);
    assert.match(healthWorkspace, /number="H-3" title="Vital Metrics"/);
    assert.match(healthWorkspace, /<HealthMasonryGrid categories=\{healthSnapshot\.categories\}\/>/);
    assert.match(healthWorkspace, /nutrition-1/);
    assert.match(healthWorkspace, /nutrition-2/);
    assert.match(healthWorkspace, /HealthIncognitoGate/);
    assert.match(globalCss, /\.health-metrics-overview/);
    assert.match(globalCss, /\.health-direction-grid/);
    assert.match(globalCss, /\.health-cat-heart/);
    assert.match(globalCss, /\.health-direction-grid\.compact/);
    assert.match(globalCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(globalCss, /html\[data-appearance="sepia"\] \.health-kpi-tile/);
    assert.doesNotMatch(globalCss, /\.direction-unavailable/);
    const utilsSource = await readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8");
    assert.match(utilsSource, /Exclude<HealthDirectionBucket, "unavailable">/);
    assert.doesNotMatch(utilsSource, /title: "Average unavailable"/);
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
  assert.match(page, /primarySectorEarly/);
  assert.match(page, /allSectorsEarly/);
  assert.match(page, /loadSectorNews/);
  assert.match(page, /\/api\/sectors\/news/);
  assert.match(page, /Object\.keys\(sectorCompanies\)/);
  assert.match(page, /filter\(\(sectorId\) => sectorId !== primaryId\)/);
  assert.match(page, /isUsableSectorMarketStatus/);
  assert.match(await readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"), /aggregateSectorMarketStatus/);
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
  assert.match(sectorData, /Economic Times, Financial Times, Bloomberg, Zerodha, Moneycontrol/);
  assert.match(sectorData, /US tariff path/);
  assert.match(sectorData, /Blinkit daily orders/);
  assert.match(await readFile(new URL("../app/sector-news-server.ts", import.meta.url), "utf8"), /economic_times/);
  assert.match(await readFile(new URL("../app/api/sectors/news/route.ts", import.meta.url), "utf8"), /getSectorNewsSnapshot/);
  assert.match(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /News \+ sentiment/);
  assert.match(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /sector-news-sentiment-grid/);
  assert.match(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /\.slice\(0, 3\)/);
  assert.match(globalCss, /\.sector-news-sentiment-grid/);
  assert.match(globalCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
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

test("brutalist appearance themes wire toggle, FOUC, tokens and vo-pop motion", async () => {
  const [sharedUi, page, layout, globalCss, visualCss] = await Promise.all([
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-overhaul.css", import.meta.url), "utf8"),
  ]);

  assert.match(sharedUi, /export function AppearanceToggle/);
  assert.match(sharedUi, /Dashboard appearance/);
  assert.match(sharedUi, /Black[\s\S]*Dark[\s\S]*Sepia/);
  assert.match(page, /AppearanceToggle/);
  assert.match(page, /dashboard-appearance/);
  assert.match(page, /document\.documentElement\.dataset\.appearance/);
  assert.match(page, /appearanceHydrated/);
  assert.match(layout, /data-appearance="black"/);
  assert.match(layout, /dashboard-appearance/);
  assert.match(layout, /document\.documentElement\.dataset\.appearance/);

  assert.match(globalCss, /--bg-page/);
  assert.match(globalCss, /--btn-bg/);
  assert.match(globalCss, /--brutalist-shadow-lg/);
  assert.match(globalCss, /html\[data-appearance="dark"\]/);
  assert.match(globalCss, /html\[data-appearance="sepia"\]/);
  assert.match(globalCss, /html\[data-appearance="dark"\][\s\S]*--bg-page:#0d1117/);
  assert.match(globalCss, /html\[data-appearance="dark"\][\s\S]*--btn-bg:#000000/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--bg-page:#faf7f2/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--btn-bg:#1a140f/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--btn-fg:#faf6ee/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--ink:#000000/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--muted:#000000/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--navy:#000000/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--chart-tick:#000000/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--chart-label:#000000/);
  assert.match(globalCss, /html\[data-appearance="sepia"\][\s\S]*--on-dark:#fffdf9/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.nested-chart-panel[\s\S]*?background:var\(--bg-panel\) !important/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.nested-chart-panel \.panel-title[\s\S]*color:var\(--ink\) !important/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.nested-chart-panel \.ring-key[\s\S]*color:var\(--muted\) !important/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.analytics-subhead span[\s\S]*color:var\(--ink\)/);
  assert.doesNotMatch(globalCss, /html\[data-appearance="sepia"\][\s\S]*?--muted:#4a3f32/);
  assert.doesNotMatch(globalCss, /html\[data-appearance="sepia"\][\s\S]*?--ink:#1a140f/);
  /* Decision Lab / page navs paperize with black text (not dark chrome) */
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.sector-page-nav[\s\S]*?background:var\(--bg-panel\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.sector-page-nav>div button[\s\S]*?color:var\(--ink\)/);
  assert.doesNotMatch(globalCss, /html\[data-appearance="sepia"\] \.sector-page-nav\s*\{[^}]*background:var\(--btn-bg\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.decision-purpose[\s\S]*?background:var\(--bg-panel\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.decision-purpose small[\s\S]*?color:var\(--ink\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.decision-lab-sector-selector button[\s\S]*?color:var\(--ink\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.workspace-section-nav button[\s\S]*?color:var\(--ink\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.section-heading p[\s\S]*?color:var\(--ink\)/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.trigger-dial b[\s\S]*?color:\s*var\(--ink\)\s*!important/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.trigger-dial small[\s\S]*?color:\s*var\(--ink\)\s*!important/);
  assert.match(globalCss, /\.kanban-card[\s\S]*color:var\(--ink\)/);
  assert.match(globalCss, /\.kanban-lane>header[\s\S]*background:var\(--btn-bg\)/);
  assert.match(globalCss, /\.kanban-lane>header b[\s\S]*color:var\(--btn-fg\)/);
  assert.match(globalCss, /color-mix\(in srgb,var\(--sender-color\) 14%, var\(--bg-panel\)\)/);
  assert.doesNotMatch(globalCss, /color-mix\(in srgb,var\(--sender-color\) 30%,transparent\)/);
  assert.match(globalCss, /\.appearance-toggle/);
  /* Sepia paperizes dark dashboard islands (nested allocation, macro lab, evidence) */
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.scenario-shell[\s\S]*?background:var\(--bg-panel\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.macro-regime-card[\s\S]*?background:var\(--bg-panel\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.macro-selected-evidence[\s\S]*?background:var\(--bg-panel\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.exposure-driver-head[\s\S]*?background:var\(--bg-table-head\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.portfolio-activity-matrix thead th[\s\S]*?background:var\(--bg-table-head\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.kanban-lane>header[\s\S]*?background:var\(--bg-table-head\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.risk-explanation[\s\S]*?background:var\(--bg-panel\)/);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.sector-news-sentiment-column[\s\S]*?background:var\(--bg-panel\)/);
  assert.doesNotMatch(globalCss, /Intentional dark chrome islands/);

  assert.match(visualCss, /\.vo-pop/);
  assert.match(visualCss, /@keyframes vo-pop-press/);
  assert.match(visualCss, /--brutalist-shadow-lg/);
  assert.match(visualCss, /\.collapsible-content[\s\S]*vo-magnetic/);
  assert.match(visualCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(visualCss, /\.digest-panel\.briefing-rail \.evidence-chip:not\(\.focused\)[\s\S]*?opacity:\s*1/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.orbital-planet \.nested-chart-panel[\s\S]*var\(--bg-panel\) !important/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.risk-panel\.threat-flower[\s\S]*var\(--bg-panel\) !important/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.macro-workbench\.scenario-weather \.macro-event-tabs button\.active/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.lifecycle-panel\.evolution-river \.chart-wrap/);
});
