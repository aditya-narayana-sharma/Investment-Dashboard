import assert from "node:assert/strict";
import test from "node:test";
import {
  DOWNLOAD_LIST_FEED_LABEL,
  REPEATS_FEED_LABEL,
  WATCHLIST_FEED_LABEL,
  isDailyReminderList,
  isDownloadListReminderList,
  isRepeatsOnReminderList,
  isScheduledRemindersCalendar,
  isWatchlistReminderList,
  partitionCalendarActionFeeds,
} from "../app/calendar-action-feeds.ts";
import { INDIA_AND_HINDU_HOLIDAYS_LABEL, partitionPersonalCalendarFeeds } from "../app/calendar-holiday-feeds.ts";

test("isScheduledRemindersCalendar detects Apple reminder clones", () => {
  assert.equal(isScheduledRemindersCalendar({ calendar: "Scheduled Reminders" }), true);
  assert.equal(isScheduledRemindersCalendar({ calendar: "Astronomy & Space" }), false);
});

test("isDailyReminderList matches Daily and Log lists", () => {
  assert.equal(isDailyReminderList("Daily"), true);
  assert.equal(isDailyReminderList("☀️ Daily"), true);
  assert.equal(isDailyReminderList("Log"), true);
  assert.equal(isDailyReminderList("Logs"), true);
  assert.equal(isDailyReminderList("Daily Logs"), true);
  assert.equal(isDailyReminderList("Daily Log"), true);
  assert.equal(isDailyReminderList("Tasks"), false);
  assert.equal(isDailyReminderList("🔁 REPEATS ON"), false);
});

test("watchlist / download / repeats list matchers accept emoji and plain names", () => {
  assert.equal(isWatchlistReminderList("Watchlist"), true);
  assert.equal(isWatchlistReminderList("🍿 Watchlist"), true);
  assert.equal(isWatchlistReminderList("Watch List"), true);
  assert.equal(isWatchlistReminderList("Wishlist"), false);

  assert.equal(isDownloadListReminderList("Download List"), true);
  assert.equal(isDownloadListReminderList("🔽 Download List"), true);
  assert.equal(isDownloadListReminderList("Downloads"), true);
  assert.equal(isDownloadListReminderList("Download"), true);
  assert.equal(isDownloadListReminderList("Tasks"), false);

  assert.equal(isRepeatsOnReminderList("REPEATS ON"), true);
  assert.equal(isRepeatsOnReminderList("🔁 REPEATS ON"), true);
  assert.equal(isRepeatsOnReminderList("Daily"), false);
  assert.equal(REPEATS_FEED_LABEL, "🔁 REPEATS ON");
  assert.equal(WATCHLIST_FEED_LABEL, "🍿 Watchlist");
  assert.equal(DOWNLOAD_LIST_FEED_LABEL, "🔽 Download List");
});

test("partitionCalendarActionFeeds builds dedicated boxes without Other/Personal", () => {
  const calendar = [
    { id: "a1", title: "Moon", calendar: "Astronomy & Space", startsAt: "2026-07-21T11:00:00+05:30", endsAt: "2026-07-21T12:00:00+05:30", topic: "Other" },
    { id: "f1", title: "FP1", calendar: "F1", startsAt: "2026-07-25T15:00:00+05:30", endsAt: "2026-07-25T16:00:00+05:30", topic: "Other" },
    { id: "w1", title: "Standup", calendar: "Work", startsAt: "2026-07-24T10:00:00+05:30", endsAt: "2026-07-24T10:30:00+05:30", topic: "Work/Jobs" },
    { id: "ans", title: "Interview", calendar: "ANS", startsAt: "2026-07-24T11:00:00+05:30", endsAt: "2026-07-24T12:00:00+05:30", topic: "Work/Jobs" },
    { id: "e1", title: "INFY result", calendar: "Earnings", startsAt: "2026-07-24T00:00:00+05:30", endsAt: "2026-07-24T23:59:00+05:30", topic: "Earnings" },
    { id: "g1", title: "Practice", calendar: "Guitar Practice", startsAt: "2026-07-24T18:00:00+05:30", endsAt: "2026-07-24T19:00:00+05:30", topic: "Other" },
    { id: "h1", title: "Onam", calendar: "Hindu Holidays", startsAt: "2026-08-26T00:00:00+05:30", endsAt: "2026-08-26T23:59:00+05:30", topic: "Personal" },
    { id: "i1", title: "Onam", calendar: "India Holidays", startsAt: "2026-08-26T00:00:00+05:30", endsAt: "2026-08-26T23:59:00+05:30", topic: "Personal" },
    { id: "i2", title: "Independence Day", calendar: "India Holidays", startsAt: "2026-08-15T00:00:00+05:30", endsAt: "2026-08-15T23:59:00+05:30", topic: "Personal" },
    { id: "s1", title: "Electrician", calendar: "Scheduled Reminders", startsAt: "2026-07-21T05:30:00+05:30", endsAt: "2026-07-22T05:29:00+05:30", topic: "Other" },
  ];
  const feeds = partitionCalendarActionFeeds(calendar, [
    { id: "rc", title: "Done job", list: "🔍Job", completed: true, completedAt: "2026-07-20T10:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Work/Jobs" },
    { id: "rj", title: "HVAC", list: "🔍Job", completed: false, dueAt: "2026-07-21T05:30:00.000Z", detail: "", source: "Apple Reminders", topic: "Work/Jobs" },
    { id: "re", title: "BEL.NS", list: "Earnings", completed: false, dueAt: "2026-07-24T00:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Earnings" },
    { id: "rg", title: "Am chord", list: "Guitar Chords", completed: false, dueAt: "2026-07-24T18:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "rd", title: "Daily German", list: "Daily", completed: false, dueAt: "2026-07-24T05:30:00.000Z", detail: "", source: "Apple Reminders", topic: "Other", repeating: true, repeatsOn: "Daily" },
    { id: "rl", title: "Log entry", list: "Log", completed: false, dueAt: "2026-07-24T21:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "rw", title: "Dune Part Two", list: "Watchlist", completed: false, detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "rw2", title: "Done movie", list: "🍿 Watchlist", completed: true, completedAt: "2026-07-19T12:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "rdl", title: "Breaking Bad", list: "Download List", completed: false, detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "rrp", title: "Water plants", list: "🔁 REPEATS ON", completed: false, dueAt: "2026-07-24T08:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
    { id: "rs", title: "Oscar", list: "Tasks", completed: false, dueAt: "2026-07-21T19:00:00.000Z", detail: "", source: "Apple Reminders", topic: "Other" },
  ]);
  const holidays = partitionPersonalCalendarFeeds(
    calendar.filter((item) => !isScheduledRemindersCalendar(item) && /holiday/i.test(item.calendar)),
  );

  assert.equal(feeds.astronomyEvents.length, 1);
  assert.equal(feeds.f1Events.length, 1);
  assert.equal(feeds.workEvents.length, 2);
  assert.equal(feeds.jobReminders.length, 1);
  assert.equal(feeds.earningsCalendarEvents.length, 1);
  assert.equal(feeds.earningsReminders.length, 1);
  assert.equal(feeds.guitarEvents.length, 1);
  assert.equal(feeds.guitarReminders.length, 1);
  assert.equal(feeds.dailyReminders.length, 2);
  assert.ok(feeds.dailyReminders.some((item) => item.title === "Daily German"));
  assert.ok(feeds.dailyReminders.some((item) => item.title === "Log entry"));
  // Recurring Daily/Log items stay in ☀️ Daily — REPEATS must not steal them.
  assert.ok(feeds.dailyReminders.some((item) => item.title === "Daily German" && item.repeating));
  assert.equal(feeds.repeatingReminders.length, 1);
  assert.equal(feeds.repeatingReminders[0].title, "Water plants");
  assert.ok(!feeds.repeatingReminders.some((item) => item.title === "Daily German"));
  assert.ok(!feeds.repeatingReminders.some((item) => item.list === "Daily" || item.list === "Log"));
  assert.equal(feeds.watchlistReminders.length, 1);
  assert.equal(feeds.watchlistReminders[0].title, "Dune Part Two");
  assert.equal(feeds.downloadListReminders.length, 1);
  assert.equal(feeds.downloadListReminders[0].title, "Breaking Bad");
  assert.equal(feeds.completedReminders.length, 2);
  assert.ok(feeds.completedReminders.some((item) => item.title === "Done movie"));
  assert.equal(feeds.scheduledReminders.length, 1);
  assert.equal(feeds.scheduledReminders[0].title, "Oscar");
  assert.equal(holidays.indiaHolidays.length, 2);
  assert.ok(holidays.indiaHolidays.some((item) => item.title === "Onam" && item.calendar === INDIA_AND_HINDU_HOLIDAYS_LABEL));
  assert.equal(holidays.hinduHolidays.length, 0);
});
