export type ThesisTone = "positive" | "watch" | "negative";

export type ThesisBullet = {
  marker: "✅" | "⚠️" | "⛔️";
  tone: ThesisTone;
  text: string;
};

const POSITIVE = /\b(?:buy|add|support|supportive|growth|improve|improved|upside|maintain(?:s|ed)?\s+buy|strong|record|expand|expansion|beat|resilient|positive|outperform|upgrade)\b/i;
const NEGATIVE = /\b(?:sell|reduce|avoid|break(?:down| risk)?|downgrade|loss|hit stop|stop loss|underperform|weak|decline|miss|closure|closed the call)\b/i;
const WATCH = /\b(?:hold|watch|risk|caution|pressure|volatile|volatility|uncertain|moderate|tempered|offset|near[\s-]?term|execution|leverage|margin)\b/i;

const OTHER_COMPANY = /\b(?:Bandhan Bank|Bajaj Auto|Indian Hotels|UltraTech|J K Cement|JK Cement|Can Fin Homes|Global Health|Avenue Supermarts|LTIMindtree|Rainbow|Tech Mahindra|ICICI Bank|Bharti Airtel|Eternal|Axis Bank|Gujarat Fluorochemicals|Wipro|DLF|CDSL|Kalyani Steels|R Systems|TCS|BPCL|Star Cement|Aptus|Medanta)\b/i;

const STRUCTURED_SEGMENT = /([A-Z][A-Za-z0-9 &.'/()-]{1,70}?)\s*(?:Ltd|Limited|Company(?:\s+Ltd)?)?\s*:\s*(BUY|HOLD|SELL|REDUCE|ADD)\b[^·|•]*/gi;

function classifyTone(text: string, fallbackCall?: string): ThesisTone {
  if (NEGATIVE.test(text) && !/\bmaintain(?:s|ed)?\s+buy\b/i.test(text)) return "negative";
  if (POSITIVE.test(text)) return "positive";
  if (WATCH.test(text)) return "watch";
  if (fallbackCall) {
    if (/sell|reduce/i.test(fallbackCall)) return "negative";
    if (/hold/i.test(fallbackCall)) return "watch";
    if (/buy|add|pick|technical|trading/i.test(fallbackCall)) return "positive";
  }
  return "watch";
}

function markerFor(tone: ThesisTone): ThesisBullet["marker"] {
  if (tone === "positive") return "✅";
  if (tone === "negative") return "⛔️";
  return "⚠️";
}

function normalizeName(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+(?:ltd|limited|company)\.?$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mentionsSelected(chunk: string, name: string, symbol: string) {
  const lower = chunk.toLowerCase();
  if (name && lower.includes(name)) return true;
  if (symbol && lower.includes(symbol)) return true;
  return false;
}

/** Keep only fragments that mention this symbol/name when the blob clearly mixes companies. */
export function scopeThesisText(thesis: string, opts: { symbol?: string; name?: string } = {}) {
  const source = String(thesis ?? "").replace(/\s+/g, " ").trim();
  if (!source) return "";
  const name = normalizeName(opts.name);
  const symbol = String(opts.symbol ?? "").toLowerCase();
  if (!name && !symbol) return source;

  const structured = [...source.matchAll(new RegExp(STRUCTURED_SEGMENT.source, "gi"))]
    .map((match) => match[0].replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (structured.length > 1) {
    const matched = structured.filter((chunk) => mentionsSelected(chunk, name, symbol));
    if (matched.length) return matched.join(" · ");
  }

  const parts = source
    .split(/\s*[·|•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const scoped = parts.filter((part) => {
      if (mentionsSelected(part, name, symbol)) return true;
      return !OTHER_COMPANY.test(part) && /^(?:buy|hold|sell|reduce|add|tp|target)\b/i.test(part);
    });
    if (scoped.length) return scoped.join(" · ");
  }

  return source;
}

function splitBullets(text: string) {
  return text
    .split(/\s*[·•]\s*|(?<=[.;])\s+|\s+;\s+|,\s+(?=(?:and\s+)?[A-Z])/)
    .map((item) => item.replace(/^[\s\-–—]+/, "").replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 8 && !/unsubscribe|disclaimer|read report/i.test(item));
}

export function thesisBullets(
  thesis: string,
  opts: { symbol?: string; name?: string; call?: string; limit?: number } = {},
): ThesisBullet[] {
  const scoped = scopeThesisText(thesis, opts);
  const raw = splitBullets(scoped);
  const limit = opts.limit ?? 4;
  const seen = new Set<string>();
  const bullets: ThesisBullet[] = [];

  for (const item of raw) {
    const key = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    if (opts.name || opts.symbol) {
      const selectedName = normalizeName(opts.name);
      const otherHit = item.match(OTHER_COMPANY);
      if (otherHit && selectedName && !normalizeName(otherHit[0]).includes(selectedName) && !selectedName.includes(normalizeName(otherHit[0]))) {
        continue;
      }
    }
    seen.add(key);
    const tone = classifyTone(item, opts.call);
    bullets.push({
      marker: markerFor(tone),
      tone,
      text: item.length > 140 ? `${item.slice(0, 137).trim()}…` : item,
    });
    if (bullets.length >= limit) break;
  }

  if (!bullets.length && scoped) {
    const tone = classifyTone(scoped, opts.call);
    bullets.push({
      marker: markerFor(tone),
      tone,
      text: scoped.length > 140 ? `${scoped.slice(0, 137).trim()}…` : scoped,
    });
  }

  return bullets;
}
