/**
 * NSE capital-market trading calendar helpers (IST).
 * Keep in sync with scripts/nse-trading-day.mjs.
 */

/** Weekday equity closures for calendar year 2026 (YYYY-MM-DD, Asia/Kolkata). */
export const NSE_EQUITY_HOLIDAYS_2026 = new Set([
  "2026-01-15",
  "2026-01-26",
  "2026-03-03",
  "2026-03-26",
  "2026-03-31",
  "2026-04-03",
  "2026-04-14",
  "2026-05-01",
  "2026-05-28",
  "2026-06-26",
  "2026-09-14",
  "2026-10-02",
  "2026-10-20",
  "2026-11-10",
  "2026-11-24",
  "2026-12-25",
]);

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shiftIstDateKey(dateKey: string, deltaDays: number) {
  const base = new Date(`${dateKey}T12:00:00+05:30`);
  base.setDate(base.getDate() + deltaDays);
  return istDateKey(base);
}

export function weekdayInIst(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+05:30`));
}

export function isNseEquityHoliday(dateKey: string) {
  return NSE_EQUITY_HOLIDAYS_2026.has(dateKey);
}

export function isNseTradingDay(dateKey: string) {
  const weekday = weekdayInIst(dateKey);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return !isNseEquityHoliday(dateKey);
}

export function lastNseTradingDay(calendarDate = istDateKey()) {
  let key = calendarDate;
  for (let step = 0; step < 21; step += 1) {
    if (isNseTradingDay(key)) return key;
    key = shiftIstDateKey(key, -1);
  }
  return calendarDate;
}

export function formatIstDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function resolveAxisTradingAsOf(calendarDate = istDateKey()) {
  const tradingAsOf = lastNseTradingDay(calendarDate);
  const usedLastTradingDay = tradingAsOf !== calendarDate;
  return {
    calendarDate,
    tradingAsOf,
    usedLastTradingDay,
    isTradingDay: !usedLastTradingDay,
    label: usedLastTradingDay
      ? `${formatIstDateLabel(tradingAsOf)} (last NSE trading day)`
      : formatIstDateLabel(tradingAsOf),
  };
}

export function axisMessageDateKey(
  message: { receivedAt?: string; time?: string },
  fallbackYear = new Date().getFullYear(),
) {
  if (message?.receivedAt) {
    const parsed = new Date(message.receivedAt);
    if (!Number.isNaN(parsed.getTime())) return istDateKey(parsed);
  }
  const time = String(message?.time ?? "");
  const match = time.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
  if (!match) return "";
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const month = months[match[2].slice(0, 3).toLowerCase()];
  if (!month) return "";
  return `${fallbackYear}-${month}-${String(match[1]).padStart(2, "0")}`;
}
