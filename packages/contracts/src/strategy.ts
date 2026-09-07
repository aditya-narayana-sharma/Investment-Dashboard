/**
 * Canonical StrategyGraphV2 contract (schemaVersion "2").
 * Client helpers and the validator live in `app/strategy/graph-types.ts` + `validate.ts`.
 * Do not bump schemaVersion; extend fields in a backward-compatible way.
 */
import type { StrategyTreeV1 } from "./strategy-tree.ts";

export const STRATEGY_SCHEMA_VERSION = "2" as const;

export type CandleInterval = "1m" | "5m" | "15m" | "30m" | "hour" | "day" | "week" | "month";

export type EdgeKind = "series" | "boolean" | "trigger" | "allocation";

export type NodeKind =
  | "universe"
  | "kpi"
  | "comparator"
  | "logical_group"
  | "entry_trigger"
  | "exit_trigger"
  | "allocation"
  | "rebalance"
  | "risk_limit"
  | "paper_action"
  | "broker_preview"
  | "algorithm_reference";

export type ComparatorOp = "<" | "<=" | ">" | ">=" | "==" | "!=";

export type LogicalOp = "and" | "or";

export const ASSET_CLASSES = ["Equity", "ETF", "Cash"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const DEFAULT_ASSET_CLASSES: readonly AssetClass[] = ["Equity", "ETF"];
export const DEFAULT_INTERVAL: CandleInterval = "day";
export const DEFAULT_KPI_WEIGHTAGE_PCT = 100;

/** Exchange-listed instrument types used by a backtest/engine runner. */
export type ExchangeInstrumentType = "EQ" | "ETF";

/**
 * Engine mapping:
 *   Equity → InstrumentType "EQ"
 *   ETF    → InstrumentType "ETF"
 *   Cash   → cash sleeve (not an exchange series)
 */
export type InstrumentType = ExchangeInstrumentType | "CASH";

export type InstrumentFilter = {
  instrumentTypes: ExchangeInstrumentType[];
  includeCashSleeve: boolean;
};

export type UniverseNodeParams = {
  assetClasses: AssetClass[];
  symbols?: string[];
};

export type KpiNodeParams = {
  kpiId: string;
  weightagePct: number;
};

export type ComparatorNodeParams = {
  op: ComparatorOp;
  value: number;
};

export type LogicalGroupNodeParams = {
  op: LogicalOp;
};

export type AllocationNodeParams = {
  weightagePct: number;
  symbols?: string[];
};

export type RiskLimitNodeParams = {
  allow?: boolean;
};

export type RebalanceNodeParams = {
  cadence?: string;
};

export type AlgorithmReferenceNodeParams = {
  algorithmId: string;
  version: string;
};

export type EmptyNodeParams = Record<string, never>;

export type NodeParamsByKind = {
  universe: UniverseNodeParams;
  kpi: KpiNodeParams;
  comparator: ComparatorNodeParams;
  logical_group: LogicalGroupNodeParams;
  entry_trigger: EmptyNodeParams;
  exit_trigger: EmptyNodeParams;
  allocation: AllocationNodeParams;
  rebalance: RebalanceNodeParams;
  risk_limit: RiskLimitNodeParams;
  paper_action: EmptyNodeParams;
  broker_preview: EmptyNodeParams;
  algorithm_reference: AlgorithmReferenceNodeParams;
};

export type StrategyNode = {
  id: string;
  kind: NodeKind;
  label?: string;
  params: Record<string, unknown>;
  position?: { x: number; y: number };
};

export type StrategyEdge = {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  sourcePort?: string;
  targetPort?: string;
};

export type StrategyGraphV2 = {
  schemaVersion: "2";
  id: string;
  name: string;
  description?: string;
  interval: CandleInterval;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  pinnedAlgorithmVersions: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  /** Nested-block source of truth. Omitted on graph-only library rows. */
  tree?: StrategyTreeV1;
};

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  | "missing_entry_trigger"
  | "missing_exit_trigger"
  | "port_type_mismatch"
  | "dangling_edge"
  | "unpinned_algorithm_reference"
  | "exit_unwired"
  | "allocation_weights"
  | "missing_risk_limit"
  | "asset_class_empty"
  | "asset_class_conflict";

export type ValidationIssue = {
  severity: ValidationSeverity;
  code: ValidationCode | string;
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type GraphValidation = {
  ok: boolean;
  issues: ValidationIssue[];
  stripTitle: string;
  stripDetail: string;
};

export const VALIDATION_OK_TITLE = "VALIDATION: NO ISSUES";
export const VALIDATION_OK_DETAIL = "Entry/exit paths + typed edges OK";
export const VALIDATION_WARN_TITLE = "VALIDATION: WARNINGS";
export const VALIDATION_ERR_TITLE = "VALIDATION: ERRORS";

export function isEdgeKind(value: string): value is EdgeKind {
  return value === "series" || value === "boolean" || value === "trigger" || value === "allocation";
}

export function isNodeKind(value: string): value is NodeKind {
  switch (value) {
    case "universe":
    case "kpi":
    case "comparator":
    case "logical_group":
    case "entry_trigger":
    case "exit_trigger":
    case "allocation":
    case "rebalance":
    case "risk_limit":
    case "paper_action":
    case "broker_preview":
    case "algorithm_reference":
      return true;
    default:
      return false;
  }
}

export function isAssetClass(value: string): value is AssetClass {
  return (ASSET_CLASSES as readonly string[]).includes(value);
}

export function isComparatorOp(value: string): value is ComparatorOp {
  switch (value) {
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "==":
    case "!=":
      return true;
    default:
      return false;
  }
}

export function isLogicalOp(value: string): value is LogicalOp {
  switch (value) {
    case "and":
    case "or":
      return true;
    default:
      return false;
  }
}

export function normalizeAssetClasses(value: unknown): AssetClass[] {
  if (!Array.isArray(value)) return [];
  const next: AssetClass[] = [];
  for (const item of value) {
    if (typeof item === "string" && isAssetClass(item) && !next.includes(item)) next.push(item);
  }
  return next;
}

/** Missing `assetClasses` → default Equity+ETF. Explicit `[]` stays empty (validator warning). */
export function universeAssetClasses(params: Record<string, unknown> | undefined): AssetClass[] {
  if (!params || params.assetClasses === undefined) return [...DEFAULT_ASSET_CLASSES];
  return normalizeAssetClasses(params.assetClasses);
}

export function isAssetClassFilterEmpty(params: Record<string, unknown> | undefined): boolean {
  if (!params || params.assetClasses === undefined) return false;
  return normalizeAssetClasses(params.assetClasses).length === 0;
}

/** Union of universe node filters. Explicit empty filter wins; otherwise default Equity+ETF. */
export function graphUniverseAssetClasses(graph: StrategyGraphV2): AssetClass[] {
  const universes = graph.nodes.filter((node) => node.kind === "universe");
  if (universes.some((node) => isAssetClassFilterEmpty(node.params))) return [];
  const collected: AssetClass[] = [];
  for (const node of universes) {
    for (const item of universeAssetClasses(node.params)) {
      if (!collected.includes(item)) collected.push(item);
    }
  }
  return collected.length > 0 ? collected : [...DEFAULT_ASSET_CLASSES];
}

export function instrumentTypeForAssetClass(assetClass: AssetClass): InstrumentType {
  switch (assetClass) {
    case "Equity":
      return "EQ";
    case "ETF":
      return "ETF";
    case "Cash":
      return "CASH";
    default: {
      const _never: never = assetClass;
      return _never;
    }
  }
}

export function instrumentFilterFromAssetClasses(assetClasses: readonly string[]): InstrumentFilter {
  const classes = normalizeAssetClasses(assetClasses);
  const instrumentTypes: ExchangeInstrumentType[] = [];
  if (classes.includes("Equity")) instrumentTypes.push("EQ");
  if (classes.includes("ETF")) instrumentTypes.push("ETF");
  return {
    instrumentTypes,
    includeCashSleeve: classes.includes("Cash"),
  };
}

export function selectedInstrumentTypes(assetClasses: readonly string[]): InstrumentType[] {
  const types: InstrumentType[] = [];
  for (const item of normalizeAssetClasses(assetClasses)) {
    const type = instrumentTypeForAssetClass(item);
    if (!types.includes(type)) types.push(type);
  }
  return types;
}

const KNOWN_ETF_SYMBOLS = new Set([
  "NIFTYBEES", "JUNIORBEES", "BANKBEES", "GOLDBEES", "SILVERBEES", "LIQUIDBEES",
  "ITBEES", "PHARMABEES", "PSUBNKBEES", "INFRABEES", "SETFNIF50", "SETFNN50", "GILTBEES",
]);

export function inferAssetClassForSymbol(symbol: string): AssetClass {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return "Equity";
  if (normalized === "CASH" || normalized === "INR" || normalized === "CASH_SLEEVE") return "Cash";
  if (KNOWN_ETF_SYMBOLS.has(normalized) || normalized.endsWith("BEES") || normalized.includes("ETF")) return "ETF";
  return "Equity";
}

export function kiteSeriesToAssetClass(series: string): AssetClass {
  const normalized = series.trim().toUpperCase();
  if (normalized === "ETF" || normalized === "EQETF") return "ETF";
  return "Equity";
}

export function instrumentMatchesFilter(symbol: string, filter: InstrumentFilter, series?: string): boolean {
  const inferred = series ? kiteSeriesToAssetClass(series) : inferAssetClassForSymbol(symbol);
  if (inferred === "Cash") return filter.includeCashSleeve;
  const type = instrumentTypeForAssetClass(inferred);
  if (type === "CASH") return filter.includeCashSleeve;
  return filter.instrumentTypes.includes(type);
}

/** Engine/backtest helper: keep symbols whose type ∈ selected classes (EQ|ETF + optional cash sleeve). */
export function instrumentMatchesAssetClasses(symbol: string, assetClasses: readonly string[], series?: string): boolean {
  const filter = instrumentFilterFromAssetClasses(assetClasses);
  if (filter.instrumentTypes.length === 0 && !filter.includeCashSleeve) return false;
  return instrumentMatchesFilter(symbol, filter, series);
}

export function filterSymbolsByAssetClasses(symbols: readonly string[], assetClasses: readonly string[]): string[] {
  return symbols.filter((symbol) => instrumentMatchesAssetClasses(symbol, assetClasses));
}

export function filterInstrumentsByAssetClasses<T extends { symbol: string; series?: string; instrumentType?: string }>(
  instruments: readonly T[],
  assetClasses: readonly string[],
): T[] {
  const filter = instrumentFilterFromAssetClasses(assetClasses);
  if (filter.instrumentTypes.length === 0 && !filter.includeCashSleeve) return [];
  return instruments.filter((item) => {
    const listed = typeof item.instrumentType === "string" ? item.instrumentType.toUpperCase() : "";
    if (listed === "CASH" || inferAssetClassForSymbol(item.symbol) === "Cash") return filter.includeCashSleeve;
    if (listed === "EQ" || listed === "ETF") {
      return filter.instrumentTypes.includes(listed);
    }
    return instrumentMatchesFilter(item.symbol, filter, item.series);
  });
}

export function clampWeightagePct(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_KPI_WEIGHTAGE_PCT;
  return Math.min(100, Math.max(0, value));
}

export function readWeightagePct(params: Record<string, unknown> | undefined, fallback = DEFAULT_KPI_WEIGHTAGE_PCT): number {
  const raw = params?.weightagePct;
  if (typeof raw === "number" && Number.isFinite(raw)) return clampWeightagePct(raw);
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return clampWeightagePct(parsed);
  }
  return fallback;
}

export function defaultNodeParams(kind: NodeKind): Record<string, unknown> {
  switch (kind) {
    case "universe":
      return { assetClasses: [...DEFAULT_ASSET_CLASSES] };
    case "kpi":
      return { kpiId: "close", weightagePct: DEFAULT_KPI_WEIGHTAGE_PCT };
    case "comparator":
      return { op: "<", value: 30 };
    case "logical_group":
      return { op: "and" };
    case "entry_trigger":
      return {};
    case "exit_trigger":
      return {};
    case "allocation":
      return { weightagePct: 100, symbols: [] as string[] };
    case "rebalance":
      return {};
    case "risk_limit":
      return { allow: true };
    case "paper_action":
      return {};
    case "broker_preview":
      return {};
    case "algorithm_reference":
      return { algorithmId: "", version: "" };
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}
