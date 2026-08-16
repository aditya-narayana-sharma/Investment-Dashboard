import type { StrategyTreeV1 } from "../../packages/contracts/src/strategy-tree.ts";
import { compileTreeToGraph } from "./tree-compile";
import type { StrategyGraphV2 } from "./graph-types";

export const SEED_TREE_ID = "seed-core-satellite-in";

export function createSeedTree(now = new Date()): StrategyTreeV1 {
  const stamp = now.toISOString();
  return {
    treeVersion: "1",
    id: SEED_TREE_ID,
    name: "Core Satellite",
    description: "Indian core-satellite: gold sleeve, Nifty-family equity ETFs, and a NIFTYBEES trend gate for the liquid sleeve.",
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
              id: "group-gold",
              kind: "group",
              label: "Satellite-Gold",
              params: {},
              children: [
                {
                  id: "weight-gold",
                  kind: "weight",
                  label: "Gold sleeve",
                  params: { method: "inverse_volatility", lookbackDays: 30 },
                  children: [
                    {
                      node: {
                        id: "asset-goldbees",
                        kind: "asset",
                        label: "Nippon India ETF Gold BeES",
                        params: { symbol: "GOLDBEES" },
                        children: [],
                      },
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
                {
                  id: "asset-niftybees",
                  kind: "asset",
                  label: "Nippon India ETF Nifty BeES",
                  params: { symbol: "NIFTYBEES" },
                  children: [],
                },
                {
                  id: "asset-juniorbees",
                  kind: "asset",
                  label: "Nippon India ETF Junior BeES",
                  params: { symbol: "JUNIORBEES" },
                  children: [],
                },
                {
                  id: "asset-bankbees",
                  kind: "asset",
                  label: "Nippon India ETF Bank BeES",
                  params: { symbol: "BANKBEES" },
                  children: [],
                },
                {
                  id: "asset-itbees",
                  kind: "asset",
                  label: "Nippon India ETF IT BeES",
                  params: { symbol: "ITBEES" },
                  children: [],
                },
                {
                  id: "asset-setfnif50",
                  kind: "asset",
                  label: "SBI ETF Nifty 50",
                  params: { symbol: "SETFNIF50" },
                  children: [],
                },
              ],
            },
          },
          {
            percent: 55,
            node: {
              id: "group-bond",
              kind: "group",
              label: "Satellite-Bond",
              params: {},
              children: [
                {
                  id: "if-trend",
                  kind: "if_else",
                  label: "NIFTYBEES trend gate",
                  params: {
                    left: { type: "kpi", kpiId: "close", symbol: "NIFTYBEES" },
                    op: ">",
                    right: { type: "kpi", kpiId: "sma_200", symbol: "NIFTYBEES" },
                  },
                  then: [
                    {
                      id: "asset-liquidbees",
                      kind: "asset",
                      label: "Nippon India ETF Liquid BeES",
                      params: { symbol: "LIQUIDBEES" },
                      children: [],
                    },
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
