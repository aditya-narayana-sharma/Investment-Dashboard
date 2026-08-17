import type { BrokerAdapter } from "./types.ts";

export const kiteBrokerAdapter: BrokerAdapter = {
  id: "kite",
  label: "Zerodha Kite Connect",
  capabilities: ["holdings", "positions", "orders", "gtt", "alerts", "margins", "quotes", "instruments"],
  snapshotStatus: "live",
  orderPath: "/api/kite/order",
  gttPath: "/api/kite/gtt",
  alertPath: "/api/kite/alert",
  instrumentsPath: "/api/kite/instruments",
  notes: "Runtime is the adjacent Go MCP server on :8080. Typed confirmation is required for live writes.",
};
