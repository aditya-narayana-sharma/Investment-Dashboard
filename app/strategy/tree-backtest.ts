import type { ComparatorOp } from "../../packages/contracts/src/strategy.ts";
import {
  type StrategyTreeV1,
  type TreeNode,
  type TreeOperand,
} from "../../packages/contracts/src/strategy-tree.ts";
import { BACKTEST_DEFAULTS } from "./backtest-request";
import { collectTreeSymbols } from "./tree-instruments";
import { computeKpisFromOhlcv, type OhlcvBar } from "./tree-indicators";

export type BacktestCurvePoint = {
  date: string;
  equity: number;
  benchmark?: number;
};

export type TreeBacktestResult = {
  status: "ran" | "unavailable";
  ran: boolean;
  message: string;
  warnings: string[];
  missingSymbols: string[];
  curve: BacktestCurvePoint[];
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  initialCash: number;
  endingEquity: number | null;
};

export type TreeBacktestBars = Record<string, OhlcvBar[]>;

function operandNumber(operand: TreeOperand, kpis: Map<string, number | null>): number | null {
  if (operand.type === "number") return Number.isFinite(operand.value) ? operand.value : null;
  const value = kpis.get(`${operand.kpiId}:${operand.symbol.trim().toUpperCase()}`);
  return value === undefined ? null : value;
}

function compareOp(op: ComparatorOp, left: number, right: number): boolean {
  switch (op) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default: {
      const _never: never = op;
      return _never;
    }
  }
}

function kpiMapForDate(barsBySymbol: TreeBacktestBars, date: string): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const [symbol, bars] of Object.entries(barsBySymbol)) {
    const slice = bars.filter((bar) => bar.date <= date);
    if (!slice.length) continue;
    for (const kpi of computeKpisFromOhlcv(slice)) {
      map.set(`${kpi.kpiId}:${symbol}`, kpi.value);
    }
  }
  return map;
}

function closeOn(bars: OhlcvBar[] | undefined, date: string): number | null {
  if (!bars?.length) return null;
  const bar = [...bars].reverse().find((item) => item.date <= date);
  return bar ? bar.close : null;
}

function shouldRebalance(interval: StrategyTreeV1["interval"], date: string, previous: string | null): boolean {
  if (!previous) return true;
  switch (interval) {
    case "day":
    case "1m":
    case "5m":
    case "15m":
    case "30m":
    case "hour":
      return date !== previous;
    case "week": {
      const current = new Date(`${date}T00:00:00Z`);
      const prior = new Date(`${previous}T00:00:00Z`);
      return current.getUTCDay() === 1 || current.getTime() - prior.getTime() >= 7 * 86_400_000;
    }
    case "month":
      return date.slice(0, 7) !== previous.slice(0, 7);
    default: {
      const _never: never = interval;
      return _never;
    }
  }
}

export const DEFAULT_INVERSE_VOL_LOOKBACK = 30;

type AssetWeight = { symbol: string; weight: number };

type CollectCtx = {
  kpis: Map<string, number | null>;
  warnings: string[];
  barsBySymbol: TreeBacktestBars;
  date: string;
};

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const stdev = Math.sqrt(variance);
  return Number.isFinite(stdev) && stdev > 0 ? stdev : null;
}

function alignedCloses(
  symbols: readonly string[],
  barsBySymbol: TreeBacktestBars,
  date: string,
  lookbackDays: number,
): Map<string, number[]> | null {
  if (!symbols.length || lookbackDays < 2) return null;
  const dateSets = symbols.map((symbol) => new Set(
    (barsBySymbol[symbol] ?? []).filter((bar) => bar.date <= date).map((bar) => bar.date),
  ));
  const first = dateSets[0];
  if (!first) return null;
  let common = [...first].filter((item) => dateSets.every((set) => set.has(item))).sort();
  if (common.length < lookbackDays + 1) return null;
  common = common.slice(-(lookbackDays + 1));
  const out = new Map<string, number[]>();
  for (const symbol of symbols) {
    const byDate = new Map((barsBySymbol[symbol] ?? []).map((bar) => [bar.date, bar.close]));
    const closes: number[] = [];
    for (const item of common) {
      const close = byDate.get(item);
      if (close === undefined || !(close > 0) || !Number.isFinite(close)) return null;
      closes.push(close);
    }
    out.set(symbol, closes);
  }
  return out;
}

function sleeveVolatility(nested: readonly AssetWeight[], ctx: CollectCtx, lookbackDays: number): number | null {
  const total = nested.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  const symbols = [...new Set(nested.map((item) => item.symbol))];
  const closes = alignedCloses(symbols, ctx.barsBySymbol, ctx.date, lookbackDays);
  if (!closes) return null;
  const series = closes.get(symbols[0]!);
  if (!series || series.length < 3) return null;
  const returns: number[] = [];
  for (let index = 1; index < series.length; index += 1) {
    let port = 0;
    for (const item of nested) {
      const path = closes.get(item.symbol);
      const previous = path?.[index - 1];
      const current = path?.[index];
      if (previous === undefined || current === undefined || previous <= 0) return null;
      port += (item.weight / total) * (current / previous - 1);
    }
    returns.push(port);
  }
  return sampleStdev(returns);
}

function inverseVolatilityWeights(node: Extract<TreeNode, { kind: "weight" }>, ctx: CollectCtx): AssetWeight[] {
  const lookbackDays = node.params.lookbackDays ?? DEFAULT_INVERSE_VOL_LOOKBACK;
  const label = node.label ?? node.id;
  if (lookbackDays < 2) {
    ctx.warnings.push(`Inverse Volatility on ${label} skipped — lookbackDays must be at least 2.`);
    return [];
  }
  const sleeves: Array<{ nested: AssetWeight[]; vol: number }> = [];
  let missingLookback = false;
  for (const child of node.children) {
    const nested = collectAssets(child.node, ctx);
    if (!nested.length) continue;
    const vol = sleeveVolatility(nested, ctx, lookbackDays);
    if (vol === null) {
      const symbols = [...new Set(nested.map((item) => item.symbol))];
      const historyReady = symbols.every((symbol) => (ctx.barsBySymbol[symbol]?.length ?? 0) >= lookbackDays + 1);
      if (!historyReady) {
        missingLookback = true;
        ctx.warnings.push(
          `Inverse Volatility on ${label} skipped ${symbols.join(", ") || child.node.id} — not enough overlapping lookback bars.`,
        );
      }
      continue;
    }
    sleeves.push({ nested, vol });
  }
  const invSum = sleeves.reduce((sum, sleeve) => sum + 1 / sleeve.vol, 0);
  if (!invSum) {
    if (missingLookback) {
      ctx.warnings.push(`Inverse Volatility on ${label} produced no weights — lookback bars missing.`);
    }
    return [];
  }
  const rows: AssetWeight[] = [];
  for (const sleeve of sleeves) {
    const sleeveWeight = (1 / sleeve.vol) / invSum;
    const nestedTotal = sleeve.nested.reduce((sum, item) => sum + item.weight, 0) || 1;
    for (const item of sleeve.nested) {
      rows.push({ symbol: item.symbol, weight: sleeveWeight * (item.weight / nestedTotal) });
    }
  }
  return rows;
}

function collectAssets(node: TreeNode, ctx: CollectCtx): AssetWeight[] {
  switch (node.kind) {
    case "asset": {
      const symbol = node.params.symbol.trim().toUpperCase();
      return symbol ? [{ symbol, weight: 1 }] : [];
    }
    case "group":
    case "filter":
    case "any_all": {
      const nested = node.children.flatMap((child) => collectAssets(child, ctx));
      const total = nested.reduce((sum, item) => sum + item.weight, 0);
      if (!total) return [];
      return nested.map((item) => ({ symbol: item.symbol, weight: item.weight / total }));
    }
    case "weight": {
      if (node.params.method === "inverse_volatility") {
        return inverseVolatilityWeights(node, ctx);
      }
      const rows: AssetWeight[] = [];
      for (const child of node.children) {
        const percent = child.percent ?? 0;
        const nested = collectAssets(child.node, ctx);
        const nestedWeight = nested.reduce((sum, item) => sum + item.weight, 0) || 1;
        for (const item of nested) {
          rows.push({ symbol: item.symbol, weight: (percent / 100) * (item.weight / nestedWeight) });
        }
      }
      return rows;
    }
    case "if_else": {
      const left = operandNumber(node.params.left, ctx.kpis);
      const right = operandNumber(node.params.right, ctx.kpis);
      if (left === null || right === null) return [];
      const passed = compareOp(node.params.op, left, right);
      return (passed ? node.then : node.else).flatMap((child) => collectAssets(child, ctx));
    }
    default: {
      const _never: never = node;
      return _never;
    }
  }
}

function maxDrawdown(equities: number[]): number | null {
  if (equities.length < 2) return null;
  let peak = equities[0]!;
  let worst = 0;
  for (const equity of equities) {
    if (equity > peak) peak = equity;
    if (peak > 0) worst = Math.min(worst, (equity - peak) / peak);
  }
  return worst * 100;
}

function annualized(totalReturn: number, firstDate: string, lastDate: string): number | null {
  const start = Date.parse(`${firstDate}T00:00:00Z`);
  const end = Date.parse(`${lastDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const years = (end - start) / (365.25 * 86_400_000);
  if (years <= 0) return null;
  return ((1 + totalReturn) ** (1 / years) - 1) * 100;
}

function sharpeFromEquities(equities: number[]): number | null {
  if (equities.length < 3) return null;
  const returns: number[] = [];
  for (let index = 1; index < equities.length; index += 1) {
    const previous = equities[index - 1]!;
    const current = equities[index]!;
    if (previous <= 0 || !Number.isFinite(previous) || !Number.isFinite(current)) continue;
    returns.push(current / previous - 1);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const stdev = Math.sqrt(variance);
  if (!Number.isFinite(stdev) || stdev === 0) return null;
  return (mean / stdev) * Math.sqrt(252);
}

export function kpisFromEquityCurve(curve: BacktestCurvePoint[], initialCash: number): {
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  endingEquity: number | null;
} {
  const ending = curve[curve.length - 1]?.equity ?? null;
  const totalReturn = ending === null || curve.length < 2 ? null : (ending - initialCash) / initialCash;
  const equities = curve.map((point) => point.equity);
  const firstDate = curve[0]?.date;
  const lastDate = curve[curve.length - 1]?.date;
  return {
    totalReturnPct: totalReturn === null ? null : totalReturn * 100,
    annualizedReturnPct: totalReturn === null || !firstDate || !lastDate
      ? null
      : annualized(totalReturn, firstDate, lastDate),
    sharpe: sharpeFromEquities(equities),
    maxDrawdownPct: maxDrawdown(equities),
    endingEquity: ending,
  };
}

/** Walk a tree on provided OHLCV. Missing required series → ran=false, no curve. */
export function runTreeBacktest(tree: StrategyTreeV1, barsBySymbol: TreeBacktestBars): TreeBacktestResult {
  const required = collectTreeSymbols(tree);
  const missingSymbols = required.filter((symbol) => !barsBySymbol[symbol]?.length);
  const warnings: string[] = [];
  if (missingSymbols.length) {
    return {
      status: "unavailable",
      ran: false,
      message: `Unavailable: missing OHLCV for ${missingSymbols.join(", ")}.`,
      warnings,
      missingSymbols,
      curve: [],
      totalReturnPct: null,
      annualizedReturnPct: null,
      sharpe: null,
      maxDrawdownPct: null,
      initialCash: BACKTEST_DEFAULTS.initialCash,
      endingEquity: null,
    };
  }

  const dateSet = new Set<string>();
  for (const symbol of required) {
    for (const bar of barsBySymbol[symbol] ?? []) dateSet.add(bar.date);
  }
  const dates = [...dateSet].sort();
  if (dates.length < 2) {
    return {
      status: "unavailable",
      ran: false,
      message: "Unavailable: not enough overlapping bars to run.",
      warnings,
      missingSymbols,
      curve: [],
      totalReturnPct: null,
      annualizedReturnPct: null,
      sharpe: null,
      maxDrawdownPct: null,
      initialCash: BACKTEST_DEFAULTS.initialCash,
      endingEquity: null,
    };
  }

  const initialCash = BACKTEST_DEFAULTS.initialCash;
  const costBps = BACKTEST_DEFAULTS.slippageBps + 3;
  let cash = initialCash;
  const positions = new Map<string, number>();
  let lastRebalance: string | null = null;
  const curve: BacktestCurvePoint[] = [];
  const benchmarkBars = barsBySymbol.RELIANCE ?? [];
  const benchStart = closeOn(benchmarkBars, dates[0]!);

  for (const date of dates) {
    if (shouldRebalance(tree.interval, date, lastRebalance)) {
      const kpis = kpiMapForDate(barsBySymbol, date);
      const targets = tree.children.flatMap((node) => collectAssets(node, { kpis, warnings, barsBySymbol, date }));
      const equityBefore = markEquity(cash, positions, barsBySymbol, date);
      const desired = new Map<string, number>();
      for (const row of targets) {
        desired.set(row.symbol, (desired.get(row.symbol) ?? 0) + row.weight);
      }
      const nextPositions = new Map<string, number>();
      let spent = 0;
      for (const [symbol, weight] of desired) {
        const price = closeOn(barsBySymbol[symbol], date);
        if (price === null || price <= 0 || weight <= 0) continue;
        const notional = equityBefore * weight;
        const shares = notional / price;
        const tradeCost = Math.abs(notional) * (costBps / 10_000);
        spent += notional + tradeCost;
        nextPositions.set(symbol, shares);
      }
      cash = Math.max(0, equityBefore - spent);
      positions.clear();
      for (const [symbol, shares] of nextPositions) positions.set(symbol, shares);
      lastRebalance = date;
    }

    const equity = markEquity(cash, positions, barsBySymbol, date);
    const bench = closeOn(benchmarkBars, date);
    const point: BacktestCurvePoint = { date, equity };
    if (bench !== null && benchStart) point.benchmark = initialCash * (bench / benchStart);
    curve.push(point);
  }

  const ending = curve[curve.length - 1]?.equity ?? null;
  const stats = kpisFromEquityCurve(curve, initialCash);
  return {
    status: "ran",
    ran: true,
    message: "Backtest ran on historical OHLCV.",
    warnings: [...new Set(warnings)],
    missingSymbols: [],
    curve,
    totalReturnPct: stats.totalReturnPct,
    annualizedReturnPct: stats.annualizedReturnPct,
    sharpe: stats.sharpe,
    maxDrawdownPct: stats.maxDrawdownPct,
    initialCash,
    endingEquity: stats.endingEquity ?? ending,
  };
}

function markEquity(
  cash: number,
  positions: Map<string, number>,
  barsBySymbol: TreeBacktestBars,
  date: string,
): number {
  let equity = cash;
  for (const [symbol, shares] of positions) {
    const price = closeOn(barsBySymbol[symbol], date);
    if (price !== null) equity += shares * price;
  }
  return equity;
}
