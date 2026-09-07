#!/usr/bin/env node
/**
 * Fetch the official NSE Nifty 500 constituent list and write a labeled cache.
 * Source: NSE Indices CSV (nsearchives.nseindia.com). Names are not invented.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv";
const FALLBACK_URL = "https://archives.nseindia.com/content/indices/ind_nifty500list.csv";
const OUT_PATH = fileURLToPath(new URL("../app/strategy/builder-universe.cache.json", import.meta.url));

function isBeesSymbol(symbol) {
  return symbol.trim().toUpperCase().endsWith("BEES");
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0]?.split(",") ?? [];
  const symbolIdx = header.findIndex((col) => col.trim() === "Symbol");
  const nameIdx = header.findIndex((col) => col.trim() === "Company Name");
  const industryIdx = header.findIndex((col) => col.trim() === "Industry");
  const seriesIdx = header.findIndex((col) => col.trim() === "Series");
  if (symbolIdx < 0 || nameIdx < 0) {
    throw new Error("NSE CSV missing Symbol or Company Name columns.");
  }
  const equities = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const symbol = (cols[symbolIdx] ?? "").trim().toUpperCase();
    const name = (cols[nameIdx] ?? "").trim();
    if (!symbol || !name || isBeesSymbol(symbol)) continue;
    equities.push({
      symbol,
      name,
      industry: (cols[industryIdx] ?? "").trim(),
      series: (cols[seriesIdx] ?? "").trim().toUpperCase(),
    });
  }
  return equities;
}

async function download(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PortfolioIntelligence/1.0 (Nifty 500 constituent refresh)",
      Accept: "text/csv,text/plain,*/*",
    },
  });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.text();
}

const raw = await download(SOURCE_URL).catch(() => download(FALLBACK_URL));
const equities = parseCsv(raw);
if (equities.length < 400) {
  throw new Error(`Expected ~500 Nifty 500 names, got ${equities.length}. Refusing to write a partial cache.`);
}

const payload = {
  source: "NSE Indices official constituent CSV",
  sourceUrl: SOURCE_URL,
  market: "NSE",
  index: "NIFTY 500",
  asOf: new Date().toISOString().slice(0, 10),
  fetchedAt: new Date().toISOString(),
  count: equities.length,
  equities,
};

await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(`Wrote ${equities.length} Nifty 500 equities as-of ${payload.asOf} → ${OUT_PATH}\n`);
