import {
  filterSymbolsByAssetClasses,
  graphUniverseAssetClasses,
  instrumentFilterFromAssetClasses,
  selectedInstrumentTypes,
  type InstrumentFilter,
  type InstrumentType,
} from "./asset-classes";
import type { CandleInterval, StrategyGraphV2 } from "./graph-types";

export const BACKTEST_DEFAULTS = {
  initialCash: 100_000,
  slippageBps: 5,
  costPreset: "zerodha_equity_v1",
  benchmark: "RELIANCE",
} as const;

export type BacktestCostPreset = typeof BACKTEST_DEFAULTS.costPreset;
export type BacktestBenchmark = typeof BACKTEST_DEFAULTS.benchmark;

export type BacktestRequest = {
  strategyId: string;
  strategyName: string;
  graph: StrategyGraphV2;
  initialCash: typeof BACKTEST_DEFAULTS.initialCash;
  slippageBps: typeof BACKTEST_DEFAULTS.slippageBps;
  costPreset: BacktestCostPreset;
  benchmark: BacktestBenchmark;
  interval: CandleInterval;
  assetClasses: string[];
  instrumentTypes: InstrumentType[];
  instrumentFilter: InstrumentFilter;
};

export function universeAssetClasses(graph: StrategyGraphV2): string[] {
  return graphUniverseAssetClasses(graph);
}

/** Apply the graph's universe asset-class filter (EQ|ETF + optional cash sleeve). */
export function filterBacktestSymbols(graph: StrategyGraphV2, symbols: readonly string[]): string[] {
  return filterSymbolsByAssetClasses(symbols, universeAssetClasses(graph));
}

/** Graph → BacktestRequest. Does not run a backtest. */
export function buildBacktestRequest(graph: StrategyGraphV2): BacktestRequest {
  const assetClasses = universeAssetClasses(graph);
  return {
    strategyId: graph.id,
    strategyName: graph.name,
    graph,
    initialCash: BACKTEST_DEFAULTS.initialCash,
    slippageBps: BACKTEST_DEFAULTS.slippageBps,
    costPreset: BACKTEST_DEFAULTS.costPreset,
    benchmark: BACKTEST_DEFAULTS.benchmark,
    interval: graph.interval,
    assetClasses,
    instrumentTypes: selectedInstrumentTypes(assetClasses),
    instrumentFilter: instrumentFilterFromAssetClasses(assetClasses),
  };
}
