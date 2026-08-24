import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isLlmAssistTask, llmAssistSystemPrompt } from "../app/local-llm-assist.ts";
import { chunkTextForSse, formatSatyaLlmOperatorMessage } from "../app/local-llm-client.ts";
import {
  classifySatyaRefusal,
  encodeSatyaSse,
  buildSatyaUserPrompt,
  deleteSatyaSession,
  listSatyaSessions,
  persistSatyaSession,
  renameSatyaSession,
  runSatyaChat,
  satyaGenerationBudget,
  satyaRefusalMessage,
  satyaSessionDisplayTitle,
  satyaSystemPrompt,
} from "../app/satya/chat.ts";
import {
  earningsPassagesFromSnapshot,
  isSatyaBroadSurveyQuery,
  isSatyaCorpusEmpty,
  loadSatyaCatalog,
  readMailFreshness,
  packSatyaPassages,
  packedSatyaEvidenceChars,
  retrieveSatyaPassages,
  SATYA_PROMPT_INPUT_CHAR_CAP,
  satyaRetrieveBudget,
  searchSatyaCorpus,
  workspaceQueryHints,
} from "../app/satya/retrieve.ts";
import { compactCitationLinks, citationSourceBadges, groupedAxisResearchCategories, resolveSatyaWorkspaceSlot, satyaCorpusHealthFromStatus, satyaShouldSpeak } from "../app/dashboard/satya-client.ts";
import { buildEarningsSnapshot } from "../app/earnings-verify.ts";
import { earningsCalendar } from "../app/portfolio-data.ts";
import { upsertSatyaDocument } from "../scripts/satya-corpus.mjs";

test("satya is an LLM assist task with a retrieval-only system prompt", () => {
  assert.equal(isLlmAssistTask("satya"), true);
  const prompt = llmAssistSystemPrompt("satya");
  assert.equal(prompt, satyaSystemPrompt());
  assert.match(prompt, /Use ONLY the retrieved passages/i);
  assert.match(prompt, /family, date, and title|family, date, category, and title/);
  assert.match(prompt, /compact mail\/pdf\/podcast\/earnings icons/);
  assert.match(prompt, /never invent CMP, targets/i);
  assert.match(prompt, /machine-drafted/);
  assert.match(prompt, /Calendar rows are scheduling evidence/);
  assert.match(prompt, /My Feed/);
  assert.match(prompt, /Kite orders/);
  assert.match(prompt, /Satya there/);
  assert.match(prompt, /never a one-line reply/i);
  assert.match(prompt, /three-line bullet dump/i);
  assert.match(prompt, /28 named categories/);
  assert.match(prompt, /verbatim/);
  assert.match(prompt, /composite score/);
  assert.match(prompt, /scenario update/);
  assert.match(prompt, /500\+ words/);
  assert.match(prompt, /Write a story grounded in this query's context/);
  assert.match(prompt, /Do not force a robotic WHAT\/WHY\/HOW heading template/);
  assert.match(prompt, /never fill with model knowledge/);
  assert.match(prompt, /unpublished or not in this evidence/);
  assert.doesNotMatch(prompt, /Prefer short factual bullets over narrative/);
  assert.doesNotMatch(prompt, /Interrogate LLM/);
});

test("satya written prompt forbids one-line-only answers and requires passage-grounded KPIs", () => {
  const passages = [{
    family: "axis_research",
    title: "Result Update: HDFC Bank",
    date: "2026-08-18T06:00:00Z",
    sender: "Axis Direct",
    excerpt: "NII ₹320 bn. No new CMP is stated here.",
    axisCategory: "result_update",
    pdfUrl: null,
  }];
  const written = buildSatyaUserPrompt({
    question: "summarize ALL Axis + Newsletters + Podcasts by topics, at least 500 words",
    passages,
    voice: false,
  });
  assert.match(written, /tell a story grounded only in this query's retrieved evidence/i);
  assert.match(written, /long-form/i);
  assert.match(written, /multiple paragraphs/i);
  assert.match(written, /verbatim/);
  assert.match(written, /500\+ words/);
  assert.match(written, /composite score/i);
  assert.match(written, /scenario update/i);
  assert.match(written, /EVIDENCE INVENTORY/);
  assert.match(written, /unpublished or not in this evidence/);
  assert.match(written, /Do not force a WHAT \/ WHY \/ HOW heading list/);
  assert.match(written, /Do not stop after three bullets for the whole answer/);
  assert.doesNotMatch(written, /keep it brief/i);
  assert.doesNotMatch(written, /keep it concise \(4–8 sentences\)/);
  assert.doesNotMatch(written, /short factual paragraphs or bullets/);
  assert.doesNotMatch(written, /Return 3-6 short factual bullets/);

  const spoken = buildSatyaUserPrompt({
    question: "What did Axis say about HDFC Bank?",
    passages,
    voice: true,
  });
  assert.match(spoken, /not a one-liner/);
  assert.match(spoken, /short story/);
  assert.doesNotMatch(spoken, /keep it concise \(4–8 sentences\)/);
});

test("podcast-theme prompts stay narrative and refuse unpublished peer KPI comparisons", () => {
  const written = buildSatyaUserPrompt({
    question: "What were the main overnight podcast themes?",
    passages: [{
      family: "podcasts",
      title: "Overnight markets",
      date: "2026-08-19T03:00:00Z",
      sender: "Podcasts",
      excerpt: "Description of overnight markets. Not a transcript.",
      pdfUrl: null,
    }],
    voice: false,
  });
  assert.match(written, /tell a story grounded only in this query's retrieved evidence/i);
  assert.match(written, /Do not force a WHAT \/ WHY \/ HOW heading list when the question is a podcast theme/);
  assert.match(written, /unpublished or not in this evidence/);
  assert.match(written, /never invent or use model knowledge/);
  assert.match(written, /## Podcasts/);
  assert.doesNotMatch(written, /write every heading listed here/i);
  assert.doesNotMatch(written, /REQUIRED HEADINGS — write every heading/);
});

test("satya prompts reject three-bullet dumps, one-liners, and keep-it-brief instructions", () => {
  const system = llmAssistSystemPrompt("satya");
  const written = buildSatyaUserPrompt({
    question: "Summarise all detailed analysis across all research categories",
    passages: [{
      family: "axis_research",
      title: "Daily Morning Note",
      date: "2026-08-19T03:21:00Z",
      sender: "Axis Direct",
      excerpt: "Nifty closed at 24,812 with a 0.6% decline. Breadth was 1:2.",
      axisCategory: "daily_morning_note",
      pdfUrl: null,
    }],
    voice: false,
  });
  const combined = `${system}\n${written}`;
  assert.match(system, /never a one-line reply/i);
  assert.match(system, /never a three-line bullet dump/i);
  assert.match(system, /Write a story grounded in this query's context/);
  assert.match(system, /Do not force a robotic WHAT\/WHY\/HOW heading template/);
  assert.match(system, /Do not stop after three bullets for the whole answer/);
  assert.match(written, /EVIDENCE INVENTORY/);
  assert.match(written, /## Axis Research/);
  assert.doesNotMatch(combined, /keep it brief/i);
  assert.doesNotMatch(combined, /keep it concise \(4–8 sentences\)/);
  assert.doesNotMatch(combined, /short factual paragraphs or bullets/i);
  assert.doesNotMatch(combined, /Prefer short factual bullets over narrative/);
  assert.doesNotMatch(combined, /Return 3-6 short factual bullets/);
  assert.doesNotMatch(system, /Interrogate LLM/);
});

test("broad summarize-all queries raise retrieve coverage across families and categories", () => {
  const query = "summarize ALL Axis + Newsletters + Podcasts by topics, at least 500 words";
  assert.equal(isSatyaBroadSurveyQuery(query), true);
  assert.equal(
    isSatyaBroadSurveyQuery("Summarise all detailed analysis across all research categories"),
    true,
  );
  assert.equal(
    isSatyaBroadSurveyQuery("All the analysis make sure all the analysis is extremely detailed and at least 3 to 4 bullet points across each research category"),
    true,
  );
  assert.equal(
    isSatyaBroadSurveyQuery("Summarize Axis Research result updates and company notes from the supplied digest only. Leave unpublished KPIs blank. Never invent figures."),
    false,
  );
  const budget = satyaRetrieveBudget(query);
  assert.ok(budget.coverageSampling);
  assert.ok(budget.limit >= 80);
  assert.ok(budget.perCategoryCap >= 4);
  assert.ok(budget.innerLimit >= 400);
  assert.ok(budget.excerptMax >= 800);
  assert.ok(budget.recencyFallback);
  assert.equal(satyaGenerationBudget({ question: query }).maxTokens, 8192);
  assert.equal(satyaGenerationBudget({ question: query, voice: true }).maxTokens, 2048);
  assert.equal(satyaRetrieveBudget("HDFC Bank Axis Buy").coverageSampling, false);

  const dir = join(tmpdir(), `satya-broad-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const dbPath = join(dir, "corpus.sqlite");
  const fixtures = [
    {
      messageId: "<morning-note>",
      family: "axis_research",
      mailbox: "Axis Research",
      title: "Daily Morning Note & Trade Setup for the Day - August 19, 2026",
      content: "Nifty closed at 24,812 with a 0.6% decline. Breadth was 1:2.",
    },
    {
      messageId: "<result-update>",
      family: "axis_research",
      mailbox: "Axis Research",
      title: "Result Update: HDFC Bank - Q1FY27",
      content: "HDFC Bank NII was ₹320 billion this quarter. No new CMP is stated here.",
    },
    {
      messageId: "<sector-update>",
      family: "axis_research",
      mailbox: "Axis Research",
      title: "Sector Update: Banking - August 2026",
      content: "Private banks showed a 12% YoY loan growth print in the Axis sector note.",
    },
    {
      messageId: "<other-research>",
      family: "axis_research",
      mailbox: "Axis Research",
      title: "Event Updates: RBI Monetary Policy",
      content: "The Axis event note flags the policy repo rate already stated in the mail.",
    },
    {
      messageId: "<webinar-skip>",
      family: "axis_research",
      mailbox: "Axis Research",
      title: "LIVE Webinar: Simplifying the World of Options Trading | Register Now",
      content: "Register now and book your seat for this Axis Direct live webinar on options.",
      axisCategory: "live_webinars",
    },
    {
      messageId: "<groww>",
      family: "groww_digest",
      mailbox: "Newsletters",
      title: "Groww Digest: markets wrap",
      content: "Groww summarised FII selling of ₹1,240 crore in the latest wrap.",
    },
    {
      messageId: "<tldr>",
      family: "newsletter_other",
      mailbox: "Newsletters",
      title: "TLDR: chip capex",
      content: "TSMC guided $38 billion of capex in the newsletter summary.",
    },
    {
      messageId: "<podcast-desc>",
      family: "podcasts",
      mailbox: "Podcasts",
      title: "Odd Lots copper",
      content: "The host said copper inventories tightened. This is a description summary.",
      contentSource: "description",
    },
    {
      messageId: "<podcast-tr>",
      family: "podcasts",
      mailbox: "Podcasts",
      title: "We Study Billionaires",
      content: "The guest cited a 14% free-cash-flow yield on the local transcript.",
      contentSource: "transcript",
    },
  ];
  for (const fixture of fixtures) {
    upsertSatyaDocument({
      sender: fixture.family === "podcasts" ? "Podcasts" : "Axis Direct <research@axisdirect.in>",
      receivedAt: "2026-08-19T06:00:00Z",
      bullets: [fixture.content],
      contentSource: fixture.contentSource || "mail",
      ...fixture,
    }, dbPath);
  }

  const passages = retrieveSatyaPassages({
    query,
    path: dbPath,
    families: ["axis_research", "groww_digest", "newsletter_other", "podcasts"],
  });
  assert.ok(passages.length > 3, "broad survey must not collapse to 1–3 chunks");
  const families = new Set(passages.map((row) => row.family));
  assert.ok(families.has("axis_research"));
  assert.ok(families.has("newsletter_other") || families.has("groww_digest"));
  assert.ok(families.has("podcasts"));
  const axisCategories = new Set(passages.filter((row) => row.family === "axis_research").map((row) => row.axisCategory));
  assert.ok(axisCategories.size >= 3);
  assert.equal(passages.some((row) => row.axisCategory === "live_webinars"), false);
  const podcasts = passages.filter((row) => row.family === "podcasts");
  assert.ok(podcasts.some((row) => row.evidenceKind === "transcript"));
  assert.ok(podcasts.some((row) => row.evidenceKind === "description"));
});

test("satya refuses health vitals, kite orders, and builder trees", () => {
  assert.equal(classifySatyaRefusal("what was my heart rate and sleep score?"), "health");
  assert.equal(classifySatyaRefusal("place a kite order for 10 shares of RELIANCE"), "kite");
  assert.equal(classifySatyaRefusal("draft a strategy tree on algorithm canvas"), "builder");
  assert.equal(classifySatyaRefusal("What did Axis say about HDFC Bank last week?"), null);
  assert.match(satyaRefusalMessage("empty_corpus"), /corpus is empty/i);
  assert.match(satyaRefusalMessage("no_match"), /No retrieved passage matched/i);
  assert.doesNotMatch(satyaRefusalMessage("no_match"), /corpus is empty/i);
  assert.doesNotMatch(satyaRefusalMessage("no_match"), /Refresh iCloud/i);
  assert.match(satyaRefusalMessage("health"), /My Feed/);
  assert.match(satyaRefusalMessage("kite"), /Kite orders/);
  assert.match(satyaRefusalMessage("builder"), /Algorithm Canvas/);
  assert.doesNotMatch(satyaRefusalMessage("builder"), /Interrogate LLM/);
});

test("satya workspace slots pick one assistant context per view", () => {
  assert.equal(resolveSatyaWorkspaceSlot("investment", ""), "investment");
  assert.equal(resolveSatyaWorkspaceSlot("sectors", "?section=s2"), "sectors-s2");
  assert.equal(resolveSatyaWorkspaceSlot("sectors", "?section=s3"), "sectors-s3");
  assert.equal(resolveSatyaWorkspaceSlot("intelligence", "?section=m2"), "satya");
  assert.equal(resolveSatyaWorkspaceSlot("intelligence", "?section=m3"), "intelligence-m3");
  assert.equal(resolveSatyaWorkspaceSlot("builder", "?section=canvas"), "builder");
  assert.equal(resolveSatyaWorkspaceSlot("strategies", "?section=y2"), "strategies");
  assert.equal(resolveSatyaWorkspaceSlot("health", ""), "health");
});

test("workspace hint tokens drop numbers so they cannot become invented figures", () => {
  const hints = workspaceQueryHints("RELIANCE 1840 HDFCBANK investment");
  assert.deepEqual(hints, ["RELIANCE", "HDFCBANK", "investment"]);
});

test("missing corpus returns empty retrieval", async () => {
  const root = await mkdtemp(join(tmpdir(), "satya-missing-"));
  const missing = join(root, "no-such-corpus.sqlite");
  assert.equal(isSatyaCorpusEmpty(missing), true);
  assert.deepEqual(searchSatyaCorpus("Axis HDFC", { path: missing }), []);
  assert.deepEqual(retrieveSatyaPassages({
    query: "Axis HDFC",
    path: missing,
    families: ["axis_research"],
  }), []);
  const catalog = await loadSatyaCatalog();
  assert.ok(catalog.families.every((row) => typeof row.count === "number"));
  assert.equal(await readMailFreshness(root), null);
});

test("sqlite FTS retrieval returns family, date, title, and urls", () => {
  const dir = join(tmpdir(), `satya-fts-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const dbPath = join(dir, "corpus.sqlite");
  upsertSatyaDocument({
    messageId: "<axis-hdfc-1>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "HDFC Bank — maintain Buy",
    receivedAt: "2026-08-18T06:00:00Z",
    content: "Axis maintains Buy on HDFC Bank with a prior target already in the mail. No new CMP is stated here.",
    bullets: ["Maintain Buy on HDFC Bank"],
    pdfUrl: "/api/axis-research/pdf?file=hdfc.pdf",
    messageUrl: "message://%3Caxis-hdfc-1%3E",
    contentSource: "mail",
  }, dbPath);
  const passages = retrieveSatyaPassages({ query: "HDFC Bank Axis", path: dbPath });
  assert.ok(passages.length >= 1);
  assert.equal(passages[0]?.family, "axis_research");
  assert.match(passages[0]?.title ?? "", /HDFC Bank/);
  assert.equal(passages[0]?.messageUrl, "message://%3Caxis-hdfc-1%3E");
  assert.equal(passages[0]?.pdfUrl, "/api/axis-research/pdf?file=hdfc.pdf");
  assert.equal(retrieveSatyaPassages({ query: "zzzz-no-such-term", path: dbPath }).length, 0);
  const podcastOnly = retrieveSatyaPassages({
    query: "HDFC Bank Axis",
    path: dbPath,
    families: ["podcasts"],
  });
  assert.equal(podcastOnly.length, 0);
});

test("verified earnings family retrieves IR/NSE KPI passages without unpublished fields", () => {
  const snapshot = buildEarningsSnapshot(earningsCalendar, "2026-08-13");
  const hits = earningsPassagesFromSnapshot("IRFC reported earnings KPIs", snapshot);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0]?.family, "earnings");
  assert.match(hits[0]?.title ?? "", /IRFC/);
  assert.match(hits[0]?.excerpt ?? "", /₹/);
  assert.ok(hits[0]?.sourceUrl);
  assert.equal(earningsPassagesFromSnapshot("zzzz-no-such-term", snapshot).length, 0);
  assert.doesNotMatch(hits[0]?.excerpt ?? "", /:\s*(;|$)/);
  assert.equal(retrieveSatyaPassages({
    query: "IRFC reported earnings",
    path: join(tmpdir(), "satya-no-corpus-earnings.sqlite"),
    families: ["axis_research"],
  }).length, 0);
  const withFamily = retrieveSatyaPassages({
    query: "IRFC reported earnings",
    path: join(tmpdir(), "satya-no-corpus-earnings.sqlite"),
    families: ["earnings"],
    earnings: snapshot,
  });
  assert.ok(withFamily.some((row) => row.family === "earnings"));
  const icons = compactCitationLinks([{
    family: "earnings",
    title: "IRFC print",
    date: "2026-08-13",
    sender: "IR/NSE verified",
    excerpt: "PAT filled",
    sourceUrl: "https://irfc.co.in/investors",
    pdfUrl: null,
  }]);
  assert.deepEqual(icons.map((link) => link.kind), ["earnings"]);
  assert.equal(icons[0]?.label, "Open earnings source: IRFC print");
});

test("compactCitationLinks emits one opener for each cited PDF URL", () => {
  const citations = [
    {
      family: "axis_research",
      title: "RITES result update",
      date: "2026-08-19",
      sender: "Axis Direct",
      excerpt: "Maintain Buy",
      messageUrl: "message://rites",
      pdfUrl: "/api/axis-research/pdf?file=rites.pdf",
    },
    {
      family: "axis_research",
      title: "BhartiAirtel result update",
      date: "2026-08-19",
      sender: "Axis Direct",
      excerpt: "Maintain Buy",
      messageUrl: "message://airtel",
      pdfUrl: "/api/axis-research/pdf?file=airtel.pdf",
    },
  ];
  const links = compactCitationLinks(citations);
  const pdfs = links.filter((link) => link.kind === "pdf");
  assert.equal(pdfs.length, 2);
  assert.deepEqual(pdfs.map((link) => link.href), [
    "/api/axis-research/pdf?file=rites.pdf",
    "/api/axis-research/pdf?file=airtel.pdf",
  ]);
  assert.equal(links.filter((link) => link.kind === "mail").length, 2);
  const badges = citationSourceBadges(citations);
  assert.deepEqual(badges.map((badge) => `${badge.kind}:${badge.count}`), ["mail:2", "pdf:2"]);
  assert.equal(badges.length, 2);
});

test("citation source badges collapse many PDFs into one counted category", () => {
  const citations = Array.from({ length: 24 }, (_, index) => ({
    family: "axis_research",
    title: `Note ${index + 1}`,
    date: "2026-08-19",
    sender: "Axis Direct",
    excerpt: "Maintain Buy. No new CMP is stated here.",
    messageUrl: index === 0 ? "message://axis-mail" : undefined,
    pdfUrl: `/api/axis-research/pdf?file=note-${index + 1}.pdf`,
  }));
  citations.push({
    family: "podcasts",
    title: "Episode",
    date: "2026-08-19",
    sender: "Podcasts",
    excerpt: "Description evidence only.",
    episodeUrl: "https://example.local/episode",
    pdfUrl: null,
  });
  citations.push({
    family: "earnings",
    title: "IRFC print",
    date: "2026-08-13",
    sender: "IR/NSE verified",
    excerpt: "PAT filled",
    sourceUrl: "https://irfc.co.in/investors",
    pdfUrl: null,
  });
  const badges = citationSourceBadges(citations);
  assert.deepEqual(badges.map((badge) => `${badge.kind}:${badge.count}`), ["mail:1", "pdf:24", "podcast:1", "earnings:1"]);
  assert.equal(badges.length, 4);
  assert.ok(badges.every((badge) => badge.label && badge.count >= 1));
});

test("packSatyaPassages keeps category coverage under the documented input cap", () => {
  const passages = [];
  for (let category = 0; category < 12; category += 1) {
    for (let row = 0; row < 4; row += 1) {
      passages.push({
        family: "axis_research",
        axisCategory: category % 2 === 0 ? "result_update" : "daily_morning_note",
        title: `Axis note ${category}-${row}`,
        date: "2026-08-19",
        sender: "Axis Direct",
        excerpt: `${"NII ₹320 bn. Maintain Buy. No new CMP is stated here. ".repeat(20)} row ${row}`,
        pdfUrl: `/api/axis-research/pdf?file=${category}-${row}.pdf`,
      });
    }
  }
  passages.push({
    family: "groww_digest",
    title: "Groww wrap",
    date: "2026-08-19",
    sender: "Groww",
    excerpt: "Groww summarised FII selling of ₹1,240 crore in the latest wrap. ".repeat(12),
    pdfUrl: null,
  });
  passages.push({
    family: "podcasts",
    title: "Podcast episode",
    date: "2026-08-19",
    sender: "Podcasts",
    excerpt: "Description of overnight markets. Not a transcript. ".repeat(12),
    pdfUrl: null,
  });
  passages.push({
    family: "earnings",
    title: "IRFC print",
    date: "2026-08-13",
    sender: "IR/NSE verified",
    excerpt: "PAT: ₹1,204 crore. Unpublished fields stay blank.",
    sourceUrl: "https://irfc.co.in/investors",
    pdfUrl: null,
  });
  const packed = packSatyaPassages(passages);
  assert.ok(packedSatyaEvidenceChars(packed) <= SATYA_PROMPT_INPUT_CHAR_CAP);
  assert.ok(packed.some((row) => row.family === "axis_research" && row.axisCategory === "result_update"));
  assert.ok(packed.some((row) => row.family === "axis_research" && row.axisCategory === "daily_morning_note"));
  assert.ok(packed.some((row) => row.family === "groww_digest"));
  assert.ok(packed.some((row) => row.family === "podcasts"));
  assert.ok(packed.some((row) => row.family === "earnings"));
  const prompt = buildSatyaUserPrompt({
    question: "summarize ALL Axis + Newsletters + Podcasts by topics, at least 500 words",
    passages: packed,
  });
  assert.ok(packedSatyaEvidenceChars(packed) <= SATYA_PROMPT_INPUT_CHAR_CAP);
  assert.match(prompt, /EVIDENCE INVENTORY/);
  assert.match(prompt, /tell a story grounded only in this query's retrieved evidence/);
  assert.match(prompt, /Do not stop after three bullets for the whole answer/);
  assert.doesNotMatch(prompt, /keep it brief/i);
  assert.ok(!prompt.includes("NII ₹320 bn. Maintain Buy. No new CMP is stated here. ".repeat(18)));
});

test("Satya LLM errors are operator-safe and do not look like a research answer", async () => {
  const message = formatSatyaLlmOperatorMessage([
    { provider: "Claude", model: "claude-sonnet-4-6", status: 401, errorType: "authentication_error" },
    { provider: "OpenAI", model: "gpt-4.1-mini", status: 403, errorType: "model_not_found" },
    { provider: "OpenAI", model: "gpt-3.5-turbo", status: 400, errorType: "context_length_exceeded" },
    { provider: "Ollama", model: "qwen2.5:7b-instruct", status: null, errorType: "unavailable" },
  ]);
  assert.match(message, /on-device LLM unavailable/i);
  assert.match(message, /cloud LLM skipped/i);
  assert.doesNotMatch(message, /HTTP 401|authentication_error|model_not_found|context_length_exceeded/i);
  assert.doesNotMatch(message, /EVIDENCE INVENTORY|REQUIRED HEADING|machine-drafted bullet|NII/i);
  assert.doesNotMatch(message, /Refresh iCloud|refresh mail/i);

  const root = await mkdtemp(join(tmpdir(), "satya-llm-error-"));
  const dbPath = join(root, "corpus.sqlite");
  upsertSatyaDocument({
    messageId: "<axis-error-1>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "HDFC Bank — maintain Buy",
    receivedAt: "2026-08-18T06:00:00Z",
    content: "Axis maintains Buy on HDFC Bank with a prior target already in the mail. No new CMP is stated here.",
    bullets: ["Maintain Buy on HDFC Bank"],
    contentSource: "mail",
  }, dbPath);
  const events = [];
  await assert.rejects(() => runSatyaChat({
    request: { messages: [{ role: "user", content: "HDFC Bank Axis" }] },
    secrets: { anthropicApiKey: "sk-ant-test-local-key-value" },
    emit: (event) => events.push(event),
    root,
    corpusPath: dbPath,
    complete: async () => ({
      ok: false,
      disabled: false,
      provider: "Ollama",
      message,
    }),
  }));
  const errorEvent = events.find((event) => event.event === "error");
  assert.equal(errorEvent?.event, "error");
  assert.match(String(errorEvent?.data?.message ?? ""), /on-device LLM unavailable/i);
  assert.doesNotMatch(String(errorEvent?.data?.message ?? ""), /HTTP 401|authentication_error/);
  assert.ok(!events.some((event) => event.event === "token" && /HTTP 401/.test(String(event.data?.text ?? ""))));
});

test("persistSatyaSession appends turns so CHATS can resume a thread", async () => {
  const root = await mkdtemp(join(tmpdir(), "satya-sessions-"));
  const first = await persistSatyaSession({
    root,
    workspace: "intelligence",
    messages: [{ role: "user", content: "Axis conviction ideas" }],
  });
  await persistSatyaSession({
    root,
    sessionId: first.id,
    workspace: "intelligence",
    messages: [{ role: "assistant", content: "From retrieved notes." }],
  });
  const sessions = await listSatyaSessions(root);
  assert.equal(sessions[0]?.id, first.id);
  assert.equal(sessions[0]?.messages.length, 2);
  assert.equal(sessions[0]?.messages[0]?.content, "Axis conviction ideas");
  assert.equal(sessions[0]?.messages[1]?.content, "From retrieved notes.");
});

test("renameSatyaSession persists a title and deleteSatyaSession removes only that id", async () => {
  const root = await mkdtemp(join(tmpdir(), "satya-session-crud-"));
  const first = await persistSatyaSession({
    root,
    workspace: "intelligence",
    messages: [{ role: "user", content: "Axis conviction ideas" }],
  });
  const second = await persistSatyaSession({
    root,
    workspace: "intelligence",
    messages: [{ role: "user", content: "Podcast overlap" }],
  });
  const renamed = await renameSatyaSession({ id: first.id, title: "Conviction thread", root });
  assert.equal(renamed?.title, "Conviction thread");
  assert.equal(satyaSessionDisplayTitle(renamed), "Conviction thread");
  await persistSatyaSession({
    root,
    sessionId: first.id,
    workspace: "intelligence",
    messages: [{ role: "assistant", content: "From retrieved notes." }],
  });
  const listed = await listSatyaSessions(root);
  const kept = listed.find((session) => session.id === first.id);
  assert.equal(kept?.title, "Conviction thread");
  assert.equal(kept?.messages.length, 2);
  assert.equal(await deleteSatyaSession({ id: first.id, root }), true);
  const after = await listSatyaSessions(root);
  assert.equal(after.some((session) => session.id === first.id), false);
  assert.equal(after.some((session) => session.id === second.id), true);
  assert.equal(await deleteSatyaSession({ id: first.id, root }), false);
  assert.equal(await renameSatyaSession({ id: "missing", title: "Nope", root }), null);
  assert.equal(await renameSatyaSession({ id: second.id, title: "   ", root }), null);
});

test("Satya status corpus health and Axis chip groups are operator-facing", () => {
  const health = satyaCorpusHealthFromStatus({
    corpus: {
      documentCount: 128,
      ingestError: "PDF extract failed",
      families: { axis_research: 40, podcasts: 12 },
    },
  });
  assert.equal(health.documentCount, 128);
  assert.equal(health.ingestError, "PDF extract failed");
  assert.equal(health.families.axis_research, 40);
  assert.equal(health.families.podcasts, 12);
  const groups = groupedAxisResearchCategories();
  assert.equal(groups[0]?.id, "research");
  assert.equal(groups[1]?.id, "webinars");
  assert.match(groups[1]?.hint ?? "", /Webinars off unless selected/);
  assert.equal(groups[1]?.categories.some((row) => row.id === "live_webinars"), true);
  assert.equal(groups[0]?.categories.some((row) => row.id === "live_webinars"), false);
  assert.equal(satyaShouldSpeak({ voice: false }), false);
  assert.equal(satyaShouldSpeak({ voice: true }), true);
  assert.equal(satyaShouldSpeak({ voice: true, error: true }), false);
});

const AXIS_RESULT_UPDATES_PROMPT =
  "Summarize Axis Research result updates and company notes from the supplied digest only. Leave unpublished KPIs blank. Never invent figures.";

test("Axis result updates suggestion retrieves result_update passages instead of no_match", async () => {
  const root = await mkdtemp(join(tmpdir(), "satya-result-updates-"));
  const dbPath = join(root, "corpus.sqlite");
  upsertSatyaDocument({
    messageId: "<axis-result-update-1>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "Result Update: HDFC Bank - Q1FY27",
    receivedAt: "2026-08-18T06:00:00Z",
    content: "HDFC Bank reported a sequential rise in net interest income this quarter. No new CMP is stated here.",
    bullets: ["HDFC Bank reported a sequential rise in net interest income this quarter."],
    pdfUrl: "/api/axis-research/pdf?file=hdfc-result.pdf",
    messageUrl: "message://%3Caxis-result-update-1%3E",
    contentSource: "mail",
  }, dbPath);

  const passages = retrieveSatyaPassages({
    query: AXIS_RESULT_UPDATES_PROMPT,
    path: dbPath,
    families: ["axis_research"],
  });
  assert.ok(passages.length >= 1);
  assert.equal(passages[0]?.family, "axis_research");
  assert.equal(passages[0]?.axisCategory, "result_update");
  assert.equal(retrieveSatyaPassages({ query: "zzzz-no-such-term", path: dbPath }).length, 0);

  const events = [];
  const run = await runSatyaChat({
    request: {
      messages: [{ role: "user", content: AXIS_RESULT_UPDATES_PROMPT }],
      families: ["axis_research"],
    },
    secrets: {},
    emit: (event) => events.push(event),
    root,
    corpusPath: dbPath,
    complete: async ({ onToken }) => {
      onToken?.("HDFC Bank reported a sequential rise in net interest income from the retrieved note.");
      return {
        ok: true,
        text: "HDFC Bank reported a sequential rise in net interest income from the retrieved note.",
        provider: "Claude",
      };
    },
  });
  assert.equal(run.refusal, null);
  assert.equal(run.citations[0]?.family, "axis_research");
  assert.ok(events.some((event) => event.event === "citation"));
});

test("runSatyaChat distinguishes empty corpus from zero retrieval hits", async () => {
  const root = await mkdtemp(join(tmpdir(), "satya-chat-"));
  const missing = join(root, "missing-corpus.sqlite");
  const emptyEvents = [];
  const emptyRun = await runSatyaChat({
    request: { messages: [{ role: "user", content: "What did Axis say about HDFC Bank?" }] },
    secrets: {},
    emit: (event) => emptyEvents.push(event),
    root,
    corpusPath: missing,
  });
  assert.equal(emptyRun.refusal, "empty_corpus");
  assert.match(emptyRun.text, /corpus is empty/i);

  const dbPath = join(root, "corpus.sqlite");
  upsertSatyaDocument({
    messageId: "<axis-hdfc-chat-1>",
    mailbox: "Axis Research",
    family: "axis_research",
    sender: "Axis Direct <research@axisdirect.in>",
    title: "HDFC Bank — maintain Buy",
    receivedAt: "2026-08-18T06:00:00Z",
    content: "Axis maintains Buy on HDFC Bank with a prior target already in the mail. No new CMP is stated here.",
    bullets: ["Maintain Buy on HDFC Bank"],
    contentSource: "mail",
  }, dbPath);

  const missEvents = [];
  const missRun = await runSatyaChat({
    request: { messages: [{ role: "user", content: "zzzz-no-such-term" }] },
    secrets: {},
    emit: (event) => missEvents.push(event),
    root,
    corpusPath: dbPath,
  });
  assert.equal(missRun.refusal, "no_match");
  assert.match(missRun.text, /No retrieved passage matched/i);
  assert.doesNotMatch(missRun.text, /corpus is empty/i);
  assert.doesNotMatch(missRun.text, /Refresh iCloud/i);

  const groundedEvents = [];
  const grounded = await runSatyaChat({
    request: { messages: [{ role: "user", content: "HDFC Bank Axis" }] },
    secrets: {},
    emit: (event) => groundedEvents.push(event),
    root,
    corpusPath: dbPath,
    complete: async ({ onToken }) => {
      onToken?.("Axis maintains Buy on HDFC Bank from the retrieved note.");
      return { ok: true, text: "Axis maintains Buy on HDFC Bank from the retrieved note.", provider: "Claude" };
    },
  });
  assert.equal(grounded.refusal, null);
  assert.match(grounded.text, /Axis maintains Buy/);
  assert.equal(grounded.citations[0]?.family, "axis_research");
  assert.ok(groundedEvents.some((event) => event.event === "citation"));
});

test("mail freshness is optional and does not throw when the snapshot is partial", async () => {
  const root = await mkdtemp(join(tmpdir(), "satya-mail-"));
  const snapshotDir = join(root, "artifacts", "private");
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(join(snapshotDir, "content-snapshot.json"), JSON.stringify({
    asOf: "18 Aug 2026, 3:00 pm",
    sources: {
      newsletters: { status: "live", count: 4, observedAt: "2026-08-18T09:30:00.000Z" },
      axisResearch: { status: "stale", count: 2, observedAt: "2026-08-17T09:30:00.000Z" },
    },
  }));
  const freshness = await readMailFreshness(root);
  assert.equal(freshness?.asOf, "18 Aug 2026, 3:00 pm");
  assert.equal(freshness?.newsletters?.status, "live");
  assert.equal(freshness?.axisResearch?.status, "stale");
});

test("SSE encoder emits named events used by the chat route", () => {
  assert.equal(
    encodeSatyaSse({ event: "status", data: { message: "Retrieving Satya corpus…" } }),
    "event: status\ndata: {\"message\":\"Retrieving Satya corpus…\"}\n\n",
  );
  assert.match(encodeSatyaSse({ event: "token", data: { text: "Axis" } }), /event: token/);
  assert.deepEqual(chunkTextForSse("abcdefghij", 4), ["abcd", "efgh", "ij"]);
});

test("satya routes and speech bridge keep the documented contracts", async () => {
  const [chatRoute, chat, retrieve, client, statusRoute, sourcesRoute, sessionsRoute, flask, speech, nativeSpeech, assist, plist, permissions, browser] = await Promise.all([
    readFile(new URL("../app/api/satya/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/satya/chat.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/satya/retrieve.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/satya/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/satya/sources/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/satya/sessions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../flask_gateway.py", import.meta.url), "utf8"),
    readFile(new URL("../app/satya/speech.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/satya/speech-native.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/local-llm-assist.ts", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Stratji/Info.plist", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Stratji/StratjiApplePermissions.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Shared/StratjiDocumentBrowser.swift", import.meta.url), "utf8"),
  ]);
  assert.match(chatRoute, /isLocalOperatorRequest/);
  assert.match(chatRoute, /text\/event-stream/);
  assert.match(chatRoute, /event: "status"|encodeSatyaSse/);
  assert.match(chatRoute, /parseSatyaFamilies/);
  assert.match(chatRoute, /parseSatyaAxisCategories/);
  assert.match(chat, /isSatyaCorpusEmpty/);
  assert.match(chat, /retrieveSatyaPassages/);
  assert.match(chat, /axisCategories: options\.request\.axisCategories/);
  assert.match(chat, /packSatyaPassages/);
  assert.match(retrieve, /SATYA_PROMPT_INPUT_CHAR_CAP/);
  assert.match(chat, /satyaGenerationBudget/);
  assert.match(chat, /satyaEvidenceOutline/);
  assert.match(chat, /maxTokens/);
  assert.match(chat, /tell a story grounded only in this query's retrieved evidence/);
  assert.match(chat, /Do not clip a written answer to a handful of sentences/);
  assert.match(chat, /EVIDENCE INVENTORY/);
  assert.match(client, /onSatyaThreadNotify/);
  assert.match(
    await readFile(new URL("../app/dashboard/satya-draft-popout.ts", import.meta.url), "utf8"),
    /openSatyaDraftPopout|hasNativeSatyaDraftPopout/,
  );
  assert.match(browser, /StratjiSatyaDraftBridge/);
  assert.match(browser, /satyaDraft/);
  assert.doesNotMatch(chat, /keep it concise \(4–8 sentences\)/);
  assert.doesNotMatch(chat, /short factual paragraphs or bullets/);
  assert.match(chat, /refusal: "no_match"/);
  assert.match(chat, /satyaRefusalMessage\("no_match"\)/);
  assert.match(chatRoute, /signal: request\.signal/);
  assert.match(retrieve, /from ["']\.\/search\.ts["']/);
  assert.doesNotMatch(retrieve, /satya-corpus\.mjs/);
  assert.doesNotMatch(retrieve, /osascript/);
  assert.match(retrieve, /searchSatyaCorpus as searchSatyaCorpusImpl/);
  assert.match(retrieve, /resolveResultUpdateRetrieval/);
  assert.match(retrieve, /recencyFallback/);
  assert.match(retrieve, /coverageSampling/);
  assert.match(retrieve, /isSatyaBroadSurveyQuery/);
  assert.match(client, /resolveResultUpdateRetrieval/);
  assert.match(retrieve, /countSatyaDocuments/);
  assert.match(retrieve, /catalogSeedsFromCorpus/);
  assert.match(retrieve, /listSatyaDocuments/);
  assert.match(statusRoute, /loadSatyaCorpusStats/);
  assert.match(statusRoute, /readMailFreshness/);
  assert.match(statusRoute, /ingestError/);
  assert.match(statusRoute, /documentCount|loadSatyaCorpusStats/);
  assert.match(sourcesRoute, /loadSatyaCatalog/);
  assert.match(sourcesRoute, /catalog\.families/);
  assert.match(sourcesRoute, /axisCategories: catalog\.axisCategories/);
  assert.match(sourcesRoute, /recent/);
  assert.doesNotMatch(sourcesRoute, /senders/);
  assert.match(sessionsRoute, /isLocalOperatorRequest/);
  assert.match(sessionsRoute, /listSatyaSessions/);
  assert.match(sessionsRoute, /renameSatyaSession/);
  assert.match(sessionsRoute, /deleteSatyaSession/);
  assert.match(sessionsRoute, /export async function PATCH/);
  assert.match(sessionsRoute, /export async function DELETE/);
  assert.match(client, /fetchSatyaSessions/);
  assert.match(client, /persistSatyaThreadLocal/);
  assert.match(client, /openSatyaChats/);
  assert.match(client, /renameSatyaSession/);
  assert.match(client, /deleteSatyaSession/);
  assert.match(client, /status === 403/);
  assert.doesNotMatch(client, /sessions\.json/);
  assert.match(flask, /path == "api\/satya\/chat" and method == "POST"/);
  assert.match(flask, /path == "api\/satya\/sessions" and method in \{"GET", "PATCH", "DELETE"\}/);
  assert.match(speech, /satyaSpeech\.start\(\)/);
  assert.match(speech, /satyaSpeech\.stop\(\)/);
  assert.match(speech, /satyaSpeech\.speak\(text\)/);
  assert.match(speech, /satyaSpeech\.cancel\(\)/);
  assert.match(speech, /satyaSpeech\.listVoices\(\)/);
  assert.match(speech, /satyaSpeech\.setVoice\(id\)/);
  assert.match(speech, /satyaSpeech\.onPartial/);
  assert.match(speech, /satyaSpeech\.onFinal/);
  assert.match(speech, /satyaSpeech\.onSpeechEnd/);
  assert.match(speech, /satyaSpeech\.onVoices/);
  assert.match(speech, /webkitSpeechRecognition/);
  assert.match(nativeSpeech, /webkit\.messageHandlers\.satyaSpeech/);
  assert.match(assist, /"satya"/);
  assert.match(plist, /NSMicrophoneUsageDescription/);
  assert.match(plist, /NSSpeechRecognitionUsageDescription/);
  assert.match(permissions, /case speech/);
  assert.match(permissions, /Speech \/ Mic/);
  assert.match(permissions, /Newsletters and iCloud → Axis Research/);
  assert.match(browser, /StratjiSatyaSpeechBridge/);
  assert.match(browser, /satyaSpeech/);
});
