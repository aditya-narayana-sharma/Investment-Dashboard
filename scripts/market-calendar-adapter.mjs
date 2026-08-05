import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE_NAMES = {
  NSE: "NSE trading holiday calendar",
  US: "US exchange holiday calendar",
};

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_MARKET_CALENDAR_PATH = path.join(REPO_ROOT, "config", "market-calendar.json");

function dateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) ? String(value) : "";
}

function sourceUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Load a local, source-attributed canonical holiday document.
 *
 * Defaults to config/market-calendar.json. Override with MARKET_CALENDAR_PATH
 * for a privately maintained refresh. The adapter intentionally has no guessed
 * holiday defaults; invalid or missing data is returned as unavailable.
 */
export async function loadMarketCalendar({
  path: calendarPath = process.env.MARKET_CALENDAR_PATH || DEFAULT_MARKET_CALENDAR_PATH,
  windowStart,
  windowEnd,
} = {}) {
  const crypto = {
    market: "CRYPTO",
    semantics: "24/7",
    message: "Crypto markets operate continuously; exchange maintenance and venue-specific outages remain possible.",
  };
  if (!calendarPath) {
    return {
      status: "unavailable",
      asOf: "",
      holidays: [],
      crypto,
      message: "MARKET_CALENDAR_PATH is not configured; no NSE or US holiday dates were inferred.",
    };
  }

  try {
    const parsed = JSON.parse(await readFile(calendarPath, "utf8"));
    const asOf = new Date(parsed.asOf);
    const coverageStart = dateKey(parsed.coverageStart);
    const coverageEnd = dateKey(parsed.coverageEnd);
    if (
      parsed.version !== 1
      || Number.isNaN(asOf.getTime())
      || !coverageStart
      || !coverageEnd
      || coverageStart > windowStart
      || coverageEnd < windowEnd
      || !Array.isArray(parsed.holidays)
    ) {
      throw new Error("expected version=1, an ISO asOf timestamp, full active-window coverage, and a holidays array");
    }
    const sources = parsed.sources && typeof parsed.sources === "object" ? parsed.sources : {};
    const holidays = parsed.holidays.flatMap((row, index) => {
      const market = row?.market === "NSE" || row?.market === "US" ? row.market : null;
      const date = dateKey(row?.date);
      const title = String(row?.name ?? "").trim();
      const configuredSource = sources[market] ?? {};
      const url = sourceUrl(row?.sourceUrl || configuredSource.url);
      if (!market || !date || !title || !url || date < windowStart || date > windowEnd) return [];
      const sourceName = String(row?.sourceName || configuredSource.name || DEFAULT_SOURCE_NAMES[market]).trim();
      return [{
        id: `market-holiday:${market}:${date}:${index}`,
        title,
        calendar: market === "NSE" ? "NSE Market Holidays" : "US Market Holidays",
        startsAt: `${date}T00:00:00.000+05:30`,
        endsAt: `${date}T23:59:59.999+05:30`,
        topic: "Earnings",
        notes: `${market} market holiday. Source: ${sourceName}.`,
        marketHoliday: { market, sourceName, sourceUrl: url, asOf: asOf.toISOString() },
      }];
    });
    return {
      status: "live",
      asOf: asOf.toISOString(),
      holidays,
      crypto,
      message: `${holidays.length} source-attributed market holidays in the active calendar window (${path.basename(calendarPath)}).`,
    };
  } catch (error) {
    return {
      status: "unavailable",
      asOf: "",
      holidays: [],
      crypto,
      message: `Market calendar adapter unavailable (${calendarPath}): ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
