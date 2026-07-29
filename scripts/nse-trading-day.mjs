/**
 * NSE capital-market trading calendar helpers (IST).
 * Holidays sourced from NSE 2026 equity holiday circular (+ Maharashtra municipal election day).
 */

/** Weekday equity closures for calendar year 2026 (YYYY-MM-DD, Asia/Kolkata). */
export const NSE_EQUITY_HOLIDAYS_2026 = new Set([
  "2026-01-15", // Municipal Corporation Elections — Maharashtra
  "2026-01-26", // Republic Day
  "2026-03-03", // Holi
  "2026-03-26", // Shri Ram Navami
  "2026-03-31", // Shri Mahavir Jayanti
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
  "2026-05-01", // Maharashtra Day
  "2026-05-28", // Bakri Id
  "2026-06-26", // Muharram
  "2026-09-14", // Ganesh Chaturthi
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-10-20", // Dussehra
  "2026-11-10", // Diwali-Balipratipada
  "2026-11-24", // Prakash Gurpurb Sri Guru Nanak Dev
  "2026-12-25", // Christmas
]);

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shiftIstDateKey(dateKey, deltaDays) {
  const base = new Date(`${dateKey}T12:00:00+05:30`);
  base.setDate(base.getDate() + deltaDays);
  return istDateKey(base);
}

export function weekdayInIst(dateKey) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+05:30`));
}

export function isNseEquityHoliday(dateKey) {
  return NSE_EQUITY_HOLIDAYS_2026.has(dateKey);
}

/** True when the NSE capital market is open for a normal cash session. */
export function isNseTradingDay(dateKey) {
  const weekday = weekdayInIst(dateKey);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return !isNseEquityHoliday(dateKey);
}

/** Walk backward from calendarDate until an NSE trading day is found. */
export function lastNseTradingDay(calendarDate = istDateKey()) {
  let key = calendarDate;
  for (let step = 0; step < 21; step += 1) {
    if (isNseTradingDay(key)) return key;
    key = shiftIstDateKey(key, -1);
  }
  return calendarDate;
}

export function formatIstDateLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Resolve the Axis Recommended Stocks as-of day:
 * - trading day → that calendar date
 * - weekend / NSE holiday → previous trading session
 */
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

/** IST YYYY-MM-DD from Axis digest `receivedAt` or display `time` (`25 Jul, 8:03 am`). */
export function axisMessageDateKey(message, fallbackYear = new Date().getFullYear()) {
  if (message?.receivedAt) {
    const parsed = new Date(message.receivedAt);
    if (!Number.isNaN(parsed.getTime())) return istDateKey(parsed);
  }
  const time = String(message?.time ?? "");
  const match = time.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
  if (!match) return "";
  const months = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const month = months[match[2].slice(0, 3).toLowerCase()];
  if (!month) return "";
  return `${fallbackYear}-${month}-${String(match[1]).padStart(2, "0")}`;
}
