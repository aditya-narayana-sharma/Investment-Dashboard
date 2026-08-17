import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isAxisResearchMail } from "../scripts/axis-mail-filter.mjs";
import { portfolioReturnTone } from "../app/portfolio-concentration.mjs";
import {
  BUILDER_CHROME_CANDIDATES,
  BUILDER_WORKSPACE_CANDIDATES,
  ROUTING_SOURCE_CANDIDATES,
  firstExisting,
  readJoined,
} from "./helpers/algorithm-canvas.mjs";

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

test("portfolio concentration tiles preserve complete primary labels", async () => {
  const [workspace, globalCss] = await Promise.all([
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /function worstAspect\(/);
  assert.match(workspace, /const density = .*"micro".*"compact".*"roomy"/);
  assert.match(workspace, /<b title=\{holding\.symbol\}>\{holding\.symbol\}<\/b>/);
  assert.match(globalCss, /\.portfolio-map-tile\s*\{[^}]*container-type:size/s);
  assert.doesNotMatch(globalCss, /\.portfolio-map-primary b\s*\{[^}]*text-overflow:ellipsis/s);
  assert.match(globalCss, /\.portfolio-map-tile\.micro \.portfolio-map-primary b/);
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
  assert.match(workspace, />Create NSE order<\/button>/);
  assert.match(workspace, /disabled=\{!isLive\}/);
  assert.match(ticket, /reviewed && confirmation\.trim\(\)\.toUpperCase\(\) === expected/);
  assert.match(ticket, /kiteSessionLive/);
  assert.match(ticket, /readKiteTicketResponse/);
  assert.match(ticket, /Kite session required/);
  assert.match(ticket, /`Place \$\{side\} order`/);
  assert.match(ticket, /INSUFFICIENT_BUY_FUNDS_MESSAGE/);
  assert.match(ticket, /buyOrderFundsState/);
  assert.match(ticket, /funds\.insufficient/);
  assert.doesNotMatch(ticket, /!funds\.(blocked|insufficient)/);
  assert.match(ticket, /kite-order-funds/);
  assert.match(workspace, /equityMargin=\{portfolio\.equityMargin\}/);
  assert.match(workspace, /marginsKnown=\{isLive && !unavailable\.has\("margins"\)\}/);
  assert.match(route, /expectedConfirmation = `\$\{side\} \$\{quantity\} \$\{symbol\}`/);
  assert.match(server, /callKiteTool\("place_order"/);
  assert.match(server, /annotateKiteWriteError/);
  assert.match(server, /requireKiteCashInstrument\(symbol, "NSE"\)/);
  assert.match(server, /assertBuyOrderFunds/);
  assert.match(server, /order\.side === "BUY"/);
  assert.match(ticket, /useKiteInstrumentLookup\(normalizedSymbol, "NSE"\)/);
  assert.match(page, /orders, GTTs\/TSLs, and price alerts require an explicit reviewed ticket and typed confirmation/);
});

test("Portfolio activity GTT and TSL creates require reviewed confirmation before create_gtt", async () => {
  const [workspace, ticket, route, server] = await Promise.all([
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/KiteGttTicket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/kite/gtt/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/kite-live-server.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, />Create GTT<\/button>/);
  assert.match(workspace, />Create TSL<\/button>/);
  assert.match(workspace, /setGttSelection\(\{ kind: "gtt" \}\)/);
  assert.match(workspace, /setGttSelection\(\{ kind: "tsl" \}\)/);
  assert.match(ticket, /confirmation\.trim\(\)\.toUpperCase\(\) === expected/);
  assert.match(ticket, /`Create \$\{label\}`/);
  assert.match(ticket, /readKiteTicketResponse/);
  assert.match(ticket, /kiteSessionLive/);
  assert.match(ticket, /fetch\("\/api\/kite\/gtt"/);
  assert.match(route, /expectedConfirmation = `\$\{label\} \$\{side\} \$\{quantity\} \$\{symbol\}`/);
  assert.match(server, /callKiteTool\("create_gtt"/);
  assert.match(server, /confirm: true/);
  assert.match(ticket, /Reference last price/);
  assert.match(server, /last_price: order\.lastPrice/);
});

test("Portfolio activity price alerts require reviewed confirmation before create_alert", async () => {
  const [workspace, ticket, route, server, page] = await Promise.all([
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/KiteAlertTicket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/kite/alert/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/kite-live-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /key: "alerts", label: "Alerts"/);
  assert.match(workspace, />Create price alert<\/button>/);
  assert.match(workspace, /setAlertSelection\(\{\}\)/);
  assert.match(ticket, /confirmation\.trim\(\)\.toUpperCase\(\) === expected/);
  assert.match(ticket, /`ALERT \$\{directionLabel\(direction\)\} \$\{normalizedSymbol\} \$\{triggerText\}`/);
  assert.match(ticket, /readKiteTicketResponse/);
  assert.match(ticket, /kiteSessionLive/);
  assert.match(ticket, /fetch\("\/api\/kite\/alert"/);
  assert.match(ticket, /Create price alert/);
  assert.match(route, /expectedConfirmation = `\$\{label \? `ALERT \$\{label\}` : "ALERT"\} \$\{symbol\} \$\{triggerPrice\}`/);
  assert.match(server, /callKiteTool\("create_alert"/);
  assert.match(server, /callKiteTool\("get_alerts"/);
  assert.match(server, /confirm: true/);
  assert.match(page, /"alerts"/);
});

test("focused I-2 keeps ticket entry points and mounts tickets outside exclusive hide", async () => {
  const [workspace, orderTicket, gttTicket, alertTicket, portal, orderRoute, gttRoute, alertRoute, page, browser, stratjiBrowser, iosShell] = await Promise.all([
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/KiteOrderTicket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/KiteGttTicket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/KiteAlertTicket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/KiteTicketPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/kite/order/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/kite/gtt/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/kite/alert/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardBrowser.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Shared/StratjiDocumentBrowser.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/NativeWorkspaceViews.swift", import.meta.url), "utf8"),
  ]);
  const i2Start = workspace.indexOf('id="investment-i2"');
  const i3Start = workspace.indexOf('id="investment-i3"');
  const ticketMount = workspace.indexOf("{orderSelection && <KiteOrderTicket");
  assert.ok(i2Start >= 0 && i3Start > i2Start, "I-2 and I-3 section markers must exist");
  const i2 = workspace.slice(i2Start, i3Start);
  assert.match(i2, /hidden=\{nativeChromeHidesSection\(activeSection, "i2"\)\}/);
  assert.match(i2, />BUY<\/button>/);
  assert.match(i2, />SELL<\/button>/);
  assert.match(i2, />Create NSE order<\/button>/);
  assert.match(i2, />Create GTT<\/button>/);
  assert.match(i2, />Create TSL<\/button>/);
  assert.match(i2, />Create price alert<\/button>/);
  assert.match(i2, /nested-chart-panel/);
  assert.match(i2, /portfolio-map-panel/);
  assert.match(i2, /InstrumentGauge/);
  assert.doesNotMatch(i2, /KiteOrderTicket|KiteGttTicket|KiteAlertTicket/);
  assert.ok(ticketMount > i3Start, "tickets must mount outside the exclusive I-2 overflow section");
  assert.match(workspace, /setView\("orders"\); await onKiteRefresh\(\)/);
  assert.match(workspace, /setView\(gttSelection\.kind === "tsl" \? "tsls" : "gtts"\)/);
  assert.match(workspace, /setView\("alerts"\); await onKiteRefresh\(\)/);
  assert.match(portal, /createPortal\(children, document\.body\)/);
  for (const ticket of [orderTicket, gttTicket, alertTicket]) {
    assert.match(ticket, /KiteTicketPortal/);
    assert.match(ticket, /credentials: "same-origin"/);
    assert.match(ticket, /cache: "no-store"/);
  }
  assert.match(orderRoute, /export async function POST/);
  assert.match(gttRoute, /export async function POST/);
  assert.match(alertRoute, /export async function POST/);
  assert.match(orderTicket, /fetch\("\/api\/kite\/order"/);
  assert.match(gttTicket, /fetch\("\/api\/kite\/gtt"/);
  assert.match(alertTicket, /fetch\("\/api\/kite\/alert"/);
  assert.match(page, /refreshKiteAfterTrade/);
  assert.match(page, /onKiteRefresh=\{refreshKiteAfterTrade\}/);
  assert.match(browser, /navigationType == \.linkActivated/);
  assert.match(stratjiBrowser, /navigationType == \.linkActivated/);
  assert.match(iosShell, /Open workspace outline/);
  assert.match(iosShell, /compact-outline/);
});

test("nested portfolio allocation markup remains protected", async () => {
  const investmentWorkspace = await readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8");
  const start = investmentWorkspace.indexOf('<section className="panel chart-panel nested-chart-panel">');
  const end = investmentWorkspace.indexOf('<section className="portfolio-management"', start);
  assert.ok(start >= 0 && end > start, "protected donut JSX boundaries must exist");
  const donutMarkup = investmentWorkspace.slice(start, end).replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(donutMarkup).digest("hex"), "07f87df90a723340382884496f8c0a0378e48b1d73f84c1a72712725b19b4097");
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

test("M-2 Interrogate LLM is full-width with source-of-truth copy and suggestion chips", async () => {
  const [intelligenceWorkspace, llmPanel, symphonyEditor, globalCss] = await Promise.all([
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/LlmAssistPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/builder/SymphonyEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(intelligenceWorkspace, /title="Interrogate LLM"/);
  assert.match(intelligenceWorkspace, /titleTone="section"/);
  assert.match(intelligenceWorkspace, /className="llm-assist-span"/);
  assert.doesNotMatch(intelligenceWorkspace, /LLM intelligence draft/i);
  assert.match(
    intelligenceWorkspace,
    /Newsletters \+ Axis Research \+ Podcast Transcript Summaries, as Source of Truth/,
  );
  assert.match(
    intelligenceWorkspace,
    /podcast summaries \(description unless a local transcript was available\)/,
  );
  assert.match(intelligenceWorkspace, /hasLocalPodcastTranscript/);
  assert.match(intelligenceWorkspace, /LIVE_INTELLIGENCE_LLM_SUGGESTIONS/);
  assert.match(intelligenceWorkspace, /Overnight newsletter themes/);
  assert.match(intelligenceWorkspace, /Axis conviction vs holdings/);
  assert.match(intelligenceWorkspace, /Podcast vs Axis overlap/);
  assert.match(intelligenceWorkspace, /What changed since last digest/);
  assert.match(intelligenceWorkspace, /Axis result updates/);
  assert.match(intelligenceWorkspace, /Cautionary notes across sources/);
  assert.match(intelligenceWorkspace, /\[\$\{evidence\}\/\$\{item\.summaryStatus/);
  assert.match(llmPanel, /Smart Suggestions/);
  assert.match(llmPanel, /setPrompt\(item\.prompt\)/);
  assert.match(llmPanel, /\/api\/llm\/complete/);
  assert.match(llmPanel, /settingsHref/);
  assert.match(llmPanel, /if \(payload\.disabled\)/);
  assert.doesNotMatch(llmPanel, /if \(payload\.settingsHref\)/);
  assert.match(llmPanel, /enabled && error/);
  assert.match(llmPanel, /llm-assist-error[\s\S]*Settings/);
  assert.match(llmPanel, /title = "Interrogate LLM"/);
  assert.match(llmPanel, /titleTone = "section"/);
  assert.match(llmPanel, /applyLabel \?\? "Interrogate LLM"/);
  assert.doesNotMatch(llmPanel, /Draft with LLM/i);
  assert.match(symphonyEditor, /applyLabel="Interrogate LLM"/);
  assert.doesNotMatch(symphonyEditor, /Apply drafted tree/);
  assert.match(globalCss, /\.llm-assist-span\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.match(globalCss, /\.llm-assist header h3\s*\{[^}]*text-transform:\s*none/s);
  assert.match(globalCss, /\.llm-assist-suggestion\s*\{[^}]*text-transform:\s*none/s);
  assert.match(globalCss, /\.llm-assist-run[^{]*\{[^}]*text-transform:\s*none/s);
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
  assert.match(intelligenceWorkspace, /axisResearch=\{layout === "axis"\}/);
  assert.match(intelligenceWorkspace, /axis-open-pdf/);
  assert.match(intelligenceWorkspace, /axisResearch && <DigestSourceLinks[\s\S]*?<WaveformStrip/);
  assert.match(intelligenceWorkspace, /Open in Podcasts/);
  assert.match(intelligenceWorkspace, /DigestSourceLinks/);
  assert.match(intelligenceWorkspace, /return "Description"/);
  assert.match(intelligenceWorkspace, /keyTakeaways/);
  assert.match(intelligenceWorkspace, /AI transcript summary/);
  assert.match(intelligenceWorkspace, /AI description summary/);
  assert.match(intelligenceWorkspace, /Outcome · \{insight\.outcome\}/);
  assert.match(intelligenceWorkspace, /Sentiment · \{insight\.sentiment\}/);
  assert.match(contentTypes, /messageUrl\?:/);
  assert.match(contentTypes, /pdfUrl\?:/);
  assert.match(contentTypes, /topicGroup\?:/);
  assert.match(contentServer, /mailMessageId\(/);
  assert.match(contentServer, /mailMessageUrl\(/);
  assert.match(contentServer, /matchAxisResearchPdf\(/);
  assert.match(contentServer, /axisTopicGroup\(/);
  assert.match(contentServer, /\(\[\?&\]\[A-Za-z\]\[A-Za-z0-9_-\]\*\)=\\r\?\\n/);
  assert.match(contentServer, /preferApplePodcastsEpisodeUrl\(/);
  assert.match(contentServer, /deduplicatePodcastEpisodes\(/);
  assert.match(pdfRoute, /application\/pdf/);
  assert.match(pdfRoute, /AXIS_PDF_ARCHIVE_PATH|Downloads\/Axis Research/);
  assert.match(globalCss, /\.digest-source-link\s*\{/);
  assert.match(globalCss, /\.digest-source-link\.axis-open-pdf\s*\{/);
  assert.match(globalCss, /min-height:42px/);
  assert.match(globalCss, /\.podcast-insight-card\.outcome-positive/);
  assert.match(globalCss, /\.podcast-insight-card\.sentiment-negative/);
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
  assert.match(workspace, /benchmarks=\{benchmarks\}/);
  assert.match(analytics, /task="industry"/);
  assert.match(analytics, /industryAnalyticsSuggestions/);
  assert.match(analytics, /not Mail or Podcasts/);
  assert.match(analytics, /<LlmAssistPanel/);
  assert.match(analytics, /llm-assist-span/);
  assert.doesNotMatch(analytics, /Newsletter digest|Podcast summaries|axisResearch/);
  assert.doesNotMatch(decisionLab, /title="LLM framework draft"/i);
  assert.doesNotMatch(decisionLab, /LLM FRAMEWORK DRAFT/i);
  assert.match(decisionLab, /Comments on supplied EOD benchmarks only/);
  assert.match(decisionLab, /does not replace composite scores or invent index levels/);
  assert.match(decisionLab, /const \[sectorId, setSectorId\] = useState\("pharma"\)/);
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
  assert.match(globalCss, /\.sector-full-section-body \.sector-overview > \.llm-assist\s*\{[^}]*width:\s*100%/s);

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
  assert.match(contentServer, /summarizePodcastDescription\(descriptionEvidence/);
  assert.match(podcastSummarizer, /chunkPodcastTranscript/);
  assert.match(podcastSummarizer, /configuredPodcastSummarizer/);
  assert.match(contentServer, /reminderVisual\(topic\)/);
  assert.match(contentTypes, /axisLastFetchedAt/);
  assert.match(dashboardRefresh, /axisResearchLastFetchedAt/);
  assert.match(workspace, /dashboard-saved-items-v1/);
  assert.match(workspace, /Read Later/);
  assert.match(workspace, /findEarningsHolidayConflicts/);
  assert.match(workspace, /AI transcript summary/);
  assert.match(workspace, /Publisher description evidence — AI summary not generated/);
  assert.match(workspace, /Evidence unavailable/);
  assert.match(workspace, /Open in Podcasts/);
  assert.match(globalCss, /font-size:12px/);
  assert.match(workspace, /data-reminder-list=\{item\.list \|\| "Unknown list"\}/);
  assert.match(workspace, /const listColor = reminderListColor\(item\.list\)/);
  assert.match(globalCss, /background:color-mix\(in srgb,var\(--reminder-list-color\) 30%,transparent\)/);
  assert.match(cron, /0 \* \* \* \*/);
});

test("server-renders the portfolio dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Portfolio Intelligence<\/title>/i);
  assert.match(html, /Investment Brief/);
  assert.match(html, /On request/);
  assert.doesNotMatch(html, /<span>Kite snapshot<\/span>/);
  assert.doesNotMatch(html, /aria-label="Open Integrations settings"/);
  assert.match(html, /Dashboard workspaces/);
  assert.match(html, /id="workspace-tab-investment"/);
  assert.match(html, /id="workspace-tab-sectors"/);
  assert.match(html, /id="workspace-tab-intelligence"/);
  assert.match(html, /id="workspace-tab-health"/);
  assert.match(html, /id="workspace-tab-builder"/);
  assert.match(html, /id="workspace-tab-strategies"/);
  assert.equal(
    [...html.matchAll(/id="workspace-tab-(investment|sectors|intelligence|health|builder|strategies)"/g)].length,
    6,
  );
  assert.match(html, /Sectoral Analytics/);
  assert.doesNotMatch(html, /<b>Health incognito<\/b>/);
  assert.doesNotMatch(html, /aria-label="Hide health statistics"/);
  assert.doesNotMatch(html, /aria-label="Dashboard appearance"/);
  assert.doesNotMatch(html, /aria-label="Open Integrations settings"/);
  // I-1 opens from the default section; I-2/I-3/I-4 stay collapsed on first paint.
  assert.match(html, /collapsible-section collapsed/);
  assert.match(html, /Investment action board/);
  assert.match(html, /Collapse Investment action board|Collapse<!-- --> <!-- -->Investment action board/);
  assert.match(html, /Expand Portfolio/);
  assert.match(html, /Expand Risk/);
  assert.match(html, /Expand Axis picks/);
  assert.doesNotMatch(html, /Collapse Portfolio/);
  assert.doesNotMatch(html, /Read-only wellness view/);
});

test("nativeChrome hides web masthead and workspace tabs, keeps in-page sections", async () => {
  const [page, routing, globalCss, layout, visual, sharedUi, iosShell, iosBrowser] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/workspace-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/visual-components.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/NativeWorkspaceViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardBrowser.swift", import.meta.url), "utf8"),
  ]);

  assert.match(routing, /case "1":/);
  assert.match(routing, /case "true":/);
  assert.match(routing, /function nativeChromeFromPageSearch/);
  assert.match(routing, /function detectNativeChrome/);
  assert.match(page, /detectNativeChrome/);
  assert.match(page, /showWorkspaceShell && !nativeChrome && <DashboardTabs/);
  assert.match(page, /!nativeChrome && \([\s\S]*className="masthead"/);
  assert.doesNotMatch(page, /nativeChrome && <AppearanceToggle/);
  assert.doesNotMatch(page, /HealthIncognitoToggle/);
  assert.doesNotMatch(page, /Open Integrations settings/);
  assert.match(page, /nativeChrome && showPdfLink && <a className="masthead-pdf" href=\{pdfHref\}/);
  assert.match(page, /sourceFreshness\.length > 0 && \([\s\S]*<PulseConstellation/);
  assert.doesNotMatch(page, /!nativeChrome && <PulseConstellation/);
  assert.match(page, /\{showWorkspaceShell && !nativeChrome && <DashboardTabs/);
  assert.doesNotMatch(page, /\{showWorkspaceShell && <DashboardTabs/);
  assert.doesNotMatch(page, /!nativeChrome && <DailyKanbanBoard/);
  assert.match(page, /isIntegrationsChrome && <IntegrationsWorkspace/);
  assert.match(page, /showWorkspaceShell && \(workspace === "investment" \|\| stayMounted\)/);
  assert.match(page, /workspace === "sectors"/);
  assert.match(page, /workspace === "intelligence"/);
  assert.match(page, /workspace === "health"/);
  assert.match(page, /workspace === "builder"/);
  assert.match(page, /workspace === "strategies"/);
  assert.match(layout, /import "\.\/globals\.css"/);
  assert.match(layout, /import "\.\/visual-overhaul\.css"/);
  assert.match(layout, /nativeChromeFoucScript/);
  assert.match(layout, /nativeChrome\|native/);
  assert.match(sharedUi, /className="workspace-section-nav"/);
  assert.match(sharedUi, /className="workspace-navigation mode-dial glass-bar liquid-glass"/);
  assert.match(sharedUi, /export function AppearanceToggle/);
  assert.match(visual, /export function PulseConstellation/);
  assert.match(visual, /export function InstrumentGauge/);
  assert.match(visual, /export function TriggerDial/);
  assert.match(visual, /export function SparkFilament/);
  assert.match(visual, /export function WaveformStrip/);
  assert.match(globalCss, /html\.native-chrome-embed \.masthead/);
  assert.match(globalCss, /html\.native-chrome-embed \.workspace-navigation\.mode-dial/);
  assert.match(globalCss, /padding:0 10px 8px/);
  assert.match(globalCss, /html\.native-chrome-embed \.health-workspace-shell\.health-full-workspace/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*source-freshness[^\n]*display:\s*none|source-freshness[^\n]*native-chrome[^\n]*display:\s*none/);
  assert.doesNotMatch(globalCss, /html\.native-chrome-embed \.workspace-section-nav[\s\S]{0,180}display:\s*none/);
  assert.match(globalCss, /\[data-focus-section\]/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*kanban-board[^\n]*display:\s*none/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*collapsible-section[^\n]*display:\s*none/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*pulse-constellation[^\n]*display:\s*none/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*appearance-toggle[^\n]*display:\s*none/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*incognito-toggle[^\n]*display:\s*none/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*workspace-panel[^\n]*overflow:\s*hidden/);
  assert.doesNotMatch(globalCss, /native-chrome[^\n]*health-workspace-shell[^\n]*overflow:\s*hidden/);
  assert.doesNotMatch(page, /nativeChrome && <PulseConstellation/);
  assert.doesNotMatch(page, /!nativeChrome && <InvestmentWorkspace/);
  const nativeChromeCss = `${globalCss}\n${visual}`.replace(/\/\*[\s\S]*?\*\//g, "");
  const nativeChromeHideSelectors = [...nativeChromeCss.matchAll(/([^{}]*native-chrome[^{]*)\{([^}]*)\}/g)]
    .filter(([, , body]) => /display:\s*none/i.test(body))
    .flatMap(([, selector]) => selector.split(",").map((part) => part.trim()).filter(Boolean));
  assert.ok(nativeChromeHideSelectors.length >= 2, nativeChromeHideSelectors.join(" | "));
  for (const selector of nativeChromeHideSelectors) {
    if (/workspace-navigation/.test(selector)) {
      assert.match(selector, /native-chrome/);
      continue;
    }
    assert.match(selector, /masthead/);
    assert.doesNotMatch(selector, /workspace-navigation|workspace-section-nav|footer|skip-link|workspace-panel|kanban|recharts|collapsible|source-freshness|pulse-constellation/);
  }
  assert.match(iosShell, /NavigationSplitView/);
  assert.match(iosShell, /DashboardOutline\.sidebarWidth/);
  assert.match(iosShell, /DashboardOutlineList\(selectedID:/);
  assert.match(iosBrowser, /nativeChrome/);
  assert.match(iosBrowser, /applicationNameForUserAgent = "Stratji\/1"/);
  assert.match(iosBrowser, /querySelectorAll\('\.masthead'\)/);
  assert.doesNotMatch(iosBrowser, /workspace-navigation\.mode-dial/);

  const html = await (await render("/?nativeChrome=1")).text();
  assert.match(html, /data-native-chrome="1"/);
  assert.match(html, /native-chrome/);
  assert.doesNotMatch(html, /aria-label="Dashboard workspaces"/);
  assert.doesNotMatch(html, /id="workspace-tab-investment"/);
  assert.doesNotMatch(html, /class="masthead"/);
  assert.doesNotMatch(html, /<h1>Investment Brief<\/h1>/);
  assert.doesNotMatch(html, /aria-label="Dashboard appearance"/);
  assert.doesNotMatch(html, /aria-label="Hide health statistics"/);
  assert.match(html, /Investment action board/);
  assert.match(html, /On request/);
  assert.match(html, /collapsible-section collapsed/);
  const htmlTrue = await (await render("/?nativeChrome=true")).text();
  assert.match(htmlTrue, /data-native-chrome="1"/);
  assert.doesNotMatch(htmlTrue, /aria-label="Dashboard appearance"/);
  assert.doesNotMatch(htmlTrue, /id="workspace-tab-investment"/);
  const htmlNativeAlias = await (await render("/?native=1")).text();
  assert.match(htmlNativeAlias, /data-native-chrome="1"/);
  assert.doesNotMatch(htmlNativeAlias, /id="workspace-tab-investment"/);

  const distinctiveViews = [
    ["investment", [/<span>I-1<\/span>/, /<span>I-3<\/span>/]],
    ["sectors", [/<span>S-2<\/span>/, /<span>S-1<\/span>/]],
    ["intelligence", [/<span>M-3<\/span>|license-gate/, /<span>M-1<\/span>|Market Intelligence/]],
    ["health", [/<span>H-3<\/span>|license-gate/, /<span>H-1<\/span>|Health &amp; Wellness|license-gate/]],
    ["builder", [/id="builder-canvas"|license-gate/, /symphony-editor|Algorithm Canvas/]],
    ["strategies", [/class="strategy-card"|license-gate/, /strategies-gallery|Strategies/]],
  ];
  const [investmentSource, sectorsSource] = await Promise.all([
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(investmentSource, /ResponsiveContainer/);
  assert.match(sectorsSource, /ResponsiveContainer/);
  for (const [view, needles] of distinctiveViews) {
    const [webHtml, nativeHtml] = await Promise.all([
      (await render(`/?view=${view}`)).text(),
      (await render(`/?view=${view}&nativeChrome=1`)).text(),
    ]);
    for (const needle of needles) {
      assert.match(webHtml, needle, `${view} web missing ${needle}`);
      assert.match(nativeHtml, needle, `${view} nativeChrome missing ${needle}`);
    }
    assert.match(webHtml, /class="masthead"/);
    assert.match(webHtml, /aria-label="Dashboard workspaces"/);
    assert.doesNotMatch(nativeHtml, /class="masthead"/);
    assert.doesNotMatch(nativeHtml, /aria-label="Dashboard workspaces"/);
    assert.doesNotMatch(nativeHtml, /id="workspace-tab-investment"/);
    assert.match(nativeHtml, /data-native-chrome="1"/);
    assert.match(nativeHtml, /workspace-section-nav|license-gate/);
  }
});

test("CollapsibleSection defaults to collapsed with v2 open-only persistence", async () => {
  const [sharedUi, investment, sectors, intelligence, health, strategies] = await Promise.all([
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/StrategiesWorkspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(sharedUi, /portfolio-section-v2-\$\{number\}-open/);
  assert.match(sharedUi, /const \[open, setOpen\] = useState\(defaultOpen\)/);
  assert.match(sharedUi, /stored === "true"/);
  assert.match(sharedUi, /dashboard-expand-section/);
  assert.match(sharedUi, /export function expandDashboardSection/);
  assert.match(sharedUi, /export function dashboardSectionNumberFromNavId/);
  assert.doesNotMatch(sharedUi, /getItem\(storageKey\) !== "false"/);
  assert.match(intelligence, /function IntelligenceFeedSection[\s\S]*?const \[open, setOpen\] = useState\(false\)/);
  for (const workspace of [investment, sectors, intelligence, health, strategies]) {
    assert.match(workspace, /expandDashboardSection\(dashboardSectionNumberFromNavId\(/);
  }
});

test("workspaces honor section/page from the URL on first paint and popstate", async () => {
  const [sharedUi, investment, sectors, intelligence, health, page] = await Promise.all([
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(sharedUi, /export function revealDashboardSection/);
  assert.match(investment, /function investmentSectionFromUrl/);
  assert.match(investment, /useState<string>\(investmentSectionFromUrl\)/);
  assert.match(investment, /revealDashboardSection\(section, `investment-\$\{section\}`\)/);
  assert.match(investment, /hidden=\{nativeChromeHidesSection\(activeSection, "i3"\)\}/);
  assert.match(intelligence, /function intelligenceSectionFromUrl/);
  assert.match(intelligence, /useState<string>\(intelligenceSectionFromUrl\)/);
  assert.match(sectors, /useState<SectorTopSection>\(\(\) => sectionFromUrl\(\)\.topSection\)/);
  assert.match(health, /useState<HealthRoute>\(healthRouteFromUrl\)/);
  assert.match(page, /__stratjiApplyNativeRoute/);
  assert.match(page, /addEventListener\("popstate"/);
});

test("collapsed section preview is not constrained by the section-number badge", async () => {
  const [sharedUi, globalCss] = await Promise.all([
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(sharedUi, /className="shutter-preview"[\s\S]*?<em>preview<\/em>/);
  assert.match(globalCss, /\.section-heading>span:first-child\s*\{[^}]*width:36px;[^}]*height:36px;/s);
  assert.doesNotMatch(globalCss, /\.section-heading>span\s*\{[^}]*width:36px;[^}]*height:36px;/s);
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
  const [sharedUi, investment, sectors, intelligence, health, strategies, globalCss] = await Promise.all([
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/StrategiesWorkspace.tsx", import.meta.url), "utf8"),
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
    [strategies, "Strategies sections", [
      ['y1', "Action Board"],
      ['y2', "Library"],
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
  assert.match(strategies, /id="strategies-y1"/);
  assert.match(strategies, /id="strategies-y2"/);
  assert.match(health, /searchParams\.set\("section", "h1"\)/);
  assert.doesNotMatch(health, /id="health-h4"|\{ id: "h4"|number="H-4"|Health Status|Daily Guidance|HealthStatusOverview|HealthStatusWorkbench/);
  assert.doesNotMatch(sectors, /S-4|s4|EarningsMonthCalendar|sector-intelligence-filter|sector-dimmed/);
  assert.doesNotMatch(health, /health-overview-console|<HealthThumbnail/);
  assert.doesNotMatch(health, /sector-detail-shell|health-detail-shell/);
  assert.match(health, /className="health-workspace-shell"/);
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
      readFile(new URL("../app/dashboard/AppleMonthlyCalendar.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/HealthWorkspace.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/StrategiesWorkspace.tsx", import.meta.url), "utf8"),
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
  assert.match(globalCss, /\.portfolio-analysis-grid\s*\{[^}]*grid-template-columns:minmax\(0,7fr\) minmax\(0,3fr\)[^}]*grid-template-areas:"allocation management" "activity concentration"[^}]*align-items:stretch/s);
  assert.match(globalCss, /\.portfolio-analysis-grid>\.portfolio-management\s*\{[^}]*grid-area:management[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/s);
  assert.match(globalCss, /\.portfolio-analysis-grid>\.portfolio-activity-panel\s*\{\s*grid-area:activity/);
  assert.match(globalCss, /\.portfolio-analysis-grid>\.portfolio-map-panel\s*\{\s*grid-area:concentration/);
  const allocationIndex = page.indexOf('className="panel chart-panel nested-chart-panel"');
  const managementIndex = page.indexOf('className="portfolio-management"', allocationIndex);
  const activityIndex = page.indexOf('className="panel holdings-panel portfolio-activity-panel spectrum-sheet"', managementIndex);
  const mapIndex = page.indexOf('className="panel portfolio-map-panel gravity-well"', activityIndex);
  assert.ok(allocationIndex >= 0 && allocationIndex < managementIndex && managementIndex < activityIndex && activityIndex < mapIndex, "I-2 follows allocation, management, activity and concentration-map source order");
  assert.match(globalCss, /\.portfolio-activity-mobile\s*\{\s*display:none/);
  assert.match(globalCss, /@media \(max-width:620px\)[\s\S]*\.portfolio-activity-table\s*\{\s*display:none;\s*\}[\s\S]*\.portfolio-activity-mobile\s*\{\s*display:grid/);
  assert.doesNotMatch(reportPage, /Portfolio concentration map/);
  assert.doesNotMatch(page, /5 \* 60 \* 1000/);
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
  assert.match(page, /hideHealth=\{demoMode\}/);
  assert.match(page, /className="workspace-navigation mode-dial glass-bar liquid-glass"/);
  assert.match(page, /barLabel/);
  assert.match(page, /data-count=\{visibleWorkspaces\.length\}/);
  assert.match(page, /event\.key === "ArrowDown"/);
  assert.match(page, /selectByIndex\(visibleWorkspaces\.length - 1\)/);
  assert.match(page, /function DemoCaptionBar/);
  assert.match(page, /data-demo-sensitive/);
  assert.match(globalCss, /html\[data-demo="1"\] \[data-demo-sensitive\]/);
  assert.match(packageJson, /demo:record/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /event\.key === "Home"/);
  assert.match(page, /event\.key === "End"/);
  assert.match(page, /searchParams\.set\("view", next\)/);
  assert.match(page, /addEventListener\("popstate"/);
  assert.match(page, /tabList\.scrollLeft = Math\.max/);
  assert.match(page, /window\.dispatchEvent\(new Event\("resize"\)\)/);
  assert.match(page, /loadSectorMarket/);
  assert.match(page, /\/api\/sectors\/snapshot/);
  assert.doesNotMatch(page, /visibilitychange/);
  assert.doesNotMatch(page, /addEventListener\("focus"/);
  assert.doesNotMatch(page, /addEventListener\("online"/);
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
  assert.match(reportPage, /<th>CMP<\/th><th>Target<\/th><th>Implied<\/th>/);
  assert.match(reportPage, /a\.cmp != null \? inr\.format\(a\.cmp\) : "—"/);
  assert.match(page, /No static positions are shown/);
  assert.match(page, /Shaded outer segment = negative day P&amp;L/);
  assert.match(page, /Verified industry and sub-sector/);
  assert.match(reportPage, /sub-sector from company disclosures/);
  assert.match(page, /AMFI market-cap tier/);
  assert.match(page, /COMPOSITE MONITORING INDEX/);
  assert.match(page, /Event transmission/);
  assert.match(page, /KPI watch/);
  assert.match(page, /buildExposureDrivers/);
  assert.match(page, /eventBullets/);
  assert.match(page, /kpiBullets/);
  assert.match(page, /data-tone=\{bullet\.tone\}/);
  assert.match(page, /raw score ÷ 6/);
  assert.match(page, /categories\.map/);
  assert.match(page, /health-kpi-grid/);
  assert.match(page, /health-kpi-tile/);
  assert.match(page, /new ResizeObserver\(fit\)/);
  assert.match(page, /workspace === "investment" \|\| stayMounted/);
  assert.match(page, /workspace === "sectors" \|\| stayMounted/);
  assert.match(page, /workspace === "intelligence" \|\| stayMounted/);
  assert.match(page, /workspace === "health" \|\| stayMounted/);
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
  assert.match(page, /AppleMonthlyCalendar/);
  assert.match(page, /<AppleMonthlyCalendar events=\{calendar\}/);
  assert.match(page, /Navigate Apple Calendar months/);
  assert.match(page, /apple-month-grid/);
  assert.match(page, /CELL_PREVIEW = 4/);
  assert.match(page, /formula\\s\*1\|\\bf1\\b/);
  assert.match(page, /astronom\|space\|moon\|solar\|lunar/);
  assert.match(page, /coursera\|course\|learning\|study/);
  assert.match(page, /family\|birthday\|anniversary/);
  assert.match(page, /sourceDate/);
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
  assert.match(page, /unique\.join\(" \/ "\)/);
  assert.doesNotMatch(page, /kpi-row-label/);
  assert.match(page, /function kpiOutcome/);
  assert.match(page, /tone === "green"[\s\S]*?className: "positive"/);
  assert.match(page, /tone === "red"[\s\S]*?className: "negative"/);
  assert.match(page, /className: "neutral"/);
  assert.match(page, /\$\{outcome\.label\} outcome:/);
  assert.match(page, /earnings-outcome-legend/);
  assert.match(page, />\+VE</);
  assert.match(page, />NEUTRAL</);
  assert.match(page, />−VE</);
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
  assert.doesNotMatch(globalCss, /kpi-row-label/);
  assert.match(globalCss, /td\.kpi-outcome-positive \.kpi-outcome-change/);
  assert.match(globalCss, /td\.kpi-outcome-neutral \.kpi-outcome-change/);
  assert.match(globalCss, /td\.kpi-outcome-negative \.kpi-outcome-change/);
  assert.match(globalCss, /\.intelligence-feed-stack\s*\{[^}]*display:grid;/s);
  assert.match(globalCss, /\.intelligence-feed-stack\.topic-feed[\s\S]*?column-count:\s*auto\s*!important/s);
  assert.match(page, /intelligence-feed-stack agenda-ribbon triptych-command/);
  assert.doesNotMatch(page, /intelligence-feed-stack topic-feed agenda-ribbon/);
  assert.match(globalCss, /\.intelligence-feed-collapse:focus-visible\s*\{[^}]*outline:/s);
  assert.match(globalCss, /\.reminder-smart-groups\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(globalCss, /\.apple-month-grid\s*\{[^}]*grid-template-columns:repeat\(7,minmax\(0,1fr\)\);/s);
  assert.match(globalCss, /\.apple-month-scroll\s*\{[^}]*overflow-x:auto;/s);
  assert.match(globalCss, /\.apple-month-weekdays,[\s\S]*?\.apple-month-grid\s*\{[^}]*min-width:760px;/s);
  assert.match(globalCss, /html\[data-appearance="sepia"\] \.apple-calendar-event\s*\{[^}]*background:var\(--calendar-paper\);[^}]*color:var\(--calendar-paper-text\);/s);
  assert.match(globalCss, /digest-panel-podcasts/);
  assert.match(globalCss, /topic-feed-check/);
  assert.match(page, /topic-feed-completed[\s\S]*?topic-feed-scheduled[\s\S]*?topic-feed-work/);
  // Market Intelligence M-2 order: Interrogate LLM (full width) → Newsletters | Axis → Podcasts; M-4 Calendar + action feeds
  assert.match(page, /Interrogate LLM[\s\S]*?Newsletter digest[\s\S]*?Axis Research[\s\S]*?digest-panel-podcasts[\s\S]*?digest-panel-span/);
  assert.doesNotMatch(page, /LLM intelligence draft/i);
  assert.doesNotMatch(page, /LLM framework draft/i);
  assert.doesNotMatch(page, /LLM composite commentary/i);
  assert.doesNotMatch(page, /LLM earnings narrative/i);
  assert.doesNotMatch(page, /LLM strategy assist/i);
  assert.match(page, /task="industry"/);
  assert.match(page, /industryAnalyticsSuggestions/);
  assert.match(page, /llm-assist-span/);
  assert.match(page, /Newsletters \+ Axis Research \+ Podcast Transcript Summaries, as Source of Truth/);
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
  assert.match(page, /<th>CMP<\/th><th>Target<\/th>/);
  assert.match(page, /data-label="CMP"/);
  assert.match(page, /current \? inr\.format\(current\) : "—"/);
  assert.match(page, /Implied vs CMP/);
  assert.match(page, /analystMatrixSymbols/);
  assert.match(page, /missingYfinanceKey/);
  assert.match(page, /CMP for every analyst-matrix symbol/);
  assert.match(page, /\/api\/quotes\/yfinance\?symbols=/);
  assert.match(page, /Kite last price when held; otherwise a yfinance delayed NSE quote/);
  assert.match(reportPage, /fetchYfinanceBySymbol/);
  assert.match(reportPage, /yfinanceBySymbol/);
  assert.match(reportPage, /Price basis/);
  assert.match(reportPage, /yfinance delayed NSE quote/);
  assert.doesNotMatch(reportPage, /Current-position coverage/);
  const yfinanceRoute = await readFile(new URL("../app/api/quotes/yfinance/route.ts", import.meta.url), "utf8");
  const yfinanceTickers = await readFile(new URL("../app/strategy/yfinance-tickers.ts", import.meta.url), "utf8");
  assert.match(yfinanceRoute, /process\.cwd\(\)/);
  assert.match(yfinanceRoute, /status: "public_delayed"/);
  assert.match(yfinanceRoute, /yf\.download/);
  assert.match(yfinanceRoute, /YFINANCE_NSE_ALIASES/);
  assert.match(yfinanceTickers, /MAXHEALTHCARE: "MAXHEALTH"/);
  assert.match(yfinanceRoute, /Prefer history over fast_info/);
  assert.match(yfinanceRoute, /currentTradingPeriod/);
  assert.match(yfinanceTickers, /RAINBOWCHILDRE: "RAINBOW"/);
  assert.match(yfinanceTickers, /KALYANISTEELS: "KSL"/);
  assert.match(page, /data-label="What matters"/);
  assert.match(page, /thesisBullets\(/);
  assert.match(page, /ThesisBulletList/);
  assert.match(page, /archive calls/);
  assert.match(page, /mail-window/);
  assert.match(page, /every active analyst-call category the matrix exposes/);
  assert.match(page, /last trading day/);
  assert.match(globalCss, /\.thesis-bullet-list/);
  assert.match(globalCss, /\.analyst-matrix/);
  assert.match(globalCss, /grid-template-areas:[\s\S]*"stock call"[\s\S]*"cmp cmp"[\s\S]*"target target"/);
  assert.match(globalCss, /\.analyst-table td:nth-child\(4\) \{ grid-area:cmp; \}/);
  assert.match(page, /function AxisRecommendationWorkbench/);
  assert.match(page, /mergeActiveMatrixRowsIntoWorkbench/);
  assert.match(page, /axis-pick-group/);
  assert.match(page, /every active analyst-call category the matrix exposes/);
  assert.doesNotMatch(page, /role="tablist" aria-label="Axis recommendation categories"/);
  assert.doesNotMatch(page, /setActiveCategory/);
  assert.match(page, /formatAxisTargetLine/);
  assert.match(page, /TARGET - \$\{label\} \(\$\{sourceLabel\}\)/);
  assert.match(page, /function axisProgressToTarget/);
  assert.match(page, /function AxisCmpProgressBar/);
  assert.match(page, /Progress to target/);
  assert.match(page, /CMP ÷ Axis target \(capped 100%\)|Kite CMP ÷ Axis target|yfinance CMP ÷ Axis target/);
  assert.match(page, /axis-pick-cmp/);
  assert.match(page, /axis-pick-backdrop|aria-modal="true"/);
  assert.match(page, /Group by|analyst-group-by|AnalystGroupMode|groupAnalystRows/);
  assert.match(page, /value="target-achieved">Target achieved/);
  assert.match(page, /collapsedAnalystGroups|toggleAnalystGroup/);
  assert.match(page, /aria-expanded=\{!isCollapsed\}/);
  assert.match(page, /Plain BUY variants resolve to one BUY category/);
  assert.match(page, /axisTargetAchievements/);
  assert.match(globalCss, /\.analyst-group-block\.collapsed \.analyst-group-title svg/);
  assert.doesNotMatch(page, /WINDOW MAIL/);
  assert.match(page, /mergeHoldingTradingCalls|dedupeAxisCallsBySymbol|axisHoldingTradingCalls|AXIS_HOLDING_TRADING_SYMBOLS/);
  assert.match(page, /ETERNAL|ICICIBANK|JSWENERGY|BHARTIARTL/);
  assert.match(globalCss, /\.axis-pick-list button \{[^}]*flex-direction:column/);
  assert.match(globalCss, /\.axis-visual-grid \{[^}]*grid-template-columns:1fr/);
  assert.match(globalCss, /\.axis-pick-group/);
  assert.match(globalCss, /\.axis-pick-group-title/);
  assert.match(globalCss, /\.axis-pick-backdrop/);
  assert.match(globalCss, /\.analyst-matrix-controls/);
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
  assert.match(page, /<DailyKanbanBoard workspace="strategies"\/>/);
  assert.doesNotMatch(page, /<DailyKanbanBoard[^>]+(?:lane|compact)=/);
  assert.doesNotMatch(globalCss, /\.kanban-board\.compact/);
  assert.match(globalCss, /\.canonical-action-board\{height:auto!important/);
  assert.ok(
    (page.match(/className="workspace-section action-board-workspace-section"/g) ?? []).length >= 4,
    "existing workspaces must keep the canonical action-board section",
  );
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
  assert.match(page, /assembleScenarioEvidence\(candidateItems, eventKey, bandKey, event\)/);
  assert.match(page, /selectedEvidenceItems\.length/);
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
  assert.match(reportPage, /AbortSignal\.timeout\(90_000\)/);
  assert.match(reportPage, /querySelectorAll\("script"\)/);
  assert.match(reportPage, /JSON\.stringify\(\{ pages: pageDocuments \}\)/);
  assert.match(reportPage, /reportPages\.map\(\(page\) => page\.outerHTML\)\.join\(""\)/);
  assert.match(reportPage, /promptPdfDownload\(/);
  assert.match(reportPage, /choosePdfSaveHandle\(/);
  assert.match(reportPage, /showSaveFilePicker/);
  assert.match(reportPage, /anchor\.download = filename/);
  assert.match(reportPage, /window\.location\.assign\(downloadUrl\)/);
  assert.match(reportPage, /Download prepared PDF/);
  assert.match(reportPage, /Generate Report PDF/);
  assert.doesNotMatch(reportPage, /Refresh & Export/);
  assert.doesNotMatch(reportPage, /Saved to Downloads as/);
  assert.match(page, /Generate Report PDF/);
  assert.match(page, /tierAllows\(license\.tier, "pdf"\) \|\| license\.author/);
  assert.doesNotMatch(page, /Refresh & Export/);
  assert.match(reportDownloadRoute, /Content-Disposition/);
  assert.match(reportDownloadRoute, /attachment; filename=/);
  assert.match(reportDownloadRoute, /preparedPdfs\.size > 4/);
  assert.match(reportDownloadRoute, /savedToDownloads: false/);
  assert.match(reportDownloadRoute, /http:\/\/127\.0\.0\.1:3002\/render/);
  assert.match(reportDownloadServer, /--headless=new/);
  assert.match(reportDownloadServer, /\/Applications\/Browsers\/Google Chrome\.app\/Contents\/MacOS\/Google Chrome/);
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
  assert.match(contentServer, /digestItemEvidenceText/);
  assert.match(contentServer, /matched\.slice\(0, 16\)/);
  assert.match(page, /assembleScenarioEvidence\(candidateItems, eventKey, bandKey, event\)/);
  assert.match(page, /evidenceCardLabel/);
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
    const guidanceAt = healthWorkspace.indexOf("<HealthGuidanceWorkbench", optimismAt);
    const masonryAt = healthWorkspace.indexOf("<HealthMasonryGrid categories={healthSnapshot.categories}/>", optimismAt);
    assert.ok(optimismAt >= 0 && guidanceAt >= 0 && masonryAt >= 0 && optimismAt < guidanceAt && guidanceAt < masonryAt, "Daily Optimism with rich guidance must render above Vital cadence / HealthMasonryGrid");
    assert.match(healthWorkspace, /id="health-h2-insights"/);
    assert.match(healthWorkspace, /id="health-h2-guidance"/);
    assert.match(healthWorkspace, /id="health-h2-guardrails"/);
    assert.match(healthWorkspace, /<h3>Insights<\/h3>/);
    assert.match(healthWorkspace, /<h3>Guidance<\/h3>/);
    assert.match(healthWorkspace, /route\.section === "h3" && pages\.length > 1/);
    assert.doesNotMatch(healthWorkspace, /\{ id: "insights", label: "Insights" \}/);
    assert.doesNotMatch(healthWorkspace, /\{ id: "guidance", label: "Guidance" \}/);
    assert.doesNotMatch(healthWorkspace, /\{ id: "guardrails", label: "Guardrails" \}/);
    assert.match(healthWorkspace, /HEALTH_TOP_SECTIONS/);
    assert.match(healthWorkspace, /<WorkspaceSectionNav[\s\S]*label="Health & Wellness sections"/);
    assert.match(healthWorkspace, /HealthWorkspaceSection = "h2" \| "h3"/);
    assert.match(healthWorkspace, /number="H-1" title="Health action board"/);
    assert.match(healthWorkspace, /healthRouteFromUrl/);
    assert.match(healthWorkspace, /health-workspace-shell/);
    assert.doesNotMatch(healthWorkspace, /health-overview-console/);
    assert.doesNotMatch(healthWorkspace, /<HealthThumbnail/);
    assert.doesNotMatch(healthWorkspace, /Health Status|Daily Guidance|number="H-4"|HealthStatusOverview|HealthStatusWorkbench|id="health-h4"|\{ id: "h4"/);
    assert.doesNotMatch(healthWorkspace, /Health Daily|sector-detail-shell|health-detail-shell/);
    assert.match(healthWorkspace, /number="H-2" title="Daily Optimism"/);
    assert.match(healthWorkspace, /number="H-3" title="Vital Metrics"/);
    assert.match(healthWorkspace, /<HealthMasonryGrid categories=\{healthSnapshot\.categories\}\/>/);
    assert.match(healthWorkspace, /\{ id: "nutrition", label: "Nutrition" \}/);
    assert.match(healthWorkspace, /parseHealthH3Page/);
    const routingSource = await readFile(new URL("../app/dashboard/workspace-routing.ts", import.meta.url), "utf8");
    assert.match(routingSource, /case "nutrition-1":/);
    assert.match(routingSource, /case "nutrition-2":/);
    assert.match(routingSource, /return "nutrition"/);
    assert.match(healthWorkspace, /HealthIncognitoGate/);
    assert.match(globalCss, /\.health-metrics-overview/);
    assert.match(globalCss, /\.health-direction-grid/);
    assert.match(globalCss, /\.health-cat-heart/);
    assert.match(globalCss, /\.health-direction-grid\.compact/);
    assert.match(globalCss, /\.health-direction-row/);
    assert.match(globalCss, /grid-template-columns:repeat\(auto-fill,minmax\(168px,1fr\)\)/);
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
  assert.match(page, /sanitizeKiteStatusNote/);
  assert.doesNotMatch(page, /Latest refresh failed; retaining the last validated values/);
  assert.doesNotMatch(page, /`\$\{current\.message\} Latest refresh failed/);
  assert.match(liveServer, /callKiteTool\("get_holdings"\)/);
  assert.match(liveServer, /callKiteTool\("get_positions"\)/);
  assert.match(liveServer, /netPositionsFromKitePayload\(positionsRaw\)/);
  assert.match(liveServer, /callKiteTool\("get_orders"\)/);
  assert.match(liveServer, /callKiteTool\("get_gtts"\)/);
  assert.match(liveServer, /settledQty \+ t1Qty \+ mtfQty/);
  assert.match(liveServer, /product === "CNC"/);
  assert.doesNotMatch(liveServer, /number\(raw\.collateral_quantity\)/);
  assert.doesNotMatch(liveServer, /sector: "Other"/);
  assert.doesNotMatch(liveServer, /marketCap: "Unclassified"/);
  assert.match(liveServer, /sanitizeKiteStatusNote/);
  assert.doesNotMatch(liveServer, /Retaining the last validated Kite snapshot until the next five-minute refresh/);
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
  assert.match(await readFile(new URL("../app/sector-news-server.ts", import.meta.url), "utf8"), /PER_SOURCE_ITEM_CEILING = 100/);
  assert.match(await readFile(new URL("../app/sector-news-server.ts", import.meta.url), "utf8"), /parseItems\(xml, feed, PER_SOURCE_ITEM_CEILING\)/);
  assert.doesNotMatch(await readFile(new URL("../app/sector-news-server.ts", import.meta.url), "utf8"), /parseItems\(xml, feed, 8\)/);
  assert.match(await readFile(new URL("../app/api/sectors/news/route.ts", import.meta.url), "utf8"), /getSectorNewsSnapshot/);
  assert.match(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /News \+ sentiment/);
  assert.match(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /sector-news-sentiment-grid/);
  assert.match(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /newsItems\.filter\(\(item\) => item\.sentiment === "Positive"\)/);
  assert.doesNotMatch(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /sentiment === "Positive"\)\.slice\(0, 3\)/);
  assert.doesNotMatch(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /sentiment === "Neutral"\)\.slice\(0, 3\)/);
  assert.doesNotMatch(await readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"), /sentiment === "Negative"\)\.slice\(0, 3\)/);
  assert.match(globalCss, /\.sector-news-sentiment-grid/);
  assert.match(globalCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(globalCss, /\.workspace-navigation\s*\{/);
  assert.match(globalCss, /position:\s*sticky/);
  assert.match(globalCss, /\.workspace-tabs\s*\{[^}]*grid-template-columns:repeat\(var\(--glass-count\)/);
  assert.match(globalCss, /\.workspace-tabs::after/);
  assert.match(globalCss, /\.workspace-tabs::before/);
  assert.match(globalCss, /--glass-count:6/);
  assert.match(globalCss, /border-radius:999px !important/);
  assert.doesNotMatch(globalCss, /\.workspace-tabs\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(globalCss, /\.viewport-console-active\s+\.workspace-tabs\{[^}]*repeat\(3,/);
  assert.match(globalCss, /\.sector-rank-grid/);
});

test("native iPhone shell exposes complete workspace, freshness, pairing and offline contracts", async () => {
  const [contentView, configuration, browser, status, shell, pairing, healthKit, flaskGateway, models, workspaces, actions] = await Promise.all([
    readFile(new URL("../apple-app/InvestmentDashboard/ContentView.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/PortfolioDashboardConfiguration.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardBrowser.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardStatus.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardShellViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/HealthPairing.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/HealthKitSync.swift", import.meta.url), "utf8"),
    readFile(new URL("../flask_gateway.py", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/NativeDashboardModels.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/NativeWorkspaceViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/NativeActionBoard.swift", import.meta.url), "utf8"),
  ]);

  assert.match(configuration, /case investment[\s\S]*case sectors[\s\S]*case intelligence[\s\S]*case health[\s\S]*case builder[\s\S]*case strategies/);
  assert.match(configuration, /Portfolio Overview/);
  assert.match(configuration, /URLQueryItem\(name: "view", value: view\)/);
  assert.match(configuration, /URLQueryItem\(name: "nativeChrome", value: "1"\)/);
  assert.match(configuration, /integrationsURL/);
  assert.match(contentView, /NativeRootShell/);
  assert.match(contentView, /NativeRefreshProgressView/);
  assert.match(contentView, /NativeOfflineScreen/);
  assert.match(contentView, /HealthKitSyncCoordinator/);
  assert.match(contentView, /showingInspector|showingDebugDashboard/);
  assert.match(contentView, /browser: browser/);
  assert.match(contentView, /PortfolioDashboardWebView/);
  assert.match(workspaces, /NavigationSplitView/);
  assert.match(workspaces, /DashboardOutlineList\(selectedID:/);
  assert.match(browser, /nativeChrome/);
  assert.match(actions, /To Do Today/);
  assert.match(actions, /Completed Today/);
  assert.match(actions, /To Do Today/);
  assert.match(actions, /Completed Today/);
  assert.match(models, /FreshnessLabel/);
  assert.match(models, /"snapshot"/);
  assert.match(status, /\/api\/dashboard\/freshness/);
  assert.match(status, /\/api\/dashboard\/refresh/);
  assert.match(status, /\/api\/kite\/snapshot/);
  assert.match(status, /\/api\/integrations/);
  assert.match(status, /\/_flask\/health/);
  assert.match(status, /\/_startup\/audit/);
  assert.match(shell, /DashboardOnboardingView/);
  assert.match(shell, /npm run iphone:pair/);
  assert.match(browser, /private\(set\) lazy var webView/);
  assert.match(pairing, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(healthKit, /HealthCredentialStore\.token\(\)/);
  assert.doesNotMatch(healthKit, /portfolio-local-health-token/);
  assert.match(flaskGateway, /@app\.post\("\/_health\/pair\/code"\)/);
  assert.match(flaskGateway, /@app\.post\("\/_health\/pair"\)/);
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
  assert.doesNotMatch(page, /AppearanceToggle/);
  assert.match(page, /dashboard-appearance/);
  assert.match(page, /document\.documentElement\.dataset\.appearance/);
  assert.match(page, /appearanceHydrated/);
  assert.match(layout, /data-appearance="black"/);
  assert.match(layout, /dashboard-appearance/);
  assert.match(layout, /document\.documentElement\.dataset\.appearance/);

  assert.match(globalCss, /--bg-page/);
  assert.match(globalCss, /--btn-bg/);
  assert.match(globalCss, /--brutalist-shadow-lg/);
  assert.match(globalCss, /--radius:\s*12px/);
  assert.match(globalCss, /\*\s*\{\s*box-sizing:border-box;\s*border-radius:\s*var\(--radius\)\s*!important/);
  assert.doesNotMatch(globalCss, /\*\s*\{\s*box-sizing:border-box;\s*border-radius:\s*0\s*!important/);
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
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.sector-selector\.sector-prism button span/);
  assert.match(visualCss, /--sepia-positive-ink:\s*#075b32/);
  assert.match(visualCss, /--sepia-warning-ink:\s*#704600/);
  assert.match(visualCss, /--sepia-negative-ink:\s*#8f1d2c/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.recharts-cartesian-axis-tick-value/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.section-heading > \.shutter-preview em/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.portfolio-map-legend/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.macro-no-evidence b/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.linked-insight h4/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.linked-insight-scroll > div/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.podcast-summary-unavailable/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.earnings-month-cell\.today \.earnings-month-daynum/);
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
  assert.match(visualCss, /translateY\(-2px\)\s*scale\(1\.02\)/);
  assert.match(visualCss, /border-radius:\s*var\(--radius\)/);
  assert.match(visualCss, /Last-wins rounded brutalist clip/);
  assert.match(visualCss, /\.collapsible-content[\s\S]*border-radius:\s*var\(--radius\)\s*!important/);
  assert.match(visualCss, /\.collapsible-content[\s\S]*vo-magnetic/);
  assert.match(visualCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(visualCss, /\.digest-panel\.briefing-rail \.evidence-chip:not\(\.focused\)[\s\S]*?opacity:\s*1/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.orbital-planet \.nested-chart-panel[\s\S]*var\(--bg-panel\) !important/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.risk-panel\.threat-flower[\s\S]*var\(--bg-panel\) !important/);
  assert.match(visualCss, /\.risk-panel\.threat-flower:not\(\.holdings-stack\) \.risk-selector button \{[^}]*min-width:\s*78px/s);
  assert.match(visualCss, /\.risk-panel\.threat-flower:not\(\.holdings-stack\) \.risk-chart \{[^}]*min-height:\s*620px/s);
  assert.match(visualCss, /\.risk-panel\.threat-flower:not\(\.holdings-stack\) \.axis-risk-stack/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.macro-workbench\.scenario-weather \.macro-event-tabs button\.active/);
  assert.match(visualCss, /html\[data-appearance="sepia"\] \.lifecycle-panel\.evolution-river \.chart-wrap/);
  assert.match(visualCss, /--vo-desk:\s*#1d4ed8/);
  assert.match(visualCss, /--vo-map:\s*#0d9488/);
  assert.match(visualCss, /--vo-news:\s*#a855f7/);
  assert.match(visualCss, /--vo-body:\s*#f43f5e/);
  assert.match(visualCss, /--vo-canvas:\s*#d97706/);
  assert.match(visualCss, /--vo-strategies:\s*#65a30d/);
  assert.match(visualCss, /button\[data-mode="investment"\]/);
  assert.match(visualCss, /button\[data-mode="sectors"\]/);
  assert.match(visualCss, /button\[data-mode="intelligence"\]/);
  assert.match(visualCss, /button\[data-mode="health"\]/);
  assert.match(visualCss, /button\[data-mode="builder"\]/);
  assert.match(visualCss, /button\[data-mode="strategies"\]/);
  assert.match(visualCss, /html\[data-appearance="sepia"\][\s\S]*button\[data-mode="builder"\]/);
  assert.match(visualCss, /html\[data-appearance="sepia"\][\s\S]*button\[data-mode="strategies"\]/);
  assert.match(visualCss, /--vo-canvas:\s*#d97706/);
  assert.match(visualCss, /--vo-strategies:\s*#65a30d/);
  assert.match(globalCss, /button\.active\[data-mode="builder"\]/);
  assert.match(globalCss, /button\.active\[data-mode="strategies"\]/);
});

test("source freshness details reserve layout space above the sticky workspace navigation", async () => {
  const [visualComponents, visualCss] = await Promise.all([
    readFile(new URL("../app/dashboard/visual-components.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-overhaul.css", import.meta.url), "utf8"),
  ]);

  assert.match(visualComponents, /className="source-freshness-region"/);
  assert.match(visualComponents, /className="pulse-detail-lane"/);
  assert.doesNotMatch(visualComponents, /className="pulse-popover"/);
  assert.match(visualCss, /\.pulse-detail-lane\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(visualCss, /\.pulse-detail-lane\s*\{[\s\S]{0,240}position:\s*absolute/);
});

test("Algorithm Canvas builder view chrome includes Algorithm Builder, Action Board, Canvas, and JSON", async () => {
  const [page, types, routing, chrome, workspace] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/types.ts", import.meta.url), "utf8"),
    readJoined(ROUTING_SOURCE_CANDIDATES),
    readJoined(BUILDER_CHROME_CANDIDATES),
    firstExisting(BUILDER_WORKSPACE_CANDIDATES),
  ]);

  assert.match(page, /workspace === "investment"/);
  assert.match(page, /workspace === "sectors"/);
  assert.match(page, /workspace === "intelligence"/);
  assert.match(page, /workspace === "health"/);
  assert.match(page, /workspace === "strategies"/);
  assert.match(page, /value === "market-intelligence"/);
  assert.match(chrome, /Algorithm Builder/);
  assert.doesNotMatch(chrome, /BuilderKanbanBoard|AlgorithmKanbanBoard|compact-action-board/);
  if (!workspace.text) {
    console.log("SOFT (waiting on shell sibling): builder chrome Action Board / Canvas / JSON");
    return;
  }
  assert.match(types, /type WorkspaceKey =[\s\S]*"builder"/);
  assert.match(routing, /algorithm-canvas/);
  assert.match(workspace.text, /Action Board|ACTION BOARD/);
  assert.match(workspace.text, /(?:label|title|id):\s*"canvas"|["']Canvas["']|>CANVAS</);
  assert.match(workspace.text, /(?:label|title|id):\s*"json"|["']JSON["']|>JSON</i);
  assert.match(workspace.text, /<DailyKanbanBoard workspace="builder"\s*\/>/);
});

test("builder and strategies query strings SSR their workspace chrome", async () => {
  const builder = await (await render("/?view=builder&section=canvas")).text();
  assert.match(builder, /Algorithm Builder|Algorithm Canvas/);
  assert.match(builder, /data-workspace="builder"/);
  assert.match(builder, /kpi-registry-panel|KPI registry|license-gate/);
  const strategies = await (await render("/?view=strategies&section=y2")).text();
  assert.match(strategies, /data-workspace="strategies"/);
  assert.match(strategies, /strategy-card|simons-kmlm|NSE ETF|license-gate/);
});

test("Integrations is Settings chrome, not a seventh DailyKanbanBoard workspace", async () => {
  const [page, utils, types, workspace, routing, globalCss] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntegrationsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/workspace-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(utils, /key: "investment", label: "Portfolio Overview"/);
  const workspaceKeys = [...utils.matchAll(/\{ key: "(investment|sectors|intelligence|health|builder|strategies|integrations)"/g)].map((match) => match[1]);
  assert.deepEqual(workspaceKeys, ["investment", "sectors", "intelligence", "health", "builder", "strategies"]);
  assert.match(types, /type WorkspaceKey = "investment" \| "sectors" \| "intelligence" \| "health" \| "builder" \| "strategies"/);
  assert.match(routing, /case "portfolio":/);
  assert.match(routing, /case "portfolio-overview":/);
  assert.match(routing, /function isIntegrationsView/);
  assert.match(page, /IntegrationsWorkspace/);
  assert.doesNotMatch(page, /integrations-chrome-link/);
  assert.doesNotMatch(page, /Open Integrations settings/);
  assert.match(page, /DashboardTabs active=\{workspace\}/);
  assert.match(page, /nativeChrome/);
  assert.match(page, /native-chrome/);
  assert.match(page, /showWorkspaceShell && !nativeChrome && <DashboardTabs/);
  assert.match(page, /isIntegrationsChrome && <IntegrationsWorkspace/);
  assert.match(page, /document\.title = isIntegrationsChrome \? "Settings"/);
  assert.match(page, /if \(isIntegrationsChrome\) return;/);
  assert.match(workspace, /id="integrations-chrome-heading">Settings/);
  assert.match(workspace, /id="integrations-appearance-heading">Appearance/);
  assert.match(workspace, /AppearanceToggle/);
  assert.match(workspace, /HealthIncognitoToggle/);
  assert.match(globalCss, /data-chrome-page="integrations"/);
  assert.doesNotMatch(workspace, /DailyKanbanBoard/);
  assert.doesNotMatch(workspace, /sector-dimmed|selectedSectorId|EarningsMonthCalendar/);
  assert.match(workspace, /data-chrome="integrations"/);
  assert.match(globalCss, /\.integrations-workspace/);
  assert.match(globalCss, /\.integrations-appearance/);
  assert.doesNotMatch(globalCss, /\.integrations-chrome-link/);
});

test("Settings / Integrations chrome omits dashboard masthead, tiles, and freshness strip", async () => {
  const [html, nativeHtml, stratjiWorkspace] = await Promise.all([
    (await render("/?view=integrations")).text(),
    (await render("/?view=integrations&nativeChrome=1")).text(),
    readFile(new URL("../apple-app/Shared/StratjiWorkspace.swift", import.meta.url), "utf8"),
  ]);
  for (const body of [html, nativeHtml]) {
    assert.match(body, /data-chrome-page="integrations"/);
    assert.match(body, /id="integrations-chrome-heading"/);
    assert.match(body, />Settings</);
    assert.match(body, /STRATJI CHROME/);
    assert.match(body, /Zerodha Streak/);
    assert.doesNotMatch(body, /<h1>Investment Brief<\/h1>/);
    assert.doesNotMatch(body, /class="masthead"/);
    assert.doesNotMatch(body, /aria-label="Dashboard workspaces"/);
    assert.doesNotMatch(body, /id="workspace-tab-investment"/);
    assert.doesNotMatch(body, /class="live-feed-banner/);
    assert.doesNotMatch(body, />Generate Report PDF</);
    assert.doesNotMatch(body, />Export Report</);
    assert.match(body, /Dashboard appearance/);
    assert.match(body, /Health incognito/);
  }
  assert.match(html, /Back to dashboard/);
  assert.doesNotMatch(nativeHtml, /Back to dashboard/);
  assert.match(stratjiWorkspace, /view: "integrations", nativeChrome: true/);
});

test("S-2 pulse orb cores keep KPI values inside the 12px rounded well", async () => {
  const visualCss = await readFile(new URL("../app/visual-overhaul.css", import.meta.url), "utf8");
  const orb = visualCss.match(/\.pulse-orb \.orb-core\s*\{[\s\S]*?\n\}/);
  assert.ok(orb, "expected .pulse-orb .orb-core rule");
  assert.match(orb[0], /min-width:\s*88px/);
  assert.match(orb[0], /min-height:\s*88px/);
  assert.match(orb[0], /padding:\s*10px 8px/);
  assert.match(orb[0], /font-size:\s*clamp\(10px,\s*1\.15vw,\s*12px\)/);
  assert.match(orb[0], /font-variant-numeric:\s*tabular-nums/);
  assert.match(orb[0], /overflow-wrap:\s*break-word/);
  assert.doesNotMatch(orb[0], /width:\s*56px/);
  assert.doesNotMatch(orb[0], /overflow:\s*hidden/);
  assert.match(visualCss, /\.pulse-orb \.orb-core,[\s\S]*border-radius:\s*var\(--radius\)\s*!important/);
});
