import { spawn } from "node:child_process";
import path from "node:path";
import { callKiteTool } from "./kite-live-server";
import { sectorCompanies } from "./sector-company-data";
import type { SectorCompanyMarket, SectorMarketSnapshot, SectorReturnHorizon } from "./sector-live-types";

const root = process.cwd();
const yfinanceScript = path.join(root, "scripts/fetch-sector-quotes-yfinance.py");
const flaskPython = path.join(root, ".venv-flask/bin/python");

type JsonObject = Record<string, unknown>;
type HistoryEntry = { date: string; returns: Record<Exclude<SectorReturnHorizon, "day">, number | null> };
type SectorRuntimeState = {
  history: Map<string, HistoryEntry>;
  lastGood: Map<string, SectorMarketSnapshot>;
  yfinanceCache: Map<string, { expiresAt: number; snapshot: SectorMarketSnapshot }>;
};

const globalState = globalThis as typeof globalThis & { __sectorRuntime?: SectorRuntimeState };
const state = globalState.__sectorRuntime ??= { history: new Map(), lastGood: new Map(), yfinanceCache: new Map() };
state.yfinanceCache ??= new Map();

let rateLimitedUntil = 0;
let authProbeCache: { valid: boolean; expiresAt: number } | undefined;

const CONNECT_MARKET_DATA_MESSAGE =
  "Kite Connect paid market-data permission is required. Zerodha Personal (free) apps cannot serve live sector quotes.";

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimited() {
  return Date.now() < rateLimitedUntil;
}

function isRateLimitError(message: string) {
  return /too many requests|rate limit/i.test(message);
}

function isInsufficientPermissionError(message: string) {
  return /insufficient permission/i.test(message);
}

function isAuthError(message: string) {
  return /log in|login|authentication|required|token/i.test(message);
}

function markRateLimited(message: string) {
  if (!isRateLimitError(message)) return;
  rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + 60_000);
}

function permissionFailure(message: string) {
  return new Error(`${CONNECT_MARKET_DATA_MESSAGE} ${message}`);
}

function asOfLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

function resolvePythonBin() {
  return process.env.PORTFOLIO_SECTOR_PYTHON
    ?? (process.env.PORTFOLIO_FLASK_VENV ? path.join(process.env.PORTFOLIO_FLASK_VENV, "bin/python") : flaskPython);
}

export async function kiteAuthLikelyValid() {
  if (authProbeCache && authProbeCache.expiresAt > Date.now()) return authProbeCache.valid;
  try {
    await callKiteTool("get_profile");
    authProbeCache = { valid: true, expiresAt: Date.now() + 60_000 };
    return true;
  } catch {
    authProbeCache = { valid: false, expiresAt: Date.now() + 60_000 };
    return false;
  }
}

export async function loadKiteQuotes(instruments: string[]) {
  if (isRateLimited()) throw new Error("Zerodha rate limit reached");

  // Prefer LTP first, then OHLC, then full quotes.
  const attempts = [
    { tool: "get_ltp", mode: "LTP" },
    { tool: "get_ohlc", mode: "OHLC" },
    { tool: "get_quotes", mode: "full quotes" },
  ] as const;

  let lastError: Error | undefined;
  for (const attempt of attempts) {
    try {
      const raw = await callKiteTool(attempt.tool, { instruments });
      return { raw, quoteMode: attempt.mode };
    } catch (error) {
      const message = errorMessage(error);
      lastError = error instanceof Error ? error : new Error(message);
      if (isInsufficientPermissionError(message)) throw permissionFailure(message);
      if (isRateLimitError(message)) {
        markRateLimited(message);
        throw new Error("Zerodha rate limit reached");
      }
    }
  }

  throw lastError ?? new Error("Kite market data could not be loaded.");
}

function quoteMap(raw: unknown) {
  const rootObj = object(raw);
  const data = Object.keys(object(rootObj.data)).length ? object(rootObj.data) : rootObj;
  return data;
}

function candles(raw: unknown) {
  const rootObj = object(raw);
  const candidates = Array.isArray(raw)
    ? raw
    : Array.isArray(rootObj.candles)
      ? rootObj.candles
      : Array.isArray(object(rootObj.data).candles)
        ? object(rootObj.data).candles as unknown[]
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
  if (instrumentToken === null || isRateLimited()) return empty;

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
  } catch (error) {
    const message = errorMessage(error);
    if (isRateLimitError(message)) markRateLimited(message);
    return empty;
  }
}

async function addHistory(rows: Array<SectorCompanyMarket & { instrumentToken: number | null }>, skipHistorical = false) {
  if (skipHistorical) {
    return rows.map((row) => ({
      symbol: row.symbol,
      price: row.price,
      previousClose: row.previousClose,
      returns: row.returns,
    }));
  }

  const enriched: SectorCompanyMarket[] = [];
  for (let index = 0; index < rows.length; index += 3) {
    if (isRateLimited()) {
      enriched.push(...rows.slice(index).map((row) => ({
        symbol: row.symbol,
        price: row.price,
        previousClose: row.previousClose,
        returns: row.returns,
      })));
      break;
    }
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

function parseYfinanceCompanies(raw: unknown): SectorCompanyMarket[] {
  const rootObj = object(raw);
  const list = Array.isArray(rootObj.companies) ? rootObj.companies : [];
  return list.map((item) => {
    const company = object(item);
    const returns = object(company.returns);
    return {
      symbol: String(company.symbol ?? ""),
      price: numberOrNull(company.price),
      previousClose: numberOrNull(company.previousClose),
      returns: {
        day: numberOrNull(returns.day),
        week: numberOrNull(returns.week),
        month: numberOrNull(returns.month),
        quarter: numberOrNull(returns.quarter),
      },
    };
  }).filter((company) => company.symbol);
}

function runYfinanceScript(symbols: string[]) {
  const pythonBin = resolvePythonBin();
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(pythonBin, [yfinanceScript], {
      env: {
        ...process.env,
        PYTHONPYCACHEPREFIX: "/tmp/portfolio-sector-pycache",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("yfinance sector quote fetch timed out after 90s."));
    }, 90_000);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `yfinance exited with code ${code ?? "unknown"}`));
    });
    child.stdin.write(JSON.stringify({ symbols }));
    child.stdin.end();
  });
}

export async function loadYfinanceSectorQuotes(symbols: string[]) {
  const { stdout, stderr } = await runYfinanceScript(symbols);
  const payload = JSON.parse(stdout) as unknown;
  const companies = parseYfinanceCompanies(payload);
  if (!companies.some((company) => company.price !== null)) {
    throw new Error(stderr.trim() || "yfinance returned no sector prices.");
  }
  return companies;
}

export async function getYfinanceSectorMarketSnapshot(sectorId: string): Promise<SectorMarketSnapshot> {
  const cached = state.yfinanceCache.get(sectorId);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

  const universe = sectorCompanies[sectorId] ?? sectorCompanies.pharma;
  const companies = await loadYfinanceSectorQuotes(universe.map((company) => company.symbol));
  const bySymbol = new Map(companies.map((company) => [company.symbol, company]));
  const ordered = universe.map((company) => bySymbol.get(company.symbol) ?? {
    symbol: company.symbol,
    price: null,
    previousClose: null,
    returns: { day: null, week: null, month: null, quarter: null },
  });

  if (!ordered.some((company) => company.price !== null)) {
    throw new Error("yfinance returned no sector prices.");
  }

  const snapshot: SectorMarketSnapshot = {
    status: "live",
    sectorId,
    asOf: asOfLabel(),
    message: "Live yfinance NSE quotes; multi-period returns use daily closes. Kite paid market-data is optional for sector snapshots.",
    companies: ordered,
  };
  state.yfinanceCache.set(sectorId, { expiresAt: Date.now() + 60_000, snapshot });
  state.lastGood.set(sectorId, snapshot);
  return snapshot;
}

async function getKiteSectorMarketSnapshot(sectorId: string): Promise<SectorMarketSnapshot> {
  const universe = sectorCompanies[sectorId] ?? sectorCompanies.pharma;
  const instruments = universe.map((company) => `NSE:${company.symbol}`);
  const { raw, quoteMode } = await loadKiteQuotes(instruments);
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
  return {
    status: "live",
    sectorId,
    asOf: asOfLabel(),
    message: `Live Kite ${quoteMode}; multi-period returns use the latest cached daily closes.`,
    companies,
  };
}

/** @deprecated Kept for route catch-all compatibility; prefer getYfinanceSectorMarketSnapshot. */
export async function getPublicSectorMarketSnapshot(sectorId: string, reason: string): Promise<SectorMarketSnapshot> {
  try {
    const snapshot = await getYfinanceSectorMarketSnapshot(sectorId);
    return {
      ...snapshot,
      message: `Live yfinance NSE quotes (route fallback). ${reason}`,
    };
  } catch (error) {
    const universe = sectorCompanies[sectorId] ?? sectorCompanies.pharma;
    return {
      status: "unavailable",
      sectorId,
      asOf: asOfLabel(),
      message: `yfinance sector quotes unavailable. ${reason} Detail: ${errorMessage(error)}`,
      companies: universe.map((company) => ({
        symbol: company.symbol,
        price: null,
        previousClose: null,
        returns: { day: null, week: null, month: null, quarter: null },
      })),
    };
  }
}

export async function getSectorMarketSnapshot(sectorId: string): Promise<SectorMarketSnapshot> {
  const universe = sectorCompanies[sectorId] ?? sectorCompanies.pharma;

  try {
    return await getYfinanceSectorMarketSnapshot(sectorId);
  } catch (yfinanceError) {
    const yfinanceMessage = errorMessage(yfinanceError);

    try {
      const kiteSnapshot = await getKiteSectorMarketSnapshot(sectorId);
      state.lastGood.set(sectorId, kiteSnapshot);
      return kiteSnapshot;
    } catch (kiteError) {
      const message = errorMessage(kiteError);
      const cached = state.lastGood.get(sectorId);
      if (cached) {
        const suffix = isRateLimitError(message)
          ? "Zerodha rate limit reached; retaining the last validated sector snapshot."
          : `yfinance: ${yfinanceMessage}. Kite: ${message}`;
        return { ...cached, status: "cached", message: `Sector refresh failed. ${suffix}` };
      }

      const permissionDenied = isInsufficientPermissionError(message) || message.includes(CONNECT_MARKET_DATA_MESSAGE);
      let authRequired = isAuthError(message);
      if (!authRequired && !permissionDenied) {
        authRequired = !(await kiteAuthLikelyValid());
      }

      return {
        status: authRequired ? "auth_required" : "unavailable",
        sectorId,
        asOf: asOfLabel(),
        message: `yfinance failed (${yfinanceMessage}). ${permissionDenied ? CONNECT_MARKET_DATA_MESSAGE : message}`,
        companies: universe.map((company) => ({
          symbol: company.symbol,
          price: null,
          previousClose: null,
          returns: { day: null, week: null, month: null, quarter: null },
        })),
      };
    }
  }
}
