import { spawn } from "node:child_process";
import path from "node:path";
import {
  BENCHMARK_FACTSHEET_URL,
  placeholderBenchmarkIndex,
  SECTOR_BENCHMARK_REGISTRY,
} from "./sector-benchmark-registry";
import type { SectorBenchmarkIndex, SectorBenchmarkSnapshot } from "./sector-live-types";

const root = process.cwd();
const script = path.join(root, "scripts/fetch-sector-benchmarks-yfinance.py");
const flaskPython = path.join(root, ".venv-flask/bin/python");

type RawIndex = {
  id: string;
  level?: number;
  returns?: SectorBenchmarkIndex["returns"];
  indexedHistory?: SectorBenchmarkIndex["indexedHistory"];
  volatility?: number;
  maxDrawdown?: number;
  squeezeWidth?: number;
  observedAt?: string;
  source?: string;
  sourceUrl?: string;
  period?: string;
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
    child.stdin.end(JSON.stringify({ registry: SECTOR_BENCHMARK_REGISTRY }));
  });
}

export async function getSectorBenchmarkSnapshot(): Promise<SectorBenchmarkSnapshot> {
  if (state.snapshot && state.expiresAt > Date.now()) return state.snapshot;
  try {
    const rows = await runFetcher();
    const byId = new Map(rows.map((row) => [row.id, row]));
    const now = new Date().toISOString();
    const indices: SectorBenchmarkIndex[] = SECTOR_BENCHMARK_REGISTRY.map((item) => {
      const row = byId.get(item.id);
      const available = Boolean(row?.level != null && (row.indexedHistory?.length ?? 0) >= 2);
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
        source: available ? row?.source ?? "Exact-index delayed EOD history" : "NSE Indices canonical definition",
        sourceUrl: available ? row?.sourceUrl ?? BENCHMARK_FACTSHEET_URL : BENCHMARK_FACTSHEET_URL,
        observedAt: row?.observedAt ?? now,
        period: available ? row?.period ?? "Up to one year of daily closes" : row?.error ?? "Official NSE and exact-index fallback returned insufficient history",
        freshness: available ? "public_delayed" : "unavailable",
      };
    });
    const availableIndices = SECTOR_BENCHMARK_REGISTRY.filter((item) => {
      const index = indices.find((candidate) => candidate.id === item.id);
      return Boolean(index?.level !== null && index.indexedHistory.length >= 2);
    }).length;
    const totalIndices = SECTOR_BENCHMARK_REGISTRY.length;
    const unavailableNames = indices.filter((index) => index.freshness === "unavailable").map((index) => index.officialName);
    const status: SectorBenchmarkSnapshot["status"] = availableIndices === totalIndices && totalIndices > 0
      ? "live"
      : availableIndices > 0
        ? "partial"
        : "unavailable";
    const snapshot: SectorBenchmarkSnapshot = {
      status,
      asOf: now,
      message: status === "live"
        ? `${availableIndices}/${totalIndices} official or exact-index daily histories available.`
        : status === "partial"
          ? `${availableIndices}/${totalIndices} daily histories available. Insufficient series: ${unavailableNames.join(", ") || "none"}.`
          : `No benchmark has the minimum two official or exact-index closing observations required for a chart.`,
      indices,
    };
    state.snapshot = snapshot;
    state.expiresAt = Date.now() + 5 * 60_000;
    if (availableIndices) state.lastGood = snapshot;
    return snapshot;
  } catch (error) {
    if (state.lastGood) return { ...state.lastGood, status: "cached", message: `Benchmark refresh failed; preserving last validated snapshot. ${String(error)}` };
    const now = new Date().toISOString();
    return {
      status: "unavailable",
      asOf: now,
      message: `Benchmark history unavailable. ${String(error)}`,
      indices: SECTOR_BENCHMARK_REGISTRY.map((item) => placeholderBenchmarkIndex(item, now)),
    };
  }
}
