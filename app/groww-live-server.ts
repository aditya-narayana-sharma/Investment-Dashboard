export type GrowwSnapshot = {
  status: "live" | "unavailable";
  asOf: string | null;
  holdings: Array<{ symbol: string; qty: number; value: number }>;
  message: string;
};

type GrowwHoldingRow = {
  trading_symbol?: string;
  quantity?: number;
  value?: number;
};

function growwToken() {
  return String(process.env.GROWW_ACCESS_TOKEN ?? "").trim();
}

/** Live Groww holdings when GROWW_ACCESS_TOKEN is set. Never invents quantities. */
export async function getGrowwSnapshot(now = new Date()): Promise<GrowwSnapshot> {
  const token = growwToken();
  if (!token) {
    return {
      status: "unavailable",
      asOf: null,
      holdings: [],
      message: "Groww live API is unconfigured. Groww Digest mail remains the Satya newsletter family.",
    };
  }
  try {
    const response = await fetch("https://api.groww.in/v1/api/portfolio/v1/holdings", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        asOf: null,
        holdings: [],
        message: `Groww holdings HTTP ${response.status}. Last values were not replaced.`,
      };
    }
    const payload = await response.json() as { holdings?: GrowwHoldingRow[] };
    const holdings = (Array.isArray(payload.holdings) ? payload.holdings : [])
      .map((row) => ({
        symbol: String(row.trading_symbol ?? "").trim().toUpperCase(),
        qty: Number(row.quantity) || 0,
        value: Number(row.value) || 0,
      }))
      .filter((row) => row.symbol);
    return {
      status: "live",
      asOf: now.toISOString(),
      holdings,
      message: `Groww live holdings · ${holdings.length} rows`,
    };
  } catch (error) {
    return {
      status: "unavailable",
      asOf: null,
      holdings: [],
      message: error instanceof Error ? error.message : "Groww holdings request failed.",
    };
  }
}
