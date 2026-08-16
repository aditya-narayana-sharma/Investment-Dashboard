import {
  VALIDATION_ERR_TITLE,
  VALIDATION_OK_DETAIL,
  VALIDATION_OK_TITLE,
  VALIDATION_WARN_TITLE,
  inferAssetClassForSymbol,
  isAssetClassFilterEmpty,
  universeAssetClasses,
  type GraphValidation,
  type StrategyEdge,
  type StrategyGraphV2,
  type StrategyNode,
  type ValidationIssue,
} from "../../packages/contracts/src/strategy";
import { edgeKindForConnection, inputPortKind, outputPortKind } from "./ports";

export type { GraphValidation, ValidationIssue, ValidationSeverity } from "../../packages/contracts/src/strategy";

function nodeById(graph: StrategyGraphV2): Map<string, StrategyNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function allocationSymbols(node: StrategyNode): string[] {
  return stringList(node.params.symbols);
}

function weightagePct(node: StrategyNode): number | null {
  const raw = node.params.weightagePct;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function incomingSources(graph: StrategyGraphV2, nodeId: string): string[] {
  return graph.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source).sort();
}

/** Allocations that share the same parent set are one sleeve. Unwired nodes are their own sleeve. */
function allocationSleeveKey(graph: StrategyGraphV2, nodeId: string): string {
  const parents = incomingSources(graph, nodeId);
  return parents.length > 0 ? parents.join("+") : `__unwired__:${nodeId}`;
}

function ancestorsOfKind(graph: StrategyGraphV2, startId: string, kind: StrategyNode["kind"]): boolean {
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = incoming.get(edge.target) ?? [];
    list.push(edge.source);
    incoming.set(edge.target, list);
  }
  const seen = new Set<string>();
  const stack = [...(incoming.get(startId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = graph.nodes.find((item) => item.id === id);
    if (node?.kind === kind) return true;
    stack.push(...(incoming.get(id) ?? []));
  }
  return false;
}

function portMismatch(edge: StrategyEdge, nodes: Map<string, StrategyNode>): boolean {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  if (!source || !target) return false;
  const expected = edgeKindForConnection(source.kind);
  const targetIn = inputPortKind(target.kind);
  const sourceOut = outputPortKind(source.kind);
  if (expected === null || targetIn === null || sourceOut === null) return true;
  if (sourceOut !== targetIn) return true;
  if (edge.kind !== sourceOut) return true;
  return false;
}

function warnAllocationSleeves(graph: StrategyGraphV2, allocations: StrategyNode[], issues: ValidationIssue[]) {
  const groups = new Map<string, StrategyNode[]>();
  for (const node of allocations) {
    const key = allocationSleeveKey(graph, node.id);
    const list = groups.get(key) ?? [];
    list.push(node);
    groups.set(key, list);
  }
  for (const sleeve of groups.values()) {
    const weights = sleeve.map((node) => weightagePct(node));
    if (!weights.every((value) => value !== null)) continue;
    const sum = weights.reduce<number>((total, value) => total + (value ?? 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      issues.push({
        severity: "warning",
        code: "allocation_weights",
        message: `Allocation weights Σ = ${sum}, expected 100`,
        nodeId: sleeve[0]?.id,
      });
    }
  }
}

function warnAssetClassIssues(graph: StrategyGraphV2, allocations: StrategyNode[], issues: ValidationIssue[]) {
  for (const node of graph.nodes) {
    if (node.kind !== "universe") continue;
    if (isAssetClassFilterEmpty(node.params)) {
      issues.push({
        severity: "warning",
        code: "asset_class_empty",
        message: "Asset class filter is empty",
        nodeId: node.id,
      });
      continue;
    }
    const allowed = new Set(universeAssetClasses(node.params));
    const candidates: Array<{ symbol: string; nodeId: string }> = [
      ...stringList(node.params.symbols).map((symbol) => ({ symbol, nodeId: node.id })),
      ...allocations.flatMap((allocation) => allocationSymbols(allocation).map((symbol) => ({ symbol, nodeId: allocation.id }))),
    ];
    for (const { symbol, nodeId } of candidates) {
      const inferred = inferAssetClassForSymbol(symbol);
      if (!allowed.has(inferred)) {
        issues.push({
          severity: "warning",
          code: "asset_class_conflict",
          message: `Allocation symbol ${symbol} (${inferred}) is outside selected asset classes`,
          nodeId,
        });
      }
    }
  }
}

export function validateStrategyGraph(graph: StrategyGraphV2): GraphValidation {
  const issues: ValidationIssue[] = [];
  const nodes = nodeById(graph);
  const ids = new Set(nodes.keys());

  const hasEntry = graph.nodes.some((node) => node.kind === "entry_trigger");
  const hasExit = graph.nodes.some((node) => node.kind === "exit_trigger");
  if (!hasEntry) {
    issues.push({ severity: "error", code: "missing_entry_trigger", message: "Missing entry_trigger" });
  }
  if (!hasExit) {
    issues.push({ severity: "error", code: "missing_exit_trigger", message: "Missing exit_trigger" });
  }

  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({
        severity: "error",
        code: "dangling_edge",
        message: `Dangling edge ${edge.id}: unknown node id`,
        edgeId: edge.id,
      });
      continue;
    }
    if (portMismatch(edge, nodes)) {
      issues.push({
        severity: "error",
        code: "port_type_mismatch",
        message: `Edge ${edge.id} port type mismatch (${edge.kind})`,
        edgeId: edge.id,
      });
    }
  }

  for (const node of graph.nodes) {
    if (node.kind !== "algorithm_reference") continue;
    const pinned = graph.pinnedAlgorithmVersions[node.id];
    const paramVersion = typeof node.params.version === "string" ? node.params.version : "";
    if (!pinned && !paramVersion) {
      issues.push({
        severity: "error",
        code: "unpinned_algorithm_reference",
        message: `algorithm_reference ${node.id} has no pinned version`,
        nodeId: node.id,
      });
    }
  }

  const incoming = new Set(graph.edges.map((edge) => edge.target));
  for (const node of graph.nodes) {
    if (node.kind === "exit_trigger" && !incoming.has(node.id)) {
      issues.push({
        severity: "warning",
        code: "exit_unwired",
        message: "Exit trigger is present but unwired",
        nodeId: node.id,
      });
    }
  }

  const allocations = graph.nodes.filter((node) => node.kind === "allocation");
  warnAllocationSleeves(graph, allocations, issues);

  for (const node of graph.nodes) {
    if (node.kind !== "paper_action" && node.kind !== "broker_preview") continue;
    if (!ancestorsOfKind(graph, node.id, "risk_limit")) {
      issues.push({
        severity: "warning",
        code: "missing_risk_limit",
        message: `${node.kind} has no risk_limit in its path`,
        nodeId: node.id,
      });
    }
  }

  warnAssetClassIssues(graph, allocations, issues);

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const ok = errors.length === 0;
  return {
    ok,
    issues,
    stripTitle: ok && warnings.length === 0 ? VALIDATION_OK_TITLE : ok ? VALIDATION_WARN_TITLE : VALIDATION_ERR_TITLE,
    stripDetail: ok ? VALIDATION_OK_DETAIL : errors.map((issue) => issue.message).join(" · "),
  };
}
