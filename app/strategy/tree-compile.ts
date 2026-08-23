import kpiRegistry from "../../packages/kpi-registry/definitions/kpis.json" with { type: "json" };
import {
  cloneTree,
  operandKpiIds,
  walkTreeNodes,
  type StrategyTreeV1,
  type TreeNode,
  type TreeOperand,
  type TreeValidation,
  type TreeValidationIssue,
  type WeightChild,
  type WeightNode,
} from "../../packages/contracts/src/strategy-tree.ts";
import {
  DEFAULT_ASSET_CLASSES,
  DEFAULT_INTERVAL,
  type StrategyEdge,
  type StrategyGraphV2,
  type StrategyNode,
} from "./graph-types";

const KPI_IDS = new Set((kpiRegistry.kpis as Array<{ id: string; label: string }>).map((kpi) => kpi.id));
const KPI_LABELS = new Map((kpiRegistry.kpis as Array<{ id: string; label: string }>).map((kpi) => [kpi.id, kpi.label]));

function knownKpi(id: string): boolean {
  return KPI_IDS.has(id);
}

function kpiLabel(id: string): string {
  return KPI_LABELS.get(id) ?? id;
}

const PERCENT_TOLERANCE = 0.51;

type CompileContext = {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  usedIds: Set<string>;
  x: number;
  y: number;
};

function nextCompileId(prefix: string, used: Set<string>): string {
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  const id = `${prefix}-${index}`;
  used.add(id);
  return id;
}

function pushNode(ctx: CompileContext, node: StrategyNode): StrategyNode {
  ctx.usedIds.add(node.id);
  ctx.nodes.push(node);
  return node;
}

function pushEdge(ctx: CompileContext, source: string, target: string, kind: StrategyEdge["kind"]) {
  ctx.edges.push({
    id: `e-${source}-${target}`,
    source,
    target,
    kind,
    sourcePort: "out",
    targetPort: "in",
  });
}

function collectAssets(node: TreeNode): string[] {
  switch (node.kind) {
    case "asset":
      return node.params.symbol.trim() ? [node.params.symbol.trim().toUpperCase()] : [];
    case "group":
    case "any_all":
    case "filter":
      return node.children.flatMap(collectAssets);
    case "weight":
      return node.children.flatMap((child) => collectAssets(child.node));
    case "if_else":
      return [...node.then, ...node.else].flatMap(collectAssets);
    default: {
      const _never: never = node;
      return _never;
    }
  }
}

function collectFilters(nodes: readonly TreeNode[]): TreeNode[] {
  const filters: TreeNode[] = [];
  walkTreeNodes(nodes, (node) => {
    if (node.kind === "filter") filters.push(node);
  });
  return filters;
}

function collectIfElse(nodes: readonly TreeNode[]): TreeNode[] {
  const found: TreeNode[] = [];
  walkTreeNodes(nodes, (node) => {
    if (node.kind === "if_else") found.push(node);
  });
  return found;
}

function collectWeightSleeves(nodes: readonly TreeNode[]): WeightNode[] {
  const found: WeightNode[] = [];
  walkTreeNodes(nodes, (node) => {
    if (node.kind === "weight") found.push(node);
  });
  return found;
}

function operandLabel(operand: TreeOperand): string {
  switch (operand.type) {
    case "number":
      return String(operand.value);
    case "kpi":
      return `${operand.kpiId}(${operand.symbol || "?"})`;
    default: {
      const _never: never = operand;
      return _never;
    }
  }
}

function place(ctx: CompileContext): { x: number; y: number } {
  const position = { x: ctx.x, y: ctx.y };
  ctx.x += 240;
  if (ctx.x > 1000) {
    ctx.x = 40;
    ctx.y += 120;
  }
  return position;
}

function emitUniverse(ctx: CompileContext, tree: StrategyTreeV1): StrategyNode {
  const filters = collectFilters(tree.children).filter((node): node is Extract<TreeNode, { kind: "filter" }> => node.kind === "filter");
  const first = filters[0];
  const symbols = [...new Set(tree.children.flatMap(collectAssets))];
  return pushNode(ctx, {
    id: first?.id ? `universe-${first.id}` : nextCompileId("universe", ctx.usedIds),
    kind: "universe",
    label: first?.label ?? "Universe",
    params: {
      assetClasses: first ? [...first.params.assetClasses] : [...DEFAULT_ASSET_CLASSES],
      symbols,
    },
    position: place(ctx),
  });
}

function emitKpi(ctx: CompileContext, operand: Extract<TreeOperand, { type: "kpi" }>, universeId: string): StrategyNode {
  const node = pushNode(ctx, {
    id: nextCompileId("kpi", ctx.usedIds),
    kind: "kpi",
    label: kpiLabel(operand.kpiId),
    params: { kpiId: operand.kpiId, weightagePct: 100 },
    position: place(ctx),
  });
  pushEdge(ctx, universeId, node.id, "series");
  return node;
}

function emitCondition(
  ctx: CompileContext,
  node: Extract<TreeNode, { kind: "if_else" }>,
  universeId: string,
): { comparatorId: string } {
  const left = node.params.left;
  const right = node.params.right;
  const leftKpi = left.type === "kpi"
    ? emitKpi(ctx, left, universeId)
    : emitKpi(ctx, { type: "kpi", kpiId: "close", symbol: "RELIANCE" }, universeId);
  if (right.type === "kpi") emitKpi(ctx, right, universeId);
  const comparator = pushNode(ctx, {
    id: nextCompileId("cmp", ctx.usedIds),
    kind: "comparator",
    label: `IF ${operandLabel(left)} ${node.params.op} ${operandLabel(right)}`,
    params: {
      op: node.params.op,
      value: right.type === "number" ? right.value : 0,
    },
    position: place(ctx),
  });
  pushEdge(ctx, leftKpi.id, comparator.id, "series");
  return { comparatorId: comparator.id };
}

function emitLogicalGroups(ctx: CompileContext, tree: StrategyTreeV1, booleanSourceId: string): string {
  let current = booleanSourceId;
  walkTreeNodes(tree.children, (node) => {
    if (node.kind !== "any_all") return;
    const group = pushNode(ctx, {
      id: node.id,
      kind: "logical_group",
      label: node.label ?? (node.params.op === "or" ? "ANY" : "ALL"),
      params: { op: node.params.op },
      position: place(ctx),
    });
    pushEdge(ctx, current, group.id, "boolean");
    current = group.id;
  });
  return current;
}

function emitSleeveAllocations(ctx: CompileContext, sleeves: WeightChild[], entryId: string) {
  for (const sleeve of sleeves) {
    const symbols = collectAssets(sleeve.node);
    const allocation = pushNode(ctx, {
      id: nextCompileId("alloc", ctx.usedIds),
      kind: "allocation",
      label: `Sleeve ${typeof sleeve.percent === "number" ? sleeve.percent : 0}%`,
      params: {
        weightagePct: typeof sleeve.percent === "number" ? sleeve.percent : 0,
        symbols,
      },
      position: place(ctx),
    });
    pushEdge(ctx, entryId, allocation.id, "trigger");
  }
}

function fallbackAllocation(ctx: CompileContext, tree: StrategyTreeV1, entryId: string) {
  const symbols = [...new Set(tree.children.flatMap(collectAssets))];
  const allocation = pushNode(ctx, {
    id: nextCompileId("alloc", ctx.usedIds),
    kind: "allocation",
    label: "Allocation",
    params: { weightagePct: 100, symbols },
    position: place(ctx),
  });
  pushEdge(ctx, entryId, allocation.id, "trigger");
}

export function validateTree(tree: StrategyTreeV1): TreeValidation {
  const issues: TreeValidationIssue[] = [];
  walkTreeNodes(tree.children, (node) => {
    switch (node.kind) {
      case "asset":
      case "group":
      case "filter":
        break;
      case "weight": {
        if (node.params.method === "inverse_volatility") {
          const lookback = node.params.lookbackDays ?? 30;
          if (lookback < 2) {
            issues.push({
              severity: "warning",
              code: "weight_lookback",
              message: "Inverse Volatility lookbackDays must be at least 2",
              nodeId: node.id,
            });
          }
        }
        if (node.params.method === "specified" && node.children.length > 0) {
          const sum = node.children.reduce((total, child) => total + (child.percent ?? 0), 0);
          if (Math.abs(sum - 100) > PERCENT_TOLERANCE) {
            issues.push({
              severity: "warning",
              code: "weight_percent_sum",
              message: `Specified weights sum to ${sum}, expected 100`,
              nodeId: node.id,
            });
          }
        }
        break;
      }
      case "if_else": {
        if (node.else.length === 0) {
          issues.push({
            severity: "warning",
            code: "empty_else",
            message: "IF/ELSE has an empty ELSE branch",
            nodeId: node.id,
          });
        }
        for (const operand of [node.params.left, node.params.right]) {
          for (const kpiId of operandKpiIds(operand)) {
            if (!knownKpi(kpiId)) {
              issues.push({
                severity: "error",
                code: "unknown_kpi",
                message: `Unknown kpiId "${kpiId}"`,
                nodeId: node.id,
              });
            }
          }
        }
        break;
      }
      case "any_all":
        break;
      default: {
        const _never: never = node;
        return _never;
      }
    }
  });
  const errors = issues.filter((issue) => issue.severity === "error");
  return { ok: errors.length === 0, issues };
}

export function compileTreeToGraph(tree: StrategyTreeV1, now = new Date()): StrategyGraphV2 {
  const stamp = now.toISOString();
  const ctx: CompileContext = {
    nodes: [],
    edges: [],
    usedIds: new Set(collectCompileReservedIds(tree)),
    x: 40,
    y: 80,
  };

  const universe = emitUniverse(ctx, tree);
  const ifNodes = collectIfElse(tree.children).filter((node): node is Extract<TreeNode, { kind: "if_else" }> => node.kind === "if_else");
  const firstIf = ifNodes[0];
  const condition = firstIf ? emitCondition(ctx, firstIf, universe.id) : null;

  const entry = pushNode(ctx, {
    id: "entry-1",
    kind: "entry_trigger",
    label: "Entry trigger",
    params: {},
    position: place(ctx),
  });
  pushNode(ctx, {
    id: "exit-1",
    kind: "exit_trigger",
    label: "Exit trigger",
    params: {},
    position: place(ctx),
  });

  if (condition) {
    const booleanSource = emitLogicalGroups(ctx, tree, condition.comparatorId);
    pushEdge(ctx, booleanSource, entry.id, "boolean");
  }

  const weightNodes = collectWeightSleeves(tree.children);
  const rootWeight = weightNodes[0];
  if (rootWeight && rootWeight.children.length > 0) {
    const sleeves = rootWeight.params.method === "inverse_volatility"
      ? rootWeight.children.map((child, index, list) => ({
          ...child,
          percent: child.percent ?? (100 / list.length),
        }))
      : rootWeight.children;
    emitSleeveAllocations(ctx, sleeves, entry.id);
  } else {
    fallbackAllocation(ctx, tree, entry.id);
  }

  return {
    schemaVersion: "2",
    id: tree.id,
    name: tree.name,
    description: tree.description,
    interval: tree.interval || DEFAULT_INTERVAL,
    nodes: ctx.nodes,
    edges: ctx.edges,
    pinnedAlgorithmVersions: {},
    createdAt: tree.createdAt ?? stamp,
    updatedAt: tree.updatedAt ?? stamp,
    tree: cloneTree(tree),
  };
}

function collectCompileReservedIds(tree: StrategyTreeV1): string[] {
  return [tree.id, "entry-1", "exit-1"];
}

export function graphWithTree(graph: StrategyGraphV2, tree: StrategyTreeV1): StrategyGraphV2 {
  return { ...graph, tree: cloneTree(tree) };
}
