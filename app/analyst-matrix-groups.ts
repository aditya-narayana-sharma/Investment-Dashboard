import type { LiveHolding } from "./live-types";
import { sectorCompanies } from "./sector-company-data.ts";

export type AnalystMatrixRow = {
  symbol: string;
  house: string;
  rating: string;
  target: number | null | undefined;
  date: string;
  thesis: string;
  mail: boolean;
  targetAchieved?: boolean;
};

export type AnalystGroupMode = "calls" | "industries" | "performance" | "posted-month" | "target-achieved";

export type AnalystCallTone = "green" | "gold" | "red" | "blue" | "neutral";

export type AnalystMatrixGroup = {
  key: string;
  label: string;
  tone: AnalystCallTone;
  rows: AnalystMatrixRow[];
};

const ANALYST_INDUSTRY_LABELS: Record<string, string> = {
  auto: "Auto",
  pharma: "Pharma",
  fmcg: "FMCG",
  defence: "Defence",
  power: "Power",
  banking: "Banking",
  nbfc: "NBFC",
  telecom: "Telecom",
  consumer: "Consumer",
  energy: "Energy",
  infrastructure: "Infra",
};

const ANALYST_RENEWABLE_SYMBOLS = new Set(["ADANIGREEN", "SJVN", "NHPC"]);

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Collapse casing / whitespace variants into one group key.
 * TRADING BUY and TECHNICAL BUY stay distinct from plain BUY.
 */
export function normalizeAnalystCallLabel(call: string): string {
  const cleaned = String(call ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "Unrated";
  const upper = cleaned.toUpperCase();
  if (/^(?:BUY|BUY CALL|FUNDAMENTAL BUY|POSITIVE)$/.test(upper)) return "BUY";
  return upper;
}

export function analystCallTone(call: string): AnalystCallTone {
  const upper = normalizeAnalystCallLabel(call);
  if (upper === "Unrated") return "neutral";
  if (upper === "TARGET ACHIEVED") return "green";
  if (/\bTECHNICAL\b/.test(upper) && /\bBUY\b/.test(upper)) return "blue";
  if (/\bSELL\b|\bREDUCE\b|\bAVOID\b/.test(upper)) return "red";
  if (/\bHOLD\b/.test(upper)) return "gold";
  if (/\bBUY\b/.test(upper)) return "green";
  return "neutral";
}

export function resolveAnalystIndustry(symbol: string, holdings: LiveHolding[]): string {
  const holding = holdings.find((item) => item.symbol === symbol);
  if (holding?.subSector && /renewable/i.test(holding.subSector)) return "Renewables";
  if (ANALYST_RENEWABLE_SYMBOLS.has(symbol)) return "Renewables";
  for (const [sectorId, companies] of Object.entries(sectorCompanies)) {
    if (companies.some((company) => company.symbol === symbol)) {
      return ANALYST_INDUSTRY_LABELS[sectorId] ?? sectorId;
    }
  }
  if (holding?.sector) {
    if (/power/i.test(holding.sector) && /renewable/i.test(holding.subSector ?? "")) return "Renewables";
    if (/auto|automobile/i.test(holding.sector)) return "Auto";
    if (/pharma|healthcare/i.test(holding.sector)) return "Pharma";
    if (/fmcg|consumer staple/i.test(holding.sector)) return "FMCG";
    if (/defence|aerospace/i.test(holding.sector)) return "Defence";
    if (/power|utilit/i.test(holding.sector)) return "Power";
    if (/bank/i.test(holding.sector)) return "Banking";
    if (/it\b|software| techn/i.test(holding.sector)) return "IT";
  }
  return "Other";
}

export function postedMonthLabel(date: string): string {
  const parsed = Date.parse(date);
  if (!Number.isNaN(parsed)) return MONTH_LABELS[new Date(parsed).getMonth()];
  const match = date.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
  if (!match) return "Unknown";
  const key = match[1].slice(0, 3).toLowerCase();
  const index = MONTH_LABELS.findIndex((month) => month.toLowerCase() === key);
  return index >= 0 ? MONTH_LABELS[index] : "Unknown";
}

export function groupAnalystRows(
  rows: AnalystMatrixRow[],
  mode: AnalystGroupMode,
  currentBySymbol: Map<string, number>,
  holdings: LiveHolding[],
): AnalystMatrixGroup[] {
  if (mode === "target-achieved") {
    const achieved = rows.filter((row) => row.targetAchieved);
    return achieved.length
      ? [{ key: "target-achieved", label: "Target achieved", tone: "green", rows: achieved }]
      : [];
  }

  // Closed calls have their own explicit view and must never re-enter active
  // call, industry, performance or posted-month groupings.
  const activeRows = rows.filter((row) => !row.targetAchieved);

  if (mode === "performance") {
    const scored = activeRows.map((row) => {
      const current = currentBySymbol.get(row.symbol);
      const upside = current && row.target ? (row.target / current - 1) * 100 : null;
      return { row, upside };
    });
    const ranked = [...scored].sort((left, right) => (right.upside ?? Number.NEGATIVE_INFINITY) - (left.upside ?? Number.NEGATIVE_INFINITY));
    const withUpside = ranked.filter((item) => item.upside !== null);
    const leaders = withUpside.slice(0, 5).map((item) => item.row);
    const leaderSymbols = new Set(leaders.map((item) => item.symbol));
    const remainingUpside = withUpside.filter((item) => !leaderSymbols.has(item.row.symbol));
    const laggards = remainingUpside.slice(-5).reverse().map((item) => item.row);
    const laggardSymbols = new Set(laggards.map((item) => item.symbol));
    const mid = ranked
      .filter((item) => !leaderSymbols.has(item.row.symbol) && !laggardSymbols.has(item.row.symbol))
      .map((item) => item.row);
    return [
      { key: "leaders", label: "Leaders · top 5 upside vs CMP", tone: "green" as const, rows: leaders },
      { key: "laggards", label: "Laggards · bottom 5 upside vs CMP", tone: "red" as const, rows: laggards },
      { key: "mid", label: "Mid · remaining calls", tone: "neutral" as const, rows: mid },
    ].filter((group) => group.rows.length);
  }

  const buckets = new Map<string, AnalystMatrixRow[]>();
  for (const row of activeRows) {
    let key = "Other";
    if (mode === "calls") key = normalizeAnalystCallLabel(row.rating);
    else if (mode === "industries") key = resolveAnalystIndustry(row.symbol, holdings);
    else key = postedMonthLabel(row.date);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const monthOrder = new Map(MONTH_LABELS.map((month, index) => [month, index]));
  const entries = [...buckets.entries()].sort((left, right) => {
    if (mode === "posted-month") {
      const leftRank = monthOrder.get(left[0] as typeof MONTH_LABELS[number]) ?? 99;
      const rightRank = monthOrder.get(right[0] as typeof MONTH_LABELS[number]) ?? 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
    }
    if (mode === "calls") {
      const leftTone = analystCallTone(left[0]);
      const rightTone = analystCallTone(right[0]);
      const toneRank = { green: 0, blue: 1, gold: 2, red: 3, neutral: 4 } as const;
      if (toneRank[leftTone] !== toneRank[rightTone]) return toneRank[leftTone] - toneRank[rightTone];
    }
    return left[0].localeCompare(right[0]);
  });

  return entries.map(([key, grouped]) => ({
    key,
    label: key,
    tone: mode === "calls" ? analystCallTone(key) : "neutral",
    rows: grouped,
  }));
}
