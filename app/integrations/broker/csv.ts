import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadIntegrationsConfig } from "../store";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export type CachedCsvHoldings = {
  status: "cached";
  asOf: string;
  brokerId: string;
  rows: Array<{ symbol: string; quantity: number; averagePrice?: number; name?: string }>;
  message: string;
};

export function csvHoldingsPath() {
  return process.env.BROKER_CSV_PATH || join(ROOT, "artifacts/private/broker-csv-holdings.json");
}

export function loadCsvHoldings(): CachedCsvHoldings | null {
  try {
    const parsed = JSON.parse(readFileSync(csvHoldingsPath(), "utf8")) as CachedCsvHoldings;
    if (parsed?.status !== "cached" || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseHoldingsCsv(text: string): CachedCsvHoldings["rows"] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0]!.split(/[,|\t]/).map((part) => part.trim().toLowerCase());
  const hasHeader = header.includes("symbol") || header.includes("tradingsymbol");
  const body = hasHeader ? lines.slice(1) : lines;
  const symbolIndex = hasHeader ? header.findIndex((part) => part === "symbol" || part === "tradingsymbol") : 0;
  const qtyIndex = hasHeader ? header.findIndex((part) => part === "qty" || part === "quantity") : 1;
  const avgIndex = hasHeader ? header.findIndex((part) => part === "avg" || part === "average" || part === "averageprice") : 2;
  const nameIndex = hasHeader ? header.findIndex((part) => part === "name") : -1;
  return body.map((line) => {
    const cols = line.split(/[,|\t]/).map((part) => part.trim());
    return {
      symbol: String(cols[Math.max(symbolIndex, 0)] ?? "").toUpperCase(),
      quantity: Number(cols[qtyIndex] ?? 0) || 0,
      averagePrice: avgIndex >= 0 ? Number(cols[avgIndex]) || undefined : undefined,
      name: nameIndex >= 0 ? cols[nameIndex] : undefined,
    };
  }).filter((row) => row.symbol && row.quantity > 0);
}

export function saveCsvHoldings(text: string, brokerId = "grow"): CachedCsvHoldings {
  const config = loadIntegrationsConfig();
  const payload: CachedCsvHoldings = {
    status: "cached",
    asOf: new Date().toISOString(),
    brokerId: brokerId || config.broker.id,
    rows: parseHoldingsCsv(text),
    message: "CSV holdings are cached only and are never labelled live.",
  };
  const path = csvHoldingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}
