import { spawn } from "node:child_process";
import path from "node:path";
import { detectRuntimeTools } from "../runtime-tools-server";
import { resolveYfinancePythonBin } from "./yfinance-kpis";
import {
  fromYahooTicker,
  type InstrumentQuoteKpis,
} from "./yfinance-tickers";

const root = process.cwd();
const yfinanceScript = path.join(root, "scripts/fetch-sector-quotes-yfinance.py");

export type YfinanceSearchInstrument = InstrumentQuoteKpis & {
  symbol: string;
  tradingsymbol: string;
  yahooTicker: string;
  name: string;
  source: "yfinance";
};

export type YfinanceSearchSnapshot = {
  status: "ok" | "unavailable";
  query: string;
  message: string;
  instruments: YfinanceSearchInstrument[];
};

let lastGoodSearch: YfinanceSearchSnapshot | undefined;
const lastQuoteBySymbol = new Map<string, YfinanceSearchInstrument>();

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseYfinanceStdout(stdout: string): unknown {
  const lines = stdout.trim().split("\n").filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]!);
    } catch {
      continue;
    }
  }
  return JSON.parse(stdout);
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInstrument(raw: unknown): YfinanceSearchInstrument | undefined {
  const row = object(raw);
  const yahooTicker = String(row.yahooTicker ?? row.symbol ?? "").trim().toUpperCase();
  const symbol = fromYahooTicker(String(row.symbol ?? row.tradingsymbol ?? yahooTicker));
  if (!symbol) return undefined;
  const name = String(row.name ?? "").trim() || symbol;
  const instrument: YfinanceSearchInstrument = {
    symbol,
    tradingsymbol: String(row.tradingsymbol ?? symbol).trim().toUpperCase() || symbol,
    yahooTicker: yahooTicker || `${symbol}.NS`,
    name,
    source: "yfinance",
  };
  const price = numberOrUndefined(row.price ?? row.lastPrice);
  const changePct = numberOrUndefined(row.changePct);
  const marketCap = numberOrUndefined(row.marketCap);
  const pe = numberOrUndefined(row.pe);
  const sector = String(row.sector ?? "").trim();
  const exchange = String(row.exchange ?? "").trim();
  const currency = String(row.currency ?? "").trim().toUpperCase();
  const asOf = String(row.asOf ?? "").trim();
  if (price !== undefined) instrument.price = price;
  if (changePct !== undefined) instrument.changePct = changePct;
  if (marketCap !== undefined) instrument.marketCap = marketCap;
  if (pe !== undefined) instrument.pe = pe;
  if (sector) instrument.sector = sector;
  if (exchange) instrument.exchange = exchange;
  if (currency) instrument.currency = currency;
  if (asOf) instrument.asOf = asOf;
  lastQuoteBySymbol.set(symbol, instrument);
  return instrument;
}

function retainLastSearch(query: string, message: string): YfinanceSearchSnapshot {
  if (lastGoodSearch?.instruments.length) {
    return {
      status: "unavailable",
      query,
      message: `${message} Retaining the last validated yfinance snapshot.`,
      instruments: lastGoodSearch.instruments,
    };
  }
  return { status: "unavailable", query, message, instruments: [] };
}

async function yfinanceDetected(): Promise<string> {
  const tools = await detectRuntimeTools();
  const yfinance = tools.find((tool) => tool.id === "yfinance");
  if (yfinance?.status === "detected") return "";
  return yfinance?.detail || "yfinance status unknown. Search stays unavailable until the package is installed.";
}

function runYfinancePayload(payload: Record<string, unknown>, timeoutMs = 45_000) {
  const pythonBin = resolveYfinancePythonBin();
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(pythonBin, [yfinanceScript], {
      env: {
        ...process.env,
        PYTHONPYCACHEPREFIX: "/tmp/portfolio-strategy-pycache",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`yfinance search timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
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
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function searchYfinanceInstruments(query: string, limit = 8): Promise<YfinanceSearchSnapshot> {
  const normalized = query.trim();
  if (!normalized) {
    return { status: "ok", query: "", message: "", instruments: [] };
  }

  const missing = await yfinanceDetected();
  if (missing) return retainLastSearch(normalized, `Unavailable: ${missing}`);

  try {
    const { stdout } = await runYfinancePayload({
      mode: "search",
      query: normalized,
      limit: Math.max(1, Math.min(12, limit)),
    });
    const payload = object(parseYfinanceStdout(stdout));
    const instruments = (Array.isArray(payload.instruments) ? payload.instruments : [])
      .map(parseInstrument)
      .filter((row): row is YfinanceSearchInstrument => Boolean(row));
    const snapshot: YfinanceSearchSnapshot = {
      status: "ok",
      query: normalized,
      message: "",
      instruments,
    };
    lastGoodSearch = snapshot;
    return snapshot;
  } catch (error) {
    const text = error instanceof Error ? error.message : "yfinance search failed.";
    return retainLastSearch(normalized, `Unavailable: ${text}`);
  }
}

export async function loadYfinanceQuoteKpis(symbols: readonly string[]): Promise<YfinanceSearchSnapshot> {
  const unique = [...new Set(symbols.map((item) => fromYahooTicker(item)).filter(Boolean))];
  if (!unique.length) {
    return { status: "ok", query: "", message: "", instruments: [] };
  }

  const missing = await yfinanceDetected();
  if (missing) {
    const retained = unique.flatMap((symbol) => {
      const row = lastQuoteBySymbol.get(symbol);
      return row ? [row] : [];
    });
    return {
      status: "unavailable",
      query: unique.join(","),
      message: retained.length
        ? `Unavailable: ${missing} Retaining the last validated yfinance snapshot.`
        : `Unavailable: ${missing}`,
      instruments: retained,
    };
  }

  try {
    const { stdout } = await runYfinancePayload({ mode: "quote_kpis", symbols: unique });
    const payload = object(parseYfinanceStdout(stdout));
    const instruments = (Array.isArray(payload.instruments) ? payload.instruments : [])
      .map(parseInstrument)
      .filter((row): row is YfinanceSearchInstrument => Boolean(row));
    return { status: "ok", query: unique.join(","), message: "", instruments };
  } catch (error) {
    const text = error instanceof Error ? error.message : "yfinance quote KPI fetch failed.";
    const retained = unique.flatMap((symbol) => {
      const row = lastQuoteBySymbol.get(symbol);
      return row ? [row] : [];
    });
    return {
      status: "unavailable",
      query: unique.join(","),
      message: retained.length
        ? `Unavailable: ${text} Retaining the last validated yfinance snapshot.`
        : `Unavailable: ${text}`,
      instruments: retained,
    };
  }
}

export function resetYfinanceSearchCache() {
  lastGoodSearch = undefined;
  lastQuoteBySymbol.clear();
}
