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
};

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((sum, value) => sum + value, 0) / period;
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of values.slice(period)) current = value * k + current * (1 - k);
  return current;
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
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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

/** Honest series from OHLCV only. Missing lookback → null. No fabricated KPIs. */
export function computeKpisFromOhlcv(bars: readonly OhlcvBar[]): ComputedKpi[] {
  if (bars.length === 0) return [];
  const latest = bars[bars.length - 1]!;
  const previous = bars.length > 1 ? bars[bars.length - 2] : undefined;
  const closes = bars.map((bar) => bar.close);
  const typical = bars.map((bar) => (bar.high + bar.low + bar.close) / 3);
  const mid = sma(closes, 20);
  const sigma = bars.length >= 20 ? stddev(closes.slice(-20)) : null;
  const upper = mid !== null && sigma !== null ? mid + 2 * sigma : null;
  const lower = mid !== null && sigma !== null ? mid - 2 * sigma : null;
  const macd = macdLine(closes);
  const values: ComputedKpi[] = [
    { kpiId: "open", value: latest.open },
    { kpiId: "high", value: latest.high },
    { kpiId: "low", value: latest.low },
    { kpiId: "close", value: latest.close },
    { kpiId: "volume", value: latest.volume },
    { kpiId: "typical_price", value: (latest.high + latest.low + latest.close) / 3 },
    { kpiId: "median_price", value: (latest.high + latest.low) / 2 },
    { kpiId: "hl2", value: (latest.high + latest.low) / 2 },
    { kpiId: "hlc3", value: (latest.high + latest.low + latest.close) / 3 },
    { kpiId: "ohlc4", value: (latest.open + latest.high + latest.low + latest.close) / 4 },
    { kpiId: "weighted_close", value: (latest.high + latest.low + latest.close * 2) / 4 },
    { kpiId: "gap_pct", value: previous && previous.close ? ((latest.open - previous.close) / previous.close) * 100 : null },
    { kpiId: "range", value: latest.high - latest.low },
    { kpiId: "sma_20", value: sma(closes, 20) },
    { kpiId: "sma_50", value: sma(closes, 50) },
    { kpiId: "sma_200", value: sma(closes, 200) },
    { kpiId: "ema_12", value: ema(closes, 12) },
    { kpiId: "ema_26", value: ema(closes, 26) },
    { kpiId: "ema_50", value: ema(closes, 50) },
    { kpiId: "wma_20", value: wma(closes, 20) },
    { kpiId: "vwma_20", value: vwma(bars, 20) },
    {
      kpiId: "weighted_ma_price",
      value: wma(typical, 20),
      label: "Weighted MA of price (typical price, 20)",
    },
    { kpiId: "rsi_14", value: rsi(closes, 14) },
    { kpiId: "rsi_7", value: rsi(closes, 7) },
    { kpiId: "macd_12_26_9", value: macd?.macd ?? null },
    { kpiId: "macd_signal", value: macd?.signal ?? null },
    { kpiId: "macd_hist", value: macd?.hist ?? null },
    { kpiId: "bbands_mid_20", value: mid },
    { kpiId: "bbands_upper_20", value: upper },
    { kpiId: "bbands_lower_20", value: lower },
    { kpiId: "bbands_width_20", value: mid && upper !== null && lower !== null && mid !== 0 ? (upper - lower) / mid : null },
    {
      kpiId: "bbands_pct_from_upper",
      value: upper && latest.close ? ((latest.close - upper) / upper) * 100 : null,
      label: "% from Bollinger upper",
    },
    {
      kpiId: "bbands_pct_from_lower",
      value: lower && latest.close ? ((latest.close - lower) / lower) * 100 : null,
      label: "% from Bollinger lower",
    },
  ];
  return values;
}

export function kpiValueMap(computed: readonly ComputedKpi[]): Map<string, number | null> {
  return new Map(computed.map((item) => [item.kpiId, item.value]));
}
