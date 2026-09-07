import type { DigestItem } from "./content-types";
import type { MacroBandKey, MacroEventKey } from "./dashboard/types";

type ScenarioEvidenceItem = Pick<DigestItem, "source" | "time" | "receivedAt" | "title" | "summary" | "bullets" | "sentiment">;

type ScenarioRule = {
  include: RegExp;
  exclude?: RegExp;
};

const scenarioRules: Record<MacroEventKey, Record<MacroBandKey, ScenarioRule>> = {
  oilWar: {
    supportive: {
      include: /\b(?:de[ -]?escalat|ceasefire|truce|peace talks?|diploma(?:cy|tic)|economic pressure|sanctions? pressure|avoid(?:ed|ing)? (?:a )?(?:strike|war|conflict)|no (?:new |fresh )?(?:strike|attack)|let .*pressure .* build|lower (?:oil|crude|brent)|oil prices? (?:fell|fall|declin|eas)|supply (?:relief|normalis|normaliz)|shipping (?:resum|normalis|normaliz))\b/i,
      exclude: /\b(?:launch(?:ed|ing)? (?:fresh )?(?:strike|attack)|hormuz (?:clos|block|disrupt)|shipping (?:halt|stop|block)|war (?:escalat|expand)|missile (?:strike|attack)|brent .*\b(?:100|110|120)\b)\b/i,
    },
    base: {
      include: /\b(?:controlled conflict|contained conflict|manageable (?:conflict|shock|damage)|headline shocks?|turbulence|geopolitical risk|war risk|sanctions?|russian crude|crude oil imports?|oil imports?|record high|supply remains?|risk premium|brent .*\b(?:7[8-9]|8\d|90)\b)\b/i,
      exclude: /\b(?:ceasefire|truce|hormuz (?:clos|block|disrupt)|shipping (?:halt|stop|block)|brent .*\b(?:100|110|120)\b)\b/i,
    },
    stress: {
      include: /\b(?:hormuz|shipping (?:halt|stop|block|disrupt)|strait (?:clos|block|disrupt)|supply (?:cut|shock|disrupt)|oil (?:shock|surge|spike)|crude (?:shock|surge|spike)|brent .*\b(?:100|110|120)\b|war (?:escalat|expand)|military strikes?|missile (?:strike|attack)|import costs? (?:surge|spike)|broad risk[ -]?off)\b/i,
      exclude: /\b(?:de[ -]?escalat|ceasefire|truce|peace talks?|diploma(?:cy|tic)|economic pressure|rather than launch|avoid(?:ed|ing)? (?:a )?(?:strike|war|conflict)|no (?:new |fresh )?(?:strike|attack))\b/i,
    },
  },
  flows: {
    supportive: { include: /\b(?:fii|fpi|foreign).{0,35}(?:inflow|net buy|buying|add)|\bforeign inflow\b/i },
    base: { include: /\b(?:dii|domestic).{0,35}(?:offset|absorb|buy)|\bmixed flows?\b|\bselective flow\b/i },
    stress: { include: /\b(?:fii|fpi|foreign).{0,35}(?:outflow|net sell|selling|exit)|\bpersistent outflow\b/i },
  },
  rates: {
    supportive: { include: /\b(?:rupee (?:stable|strength)|inr (?:stable|strength)|rate cut|yield(?:s)? (?:fell|fall|declin|eas)|inflation (?:fell|fall|declin|eas))\b/i },
    base: { include: /\b(?:rupee|inr|yield|bond|interest rate|inflation|monetary policy|rbi|fed)\b/i, exclude: /\b(?:currency crisis|rate shock|yield shock|rupee crash)\b/i },
    stress: { include: /\b(?:rupee (?:weak|fall|slid|crash)|inr (?:weak|fall)|rate hike|yield(?:s)? (?:rose|rise|surge|spike)|inflation (?:rose|rise|surge|spike)|currency[ -]?rate shock)\b/i },
  },
  breadth: {
    supportive: { include: /\b(?:broad participation|market breadth (?:improv|strength)|advance(?:r|s)? (?:lead|outnumber)|vix (?:fell|low)|volatility (?:fell|low))\b/i },
    base: { include: /\b(?:selective|mixed|narrow breadth|stock[ -]?specific|range[ -]?bound|market|nifty|sensex|volatility|vix)\b/i, exclude: /\b(?:risk[ -]?off|vix (?:surge|spike)|breadth (?:collapse|weak))\b/i },
    stress: { include: /\b(?:risk[ -]?off|vix (?:surge|spike|high)|breadth (?:collapse|weak|deteriorat)|market correction|sell[ -]?off)\b/i },
  },
  earnings: {
    supportive: { include: /\b(?:earnings?|results?|profit|revenue|margin|guidance).{0,45}(?:beat|upgrade|strong|growth|improv)|\bupgrade cycle\b/i },
    base: { include: /\b(?:mixed (?:earnings|results|evidence)|company selection|selective earnings|beat(?:s)? and miss(?:es)?|results?|earnings?)\b/i, exclude: /\b(?:downgrade cycle|broad misses|guidance cuts?)\b/i },
    stress: { include: /\b(?:earnings?|results?|profit|revenue|margin|guidance).{0,45}(?:miss|downgrade|cut|weak|declin)|\bdowngrade cycle\b/i },
  },
};

function itemText(item: ScenarioEvidenceItem): string {
  return [item.title, item.summary, ...(item.bullets ?? [])].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
}

function stableItemKey(item: ScenarioEvidenceItem): string {
  return `${item.receivedAt ?? item.time}|${item.source}|${item.title}`.toLowerCase();
}

function scenarioBandForItem(item: ScenarioEvidenceItem, eventKey: MacroEventKey): MacroBandKey | null {
  const text = itemText(item);
  const matches = (bandKey: MacroBandKey) => {
    const rule = scenarioRules[eventKey][bandKey];
    return rule.include.test(text) && !rule.exclude?.test(text);
  };
  // Stress/supportive phrases are directional; base is the residual matching
  // range. This makes a source item belong to no more than one scenario.
  if (matches("stress")) return "stress";
  if (matches("supportive")) return "supportive";
  if (matches("base")) return "base";
  return null;
}

export function scenarioEvidenceItems(
  items: ScenarioEvidenceItem[],
  eventKey: MacroEventKey,
  bandKey: MacroBandKey,
): ScenarioEvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = stableItemKey(item);
    if (seen.has(key) || scenarioBandForItem(item, eventKey) !== bandKey) return false;
    seen.add(key);
    return true;
  });
}

export function scenarioEvidenceSentence(
  item: ScenarioEvidenceItem,
  eventKey: MacroEventKey,
  bandKey: MacroBandKey,
): string {
  const rule = scenarioRules[eventKey][bandKey];
  const boilerplate = /(?:difficult to read|view in browser|unsubscribe|subscribe|follow us|contact us|click here|website|manage preferences|privacy policy|international cat day|autumnal ambassadors|must-read tech news)/i;
  const source = [...(item.bullets ?? []), item.summary, item.title].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
  const candidates = source.split(/(?<=[.!?])\s+(?=[A-Z“"'📊💡])/u).map((part) => part.trim().replace(/\.{2,}$/, "."));
  const sentence = candidates.find((part) => part.length > 28 && !boilerplate.test(part) && rule.include.test(part) && !rule.exclude?.test(part)) ?? "";
  if (!sentence) return "";
  return sentence.length > 180 ? `${sentence.slice(0, 177).trim()}…` : sentence;
}
