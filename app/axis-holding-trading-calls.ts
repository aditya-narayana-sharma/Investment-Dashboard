/** Verified Axis PDF Trading Calls for current Kite holdings (Progress-to-Target).
 *  Targets come from Axis Morning Note Investment Picks / dedicated PDFs — not invented.
 *  CMP is filled at runtime from Kite first, then yfinance.
 */
import type { MailRecommendation } from "./content-types";

export const AXIS_HOLDING_TRADING_SYMBOLS = ["ETERNAL", "ICICIBANK", "JSWENERGY", "BHARTIARTL"] as const;

export type AxisHoldingTradingSymbol = (typeof AXIS_HOLDING_TRADING_SYMBOLS)[number];

export type AxisCallBucket = "fundamental" | "technical" | "trading";

/** Latest verified rows from Axis_MorningNote-2026-08-06.pdf Investment Picks table. */
export const axisHoldingTradingCalls: MailRecommendation[] = [
  {
    symbol: "ETERNAL",
    name: "Eternal",
    call: "TRADING BUY",
    target: 360,
    cmp: 311,
    upside: "—",
    horizon: "Axis Investment Picks",
    source: "Axis PDF",
    date: "6 Aug",
    thesis: "Eternal: TRADING BUY · TP ₹360",
    color: "#42c878",
    scores: [5, 4, 2, 4, 4, 1],
    evidenceFile: "Axis_MorningNote-2026-08-06.pdf",
    dateKey: "2026-08-06",
    bucket: "trading",
    origin: "pdf",
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank",
    call: "TRADING BUY",
    target: 1800,
    cmp: 1444,
    upside: "—",
    horizon: "Axis Investment Picks",
    source: "Axis PDF",
    date: "6 Aug",
    thesis: "ICICI Bank: TRADING BUY · TP ₹1,800",
    color: "#4c8fff",
    scores: [3, 3, 1, 3, 3, 2],
    evidenceFile: "Axis_MorningNote-2026-08-06.pdf",
    dateKey: "2026-08-06",
    bucket: "trading",
    origin: "pdf",
  },
  {
    symbol: "JSWENERGY",
    name: "JSW Energy",
    call: "TRADING BUY",
    target: 630,
    cmp: 566,
    upside: "—",
    horizon: "Axis Investment Picks",
    source: "Axis PDF",
    date: "6 Aug",
    thesis: "JSW Energy: TRADING BUY · TP ₹630",
    color: "#e3b844",
    scores: [4, 4, 2, 4, 4, 3],
    evidenceFile: "Axis_MorningNote-2026-08-06.pdf",
    dateKey: "2026-08-06",
    bucket: "trading",
    origin: "pdf",
  },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel",
    call: "TRADING BUY",
    target: 2530,
    cmp: 1964,
    upside: "—",
    horizon: "Axis Investment Picks",
    source: "Axis PDF",
    date: "6 Aug",
    thesis: "Bharti Airtel: TRADING BUY · TP ₹2,530",
    color: "#21b5c5",
    scores: [3, 3, 1, 3, 3, 2],
    evidenceFile: "Axis_MorningNote-2026-08-06.pdf",
    dateKey: "2026-08-06",
    bucket: "trading",
    origin: "pdf",
  },
];

export function axisCallBucket(item: Pick<MailRecommendation, "bucket" | "call" | "horizon">): AxisCallBucket {
  if (item.bucket === "technical" || item.bucket === "trading" || item.bucket === "fundamental") {
    return item.bucket;
  }
  const call = String(item.call ?? "").toUpperCase();
  const horizon = String(item.horizon ?? "").toLowerCase();
  if (call.includes("TECHNICAL") || horizon.includes("technical")) return "technical";
  if (call.includes("TRADING") || horizon.includes("punch")) return "trading";
  return "fundamental";
}

function normalizeCallFamily(call: string): "technical" | "trading" | "plain" {
  const upper = String(call ?? "").toUpperCase();
  if (upper.includes("TECHNICAL")) return "technical";
  if (upper.includes("TRADING")) return "trading";
  return "plain";
}

function dateRank(item: Pick<MailRecommendation, "dateKey" | "date">): number {
  if (item.dateKey) return Number(String(item.dateKey).replaceAll("-", "")) || 0;
  return 0;
}

function axisCallRichness(item: MailRecommendation): number {
  const originBoost = item.origin === "pdf" ? 1 : 0;
  return (item.cmp ? 4 : 0) + (item.target ? 4 : 0) + originBoost + dateRank(item) / 1e8;
}

function bucketPriority(bucket: AxisCallBucket): number {
  switch (bucket) {
    case "trading":
      return 3;
    case "technical":
      return 2;
    case "fundamental":
      return 1;
    default: {
      const _exhaustive: never = bucket;
      return _exhaustive;
    }
  }
}

/** Prefer newer, richer, and more specific (trading > technical > fundamental) Axis rows. */
export function preferAxisCall(next: MailRecommendation, prev: MailRecommendation): boolean {
  const nextBucket = axisCallBucket(next);
  const prevBucket = axisCallBucket(prev);
  if (bucketPriority(nextBucket) !== bucketPriority(prevBucket)) {
    return bucketPriority(nextBucket) > bucketPriority(prevBucket);
  }
  const nextDate = dateRank(next);
  const prevDate = dateRank(prev);
  if (nextDate !== prevDate) return nextDate > prevDate;
  return axisCallRichness(next) >= axisCallRichness(prev);
}

function logicalCallKey(item: MailRecommendation): string {
  const bucket = axisCallBucket(item);
  const call = String(item.call ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  const target = item.target == null ? "" : String(item.target);
  const published = item.dateKey ?? item.date ?? "";
  return `${item.symbol}|${call}|${target}|${published}|${bucket}`;
}

function nearDuplicateKey(item: MailRecommendation): string {
  const target = item.target == null ? "" : String(item.target);
  const published = item.dateKey ?? item.date ?? "";
  return `${item.symbol}|${target}|${published}`;
}

/**
 * Collapse exact/near-duplicate Axis rows.
 * Key: symbol + call + target + published date (+ bucket).
 * Near-dup: same symbol/target/date where only BUY vs TRADING BUY differ → keep trading.
 */
export function collapseNearDuplicateAxisCalls(recommendations: MailRecommendation[]): MailRecommendation[] {
  const exact = new Map<string, MailRecommendation>();
  for (const item of recommendations) {
    if (!item?.symbol || !item?.call) continue;
    const next = { ...item, bucket: axisCallBucket(item) };
    const key = logicalCallKey(next);
    const prev = exact.get(key);
    if (!prev || preferAxisCall(next, prev)) exact.set(key, next);
  }

  const near = new Map<string, MailRecommendation>();
  for (const item of exact.values()) {
    const key = nearDuplicateKey(item);
    const prev = near.get(key);
    if (!prev) {
      near.set(key, item);
      continue;
    }
    const prevFamily = normalizeCallFamily(prev.call);
    const nextFamily = normalizeCallFamily(item.call);
    const buyLikePair =
      (prevFamily === "plain" && nextFamily === "trading")
      || (prevFamily === "trading" && nextFamily === "plain");
    if (buyLikePair) {
      near.set(key, nextFamily === "trading" ? item : prev);
      continue;
    }
    if (preferAxisCall(item, prev)) near.set(key, item);
  }

  return [...near.values()].sort(
    (left, right) => String(right.dateKey ?? "").localeCompare(String(left.dateKey ?? ""))
      || left.symbol.localeCompare(right.symbol)
      || bucketPriority(axisCallBucket(right)) - bucketPriority(axisCallBucket(left)),
  );
}

/** One preferred Axis row per symbol (trading > technical > fundamental, then newer/richer). */
export function dedupeAxisCallsBySymbol(recommendations: MailRecommendation[]): MailRecommendation[] {
  const bySymbol = new Map<string, MailRecommendation>();
  for (const item of collapseNearDuplicateAxisCalls(recommendations)) {
    const prev = bySymbol.get(item.symbol);
    if (!prev || preferAxisCall(item, prev)) bySymbol.set(item.symbol, item);
  }
  return [...bySymbol.values()].sort(
    (left, right) => String(right.dateKey ?? "").localeCompare(String(left.dateKey ?? ""))
      || left.symbol.localeCompare(right.symbol),
  );
}

/** Merge holding Trading Calls into Axis recommendations without duplicating live trading rows. */
export function mergeHoldingTradingCalls(recommendations: MailRecommendation[]): MailRecommendation[] {
  const byKey = new Map<string, MailRecommendation>();
  for (const item of recommendations) {
    if (!item?.symbol || !item?.call) continue;
    const bucket = axisCallBucket(item);
    const next = { ...item, bucket };
    const key = `${item.symbol}|${bucket}`;
    const prev = byKey.get(key);
    if (!prev || preferAxisCall(next, prev)) byKey.set(key, next);
  }

  for (const holdingCall of axisHoldingTradingCalls) {
    const key = `${holdingCall.symbol}|trading`;
    const prev = byKey.get(key);
    // Fill missing trading-bucket holdings; never overwrite a newer/richer live trading call.
    if (!prev || preferAxisCall(holdingCall, prev)) {
      byKey.set(key, holdingCall);
    }
  }

  return collapseNearDuplicateAxisCalls([...byKey.values()]);
}
