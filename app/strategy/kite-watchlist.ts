import { callKiteTool, listKiteToolNames } from "../kite-live-server";
import type { TreeInstrument, WatchlistSnapshot } from "./tree-instruments";

const WATCHLIST_TOOL_NAMES = [
  "get_watchlist",
  "get_watchlists",
  "watchlist",
  "get_marketwatch",
  "get_watchlist_items",
] as const;

type JsonObject = Record<string, unknown>;

let lastGoodWatchlist: WatchlistSnapshot | undefined;

function string(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rowsFromPayload(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) return payload.filter((item): item is JsonObject => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const object = payload as JsonObject;
  for (const key of ["data", "items", "results", "instruments", "watchlist", "watchlists"]) {
    const value = object[key];
    if (!Array.isArray(value)) continue;
    const nested: JsonObject[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as JsonObject;
      if (Array.isArray(record.items)) {
        nested.push(...record.items.filter((row): row is JsonObject => Boolean(row && typeof row === "object")));
      } else {
        nested.push(record);
      }
    }
    if (nested.length) return nested;
  }
  return [];
}

function mapWatchlistRows(payload: unknown): TreeInstrument[] {
  const instruments: TreeInstrument[] = [];
  const seen = new Set<string>();
  for (const raw of rowsFromPayload(payload)) {
    const symbol = string(raw.tradingsymbol || raw.symbol || raw.tradingsSymbol).trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    const lastPrice = numberOrUndefined(raw.last_price ?? raw.lastPrice ?? raw.ltp);
    const qty = numberOrUndefined(raw.quantity ?? raw.qty);
    const pnl = numberOrUndefined(raw.pnl);
    const exchange = string(raw.exchange).trim().toUpperCase();
    instruments.push({
      symbol,
      tradingsymbol: symbol,
      name: string(raw.name) || symbol,
      source: "watchlist",
      ...(exchange ? { exchange } : {}),
      ...(lastPrice !== undefined ? { lastPrice } : {}),
      ...(qty !== undefined ? { qty } : {}),
      ...(pnl !== undefined ? { pnl } : {}),
    });
  }
  return instruments;
}

function pickWatchlistTool(toolNames: readonly string[]): string | undefined {
  const lower = new Map(toolNames.map((name) => [name.toLowerCase(), name]));
  for (const candidate of WATCHLIST_TOOL_NAMES) {
    const match = lower.get(candidate);
    if (match) return match;
  }
  return toolNames.find((name) => /watchlist|marketwatch/i.test(name));
}

export function unavailableWatchlist(message: string, retainLastGood = true): WatchlistSnapshot {
  if (retainLastGood && lastGoodWatchlist?.status === "live" && lastGoodWatchlist.instruments.length) {
    return {
      status: "unavailable",
      message: `${message} Retaining the last validated watchlist snapshot.`,
      instruments: lastGoodWatchlist.instruments,
    };
  }
  return { status: "unavailable", message, instruments: [] };
}

export async function getKiteWatchlist(): Promise<WatchlistSnapshot> {
  try {
    const toolNames = await listKiteToolNames();
    const tool = pickWatchlistTool(toolNames);
    if (!tool) {
      return unavailableWatchlist(
        "Unavailable: Kite MCP has no watchlist tool. Search company names in the instrument picker via yfinance; holdings remain the live portfolio source.",
      );
    }
    const payload = await callKiteTool(tool);
    const instruments = mapWatchlistRows(payload);
    const snapshot: WatchlistSnapshot = {
      status: "live",
      message: `Live Kite watchlist via ${tool}.`,
      instruments,
    };
    lastGoodWatchlist = snapshot;
    return snapshot;
  } catch (error) {
    const text = error instanceof Error ? error.message : "Kite watchlist failed.";
    return unavailableWatchlist(`Unavailable: ${text}`);
  }
}

export function resetWatchlistCache() {
  lastGoodWatchlist = undefined;
}
