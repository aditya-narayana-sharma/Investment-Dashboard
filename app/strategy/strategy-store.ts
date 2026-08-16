import type { StrategyGraphV2 } from "./graph-types";
import {
  getStrategy as getSqliteStrategy,
  insertBacktestConfigure as insertSqliteBacktestConfigure,
  insertBacktestRun as insertSqliteBacktestRun,
  listStrategies as listSqliteStrategies,
  upsertStrategy as upsertSqliteStrategy,
  type StoredBacktestConfigure,
  type StoredStrategy,
} from "./sqlite-store";
import {
  getStrategy as getSupabaseStrategy,
  insertBacktestConfigure as insertSupabaseBacktestConfigure,
  insertBacktestRun as insertSupabaseBacktestRun,
  listStrategies as listSupabaseStrategies,
  upsertStrategy as upsertSupabaseStrategy,
} from "./supabase-store";

export type { StoredBacktestConfigure, StoredStrategy };
export type StrategyStoreKind = "sqlite" | "supabase";

export type StrategyStoreEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

/** Prefer Supabase only when both server env vars are non-empty. Ignores NEXT_PUBLIC_ keys. */
export function resolveStrategyStoreKind(env: StrategyStoreEnv = process.env): StrategyStoreKind {
  const url = env.SUPABASE_URL?.trim() ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return url !== "" && key !== "" ? "supabase" : "sqlite";
}

export function selectedStrategyStore(): StrategyStoreKind {
  return resolveStrategyStoreKind(process.env);
}

async function withSelectedStore<T>(handlers: {
  sqlite: () => T | Promise<T>;
  supabase: () => T | Promise<T>;
}): Promise<T> {
  const kind = selectedStrategyStore();
  switch (kind) {
    case "sqlite":
      return handlers.sqlite();
    case "supabase":
      return handlers.supabase();
    default: {
      const _never: never = kind;
      throw new Error(`Unhandled strategy store: ${_never}`);
    }
  }
}

export async function listStrategies(): Promise<StoredStrategy[]> {
  return withSelectedStore({
    sqlite: () => listSqliteStrategies(),
    supabase: () => listSupabaseStrategies(),
  });
}

export async function getStrategy(id: string): Promise<StoredStrategy | null> {
  return withSelectedStore({
    sqlite: () => getSqliteStrategy(id),
    supabase: () => getSupabaseStrategy(id),
  });
}

export async function upsertStrategy(graph: StrategyGraphV2): Promise<StoredStrategy> {
  return withSelectedStore({
    sqlite: () => upsertSqliteStrategy(graph),
    supabase: () => upsertSupabaseStrategy(graph),
  });
}

export async function insertBacktestConfigure(
  strategyId: string,
  requestJson: string,
): Promise<StoredBacktestConfigure> {
  return withSelectedStore({
    sqlite: () => insertSqliteBacktestConfigure(strategyId, requestJson),
    supabase: () => insertSupabaseBacktestConfigure(strategyId, requestJson),
  });
}

export async function insertBacktestRun(
  strategyId: string,
  resultJson: string,
): Promise<StoredBacktestConfigure> {
  return withSelectedStore({
    sqlite: () => insertSqliteBacktestRun(strategyId, resultJson),
    supabase: () => insertSupabaseBacktestRun(strategyId, resultJson),
  });
}
