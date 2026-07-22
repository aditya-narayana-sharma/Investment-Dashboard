import { classificationSources, securityClassifications } from "./portfolio-data";
import type { AllocationSlice, KiteSnapshot, LiveGtt, LiveHolding, LiveOrder } from "./live-types";

type JsonObject = Record<string, unknown>;
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
let lastLiveSnapshot: KiteSnapshot | undefined;
let lastLiveAt = 0;
let snapshotInFlight: Promise<KiteSnapshot> | undefined;

const metadata = new Map(Object.entries(securityClassifications));

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
  if (state.sessionId) return;
  state.sessionInit ??= initializeSession().finally(() => {
    state.sessionInit = undefined;
  });
  await state.sessionInit;
}

export async function callKiteTool(name: string, args: JsonObject = {}): Promise<unknown> {
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

async function getLoginUrl() {
  const result = await callKiteTool("login");
  const text = string(result);
  const match = text.match(/\[Login to Kite\]\((https?:\/\/[^)]+)\)/) ?? text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("Kite login URL was not returned");
  state.authUrl = match[1] ?? match[0];
  state.authUrlCreatedAt = Date.now();
  return state.authUrl;
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
    const verified = metadata.get(symbol);
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

function allocations(holdings: LiveHolding[], key: "marketCap" | "sector" | "subSector", colors: Record<string, string>): AllocationSlice[] {
  const grouped = new Map<string, number>();
  for (const holding of holdings) grouped.set(holding[key], (grouped.get(holding[key]) ?? 0) + holding.value);
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
  return [...grouped.entries()].map(([name, value]) => ({ name, value, weight: total ? value / total * 100 : 0, color: colors[name] ?? "#6f8193" }));
}

function mapOrders(rawOrders: JsonObject[]): LiveOrder[] {
  return rawOrders.slice().reverse().map((raw) => ({
    id: string(raw.order_id), symbol: string(raw.tradingsymbol), side: string(raw.transaction_type), qty: number(raw.quantity),
    type: `${string(raw.order_type)} · ${string(raw.product)}`, price: number(raw.average_price) || number(raw.price), status: string(raw.status),
  }));
}

function mapGtts(rawGtts: JsonObject[]): LiveGtt[] {
  return rawGtts.map((raw) => {
    const condition = (raw.condition ?? {}) as JsonObject;
    const orders = Array.isArray(raw.orders) ? raw.orders as JsonObject[] : [];
    const order = orders[0] ?? {};
    const triggers = Array.isArray(condition.trigger_values) ? condition.trigger_values : [];
    return {
      id: string(raw.id), symbol: string(condition.tradingsymbol), side: string(order.transaction_type), qty: number(order.quantity),
      trigger: number(triggers[0]), limit: number(order.price), status: string(raw.status), expiry: string(raw.expires_at),
    };
  });
}

function fallbackSnapshot(message: string, authUrl?: string): KiteSnapshot {
  return {
    status: authUrl ? "auth_required" : "unavailable",
    asOf: "Live Kite unavailable",
    message: "Portfolio figures are hidden because live Kite data is unavailable. " + message,
    authUrl,
    unavailableSections: ["live Kite"],
    portfolio: { invested: 0, value: 0, pnl: 0, pnlPct: 0, dayPnl: 0, dayPct: 0, topTwo: 0, equityMargin: 0 },
    holdings: [],
    orders: [],
    gtts: [],
    marketCapAllocation: [],
    sectorAllocation: [],
    subSectorAllocation: [],
    classification: { industrySource: classificationSources.industry, marketCapSource: classificationSources.marketCap, industryUrl: classificationSources.industryUrl, marketCapUrl: classificationSources.marketCapUrl, asOf: classificationSources.asOf, pendingSymbols: [] },
  };
}

export function restoreKiteSession(sessionId?: string, replaceExisting = false) {
  // The portfolio route normally owns the active session. Read-only sibling routes
  // may explicitly replace their isolated runtime state with that authoritative cookie.
  if (sessionId && (!state.sessionId || (replaceExisting && state.sessionId !== sessionId))) {
    state.sessionId = sessionId;
    clearAuthUrl();
  }
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

    const toolNames = ["holdings", "positions", "orders", "GTTs", "margins"] as const;
    const results = await Promise.allSettled([
      callKiteTool("get_holdings"), callKiteTool("get_positions"), callKiteTool("get_orders"), callKiteTool("get_gtts"), callKiteTool("get_margins"),
    ]);
    const [holdingsResult, positionsResult, ordersResult, gttsResult, marginsResult] = results;
    if (holdingsResult.status === "rejected") throw holdingsResult.reason;

    const holdingsRaw = holdingsResult.value;
    const positionsRaw = positionsResult.status === "fulfilled" ? positionsResult.value : [];
    const ordersRaw = ordersResult.status === "fulfilled" ? ordersResult.value : [];
    const gttsRaw = gttsResult.status === "fulfilled" ? gttsResult.value : [];
    const marginsRaw = marginsResult.status === "fulfilled" ? marginsResult.value : {};
    const unavailable = results
      .map((result, index) => result.status === "rejected" ? toolNames[index] : null)
      .filter((name): name is typeof toolNames[number] => name !== null);
    const holdings = mapLiveHoldings(holdingsRaw as JsonObject[], positionsRaw as JsonObject[]);
    const donutHoldings = holdings.slice().sort((a, b) =>
      `${a.marketCap}|${a.sector}|${a.subSector}|${String(a.donutOrder).padStart(3, "0")}|${a.symbol}`
        .localeCompare(`${b.marketCap}|${b.sector}|${b.subSector}|${String(b.donutOrder).padStart(3, "0")}|${b.symbol}`),
    );
    const value = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const invested = holdings.reduce((sum, holding) => sum + holding.avg * holding.qty, 0);
    const pnl = holdings.reduce((sum, holding) => sum + holding.pnl, 0);
    const dayPnl = holdings.reduce((sum, holding) => sum + holding.dayPnl, 0);
    const margins = marginsRaw as JsonObject;
    const equity = (margins.equity ?? {}) as JsonObject;
    const snapshot: KiteSnapshot = {
      status: "live",
      asOf: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date()),
      message: unavailable.length
        ? `Live holdings from Zerodha Kite Connect; ${unavailable.join(", ")} temporarily unavailable. Auto-refreshes every five minutes.`
        : "Live holdings and non-duplicated CNC equity positions from Zerodha Kite Connect. Quantities include settled, T1 and MTF shares; pledged collateral is not double-counted. Auto-refreshes every five minutes.",
      unavailableSections: unavailable,
      portfolio: {
        invested, value, pnl, pnlPct: invested ? pnl / invested * 100 : 0, dayPnl, dayPct: value - dayPnl ? dayPnl / (value - dayPnl) * 100 : 0,
        topTwo: holdings.slice(0, 2).reduce((sum, holding) => sum + holding.weight, 0), equityMargin: number(equity.net),
      },
      holdings,
      orders: mapOrders(ordersRaw as JsonObject[]),
      gtts: mapGtts(gttsRaw as JsonObject[]),
      marketCapAllocation: allocations(donutHoldings, "marketCap", marketCapColors),
      sectorAllocation: allocations(donutHoldings, "sector", sectorColors),
      subSectorAllocation: allocations(donutHoldings, "subSector", subSectorColors),
      classification: {
        industrySource: classificationSources.industry,
        marketCapSource: classificationSources.marketCap,
        industryUrl: classificationSources.industryUrl,
        marketCapUrl: classificationSources.marketCapUrl,
        asOf: classificationSources.asOf,
        pendingSymbols: holdings.filter((holding) => holding.classificationStatus === "pending").map((holding) => holding.symbol),
      },
    };
    lastLiveSnapshot = snapshot;
    lastLiveAt = Date.now();
    return snapshot;
  } catch (error) {
    if (error instanceof KiteSessionInvalid && !retried) return fetchKiteSnapshot(true);
    if (error instanceof KiteAuthRequired) {
      try { return fallbackSnapshot("Authenticate once to restore live refresh.", await getLoginUrl()); }
      catch (loginError) { error = loginError; }
    }

    const message = error instanceof Error ? error.message : String(error);
    if (/too many requests|rate limit/i.test(message)) {
      return lastLiveSnapshot
        ? { ...lastLiveSnapshot, status: "snapshot", asOf: `${lastLiveSnapshot.asOf} · cached`, message: "Zerodha rate limit reached; retaining the last validated Kite snapshot until the next five-minute refresh." }
        : fallbackSnapshot("Zerodha rate limit reached. Retry after the current request window resets.");
    }

    // Some Kite SDK failures arrive as a generic "Failed to execute" message
    // instead of an explicit token-expired error. Probe the profile before
    // accepting the cached fallback so the dashboard can still surface a
    // usable authentication link after the daily access token expires.
    try {
      await callKiteTool("get_profile");
    } catch {
      try {
        return fallbackSnapshot("Authenticate once to restore live refresh.", await getLoginUrl());
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
