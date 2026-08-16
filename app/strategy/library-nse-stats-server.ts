import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { COMPOSER_STRATEGIES } from "./composer-strategies";
import {
  bundledLibraryNseStats,
  type LibraryNseStatsCache,
  type LibraryNseStrategyStat,
} from "./library-nse-stats";
import { collectTreeSymbols } from "./tree-instruments";
import { runTreeBacktest } from "./tree-backtest";
import { loadYfinanceStrategyKpis } from "./yfinance-kpis";

const root = process.cwd();
export const LIBRARY_NSE_STATS_ARTIFACT = path.join(root, "artifacts/strategy-library-nse-stats.json");
export const LIBRARY_NSE_STATS_BUNDLE = path.join(root, "app/strategy/library-nse-stats.cache.json");

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function calmar(annualized: number | null, maxDrawdownPct: number | null): number | null {
  if (annualized === null || maxDrawdownPct === null) return null;
  const depth = Math.abs(maxDrawdownPct);
  if (!depth) return null;
  return annualized / depth;
}

function parseCache(raw: string): LibraryNseStatsCache | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    if (row.source !== "yfinance" || row.market !== "NSE") return null;
    if (!row.strategies || typeof row.strategies !== "object") return null;
    return parsed as LibraryNseStatsCache;
  } catch {
    return null;
  }
}

export async function readLibraryNseStatsCache(): Promise<LibraryNseStatsCache> {
  try {
    const raw = await readFile(LIBRARY_NSE_STATS_ARTIFACT, "utf8");
    const parsed = parseCache(raw);
    if (parsed) return parsed;
  } catch {
    // Artifact is optional; fall through to the bundled snapshot.
  }
  return bundledLibraryNseStats();
}

export async function writeLibraryNseStatsCache(cache: LibraryNseStatsCache): Promise<void> {
  const body = `${JSON.stringify(cache, null, 2)}\n`;
  await mkdir(path.dirname(LIBRARY_NSE_STATS_ARTIFACT), { recursive: true });
  await writeFile(LIBRARY_NSE_STATS_ARTIFACT, body, "utf8");
  await writeFile(LIBRARY_NSE_STATS_BUNDLE, body, "utf8");
}

export async function computeLibraryNseStats(): Promise<LibraryNseStatsCache> {
  const symbols = [...new Set(COMPOSER_STRATEGIES.flatMap((card) => collectTreeSymbols(card.tree)).concat("RELIANCE"))];
  let rows: Awaited<ReturnType<typeof loadYfinanceStrategyKpis>> = [];
  let fetchError: string | undefined;
  try {
    rows = await loadYfinanceStrategyKpis(symbols, { ohlcvOnly: true, timeoutMs: 180_000 });
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "yfinance NSE history fetch failed.";
  }

  const bars = Object.fromEntries(rows.map((row) => [row.symbol, row.ohlcv]));
  const asOfDates = rows.map((row) => row.asOf).filter((value): value is string => Boolean(value)).sort();
  const asOf = asOfDates[asOfDates.length - 1] ?? null;
  const strategies: Record<string, LibraryNseStrategyStat> = {};

  for (const card of COMPOSER_STRATEGIES) {
    const result = runTreeBacktest(card.tree, bars);
    if (result.ran) {
      const annualized = finiteOrNull(result.annualizedReturnPct);
      const maxDrawdownPct = finiteOrNull(result.maxDrawdownPct);
      strategies[card.id] = {
        ran: true,
        annualizedReturnPct: annualized,
        cumulativeReturnPct: finiteOrNull(result.totalReturnPct),
        sharpe: finiteOrNull(result.sharpe),
        maxDrawdownPct,
        calmar: calmar(annualized, maxDrawdownPct),
        oosStart: result.curve[0]?.date,
        oosEnd: result.curve[result.curve.length - 1]?.date,
        source: "yfinance",
        market: "NSE",
        message: result.message,
        warnings: result.warnings,
      };
      continue;
    }
    const message = fetchError ? `${result.message} ${fetchError}` : result.message;
    strategies[card.id] = {
      ran: false,
      source: "yfinance",
      market: "NSE",
      message,
      warnings: result.warnings,
      missingSymbols: result.missingSymbols,
    };
  }

  const fetched = rows.some((row) => row.ohlcv.length > 0);
  const ranCount = Object.values(strategies).filter((row) => row.ran).length;
  const message = fetchError
    ? `yfinance NSE fetch failed: ${fetchError}`
    : ranCount
      ? `Tree backtest on yfinance NSE daily history (${ranCount}/${COMPOSER_STRATEGIES.length} ran).`
      : "No library tree produced a ran=true backtest on yfinance NSE history.";

  return {
    source: "yfinance",
    market: "NSE",
    asOf,
    computedAt: new Date().toISOString(),
    fetched,
    message,
    strategies,
  };
}

export async function computeAndCacheLibraryNseStats(): Promise<LibraryNseStatsCache> {
  const cache = await computeLibraryNseStats();
  await writeLibraryNseStatsCache(cache);
  return cache;
}

export async function loadOrComputeLibraryNseStats(force = false): Promise<LibraryNseStatsCache> {
  if (!force) {
    const existing = await readLibraryNseStatsCache();
    const hasRun = Object.values(existing.strategies).some((row) => row.ran);
    if (existing.fetched === true || hasRun) return existing;
  }
  return computeAndCacheLibraryNseStats();
}
