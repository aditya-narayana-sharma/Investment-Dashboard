import {
  walkTreeNodes,
  type StrategyTreeV1,
} from "../../packages/contracts/src/strategy-tree.ts";
import type { LiveHolding, LivePosition } from "../live-types";
import { isBeesSymbol, nifty500Name } from "./builder-universe";

export type TreeInstrumentSource = "holding" | "position" | "watchlist" | "catalogue";

export type TreeInstrument = {
  symbol: string;
  tradingsymbol: string;
  name: string;
  exchange?: string;
  source: TreeInstrumentSource;
  lastPrice?: number;
  qty?: number;
  pnl?: number;
};

export type WatchlistSnapshot = {
  status: "live" | "unavailable";
  message: string;
  instruments: TreeInstrument[];
};

export type TreeLivePreviewStatus = "live" | "stale" | "unavailable" | "auth_required";

export type ResolveTreeInstrumentsOptions = {
  positions?: readonly LivePosition[];
  nseSymbols?: readonly string[];
  catalogue?: readonly TreeInstrument[];
};

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function collectTreeSymbols(tree: StrategyTreeV1): string[] {
  const symbols = new Set<string>();
  walkTreeNodes(tree.children, (node) => {
    switch (node.kind) {
      case "asset": {
        const symbol = normalizeSymbol(node.params.symbol);
        if (symbol) symbols.add(symbol);
        break;
      }
      case "filter": {
        for (const item of node.params.symbols ?? []) {
          const symbol = normalizeSymbol(item);
          if (symbol) symbols.add(symbol);
        }
        break;
      }
      case "if_else": {
        for (const operand of [node.params.left, node.params.right]) {
          if (operand.type === "kpi") {
            const symbol = normalizeSymbol(operand.symbol);
            if (symbol) symbols.add(symbol);
          }
        }
        break;
      }
      case "group":
      case "weight":
      case "any_all":
        break;
      default: {
        const _never: never = node;
        return _never;
      }
    }
  });
  return [...symbols];
}

export function instrumentFromHolding(holding: LiveHolding): TreeInstrument {
  const symbol = normalizeSymbol(holding.symbol);
  const instrument: TreeInstrument = {
    symbol,
    tradingsymbol: symbol,
    name: holding.name || symbol,
    source: "holding",
  };
  if (Number.isFinite(holding.price)) instrument.lastPrice = holding.price;
  if (Number.isFinite(holding.qty)) instrument.qty = holding.qty;
  if (Number.isFinite(holding.pnl)) instrument.pnl = holding.pnl;
  return instrument;
}

export function instrumentFromPosition(position: LivePosition): TreeInstrument {
  const symbol = normalizeSymbol(position.symbol);
  const instrument: TreeInstrument = {
    symbol,
    tradingsymbol: symbol,
    name: nifty500Name(symbol) || symbol,
    source: "position",
  };
  if (Number.isFinite(position.price)) instrument.lastPrice = position.price;
  if (Number.isFinite(position.qty)) instrument.qty = position.qty;
  if (Number.isFinite(position.pnl)) instrument.pnl = position.pnl;
  return instrument;
}

export function instrumentFromCatalogue(row: {
  symbol: string;
  name?: string;
  exchange?: string;
}): TreeInstrument | undefined {
  const symbol = normalizeSymbol(row.symbol);
  if (!symbol || isBeesSymbol(symbol)) return undefined;
  const name = (row.name ?? nifty500Name(symbol) ?? "").trim() || symbol;
  return {
    symbol,
    tradingsymbol: symbol,
    name,
    source: "catalogue",
    exchange: (row.exchange ?? "NSE").trim().toUpperCase() || "NSE",
  };
}

function remember(bySymbol: Map<string, TreeInstrument>, instrument: TreeInstrument | undefined) {
  if (!instrument?.symbol || bySymbol.has(instrument.symbol)) return;
  bySymbol.set(instrument.symbol, instrument);
}

/**
 * Holdings, then open positions, then a live watchlist, then known NSE cash-equity
 * names from the tree / Kite catalogue. Never invent tickers or last prices.
 */
export function resolveTreeInstruments(
  holdings: readonly LiveHolding[],
  watchlist: WatchlistSnapshot,
  options: ResolveTreeInstrumentsOptions = {},
): TreeInstrument[] {
  const bySymbol = new Map<string, TreeInstrument>();
  for (const holding of holdings) {
    remember(bySymbol, instrumentFromHolding(holding));
  }
  for (const position of options.positions ?? []) {
    remember(bySymbol, instrumentFromPosition(position));
  }
  if (watchlist.status === "live") {
    for (const row of watchlist.instruments) {
      const symbol = normalizeSymbol(row.symbol || row.tradingsymbol);
      if (!symbol || bySymbol.has(symbol)) continue;
      bySymbol.set(symbol, {
        symbol,
        tradingsymbol: normalizeSymbol(row.tradingsymbol) || symbol,
        name: row.name || symbol,
        source: "watchlist",
        ...(row.exchange ? { exchange: row.exchange } : {}),
        ...(row.lastPrice !== undefined && Number.isFinite(row.lastPrice) ? { lastPrice: row.lastPrice } : {}),
        ...(row.qty !== undefined && Number.isFinite(row.qty) ? { qty: row.qty } : {}),
        ...(row.pnl !== undefined && Number.isFinite(row.pnl) ? { pnl: row.pnl } : {}),
      });
    }
  }
  for (const row of options.catalogue ?? []) {
    remember(bySymbol, row.source === "catalogue" ? row : instrumentFromCatalogue(row));
  }
  for (const raw of options.nseSymbols ?? []) {
    const symbol = normalizeSymbol(raw);
    if (!symbol || bySymbol.has(symbol) || isBeesSymbol(symbol)) continue;
    const name = nifty500Name(symbol);
    if (!name) continue;
    remember(bySymbol, instrumentFromCatalogue({ symbol, name, exchange: "NSE" }));
  }
  return [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export function findTreeInstrument(
  instruments: readonly TreeInstrument[],
  symbol: string,
): TreeInstrument | undefined {
  const needle = normalizeSymbol(symbol);
  return instruments.find((item) => item.symbol === needle || item.tradingsymbol === needle);
}

/**
 * Red asset warnings are only for unresolved tickers. Holdings, positions, NSE
 * cash-equity names, and Kite catalogue hits are valid. A missing watchlist is
 * not a trading block and must not be concatenated onto a holdings warning.
 */
export function treeAssetWarning(input: {
  symbol: string;
  instrument?: TreeInstrument;
  previewStatus: TreeLivePreviewStatus;
  watchlistStatus: WatchlistSnapshot["status"];
}): string | null {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol || input.instrument) return null;
  if (nifty500Name(symbol) && !isBeesSymbol(symbol)) return null;

  switch (input.previewStatus) {
    case "live":
      return input.watchlistStatus === "live"
        ? "Not in live holdings or watchlist"
        : "Not in live holdings";
    case "stale":
    case "unavailable":
    case "auth_required":
      return "Not in last known holdings";
    default: {
      const _never: never = input.previewStatus;
      return _never;
    }
  }
}
