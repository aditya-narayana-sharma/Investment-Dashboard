import { kiteBrokerAdapter } from "./kite";
import type { BrokerAdapter } from "./types";
import { growBrokerAdapter, unavailableBrokerAdapter } from "./unavailable";

const ADAPTERS: Record<string, BrokerAdapter> = {
  kite: kiteBrokerAdapter,
  grow: growBrokerAdapter,
  groww: growBrokerAdapter,
};

export function resolveBrokerAdapter(id: string | undefined): BrokerAdapter {
  const key = (id ?? "kite").trim().toLowerCase();
  return ADAPTERS[key] ?? unavailableBrokerAdapter(key, key, "Unknown broker id. Kite remains the default live adapter.");
}

export { kiteBrokerAdapter, growBrokerAdapter, unavailableBrokerAdapter };
export type { BrokerAdapter, BrokerWriteKind } from "./types";
export { brokerWritePath } from "./types";
