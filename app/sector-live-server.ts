import { callKiteTool } from "./kite-live-server";
import { sectorCompanies } from "./sector-company-data";
import type { SectorCompanyMarket, SectorMarketSnapshot, SectorReturnHorizon } from "./sector-live-types";

type JsonObject = Record<string, unknown>;
type HistoryEntry = { date: string; returns: Record<Exclude<SectorReturnHorizon, "day">, number | null> };
type SectorRuntimeState = {
  history: Map<string, HistoryEntry>;
  lastGood: Map<string, SectorMarketSnapshot>;
  publicFallback: Map<string, { expiresAt: number; snapshot: SectorMarketSnapshot }>;
};

const globalState = globalThis as typeof globalThis & { __sectorRuntime?: SectorRuntimeState };
const state = globalState.__sectorRuntime ??= { history: new Map(), lastGood: new Map(), publicFallback: new Map() };
state.publicFallback ??= new Map();

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function isoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function kiteDate(date: Date, end = false) {
  return `${date.toISOString().slice(0, 10)} ${end ? "23:59:59" : "00:00:00"}`;
}

function percent(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return Number(((current / previous - 1) * 100).toFixed(2));
}

function quoteMap(raw: unknown) {
  const root = object(raw);
  const data = Object.keys(object(root.data)).length ? object(root.data) : root;
  return data;
}

function candles(raw: unknown) {
  const root = object(raw);
  const candidates = Array.isArray(raw)
    ? raw
    : Array.isArray(root.candles)
      ? root.candles
      : Array.isArray(object(root.data).candles)
        ? object(root.data).candles as unknown[]
        : [];

  return candidates.map((item) => {
    if (Array.isArray(item)) return numberOrNull(item[4]);
    return numberOrNull(object(item).close);
  }).filter((value): value is number => value !== null);
}

async function historyReturns(symbol: string, instrumentToken: number | null, currentPrice: number | null) {
  const cached = state.history.get(symbol);
  if (cached?.date === isoDate()) return cached.returns;
  const empty = { week: null, month: null, quarter: null };
  if (instrumentToken === null) return empty;

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 110);
  try {
    const raw = await callKiteTool("get_historical_data", {
      instrument_token: instrumentToken,
      interval: "day",
      from_date: kiteDate(from),
      to_date: kiteDate(to, true),
      continuous: false,
      oi: false,
    });
    const closes = candles(raw);
    const latest = currentPrice ?? closes.at(-1) ?? null;
    const at = (sessions: number) => closes.length > sessions ? closes[closes.length - 1 - sessions] : closes[0] ?? null;
    const returns = {
      week: percent(latest, at(5)),
      month: percent(latest, at(21)),
      quarter: percent(latest, at(63)),
    };
    state.history.set(symbol, { date: isoDate(), returns });
    return returns;
  } catch {
    return empty;
  }
}

async function addHistory(rows: Array<SectorCompanyMarket & { instrumentToken: number | null }>) {
  const enriched: SectorCompanyMarket[] = [];
  for (let index = 0; index < rows.length; index += 3) {
    const batch = rows.slice(index, index + 3);
    const results = await Promise.all(batch.map(async (row) => ({
      ...row,
      returns: { ...row.returns, ...await historyReturns(row.symbol, row.instrumentToken, row.price) },
    })));
    enriched.push(...results.map((row) => ({
      symbol: row.symbol,
      price: row.price,
      previousClose: row.previousClose,
      returns: row.returns,
    })));
    if (index + 3 < rows.length) await new Promise((resolve) => setTimeout(resolve, 380));
  }
  return enriched;
}


type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

async function publicCompanyMarket(symbol: string): Promise<SectorCompanyMarket> {
  const yahooSymbol = `${symbol}.NS`;
  const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=6mo&interval=1d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Public market fallback returned HTTP ${response.status} for ${symbol}.`);
  const payload = await response.json() as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const price = numberOrNull(result?.meta?.regularMarketPrice) ?? closes.at(-1) ?? null;
  const previousClose = closes.length > 1 ? closes.at(-2) ?? null : numberOrNull(result?.meta?.chartPreviousClose);
  const at = (sessions: number) => closes.length > sessions ? closes[closes.length - 1 - sessions] : closes[0] ?? null;
  return {
    symbol,
    price,
    previousClose,
    returns: {
      day: percent(price, previousClose),
      week: percent(price, at(5)),
      month: percent(price, at(21)),
      quarter: percent(price, at(63)),
    },
  };
}

export async function getPublicSectorMarketSnapshot(sectorId: string, reason: string): Promise<SectorMarketSnapshot> {
  const cached = state.publicFallback.get(sectorId);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;
  const universe = sectorCompanies[sectorId] ?? sectorCompanies.pharma;
  const companies: SectorCompanyMarket[] = [];
  for (let index = 0; index < universe.length; index += 4) {
    companies.push(...await Promise.all(universe.slice(index, index + 4).map(async (company) => {
      try {
        return await publicCompanyMarket(company.symbol);
      } catch {
        return { symbol: company.symbol, price: null, previousClose: null, returns: { day: null, week: null, month: null, quarter: null } };
      }
    })));
  }
  if (!companies.some((company) => company.price !== null)) throw new Error("Public market fallback could not load any sector prices.");
  const snapshot: SectorMarketSnapshot = {
    status: "public_delayed",
    sectorId,
    asOf: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date()),
    message: `Public delayed market fallback (Yahoo Finance). Kite account access is valid, but Kite market-data calls failed: ${reason}`,
    companies,
  };
  state.publicFallback.set(sectorId, { expiresAt: Date.now() + 5 * 60_000, snapshot });
  return snapshot;
}

export async function getSectorMarketSnapshot(sectorId: string): Promise<SectorMarketSnapshot> {
  const universe = sectorCompanies[sectorId] ?? sectorCompanies.pharma;
  try {
    const instruments = universe.map((company) => `NSE:${company.symbol}`);
    let raw: unknown;
    let quoteMode = "full quotes";
    try {
      raw = await callKiteTool("get_quotes", { instruments });
    } catch {
      try {
        raw = await callKiteTool("get_ohlc", { instruments });
        quoteMode = "OHLC fallback";
      } catch {
        raw = await callKiteTool("get_ltp", { instruments });
        quoteMode = "LTP fallback";
      }
    }
    const quotes = quoteMap(raw);
    const rows = universe.map((company) => {
      const quote = object(quotes[`NSE:${company.symbol}`]);
      const ohlc = object(quote.ohlc);
      const price = numberOrNull(quote.last_price);
      const previousClose = numberOrNull(ohlc.close);
      return {
        symbol: company.symbol,
        price,
        previousClose,
        instrumentToken: numberOrNull(quote.instrument_token),
        returns: { day: percent(price, previousClose), week: null, month: null, quarter: null },
      };
    });
    const companies = await addHistory(rows);
    const snapshot: SectorMarketSnapshot = {
      status: "live",
      sectorId,
      asOf: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date()),
      message: `Live Kite ${quoteMode}; multi-period returns use the latest cached daily closes.`,
      companies,
    };
    state.lastGood.set(sectorId, snapshot);
    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sector market data could not be loaded.";
    const cached = state.lastGood.get(sectorId);
    if (cached) return { ...cached, status: "cached", message: `Kite refresh failed. ${message}` };
    let authRequired = /log in|login|authentication|required|token/i.test(message);
    if (!authRequired && /failed to get (?:quotes|OHLC|latest trading prices)/i.test(message)) {
      try {
        await callKiteTool("get_profile");
      } catch {
        authRequired = true;
      }
    }
    try {
      return await getPublicSectorMarketSnapshot(sectorId, authRequired ? "Kite authentication is required." : message);
    } catch {
      // Preserve the explicit Kite state if the independent public source also fails.
    }
    return {
      status: authRequired ? "auth_required" : "unavailable",
      sectorId,
      asOf: "Research universe reviewed · 16 Jul 2026",
      message: authRequired ? "Authenticate Kite to populate live prices and return rankings." : message,
      companies: universe.map((company) => ({
        symbol: company.symbol,
        price: null,
        previousClose: null,
        returns: { day: null, week: null, month: null, quarter: null },
      })),
    };
  }
}
