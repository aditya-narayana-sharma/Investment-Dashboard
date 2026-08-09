export type SectorReturnHorizon = "day" | "week" | "month" | "quarter";

export type SectorCompanyMarket = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  returns: Record<SectorReturnHorizon, number | null>;
};

export type SectorMarketSnapshot = {
  status: "live" | "cached" | "public_delayed" | "auth_required" | "unavailable";
  sectorId: string;
  asOf: string;
  message: string;
  companies: SectorCompanyMarket[];
};

export const emptySectorSnapshot = (sectorId: string): SectorMarketSnapshot => ({
  status: "unavailable",
  sectorId,
  asOf: "Waiting for yfinance",
  message: "Sector prices load via yfinance; Kite paid market-data is optional.",
  companies: [],
});

/** Aggregate S-2 market freshness across industry snapshots (unfiltered breadth view). */
export function aggregateSectorMarketStatus(
  snapshots: SectorMarketSnapshot[],
): SectorMarketSnapshot["status"] {
  if (!snapshots.length) return "unavailable";
  if (snapshots.some((item) => item.status === "live")) return "live";
  if (snapshots.some((item) => item.status === "public_delayed")) return "public_delayed";
  if (snapshots.some((item) => item.status === "cached")) return "cached";
  if (snapshots.some((item) => item.status === "auth_required")) return "auth_required";
  return "unavailable";
}

export function isUsableSectorMarketStatus(status: SectorMarketSnapshot["status"]) {
  return status === "live" || status === "cached" || status === "public_delayed";
}

export type SectorBenchmarkPeriod = "day" | "week" | "month" | "quarter" | "halfYear" | "year";

export type SectorBenchmarkPoint = {
  date: string;
  value: number;
};

export type SectorBenchmarkIndex = {
  id: string;
  officialName: string;
  family: "broad" | "sector" | "strategy";
  level: number | null;
  returns: Record<SectorBenchmarkPeriod, number | null>;
  indexedHistory: SectorBenchmarkPoint[];
  volatility: number | null;
  maxDrawdown: number | null;
  squeezeWidth: number | null;
  source: string;
  sourceUrl: string;
  observedAt: string;
  period: string;
  freshness: "live" | "public_delayed" | "cached" | "unavailable";
};

export type SectorBenchmarkSnapshot = {
  status: "live" | "partial" | "cached" | "unavailable";
  asOf: string;
  message: string;
  indices: SectorBenchmarkIndex[];
};

export const emptyBenchmarkSnapshot = (): SectorBenchmarkSnapshot => ({
  status: "unavailable",
  asOf: "Waiting for benchmark refresh",
  message: "Canonical NSE benchmark definitions are configured; market history has not loaded yet.",
  // Keep the full S-3 index registry visible while history loads so the section is not an empty shell.
  indices: [
    { id: "nifty-50", officialName: "NIFTY 50", family: "broad", level: null, returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null }, indexedHistory: [], volatility: null, maxDrawdown: null, squeezeWidth: null, source: "NSE Indices canonical definition", sourceUrl: "https://www.niftyindices.com/reports/index-factsheet", observedAt: "Waiting for benchmark refresh", period: "Configured official NSE history waiting for refresh", freshness: "unavailable" },
    { id: "nifty-bank", officialName: "NIFTY Bank", family: "sector", level: null, returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null }, indexedHistory: [], volatility: null, maxDrawdown: null, squeezeWidth: null, source: "NSE Indices canonical definition", sourceUrl: "https://www.niftyindices.com/reports/index-factsheet", observedAt: "Waiting for benchmark refresh", period: "Configured official NSE history waiting for refresh", freshness: "unavailable" },
    { id: "nifty-it", officialName: "NIFTY IT", family: "sector", level: null, returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null }, indexedHistory: [], volatility: null, maxDrawdown: null, squeezeWidth: null, source: "NSE Indices canonical definition", sourceUrl: "https://www.niftyindices.com/reports/index-factsheet", observedAt: "Waiting for benchmark refresh", period: "Configured official NSE history waiting for refresh", freshness: "unavailable" },
    { id: "nifty-auto", officialName: "NIFTY Auto", family: "sector", level: null, returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null }, indexedHistory: [], volatility: null, maxDrawdown: null, squeezeWidth: null, source: "NSE Indices canonical definition", sourceUrl: "https://www.niftyindices.com/reports/index-factsheet", observedAt: "Waiting for benchmark refresh", period: "Configured official NSE history waiting for refresh", freshness: "unavailable" },
    { id: "nifty-alpha-50", officialName: "NIFTY Alpha 50", family: "strategy", level: null, returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null }, indexedHistory: [], volatility: null, maxDrawdown: null, squeezeWidth: null, source: "NSE Indices canonical definition", sourceUrl: "https://www.niftyindices.com/reports/index-factsheet", observedAt: "Waiting for benchmark refresh", period: "Configured official NSE history waiting for refresh", freshness: "unavailable" },
    { id: "nifty200-alpha-30", officialName: "NIFTY200 Alpha 30", family: "strategy", level: null, returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null }, indexedHistory: [], volatility: null, maxDrawdown: null, squeezeWidth: null, source: "NSE Indices canonical definition", sourceUrl: "https://www.niftyindices.com/reports/index-factsheet", observedAt: "Waiting for benchmark refresh", period: "Configured official NSE history waiting for refresh", freshness: "unavailable" },
    { id: "nifty100-low-vol-30", officialName: "NIFTY100 Low Volatility 30", family: "strategy", level: null, returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null }, indexedHistory: [], volatility: null, maxDrawdown: null, squeezeWidth: null, source: "NSE Indices canonical definition", sourceUrl: "https://www.niftyindices.com/reports/index-factsheet", observedAt: "Waiting for benchmark refresh", period: "Configured official NSE history waiting for refresh", freshness: "unavailable" },
  ],
});
