import type { LlmAssistTask } from "../local-llm-assist";
import type { WorkspaceKey } from "./types";

export type SatyaSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export type SatyaSuggestionCatalog = {
  workspace: WorkspaceKey;
  suggestions: SatyaSuggestion[];
  note?: string;
  placeholder?: string;
  hint?: string;
};

export type SatyaSuggestionOptions = {
  section?: string;
  subject?: string;
};

/** Grounded chip Ask: one Axis category, retrieved passages only. */
export function axisCategoryAskPrompt(label: string): string {
  const name = label.trim() || "this research category";
  return `Summarize this research category (${name}) from retrieved passages only. Ignore ads, CTAs, and promotions. Leave unpublished KPIs blank. Never invent figures.`;
}

export function isSatyaCorpusSuggestionPrompt(prompt: string, catalog: SatyaSuggestionCatalog): boolean {
  const text = prompt.trim();
  if (!text) return false;
  if (catalog.suggestions.some((item) => item.prompt === text)) return true;
  return text.startsWith("Summarize this research category (");
}

function prioritize(items: SatyaSuggestion[], leadIds: string[]): SatyaSuggestion[] {
  const lead = leadIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is SatyaSuggestion => Boolean(item));
  const rest = items.filter((item) => !leadIds.includes(item.id));
  return [...lead, ...rest];
}

/** One wording for Axis-picks / holdings commentary. Never invent CMP. */
export const NEVER_INVENT_CMP = "Never invent CMP, quantities, or unpublished KPIs.";

const INVESTMENT_SUGGESTIONS: SatyaSuggestion[] = [
  {
    id: "i1-research-actions",
    label: "I-1 research actions",
    prompt: "Which retrieved Axis Research, newsletter, or podcast notes should inform the Investment Action Board today? Research only — do not invent prices or quantities, and I am not asking you to place trades.",
  },
  {
    id: "i2-portfolio-research",
    label: "Portfolio-name research",
    prompt: "What did Axis Research and newsletters say about portfolio-relevant names in the retrieved passages? Treat workspace text as symbols only, never as prices or quantities. Unpublished KPIs stay blank.",
  },
  {
    id: "i3-risk-notes",
    label: "I-3 risk notes",
    prompt: `Flag retrieved downgrades, concentration, or cautionary notes that matter for Investment risk. ${NEVER_INVENT_CMP}`,
  },
  {
    id: "i4-axis-picks",
    label: "I-4 Axis picks",
    prompt: `Summarize Axis picks commentary from retrieved Axis Research only. Unpublished targets stay blank. ${NEVER_INVENT_CMP}`,
  },
  {
    id: "axis-picks-vs-holdings",
    label: "Axis picks vs holdings",
    prompt: `How do Axis Research conviction ideas and Axis picks compare with current holdings in the retrieved passages? Holdings are symbols only. ${NEVER_INVENT_CMP}`,
  },
];

function sectorSubject(subject?: string): string {
  const name = subject?.trim();
  return name || "the selected S-2 industry";
}

function sectorSatyaSuggestions(subject?: string): SatyaSuggestion[] {
  const industry = sectorSubject(subject);
  return [
    {
      id: "industry-research",
      label: "Industry research",
      prompt: `What do Axis Research and newsletters say about ${industry} constituents or rankings? Rankings stay on Sectoral Analytics. Use retrieved passages only. Do not invent prices or unpublished KPIs.`,
    },
    {
      id: "constituents-in-research",
      label: "Constituents in research",
      prompt: `Which retrieved research names overlap ${industry} constituents? Missing figures stay unpublished.`,
    },
    {
      id: "leaders-laggards-notes",
      label: "Leaders vs laggards notes",
      prompt: `Any retrieved Axis or newsletter notes on leaders or laggards in ${industry}? Do not invent returns. Snapshot ranks stay on S-2.`,
    },
    {
      id: "framework-watch-notes",
      label: "Framework watch notes",
      prompt: `What Axis Research or podcast notes speak to the Decision Framework watch items for ${industry}? Never invent index levels or replace the rule-based composite.`,
    },
    {
      id: "industry-caution",
      label: "Industry caution",
      prompt: `Flag retrieved downgrades or cautionary notes for ${industry}. No Market Intelligence digest promo and no Investment tickets.`,
    },
  ];
}

export const SATYA_BRIEFING_SUGGESTIONS: SatyaSuggestion[] = [
  {
    id: "overnight-themes",
    label: "Overnight newsletter themes",
    prompt: "What were the main overnight newsletter themes in the retrieved Newsletters? Ignore ads, CTAs, and promotions. Do not invent numbers.",
  },
  {
    id: "axis-vs-holdings",
    label: "Axis conviction vs holdings",
    prompt: "How do Axis Research conviction ideas compare with current holdings in the retrieved passages? Do not invent prices, quantities, or unpublished KPIs.",
  },
  {
    id: "podcast-axis-overlap",
    label: "Podcast vs Axis overlap",
    prompt: "Where do podcast summaries overlap with Axis Research? Treat transcript-derived items as transcripts and description-only items as descriptions. Do not invent quotes.",
  },
  {
    id: "what-changed",
    label: "What changed since last digest",
    prompt: "What changed across Newsletters, Axis Research, and podcast summaries in the retrieved window? If a prior comparison is not in the passages, say so. Do not invent missing items.",
  },
  {
    id: "axis-result-updates",
    label: "Axis result updates",
    prompt: "Summarize Axis Research result updates and company notes from the retrieved passages only. Leave unpublished KPIs blank. Never invent figures.",
  },
  {
    id: "verified-prints",
    label: "Verified earnings prints",
    prompt: "What did independently verified IR/NSE reported KPIs say? Unpublished fields stay blank. Calendar rows stay scheduling evidence only.",
  },
  {
    id: "cautionary-notes",
    label: "Cautionary notes across sources",
    prompt: "Flag risks, downgrades, or cautionary notes across Newsletters, Axis Research, podcasts, and verified earnings. Never invent prices or KPIs.",
  },
];

export const EARNINGS_SATYA_SUGGESTIONS: SatyaSuggestion[] = [
  {
    id: "verified-week",
    label: "Verified prints this week",
    prompt: "What did independently verified IR/NSE reported KPIs say this week? Unpublished fields stay blank. Calendar rows stay scheduling evidence only. Do not invent figures.",
  },
  {
    id: "unpublished-blank",
    label: "Unpublished stay blank",
    prompt: "Which retrieved earnings prints are still pending, and which KPI fields are unpublished? Leave those fields blank. Do not invent results.",
  },
  {
    id: "holdings-reported",
    label: "Holdings with prints",
    prompt: "Which retrieved verified earnings prints overlap current holdings symbols? Use only verified KPI values in the passages. Never invent prices or unpublished fields.",
  },
  {
    id: "holiday-conflicts",
    label: "Holiday conflicts",
    prompt: "If retrieved passages mention holiday conflicts on earnings dates, summarize them. Apple Calendar rows are scheduling evidence only, not proof a result was published.",
  },
  {
    id: "pending-upcoming",
    label: "Pending / upcoming",
    prompt: "Which retrieved earnings events are still pending or upcoming, and what is still unpublished? Do not fill KPI values that are blank.",
  },
  {
    id: "axis-result-updates",
    label: "Axis result updates",
    prompt: "Summarize Axis Research result updates and company notes from the retrieved passages only. Leave unpublished KPIs blank. Never invent figures.",
  },
];

const HEALTH_SUGGESTIONS: SatyaSuggestion[] = [
  {
    id: "h1-operational-notes",
    label: "H-1 operational notes",
    prompt: "Which retrieved research items are operational for today's My Feed Action Board? Editorial and research only — not biometric numbers and not trade tickets.",
  },
  {
    id: "h2-briefing-tone",
    label: "H-2 briefing tone",
    prompt: "Which retrieved newsletter or podcast notes are useful for today's Daily Optimism briefing tone? Research and editorial only — I am not asking for biometric KPIs.",
  },
  {
    id: "h3-briefing-notes",
    label: "H-3 briefing notes",
    prompt: "Which retrieved newsletter or Axis Research notes are useful context for today's My Feed briefing? Editorial and research only — not biometric numbers. Never invent unpublished KPIs.",
  },
  {
    id: "h4-calendar-research",
    label: "H-4 calendar research",
    prompt: "What retrieved Axis Research, newsletter, or verified earnings notes sit next to today's Calendar + Reminders? Calendar rows are scheduling evidence only. Do not invent unpublished KPIs.",
  },
];

const BUILDER_SUGGESTIONS: SatyaSuggestion[] = [
  {
    id: "nse-name-research",
    label: "NSE name research",
    prompt: "What did Axis Research and newsletters say about NSE names such as RELIANCE, TCS, or HDFCBANK? Use retrieved passages only. Do not invent prices. I am not asking you to draft or summarize a tree.",
  },
];

const STRATEGIES_SUGGESTIONS: SatyaSuggestion[] = [
  {
    id: "quality-momentum-notes",
    label: "Quality vs momentum notes",
    prompt: "What Axis Research or newsletter notes speak to quality versus momentum themes in the Strategies library? Do not invent backtest KPIs. Missing figures stay unpublished.",
  },
  {
    id: "library-name-overlap",
    label: "Library name overlap",
    prompt: "Which retrieved research names overlap public Strategies library ideas? Do not paste or reconstruct Composer trees. Never invent live KPI values.",
  },
  {
    id: "y2-compare-notes",
    label: "Y-2 compare notes",
    prompt: "Compare quality, momentum, and other library themes using retrieved Axis Research and newsletters only. Do not dump Composer trees and do not invent backtest figures.",
  },
  {
    id: "sleeve-caution",
    label: "Sleeve caution",
    prompt: "Flag retrieved downgrades or cautionary notes that apply to Strategies library sleeves. If a KPI is missing, say unpublished.",
  },
];

export function satyaSuggestionsForWorkspace(
  workspace: WorkspaceKey,
  options: SatyaSuggestionOptions = {},
): SatyaSuggestionCatalog {
  const section = options.section?.trim() ?? "";
  switch (workspace) {
    case "investment": {
      const lead = section === "i3"
        ? ["i3-risk-notes"]
        : section === "i4"
          ? ["i4-axis-picks", "axis-picks-vs-holdings"]
          : section === "i2"
            ? ["i2-portfolio-research"]
            : ["i1-research-actions"];
      return {
        workspace,
        suggestions: prioritize(INVESTMENT_SUGGESTIONS, lead),
        placeholder: "e.g. What did Axis Research say about Axis picks versus holdings symbols?",
        hint: "Investment language only. Grounded on Mail, Axis PDFs, podcasts, and verified earnings — not Health or canvas JSON.",
      };
    }
    case "sectors": {
      const items = sectorSatyaSuggestions(options.subject);
      const lead = section === "s3" ? ["framework-watch-notes"] : ["industry-research"];
      return {
        workspace,
        suggestions: prioritize(items, lead),
        placeholder: options.subject
          ? `e.g. What did Axis Research say about ${options.subject} constituents?`
          : "e.g. What did Axis Research say about the selected industry's constituents?",
        hint: "Sectoral Analytics language only. S-2 industries, Decision Framework, constituents, and rankings — no MI digest promo and no I-1 tickets.",
      };
    }
    case "intelligence": {
      const earningsLead = section === "m3";
      return {
        workspace,
        suggestions: earningsLead
          ? prioritize(
            [...EARNINGS_SATYA_SUGGESTIONS, ...SATYA_BRIEFING_SUGGESTIONS.filter((item) => (
              !EARNINGS_SATYA_SUGGESTIONS.some((earnings) => earnings.id === item.id)
            ))],
            ["verified-week", "verified-prints", "axis-result-updates"],
          )
          : SATYA_BRIEFING_SUGGESTIONS,
        placeholder: earningsLead
          ? "e.g. What did independently verified prints say this week?"
          : "e.g. What were the main overnight newsletter themes?",
        hint: "Market Intelligence only. Axis research categories, newsletters, podcasts, and verified earnings KPIs — no sector-dimming, Health, or builder trees.",
      };
    }
    case "health": {
      const lead = section === "h4"
        ? ["h4-calendar-research"]
        : section === "h3"
          ? ["h3-briefing-notes"]
          : section === "h2"
            ? ["h2-briefing-tone"]
            : ["h1-operational-notes"];
      return {
        workspace,
        suggestions: prioritize(HEALTH_SUGGESTIONS, lead),
        placeholder: "e.g. Which retrieved notes sit next to today's Calendar + Reminders?",
        hint: "My Feed language only. Satya will not answer biometric KPIs — use H-2/H-3/H-4 for those, and ask Satya only for Mail / Axis / podcast / earnings research.",
      };
    }
    case "builder":
      return {
        workspace,
        suggestions: BUILDER_SUGGESTIONS,
        note: "Satya chat will not draft or summarize canvas trees. Type a draft request for the canvas editor, or ask a Mail / Axis / podcast / earnings question Satya can retrieve.",
        placeholder: "e.g. What did Axis Research say about RELIANCE, TCS, or HDFCBANK?",
        hint: "Canvas language only. Smart Suggestions stay research-only. Typed prompts can still draft a StrategyTreeV1 for the editor.",
      };
    case "strategies":
      return {
        workspace,
        suggestions: STRATEGIES_SUGGESTIONS,
        placeholder: "e.g. What Axis Research notes speak to quality versus momentum library themes?",
        hint: "Strategies library / Y-2 compare language only. Satya will not reconstruct Composer trees.",
      };
    default: {
      const _exhaustive: never = workspace;
      return _exhaustive;
    }
  }
}

function taskWorkspace(task: LlmAssistTask): { workspace: WorkspaceKey; section?: string } {
  switch (task) {
    case "composite":
      return { workspace: "investment", section: "i4" };
    case "industry":
      return { workspace: "sectors", section: "s2" };
    case "framework":
      return { workspace: "sectors", section: "s3" };
    case "summarize":
    case "satya":
      return { workspace: "intelligence" };
    case "builder":
      return { workspace: "builder" };
    case "strategy":
      return { workspace: "strategies" };
    default: {
      const _exhaustive: never = task;
      return _exhaustive;
    }
  }
}

/** Assist-slot chips reuse the workspace catalog so Satya wording cannot drift. */
export function defaultSatyaSuggestions(task: LlmAssistTask): SatyaSuggestion[] {
  const { workspace, section } = taskWorkspace(task);
  return satyaSuggestionsForWorkspace(workspace, { section }).suggestions;
}
