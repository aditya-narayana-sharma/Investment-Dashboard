import { getKiteSnapshot, searchKiteCashInstruments } from "../kite-live-server";
import { BACKTEST_DEFAULTS, buildBacktestRequest } from "./backtest-request";
import { getKiteWatchlist, unavailableWatchlist } from "./kite-watchlist";
import { importStrategyGraphJson } from "./persist";
import {
  getStrategy,
  insertBacktestConfigure,
  insertBacktestRun,
  listStrategies,
  selectedStrategyStore,
  upsertStrategy,
} from "./strategy-store";
import {
  collectTreeSymbols,
  findTreeInstrument,
  instrumentFromCatalogue,
  resolveTreeInstruments,
  type TreeInstrument,
} from "./tree-instruments";
import { buildTreeLivePreview, parseTreeLiveBody, parseTreeLiveKpiSymbol } from "./tree-live";
import { buildTradingSinkPreview, listTradingSinkPreviews, stampTradingSinksUnsubmitted } from "./trading-sinks";
import { validateStrategyGraph } from "./graph-types";
import { runTreeBacktest } from "./tree-backtest";
import { loadYfinanceStrategyKpis } from "./yfinance-kpis";
import { loadOrComputeLibraryNseStats } from "./library-nse-stats-server";
import { resolveLibraryTrees } from "./library-resolve";
import { combineStrategyBook, normalizeBookWeight, STRATEGY_BOOK_PLACES_ORDERS } from "./strategy-book";
import {
  collectCampaignSymbols,
  missingCampaignRow,
  runCampaignTrees,
  STRATEGY_CAMPAIGN_PLACES_ORDERS,
} from "./strategy-campaign";

const JSON_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ status: status === 400 ? "invalid" : "failed", message, ...extra }, { status, headers: JSON_HEADERS });
}

async function readGraphBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Requests must use JSON."), { status: 415 });
  }
  const body = await request.json() as unknown;
  if (body && typeof body === "object" && "graph" in body) {
    return importStrategyGraphJson((body as { graph: unknown }).graph);
  }
  return importStrategyGraphJson(body);
}

export async function handleStrategyList(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const strategy = await getStrategy(id);
      if (!strategy) return jsonError(404, `Strategy ${id} was not found.`);
      return Response.json({ status: "ok", store: selectedStrategyStore(), strategy }, { headers: JSON_HEADERS });
    }
    return Response.json({
      status: "ok",
      store: selectedStrategyStore(),
      strategies: await listStrategies(),
    }, { headers: JSON_HEADERS });
  } catch (error) {
    return jsonError(500, errorMessage(error, "Could not read the strategy library."));
  }
}

export async function handleStrategyUpsert(request: Request) {
  try {
    const graph = stampTradingSinksUnsubmitted(await readGraphBody(request));
    const stored = await upsertStrategy(graph);
    return Response.json({
      status: "saved",
      store: selectedStrategyStore(),
      strategy: {
        id: stored.id,
        name: stored.name,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      },
      graph: stored.graph,
    }, { status: 201, headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Strategy upsert failed."));
  }
}

export async function handleStrategyValidate(request: Request) {
  try {
    const graph = await readGraphBody(request);
    const validation = validateStrategyGraph(graph);
    return Response.json({
      status: validation.ok ? "ok" : "invalid",
      schemaVersion: graph.schemaVersion,
      ...validation,
    }, { headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Strategy validation failed."), {
      ok: false,
      issues: [],
      stripTitle: "VALIDATION: UNAVAILABLE",
      stripDetail: errorMessage(error, "Strategy validation failed."),
    });
  }
}

export async function handleBacktestConfigure(request: Request) {
  try {
    const graph = await readGraphBody(request);
    const requestPayload = buildBacktestRequest(graph);
    const stored = await insertBacktestConfigure(graph.id, JSON.stringify(requestPayload));
    return Response.json({
      status: "configured",
      ran: false,
      id: stored.id,
      request: requestPayload,
      message: "Backtest request stored. No engine ran.",
    }, { status: 201, headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Backtest configure failed."), { ran: false });
  }
}

async function lookupKiteCatalogueInstruments(symbols: readonly string[]): Promise<TreeInstrument[]> {
  const unique = [...new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return [];
  const rows = await Promise.all(unique.map(async (symbol) => {
    try {
      const matches = await searchKiteCashInstruments(symbol, "NSE", 8);
      const exact = matches.find((item) => item.symbol === symbol && item.exchange === "NSE" && item.series === "EQ");
      return exact ? instrumentFromCatalogue({ symbol: exact.symbol, name: exact.name, exchange: exact.exchange }) : undefined;
    } catch {
      return undefined;
    }
  }));
  return rows.filter((row): row is TreeInstrument => Boolean(row));
}

export async function handleTreeLivePreview(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return jsonError(415, "Live preview requests must use JSON.");
    }
    const raw = await request.json();
    const tree = parseTreeLiveBody(raw);
    const extraSymbols = [parseTreeLiveKpiSymbol(raw)].filter(Boolean);
    const kite = await getKiteSnapshot();
    const watchlist = kite.status === "auth_required" || kite.status === "unavailable"
      ? unavailableWatchlist("Unavailable: Kite session is missing. Holdings and watchlist are not live.", false)
      : await getKiteWatchlist();
    const symbols = [...new Set([...collectTreeSymbols(tree), ...extraSymbols])];
    const resolved = resolveTreeInstruments(kite.holdings, watchlist, {
      positions: kite.positions,
      nseSymbols: symbols,
    });
    const unresolved = symbols.filter((symbol) => !findTreeInstrument(resolved, symbol));
    const kiteLive = kite.status === "live" || kite.status === "partial";
    const catalogueInstruments = kiteLive ? await lookupKiteCatalogueInstruments(unresolved) : [];
    let yfinance = [] as Awaited<ReturnType<typeof loadYfinanceStrategyKpis>>;
    let yfinanceError: string | undefined;
    try {
      yfinance = await loadYfinanceStrategyKpis([...new Set([...symbols, "RELIANCE"])]);
    } catch (error) {
      yfinance = [];
      yfinanceError = error instanceof Error ? error.message : "yfinance strategy KPI fetch failed.";
    }
    const preview = buildTreeLivePreview(tree, { kite, watchlist, yfinance, yfinanceError, catalogueInstruments }, extraSymbols);
    return Response.json(preview, { headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Tree live preview failed."));
  }
}

export async function handleBacktestRun(request: Request) {
  try {
    const tree = parseTreeLiveBody(await request.json());
    const symbols = [...new Set([...collectTreeSymbols(tree), "RELIANCE"])];
    let yfinanceError: string | undefined;
    let rows: Awaited<ReturnType<typeof loadYfinanceStrategyKpis>> = [];
    try {
      rows = await loadYfinanceStrategyKpis(symbols);
    } catch (error) {
      yfinanceError = error instanceof Error ? error.message : "yfinance history fetch failed.";
    }
    const bars = Object.fromEntries(rows.map((row) => [row.symbol, row.ohlcv]));
    const result = runTreeBacktest(tree, bars);
    if (!result.ran) {
      return Response.json({
        ...result,
        message: yfinanceError ? `${result.message} ${yfinanceError}` : result.message,
      }, { headers: JSON_HEADERS });
    }
    const stored = await insertBacktestRun(tree.id, JSON.stringify(result));
    return Response.json({
      ...result,
      id: stored.id,
      warnings: yfinanceError ? [...result.warnings, yfinanceError] : result.warnings,
    }, { status: 201, headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Backtest run failed."), { ran: false, status: "unavailable" });
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function optionalDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

async function loadBarsForSymbols(symbols: readonly string[]) {
  let yfinanceError: string | undefined;
  let rows: Awaited<ReturnType<typeof loadYfinanceStrategyKpis>> = [];
  try {
    rows = await loadYfinanceStrategyKpis([...symbols], { ohlcvOnly: true, timeoutMs: 180_000 });
  } catch (error) {
    yfinanceError = error instanceof Error ? error.message : "yfinance history fetch failed.";
  }
  return {
    bars: Object.fromEntries(rows.map((row) => [row.symbol, row.ohlcv])),
    yfinanceError,
  };
}

export async function handleBacktestCampaign(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return jsonError(415, "Campaign requests must use JSON.");
    }
    const body = await request.json() as Record<string, unknown>;
    const ids = stringList(body.ids);
    if (ids.length < 1) return jsonError(400, "Provide at least one library id.");
    const { resolved, missing } = await resolveLibraryTrees(ids);
    const { bars, yfinanceError } = await loadBarsForSymbols(collectCampaignSymbols(resolved));
    const rows = [
      ...runCampaignTrees(resolved, bars, {
        from: optionalDate(body.from),
        to: optionalDate(body.to),
        walkForward: body.walkForward === true,
      }),
      ...missing.map(missingCampaignRow),
    ];
    return Response.json({
      status: "ok",
      placesOrders: STRATEGY_CAMPAIGN_PLACES_ORDERS,
      message: yfinanceError ?? "Campaign ran each selected tree on the shared OHLCV window.",
      warnings: yfinanceError ? [yfinanceError] : [],
      rows,
    }, { headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Campaign backtest failed."), {
      ran: false,
      placesOrders: STRATEGY_CAMPAIGN_PLACES_ORDERS,
    });
  }
}

export async function handleBacktestBook(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return jsonError(415, "Book requests must use JSON.");
    }
    const body = await request.json() as Record<string, unknown>;
    const rawLegs = Array.isArray(body.legs) ? body.legs : [];
    const parsed = rawLegs.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? "").trim();
      const weight = normalizeBookWeight(Number(row.weight));
      return id ? [{ id, weight }] : [];
    });
    if (parsed.length < 2) return jsonError(400, "A book needs at least two weighted trees.");
    const { resolved, missing } = await resolveLibraryTrees(parsed.map((leg) => leg.id));
    const { bars, yfinanceError } = await loadBarsForSymbols(collectCampaignSymbols(resolved));
    const byId = new Map(resolved.map((row) => [row.id, row]));
    const book = combineStrategyBook(parsed.map((leg) => {
      const resolvedTree = byId.get(leg.id);
      if (!resolvedTree) {
        return {
          id: leg.id,
          name: leg.id,
          weight: leg.weight,
          result: {
            status: "unavailable" as const,
            ran: false,
            message: `Unavailable: library id ${leg.id} was not found.`,
            warnings: [],
            missingSymbols: [],
            curve: [],
            totalReturnPct: null,
            annualizedReturnPct: null,
            sharpe: null,
            maxDrawdownPct: null,
            initialCash: BACKTEST_DEFAULTS.initialCash,
            endingEquity: null,
          },
        };
      }
      return {
        id: resolvedTree.id,
        name: resolvedTree.name,
        weight: leg.weight,
        result: runTreeBacktest(resolvedTree.tree, bars),
      };
    }));
    return Response.json({
      ...book,
      warnings: yfinanceError ? [...book.warnings, yfinanceError] : book.warnings,
      missingIds: [...new Set([...book.missingIds, ...missing])],
    }, { headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Book backtest failed."), {
      ran: false,
      placesOrders: STRATEGY_BOOK_PLACES_ORDERS,
    });
  }
}

export async function handleLibraryNseStats(request: Request) {
  try {
    const force = request.method === "POST" || new URL(request.url).searchParams.get("refresh") === "1";
    const cache = await loadOrComputeLibraryNseStats(force);
    return Response.json({
      status: "ok",
      ...cache,
    }, { headers: JSON_HEADERS });
  } catch (error) {
    return jsonError(500, errorMessage(error, "Library NSE stats failed."));
  }
}

export async function handleTradingPreview(request: Request) {
  try {
    const graph = stampTradingSinksUnsubmitted(await readGraphBody(request));
    const url = new URL(request.url);
    const nodeId = url.searchParams.get("nodeId");
    const previews = nodeId ? [buildTradingSinkPreview(graph, nodeId)] : listTradingSinkPreviews(graph);
    return Response.json({
      status: "preview",
      submitted: false,
      previews,
      message: "Paper / broker preview only. No live order was placed.",
    }, { headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Trading preview failed."), { submitted: false });
  }
}
