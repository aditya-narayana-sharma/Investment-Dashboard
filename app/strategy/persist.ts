import { parseStrategyTree, type StrategyTreeV1 } from "../../packages/contracts/src/strategy-tree.ts";
import { buildBacktestRequest, type BacktestRequest } from "./backtest-request";
import { parseStrategyGraph } from "./graph-ops";
import {
  cloneGraph,
  DEFAULT_ASSET_CLASSES,
  DEFAULT_INTERVAL,
  DEFAULT_KPI_WEIGHTAGE_PCT,
  isEdgeKind,
  isNodeKind,
  type GraphValidation,
  type StrategyEdge,
  type StrategyGraphV2,
  type StrategyNode,
} from "./graph-types";
import { compileTreeToGraph } from "./tree-compile";
import type { LibraryNseStatsCache } from "./library-nse-stats";

export const STRATEGIES_UPSERT_PATH = "/strategies";
export const STRATEGIES_UPSERT_ALIAS = "/api/strategies";
export const STRATEGIES_VALIDATE_PATH = "/api/strategies/validate";
export const STRATEGIES_VALIDATE_ALIAS = "/strategies/validate";
export const BACKTESTS_CONFIGURE_PATH = "/api/backtests";
export const BACKTESTS_RUN_PATH = "/api/backtests/run";
export const BACKTESTS_CAMPAIGN_PATH = "/api/backtests/campaign";
export const BACKTESTS_BOOK_PATH = "/api/backtests/book";
export const STRATEGIES_LIST_PATH = "/api/strategies";
export const STRATEGIES_PREVIEW_PATH = "/api/strategies/preview";
export const STRATEGIES_LIVE_PATH = "/api/strategies/live";
export const LIBRARY_NSE_STATS_PATH = "/api/strategies/library-stats";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type BacktestConfigureStatus = "idle" | "configuring" | "configured" | "error";

export type StrategyDocument = {
  tree?: StrategyTreeV1;
  graph: StrategyGraphV2;
};

export type StrategySaveResponse = {
  status: "saved" | "invalid" | "failed";
  store?: "sqlite" | "supabase";
  strategy?: { id: string; name: string; createdAt: string; updatedAt: string };
  graph?: StrategyGraphV2;
  message?: string;
};

export type StrategyValidateResponse = GraphValidation & {
  status: "ok" | "invalid" | "failed";
  message?: string;
};

export type BacktestConfigureResponse = {
  status: "configured" | "invalid" | "failed";
  ran: false;
  request?: BacktestRequest;
  id?: string;
  message?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Graph JSON must be an object");
  }
  return value as Record<string, unknown>;
}

function restoreNode(raw: unknown): StrategyNode {
  if (!raw || typeof raw !== "object") throw new Error("Each node must be an object");
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !value.id) throw new Error("Node id is required");
  if (typeof value.kind !== "string" || !isNodeKind(value.kind)) throw new Error(`Unknown node kind: ${String(value.kind)}`);
  if (!value.params || typeof value.params !== "object" || Array.isArray(value.params)) {
    throw new Error(`Node ${value.id} params must be an object`);
  }
  const params = structuredClone(value.params) as Record<string, unknown>;
  const node: StrategyNode = {
    id: value.id,
    kind: value.kind,
    params,
  };
  if (typeof value.label === "string") node.label = value.label;
  if (value.position && typeof value.position === "object") {
    const position = value.position as Record<string, unknown>;
    if (typeof position.x === "number" && typeof position.y === "number") {
      node.position = { x: position.x, y: position.y };
    }
  }
  return node;
}

function restoreEdge(raw: unknown): StrategyEdge {
  if (!raw || typeof raw !== "object") throw new Error("Each edge must be an object");
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !value.id) throw new Error("Edge id is required");
  if (typeof value.source !== "string" || typeof value.target !== "string") {
    throw new Error(`Edge ${value.id} requires source and target`);
  }
  if (typeof value.kind !== "string" || !isEdgeKind(value.kind)) {
    throw new Error(`Edge ${value.id} has unknown kind`);
  }
  const edge: StrategyEdge = {
    id: value.id,
    source: value.source,
    target: value.target,
    kind: value.kind,
  };
  if (typeof value.sourcePort === "string") edge.sourcePort = value.sourcePort;
  if (typeof value.targetPort === "string") edge.targetPort = value.targetPort;
  return edge;
}

/** Contract defaults only when the field is absent. Explicit [] / 0 stay as exported. */
function applyContractDefaults(node: StrategyNode): StrategyNode {
  const params = structuredClone(node.params);
  if (node.kind === "universe" && params.assetClasses === undefined) {
    params.assetClasses = [...DEFAULT_ASSET_CLASSES];
  }
  if (node.kind === "kpi" && params.weightagePct === undefined) {
    params.weightagePct = DEFAULT_KPI_WEIGHTAGE_PCT;
  }
  return { ...node, params };
}

function restorePins(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("pinnedAlgorithmVersions is required");
  }
  const pins: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string") throw new Error(`pinnedAlgorithmVersions.${key} must be a string`);
    pins[key] = value;
  }
  return pins;
}

/** Lossless StrategyGraphV2 JSON. Preserves ids, positions, params (assetClasses, weightagePct), pins. */
export function exportStrategyGraphJson(graph: StrategyGraphV2): string {
  return `${JSON.stringify(cloneGraph(graph), null, 2)}\n`;
}

export function importStrategyGraphJson(raw: string | unknown): StrategyGraphV2 {
  const parsed = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
  const value = asRecord(parsed);
  if (value.graph && typeof value.graph === "object" && !Array.isArray(value.graph) && !Array.isArray(value.nodes)) {
    return importStrategyDocumentJson(value).graph;
  }
  const nodesRaw = value.nodes;
  const edgesRaw = value.edges;
  if (!Array.isArray(nodesRaw) || !Array.isArray(edgesRaw)) throw new Error("nodes and edges are required");
  const restored: StrategyGraphV2 = {
    schemaVersion: "2",
    id: typeof value.id === "string" ? value.id : "",
    name: typeof value.name === "string" ? value.name : "",
    interval: typeof value.interval === "string" ? value.interval as StrategyGraphV2["interval"] : DEFAULT_INTERVAL,
    nodes: nodesRaw.map((node) => applyContractDefaults(restoreNode(node))),
    edges: edgesRaw.map(restoreEdge),
    pinnedAlgorithmVersions: restorePins(value.pinnedAlgorithmVersions),
  };
  if (typeof value.description === "string") restored.description = value.description;
  if (typeof value.createdAt === "string") restored.createdAt = value.createdAt;
  if (typeof value.updatedAt === "string") restored.updatedAt = value.updatedAt;
  const embeddedTree = restoreEmbeddedTree(value.tree);
  if (embeddedTree) restored.tree = embeddedTree;
  const graph = parseStrategyGraph(restored);
  for (let index = 0; index < graph.nodes.length; index += 1) {
    const node = graph.nodes[index];
    const source = restored.nodes[index];
    if (!node || !source || node.id !== source.id) continue;
    node.params = structuredClone(source.params);
    if (source.position) node.position = { ...source.position };
    if (source.label !== undefined) node.label = source.label;
  }
  graph.pinnedAlgorithmVersions = structuredClone(restored.pinnedAlgorithmVersions);
  if (restored.tree) graph.tree = restored.tree;
  return graph;
}

function restoreEmbeddedTree(raw: unknown): StrategyTreeV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  try {
    return parseStrategyTree(raw);
  } catch {
    return undefined;
  }
}

export function exportStrategyDocumentJson(document: StrategyDocument): string {
  const graph = cloneGraph(document.graph);
  if (document.tree) graph.tree = structuredClone(document.tree);
  return `${JSON.stringify({ tree: graph.tree ?? null, graph }, null, 2)}\n`;
}

export function importStrategyDocumentJson(raw: string | unknown): StrategyDocument {
  const parsed = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
  const value = asRecord(parsed);
  if (value.graph && typeof value.graph === "object" && !Array.isArray(value.graph)) {
    const graph = importStrategyGraphJson(value.graph);
    const tree = restoreEmbeddedTree(value.tree) ?? graph.tree;
    if (tree) graph.tree = tree;
    return { tree, graph };
  }
  if (value.treeVersion === "1") {
    const tree = parseStrategyTree(value);
    return { tree, graph: compileTreeToGraph(tree) };
  }
  const graph = importStrategyGraphJson(value);
  return { tree: graph.tree, graph };
}

export function triggerStrategyGraphDownload(graph: StrategyGraphV2, filename?: string) {
  if (typeof document === "undefined") {
    throw new Error("Strategy graph download requires a browser document");
  }
  const blob = new Blob([exportStrategyGraphJson(graph)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? `${graph.id || "strategy"}.strategy.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importStrategyGraphFromFile(file: File): Promise<StrategyGraphV2> {
  return importStrategyGraphJson(await file.text());
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json() as unknown;
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

function failureMessage(payload: Record<string, unknown>, fallback: string): string {
  return typeof payload.message === "string" && payload.message ? payload.message : fallback;
}

/** POST /strategies (same handler at /api/strategies). Does not fake success. */
export async function saveStrategyToLibrary(graph: StrategyGraphV2): Promise<StrategySaveResponse> {
  const response = await fetch(STRATEGIES_UPSERT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: exportStrategyGraphJson(graph),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    return {
      status: response.status === 400 ? "invalid" : "failed",
      message: failureMessage(payload, `Save failed (${response.status})`),
    };
  }
  if (payload.status !== "saved") {
    return {
      status: "failed",
      message: failureMessage(payload, "Save did not confirm status=saved"),
    };
  }
  return payload as StrategySaveResponse;
}

/** POST /api/strategies/validate in addition to the client validator. */
export async function validateStrategyOnServer(graph: StrategyGraphV2): Promise<StrategyValidateResponse> {
  const response = await fetch(STRATEGIES_VALIDATE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: exportStrategyGraphJson(graph),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    return {
      status: "failed",
      ok: false,
      issues: [],
      stripTitle: "VALIDATION: UNAVAILABLE",
      stripDetail: failureMessage(payload, `Validate failed (${response.status})`),
      message: failureMessage(payload, `Validate failed (${response.status})`),
    };
  }
  return payload as StrategyValidateResponse;
}

/** Builds and stores a BacktestRequest. Does not run a backtest. */
export async function configureBacktest(graph: StrategyGraphV2): Promise<BacktestConfigureResponse> {
  const request = buildBacktestRequest(graph);
  const response = await fetch(BACKTESTS_CONFIGURE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ graph, request }),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    return {
      status: response.status === 400 ? "invalid" : "failed",
      ran: false,
      request,
      message: failureMessage(payload, `Backtest configure failed (${response.status})`),
    };
  }
  if (payload.status !== "configured" || payload.ran === true) {
    return {
      status: "failed",
      ran: false,
      request,
      message: failureMessage(payload, "Backtest API did not confirm a configure-only response"),
    };
  }
  return {
    ...(payload as BacktestConfigureResponse),
    ran: false,
    request: (payload.request as BacktestRequest | undefined) ?? request,
  };
}

export function localBacktestRequest(graph: StrategyGraphV2): BacktestRequest {
  return buildBacktestRequest(graph);
}

export type StrategyLibraryItem = {
  id: string;
  name: string;
  updatedAt: string;
  hasTree: boolean;
};

export async function listStrategyLibrary(): Promise<StrategyLibraryItem[]> {
  const response = await fetch(STRATEGIES_LIST_PATH, { cache: "no-store" });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(payload, `Library list failed (${response.status})`));
  }
  const strategies = Array.isArray(payload.strategies) ? payload.strategies : [];
  return strategies.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const graph = row.graph && typeof row.graph === "object" ? row.graph as Record<string, unknown> : {};
    return [{
      id: String(row.id ?? ""),
      name: String(row.name ?? "Untitled"),
      updatedAt: String(row.updatedAt ?? ""),
      hasTree: Boolean(graph.tree),
    }].filter((entry) => entry.id);
  });
}

export async function loadStrategyFromLibrary(id: string): Promise<StrategyDocument> {
  const response = await fetch(`${STRATEGIES_LIST_PATH}?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(payload, `Library load failed (${response.status})`));
  }
  const strategy = payload.strategy && typeof payload.strategy === "object"
    ? payload.strategy as Record<string, unknown>
    : payload;
  const graphRaw = strategy.graph ?? payload.graph;
  if (!graphRaw) throw new Error("Library row has no graph.");
  return importStrategyDocumentJson({ graph: graphRaw, tree: (graphRaw as { tree?: unknown }).tree });
}

export type BacktestRunResponse = {
  status: "ran" | "unavailable" | "failed";
  ran: boolean;
  message?: string;
  warnings?: string[];
  missingSymbols?: string[];
  curve?: Array<{ date: string; equity: number; benchmark?: number }>;
  totalReturnPct?: number | null;
  annualizedReturnPct?: number | null;
  sharpe?: number | null;
  maxDrawdownPct?: number | null;
  endingEquity?: number | null;
};

export async function runTreeBacktestOnServer(tree: StrategyTreeV1): Promise<BacktestRunResponse> {
  const response = await fetch(BACKTESTS_RUN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tree }),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    return {
      status: "failed",
      ran: false,
      message: failureMessage(payload, `Backtest run failed (${response.status})`),
    };
  }
  if (payload.ran === true && payload.status === "ran") {
    return payload as BacktestRunResponse;
  }
  return {
    status: payload.status === "unavailable" ? "unavailable" : "failed",
    ran: false,
    message: failureMessage(payload, "Backtest did not run."),
    missingSymbols: Array.isArray(payload.missingSymbols) ? payload.missingSymbols as string[] : [],
    warnings: Array.isArray(payload.warnings) ? payload.warnings as string[] : [],
  };
}

export type CampaignRowResponse = {
  id: string;
  name: string;
  ran: boolean;
  message: string;
  missingSymbols?: string[];
  warnings?: string[];
  curve: Array<{ date: string; equity: number; benchmark?: number }>;
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  endingEquity: number | null;
  oosFrom: string | null;
  oosTotalReturnPct: number | null;
  oosAnnualizedReturnPct: number | null;
  oosSharpe: number | null;
  oosMaxDrawdownPct: number | null;
};

export type CampaignRunResponse = {
  status: "ok" | "failed";
  placesOrders: false;
  message?: string;
  warnings?: string[];
  rows: CampaignRowResponse[];
};

export type BookRunResponse = {
  status: "ran" | "unavailable" | "failed";
  ran: boolean;
  placesOrders: false;
  message?: string;
  warnings?: string[];
  missingIds?: string[];
  curve?: Array<{ date: string; equity: number; benchmark?: number }>;
  totalReturnPct?: number | null;
  annualizedReturnPct?: number | null;
  sharpe?: number | null;
  maxDrawdownPct?: number | null;
  endingEquity?: number | null;
  legs?: Array<{ id: string; name: string; weight: number; ran: boolean }>;
};

export async function runLibraryCampaignOnServer(input: {
  ids: string[];
  from?: string;
  to?: string;
  walkForward?: boolean;
}): Promise<CampaignRunResponse> {
  const response = await fetch(BACKTESTS_CAMPAIGN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const payload = await readJson(response);
  const rows = Array.isArray(payload.rows) ? payload.rows as CampaignRowResponse[] : [];
  if (!response.ok) {
    return {
      status: "failed",
      placesOrders: false,
      message: failureMessage(payload, `Campaign failed (${response.status})`),
      rows,
    };
  }
  return {
    status: "ok",
    placesOrders: false,
    message: typeof payload.message === "string" ? payload.message : undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings as string[] : [],
    rows,
  };
}

export async function runStrategyBookOnServer(
  legs: Array<{ id: string; weight: number }>,
): Promise<BookRunResponse> {
  const response = await fetch(BACKTESTS_BOOK_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ legs }),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    return {
      status: "failed",
      ran: false,
      placesOrders: false,
      message: failureMessage(payload, `Book run failed (${response.status})`),
      missingIds: Array.isArray(payload.missingIds) ? payload.missingIds as string[] : [],
    };
  }
  return {
    ...(payload as BookRunResponse),
    placesOrders: false,
    ran: payload.ran === true,
    status: payload.ran === true ? "ran" : "unavailable",
  };
}

export async function loadLibraryNseStats(refresh = false): Promise<LibraryNseStatsCache> {
  const url = refresh ? `${LIBRARY_NSE_STATS_PATH}?refresh=1` : LIBRARY_NSE_STATS_PATH;
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(payload, `Library NSE stats failed (${response.status})`));
  }
  return payload as unknown as LibraryNseStatsCache;
}
