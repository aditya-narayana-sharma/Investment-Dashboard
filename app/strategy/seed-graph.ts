import { DEFAULT_ASSET_CLASSES, DEFAULT_INTERVAL, type StrategyGraphV2 } from "./graph-types";

export const SEED_GRAPH_ID = "seed-rsi-oversold";

export function createSeedGraph(now = new Date()): StrategyGraphV2 {
  const stamp = now.toISOString();
  return {
    schemaVersion: "2",
    id: SEED_GRAPH_ID,
    name: "RSI oversold entry",
    description: "Demo seed: RSI 14 < 30 entry. Exit trigger is present and starts unwired.",
    interval: DEFAULT_INTERVAL,
    pinnedAlgorithmVersions: {},
    createdAt: stamp,
    updatedAt: stamp,
    nodes: [
      {
        id: "universe-1",
        kind: "universe",
        label: "Universe",
        params: { assetClasses: [...DEFAULT_ASSET_CLASSES] },
        position: { x: 40, y: 80 },
      },
      {
        id: "kpi-rsi",
        kind: "kpi",
        label: "RSI 14",
        params: { kpiId: "rsi_14", weightagePct: 100 },
        position: { x: 280, y: 80 },
      },
      {
        id: "cmp-rsi",
        kind: "comparator",
        label: "RSI < 30",
        params: { op: "<", value: 30 },
        position: { x: 520, y: 80 },
      },
      {
        id: "entry-1",
        kind: "entry_trigger",
        label: "Entry trigger",
        params: {},
        position: { x: 760, y: 80 },
      },
      {
        id: "exit-1",
        kind: "exit_trigger",
        label: "Exit trigger",
        params: {},
        position: { x: 760, y: 240 },
      },
    ],
    edges: [
      { id: "e-universe-kpi", source: "universe-1", target: "kpi-rsi", kind: "series", sourcePort: "out", targetPort: "in" },
      { id: "e-kpi-cmp", source: "kpi-rsi", target: "cmp-rsi", kind: "series", sourcePort: "out", targetPort: "in" },
      { id: "e-cmp-entry", source: "cmp-rsi", target: "entry-1", kind: "boolean", sourcePort: "out", targetPort: "in" },
    ],
  };
}
