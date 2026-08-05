import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarSchedulingMetadata,
  exactEarningsCalendarItems,
} from "../app/calendar-earnings.ts";

function event(partial) {
  return {
    id: partial.id,
    title: partial.title,
    calendar: partial.calendar ?? "Earnings",
    startsAt: partial.startsAt,
    endsAt: partial.endsAt ?? partial.startsAt,
    allDay: partial.allDay ?? true,
    sourceDate: partial.sourceDate,
    topic: partial.topic ?? "Earnings",
  };
}

test("exact Earnings source keeps historical and future rows without all-day shifts", () => {
  const rows = exactEarningsCalendarItems([
    event({ id: "past", title: "PAST Q4 FY23 Results", startsAt: "2023-01-13T00:00:00.000Z", sourceDate: "2023-01-14" }),
    event({ id: "future", title: "FUTURE Q1 FY27 Results", startsAt: "2026-08-12T00:00:00.000Z", sourceDate: "2026-08-13" }),
  ]);
  assert.deepEqual(rows.map((row) => calendarSchedulingMetadata(row).dateKey), ["2023-01-14", "2026-08-13"]);
  assert.ok(rows.every((row) => calendarSchedulingMetadata(row).reported === false));
});

test("stable source IDs dedupe same-date rows but preserve distinct dates and event kinds", () => {
  const duplicate = event({ id: "stable", title: "XYZ Q1 FY27 Results", startsAt: "2026-08-12T00:00:00.000Z", sourceDate: "2026-08-13" });
  const rows = exactEarningsCalendarItems([
    duplicate,
    { ...duplicate },
    { ...duplicate, sourceDate: "2026-08-14" },
    event({ id: "call", title: "XYZ Q1 FY27 Concall", startsAt: "2026-08-12T00:00:00.000Z", sourceDate: "2026-08-13" }),
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(new Set(rows.map((row) => calendarSchedulingMetadata(row).eventKind)), new Set(["results", "call"]));
});

test("non-Earnings calendars never enter the tracked schedule", () => {
  const rows = exactEarningsCalendarItems([
    event({ id: "exact", title: "EXACT Results", startsAt: "2026-08-06T00:00:00.000Z", sourceDate: "2026-08-06" }),
    event({ id: "other", title: "Market Earnings Review", calendar: "Work", startsAt: "2026-08-06T00:00:00.000Z", sourceDate: "2026-08-06" }),
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["exact"]);
});
