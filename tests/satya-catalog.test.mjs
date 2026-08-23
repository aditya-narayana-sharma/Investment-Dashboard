import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSatyaCatalog } from "../app/satya/source-catalog.mjs";
import {
  classifySatyaFamily,
  matchesAxisMutualFund,
  matchesFlipboardTech,
  matchesGrowwDigest,
  shouldIndexSatyaDocument,
} from "../scripts/satya-classify.mjs";

const contentServer = readFileSync(new URL("../scripts/content-digest-server.mjs", import.meta.url), "utf8");

test("Axis Research mailbox is mailbox-backed, not a named Newsletters family", () => {
  assert.equal(classifySatyaFamily({
    mailbox: "Axis Research",
    sender: "Axis Direct <research@axisdirect.in>",
    subject: "Daily Morning Note & Trade Setup for the Day",
  }), "axis_research");
});

test("named families inside Newsletters match sender, domain, and subject prefix", () => {
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "Axis Mutual Fund <research@axismf.com>",
    subject: "Axis MF Monthly Market Outlook",
  }), "axis_mutual_fund");
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "Axis AMC Research <noreply@axisamc.com>",
    subject: "Equity strategy note",
  }), "axis_mutual_fund");
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "Groww Digest <digest@groww.in>",
    subject: "Groww Digest: Nifty breadth and FII flows",
  }), "groww_digest");
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "Flipboard <briefing@flipboard.com>",
    subject: "Tech Briefing: AI chip supply and cloud capex",
  }), "flipboard_tech");
});

test("Axis Direct brokerage promo is not Axis Mutual Fund", () => {
  assert.equal(matchesAxisMutualFund({
    sender: "Axis Direct <service@axisdirect.in>",
    senderEmail: "service@axisdirect.in",
    subject: "Axis Mutual Fund SIP offer — start investing today",
  }), false);
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "Axis Direct <research@axisdirect.in>",
    subject: "Daily Morning Note",
  }), "newsletter_other");
});

test("contract notes and KYC stay out of Axis MF and the corpus", () => {
  const kyc = {
    mailbox: "Newsletters",
    sender: "Axis Mutual Fund <ops@axismf.com>",
    subject: "KYC update required for your folio",
    content: "Please complete KYC with the attached form and registered office details.",
  };
  assert.equal(matchesAxisMutualFund(kyc), false);
  assert.equal(classifySatyaFamily(kyc), "newsletter_other");
  assert.equal(shouldIndexSatyaDocument(kyc), false);
  assert.equal(shouldIndexSatyaDocument({
    mailbox: "Axis Research",
    sender: "Axis Direct <service@axisdirect.in>",
    subject: "Contract Note — Equity",
    content: "Your contract note for today's trades is attached.",
  }), false);
});

test("Groww IPO blasts and Flipboard non-tech mail do not steal named families", () => {
  assert.equal(matchesGrowwDigest({
    sender: "Groww <updates@groww.in>",
    senderEmail: "updates@groww.in",
    subject: "IPO is live",
  }), false);
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "Groww <updates@groww.in>",
    subject: "IPO is live",
  }), "newsletter_other");
  assert.equal(matchesFlipboardTech({
    sender: "Flipboard <news@flipboard.com>",
    subject: "Weekend culture mix",
  }), false);
});

test("Axis MF subject match is a prefix, not a mid-subject mention from another sender", () => {
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "TLDR <dan@tldr.tech>",
    subject: "TLDR: Axis Mutual Fund SIP flows and mid-cap breadth",
  }), "newsletter_other");
  assert.equal(matchesAxisMutualFund({
    sender: "TLDR <dan@tldr.tech>",
    senderEmail: "dan@tldr.tech",
    subject: "TLDR: Axis Mutual Fund SIP flows and mid-cap breadth",
  }), false);
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "Research desk <desk@example.com>",
    subject: "Axis MF Monthly Market Outlook",
  }), "axis_mutual_fund");
});

test("catalog TypeScript module re-exports the canonical .mjs builder", () => {
  const catalogTs = readFileSync(new URL("../app/satya/source-catalog.ts", import.meta.url), "utf8");
  assert.match(catalogTs, /from "\.\/source-catalog\.mjs"/);
  assert.doesNotMatch(catalogTs, /function buildSatyaCatalog|function familyOf/);
});

test("unknown Newsletters senders become newsletter_other; podcasts are supporting", () => {
  assert.equal(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: "TLDR <dan@tldr.tech>",
    subject: "TLDR: Markets and AI",
  }), "newsletter_other");
  assert.equal(classifySatyaFamily({
    mailbox: "Podcasts",
    sender: "Odd Lots",
    subject: "Why copper matters",
    contentSource: "podcast",
  }), "podcasts");
});

test("live catalog auto-registers unique Newsletters senders until a named matcher hits", () => {
  const catalog = buildSatyaCatalog([
    {
      mailbox: "Newsletters",
      source: "TLDR",
      sender: "TLDR <dan@tldr.tech>",
      title: "TLDR: Nifty closed lower amid weak global cues",
      receivedAt: "2026-08-19T03:00:00.000Z",
    },
    {
      mailbox: "Newsletters",
      source: "TLDR",
      sender: "TLDR <dan@tldr.tech>",
      title: "TLDR: Breadth stayed weak across mid-caps",
      receivedAt: "2026-08-18T03:00:00.000Z",
    },
    {
      mailbox: "Newsletters",
      source: "Groww Digest",
      sender: "Groww Digest <digest@groww.in>",
      senderEmail: "digest@groww.in",
      title: "Groww Digest: FII flows reversed",
      receivedAt: "2026-08-19T04:00:00.000Z",
    },
    {
      mailbox: "Axis Research",
      family: "axis_research",
      source: "Axis Direct",
      sender: "Axis Direct <research@axisdirect.in>",
      title: "Result Updates",
      receivedAt: "2026-08-19T02:00:00.000Z",
    },
  ], { asOf: "2026-08-19T10:00:00.000Z" });

  assert.equal(catalog.asOf, "2026-08-19T10:00:00.000Z");
  const tldr = catalog.senders.find((row) => row.sender === "TLDR");
  assert.ok(tldr);
  assert.equal(tldr.family, "newsletter_other");
  assert.equal(tldr.messageCount, 2);
  const groww = catalog.senders.find((row) => row.family === "groww_digest");
  assert.ok(groww);
  assert.notEqual(groww.family, "newsletter_other");
  assert.equal(catalog.families.find((row) => row.family === "newsletter_other")?.count, 2);
  assert.equal(catalog.families.find((row) => row.family === "axis_research")?.count, 1);
  assert.ok(catalog.families.every((row) => ["axis_research", "axis_mutual_fund", "groww_digest", "flipboard_tech", "newsletter_other", "podcasts"].includes(row.family)));
});

function extractConstRaw(source, name) {
  const marker = `const ${name} = String.raw\``;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const from = start + marker.length;
  const end = source.indexOf("`;", from);
  return end > from ? source.slice(from, end) : "";
}

test("Newsletters Mail read stays metadata plus body-slice and never dumps MIME source", () => {
  const newsletterList = extractConstRaw(contentServer, "newsletterListScript");
  const newsletterBody = extractConstRaw(contentServer, "newsletterBodyScript");
  const newsletterHelpers = extractConstRaw(contentServer, "newsletterMailboxHelpers");
  const axisBody = extractConstRaw(contentServer, "axisBodyScript");
  const axisHelpers = extractConstRaw(contentServer, "mailLinkHelpers");

  assert.match(newsletterList, /mailMessageIdHelper/);
  assert.match(newsletterBody, /mailMessageIdHelper/);
  assert.match(newsletterBody, /NEWSLETTER_CONTENT_CHARS/);
  assert.match(newsletterBody, /message\.content\(\)/);
  assert.match(newsletterHelpers, /exactMailbox\(account, "Newsletters"\)/);

  for (const script of [newsletterList, newsletterBody, newsletterHelpers]) {
    assert.doesNotMatch(script, /mailLinkHelpers/);
    assert.doesNotMatch(script, /mailReportLinks/);
    assert.doesNotMatch(script, /mailAttachmentNames/);
    assert.doesNotMatch(script, /message\.source\(\)/);
    assert.doesNotMatch(script, /message\.properties\(\)/);
  }

  assert.match(axisBody, /mailLinkHelpers/);
  assert.match(axisBody, /mailReportLinks\(message\)/);
  assert.match(axisBody, /mailAttachmentNames\(message\)/);
  assert.match(axisHelpers, /message\.source\(\)/);
});

test("digest server classifies items and ingests corpus after successful Mail/podcast reads", () => {
  assert.match(contentServer, /NEWSLETTER_DIGEST_LIMIT = 500/);
  assert.match(contentServer, /ANALYSIS_WINDOW_START = process\.env\.INVESTMENT_ANALYSIS_START_DATE \?\? istDateKey\(3\)/);
  assert.match(contentServer, /sourceFamily: classifySatyaFamily/);
  assert.match(contentServer, /sourceFamily: "podcasts"/);
  assert.match(contentServer, /ingestSatyaDigestRefresh/);
  assert.match(contentServer, /ingestSatyaAxisPdfArchive/);
  assert.match(contentServer, /recordSatyaIngestError/);
  assert.match(contentServer, /exactMailbox\(account, "Newsletters"\)/);
  assert.match(contentServer, /exactMailbox\(account, "Axis Research"\)/);
  assert.match(contentServer, /readAxisListing/);
  assert.match(contentServer, /isAxisResearchSender/);
});
