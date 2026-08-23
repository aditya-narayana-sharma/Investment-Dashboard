import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  AXIS_RESEARCH_CATEGORIES,
  AXIS_RESEARCH_CATEGORY_IDS,
  DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS,
  classifyAxisCategory,
  isDefaultRetrieveAxisCategory,
  resolveAxisCategoryFilter,
} from "../app/satya/axis-categories.mjs";
import {
  axisTopicGroup,
  indexAxisPdfArchive,
  matchAxisResearchPdf,
} from "../scripts/axis-digest-links.mjs";
import { isAxisResearchMail } from "../scripts/axis-mail-filter.mjs";
import { searchSatyaCorpus, upsertSatyaDocument } from "../scripts/satya-corpus.mjs";

const SAMPLE_SUBJECTS = {
  result_update: "Result Update: HDFC Bank - Q1FY27",
  sector_update: "Sector Update: Banking - August 2026",
  auto_monthly_sales_volume: "Auto Monthly Sales Volume - July 2026",
  earnings_preview: "Earnings Preview: Infosys",
  axis_alpha: "Axis Alpha: TBO Tek Ltd - BUY",
  company_update: "Company Update: Reliance Industries",
  axis_punch: "Axis Punch - Oberoi Realty Limited",
  axis_top_picks: "Axis Top Picks - August 2026",
  book_profits: "Book Profits: Tata Motors",
  call_closure: "Call Closure: ITC Ltd",
  result_preview: "Result Preview: HDFC Bank",
  daily_derivatives_insights: "Daily Derivatives Insights - 06 August 2026",
  daily_morning_note: "Daily Morning Note & Trade Setup for the Day - August 06, 2026",
  daily_stock_derivative_lens: "Daily Stock Derivative Lens - 06 August 2026",
  daily_technical_outlook: "Daily Technical Outlook",
  sector_opportunity: "Sector Opportunity: Chemicals",
  monthly_quant_report: "Monthly Quant Report August 2026",
  monthly_technical_outlook_picks: "Monthly Technical Outlook & Picks - August 2026",
  pick_of_the_week: "Pick of the Week: Bajaj Finance",
  quarterly_result_updates: "Result Updates - Q1FY27: Our Latest Stock Recommendations & Target Prices",
  sector_seasonality_report: "Sector Seasonality Report - August 2026",
  target_achieved: "Target Achieved: Cholamandalam Investment and Fin Co Ltd - Axis Punch",
  top_conviction_ideas: "Top Conviction Ideas - August 2026",
  weekly_derivatives_insights: "Weekly Derivatives Insights - 10 August 2026",
  weekly_technical_picks: "Weekly Technical Picks - 10 August 2026",
  axis_annual_analysis: "Axis Annual Analysis: HDFC Bank",
  important_update: "Important Update: Portfolio Action",
  live_webinars: "LIVE Webinar: Simplifying the World of Options Trading | Register Now",
  other_research: "Event Updates: RBI Monetary Policy",
};

test("catalog has 28 named categories plus other_research", () => {
  assert.equal(AXIS_RESEARCH_CATEGORIES.length, 29);
  assert.equal(AXIS_RESEARCH_CATEGORY_IDS.filter((id) => id !== "other_research").length, 28);
  assert.ok(AXIS_RESEARCH_CATEGORY_IDS.includes("other_research"));
  assert.equal(isDefaultRetrieveAxisCategory("live_webinars"), false);
  assert.ok(!DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS.includes("live_webinars"));
  assert.ok(DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS.includes("axis_punch"));
});

test("classifyAxisCategory matches one sample subject per category", () => {
  for (const [id, subject] of Object.entries(SAMPLE_SUBJECTS)) {
    assert.equal(classifyAxisCategory(subject), id, subject);
  }
});

test("match order keeps more specific Axis subjects from collapsing", () => {
  assert.equal(
    classifyAxisCategory("Monthly Technical Outlook & Picks - August 2026"),
    "monthly_technical_outlook_picks",
  );
  assert.notEqual(
    classifyAxisCategory("Monthly Technical Outlook & Picks - August 2026"),
    "daily_technical_outlook",
  );
  assert.equal(classifyAxisCategory("Axis Annual Analysis: HDFC Bank"), "axis_annual_analysis");
  assert.notEqual(classifyAxisCategory("Axis Annual Analysis: HDFC Bank"), "company_update");
  assert.equal(
    classifyAxisCategory("Result Updates - Q1FY27: Our Latest Stock Recommendations & Target Prices"),
    "quarterly_result_updates",
  );
  assert.equal(classifyAxisCategory("Result Update: HDFC Bank"), "result_update");
  assert.equal(classifyAxisCategory("Axis Punch - Oberoi Realty Limited"), "axis_punch");
  assert.equal(classifyAxisCategory("Market punch above resistance in Nifty"), "other_research");
  assert.equal(classifyAxisCategory("Axis \u0391lpha: TBO Tek Ltd - BUY"), "axis_alpha");
  assert.equal(classifyAxisCategory("Sector Oppportunity: Chemicals"), "sector_opportunity");
  assert.equal(classifyAxisCategory("Earnings Preview: Infosys"), "earnings_preview");
  assert.equal(classifyAxisCategory("Result Preview: Infosys"), "result_preview");
  assert.equal(classifyAxisCategory("Axis Top Picks - August 2026"), "axis_top_picks");
  assert.equal(classifyAxisCategory("Top Conviction Ideas - August 2026"), "top_conviction_ideas");
  assert.equal(classifyAxisCategory("Update - KYC pending"), "other_research");
  assert.equal(axisTopicGroup("Axis Punch - Oberoi Realty Limited"), "Axis Punch");
  assert.equal(axisTopicGroup("Monthly Quant Report August 2026"), "Monthly Quant Report");
});

test("live webinars classify but stay out of default retrieve", () => {
  assert.equal(
    classifyAxisCategory("LIVE Webinar: Simplifying the World of Options Trading | Register Now"),
    "live_webinars",
  );
  assert.ok(!resolveAxisCategoryFilter(undefined).includes("live_webinars"));
  assert.ok(!resolveAxisCategoryFilter([]).includes("live_webinars"));
  assert.deepEqual(resolveAxisCategoryFilter(["live_webinars"]), ["live_webinars"]);
  assert.equal(
    isAxisResearchMail({
      sender: "Axis Direct <research@axisdirect.in>",
      subject: "LIVE Webinar: Options Trading | Register Now",
    }),
    true,
  );
  assert.equal(
    isAxisResearchMail({
      sender: "Axis Direct <service@axisdirect.in>",
      subject: "966526 is your access code to log in",
    }),
    false,
  );
  assert.equal(
    isAxisResearchMail({
      sender: "Axis Direct <service@axisdirect.in>",
      subject: "Build your retirement fund with Axis Direct NPS",
    }),
    false,
  );
});

test("axisCategories SQL filter runs before LIMIT and default retrieve omits webinars", () => {
  const dir = mkdtempSync(join(tmpdir(), "satya-axis-cat-"));
  const path = join(dir, "corpus.sqlite");
  const body = "xylophonemacrobrief copper demand and grid investment rose together this quarter with further commentary.";
  upsertSatyaDocument({
    messageId: "<axis-morning-cat>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Daily Morning Note",
    receivedAt: "2026-08-19T03:21:00.000Z",
    content: body,
    bullets: [body],
    contentSource: "mail",
  }, path);
  upsertSatyaDocument({
    messageId: "<axis-punch-cat>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Axis Punch - Oberoi Realty Limited",
    receivedAt: "2026-08-19T04:21:00.000Z",
    content: body,
    bullets: [body],
    contentSource: "mail",
  }, path);
  upsertSatyaDocument({
    messageId: "<axis-webinar-cat>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "LIVE Webinar: Options Trading",
    receivedAt: "2026-08-19T05:21:00.000Z",
    content: body,
    bullets: [body],
    contentSource: "mail",
  }, path);

  const punchOnly = searchSatyaCorpus("xylophonemacrobrief", {
    families: ["axis_research"],
    axisCategories: ["axis_punch"],
    path,
  });
  assert.equal(punchOnly.length, 1);
  assert.match(punchOnly[0]?.title ?? "", /Axis Punch/);

  const defaultHits = searchSatyaCorpus("xylophonemacrobrief", { families: ["axis_research"], path });
  assert.ok(defaultHits.some((hit) => /Morning Note/i.test(hit.title)));
  assert.ok(defaultHits.some((hit) => /Axis Punch/i.test(hit.title)));
  assert.ok(!defaultHits.some((hit) => /Webinar/i.test(hit.title)));

  const webinarHits = searchSatyaCorpus("xylophonemacrobrief", {
    families: ["axis_research"],
    axisCategories: ["live_webinars"],
    path,
  });
  assert.equal(webinarHits.length, 1);
  assert.match(webinarHits[0]?.title ?? "", /Webinar/i);
});

test("PDF matcher still resolves dated MorningNote and TechnicalOutlook after label rename", () => {
  const root = mkdtempSync(join(tmpdir(), "axis-pdf-cat-"));
  mkdirSync(join(root, "Axis Reports"), { recursive: true });
  writeFileSync(join(root, "Axis_MorningNote-2026-08-06.pdf"), "%PDF-1.4");
  writeFileSync(join(root, "Axis_TechnicalOutlook-2026-08-06.pdf"), "%PDF-1.4");
  const index = indexAxisPdfArchive(root);

  assert.equal(
    matchAxisResearchPdf({
      subject: "Daily Morning Note & Trade Setup for the Day - August 06, 2026",
      receivedAt: "2026-08-06T02:00:00.000Z",
      archiveIndex: index,
    })?.file,
    "Axis_MorningNote-2026-08-06.pdf",
  );
  assert.equal(
    matchAxisResearchPdf({
      subject: "Daily Technical Outlook",
      receivedAt: "2026-08-06T02:00:00.000Z",
      archiveIndex: index,
    })?.file,
    "Axis_TechnicalOutlook-2026-08-06.pdf",
  );
});
