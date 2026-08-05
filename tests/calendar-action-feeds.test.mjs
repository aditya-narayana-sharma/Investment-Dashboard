import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPLETED_FEED_LABEL,
  SCHEDULED_FEED_LABEL,
  WORK_JOBS_LABEL,
  groupCalendarItemsBySource,
  isExcludedReminderList,
  isScheduledRemindersCalendar,
  partitionReminderSmartGroups,
} from "../app/calendar-action-feeds.ts";

test("calendar source groups are stable, complete, and chronological", () => {
  const input = [
    { id: "b-late", title: "Later", calendar: "Beta", startsAt: "2026-08-09T00:00:00.000Z", endsAt: "", topic: "Other" },
    { id: "a-undated", title: "Undated", calendar: "Alpha", startsAt: "", endsAt: "", topic: "Other" },
    { id: "a-early", title: "Earlier", calendar: "Alpha", startsAt: "2026-08-05T00:00:00.000Z", endsAt: "", topic: "Other" },
    { id: "b-early", title: "First", calendar: "Beta", startsAt: "2026-08-06T00:00:00.000Z", endsAt: "", topic: "Other" },
  ];
  const groups = groupCalendarItemsBySource(input);
  assert.deepEqual(groups.map((group) => group.calendar), ["Alpha", "Beta"]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["a-early", "a-undated"]);
  assert.deepEqual(groups[1].items.map((item) => item.id), ["b-early", "b-late"]);
  assert.equal(groups.flatMap((group) => group.items).length, input.length);
});

test("isScheduledRemindersCalendar detects Apple reminder clones", () => {
  assert.equal(isScheduledRemindersCalendar({ calendar: "Scheduled Reminders" }), true);
  assert.equal(isScheduledRemindersCalendar({ calendar: "Astronomy & Space" }), false);
});

test("excluded reminder lists are case, spacing, and emoji tolerant", () => {
  for (const list of ["Watchlist", "🍿 Watch List", " WATCHLIST ", "Download List", "🔽  download   list", "Downloads", "Wishlist", "Wish List", "🇩🇪 ♾️ 🇮🇳", "  🇩🇪   ♾️   🇮🇳  ", "🇩🇪♾🇮🇳"]) {
    assert.equal(isExcludedReminderList(list), true, list);
  }
  assert.equal(isExcludedReminderList("Earnings"), false);
  assert.equal(isExcludedReminderList("Job 🔍"), false);
  assert.equal(isExcludedReminderList("🇫🇷 ♾️ 🇮🇳"), false);
  assert.equal(isExcludedReminderList("🏁"), false);
});

test("reminders partition into exactly three smart groups without reactivation", () => {
  assert.deepEqual(
    [COMPLETED_FEED_LABEL, SCHEDULED_FEED_LABEL, WORK_JOBS_LABEL],
    ["Completed", "Scheduled Important", "Work / Job 🔍"],
  );

  const groups = partitionReminderSmartGroups([
    { id: "done-old", title: "Earlier evidence", list: "Tasks", completed: true, completedAt: "2026-08-02T10:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "done-new", title: "Latest evidence", list: "Job 🔍", completed: true, completedAt: "2026-08-05T10:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Work/Jobs" },
    { id: "job", title: "Application follow-up", list: "🔍Job", completed: false, detail: "", source: "Apple Reminders", topic: "Work/Jobs" },
    { id: "earn", title: "Tracked result", list: "Earnings", completed: false, detail: "", source: "Apple Reminders", topic: "Earnings" },
    { id: "due", title: "Due task", list: "Tasks", completed: false, dueAt: "2026-08-06T06:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "flag", title: "Flagged task", list: "Tasks", completed: false, flagged: true, detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "noise", title: "Unscheduled idea", list: "Tasks", completed: false, detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "watch", title: "Excluded active", list: "  🍿 WATCHLIST ", completed: false, dueAt: "2026-08-06T06:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "download", title: "Excluded download", list: "Download   List", completed: false, flagged: true, detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "wish-done", title: "Excluded completed", list: "Wish List", completed: true, completedAt: "2026-08-06T10:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "language-loop", title: "Excluded symbolic list", list: "  🇩🇪   ♾️   🇮🇳  ", completed: false, dueAt: "2026-08-06T07:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
  ]);

  assert.deepEqual(groups.completedReminders.map((item) => item.id), ["done-new", "done-old"]);
  assert.deepEqual(groups.workJobReminders.map((item) => item.id), ["job"]);
  assert.deepEqual(new Set(groups.scheduledImportantReminders.map((item) => item.id)), new Set(["earn", "due", "flag"]));
  assert.equal(groups.omittedUnimportantCount, 1);
  assert.equal(groups.excludedCount, 4);
  assert.equal(groups.allowedCount, 7);
  assert.ok(groups.completedReminders.every((item) => item.completed));
  assert.ok(!groups.workJobReminders.some((item) => item.completed));
  assert.ok(!groups.scheduledImportantReminders.some((item) => item.completed));
  assert.ok(!JSON.stringify(groups).match(/watch|download|wish-done|language-loop/));
});
