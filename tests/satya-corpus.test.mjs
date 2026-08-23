import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  countSatyaDocuments,
  getSatyaMeta,
  ingestSatyaDigestRefresh,
  listSatyaDocuments,
  recordSatyaIngestError,
  resolveSatyaRepoRoot,
  satyaBackfillWindow,
  satyaCatalogPath,
  satyaCorpusPath,
  searchSatyaCorpus,
  upsertSatyaDocument,
  buildSatyaFtsQuery,
} from "../scripts/satya-corpus.mjs";
import { classifyAxisCategory, DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS } from "../app/satya/axis-categories.mjs";
import { retrieveSatyaPassages } from "../app/satya/retrieve.ts";
import { ingestSatyaAxisPdfArchive, isValidPdfHeader } from "../scripts/satya-axis-pdf-ingest.mjs";

function tempCorpus() {
  const dir = mkdtempSync(join(tmpdir(), "satya-corpus-"));
  return {
    dir,
    path: join(dir, "corpus.sqlite"),
    catalogPath: join(dir, "catalog.json"),
  };
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("corpus path is repo-root absolute, not dist/server from a Vinext bundle", () => {
  const previousCorpus = process.env.SATYA_CORPUS_PATH;
  const previousCatalog = process.env.SATYA_CATALOG_PATH;
  delete process.env.SATYA_CORPUS_PATH;
  delete process.env.SATYA_CATALOG_PATH;
  try {
    const bundledServer = join(REPO_ROOT, "dist", "server");
    assert.equal(resolveSatyaRepoRoot([bundledServer]), resolve(REPO_ROOT));
    assert.equal(resolveSatyaRepoRoot([join(bundledServer, "chunks")]), resolve(REPO_ROOT));
    const corpus = satyaCorpusPath();
    const catalog = satyaCatalogPath();
    assert.equal(isAbsolute(corpus), true);
    assert.equal(corpus, join(resolve(REPO_ROOT), "artifacts", "private", "satya", "corpus.sqlite"));
    assert.equal(catalog, join(resolve(REPO_ROOT), "artifacts", "private", "satya", "catalog.json"));
    assert.doesNotMatch(corpus, /\/dist\/(?:server\/)?artifacts\//);
  } finally {
    if (previousCorpus === undefined) delete process.env.SATYA_CORPUS_PATH;
    else process.env.SATYA_CORPUS_PATH = previousCorpus;
    if (previousCatalog === undefined) delete process.env.SATYA_CATALOG_PATH;
    else process.env.SATYA_CATALOG_PATH = previousCatalog;
  }
});

const niftyBody = [
  "Nifty closed lower amid weak global cues and thin breadth.",
  "Banking names led the selloff while IT held relatively better.",
  "Foreign flows remained net sellers for a third session.",
].join(" ");

test("FTS search returns citations with family, date, title, sender, and excerpt", () => {
  const { path } = tempCorpus();
  const inserted = upsertSatyaDocument({
    messageId: "<axis-morning@axisdirect.in>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Daily Morning Note",
    receivedAt: "2026-08-19T03:21:00.000Z",
    content: niftyBody,
    bullets: [
      "Nifty closed lower amid weak global cues and thin breadth.",
      "Banking names led the selloff while IT held relatively better.",
    ],
    messageUrl: "message://%3Caxis-morning%40axisdirect.in%3E",
    pdfUrl: "/api/axis-research/pdf?file=Axis_MorningNote-2026-08-19.pdf",
    contentSource: "mail",
  }, path);

  assert.equal(inserted.upserted, true);
  const hits = searchSatyaCorpus("Nifty closed lower", { limit: 5, path });
  assert.ok(hits.length >= 1);
  const hit = hits[0];
  assert.equal(hit.family, "axis_research");
  assert.equal(hit.title, "Daily Morning Note");
  assert.equal(hit.date, "2026-08-19T03:21:00.000Z");
  assert.equal(hit.sender, "Axis Direct");
  assert.match(hit.excerpt, /Nifty closed lower/i);
  assert.equal(hit.messageUrl, "message://%3Caxis-morning%40axisdirect.in%3E");
  assert.equal(hit.pdfUrl, "/api/axis-research/pdf?file=Axis_MorningNote-2026-08-19.pdf");
});

test("axis_research ranks above newsletter_other for the same query", () => {
  const { path } = tempCorpus();
  upsertSatyaDocument({
    messageId: "<other@tldr.tech>",
    mailbox: "Newsletters",
    family: "newsletter_other",
    sender: "TLDR <dan@tldr.tech>",
    title: "TLDR markets",
    receivedAt: "2026-08-19T04:00:00.000Z",
    content: niftyBody,
    bullets: ["Nifty closed lower amid weak global cues and thin breadth."],
    contentSource: "mail",
  }, path);
  upsertSatyaDocument({
    messageId: "<axis@axisdirect.in>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Daily Morning Note",
    receivedAt: "2026-08-19T03:00:00.000Z",
    content: niftyBody,
    bullets: ["Nifty closed lower amid weak global cues and thin breadth."],
    contentSource: "mail",
  }, path);

  const hits = searchSatyaCorpus("Nifty closed lower", { limit: 5, path });
  assert.ok(hits.length >= 2);
  assert.equal(hits[0].family, "axis_research");
  assert.ok(hits.some((hit) => hit.family === "newsletter_other"));
});

test("promo-only mail is skipped and content-hash changes re-index", () => {
  const { path } = tempCorpus();
  const promo = upsertSatyaDocument({
    messageId: "<promo@axisdirect.in>",
    mailbox: "Axis Research",
    sender: "Axis Direct <service@axisdirect.in>",
    title: "Learn Account Offer Benefits",
    receivedAt: "2026-08-19T01:00:00.000Z",
    content: "Register now and unlock wealth with our limited-time brokerage plan.",
    contentSource: "mail",
  }, path);
  assert.equal(promo.upserted, false);
  assert.equal(promo.skipped, "promo_or_empty");

  const first = upsertSatyaDocument({
    messageId: "<groww@groww.in>",
    mailbox: "Newsletters",
    family: "groww_digest",
    sender: "Groww Digest <digest@groww.in>",
    title: "Groww Digest: FII flows reversed",
    receivedAt: "2026-08-19T05:00:00.000Z",
    content: "Foreign institutional investors turned net buyers after three sessions of outflows.",
    bullets: ["Foreign institutional investors turned net buyers after three sessions of outflows."],
    contentSource: "mail",
  }, path);
  assert.equal(first.upserted, true);

  const same = upsertSatyaDocument({
    messageId: "<groww@groww.in>",
    mailbox: "Newsletters",
    family: "groww_digest",
    sender: "Groww Digest <digest@groww.in>",
    title: "Groww Digest: FII flows reversed",
    receivedAt: "2026-08-19T05:00:00.000Z",
    content: "Foreign institutional investors turned net buyers after three sessions of outflows.",
    bullets: ["Foreign institutional investors turned net buyers after three sessions of outflows."],
    contentSource: "mail",
  }, path);
  assert.equal(same.upserted, false);
  assert.equal(same.skipped, "unchanged");

  const updated = upsertSatyaDocument({
    messageId: "<groww@groww.in>",
    mailbox: "Newsletters",
    family: "groww_digest",
    sender: "Groww Digest <digest@groww.in>",
    title: "Groww Digest: FII flows reversed",
    receivedAt: "2026-08-19T05:00:00.000Z",
    content: "Foreign institutional investors turned net buyers and rupee yields stayed firm.",
    bullets: ["Foreign institutional investors turned net buyers and rupee yields stayed firm."],
    contentSource: "mail",
  }, path);
  assert.equal(updated.upserted, true);

  const hits = searchSatyaCorpus("rupee yields", { path });
  assert.ok(hits.some((hit) => /rupee yields/i.test(hit.excerpt)));
});

test("digest ingest writes a live catalog snapshot without dumping podcasts as mail", () => {
  const { path, catalogPath } = tempCorpus();
  const catalog = ingestSatyaDigestRefresh({
    newsletters: [{
      source: "Stratechery",
      sender: "Stratechery <ben@stratechery.com>",
      title: "Cloud capex and advertising",
      receivedAt: "2026-08-19T06:00:00.000Z",
      summary: "Microsoft raised capex guidance after Azure growth accelerated this quarter.",
      bullets: ["Microsoft raised capex guidance after Azure growth accelerated this quarter."],
      sourceFamily: "newsletter_other",
      messageId: "<ben@stratechery.com>",
    }],
    axisResearch: [{
      source: "Axis Direct",
      title: "Result Updates",
      receivedAt: "2026-08-19T02:10:00.000Z",
      summary: "HDFC Bank reported a sequential rise in net interest income this quarter.",
      bullets: ["HDFC Bank reported a sequential rise in net interest income this quarter."],
      sourceFamily: "axis_research",
      messageId: "<result@axisdirect.in>",
      pdfUrl: "/api/axis-research/pdf?file=Axis_Result-2026-08-19.pdf",
    }],
    podcasts: [{
      source: "Odd Lots",
      title: "Why copper matters for electrification",
      receivedAt: "2026-08-18T12:00:00.000Z",
      summary: "Copper demand is expected to rise as grid investment and EVs expand together.",
      bullets: ["Copper demand is expected to rise as grid investment and EVs expand together."],
      sourceFamily: "podcasts",
      episodeUrl: "https://podcasts.apple.com/podcast/id123?i=456",
    }],
    asOf: "2026-08-19T10:00:00.000Z",
    corpusPath: path,
    catalogPath,
  });

  assert.equal(catalog.asOf, "2026-08-19T10:00:00.000Z");
  assert.ok(catalog.senders.some((row) => row.family === "newsletter_other" && row.sender === "Stratechery"));
  const snapshot = JSON.parse(readFileSync(catalogPath, "utf8"));
  assert.equal(snapshot.families.find((row) => row.family === "podcasts")?.count, 1);

  const podcastHits = searchSatyaCorpus("copper demand", { families: ["podcasts"], path });
  assert.equal(podcastHits[0]?.family, "podcasts");
  assert.match(podcastHits[0].messageUrl, /podcasts\.apple\.com/);
});

test("family filter is applied in SQL before the FTS LIMIT so selected families cannot drop true hits", () => {
  const { path } = tempCorpus();
  const token = "xylophonemacrobrief";
  const body = `${token} copper demand and grid investment rose together this quarter with further commentary on electrification.`;
  for (let index = 0; index < 81; index += 1) {
    upsertSatyaDocument({
      messageId: `<nl-${index}@tldr.tech>`,
      mailbox: "Newsletters",
      family: "newsletter_other",
      sender: `TLDR ${index} <dan${index}@tldr.tech>`,
      title: `TLDR ${token} ${index}`,
      receivedAt: `2026-08-19T${String(10 + Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`,
      content: body,
      bullets: [body],
      contentSource: "mail",
    }, path);
  }
  upsertSatyaDocument({
    messageId: "<odd-lots-copper>",
    mailbox: "Podcasts",
    family: "podcasts",
    sender: "Odd Lots",
    title: `Why ${token} copper matters`,
    receivedAt: "2026-08-01T12:00:00.000Z",
    content: body,
    bullets: [body],
    contentSource: "podcast",
    messageUrl: "https://podcasts.apple.com/podcast/id123?i=456",
  }, path);

  assert.equal(countSatyaDocuments(path), 82);
  const unfiltered = searchSatyaCorpus(token, { limit: 8, path });
  assert.ok(unfiltered.length >= 1);
  const podcastHits = searchSatyaCorpus(token, { families: ["podcasts"], limit: 8, path });
  assert.equal(podcastHits.length, 1);
  assert.equal(podcastHits[0]?.family, "podcasts");
  assert.match(podcastHits[0]?.title ?? "", /copper matters/i);
});

test("successful digest ingest clears a recorded corpus ingest error", () => {
  const { path, catalogPath } = tempCorpus();
  recordSatyaIngestError(new Error("disk full"), path);
  assert.equal(getSatyaMeta("ingestError", path), "disk full");
  ingestSatyaDigestRefresh({
    newsletters: [{
      source: "Stratechery",
      sender: "Stratechery <ben@stratechery.com>",
      title: "Cloud capex",
      receivedAt: "2026-08-19T06:00:00.000Z",
      summary: "Microsoft raised capex guidance after Azure growth accelerated this quarter.",
      bullets: ["Microsoft raised capex guidance after Azure growth accelerated this quarter."],
      sourceFamily: "newsletter_other",
      messageId: "<ben-capex@stratechery.com>",
    }],
    asOf: "2026-08-19T10:00:00.000Z",
    corpusPath: path,
    catalogPath,
  });
  assert.equal(getSatyaMeta("ingestError", path), "");
});

test("digest podcast ingest stores transcript vs description evidence and never relabels descriptions", () => {
  const { path, catalogPath } = tempCorpus();
  ingestSatyaDigestRefresh({
    podcasts: [
      {
        source: "Odd Lots",
        title: "Copper inventories",
        receivedAt: "2026-08-19T12:00:00.000Z",
        summary: "Inventories tightened on the LME according to the episode description.",
        bullets: ["Inventories tightened on the LME according to the episode description."],
        sourceFamily: "podcasts",
        messageId: "<odd-lots-copper>",
        contentSource: "description",
        episodeUrl: "https://podcasts.apple.com/podcast/id123?i=1",
      },
      {
        source: "We Study Billionaires",
        title: "FCF yields",
        receivedAt: "2026-08-19T13:00:00.000Z",
        summary: "The guest cited a 14% free-cash-flow yield on the local transcript.",
        bullets: ["The guest cited a 14% free-cash-flow yield on the local transcript."],
        sourceFamily: "podcasts",
        messageId: "<wsb-fcf>",
        contentSource: "transcript",
        episodeUrl: "https://podcasts.apple.com/podcast/id123?i=2",
      },
    ],
    asOf: "2026-08-19T14:00:00.000Z",
    corpusPath: path,
    catalogPath,
  });
  const rows = listSatyaDocuments({ path });
  const description = rows.find((row) => row.message_id === "<odd-lots-copper>");
  const transcript = rows.find((row) => row.message_id === "<wsb-fcf>");
  assert.equal(description?.family, "podcasts");
  assert.equal(description?.content_source, "podcast");
  assert.equal(description?.evidence_kind, "description");
  assert.equal(transcript?.content_source, "podcast");
  assert.equal(transcript?.evidence_kind, "transcript");
});

test("backfill window resumes from last indexed timestamp within the 90-day lookback", () => {
  const now = Date.parse("2026-08-19T12:00:00.000Z");
  const fresh = satyaBackfillWindow({ now, days: 90, lastIndexedReceivedAt: null });
  assert.equal(fresh.lookbackDays, 90);
  assert.equal(fresh.end, "2026-08-19T12:00:00.000Z");
  assert.ok(Date.parse(fresh.start) < now);

  const cursor = "2026-07-01T00:00:00.000Z";
  const resumed = satyaBackfillWindow({ now, days: 90, lastIndexedReceivedAt: cursor });
  assert.equal(resumed.start, new Date(cursor).toISOString());

  const staleCursor = "2025-01-01T00:00:00.000Z";
  const clamped = satyaBackfillWindow({ now, days: 90, lastIndexedReceivedAt: staleCursor });
  assert.equal(clamped.start, clamped.cutoff);
});

test("Axis mail upsert stamps axis_category and PDF rows use content_source=pdf", () => {
  const { path } = tempCorpus();
  upsertSatyaDocument({
    messageId: "<morning@axisdirect.in>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Daily Morning Note & Trade Setup for the Day - August 19, 2026",
    receivedAt: "2026-08-19T03:21:00.000Z",
    content: niftyBody,
    bullets: ["Nifty closed lower amid weak global cues and thin breadth."],
    contentSource: "mail",
  }, path);
  upsertSatyaDocument({
    messageId: "pdf:morning-note-archive",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct",
    title: "Axis Morning Note 2026-08-19",
    subject: "Axis_MorningNote-2026-08-19.pdf",
    receivedAt: "2026-08-19T03:21:00.000Z",
    content: `${niftyBody} Extracted from the local Morning Note PDF text layer only.`,
    pdfUrl: "/api/axis-research/pdf?file=Axis_MorningNote-2026-08-19.pdf",
    pdfPath: "/tmp/Axis Research/Axis_MorningNote-2026-08-19.pdf",
    contentSource: "pdf",
  }, path);

  const rows = listSatyaDocuments({ path });
  const mail = rows.find((row) => row.message_id === "<morning@axisdirect.in>");
  const pdf = rows.find((row) => row.content_source === "pdf");
  assert.equal(mail?.axis_category, "daily_morning_note");
  assert.equal(pdf?.axis_category, "daily_morning_note");
  assert.equal(pdf?.pdf_path, "/tmp/Axis Research/Axis_MorningNote-2026-08-19.pdf");
  assert.match(pdf?.pdf_url ?? "", /Axis_MorningNote-2026-08-19\.pdf/);
  assert.equal(classifyAxisCategory("Axis Αlpha: Global Health Ltd - BUY"), "axis_alpha");
  assert.equal(classifyAxisCategory("Monthly Technical Outlook & Picks"), "monthly_technical_outlook_picks");
  assert.equal(classifyAxisCategory("Result Updates - Q1FY27: Our Latest Stock Recommendations"), "quarterly_result_updates");
});

test("live_webinars index but are excluded from default Satya retrieval", () => {
  const { path } = tempCorpus();
  upsertSatyaDocument({
    messageId: "<webinar@axisdirect.in>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "LIVE Webinar: Simplifying the World of Options Trading | Register Now",
    receivedAt: "2026-08-19T08:00:00.000Z",
    content: "Register now and book your seat for this Axis Direct live webinar on options.",
    contentSource: "mail",
    axisCategory: "live_webinars",
  }, path);
  upsertSatyaDocument({
    messageId: "<punch@axisdirect.in>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Axis Punch - SBI Cards",
    receivedAt: "2026-08-19T07:00:00.000Z",
    content: "Axis Punch reiterated a trading buy on SBI Cards after the latest derivative setup.",
    bullets: ["Axis Punch reiterated a trading buy on SBI Cards after the latest derivative setup."],
    contentSource: "mail",
  }, path);

  const defaultHits = searchSatyaCorpus("SBI Cards derivative setup", { families: ["axis_research"], path });
  assert.ok(defaultHits.some((hit) => hit.title.includes("SBI Cards")));
  assert.equal(defaultHits.some((hit) => /webinar/i.test(hit.title)), false);

  const webinarHits = searchSatyaCorpus("options trading webinar", {
    families: ["axis_research"],
    axisCategories: ["live_webinars"],
    path,
  });
  assert.equal(webinarHits.length, 1);
  assert.equal(webinarHits[0]?.axisCategory, "live_webinars");
});

const AXIS_RESULT_UPDATES_PROMPT =
  "Summarize Axis Research result updates and company notes from the supplied digest only. Leave unpublished KPIs blank. Never invent figures.";

test("Axis result updates suggestion uses content-term OR FTS, not instruction AND", () => {
  const match = buildSatyaFtsQuery(AXIS_RESULT_UPDATES_PROMPT);
  assert.match(match, /result/i);
  assert.match(match, /update/i);
  assert.match(match, /\bOR\b/);
  assert.doesNotMatch(match, /\bAND\b/);
  assert.doesNotMatch(match, /summarize/i);
  assert.doesNotMatch(match, /unpublished/i);
  assert.doesNotMatch(match, /invent/i);
  assert.doesNotMatch(match, /digest/i);
  assert.doesNotMatch(match, /kpis/i);
});

test("Axis result updates suggestion retrieves an axis_research result_update fixture", () => {
  const { path } = tempCorpus();
  upsertSatyaDocument({
    messageId: "<result-update-hdfc>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Result Update: HDFC Bank - Q1FY27",
    receivedAt: "2026-08-19T02:10:00.000Z",
    content: "HDFC Bank reported a sequential rise in net interest income this quarter. Operating profit improved versus the prior period.",
    bullets: ["HDFC Bank reported a sequential rise in net interest income this quarter."],
    contentSource: "mail",
  }, path);
  upsertSatyaDocument({
    messageId: "<company-update-infosys>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Company Update: Infosys",
    receivedAt: "2026-08-18T09:00:00.000Z",
    content: "Infosys restated its large-deal pipeline commentary without a new target price in this note.",
    bullets: ["Infosys restated its large-deal pipeline commentary without a new target price in this note."],
    contentSource: "mail",
  }, path);
  upsertSatyaDocument({
    messageId: "<morning-note-distractor>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Daily Morning Note & Trade Setup for the Day - August 19, 2026",
    receivedAt: "2026-08-19T03:21:00.000Z",
    content: niftyBody,
    bullets: ["Nifty closed lower amid weak global cues and thin breadth."],
    contentSource: "mail",
  }, path);

  const hits = retrieveSatyaPassages({
    query: AXIS_RESULT_UPDATES_PROMPT,
    families: ["axis_research"],
    axisCategories: [...DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS],
    path,
  });
  assert.ok(hits.length >= 1, "instruction prompt must not false no_match against result_update rows");
  assert.ok(
    hits.every((hit) => hit.family === "axis_research"),
    "result-updates intent must stay on axis_research",
  );
  assert.ok(
    hits.some((hit) => hit.axisCategory === "result_update" || hit.axisCategory === "company_update"),
  );
  assert.equal(hits.some((hit) => /Morning Note/i.test(hit.title)), false);

  const ftsOnly = searchSatyaCorpus(AXIS_RESULT_UPDATES_PROMPT, {
    families: ["axis_research"],
    path,
  });
  assert.ok(ftsOnly.some((hit) => /Result Update/i.test(hit.title)));
});

test("category recency fallback still returns result_update rows when FTS misses", () => {
  const { path } = tempCorpus();
  upsertSatyaDocument({
    messageId: "<result-update-silent>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "HDFC Bank Q1 pack",
    receivedAt: "2026-08-19T02:10:00.000Z",
    content: "Net interest income rose sequentially versus the prior period.",
    contentSource: "mail",
    axisCategory: "result_update",
  }, path);

  const miss = searchSatyaCorpus("zzzz-no-such-term", {
    families: ["axis_research"],
    axisCategories: ["result_update"],
    path,
  });
  assert.equal(miss.length, 0);

  const fallback = searchSatyaCorpus("zzzz-no-such-term", {
    families: ["axis_research"],
    axisCategories: ["result_update"],
    recencyFallback: true,
    path,
  });
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0]?.axisCategory, "result_update");
  assert.equal(fallback[0]?.family, "axis_research");
});

test("PDF archive ingest skips corrupt files and does not invent text", async () => {
  const { path, dir } = tempCorpus();
  const archive = join(dir, "Axis Research");
  mkdirSync(archive, { recursive: true });
  const corrupt = join(archive, "broken.pdf");
  const headerOnly = join(archive, "Axis_MorningNote-2026-08-19.pdf");
  writeFileSync(corrupt, "not a pdf");
  writeFileSync(headerOnly, "%PDF-1.4\n");
  assert.equal(isValidPdfHeader(corrupt), false);
  assert.equal(isValidPdfHeader(headerOnly), true);

  const stats = await ingestSatyaAxisPdfArchive({
    archiveRoot: archive,
    mailItems: [],
    corpusPath: path,
  });
  assert.equal(stats.attempted, 2);
  assert.equal(stats.valid, 1);
  assert.ok(stats.skippedCorrupt >= 1);
  assert.equal(countSatyaDocuments(path), 0);
  assert.ok(getSatyaMeta("lastPdfIngestAt", path));
});

