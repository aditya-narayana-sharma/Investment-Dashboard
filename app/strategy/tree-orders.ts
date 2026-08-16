import {
  childNodesOf,
  walkTreeNodes,
  type StrategyTreeV1,
  type TreeNode,
} from "../../packages/contracts/src/strategy-tree.ts";
import { findTreeInstrument, type TreeInstrument } from "./tree-instruments";

export type TreeOrderSide = "BUY" | "SELL";
export type TreeOrderProduct = "CNC" | "MIS" | "NRML" | "MTF";
export type TreeGttKind = "gtt" | "tsl";
export type TreeAlertDirection = "above" | "below";

export type TreeOrderPreview = {
  nodeId: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  side: TreeOrderSide;
  quantity: number;
  product: TreeOrderProduct;
  orderType: "MARKET";
  source: "weight" | "if_then" | "if_else";
  confirmation: string;
};

export type TreeGttPreview = {
  nodeId: string;
  symbol: string;
  side: TreeOrderSide;
  quantity: number;
  product: TreeOrderProduct;
  triggerPrice: number;
  limitPrice: number;
  lastPrice?: number;
  kind: TreeGttKind;
  confirmation: string;
};

export type TreeAlertPreview = {
  nodeId: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  direction: TreeAlertDirection;
  triggerPrice: number;
  confirmation: string;
};

type Slot = "root" | "then" | "else" | "children";

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function exchangeOf(instrument: TreeInstrument | undefined): "NSE" | "BSE" {
  return instrument?.exchange === "BSE" ? "BSE" : "NSE";
}

function quantityFor(instrument: TreeInstrument | undefined, percent?: number): number {
  if (instrument?.qty && instrument.qty > 0 && percent !== undefined && Number.isFinite(percent)) {
    return Math.max(1, Math.floor(instrument.qty * percent / 100));
  }
  return 1;
}

function orderConfirmation(side: TreeOrderSide, quantity: number, symbol: string): string {
  return `${side} ${quantity} ${symbol}`;
}

function gttConfirmation(kind: TreeGttKind, side: TreeOrderSide, quantity: number, symbol: string): string {
  return `${kind === "tsl" ? "TSL" : "GTT"} ${side} ${quantity} ${symbol}`;
}

function alertConfirmation(direction: TreeAlertDirection, symbol: string, triggerPrice: number): string {
  return `ALERT ${direction === "above" ? "ABOVE" : "BELOW"} ${symbol} ${triggerPrice}`;
}

function walkWithSlot(
  nodes: readonly TreeNode[],
  slot: Slot,
  visit: (node: TreeNode, slot: Slot, percent?: number) => void,
  percent?: number,
) {
  for (const node of nodes) {
    visit(node, slot, percent);
    switch (node.kind) {
      case "if_else":
        walkWithSlot(node.then, "then", visit);
        walkWithSlot(node.else, "else", visit);
        break;
      case "weight":
        for (const child of node.children) {
          walkWithSlot([child.node], "children", visit, child.percent);
        }
        break;
      case "asset":
        break;
      case "group":
      case "any_all":
      case "filter":
        walkWithSlot(node.children, "children", visit, percent);
        break;
      default: {
        const _never: never = node;
        return _never;
      }
    }
  }
}

export function buildTreeOrderPreviews(
  tree: StrategyTreeV1,
  instruments: readonly TreeInstrument[],
): TreeOrderPreview[] {
  const previews: TreeOrderPreview[] = [];
  walkWithSlot(tree.children, "root", (node, slot, percent) => {
    if (node.kind !== "asset") return;
    const symbol = normalizeSymbol(node.params.symbol);
    if (!symbol) return;
    const instrument = findTreeInstrument(instruments, symbol);
    const side: TreeOrderSide = slot === "else" ? "SELL" : "BUY";
    const quantity = quantityFor(instrument, percent);
    const source = slot === "then" ? "if_then" : slot === "else" ? "if_else" : "weight";
    previews.push({
      nodeId: node.id,
      symbol,
      exchange: exchangeOf(instrument),
      side,
      quantity,
      product: "CNC",
      orderType: "MARKET",
      source,
      confirmation: orderConfirmation(side, quantity, symbol),
    });
  });
  return previews;
}

function triggerFromIfElse(node: Extract<TreeNode, { kind: "if_else" }>): number | null {
  const { left, right } = node.params;
  if (right.type === "number" && Number.isFinite(right.value)) return right.value;
  if (left.type === "number" && Number.isFinite(left.value)) return left.value;
  return null;
}

function ifElseSymbol(node: Extract<TreeNode, { kind: "if_else" }>): string {
  const { left, right } = node.params;
  if (left.type === "kpi" && left.symbol.trim()) return normalizeSymbol(left.symbol);
  if (right.type === "kpi" && right.symbol.trim()) return normalizeSymbol(right.symbol);
  const firstAsset = [...node.then, ...node.else].find((child) => child.kind === "asset");
  return firstAsset && firstAsset.kind === "asset" ? normalizeSymbol(firstAsset.params.symbol) : "";
}

function alertDirection(op: string): TreeAlertDirection | null {
  switch (op) {
    case ">":
    case ">=":
      return "above";
    case "<":
    case "<=":
      return "below";
    default:
      return null;
  }
}

export function buildTreeGttPreviews(
  tree: StrategyTreeV1,
  instruments: readonly TreeInstrument[],
): TreeGttPreview[] {
  const previews: TreeGttPreview[] = [];
  walkTreeNodes(tree.children, (node) => {
    if (node.kind !== "if_else") return;
    const triggerPrice = triggerFromIfElse(node);
    const symbol = ifElseSymbol(node);
    if (triggerPrice === null || triggerPrice <= 0 || !symbol) return;
    const instrument = findTreeInstrument(instruments, symbol);
    const direction = alertDirection(node.params.op);
    const side: TreeOrderSide = direction === "below" ? "SELL" : "BUY";
    const kind: TreeGttKind = side === "SELL" ? "tsl" : "gtt";
    const quantity = quantityFor(instrument);
    const lastPrice = instrument?.lastPrice;
    previews.push({
      nodeId: node.id,
      symbol,
      side,
      quantity,
      product: "CNC",
      triggerPrice,
      limitPrice: triggerPrice,
      ...(lastPrice !== undefined ? { lastPrice } : {}),
      kind,
      confirmation: gttConfirmation(kind, side, quantity, symbol),
    });
  });
  return previews;
}

export function buildTreeAlertPreviews(
  tree: StrategyTreeV1,
  instruments: readonly TreeInstrument[],
): TreeAlertPreview[] {
  const previews: TreeAlertPreview[] = [];
  walkTreeNodes(tree.children, (node) => {
    if (node.kind !== "if_else") return;
    const triggerPrice = triggerFromIfElse(node);
    const symbol = ifElseSymbol(node);
    const direction = alertDirection(node.params.op);
    if (triggerPrice === null || triggerPrice <= 0 || !symbol || !direction) return;
    const instrument = findTreeInstrument(instruments, symbol);
    previews.push({
      nodeId: node.id,
      symbol,
      exchange: exchangeOf(instrument),
      direction,
      triggerPrice,
      confirmation: alertConfirmation(direction, symbol, triggerPrice),
    });
  });
  return previews;
}

export function childSymbolsOf(node: TreeNode): string[] {
  return childNodesOf(node)
    .filter((child): child is Extract<TreeNode, { kind: "asset" }> => child.kind === "asset")
    .map((child) => normalizeSymbol(child.params.symbol))
    .filter(Boolean);
}
