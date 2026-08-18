import { createHash } from "node:crypto";
import { sectorCatalogIds, type SectorCatalogId } from "./sector-catalog.ts";
import type {
  SectorNewsItem,
  SectorNewsSentiment,
  SectorNewsSnapshot,
  SectorNewsSourceId,
  SectorNewsSourceState,
} from "./sector-news-types";

type FeedConfig = {
  id: SectorNewsSourceId;
  label: string;
  url: string;
  /** When true, titles often include " - Source" suffixes from Google News. */
  stripPublisherSuffix?: boolean;
};

const PER_SOURCE_ITEM_CEILING = 100;

const FEEDS: FeedConfig[] = [
  {
    id: "economic_times",
    label: "Economic Times",
    url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
  },
  {
    id: "financial_times",
    label: "Financial Times",
    url: "https://www.ft.com/markets?format=rss",
  },
  {
    id: "bloomberg",
    label: "Bloomberg",
    url: "https://feeds.bloomberg.com/markets/news.rss",
  },
  {
    id: "zerodha",
    label: "Zerodha",
    url: "https://zerodha.com/z-connect/feed",
  },
  {
    id: "moneycontrol",
    label: "Moneycontrol",
    // Direct Moneycontrol RSS returns 403; Google News site search preserves Moneycontrol URLs.
    url: "https://news.google.com/rss/search?q=site:moneycontrol.com+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    stripPublisherSuffix: true,
  },
  {
    id: "ndtv_profit",
    label: "NDTV Profit",
    url: "https://feeds.feedburner.com/ndtvprofit-latest",
  },
];

const POSITIVE_SENTIMENT = [
  /\b(?:surge|rally|gain|gains|jump|jumps|soar|beat|beats|upgrade|upgrades|record high|bullish|optimism|outperform)\b/i,
  /\b(?:strong growth|better.?than.?expected|raises guidance|profit jumps)\b/i,
];
const NEGATIVE_SENTIMENT = [
  /\b(?:fall|falls|drop|drops|slump|slumps|crash|crashes|sell.?off|downgrade|downgrades|bearish|warning|loss|losses)\b/i,
  /\b(?:miss(?:es)? estimates|cuts guidance|profit falls|weak demand|default)\b/i,
];

function classifySectorSentiment(value: string): SectorNewsSentiment {
  const text = String(value ?? "").normalize("NFKC");
  const positive = POSITIVE_SENTIMENT.reduce((score, matcher) => score + (matcher.test(text) ? 1 : 0), 0);
  const negative = NEGATIVE_SENTIMENT.reduce((score, matcher) => score + (matcher.test(text) ? 1 : 0), 0);
  if (positive - negative >= 1) return "Positive";
  if (negative - positive >= 1) return "Negative";
  return "Neutral";
}

const SECTOR_MATCHER_PATTERNS: Record<SectorCatalogId, RegExp> = {
  it: /\b(?:it services|software|infosys|wipro|\btcs\b|hcl tech|tech mahindra|coforge|ltts|it\/tech)\b/i,
  pharma: /\b(?:pharma|pharmaceutical|generic(?:s)?|drug|api maker|sun pharma|cipla|dr\.?\s*reddy)\b/i,
  power: /\b(?:power|electricity|renewable|solar|wind|grid|utility|utilities)\b/i,
  infrastructure: /\b(?:infrastructure|highway|nhai|construction|epc|cement|capex)\b/i,
  auto: /\b(?:auto(?:motive)?|vehicle|ev\b|two-wheeler|siam|passenger vehicle)\b/i,
  telecom: /\b(?:telecom|broadband|arpu|airtel|jio|vodafone|idea|5g)\b/i,
  banking: /\b(?:bank(?:ing)?|nim\b|npa\b|deposit|credit cost|rbi)\b/i,
  nbfc: /\b(?:nbfc|housing finance|microfinance|hfc|aum)\b/i,
  fmcg: /\b(?:fmcg|staples|consumer goods|nestl[eé]|hindustan unilever|itc)\b/i,
  consumer: /\b(?:quick commerce|consumer|retail|e-?commerce|blinkit|zomato|eternal)\b/i,
  energy: /\b(?:oil|gas|crude|refining|omc|lpg|petroleum|ongc|reliance)\b/i,
  metals: /\b(?:steel|aluminium|aluminum|mining|zinc|metal(?:s)?|jsw steel|tata steel|hindalco|coal india)\b/i,
  defence: /\b(?:defence|defense|hal\b|ordnance|missile|aerospace|mod\b)\b/i,
};

const SECTOR_MATCHERS: Array<[SectorCatalogId, RegExp]> = sectorCatalogIds.map((id) => [id, SECTOR_MATCHER_PATTERNS[id]]);

type RuntimeState = {
  cache?: { expiresAt: number; snapshot: SectorNewsSnapshot };
  lastGood?: SectorNewsSnapshot;
};

const globalState = globalThis as typeof globalThis & { __sectorNewsRuntime?: RuntimeState };
const state = globalState.__sectorNewsRuntime ??= {};

function asOfLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tagContent(xml: string, tag: string) {
  const cdata = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i").exec(xml);
  if (cdata?.[1]) return decodeEntities(cdata[1]).trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return plain?.[1] ? stripTags(plain[1]) : "";
}

function firstHref(xml: string) {
  const match = /<link[^>]*href=["']([^"']+)["']/i.exec(xml) ?? /<link[^>]*>([^<]+)<\/link>/i.exec(xml);
  return match?.[1]?.trim() ?? "";
}

function parseItems(xml: string, feed: FeedConfig, limit: number): Omit<SectorNewsItem, "sentiment" | "sectorIds">[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const items: Omit<SectorNewsItem, "sentiment" | "sectorIds">[] = [];
  for (const block of blocks) {
    if (items.length >= limit) break;
    let title = tagContent(block, "title");
    if (!title) continue;
    if (feed.stripPublisherSuffix) {
      title = title.replace(/\s+-\s+[^-]+$/u, "").trim();
    }
    const url = firstHref(block) || tagContent(block, "guid");
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const publishedAt = tagContent(block, "pubDate") || tagContent(block, "published") || null;
    const summary = tagContent(block, "description") || tagContent(block, "summary") || "";
    const id = createHash("sha1").update(`${feed.id}|${url}|${title}`).digest("hex").slice(0, 16);
    items.push({
      id,
      sourceId: feed.id,
      sourceLabel: feed.label,
      title,
      url,
      publishedAt,
      summary: summary.slice(0, 280),
    });
  }
  return items;
}

function matchSectorIds(text: string) {
  return SECTOR_MATCHERS.filter(([, matcher]) => matcher.test(text)).map(([id]) => id);
}

async function fetchFeed(feed: FeedConfig): Promise<{ source: SectorNewsSourceState; items: SectorNewsItem[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 PortfolioIntelligence/1.0 (+sector-news)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        source: {
          id: feed.id,
          label: feed.label,
          status: "unavailable",
          asOf: null,
          message: `HTTP ${response.status} fetching ${feed.label}`,
          itemCount: 0,
        },
        items: [],
      };
    }
    const xml = await response.text();
    if (!/<rss\b|<feed\b/i.test(xml)) {
      return {
        source: {
          id: feed.id,
          label: feed.label,
          status: "unavailable",
          asOf: null,
          message: `${feed.label} response was not an RSS/Atom feed`,
          itemCount: 0,
        },
        items: [],
      };
    }
    const parsed = parseItems(xml, feed, PER_SOURCE_ITEM_CEILING).map((item) => {
      const blob = `${item.title} ${item.summary}`;
      return {
        ...item,
        sentiment: classifySectorSentiment(blob),
        sectorIds: matchSectorIds(blob),
      };
    });
    return {
      source: {
        id: feed.id,
        label: feed.label,
        status: "live",
        asOf: asOfLabel(),
        message: `${parsed.length} headlines`,
        itemCount: parsed.length,
      },
      items: parsed,
    };
  } catch (error) {
    return {
      source: {
        id: feed.id,
        label: feed.label,
        status: "unavailable",
        asOf: null,
        message: error instanceof Error ? error.message : String(error),
        itemCount: 0,
      },
      items: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getSectorNewsSnapshot(force = false): Promise<SectorNewsSnapshot> {
  if (!force && state.cache && state.cache.expiresAt > Date.now()) {
    return state.cache.snapshot;
  }

  const results = await Promise.all(FEEDS.map((feed) => fetchFeed(feed)));
  const sources = results.map((result) => result.source);
  const items = results
    .flatMap((result) => result.items)
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    });

  const liveCount = sources.filter((source) => source.status === "live").length;
  const failed = sources.filter((source) => source.status === "unavailable").map((source) => source.label);
  const status = liveCount === sources.length ? "live" : liveCount > 0 ? "partial" : "unavailable";
  const snapshot: SectorNewsSnapshot = {
    status,
    asOf: asOfLabel(),
    message: liveCount
      ? `Aggregated ${items.length} headlines from ${liveCount}/${sources.length} sources`
        + (failed.length ? ` · unavailable: ${failed.join(", ")}` : "")
        + "."
      : `Sector news unavailable (${failed.join(", ") || "all sources failed"}).`,
    sources,
    items,
  };

  if (liveCount > 0) {
    state.cache = { expiresAt: Date.now() + 5 * 60_000, snapshot };
    state.lastGood = snapshot;
    return snapshot;
  }

  if (state.lastGood) {
    return {
      ...state.lastGood,
      status: "partial",
      message: `Latest refresh failed; retaining last validated sector news. ${snapshot.message}`,
    };
  }

  return snapshot;
}
