import type { AppleCalendarItem, AppleTaskItem } from "./content-types";

export const COMPLETED_FEED_LABEL = "Completed";
export const SCHEDULED_FEED_LABEL = "Scheduled Important";
export const WORK_JOBS_LABEL = "Work / Job 🔍";

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

export function isEarningsCalendar(calendar: string) {
  return /^earnings$/.test(normalizeCalendarName(calendar));
}

export function isJobReminderList(list?: string | null) {
  const name = stripListEmoji(normalizeListName(list));
  return name === "job";
}

export function isEarningsReminderList(list?: string | null) {
  return stripListEmoji(normalizeListName(list)) === "earnings";
}

/** Lists that are deliberately absent from dashboard reminder data and UI. */
export function isExcludedReminderList(list?: string | null) {
  const normalized = normalizeListName(list);
  const exactSymbolicName = normalized.replace(/[\s\uFE0F]/g, "");
  if (exactSymbolicName === "🇩🇪♾🇮🇳") return true;
  const name = stripListEmoji(normalized);
  return /^(?:watch\s*list|download(?:\s*list)?|downloads|wish\s*list)$/.test(name);
}

export function sortCalendarItems(items: AppleCalendarItem[]) {
  return [...items].sort((a, b) => {
    const leftTime = Date.parse(a.startsAt);
    const rightTime = Date.parse(b.startsAt);
    const leftDated = Number.isFinite(leftTime);
    const rightDated = Number.isFinite(rightTime);
    if (leftDated !== rightDated) return leftDated ? -1 : 1;
    if (leftDated && rightDated && leftTime !== rightTime) return leftTime - rightTime;
    return a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true });
  });
}

export type CalendarSourceGroup = {
  calendar: string;
  items: AppleCalendarItem[];
};

/** Group every calendar row exactly once, with stable source and entry ordering. */
export function groupCalendarItemsBySource(items: AppleCalendarItem[]): CalendarSourceGroup[] {
  const groups = new Map<string, AppleCalendarItem[]>();
  for (const item of items) {
    const calendar = item.calendar.trim() || "Unknown calendar";
    groups.set(calendar, [...(groups.get(calendar) ?? []), item]);
  }
  return Array.from(groups, ([calendar, sourceItems]) => ({
    calendar,
    items: sortCalendarItems(sourceItems),
  })).sort((left, right) => left.calendar.localeCompare(right.calendar, "en", { sensitivity: "base", numeric: true }));
}

function sortActionable(items: AppleTaskItem[]) {
  return [...items].sort(
    (left, right) =>
      new Date(left.dueAt ?? Number.POSITIVE_INFINITY).getTime() - new Date(right.dueAt ?? Number.POSITIVE_INFINITY).getTime() ||
      Number(right.flagged) - Number(left.flagged) ||
      (right.priority ?? 0) - (left.priority ?? 0) ||
      left.title.localeCompare(right.title),
  );
}

function sortCompleted(items: AppleTaskItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = left.completedAt ?? left.dueAt ?? "";
    const rightDate = right.completedAt ?? right.dueAt ?? "";
    return new Date(rightDate || 0).getTime() - new Date(leftDate || 0).getTime() || left.title.localeCompare(right.title);
  });
}

function isMergedReminderFeed(list?: string | null) {
  const name = stripListEmoji(normalizeListName(list));
  return !name || name === "all" || name === "reminders" || name === "unknown list";
}

function isWorkReminder(item: AppleTaskItem) {
  return isJobReminderList(item.list) || (isMergedReminderFeed(item.list) && item.topic === "Work/Jobs");
}

function isScheduledImportantReminder(item: AppleTaskItem) {
  return Boolean(
    item.dueAt ||
    item.flagged ||
    item.urgent ||
    (item.priority ?? 0) > 0 ||
    isEarningsReminderList(item.list) ||
    item.topic === "Earnings",
  );
}

export type ReminderSmartGroups = {
  completedReminders: AppleTaskItem[];
  scheduledImportantReminders: AppleTaskItem[];
  workJobReminders: AppleTaskItem[];
  omittedUnimportantCount: number;
  excludedCount: number;
  allowedCount: number;
};

/**
 * Classify the one Market Intelligence Reminders feed into exactly three smart
 * groups. Completed items remain evidence only and can never move back to an
 * active group. Unscheduled, unflagged, non-work/non-earnings noise is omitted.
 */
export function partitionReminderSmartGroups(reminders: AppleTaskItem[]): ReminderSmartGroups {
  const excludedCount = reminders.filter((item) => isExcludedReminderList(item.list)).length;
  const allowed = reminders.filter((item) => !isExcludedReminderList(item.list));
  const completedReminders = sortCompleted(allowed.filter((item) => item.completed));
  const incomplete = allowed.filter((item) => !item.completed);
  const workJobReminders = sortActionable(incomplete.filter(isWorkReminder));
  const workIds = new Set(workJobReminders.map((item) => item.id));
  const scheduledImportantReminders = sortActionable(
    incomplete.filter((item) => !workIds.has(item.id) && isScheduledImportantReminder(item)),
  );
  const shownIds = new Set([...workJobReminders, ...scheduledImportantReminders].map((item) => item.id));
  return {
    completedReminders,
    scheduledImportantReminders,
    workJobReminders,
    omittedUnimportantCount: incomplete.filter((item) => !shownIds.has(item.id)).length,
    excludedCount,
    allowedCount: allowed.length,
  };
}
