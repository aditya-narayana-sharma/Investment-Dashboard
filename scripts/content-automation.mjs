const AXIS_SECTORS = [
  ["Banking", /\b(?:bank|banking|deposit|credit cost|nim|npa|loan book)\b/i],
  ["NBFC", /\b(?:nbfc|housing finance|microfinance|lending|aum)\b/i],
  ["Technology", /\b(?:software|technology|it services|digital|cloud|ai|artificial intelligence)\b/i],
  ["Healthcare", /\b(?:healthcare|hospital|pharma|drug|diagnostic)\b/i],
  ["Consumer", /\b(?:consumer|retail|fmcg|staples|quick commerce|hotel)\b/i],
  ["Automotive", /\b(?:auto|automobile|vehicle|ev|two-wheeler)\b/i],
  ["Energy", /\b(?:energy|power|utility|renewable|oil|gas|refining)\b/i],
  ["Infrastructure", /\b(?:infrastructure|construction|epc|cement|real estate|realty)\b/i],
  ["Telecom", /\b(?:telecom|wireless|broadband|subscriber|arpu)\b/i],
  ["Industrials", /\b(?:industrial|manufacturing|capital goods|engineering)\b/i],
];

const AXIS_THESES = [
  ["Earnings", /\b(?:earnings|result|q[1-4]|revenue|profit|pat|ebitda|margin)\b/i],
  ["Growth", /\b(?:growth|expansion|market share|order book|capacity|scale-up)\b/i],
  ["Valuation", /\b(?:valuation|target price|\btp\b|multiple|rerating|undervalued)\b/i],
  ["Momentum", /\b(?:momentum|breakout|technical|trade setup|moving average)\b/i],
  ["Quality", /\b(?:quality|cash flow|return on equity|roe|roa|balance sheet|debt-free)\b/i],
  ["Risk", /\b(?:risk|downgrade|headwind|slowdown|leverage|regulatory|volatile)\b/i],
];

const AXIS_CONVICTION = [
  ["High", /\b(?:strong buy|high conviction|top pick|pick of the week|axis alpha)\b/i],
  ["Positive", /\b(?:buy|add|outperform|accumulate|technical buy|trading buy)\b/i],
  ["Neutral", /\b(?:hold|neutral|market perform)\b/i],
  ["Cautious", /\b(?:reduce|sell|underperform|avoid|stop loss|downgrade)\b/i],
];

const POSITIVE_SENTIMENT = [
  /\bbeat(?:s|ing)?\b/i, /\bupgrade[ds]?\b/i, /\boutperform(?:ed|s|ing)?\b/i,
  /\b(?:rose|rises|rising|gained|gains|growth|grew|record high|strong|bullish|recovery)\b/i,
  /\b(?:profit|revenue|margin)s?\s+(?:rose|grew|expanded|beat)\b/i,
];
const NEGATIVE_SENTIMENT = [
  /\bmiss(?:es|ed|ing)?\b/i, /\bdowngrade[ds]?\b/i, /\bunderperform(?:ed|s|ing)?\b/i,
  /\b(?:fell|falls|falling|declined|declines|weak|bearish|slowdown|warning|risk|loss)\b/i,
  /\b(?:profit|revenue|margin)s?\s+(?:fell|declined|contracted|missed)\b/i,
];

function uniqueMatches(text, definitions) {
  return definitions.filter(([, matcher]) => matcher.test(text)).map(([label]) => label);
}

/** Deterministic keyword tags; unknown content remains explicitly unclassified. */
export function classifyAxisTags(value) {
  const text = String(value ?? "").normalize("NFKC");
  return {
    sector: uniqueMatches(text, AXIS_SECTORS),
    thesis: uniqueMatches(text, AXIS_THESES),
    conviction: uniqueMatches(text, AXIS_CONVICTION),
  };
}

/** Lexicon score with a conservative neutral band. */
export function classifyNewsletterSentiment(value) {
  const text = String(value ?? "").normalize("NFKC");
  const positive = POSITIVE_SENTIMENT.reduce((score, matcher) => score + (matcher.test(text) ? 1 : 0), 0);
  const negative = NEGATIVE_SENTIMENT.reduce((score, matcher) => score + (matcher.test(text) ? 1 : 0), 0);
  if (positive - negative >= 1) return "Positive";
  if (negative - positive >= 1) return "Negative";
  return "Neutral";
}

export const REMINDER_TOPIC_COLORS = Object.freeze({
  Earnings: "#2563EB",
  "Work/Jobs": "#F97316",
  Health: "#16A34A",
  Personal: "#9333EA",
  Other: "#64748B",
});

export function yiqTextColor(hex) {
  const normalized = String(hex ?? "").replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#FFF";
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return ((red * 299 + green * 587 + blue * 114) / 1000) >= 128 ? "#000" : "#FFF";
}

export function reminderVisual(topic) {
  const topicColor = REMINDER_TOPIC_COLORS[topic] ?? REMINDER_TOPIC_COLORS.Other;
  return {
    topicColor,
    backgroundColor: `${topicColor}80`,
    textColor: yiqTextColor(topicColor),
  };
}

function timestampSeconds(raw) {
  const parts = String(raw).split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part)) || parts.length < 2 || parts.length > 3) return null;
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function safeEpisodeUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function podcastTimestampLinks(text, episodeUrl) {
  const url = safeEpisodeUrl(episodeUrl);
  if (!url) return [];
  const links = [];
  const seen = new Set();
  for (const match of String(text ?? "").matchAll(/\[((?:\d{1,2}:)?\d{1,2}:\d{2})\]/g)) {
    const seconds = timestampSeconds(match[1]);
    if (seconds === null || seen.has(seconds)) continue;
    seen.add(seconds);
    const linked = new URL(url);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    linked.hash = `t=${minutes}m${remainder}s`;
    links.push({ label: match[1], seconds, href: linked.toString() });
  }
  return links;
}

/** Preserve TTML cue starts as safe text markers before stripping XML. */
export function transcriptTextFromTtml(raw) {
  const source = String(raw ?? "");
  const cues = [];
  for (const match of source.matchAll(/<p\b[^>]*\bbegin=["']([^"']+)["'][^>]*>([\s\S]*?)<\/p>/gi)) {
    const seconds = timestampSeconds(String(match[1]).replace(/\.\d+$/, ""));
    const body = match[2]
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim();
    if (seconds === null || !body) continue;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    cues.push(`[${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}] ${body}`);
  }
  return cues.join("\n");
}
