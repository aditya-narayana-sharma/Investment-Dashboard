import { spawn } from "node:child_process";
import path from "node:path";
import type { OhlcvBar } from "./tree-indicators";

const root = process.cwd();
const yfinanceScript = path.join(root, "scripts/fetch-sector-quotes-yfinance.py");
const flaskPython = path.join(root, ".venv-flask/bin/python");

export type YfinanceFundamentals = {
  revenue?: number;
  sales?: number;
  operatingMargin?: number;
  profitMargin?: number;
  pat?: number;
  ebitda?: number;
  salesGrowthYoy?: number;
  peTtm?: number;
  peFwd?: number;
  pb?: number;
  psTtm?: number;
  evEbitda?: number;
  evSales?: number;
  dividendYield?: number;
  earningsYield?: number;
  fcfYield?: number;
  roe?: number;
  roce?: number;
  peg?: number;
  priceToFcf?: number;
  bookYield?: number;
  evEbit?: number;
  freeCashflow?: number;
  marketCap?: number;
};

export type YfinanceSymbolKpis = {
  symbol: string;
  asOf?: string;
  ohlcv: OhlcvBar[];
  fundamentals: YfinanceFundamentals;
  source: "yfinance";
};

function resolvePythonBin() {
  return process.env.PORTFOLIO_SECTOR_PYTHON
    ?? (process.env.PORTFOLIO_FLASK_VENV ? path.join(process.env.PORTFOLIO_FLASK_VENV, "bin/python") : flaskPython);
}

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

function parseOhlcv(raw: unknown): OhlcvBar[] {
  if (!Array.isArray(raw)) return [];
  const bars: OhlcvBar[] = [];
  for (const item of raw) {
    const row = object(item);
    const open = numberOrUndefined(row.open);
    const high = numberOrUndefined(row.high);
    const low = numberOrUndefined(row.low);
    const close = numberOrUndefined(row.close);
    const volume = numberOrUndefined(row.volume);
    if (open === undefined || high === undefined || low === undefined || close === undefined || volume === undefined) {
      continue;
    }
    bars.push({
      date: typeof row.date === "string" ? row.date : "",
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return bars;
}

const FUNDAMENTAL_KEYS = [
  "revenue", "sales", "operatingMargin", "profitMargin", "pat", "ebitda",
  "salesGrowthYoy", "peTtm", "peFwd", "pb", "psTtm", "evEbitda", "evSales",
  "dividendYield", "earningsYield", "fcfYield", "roe", "roce", "peg",
  "priceToFcf", "bookYield", "evEbit", "freeCashflow", "marketCap",
] as const;

function parseFundamentals(raw: unknown): YfinanceFundamentals {
  const row = object(raw);
  const fundamentals: YfinanceFundamentals = {};
  for (const key of FUNDAMENTAL_KEYS) {
    const value = numberOrUndefined(row[key]);
    if (value !== undefined) fundamentals[key] = value;
  }
  return fundamentals;
}

export type LoadYfinanceStrategyKpisOptions = {
  ohlcvOnly?: boolean;
  timeoutMs?: number;
};

function runYfinanceKpis(symbols: string[], options: LoadYfinanceStrategyKpisOptions = {}) {
  const pythonBin = resolvePythonBin();
  const timeoutMs = options.timeoutMs ?? 90_000;
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
      reject(new Error(`yfinance strategy KPI fetch timed out after ${Math.round(timeoutMs / 1000)}s.`));
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
    child.stdin.write(JSON.stringify({
      mode: "strategy_kpis",
      symbols,
      ohlcvOnly: options.ohlcvOnly === true,
    }));
    child.stdin.end();
  });
}

export async function loadYfinanceStrategyKpis(
  symbols: string[],
  options: LoadYfinanceStrategyKpisOptions = {},
): Promise<YfinanceSymbolKpis[]> {
  const unique = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return [];
  const { stdout } = await runYfinanceKpis(unique, options);
  const payload = parseYfinanceStdout(stdout);
  const rootObj = object(payload);
  const list = Array.isArray(rootObj.companies) ? rootObj.companies : [];
  return list.map((item) => {
    const company = object(item);
    return {
      symbol: String(company.symbol ?? "").trim().toUpperCase(),
      asOf: typeof company.asOf === "string" ? company.asOf : undefined,
      ohlcv: parseOhlcv(company.ohlcv),
      fundamentals: parseFundamentals(company.fundamentals),
      source: "yfinance" as const,
    };
  }).filter((company) => company.symbol);
}
