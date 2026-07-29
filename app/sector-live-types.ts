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
  indices: [],
});
