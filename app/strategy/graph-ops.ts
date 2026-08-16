import { SNAP_PX, UNDO_DEPTH, cloneGraph, defaultNodeParams, type NodeKind, type StrategyGraphV2, type StrategyNode } from "./graph-types";
import { edgeKindForConnection, portsCompatible } from "./ports";

export function snapToGrid(value: number, snap = SNAP_PX): number {
  return Math.round(value / snap) * snap;
}

export function nextNodeId(kind: NodeKind, existing: Iterable<string>): string {
  const prefix = kind.replaceAll("_", "-");
  let index = 1;
  const used = new Set(existing);
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function defaultParams(kind: NodeKind): Record<string, unknown> {
  return defaultNodeParams(kind);
}

export function defaultLabel(kind: NodeKind): string {
  switch (kind) {
    case "universe":
      return "Universe";
    case "kpi":
      return "KPI";
    case "comparator":
      return "Comparator";
    case "logical_group":
      return "AND / OR";
    case "entry_trigger":
      return "Entry trigger";
    case "exit_trigger":
      return "Exit trigger";
    case "allocation":
      return "Allocation";
    case "rebalance":
      return "Rebalance";
    case "risk_limit":
      return "Risk limit";
    case "paper_action":
      return "Paper action";
    case "broker_preview":
      return "Broker preview";
    case "algorithm_reference":
      return "Algorithm reference";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function createNode(kind: NodeKind, position: { x: number; y: number }, existingIds: Iterable<string>, extras?: Record<string, unknown>): StrategyNode {
  return {
    id: nextNodeId(kind, existingIds),
    kind,
    label: defaultLabel(kind),
    params: { ...defaultParams(kind), ...extras },
    position: { x: snapToGrid(position.x), y: snapToGrid(position.y) },
  };
}

export function connectNodes(graph: StrategyGraphV2, sourceId: string, targetId: string): StrategyGraphV2 | null {
  const source = graph.nodes.find((node) => node.id === sourceId);
  const target = graph.nodes.find((node) => node.id === targetId);
  if (!source || !target) return null;
  if (!portsCompatible(source.kind, target.kind)) return null;
  const kind = edgeKindForConnection(source.kind);
  if (!kind) return null;
  if (graph.edges.some((edge) => edge.source === sourceId && edge.target === targetId)) return graph;
  const next = cloneGraph(graph);
  next.edges.push({
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    kind,
    sourcePort: "out",
    targetPort: "in",
  });
  next.updatedAt = new Date().toISOString();
  return next;
}

export function removeNode(graph: StrategyGraphV2, nodeId: string): StrategyGraphV2 {
  const next = cloneGraph(graph);
  next.nodes = next.nodes.filter((node) => node.id !== nodeId);
  next.edges = next.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
  delete next.pinnedAlgorithmVersions[nodeId];
  next.updatedAt = new Date().toISOString();
  return next;
}

export function parseStrategyGraph(raw: unknown): StrategyGraphV2 {
  if (!raw || typeof raw !== "object") throw new Error("Graph JSON must be an object");
  const value = raw as StrategyGraphV2;
  if (value.schemaVersion !== "2") throw new Error("schemaVersion must be \"2\"");
  if (typeof value.id !== "string" || !value.id) throw new Error("Graph id is required");
  if (typeof value.name !== "string" || !value.name) throw new Error("Graph name is required");
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error("nodes and edges are required");
  if (!value.pinnedAlgorithmVersions || typeof value.pinnedAlgorithmVersions !== "object") {
    throw new Error("pinnedAlgorithmVersions is required");
  }
  return cloneGraph({
    schemaVersion: "2",
    id: value.id,
    name: value.name,
    description: value.description,
    interval: value.interval ?? "day",
    nodes: value.nodes,
    edges: value.edges,
    pinnedAlgorithmVersions: value.pinnedAlgorithmVersions,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

export class GraphHistory {
  private past: StrategyGraphV2[] = [];
  private future: StrategyGraphV2[] = [];
  private current: StrategyGraphV2;
  private readonly depth: number;

  constructor(current: StrategyGraphV2, depth = UNDO_DEPTH) {
    this.current = current;
    this.depth = depth;
  }

  get graph(): StrategyGraphV2 {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  push(next: StrategyGraphV2) {
    this.past.push(cloneGraph(this.current));
    if (this.past.length > this.depth) this.past.shift();
    this.current = cloneGraph(next);
    this.future = [];
  }

  replace(next: StrategyGraphV2) {
    this.current = cloneGraph(next);
  }

  undo(): StrategyGraphV2 | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(cloneGraph(this.current));
    this.current = previous;
    return cloneGraph(this.current);
  }

  redo(): StrategyGraphV2 | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(cloneGraph(this.current));
    this.current = next;
    return cloneGraph(this.current);
  }
}
