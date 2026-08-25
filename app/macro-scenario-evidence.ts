import type { DigestItem } from "./content-types";
import type { MacroBandKey, MacroEventKey } from "./dashboard/types";

export const MIN_SCENARIO_EVIDENCE = 4;
export const MAX_SCENARIO_EVIDENCE = 8;

export type ScenarioEvidenceKind = "mail" | "web" | "framework";
export type ScenarioRangeSupport = "supports-range" | "context";

export type ScenarioEvidenceItem = Pick<DigestItem, "source" | "time" | "receivedAt" | "title" | "summary" | "bullets" | "sentiment"> & {
  evidenceKind?: ScenarioEvidenceKind;
  url?: string;
};

export type ScenarioEvidenceCard = ScenarioEvidenceItem & {
  kind: ScenarioEvidenceKind;
  rangeSupport: ScenarioRangeSupport;
};

export type ScenarioFrameworkEvent = {
  label: string;
  evidence: string;
  sectors: string;
  trigger: string;
  bands: Record<MacroBandKey, { label: string; range: string; summary: string; action: string }>;
};

type ScenarioRule = {
  include: RegExp;
  exclude?: RegExp;
};

const kpiRules: Record<MacroEventKey, ScenarioRule> = {
  oilWar: {
    include: /\b(?:brent|wti|crude(?:\s+oil)?|opec|hormuz|iran|geopolit(?:ical|ics)?|lpg|petroleum|oil[- ]?(?:price|prices|import|imports|shock|supply|bill)|(?:imported|russian)\s+crude|oil)\b/i,
    exclude: /\b(?:maze of conflicts|data fortress|herbal extract|chicken surplus|poultry companies)\b/i,
  },
  flows: {
    include: /\b(?:fiis?|fpis?|diis?|foreign (?:investor|institutional|inflow|outflow)|institutional (?:investor|flow)|net (?:buy|sell)|passive flow|\bmsci\b|healthy flows?|dollar-?deposit|fcnr)\b/i,
  },
  rates: {
    include: /\b(?:rupee|\binr\b|forex|fx reserve|bond yield|10y|gilt|g-sec|monetary policy|\brbi\b|fed funds|rate cut|rate hike|interest rate|\bcpi\b|\bwpi\b|inflation|\bcurrency\b)/i,
    exclude: /\bcryptocurrency\b/i,
  },
  breadth: {
    include: /\b(?:breadth|india(?:n)? vix|\bvix\b|volatility|mid-?caps?|small-?caps?|risk-?off|market correction|technical outlook|trade setup|\bnifty(?:50)?\b|\bsensex\b|advance(?:r|s)?[- ]declin)/i,
  },
  earnings: {
    include: /\b(?:earnings?|result updates?|\bq[1-4]fy?\d{0,2}\b|annual analysis|annual report|financial performance|\bguidance\b|\bpat\b|\brevenue\b|\bprofit\b|sector rotation|\bmargin(?:s)?\b)/i,
    exclude: /\b(?:cuddly mascot|must-read tech news|college major)\b/i,
  },
};

const scenarioRules: Record<MacroEventKey, Record<MacroBandKey, ScenarioRule>> = {
  oilWar: {
    supportive: {
      include: /\b(?:de[ -]?escalat|ceasefire|truce|peace talks?|diploma(?:cy|tic)|economic pressure|sanctions? pressure|avoid(?:ed|ing)? (?:a )?(?:strike|war|conflict)|no (?:new |fresh )?(?:strike|attack)|let .*pressure .* build|lower (?:oil|crude|brent)|(?:oil|crude|brent) (?:prices? )?(?:fell|fall|declin|eas|cool)|crude cools|supply (?:relief|normalis|normaliz)|shipping (?:resum|normalis|normaliz)|brent .*\b(?:70|7[1-5])\b)\b/i,
      exclude: /\b(?:launch(?:ed|ing)? (?:fresh )?(?:strike|attack)|hormuz (?:clos|block|disrupt)|shipping (?:halt|stop|block)|war (?:escalat|expand)|missile (?:strike|attack)|brent .*\b(?:100|110|120)\b)\b/i,
    },
    base: {
      include: /\b(?:controlled conflict|contained conflict|manageable (?:conflict|shock|damage)|headline shocks?|turbulence|geopolitical risk|war risk|sanctions?|russian crude|crude oil imports?|oil imports?|record high|supply remains?|risk premium|brent .*\b(?:7[8-9]|8\d|90)\b)\b/i,
      exclude: /\b(?:ceasefire|truce|hormuz (?:clos|block|disrupt)|shipping (?:halt|stop|block)|brent .*\b(?:100|110|120)\b)\b/i,
    },
    stress: {
      include: /\b(?:hormuz|shipping (?:halt|stop|block|disrupt)|strait (?:clos|block|disrupt)|oil (?:shock|surge|spike)|crude (?:shock|surge|spike)|brent .*\b(?:100|110|120)\b|war (?:escalat|expand)|military strikes?|missile (?:strike|attack)|import costs? (?:surge|spike)|broad risk[ -]?off|lpg plan)\b/i,
      exclude: /\b(?:de[ -]?escalat|ceasefire|truce|peace talks?|diploma(?:cy|tic)|economic pressure|rather than launch|avoid(?:ed|ing)? (?:a )?(?:strike|war|conflict)|no (?:new |fresh )?(?:strike|attack)|crude cools)\b/i,
    },
  },
  flows: {
    supportive: { include: /\b(?:fiis?|fpis?|foreign).{0,40}(?:inflow|net buy|buying|bought|add)|foreign inflow|healthy (?:foreign )?flows?\b/i },
    base: { include: /\b(?:diis?|domestic).{0,40}(?:offset|absorb|buy|hold the fort)|\bmixed flows?\b|\bselective flow\b|fii.{0,24}dii|dii.{0,24}fii/i },
    stress: { include: /\b(?:fiis?|fpis?|foreign).{0,40}(?:outflow|net sell|selling|sold|exit|keep selling)|\bpersistent outflow\b/i },
  },
  rates: {
    supportive: { include: /\b(?:rupee (?:stable|strength)|inr (?:stable|strength)|rate cut|yield(?:s)? (?:fell|fall|declin|eas)|inflation (?:fell|fall|declin|eas)|forex reserves? rose|wpi (?:fell|fall|declin))\b/i },
    base: { include: /\b(?:rupee|\binr\b|yield|bond|interest rate|inflation|monetary policy|\brbi\b|forex|fed)\b/i, exclude: /\b(?:currency crisis|rate shock|yield shock|rupee crash)\b/i },
    stress: { include: /\b(?:rupee (?:weak|fall|slid|crash|decline)|inr (?:weak|fall)|rapid decline in the rupee|rate hike|yield(?:s)? (?:rose|rise|surge|spike)|inflation (?:rose|rise|surge|spike)|bonds? fell|currency[ -]?rate shock|less rupee liquidity)\b/i },
  },
  breadth: {
    supportive: { include: /\b(?:broad participation|market breadth (?:improv|strength)|advance(?:r|s)? (?:lead|outnumber)|vix (?:fell|low)|volatility (?:fell|low)|markets? (?:rose|closed higher)|nifty (?:rose|closed higher))\b/i },
    base: { include: /\b(?:selective|mixed|narrow breadth|stock[ -]?specific|range[ -]?bound|indecision|doji|trade setup|technical outlook|\bnifty\b|\bsensex\b|volatility|\bvix\b)\b/i, exclude: /\b(?:risk[ -]?off|vix (?:surge|spike)|breadth (?:collapse|weak)|mild(?:ly)? bearish)\b/i },
    stress: { include: /\b(?:risk[ -]?off|vix (?:surge|spike|high)|breadth (?:collapse|weak|deteriorat)|market correction|sell[ -]?off|mild(?:ly)? bearish|markets? closed lower|nifty (?:closed )?(?:lower|down))\b/i },
  },
  earnings: {
    supportive: { include: /\b(?:earnings?|results?|profit|revenue|margin|guidance|pat).{0,45}(?:beat|upgrade|strong|growth|improv)|\bupgrade cycle\b|\bmaintain(?:ed)? (?:our )?buy\b|\bstrong (?:performance|recovery|execution)\b/i },
    base: { include: /\b(?:mixed (?:earnings|results|evidence)|company selection|selective earnings|beat(?:s)? and miss(?:es)?|result updates?|earnings?)\b/i, exclude: /\b(?:downgrade cycle|broad misses|guidance cuts?)\b/i },
    stress: { include: /\b(?:earnings?|results?|profit|revenue|margin|guidance|pre-sales).{0,45}(?:miss|downgrade|cut|weak|declin)|\bdowngrade cycle\b|\bcut our\b/i },
  },
};

const bandOrder: MacroBandKey[] = ["stress", "supportive", "base"];

export function itemText(item: ScenarioEvidenceItem): string {
  return [item.title, item.summary, ...(item.bullets ?? [])].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
}

export function stableItemKey(item: ScenarioEvidenceItem): string {
  const title = String(item.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const day = item.receivedAt
    ? String(item.receivedAt).slice(0, 10)
    : (String(item.time ?? "").match(/^\d{1,2}\s+\w+/)?.[0] ?? String(item.time ?? "")).toLowerCase();
  return `${item.source}|${title}|${day}`.toLowerCase();
}

function matchesRule(text: string, rule: ScenarioRule): boolean {
  rule.include.lastIndex = 0;
  if (rule.exclude) rule.exclude.lastIndex = 0;
  return rule.include.test(text) && !rule.exclude?.test(text);
}

export function kpiEvidenceItems(items: ScenarioEvidenceItem[], eventKey: MacroEventKey): ScenarioEvidenceItem[] {
  const rule = kpiRules[eventKey];
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = stableItemKey(item);
    if (seen.has(key)) return false;
    const text = itemText(item).replace(/\bwar chest\b/gi, "");
    if (!matchesRule(text, rule)) return false;
    seen.add(key);
    return true;
  });
}

export function scenarioBandForItem(item: ScenarioEvidenceItem, eventKey: MacroEventKey): MacroBandKey | null {
  const text = itemText(item);
  const rules = scenarioRules[eventKey];
  for (const bandKey of bandOrder) {
    const rule = rules[bandKey];
    if (rule && matchesRule(text, rule)) return bandKey;
  }
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

function cardKind(item: ScenarioEvidenceItem): ScenarioEvidenceKind {
  if (item.evidenceKind) return item.evidenceKind;
  if (/^framework note$/i.test(item.source)) return "framework";
  return "mail";
}

export function frameworkEvidenceItems(event: ScenarioFrameworkEvent, bandKey: MacroBandKey): ScenarioEvidenceCard[] {
  const band = event.bands[bandKey];
  const rows: Array<{ time: string; title: string; summary: string }> = [
    { time: "Decision range", title: `${band.label} · ${band.range}`, summary: band.summary },
    { time: "Transmission", title: `${event.label} transmission`, summary: event.evidence },
    { time: "Sectors", title: "Relative sector transmission", summary: event.sectors },
    { time: "Response", title: "Framework response", summary: band.action },
    { time: "Trigger", title: "Watch trigger", summary: event.trigger },
  ];
  return rows.map((row) => ({
    source: "Framework note",
    time: row.time,
    title: row.title,
    summary: row.summary,
    kind: "framework",
    rangeSupport: "context",
    evidenceKind: "framework",
  }));
}

/**
 * Optional precision layer. Keys are `stableItemKey`; a present entry overrides
 * the regex band verdict for that item, an absent one leaves it untouched. See
 * `macro-evidence-ranking.ts` for how entries are validated and grounded.
 */
export type ScenarioBandOverrides = ReadonlyMap<string, { band: MacroBandKey | null; relevance: number }>;

/** Regex verdict unless a validated override exists for this exact item. */
export function resolveScenarioBand(
  item: ScenarioEvidenceItem,
  eventKey: MacroEventKey,
  overrides?: ScenarioBandOverrides,
): MacroBandKey | null {
  const override = overrides?.get(stableItemKey(item));
  return override ? override.band : scenarioBandForItem(item, eventKey);
}

export function assembleScenarioEvidence(
  items: ScenarioEvidenceItem[],
  eventKey: MacroEventKey,
  bandKey: MacroBandKey,
  framework: ScenarioFrameworkEvent,
  overrides?: ScenarioBandOverrides,
): ScenarioEvidenceCard[] {
  const pool = kpiEvidenceItems(items, eventKey);
  const exclusive: Array<{ card: ScenarioEvidenceCard; relevance: number }> = [];
  const leftover: ScenarioEvidenceCard[] = [];
  for (const item of pool) {
    // An item supports at most one band, so cross-band exclusivity holds by
    // construction for both the regex and the ranked path.
    const band = resolveScenarioBand(item, eventKey, overrides);
    const card: ScenarioEvidenceCard = {
      ...item,
      kind: cardKind(item),
      rangeSupport: band === bandKey ? "supports-range" : "context",
    };
    if (band === bandKey) {
      exclusive.push({ card, relevance: overrides?.get(stableItemKey(item))?.relevance ?? 0 });
    } else if (band === null) {
      leftover.push(card);
    }
  }
  // Strongest support first when a ranking supplied relevance; otherwise the
  // pool's existing recency order is preserved (all relevances equal).
  exclusive.sort((left, right) => right.relevance - left.relevance);

  const cards: ScenarioEvidenceCard[] = [];
  const seen = new Set<string>();
  const take = (card: ScenarioEvidenceCard) => {
    const key = `${card.kind}|${stableItemKey(card)}`;
    if (seen.has(key) || cards.length >= MAX_SCENARIO_EVIDENCE) return;
    seen.add(key);
    cards.push(card);
  };
  exclusive.forEach((entry) => take(entry.card));
  leftover.forEach(take);
  if (cards.length < MIN_SCENARIO_EVIDENCE) {
    for (const note of frameworkEvidenceItems(framework, bandKey)) {
      if (cards.length >= MIN_SCENARIO_EVIDENCE) break;
      take(note);
    }
  }
  return cards;
}

function extractiveSentence(source: string, include: RegExp, exclude?: RegExp): string {
  const boilerplate = /(?:difficult to read|view in browser|unsubscribe|subscribe|follow us|contact us|click here|website|manage preferences|privacy policy|international cat day|autumnal ambassadors|must-read tech news)/i;
  const candidates = source.split(/(?<=[.!?])\s+(?=[A-Z“"'📊💡])/u).map((part) => part.trim().replace(/\.{2,}$/, "."));
  const sentence = candidates.find((part) => part.length > 28 && !boilerplate.test(part) && include.test(part) && !exclude?.test(part)) ?? "";
  if (!sentence) return "";
  return sentence.length > 180 ? `${sentence.slice(0, 177).trim()}…` : sentence;
}

export function scenarioEvidenceSentence(
  item: ScenarioEvidenceItem,
  eventKey: MacroEventKey,
  bandKey: MacroBandKey,
): string {
  if (cardKind(item) === "framework") {
    const text = (item.summary || item.title).replace(/\s+/g, " ").trim();
    return text.length > 180 ? `${text.slice(0, 177).trim()}…` : text;
  }
  const rule = scenarioRules[eventKey][bandKey];
  const source = [...(item.bullets ?? []), item.summary, item.title].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
  const ranged = extractiveSentence(source, rule.include, rule.exclude);
  if (ranged) return ranged;
  const kpi = kpiRules[eventKey];
  return extractiveSentence(source, kpi.include, kpi.exclude);
}

export function evidenceCardLabel(item: ScenarioEvidenceCard): string {
  const kind = item.kind === "framework" ? "Framework note" : item.kind === "web" ? "Web source" : "Mail";
  const support = item.rangeSupport === "supports-range" ? "supports this range" : "context · not a range proof";
  return `${kind} · ${support} · ${item.source} · ${item.time}`;
}
