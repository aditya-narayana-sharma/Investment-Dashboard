import type { LlmAssistTask } from "../local-llm-assist";

export type SatyaSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

/** Grounded chip Ask: one Axis category, retrieved passages only. */
export function axisCategoryAskPrompt(label: string): string {
  const name = label.trim() || "this research category";
  return `Summarize this research category (${name}) from retrieved passages only. Ignore ads, CTAs, and promotions. Leave unpublished KPIs blank. Never invent figures.`;
}

export function defaultSatyaSuggestions(task: LlmAssistTask): SatyaSuggestion[] {
  switch (task) {
    case "composite":
      return [
        {
          id: "target-vs-buy",
          label: "Target achieved vs BUY",
          prompt: "What stands out in Target achieved versus active BUY rows in the supplied analyst matrix? Do not invent CMP or targets. Missing fields stay missing.",
        },
        {
          id: "hold-watch",
          label: "HOLD rows to watch",
          prompt: "Which supplied HOLD rows look most important to monitor, and why? Do not change composite scores or invent missing CMP/targets.",
        },
        {
          id: "leaders-laggards",
          label: "Leaders vs laggards",
          prompt: "Compare Performance Leaders and Laggards using only supplied rows. If a CMP or target is missing, say it is missing.",
        },
        {
          id: "trading-technical",
          label: "Trading vs Technical BUY",
          prompt: "How do supplied Trading BUY and Technical BUY rows differ from plain BUY? Do not invent prices or unpublished targets.",
        },
        {
          id: "missing-fields",
          label: "Missing CMP / targets",
          prompt: "Which supplied analyst-matrix rows are missing CMP or target, and what does that imply for the commentary? Never fill missing numbers.",
        },
      ];
    case "industry":
      return [
        {
          id: "vs-nifty",
          label: "vs Nifty 50",
          prompt: "How does the selected industry compare with Nifty 50 using only the supplied snapshot and EOD benchmarks? Do not invent index levels. If a level is missing, say unavailable.",
        },
        {
          id: "breadth",
          label: "Session breadth",
          prompt: "Summarize advancers vs decliners and median 1M return from the supplied industry snapshot only. Missing quotes stay blank.",
        },
        {
          id: "leaders-laggards",
          label: "Leaders vs laggards",
          prompt: "Who are the supplied leaders and laggards? Use only supplied rank values. Do not invent returns or KPIs.",
        },
        {
          id: "composite-pulse",
          label: "Composite vs pulse",
          prompt: "What do the supplied composite score and pulse imply? Do not change scores or invent missing KPIs.",
        },
        {
          id: "owned-names",
          label: "Owned names",
          prompt: "Which supplied constituents are marked owned, and what does the supplied P&L say? Do not invent quantities or prices.",
        },
      ];
    case "framework":
      return [
        {
          id: "gate-change",
          label: "Monitor → allocate",
          prompt: "What supplied evidence would need to change for this gate to move from monitor to allocate? Do not replace the rule-based composite or invent index levels.",
        },
        {
          id: "closest-trigger",
          label: "Closest macro trigger",
          prompt: "Which supplied macro trigger is closest to a sizing change? Trigger distance is context, not an automatic trade. Missing levels stay unavailable.",
        },
        {
          id: "vs-benchmarks",
          label: "Vs selected indices",
          prompt: "How does this sector compare to the selected EOD benchmarks using only supplied levels and returns? Delayed series stay delayed.",
        },
        {
          id: "evidence-watch",
          label: "Evidence vs watch",
          prompt: "Restate the supplied evidence, monitor, and invalidation lines. If a factor is unavailable, say unavailable.",
        },
        {
          id: "missing-levels",
          label: "Unavailable levels",
          prompt: "Which supplied benchmark or factor values are unavailable, and how should that constrain the commentary? Never invent levels.",
        },
      ];
    case "summarize":
      return [
        {
          id: "overnight-themes",
          label: "Overnight themes",
          prompt: "What were the main overnight newsletter themes in the supplied digest? Ignore ads, CTAs, and promotions. Do not invent numbers.",
        },
        {
          id: "axis-vs-holdings",
          label: "Axis vs holdings",
          prompt: "How do Axis Research conviction ideas compare with current holdings in the supplied digest? Do not invent prices, quantities, or unpublished KPIs.",
        },
        {
          id: "podcast-overlap",
          label: "Podcast overlap",
          prompt: "Where do podcast summaries overlap with Axis Research? Treat transcript-derived items as transcripts and description-only items as descriptions. Do not invent quotes.",
        },
        {
          id: "verified-prints",
          label: "Verified prints",
          prompt: "What did independently verified reported KPIs say? Unpublished fields stay blank. Calendar rows stay scheduling evidence only.",
        },
        {
          id: "cautionary",
          label: "Cautionary notes",
          prompt: "Flag risks, downgrades, or cautionary notes in the supplied evidence. Never invent prices or KPIs.",
        },
      ];
    case "builder":
      return [
        {
          id: "core-satellite",
          label: "Core-satellite sleeve",
          prompt: "Draft a StrategyTreeV1 core-satellite with an HDFCBANK quality sleeve. Use only NSE-style symbols. Return JSON only. If it cannot be expressed as a tree, return {\"error\":\"cannot_draft\"}.",
        },
        {
          id: "reliance-gate",
          label: "RELIANCE trend gate",
          prompt: "Draft a StrategyTreeV1 with a RELIANCE trend If/Else gate over an equal-weight quality sleeve. Indian market only. Return JSON only.",
        },
        {
          id: "equal-weight",
          label: "Equal-weight names",
          prompt: "Draft a StrategyTreeV1 that equal-weights a small NSE sleeve (TCS, INFY, HDFCBANK). treeVersion must be \"1\". Return JSON only.",
        },
        {
          id: "any-all-filter",
          label: "Any/All quality filter",
          prompt: "Draft a StrategyTreeV1 that uses any_all plus a filter block for a quality sleeve. No US tickers. Return JSON only.",
        },
        {
          id: "invalid-json",
          label: "Keep canvas if invalid",
          prompt: "If this request cannot be a valid StrategyTreeV1, return {\"error\":\"cannot_draft\"} so the canvas stays as-is. Do not invent backtest KPIs.",
        },
      ];
    case "strategy":
      return [
        {
          id: "quality-momentum",
          label: "Quality vs momentum",
          prompt: "Compare quality vs momentum sleeves in the supplied public library. Missing KPIs stay —. Do not invent backtest figures.",
        },
        {
          id: "verify-canvas",
          label: "Verify on canvas",
          prompt: "What should be verified on Algorithm Canvas for the top supplied cards? Missing KPIs stay —. Indian market only.",
        },
        {
          id: "mine-vs-public",
          label: "Mine vs public",
          prompt: "How do My library trees differ from the supplied public cards? Do not invent live KPI values.",
        },
        {
          id: "risks",
          label: "Sleeve risks",
          prompt: "List idea, sleeves, and risks for the supplied library cards. If a KPI is missing, write —.",
        },
        {
          id: "indian-only",
          label: "Indian market only",
          prompt: "Which supplied notes assume Indian-market symbols, and what would you verify before editing on Algorithm Canvas? Never invent KPIs.",
        },
      ];
    case "satya":
      return [];
    default: {
      const _exhaustive: never = task;
      return _exhaustive;
    }
  }
}
