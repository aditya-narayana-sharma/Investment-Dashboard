import { classificationSources, securityClassifications, securitySymbolAliases } from "./portfolio-data";
import { buildContiguousAllocations, sortDonutHoldings } from "./portfolio-donut";
import { netPositionsFromKitePayload } from "./kite-positions";
import { nextKiteDailyExpiry, persistKiteSession, readPersistedKiteSession, clearPersistedKiteSession } from "./kite-session-store";
import type { KiteAuthStatus, KiteSnapshot, LiveAlert, LiveGtt, LiveHolding, LiveOrder, LivePosition } from "./live-types";
import { sanitizeKiteStatusNote } from "./kite-status-note";

type JsonObject = Record<string, unknown>;
export type KiteOrderRequest = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  product: "CNC" | "MIS" | "NRML" | "MTF";
  orderType: "MARKET" | "LIMIT" | "SL" | "SL-M";
  price?: number;
  triggerPrice?: number;
};

/** Single-leg GTT / protective TSL create payload (both map to Kite PlaceGTT). */
export type KiteGttRequest = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  product: "CNC" | "MIS" | "NRML" | "MTF";
  triggerPrice: number;
  limitPrice: number;
  lastPrice?: number;
  kind: "gtt" | "tsl";
};

/** Simple Kite Connect price alert (LTP vs constant). */
export type KiteAlertRequest = {
  symbol: string;
  exchange: "NSE" | "BSE" | "NFO" | "CDS" | "BCD" | "MCX" | "INDICES";
  direction: "above" | "below";
  triggerPrice: number;
  note?: string;
};
export type KiteCashInstrument = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  series: string;
  tickSize: number;
  lotSize: number;
  active: boolean;
};
type McpState = {
  sessionId?: string;
  authUrl?: string;
  authUrlCreatedAt?: number;
  requestId: number;
  sessionInit?: Promise<void>;
};

const globalState = globalThis as typeof globalThis & { __kiteDashboardMcp?: McpState };
const state = globalState.__kiteDashboardMcp ??= { requestId: 1 };
const endpoint = process.env.KITE_MCP_URL ?? "http://127.0.0.1:8080/mcp";
const AUTH_URL_MAX_AGE_MS = 20 * 60 * 1000;
const SNAPSHOT_COALESCE_MS = 5 * 1000;
const KITE_CALL_MIN_GAP_MS = 350;
let lastLiveSnapshot: KiteSnapshot | undefined;
let lastLiveAt = 0;
let snapshotInFlight: Promise<KiteSnapshot> | undefined;
let kiteCallChain: Promise<unknown> = Promise.resolve();
let lastKiteCallAt = 0;

const metadata = new Map(Object.entries(securityClassifications));

function classificationForSymbol(symbol: string) {
  const canonical = securitySymbolAliases[symbol] ?? symbol;
  return metadata.get(canonical) ?? metadata.get(symbol);
}

const marketCapColors: Record<string, string> = { "Large cap": "#315f91", "Mid cap": "#8aa4bd", "Small cap": "#c1ceda" };
const sectorColors: Record<string, string> = Object.fromEntries(Object.values(securityClassifications).map((holding) => [holding.sector, holding.color]));
const subSectorColors: Record<string, string> = Object.fromEntries(Object.values(securityClassifications).map((holding) => [holding.subSector, holding.color]));

class KiteAuthRequired extends Error {}
class KiteSessionInvalid extends Error {}

function clearAuthUrl() {
  state.authUrl = undefined;
  state.authUrlCreatedAt = undefined;
}

function hasFreshAuthUrl() {
  return Boolean(state.authUrl && state.authUrlCreatedAt && Date.now() - state.authUrlCreatedAt < AUTH_URL_MAX_AGE_MS);
}

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

async function postMcp(payload: JsonObject, sessionId: string | null | undefined = state.sessionId) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    if ((response.status === 400 || response.status === 404) && sessionId) {
      state.sessionId = undefined;
      clearAuthUrl();
      // Drop the dead MCP session id from disk so the next request creates a fresh
      // MCP session that can re-apply the persisted daily Kite access token.
      clearPersistedKiteSession();
      throw new KiteSessionInvalid("Kite MCP session expired");
    }
    throw new Error(`Kite MCP returned HTTP ${response.status}`);
  }

  const rawBody = await response.text();
  if (!rawBody.trim()) return { response, body: {} as JsonObject };

  try {
    return { response, body: JSON.parse(rawBody) as JsonObject };
  } catch {
    throw new Error(`Kite MCP returned an invalid JSON response (${response.status})`);
  }
}

async function initializeSession() {
  const { response } = await postMcp({
    jsonrpc: "2.0",
    id: state.requestId++,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "portfolio-live-dashboard", version: "1.0.0" } },
  }, null);
  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("Kite MCP did not provide a session ID");
  state.sessionId = sessionId;
  await postMcp({ jsonrpc: "2.0", method: "notifications/initialized" });
}

async function ensureSession() {
  adoptPersistedKiteSession();
  if (state.sessionId) return;
  state.sessionInit ??= initializeSession().finally(() => {
    state.sessionInit = undefined;
  });
  await state.sessionInit;
}

async function invokeKiteTool(name: string, args: JsonObject = {}): Promise<unknown> {
  await ensureSession();
  const { body } = await postMcp({ jsonrpc: "2.0", id: state.requestId++, method: "tools/call", params: { name, arguments: args } });
  const result = body.result as JsonObject | undefined;
  const content = Array.isArray(result?.content) ? result.content as JsonObject[] : [];
  const text = content.find((item) => item.type === "text")?.text;
  if (result?.isError) {
    const message = string(text) || `Kite tool ${name} failed`;
    if (/log in|login|api_key|access_token|invalid[^\n]*token|token[^\n]*expired|authentication required/i.test(message)) {
      throw new KiteAuthRequired(message);
    }
    throw new Error(message);
  }
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function callKiteTool(name: string, args: JsonObject = {}): Promise<unknown> {
  const scheduled = kiteCallChain.then(async () => {
    const waitMs = Math.max(0, KITE_CALL_MIN_GAP_MS - (Date.now() - lastKiteCallAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastKiteCallAt = Date.now();
    return invokeKiteTool(name, args);
  });
  kiteCallChain = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

async function invokeKiteToolsList(): Promise<string[]> {
  await ensureSession();
  const { body } = await postMcp({
    jsonrpc: "2.0",
    id: state.requestId++,
    method: "tools/list",
    params: {},
  });
  const result = body.result && typeof body.result === "object" ? body.result as JsonObject : {};
  const tools = Array.isArray(result.tools) ? result.tools : [];
  return tools
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      return string((item as JsonObject).name);
    })
    .filter((name) => name.length > 0);
}

/** Discover registered Kite MCP tool names. Never invent a watchlist tool. */
export async function listKiteToolNames(): Promise<string[]> {
  const scheduled = kiteCallChain.then(async () => {
    const waitMs = Math.max(0, KITE_CALL_MIN_GAP_MS - (Date.now() - lastKiteCallAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastKiteCallAt = Date.now();
    return invokeKiteToolsList();
  });
  kiteCallChain = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

function instrumentRows(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) return payload.filter((item): item is JsonObject => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const object = payload as JsonObject;
  for (const key of ["data", "items", "results", "instruments"]) {
    if (Array.isArray(object[key])) return (object[key] as unknown[]).filter((item): item is JsonObject => Boolean(item && typeof item === "object"));
  }
  return [];
}

/** Search the broker's daily cash-market instrument catalogue, not the holdings list. */
export async function searchKiteCashInstruments(query: string, exchange = "NSE", limit = 20): Promise<KiteCashInstrument[]> {
  const normalizedQuery = query.trim().toUpperCase();
  const normalizedExchange = exchange.trim().toUpperCase();
  if (!/^[A-Z0-9&.\- ]{1,48}$/.test(normalizedQuery)) return [];
  if (!/^(NSE|BSE)$/.test(normalizedExchange)) throw new Error("Instrument search supports NSE and BSE cash markets only.");

  const payload = await callKiteTool("search_instruments", {
    query: normalizedQuery.includes(":") ? normalizedQuery : `${normalizedExchange}:${normalizedQuery}`,
    filter_on: "id",
    from: 0,
    limit: Math.max(1, Math.min(100, limit * 5)),
  });
  const rows = instrumentRows(payload);
  return rows
    .map((raw) => ({
      id: string(raw.id).toUpperCase(),
      symbol: string(raw.tradingsymbol).toUpperCase(),
      name: string(raw.name) || string(raw.tradingsymbol),
      exchange: string(raw.exchange).toUpperCase(),
      series: string(raw.series).toUpperCase(),
      tickSize: number(raw.tick_size),
      lotSize: number(raw.lot_size) || 1,
      active: raw.active !== false,
    }))
    .filter((item) => item.active && item.exchange === normalizedExchange && item.series === "EQ" && item.symbol)
    .sort((left, right) => {
      const leftExact = left.symbol === normalizedQuery || left.id === `${normalizedExchange}:${normalizedQuery}`;
      const rightExact = right.symbol === normalizedQuery || right.id === `${normalizedExchange}:${normalizedQuery}`;
      return Number(rightExact) - Number(leftExact) || left.symbol.localeCompare(right.symbol);
    })
    .slice(0, Math.max(1, Math.min(50, limit)));
}

async function requireKiteCashInstrument(symbol: string, exchange = "NSE") {
  const matches = await searchKiteCashInstruments(symbol, exchange, 25);
  const exact = matches.find((item) => item.symbol === symbol && item.exchange === exchange);
  if (!exact) throw new Error(`${exchange}:${symbol} is not an active cash-market instrument in Kite's current catalogue.`);
  return exact;
}

/**
 * Submit an explicitly confirmed order from the dashboard order ticket.
 * The API route validates the human-entered confirmation phrase before this
 * function is reachable; this function then re-validates the complete payload.
 */
export async function placeKiteOrder(order: KiteOrderRequest) {
  const symbol = order.symbol.trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,32}$/.test(symbol)) throw new Error("Invalid Kite trading symbol.");
  if (!Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 1_000_000) throw new Error("Quantity must be a positive whole number.");
  if (!["BUY", "SELL"].includes(order.side)) throw new Error("Invalid transaction side.");
  if (!["CNC", "MIS", "NRML", "MTF"].includes(order.product)) throw new Error("Invalid Kite product.");
  if (!["MARKET", "LIMIT", "SL", "SL-M"].includes(order.orderType)) throw new Error("Invalid Kite order type.");
  if ((order.orderType === "LIMIT" || order.orderType === "SL") && (!order.price || order.price <= 0)) throw new Error("A positive limit price is required.");
  if ((order.orderType === "SL" || order.orderType === "SL-M") && (!order.triggerPrice || order.triggerPrice <= 0)) throw new Error("A positive trigger price is required.");

  await requireKiteCashInstrument(symbol, "NSE");

  const result = await callKiteTool("place_order", {
    variety: "regular",
    exchange: "NSE",
    tradingsymbol: symbol,
    transaction_type: order.side,
    quantity: order.quantity,
    product: order.product,
    order_type: order.orderType,
    validity: "DAY",
    price: order.price ?? 0,
    trigger_price: order.triggerPrice ?? 0,
    tag: "PI-DASHBOARD",
  });
  lastLiveAt = 0;
  return result;
}

/**
 * Submit an explicitly confirmed single-leg GTT (entry or protective TSL).
 * Dashboard confirmation is enforced by the API route before this runs.
 * Uses kite-mcp `create_gtt` with confirm=true so Kite PlaceGTT is invoked.
 */
export async function placeKiteGtt(order: KiteGttRequest) {
  const symbol = order.symbol.trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,32}$/.test(symbol)) throw new Error("Invalid Kite trading symbol.");
  if (!Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 1_000_000) throw new Error("Quantity must be a positive whole number.");
  if (!["BUY", "SELL"].includes(order.side)) throw new Error("Invalid transaction side.");
  if (!["CNC", "MIS", "NRML", "MTF"].includes(order.product)) throw new Error("Invalid Kite product.");
  switch (order.kind) {
    case "gtt":
    case "tsl":
      break;
    default: {
      const _exhaustive: never = order.kind;
      throw new Error(`Invalid GTT kind: ${String(_exhaustive)}`);
    }
  }
  if (!(order.triggerPrice > 0)) throw new Error("A positive trigger price is required.");
  if (!(order.limitPrice > 0)) throw new Error("A positive limit price is required.");
  if (order.kind === "tsl" && order.side !== "SELL") throw new Error("Protective TSLs must be SELL GTTs.");
  if (!(order.lastPrice && order.lastPrice > 0)) throw new Error("A positive reviewed reference last price is required for every GTT/TSL.");

  await requireKiteCashInstrument(symbol, "NSE");

  const result = await callKiteTool("create_gtt", {
    tradingsymbol: symbol,
    exchange: "NSE",
    transaction_type: order.side,
    product: order.product,
    trigger_price: order.triggerPrice,
    quantity: order.quantity,
    limit_price: order.limitPrice,
    last_price: order.lastPrice,
    confirm: true,
  });

  if (result && typeof result === "object" && (result as JsonObject).submitted === false) {
    throw new Error("Kite returned a GTT preview instead of a submission. Confirmation did not reach create_gtt.");
  }

  lastLiveAt = 0;
  return result;
}

/**
 * Submit an explicitly confirmed simple price alert.
 * Dashboard confirmation is enforced by the API route before this runs.
 * Uses kite-mcp `create_alert` with confirm=true so Kite CreateAlert is invoked.
 */
export async function placeKiteAlert(alert: KiteAlertRequest) {
  const symbol = alert.symbol.trim().toUpperCase();
  if (!/^[A-Z0-9&.\- ]{1,48}$/.test(symbol)) throw new Error("Invalid Kite trading symbol.");
  if (!(alert.triggerPrice > 0)) throw new Error("A positive trigger price is required.");
  switch (alert.direction) {
    case "above":
    case "below":
      break;
    default: {
      const _exhaustive: never = alert.direction;
      throw new Error(`Invalid alert direction: ${String(_exhaustive)}`);
    }
  }
  switch (alert.exchange) {
    case "NSE":
    case "BSE":
    case "NFO":
    case "CDS":
    case "BCD":
    case "MCX":
    case "INDICES":
      break;
    default: {
      const _exhaustive: never = alert.exchange;
      throw new Error(`Invalid alert exchange: ${String(_exhaustive)}`);
    }
  }

  if (alert.exchange === "NSE" || alert.exchange === "BSE") await requireKiteCashInstrument(symbol, alert.exchange);

  let result: unknown;
  try {
    result = await callKiteTool("create_alert", {
      tradingsymbol: symbol,
      exchange: alert.exchange,
      direction: alert.direction,
      trigger_price: alert.triggerPrice,
      ...(alert.note?.trim() ? { name: alert.note.trim().slice(0, 80) } : {}),
      confirm: true,
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/unknown tool|tool not found|method not found|not (?:found|registered|available)|does not exist/i.test(text)) {
      throw new Error("Unavailable: Kite MCP does not expose create_alert on this server build.");
    }
    throw error;
  }

  if (result && typeof result === "object" && (result as JsonObject).submitted === false) {
    throw new Error("Kite returned an alert preview instead of a submission. Confirmation did not reach create_alert.");
  }

  const kiteResponse = result && typeof result === "object" ? (result as JsonObject).kite_response : undefined;
  lastLiveAt = 0;
  return kiteResponse ?? result;
}

async function getLoginUrl(force = false) {
  const result = await callKiteTool("login", force ? { force: true } : {});
  const text = string(result);
  if (!force && /already logged in/i.test(text)) {
    throw new Error("Kite session is already authenticated; pass force to mint a fresh login URL");
  }
  const match = text.match(/\[Login to Kite\]\((https?:\/\/[^)]+)\)/) ?? text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("Kite login URL was not returned");
  state.authUrl = match[1] ?? match[0];
  state.authUrlCreatedAt = Date.now();
  return state.authUrl;
}

/** Explicit user-driven re-auth. Clears the daily token only when force=true. */
export async function requestKiteLoginUrl(force = false) {
  return getLoginUrl(force);
}

function mapLiveHoldings(rawHoldings: JsonObject[], rawPositions: JsonObject[]): LiveHolding[] {
  const merged = new Map<string, { raw: JsonObject; source: "holding" | "position" }>();
  for (const raw of rawHoldings) merged.set(string(raw.tradingsymbol), { raw, source: "holding" });
  for (const raw of rawPositions) {
    const symbol = string(raw.tradingsymbol);
    const qty = number(raw.quantity);
    const product = string(raw.product).toUpperCase();
    const exchange = string(raw.exchange).toUpperCase();
    if (qty !== 0 && product === "CNC" && (exchange === "NSE" || exchange === "BSE") && !merged.has(symbol)) {
      merged.set(symbol, { raw, source: "position" });
    }
  }

  const rows = [...merged.entries()].map(([symbol, entry]) => {
    const raw = entry.raw;
    const verified = classificationForSymbol(symbol);
    const details = verified ?? {
      name: symbol, sector: "Verification pending", subSector: "Verification pending", marketCap: "Verification pending", donutOrder: 999, risk: "Review", stance: "Classification required", oil: 3, flow: 3, quarter: "Review", color: "#6f8193",
    };
    const mtf = (raw.mtf ?? {}) as JsonObject;
    const settledQty = number(raw.quantity);
    const t1Qty = number(raw.t1_quantity);
    const mtfQty = number(mtf.quantity);
    const qty = entry.source === "holding" ? settledQty + t1Qty + mtfQty : settledQty;
    const deliveryQty = settledQty + t1Qty;
    const deliveryAvg = number(raw.average_price);
    const mtfAvg = number(mtf.average_price);
    const avg = entry.source === "holding" && qty
      ? ((deliveryQty * deliveryAvg) + (mtfQty * mtfAvg)) / qty
      : deliveryAvg;
    const price = number(raw.last_price);
    const close = number(raw.close_price);
    const value = qty * price;
    const pnl = number(raw.pnl) || (price - avg) * qty;
    const invested = avg * qty;
    const dayPnl = (price - close) * qty;
    return {
      symbol, ...details, qty, avg, price, value, pnl,
      pnlPct: invested ? pnl / invested * 100 : 0,
      dayPnl,
      dayPct: close ? (price - close) / close * 100 : 0,
      weight: 0,
      classificationStatus: verified ? "verified" as const : "pending" as const,
    };
  }).filter((holding) => holding.qty !== 0 && holding.value !== 0);

  const total = rows.reduce((sum, holding) => sum + holding.value, 0);
  return rows.map((holding) => ({ ...holding, weight: total ? holding.value / total * 100 : 0 })).sort((a, b) => b.value - a.value);
}

function mapOrders(rawOrders: JsonObject[]): LiveOrder[] {
  return rawOrders.slice().reverse().map((raw) => ({
    id: string(raw.order_id), symbol: string(raw.tradingsymbol), side: string(raw.transaction_type), qty: number(raw.quantity),
    type: `${string(raw.order_type)} · ${string(raw.product)}`, price: number(raw.average_price) || number(raw.price), status: string(raw.status),
    statusMessage: string(raw.status_message) || string(raw.status_message_raw),
  }));
}

function mapOpenPositions(rawPositions: JsonObject[]): LivePosition[] {
  return rawPositions
    .map((raw, index) => {
      const qty = number(raw.quantity);
      if (!qty) return null;
      const product = string(raw.product).toUpperCase() || "CNC";
      const side = qty > 0 ? "LONG" : "SHORT";
      return {
        id: `${string(raw.tradingsymbol)}-${product}-${index}`,
        symbol: string(raw.tradingsymbol),
        product,
        side,
        qty: Math.abs(qty),
        avg: number(raw.average_price),
        price: number(raw.last_price),
        pnl: number(raw.pnl) || (number(raw.last_price) - number(raw.average_price)) * qty,
      } satisfies LivePosition;
    })
    .filter((row): row is LivePosition => row !== null);
}

function mapGtts(rawGtts: JsonObject[]): LiveGtt[] {
  return rawGtts.map((raw) => {
    const condition = (raw.condition ?? {}) as JsonObject;
    const orders = Array.isArray(raw.orders) ? raw.orders as JsonObject[] : [];
    const order = orders[0] ?? {};
    const triggers = Array.isArray(condition.trigger_values) ? condition.trigger_values : [];
    const side = string(order.transaction_type).toUpperCase();
    const meta = `${string(raw.type)} ${string(order.order_type)} ${JSON.stringify(raw.meta ?? "")}`.toLowerCase();
    const trailing = number((raw as JsonObject).trailing_stoploss) || number(order.trailing_stoploss);
    const kind: LiveGtt["kind"] = side === "SELL" || trailing > 0 || /trail|stoploss|stop.?loss|sl\b/.test(meta) ? "tsl" : "gtt";
    return {
      id: string(raw.id), symbol: string(condition.tradingsymbol), side: string(order.transaction_type), qty: number(order.quantity),
      trigger: number(triggers[0]), limit: number(order.price), status: string(raw.status), expiry: string(raw.expires_at), kind,
    };
  });
}

function mapAlertDirection(operator: string): LiveAlert["direction"] {
  switch (operator) {
    case ">=":
    case ">":
      return "above";
    case "<=":
    case "<":
      return "below";
    default:
      return "other";
  }
}

function mapAlerts(rawAlerts: JsonObject[]): LiveAlert[] {
  return rawAlerts.map((raw) => {
    const operator = string(raw.operator);
    const name = string(raw.name);
    return {
      id: string(raw.uuid) || string(raw.id),
      name,
      symbol: string(raw.lhs_tradingsymbol),
      exchange: string(raw.lhs_exchange) || "NSE",
      direction: mapAlertDirection(operator),
      operator,
      trigger: number(raw.rhs_constant),
      status: string(raw.status) || "unknown",
      note: name,
    };
  });
}

function authStatusForFailure(message: string, authUrl?: string): KiteAuthStatus {
  if (/expired|token[^\n]*invalid|invalid[^\n]*token|06:00|daily access token/i.test(message)) return "expired";
  if (authUrl) return "unauthenticated";
  return "unavailable";
}

function kiteDailyExpiryHint() {
  const expiresAt = nextKiteDailyExpiry();
  const label = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt);
  return { expiresAt: expiresAt.toISOString(), label };
}

function withDailyAuthHint(message: string) {
  if (/06:00|daily access token|once per day/i.test(message)) return message;
  return `${message} Zerodha access tokens expire once per day around 06:00 IST (not a fixed 12-hour timer).`;
}

function fallbackSnapshot(message: string, authUrl?: string): KiteSnapshot {
  const { expiresAt } = kiteDailyExpiryHint();
  const authStatus = authStatusForFailure(message, authUrl);
  const detail = authStatus === "expired" || authStatus === "unauthenticated"
    ? withDailyAuthHint(message)
    : message;
  return {
    status: authUrl ? "auth_required" : "unavailable",
    authStatus,
    asOf: "Live Kite unavailable",
    message: "Portfolio figures are hidden because live Kite data is unavailable. " + detail,
    authUrl,
    tokenExpiresAt: expiresAt,
    unavailableSections: ["live Kite"],
    portfolio: { invested: 0, value: 0, pnl: 0, pnlPct: 0, dayPnl: 0, dayPct: 0, topTwo: 0, equityMargin: 0 },
    holdings: [],
    positions: [],
    orders: [],
    gtts: [],
    alerts: [],
    marketCapAllocation: [],
    sectorAllocation: [],
    subSectorAllocation: [],
    classification: { industrySource: classificationSources.industry, marketCapSource: classificationSources.marketCap, industryUrl: classificationSources.industryUrl, marketCapUrl: classificationSources.marketCapUrl, asOf: classificationSources.asOf, pendingSymbols: [] },
  };
}

/** Retain last holdings visually, but never claim a verified live auth session. */
async function retainedSnapshot(base: KiteSnapshot): Promise<KiteSnapshot> {
  const { expiresAt } = kiteDailyExpiryHint();
  const retainedMessage = sanitizeKiteStatusNote(base.message);
  try {
    await callKiteTool("get_profile");
    return {
      ...base,
      status: "snapshot",
      // Profile still works, but this is retained/cached data — not a fresh live refresh.
      // UI must treat status=snapshot as cached (never "Kite authenticated").
      authStatus: "authenticated",
      asOf: `${base.asOf.replace(/ · cached$/, "")} · cached`,
      message: retainedMessage,
      authUrl: undefined,
      tokenExpiresAt: expiresAt,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    try {
      const authUrl = await getLoginUrl();
      const authStatus = authStatusForFailure(detail, authUrl);
      return {
        ...base,
        status: "snapshot",
        authStatus,
        asOf: `${base.asOf.replace(/ · cached$/, "")} · cached`,
        message: retainedMessage,
        authUrl,
        tokenExpiresAt: expiresAt,
      };
    } catch {
      return {
        ...base,
        status: "snapshot",
        authStatus: "unknown",
        asOf: `${base.asOf.replace(/ · cached$/, "")} · cached`,
        message: retainedMessage,
        authUrl: undefined,
        tokenExpiresAt: expiresAt,
      };
    }
  }
}

export function restoreKiteSession(sessionId?: string, replaceExisting = false) {
  // Prefer the in-memory MCP session. Only adopt a cookie/file when no session exists,
  // or when a caller explicitly opts into replacement (avoid multi-tab clobber).
  if (!sessionId) return;
  if (!state.sessionId) {
    state.sessionId = sessionId;
    clearAuthUrl();
    return;
  }
  if (replaceExisting && state.sessionId !== sessionId) {
    state.sessionId = sessionId;
    clearAuthUrl();
  }
}

function adoptPersistedKiteSession() {
  if (state.sessionId) return;
  const persisted = readPersistedKiteSession();
  if (persisted) restoreKiteSession(persisted, false);
}

export function currentKiteSession() {
  return state.sessionId;
}

async function fetchKiteSnapshot(retried = false): Promise<KiteSnapshot> {
  try {
    if (state.authUrl) {
      try {
        await callKiteTool("get_profile");
        clearAuthUrl();
      } catch {
        if (!hasFreshAuthUrl()) {
          return fallbackSnapshot("The Kite login link was refreshed. Complete authentication, then refresh this dashboard.", await getLoginUrl());
        }
        return fallbackSnapshot("Complete Kite authentication, then refresh this dashboard.", state.authUrl);
      }
    }

    const toolNames = ["holdings", "positions", "orders", "GTTs", "margins", "alerts"] as const;
    const results = await Promise.allSettled([
      callKiteTool("get_holdings"), callKiteTool("get_positions"), callKiteTool("get_orders"), callKiteTool("get_gtts"), callKiteTool("get_margins"), callKiteTool("get_alerts"),
    ]);
    const [holdingsResult, positionsResult, ordersResult, gttsResult, marginsResult, alertsResult] = results;
    if (holdingsResult.status === "rejected") throw holdingsResult.reason;

    const holdingsRaw = holdingsResult.value;
    const positionsRaw = positionsResult.status === "fulfilled" ? positionsResult.value : [];
    const ordersRaw = ordersResult.status === "fulfilled" ? ordersResult.value : [];
    const gttsRaw = gttsResult.status === "fulfilled" ? gttsResult.value : [];
    const marginsRaw = marginsResult.status === "fulfilled" ? marginsResult.value : {};
    const alertsRaw = alertsResult.status === "fulfilled" ? alertsResult.value : [];
    const unavailable: string[] = results
      .map((result, index) => result.status === "rejected" ? toolNames[index] : null)
      .filter((name): name is typeof toolNames[number] => name !== null);
    const marginsFailure = marginsResult.status === "rejected"
      ? (marginsResult.reason instanceof Error ? marginsResult.reason.message : String(marginsResult.reason))
      : "";
    const marginsApiFault = unavailable.includes("margins")
      && /message build error|failed to execute get_margins|generalexception|rms limits|unknown_request|request not registered|error parsing response/i.test(marginsFailure);
    const netPositionsRaw = netPositionsFromKitePayload(positionsRaw);
    const holdings = mapLiveHoldings(holdingsRaw as JsonObject[], netPositionsRaw);
    const pendingClassifications = holdings
      .filter((holding) => holding.classificationStatus === "pending")
      .map((holding) => holding.symbol);
    if (pendingClassifications.length) unavailable.push("classifications");
    const openPositions = mapOpenPositions(netPositionsRaw);
    const donutHoldings = sortDonutHoldings(holdings);
    const value = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const invested = holdings.reduce((sum, holding) => sum + holding.avg * holding.qty, 0);
    const pnl = holdings.reduce((sum, holding) => sum + holding.pnl, 0);
    const dayPnl = holdings.reduce((sum, holding) => sum + holding.dayPnl, 0);
    const margins = marginsRaw as JsonObject;
    const equity = (margins.equity ?? {}) as JsonObject;
    let partialMessage = unavailable.length
      ? `Partial Kite snapshot: holdings are live, but ${unavailable.join(", ")} temporarily unavailable. Auto-refreshes every five minutes.`
      : "Live holdings and non-duplicated CNC equity positions from Zerodha Kite Connect. Quantities include settled, T1 and MTF shares; pledged collateral is not double-counted. Auto-refreshes every five minutes.";
    if (marginsApiFault) {
      partialMessage = "Partial Kite snapshot: the session is authenticated and holdings are live, but Zerodha's margins endpoint rejected the request. Re-authentication is not required; retry the refresh, and inspect the Kite adapter if margins remains unavailable. PDF export stays locked until margins succeeds.";
    }
    const { expiresAt, label: expiryLabel } = kiteDailyExpiryHint();
    const snapshot: KiteSnapshot = {
      status: unavailable.length ? "partial" : "live",
      // Holdings succeeded with this session, so secondary endpoint failures
      // affect completeness, not authentication.
      authStatus: "authenticated",
      asOf: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date()),
      message: unavailable.length
        ? partialMessage
        : `${partialMessage} Session valid until ~${expiryLabel} (Zerodha daily ~06:00 IST boundary).`,
      tokenExpiresAt: expiresAt,
      // Login is offered only by auth_required/expired snapshots. A secondary
      // adapter failure must never invalidate an otherwise working daily token.
      reauthSuggested: false,
      // Do not auto-force a login URL here — that would clear a working daily token on every refresh.
      // UI uses /api/kite/login?force=1 when the user explicitly chooses Re-auth.
      unavailableSections: unavailable,
      portfolio: {
        invested, value, pnl, pnlPct: invested ? pnl / invested * 100 : 0, dayPnl, dayPct: value - dayPnl ? dayPnl / (value - dayPnl) * 100 : 0,
        topTwo: holdings.slice(0, 2).reduce((sum, holding) => sum + holding.weight, 0), equityMargin: number(equity.net),
      },
      holdings,
      positions: openPositions,
      orders: mapOrders(ordersRaw as JsonObject[]),
      gtts: mapGtts(gttsRaw as JsonObject[]),
      alerts: mapAlerts(Array.isArray(alertsRaw) ? alertsRaw as JsonObject[] : []),
      marketCapAllocation: buildContiguousAllocations(donutHoldings, "marketCap", marketCapColors),
      sectorAllocation: buildContiguousAllocations(donutHoldings, "sector", sectorColors),
      subSectorAllocation: buildContiguousAllocations(donutHoldings, "subSector", subSectorColors),
      classification: {
        industrySource: classificationSources.industry,
        marketCapSource: classificationSources.marketCap,
        industryUrl: classificationSources.industryUrl,
        marketCapUrl: classificationSources.marketCapUrl,
        asOf: classificationSources.asOf,
        pendingSymbols: pendingClassifications,
      },
    };
    lastLiveSnapshot = snapshot;
    lastLiveAt = Date.now();
    persistKiteSession(state.sessionId);
    return snapshot;
  } catch (error) {
    if (error instanceof KiteSessionInvalid && !retried) return fetchKiteSnapshot(true);
    if (error instanceof KiteAuthRequired) {
      try {
        return fallbackSnapshot(
          "Kite session expired or was logged out. Complete Zerodha login once (daily ~06:00 IST boundary), then refresh.",
          await getLoginUrl(),
        );
      } catch (loginError) { error = loginError; }
    }

    const message = error instanceof Error ? error.message : String(error);
    if (/too many requests|rate limit/i.test(message)) {
      return lastLiveSnapshot
        ? retainedSnapshot(lastLiveSnapshot)
        : fallbackSnapshot("Zerodha rate limit reached. Retry after the current request window resets.");
    }

    if (lastLiveSnapshot) {
      return retainedSnapshot(lastLiveSnapshot);
    }

    // Some Kite SDK failures arrive as a generic "Failed to execute" message
    // instead of an explicit token-expired error. Probe the profile only when
    // no validated snapshot exists so the dashboard can still surface a login
    // link after the daily access token expires.
    try {
      await callKiteTool("get_profile");
    } catch {
      try {
        return fallbackSnapshot(
          "Kite session expired or login is required. Complete Zerodha login once (daily ~06:00 IST boundary), then refresh.",
          await getLoginUrl(),
        );
      } catch {
        // Preserve the original holdings error when the MCP server itself is
        // unreachable or cannot create a login URL.
      }
    }
    return fallbackSnapshot(error instanceof Error ? error.message : "Could not reach the local Kite MCP server.");
  }
}

export async function getKiteSnapshot(retried = false): Promise<KiteSnapshot> {
  if (retried) return fetchKiteSnapshot(true);
  if (lastLiveSnapshot && Date.now() - lastLiveAt < SNAPSHOT_COALESCE_MS) return lastLiveSnapshot;
  snapshotInFlight ??= fetchKiteSnapshot().finally(() => {
    snapshotInFlight = undefined;
  });
  return snapshotInFlight;
}
