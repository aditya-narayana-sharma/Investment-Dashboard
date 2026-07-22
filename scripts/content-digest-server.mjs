import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isAxisResearchMail } from "./axis-mail-filter.mjs";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.CONTENT_DIGEST_PORT ?? 3003);
const PODCAST_DB = `${process.env.HOME}/Library/Group Containers/243LU875E5.groups.com.apple.podcasts/Documents/MTLibrary.sqlite`;
const REMINDERS_STORE_DIR = `${process.env.HOME}/Library/Group Containers/group.com.apple.reminders/Container_v1/Stores`;
const CONTENT_SNAPSHOT_PATH = process.env.CONTENT_SNAPSHOT_PATH ?? fileURLToPath(new URL("../artifacts/private/content-snapshot.json", import.meta.url));
const CONTENT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const FORCE_REFRESH_BUDGET_MS = 90_000;
const NEWSLETTER_DIGEST_LIMIT = 500;
function istDateKey(daysAgo) {
  return new Date(Date.now() + (5.5 * 60 * 60 * 1000) - (daysAgo * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}
const ANALYSIS_WINDOW_START = process.env.INVESTMENT_ANALYSIS_START_DATE ?? istDateKey(3);
const ANALYSIS_DATE = process.env.INVESTMENT_ANALYSIS_DATE ?? istDateKey(0);
const AXIS_LOOKBACK_DAYS = 3;
const AXIS_DIGEST_LIMIT = 500;

const newsletterMailScript = String.raw`
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
function serialize(message) {
  try {
    const properties = message.properties();
    const received = properties.dateReceived || message.dateReceived();
    return {
      subject: String(properties.subject || "Untitled message"),
      sender: String(properties.sender || "Unknown sender"),
      received: received.toISOString(),
      content: String(properties.content || "").slice(0, 16000),
    };
  } catch (error) {
    return null;
  }
}
function analysisDayMessages(name, limit) {
  const mailbox = exactMailbox(account, name);
  const cutoff = new Date("${ANALYSIS_WINDOW_START}T00:00:00+05:30");
  const end = new Date("${ANALYSIS_DATE}T00:00:00+05:30");
  end.setDate(end.getDate() + 1);
  const recent = mailbox.messages.whose({ _and: [
    { dateReceived: { _greaterThan: cutoff } },
    { dateReceived: { _lessThan: end } },
  ] })();
  const totalCount = recent.length;
  const messages = recent
    .map((message) => ({ message, received: message.dateReceived().getTime() }))
    .sort((left, right) => right.received - left.received)
    .slice(0, limit)
    .map(({ message }) => serialize(message))
    .filter(Boolean);
  return { totalCount, messages };
}
JSON.stringify(analysisDayMessages("Newsletters", ${NEWSLETTER_DIGEST_LIMIT}));
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
    content: String(properties.content || "").slice(0, 16000),
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
    content: String(properties.content || "").slice(0, 16000),
  };
}).sort((left, right) => new Date(right.received) - new Date(left.received)).slice(0, ${AXIS_DIGEST_LIMIT});
JSON.stringify({ totalCount, messages });
`;

const remindersQuery = `
SELECT
  hex(reminder.ZIDENTIFIER) AS id,
  reminder.ZTITLE AS title,
  coalesce(reminder.ZNOTES, '') AS detail,
  list.ZNAME AS list,
  reminder.ZDUEDATE AS dueCoreData,
  reminder.ZCOMPLETED AS completed
FROM ZREMCDREMINDER reminder
JOIN ZREMCDBASELIST list ON list.Z_PK = reminder.ZLIST
WHERE list.ZNAME IN ('🔍Job', 'Job 🔍', 'Earnings')
  AND reminder.ZCOMPLETED = 0
  AND coalesce(reminder.ZMARKEDFORDELETION, 0) = 0
  AND coalesce(list.ZMARKEDFORDELETION, 0) = 0
ORDER BY list.ZNAME, reminder.ZCREATIONDATE DESC;
`;

const calendarScript = String.raw`
const Calendar = Application("Calendar");
const start = new Date("${ANALYSIS_WINDOW_START}T00:00:00+05:30");
const end = new Date("${ANALYSIS_DATE}T23:59:59+05:30");
end.setDate(end.getDate() + 45);
const output = [];
for (const calendar of Calendar.calendars()) {
  const calendarName = String(calendar.name());
  let events = [];
  try {
    events = calendar.events.whose({ _and: [{ startDate: { _greaterThan: start } }, { startDate: { _lessThan: end } }] })();
  } catch (_) { continue; }
  for (const event of events) {
    const properties = event.properties();
    output.push({
      id: String(properties.uid || properties.id || ""),
      title: String(properties.summary || "Untitled event"),
      calendar: calendarName,
      startsAt: properties.startDate ? properties.startDate.toISOString() : "",
      endsAt: properties.endDate ? properties.endDate.toISOString() : "",
      notes: String(properties.description || "").slice(0, 4000),
    });
  }
}
JSON.stringify(output);
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
  const descriptionColumns = ["ZITEMDESCRIPTIONWITHOUTHTML", "ZITEMDESCRIPTION", "ZITUNESSUBTITLE"]
    .filter((column) => episodeColumns.has(column))
    .map((column) => `e.${column}`);
  const description = descriptionColumns.length ? `coalesce(${descriptionColumns.join(", ")}, '')` : "''";
  return `
SELECT
  coalesce(p.ZTITLE, e.ZAUTHOR, 'Apple Podcasts') AS source,
  coalesce(e.ZTITLE, e.ZITUNESTITLE, 'Untitled episode') AS title,
  datetime(e.ZPUBDATE + 978307200, 'unixepoch', 'localtime') AS published,
  ${description} AS description
FROM ZMTEPISODE e
LEFT JOIN ZMTPODCAST p ON p.Z_PK = e.ZPODCAST
WHERE date(e.ZPUBDATE + 978307200, 'unixepoch', 'localtime') BETWEEN date('${ANALYSIS_WINDOW_START}') AND date('${ANALYSIS_DATE}')
ORDER BY e.ZPUBDATE DESC;`;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\uFFFC/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email redacted]")
    .replace(/\b(Client ID|Client Code|Account ID)\s*:\s*[A-Z0-9-]+/gi, "$1: [redacted]")
    .replace(/click here to unsubscribe[^.\n]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function concise(value, limit = 360) {
  const clean = cleanText(value);
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 24 && !/unsubscribe|disclaimer|market risks|contact us/i.test(sentence));
  const selected = [];
  let size = 0;
  for (const sentence of sentences) {
    if (selected.length && size + sentence.length > limit) break;
    selected.push(sentence);
    size += sentence.length;
    if (selected.length === 2) break;
  }
  const summary = selected.join(" ") || clean;
  return summary.length > limit ? `${summary.slice(0, limit - 1).trim()}…` : summary;
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
  if (!entries.length) return { summary: concise(text, 700), observedDate: null };

  const latest = entries.reduce((best, entry) => {
    const timestamp = Date.UTC(entry.year, entry.month, entry.day);
    return !best || timestamp > best.timestamp ? { ...entry, timestamp } : best;
  }, null);
  const next = entries.find((entry) => entry.index > latest.index);
  const section = text.slice(latest.index, next?.index ?? text.length);
  return {
    summary: concise(section, 700),
    observedDate: `${latest.year}-${String(latest.month + 1).padStart(2, "0")}-${String(latest.day).padStart(2, "0")}`,
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

function axisSummary(message) {
  const body = cleanText(message.content);
  const recommendations = [...body.matchAll(/([A-Z][A-Za-z0-9 &.'-]{2,70}?)\s*-\s*Result Update;\s*(BUY|HOLD|SELL|REDUCE);\s*TP:\s*Rs\s*([\d,]+)/gi)]
    .slice(0, 5)
    .map((match) => `${match[1].trim()}: ${match[2].toUpperCase()}, TP ₹${match[3]}`);
  return recommendations.length ? `${recommendations.join(" · ")}. ${concise(body, 260)}` : concise(body, 420);
}

function mailItem(message, axis = false, includeDate = false) {
  const summary = axis ? axisSummary(message) : concise(message.content, 360);
  return {
    source: senderName(message.sender),
    time: includeDate ? formatMailTimestamp(message.received) : formatTime(message.received),
    receivedAt: message.received,
    title: cleanText(message.subject),
    summary: summary || `Headline received from ${senderName(message.sender)}; this message has no readable plain-text body.`,
  };
}

async function readNewsletters() {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", newsletterMailScript], { timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return {
    total: parsed.totalCount,
    items: parsed.messages.map((message) => mailItem(message, false, true)),
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

const companySymbols = [
  ["ICICI Bank", "ICICIBANK"], ["Bharti Airtel", "BHARTIARTL"], ["Eternal", "ETERNAL"],
  ["JSW Energy", "JSWENERGY"], ["Adani Green Energy", "ADANIGREEN"], ["Aether Industries", "AETHER"],
  ["Tech Mahindra", "TECHM"], ["L&T Technology Services", "LTTS"], ["LTIMindtree", "LTIM"],
  ["Avenue Supermarts", "DMART"], ["R Systems International", "RSYSTEMS"],
  ["Ujjivan Small Finance Bank", "UJJIVANSFB"],
  ["Axis Bank", "AXISBANK"], ["Global Health", "MEDANTA"], ["Bandhan Bank", "BANDHANBNK"],
  ["Bajaj Auto", "BAJAJ-AUTO"], ["Bharat Petroleum", "BPCL"], ["UltraTech Cement", "ULTRACEMCO"],
  ["Steel Strips Wheels", "SSWL"], ["Wipro", "WIPRO"], ["Star Cement", "STARCEMENT"],
  ["Gujarat Fluorochemicals", "FLUOROCHEM"], ["Aptus Value Housing Finance India", "APTUS"],
  ["Rainbow Children's Medicare", "RAINBOW"], ["Tata Consultancy Services", "TCS"],
  ["DLF", "DLF"], ["CDSL", "CDSL"], ["Kalyani Steels", "KSL"],
];

const recommendationColors = ["#4c8fff", "#42c878", "#b38cff", "#ff7f6e", "#21b5c5", "#e3b844"];

const recommendationRiskOverrides = {
  RSYSTEMS: [4, 4, 4, 5, 4, 1], DMART: [5, 3, 1, 3, 4, 1], LTIM: [3, 4, 1, 4, 4, 1],
  RAINBOW: [4, 4, 3, 4, 4, 3], TCS: [3, 4, 1, 3, 4, 1], ETERNAL: [5, 4, 2, 4, 4, 1],
  DLF: [4, 5, 1, 4, 3, 4], CDSL: [4, 4, 1, 4, 3, 1], KSL: [4, 5, 4, 5, 3, 3],
  UJJIVANSFB: [3, 4, 3, 4, 3, 4], TECHM: [3, 4, 1, 3, 4, 1], LTTS: [4, 4, 2, 4, 4, 1],
  SSWL: [4, 4, 3, 4, 4, 3], WIPRO: [3, 3, 1, 3, 4, 1], STARCEMENT: [4, 5, 3, 4, 4, 3],
  FLUOROCHEM: [4, 5, 3, 5, 4, 3], APTUS: [4, 4, 3, 4, 4, 4],
};

function recommendationRiskScores(symbol, text) {
  if (recommendationRiskOverrides[symbol]) return recommendationRiskOverrides[symbol];
  const scores = [3, 3, 3, 3, 3, 3];
  if (/premium valuation|expensive|high valuation|multiple|rerating/i.test(text)) scores[0] = 5;
  else if (/valuation comfort|undervalued|attractive valuation/i.test(text)) scores[0] = 2;
  if (/small.?cap|micro.?cap|cyclical|commodity|real estate/i.test(text)) scores[1] = 4;
  if (/small.?cap|micro.?cap|low liquidity|technical buy/i.test(text)) scores[2] = 4;
  else if (/large.?cap|nifty|sensex/i.test(text)) scores[2] = 1;
  if (/volatile|technical|trading buy|momentum|breakout/i.test(text)) scores[3] = 5;
  if (/regulatory|geopolitical|currency|commodity|result|earnings|event/i.test(text)) scores[4] = 4;
  if (/leverage|debt|capital intensive|capex|credit cost|asset quality/i.test(text)) scores[5] = 4;
  else if (/net cash|debt.?free|asset light/i.test(text)) scores[5] = 1;
  return scores;
}

function recommendationSymbol(name) {
  const match = companySymbols.find(([company]) => name.toLowerCase().includes(company.toLowerCase()) || company.toLowerCase().includes(name.toLowerCase()));
  return match?.[1] ?? name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

function extractAxisRecommendations(messages) {
  const recommendations = [];
  const seen = new Set();
  const addRecommendation = ({ symbol, name, call, target, message, text, horizon = "Latest Axis report" }) => {
    if (!name || seen.has(symbol)) return;
    seen.add(symbol);
    recommendations.push({
      symbol, name, call, target, cmp: null,
      upside: target ? "Target from latest Axis mail" : "No explicit target in readable Mail content",
      horizon, source: message.source || "Axis Direct", date: message.time, thesis: message.summary,
      color: recommendationColors[recommendations.length % recommendationColors.length],
      scores: recommendationRiskScores(symbol, text),
    });
  };
  for (const message of messages) {
    const text = `${message.title}. ${message.summary}`;
    const pickMatch = message.title.match(/^Pick of the Week\s*-\s*(.+?)(?:\s+Limited)?$/i);
    if (pickMatch) {
      const name = cleanText(pickMatch[1]).trim();
      const symbol = recommendationSymbol(name);
      addRecommendation({ symbol, name, call: "PICK", target: null, message, text, horizon: "Pick of the Week" });
    }

    for (const [company, symbol] of companySymbols) {
      const companyIndex = text.toLowerCase().indexOf(company.toLowerCase());
      if (companyIndex < 0) continue;
      const companyContext = text.slice(companyIndex, companyIndex + 220);
      const callMatch = companyContext.match(/\b(BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)\b/i);
      const isTechnicalPick = /Weekly Technical Picks/i.test(message.title);
      if (!callMatch && !isTechnicalPick) continue;
      const targetMatch = companyContext.match(/\bTP\s*(?:of|:)?\s*(?:Rs\.?|₹)?\s*([\d,]+)/i);
      addRecommendation({
        symbol,
        name: company,
        call: callMatch?.[1].toUpperCase() ?? "TECHNICAL BUY",
        target: targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null,
        message,
        text,
        horizon: isTechnicalPick ? "Weekly technical setup" : "Latest Axis report",
      });
    }

    const titleCall = message.title.match(/^(.+?)(?:\s*-\s*Axis Annual Analysis)?\s*:\s*(BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)/i);
    if (titleCall) {
      const name = cleanText(titleCall[1]).trim();
      const symbol = recommendationSymbol(name);
      const targetMatch = text.match(/(?:TP|target)(?:\s+of)?\s*(?:Rs\.?|₹)?\s*([\d,]+)/i);
      const target = targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null;
      addRecommendation({
        symbol, name, call: titleCall[2].toUpperCase(), target, message, text,
        horizon: `${ANALYSIS_WINDOW_START} to ${ANALYSIS_DATE}`,
      });
    }

    const axisAlphaCall = message.title.match(/^Axis Alpha\s*:\s*(.+?)(?:\s*-\s*|\s*:\s*)(BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)\b/i);
    if (axisAlphaCall) {
      const name = cleanText(axisAlphaCall[1]).trim();
      const symbol = recommendationSymbol(name);
      const targetMatch = text.match(/(?:TP|target)(?:\s+of)?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+)/i);
      addRecommendation({ symbol, name, call: axisAlphaCall[2].toUpperCase(), target: targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null, message, text, horizon: "Axis Alpha" });
    }
  }
  return recommendations.slice(0, 20);
}

function macroEvidence(newsletters, axisItems) {
  const definitions = [
    ["oilWar", /\boil\b|\bbrent\b|\bcrude\b|\biran\b|\bhormuz\b|geopolit|\bwar\b|\bshipping\b|energy price|commodity/i],
    ["flows", /\bfii\b|\bfpi\b|\bdii\b|foreign investor|institutional flow|fund flow|passive flow|liquidity|msci/i],
    ["rates", /\binr\b|rupee|currency|yield|bond|rate cut|rate hike|interest rate|inflation|monetary policy|rbi/i],
    ["breadth", /breadth|volatility|vix|mid.?cap|small.?cap|risk.?off|market correction|technical outlook|trade setup|\bnifty\b|\bsensex\b/i],
    ["earnings", /\bearnings\b|\bresults?\b|\bq[1-4]\b|annual analysis|annual report|financial performance|\bmargin\b|\bguidance\b|\brevenue\b|\bprofit\b|sector rotation/i],
  ];
  const items = [...axisItems, ...newsletters].sort((left, right) => new Date(right.receivedAt ?? 0) - new Date(left.receivedAt ?? 0));
  return definitions.map(([key, matcher]) => {
    const matched = items.filter((item) => matcher.test(`${item.title} ${item.summary}`));
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
  return JSON.parse(stdout || "[]").map((episode) => ({
    source: cleanText(episode.source),
    time: formatTime(`${episode.published.replace(" ", "T")}+05:30`),
    title: cleanText(episode.title),
    summary: concise(episode.description, 380),
  }));
}

function classifyTopic(title, detail = "", source = "") {
  const text = `${title} ${detail} ${source}`;
  if (/earnings|results?|q[1-4]|investor|analyst|stock|nifty|sensex|market/i.test(text)) return "Earnings";
  if (/job|interview|application|resume|recruit|career|work/i.test(text)) return "Work/Jobs";
  if (/health|doctor|workout|sleep|nutrition|medicine|hospital/i.test(text)) return "Health";
  if (/birthday|family|personal|travel|holiday/i.test(text)) return "Personal";
  return "Other";
}

async function readReminders() {
  const stores = readdirSync(REMINDERS_STORE_DIR)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => `${REMINDERS_STORE_DIR}/${name}`);
  if (!stores.length) throw new Error("No local Apple Reminders stores were found.");

  const rows = [];
  for (const store of stores) {
    const { stdout } = await execFileAsync("sqlite3", ["-readonly", "-json", store, remindersQuery], { timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
    rows.push(...JSON.parse(stdout || "[]"));
  }

  return [...new Map(rows.map((item) => [item.id, item])).values()].map((item) => {
    const dueSeconds = Number(item.dueCoreData);
    const dueAt = Number.isFinite(dueSeconds) ? new Date((dueSeconds + 978307200) * 1000).toISOString() : null;
    return {
      id: String(item.id || `${item.list}:${item.title}`),
      title: String(item.title || "Untitled reminder"),
      detail: String(item.detail || ""),
      list: String(item.list || "Unknown list"),
      dueAt,
      completed: Boolean(item.completed),
      source: "Apple Reminders",
      topic: classifyTopic(item.title, item.detail, item.list),
    };
  });
}

async function readCalendar() {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", calendarScript], { timeout: 60000, maxBuffer: 12 * 1024 * 1024 });
  return JSON.parse(stdout || "[]").map((item) => ({ ...item, topic: classifyTopic(item.title, item.notes, item.calendar) })).sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
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

async function refresh() {
  const [newsletters, axisResearch, podcasts, reminders, calendar, healthNote] = await Promise.all([
    settle(readNewsletters),
    settle(readAxisResearch),
    settle(readPodcasts),
    settle(readReminders),
    settle(readCalendar),
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
    investment: {
      policy: "Latest iCloud Axis Research and Newsletters mail is refreshed before investment analysis; static research is fallback-only.",
      analysisWindowStart: ANALYSIS_WINDOW_START,
      analysisDate: ANALYSIS_DATE,
      axisLookbackDays: AXIS_LOOKBACK_DAYS,
      latestAxisAt: axisValue.items[0]?.time ?? "No qualifying Axis report in the rolling window",
      latestNewsletterAt: newsletterValue.items[0]?.time ?? "No newsletter available",
      axisRecommendations: extractAxisRecommendations(axisValue.items),
      macroEvidence: macroEvidence(newsletterValue.items, axisValue.items),
    },
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
  retained.investment = {
    ...retained.investment,
    latestAxisAt: retained.axisResearch[0]?.time ?? "No qualifying Axis report in the rolling window",
    latestNewsletterAt: retained.newsletters[0]?.time ?? "No newsletter available",
    axisRecommendations: extractAxisRecommendations(retained.axisResearch),
    macroEvidence: macroEvidence(retained.newsletters, retained.axisResearch),
  };
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

createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (requestUrl.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
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
}).listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Content digest server listening on http://127.0.0.1:${PORT}\n`);
  if (!lastSnapshot || snapshotAge(lastSnapshot) >= CONTENT_REFRESH_INTERVAL_MS) refreshOnce().catch((error) => process.stderr.write(`Initial content refresh failed: ${error instanceof Error ? error.message : String(error)}\n`));
});
