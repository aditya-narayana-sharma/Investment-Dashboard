import type { BrokerAdapter } from "./types.ts";

export function unavailableBrokerAdapter(id: string, label: string, reason: string): BrokerAdapter {
  return {
    id,
    label,
    capabilities: [],
    snapshotStatus: "unavailable",
    orderPath: "",
    gttPath: "",
    alertPath: "",
    instrumentsPath: "",
    notes: reason,
  };
}

export const growBrokerAdapter = unavailableBrokerAdapter(
  "grow",
  "Groww",
  "No public retail Connect-style API. Optional CSV holdings import is cached only and is never labelled live.",
);
