import type { AppleCalendarItem, MarketCalendarKind, MarketHoliday } from "./content-types";
import type { EarningsEvent } from "./portfolio-data";

const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", sept: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
};

function earningsDateKey(event: EarningsEvent, analysisDate: string) {
  const match = event.date.trim().match(/^(\d{1,2})\s+([A-Za-z]+)/);
  const year = analysisDate.match(/^(\d{4})/)?.[1];
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || !year || !month) return null;
  return `${year}-${month}-${match[1].padStart(2, "0")}`;
}

export const MARKET_HOLIDAY_CALENDARS: Record<Exclude<MarketCalendarKind, "CRYPTO">, string> = {
  NSE: "NSE Market Holidays",
  US: "US Market Holidays",
};

export function marketHolidayDateKey(item: Pick<AppleCalendarItem, "startsAt">) {
  const match = item.startsAt.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export function isMarketHoliday(item: AppleCalendarItem): item is AppleCalendarItem & { marketHoliday: MarketHoliday } {
  return Boolean(item.marketHoliday && (item.marketHoliday.market === "NSE" || item.marketHoliday.market === "US"));
}

export type EarningsHolidayConflict = {
  eventKey: string;
  date: string;
  market: Exclude<MarketCalendarKind, "CRYPTO">;
  holiday: string;
};

/**
 * Calendar overlap is a scheduling warning only. It does not claim that an
 * earnings result was or was not published.
 */
export function findEarningsHolidayConflicts(
  events: EarningsEvent[],
  calendar: AppleCalendarItem[],
  analysisDate: string,
): EarningsHolidayConflict[] {
  const holidaysByDate = new Map<string, Array<AppleCalendarItem & { marketHoliday: MarketHoliday }>>();
  for (const item of calendar.filter(isMarketHoliday)) {
    const key = marketHolidayDateKey(item);
    if (!key) continue;
    holidaysByDate.set(key, [...(holidaysByDate.get(key) ?? []), item]);
  }

  return events.flatMap((event) => {
    const date = earningsDateKey(event, analysisDate);
    if (!date) return [];
    return (holidaysByDate.get(date) ?? []).map((holiday) => ({
      eventKey: `${event.date}|${event.symbol}|${event.name}`,
      date,
      market: holiday.marketHoliday.market as Exclude<MarketCalendarKind, "CRYPTO">,
      holiday: holiday.title,
    }));
  });
}
