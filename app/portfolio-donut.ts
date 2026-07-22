import type { AllocationSlice, LiveHolding } from "./live-types";

const MARKET_CAP_RANK: Record<string, number> = {
  "Large cap": 1,
  "Mid cap": 2,
  "Small cap": 3,
};

export type DonutHolding = Pick<LiveHolding, "marketCap" | "sector" | "subSector" | "donutOrder" | "symbol" | "value" | "color">;

/** Canonical sunburst order: market cap → sector → sub-sector → donutOrder → symbol. */
export function compareDonutHoldings(a: DonutHolding, b: DonutHolding) {
  const rankA = MARKET_CAP_RANK[a.marketCap] ?? 98;
  const rankB = MARKET_CAP_RANK[b.marketCap] ?? 98;
  if (rankA !== rankB) return rankA - rankB;
  const sector = a.sector.localeCompare(b.sector);
  if (sector) return sector;
  const subSector = a.subSector.localeCompare(b.subSector);
  if (subSector) return subSector;
  const order = (a.donutOrder ?? 999) - (b.donutOrder ?? 999);
  if (order) return order;
  return a.symbol.localeCompare(b.symbol);
}

export function sortDonutHoldings<T extends DonutHolding>(holdings: T[]) {
  return holdings.slice().sort(compareDonutHoldings);
}

/**
 * Build nested-donut ring slices by run-length encoding the sorted holdings.
 * Same label under different parents (e.g. Power Generation in Large and Mid)
 * becomes separate contiguous arcs so rings stay aligned with tickers.
 */
export function buildContiguousAllocations(
  holdings: DonutHolding[],
  key: "marketCap" | "sector" | "subSector",
  colors: Record<string, string>,
): AllocationSlice[] {
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const slices: AllocationSlice[] = [];
  for (const holding of holdings) {
    const name = holding[key];
    const previous = slices[slices.length - 1];
    if (previous && previous.name === name) {
      previous.value += holding.value;
      previous.weight = total ? (previous.value / total) * 100 : 0;
      continue;
    }
    slices.push({
      id: `${key}-${slices.length}-${name}`,
      name,
      value: holding.value,
      weight: total ? (holding.value / total) * 100 : 0,
      color: colors[name] ?? holding.color ?? "#6f8193",
    });
  }
  return slices;
}
