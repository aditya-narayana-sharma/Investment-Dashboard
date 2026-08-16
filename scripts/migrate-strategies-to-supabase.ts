/**
 * One-time copy of local strategies.sqlite rows into Supabase.
 *
 *   node --import ./tests/helpers/register-ts-ext.mjs --experimental-strip-types \
 *     scripts/migrate-strategies-to-supabase.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from the environment
 * or .env.local). Never uses NEXT_PUBLIC_ keys.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  listBacktestConfigures,
  listStrategies,
  STRATEGY_LIBRARY_DB_PATH,
} from "../app/strategy/sqlite-store.ts";
import { resolveStrategyStoreKind } from "../app/strategy/strategy-store.ts";
import { insertStoredBacktestConfigure, upsertStrategy } from "../app/strategy/supabase-store.ts";

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireSupabaseEnv() {
  const kind = resolveStrategyStoreKind(process.env);
  switch (kind) {
    case "supabase":
      return;
    case "sqlite":
      throw new Error(
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (not NEXT_PUBLIC_) before migrating.",
      );
    default: {
      const _never: never = kind;
      throw new Error(`Unhandled strategy store: ${_never}`);
    }
  }
}

async function main() {
  loadDotEnvFile(join(process.cwd(), ".env.local"));
  loadDotEnvFile(join(process.cwd(), ".env"));
  requireSupabaseEnv();

  if (!existsSync(STRATEGY_LIBRARY_DB_PATH)) {
    console.log(`No local SQLite library at ${STRATEGY_LIBRARY_DB_PATH}; nothing to migrate.`);
    return;
  }

  const strategies = listStrategies();
  const backtests = listBacktestConfigures();
  if (strategies.length === 0 && backtests.length === 0) {
    console.log("Local strategies.sqlite has no rows; nothing to migrate.");
    return;
  }

  for (const strategy of strategies) {
    const stored = await upsertStrategy(strategy.graph);
    console.log(`Upserted strategy ${stored.id} (${stored.name})`);
  }
  for (const backtest of backtests) {
    const stored = await insertStoredBacktestConfigure(backtest);
    console.log(`Upserted backtest ${stored.id} for ${stored.strategyId}`);
  }
  console.log(`Migrated ${strategies.length} strateg${strategies.length === 1 ? "y" : "ies"} and ${backtests.length} backtest request${backtests.length === 1 ? "" : "s"} to Supabase.`);
}

await main();
