import type { OhlcvBar } from "./tree-indicators";

/**
 * Bollinger Band Expansion and Mean Comparison.
 *
 * Kept separate from `tree-indicators.ts` so the maths is unit-testable against
 * synthetic series with known answers, and so the 700-line indicator switch does
 * not grow another block.
 *
 * Note on units: the pre-existing `bbands_width_20` KPI is *normalised*
 * ((upper - lower) / mid). The operator asked for the **price difference**
 * between the bands at maximum contraction and at breakout, so everything here
 * is an absolute price spread. The two are deliberately not interchangeable.
 */

/** ~3 months of NSE sessions. */
export const THREE_MONTH_SESSIONS = 63;
export const BOLLINGER_PERIOD = 20;
export const BOLLINGER_MULTIPLIER = 2;
/** Within this % of the 3-month minimum width still counts as a squeeze. */
export const SQUEEZE_TOLERANCE_PCT = 5;
/** Sessions used to read the direction of width change. */
const SLOPE_LOOKBACK = 3;

export type BollingerPoint = {
  date: string;
  mid: number;
  upper: number;
  lower: number;
  /** Absolute price spread, upper - lower. */
  width: number;
};

export type BollingerExpansionState = "contracting" | "squeeze" | "expanding";

export type BollingerExpansion = {
  upperMin3m: number | null;
  lowerMax3m: number | null;
  widthMin3m: number | null;
  contractionDate: string | null;
  widthAtContraction: number | null;
  currentWidth: number | null;
  expansionDelta: number | null;
  expansionPct: number | null;
  state: BollingerExpansionState | null;
  /** Only meaningful while expanding; null otherwise. */
  breakoutDirection: "up" | "down" | null;
  reason: string | null;
};

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Population standard deviation, matching the existing bbands computation. */
function stddev(values: readonly number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export function smaSeries(values: readonly number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  if (period <= 0) return values.map(() => null);
  let running = 0;
  for (let index = 0; index < values.length; index += 1) {
    running += values[index]!;
    if (index >= period) running -= values[index - period]!;
    out.push(index >= period - 1 ? running / period : null);
  }
  return out;
}

/** One Bollinger point per bar that has a full period behind it. */
export function bollingerSeries(
  bars: readonly OhlcvBar[],
  period: number = BOLLINGER_PERIOD,
  multiplier: number = BOLLINGER_MULTIPLIER,
): BollingerPoint[] {
  if (bars.length < period || period <= 0) return [];
  const closes = bars.map((bar) => bar.close);
  const points: BollingerPoint[] = [];
  for (let index = period - 1; index < bars.length; index += 1) {
    const window = closes.slice(index - period + 1, index + 1);
    const mid = mean(window);
    const sigma = stddev(window);
    const upper = mid + multiplier * sigma;
    const lower = mid - multiplier * sigma;
    points.push({ date: bars[index]!.date, mid, upper, lower, width: upper - lower });
  }
  return points;
}

/**
 * Upper-band minima, lower-band maxima, the maximum-contraction spread over the
 * trailing window, and how far the bands have expanded since that point.
 */
export function bollingerExpansion(
  bars: readonly OhlcvBar[],
  {
    period = BOLLINGER_PERIOD,
    multiplier = BOLLINGER_MULTIPLIER,
    lookbackSessions = THREE_MONTH_SESSIONS,
    squeezeTolerancePct = SQUEEZE_TOLERANCE_PCT,
  }: {
    period?: number;
    multiplier?: number;
    lookbackSessions?: number;
    squeezeTolerancePct?: number;
  } = {},
): BollingerExpansion {
  const empty: BollingerExpansion = {
    upperMin3m: null,
    lowerMax3m: null,
    widthMin3m: null,
    contractionDate: null,
    widthAtContraction: null,
    currentWidth: null,
    expansionDelta: null,
    expansionPct: null,
    state: null,
    breakoutDirection: null,
    reason: null,
  };

  const series = bollingerSeries(bars, period, multiplier);
  if (!series.length) {
    return { ...empty, reason: `needs at least ${period} bars for Bollinger bands` };
  }

  const window = series.slice(-lookbackSessions);
  const latest = window[window.length - 1]!;

  let upperMin = window[0]!.upper;
  let lowerMax = window[0]!.lower;
  let contraction = window[0]!;
  for (const point of window) {
    if (point.upper < upperMin) upperMin = point.upper;
    if (point.lower > lowerMax) lowerMax = point.lower;
    if (point.width < contraction.width) contraction = point;
  }

  const currentWidth = latest.width;
  const widthAtContraction = contraction.width;
  const expansionDelta = currentWidth - widthAtContraction;
  // A zero contraction width means the bands collapsed entirely (a flat series);
  // a percentage against it is undefined rather than infinite.
  const expansionPct = widthAtContraction > 0 ? (expansionDelta / widthAtContraction) * 100 : null;

  const slopeIndex = window.length > SLOPE_LOOKBACK ? window.length - 1 - SLOPE_LOOKBACK : 0;
  const slope = currentWidth - window[slopeIndex]!.width;

  let state: BollingerExpansionState;
  if (expansionPct !== null && expansionPct <= squeezeTolerancePct) state = "squeeze";
  else if (slope > 0) state = "expanding";
  else state = "contracting";

  return {
    upperMin3m: upperMin,
    lowerMax3m: lowerMax,
    widthMin3m: widthAtContraction,
    contractionDate: contraction.date,
    widthAtContraction,
    currentWidth,
    expansionDelta,
    expansionPct,
    state,
    breakoutDirection: state === "expanding"
      ? (bars[bars.length - 1]!.close >= latest.mid ? "up" : "down")
      : null,
    reason: null,
  };
}

export type MeanCrossState = "bullish" | "bearish";

export type MeanComparison = {
  fast: number | null;
  slow: number | null;
  state: MeanCrossState | null;
  /** (fast - slow) / slow, as a percentage. */
  gapPct: number | null;
  /** Sessions since the relationship last flipped; null when it never has. */
  daysSinceFlip: number | null;
  /** True only on the session the state turned bullish. */
  freshBullishCross: boolean;
  reason: string | null;
};

/**
 * SMA-20 versus SMA-220.
 *
 * `freshBullishCross` is the BUY *candidate* trigger. It is deliberately a
 * candidate and never an order: the Strategies workspace routes it through the
 * existing reviewed order ticket, which requires typed confirmation.
 */
export function meanComparison(
  bars: readonly OhlcvBar[],
  { fastPeriod = 20, slowPeriod = 220 }: { fastPeriod?: number; slowPeriod?: number } = {},
): MeanComparison {
  const empty: MeanComparison = {
    fast: null,
    slow: null,
    state: null,
    gapPct: null,
    daysSinceFlip: null,
    freshBullishCross: false,
    reason: null,
  };
  if (bars.length < slowPeriod) {
    return { ...empty, reason: `needs ${slowPeriod} sessions; have ${bars.length}` };
  }

  const closes = bars.map((bar) => bar.close);
  const fastSeries = smaSeries(closes, fastPeriod);
  const slowSeries = smaSeries(closes, slowPeriod);

  const states: Array<MeanCrossState | null> = closes.map((_, index) => {
    const fast = fastSeries[index];
    const slow = slowSeries[index];
    if (fast === null || slow === null || fast === undefined || slow === undefined) return null;
    return fast > slow ? "bullish" : "bearish";
  });

  const lastIndex = closes.length - 1;
  const fast = fastSeries[lastIndex] ?? null;
  const slow = slowSeries[lastIndex] ?? null;
  const state = states[lastIndex] ?? null;
  if (fast === null || slow === null || state === null) {
    return { ...empty, reason: "insufficient lookback for both means" };
  }

  let daysSinceFlip: number | null = null;
  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const previous = states[index];
    if (previous === null) break;
    if (previous !== state) {
      daysSinceFlip = lastIndex - index;
      break;
    }
  }

  return {
    fast,
    slow,
    state,
    gapPct: slow !== 0 ? ((fast - slow) / slow) * 100 : null,
    daysSinceFlip,
    freshBullishCross: state === "bullish" && daysSinceFlip === 1,
    reason: null,
  };
}
