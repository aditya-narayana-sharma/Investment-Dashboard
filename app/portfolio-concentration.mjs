/**
 * Classify unrealised return for the portfolio concentration map.
 * Boundary values are intentionally neutral: only values strictly outside
 * ±0.5% receive gain/loss colors.
 * @param {number} returnPct
 * @returns {"gain" | "flat" | "loss"}
 */
export function portfolioReturnTone(returnPct) {
  if (returnPct > 0.5) return "gain";
  if (returnPct < -0.5) return "loss";
  return "flat";
}
