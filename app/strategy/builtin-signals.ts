import type { OhlcvBar } from "./tree-indicators";
import {
  bollingerExpansion,
  meanComparison,
  type BollingerExpansion,
  type MeanComparison,
} from "./expansion-indicators";

/**
 * Built-in strategy signals: Bollinger Band Expansion and Mean Comparison.
 *
 * A signal is a **candidate**, never an order. Nothing in this module can place,
 * stage or modify a Kite order. The Strategies workspace shows candidates, the
 * allocation planner sizes them, and the existing `KiteOrderTicket` typed
 * confirmation remains the only path to a broker.
 *
 * Bars come from the existing `loadYfinanceStrategyKpis` loader, which requests
 * `period="2y"` (~500 sessions) -- comfortably above the 220 sessions SMA-220
 * needs plus a 3-month band lookback. When a symbol has less history the signal
 * reports `eligible: false` with a stated reason; it never infers a value.
 */

export const MIN_SESSIONS_FOR_MEAN_COMPARISON = 220;

export type StrategySignalId = "bollinger_expansion" | "mean_comparison";

export type SignalAction = "buy_candidate" | "watch" | "none";

export type StrategySignal = {
  strategy: StrategySignalId;
  symbol: string;
  eligible: boolean;
  action: SignalAction;
  /** Human-readable state for the signals table. Never a number in disguise. */
  state: string;
  /** Ordered display metrics; `value: null` renders blank, never inferred. */
  metrics: Array<{ label: string; value: number | null; unit?: string }>;
  asOf: string | null;
  source: "yfinance" | "kite";
  reason: string | null;
};

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function lastDate(bars: readonly OhlcvBar[]): string | null {
  return bars.length ? bars[bars.length - 1]!.date || null : null;
}

export function bollingerExpansionSignal(
  symbol: string,
  bars: readonly OhlcvBar[],
  source: StrategySignal["source"] = "yfinance",
  expansion: BollingerExpansion = bollingerExpansion(bars),
): StrategySignal {
  const base = {
    strategy: "bollinger_expansion" as const,
    symbol,
    asOf: lastDate(bars),
    source,
  };

  if (expansion.state === null) {
    return {
      ...base,
      eligible: false,
      action: "none",
      state: "Unavailable",
      metrics: [],
      reason: expansion.reason ?? "insufficient history",
    };
  }

  const metrics = [
    { label: "Upper band minima (3M)", value: round(expansion.upperMin3m) },
    { label: "Lower band maxima (3M)", value: round(expansion.lowerMax3m) },
    { label: "Spread at max contraction", value: round(expansion.widthAtContraction) },
    { label: "Current spread", value: round(expansion.currentWidth) },
    { label: "Expansion delta", value: round(expansion.expansionDelta) },
    { label: "Expansion", value: round(expansion.expansionPct), unit: "%" },
  ];

  // A breakout is only actionable upward: an expanding band with the close below
  // the mid is a downside break, which this strategy watches rather than buys.
  const action: SignalAction = expansion.state === "expanding" && expansion.breakoutDirection === "up"
    ? "buy_candidate"
    : expansion.state === "squeeze"
      ? "watch"
      : "none";

  const state = expansion.state === "expanding"
    ? `Expanding (${expansion.breakoutDirection === "up" ? "upside" : "downside"} break)`
    : expansion.state === "squeeze"
      ? "Squeeze"
      : "Contracting";

  return { ...base, eligible: true, action, state, metrics, reason: null };
}

export function meanComparisonSignal(
  symbol: string,
  bars: readonly OhlcvBar[],
  source: StrategySignal["source"] = "yfinance",
  cross: MeanComparison = meanComparison(bars),
): StrategySignal {
  const base = {
    strategy: "mean_comparison" as const,
    symbol,
    asOf: lastDate(bars),
    source,
  };

  if (cross.state === null) {
    return {
      ...base,
      eligible: false,
      action: "none",
      state: "Unavailable",
      metrics: [],
      reason: cross.reason ?? `needs ${MIN_SESSIONS_FOR_MEAN_COMPARISON} sessions`,
    };
  }

  const metrics = [
    { label: "SMA 20", value: round(cross.fast) },
    { label: "SMA 220", value: round(cross.slow) },
    { label: "Gap", value: round(cross.gapPct), unit: "%" },
    { label: "Sessions since flip", value: cross.daysSinceFlip },
  ];

  // The operator's rule is "if SMA 20 > SMA 220, BUY". A fresh cross is the
  // strongest form of that; an already-bullish stack stays a candidate too, but
  // the state text distinguishes them so the reviewer can tell.
  const action: SignalAction = cross.state === "bullish" ? "buy_candidate" : "none";
  const state = cross.freshBullishCross
    ? "Fresh bullish cross"
    : cross.state === "bullish"
      ? "Bullish (SMA 20 > SMA 220)"
      : "Bearish (SMA 20 < SMA 220)";

  return { ...base, eligible: true, action, state, metrics, reason: null };
}

export function buildStrategySignals(
  symbol: string,
  bars: readonly OhlcvBar[],
  source: StrategySignal["source"] = "yfinance",
): StrategySignal[] {
  return [
    bollingerExpansionSignal(symbol, bars, source),
    meanComparisonSignal(symbol, bars, source),
  ];
}

/** Only eligible buy candidates may reach the allocation planner. */
export function buyCandidates(signals: readonly StrategySignal[]): StrategySignal[] {
  return signals.filter((signal) => signal.eligible && signal.action === "buy_candidate");
}
