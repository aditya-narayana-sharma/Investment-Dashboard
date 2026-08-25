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
  /** Signed magnitude in [-1, 1] from `sector-news-scoring.ts`. */
  sentimentScore?: number;
  /** [0, 1]. Low when cues are sparse, contradictory, or hedged. */
  sentimentConfidence?: number;
  sectorIds: string[];
};

export type SectorNewsSourceState = {
  id: SectorNewsSourceId;
  label: string;
  status: "live" | "unavailable";
  asOf: string | null;
  message: string;
  itemCount: number;
  /** Relative trust applied to this vendor in the composite. */
  weight?: number;
};

export type SectorNewsCompositeRow = {
  sectorId: string;
  score: number | null;
  itemCount: number;
  weightTotal: number;
};

export type SectorNewsSnapshot = {
  status: "live" | "partial" | "unavailable";
  asOf: string;
  message: string;
  sources: SectorNewsSourceState[];
  items: SectorNewsItem[];
  /** Per-sector composite, decomposed rather than presented bare. */
  composites?: SectorNewsCompositeRow[];
};

export const emptySectorNewsSnapshot = (): SectorNewsSnapshot => ({
  status: "unavailable",
  asOf: "Waiting for sector news refresh",
  message: "Sector news aggregation has not loaded yet.",
  sources: [],
  items: [],
  composites: [],
});
