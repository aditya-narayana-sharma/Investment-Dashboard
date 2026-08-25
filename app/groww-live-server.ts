/**
 * Groww live adapter.
 *
 * Deliberately **read-only**: holdings, positions and the order book. There is
 * no order-placement path here and there must not be one — Kite is the only
 * broker Stratji can transact through, behind the reviewed order ticket's typed
 * confirmation.
 *
 * The snapshot mirrors the Kite contract (`status` / `authStatus` / `message` /
 * `asOf`) so the source-freshness strip can treat both brokers identically
 * instead of special-casing Groww as a stub.
 */

export type GrowwAuthStatus = "authenticated" | "unauthenticated" | "expired" | "unknown" | "unavailable";

export type GrowwHolding = { symbol: string; qty: number; value: number; avg: number | null };
export type GrowwPosition = { symbol: string; qty: number; product: string; pnl: number | null };
export type GrowwOrder = {
  orderId: string;
  symbol: string;
  side: string;
  qty: number;
  status: string;
  placedAt: string | null;
};

export type GrowwSnapshot = {
  /** `partial` mirrors Kite: the session is valid but a section failed. */
  status: "live" | "partial" | "unavailable";
  authStatus: GrowwAuthStatus;
  asOf: string | null;
  holdings: GrowwHolding[];
  positions: GrowwPosition[];
  orders: GrowwOrder[];
  /** Sections that failed on this refresh; empty on a clean `live`. */
  unavailableSections: string[];
  message: string;
};

type Row = Record<string, unknown>;

const BASE_URL = process.env.GROWW_BASE_URL ?? "https://api.groww.in";
const REQUEST_TIMEOUT_MS = 12_000;

function growwToken(): string {
  return String(process.env.GROWW_ACCESS_TOKEN ?? "").trim();
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function rows(payload: unknown, ...keys: string[]): Row[] {
  if (Array.isArray(payload)) return payload as Row[];
  const record = payload && typeof payload === "object" ? payload as Row : {};
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as Row[];
  }
  return [];
}

export function unavailableGrowwSnapshot(message: string, authStatus: GrowwAuthStatus = "unavailable"): GrowwSnapshot {
  return {
    status: "unavailable",
    authStatus,
    asOf: null,
    holdings: [],
    positions: [],
    orders: [],
    unavailableSections: ["holdings", "positions", "orders"],
    message,
  };
}

class GrowwAuthError extends Error {}

async function growwGet(path: string, token: string): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  // 401/403 is a real session problem; every other non-2xx is a transport or
  // upstream fault and must not be reported as an auth failure.
  if (response.status === 401 || response.status === 403) {
    throw new GrowwAuthError(`Groww rejected the access token (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(`Groww ${path} returned HTTP ${response.status}.`);
  return response.json();
}

export function mapGrowwHoldings(payload: unknown): GrowwHolding[] {
  return rows(payload, "holdings", "data").map((row) => ({
    symbol: str(row.trading_symbol ?? row.tradingSymbol ?? row.symbol).trim().toUpperCase(),
    qty: num(row.quantity ?? row.qty),
    value: num(row.value ?? row.current_value),
    avg: numOrNull(row.average_price ?? row.avg_price),
  })).filter((row) => row.symbol);
}

export function mapGrowwPositions(payload: unknown): GrowwPosition[] {
  return rows(payload, "positions", "net", "data").map((row) => ({
    symbol: str(row.trading_symbol ?? row.tradingSymbol ?? row.symbol).trim().toUpperCase(),
    qty: num(row.quantity ?? row.net_quantity ?? row.qty),
    product: str(row.product ?? row.product_type) || "—",
    pnl: numOrNull(row.pnl ?? row.profit_loss),
  })).filter((row) => row.symbol);
}

export function mapGrowwOrders(payload: unknown): GrowwOrder[] {
  return rows(payload, "orders", "data").map((row) => ({
    orderId: str(row.order_id ?? row.orderId ?? row.id),
    symbol: str(row.trading_symbol ?? row.tradingSymbol ?? row.symbol).trim().toUpperCase(),
    side: str(row.transaction_type ?? row.side).toUpperCase() || "—",
    qty: num(row.quantity ?? row.qty),
    status: str(row.order_status ?? row.status) || "—",
    placedAt: str(row.created_at ?? row.order_timestamp) || null,
  })).filter((row) => row.symbol || row.orderId);
}

/**
 * Live Groww holdings, positions and orders when `GROWW_ACCESS_TOKEN` is set.
 * Never invents quantities, and never replaces a failed section with zeroes:
 * a failed section is named in `unavailableSections` and the snapshot degrades
 * to `partial`.
 */
export async function getGrowwSnapshot(now = new Date()): Promise<GrowwSnapshot> {
  const token = growwToken();
  if (!token) {
    return unavailableGrowwSnapshot(
      "Groww live API is unconfigured. Set GROWW_ACCESS_TOKEN to enable read-only Groww holdings, positions and orders.",
      "unauthenticated",
    );
  }

  const [holdingsResult, positionsResult, ordersResult] = await Promise.allSettled([
    growwGet("/v1/api/portfolio/v1/holdings", token),
    growwGet("/v1/api/portfolio/v1/positions", token),
    growwGet("/v1/api/order/v1/list", token),
  ]);

  // A rejected token on any call means the session is genuinely dead.
  const authFailure = [holdingsResult, positionsResult, ordersResult]
    .find((result) => result.status === "rejected" && result.reason instanceof GrowwAuthError);
  if (authFailure && authFailure.status === "rejected") {
    return unavailableGrowwSnapshot(String(authFailure.reason.message), "expired");
  }

  const sections: Array<[string, PromiseSettledResult<unknown>]> = [
    ["holdings", holdingsResult],
    ["positions", positionsResult],
    ["orders", ordersResult],
  ];
  const unavailableSections = sections
    .filter(([, result]) => result.status === "rejected")
    .map(([name]) => name);

  if (unavailableSections.length === sections.length) {
    const reason = holdingsResult.status === "rejected"
      ? String((holdingsResult.reason as Error)?.message ?? holdingsResult.reason)
      : "Groww is unreachable.";
    // Every section failed: transport, not authentication. Say so.
    return unavailableGrowwSnapshot(reason, "unknown");
  }

  const holdings = holdingsResult.status === "fulfilled" ? mapGrowwHoldings(holdingsResult.value) : [];
  const positions = positionsResult.status === "fulfilled" ? mapGrowwPositions(positionsResult.value) : [];
  const orders = ordersResult.status === "fulfilled" ? mapGrowwOrders(ordersResult.value) : [];

  return {
    status: unavailableSections.length ? "partial" : "live",
    authStatus: "authenticated",
    asOf: now.toISOString(),
    holdings,
    positions,
    orders,
    unavailableSections,
    message: unavailableSections.length
      ? `Partial Groww snapshot: ${unavailableSections.join(", ")} unavailable. Read-only; Groww orders are not placed from Stratji.`
      : `Groww live · ${holdings.length} holdings · ${positions.length} positions · ${orders.length} orders. Read-only.`,
  };
}
