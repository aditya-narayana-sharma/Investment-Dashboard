import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isAxisResearchMail } from "./axis-mail-filter.mjs";
import { extractAxisRecommendationsForTradingAsOf } from "./axis-recommendations.mjs";
import { formatIstDateLabel } from "./nse-trading-day.mjs";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.CONTENT_DIGEST_PORT ?? 3003);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const COMPLETE_REMINDER_EVENTKIT_SCRIPT = join(SCRIPT_DIR, "complete-reminder-eventkit.swift");
const PODCAST_DB = `${process.env.HOME}/Library/Group Containers/243LU875E5.groups.com.apple.podcasts/Documents/MTLibrary.sqlite`;
const PODCAST_TTML_ROOT = `${process.env.HOME}/Library/Group Containers/243LU875E5.groups.com.apple.podcasts/Library/Cache/Assets/TTML`;
const REMINDERS_STORE_DIR = `${process.env.HOME}/Library/Group Containers/group.com.apple.reminders/Container_v1/Stores`;
const CALENDAR_DB = `${process.env.HOME}/Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb`;
const CORE_DATA_EPOCH = 978307200;
const MAIL_CONTENT_CHARS = 4500;
/** Enough body text to support ≥5 summary bullets per newsletter item. */
const NEWSLETTER_CONTENT_CHARS = 3200;
const CALENDAR_NOTES_CHARS = 1600;
const DIGEST_BULLET_MAX = 8;
const CONTENT_SNAPSHOT_PATH = process.env.CONTENT_SNAPSHOT_PATH ?? fileURLToPath(new URL("../artifacts/private/content-snapshot.json", import.meta.url));
const CONTENT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const FORCE_REFRESH_BUDGET_MS = 480_000;
const NEWSLETTER_DIGEST_LIMIT = 500;
const NEWSLETTER_LIST_TIMEOUT_MS = 60_000;
const NEWSLETTER_BODY_TIMEOUT_MS = 120_000;
/** Soft deadline inside osascript so bodies return before Node kills the process. */
const NEWSLETTER_BODY_BUDGET_MS = 95_000;
function istDateKey(daysAgo) {
  return new Date(Date.now() + (5.5 * 60 * 60 * 1000) - (daysAgo * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}
const ANALYSIS_WINDOW_START = process.env.INVESTMENT_ANALYSIS_START_DATE ?? istDateKey(3);
const ANALYSIS_DATE = process.env.INVESTMENT_ANALYSIS_DATE ?? istDateKey(0);
const CALENDAR_WINDOW_END = (() => {
  const end = new Date(`${ANALYSIS_DATE}T00:00:00+05:30`);
  end.setDate(end.getDate() + 46);
  return end.toISOString().slice(0, 10);
})();
const AXIS_LOOKBACK_DAYS = 3;
const AXIS_DIGEST_LIMIT = 500;

const newsletterMailboxHelpers = String.raw`
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
const account = exactAccount("iCloud");
function newsletterWindowMessages(limit) {
  const mailbox = exactMailbox(account, "Newsletters");
  const cutoff = new Date("${ANALYSIS_WINDOW_START}T00:00:00+05:30");
  const end = new Date("${ANALYSIS_DATE}T00:00:00+05:30");
  end.setDate(end.getDate() + 1);
  const recent = mailbox.messages.whose({ _and: [
    { dateReceived: { _greaterThan: cutoff } },
    { dateReceived: { _lessThan: end } },
  ] })();
  const totalCount = recent.length;
  const ordered = recent
    .map((message) => {
      try {
        return { message, received: message.dateReceived() };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.received - left.received)
    .slice(0, limit);
  return { totalCount, ordered };
}
`;

/** Fast metadata pass — proves the mailbox is readable without loading bodies. */
const newsletterListScript = String.raw`
${newsletterMailboxHelpers}
const { totalCount, ordered } = newsletterWindowMessages(${NEWSLETTER_DIGEST_LIMIT});
const messages = ordered.map(({ message, received }) => {
  try {
    return {
      subject: String(message.subject() || "Untitled message"),
      sender: String(message.sender() || "Unknown sender"),
      received: received.toISOString(),
      content: "",
    };
  } catch (error) {
    return null;
  }
}).filter(Boolean);
JSON.stringify({ totalCount, messages });
`;

/**
 * Body enrichment for the same window. Stops reading content at NEWSLETTER_BODY_BUDGET_MS
 * so Node does not kill a half-finished osascript; remaining items keep metadata only.
 */
const newsletterBodyScript = String.raw`
${newsletterMailboxHelpers}
const { totalCount, ordered } = newsletterWindowMessages(${NEWSLETTER_DIGEST_LIMIT});
const started = Date.now();
const budgetMs = ${NEWSLETTER_BODY_BUDGET_MS};
const messages = ordered.map(({ message, received }) => {
  try {
    const subject = String(message.subject() || "Untitled message");
    const sender = String(message.sender() || "Unknown sender");
    let content = "";
    if (Date.now() - started < budgetMs) {
      try {
        content = String(message.content() || "").slice(0, ${NEWSLETTER_CONTENT_CHARS});
      } catch (error) {
        content = "";
      }
    }
    return { subject, sender, received: received.toISOString(), content };
  } catch (error) {
    return null;
  }
}).filter(Boolean);
JSON.stringify({ totalCount, messages, bodiesLoaded: messages.filter((message) => message.content).length });
`;

const axisMailScript = String.raw`
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
const account = exactAccount("iCloud");
const cutoff = new Date("${ANALYSIS_WINDOW_START}T00:00:00+05:30");
const end = new Date("${ANALYSIS_DATE}T00:00:00+05:30");
end.setDate(end.getDate() + 1);
function serialize(message) {
  const properties = message.properties();
  return {
    subject: String(properties.subject || "Untitled message"),
    sender: String(properties.sender || "Unknown sender"),
    received: properties.dateReceived.toISOString(),
    content: String(properties.content || "").slice(0, ${MAIL_CONTENT_CHARS}),
  };
}
const mailbox = exactMailbox(account, "Axis Research");
const recent = mailbox.messages.whose({ _and: [
  { dateReceived: { _greaterThan: cutoff } },
  { dateReceived: { _lessThan: end } },
] })();
const totalCount = recent.length;
const messages = recent.map((message) => {
  const properties = message.properties();
  return {
    subject: String(properties.subject || "Untitled message"),
    sender: String(properties.sender || "Unknown sender"),
    received: properties.dateReceived.toISOString(),
    content: String(properties.content || "").slice(0, ${MAIL_CONTENT_CHARS}),
  };
}).sort((left, right) => new Date(right.received) - new Date(left.received)).slice(0, ${AXIS_DIGEST_LIMIT});
JSON.stringify({ totalCount, messages });
`;

/** Incomplete from every list; completed capped later (Job/Earnings evidence + recent due-dated). */
const remindersQuery = `
SELECT
  hex(reminder.ZIDENTIFIER) AS id,
  reminder.Z_PK AS pk,
  reminder.ZTITLE AS title,
  coalesce(reminder.ZNOTES, '') AS detail,
  list.ZNAME AS list,
  reminder.ZDUEDATE AS dueCoreData,
  reminder.ZCOMPLETED AS completed,
  reminder.ZCOMPLETIONDATE AS completionCoreData
FROM ZREMCDREMINDER reminder
JOIN ZREMCDBASELIST list ON list.Z_PK = reminder.ZLIST
WHERE coalesce(reminder.ZMARKEDFORDELETION, 0) = 0
  AND coalesce(list.ZMARKEDFORDELETION, 0) = 0
ORDER BY list.ZNAME, reminder.ZCOMPLETED ASC, reminder.ZCOMPLETIONDATE DESC, reminder.ZCREATIONDATE DESC;
`;

const REMINDER_COMPLETED_CAP = 300;
const PRIORITY_REMINDER_LISTS = new Set(["🔍Job", "Job 🔍", "Earnings"]);

/** REMCDRecurrenceRule rows live in ZREMCDOBJECT (Z_ENT=34); ZREMINDER4 → reminder PK. */
const reminderRecurrenceQuery = `
SELECT
  o.ZREMINDER4 AS reminderPk,
  o.ZFREQUENCY AS frequency,
  o.ZINTERVAL AS intervalCount,
  o.ZENDDATE AS endCoreData
FROM ZREMCDOBJECT o
WHERE o.Z_ENT = 34
  AND o.ZREMINDER4 IS NOT NULL
  AND coalesce(o.ZMARKEDFORDELETION, 0) = 0;
`;

const calendarQuery = `
SELECT
  coalesce(i.unique_identifier, i.UUID, hex(i.ROWID)) AS id,
  coalesce(i.summary, 'Untitled event') AS title,
  coalesce(c.title, 'Unknown calendar') AS calendar,
  i.start_date AS startCoreData,
  i.end_date AS endCoreData,
  substr(coalesce(i.description, ''), 1, ${CALENDAR_NOTES_CHARS}) AS notes
FROM CalendarItem i
JOIN Calendar c ON c.ROWID = i.calendar_id
WHERE date(i.start_date + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') >= date('${ANALYSIS_WINDOW_START}')
  AND date(i.start_date + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') <= date('${CALENDAR_WINDOW_END}')
  AND coalesce(c.title, '') NOT LIKE '%Birthday%'
  AND coalesce(c.title, '') NOT LIKE '%Scheduled Reminders%'
ORDER BY i.start_date ASC
LIMIT 500;
`;

const healthNoteScript = String.raw`
const Notes = Application("Notes");
const account = Notes.accounts().find((candidate) => String(candidate.name()) === "iCloud");
if (!account) throw new Error('Notes account "iCloud" was not found');
const note = account.notes().find((candidate) => String(candidate.name()) === " Health Daily");
if (!note) throw new Error('The exact note " Health Daily" was not found');
const properties = note.properties();
JSON.stringify({
  title: " Health Daily",
  modifiedAt: properties.modificationDate ? properties.modificationDate.toISOString() : "",
  body: String(properties.plaintext || properties.body || "").slice(0, 24000),
});
`;

function podcastQuery(episodeColumns) {
  // Modern Apple Podcasts stores episode copy on ZMTEPISODEDESCRIPTION (via ZDESCRIPTIONOBJECT).
  // Older schemas may still expose description columns directly on ZMTEPISODE.
  const legacyColumns = ["ZITEMDESCRIPTIONWITHOUTHTML", "ZITEMDESCRIPTION", "ZITUNESSUBTITLE"]
    .filter((column) => episodeColumns.has(column))
    .map((column) => `e.${column}`);
  const description = legacyColumns.length
    ? `coalesce(d.ZPLAINTEXT, d.ZTEXT, ${legacyColumns.join(", ")}, '')`
    : `coalesce(d.ZPLAINTEXT, d.ZTEXT, '')`;
  return `
SELECT
  coalesce(p.ZTITLE, e.ZAUTHOR, 'Apple Podcasts') AS source,
  coalesce(e.ZTITLE, e.ZITUNESTITLE, 'Untitled episode') AS title,
  datetime(e.ZPUBDATE + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') AS published,
  ${description} AS description,
  (
    SELECT m.ZTRANSCRIPTIDENTIFIER
    FROM ZMTMEDIAENCLOSURE m
    WHERE m.ZEPISODE = e.Z_PK
      AND m.ZTRANSCRIPTIDENTIFIER IS NOT NULL
      AND trim(m.ZTRANSCRIPTIDENTIFIER) != ''
    LIMIT 1
  ) AS transcriptIdentifier
FROM ZMTEPISODE e
LEFT JOIN ZMTPODCAST p ON p.Z_PK = e.ZPODCAST
LEFT JOIN ZMTEPISODEDESCRIPTION d ON d.Z_PK = e.ZDESCRIPTIONOBJECT
WHERE date(e.ZPUBDATE + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') BETWEEN date('${ANALYSIS_WINDOW_START}') AND date('${ANALYSIS_DATE}')
ORDER BY e.ZPUBDATE DESC;`;
}

/** Read a locally cached Apple Podcasts TTML transcript when the user has opened the episode. */
function readLocalPodcastTranscript(transcriptIdentifier) {
  const ident = String(transcriptIdentifier ?? "").trim();
  if (!ident || ident.includes("..")) return "";
  const candidates = [`${PODCAST_TTML_ROOT}/${ident}`];
  const base = ident.split("/").pop() ?? "";
  const episodeMatch = /transcript_(\d+)\.ttml$/i.exec(base);
  if (episodeMatch) {
    candidates.push(`${PODCAST_TTML_ROOT}/${ident}-${episodeMatch[1]}.ttml`);
  }
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf8");
      if (!raw || raw.length < 40) continue;
      const text = raw
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
      if (text.length >= 40) return text.slice(0, 12000);
    } catch {
      // Missing cache entry — fall back to episode description.
    }
  }
  return "";
}

function preferPodcastBody(transcript, description) {
  const transcriptText = String(transcript ?? "").trim();
  if (transcriptText.length >= 40) return { text: transcriptText, source: "transcript" };
  const descriptionText = String(description ?? "").trim();
  if (descriptionText.length >= 18) return { text: descriptionText, source: "description" };
  return { text: "", source: "none" };
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\uFFFC/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/\[email redacted\]/gi, " ")
    .replace(/\b\w{1,12}@\w{2,}/g, " ")
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, " ")
    .replace(/\b(Client ID|Client Code|Account ID)\s*:\s*[A-Z0-9-]+/gi, "$1: [redacted]")
    .replace(/click here to unsubscribe[^.\n]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function concise(value, limit = 360) {
  const bullets = summaryBullets(value, { max: 3 });
  if (bullets.length) {
    const joined = bullets.join(" ");
    return joined.length > limit ? `${joined.slice(0, limit - 1).trim()}…` : joined;
  }
  const clean = cleanText(value);
  return clean.length > limit ? `${clean.slice(0, limit - 1).trim()}…` : clean;
}

function normalizeBulletKey(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const PROVENANCE_LINE =
  /^(?:headline|source|show|as of|received|published|reminders list|calendar|topic|starts|ends|due|episode|reminder|event|list|schedule|status|marked)\s*:/i;

const EMAIL_LIKE =
  /(?:\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\[email redacted\]|\b\w{1,12}@\w{2,})/i;

const BARE_NAME_LINE =
  /^(?:Nifty(?:\s*50)?|Sensex|[A-Z][A-Za-z0-9.&'/-]*(?:\s+[A-Z][A-Za-z0-9.&'/-]*){0,5}(?:\s+(?:Ltd|Limited|Inc|Corp|Corporation|Plc|Bank|Hotels?))?)\.?$/;

/** Mail boilerplate + podcast CTA / promo / credit-roll — never used as content bullets. */
const DIGEST_PROMO_OR_CTA =
  /unsubscribe|disclaimer|market risks|contact us|view online|sign up|advertise|forward to your friends|read report|tap the link|click here|privacy policy|terms of (?:use|service)|manage preferences|open in (?:browser|app)|tldr together with|reality bites|^(?:follow|subscribe|check out|learn more|see|catch|support|listen|join|rate|share|send us|put your email)\b|follow (?:us|me|@)|follow\b.{0,80}\bon\b.{0,40}(?:twitter|x\b|instagram|tiktok|substack|facebook|linkedin|youtube)|subscribe (?:to|on|now|here|for)|(?:^|\b)subscribe\b.{0,40}(?:youtube|spotify|apple podcasts|patreon|substack|newsletter|channel)|patreon|sponsor(?:ed|ship)?\b|learn more\b|check out\b|see (?:more|show notes|omnystudio|acast|the (?:full|latest)|our)|catch (?:the )?latest|support .{0,60}(?:by|on|via|with)\b|leave a (?:rating|review)|rate (?:and|&) review|share (?:this|with friends)|join (?:our|the) (?:newsletter|mailing|patreon|discord|community)|mailing list|youtube channel|podcastchoices|ad choices|without ads|ad[- ]free|hosted on acast|our (?:editor|producer|intern|executive producer) is|theme music (?:is )?by|additional help from|read a transcript|transcript of this episode|for access to future|send us your (?:questions|comments)|visit (?:podcastchoices|omnystudio|acast|ft\.com|bloomberg\.com)|@\w{2,30}\b.{0,40}\b(?:twitter|x\b|instagram|tiktok|substack)|listen (?:and subscribe|on apple|on spotify)|available on (?:apple podcasts|spotify|youtube)|put your email|make you smart every day|informational purposes only|none of the (?:stocks|brands|products).{0,40}recommendations?|mentioned in this (?:podcast|episode)|we also send out|daily newsletter|^\d{1,2}:\d{2}\b|your morning briefing|top stories,? with context|all the news you need|business and finance news from|share this email|brought to you by|presented by|read in browser|welcome back[,.]|dear (?:reader|investor|client)\b|registered office|sebi registration|cin\s*:|gstin\s*:|zero entry barriers|international portfolio is waiting|diversify across top (?:us|global) stocks|as low as\s*\$\s*1\b|stop limiting your wealth|axis direct brings you|stories we(?:'|\u2019)?ll be tracking|take a look at some of the stories|hellyeah|\bbruh\b|\blmao\b|\bwtf\b|quick gut check|in partnership with|want a free |use code:|rozana sip|buy you a stake|favourite global company|favorite global company|start investing today|retail broking|not a cup of coffee|not a magazine|unleash your investment|exclusive picks by axis|curated stock picks by axis|don’t miss out on these curated|don't miss out on these curated|you received this email because you subscribed|alert list\b|carefully before investing|only for consumption by the client|should not be redistributed|sebi research analyst|research analyst reg|in[hzap]\d{6,}|related documents carefully|compliance officer|for private circulation|not an offer to (?:buy|sell)|investment in securities market|past performance is not|mutual fund investments are subject|pop registration|portfolio manager reg|amfi\b|arn[-\s]?\d{4,}|mutual fund distributor|hope this email finds you|valued (?:investor|client)|handpicked stocks|unlock wealth|remarkable potential|assuring you the best|kindly refer to the attached|please find the attached|please review the attached|excited to (?:present|bring) you|thank you for taking the time to read|thriving in your investment journey|encourag(?:e|ing) you to examine these opportunities|best of our services at all times|let(?:'|\u2019)?s (?:shift our attention|delve into)|now let(?:'|\u2019)?s\b|what(?:'|\u2019)s the real return on slack|forrester total economic impact|made their money back in just six months|\$50m in efficiency gains|312% collective roi/i;

const PROMOTIONAL_MESSAGE =
  /\*{3,}\s*spam\s*\*{3,}|today(?:'|\u2019)s paper|daily newspaper is now ready|read complete epaper|micro investing|invest ₹?1,?000|start investing today|webinar|masterclass|workshop|wealth expo|wealth gathering|limited[- ]time offer|exclusive offer|special offer|register now|book your seat|buy now|shop now|unlock (?:your )?(?:wealth|investment)|gift city.{0,80}(?:summit|conference)|where the conversations shaping|axis mutual fund.{0,80}(?:invest|sip)|want to invest ₹/i;

function isPromotionalMessage(message, item) {
  const title = cleanText(message?.subject ?? item?.title);
  const body = cleanText([
    message?.content,
    item?.summary,
    ...(Array.isArray(item?.bullets) ? item.bullets : []),
  ].filter(Boolean).join(" "));
  if (PROMOTIONAL_MESSAGE.test(`${title} ${body}`)) return true;
  if (!item?.bullets?.length && /read|paper|edition|digest|alert|notification/i.test(title)) return true;
  return false;
}

function hasFinancialSignal(value) {
  return /(?:₹|rs\.?\s*\d|%\s*(?:yoy|qoq|mom)?|\b(?:yoy|qoq|bps|crore|cr\b|tp|target|pat|revenue|nifty|sensex|buy|sell|hold|reduce|add)\b|\d{2,}(?:\.\d+)?\s*%)/i.test(
    value,
  );
}

function isDigestPromoOrNoise(value) {
  const item = cleanText(value);
  if (!item) return true;
  if (DIGEST_PROMO_OR_CTA.test(item)) return true;
  if (EMAIL_LIKE.test(item)) return true;
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(item)) return true;
  if (/^@\w+$/i.test(item)) return true;
  if (BARE_NAME_LINE.test(item)) return true;
  if (/^red flags to watch out for:?$/i.test(item)) return true;
  if (/\b(?:IN[HZAP]|POP)\d{5,}\b/i.test(item) && item.split(/\s+/).filter(Boolean).length <= 16) return true;
  return false;
}

function isDigestContentWorthy(value) {
  const item = cleanText(value);
  if (!item) return false;
  if (isDigestPromoOrNoise(item) || PROVENANCE_LINE.test(item)) return false;
  if (EMAIL_LIKE.test(item)) return false;
  if (item.endsWith(":")) return false;
  if (BARE_NAME_LINE.test(item)) return false;
  if (/^[\W\d_\s]+$/.test(item)) return false;
  if (/\b\w{1,2}@[a-z]/i.test(item)) return false;
  if (/(?:^|\s)(?:okay no seriously|all i can see is drum rolls)/i.test(item)) return false;
  const words = item.split(/\s+/).filter(Boolean).length;
  if (words < 5 && !hasFinancialSignal(item)) return false;
  if (words < 3) return false;
  const looksProse =
    /\b(?:is|are|was|were|be|been|being|has|have|had|will|would|can|could|may|might|should|do|does|did|said|says|closed|rose|fell|grew|cut|hit|missed|beat|raised|launched|announced|reported|expects?|expected|discuss(?:es|ed)?|explore(?:s|d)?|cover(?:s|ed)?|marks?|prompted|forced|agreed|claimed|threatened|stayed|remained|led|kept|pushed|weighed|formed|extended|joined|delayed|printed|due|jumped|sold|delivered|held|argue(?:s|d)?|explain(?:s|ed)?|interview(?:s|ed)?|talk(?:s|ed)?|examine(?:s|d)?|walk(?:s|ed)?\s+through|break(?:s|ing)?\s+down|look(?:s|ed)?\s+at|dig(?:s|ging)?\s+into|debate(?:s|d)?|unpack(?:s|ed)?|highlight(?:s|ed)?|warn(?:s|ed)?)\b/i.test(
      item,
    ) || hasFinancialSignal(item);
  if (!looksProse && words < 8) return false;
  if (/^[A-Z0-9 ?!]{0,40}$/.test(item) && /(?:\?|!)/.test(item) && words <= 6) return false;
  if (/,\s*$/.test(item)) return false;
  return true;
}

function stripDigestChrome(text) {
  return String(text ?? "")
    .replace(/\uFFFC/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/\[email redacted\]/gi, " ")
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/(?:^|\n)\s*(?:sign up|advertise|view online|shop|read online|read in browser)(?:\s*[|/]\s*(?:sign up|advertise|view online|shop|read online))*\s*(?:\n|$)/gi, "\n")
    .replace(/(?:^|\n)\s*(?:share this email|brought to you by|presented by|forward to your friends|tldr together with)[^\n]*/gi, "\n")
    .replace(/(?:^|\n)\s*registered office address[^\n]*/gi, "\n")
    .replace(/(?:^|\n)\s*learn more about your ad choices[^\n]*/gi, "\n")
    // Podcast credit-roll / promo tails — keep editorial body only.
    .replace(/(?:^|\n)\s*(?:mentioned in this (?:podcast|episode)|links?(?:\s+(?:and|&)\s+resources)?|show notes|production credits?|credits?)\s*:?\s*[\s\S]*$/i, "\n")
    .replace(/(?:^|\n)\s*(?:follow (?:us|me|@)|subscribe to|support .{0,60}(?:by|on|via|with)\b|listen (?:and subscribe|on apple|on spotify)|join (?:our|the)|rate (?:and|&) review|share (?:this|with)|send us your|check out (?:our|the|more)|learn more about|visit (?:podcastchoices|omnystudio|acast)|hosted on|available on (?:apple|spotify|youtube)|catch the latest)[^\n]*/gi, "\n")
    .replace(/(?:^|\n)\s*(?:our (?:editor|producer|intern|executive producer) is|theme music|additional help from|this episode (?:was )?(?:produced|edited) by)[^\n]*/gi, "\n")
    .replace(/\b(?:on today(?:'|\u2019)?s (?:show|podcast|episode)|in this episode|today(?:'|\u2019)?s topics?(?:\s+include)?)\s*:?\s*/gi, "")
    .trim();
}

/**
 * Extract content-only summary bullets from body text.
 * Never pads with mailbox/show/timestamp provenance or podcast CTAs — if the body is thin, return fewer than 5.
 */
function summaryBullets(value, options = {}) {
  const max = options.max ?? DIGEST_BULLET_MAX;
  const extras = options.extras ?? [];
  const raw = stripDigestChrome(value);
  const chunks = [];
  for (const line of raw.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\s*(?:\(?\d+[).:]|[-–—*•·]|[a-z][).])\s+/i.test(trimmed)) {
      chunks.push(trimmed.replace(/^\s*(?:\(?\d+[).:]|[-–—*•·]|[a-z][).])\s+/i, ""));
      continue;
    }
    if (/\(\d+[).]/.test(trimmed) || /(?:^|\s)\d+[).]\s+\S/.test(trimmed)) {
      for (const part of trimmed.split(/(?=\(\d+[).])|(?=(?:^|\s)\d+[).]\s+)/)) {
        const cleaned = part.replace(/^\s*(?:\(?\d+[).:]|[a-z][).])\s*/i, "").trim();
        if (cleaned) chunks.push(cleaned);
      }
      continue;
    }
    for (const part of trimmed.split(/\s*[·|•]\s*/)) {
      if (part.trim()) chunks.push(part);
    }
  }
  for (const sentence of raw.replace(/\n+/g, " ").replace(/\b(U\.S|U\.K|E\.U|Mr|Mrs|Ms|Dr|Prof|Inc|Ltd|Jr|Sr)\./gi, "$1\u2024").split(/(?<=[.!?])\s+|(?<=;)\s+/)) {
    if (sentence.trim()) chunks.push(sentence.replace(/\u2024/g, "."));
  }

  const seen = new Set();
  const bullets = [];
  const push = (candidate, { minLength = 18, relaxWorthy = false } = {}) => {
    const item = cleanText(candidate);
    if (item.length < minLength || item.length > 280) return;
    if (isDigestPromoOrNoise(item) || PROVENANCE_LINE.test(item) || EMAIL_LIKE.test(item)) return;
    if (!relaxWorthy && !isDigestContentWorthy(item) && !hasFinancialSignal(item)) return;
    if (relaxWorthy && !hasFinancialSignal(item) && !isDigestContentWorthy(item)) return;
    const key = normalizeBulletKey(item);
    if (!key || seen.has(key)) return;
    if ([...seen].some((existing) => existing.length > 24 && (existing.startsWith(key) || key.startsWith(existing)))) return;
    seen.add(key);
    bullets.push(item.length > 220 ? `${item.slice(0, 217).trim()}…` : item);
  };

  for (const chunk of chunks) {
    push(chunk);
    if (bullets.length >= max) break;
  }
  // Optional content extras only (e.g. Axis recommendation lines) — never provenance fillers.
  for (const extra of extras) {
    if (bullets.length >= max) break;
    push(extra, { minLength: 12, relaxWorthy: true });
  }
  return bullets.slice(0, max);
}

/** EKRecurrenceFrequency: 0 daily, 1 weekly, 2 monthly, 3 yearly. */
function formatRepeatsOn(frequency, intervalCount) {
  const interval = Math.max(1, Number(intervalCount) || 1);
  const unit = ({ 0: ["day", "days"], 1: ["week", "weeks"], 2: ["month", "months"], 3: ["year", "years"] })[Number(frequency)];
  if (!unit) return "Repeats";
  if (interval === 1) {
    return ({ 0: "Daily", 1: "Weekly", 2: "Monthly", 3: "Yearly" })[Number(frequency)] ?? "Repeats";
  }
  return `Every ${interval} ${unit[1]}`;
}

function extractDailyOptimism(sectionText) {
  // Preserve line breaks so section headings remain detectable; cleanText flattens whitespace.
  const text = String(sectionText ?? "")
    .replace(/\uFFFC/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!text) return null;
  const heading = /(?:^|\n|\|\s*)Daily\s+Optimism\s*[:\-–—]?\s*/gi;
  let match;
  let latest = null;
  while ((match = heading.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const stop = rest.search(/\n\s*(?:Daily\s+Optimism\b|Health\s+Stats\b|\d{1,2}\.?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y|i)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\s*\|)/i);
    const body = cleanText(stop >= 0 ? rest.slice(0, stop) : rest);
    if (!body) continue;
    latest = concise(body, 900);
  }
  return latest;
}

function latestHealthNoteEntry(value) {
  const text = cleanText(value);
  const marker = /\b([0-3]?\d)\.?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y|i)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\s*\|\s*Health Stats\b/gi;
  const monthIndex = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
    jun: 5, june: 5, jul: 6, july: 6, juli: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };
  const entries = [];
  let match;
  while ((match = marker.exec(text)) !== null) {
    const month = monthIndex[match[2].toLowerCase()];
    if (month === undefined) continue;
    entries.push({ index: match.index, day: Number(match[1]), month, year: Number(match[3]) });
  }
  if (!entries.length) {
    return {
      summary: concise(text, 700),
      observedDate: null,
      dailyOptimism: extractDailyOptimism(text),
    };
  }

  const latest = entries.reduce((best, entry) => {
    const timestamp = Date.UTC(entry.year, entry.month, entry.day);
    return !best || timestamp > best.timestamp ? { ...entry, timestamp } : best;
  }, null);
  const next = entries.find((entry) => entry.index > latest.index);
  const section = text.slice(latest.index, next?.index ?? text.length);
  return {
    summary: concise(section, 700),
    observedDate: `${latest.year}-${String(latest.month + 1).padStart(2, "0")}-${String(latest.day).padStart(2, "0")}`,
    // Prefer the latest day's Optimism block; fall back to any note-wide Daily Optimism heading.
    dailyOptimism: extractDailyOptimism(section) ?? extractDailyOptimism(text),
  };
}

function senderName(sender) {
  return cleanText(sender).replace(/\s*<[^>]+>\s*$/, "").replace(/_at_.+$/, "").trim() || "Newsletter";
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function formatMailTimestamp(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function axisBullets(message) {
  const body = cleanText(message.content);
  const recommendations = [...body.matchAll(/([A-Z][A-Za-z0-9 &.'-]{2,70}?)\s*-\s*Result Update;\s*(BUY|HOLD|SELL|REDUCE);\s*TP:\s*Rs\s*([\d,]+)/gi)]
    .slice(0, DIGEST_BULLET_MAX)
    .map((match) => `${match[1].trim()}: ${match[2].toUpperCase()}, TP ₹${match[3]}`);
  const altCalls = [...body.matchAll(/([A-Z][A-Za-z0-9 &.'-]{2,70}?)\s*:\s*(BUY|HOLD|SELL|REDUCE|ADD)\b[^·|•\n]{0,120}/gi)]
    .slice(0, DIGEST_BULLET_MAX)
    .map((match) => cleanText(match[0]));
  // Content takeaways only — recommendation lines count; no mailbox/timestamp padding.
  return summaryBullets(message.content, { extras: [...recommendations, ...altCalls] });
}

function mailItem(message, axis = false, includeDate = false) {
  const source = senderName(message.sender);
  const title = cleanText(message.subject);
  const time = includeDate ? formatMailTimestamp(message.received) : formatTime(message.received);
  const bullets = axis ? axisBullets(message) : summaryBullets(message.content);
  const summary = bullets.length
    ? bullets.slice(0, 3).join(" ")
    : `Headline received from ${source}; this message has no readable plain-text body.`;
  return {
    source,
    time,
    receivedAt: message.received,
    title,
    summary,
    bullets,
  };
}

async function readNewsletterListing() {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", newsletterListScript], {
    timeout: NEWSLETTER_LIST_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

async function readNewsletterBodies() {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", newsletterBodyScript], {
    timeout: NEWSLETTER_BODY_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function newsletterMessageKey(subject, received) {
  return `${String(subject || "").trim()}\0${String(received || "").trim()}`;
}

async function readNewsletters() {
  // Listing alone is enough for status=live when the mailbox is readable.
  const listed = await readNewsletterListing();
  let messages = listed.messages ?? [];
  try {
    const enriched = await readNewsletterBodies();
    if (Array.isArray(enriched.messages) && enriched.messages.length) {
      const byKey = new Map(
        enriched.messages.map((message) => [newsletterMessageKey(message.subject, message.received), message]),
      );
      // Merge bodies onto the list pass — never replace with empty-content rows when Mail times out.
      messages = messages.map((listedMessage) => {
        const rich = byKey.get(newsletterMessageKey(listedMessage.subject, listedMessage.received));
        const content = String(rich?.content || "").trim();
        if (content.length >= 40) return { ...listedMessage, content };
        return listedMessage;
      });
    }
  } catch {
    // Retain metadata-only digests; do not fail the Newsletters source after a successful list.
  }

  const previousByKey = new Map(
    (lastSnapshot?.newsletters || []).map((item) => [newsletterMessageKey(item.title, item.receivedAt), item]),
  );

  return {
    total: listed.totalCount,
    items: messages.map((message) => {
      const item = mailItem(message, false, true);
      if ((item.bullets?.length || 0) > 0) return item;
      const previous = previousByKey.get(newsletterMessageKey(item.title, item.receivedAt));
      if (previous?.bullets?.length) {
        return {
          ...item,
          bullets: previous.bullets,
          summary: previous.summary || item.summary,
        };
      }
      return item;
    }).filter((item, index) => !isPromotionalMessage(messages[index], item)),
  };
}

async function readAxisResearch() {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", axisMailScript], { timeout: 45000, maxBuffer: 12 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  const uniqueMessages = parsed.messages.filter(isAxisResearchMail).filter((message, index, messages) => messages.findIndex((candidate) => candidate.subject === message.subject && candidate.received === message.received) === index);
  return {
    total: parsed.totalCount,
    items: uniqueMessages.map((message) => mailItem(message, true, true)),
  };
}

function macroEvidence(newsletters, axisItems) {
  const definitions = [
    ["oilWar", /\boil\b|\bbrent\b|\bcrude\b|\biran\b|\bhormuz\b|geopolit|\b(?:war|conflict|missile|sanction)s?\b|\bshipping\b|energy price|commodity/i],
    ["flows", /\bfii\b|\bfpi\b|\bdii\b|foreign investor|foreign institutional|institutional (?:investor|flow)|fund flow|passive flow|liquidity|msci|net (?:buy|sell)(?:ers?)?\b/i],
    ["rates", /\binr\b|rupee|currency|yield|bond|rate cut|rate hike|interest rate|inflation|monetary policy|rbi/i],
    ["breadth", /breadth|volatility|vix|mid.?cap|small.?cap|risk.?off|market correction|technical outlook|trade setup|\bnifty\b|\bsensex\b/i],
    ["earnings", /\bearnings\b|\bresults?\b|\bq[1-4]\b|annual analysis|annual report|financial performance|\bmargin\b|\bguidance\b|\brevenue\b|\bprofit\b|sector rotation/i],
  ];
  const items = [...axisItems, ...newsletters].sort((left, right) => new Date(right.receivedAt ?? 0) - new Date(left.receivedAt ?? 0));
  return definitions.map(([key, matcher]) => {
    const matched = items.filter((item) => {
      const evidenceText = `${item.title} ${item.summary}`.replace(/\bwar chest\b/gi, "");
      return matcher.test(evidenceText);
    });
    return {
      key,
      count: matched.length,
      latestTitle: matched[0]?.title ?? "No matching Mail evidence",
      latestAt: matched[0]?.time ?? "—",
      items: matched.slice(0, 4),
    };
  });
}

async function readPodcasts() {
  const schema = await execFileAsync("sqlite3", ["-readonly", "-json", PODCAST_DB, "PRAGMA table_info(ZMTEPISODE);"], { timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  const columns = new Set(JSON.parse(schema.stdout || "[]").map((column) => column.name));
  const { stdout } = await execFileAsync("sqlite3", ["-readonly", "-json", PODCAST_DB, podcastQuery(columns)], { timeout: 15000, maxBuffer: 12 * 1024 * 1024 });
  const items = JSON.parse(stdout || "[]").map((episode) => {
    const source = cleanText(episode.source);
    const title = cleanText(episode.title);
    const time = formatTime(`${episode.published.replace(" ", "T")}+05:30`);
    const transcript = readLocalPodcastTranscript(episode.transcriptIdentifier);
    const body = preferPodcastBody(transcript, episode.description);
    // Prefer transcript-derived takeaways when cached; else description content only (no CTAs).
    const bullets = summaryBullets(body.text, { max: DIGEST_BULLET_MAX });
    const contentBullets = bullets.filter((bullet) => !isDigestPromoOrNoise(bullet));
    return {
      source,
      time,
      title,
      summary: contentBullets.slice(0, 4).join(" ") || "No content takeaways available from the local transcript or episode description.",
      bullets: contentBullets,
      contentSource: body.source,
    };
  });
  const quality = (item) => (item.contentSource === "transcript" ? 1000 : item.contentSource === "description" ? 100 : 0) + item.bullets.length;
  const unique = new Map();
  for (const item of items) {
    const key = normalizeBulletKey(item.title)
      .replace(/^(?:special|bonus|rerun|encore)\s+/, "")
      .replace(/\s+(?:special|rerun|encore)$/, "");
    const existing = unique.get(key);
    if (!existing || quality(item) > quality(existing)) unique.set(key, item);
  }
  return [...unique.values()];
}

function coreDataToIso(coreDataSeconds) {
  const seconds = Number(coreDataSeconds);
  if (!Number.isFinite(seconds)) return "";
  return new Date((seconds + CORE_DATA_EPOCH) * 1000).toISOString();
}

function classifyTopic(title, detail = "", source = "") {
  const text = `${title} ${detail} ${source}`;
  if (/earnings|results?|q[1-4]|investor|analyst|stock|nifty|sensex|market/i.test(text)) return "Earnings";
  if (/job|interview|application|resume|recruit|career|work/i.test(text)) return "Work/Jobs";
  if (/health|doctor|workout|sleep|nutrition|medicine|hospital/i.test(text)) return "Health";
  if (/birthday|family|personal|travel|holiday/i.test(text)) return "Personal";
  return "Other";
}

function classifyReminderTopic(title, detail = "", list = "") {
  // List name wins for Job 🔍 / Earnings so title keywords do not mis-bucket actionable work items.
  if (/^earnings$/i.test(list.trim())) return "Earnings";
  if (PRIORITY_REMINDER_LISTS.has(list) || /job/i.test(list)) return "Work/Jobs";
  return classifyTopic(title, detail, list);
}

async function readReminders() {
  const stores = readdirSync(REMINDERS_STORE_DIR)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => `${REMINDERS_STORE_DIR}/${name}`);
  if (!stores.length) throw new Error("No local Apple Reminders stores were found.");

  const rows = [];
  const recurrenceByPk = new Map();
  for (const store of stores) {
    const { stdout } = await execFileAsync("sqlite3", ["-readonly", "-json", store, remindersQuery], { timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
    rows.push(...JSON.parse(stdout || "[]"));
    try {
      const recurrence = await execFileAsync("sqlite3", ["-readonly", "-json", store, reminderRecurrenceQuery], { timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
      for (const rule of JSON.parse(recurrence.stdout || "[]")) {
        const pk = Number(rule.reminderPk);
        if (!Number.isFinite(pk) || recurrenceByPk.has(pk)) continue;
        recurrenceByPk.set(pk, {
          repeatsOn: formatRepeatsOn(rule.frequency, rule.intervalCount),
        });
      }
    } catch {
      // Older stores may lack recurrence entity rows — active/completed reminders still return.
    }
  }

  const mapped = [...new Map(rows.map((item) => [item.id, item])).values()].map((item) => {
    const dueSeconds = Number(item.dueCoreData);
    const dueAt = Number.isFinite(dueSeconds) ? new Date((dueSeconds + CORE_DATA_EPOCH) * 1000).toISOString() : null;
    const completionSeconds = Number(item.completionCoreData);
    const completedAt = Number.isFinite(completionSeconds) ? new Date((completionSeconds + CORE_DATA_EPOCH) * 1000).toISOString() : null;
    const title = String(item.title || "Untitled reminder");
    const detail = String(item.detail || "");
    const list = String(item.list || "Unknown list");
    const topic = classifyReminderTopic(title, detail, list);
    const recurrence = recurrenceByPk.get(Number(item.pk));
    return {
      id: String(item.id || `${item.list}:${item.title}`),
      title,
      detail,
      list,
      dueAt,
      completed: Boolean(item.completed),
      completedAt,
      repeating: Boolean(recurrence),
      repeatsOn: recurrence?.repeatsOn ?? null,
      source: "Apple Reminders",
      topic,
      // Reminders never use 5-bullet digest padding — UI shows title + meta only.
    };
  });

  const incomplete = mapped.filter((item) => !item.completed);
  // Prefer Job/Earnings evidence + due-dated completions (calendar Scheduled Reminders clones), then recent others.
  const completed = mapped
    .filter((item) => item.completed)
    .sort((left, right) => {
      const leftPriority = PRIORITY_REMINDER_LISTS.has(left.list) || Boolean(left.dueAt) ? 1 : 0;
      const rightPriority = PRIORITY_REMINDER_LISTS.has(right.list) || Boolean(right.dueAt) ? 1 : 0;
      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      return new Date(right.completedAt ?? 0).getTime() - new Date(left.completedAt ?? 0).getTime();
    })
    .slice(0, REMINDER_COMPLETED_CAP);

  return [...incomplete, ...completed];
}

async function readCalendar() {
  const { stdout } = await execFileAsync("sqlite3", ["-readonly", "-json", CALENDAR_DB, calendarQuery], { timeout: 30000, maxBuffer: 12 * 1024 * 1024 });
  return JSON.parse(stdout || "[]").map((item) => {
    const title = String(item.title || "Untitled event");
    const calendar = String(item.calendar || "Unknown calendar");
    const startsAt = coreDataToIso(item.startCoreData);
    const endsAt = coreDataToIso(item.endCoreData);
    const notes = String(item.notes || "");
    const topic = classifyTopic(item.title, item.notes, item.calendar);
    return {
      id: String(item.id || ""),
      title,
      calendar,
      startsAt,
      endsAt,
      notes,
      topic,
      // Calendar events never use 5-bullet digest padding — UI shows title + schedule meta only.
    };
  }).sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
}

async function readHealthNote() {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", healthNoteScript], { timeout: 45000, maxBuffer: 2 * 1024 * 1024 });
  const note = JSON.parse(stdout);
  const latestEntry = latestHealthNoteEntry(note.body);
  return { title: note.title, modifiedAt: note.modifiedAt, ...latestEntry };
}

async function settle(task) {
  try {
    return { status: "fulfilled", value: await task() };
  } catch (reason) {
    return { status: "rejected", reason };
  }
}

/** Axis Recommended Stocks: trading-day as-of (today or last NSE session). */
function buildInvestmentIntelligence(newsletters, axisItems) {
  const axisScoped = extractAxisRecommendationsForTradingAsOf(axisItems, {
    calendarDate: ANALYSIS_DATE,
    lookbackDays: AXIS_LOOKBACK_DAYS,
  });
  return {
    policy: "Mail-first: Axis Recommended Stocks use today's Axis Research when NSE is open; on weekends/holidays they use the last trading day's mails. Local archive PDFs are evidence inventory only, not a stock-call count.",
    analysisWindowStart: ANALYSIS_WINDOW_START,
    analysisDate: ANALYSIS_DATE,
    axisLookbackDays: AXIS_LOOKBACK_DAYS,
    axisTradingAsOf: axisScoped.sourceDate,
    axisTradingAsOfLabel: axisScoped.usedLastTradingDay || axisScoped.sourceDate !== axisScoped.tradingAsOf
      ? `${formatIstDateLabel(axisScoped.sourceDate)} (last NSE trading day)`
      : formatIstDateLabel(axisScoped.sourceDate),
    axisUsedLastTradingDay: axisScoped.usedLastTradingDay || axisScoped.sourceDate !== ANALYSIS_DATE,
    latestAxisAt: axisItems[0]?.time ?? "No qualifying Axis report in the rolling window",
    latestNewsletterAt: newsletters[0]?.time ?? "No newsletter available",
    axisRecommendations: axisScoped.recommendations,
    macroEvidence: macroEvidence(newsletters, axisItems),
  };
}

async function refresh() {
  const calendar = await settle(readCalendar);
  const newsletters = await settle(readNewsletters);
  const axisResearch = await settle(readAxisResearch);
  const [podcasts, reminders, healthNote] = await Promise.all([
    settle(readPodcasts),
    settle(readReminders),
    settle(readHealthNote),
  ]);
  const newsletterValue = newsletters.status === "fulfilled" ? newsletters.value : { total: 0, items: [] };
  const axisValue = axisResearch.status === "fulfilled" ? axisResearch.value : { total: 0, items: [] };
  const podcastValue = podcasts.status === "fulfilled" ? podcasts.value : [];
  const reminderValue = reminders.status === "fulfilled" ? reminders.value : [];
  const calendarValue = calendar.status === "fulfilled" ? calendar.value : [];
  const healthNoteValue = healthNote.status === "fulfilled" ? healthNote.value : null;
  const requiredSources = [newsletters, axisResearch, reminders, calendar, healthNote];
  const liveRequiredSources = requiredSources.filter((source) => source.status === "fulfilled").length;
  const sourceState = (result, count, permissionOptional = false) => ({
    status: result.status === "fulfilled" ? "live" : permissionOptional ? "permission_required" : "error",
    count,
    observedAt: new Date().toISOString(),
    message: result.status === "rejected" ? String(result.reason) : undefined,
  });
  return {
    status: liveRequiredSources === requiredSources.length ? "live" : liveRequiredSources ? "partial" : "unavailable",
    asOf: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date()),
    newsletters: newsletterValue.items,
    axisResearch: axisValue.items,
    podcasts: podcastValue,
    reminders: reminderValue,
    calendar: calendarValue,
    healthNote: healthNoteValue,
    investment: buildInvestmentIntelligence(newsletterValue.items, axisValue.items),
    sources: {
      newsletters: { status: newsletters.status === "fulfilled" ? "live" : "error", count: newsletterValue.total, displayedCount: newsletterValue.items.length, message: newsletters.status === "rejected" ? String(newsletters.reason) : undefined },
      axisResearch: { status: axisResearch.status === "fulfilled" ? "live" : "error", count: axisValue.total, displayedCount: axisValue.items.length, message: axisResearch.status === "rejected" ? String(axisResearch.reason) : undefined },
      podcasts: sourceState(podcasts, podcastValue.length, true),
      reminders: sourceState(reminders, reminderValue.length),
      calendar: sourceState(calendar, calendarValue.length),
      healthNote: sourceState(healthNote, healthNoteValue ? 1 : 0),
    },
  };
}

let refreshInFlight = null;
let lastSnapshot = null;

function snapshotAge(snapshot) {
  const observed = Date.parse(snapshot?.refreshedAt ?? snapshot?.asOf ?? "");
  return Number.isFinite(observed) ? Date.now() - observed : Number.POSITIVE_INFINITY;
}

function cachedSnapshot(snapshot, message) {
  if (!snapshot) return null;
  const sources = Object.fromEntries(Object.entries(snapshot.sources ?? {}).map(([key, value]) => [key, {
    ...value,
    status: value.status === "permission_required" ? value.status : "cached",
    message: value.message ? `${value.message} ${message}` : message,
  }]));
  return { ...snapshot, status: "partial", sources };
}

try {
  const restored = JSON.parse(readFileSync(CONTENT_SNAPSHOT_PATH, "utf8"));
  // Disk restore is retention only — never treat as a fresh live Apple read.
  lastSnapshot = cachedSnapshot(restored, "Restored from local cache at process start; awaiting a forced Apple-source refresh.");
} catch {
  lastSnapshot = null;
}

function initializingSnapshot() {
  const observedAt = new Date().toISOString();
  const source = (message, permissionOptional = false) => ({
    status: permissionOptional ? "permission_required" : "error",
    count: 0,
    observedAt,
    message,
  });
  return {
    status: "partial",
    asOf: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date()),
    refreshedAt: observedAt,
    newsletters: [],
    axisResearch: [],
    podcasts: [],
    reminders: [],
    calendar: [],
    healthNote: null,
    investment: {
      policy: "The exact local Apple containers are being refreshed. The last validated snapshot will replace this state automatically.",
      analysisWindowStart: ANALYSIS_WINDOW_START,
      analysisDate: ANALYSIS_DATE,
      axisLookbackDays: AXIS_LOOKBACK_DAYS,
      axisTradingAsOf: ANALYSIS_DATE,
      axisTradingAsOfLabel: formatIstDateLabel(ANALYSIS_DATE),
      axisUsedLastTradingDay: false,
      latestAxisAt: "Refresh in progress",
      latestNewsletterAt: "Refresh in progress",
      axisRecommendations: [],
      macroEvidence: [],
    },
    sources: {
      newsletters: source("iCloud / Newsletters refresh is running in the background."),
      axisResearch: source("iCloud / Axis Research refresh is running in the background."),
      podcasts: source("Apple Podcasts refresh is running in the background.", true),
      reminders: source("Apple Reminders refresh is running in the background."),
      calendar: source("Apple Calendar refresh is running in the background."),
      healthNote: source("The exact  Health Daily note refresh is running in the background."),
    },
  };
}

async function refreshAndCache() {
  const refreshed = await refresh();
  const previous = lastSnapshot;
  const retained = { ...refreshed };
  for (const [sourceKey, dataKey] of [
    ["newsletters", "newsletters"],
    ["axisResearch", "axisResearch"],
    ["podcasts", "podcasts"],
    ["reminders", "reminders"],
    ["calendar", "calendar"],
    ["healthNote", "healthNote"],
  ]) {
    const currentSource = refreshed.sources?.[sourceKey];
    const previousSource = previous?.sources?.[sourceKey];
    const previousData = previous?.[dataKey];
    const hasPreviousData = dataKey === "healthNote" ? Boolean(previousData) : Array.isArray(previousData) && previousData.length > 0;
    if (currentSource?.status === "live" || !previousSource || !hasPreviousData) continue;
    retained[dataKey] = previousData;
    retained.sources = {
      ...retained.sources,
      [sourceKey]: {
        ...currentSource,
        status: currentSource.status === "permission_required" ? "permission_required" : "cached",
        count: previousSource.count,
        displayedCount: previousSource.displayedCount,
        observedAt: previousSource.observedAt ?? previous.refreshedAt,
        message: `${currentSource.message ?? "Latest refresh failed."} Retaining the last validated ${sourceKey} snapshot.`,
      },
    };
  }
  retained.investment = buildInvestmentIntelligence(retained.newsletters, retained.axisResearch);
  const requiredKeys = ["newsletters", "axisResearch", "reminders", "calendar", "healthNote"];
  retained.status = requiredKeys.every((key) => retained.sources[key]?.status === "live") ? "live" : "partial";
  const persisted = { ...retained, refreshedAt: new Date().toISOString() };
  mkdirSync(dirname(CONTENT_SNAPSHOT_PATH), { recursive: true });
  writeFileSync(CONTENT_SNAPSHOT_PATH, JSON.stringify(persisted, null, 2));
  lastSnapshot = persisted;
  return persisted;
}

function refreshOnce() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshAndCache().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function escapeAppleScriptString(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatExecError(error) {
  if (!error) return "unknown error";
  const stderr = String(error.stderr || "").trim();
  const stdout = String(error.stdout || "").trim();
  const message = error instanceof Error ? error.message : String(error);
  return [stderr, stdout, message].filter(Boolean).join(" | ") || message;
}

/**
 * Mark one incomplete reminder complete via EventKit (preferred).
 * Sees lists AppleScript often omits (Watchlist, Download List) and writes the real Reminders DB (iCloud sync).
 * Snapshot hex ids are not EventKit ids — title/list is the stable write key.
 */
async function completeReminderViaEventKit({ title, list }) {
  const { stdout } = await execFileAsync(
    "swift",
    [COMPLETE_REMINDER_EVENTKIT_SCRIPT, list, title],
    {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    },
  );
  const result = String(stdout || "").trim();
  if (result !== "ok") {
    throw new Error(result || "EventKit completer returned no confirmation.");
  }
  return result;
}

/**
 * Mark one incomplete reminder complete via Reminders AppleScript (list + title).
 * Fallback when EventKit is unavailable; cannot see some SQLite-visible lists.
 */
async function completeReminderViaAppleScript({ title, list }) {
  const safeTitle = escapeAppleScriptString(title);
  const safeList = escapeAppleScriptString(list);
  const script = `
on stripNoise(raw)
  set t to raw as text
  -- Keep ASCII letters/digits/spaces for fuzzy list matching when emoji prefixes differ.
  set out to ""
  repeat with i from 1 to length of t
    set ch to character i of t
    set c to id of ch
    if (c ≥ 48 and c ≤ 57) or (c ≥ 65 and c ≤ 90) or (c ≥ 97 and c ≤ 122) or c is 32 then
      set out to out & ch
    end if
  end repeat
  return my trimLower(out)
end stripNoise

on trimLower(raw)
  set t to raw as text
  repeat while t starts with " "
    set t to text 2 thru -1 of t
  end repeat
  repeat while t ends with " "
    if (length of t) is 0 then exit repeat
    set t to text 1 thru -2 of t
  end repeat
  return do shell script "printf %s " & quoted form of t & " | tr '[:upper:]' '[:lower:]'"
end trimLower

tell application "Reminders"
  set targetTitle to "${safeTitle}"
  set targetListName to "${safeList}"
  set matchedList to missing value
  repeat with candidate in every list
    set candidateName to name of candidate as text
    if candidateName is targetListName then
      set matchedList to candidate
      exit repeat
    end if
  end repeat
  if matchedList is missing value then
    set strippedTarget to my stripNoise(targetListName)
    repeat with candidate in every list
      set candidateName to name of candidate as text
      if my stripNoise(candidateName) is strippedTarget then
        set matchedList to candidate
        exit repeat
      end if
    end repeat
  end if
  if matchedList is missing value then error "Reminders list not visible to AppleScript: " & targetListName
  set openItems to (reminders of matchedList whose completed is false and name is targetTitle)
  if (count of openItems) is 0 then error "No incomplete reminder named \\"" & targetTitle & "\\" in list \\"" & targetListName & "\\""
  set completed of item 1 of openItems to true
  return "ok"
end tell
`;
  const { stdout } = await execFileAsync("osascript", [], {
    timeout: 45000,
    maxBuffer: 1024 * 1024,
    input: script,
  });
  return String(stdout || "").trim();
}

/**
 * Complete in Apple Reminders: EventKit first (all iCloud lists), AppleScript fallback.
 */
async function completeReminderInAppleReminders({ title, list }) {
  try {
    const result = await completeReminderViaEventKit({ title, list });
    return { method: "eventkit", result };
  } catch (eventKitError) {
    try {
      const result = await completeReminderViaAppleScript({ title, list });
      return { method: "applescript", result };
    } catch (appleScriptError) {
      const eventKitDetail = formatExecError(eventKitError);
      const appleScriptDetail = formatExecError(appleScriptError);
      throw new Error(
        `Apple Reminders write-back failed. EventKit: ${eventKitDetail}. AppleScript: ${appleScriptDetail}`,
      );
    }
  }
}

function markReminderCompletedInSnapshot(snapshot, { id, title, list }) {
  if (!snapshot || !Array.isArray(snapshot.reminders)) return snapshot;
  const completedAt = new Date().toISOString();
  const reminders = snapshot.reminders.map((item) => {
    const idMatch = id && item.id === id;
    const titleMatch = title && item.title === title && (!list || item.list === list);
    if (!idMatch && !titleMatch) return item;
    if (item.completed) return item;
    return { ...item, completed: true, completedAt };
  });
  return { ...snapshot, reminders, refreshedAt: completedAt };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (requestUrl.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (requestUrl.pathname === "/reminders/complete" && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const id = String(body.id || "").trim();
      const title = String(body.title || "").trim();
      const list = String(body.list || "").trim();
      if (!title || !list) {
        response.writeHead(400, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify({ ok: false, error: "title and list are required to complete a reminder." }));
        return;
      }
      const writeBack = await completeReminderInAppleReminders({ title, list });
      const completedAt = new Date().toISOString();
      if (lastSnapshot) {
        lastSnapshot = markReminderCompletedInSnapshot(lastSnapshot, { id, title, list });
        try {
          mkdirSync(dirname(CONTENT_SNAPSHOT_PATH), { recursive: true });
          writeFileSync(CONTENT_SNAPSHOT_PATH, JSON.stringify(lastSnapshot, null, 2));
        } catch {
          // Cache write is best-effort; Apple Reminders already accepted the completion.
        }
      }
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(
        JSON.stringify({
          ok: true,
          id,
          title,
          list,
          completedAt,
          method: writeBack.method,
        }),
      );
    } catch (error) {
      response.writeHead(502, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          blocker:
            "Apple Reminders write-back failed (EventKit + AppleScript). The item was NOT marked complete in the Reminders app. Check Full Disk / Reminders access, then try again.",
        }),
      );
    }
    return;
  }
  if (requestUrl.pathname !== "/refresh") {
    response.writeHead(404).end();
    return;
  }
  try {
    const force = requestUrl.searchParams.get("force") === "1";
    const cacheIsFresh = lastSnapshot && snapshotAge(lastSnapshot) < CONTENT_REFRESH_INTERVAL_MS;
    if (cacheIsFresh && !force) {
      response.writeHead(lastSnapshot.status === "unavailable" ? 503 : 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(lastSnapshot));
      return;
    }
    const refreshPromise = refreshOnce();
    if (lastSnapshot && !force) {
      refreshPromise.catch(() => undefined);
      const cached = cachedSnapshot(lastSnapshot, "A local Apple-source refresh is running in the background.");
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(cached));
      return;
    }
    if (!lastSnapshot && !force) {
      const pending = initializingSnapshot();
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(pending));
      return;
    }
    // force=1: wait up to FORCE_REFRESH_BUDGET_MS, then return retained snapshot rather than hanging Mail/Calendar audits.
    const snapshot = await Promise.race([
      refreshPromise,
      new Promise((resolve) => {
        setTimeout(() => {
          if (lastSnapshot) {
            resolve(cachedSnapshot(lastSnapshot, `Forced Apple-source refresh exceeded ${FORCE_REFRESH_BUDGET_MS / 1000}s; retaining the last validated digest.`));
          } else {
            resolve(initializingSnapshot());
          }
        }, FORCE_REFRESH_BUDGET_MS);
      }),
    ]);
    response.writeHead(snapshot.status === "unavailable" ? 503 : 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(snapshot));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ status: "unavailable", message: error instanceof Error ? error.message : String(error) }));
  }
});
server.on("error", (error) => {
  process.stderr.write(`Content digest server failed to listen on 127.0.0.1:${PORT}: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Content digest server listening on http://127.0.0.1:${PORT}\n`);
  if (!lastSnapshot || snapshotAge(lastSnapshot) >= CONTENT_REFRESH_INTERVAL_MS) refreshOnce().catch((error) => process.stderr.write(`Initial content refresh failed: ${error instanceof Error ? error.message : String(error)}\n`));
});
