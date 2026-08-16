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
  evEbitda?: number;
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

function parseFundamentals(raw: unknown): YfinanceFundamentals {
  const row = object(raw);
  const fundamentals: YfinanceFundamentals = {};
  const revenue = numberOrUndefined(row.revenue);
  const sales = numberOrUndefined(row.sales);
  const operatingMargin = numberOrUndefined(row.operatingMargin);
  const profitMargin = numberOrUndefined(row.profitMargin);
  const pat = numberOrUndefined(row.pat);
  const ebitda = numberOrUndefined(row.ebitda);
  const salesGrowthYoy = numberOrUndefined(row.salesGrowthYoy);
  const peTtm = numberOrUndefined(row.peTtm);
  const evEbitda = numberOrUndefined(row.evEbitda);
  if (revenue !== undefined) fundamentals.revenue = revenue;
  if (sales !== undefined) fundamentals.sales = sales;
  if (operatingMargin !== undefined) fundamentals.operatingMargin = operatingMargin;
  if (profitMargin !== undefined) fundamentals.profitMargin = profitMargin;
  if (pat !== undefined) fundamentals.pat = pat;
  if (ebitda !== undefined) fundamentals.ebitda = ebitda;
  if (salesGrowthYoy !== undefined) fundamentals.salesGrowthYoy = salesGrowthYoy;
  if (peTtm !== undefined) fundamentals.peTtm = peTtm;
  if (evEbitda !== undefined) fundamentals.evEbitda = evEbitda;
  return fundamentals;
}

function runYfinanceKpis(symbols: string[]) {
  const pythonBin = resolvePythonBin();
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
      reject(new Error("yfinance strategy KPI fetch timed out after 90s."));
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
    child.stdin.write(JSON.stringify({ mode: "strategy_kpis", symbols }));
    child.stdin.end();
  });
}

export async function loadYfinanceStrategyKpis(symbols: string[]): Promise<YfinanceSymbolKpis[]> {
  const unique = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return [];
  const { stdout } = await runYfinanceKpis(unique);
  const payload = JSON.parse(stdout) as unknown;
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
