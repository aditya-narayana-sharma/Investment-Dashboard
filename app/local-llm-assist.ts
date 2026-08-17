import { parseStrategyTree, type StrategyTreeV1 } from "../packages/contracts/src/strategy-tree.ts";

export const LLM_ASSIST_TASKS = [
  "summarize",
  "composite",
  "industry",
  "framework",
  "builder",
  "strategy",
] as const;

export type LlmAssistTask = (typeof LLM_ASSIST_TASKS)[number];

export function isLlmAssistTask(value: string): value is LlmAssistTask {
  switch (value) {
    case "summarize":
    case "composite":
    case "industry":
    case "framework":
    case "builder":
    case "strategy":
      return true;
    default:
      return false;
  }
}

export function llmAssistSystemPrompt(task: LlmAssistTask): string {
  switch (task) {
    case "summarize":
      return [
        "You draft machine-labelled research summaries for Stratji.",
        "Use only the supplied Mail, Podcast, or earnings evidence.",
        "Never invent prices, KPIs, transcripts, or unpublished earnings fields.",
        "Omit ads, sponsors, CTAs, phones, emails, and URLs.",
        "Return 3-6 short factual bullets. Label nothing as live unless the source says so.",
      ].join(" ");
    case "composite":
      return [
        "You comment on Stratji composite scores and analyst-matrix rows that are already computed.",
        "Do not change numeric scores or fabricate missing CMP/target/KPI values.",
        "Explain what the supplied scores imply. If a field is missing, say it is missing.",
        "Return 3-5 bullets. This is machine-drafted commentary, not a rating change.",
      ].join(" ");
    case "industry":
      return [
        "You comment on the supplied S-2 Industry Analytics snapshot only: selected industry, rankings, constituents, and EOD benchmarks.",
        "Do not use Mail, Podcasts, or earnings calendars.",
        "Never invent prices, KPIs, breadth counts, or index levels. Missing fields stay blank or unavailable.",
        "Return 3-6 bullets. This is machine-drafted commentary, not a source for numbers.",
      ].join(" ");
    case "framework":
      return [
        "You draft S-3 Decision Framework commentary from supplied PESTEL, Porter, investability, and benchmark evidence.",
        "Do not invent index levels or replace the rule-based composite.",
        "If evidence is missing, say unavailable. Return 4-6 bullets plus one allocate/monitor/reassess/avoid line that matches the supplied gate when present.",
      ].join(" ");
    case "builder":
      return [
        "You draft a Stratji Algorithm Canvas StrategyTreeV1 JSON document.",
        "Use only NSE/Nifty 500 style symbols (e.g. RELIANCE, TCS, HDFCBANK). Never US tickers.",
        "treeVersion must be \"1\". Allowed block kinds: asset, group, weight, if_else, any_all, filter.",
        "Return JSON only. If the user request cannot be expressed as a tree, return {\"error\":\"cannot_draft\"}.",
      ].join(" ");
    case "strategy":
      return [
        "You help develop Stratji Strategies library notes from the supplied tree or Composer card.",
        "Do not invent backtest KPIs. If a KPI is missing, write —.",
        "Return 4-6 bullets: idea, sleeves, risks, what to verify on Algorithm Canvas. Indian market only.",
      ].join(" ");
    default: {
      const _exhaustive: never = task;
      return _exhaustive;
    }
  }
}

export function extractJsonObject(text: string): unknown {
  const trimmed = String(text ?? "").trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const raw = (fenced?.[1] ?? trimmed).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model output did not include a JSON object.");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export function parseTreeFromLlmText(text: string): StrategyTreeV1 {
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Model output was not a tree object.");
  const record = parsed as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    throw new Error("The model could not draft a valid tree from that prompt.");
  }
  return parseStrategyTree(parsed);
}

export function parseBulletLines(text: string): string[] {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length >= 12 && !/^```/.test(line));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
    if (unique.length >= 8) break;
  }
  return unique;
}
