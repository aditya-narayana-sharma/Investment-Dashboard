import type { EarningsEvent } from "./portfolio-data";

export type EarningsSnapshot = {
  status: "verified" | "stale" | "unavailable";
  asOf: string;
  analysisDate: string;
  events: EarningsEvent[];
  message: string;
};
