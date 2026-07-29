import type { AppleCalendarItem, AppleTaskItem } from "./content-types";

export const COMPLETED_FEED_LABEL = "✅ Completed";
export const SCHEDULED_FEED_LABEL = "⏰ Scheduled";
export const REPEATS_FEED_LABEL = "🔁 REPEATS ON";
export const DAILY_FEED_LABEL = "☀️ Daily";
export const ASTRONOMY_SPACE_LABEL = "✨ Astronomy & Space";
export const F1_LABEL = "🏎️ F1";
export const WORK_JOBS_LABEL = "💼 Work + 🔍 Jobs";
export const EARNINGS_FEED_LABEL = "💸 Earnings";
export const GUITAR_PRACTICE_LABEL = "🎸 Guitar Practice";
export const WATCHLIST_FEED_LABEL = "🍿 Watchlist";
export const DOWNLOAD_LIST_FEED_LABEL = "🔽 Download List";
export const INDIA_HOLIDAYS_FEED_LABEL = "🇮🇳 India Holidays";
export const HINDU_HOLIDAYS_FEED_LABEL = "🛕 Hindu Holidays";

function normalizeListName(list?: string | null) {
  return String(list || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function stripListEmoji(name: string) {
  return name
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCalendarName(calendar: string) {
  return calendar.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isScheduledRemindersCalendar(item: Pick<AppleCalendarItem, "calendar">) {
  return /scheduled\s*reminders/i.test(item.calendar || "");
}

export function isAstronomySpaceCalendar(calendar: string) {
  const name = normalizeCalendarName(calendar);
  return /astronomy/.test(name) && /space/.test(name);
}

export function isF1Calendar(calendar: string) {
  const name = normalizeCalendarName(calendar);
  return /^f1$/.test(name) || /^formula\s*1$/.test(name) || /^f1\b/.test(name);
}

export function isWorkCalendar(calendar: string) {
  const name = normalizeCalendarName(calendar);
  return /^work$/.test(name) || /^ans$/.test(name);
}

export function isEarningsCalendar(calendar: string) {
  return /^earnings$/.test(normalizeCalendarName(calendar));
}

export function isGuitarPracticeCalendar(calendar: string) {
  const name = normalizeCalendarName(calendar);
  return /^guitar(\s+practice)?$/.test(name) || /guitar\s+practice/.test(name) || /^guitar\s+chords$/.test(name);
}

export function isJobReminderList(list?: string | null) {
  const name = String(list || "").trim();
  if (!name) return false;
  if (name === "🔍Job" || name === "Job 🔍") return true;
  return /job/i.test(name);
}

export function isEarningsReminderList(list?: string | null) {
  return /^earnings$/i.test(String(list || "").trim());
}

/** Daily + Daily Logs / Log reminder lists (emoji prefixes allowed). */
export function isDailyReminderList(list?: string | null) {
  const raw = String(list || "").trim();
  if (!raw) return false;
  if (/☀️/.test(raw) && /daily/i.test(raw)) return true;
  const name = stripListEmoji(normalizeListName(raw));
  if (!name) return false;
  if (name === "daily" || name === "log" || name === "logs") return true;
  return /^daily(\s+logs?)?$/.test(name);
}

export function isGuitarReminderList(list?: string | null) {
  return /guitar/i.test(String(list || ""));
}

/** Exact or emoji/name variants of Apple Reminders list `🔁 REPEATS ON`. */
export function isRepeatsOnReminderList(list?: string | null) {
  const raw = String(list || "").trim();
  if (!raw) return false;
  if (/🔁/.test(raw) && /repeats\s*on/i.test(raw)) return true;
  const name = stripListEmoji(normalizeListName(raw));
  return /^repeats\s*on$/.test(name);
}

/** Incomplete items with a recurrence rule, or from the REPEATS ON list. */
export function isRepeatingReminder(item: Pick<AppleTaskItem, "list" | "repeating">) {
  return Boolean(item.repeating) || isRepeatsOnReminderList(item.list);
}

/** Exact or emoji/name variants of Apple Reminders list `🍿 Watchlist`. */
export function isWatchlistReminderList(list?: string | null) {
  const raw = String(list || "").trim();
  if (!raw) return false;
  if (/🍿/.test(raw) && /watch\s*list/i.test(raw)) return true;
  const name = stripListEmoji(normalizeListName(raw));
  return /^watch\s*list$/.test(name) || /^watchlist$/.test(name);
}

/** Exact or emoji/name variants of Apple Reminders list `🔽 Download List`. */
export function isDownloadListReminderList(list?: string | null) {
  const raw = String(list || "").trim();
  if (!raw) return false;
  if (/🔽/.test(raw) && /download/i.test(raw)) return true;
  const name = stripListEmoji(normalizeListName(raw));
  return /^download(\s+list)?$/.test(name) || /^downloads$/.test(name);
}

function sortCalendar(items: AppleCalendarItem[]) {
  return [...items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() || a.title.localeCompare(b.title));
}

function sortScheduled(items: AppleTaskItem[]) {
  return [...items].sort(
    (left, right) =>
      new Date(left.dueAt ?? Number.POSITIVE_INFINITY).getTime() - new Date(right.dueAt ?? Number.POSITIVE_INFINITY).getTime() ||
      left.title.localeCompare(right.title),
  );
}

function sortCompleted(items: AppleTaskItem[]) {
  return [...items].sort((left, right) => new Date(right.completedAt ?? 0).getTime() - new Date(left.completedAt ?? 0).getTime());
}

export type CalendarActionFeeds = {
  completedReminders: AppleTaskItem[];
  scheduledReminders: AppleTaskItem[];
  repeatingReminders: AppleTaskItem[];
  dailyReminders: AppleTaskItem[];
  astronomyEvents: AppleCalendarItem[];
  f1Events: AppleCalendarItem[];
  workEvents: AppleCalendarItem[];
  jobReminders: AppleTaskItem[];
  earningsCalendarEvents: AppleCalendarItem[];
  earningsReminders: AppleTaskItem[];
  guitarEvents: AppleCalendarItem[];
  guitarReminders: AppleTaskItem[];
  watchlistReminders: AppleTaskItem[];
  downloadListReminders: AppleTaskItem[];
};

/**
 * Partition Calendar + Reminders into the Market Intelligence feed boxes.
 * Holidays are handled by partitionPersonalCalendarFeeds in the UI.
 * Drops Scheduled Reminders calendar clones. No Other/Personal mega-bucket.
 */
export function partitionCalendarActionFeeds(
  calendar: AppleCalendarItem[],
  reminders: AppleTaskItem[],
): CalendarActionFeeds {
  const visibleCalendar = calendar.filter((item) => !isScheduledRemindersCalendar(item));
  const completedReminders = sortCompleted(reminders.filter((item) => item.completed));
  const incomplete = reminders.filter((item) => !item.completed);

  const jobReminders = sortScheduled(incomplete.filter((item) => isJobReminderList(item.list)));
  const earningsReminders = sortScheduled(incomplete.filter((item) => isEarningsReminderList(item.list)));
  const watchlistReminders = sortScheduled(incomplete.filter((item) => isWatchlistReminderList(item.list)));
  const downloadListReminders = sortScheduled(incomplete.filter((item) => isDownloadListReminderList(item.list)));
  const guitarReminders = sortScheduled(incomplete.filter((item) => isGuitarReminderList(item.list)));
  // Daily/Log list membership wins over recurrence — include ALL incomplete Daily+Log items in ☀️ Daily
  // (including recurring ones). REPEATS ON must not steal Daily/Log list items.
  const dailyReminders = sortScheduled(incomplete.filter((item) => isDailyReminderList(item.list)));
  const listDedicatedIds = new Set(
    [
      ...jobReminders,
      ...earningsReminders,
      ...watchlistReminders,
      ...downloadListReminders,
      ...guitarReminders,
      ...dailyReminders,
    ].map((item) => item.id),
  );

  const repeatingReminders = sortScheduled(
    incomplete.filter((item) => !listDedicatedIds.has(item.id) && isRepeatingReminder(item)),
  );
  const dedicatedIds = new Set([...listDedicatedIds, ...repeatingReminders.map((item) => item.id)]);
  const scheduledReminders = sortScheduled(incomplete.filter((item) => !dedicatedIds.has(item.id)));

  return {
    completedReminders,
    scheduledReminders,
    repeatingReminders,
    dailyReminders,
    astronomyEvents: sortCalendar(visibleCalendar.filter((item) => isAstronomySpaceCalendar(item.calendar))),
    f1Events: sortCalendar(visibleCalendar.filter((item) => isF1Calendar(item.calendar))),
    workEvents: sortCalendar(visibleCalendar.filter((item) => isWorkCalendar(item.calendar))),
    jobReminders,
    earningsCalendarEvents: sortCalendar(visibleCalendar.filter((item) => isEarningsCalendar(item.calendar))),
    earningsReminders,
    guitarEvents: sortCalendar(visibleCalendar.filter((item) => isGuitarPracticeCalendar(item.calendar))),
    guitarReminders,
    watchlistReminders,
    downloadListReminders,
  };
}
