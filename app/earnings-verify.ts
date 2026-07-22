import type { EarningsEvent } from "./portfolio-data";
import type { EarningsSnapshot } from "./earnings-live-types";

const monthIndex: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6, juli: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function istAnalysisDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Parse calendar labels like "20 Jul" into an IST YYYY-MM-DD key for the analysis year. */
export function earningsEventDateKey(event: EarningsEvent, analysisDate: string): string | null {
  const match = event.date.trim().match(/^(\d{1,2})\s+([A-Za-z]+)/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = monthIndex[match[2].toLowerCase()];
  if (!Number.isFinite(day) || month === undefined) return null;
  const year = Number(analysisDate.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function hasHttpSource(event: EarningsEvent) {
  return typeof event.source === "string" && /^https?:\/\//i.test(event.source.trim());
}

function reportedKpisFilled(event: EarningsEvent) {
  return event.kpis.every((kpi) => typeof kpi.value === "string" && kpi.value.trim().length > 0);
}

/**
 * Contractual earnings verification without a live IR/NSE scraper:
 * - reported rows need an http(s) source URL and filled KPI values (hard fail → stale)
 * - overdue pending rows are called out as watch items but do not alone demote verified
 *   (calendar dates are scheduling evidence; KPIs stay blank until publication)
 */
export function buildEarningsSnapshot(events: EarningsEvent[], analysisDate = istAnalysisDateKey()): EarningsSnapshot {
  if (!events.length) {
    return {
      status: "unavailable",
      asOf: `${analysisDate} · no earnings calendar`,
      analysisDate,
      events: [],
      message: "Earnings calendar is empty; no verified events are available.",
    };
  }

  const hardIssues: string[] = [];
  const overduePending: string[] = [];
  for (const event of events) {
    const eventDate = earningsEventDateKey(event, analysisDate);
    if (event.reported) {
      if (!hasHttpSource(event)) hardIssues.push(`${event.symbol}: reported without an http(s) source URL`);
      if (!reportedKpisFilled(event)) hardIssues.push(`${event.symbol}: reported with blank KPI values`);
      continue;
    }
    if (eventDate && eventDate < analysisDate) {
      overduePending.push(`${event.symbol} (${event.date})`);
    }
  }

  if (hardIssues.length) {
    return {
      status: "stale",
      asOf: `${analysisDate} · local calendar contract needs source updates`,
      analysisDate,
      events,
      message: `Earnings calendar is not fully verified: ${hardIssues.slice(0, 4).join("; ")}${hardIssues.length > 4 ? ` (+${hardIssues.length - 4} more)` : ""}. Pending KPI fields remain blank until publication is confirmed.`,
    };
  }

  const overdueNote = overduePending.length
    ? ` Overdue pending (scheduling only, KPIs blank): ${overduePending.slice(0, 4).join(", ")}${overduePending.length > 4 ? ` (+${overduePending.length - 4} more)` : ""}.`
    : "";

  return {
    status: "verified",
    asOf: `${analysisDate} · verified local calendar contract`,
    analysisDate,
    events,
    message: `Earnings calendar verified through today. Reported KPI rows retain source URLs; pending future values remain intentionally blank.${overdueNote}`,
  };
}
