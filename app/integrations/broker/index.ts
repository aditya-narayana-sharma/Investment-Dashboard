import { kiteBrokerAdapter } from "./kite.ts";
import type { BrokerAdapter } from "./types.ts";
import { growBrokerAdapter, unavailableBrokerAdapter } from "./unavailable.ts";

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
