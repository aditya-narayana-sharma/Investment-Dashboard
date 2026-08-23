import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  AXIS_RESEARCH_CATEGORIES,
  classifyAxisCategory,
} from "../app/satya/axis-categories.mjs";
import { isAxisResearchMail } from "./axis-mail-filter.mjs";
import { buildSatyaCatalog } from "../app/satya/source-catalog.mjs";
import {
  classifySatyaFamily,
  parseMailSender,
  satyaSenderId,
} from "./satya-classify.mjs";
import {
  axisCategoryCountsFromCorpus,
  catalogSeedsFromCorpus,
} from "../app/satya/search.mjs";
import {
  clearSatyaIngestError,
  getSatyaMeta,
  satyaCatalogPath,
  satyaCorpusPath,
  setSatyaMeta,
  upsertSatyaDocument,
  upsertSatyaDocumentOn,
  withCorpus,
} from "./satya-store.mjs";

const execFileAsync = promisify(execFile);


const DEFAULT_BACKFILL_DAYS = 90;
const BACKFILL_PAGE_SIZE = 25;
const BACKFILL_CONTENT_CHARS = 3200;
const BACKFILL_PAGE_TIMEOUT_MS = 25_000;
const BACKFILL_BODY_BUDGET_MS = 18_000;
function attachAxisCategoryCounts(catalog, path) {
  const counts = new Map();
  try {
    for (const row of axisCategoryCountsFromCorpus(path)) {
      counts.set(String(row.id), Number(row.count) || 0);
    }
  } catch {
    /* empty or unmigrated corpus */
  }
  return {
    ...catalog,
    axisCategories: AXIS_RESEARCH_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      count: counts.get(category.id) ?? 0,
    })),
  };
}

function catalogSeedKey(item) {
  const family = item.family
    ?? classifySatyaFamily({
      mailbox: item.mailbox,
      sender: item.sender ?? item.source,
      senderEmail: item.senderEmail,
      subject: item.subject ?? item.title,
      title: item.title,
      contentSource: item.contentSource,
    });
  const parsed = parseMailSender(item.sender ?? item.source ?? "");
  const sender = parsed.name || item.source || "Unknown sender";
  const email = item.senderEmail || parsed.email || "";
  return satyaSenderId(sender, email, family);
}

export function writeSatyaCatalogSnapshot(extraItems = [], options = {}) {
  const path = options.corpusPath ?? satyaCorpusPath();
  const catalogFile = options.catalogPath ?? satyaCatalogPath();
  const corpusSeeds = catalogSeedsFromCorpus(path);
  const seen = new Set(corpusSeeds.map((seed) => catalogSeedKey(seed)));
  const extras = extraItems.filter((item) => !seen.has(catalogSeedKey(item)));
  const catalog = attachAxisCategoryCounts(
    buildSatyaCatalog([...corpusSeeds, ...extras], { asOf: options.asOf ?? new Date().toISOString() }),
    path,
  );
  mkdirSync(dirname(catalogFile), { recursive: true });
  writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

function ingestItems(items, { mailbox, contentSource, path }) {
  return withCorpus((db) => {
    let upserted = 0;
    let skipped = 0;
    let latestAt = null;
    for (const item of items ?? []) {
      const family = item.sourceFamily ?? classifySatyaFamily({
        mailbox,
        sender: item.sender ?? item.source,
        senderEmail: item.senderEmail,
        subject: item.title,
        title: item.title,
        contentSource,
      });
      const result = upsertSatyaDocumentOn(db, {
        messageId: item.messageId,
        mailbox,
        family,
        sender: item.sender ?? item.source,
        senderEmail: item.senderEmail,
        title: item.title,
        subject: item.title,
        receivedAt: item.receivedAt,
        summary: item.summary,
        content: item.summary,
        bullets: item.bullets,
        tags: item.tags,
        axisCategory: item.axisCategory,
        pdfUrl: item.pdfUrl,
        pdfPath: item.pdfPath,
        messageUrl: item.messageUrl || item.episodeUrl,
        episodeUrl: item.episodeUrl,
        contentSource: item.contentSource || contentSource,
        evidenceKind: item.evidenceKind
          || (item.contentSource === "transcript" || item.contentSource === "description" ? item.contentSource : undefined),
      });
      if (result.upserted) upserted += 1;
      else skipped += 1;
      if (item.receivedAt && (!latestAt || Date.parse(item.receivedAt) > Date.parse(latestAt))) {
        latestAt = item.receivedAt;
      }
    }
    if (latestAt) {
      const key = `lastIndexedReceivedAt:${mailbox}`;
      const previous = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
      if (!previous || Date.parse(latestAt) > Date.parse(String(previous.value))) {
        db.prepare("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .run(key, latestAt);
      }
    }
    return { upserted, skipped, latestAt };
  }, path);
}

/**
 * Hook for content-digest-server: index successful Mail/podcast reads into the corpus.
 * Failed sources should pass null so retained snapshots are not re-indexed as live.
 */
export function ingestSatyaDigestRefresh({
  newsletters = null,
  axisResearch = null,
  podcasts = null,
  asOf = new Date().toISOString(),
  corpusPath = satyaCorpusPath(),
  catalogPath = satyaCatalogPath(),
} = {}) {
  const extra = [];
  if (Array.isArray(newsletters)) {
    ingestItems(newsletters, { mailbox: "Newsletters", contentSource: "mail", path: corpusPath });
    extra.push(...newsletters.map((item) => ({
      ...item,
      mailbox: "Newsletters",
      family: item.sourceFamily,
      sender: item.sender ?? item.source,
    })));
  }
  if (Array.isArray(axisResearch)) {
    ingestItems(axisResearch, { mailbox: "Axis Research", contentSource: "mail", path: corpusPath });
    extra.push(...axisResearch.map((item) => ({
      ...item,
      mailbox: "Axis Research",
      family: item.sourceFamily ?? "axis_research",
      sender: item.sender ?? item.source,
    })));
  }
  if (Array.isArray(podcasts)) {
    ingestItems(podcasts, { mailbox: "Podcasts", contentSource: "podcast", path: corpusPath });
    extra.push(...podcasts.map((item) => ({
      ...item,
      mailbox: "Podcasts",
      family: "podcasts",
      sender: item.sender ?? item.source,
      contentSource: "podcast",
    })));
  }
  const catalog = writeSatyaCatalogSnapshot(extra, { asOf, corpusPath, catalogPath });
  setSatyaMeta("lastDigestIngestAt", asOf, corpusPath);
  clearSatyaIngestError(corpusPath);
  return catalog;
}

export function satyaBackfillWindow({
  now = Date.now(),
  days = Number(process.env.SATYA_BACKFILL_DAYS ?? DEFAULT_BACKFILL_DAYS),
  lastIndexedReceivedAt = null,
} = {}) {
  const lookbackDays = Number.isFinite(Number(days)) && Number(days) > 0 ? Number(days) : DEFAULT_BACKFILL_DAYS;
  const cutoff = new Date(now - lookbackDays * 86_400_000);
  const cursor = lastIndexedReceivedAt ? new Date(lastIndexedReceivedAt) : null;
  const start = cursor && Number.isFinite(cursor.getTime()) && cursor > cutoff ? cursor : cutoff;
  return {
    start: start.toISOString(),
    end: new Date(now).toISOString(),
    cutoff: cutoff.toISOString(),
    lookbackDays,
  };
}

function mailLinkHelpers() {
  return String.raw`
function mailMessageId(message) {
  try {
    const id = String(message.messageId() || "").trim();
    if (id) return id;
  } catch (error) {
    /* fall through to properties() */
  }
  try {
    const id = String(message.properties().messageId || "").trim();
    return id;
  } catch (inner) {
    return "";
  }
}
`;
}

function backfillMailboxScript({ mailboxName, startIso, endIso, limit, contentChars, budgetMs }) {
  return String.raw`
const Mail = Application("Mail");
function exactAccount(name) {
  const account = Mail.accounts().find((candidate) => String(candidate.name()) === name);
  if (!account) throw new Error('Mail account "' + name + '" was not found');
  return account;
}
function exactMailbox(account, name) {
  const mailbox = account.mailboxes().find((candidate) => String(candidate.name()) === name);
  if (!mailbox) throw new Error('Mailbox "' + name + '" was not found under iCloud');
  return mailbox;
}
${mailLinkHelpers()}
const started = Date.now();
const account = exactAccount("iCloud");
const mailbox = exactMailbox(account, ${JSON.stringify(mailboxName)});
const cutoff = new Date(${JSON.stringify(startIso)});
const end = new Date(${JSON.stringify(endIso)});
const recent = mailbox.messages.whose({ _and: [
  { dateReceived: { _greaterThan: cutoff } },
  { dateReceived: { _lessThan: end } },
] })();
const ordered = recent
  .map((message) => {
    try { return { message, received: message.dateReceived() }; }
    catch (error) { return null; }
  })
  .filter(Boolean)
  .sort((left, right) => left.received - right.received)
  .slice(0, ${Number(limit)});
const messages = [];
for (const { message, received } of ordered) {
  if (Date.now() - started > ${Number(budgetMs)}) break;
  try {
    const subject = String(message.subject() || "Untitled message");
    const sender = String(message.sender() || "Unknown sender");
    const axisResearchSender = /(?:\baxis\s*(?:direct|securities|research)\b|@(?:[\w.-]+\.)?(?:axisdirect|axissecurities)\.(?:in|com)\b)/i.test(sender);
    const loadBody = ${JSON.stringify(mailboxName)} !== "Axis Research" || axisResearchSender;
    let content = "";
    if (loadBody) {
      try { content = String(message.content() || "").slice(0, ${Number(contentChars)}); }
      catch (error) { content = ""; }
    }
    messages.push({
      subject,
      sender,
      received: received.toISOString(),
      messageId: mailMessageId(message),
      content,
    });
  } catch (error) {
    continue;
  }
}
JSON.stringify({ mailbox: ${JSON.stringify(mailboxName)}, totalCount: recent.length, messages });
`;
}

async function runOsascript(script, timeoutMs) {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", script], {
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

async function backfillMailbox({ mailboxName, days, pages }) {
  const cursorKey = `lastIndexedReceivedAt:${mailboxName}`;
  const window = satyaBackfillWindow({
    days,
    lastIndexedReceivedAt: getSatyaMeta(cursorKey),
  });
  let upserted = 0;
  let skipped = 0;
  let pagesRead = 0;
  let lastReceived = window.start;

  for (let page = 0; page < pages; page += 1) {
    const pageWindow = satyaBackfillWindow({
      days,
      lastIndexedReceivedAt: getSatyaMeta(cursorKey),
    });
    const stdout = await runOsascript(
      backfillMailboxScript({
        mailboxName,
        startIso: pageWindow.start,
        endIso: pageWindow.end,
        limit: BACKFILL_PAGE_SIZE,
        contentChars: BACKFILL_CONTENT_CHARS,
        budgetMs: BACKFILL_BODY_BUDGET_MS,
      }),
      BACKFILL_PAGE_TIMEOUT_MS,
    );
    const parsed = JSON.parse(stdout || "{}");
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    if (!messages.length) break;
    pagesRead += 1;

    for (const message of messages) {
      if (mailboxName === "Axis Research" && !isAxisResearchMail(message)) {
        skipped += 1;
        continue;
      }
      const family = classifySatyaFamily({
        mailbox: mailboxName,
        sender: message.sender,
        subject: message.subject,
      });
      const result = upsertSatyaDocument({
        messageId: message.messageId,
        mailbox: mailboxName,
        family,
        sender: message.sender,
        subject: message.subject,
        title: message.subject,
        receivedAt: message.received,
        content: message.content,
        summary: message.content,
        contentSource: "mail",
        axisCategory: mailboxName === "Axis Research" ? classifyAxisCategory(message.subject) : undefined,
      });
      if (result.upserted) upserted += 1;
      else skipped += 1;
      if (message.received && Date.parse(message.received) >= Date.parse(lastReceived)) {
        lastReceived = message.received;
        setSatyaMeta(cursorKey, message.received);
      }
    }

    if (messages.length < BACKFILL_PAGE_SIZE) break;
  }

  return { mailbox: mailboxName, upserted, skipped, pagesRead, lastReceived };
}

export async function runSatyaBackfill(options = {}) {
  const days = Number(options.days ?? process.env.SATYA_BACKFILL_DAYS ?? DEFAULT_BACKFILL_DAYS);
  const pages = Math.max(1, Number(options.pages ?? process.env.SATYA_BACKFILL_PAGES ?? 8));
  if (process.env.SATYA_BACKFILL_SKIP_JXA === "1") {
    const catalog = writeSatyaCatalogSnapshot([], { asOf: new Date().toISOString() });
    setSatyaMeta("lastBackfillAt", new Date().toISOString());
    return { skippedJxa: true, catalog };
  }

  const newsletters = await backfillMailbox({ mailboxName: "Newsletters", days, pages });
  const axisResearch = await backfillMailbox({ mailboxName: "Axis Research", days, pages });
  const catalog = writeSatyaCatalogSnapshot([], { asOf: new Date().toISOString() });
  setSatyaMeta("lastBackfillAt", new Date().toISOString());
  return { newsletters, axisResearch, catalog };
}

function isMain() {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (isMain() && process.argv[2] === "backfill") {
  runSatyaBackfill()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      console.error("[satya-ingest] backfill failed:", error);
      process.exitCode = 1;
    });
}
