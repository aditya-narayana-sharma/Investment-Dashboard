import type { ComparatorOp } from "../../packages/contracts/src/strategy.ts";
import {
  walkTreeNodes,
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

function collectAssets(node: TreeNode, kpis: Map<string, number | null>, warnings: string[]): Array<{ symbol: string; weight: number }> {
  switch (node.kind) {
    case "asset": {
      const symbol = node.params.symbol.trim().toUpperCase();
      return symbol ? [{ symbol, weight: 1 }] : [];
    }
    case "group":
    case "filter":
    case "any_all":
      return node.children.flatMap((child) => collectAssets(child, kpis, warnings));
    case "weight": {
      if (node.params.method === "inverse_volatility") {
        warnings.push(`Inverse Volatility on ${node.label ?? node.id} is stored but not executable — sleeve skipped.`);
        return [];
      }
      const rows: Array<{ symbol: string; weight: number }> = [];
      for (const child of node.children) {
        const percent = child.percent ?? 0;
        const nested = collectAssets(child.node, kpis, warnings);
        const nestedWeight = nested.reduce((sum, item) => sum + item.weight, 0) || 1;
        for (const item of nested) {
          rows.push({ symbol: item.symbol, weight: (percent / 100) * (item.weight / nestedWeight) });
        }
      }
      return rows;
    }
    case "if_else": {
      const left = operandNumber(node.params.left, kpis);
      const right = operandNumber(node.params.right, kpis);
      if (left === null || right === null) return [];
      const passed = compareOp(node.params.op, left, right);
      return (passed ? node.then : node.else).flatMap((child) => collectAssets(child, kpis, warnings));
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

/** Walk a tree on provided OHLCV. Missing required series → ran=false, no curve. */
export function runTreeBacktest(tree: StrategyTreeV1, barsBySymbol: TreeBacktestBars): TreeBacktestResult {
  const required = collectTreeSymbols(tree).filter((symbol) => {
    let needed = false;
    walkTreeNodes(tree.children, (node) => {
      if (node.kind === "asset" && node.params.symbol.trim().toUpperCase() === symbol) needed = true;
    });
    return needed;
  });
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
  const benchmarkBars = barsBySymbol.NIFTYBEES ?? [];
  const benchStart = closeOn(benchmarkBars, dates[0]!);

  for (const date of dates) {
    if (shouldRebalance(tree.interval, date, lastRebalance)) {
      const kpis = kpiMapForDate(barsBySymbol, date);
      const targets = tree.children.flatMap((node) => collectAssets(node, kpis, warnings));
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
  const totalReturn = ending === null ? null : (ending - initialCash) / initialCash;
  return {
    status: "ran",
    ran: true,
    message: "Backtest ran on historical OHLCV.",
    warnings: [...new Set(warnings)],
    missingSymbols: [],
    curve,
    totalReturnPct: totalReturn === null ? null : totalReturn * 100,
    annualizedReturnPct: totalReturn === null ? null : annualized(totalReturn, dates[0]!, dates[dates.length - 1]!),
    maxDrawdownPct: maxDrawdown(curve.map((point) => point.equity)),
    initialCash,
    endingEquity: ending,
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
