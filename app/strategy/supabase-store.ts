import type { StrategyGraphV2 } from "./graph-types";
import type { StoredBacktestConfigure, StoredStrategy } from "./sqlite-store";
import { getSupabaseAdmin, type BacktestRequestRow, type StrategyRow } from "./supabase-admin";

function parseGraphJson(value: unknown): StrategyGraphV2 {
  if (typeof value === "string") {
    return JSON.parse(value) as StrategyGraphV2;
  }
  if (value && typeof value === "object") {
    return value as StrategyGraphV2;
  }
  throw new Error("strategy.graph_json is missing or invalid.");
}

function rowToStrategy(row: StrategyRow): StoredStrategy {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    interval: row.interval,
    graph: parseGraphJson(row.graph_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseRequestJson(requestJson: string): unknown {
  return JSON.parse(requestJson) as unknown;
}

function requestJsonToString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function listStrategies(): Promise<StoredStrategy[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("strategies")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(rowToStrategy);
}

export async function getStrategy(id: string): Promise<StoredStrategy | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("strategies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? rowToStrategy(data) : null;
}

export async function upsertStrategy(graph: StrategyGraphV2): Promise<StoredStrategy> {
  const now = new Date().toISOString();
  const createdAt = graph.createdAt ?? now;
  const updatedAt = now;
  const persisted: StrategyGraphV2 = {
    ...graph,
    createdAt,
    updatedAt,
  };
  const row: StrategyRow = {
    id: persisted.id,
    name: persisted.name,
    description: persisted.description ?? null,
    interval: persisted.interval,
    graph_json: persisted,
    created_at: createdAt,
    updated_at: updatedAt,
  };
  const { data, error } = await getSupabaseAdmin()
    .from("strategies")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Strategy upsert failed.");
  }
  return rowToStrategy(data);
}

export async function insertBacktestConfigure(
  strategyId: string,
  requestJson: string,
): Promise<StoredBacktestConfigure> {
  const created: StoredBacktestConfigure = {
    id: `bt-${strategyId}-${Date.now()}`,
    strategyId,
    requestJson,
    status: "configured",
    ran: false,
    createdAt: new Date().toISOString(),
  };
  return insertStoredBacktestConfigure(created);
}

/** Preserves ids/timestamps for one-time SQLite → Supabase migration. */
export async function insertStoredBacktestConfigure(
  stored: StoredBacktestConfigure,
): Promise<StoredBacktestConfigure> {
  const row: BacktestRequestRow = {
    id: stored.id,
    strategy_id: stored.strategyId,
    request_json: parseRequestJson(stored.requestJson),
    status: stored.status,
    ran: stored.ran,
    created_at: stored.createdAt,
  };
  const { data, error } = await getSupabaseAdmin()
    .from("backtest_requests")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Backtest configure insert failed.");
  }
  return {
    id: data.id,
    strategyId: data.strategy_id,
    requestJson: requestJsonToString(data.request_json),
    status: data.ran ? "ran" : "configured",
    ran: Boolean(data.ran),
    createdAt: data.created_at,
  };
}

export async function insertBacktestRun(
  strategyId: string,
  resultJson: string,
): Promise<StoredBacktestConfigure> {
  return insertStoredBacktestConfigure({
    id: `bt-run-${strategyId}-${Date.now()}`,
    strategyId,
    requestJson: resultJson,
    status: "ran",
    ran: true,
    createdAt: new Date().toISOString(),
  });
}
