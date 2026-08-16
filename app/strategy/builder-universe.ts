import { SECTOR_BENCHMARK_REGISTRY, type SectorBenchmarkRegistryItem } from "../sector-benchmark-registry";
import { sectorUniverseLabels } from "../sector-company-data";
import bundledCache from "./builder-universe.cache.json" with { type: "json" };

export const BUILDER_UNIVERSE_SOURCE = "NSE Indices official constituent CSV" as const;
export const BUILDER_UNIVERSE_SOURCE_URL = "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv";

export type BuilderUniverseGroup = "equity" | "broad" | "industry" | "thematic" | "strategy";

export type BuilderUniverseItem = {
  symbol: string;
  name: string;
  group: BuilderUniverseGroup;
  yahooTicker?: string;
};

export type BuilderUniverseCache = {
  source: string;
  sourceUrl: string;
  market: "NSE";
  index: "NIFTY 500";
  asOf: string;
  fetchedAt: string;
  count: number;
  equities: Array<{ symbol: string; name: string; industry?: string; series?: string }>;
};

export const BUILDER_UNIVERSE_GROUP_LABELS: Record<BuilderUniverseGroup, string> = {
  broad: "Broad market",
  industry: "Industry",
  thematic: "Thematic",
  strategy: "Strategy",
  equity: "Nifty 500",
};

export function isBeesSymbol(symbol: string): boolean {
  return symbol.trim().toUpperCase().endsWith("BEES");
}

function isCache(value: unknown): value is BuilderUniverseCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.market === "NSE" && row.index === "NIFTY 500" && Array.isArray(row.equities);
}

export function bundledNifty500Cache(): BuilderUniverseCache {
  if (!isCache(bundledCache)) {
    throw new Error("builder-universe.cache.json is missing a labeled NSE Nifty 500 payload.");
  }
  return bundledCache;
}

function officialIndex(
  symbol: string,
  name: string,
  group: Exclude<BuilderUniverseGroup, "equity">,
  yahooTicker = "",
): BuilderUniverseItem {
  return { symbol, name, group, ...(yahooTicker ? { yahooTicker } : {}) };
}

function familyToGroup(family: SectorBenchmarkRegistryItem["family"]): Exclude<BuilderUniverseGroup, "equity"> {
  switch (family) {
    case "broad":
      return "broad";
    case "sector":
      return "industry";
    case "strategy":
      return "strategy";
    default: {
      const _never: never = family;
      return _never;
    }
  }
}

/** Official NSE index names from the S-3 registry, sector universes, and core broad-market products. */
export function officialNseIndices(): BuilderUniverseItem[] {
  const bySymbol = new Map<string, BuilderUniverseItem>();
  const add = (item: BuilderUniverseItem) => {
    if (isBeesSymbol(item.symbol)) return;
    if (!bySymbol.has(item.symbol)) bySymbol.set(item.symbol, item);
  };

  for (const item of SECTOR_BENCHMARK_REGISTRY) {
    add(officialIndex(item.officialName, item.officialName, familyToGroup(item.family), item.ticker));
  }

  add(officialIndex("NIFTY 500", "NIFTY 500", "broad"));
  add(officialIndex("NIFTY NEXT 50", "NIFTY Next 50", "broad"));
  add(officialIndex("NIFTY 100", "NIFTY 100", "broad"));
  add(officialIndex("NIFTY 200", "NIFTY 200", "broad"));
  add(officialIndex("NIFTY MIDCAP 150", "NIFTY Midcap 150", "broad"));
  add(officialIndex("NIFTY SMALLCAP 250", "NIFTY Smallcap 250", "broad"));

  for (const label of Object.values(sectorUniverseLabels)) {
    if (label.startsWith("NSE ·")) continue;
    if (label.includes("NIFTY 500 ·")) continue;
    const thematic = /Consumption|Infrastructure/i.test(label);
    add(officialIndex(label, label, thematic ? "thematic" : "industry"));
  }

  return [...bySymbol.values()];
}

export function nifty500Equities(): BuilderUniverseItem[] {
  return bundledNifty500Cache().equities.flatMap((row) => {
    const symbol = row.symbol.trim().toUpperCase();
    const name = row.name.trim();
    if (!symbol || !name || isBeesSymbol(symbol)) return [];
    return [{ symbol, name, group: "equity" as const, yahooTicker: `${symbol}.NS` }];
  });
}

const nifty500NameIndex = new Map(
  bundledNifty500Cache().equities.map((row) => [row.symbol.trim().toUpperCase(), row.name.trim()] as const),
);

export function nifty500Name(symbol: string): string | undefined {
  const name = nifty500NameIndex.get(symbol.trim().toUpperCase());
  return name || undefined;
}

export function formatTickerName(symbol: string, name?: string): string {
  const ticker = symbol.trim().toUpperCase();
  const company = (name ?? nifty500Name(ticker) ?? "").trim();
  if (!ticker) return "";
  if (!company || company.toUpperCase() === ticker) return ticker;
  return `${ticker} · ${company}`;
}

export function builderUniverse(): BuilderUniverseItem[] {
  return [...officialNseIndices(), ...nifty500Equities()];
}
