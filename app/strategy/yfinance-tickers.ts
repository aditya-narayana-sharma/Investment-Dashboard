/**
 * Map Kite tradingsymbols onto Yahoo tickers. NSE cash names need `.NS`;
 * never invent a suffix when one is already present.
 */
export const YFINANCE_NSE_ALIASES: Record<string, string> = {
  MAXHEALTHCARE: "MAXHEALTH",
  CREDITACCESSGR: "CREDITACC",
  GRASIMINDUSTRI: "GRASIM",
  HINDUSTANAERON: "HAL",
  JKLAKSHMICEMEN: "JKLAKSHMI",
  ONE97COMMUNICA: "PAYTM",
  LTIMINDTREE: "LTIM",
  AVENUESUPERMAR: "DMART",
  RSYSTEMSINTER: "RSYSTEMS",
  RAINBOWCHILDRE: "RAINBOW",
  KALYANISTEELS: "KSL",
  GLOBALHEALTH: "MEDANTA",
  BAJAJAUTO: "BAJAJ-AUTO",
  GILTBEES: "LTGILTBEES",
};

export type YahooExchangeHint = "NSE" | "BSE" | string;

export type InstrumentQuoteKpis = {
  price?: number;
  changePct?: number;
  marketCap?: number;
  pe?: number;
  sector?: string;
  exchange?: string;
  currency?: string;
  asOf?: string;
};

const YAHOO_SUFFIX = /\.[A-Z]{1,4}$/;

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function hasYahooSuffix(symbol: string): boolean {
  return YAHOO_SUFFIX.test(normalizeSymbol(symbol));
}

export function toYahooTicker(tradingsymbol: string, exchange: YahooExchangeHint = "NSE"): string {
  const raw = normalizeSymbol(tradingsymbol);
  if (!raw) return "";
  if (raw.startsWith("^") || hasYahooSuffix(raw)) return raw;
  const mapped = YFINANCE_NSE_ALIASES[raw] ?? raw;
  const hint = normalizeSymbol(exchange);
  const suffix = hint === "BSE" || hint === "BOM" ? ".BO" : ".NS";
  return `${mapped}${suffix}`;
}

export function fromYahooTicker(yahoo: string): string {
  const raw = normalizeSymbol(yahoo);
  if (!raw) return "";
  if (raw.endsWith(".NS") || raw.endsWith(".BO")) return raw.slice(0, -3);
  return raw;
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

function formatPrice(price: number, currency?: string): string {
  const code = (currency ?? "").trim().toUpperCase();
  if (code === "INR" || code === "RS") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(price);
  }
  if (code === "USD" || code === "US$") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(price);
  }
  const formatted = compactNumber(price);
  return code ? `${code} ${formatted}` : formatted;
}

function formatMarketCap(value: number, currency?: string): string {
  const code = (currency ?? "").trim().toUpperCase();
  if (code === "INR" || code === "RS") {
    if (value >= 1e12) return `₹${(value / 1e12).toFixed(2)}L Cr`;
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
    return `₹${compactNumber(value)}`;
  }
  return compactNumber(value);
}

/** Honest KPI line for picker rows. Missing fields are omitted; never invent quotes. */
export function formatInstrumentKpis(kpis?: InstrumentQuoteKpis | null): string {
  if (!kpis) return "Unavailable";
  const parts: string[] = [];
  if (kpis.price !== undefined && Number.isFinite(kpis.price)) {
    parts.push(formatPrice(kpis.price, kpis.currency));
  }
  if (kpis.changePct !== undefined && Number.isFinite(kpis.changePct)) {
    const sign = kpis.changePct > 0 ? "+" : "";
    parts.push(`${sign}${kpis.changePct.toFixed(2)}%`);
  }
  if (kpis.sector?.trim()) parts.push(kpis.sector.trim());
  if (kpis.exchange?.trim()) parts.push(kpis.exchange.trim());
  if (kpis.pe !== undefined && Number.isFinite(kpis.pe)) parts.push(`PE ${kpis.pe.toFixed(1)}`);
  if (kpis.marketCap !== undefined && Number.isFinite(kpis.marketCap)) {
    parts.push(formatMarketCap(kpis.marketCap, kpis.currency));
  }
  if (kpis.currency?.trim() && kpis.price === undefined) parts.push(kpis.currency.trim());
  return parts.length ? parts.join(" · ") : "Unavailable";
}
