import type { MailRecommendation } from "./content-types";

export type AxisCmpSource = "kite" | "yfinance" | "axis";

export type CompleteAxisPick = MailRecommendation & {
  target: number;
  cmp: number;
  computedUpsidePct: number;
  cmpSource: AxisCmpSource;
};

function positiveNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** The sole Axis upside formula: (target / CMP - 1) * 100. */
export function axisImpliedUpsidePct(
  target: number | null | undefined,
  cmp: number | null | undefined,
): number | null {
  const safeTarget = positiveNumber(target);
  const safeCmp = positiveNumber(cmp);
  return safeTarget === null || safeCmp === null ? null : (safeTarget / safeCmp - 1) * 100;
}

/** Resolve CMP in evidence order: Kite holding, delayed yfinance quote, Axis report CMP. */
export function resolveAxisCmp(
  item: MailRecommendation,
  kiteBySymbol: ReadonlyMap<string, number>,
  yfinanceBySymbol: ReadonlyMap<string, number>,
): { cmp: number | null; source: AxisCmpSource | null } {
  const kite = positiveNumber(kiteBySymbol.get(item.symbol));
  if (kite !== null) return { cmp: kite, source: "kite" };
  const yfinance = positiveNumber(yfinanceBySymbol.get(item.symbol));
  if (yfinance !== null) return { cmp: yfinance, source: "yfinance" };
  const axis = positiveNumber(item.cmp);
  return axis === null ? { cmp: null, source: null } : { cmp: axis, source: "axis" };
}

/**
 * Axis picks are displayable only with a positive target and a resolved CMP.
 * Stored percentage prose is replaced by the computed value so it cannot drift.
 */
export function completeAxisPicks(
  recommendations: readonly MailRecommendation[],
  kiteBySymbol: ReadonlyMap<string, number>,
  yfinanceBySymbol: ReadonlyMap<string, number>,
): CompleteAxisPick[] {
  return recommendations.flatMap((item) => {
    const target = positiveNumber(item.target);
    const { cmp, source } = resolveAxisCmp(item, kiteBySymbol, yfinanceBySymbol);
    const computedUpsidePct = axisImpliedUpsidePct(target, cmp);
    if (target === null || cmp === null || source === null || computedUpsidePct === null) return [];
    return [{
      ...item,
      target,
      cmp,
      computedUpsidePct,
      cmpSource: source,
      upside: `${computedUpsidePct >= 0 ? "+" : ""}${computedUpsidePct.toFixed(1)}%`,
    }];
  });
}
