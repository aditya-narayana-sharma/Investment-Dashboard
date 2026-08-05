import type { ContentDigestSnapshot } from "./content-types";
import type { EarningsSnapshot } from "./earnings-live-types";
import type { HealthLiveSnapshot } from "./health-live-types";
import type { KiteSnapshot } from "./live-types";
import type { SectorBenchmarkSnapshot } from "./sector-live-types";

export type FreshnessState = "live" | "verified" | "partial" | "cached" | "stale" | "unavailable" | "permission_required";

export type SourceFreshness = {
  source: string;
  state: FreshnessState;
  observedAt: string;
  period: string;
  required: boolean;
  message: string;
};

export type DashboardRefreshResult = {
  status: "current" | "partial" | "unavailable";
  refreshedAt: string;
  /** Latest successful exact iCloud → Axis Research mailbox read. */
  axisResearchLastFetchedAt?: string;
  analysisDate: string;
  completedHealthThrough: string;
  partialToday: boolean;
  sources: SourceFreshness[];
  kite?: KiteSnapshot;
  content?: ContentDigestSnapshot;
  earnings?: EarningsSnapshot;
  health?: HealthLiveSnapshot;
  benchmarks?: SectorBenchmarkSnapshot;
};
