/**
 * StrategyTreeV1 — nested-block document for the Algorithm Builder.
 * Compiles to StrategyGraphV2 (schemaVersion "2"). Do not invent a third schema version.
 */
import {
  ASSET_CLASSES,
  DEFAULT_ASSET_CLASSES,
  DEFAULT_INTERVAL,
  isAssetClass,
  isComparatorOp,
  isLogicalOp,
  type AssetClass,
  type CandleInterval,
  type ComparatorOp,
  type LogicalOp,
} from "./strategy.ts";

export const STRATEGY_TREE_VERSION = "1" as const;

export type TreeBlockKind = "asset" | "group" | "weight" | "if_else" | "any_all" | "filter";

export type WeightMethod = "specified" | "inverse_volatility";

export type TreeOperand =
  | { type: "kpi"; kpiId: string; symbol: string }
  | { type: "number"; value: number };

export type WeightChild = {
  percent?: number;
  node: TreeNode;
};

type TreeNodeBase = {
  id: string;
  label?: string;
};

export type AssetNode = TreeNodeBase & {
  kind: "asset";
  params: { symbol: string };
  children: [];
};

export type GroupNode = TreeNodeBase & {
  kind: "group";
  params: Record<string, never>;
  children: TreeNode[];
};

export type WeightNode = TreeNodeBase & {
  kind: "weight";
  params: { method: WeightMethod; lookbackDays?: number };
  children: WeightChild[];
};

export type IfElseNode = TreeNodeBase & {
  kind: "if_else";
  params: { left: TreeOperand; op: ComparatorOp; right: TreeOperand };
  then: TreeNode[];
  else: TreeNode[];
};

export type AnyAllNode = TreeNodeBase & {
  kind: "any_all";
  params: { op: LogicalOp };
  children: TreeNode[];
};

export type FilterNode = TreeNodeBase & {
  kind: "filter";
  params: { assetClasses: AssetClass[]; symbols?: string[] };
  children: TreeNode[];
};

export type TreeNode = AssetNode | GroupNode | WeightNode | IfElseNode | AnyAllNode | FilterNode;

export type StrategyTreeV1 = {
  treeVersion: "1";
  id: string;
  name: string;
  description?: string;
  interval: CandleInterval;
  children: TreeNode[];
  createdAt?: string;
  updatedAt?: string;
};

export type TreeValidationCode =
  | "weight_percent_sum"
  | "unknown_kpi"
  | "empty_else"
  | "weight_method_unsupported"
  | "invalid_tree";

export type TreeValidationIssue = {
  severity: "error" | "warning";
  code: TreeValidationCode | string;
  message: string;
  nodeId?: string;
};

export type TreeValidation = {
  ok: boolean;
  issues: TreeValidationIssue[];
};

export const TREE_BLOCK_KINDS: readonly TreeBlockKind[] = [
  "asset",
  "group",
  "weight",
  "if_else",
  "any_all",
  "filter",
];

export function isTreeBlockKind(value: string): value is TreeBlockKind {
  switch (value) {
    case "asset":
    case "group":
    case "weight":
    case "if_else":
    case "any_all":
    case "filter":
      return true;
    default:
      return false;
  }
}

export function isWeightMethod(value: string): value is WeightMethod {
  switch (value) {
    case "specified":
    case "inverse_volatility":
      return true;
    default:
      return false;
  }
}

export function isTreeOperand(value: unknown): value is TreeOperand {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.type === "number") return typeof record.value === "number" && Number.isFinite(record.value);
  if (record.type === "kpi") {
    return typeof record.kpiId === "string" && record.kpiId.length > 0 && typeof record.symbol === "string";
  }
  return false;
}

export function defaultTreeInterval(): CandleInterval {
  return DEFAULT_INTERVAL;
}

export function defaultFilterAssetClasses(): AssetClass[] {
  return [...DEFAULT_ASSET_CLASSES];
}

export function knownAssetClasses(): readonly AssetClass[] {
  return ASSET_CLASSES;
}

export function operandKpiIds(operand: TreeOperand): string[] {
  return operand.type === "kpi" ? [operand.kpiId] : [];
}

export function cloneTree(tree: StrategyTreeV1): StrategyTreeV1 {
  return structuredClone(tree);
}

export function childNodesOf(node: TreeNode): TreeNode[] {
  switch (node.kind) {
    case "asset":
      return [];
    case "group":
    case "any_all":
    case "filter":
      return node.children;
    case "weight":
      return node.children.map((child) => child.node);
    case "if_else":
      return [...node.then, ...node.else];
    default: {
      const _never: never = node;
      return _never;
    }
  }
}

export function walkTreeNodes(nodes: readonly TreeNode[], visit: (node: TreeNode) => void) {
  for (const node of nodes) {
    visit(node);
    walkTreeNodes(childNodesOf(node), visit);
  }
}

export function collectTreeNodeIds(tree: StrategyTreeV1): string[] {
  const ids = [tree.id];
  walkTreeNodes(tree.children, (node) => {
    ids.push(node.id);
  });
  return ids;
}

export function findTreeNode(tree: StrategyTreeV1, id: string): TreeNode | null {
  let found: TreeNode | null = null;
  walkTreeNodes(tree.children, (node) => {
    if (node.id === id) found = node;
  });
  return found;
}

export function parseTreeOperand(raw: unknown, fallback: TreeOperand): TreeOperand {
  if (isTreeOperand(raw)) return structuredClone(raw);
  return structuredClone(fallback);
}

export function parseWeightChildren(raw: unknown): WeightChild[] {
  if (!Array.isArray(raw)) return [];
  const children: WeightChild[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const node = parseTreeNode(record.node);
    if (!node) continue;
    const child: WeightChild = { node };
    if (typeof record.percent === "number" && Number.isFinite(record.percent)) child.percent = record.percent;
    children.push(child);
  }
  return children;
}

export function parseTreeNode(raw: unknown): TreeNode | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.kind !== "string" || !isTreeBlockKind(value.kind)) return null;
  const label = typeof value.label === "string" ? value.label : undefined;
  const params = value.params && typeof value.params === "object" && !Array.isArray(value.params)
    ? value.params as Record<string, unknown>
    : {};

  switch (value.kind) {
    case "asset": {
      const symbol = typeof params.symbol === "string" ? params.symbol : "";
      return { id: value.id, kind: "asset", label, params: { symbol }, children: [] };
    }
    case "group":
      return {
        id: value.id,
        kind: "group",
        label,
        params: {},
        children: parseTreeNodeList(value.children),
      };
    case "weight": {
      const method = typeof params.method === "string" && isWeightMethod(params.method) ? params.method : "specified";
      const lookbackDays = typeof params.lookbackDays === "number" && Number.isFinite(params.lookbackDays)
        ? params.lookbackDays
        : undefined;
      return {
        id: value.id,
        kind: "weight",
        label,
        params: lookbackDays === undefined ? { method } : { method, lookbackDays },
        children: parseWeightChildren(value.children),
      };
    }
    case "if_else": {
      const left = parseTreeOperand(params.left, { type: "kpi", kpiId: "close", symbol: "NIFTYBEES" });
      const right = parseTreeOperand(params.right, { type: "number", value: 0 });
      const op = typeof params.op === "string" && isComparatorOp(params.op) ? params.op : ">";
      return {
        id: value.id,
        kind: "if_else",
        label,
        params: { left, op, right },
        then: parseTreeNodeList(value.then),
        else: parseTreeNodeList(value.else),
      };
    }
    case "any_all": {
      const op = typeof params.op === "string" && isLogicalOp(params.op) ? params.op : "and";
      return {
        id: value.id,
        kind: "any_all",
        label,
        params: { op },
        children: parseTreeNodeList(value.children),
      };
    }
    case "filter": {
      const assetClasses = Array.isArray(params.assetClasses)
        ? params.assetClasses.filter((item): item is AssetClass => typeof item === "string" && isAssetClass(item))
        : [...DEFAULT_ASSET_CLASSES];
      const symbols = Array.isArray(params.symbols)
        ? params.symbols.filter((item): item is string => typeof item === "string")
        : undefined;
      return {
        id: value.id,
        kind: "filter",
        label,
        params: symbols ? { assetClasses, symbols } : { assetClasses },
        children: parseTreeNodeList(value.children),
      };
    }
    default: {
      const _never: never = value.kind;
      return _never;
    }
  }
}

export function parseTreeNodeList(raw: unknown): TreeNode[] {
  if (!Array.isArray(raw)) return [];
  const nodes: TreeNode[] = [];
  for (const item of raw) {
    const node = parseTreeNode(item);
    if (node) nodes.push(node);
  }
  return nodes;
}

export function parseStrategyTree(raw: unknown): StrategyTreeV1 {
  if (!raw || typeof raw !== "object") throw new Error("Tree JSON must be an object");
  const value = raw as Record<string, unknown>;
  if (value.treeVersion !== STRATEGY_TREE_VERSION) throw new Error("treeVersion must be \"1\"");
  if (typeof value.id !== "string" || !value.id) throw new Error("Tree id is required");
  if (typeof value.name !== "string" || !value.name) throw new Error("Tree name is required");
  const tree: StrategyTreeV1 = {
    treeVersion: "1",
    id: value.id,
    name: value.name,
    interval: typeof value.interval === "string" ? value.interval as CandleInterval : defaultTreeInterval(),
    children: parseTreeNodeList(value.children),
  };
  if (typeof value.description === "string") tree.description = value.description;
  if (typeof value.createdAt === "string") tree.createdAt = value.createdAt;
  if (typeof value.updatedAt === "string") tree.updatedAt = value.updatedAt;
  return tree;
}
