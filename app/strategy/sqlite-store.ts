import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { StrategyGraphV2 } from "./graph-types";

export const STRATEGY_LIBRARY_DB_PATH = process.env.STRATEGY_LIBRARY_DB_PATH
  ?? join(process.cwd(), "artifacts", "private", "strategies.sqlite");

export type StoredStrategy = {
  id: string;
  name: string;
  description: string | null;
  interval: string;
  graph: StrategyGraphV2;
  createdAt: string;
  updatedAt: string;
};

export type StoredBacktestConfigure = {
  id: string;
  strategyId: string;
  requestJson: string;
  status: "configured";
  ran: false;
  createdAt: string;
};

function openDb(): DatabaseSync {
  mkdirSync(dirname(STRATEGY_LIBRARY_DB_PATH), { recursive: true });
  const db = new DatabaseSync(STRATEGY_LIBRARY_DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      interval TEXT NOT NULL,
      graph_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS backtest_requests (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL,
      request_json TEXT NOT NULL,
      status TEXT NOT NULL,
      ran INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function withDb<T>(fn: (db: DatabaseSync) => T): T {
  const db = openDb();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function rowToStrategy(row: Record<string, unknown>): StoredStrategy {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    interval: String(row.interval),
    graph: JSON.parse(String(row.graph_json)) as StrategyGraphV2,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listStrategies(): StoredStrategy[] {
  return withDb((db) => {
    const rows = db.prepare("SELECT * FROM strategies ORDER BY updated_at DESC").all() as Record<string, unknown>[];
    return rows.map(rowToStrategy);
  });
}

export function getStrategy(id: string): StoredStrategy | null {
  return withDb((db) => {
    const row = db.prepare("SELECT * FROM strategies WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? rowToStrategy(row) : null;
  });
}

export function upsertStrategy(graph: StrategyGraphV2): StoredStrategy {
  const now = new Date().toISOString();
  const createdAt = graph.createdAt ?? now;
  const updatedAt = now;
  const persisted: StrategyGraphV2 = {
    ...graph,
    createdAt,
    updatedAt,
  };
  const graphJson = JSON.stringify(persisted);
  return withDb((db) => {
    db.prepare(`
      INSERT INTO strategies (id, name, description, interval, graph_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        interval = excluded.interval,
        graph_json = excluded.graph_json,
        updated_at = excluded.updated_at
    `).run(
      persisted.id,
      persisted.name,
      persisted.description ?? null,
      persisted.interval,
      graphJson,
      createdAt,
      updatedAt,
    );
    const row = db.prepare("SELECT * FROM strategies WHERE id = ?").get(persisted.id) as Record<string, unknown>;
    return rowToStrategy(row);
  });
}

export function insertBacktestConfigure(strategyId: string, requestJson: string): StoredBacktestConfigure {
  const id = `bt-${strategyId}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  return withDb((db) => {
    db.prepare(`
      INSERT INTO backtest_requests (id, strategy_id, request_json, status, ran, created_at)
      VALUES (?, ?, ?, 'configured', 0, ?)
    `).run(id, strategyId, requestJson, createdAt);
    return {
      id,
      strategyId,
      requestJson,
      status: "configured",
      ran: false,
      createdAt,
    };
  });
}
