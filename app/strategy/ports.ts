import type { EdgeKind, NodeKind } from "./graph-types";

export const EDGE_COLORS: Record<EdgeKind, string> = {
  series: "#3b82f6",
  boolean: "#f59e0b",
  trigger: "#22c55e",
  allocation: "#22d3ee",
};

export const PORT_LEGEND: Array<{ kind: EdgeKind; label: string; color: string }> = [
  { kind: "series", label: "series", color: EDGE_COLORS.series },
  { kind: "boolean", label: "boolean", color: EDGE_COLORS.boolean },
  { kind: "trigger", label: "trigger", color: EDGE_COLORS.trigger },
  { kind: "allocation", label: "allocation", color: EDGE_COLORS.allocation },
];

export function outputPortKind(kind: NodeKind): EdgeKind | null {
  switch (kind) {
    case "universe":
    case "kpi":
      return "series";
    case "comparator":
    case "logical_group":
      return "boolean";
    case "entry_trigger":
    case "exit_trigger":
      return "trigger";
    case "allocation":
    case "rebalance":
    case "risk_limit":
      return "allocation";
    case "paper_action":
    case "broker_preview":
    case "algorithm_reference":
      return null;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function inputPortKind(kind: NodeKind): EdgeKind | null {
  switch (kind) {
    case "universe":
      return null;
    case "kpi":
    case "comparator":
      return "series";
    case "logical_group":
    case "entry_trigger":
    case "exit_trigger":
      return "boolean";
    case "allocation":
      return "trigger";
    case "rebalance":
    case "risk_limit":
    case "paper_action":
    case "broker_preview":
      return "allocation";
    case "algorithm_reference":
      return null;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function portsCompatible(sourceKind: NodeKind, targetKind: NodeKind): boolean {
  const out = outputPortKind(sourceKind);
  const inn = inputPortKind(targetKind);
  return out !== null && inn !== null && out === inn;
}

export function incompatibilityReason(sourceKind: NodeKind, targetKind: NodeKind): string | null {
  if (portsCompatible(sourceKind, targetKind)) return null;
  const out = outputPortKind(sourceKind);
  const inn = inputPortKind(targetKind);
  const sourceLabel = sourceKind.replaceAll("_", " ");
  const targetLabel = targetKind.replaceAll("_", " ");
  if (out === null) return `${sourceLabel} has no output — nothing to connect from`;
  if (inn === null) return `${targetLabel} has no input — nothing to connect into`;
  return `${out} cannot connect to ${inn} — ${sourceLabel} → ${targetLabel} rejected`;
}

export function edgeKindForConnection(sourceKind: NodeKind): EdgeKind | null {
  return outputPortKind(sourceKind);
}
