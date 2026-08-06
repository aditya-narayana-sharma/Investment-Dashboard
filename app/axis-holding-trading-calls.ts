/** Verified Axis PDF Trading Calls for current Kite holdings (Progress-to-Target).
 *  Targets come from Axis Morning Note Investment Picks / dedicated PDFs — not invented.
 *  CMP is filled at runtime from Kite first, then yfinance.
 */
import type { MailRecommendation } from "./content-types";

export const AXIS_HOLDING_TRADING_SYMBOLS = ["ETERNAL", "ICICIBANK", "JSWENERGY", "BHARTIARTL"] as const;

export type AxisHoldingTradingSymbol = (typeof AXIS_HOLDING_TRADING_SYMBOLS)[number];

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

/** Merge holding Trading Calls into Axis recommendations (trading bucket wins per symbol). */
export function mergeHoldingTradingCalls(recommendations: MailRecommendation[]): MailRecommendation[] {
  const byKey = new Map<string, MailRecommendation>();
  for (const item of recommendations) {
    const bucket = item.bucket
      ?? (item.call.includes("TECHNICAL") ? "technical" : item.call.includes("TRADING") || /punch/i.test(item.horizon) ? "trading" : "fundamental");
    byKey.set(`${item.symbol}|${bucket}`, { ...item, bucket });
  }
  for (const holdingCall of axisHoldingTradingCalls) {
    byKey.set(`${holdingCall.symbol}|trading`, holdingCall);
  }
  return [...byKey.values()].sort((left, right) => String(right.dateKey ?? "").localeCompare(String(left.dateKey ?? "")) || left.symbol.localeCompare(right.symbol));
}
