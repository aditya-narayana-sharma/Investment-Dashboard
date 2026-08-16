import type { ComposerPublishedStats, ComposerStrategyCard } from "./composer-strategies";
import bundledCache from "./library-nse-stats.cache.json" with { type: "json" };

export const LIBRARY_NSE_STATS_SOURCE = "yfinance" as const;
export const LIBRARY_NSE_STATS_MARKET = "NSE" as const;

export type LibraryNseStrategyStat = {
  ran: boolean;
  annualizedReturnPct?: number | null;
  cumulativeReturnPct?: number | null;
  sharpe?: number | null;
  maxDrawdownPct?: number | null;
  calmar?: number | null;
  oosStart?: string;
  oosEnd?: string;
  source: "yfinance";
  market: "NSE";
  message: string;
  warnings?: string[];
  missingSymbols?: string[];
};

export type LibraryNseStatsCache = {
  source: "yfinance";
  market: "NSE";
  asOf: string | null;
  computedAt: string | null;
  fetched?: boolean;
  message: string;
  strategies: Record<string, LibraryNseStrategyStat>;
};

export const EMPTY_LIBRARY_NSE_STATS: LibraryNseStatsCache = {
  source: LIBRARY_NSE_STATS_SOURCE,
  market: LIBRARY_NSE_STATS_MARKET,
  asOf: null,
  computedAt: null,
  fetched: false,
  message: "Library NSE backtests have not been run yet.",
  strategies: {},
};

function isCache(value: unknown): value is LibraryNseStatsCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.source === "yfinance" && row.market === "NSE" && row.strategies !== null && typeof row.strategies === "object";
}

export function bundledLibraryNseStats(): LibraryNseStatsCache {
  return isCache(bundledCache) ? bundledCache : EMPTY_LIBRARY_NSE_STATS;
}

export function libraryNseStatsHaveRuns(cache: LibraryNseStatsCache | null | undefined): boolean {
  if (!cache) return false;
  return Object.values(cache.strategies).some((row) => row.ran);
}

function finiteOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function applyLibraryNseStats(
  cards: readonly ComposerStrategyCard[],
  cache: LibraryNseStatsCache | null | undefined,
): ComposerStrategyCard[] {
  if (!cache) return cards.map((card) => ({ ...card, stats: { ...card.stats } }));
  return cards.map((card) => {
    const row = cache.strategies[card.id];
    if (!row) return { ...card, stats: { ...card.stats } };
    if (!row.ran) {
      const stats: ComposerPublishedStats = {
        ...card.stats,
        source: "yfinance",
        asOf: cache.asOf ?? undefined,
        unavailableReason: row.message,
      };
      delete stats.annualizedReturnPct;
      delete stats.cumulativeReturnPct;
      delete stats.sharpe;
      delete stats.maxDrawdownPct;
      delete stats.calmar;
      delete stats.oosStart;
      return { ...card, stats };
    }
    const stats: ComposerPublishedStats = {
      ...card.stats,
      source: "yfinance",
      asOf: row.oosEnd ?? cache.asOf ?? undefined,
      oosStart: row.oosStart,
      annualizedReturnPct: finiteOrUndefined(row.annualizedReturnPct),
      cumulativeReturnPct: finiteOrUndefined(row.cumulativeReturnPct),
      sharpe: finiteOrUndefined(row.sharpe),
      maxDrawdownPct: finiteOrUndefined(row.maxDrawdownPct),
      calmar: finiteOrUndefined(row.calmar),
    };
    delete stats.unavailableReason;
    return { ...card, stats };
  });
}
