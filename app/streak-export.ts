import type { StrategyTreeV1, TreeNode } from "../../packages/contracts/src/strategy-tree.ts";

export type StreakScannerExport = {
  venue: "zerodha-streak";
  placesOrders: false;
  name: string;
  interval: string;
  symbols: string[];
  conditions: string[];
  checklist: string[];
};

function collectSymbols(node: TreeNode, into: Set<string>) {
  switch (node.kind) {
    case "asset":
      if (node.params.symbol.trim()) into.add(node.params.symbol.trim().toUpperCase());
      return;
    case "group":
    case "any_all":
    case "filter":
      for (const child of node.children) collectSymbols(child, into);
      return;
    case "weight":
      for (const child of node.children) collectSymbols(child.node, into);
      return;
    case "if_else":
      for (const child of node.then) collectSymbols(child, into);
      for (const child of node.else) collectSymbols(child, into);
      return;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function collectConditions(node: TreeNode, into: string[]) {
  switch (node.kind) {
    case "if_else": {
      const left = node.params.left.type === "kpi"
        ? `${node.params.left.symbol} ${node.params.left.kpiId}`
        : String(node.params.left.value);
      const right = node.params.right.type === "kpi"
        ? `${node.params.right.symbol} ${node.params.right.kpiId}`
        : String(node.params.right.value);
      into.push(`${left} ${node.params.op} ${right}`);
      for (const child of node.then) collectConditions(child, into);
      for (const child of node.else) collectConditions(child, into);
      return;
    }
    case "any_all":
      into.push(`group ${node.params.op}`);
      for (const child of node.children) collectConditions(child, into);
      return;
    case "group":
    case "filter":
      for (const child of node.children) collectConditions(child, into);
      return;
    case "weight":
      for (const child of node.children) collectConditions(child.node, into);
      return;
    case "asset":
      return;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

/** Compile a StrategyTreeV1 into a Streak scanner payload. Stratji never places the order. */
export function compileStreakScanner(tree: StrategyTreeV1): StreakScannerExport {
  const symbols = new Set<string>();
  const conditions: string[] = [];
  for (const child of tree.children) {
    collectSymbols(child, symbols);
    collectConditions(child, conditions);
  }
  return {
    venue: "zerodha-streak",
    placesOrders: false,
    name: tree.name,
    interval: tree.interval,
    symbols: [...symbols],
    conditions,
    checklist: [
      "Open Zerodha Streak in the browser while logged into Kite.",
      "Create a scanner with the exported symbols and conditions.",
      "Deploy in Streak only after reviewing every condition.",
      "Stratji does not scrape Streak and does not place unattended orders.",
    ],
  };
}
