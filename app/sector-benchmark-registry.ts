import type { SectorBenchmarkIndex } from "./sector-live-types";

const factsheetUrl = "https://www.niftyindices.com/reports/index-factsheet";

/** Canonical S-3 benchmark definitions. Yahoo tickers are exact-index fallbacks, never ETF proxies. */
export const SECTOR_BENCHMARK_REGISTRY = [
  { id: "nifty-50", officialName: "NIFTY 50", nseIndexName: "NIFTY 50", family: "broad" as const, ticker: "^NSEI" },
  { id: "nifty-bank", officialName: "NIFTY Bank", nseIndexName: "NIFTY BANK", family: "sector" as const, ticker: "^NSEBANK" },
  { id: "nifty-it", officialName: "NIFTY IT", nseIndexName: "NIFTY IT", family: "sector" as const, ticker: "^CNXIT" },
  { id: "nifty-auto", officialName: "NIFTY Auto", nseIndexName: "NIFTY AUTO", family: "sector" as const, ticker: "^CNXAUTO" },
  { id: "nifty-alpha-50", officialName: "NIFTY Alpha 50", nseIndexName: "NIFTY ALPHA 50", family: "strategy" as const, ticker: "NIFTYALPHA50.NS" },
  { id: "nifty200-alpha-30", officialName: "NIFTY200 Alpha 30", nseIndexName: "NIFTY200 ALPHA 30", family: "strategy" as const, ticker: "" },
  { id: "nifty100-low-vol-30", officialName: "NIFTY100 Low Volatility 30", nseIndexName: "NIFTY100 LOW VOLATILITY 30", family: "strategy" as const, ticker: "NIFTY100LOWVOL30.NS" },
] as const;

export type SectorBenchmarkRegistryItem = (typeof SECTOR_BENCHMARK_REGISTRY)[number];

export function placeholderBenchmarkIndex(
  item: SectorBenchmarkRegistryItem,
  observedAt = "Waiting for benchmark refresh",
): SectorBenchmarkIndex {
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
    period: "Configured official NSE history waiting for refresh",
    freshness: "unavailable",
  };
}

export const BENCHMARK_FACTSHEET_URL = factsheetUrl;
