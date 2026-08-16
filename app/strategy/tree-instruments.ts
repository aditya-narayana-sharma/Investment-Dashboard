import {
  walkTreeNodes,
  type StrategyTreeV1,
} from "../../packages/contracts/src/strategy-tree.ts";
import type { LiveHolding } from "../live-types";

export type TreeInstrumentSource = "holding" | "watchlist";

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

/** Holdings first, then watchlist names that are not already holdings. Never invent symbols. */
export function resolveTreeInstruments(
  holdings: readonly LiveHolding[],
  watchlist: WatchlistSnapshot,
): TreeInstrument[] {
  const bySymbol = new Map<string, TreeInstrument>();
  for (const holding of holdings) {
    const instrument = instrumentFromHolding(holding);
    if (!instrument.symbol) continue;
    bySymbol.set(instrument.symbol, instrument);
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
  return [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export function findTreeInstrument(
  instruments: readonly TreeInstrument[],
  symbol: string,
): TreeInstrument | undefined {
  const needle = normalizeSymbol(symbol);
  return instruments.find((item) => item.symbol === needle || item.tradingsymbol === needle);
}
