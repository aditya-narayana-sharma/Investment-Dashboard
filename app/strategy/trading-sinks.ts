import type { StrategyGraphV2, StrategyNode } from "./graph-types";

export type TradingSinkKind = "paper_action" | "broker_preview";

export type TradingSinkPreview = {
  kind: TradingSinkKind;
  submitted: false;
  strategyId: string;
  nodeId: string;
  label: string;
  reason: string;
};

function isTradingSinkKind(kind: StrategyNode["kind"]): kind is TradingSinkKind {
  return kind === "paper_action" || kind === "broker_preview";
}

export function stampTradingSinksUnsubmitted(graph: StrategyGraphV2): StrategyGraphV2 {
  const next = structuredClone(graph);
  for (const node of next.nodes) {
    if (!isTradingSinkKind(node.kind)) continue;
    node.params = { ...node.params, submitted: false };
  }
  return next;
}

/** Paper / broker preview only. Never places a live order. */
export function buildTradingSinkPreview(graph: StrategyGraphV2, nodeId: string): TradingSinkPreview {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node || !isTradingSinkKind(node.kind)) {
    throw new Error(`Node ${nodeId} is not a paper_action or broker_preview sink`);
  }
  const reason = node.kind === "paper_action"
    ? "Paper sink only — no live order was submitted."
    : "Broker preview only — submitted is false and no Kite order was placed.";
  return {
    kind: node.kind,
    submitted: false,
    strategyId: graph.id,
    nodeId: node.id,
    label: node.label ?? node.kind,
    reason,
  };
}

export function listTradingSinkPreviews(graph: StrategyGraphV2): TradingSinkPreview[] {
  return graph.nodes
    .filter((node) => isTradingSinkKind(node.kind))
    .map((node) => buildTradingSinkPreview(graph, node.id));
}
