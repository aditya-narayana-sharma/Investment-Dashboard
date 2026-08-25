import { buyOrderFundsState, type BuyOrderFundsState } from "../kite-order-funds";

/**
 * Allocation planning for built-in strategy signals.
 *
 * Turns "these symbols signalled BUY" plus a capital figure into whole-share
 * quantities the operator can review. It is arithmetic only: nothing here talks
 * to a broker, and the resulting plan is a *pre-fill* for the existing
 * `KiteOrderTicket`, whose typed-confirmation gate is untouched.
 *
 * Quantities are floored to whole shares -- NSE equity delivery cannot be
 * fractional, and rounding up would silently exceed the operator's stated
 * allocation.
 */

export type AllocationMode = "percent" | "amount";

export type AllocationRequest = {
  symbol: string;
  /** Latest traded price used for sizing. Null when unavailable. */
  price: number | null;
  /** Percent of deployable capital, or an absolute rupee amount. */
  allocation: number;
};

export type AllocationLine = {
  symbol: string;
  price: number | null;
  /** Rupees this symbol is allowed to consume. */
  budget: number | null;
  quantity: number;
  /** quantity x price. Zero when the budget cannot buy one whole share. */
  notional: number;
  funds: BuyOrderFundsState;
  reason: string | null;
};

export type AllocationPlan = {
  mode: AllocationMode;
  deployableCapital: number;
  lines: AllocationLine[];
  totalNotional: number;
  /** Capital left after the plan. Negative means the plan exceeds capital. */
  residual: number;
  /** Blocking problems. A plan with errors must not reach the order ticket. */
  errors: string[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Size a set of signalled symbols.
 *
 * `percent` treats each `allocation` as a share of `deployableCapital`;
 * `amount` treats it as rupees directly and ignores the capital figure except
 * for the over-allocation check.
 */
export function planAllocation(
  requests: readonly AllocationRequest[],
  {
    mode,
    deployableCapital,
    equityMargin,
    marginsKnown,
  }: {
    mode: AllocationMode;
    deployableCapital: number;
    equityMargin: number;
    marginsKnown: boolean;
  },
): AllocationPlan {
  const errors: string[] = [];
  const capital = Number.isFinite(deployableCapital) && deployableCapital > 0 ? deployableCapital : 0;
  if (capital <= 0) errors.push("Deployable capital must be greater than zero.");

  if (mode === "percent") {
    const totalPercent = requests.reduce((sum, request) => sum + (Number(request.allocation) || 0), 0);
    if (totalPercent > 100 + 1e-9) {
      errors.push(`Allocations total ${round2(totalPercent)}%, which exceeds 100%.`);
    }
  }

  const seen = new Set<string>();
  const lines: AllocationLine[] = requests.map((request) => {
    const symbol = String(request.symbol ?? "").trim().toUpperCase();
    const allocation = Number(request.allocation);
    const price = request.price !== null && Number.isFinite(request.price) && request.price > 0
      ? request.price
      : null;

    let reason: string | null = null;
    if (!symbol) reason = "missing symbol";
    else if (seen.has(symbol)) reason = "duplicate symbol in the plan";
    else if (!Number.isFinite(allocation) || allocation <= 0) reason = "allocation must be greater than zero";
    else if (price === null) reason = "no live price; cannot size this line";
    if (symbol) seen.add(symbol);

    const budget = reason !== null
      ? null
      : mode === "percent"
        ? (capital * allocation) / 100
        : allocation;

    // Whole shares only, and never more than the budget allows.
    const quantity = budget !== null && price !== null ? Math.floor(budget / price) : 0;
    if (reason === null && quantity < 1) {
      reason = "budget is below one share at the current price";
    }
    const notional = quantity > 0 && price !== null ? quantity * price : 0;

    return {
      symbol,
      price,
      budget: budget === null ? null : round2(budget),
      quantity,
      notional: round2(notional),
      funds: buyOrderFundsState({
        side: "BUY",
        quantity,
        estimatedPrice: price ?? 0,
        equityMargin,
        marginsKnown,
      }),
      reason,
    };
  });

  const totalNotional = round2(lines.reduce((sum, line) => sum + line.notional, 0));
  if (capital > 0 && totalNotional > capital + 1e-9) {
    errors.push(`Plan totals ${round2(totalNotional)}, which exceeds deployable capital ${round2(capital)}.`);
  }

  return {
    mode,
    deployableCapital: capital,
    lines,
    totalNotional,
    residual: round2(capital - totalNotional),
    errors,
  };
}

/** Only fully-sized, error-free lines may pre-fill an order ticket. */
export function orderTicketPrefills(plan: AllocationPlan): Array<{ symbol: string; quantity: number; price: number }> {
  if (plan.errors.length) return [];
  return plan.lines
    .filter((line) => line.reason === null && line.quantity >= 1 && line.price !== null)
    .map((line) => ({ symbol: line.symbol, quantity: line.quantity, price: line.price as number }));
}
