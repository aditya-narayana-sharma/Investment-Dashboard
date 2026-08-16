import { CircleDollarSign, GitBranch, HeartPulse, Layers3, Newspaper } from "lucide-react";
import { axisResearchDigest, earningsCalendar, newsletterDigest, podcastNotes, type EarningsEvent } from "../portfolio-data";
import {
  healthActions,
  healthCategories,
  healthSources,
  type HealthAveragePeriod,
  type HealthMetric,
} from "../health-data";
import { healthTargetDateKey } from "../health-date-policy";
import type { HealthLiveSnapshot } from "../health-live-types";
import type { ContentDigestSnapshot } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import type { LiveHolding } from "../live-types";
import { sectorCompanies } from "../sector-company-data";
import { earningsEventDateKey } from "../earnings-verify";
import { calendarSchedulingMetadata, exactEarningsCalendarItems } from "../calendar-earnings";
import type { MacroBandKey, MacroEventKey, KanbanItem, KanbanWorkspace, WorkspaceKey, DonutLabelProps } from "./types";

export const DIGEST_PAGE_SIZE = 40;

export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
export const analysisDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const currentIstDateKey = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const currentIstDateLabel = () => analysisDay.format(new Date(`${currentIstDateKey()}T12:00:00+05:30`));

export const sectorSearchTerms: Record<string, string[]> = {
  pharma: ["pharma", "healthcare", "drug", "hospital", "diagnostic", "cipla", "sun pharma", "lupin"],
  power: ["power", "utility", "utilities", "renewable", "electricity", "ntpc", "adani green", "jsw energy"],
  infrastructure: ["infrastructure", "infra", "realty", "construction", "epc", "cement", "larsen", "l&t"],
  auto: ["auto", "automobile", "vehicle", "ev", "maruti", "mahindra", "tata motors", "bajaj auto"],
  telecom: ["telecom", "wireless", "broadband", "tower", "airtel", "vodafone idea"],
  banking: ["bank", "banking", "hdfc", "icici", "axis bank", "kotak", "sbi", "federal bank"],
  nbfc: ["nbfc", "finance", "lending", "microfinance", "bajaj finance", "shriram", "muthoot"],
  fmcg: ["fmcg", "staples", "consumer goods", "hul", "itc", "nestle", "britannia", "dabur"],
  consumer: ["consumer", "retail", "e-commerce", "ecommerce", "quick commerce", "eternal", "zomato", "titan", "trent"],
  energy: ["energy", "oil", "gas", "refining", "upstream", "ongc", "reliance", "bpcl", "ioc"],
  defence: ["defence", "defense", "aerospace", "hal", "bel", "mazdock", "bdl", "shipyard", "drone", "missile"],
};

export function matchesSelectedSector(sectorId: string, ...values: Array<string | undefined>) {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  const companyTerms = (sectorCompanies[sectorId] ?? []).flatMap((company) => [company.symbol.toLowerCase(), company.name.toLowerCase()]);
  return [...(sectorSearchTerms[sectorId] ?? [sectorId]), ...companyTerms].some((term) => haystack.includes(term.toLowerCase()));
}

export function analysisWindowLabel(content: ContentDigestSnapshot) {
  const start = new Date(`${content.investment.analysisWindowStart}T12:00:00+05:30`);
  const end = new Date(`${content.investment.analysisDate}T12:00:00+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "current analysis window";
  return content.investment.analysisWindowStart === content.investment.analysisDate
    ? analysisDay.format(end)
    : `${analysisDay.format(start)}–${analysisDay.format(end)}`;
}

/** Outer-ring gain palette — always index with modulo so 6+ holdings never render black. */
export const gainShades = ["#0f704f", "#178c61", "#23a472", "#39b785", "#63c99e", "#4db88a", "#2d9b6c"];
export const LOSS_FILL = "#c33f47";

/** Live holding outer-ring fill: green shades for unrealised gain, red for loss. */
export function holdingOuterFill(pnl: number, index: number) {
  if (pnl < 0) return LOSS_FILL;
  return gainShades[index % gainShades.length] ?? gainShades[0];
}

export const RADIAN = Math.PI / 180;
export const fallbackContent: ContentDigestSnapshot = {
  status: "unavailable",
  asOf: "Bundled fallback · refresh required",
  newsletters: newsletterDigest,
  axisResearch: axisResearchDigest.map((item) => ({ ...item, source: "Axis Research" })),
  podcasts: podcastNotes.map(([source, summary, bullets], index) => ({ source, title: "Latest captured episode", summary, bullets, time: String(index + 1).padStart(2, "0") })),
  reminders: [],
  calendar: [],
  healthNote: null,
  investment: {
    policy: "Static research fallback. Refresh Mail before using investment analysis.",
    analysisWindowStart: currentIstDateKey(),
    analysisDate: currentIstDateKey(),
    axisLookbackDays: 3,
    axisTradingAsOf: currentIstDateKey(),
    axisTradingAsOfLabel: currentIstDateKey(),
    axisUsedLastTradingDay: false,
    latestAxisAt: "Unavailable",
    latestNewsletterAt: "Unavailable",
    axisRecommendations: [],
    axisTargetAchievements: [],
    macroEvidence: ["oilWar", "flows", "rates", "breadth", "earnings"].map((key) => ({ key: key as MacroEventKey, count: 0, latestTitle: "Mail unavailable", latestAt: "—", items: [] })),
  },
  sources: {
    newsletters: { status: "error", count: newsletterDigest.length, displayedCount: newsletterDigest.length },
    axisResearch: { status: "error", count: axisResearchDigest.length },
    podcasts: { status: "error", count: podcastNotes.length },
    reminders: { status: "error", count: 0 },
    calendar: { status: "error", count: 0 },
    healthNote: { status: "error", count: 0 },
  },
};

export const fallbackEarnings: EarningsSnapshot = {
  status: "stale",
  asOf: "Bundled fallback",
  analysisDate: currentIstDateLabel(),
  events: earningsCalendar,
  message: "Using the last bundled earnings calendar until the earnings refresh endpoint responds.",
};

const EARNINGS_TICKER_ALIASES: Record<string, string> = {
  TVSMOTORS: "TVSMOTOR",
  BAJAJAUTO: "BAJAJ-AUTO",
  LTFINANCE: "LTF",
  LTFH: "LTF",
  ULTRATECH: "ULTRACEMCO",
  ULTRATECHCEM: "ULTRACEMCO",
  ADANIGREENENERGY: "ADANIGREEN",
  INFOSYS: "INFY",
  TATACONSUMER: "TATACONSUM",
  BANKOFBARODA: "BANKBARODA",
  BOB: "BANKBARODA",
  HINDUSTANAEORONAUTICS: "HAL",
  BHARATELECTRONICS: "BEL",
  BHARATDYNAMICS: "BDL",
  MAZAGONDOCK: "MAZDOCK",
};

function titleCaseWords(value: string) {
  return value
    .split(/[\s_/]+/)
    .filter(Boolean)
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

function normalizeEarningsTicker(raw: string) {
  const cleaned = raw.replace(/\.(NS|BO|NSE|BSE)$/i, "").replace(/[^A-Za-z0-9&-]/g, "").toUpperCase();
  if (!cleaned) return "";
  return EARNINGS_TICKER_ALIASES[cleaned] ?? cleaned;
}

/** Build symbol → company name lookup from the curated calendar and sector universes. */
export function earningsCompanyDirectory(existing: Array<{ symbol: string; name: string }> = earningsCalendar) {
  const bySymbol = new Map<string, string>();
  const byName = new Map<string, { symbol: string; name: string }>();
  const remember = (symbol: string, name: string) => {
    const ticker = normalizeEarningsTicker(symbol);
    if (!ticker || !name.trim()) return;
    if (!bySymbol.has(ticker)) bySymbol.set(ticker, name.trim());
    byName.set(name.trim().toLowerCase(), { symbol: ticker, name: name.trim() });
  };
  for (const event of existing) remember(event.symbol, event.name);
  for (const companies of Object.values(sectorCompanies)) {
    for (const company of companies) remember(company.symbol, company.name);
  }
  return { bySymbol, byName };
}

/**
 * Resolve a calendar/earnings title into a proper NSE-style ticker and company name.
 * Never invent opaque codes like CAL-1.
 */
export function resolveEarningsIdentity(title: string, existing: Array<{ symbol: string; name: string }> = earningsCalendar) {
  const directory = earningsCompanyDirectory(existing);
  const raw = title.trim();
  const tickerHit = raw.match(/\b([A-Za-z][A-Za-z0-9&-]{1,20})(?:\.(?:NS|BO|NSE|BSE))?\b/g) ?? [];
  for (const token of tickerHit) {
    const ticker = normalizeEarningsTicker(token);
    const knownName = directory.bySymbol.get(ticker);
    if (knownName) return { symbol: ticker, name: knownName };
  }

  const haystack = raw.toLowerCase();
  for (const [nameKey, identity] of directory.byName) {
    if (nameKey.length >= 4 && haystack.includes(nameKey)) return identity;
  }

  const cleanedName = raw
    .replace(/\b(q[1-4]\s*(fy)?\s*\d{0,4}|fy\s*\d{2,4}|results?|earnings|concall|conference\s*call|investor\s*call|board\s*meeting|unaudited|financials?)\b/gi, " ")
    .replace(/\.(NS|BO|NSE|BSE)\b/gi, " ")
    .replace(/[|/–—_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fallbackName = cleanedName || raw;
  const maybeTicker = normalizeEarningsTicker(fallbackName.replace(/\s+/g, ""));
  if (maybeTicker && directory.bySymbol.has(maybeTicker)) {
    return { symbol: maybeTicker, name: directory.bySymbol.get(maybeTicker)! };
  }
  if (/^[A-Z0-9&-]{2,15}$/.test(maybeTicker) && !/\s/.test(fallbackName)) {
    return { symbol: maybeTicker, name: titleCaseWords(maybeTicker.replace(/-/g, " ")) };
  }
  const symbol = maybeTicker && maybeTicker.length >= 2 && maybeTicker.length <= 15
    ? maybeTicker
    : fallbackName.split(/\s+/).map((word) => word[0] ?? "").join("").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "EVENT";
  return { symbol, name: titleCaseWords(fallbackName) };
}

export function earningsEventMonthLabel(dateLabel: string) {
  const match = dateLabel.trim().match(/\d{1,2}\s+([A-Za-z]{3,})/);
  return (match?.[1] ?? "Jul").slice(0, 3).toUpperCase();
}

/** Convert every row from the exact Earnings calendar into pending scheduling evidence. */
export function calendarEarningsEvents(content: ContentDigestSnapshot, existing: EarningsEvent[]): EarningsEvent[] {
  const events: EarningsEvent[] = [];
  for (const item of exactEarningsCalendarItems(content.calendar)) {
    const identity = resolveEarningsIdentity(item.title, existing);
    const schedule = calendarSchedulingMetadata(item);
    const dateKey = schedule.dateKey;
    if (!dateKey) continue;
    const dateAtNoon = new Date(`${dateKey}T12:00:00+05:30`);
    const day = dateKey.slice(8, 10);
    const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(dateAtNoon);
    const banking = /bank|finance|nbfc|insurance/i.test(`${identity.name} ${item.title}`);
    const technology = /tech|software|digital|infosys|tcs|wipro/i.test(`${identity.name} ${item.title}`);
    const kpiLabels = banking
      ? ["PAT", "NII / income", "Asset quality", "Margin / credit cost"]
      : technology
        ? ["Revenue / CC growth", "Operating margin", "Deal wins", "Guidance"]
        : ["Revenue", "Profit", "Operating margin", "Management guidance"];
    events.push({
      date,
      dateKey,
      day,
      symbol: identity.symbol,
      name: identity.name,
      state: "Pending · Apple Calendar",
      portfolio: false,
      period: schedule.period,
      reported: schedule.reported,
      kpis: kpiLabels.map((label) => ({ label, value: "", change: "" })),
      summary: item.notes || "Calendar event imported from Apple Calendar. KPI fields remain blank until a cited company or exchange result is available.",
      calendarEventId: schedule.calendarEventId,
      eventKind: schedule.eventKind,
    });
  }
  return events;
}

export function canonicalEarningsSymbol(raw: string) {
  return normalizeEarningsTicker(raw);
}

export function mergeEarningsCalendarEvents(snapshot: EarningsSnapshot, content: ContentDigestSnapshot, holdings: LiveHolding[] = []): EarningsEvent[] {
  const baseEvents = snapshot.events.length ? snapshot.events : earningsCalendar;
  const held = new Set(holdings.map((holding) => canonicalEarningsSymbol(holding.symbol)));
  const hasLiveHoldingIdentity = holdings.length > 0;
  const analysisDate = snapshot.analysisDate || currentIstDateKey();
  const deduplicated = new Map<string, EarningsEvent[]>();

  for (const event of [...baseEvents, ...calendarEarningsEvents(content, baseEvents)]) {
    const symbol = canonicalEarningsSymbol(event.symbol);
    const dateKey = earningsEventDateKey(event, analysisDate) ?? event.date;
    const eventKind = event.eventKind ?? "results";
    const key = `${symbol}|${eventKind}|${dateKey}`;
    const normalized = { ...event, symbol, eventKind, portfolio: hasLiveHoldingIdentity ? held.has(symbol) : event.portfolio };
    const candidates = deduplicated.get(key) ?? [];
    const period = normalized.period.trim().toLowerCase();
    const duplicateIndex = candidates.findIndex((candidate) => {
      const candidatePeriod = candidate.period.trim().toLowerCase();
      return candidatePeriod === period || candidatePeriod === "latest quarter" || period === "latest quarter";
    });
    if (duplicateIndex < 0) {
      deduplicated.set(key, [...candidates, normalized]);
      continue;
    }
    const previous = candidates[duplicateIndex]!;
    const preferred = (!previous.reported && normalized.reported) || (!previous.source && normalized.source)
      ? normalized
      : previous;
    candidates[duplicateIndex] = {
      ...preferred,
      dateKey: preferred.dateKey ?? normalized.dateKey ?? previous.dateKey,
      calendarEventId: preferred.calendarEventId ?? normalized.calendarEventId ?? previous.calendarEventId,
    };
    deduplicated.set(key, candidates);
  }

  return [...deduplicated.values()].flat().sort((left, right) => {
    const leftDate = earningsEventDateKey(left, analysisDate) ?? left.date;
    const rightDate = earningsEventDateKey(right, analysisDate) ?? right.date;
    return leftDate.localeCompare(rightDate) || left.symbol.localeCompare(right.symbol);
  });
}

export function earningsReconciliationStats(
  snapshot: EarningsSnapshot,
  content: ContentDigestSnapshot,
  holdings: LiveHolding[] = [],
  mergedEvents = mergeEarningsCalendarEvents(snapshot, content, holdings),
) {
  const calendarEvents = calendarEarningsEvents(content, snapshot.events.length ? snapshot.events : earningsCalendar);
  const baseEvents = mergeEarningsCalendarEvents(snapshot, { ...content, calendar: [] }, holdings);
  const analysisDate = snapshot.analysisDate || currentIstDateKey();
  const baseKeys = new Set(baseEvents.map((event) => (
    `${canonicalEarningsSymbol(event.symbol)}|${event.eventKind ?? "results"}|${earningsEventDateKey(event, analysisDate) ?? event.date}`
  )));
  const reconciledCalendarEvents = mergedEvents.filter((event) => event.calendarEventId);
  const updated = reconciledCalendarEvents.filter((event) => baseKeys.has(
    `${canonicalEarningsSymbol(event.symbol)}|${event.eventKind ?? "results"}|${earningsEventDateKey(event, analysisDate) ?? event.date}`,
  )).length;
  const rawCalendarRows = content.calendar.filter((item) => item.calendar.trim().toLowerCase() === "earnings").length;
  return {
    discovered: rawCalendarRows,
    newlyAdded: reconciledCalendarEvents.length - updated,
    updated,
    deduplicated: Math.max(rawCalendarRows - calendarEvents.length, 0) + Math.max(baseEvents.length + calendarEvents.length - mergedEvents.length, 0),
    verifiedReported: mergedEvents.filter((event) => event.reported).length,
    pendingUpcoming: mergedEvents.filter((event) => !event.reported).length,
  };
}

export const fallbackHealth: HealthLiveSnapshot = {
  schemaVersion: 1,
  status: "stale",
  source: "Apple Health",
  dataDate: "2026-07-16",
  capturedAt: "2026-07-17T03:10:00+05:30",
  message: "No newer iPhone HealthKit snapshot has reached this Mac. Showing the last directly verified capture.",
  categories: healthCategories,
  sources: healthSources.map((item) => ({ ...item, status: "Stale", tone: "amber" as const })),
  actions: healthActions as HealthLiveSnapshot["actions"],
};
export const exposureFactors = [
  { key: "oilWar", label: "Oil / war", group: "EVENT", color: "#df6651" },
  { key: "fiiFlow", label: "FII / flow", group: "EVENT", color: "#d8942f" },
  { key: "valuation", label: "Valuation", group: "KPI", color: "#7659c8" },
  { key: "liquidity", label: "Liquidity", group: "KPI", color: "#2563a6" },
  { key: "volatility", label: "Volatility", group: "KPI", color: "#21a5b5" },
  { key: "leverage", label: "Leverage / execution", group: "KPI", color: "#3fa36c" },
] as const;

export type ExposureFactorKey = (typeof exposureFactors)[number]["key"];
export type ExposureDriverTone = "positive" | "neutral" | "negative";

export type ExposureDriverBullet = {
  key: ExposureFactorKey;
  label: string;
  detail: string;
  score: number;
  value: string;
  tone: ExposureDriverTone;
};

type ExposureContextSpec = {
  events: Array<{ key: "oilWar" | "fiiFlow"; label: string; detail: string }>;
  kpis: Array<{ key: "valuation" | "liquidity" | "volatility" | "leverage"; label: string; detail: string }>;
};

/** Higher monitoring score = more pressure to watch (negative); lower = supportive. */
export function exposureDriverTone(score: number): ExposureDriverTone {
  if (score <= 2) return "positive";
  if (score >= 4) return "negative";
  return "neutral";
}

export const exposureContext: Record<string, ExposureContextSpec> = {
  ICICIBANK: {
    events: [
      { key: "oilWar", label: "Oil / inflation", detail: "INR, imported inflation and yield spillover" },
      { key: "fiiFlow", label: "FII selling", detail: "Foreign selling into liquid private banks" },
    ],
    kpis: [
      { key: "valuation", label: "NIM", detail: "Net interest margin vs deposit cost" },
      { key: "liquidity", label: "Deposits", detail: "CASA mix and franchise stickiness" },
      { key: "volatility", label: "Credit cost", detail: "Provisions and slippage risk" },
      { key: "leverage", label: "Asset quality", detail: "GNPA / restructured book" },
    ],
  },
  ETERNAL: {
    events: [
      { key: "oilWar", label: "Fuel / logistics", detail: "Delivery cost and discretionary demand" },
      { key: "fiiFlow", label: "Index / risk-off", detail: "Growth multiple under foreign selling" },
    ],
    kpis: [
      { key: "valuation", label: "QC margin", detail: "Quick-commerce unit economics" },
      { key: "liquidity", label: "Order growth", detail: "Order frequency and AOV" },
      { key: "volatility", label: "Valuation", detail: "Duration multiple vs cash burn" },
      { key: "leverage", label: "Cash runway", detail: "Working capital and burn" },
    ],
  },
  BHARTIARTL: {
    events: [
      { key: "oilWar", label: "Tariff cycle", detail: "ARPU resets and competitive intensity" },
      { key: "fiiFlow", label: "Institutional appetite", detail: "Foreign ownership and index weight" },
    ],
    kpis: [
      { key: "valuation", label: "ARPU", detail: "Blended ARPU trajectory" },
      { key: "liquidity", label: "Subscribers", detail: "Postpaid mix and churn" },
      { key: "volatility", label: "Capex", detail: "Spectrum and 5G spend cadence" },
      { key: "leverage", label: "Net debt", detail: "Leverage vs cash conversion" },
    ],
  },
  AETHER: {
    events: [
      { key: "oilWar", label: "Crude feedstock", detail: "Input cost and freight shock" },
      { key: "fiiFlow", label: "FX / geopolitics", detail: "Export demand and supply-chain risk" },
    ],
    kpis: [
      { key: "valuation", label: "Gross margin", detail: "Pass-through of feedstock costs" },
      { key: "liquidity", label: "Utilisation", detail: "Plant load and order book" },
      { key: "volatility", label: "Working capital", detail: "Inventory and receivable days" },
      { key: "leverage", label: "Balance sheet", detail: "Debt service under margin squeeze" },
    ],
  },
  JSWENERGY: {
    events: [
      { key: "oilWar", label: "Rates / power demand", detail: "Discount rate and merchant tariffs" },
      { key: "fiiFlow", label: "Project flow", detail: "Institutional risk appetite for capex" },
    ],
    kpis: [
      { key: "valuation", label: "Net debt", detail: "Project leverage vs contracted cash" },
      { key: "liquidity", label: "Capacity adds", detail: "Commissioning and COD milestones" },
      { key: "volatility", label: "Interest cost", detail: "Rate sensitivity of project debt" },
      { key: "leverage", label: "Execution", detail: "Build-out vs guidance" },
    ],
  },
  ADANIGREEN: {
    events: [
      { key: "oilWar", label: "Rates / grid demand", detail: "Funding cost and offtake policy" },
      { key: "fiiFlow", label: "Policy execution", detail: "Renewable allocation and FII risk tone" },
    ],
    kpis: [
      { key: "valuation", label: "Net debt", detail: "Project gearing vs cash conversion" },
      { key: "liquidity", label: "Commissioning", detail: "MW COD vs guidance" },
      { key: "volatility", label: "CUF", detail: "Plant load factor delivery" },
      { key: "leverage", label: "Cash conversion", detail: "Collections and interest cover" },
    ],
  },
  AXISBANK: {
    events: [
      { key: "oilWar", label: "Oil / inflation", detail: "INR, imported inflation and yield spillover" },
      { key: "fiiFlow", label: "FII selling", detail: "Foreign selling into liquid private banks" },
    ],
    kpis: [
      { key: "valuation", label: "NIM", detail: "Net interest margin vs deposit cost" },
      { key: "liquidity", label: "Deposits", detail: "CASA mix and franchise stickiness" },
      { key: "volatility", label: "Credit cost", detail: "Provisions and slippage risk" },
      { key: "leverage", label: "Asset quality", detail: "GNPA / restructured book" },
    ],
  },
  LTF: {
    events: [
      { key: "oilWar", label: "Rates / credit cycle", detail: "Funding cost and retail credit demand" },
      { key: "fiiFlow", label: "AUM growth", detail: "Retail AUM under flow / risk-off" },
    ],
    kpis: [
      { key: "valuation", label: "NIM + fees", detail: "Spread and fee income mix" },
      { key: "liquidity", label: "RoE", detail: "Return on equity vs leverage" },
      { key: "volatility", label: "Credit cost", detail: "Stage-2/3 and write-offs" },
      { key: "leverage", label: "Disbursements", detail: "Origination vs collection quality" },
    ],
  },
};

const defaultExposureContext: ExposureContextSpec = {
  events: [
    { key: "oilWar", label: "Oil / war", detail: "Company and macro event transmission" },
    { key: "fiiFlow", label: "FII / flow", detail: "Institutional flow and risk appetite" },
  ],
  kpis: [
    { key: "valuation", label: "Valuation", detail: "Earnings multiple and durability" },
    { key: "liquidity", label: "Liquidity", detail: "Trading depth and balance-sheet liquidity" },
    { key: "volatility", label: "Volatility", detail: "Price and earnings volatility" },
    { key: "leverage", label: "Leverage", detail: "Balance-sheet and execution risk" },
  ],
};

function toExposureBullet(
  spec: { key: ExposureFactorKey; label: string; detail: string },
  rawScores: Record<string, number>,
): ExposureDriverBullet {
  const score = Math.max(1, Math.min(5, Number(rawScores[spec.key] ?? 3)));
  return {
    key: spec.key,
    label: spec.label,
    detail: spec.detail,
    score,
    value: `${score.toFixed(0)}/5`,
    tone: exposureDriverTone(score),
  };
}

export function buildExposureDrivers(symbol: string, rawScores: Record<string, number>) {
  const spec = exposureContext[symbol] ?? defaultExposureContext;
  const eventBullets = spec.events.map((item) => toExposureBullet(item, rawScores));
  const kpiBullets = spec.kpis.map((item) => toExposureBullet(item, rawScores));
  return {
    event: eventBullets.map((item) => item.detail).join("; "),
    kpis: kpiBullets.map((item) => item.label).join(", "),
    eventBullets,
    kpiBullets,
  };
}

export const macroEvents: Record<MacroEventKey, {
  label: string;
  shortLabel: string;
  evidence: string;
  sectors: string;
  trigger: string;
  bands: Record<MacroBandKey, { label: string; range: string; tone: "green" | "amber" | "red"; summary: string; leaders: string; laggards: string; action: string }>;
}> = {
  oilWar: {
    label: "Crude + geopolitics", shortLabel: "Oil / war", evidence: "Import bill, INR and inflation are the principal India transmission channels.", sectors: "Support: telecom, domestic power · Pressure: chemicals, transport, discretionary", trigger: "Escalate controls if Brent remains above $90 for two weeks.",
    bands: {
      supportive: { label: "De-escalation", range: "Brent $70-75", tone: "green", summary: "Lower imported inflation and a steadier rupee support domestic risk appetite.", leaders: "Eternal, banks, chemicals", laggards: "Defensives may trail", action: "Use staged additions within target weights." },
      base: { label: "Controlled conflict", range: "Brent $78-90", tone: "amber", summary: "Elevated volatility with manageable earnings damage and repeated headline shocks.", leaders: "Airtel, ICICI Bank", laggards: "Aether, Eternal on risk-off days", action: "Stagger additions; monitor INR, yields and FII persistence." },
      stress: { label: "Hormuz disruption", range: "Brent $100-120", tone: "red", summary: "Import costs, inflation, INR and yields create a broad India risk-off shock.", leaders: "Airtel; domestic contracted power", laggards: "Aether, Eternal, leveraged growth", action: "Preserve liquidity and avoid high-beta additions." },
    },
  },
  flows: {
    label: "FII / DII flows", shortLabel: "Flows", evidence: "Persistent FII selling first affects liquid index weights and high-duration growth multiples.", sectors: "FII-sensitive: private banks, internet, telecom · DII cushion: quality large caps", trigger: "Use five-session cumulative cash flows, not one provisional print.",
    bands: {
      supportive: { label: "Foreign inflow", range: "5D FII > +₹5,000cr", tone: "green", summary: "Broad foreign buying supports index liquidity and valuation rerating.", leaders: "Private banks, telecom, internet", laggards: "Cash-like defensives", action: "Add only where earnings confirmation matches flows." },
      base: { label: "Domestic absorption", range: "5D FII ±₹5,000cr", tone: "amber", summary: "DII buying offsets uneven foreign participation; leadership stays selective.", leaders: "Quality large caps", laggards: "Crowded mid/small caps", action: "Track breadth and avoid treating index stability as broad strength." },
      stress: { label: "Persistent outflow", range: "5D FII < -₹5,000cr", tone: "red", summary: "Liquid index weights and high-duration growth absorb the first de-risking wave.", leaders: "Domestic defensives", laggards: "Banks, internet, high-beta growth", action: "Reduce addition size until selling and breadth stabilise." },
    },
  },
  rates: {
    label: "INR + rates", shortLabel: "INR / rates", evidence: "A weaker rupee raises imported inflation while higher yields compress equity duration.", sectors: "Potential offset: IT/pharma exporters · Pressure: leveraged and import-intensive businesses", trigger: "Re-underwrite leverage when INR weakness and bond yields rise together.",
    bands: {
      supportive: { label: "Stable currency", range: "INR ≤84 · 10Y <6.5%", tone: "green", summary: "Benign currency and discount-rate conditions support domestic valuation multiples.", leaders: "Growth, consumers, banks", laggards: "Export hedges", action: "Prioritise company earnings over macro hedges." },
      base: { label: "Watch zone", range: "INR 84-86 · 10Y 6.5-7.0%", tone: "amber", summary: "Imported inflation and valuation pressure remain manageable but require monitoring.", leaders: "IT/pharma exporters", laggards: "Leveraged, import-intensive names", action: "Test interest cover, pricing power and FX sensitivity." },
      stress: { label: "Currency-rate shock", range: "INR >86 · 10Y >7.0%", tone: "red", summary: "A weaker rupee and rising yields jointly pressure earnings and valuation.", leaders: "Net exporters", laggards: "Leveraged power, discretionary, chemicals", action: "Raise balance-sheet quality thresholds before adding." },
    },
  },
  breadth: {
    label: "Breadth + volatility", shortLabel: "Breadth / VIX", evidence: "Narrow breadth can hide corrections beneath stable headline indices.", sectors: "Prefer earnings-backed leaders · Reduce reliance on momentum-only signals", trigger: "Pause additions when breadth weakens alongside rising India VIX.",
    bands: {
      supportive: { label: "Broad participation", range: "A/D >60% · VIX <14", tone: "green", summary: "More stocks participate and volatility remains contained.", leaders: "Mid caps, cyclicals, growth", laggards: "Low-beta defensives", action: "Allow measured risk while respecting position caps." },
      base: { label: "Selective tape", range: "A/D 40-60% · VIX 14-18", tone: "amber", summary: "Headline indices can hold while stock-level outcomes diverge.", leaders: "Earnings-backed large caps", laggards: "Weak-balance-sheet momentum", action: "Require price breadth plus earnings confirmation." },
      stress: { label: "Risk-off breadth", range: "A/D <40% · VIX >18", tone: "red", summary: "Falling participation and rising volatility increase concentration risk.", leaders: "Cash, defensives", laggards: "Mid/small caps and crowded themes", action: "Pause additions and protect liquidity." },
    },
  },
  earnings: {
    label: "Earnings + rotation", shortLabel: "Earnings", evidence: "Margins, guidance and cash conversion determine whether sector leadership persists.", sectors: "Reward upgrades and cash flow · Penalise leverage, misses and guidance cuts", trigger: "Update decisions after each reported KPI set, not only price reaction.",
    bands: {
      supportive: { label: "Upgrade cycle", range: ">60% tracked results beat", tone: "green", summary: "Broad beats and guidance upgrades validate sector leadership.", leaders: "Upgraded sectors and cash generators", laggards: "Unchanged defensives", action: "Add where valuation still supports the revised earnings path." },
      base: { label: "Mixed evidence", range: "40-60% tracked results beat", tone: "amber", summary: "Company selection matters more than broad sector narratives.", leaders: "Margin and cash-flow beaters", laggards: "Guidance misses", action: "Re-rank holdings after every official release." },
      stress: { label: "Downgrade cycle", range: "<40% tracked results beat", tone: "red", summary: "Misses and guidance cuts weaken the case for high valuation multiples.", leaders: "Balance-sheet defensives", laggards: "Leveraged and richly valued names", action: "Cut unsupported assumptions and wait for estimate stability." },
    },
  },
};

export const kanbanItems: Record<KanbanWorkspace, KanbanItem[]> = {
  investment: [
    { id: "inv-kite", title: "Refresh Kite and validate holdings", detail: "Reconcile holdings, positions, orders and GTTs before acting on allocation.", numericAdvantage: "100% live-position coverage", strategicAdvantage: "Prevents stale portfolio decisions", lane: "today", tone: "blue" },
    { id: "inv-concentration", title: "Review top-two concentration", detail: "Use new capital to dilute concentration before adding to the largest positions.", numericAdvantage: "Target <65% top-two weight", strategicAdvantage: "Improves shock resilience", lane: "today", tone: "amber" },
    { id: "inv-macro", title: "Monitor oil, INR and institutional flows", detail: "Apply the macro triggers before increasing high-beta exposure.", numericAdvantage: "5 regime signals", strategicAdvantage: "Links macro evidence to action", lane: "monitor", tone: "red" },
    { id: "inv-earnings", title: "Update post-result theses", detail: "Replace pending KPI fields only after official results are published.", numericAdvantage: "4 KPIs per event", strategicAdvantage: "Reduces narrative bias", lane: "monitor", tone: "green" },
  ],
  sectors: [
    { id: "sec-breadth", title: "Refresh sector breadth and rankings", detail: "Validate prices, horizons and constituent coverage across all tracked sectors.", numericAdvantage: "11 sector universes", strategicAdvantage: "Separates broad leadership from single-stock moves", lane: "today", tone: "blue" },
    { id: "sec-kpis", title: "Check sector KPI freshness", detail: "Review each metric's source date before using it in allocation decisions.", numericAdvantage: "30 numeric KPI cards", strategicAdvantage: "Makes stale evidence visible", lane: "today", tone: "green" },
    { id: "sec-framework", title: "Run the selected sector through frameworks", detail: "Use PESTEL, Porter, life-cycle and market-structure evidence together before forming a sector stance.", numericAdvantage: "4 independent lenses", strategicAdvantage: "Reduces one-factor conclusions", lane: "monitor", tone: "amber" },
    { id: "sec-earnings", title: "Fill pending earnings KPIs", detail: "Keep unpublished values blank and populate only from official releases.", numericAdvantage: "0 fabricated values", strategicAdvantage: "Preserves research integrity", lane: "monitor", tone: "red" },
  ],
  intelligence: [
    { id: "intel-mail", title: "Refresh exact Mail intelligence sources", detail: "Reconcile every item from iCloud Newsletters and Axis Research before using the digest.", numericAdvantage: "2 exact mailbox scopes", strategicAdvantage: "Prevents misfiled evidence", lane: "today", tone: "blue" },
    { id: "intel-calendar", title: "Reconcile Calendar and Reminders", detail: "Merge current events and incomplete actions without treating schedules as published results.", numericAdvantage: "2 action sources", strategicAdvantage: "Separates plans from evidence", lane: "today", tone: "green" },
    { id: "intel-earnings", title: "Monitor reported earnings evidence", detail: "Promote KPI rows only after company, exchange, or validated research evidence is available.", numericAdvantage: "0 inferred result fields", strategicAdvantage: "Protects decision quality", lane: "monitor", tone: "amber" },
    { id: "intel-podcasts", title: "Review Podcast freshness and coverage", detail: "Use local transcripts when available and label description-only summaries explicitly.", numericAdvantage: "30-minute refresh", strategicAdvantage: "Keeps evidence provenance clear", lane: "monitor", tone: "red" },
  ],
  health: [
    { id: "health-sync", title: "Verify the operational Health target", detail: "After the 8 PM cutoff, confirm the newest archive advances the target date and the dashboard badge changes to SYNCED.", numericAdvantage: "8 PM date roll", strategicAdvantage: "Keeps the wellness record auditable", lane: "today", tone: "blue" },
    { id: "health-averages", title: "Reconcile weekly and monthly averages", detail: "Show trends only where a complete comparison window is available.", numericAdvantage: "7-day + 30-day baselines", strategicAdvantage: "Avoids overreading one day", lane: "today", tone: "green" },
    { id: "health-sleep", title: "Resolve cross-app sleep variance", detail: "Keep Apple Health primary and retain Guava as a separate comparison.", numericAdvantage: "2-source reconciliation", strategicAdvantage: "Prevents incompatible totals being merged", lane: "monitor", tone: "amber" },
    { id: "health-diary", title: "Complete nutrition diary", detail: "Treat logged intake as incomplete until all meals and portions are entered.", numericAdvantage: "100% meal coverage target", strategicAdvantage: "Improves nutrition signal quality", lane: "monitor", tone: "red" },
  ],
  builder: [
    { id: "builder-validate", title: "Validate the strategy tree", detail: "Confirm Weight percents, If/Else operands and compiled StrategyGraphV2 before paper or broker preview.", numericAdvantage: "0 invalid trees", strategicAdvantage: "Blocks broken logic from leaving the canvas", lane: "today", tone: "blue" },
    { id: "builder-asset", title: "Add Indian assets on the tree", detail: "Use Add a Block → Asset. Resolve symbols against live Kite holdings and watchlist, not a static US list.", numericAdvantage: "Holdings ∪ watchlist", strategicAdvantage: "Keeps the sleeve on real NSE instruments", lane: "today", tone: "green" },
    { id: "builder-export", title: "Export the tree plus compiled graph", detail: "Save StrategyTreeV1 with compiled schemaVersion 2 before switching machines or sessions.", numericAdvantage: "Round-trip identical tree", strategicAdvantage: "Protects canvas work from session loss", lane: "monitor", tone: "amber" },
    { id: "builder-else", title: "Fill or accept an empty ELSE", detail: "If/Else THEN can hold assets; empty ELSE is allowed and warned. Do not draw wires.", numericAdvantage: "THEN / ELSE wells", strategicAdvantage: "Completes the condition without a flowchart", lane: "monitor", tone: "red" },
  ],
  strategies: [
    { id: "strat-review", title: "Review the nine NSE library trees", detail: "Open a card to read the full vertical tree before sending it to Algorithm Canvas.", numericAdvantage: "9 NSE ETF trees", strategicAdvantage: "Keeps research scoped to Indian-listed sleeves", lane: "today", tone: "blue" },
    { id: "strat-stats", title: "Do not treat empty OOS tiles as live alpha", detail: "Library KPIs stay em dash until an Indian-market engine run exists. Composer US figures are not copied.", numericAdvantage: "— until ran", strategicAdvantage: "Prevents fabricated performance", lane: "today", tone: "green" },
    { id: "strat-market", title: "Confirm every leaf is a Nifty 500 name", detail: "Sleeves use RELIANCE, TCS, HDFCBANK, INFY, ITC and other official NSE constituent names. No SPY/TQQQ/SOXL.", numericAdvantage: "NSE only", strategicAdvantage: "Keeps Stratji on Indian markets", lane: "monitor", tone: "amber" },
    { id: "strat-open", title: "Open one tree in Algorithm Canvas", detail: "Deep-link a reconstruction into the tree editor when you want to edit. The library stays read-only.", numericAdvantage: "?view=builder&section=canvas&tree=", strategicAdvantage: "Edits stay on the canvas, not in Health or Sectors", lane: "monitor", tone: "red" },
  ],
};

export const workspaces: Array<{ key: WorkspaceKey; label: string; note: string; icon: typeof CircleDollarSign }> = [
  { key: "investment", label: "Investment", note: "Portfolio, macro and research", icon: CircleDollarSign },
  { key: "sectors", label: "Sectoral Analytics", note: "Sectors, frameworks and earnings", icon: Layers3 },
  { key: "intelligence", label: "Market Intelligence", note: "Mail, calendar and podcasts", icon: Newspaper },
  { key: "health", label: "Health & Wellness", note: "Private local wellness", icon: HeartPulse },
  { key: "builder", label: "Algorithm Canvas", note: "Nested tree and JSON", icon: GitBranch },
  { key: "strategies", label: "Strategies", note: "Public Composer trees", icon: GitBranch },
];

export function number(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function labelPoint({ cx, cy, midAngle, innerRadius, outerRadius }: DonutLabelProps, radialPosition = 0.5) {
  const inner = number(innerRadius);
  const radius = inner + (number(outerRadius) - inner) * radialPosition;
  return {
    x: number(cx) + radius * Math.cos(-number(midAngle) * RADIAN),
    y: number(cy) + radius * Math.sin(-number(midAngle) * RADIAN),
  };
}

export function healthTrendTone(metric: HealthMetric, direction: "up" | "down" | "same") {
  if (direction === "same") return "moderate";
  const higherIsGenerallyFavourable = new Set([
    "Active energy", "Exercise minutes", "Stand", "Stand time", "Steps", "Walking + running", "Stairs climbed",
    "Time asleep", "Deep sleep", "REM sleep", "Core sleep", "Cardio recovery", "Cardio fitness",
    "Walking speed", "Step length", "Protein", "Fibre", "Potassium", "Water", "HRV",
  ]);
  const lowerIsGenerallyFavourable = new Set([
    "Resting heart rate", "Walking asymmetry", "Double support", "Awake", "Sodium", "Sugar", "Saturated fat",
  ]);
  if (higherIsGenerallyFavourable.has(metric.label)) return direction === "up" ? "good" : "bad";
  if (lowerIsGenerallyFavourable.has(metric.label)) return direction === "down" ? "good" : "bad";
  return "moderate";
}

/** Direction-row bucket for Vital Metrics — reuses healthTrendTone; unavailable when the selected average is missing. */
export type HealthDirectionBucket = "good" | "moderate" | "bad" | "unavailable";

/** Visible H-3 rows only — unavailable averages render inside Context dependent, not a fourth group. */
export const HEALTH_DIRECTION_COLUMNS: Array<{
  id: Exclude<HealthDirectionBucket, "unavailable">;
  title: string;
  shortLabel: string;
  className: string;
}> = [
  { id: "good", title: "Favourable direction", shortLabel: "Favourable", className: "direction-good" },
  { id: "moderate", title: "Context dependent", shortLabel: "Context", className: "direction-moderate" },
  { id: "bad", title: "Unfavourable direction", shortLabel: "Unfavourable", className: "direction-bad" },
];

export function healthMetricDirectionBucket(
  metric: HealthMetric,
  averagePeriod: HealthAveragePeriod,
): HealthDirectionBucket {
  const average = metric.averages?.[averagePeriod];
  if (!average) return "unavailable";
  return healthTrendTone(metric, average.direction);
}

/** Stable Health category order for deterministic row packing (Body Measurements / Hearing excluded). */
export const HEALTH_CATEGORY_ORDER = [
  "Activity",
  "Sleep",
  "Heart",
  "Respiratory",
  "Mindfulness",
  "Mobility",
  "Nutrition",
] as const;

const EXCLUDED_HEALTH_CATEGORIES = new Set(["Body Measurements", "Hearing", "Body measurements", "Medications", "Medication"]);

export function healthCategoryAccentClass(categoryName: string): string {
  switch (categoryName) {
    case "Heart":
      return "health-cat-heart";
    case "Activity":
      return "health-cat-activity";
    case "Nutrition":
      return "health-cat-nutrition";
    case "Respiratory":
    case "Mindfulness":
      return "health-cat-respiratory";
    case "Sleep":
      return "health-cat-sleep";
    case "Mobility":
      return "health-cat-mobility";
    default:
      return "health-cat-other";
  }
}

export type HealthDirectionMetricEntry = {
  categoryName: string;
  categoryAccent: string;
  metric: HealthMetric;
  categoryIndex: number;
  metricIndex: number;
};

/** Flatten enabled Health categories into direction rows with stable category→metric order. */
export function groupHealthMetricsByDirection(
  categories: Array<{ name: string; metrics: HealthMetric[] }>,
  averagePeriod: HealthAveragePeriod,
): Record<HealthDirectionBucket, HealthDirectionMetricEntry[]> {
  const columns: Record<HealthDirectionBucket, HealthDirectionMetricEntry[]> = {
    good: [],
    moderate: [],
    bad: [],
    unavailable: [],
  };
  const ranked = categories
    .filter((category) => !EXCLUDED_HEALTH_CATEGORIES.has(category.name))
    .map((category, fallbackIndex) => {
      const orderIndex = HEALTH_CATEGORY_ORDER.indexOf(category.name as typeof HEALTH_CATEGORY_ORDER[number]);
      return { category, categoryIndex: orderIndex < 0 ? HEALTH_CATEGORY_ORDER.length + fallbackIndex : orderIndex };
    })
    .sort((left, right) => left.categoryIndex - right.categoryIndex || left.category.name.localeCompare(right.category.name));

  const seen = new Set<string>();
  for (const { category, categoryIndex } of ranked) {
    const accent = healthCategoryAccentClass(category.name);
    category.metrics.forEach((metric, metricIndex) => {
      const identity = `${category.name}::${metric.label.trim().toLowerCase()}`;
      if (seen.has(identity)) return;
      seen.add(identity);
      const bucket = healthMetricDirectionBucket(metric, averagePeriod);
      columns[bucket].push({
        categoryName: category.name,
        categoryAccent: accent,
        metric,
        categoryIndex,
        metricIndex,
      });
    });
  }
  return columns;
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function latestCompletedHealthDateKey() {
  return healthTargetDateKey();
}

export function missingHealthDateKeys(dataDate: string, requiredDate = latestCompletedHealthDateKey()) {
  const start = new Date(`${dataDate}T12:00:00`);
  const end = new Date(`${requiredDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return [];
  const dates: string[] = [];
  for (const date = new Date(start); date < end;) {
    date.setDate(date.getDate() + 1);
    dates.push(localDateKey(date));
  }
  return dates;
}

export function compactHealthDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}
