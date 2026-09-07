export type SectorNewsSourceId =
  | "economic_times"
  | "financial_times"
  | "bloomberg"
  | "zerodha"
  | "moneycontrol"
  | "ndtv_profit";

export type SectorNewsSentiment = "Positive" | "Neutral" | "Negative";

export type SectorNewsItem = {
  id: string;
  sourceId: SectorNewsSourceId;
  sourceLabel: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
  sentiment: SectorNewsSentiment;
  sectorIds: string[];
};

export type SectorNewsSourceState = {
  id: SectorNewsSourceId;
  label: string;
  status: "live" | "unavailable";
  asOf: string | null;
  message: string;
  itemCount: number;
};

export type SectorNewsSnapshot = {
  status: "live" | "partial" | "unavailable";
  asOf: string;
  message: string;
  sources: SectorNewsSourceState[];
  items: SectorNewsItem[];
};

export const emptySectorNewsSnapshot = (): SectorNewsSnapshot => ({
  status: "unavailable",
  asOf: "Waiting for sector news refresh",
  message: "Sector news aggregation has not loaded yet.",
  sources: [],
  items: [],
});
