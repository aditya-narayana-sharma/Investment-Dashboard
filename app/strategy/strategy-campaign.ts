import { collectTreeSymbols } from "./tree-instruments";
import {
  kpisFromEquityCurve,
  runTreeBacktest,
  type BacktestCurvePoint,
  type TreeBacktestBars,
  type TreeBacktestResult,
} from "./tree-backtest";
import type { ResolvedLibraryTree } from "./library-resolve";

export const STRATEGY_CAMPAIGN_PLACES_ORDERS = false as const;

export type CampaignWindow = {
  from?: string | null;
  to?: string | null;
  walkForward?: boolean;
};

export type CampaignRow = {
  id: string;
  name: string;
  ran: boolean;
  message: string;
  missingSymbols: string[];
  warnings: string[];
  curve: BacktestCurvePoint[];
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  endingEquity: number | null;
  oosFrom: string | null;
  oosTotalReturnPct: number | null;
  oosAnnualizedReturnPct: number | null;
  oosSharpe: number | null;
  oosMaxDrawdownPct: number | null;
};

function nullKpis() {
  return {
    totalReturnPct: null,
    annualizedReturnPct: null,
    sharpe: null,
    maxDrawdownPct: null,
    endingEquity: null,
    oosFrom: null as string | null,
    oosTotalReturnPct: null,
    oosAnnualizedReturnPct: null,
    oosSharpe: null,
    oosMaxDrawdownPct: null,
  };
}

export function sliceBarsToWindow(
  barsBySymbol: TreeBacktestBars,
  from?: string | null,
  to?: string | null,
): TreeBacktestBars {
  if (!from && !to) return barsBySymbol;
  const sliced: TreeBacktestBars = {};
  for (const [symbol, bars] of Object.entries(barsBySymbol)) {
    sliced[symbol] = bars.filter((bar) => {
      if (from && bar.date < from) return false;
      if (to && bar.date > to) return false;
      return true;
    });
  }
  return sliced;
}

export function walkForwardStart(dates: readonly string[]): string | null {
  if (dates.length < 4) return null;
  return dates[Math.floor(dates.length / 2)] ?? null;
}

export function oosKpisFromCurve(
  curve: readonly BacktestCurvePoint[],
  initialCash: number,
  oosFrom: string | null,
): {
  oosFrom: string | null;
  oosTotalReturnPct: number | null;
  oosAnnualizedReturnPct: number | null;
  oosSharpe: number | null;
  oosMaxDrawdownPct: number | null;
} {
  if (!oosFrom) {
    return {
      oosFrom: null,
      oosTotalReturnPct: null,
      oosAnnualizedReturnPct: null,
      oosSharpe: null,
      oosMaxDrawdownPct: null,
    };
  }
  const slice = curve.filter((point) => point.date >= oosFrom);
  if (slice.length < 2) {
    return {
      oosFrom,
      oosTotalReturnPct: null,
      oosAnnualizedReturnPct: null,
      oosSharpe: null,
      oosMaxDrawdownPct: null,
    };
  }
  const startEquity = slice[0]?.equity;
  const stats = kpisFromEquityCurve(slice, typeof startEquity === "number" ? startEquity : initialCash);
  return {
    oosFrom,
    oosTotalReturnPct: stats.totalReturnPct,
    oosAnnualizedReturnPct: stats.annualizedReturnPct,
    oosSharpe: stats.sharpe,
    oosMaxDrawdownPct: stats.maxDrawdownPct,
  };
}

function rowFromResult(
  tree: ResolvedLibraryTree,
  result: TreeBacktestResult,
  oosFrom: string | null,
): CampaignRow {
  if (!result.ran) {
    return {
      id: tree.id,
      name: tree.name,
      ran: false,
      message: result.message,
      missingSymbols: result.missingSymbols,
      warnings: result.warnings,
      curve: [],
      ...nullKpis(),
    };
  }
  return {
    id: tree.id,
    name: tree.name,
    ran: true,
    message: result.message,
    missingSymbols: result.missingSymbols,
    warnings: result.warnings,
    curve: result.curve,
    totalReturnPct: result.totalReturnPct,
    annualizedReturnPct: result.annualizedReturnPct,
    sharpe: result.sharpe,
    maxDrawdownPct: result.maxDrawdownPct,
    endingEquity: result.endingEquity,
    ...oosKpisFromCurve(result.curve, result.initialCash, oosFrom),
  };
}

export function campaignDatesFromBars(barsBySymbol: TreeBacktestBars): string[] {
  const dates = new Set<string>();
  for (const bars of Object.values(barsBySymbol)) {
    for (const bar of bars) dates.add(bar.date);
  }
  return [...dates].sort();
}

export function collectCampaignSymbols(trees: readonly ResolvedLibraryTree[]): string[] {
  return [...new Set(trees.flatMap((row) => collectTreeSymbols(row.tree)).concat("RELIANCE"))];
}

export function runCampaignTrees(
  trees: readonly ResolvedLibraryTree[],
  barsBySymbol: TreeBacktestBars,
  window: CampaignWindow = {},
): CampaignRow[] {
  const sliced = sliceBarsToWindow(barsBySymbol, window.from, window.to);
  const dates = campaignDatesFromBars(sliced);
  const oosFrom = window.walkForward ? walkForwardStart(dates) : null;
  return trees.map((tree) => rowFromResult(tree, runTreeBacktest(tree.tree, sliced), oosFrom));
}

export function missingCampaignRow(id: string): CampaignRow {
  return {
    id,
    name: id,
    ran: false,
    message: `Unavailable: library id ${id} was not found.`,
    missingSymbols: [],
    warnings: [],
    curve: [],
    ...nullKpis(),
  };
}
