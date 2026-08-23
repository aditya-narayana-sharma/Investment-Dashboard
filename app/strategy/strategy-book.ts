import { BACKTEST_DEFAULTS } from "./backtest-request";
import {
  kpisFromEquityCurve,
  type BacktestCurvePoint,
  type TreeBacktestResult,
} from "./tree-backtest";

export const STRATEGY_BOOK_PLACES_ORDERS = false as const;

export type StrategyBookLegInput = {
  id: string;
  name?: string;
  weight: number;
  result: TreeBacktestResult;
};

export type StrategyBookLegSummary = {
  id: string;
  name: string;
  weight: number;
  ran: boolean;
};

export type StrategyBookResult = {
  status: "ran" | "unavailable";
  ran: boolean;
  placesOrders: false;
  message: string;
  warnings: string[];
  missingIds: string[];
  curve: BacktestCurvePoint[];
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  initialCash: number;
  endingEquity: number | null;
  legs: StrategyBookLegSummary[];
};

function blankBook(
  message: string,
  legs: StrategyBookLegSummary[],
  missingIds: string[],
  warnings: string[] = [],
  initialCash = BACKTEST_DEFAULTS.initialCash,
): StrategyBookResult {
  return {
    status: "unavailable",
    ran: false,
    placesOrders: STRATEGY_BOOK_PLACES_ORDERS,
    message,
    warnings,
    missingIds,
    curve: [],
    totalReturnPct: null,
    annualizedReturnPct: null,
    sharpe: null,
    maxDrawdownPct: null,
    initialCash,
    endingEquity: null,
    legs,
  };
}

/** Treat values > 1 as percents (60/40) and values in (0, 1] as fractions. */
export function normalizeBookWeight(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1 ? value / 100 : value;
}

function pointOnOrBefore(curve: readonly BacktestCurvePoint[], date: string): BacktestCurvePoint | null {
  let found: BacktestCurvePoint | null = null;
  for (const point of curve) {
    if (point.date > date) break;
    found = point;
  }
  return found;
}

/** Combine independently run tree curves into one book equity. Missing legs stay unnamed — no invented KPIs. */
export function combineStrategyBook(
  legs: readonly StrategyBookLegInput[],
  initialCash = BACKTEST_DEFAULTS.initialCash,
): StrategyBookResult {
  const summaries: StrategyBookLegSummary[] = legs.map((leg) => ({
    id: leg.id,
    name: leg.name ?? leg.id,
    weight: normalizeBookWeight(leg.weight),
    ran: leg.result.ran === true && leg.result.curve.length >= 2,
  }));
  const missingIds = summaries.filter((leg) => !leg.ran).map((leg) => leg.id);
  if (!legs.length) {
    return blankBook("Unavailable: book has no trees.", summaries, missingIds);
  }
  const weightSum = summaries.reduce((sum, leg) => sum + leg.weight, 0);
  if (!(weightSum > 0)) {
    return blankBook("Unavailable: book weights must be positive.", summaries, missingIds);
  }
  if (missingIds.length) {
    return blankBook(
      `Unavailable: ${missingIds.join(", ")} did not run.`,
      summaries,
      missingIds,
      legs.flatMap((leg) => leg.result.warnings),
    );
  }

  const dateSets = legs.map((leg) => new Set(leg.result.curve.map((point) => point.date)));
  const first = dateSets[0];
  if (!first) return blankBook("Unavailable: no overlapping equity dates.", summaries, missingIds);
  const dates = [...first].filter((date) => dateSets.every((set) => set.has(date))).sort();
  if (dates.length < 2) {
    return blankBook("Unavailable: no overlapping equity dates.", summaries, missingIds);
  }

  const curve: BacktestCurvePoint[] = [];
  for (const date of dates) {
    let equity = 0;
    let benchmark: number | undefined;
    let benchWeight = 0;
    for (const leg of legs) {
      const point = pointOnOrBefore(leg.result.curve, date);
      if (!point) {
        return blankBook(`Unavailable: ${leg.id} has no equity on ${date}.`, summaries, [leg.id]);
      }
      const cash = leg.result.initialCash || initialCash;
      const fraction = normalizeBookWeight(leg.weight) / weightSum;
      equity += (point.equity / cash) * fraction * initialCash;
      if (point.benchmark !== undefined) {
        benchmark = (benchmark ?? 0) + (point.benchmark / cash) * fraction * initialCash;
        benchWeight += fraction;
      }
    }
    const row: BacktestCurvePoint = { date, equity };
    if (benchmark !== undefined && benchWeight > 0) row.benchmark = benchmark;
    curve.push(row);
  }

  const stats = kpisFromEquityCurve(curve, initialCash);
  return {
    status: "ran",
    ran: true,
    placesOrders: STRATEGY_BOOK_PLACES_ORDERS,
    message: "Book combined from independently run trees. Stratji does not place unattended orders.",
    warnings: [...new Set(legs.flatMap((leg) => leg.result.warnings))],
    missingIds: [],
    curve,
    totalReturnPct: stats.totalReturnPct,
    annualizedReturnPct: stats.annualizedReturnPct,
    sharpe: stats.sharpe,
    maxDrawdownPct: stats.maxDrawdownPct,
    initialCash,
    endingEquity: stats.endingEquity,
    legs: summaries,
  };
}
