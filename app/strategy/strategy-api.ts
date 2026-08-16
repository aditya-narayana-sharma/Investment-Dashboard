import { getKiteSnapshot } from "../kite-live-server";
import { buildBacktestRequest } from "./backtest-request";
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
import { collectTreeSymbols } from "./tree-instruments";
import { buildTreeLivePreview, parseTreeLiveBody } from "./tree-live";
import { buildTradingSinkPreview, listTradingSinkPreviews, stampTradingSinksUnsubmitted } from "./trading-sinks";
import { validateStrategyGraph } from "./graph-types";
import { runTreeBacktest } from "./tree-backtest";
import { loadYfinanceStrategyKpis } from "./yfinance-kpis";

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

export async function handleTreeLivePreview(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return jsonError(415, "Live preview requests must use JSON.");
    }
    const tree = parseTreeLiveBody(await request.json());
    const kite = await getKiteSnapshot();
    const watchlist = kite.status === "auth_required" || kite.status === "unavailable"
      ? unavailableWatchlist("Unavailable: Kite session is missing. Holdings and watchlist are not live.", false)
      : await getKiteWatchlist();
    let yfinance = [] as Awaited<ReturnType<typeof loadYfinanceStrategyKpis>>;
    let yfinanceError: string | undefined;
    try {
      yfinance = await loadYfinanceStrategyKpis(collectTreeSymbols(tree));
    } catch (error) {
      yfinance = [];
      yfinanceError = error instanceof Error ? error.message : "yfinance strategy KPI fetch failed.";
    }
    const preview = buildTreeLivePreview(tree, { kite, watchlist, yfinance, yfinanceError });
    return Response.json(preview, { headers: JSON_HEADERS });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400;
    return jsonError(status, errorMessage(error, "Tree live preview failed."));
  }
}

export async function handleBacktestRun(request: Request) {
  try {
    const tree = parseTreeLiveBody(await request.json());
    const symbols = [...new Set([...collectTreeSymbols(tree), "NIFTYBEES"])];
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
