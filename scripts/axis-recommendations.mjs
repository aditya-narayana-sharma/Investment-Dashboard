/** Parse Axis Research mail into symbol-scoped recommendation rows. */

export const companySymbols = [
  ["ICICI Bank", "ICICIBANK"], ["Bharti Airtel", "BHARTIARTL"], ["Eternal", "ETERNAL"],
  ["JSW Energy", "JSWENERGY"], ["Adani Green Energy", "ADANIGREEN"], ["Aether Industries", "AETHER"],
  ["Tech Mahindra", "TECHM"], ["L&T Technology Services", "LTTS"], ["LTIMindtree", "LTIM"],
  ["Avenue Supermarts", "DMART"], ["R Systems International", "RSYSTEMS"], ["R Systems", "RSYSTEMS"],
  ["Ujjivan Small Finance Bank", "UJJIVANSFB"],
  ["Axis Bank", "AXISBANK"], ["Global Health", "MEDANTA"], ["Bandhan Bank", "BANDHANBNK"],
  ["Bajaj Auto", "BAJAJ-AUTO"], ["Bharat Petroleum", "BPCL"], ["UltraTech Cement", "ULTRACEMCO"],
  ["Steel Strips Wheels", "SSWL"], ["Wipro", "WIPRO"], ["Star Cement", "STARCEMENT"],
  ["Gujarat Fluorochemicals", "FLUOROCHEM"], ["Aptus Value Housing Finance India", "APTUS"],
  ["Rainbow Children's Medicare", "RAINBOW"], ["Rainbow Children's", "RAINBOW"],
  ["Tata Consultancy Services", "TCS"],
  ["DLF", "DLF"], ["CDSL", "CDSL"], ["Kalyani Steels", "KSL"],
  ["Indian Hotels Company", "INDHOTEL"], ["Indian Hotels", "INDHOTEL"],
  ["J K Cement", "JKCEMENT"], ["JK Cement", "JKCEMENT"],
  ["Can Fin Homes", "CANFINHOME"],
];

const recommendationColors = ["#4c8fff", "#42c878", "#b38cff", "#ff7f6e", "#21b5c5", "#e3b844"];

const recommendationRiskOverrides = {
  RSYSTEMS: [4, 4, 4, 5, 4, 1], DMART: [5, 3, 1, 3, 4, 1], LTIM: [3, 4, 1, 4, 4, 1],
  RAINBOW: [4, 4, 3, 4, 4, 3], TCS: [3, 4, 1, 3, 4, 1], ETERNAL: [5, 4, 2, 4, 4, 1],
  DLF: [4, 5, 1, 4, 3, 4], CDSL: [4, 4, 1, 4, 3, 1], KSL: [4, 5, 4, 5, 3, 3],
  UJJIVANSFB: [3, 4, 3, 4, 3, 4], TECHM: [3, 4, 1, 3, 4, 1], LTTS: [4, 4, 2, 4, 4, 1],
  SSWL: [4, 4, 3, 4, 4, 3], WIPRO: [3, 3, 1, 3, 4, 1], STARCEMENT: [4, 5, 3, 4, 4, 3],
  FLUOROCHEM: [4, 5, 3, 5, 4, 3], APTUS: [4, 4, 3, 4, 4, 4],
  BANDHANBNK: [3, 4, 3, 4, 4, 4], "BAJAJ-AUTO": [3, 3, 1, 3, 3, 2],
  INDHOTEL: [4, 4, 2, 3, 3, 3], JKCEMENT: [4, 4, 2, 3, 3, 3], CANFINHOME: [4, 4, 3, 4, 3, 4],
  MEDANTA: [4, 3, 3, 3, 3, 2], ULTRACEMCO: [3, 3, 1, 3, 3, 3],
};

function cleanText(value) {
  return String(value ?? "")
    .replace(/\uFFFC/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\s*\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function recommendationSymbol(name) {
  const normalized = cleanText(name).replace(/\s+(?:Ltd|Limited|Company)\.?$/i, "").trim();
  const match = companySymbols.find(([company]) => {
    const left = company.toLowerCase();
    const right = normalized.toLowerCase();
    return right.includes(left) || left.includes(right);
  });
  return match?.[1] ?? normalized.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 14);
}

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

const CALL_WORDS = "BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY";
/** Prefer explicit TP / Target Price; avoid matching Axis Alpha "CMP Target" column headers. */
const TARGET_RE = /\b(?:TP|target\s+price)\s*(?:of|:)?\s*(?:Rs\.?|₹|INR)?\s*([\d,]+)/i;

/** Structured Axis result-update lines: "Bandhan Bank Ltd: BUY, TP ₹235". */
const STRUCTURED_CALL_RE = new RegExp(
  String.raw`([A-Z][A-Za-z0-9 &'/()-]{1,60}?)\s*(?:Ltd|Limited|Company(?:\s+Ltd)?)?\s*:\s*(${CALL_WORDS})\b(?:[^·\n;.]{0,80}?\bTP[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+))?`,
  "gi",
);

/** Raw Axis body lines: "Bandhan Bank Ltd - Result Update; BUY; TP: Rs 235". */
const BODY_RESULT_RE = /([A-Z][A-Za-z0-9 &'/()-]{1,60}?)\s*(?:Ltd|Limited)?\s*-\s*Result Update;\s*(BUY|HOLD|SELL|REDUCE|ADD);\s*TP:\s*Rs\.?\s*([\d,]+)/gi;

function nextCompanyIndex(text, fromIndex, companyName) {
  const lower = text.toLowerCase();
  let nearest = text.length;
  for (const [company] of companySymbols) {
    if (company.toLowerCase() === companyName.toLowerCase()) continue;
    const at = lower.indexOf(company.toLowerCase(), fromIndex + 1);
    if (at >= 0 && at < nearest) nearest = at;
  }
  // Also split on the next "Company: CALL" pattern so digests stay scoped.
  const structured = new RegExp(STRUCTURED_CALL_RE.source, "gi");
  structured.lastIndex = fromIndex + 1;
  const next = structured.exec(text);
  if (next && next.index > fromIndex && next.index < nearest) nearest = next.index;
  return nearest;
}

export function scopeThesisToCompany(text, company, { call, target } = {}) {
  if (company && (call || target)) {
    const bits = [`${company}: ${(call || "CALL").toUpperCase()}`];
    if (target) bits.push(`TP ₹${Number(target).toLocaleString("en-IN")}`);
    return bits.join(" · ");
  }

  const source = cleanText(text);
  if (!source || !company) return source;
  const lower = source.toLowerCase();
  const needle = company.toLowerCase();
  const companyIndex = lower.indexOf(needle);
  if (companyIndex < 0) return source.slice(0, 180);

  const end = nextCompanyIndex(source, companyIndex, company);
  return source
    .slice(companyIndex, end)
    .replace(/\s*Read Report\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function sanitizeCompanyName(name) {
  return cleanText(name)
    .replace(/^(?:read\s+report|report|we\s+maintain(?:\s+our)?|maintain(?:s|ed)?(?:\s+our)?|buy\s+recommendation(?:\s+on\s+the\s+stock)?)\s+/i, "")
    .replace(/\s+(?:Ltd|Limited|Company)\.?$/i, "")
    .trim();
}

function parseStructuredCalls(text) {
  const found = [];
  const seen = new Set();

  for (const [company, symbol] of companySymbols) {
    if (seen.has(symbol)) continue;
    const escaped = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `${escaped}(?:\\s+(?:Ltd|Limited|Company(?:\\s+Ltd)?))?\\s*:\\s*(${CALL_WORDS})\\b(?:[^·\\n;.]{0,80}?\\bTP[:\\s]*(?:Rs\\.?|₹|INR)?\\s*([\\d,]+))?`,
      "i",
    );
    const match = text.match(re);
    if (!match) continue;
    seen.add(symbol);
    found.push({
      name: company,
      symbol,
      call: match[1].toUpperCase(),
      target: match[2] ? Number(match[2].replace(/,/g, "")) : null,
      index: match.index ?? 0,
    });
  }

  for (const regex of [STRUCTURED_CALL_RE, BODY_RESULT_RE]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const name = sanitizeCompanyName(match[1]);
      if (!name || /recommendation|read report|^report\b|result updates/i.test(name)) continue;
      const symbol = recommendationSymbol(name);
      if (!name || seen.has(symbol)) continue;
      seen.add(symbol);
      found.push({
        name,
        symbol,
        call: match[2].toUpperCase(),
        target: match[3] ? Number(match[3].replace(/,/g, "")) : null,
        index: match.index,
      });
    }
  }
  return found;
}

/**
 * Extract BUY/HOLD/SELL (and technical) calls from Axis Research digest items.
 * Thesis text is scoped to the matched company so multi-name digests do not bleed across rows.
 */
export function extractAxisRecommendations(messages, { analysisWindowStart, analysisDate, limit = 20 } = {}) {
  const recommendations = [];
  const seen = new Set();
  const windowLabel = analysisWindowStart && analysisDate ? `${analysisWindowStart} to ${analysisDate}` : "Latest Axis report";

  const addRecommendation = ({ symbol, name, call, target, message, text, horizon = "Latest Axis report", thesis }) => {
    if (!name || !symbol || seen.has(symbol)) return;
    // Closures / stop-loss hits are not fresh actionable calls.
    if (/hit stop loss|book profits|call closure|closed the call/i.test(`${message.title} ${text}`)) return;
    seen.add(symbol);
    const scoped = thesis || scopeThesisToCompany(text, name, { call, target });
    recommendations.push({
      symbol,
      name,
      call,
      target,
      cmp: null,
      upside: target ? "Target from latest Axis mail" : "No explicit target in readable Mail content",
      horizon,
      source: message.source || "Axis Direct",
      date: message.time,
      thesis: scoped,
      color: recommendationColors[recommendations.length % recommendationColors.length],
      scores: recommendationRiskScores(symbol, `${scoped} ${text}`),
    });
  };

  for (const message of messages) {
    const text = `${message.title}. ${message.summary}`;
    const pickMatch = message.title.match(/^Pick of the Week\s*-\s*(.+?)(?:\s+Limited)?$/i);
    if (pickMatch) {
      const name = cleanText(pickMatch[1]).trim();
      const symbol = recommendationSymbol(name);
      addRecommendation({
        symbol,
        name,
        call: "PICK",
        target: null,
        message,
        text,
        horizon: "Pick of the Week",
        thesis: scopeThesisToCompany(text, name, { call: "PICK" }),
      });
    }

    for (const structured of parseStructuredCalls(text)) {
      addRecommendation({
        symbol: structured.symbol,
        name: structured.name,
        call: structured.call,
        target: structured.target,
        message,
        text,
        horizon: /result update/i.test(message.title) ? "Result update" : "Latest Axis report",
        thesis: scopeThesisToCompany(text, structured.name, { call: structured.call, target: structured.target }),
      });
    }

    for (const [company, symbol] of companySymbols) {
      if (seen.has(symbol)) continue;
      const companyIndex = text.toLowerCase().indexOf(company.toLowerCase());
      if (companyIndex < 0) continue;
      const companyContext = text.slice(companyIndex, nextCompanyIndex(text, companyIndex, company));
      const callMatch = companyContext.match(new RegExp(`\\b(${CALL_WORDS})\\b`, "i"));
      const isTechnicalPick = /Weekly Technical Picks/i.test(message.title);
      if (!callMatch && !isTechnicalPick) continue;
      const targetMatch = companyContext.match(TARGET_RE);
      addRecommendation({
        symbol,
        name: company,
        call: callMatch?.[1].toUpperCase() ?? "TECHNICAL BUY",
        target: targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null,
        message,
        text,
        horizon: isTechnicalPick ? "Weekly technical setup" : "Latest Axis report",
        thesis: scopeThesisToCompany(text, company, {
          call: callMatch?.[1].toUpperCase() ?? "TECHNICAL BUY",
          target: targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null,
        }),
      });
    }

    const titleCall = message.title.match(/^(.+?)(?:\s*-\s*Axis Annual Analysis)?\s*:\s*(BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)/i);
    if (titleCall) {
      const name = cleanText(titleCall[1]).replace(/^Axis Alpha\s*:\s*/i, "").trim();
      const symbol = recommendationSymbol(name);
      const targetMatch = text.match(TARGET_RE);
      const target = targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null;
      addRecommendation({
        symbol,
        name,
        call: titleCall[2].toUpperCase(),
        target,
        message,
        text,
        horizon: windowLabel,
        thesis: scopeThesisToCompany(text, name, { call: titleCall[2].toUpperCase(), target }),
      });
    }

    const axisAlphaCall = message.title.match(/^Axis Alpha\s*:\s*(.+?)(?:\s*-\s*|\s*:\s*)(BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)\b/i);
    if (axisAlphaCall) {
      const name = cleanText(axisAlphaCall[1]).trim();
      const symbol = recommendationSymbol(name);
      const targetMatch = text.match(TARGET_RE);
      const target = targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null;
      addRecommendation({
        symbol,
        name,
        call: axisAlphaCall[2].toUpperCase(),
        target,
        message,
        text,
        horizon: "Axis Alpha",
        thesis: scopeThesisToCompany(text, name, { call: axisAlphaCall[2].toUpperCase(), target }),
      });
    }
  }

  return recommendations.slice(0, limit);
}
