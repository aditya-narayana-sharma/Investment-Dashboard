import type { AppleCalendarItem } from "./content-types";

export const HINDU_HOLIDAYS_LABEL = "Hindu Holidays";
export const INDIA_HOLIDAYS_LABEL = "India Holidays";
export const INDIA_AND_HINDU_HOLIDAYS_LABEL = "India + Hindu Holidays";

export type PersonalCalendarFeeds = {
  hinduHolidays: AppleCalendarItem[];
  indiaHolidays: AppleCalendarItem[];
  otherPersonal: AppleCalendarItem[];
};

function normalizeHolidayTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** IST calendar day as YYYY-MM-DD for all-day holiday matching. */
export function holidayDateKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayDiffKeys(left: string, right: string) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const leftMs = Date.parse(`${left}T12:00:00+05:30`);
  const rightMs = Date.parse(`${right}T12:00:00+05:30`);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(leftMs - rightMs) / 86_400_000);
}

export function holidayCalendarKind(calendar: string): "hindu" | "india" | null {
  const name = calendar.trim().toLowerCase();
  if (/^hindu\s+holidays?$/.test(name)) return "hindu";
  if (/^indias?\s+holidays?$/.test(name) || /^indian\s+holidays?$/.test(name)) return "india";
  return null;
}

function titlesMatch(left: AppleCalendarItem, right: AppleCalendarItem) {
  return normalizeHolidayTitle(left.title) === normalizeHolidayTitle(right.title);
}

function datesNear(left: AppleCalendarItem, right: AppleCalendarItem) {
  return dayDiffKeys(holidayDateKey(left.startsAt), holidayDateKey(right.startsAt)) <= 1;
}

function sortByStart(items: AppleCalendarItem[]) {
  return [...items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/**
 * Split calendar rows into Hindu / India holiday boxes plus leftover Personal.
 * Same title on both calendars (same day or ±1 day) merges to one row labeled
 * "India + Hindu Holidays", shown once under India Holidays (never duplicated in Hindu).
 */
export function partitionPersonalCalendarFeeds(events: AppleCalendarItem[]): PersonalCalendarFeeds {
  const hinduSource: AppleCalendarItem[] = [];
  const indiaSource: AppleCalendarItem[] = [];
  const otherPersonal: AppleCalendarItem[] = [];

  for (const item of events) {
    const kind = holidayCalendarKind(item.calendar);
    if (kind === "hindu") hinduSource.push(item);
    else if (kind === "india") indiaSource.push(item);
    else otherPersonal.push(item);
  }

  const usedHinduIds = new Set<string>();
  const indiaHolidays: AppleCalendarItem[] = [];

  for (const india of sortByStart(indiaSource)) {
    const match = sortByStart(hinduSource).find(
      (hindu) => !usedHinduIds.has(hindu.id) && titlesMatch(india, hindu) && datesNear(india, hindu),
    );
    if (match) {
      usedHinduIds.add(match.id);
      indiaHolidays.push({
        ...india,
        id: `merged:${india.id}:${match.id}`,
        title: india.title || match.title,
        calendar: INDIA_AND_HINDU_HOLIDAYS_LABEL,
        topic: india.topic,
        notes: india.notes || match.notes,
      });
    } else {
      indiaHolidays.push(india);
    }
  }

  const hinduHolidays = sortByStart(hinduSource.filter((item) => !usedHinduIds.has(item.id)));

  return {
    hinduHolidays,
    indiaHolidays: sortByStart(indiaHolidays),
    otherPersonal: sortByStart(otherPersonal),
  };
}
