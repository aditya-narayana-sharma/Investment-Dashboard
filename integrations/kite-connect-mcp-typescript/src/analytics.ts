type Holding = {
  tradingsymbol?: string;
  exchange?: string;
  quantity?: number;
  last_price?: number;
  average_price?: number;
  pnl?: number;
  day_change?: number;
  product?: string;
};

type Position = {
  tradingsymbol?: string;
  exchange?: string;
  quantity?: number;
  overnight_quantity?: number;
  multiplier?: number;
  last_price?: number;
  pnl?: number;
  m2m?: number;
  product?: string;
};

export function buildPortfolioAnalytics(holdings: unknown, positions: unknown) {
  const holdingRows = Array.isArray(holdings) ? (holdings as Holding[]) : [];
  const positionData = positions as { net?: Position[]; day?: Position[] };
  const netPositions = Array.isArray(positionData?.net) ? positionData.net : [];
  const dayPositions = Array.isArray(positionData?.day) ? positionData.day : [];

  const holdingValue = sum(holdingRows, (row) => money((row.quantity ?? 0) * (row.last_price ?? 0)));
  const holdingPnl = sum(holdingRows, (row) => row.pnl ?? 0);
  const dayChange = sum(holdingRows, (row) => row.day_change ?? 0);
  const positionPnl = sum(netPositions, (row) => row.pnl ?? 0);
  const positionM2m = sum(dayPositions, (row) => row.m2m ?? row.pnl ?? 0);
  const topHoldings = holdingRows
    .map((row) => ({
      tradingsymbol: row.tradingsymbol,
      exchange: row.exchange,
      product: row.product,
      quantity: row.quantity ?? 0,
      market_value: money((row.quantity ?? 0) * (row.last_price ?? 0)),
      pnl: money(row.pnl ?? 0),
      weight_pct: holdingValue > 0 ? round(((row.quantity ?? 0) * (row.last_price ?? 0) * 100) / holdingValue) : 0
    }))
    .sort((left, right) => right.market_value - left.market_value)
    .slice(0, 10);

  return {
    totals: {
      holdings_count: holdingRows.length,
      net_positions_count: netPositions.length,
      holding_market_value: money(holdingValue),
      holding_pnl: money(holdingPnl),
      holding_day_change: money(dayChange),
      net_position_pnl: money(positionPnl),
      day_position_m2m: money(positionM2m),
      total_reported_pnl: money(holdingPnl + positionPnl)
    },
    exposure_by_exchange: groupSum(holdingRows, (row) => row.exchange ?? "UNKNOWN", (row) => (row.quantity ?? 0) * (row.last_price ?? 0)),
    exposure_by_product: groupSum(holdingRows, (row) => row.product ?? "UNKNOWN", (row) => (row.quantity ?? 0) * (row.last_price ?? 0)),
    top_holdings: topHoldings,
    notes: [
      "Analytics are computed from Kite holdings and positions responses only.",
      "This is operational portfolio math, not investment advice or analyst research."
    ]
  };
}

function sum<T>(rows: T[], getter: (row: T) => number): number {
  return rows.reduce((total, row) => total + getter(row), 0);
}

function groupSum<T>(rows: T[], key: (row: T) => string, value: (row: T) => number) {
  const groups = new Map<string, number>();
  for (const row of rows) groups.set(key(row), (groups.get(key(row)) ?? 0) + value(row));
  return Object.fromEntries([...groups.entries()].map(([name, amount]) => [name, money(amount)]));
}

function money(value: number): number {
  return round(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
