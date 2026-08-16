import { buildBacktestRequest } from "./backtest-request";
import { importStrategyGraphJson } from "./persist";
import { getStrategy, insertBacktestConfigure, listStrategies, upsertStrategy } from "./sqlite-store";
import { buildTradingSinkPreview, listTradingSinkPreviews, stampTradingSinksUnsubmitted } from "./trading-sinks";
import { validateStrategyGraph } from "./graph-types";

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
      const strategy = getStrategy(id);
      if (!strategy) return jsonError(404, `Strategy ${id} was not found.`);
      return Response.json({ status: "ok", store: "sqlite", strategy }, { headers: JSON_HEADERS });
    }
    return Response.json({ status: "ok", store: "sqlite", strategies: listStrategies() }, { headers: JSON_HEADERS });
  } catch (error) {
    return jsonError(500, errorMessage(error, "Could not read the strategy library."));
  }
}

export async function handleStrategyUpsert(request: Request) {
  try {
    const graph = stampTradingSinksUnsubmitted(await readGraphBody(request));
    const stored = upsertStrategy(graph);
    return Response.json({
      status: "saved",
      store: "sqlite",
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
    const stored = insertBacktestConfigure(graph.id, JSON.stringify(requestPayload));
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
