import assert from "node:assert/strict";
import test from "node:test";
import {
  INDIA_AND_HINDU_HOLIDAYS_LABEL,
  holidayCalendarKind,
  holidayDateKey,
  partitionPersonalCalendarFeeds,
} from "../app/calendar-holiday-feeds.ts";

function event(partial) {
  return {
    id: partial.id,
    title: partial.title,
    calendar: partial.calendar,
    startsAt: partial.startsAt,
    endsAt: partial.endsAt ?? partial.startsAt,
    topic: "Personal",
  };
}

test("holidayCalendarKind recognizes Hindu and India holiday calendars", () => {
  assert.equal(holidayCalendarKind("Hindu Holidays"), "hindu");
  assert.equal(holidayCalendarKind("India Holidays"), "india");
  assert.equal(holidayCalendarKind("Indian Holidays"), "india");
  assert.equal(holidayCalendarKind("Work"), null);
});

test("partitionPersonalCalendarFeeds merges same-day Onam once under India with combined label", () => {
  const feeds = partitionPersonalCalendarFeeds([
    event({
      id: "india-onam",
      title: "Onam",
      calendar: "India Holidays",
      startsAt: "2026-08-26T00:00:00.000Z",
      endsAt: "2026-08-26T23:59:00.000Z",
    }),
    event({
      id: "hindu-onam",
      title: "Onam",
      calendar: "Hindu Holidays",
      startsAt: "2026-08-26T00:00:00.000Z",
      endsAt: "2026-08-26T23:59:00.000Z",
    }),
    event({
      id: "india-parsi",
      title: "Parsi New Year",
      calendar: "India Holidays",
      startsAt: "2026-08-16T00:00:00.000Z",
    }),
    event({
      id: "hindu-guru",
      title: "Guru Purnima",
      calendar: "Hindu Holidays",
      startsAt: "2026-07-29T00:00:00.000Z",
    }),
  ]);

  assert.equal(feeds.indiaHolidays.length, 2);
  assert.equal(feeds.hinduHolidays.length, 1);
  assert.equal(feeds.otherPersonal.length, 0);

  const onam = feeds.indiaHolidays.find((item) => item.title === "Onam");
  assert.ok(onam);
  assert.equal(onam.calendar, INDIA_AND_HINDU_HOLIDAYS_LABEL);
  assert.ok(feeds.indiaHolidays.some((item) => item.title === "Parsi New Year" && item.calendar === "India Holidays"));
  assert.ok(feeds.hinduHolidays.some((item) => item.title === "Guru Purnima" && item.calendar === "Hindu Holidays"));
  assert.ok(!feeds.hinduHolidays.some((item) => item.title === "Onam"));
});

test("partitionPersonalCalendarFeeds merges adjacent-date Raksha Bandhan into India box once", () => {
  const feeds = partitionPersonalCalendarFeeds([
    event({
      id: "hindu-rb",
      title: "Raksha Bandhan",
      calendar: "Hindu Holidays",
      startsAt: "2026-08-27T00:00:00.000Z",
      endsAt: "2026-08-27T23:59:00.000Z",
    }),
    event({
      id: "india-rb",
      title: "Raksha Bandhan",
      calendar: "India Holidays",
      startsAt: "2026-08-28T00:00:00.000Z",
      endsAt: "2026-08-28T23:59:00.000Z",
    }),
  ]);

  assert.equal(feeds.indiaHolidays.length, 1);
  assert.equal(feeds.hinduHolidays.length, 0);
  assert.equal(feeds.indiaHolidays[0].calendar, INDIA_AND_HINDU_HOLIDAYS_LABEL);
  assert.equal(holidayDateKey(feeds.indiaHolidays[0].startsAt), "2026-08-28");
});

test("partitionPersonalCalendarFeeds keeps non-holiday Personal events", () => {
  const feeds = partitionPersonalCalendarFeeds([
    event({
      id: "birthday",
      title: "Family birthday",
      calendar: "Home",
      startsAt: "2026-09-01T10:00:00.000Z",
    }),
  ]);

  assert.equal(feeds.hinduHolidays.length, 0);
  assert.equal(feeds.indiaHolidays.length, 0);
  assert.equal(feeds.otherPersonal.length, 1);
  assert.equal(feeds.otherPersonal[0].id, "birthday");
});
