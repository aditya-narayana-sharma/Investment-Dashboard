export const INSUFFICIENT_BUY_FUNDS_MESSAGE = "Insufficient Funds - Add Funds to Place BUY orders";

export type BuyOrderFundsInput = {
  side: "BUY" | "SELL" | string;
  quantity: number;
  estimatedPrice: number;
  equityMargin: number;
  marginsKnown: boolean;
  /** Add only when a source already computed typical charges. Never invent fees. */
  typicalCharges?: number;
};

export type BuyOrderFundsState = {
  requiredFunds: number;
  /** Warning-only: UI must not disable Place BUY for this. Server may still reject. */
  insufficient: boolean;
  message: string | null;
};

/** Required BUY cash: price × qty, plus typical charges only when already computed. */
export function buyOrderRequiredFunds(quantity: number, estimatedPrice: number, typicalCharges = 0): number {
  if (!(quantity > 0) || !(estimatedPrice > 0)) return 0;
  const charges = typicalCharges > 0 && Number.isFinite(typicalCharges) ? typicalCharges : 0;
  const notional = estimatedPrice * quantity;
  if (!Number.isFinite(notional)) return 0;
  return notional + charges;
}

/**
 * BUY-only funds warning against live Kite equity margin.
 * SELL never uses the insufficient-funds copy. Unknown margin is not treated as ₹0.
 * This does not disable Place BUY in the UI; confirmation still enables submit.
 */
export function buyOrderFundsState(input: BuyOrderFundsInput): BuyOrderFundsState {
  const requiredFunds = buyOrderRequiredFunds(input.quantity, input.estimatedPrice, input.typicalCharges);
  if (input.side !== "BUY") {
    return { requiredFunds, insufficient: false, message: null };
  }
  if (!(requiredFunds > 0) || !input.marginsKnown || !Number.isFinite(input.equityMargin)) {
    return { requiredFunds, insufficient: false, message: null };
  }
  if (requiredFunds > input.equityMargin) {
    return { requiredFunds, insufficient: true, message: INSUFFICIENT_BUY_FUNDS_MESSAGE };
  }
  return { requiredFunds, insufficient: false, message: null };
}

/** Server-side BUY reject after the user confirms. Does not control the ticket button. */
export function assertBuyOrderFunds(input: BuyOrderFundsInput): void {
  const state = buyOrderFundsState(input);
  if (state.insufficient && state.message) throw new Error(state.message);
}
