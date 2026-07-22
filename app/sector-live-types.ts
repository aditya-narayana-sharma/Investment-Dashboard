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
  asOf: "Waiting for Kite Connect",
  message: "Authenticate Kite to load sector prices and return rankings.",
  companies: [],
});
