import { parseStrategyTree, type StrategyTreeV1 } from "../../packages/contracts/src/strategy-tree.ts";
import type { KiteSnapshot } from "../live-types";
import { computeKpisFromOhlcv } from "./tree-indicators";
import {
  collectTreeSymbols,
  resolveTreeInstruments,
  findTreeInstrument,
  type TreeInstrument,
  type WatchlistSnapshot,
} from "./tree-instruments";
import {
  buildTreeAlertPreviews,
  buildTreeGttPreviews,
  buildTreeOrderPreviews,
  type TreeAlertPreview,
  type TreeGttPreview,
  type TreeOrderPreview,
} from "./tree-orders";
import {
  evaluateTreeLive,
  lookupKpiValue,
  type LiveValueStatus,
  type TreeKpiLiveValue,
  type TreeNodeLive,
} from "./tree-evaluate";
import type { YfinanceFundamentals, YfinanceSymbolKpis } from "./yfinance-kpis";

export type TreeLivePreview = {
  status: "live" | "stale" | "unavailable" | "auth_required";
  kiteStatus: KiteSnapshot["status"];
  asOf: string;
  message: string;
  authUrl?: string;
  watchlist: WatchlistSnapshot;
  instruments: TreeInstrument[];
  nodes: Record<string, TreeNodeLive>;
  kpis: Record<string, TreeKpiLiveValue>;
  orders: TreeOrderPreview[];
  gtts: TreeGttPreview[];
  alerts: TreeAlertPreview[];
  fundamentals: Record<string, YfinanceFundamentals>;
};

export type TreeLiveSources = {
  kite: KiteSnapshot;
  watchlist: WatchlistSnapshot;
  yfinance: YfinanceSymbolKpis[];
  yfinanceError?: string;
};

function kiteLiveStatus(snapshot: KiteSnapshot): LiveValueStatus {
  switch (snapshot.status) {
    case "live":
    case "partial":
      return "live";
    case "snapshot":
      return "stale";
    case "auth_required":
    case "unavailable":
      return "unavailable";
    default: {
      const _never: never = snapshot.status;
      return _never;
    }
  }
}

function previewStatus(snapshot: KiteSnapshot): TreeLivePreview["status"] {
  switch (snapshot.status) {
    case "live":
    case "partial":
      return "live";
    case "snapshot":
      return "stale";
    case "auth_required":
      return "auth_required";
    case "unavailable":
      return "unavailable";
    default: {
      const _never: never = snapshot.status;
      return _never;
    }
  }
}

function emptyFundamentals(): YfinanceFundamentals {
  return {};
}

export function buildTreeLivePreview(tree: StrategyTreeV1, sources: TreeLiveSources): TreeLivePreview {
  const instruments = resolveTreeInstruments(sources.kite.holdings, sources.watchlist);
  const yfinanceBySymbol = new Map(sources.yfinance.map((row) => [row.symbol, row]));
  const kiteStatus = kiteLiveStatus(sources.kite);
  const kpis: Record<string, TreeKpiLiveValue> = {};
  const fundamentals: Record<string, YfinanceFundamentals> = {};

  for (const symbol of collectTreeSymbols(tree)) {
    const yf = yfinanceBySymbol.get(symbol);
    const instrument = findTreeInstrument(instruments, symbol);
    const computed = yf ? computeKpisFromOhlcv(yf.ohlcv) : [];
    const fund = yf?.fundamentals ?? emptyFundamentals();
    fundamentals[symbol] = fund;
    const needed = new Set<string>();
    if (instrument) needed.add("close");
    for (const item of computed) needed.add(item.kpiId);
    for (const key of Object.keys(fund)) needed.add(key);
    needed.add("close");
    needed.add("sma_20");
    needed.add("sma_50");
    needed.add("sma_200");
    needed.add("ema_12");
    needed.add("rsi_14");
    needed.add("macd_12_26_9");
    needed.add("bbands_upper_20");
    needed.add("bbands_lower_20");
    needed.add("wma_20");
    needed.add("sales_growth_yoy");
    needed.add("pe_ttm");
    needed.add("ev_ebitda");
    for (const kpiId of needed) {
      const value = lookupKpiValue(kpiId, symbol, computed, fund, instrument, yf?.asOf ?? sources.kite.asOf, kiteStatus);
      kpis[`${kpiId}:${symbol}`] = value;
    }
  }

  const kpiMap = new Map(Object.entries(kpis));
  const nodes = evaluateTreeLive(tree, instruments, kpiMap);
  const watchlistMessage = sources.watchlist.status === "unavailable"
    ? sources.watchlist.message
    : sources.watchlist.message;
  const messageParts = [sources.kite.message, watchlistMessage];
  if (sources.yfinanceError) {
    messageParts.push(sources.yfinanceError);
  } else if (!sources.yfinance.length) {
    messageParts.push("yfinance secondaries unavailable — KPI series stay blank.");
  }

  const preview: TreeLivePreview = {
    status: previewStatus(sources.kite),
    kiteStatus: sources.kite.status,
    asOf: sources.kite.asOf,
    message: messageParts.filter(Boolean).join(" "),
    watchlist: sources.watchlist,
    instruments,
    nodes,
    kpis,
    orders: buildTreeOrderPreviews(tree, instruments),
    gtts: buildTreeGttPreviews(tree, instruments),
    alerts: buildTreeAlertPreviews(tree, instruments),
    fundamentals,
  };
  if (sources.kite.authUrl) preview.authUrl = sources.kite.authUrl;
  return preview;
}

export function parseTreeLiveBody(raw: unknown): StrategyTreeV1 {
  if (!raw || typeof raw !== "object") throw Object.assign(new Error("Live preview requires a tree object."), { status: 400 });
  const body = raw as Record<string, unknown>;
  const treeRaw = "tree" in body ? body.tree : raw;
  return parseStrategyTree(treeRaw);
}
