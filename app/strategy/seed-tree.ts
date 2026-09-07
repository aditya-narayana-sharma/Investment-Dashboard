import type { StrategyTreeV1 } from "../../packages/contracts/src/strategy-tree.ts";
import { nifty500Name } from "./builder-universe";
import { compileTreeToGraph } from "./tree-compile";
import type { StrategyGraphV2 } from "./graph-types";

export const SEED_TREE_ID = "seed-core-satellite-in";

const SEED_RELIANCE = "RELIANCE";
const SEED_TCS = "TCS";
const SEED_HDFCBANK = "HDFCBANK";
const SEED_INFY = "INFY";
const SEED_ICICIBANK = "ICICIBANK";
const SEED_BHARTI = "BHARTIARTL";
const SEED_ITC = "ITC";

function seedAsset(id: string, symbol: string) {
  return {
    id,
    kind: "asset" as const,
    label: nifty500Name(symbol) ?? symbol,
    params: { symbol },
    children: [] as const,
  };
}

export function createSeedTree(now = new Date()): StrategyTreeV1 {
  const stamp = now.toISOString();
  return {
    treeVersion: "1",
    id: SEED_TREE_ID,
    name: "Core Satellite",
    description: "Indian core-satellite on Nifty 500 equities: quality bank sleeve, large-cap core, and a Reliance trend gate into ITC.",
    interval: "month",
    createdAt: stamp,
    updatedAt: stamp,
    children: [
      {
        id: "weight-root",
        kind: "weight",
        label: "Core-Satellite sleeves",
        params: { method: "specified" },
        children: [
          {
            percent: 15,
            node: {
              id: "group-quality",
              kind: "group",
              label: "Satellite-Quality",
              params: {},
              children: [
                {
                  id: "weight-quality",
                  kind: "weight",
                  label: "Quality sleeve",
                  params: { method: "inverse_volatility", lookbackDays: 30 },
                  children: [
                    {
                      node: seedAsset("asset-hdfcbank", SEED_HDFCBANK),
                    },
                  ],
                },
              ],
            },
          },
          {
            percent: 30,
            node: {
              id: "group-equity",
              kind: "group",
              label: "Core-Equity",
              params: {},
              children: [
                seedAsset("asset-reliance", SEED_RELIANCE),
                seedAsset("asset-tcs", SEED_TCS),
                seedAsset("asset-infy", SEED_INFY),
                seedAsset("asset-icicibank", SEED_ICICIBANK),
                seedAsset("asset-bharti", SEED_BHARTI),
              ],
            },
          },
          {
            percent: 55,
            node: {
              id: "group-defensive",
              kind: "group",
              label: "Satellite-Defensive",
              params: {},
              children: [
                {
                  id: "if-trend",
                  kind: "if_else",
                  label: "RELIANCE trend gate",
                  params: {
                    left: { type: "kpi", kpiId: "close", symbol: SEED_RELIANCE },
                    op: ">",
                    right: { type: "kpi", kpiId: "sma_200", symbol: SEED_RELIANCE },
                  },
                  then: [
                    seedAsset("asset-itc", SEED_ITC),
                  ],
                  else: [],
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function createSeedTreeGraph(now = new Date()): StrategyGraphV2 {
  return compileTreeToGraph(createSeedTree(now), now);
}
