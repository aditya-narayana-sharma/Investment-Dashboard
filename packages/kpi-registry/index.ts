import registry from "./definitions/kpis.json";

export const KPI_REGISTRY_COUNT = 138;

export type KpiBucketId =
  | "ohlcv"
  | "trend"
  | "momentum"
  | "vol"
  | "volume"
  | "breadth"
  | "risk"
  | "valuation";

export type KpiDefinition = {
  id: string;
  label: string;
  bucket: KpiBucketId;
  output: "series";
  description: string;
};

export const KPI_BUCKETS: Array<{ id: KpiBucketId; label: string }> = [
  { id: "ohlcv", label: "OHLCV" },
  { id: "trend", label: "TREND" },
  { id: "momentum", label: "MOMENTUM" },
  { id: "vol", label: "VOL" },
  { id: "volume", label: "VOLUME" },
  { id: "breadth", label: "BREADTH" },
  { id: "risk", label: "RISK" },
  { id: "valuation", label: "VALUATION" },
];

export const kpiDefinitions = registry.kpis as KpiDefinition[];

if (kpiDefinitions.length !== KPI_REGISTRY_COUNT) {
  throw new Error(`KPI registry must contain exactly ${KPI_REGISTRY_COUNT} definitions; found ${kpiDefinitions.length}`);
}

export function kpiById(id: string): KpiDefinition | undefined {
  return kpiDefinitions.find((kpi) => kpi.id === id);
}

export function kpisInBucket(bucket: KpiBucketId | "all"): KpiDefinition[] {
  if (bucket === "all") return kpiDefinitions;
  return kpiDefinitions.filter((kpi) => kpi.bucket === bucket);
}

export function searchKpis(query: string, bucket: KpiBucketId | "all" = "all"): KpiDefinition[] {
  const needle = query.trim().toLowerCase();
  const pool = kpisInBucket(bucket);
  if (!needle) return pool;
  return pool.filter((kpi) =>
    kpi.id.toLowerCase().includes(needle)
    || kpi.label.toLowerCase().includes(needle)
    || kpi.description.toLowerCase().includes(needle)
  );
}
