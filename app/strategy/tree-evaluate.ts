import type { ComparatorOp } from "../../packages/contracts/src/strategy.ts";
import {
  walkTreeNodes,
  type StrategyTreeV1,
  type TreeNode,
  type TreeOperand,
} from "../../packages/contracts/src/strategy-tree.ts";
import { findTreeInstrument, type TreeInstrument } from "./tree-instruments";
import type { ComputedKpi } from "./tree-indicators";
import type { YfinanceFundamentals } from "./yfinance-kpis";

export type LiveValueStatus = "live" | "stale" | "unavailable";

export type TreeKpiLiveValue = {
  kpiId: string;
  symbol: string;
  value: number | null;
  asOf?: string;
  source: "kite" | "yfinance" | "computed";
  status: LiveValueStatus;
  label?: string;
};

export type TreeNodeLive = {
  nodeId: string;
  kind: TreeNode["kind"];
  symbol?: string;
  instrument?: TreeInstrument;
  passed?: boolean | null;
  left?: TreeKpiLiveValue;
  right?: TreeKpiLiveValue;
  values: TreeKpiLiveValue[];
};

function compare(op: ComparatorOp, left: number, right: number): boolean {
  switch (op) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default: {
      const _never: never = op;
      return _never;
    }
  }
}

function fundamentalForKpi(kpiId: string, fundamentals: YfinanceFundamentals): number | null {
  switch (kpiId) {
    case "sales_growth_yoy":
      return fundamentals.salesGrowthYoy ?? null;
    case "pe_ttm":
      return fundamentals.peTtm ?? null;
    case "ev_ebitda":
      return fundamentals.evEbitda ?? null;
    default:
      return null;
  }
}

export function lookupKpiValue(
  kpiId: string,
  symbol: string,
  computed: readonly ComputedKpi[],
  fundamentals: YfinanceFundamentals,
  instrument: TreeInstrument | undefined,
  asOf: string | undefined,
  kiteStatus: LiveValueStatus,
): TreeKpiLiveValue {
  const label = kpiId;
  if (kpiId === "close" && instrument?.lastPrice !== undefined) {
    return {
      kpiId,
      symbol,
      value: instrument.lastPrice,
      asOf,
      source: "kite",
      status: kiteStatus,
      label,
    };
  }
  const computedHit = computed.find((item) => item.kpiId === kpiId);
  if (computedHit) {
    return {
      kpiId,
      symbol,
      value: computedHit.value,
      asOf,
      source: "computed",
      status: computedHit.value === null ? "unavailable" : "live",
      label: computedHit.label ?? label,
    };
  }
  const fundamental = fundamentalForKpi(kpiId, fundamentals);
  if (fundamental !== null) {
    return {
      kpiId,
      symbol,
      value: fundamental,
      asOf,
      source: "yfinance",
      status: "live",
      label,
    };
  }
  return {
    kpiId,
    symbol,
    value: null,
    asOf,
    source: "yfinance",
    status: "unavailable",
    label,
  };
}

function operandValue(
  operand: TreeOperand,
  kpis: Map<string, TreeKpiLiveValue>,
): TreeKpiLiveValue | { type: "number"; value: number } {
  if (operand.type === "number") return { type: "number", value: operand.value };
  return kpis.get(`${operand.kpiId}:${operand.symbol.trim().toUpperCase()}`) ?? {
    kpiId: operand.kpiId,
    symbol: operand.symbol.trim().toUpperCase(),
    value: null,
    source: "yfinance",
    status: "unavailable",
    label: operand.kpiId,
  };
}

export function evaluateTreeLive(
  tree: StrategyTreeV1,
  instruments: readonly TreeInstrument[],
  kpiValues: Map<string, TreeKpiLiveValue>,
): Record<string, TreeNodeLive> {
  const nodes: Record<string, TreeNodeLive> = {};
  walkTreeNodes(tree.children, (node) => {
    switch (node.kind) {
      case "asset": {
        const symbol = node.params.symbol.trim().toUpperCase();
        const instrument = findTreeInstrument(instruments, symbol);
        nodes[node.id] = {
          nodeId: node.id,
          kind: node.kind,
          symbol,
          ...(instrument ? { instrument } : {}),
          values: instrument?.lastPrice !== undefined
            ? [{
              kpiId: "close",
              symbol,
              value: instrument.lastPrice,
              source: "kite",
              status: "live",
              label: "Last price",
            }]
            : [],
        };
        break;
      }
      case "if_else": {
        const left = operandValue(node.params.left, kpiValues);
        const right = operandValue(node.params.right, kpiValues);
        const leftValue = "type" in left ? left.value : left.value;
        const rightValue = "type" in right ? right.value : right.value;
        const passed = leftValue === null || rightValue === null || leftValue === undefined || rightValue === undefined
          ? null
          : compare(node.params.op, leftValue, rightValue);
        const values: TreeKpiLiveValue[] = [];
        if (!("type" in left)) values.push(left);
        if (!("type" in right)) values.push(right);
        nodes[node.id] = {
          nodeId: node.id,
          kind: node.kind,
          passed,
          ...(!("type" in left) ? { left } : {}),
          ...(!("type" in right) ? { right } : {}),
          values,
        };
        break;
      }
      case "filter":
      case "group":
      case "weight":
      case "any_all":
        nodes[node.id] = { nodeId: node.id, kind: node.kind, values: [] };
        break;
      default: {
        const _never: never = node;
        return _never;
      }
    }
  });
  return nodes;
}
