import { spawn } from "node:child_process";
import path from "node:path";
import type { SectorBenchmarkIndex, SectorBenchmarkSnapshot } from "./sector-live-types";

const root = process.cwd();
const script = path.join(root, "scripts/fetch-sector-benchmarks-yfinance.py");
const flaskPython = path.join(root, ".venv-flask/bin/python");
const factsheetUrl = "https://www.niftyindices.com/reports/index-factsheet";

const registry = [
  { id: "nifty-50", officialName: "NIFTY 50", family: "broad", ticker: "^NSEI" },
  { id: "nifty-bank", officialName: "NIFTY Bank", family: "sector", ticker: "^NSEBANK" },
  { id: "nifty-it", officialName: "NIFTY IT", family: "sector", ticker: "^CNXIT" },
  { id: "nifty-auto", officialName: "NIFTY Auto", family: "sector", ticker: "^CNXAUTO" },
  { id: "nifty-alpha-50", officialName: "NIFTY Alpha 50", family: "strategy", ticker: "" },
  { id: "nifty200-alpha-30", officialName: "NIFTY200 Alpha 30", family: "strategy", ticker: "" },
  { id: "nifty100-low-vol-30", officialName: "NIFTY100 Low Volatility 30", family: "strategy", ticker: "" },
] as const;

type RawIndex = {
  id: string;
  level?: number;
  returns?: SectorBenchmarkIndex["returns"];
  indexedHistory?: SectorBenchmarkIndex["indexedHistory"];
  volatility?: number;
  maxDrawdown?: number;
  squeezeWidth?: number;
  observedAt?: string;
  error?: string;
};

const state: { expiresAt: number; snapshot?: SectorBenchmarkSnapshot; lastGood?: SectorBenchmarkSnapshot } = { expiresAt: 0 };

function runFetcher() {
  return new Promise<RawIndex[]>((resolve, reject) => {
    const pythonBin = process.env.PORTFOLIO_SECTOR_PYTHON
      ?? (process.env.PORTFOLIO_FLASK_VENV ? path.join(process.env.PORTFOLIO_FLASK_VENV, "bin/python") : flaskPython);
    const child = spawn(pythonBin, [script], {
      cwd: root,
      env: { ...process.env, PYTHONPYCACHEPREFIX: "/tmp/portfolio-benchmark-pycache" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Benchmark history fetch timed out."));
    }, 90_000);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Benchmark fetch exited with ${code}`));
        return;
      }
      try {
        resolve((JSON.parse(stdout) as { indices?: RawIndex[] }).indices ?? []);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify({ registry }));
  });
}

export async function getSectorBenchmarkSnapshot(): Promise<SectorBenchmarkSnapshot> {
  if (state.snapshot && state.expiresAt > Date.now()) return state.snapshot;
  try {
    const rows = await runFetcher();
    const byId = new Map(rows.map((row) => [row.id, row]));
    const now = new Date().toISOString();
    const indices: SectorBenchmarkIndex[] = registry.map((item) => {
      const row = byId.get(item.id);
      const hasTicker = Boolean(item.ticker);
      const available = Boolean(row?.level && row.indexedHistory?.length);
      return {
        id: item.id,
        officialName: item.officialName,
        family: item.family,
        level: row?.level ?? null,
        returns: row?.returns ?? { day: null, week: null, month: null, quarter: null, halfYear: null, year: null },
        indexedHistory: row?.indexedHistory ?? [],
        volatility: row?.volatility ?? null,
        maxDrawdown: row?.maxDrawdown ?? null,
        squeezeWidth: row?.squeezeWidth ?? null,
        source: available ? "Yahoo Finance delayed NSE index history" : "NSE Indices canonical definition",
        sourceUrl: factsheetUrl,
        observedAt: row?.observedAt ?? now,
        period: available
          ? "Up to one year of daily closes"
          : hasTicker
            ? "Configured ticker returned no exact market series"
            : "Definition only · no exact public Yahoo series (ETF proxies not substituted)",
        freshness: available ? "public_delayed" : "unavailable",
      };
    });
    const tickerBacked = registry.filter((item) => Boolean(item.ticker));
    const availableTickerBacked = tickerBacked.filter((item) => {
      const index = indices.find((candidate) => candidate.id === item.id);
      return Boolean(index?.level !== null && index.indexedHistory.length);
    }).length;
    const definitionOnly = registry.filter((item) => !item.ticker).map((item) => item.officialName);
    const status: SectorBenchmarkSnapshot["status"] = availableTickerBacked === tickerBacked.length && tickerBacked.length > 0
      ? "live"
      : availableTickerBacked > 0
        ? "partial"
        : "unavailable";
    const snapshot: SectorBenchmarkSnapshot = {
      status,
      asOf: now,
      message: status === "live"
        ? `${availableTickerBacked}/${tickerBacked.length} ticker-backed index histories live. Definition-only residual gap (no exact public series; ETF proxies not substituted): ${definitionOnly.join(", ")}.`
        : status === "partial"
          ? `${availableTickerBacked}/${tickerBacked.length} ticker-backed histories available. Failed or empty series demote freshness; definition-only indices remain ${definitionOnly.join(", ")}.`
          : `No ticker-backed NSE index histories available. Definition-only indices: ${definitionOnly.join(", ")}.`,
      indices,
    };
    state.snapshot = snapshot;
    state.expiresAt = Date.now() + 5 * 60_000;
    if (availableTickerBacked) state.lastGood = snapshot;
    return snapshot;
  } catch (error) {
    if (state.lastGood) return { ...state.lastGood, status: "cached", message: `Benchmark refresh failed; preserving last validated snapshot. ${String(error)}` };
    return {
      status: "unavailable",
      asOf: new Date().toISOString(),
      message: `Benchmark history unavailable. ${String(error)}`,
      indices: registry.map((item) => ({
        id: item.id,
        officialName: item.officialName,
        family: item.family,
        level: null,
        returns: { day: null, week: null, month: null, quarter: null, halfYear: null, year: null },
        indexedHistory: [],
        volatility: null,
        maxDrawdown: null,
        squeezeWidth: null,
        source: "NSE Indices canonical definition",
        sourceUrl: factsheetUrl,
        observedAt: new Date().toISOString(),
        period: "Unavailable",
        freshness: "unavailable",
      })),
    };
  }
}
