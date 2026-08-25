import kpiRegistry from "../../packages/kpi-registry/definitions/kpis.json" with { type: "json" };
import type { YfinanceFundamentals } from "./yfinance-kpis";
import { bollingerExpansion, meanComparison } from "./expansion-indicators";

const kpiDefinitions = kpiRegistry.kpis as Array<{ id: string; label: string; bucket: string }>;

export type OhlcvBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ComputedKpi = {
  kpiId: string;
  value: number | null;
  label?: string;
  reason?: string;
  source?: "computed" | "yfinance";
};

export type UniverseMember = {
  symbol: string;
  bars: readonly OhlcvBar[];
};

export type RegistryKpiExtras = {
  fundamentals?: YfinanceFundamentals;
  benchmark?: readonly OhlcvBar[];
  universe?: readonly UniverseMember[];
};

const LOOKBACK = "insufficient lookback";
const NO_BARS = "no OHLCV bars";
const NO_FUND = "yfinance .info field missing";
const NO_BENCH = "needs RELIANCE benchmark history";
const NO_UNIVERSE = "needs universe";

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((sum, value) => sum + value, 0) / period;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const out = [current];
  for (const value of values.slice(period)) {
    current = value * k + current * (1 - k);
    out.push(current);
  }
  return out;
}

function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1]! : null;
}

function wma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const window = values.slice(-period);
  let weighted = 0;
  let denom = 0;
  for (let index = 0; index < window.length; index += 1) {
    const weight = index + 1;
    weighted += window[index]! * weight;
    denom += weight;
  }
  return denom ? weighted / denom : null;
}

function vwma(bars: readonly OhlcvBar[], period: number): number | null {
  if (bars.length < period) return null;
  const window = bars.slice(-period);
  let weighted = 0;
  let volume = 0;
  for (const bar of window) {
    weighted += bar.close * bar.volume;
    volume += bar.volume;
  }
  return volume ? weighted / volume : null;
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function trueRanges(bars: readonly OhlcvBar[]): number[] {
  return bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    const previous = bars[index - 1]!;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close));
  });
}

function wilder(values: number[], period: number): number[] {
  if (values.length < period) return [];
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const out = [current];
  for (const value of values.slice(period)) {
    current = (current * (period - 1) + value) / period;
    out.push(current);
  }
  return out;
}

function last(values: number[]): number | null {
  return values.length ? values[values.length - 1]! : null;
}

function returns(closes: number[]): number[] {
  const out: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1]!;
    if (previous === 0) continue;
    out.push((closes[index]! - previous) / previous);
  }
  return out;
}

function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1]!;
    if (previous <= 0 || closes[index]! <= 0) continue;
    out.push(Math.log(closes[index]! / previous));
  }
  return out;
}

function rsi(values: number[], period: number): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function macdLine(closes: number[]): { macd: number; signal: number; hist: number } | null {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  if (fast === null || slow === null) return null;
  const macdSeries: number[] = [];
  for (let end = 26; end <= closes.length; end += 1) {
    const slice = closes.slice(0, end);
    const a = ema(slice, 12);
    const b = ema(slice, 26);
    if (a !== null && b !== null) macdSeries.push(a - b);
  }
  if (macdSeries.length < 9) return null;
  const signal = ema(macdSeries, 9);
  if (signal === null) return null;
  const macd = macdSeries[macdSeries.length - 1]!;
  return { macd, signal, hist: macd - signal };
}

function highest(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return Math.max(...values.slice(-period));
}

function lowest(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return Math.min(...values.slice(-period));
}

function percentileRank(values: number[], current: number): number | null {
  if (values.length < 2) return null;
  const below = values.filter((value) => value <= current).length;
  return (below / values.length) * 100;
}

function alignCloses(left: readonly OhlcvBar[], right: readonly OhlcvBar[]): { left: number[]; right: number[] } {
  const map = new Map(right.map((bar) => [bar.date, bar.close]));
  const pairedLeft: number[] = [];
  const pairedRight: number[] = [];
  for (const bar of left) {
    const other = map.get(bar.date);
    if (other === undefined) continue;
    pairedLeft.push(bar.close);
    pairedRight.push(other);
  }
  return { left: pairedLeft, right: pairedRight };
}

function covariance(a: number[], b: number[]): number | null {
  if (a.length < 2 || a.length !== b.length) return null;
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let cov = 0;
  for (let index = 0; index < a.length; index += 1) cov += (a[index]! - meanA) * (b[index]! - meanB);
  return cov / a.length;
}

function row(kpiId: string, value: number | null, reason?: string, source: ComputedKpi["source"] = "computed"): ComputedKpi {
  if (value === null) return { kpiId, value: null, reason: reason ?? LOOKBACK, source };
  return { kpiId, value, source };
}

function maxDrawdown(closes: number[]): number | null {
  if (closes.length < 2) return null;
  let peak = closes[0]!;
  let maxDd = 0;
  for (const close of closes) {
    if (close > peak) peak = close;
    if (peak > 0) maxDd = Math.min(maxDd, (close - peak) / peak);
  }
  return maxDd * 100;
}

function computeDirectional(bars: readonly OhlcvBar[], period: number) {
  if (bars.length <= period) return { plusDi: null, minusDi: null, adx: null };
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  const tr = trueRanges(bars).slice(1);
  for (let index = 1; index < bars.length; index += 1) {
    const up = bars[index]!.high - bars[index - 1]!.high;
    const down = bars[index - 1]!.low - bars[index]!.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  const smoothTr = wilder(tr, period);
  const smoothPlus = wilder(plusDm, period);
  const smoothMinus = wilder(minusDm, period);
  const plusDiSeries: number[] = [];
  const minusDiSeries: number[] = [];
  const dx: number[] = [];
  for (let index = 0; index < smoothTr.length; index += 1) {
    const atr = smoothTr[index]!;
    const plus = atr ? (100 * smoothPlus[index]!) / atr : 0;
    const minus = atr ? (100 * smoothMinus[index]!) / atr : 0;
    plusDiSeries.push(plus);
    minusDiSeries.push(minus);
    const denom = plus + minus;
    dx.push(denom ? (100 * Math.abs(plus - minus)) / denom : 0);
  }
  return {
    plusDi: last(plusDiSeries),
    minusDi: last(minusDiSeries),
    adx: last(wilder(dx, period)),
  };
}

function supertrend(bars: readonly OhlcvBar[], period: number, multiplier: number): number | null {
  if (bars.length <= period) return null;
  const atrs = wilder(trueRanges(bars), period);
  if (!atrs.length) return null;
  let trend = 1;
  let superValue = bars[period]!.close;
  for (let index = period; index < bars.length; index += 1) {
    const atr = atrs[index - period]!;
    const mid = (bars[index]!.high + bars[index]!.low) / 2;
    const upper = mid + multiplier * atr;
    const lower = mid - multiplier * atr;
    if (trend === 1) {
      superValue = Math.max(lower, Number.isFinite(superValue) ? superValue : lower);
      if (bars[index]!.close < superValue) {
        trend = -1;
        superValue = upper;
      }
    } else {
      superValue = Math.min(upper, Number.isFinite(superValue) ? superValue : upper);
      if (bars[index]!.close > superValue) {
        trend = 1;
        superValue = lower;
      }
    }
  }
  return superValue;
}

function parabolicSar(bars: readonly OhlcvBar[]): number | null {
  if (bars.length < 5) return null;
  let bull = true;
  let af = 0.02;
  let ep = bars[0]!.high;
  let sar = bars[0]!.low;
  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index]!;
    sar = sar + af * (ep - sar);
    if (bull) {
      if (bar.low < sar) {
        bull = false;
        sar = ep;
        ep = bar.low;
        af = 0.02;
      } else {
        if (bar.high > ep) {
          ep = bar.high;
          af = Math.min(0.2, af + 0.02);
        }
      }
    } else if (bar.high > sar) {
      bull = true;
      sar = ep;
      ep = bar.high;
      af = 0.02;
    } else if (bar.low < ep) {
      ep = bar.low;
      af = Math.min(0.2, af + 0.02);
    }
  }
  return sar;
}

function stoch(bars: readonly OhlcvBar[], period: number): { k: number | null; d: number | null } {
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const ks: number[] = [];
  for (let end = period; end <= bars.length; end += 1) {
    const hi = highest(highs.slice(0, end), period);
    const lo = lowest(lows.slice(0, end), period);
    if (hi === null || lo === null || hi === lo) continue;
    ks.push(((bars[end - 1]!.close - lo) / (hi - lo)) * 100);
  }
  return { k: last(ks), d: sma(ks, 3) };
}

function tsi(closes: number[], longPeriod: number, shortPeriod: number): number | null {
  const momentum: number[] = [];
  for (let index = 1; index < closes.length; index += 1) momentum.push(closes[index]! - closes[index - 1]!);
  const first = emaSeries(momentum, longPeriod);
  const double = emaSeries(first, shortPeriod);
  const absFirst = emaSeries(momentum.map(Math.abs), longPeriod);
  const absDouble = emaSeries(absFirst, shortPeriod);
  const num = last(double);
  const den = last(absDouble);
  if (num === null || den === null || den === 0) return null;
  return 100 * (num / den);
}

function ultimateOsc(bars: readonly OhlcvBar[]): number | null {
  if (bars.length < 29) return null;
  const bp: number[] = [];
  const tr: number[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const prev = bars[index - 1]!.close;
    const bar = bars[index]!;
    const minLow = Math.min(bar.low, prev);
    bp.push(bar.close - minLow);
    tr.push(Math.max(bar.high, prev) - minLow);
  }
  const avg = (period: number) => {
    const b = bp.slice(-period).reduce((sum, value) => sum + value, 0);
    const t = tr.slice(-period).reduce((sum, value) => sum + value, 0);
    return t ? b / t : null;
  };
  const a7 = avg(7);
  const a14 = avg(14);
  const a28 = avg(28);
  if (a7 === null || a14 === null || a28 === null) return null;
  return 100 * ((4 * a7) + (2 * a14) + a28) / 7;
}

function mfi(bars: readonly OhlcvBar[], period: number): number | null {
  if (bars.length <= period) return null;
  let pos = 0;
  let neg = 0;
  for (let index = bars.length - period; index < bars.length; index += 1) {
    const typical = (bars[index]!.high + bars[index]!.low + bars[index]!.close) / 3;
    const prev = (bars[index - 1]!.high + bars[index - 1]!.low + bars[index - 1]!.close) / 3;
    const mf = typical * bars[index]!.volume;
    if (typical >= prev) pos += mf;
    else neg += mf;
  }
  if (neg === 0) return 100;
  return 100 - 100 / (1 + pos / neg);
}

function accumulation(bars: readonly OhlcvBar[]): number[] {
  const out: number[] = [];
  let current = 0;
  for (const bar of bars) {
    const range = bar.high - bar.low;
    const mfm = range ? ((bar.close - bar.low) - (bar.high - bar.close)) / range : 0;
    current += mfm * bar.volume;
    out.push(current);
  }
  return out;
}

function valuationFromFundamentals(fundamentals: YfinanceFundamentals | undefined): Record<string, number | null> {
  const empty: Record<string, number | null> = {
    pe_ttm: null, pe_fwd: null, pb: null, ps_ttm: null, ev_ebitda: null, ev_sales: null,
    dividend_yield: null, earnings_yield: null, fcf_yield: null, roe: null, roce: null,
    peg: null, price_to_fcf: null, book_yield: null, ev_ebit: null, sales_growth_yoy: null,
  };
  if (!fundamentals) return empty;
  const pe = fundamentals.peTtm ?? null;
  const pb = fundamentals.pb ?? null;
  const fcf = fundamentals.freeCashflow ?? null;
  const mcap = fundamentals.marketCap ?? null;
  empty.pe_ttm = pe;
  empty.pe_fwd = fundamentals.peFwd ?? null;
  empty.pb = pb;
  empty.ps_ttm = fundamentals.psTtm ?? null;
  empty.ev_ebitda = fundamentals.evEbitda ?? null;
  empty.ev_sales = fundamentals.evSales ?? null;
  empty.dividend_yield = fundamentals.dividendYield ?? null;
  empty.earnings_yield = fundamentals.earningsYield ?? (pe && pe !== 0 ? 1 / pe : null);
  empty.fcf_yield = fundamentals.fcfYield ?? (fcf !== null && mcap ? fcf / mcap : null);
  empty.roe = fundamentals.roe ?? null;
  empty.roce = fundamentals.roce ?? null;
  empty.peg = fundamentals.peg ?? null;
  empty.price_to_fcf = fundamentals.priceToFcf ?? (fcf && fcf !== 0 && mcap ? mcap / fcf : null);
  empty.book_yield = fundamentals.bookYield ?? (pb && pb !== 0 ? 1 / pb : null);
  empty.ev_ebit = fundamentals.evEbit ?? null;
  empty.sales_growth_yoy = fundamentals.salesGrowthYoy ?? null;
  return empty;
}

function computeBreadth(universe: readonly UniverseMember[] | undefined): Record<string, number | null> {
  const ids = [
    "advance_decline", "ad_ratio", "mcclellan_osc", "new_highs_20", "new_lows_20",
    "pct_above_sma50", "pct_above_sma200", "up_volume_ratio", "tick_index", "trin",
    "high_low_index", "breadth_thrust", "equal_weight_vs_cap", "sector_dispersion",
    "correlation_nifty", "participation_rate",
  ];
  const blank = Object.fromEntries(ids.map((id) => [id, null])) as Record<string, number | null>;
  if (!universe || universe.length < 5) return blank;
  let advances = 0;
  let declines = 0;
  let upVolume = 0;
  let downVolume = 0;
  let above50 = 0;
  let above200 = 0;
  let highs = 0;
  let lows = 0;
  let counted = 0;
  const lastReturns: number[] = [];
  for (const member of universe) {
    if (member.bars.length < 2) continue;
    counted += 1;
    const latest = member.bars[member.bars.length - 1]!;
    const previous = member.bars[member.bars.length - 2]!;
    const closes = member.bars.map((bar) => bar.close);
    if (latest.close >= previous.close) {
      advances += 1;
      upVolume += latest.volume;
    } else {
      declines += 1;
      downVolume += latest.volume;
    }
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);
    if (sma50 !== null && latest.close > sma50) above50 += 1;
    if (sma200 !== null && latest.close > sma200) above200 += 1;
    const hi20 = highest(member.bars.map((bar) => bar.high), 20);
    const lo20 = lowest(member.bars.map((bar) => bar.low), 20);
    if (hi20 !== null && latest.high >= hi20) highs += 1;
    if (lo20 !== null && latest.low <= lo20) lows += 1;
    if (previous.close) lastReturns.push((latest.close - previous.close) / previous.close);
  }
  if (!counted) return blank;
  const ad = advances - declines;
  blank.advance_decline = ad;
  blank.ad_ratio = declines ? advances / declines : null;
  blank.mcclellan_osc = ad;
  blank.new_highs_20 = highs;
  blank.new_lows_20 = lows;
  blank.pct_above_sma50 = (above50 / counted) * 100;
  blank.pct_above_sma200 = (above200 / counted) * 100;
  blank.up_volume_ratio = (upVolume + downVolume) ? upVolume / (upVolume + downVolume) : null;
  blank.tick_index = ad;
  blank.trin = (advances && declines && upVolume && downVolume)
    ? (advances / declines) / (upVolume / downVolume)
    : null;
  blank.high_low_index = counted ? ((highs - lows) / counted) * 100 : null;
  blank.breadth_thrust = blank.ad_ratio;
  blank.equal_weight_vs_cap = null;
  blank.sector_dispersion = stddev(lastReturns.map((value) => value * 100));
  blank.participation_rate = counted ? ((advances + declines) / counted) * 100 : null;
  return blank;
}

/** Honest series from OHLCV, optional fundamentals, benchmark, and universe. Missing inputs stay null. */
export function computeKpisFromOhlcv(bars: readonly OhlcvBar[], extras: RegistryKpiExtras = {}): ComputedKpi[] {
  const values = new Map<string, ComputedKpi>();
  const put = (kpiId: string, value: number | null, reason?: string, source: ComputedKpi["source"] = "computed") => {
    values.set(kpiId, row(kpiId, value, reason, source));
  };

  if (bars.length === 0) {
    for (const definition of kpiDefinitions) put(definition.id, null, NO_BARS);
  } else {
    const latest = bars[bars.length - 1]!;
    const previous = bars.length > 1 ? bars[bars.length - 2] : undefined;
    const closes = bars.map((bar) => bar.close);
    const highs = bars.map((bar) => bar.high);
    const lows = bars.map((bar) => bar.low);
    const volumes = bars.map((bar) => bar.volume);
    const typical = bars.map((bar) => (bar.high + bar.low + bar.close) / 3);
    const mid = sma(closes, 20);
    const sigma = bars.length >= 20 ? stddev(closes.slice(-20)) : null;
    const upper = mid !== null && sigma !== null ? mid + 2 * sigma : null;
    const lower = mid !== null && sigma !== null ? mid - 2 * sigma : null;
    const macd = macdLine(closes);
    const atr14 = last(wilder(trueRanges(bars), 14));
    const directional = computeDirectional(bars, 14);
    const stoch14 = stoch(bars, 14);
    const adLine = accumulation(bars);
    const hl = bars.map((bar) => bar.high - bar.low);
    const rets = returns(closes);
    const logRets = logReturns(closes);
    const hv20 = logRets.length >= 20 && stddev(logRets.slice(-20)) !== null
      ? stddev(logRets.slice(-20))! * Math.sqrt(252) * 100
      : null;
    const hv60 = logRets.length >= 60 && stddev(logRets.slice(-60)) !== null
      ? stddev(logRets.slice(-60))! * Math.sqrt(252) * 100
      : null;
    const hvSeries: number[] = [];
    for (let end = 21; end <= logRets.length + 1; end += 1) {
      const window = logRets.slice(Math.max(0, end - 21), end - 1);
      const sd = stddev(window);
      if (sd !== null) hvSeries.push(sd * Math.sqrt(252) * 100);
    }

    put("open", latest.open);
    put("high", latest.high);
    put("low", latest.low);
    put("close", latest.close);
    put("volume", latest.volume);
    put("typical_price", (latest.high + latest.low + latest.close) / 3);
    put("median_price", (latest.high + latest.low) / 2);
    put("weighted_close", (latest.high + latest.low + latest.close * 2) / 4);
    const vwapNum = bars.reduce((sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * bar.volume, 0);
    const vwapDen = bars.reduce((sum, bar) => sum + bar.volume, 0);
    put("vwap", vwapDen ? vwapNum / vwapDen : null, vwapDen ? undefined : "zero volume");
    put("hl2", (latest.high + latest.low) / 2);
    put("hlc3", (latest.high + latest.low + latest.close) / 3);
    put("ohlc4", (latest.open + latest.high + latest.low + latest.close) / 4);
    put("gap_pct", previous && previous.close ? ((latest.open - previous.close) / previous.close) * 100 : null);
    put("range", latest.high - latest.low);
    put("true_range", last(trueRanges(bars)));
    put("log_return", previous && previous.close > 0 && latest.close > 0 ? Math.log(latest.close / previous.close) * 100 : null);

    put("sma_20", sma(closes, 20));
    put("sma_50", sma(closes, 50));
    put("sma_200", sma(closes, 200));
    put("sma_220", sma(closes, 220), closes.length < 220 ? LOOKBACK : undefined);
    put("ema_12", ema(closes, 12));
    put("ema_26", ema(closes, 26));
    put("ema_50", ema(closes, 50));
    put("wma_20", wma(closes, 20));
    const ema20 = ema(closes, 20);
    const emaEma20 = ema(emaSeries(closes, 20), 20);
    put("dema_20", ema20 !== null && emaEma20 !== null ? 2 * ema20 - emaEma20 : null);
    const ema3 = ema(emaSeries(emaSeries(closes, 20), 20), 20);
    put("tema_20", ema20 !== null && emaEma20 !== null && ema3 !== null ? 3 * ema20 - 3 * emaEma20 + ema3 : null);
    put("adx_14", directional.adx);
    put("plus_di_14", directional.plusDi);
    put("minus_di_14", directional.minusDi);
    put("supertrend_10_3", supertrend(bars, 10, 3));
    put("ichimoku_tenkan", (() => {
      const hi = highest(highs, 9);
      const lo = lowest(lows, 9);
      return hi !== null && lo !== null ? (hi + lo) / 2 : null;
    })());
    put("ichimoku_kijun", (() => {
      const hi = highest(highs, 26);
      const lo = lowest(lows, 26);
      return hi !== null && lo !== null ? (hi + lo) / 2 : null;
    })());
    put("parabolic_sar", parabolicSar(bars));

    put("rsi_14", rsi(closes, 14));
    put("rsi_7", rsi(closes, 7));
    put("macd_12_26_9", macd?.macd ?? null);
    put("macd_signal", macd?.signal ?? null);
    put("macd_hist", macd?.hist ?? null);
    put("stoch_k_14", stoch14.k);
    put("stoch_d_14", stoch14.d);
    const tpSma = sma(typical, 20);
    const tpDev = bars.length >= 20
      ? typical.slice(-20).reduce((sum, value) => sum + Math.abs(value - (tpSma ?? value)), 0) / 20
      : null;
    put("cci_20", tpSma !== null && tpDev ? (typical[typical.length - 1]! - tpSma) / (0.015 * tpDev) : null);
    const hh14 = highest(highs, 14);
    const ll14 = lowest(lows, 14);
    put("williams_r_14", hh14 !== null && ll14 !== null && hh14 !== ll14 ? ((hh14 - latest.close) / (hh14 - ll14)) * -100 : null);
    put("roc_12", closes.length > 12 && closes[closes.length - 13] ? ((latest.close - closes[closes.length - 13]!) / closes[closes.length - 13]!) * 100 : null);
    put("mfi_14", mfi(bars, 14));
    put("momentum_10", closes.length > 10 ? latest.close - closes[closes.length - 11]! : null);
    put("tsi_25_13", tsi(closes, 25, 13));
    put("ultimate_osc", ultimateOsc(bars));
    const midpoints = bars.map((bar) => (bar.high + bar.low) / 2);
    const aoFast = sma(midpoints, 5);
    const aoSlow = sma(midpoints, 34);
    put("awesome_osc", aoFast !== null && aoSlow !== null ? aoFast - aoSlow : null);
    const roc14 = closes.length > 14 && closes[closes.length - 15] ? ((latest.close / closes[closes.length - 15]!) - 1) * 100 : null;
    const roc11 = closes.length > 11 && closes[closes.length - 12] ? ((latest.close / closes[closes.length - 12]!) - 1) * 100 : null;
    put("coppock", roc14 !== null && roc11 !== null ? wma([roc14 + roc11], 1) : null);

    put("atr_14", atr14);
    put("atr_pct_14", atr14 !== null && latest.close ? (atr14 / latest.close) * 100 : null);
    put("bbands_upper_20", upper);
    put("bbands_mid_20", mid);
    put("bbands_lower_20", lower);
    put("bbands_width_20", mid && upper !== null && lower !== null && mid !== 0 ? (upper - lower) / mid : null);

    // Bollinger Band Expansion and Mean Comparison.
    // `bbands_width_20` above is NORMALISED ((upper - lower) / mid); the
    // expansion KPIs below are ABSOLUTE price spreads, which is what a
    // contraction-to-breakout comparison needs. They are not interchangeable.
    const expansion = bollingerExpansion(bars);
    put("bb_upper_min_3m", expansion.upperMin3m, expansion.reason ?? undefined);
    put("bb_lower_max_3m", expansion.lowerMax3m, expansion.reason ?? undefined);
    put("bb_width_min_3m", expansion.widthMin3m, expansion.reason ?? undefined);
    put("bb_expansion_delta", expansion.expansionDelta, expansion.reason ?? undefined);
    put(
      "bb_expansion_pct",
      expansion.expansionPct,
      expansion.reason ?? (expansion.widthAtContraction === 0 ? "bands fully collapsed at contraction" : undefined),
    );
    put(
      "bb_expansion_state",
      expansion.state === "expanding" ? 1 : expansion.state === "squeeze" ? 0 : expansion.state === "contracting" ? -1 : null,
      expansion.reason ?? undefined,
    );

    const meanCross = meanComparison(bars);
    put("mean_cross_state", meanCross.state === "bullish" ? 1 : meanCross.state === "bearish" ? -1 : null, meanCross.reason ?? undefined);
    put("mean_cross_gap_pct", meanCross.gapPct, meanCross.reason ?? undefined);
    put("mean_cross_days_since_flip", meanCross.daysSinceFlip, meanCross.reason ?? (meanCross.state ? "no flip in the available history" : undefined));
    const ema20Close = ema(closes, 20);
    const atr20 = last(wilder(trueRanges(bars), 20));
    put("keltner_upper", ema20Close !== null && atr20 !== null ? ema20Close + 2 * atr20 : null);
    put("keltner_lower", ema20Close !== null && atr20 !== null ? ema20Close - 2 * atr20 : null);
    put("hist_vol_20", hv20);
    put("hist_vol_60", hv60);
    put("natr_14", atr14 !== null && latest.close ? (atr14 / latest.close) * 100 : null);
    put("stddev_20", bars.length >= 20 ? stddev(closes.slice(-20)) : null);
    const emaHl = ema(hl, 10);
    const emaHlPrev = hl.length > 10 ? ema(hl.slice(0, -10), 10) : null;
    put("chaikin_vol", emaHl !== null && emaHlPrev ? ((emaHl - emaHlPrev) / emaHlPrev) * 100 : null);
    put("donchian_high_20", highest(highs, 20));
    put("donchian_low_20", lowest(lows, 20));
    put("hv_rank_252", hv20 !== null ? percentileRank(hvSeries.slice(-252), hv20) : null);

    let obv = 0;
    for (let index = 1; index < bars.length; index += 1) {
      if (bars[index]!.close > bars[index - 1]!.close) obv += bars[index]!.volume;
      else if (bars[index]!.close < bars[index - 1]!.close) obv -= bars[index]!.volume;
    }
    put("obv", bars.length > 1 ? obv : null);
    put("ad_line", last(adLine));
    const cmfWindow = bars.slice(-20);
    const cmfNum = cmfWindow.reduce((sum, bar) => {
      const range = bar.high - bar.low;
      return sum + (range ? (((bar.close - bar.low) - (bar.high - bar.close)) / range) * bar.volume : 0);
    }, 0);
    const cmfDen = cmfWindow.reduce((sum, bar) => sum + bar.volume, 0);
    put("cmf_20", bars.length >= 20 && cmfDen ? cmfNum / cmfDen : null);
    put("fi_13", bars.length > 13 ? (latest.close - bars[bars.length - 14]!.close) * latest.volume : null);
    let vpt = 0;
    for (let index = 1; index < bars.length; index += 1) {
      if (bars[index - 1]!.close) vpt += bars[index]!.volume * ((bars[index]!.close - bars[index - 1]!.close) / bars[index - 1]!.close);
    }
    put("vpt", bars.length > 1 ? vpt : null);
    const emvValues: number[] = [];
    for (let index = 1; index < bars.length; index += 1) {
      const distance = ((bars[index]!.high + bars[index]!.low) / 2) - ((bars[index - 1]!.high + bars[index - 1]!.low) / 2);
      const box = bars[index]!.volume ? (bars[index]!.volume / 1_000_000) / (bars[index]!.high - bars[index]!.low || 1) : 0;
      emvValues.push(box ? distance / box : 0);
    }
    put("emv_14", sma(emvValues, 14));
    let nvi = 1000;
    let pvi = 1000;
    for (let index = 1; index < bars.length; index += 1) {
      const change = bars[index - 1]!.close ? (bars[index]!.close - bars[index - 1]!.close) / bars[index - 1]!.close : 0;
      if (bars[index]!.volume < bars[index - 1]!.volume) nvi *= 1 + change;
      if (bars[index]!.volume > bars[index - 1]!.volume) pvi *= 1 + change;
    }
    put("nvi", bars.length > 1 ? nvi : null);
    put("pvi", bars.length > 1 ? pvi : null);
    put("vwma_20", vwma(bars, 20));
    put("volume_sma_20", sma(volumes, 20));
    const volSma = sma(volumes, 20);
    put("volume_ratio_20", volSma ? latest.volume / volSma : null);
    put("pvt", bars.length > 1 ? vpt : null);
    const vf: number[] = [];
    for (let index = 1; index < bars.length; index += 1) {
      const trend = typical[index]! >= typical[index - 1]! ? 1 : -1;
      vf.push(bars[index]!.volume * trend);
    }
    const klingerFast = ema(vf, 34);
    const klingerSlow = ema(vf, 55);
    put("klinger", klingerFast !== null && klingerSlow !== null ? klingerFast - klingerSlow : null);
    const adEma3 = ema(adLine, 3);
    const adEma10 = ema(adLine, 10);
    put("adosc", adEma3 !== null && adEma10 !== null ? adEma3 - adEma10 : null);
    put("vroc_12", volumes.length > 12 && volumes[volumes.length - 13] ? ((latest.volume - volumes[volumes.length - 13]!) / volumes[volumes.length - 13]!) * 100 : null);
    put("relative_volume", volSma ? latest.volume / volSma : null);

    const r60 = rets.slice(-60);
    const r20 = rets.slice(-20);
    const mean60 = r60.length ? r60.reduce((sum, value) => sum + value, 0) / r60.length : null;
    const sd60 = stddev(r60);
    const downside = r60.filter((value) => value < 0);
    const downSd = stddev(downside.length ? downside : [0]);
    const ann = mean60 !== null ? mean60 * 252 * 100 : null;
    const dd60 = closes.length >= 60 ? maxDrawdown(closes.slice(-60)) : null;
    put("sharpe_60", mean60 !== null && sd60 ? (mean60 / sd60) * Math.sqrt(252) : null);
    put("sortino_60", mean60 !== null && downSd ? (mean60 / downSd) * Math.sqrt(252) : null);
    put("max_drawdown_60", dd60);
    const sorted20 = [...r20].sort((a, b) => a - b);
    const varIndex = Math.floor(0.05 * sorted20.length);
    const var95 = sorted20.length >= 20 ? sorted20[varIndex]! * 100 : null;
    put("var_95_20", var95);
    const tail = sorted20.slice(0, Math.max(1, varIndex + 1));
    put("cvar_95_20", sorted20.length >= 20 ? (tail.reduce((sum, value) => sum + value, 0) / tail.length) * 100 : null);
    put("downside_dev_20", r20.length >= 20 ? stddev(r20.filter((value) => value < 0).map((value) => value * 100)) : null);
    const ulcerSq = closes.length >= 20
      ? (() => {
        const window = closes.slice(-20);
        let peak = window[0]!;
        let acc = 0;
        for (const close of window) {
          if (close > peak) peak = close;
          const dd = peak ? ((close - peak) / peak) * 100 : 0;
          acc += dd * dd;
        }
        return Math.sqrt(acc / window.length);
      })()
      : null;
    put("ulcer_index", ulcerSq);
    put("calmar_60", ann !== null && dd60 && dd60 !== 0 ? ann / Math.abs(dd60) : null);
    const hvWindows: number[] = [];
    for (let end = 20; end <= logRets.length; end += 1) {
      const sd = stddev(logRets.slice(end - 20, end));
      if (sd !== null) hvWindows.push(sd);
    }
    put("vol_of_vol", hvWindows.length >= 20 ? stddev(hvWindows.slice(-20)) : null);
    const r60pct = r60.map((value) => value * 100);
    const meanR = r60pct.length ? r60pct.reduce((sum, value) => sum + value, 0) / r60pct.length : 0;
    const m3 = r60pct.reduce((sum, value) => sum + (value - meanR) ** 3, 0) / (r60pct.length || 1);
    const m4 = r60pct.reduce((sum, value) => sum + (value - meanR) ** 4, 0) / (r60pct.length || 1);
    const sdR = stddev(r60pct);
    put("skew_60", r60.length >= 60 && sdR ? m3 / (sdR ** 3) : null);
    put("kurtosis_60", r60.length >= 60 && sdR ? m4 / (sdR ** 4) : null);

    const bench = extras.benchmark;
    if (bench && bench.length >= 60) {
      const aligned60 = alignCloses(bars.slice(-120), bench);
      const aR = returns(aligned60.left).slice(-60);
      const bR = returns(aligned60.right).slice(-60);
      const minLen = Math.min(aR.length, bR.length);
      const a = aR.slice(-minLen);
      const b = bR.slice(-minLen);
      const cov = covariance(a, b);
      const varB = stddev(b);
      const beta60 = cov !== null && varB ? cov / (varB * varB) : null;
      const aligned252 = alignCloses(bars.slice(-300), bench);
      const a252 = returns(aligned252.left).slice(-252);
      const b252 = returns(aligned252.right).slice(-252);
      const n252 = Math.min(a252.length, b252.length);
      const cov252 = covariance(a252.slice(-n252), b252.slice(-n252));
      const varB252 = stddev(b252.slice(-n252));
      const beta252 = cov252 !== null && varB252 ? cov252 / (varB252 * varB252) : null;
      const excess = a.map((value, index) => value - b[index]!);
      const te = stddev(excess);
      const ir = excess.length && te ? (excess.reduce((sum, value) => sum + value, 0) / excess.length) / te * Math.sqrt(252) : null;
      const corr = cov !== null && stddev(a) && varB ? cov / (stddev(a)! * varB) : null;
      put("beta_60", beta60, beta60 === null ? LOOKBACK : undefined);
      put("beta_252", beta252, beta252 === null ? LOOKBACK : undefined);
      put("treynor_60", beta60 && mean60 !== null ? (mean60 * 252) / beta60 : null);
      put("information_ratio", ir);
      put("tracking_error", te !== null ? te * Math.sqrt(252) * 100 : null);
      put("correlation_nifty", corr);
    } else {
      put("beta_60", null, NO_BENCH);
      put("beta_252", null, NO_BENCH);
      put("treynor_60", null, NO_BENCH);
      put("information_ratio", null, NO_BENCH);
      put("tracking_error", null, NO_BENCH);
      put("correlation_nifty", null, NO_BENCH);
    }
  }

  const valuation = valuationFromFundamentals(extras.fundamentals);
  for (const [kpiId, value] of Object.entries(valuation)) {
    put(kpiId, value, value === null ? NO_FUND : undefined, "yfinance");
  }

  const breadth = computeBreadth(extras.universe);
  for (const [kpiId, value] of Object.entries(breadth)) {
    if (kpiId === "correlation_nifty" && values.get("correlation_nifty")?.value !== null && values.get("correlation_nifty")?.value !== undefined) {
      continue;
    }
    if (kpiId === "correlation_nifty" && values.has("correlation_nifty")) continue;
    put(kpiId, value, extras.universe && extras.universe.length >= 5 ? LOOKBACK : NO_UNIVERSE);
  }

  const computed: ComputedKpi[] = kpiDefinitions.map((definition) => values.get(definition.id) ?? row(definition.id, null, LOOKBACK));
  computed.push({
    kpiId: "weighted_ma_price",
    value: bars.length ? wma(bars.map((bar) => (bar.high + bar.low + bar.close) / 3), 20) : null,
    label: "Weighted MA of price (typical price, 20)",
    source: "computed",
    ...(bars.length < 20 ? { reason: LOOKBACK } : {}),
  });
  return computed;
}

export function kpiValueMap(computed: readonly ComputedKpi[]): Map<string, number | null> {
  return new Map(computed.map((item) => [item.kpiId, item.value]));
}
