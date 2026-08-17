import type { AppleCalendarItem } from "./content-types";

function normalizeCalendarName(calendar: string) {
  return calendar.trim().toLowerCase().replace(/\s+/g, " ");
}

export function calendarEventDateKey(item: AppleCalendarItem) {
  if (item.allDay && /^\d{4}-\d{2}-\d{2}$/.test(item.sourceDate ?? "")) return item.sourceDate!;
  const parsed = new Date(item.startsAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

export function calendarEventKind(title: string) {
  if (/\b(concall|conference\s*call|investor\s*call|analyst\s*call)\b/i.test(title)) return "call";
  if (/\bboard\s*meeting\b/i.test(title)) return "board-meeting";
  return "results";
}

export function calendarEventPeriod(title: string) {
  const match = title.match(/\b(Q[1-4])\s*(?:FY)?\s*(\d{2,4}(?:\s*[-/]\s*\d{2,4})?)\b/i);
  return match ? `${match[1].toUpperCase()} FY${match[2].replace(/\s+/g, "")}` : "Latest quarter";
}

export function calendarSchedulingMetadata(item: AppleCalendarItem) {
  return {
    dateKey: calendarEventDateKey(item),
    calendarEventId: item.id,
    eventKind: calendarEventKind(item.title),
    period: calendarEventPeriod(item.title),
    reported: false as const,
  };
}

/** Exact-source selection plus stable-ID/date dedupe for Apple scheduling rows. */
export function exactEarningsCalendarItems(items: AppleCalendarItem[], calendarName = "Earnings") {
  const expected = normalizeCalendarName(calendarName);
  const deduplicated = new Map<string, AppleCalendarItem>();
  for (const item of items) {
    if (normalizeCalendarName(item.calendar) !== expected) continue;
    const dateKey = calendarEventDateKey(item);
    if (!dateKey) continue;
    const stableKey = `${item.id}|${dateKey}`;
    if (!deduplicated.has(stableKey)) deduplicated.set(stableKey, item);
  }
  return [...deduplicated.values()];
}
