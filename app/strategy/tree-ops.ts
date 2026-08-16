import {
  childNodesOf,
  cloneTree,
  collectTreeNodeIds,
  isTreeBlockKind,
  parseStrategyTree,
  type StrategyTreeV1,
  type TreeBlockKind,
  type TreeNode,
  type WeightChild,
} from "../../packages/contracts/src/strategy-tree.ts";
import { DEFAULT_ASSET_CLASSES, UNDO_DEPTH } from "./graph-types";

export type TreeInsertSlot = "children" | "then" | "else";

export function nextTreeNodeId(kind: TreeBlockKind, existing: Iterable<string>): string {
  const prefix = kind.replaceAll("_", "-");
  let index = 1;
  const used = new Set(existing);
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function defaultTreeLabel(kind: TreeBlockKind): string {
  switch (kind) {
    case "asset":
      return "Asset";
    case "group":
      return "Group";
    case "weight":
      return "Weight";
    case "if_else":
      return "If / Else";
    case "any_all":
      return "Any / All";
    case "filter":
      return "Filter";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function createTreeNode(kind: TreeBlockKind, existingIds: Iterable<string>): TreeNode {
  const id = nextTreeNodeId(kind, existingIds);
  const label = defaultTreeLabel(kind);
  switch (kind) {
    case "asset":
      return { id, kind, label, params: { symbol: "" }, children: [] };
    case "group":
      return { id, kind, label, params: {}, children: [] };
    case "weight":
      return { id, kind, label, params: { method: "specified" }, children: [] };
    case "if_else":
      return {
        id,
        kind,
        label,
        params: {
          left: { type: "kpi", kpiId: "close", symbol: "RELIANCE" },
          op: ">",
          right: { type: "kpi", kpiId: "sma_200", symbol: "RELIANCE" },
        },
        then: [],
        else: [],
      };
    case "any_all":
      return { id, kind, label, params: { op: "and" }, children: [] };
    case "filter":
      return { id, kind, label, params: { assetClasses: [...DEFAULT_ASSET_CLASSES] }, children: [] };
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function mapNodes(nodes: TreeNode[], visit: (node: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((node) => mapNode(node, visit));
}

function mapNode(node: TreeNode, visit: (node: TreeNode) => TreeNode): TreeNode {
  switch (node.kind) {
    case "asset":
      return visit(node);
    case "group":
    case "any_all":
    case "filter":
      return visit({ ...node, children: mapNodes(node.children, visit) });
    case "weight":
      return visit({
        ...node,
        children: node.children.map((child) => ({ ...child, node: mapNode(child.node, visit) })),
      });
    case "if_else":
      return visit({
        ...node,
        then: mapNodes(node.then, visit),
        else: mapNodes(node.else, visit),
      });
    default: {
      const _never: never = node;
      return _never;
    }
  }
}

function insertIntoList(list: TreeNode[], child: TreeNode): TreeNode[] {
  return [...list, child];
}

function insertIntoWeight(children: WeightChild[], child: TreeNode): WeightChild[] {
  const assigned = children.reduce((sum, item) => sum + (item.percent ?? 0), 0);
  const percent = children.length === 0 ? 100 : Math.max(0, 100 - assigned);
  return [...children, { percent, node: child }];
}

export function addTreeBlock(
  tree: StrategyTreeV1,
  parentId: string | null,
  kind: TreeBlockKind,
  slot: TreeInsertSlot = "children",
): StrategyTreeV1 {
  if (!isTreeBlockKind(kind)) return tree;
  const next = cloneTree(tree);
  const child = createTreeNode(kind, collectTreeNodeIds(next));
  if (!parentId) {
    next.children = insertIntoList(next.children, child);
    next.updatedAt = new Date().toISOString();
    return next;
  }

  let inserted = false;
  next.children = mapNodes(next.children, (node) => {
    if (inserted || node.id !== parentId) return node;
    inserted = true;
    switch (node.kind) {
      case "asset":
        return node;
      case "group":
      case "any_all":
      case "filter":
        return { ...node, children: insertIntoList(node.children, child) };
      case "weight":
        return { ...node, children: insertIntoWeight(node.children, child) };
      case "if_else": {
        if (slot === "else") return { ...node, else: insertIntoList(node.else, child) };
        return { ...node, then: insertIntoList(node.then, child) };
      }
      default: {
        const _never: never = node;
        return _never;
      }
    }
  });
  if (inserted) next.updatedAt = new Date().toISOString();
  return next;
}

export function removeTreeNode(tree: StrategyTreeV1, nodeId: string): StrategyTreeV1 {
  const next = cloneTree(tree);
  const filterList = (nodes: TreeNode[]): TreeNode[] => nodes.filter((node) => node.id !== nodeId).map(strip);
  const strip = (node: TreeNode): TreeNode => {
    switch (node.kind) {
      case "asset":
        return node;
      case "group":
      case "any_all":
      case "filter":
        return { ...node, children: filterList(node.children) };
      case "weight":
        return { ...node, children: node.children.filter((child) => child.node.id !== nodeId).map((child) => ({ ...child, node: strip(child.node) })) };
      case "if_else":
        return { ...node, then: filterList(node.then), else: filterList(node.else) };
      default: {
        const _never: never = node;
        return _never;
      }
    }
  };
  next.children = filterList(next.children);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function replaceTreeNode(tree: StrategyTreeV1, nextNode: TreeNode): StrategyTreeV1 {
  const next = cloneTree(tree);
  next.children = mapNodes(next.children, (node) => (node.id === nextNode.id ? nextNode : node));
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setWeightChildPercent(tree: StrategyTreeV1, parentId: string, childId: string, percent: number): StrategyTreeV1 {
  const next = cloneTree(tree);
  next.children = mapNodes(next.children, (node) => {
    if (node.id !== parentId || node.kind !== "weight") return node;
    return {
      ...node,
      children: node.children.map((child) => (
        child.node.id === childId ? { ...child, percent } : child
      )),
    };
  });
  next.updatedAt = new Date().toISOString();
  return next;
}

export function updateTreeMeta(
  tree: StrategyTreeV1,
  patch: Partial<Pick<StrategyTreeV1, "name" | "description" | "interval">>,
): StrategyTreeV1 {
  return {
    ...cloneTree(tree),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export function emptyStrategyTree(now = new Date()): StrategyTreeV1 {
  const stamp = now.toISOString();
  return {
    treeVersion: "1",
    id: "strategy-tree",
    name: "Untitled strategy",
    interval: "day",
    children: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function treeFromUnknown(raw: unknown): StrategyTreeV1 | null {
  try {
    return parseStrategyTree(raw);
  } catch {
    return null;
  }
}

export class TreeHistory {
  private past: StrategyTreeV1[] = [];
  private future: StrategyTreeV1[] = [];
  private current: StrategyTreeV1;
  private readonly depth: number;

  constructor(current: StrategyTreeV1, depth = UNDO_DEPTH) {
    this.current = current;
    this.depth = depth;
  }

  get tree(): StrategyTreeV1 {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  push(next: StrategyTreeV1) {
    this.past.push(cloneTree(this.current));
    if (this.past.length > this.depth) this.past.shift();
    this.current = cloneTree(next);
    this.future = [];
  }

  replace(next: StrategyTreeV1) {
    this.current = cloneTree(next);
  }

  reset(next: StrategyTreeV1) {
    this.current = cloneTree(next);
    this.past = [];
    this.future = [];
  }

  undo(): StrategyTreeV1 | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(cloneTree(this.current));
    this.current = previous;
    return cloneTree(this.current);
  }

  redo(): StrategyTreeV1 | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(cloneTree(this.current));
    this.current = next;
    return cloneTree(this.current);
  }
}

export function canAcceptChild(kind: TreeBlockKind): boolean {
  switch (kind) {
    case "asset":
      return false;
    case "group":
    case "weight":
    case "if_else":
    case "any_all":
    case "filter":
      return true;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export { childNodesOf, cloneTree, collectTreeNodeIds };
