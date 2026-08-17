export type BrokerCapability =
  | "holdings"
  | "positions"
  | "orders"
  | "gtt"
  | "alerts"
  | "margins"
  | "quotes"
  | "instruments";

export type BrokerWriteKind = "order" | "gtt" | "alert";

export type BrokerAdapter = {
  id: string;
  label: string;
  capabilities: BrokerCapability[];
  snapshotStatus: "live" | "cached" | "unavailable";
  orderPath: string;
  gttPath: string;
  alertPath: string;
  instrumentsPath: string;
  notes: string;
};

export function brokerWritePath(adapter: BrokerAdapter, kind: BrokerWriteKind): string {
  switch (kind) {
    case "order":
      return adapter.orderPath;
    case "gtt":
      return adapter.gttPath;
    case "alert":
      return adapter.alertPath;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
