"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { AppleCalendarItem } from "../content-types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const CELL_PREVIEW = 4;

type CalendarPalette = {
  accent: string;
  darkText: "#07111f" | "#ffffff";
  paper: string;
  paperText: string;
};

const SOURCE_PALETTES: Array<{ matcher: RegExp; palette: CalendarPalette }> = [
  { matcher: /formula\s*1|\bf1\b/i, palette: { accent: "#ef4444", darkText: "#ffffff", paper: "#fee2e2", paperText: "#7f1d1d" } },
  { matcher: /astronom|space|moon|solar|lunar/i, palette: { accent: "#8b5cf6", darkText: "#ffffff", paper: "#ede9fe", paperText: "#4c1d95" } },
  { matcher: /work|job/i, palette: { accent: "#2563eb", darkText: "#ffffff", paper: "#dbeafe", paperText: "#1e3a8a" } },
  { matcher: /coursera|course|learning|study/i, palette: { accent: "#0f766e", darkText: "#ffffff", paper: "#ccfbf1", paperText: "#134e4a" } },
  { matcher: /family|birthday|anniversary/i, palette: { accent: "#db2777", darkText: "#ffffff", paper: "#fce7f3", paperText: "#831843" } },
  { matcher: /hindu/i, palette: { accent: "#f59e0b", darkText: "#07111f", paper: "#fef3c7", paperText: "#78350f" } },
  { matcher: /india|holiday/i, palette: { accent: "#f97316", darkText: "#07111f", paper: "#ffedd5", paperText: "#7c2d12" } },
  { matcher: /personal|home/i, palette: { accent: "#14b8a6", darkText: "#07111f", paper: "#ccfbf1", paperText: "#134e4a" } },
];

const FALLBACK_PALETTES: CalendarPalette[] = [
  { accent: "#3b82f6", darkText: "#ffffff", paper: "#dbeafe", paperText: "#1e3a8a" },
  { accent: "#22c55e", darkText: "#07111f", paper: "#dcfce7", paperText: "#14532d" },
  { accent: "#06b6d4", darkText: "#07111f", paper: "#cffafe", paperText: "#164e63" },
  { accent: "#a855f7", darkText: "#ffffff", paper: "#f3e8ff", paperText: "#581c87" },
  { accent: "#eab308", darkText: "#07111f", paper: "#fef9c3", paperText: "#713f12" },
  { accent: "#f43f5e", darkText: "#ffffff", paper: "#ffe4e6", paperText: "#881337" },
];

function sourcePalette(source: string) {
  const named = SOURCE_PALETTES.find(({ matcher }) => matcher.test(source));
  if (named) return named.palette;
  const hash = Array.from(source).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length]!;
}

function sourceStyle(source: string) {
  const palette = sourcePalette(source);
  return {
    "--calendar-accent": palette.accent,
    "--calendar-dark-text": palette.darkText,
    "--calendar-paper": palette.paper,
    "--calendar-paper-text": palette.paperText,
  } as CSSProperties;
}

function formatDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function eventDateKey(event: AppleCalendarItem) {
  if (event.allDay && /^\d{4}-\d{2}-\d{2}$/.test(event.sourceDate ?? "")) return event.sourceDate!;
  const startsAt = new Date(event.startsAt);
  if (Number.isFinite(startsAt.getTime())) return formatDateKey(startsAt);
  return event.startsAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
}

function formatEventTime(event: AppleCalendarItem) {
  if (event.allDay) return "All day";
  const startsAt = new Date(event.startsAt);
  if (!Number.isFinite(startsAt.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(startsAt);
}

function monthCells(monthKey: string) {
  const year = Number(monthKey.slice(0, 4));
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1, 12));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset, 12));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    return { key, day: date.getUTCDate(), inMonth: date.getUTCMonth() === monthIndex };
  });
}

function shiftMonth(monthKey: string, amount: number) {
  const year = Number(monthKey.slice(0, 4));
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  const date = new Date(Date.UTC(year, monthIndex + amount, 1, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AppleMonthlyCalendar({ events }: { events: AppleCalendarItem[] }) {
  const todayKey = formatDateKey(new Date());
  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, AppleCalendarItem[]>();
    for (const event of events) {
      const key = eventDateKey(event);
      if (!key) continue;
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    for (const dayEvents of grouped.values()) {
      dayEvents.sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.title.localeCompare(right.title));
    }
    return grouped;
  }, [events]);
  const candidateMonths = useMemo(() => [...new Set([...eventsByDay.keys()].map((key) => key.slice(0, 7)))].sort(), [eventsByDay]);
  const currentMonth = todayKey.slice(0, 7);
  const initialMonth = candidateMonths.includes(currentMonth)
    ? currentMonth
    : (candidateMonths.find((candidate) => candidate >= currentMonth) ?? candidateMonths[candidateMonths.length - 1] ?? currentMonth);
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(todayKey.startsWith(initialMonth) ? todayKey : `${initialMonth}-01`);
  const cells = useMemo(() => monthCells(activeMonth), [activeMonth]);
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
    .format(new Date(`${activeMonth}-15T12:00:00+05:30`));
  const monthEvents = useMemo(
    () => events.filter((event) => eventDateKey(event).startsWith(activeMonth)),
    [activeMonth, events],
  );
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of monthEvents) counts.set(event.calendar, (counts.get(event.calendar) ?? 0) + 1);
    return [...counts].sort(([left], [right]) => left.localeCompare(right, "en", { sensitivity: "base", numeric: true }));
  }, [monthEvents]);
  const selectedEvents = eventsByDay.get(selectedDay) ?? [];

  const preferredDayForMonth = (monthKey: string) => {
    const preferredDay = todayKey.startsWith(monthKey) && eventsByDay.has(todayKey)
      ? todayKey
      : ([...eventsByDay.keys()].find((key) => key.startsWith(monthKey)) ?? `${monthKey}-01`);
    return preferredDay;
  };

  const goToMonth = (monthKey: string) => {
    setActiveMonth(monthKey);
    setSelectedDay(preferredDayForMonth(monthKey));
  };

  return (
    <div className="apple-month-calendar">
      <div className="apple-month-toolbar">
        <div>
          <span className="apple-month-kicker"><CalendarDays size={14} /> Monthly view</span>
          <h4>{monthLabel}</h4>
          <p>{monthEvents.length} events across {sourceCounts.length} Apple Calendars</p>
        </div>
        <div className="apple-month-nav" role="group" aria-label="Navigate Apple Calendar months">
          <button type="button" onClick={() => goToMonth(shiftMonth(activeMonth, -1))} aria-label="Previous month"><ChevronLeft size={17} /></button>
          <button type="button" className="apple-month-today" onClick={() => goToMonth(currentMonth)}>Today</button>
          <button type="button" onClick={() => goToMonth(shiftMonth(activeMonth, 1))} aria-label="Next month"><ChevronRight size={17} /></button>
        </div>
      </div>

      <div className="apple-calendar-legend" aria-label="Apple Calendar color legend">
        {sourceCounts.map(([source, count]) => (
          <span key={source} style={sourceStyle(source)}><i aria-hidden="true" />{source}<b>{count}</b></span>
        ))}
        {sourceCounts.length === 0 && <em>No events in this month</em>}
      </div>

      <div className="apple-month-scroll" tabIndex={0} aria-label="Scrollable monthly calendar">
        <div className="apple-month-weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="apple-month-grid" role="grid" aria-label={`${monthLabel} Apple Calendar`}>
          {cells.map((cell) => {
            const dayEvents = eventsByDay.get(cell.key) ?? [];
            const preview = dayEvents.slice(0, CELL_PREVIEW);
            const overflow = dayEvents.length - preview.length;
            return (
              <div
                key={cell.key}
                role="gridcell"
                aria-selected={cell.key === selectedDay}
                className={`apple-month-cell${cell.inMonth ? "" : " outside"}${cell.key === todayKey ? " today" : ""}${cell.key === selectedDay ? " selected" : ""}`}
              >
                <button type="button" className="apple-month-day" onClick={() => setSelectedDay(cell.key)} aria-label={`Show events for ${cell.key}`}>
                  <time dateTime={cell.key}>{cell.day}</time>
                </button>
                <div className="apple-month-events">
                  {preview.map((event) => (
                    <button
                      type="button"
                      className="apple-calendar-event"
                      key={`${event.id}-${event.sourceDate ?? event.startsAt}`}
                      style={sourceStyle(event.calendar)}
                      onClick={() => setSelectedDay(cell.key)}
                      title={`${formatEventTime(event)} · ${event.title} · ${event.calendar}`}
                    >
                      <span>{event.allDay ? "" : formatEventTime(event)}</span>
                      <b>{event.title}</b>
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button type="button" className="apple-calendar-more" onClick={() => setSelectedDay(cell.key)}>
                      +{overflow} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="apple-day-agenda" aria-live="polite">
        <strong>{new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${selectedDay}T12:00:00+05:30`))}</strong>
        <div>
          {selectedEvents.map((event) => (
            <span key={`${event.id}-agenda`} style={sourceStyle(event.calendar)} title={`${event.calendar} · ${event.title}`}>
              <i aria-hidden="true" />
              <small>{formatEventTime(event)}</small>
              <b>{event.title}</b>
            </span>
          ))}
          {selectedEvents.length === 0 && <em>No events</em>}
        </div>
      </div>
    </div>
  );
}
