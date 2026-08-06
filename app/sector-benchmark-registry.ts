import type { SectorBenchmarkIndex } from "./sector-live-types";

const factsheetUrl = "https://www.niftyindices.com/reports/index-factsheet";

/** Canonical S-3 benchmark definitions. Tickers must be exact public Yahoo series — never ETF proxies. */
export const SECTOR_BENCHMARK_REGISTRY = [
  { id: "nifty-50", officialName: "NIFTY 50", family: "broad" as const, ticker: "^NSEI" },
  { id: "nifty-bank", officialName: "NIFTY Bank", family: "sector" as const, ticker: "^NSEBANK" },
  { id: "nifty-it", officialName: "NIFTY IT", family: "sector" as const, ticker: "^CNXIT" },
  { id: "nifty-auto", officialName: "NIFTY Auto", family: "sector" as const, ticker: "^CNXAUTO" },
  { id: "nifty-alpha-50", officialName: "NIFTY Alpha 50", family: "strategy" as const, ticker: "NIFTYALPHA50.NS" },
  { id: "nifty200-alpha-30", officialName: "NIFTY200 Alpha 30", family: "strategy" as const, ticker: "" },
  { id: "nifty100-low-vol-30", officialName: "NIFTY100 Low Volatility 30", family: "strategy" as const, ticker: "NIFTY100LOWVOL30.NS" },
] as const;

export type SectorBenchmarkRegistryItem = (typeof SECTOR_BENCHMARK_REGISTRY)[number];

export function placeholderBenchmarkIndex(
  item: SectorBenchmarkRegistryItem,
  observedAt = "Waiting for benchmark refresh",
): SectorBenchmarkIndex {
  const hasTicker = Boolean(item.ticker);
  return {
    id: item.id,
    officialName: item.officialName,
    family: item.family,
    level: null,
    returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null },
    indexedHistory: [],
    volatility: null,
    maxDrawdown: null,
    squeezeWidth: null,
    source: "NSE Indices canonical definition",
    sourceUrl: factsheetUrl,
    observedAt,
    period: hasTicker
      ? "Configured ticker waiting for market history"
      : "Definition only · no exact public Yahoo series (ETF proxies not substituted)",
    freshness: "unavailable",
  };
}

export const BENCHMARK_FACTSHEET_URL = factsheetUrl;
