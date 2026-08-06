"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { EarningsEvent } from "../portfolio-data";
import { earningsEventDateKey } from "../earnings-verify";
import { earningsEventBullets } from "../digest-bullets";
import { sectorCompanies } from "../sector-company-data";
import { sectors } from "../sector-data";
import { currentIstDateKey, matchesSelectedSector } from "./utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DOT_PALETTE = ["#42d98b", "#64b5ff", "#e9ae2f", "#ff9f6e", "#b794f6", "#35c2d6", "#f58fd2"];
const CELL_PREVIEW = 4;
const TABLE_PREVIEW = 8;

export function earningsEventKey(event: EarningsEvent) {
  return `${event.date}|${event.symbol}|${event.name}`;
}

/** Normalize snapshot / content analysis dates into YYYY-MM-DD (IST). */
export function resolveAnalysisDateKey(raw?: string) {
  if (!raw) return currentIstDateKey();
  const iso = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const label = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (label) {
    const months: Record<string, string> = {
      jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
      apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
      aug: "08", august: "08", sep: "09", sept: "09", september: "09",
      oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
    };
    const month = months[label[2].toLowerCase()];
    if (month) return `${label[3]}-${month}-${label[1].padStart(2, "0")}`;
  }
  return currentIstDateKey();
}

function sectorMetaForEvent(event: EarningsEvent) {
  for (const sector of sectors) {
    if ((sectorCompanies[sector.id] ?? []).some((company) => company.symbol.toUpperCase() === event.symbol.toUpperCase())) {
      return { id: sector.id, name: sector.name, color: sector.color };
    }
  }
  for (const sector of sectors) {
    if (matchesSelectedSector(sector.id, event.name, event.symbol, event.summary)) {
      return { id: sector.id, name: sector.name, color: sector.color };
    }
  }
  return { id: "other", name: "Tracked", color: DOT_PALETTE[Math.abs(hashSymbol(event.symbol)) % DOT_PALETTE.length] };
}

function hashSymbol(symbol: string) {
  let hash = 0;
  for (let index = 0; index < symbol.length; index += 1) hash = (hash * 31 + symbol.charCodeAt(index)) | 0;
  return hash;
}

function monthMatrix(year: number, monthIndex: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; key: string | null }> = [];
  for (let index = 0; index < startPad; index += 1) cells.push({ day: null, key: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      key: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, key: null });
  return cells;
}

function formatDayHeading(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

function formatShortDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(date);
}

/**
 * Day tables share four column slots. When every company on the day uses the
 * same labels (same-sector banks, etc.), reuse those headers. When sectors mix —
 * e.g. Power capacity KPIs beside Consumer NOV — keep positional slots and show
 * each row's own label in the cell so filled values never render as n/p solely
 * because the first company's labels differ.
 */
function dayKpiSlots(events: EarningsEvent[]) {
  const slotCount = 4;
  return Array.from({ length: slotCount }, (_, index) => {
    const labels = events
      .map((event) => event.kpis[index]?.label?.trim())
      .filter((label): label is string => Boolean(label));
    const unique = [...new Set(labels)];
    const homogeneous = unique.length === 1;
    return {
      index,
      header: homogeneous ? unique[0]! : `KPI ${index + 1}`,
      showPerRowLabel: !homogeneous,
    };
  });
}

function statusTone(event: EarningsEvent) {
  if (event.reported) return "reported";
  if (/today/i.test(event.state)) return "today";
  return "due";
}

export function EarningsMonthCalendar({
  events,
  analysisDate,
  title = "Earnings calendar",
  note,
  selectedEventKey,
  onSelectEvent,
  activeMonth,
  onActiveMonthChange,
  selectedDay: controlledSelectedDay,
  onActiveDayChange,
  showCalendarGrid = true,
  showDayTable = true,
  showItemSummaries = false,
}: {
  events: EarningsEvent[];
  analysisDate?: string;
  title?: string;
  note?: string;
  selectedEventKey?: string;
  onSelectEvent?: (event: EarningsEvent) => void;
  activeMonth?: string;
  onActiveMonthChange?: (monthKey: string, monthEvents: EarningsEvent[]) => void;
  selectedDay?: string;
  onActiveDayChange?: (dateKey: string, dayEvents: EarningsEvent[]) => void;
  showCalendarGrid?: boolean;
  showDayTable?: boolean;
  /** Market Intelligence: render ≥5 source-backed bullets per day event. */
  showItemSummaries?: boolean;
}) {
  const analysisKey = resolveAnalysisDateKey(analysisDate);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EarningsEvent[]>();
    for (const event of events) {
      const key = earningsEventDateKey(event, analysisKey);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [analysisKey, events]);

  const monthCandidates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const key of eventsByDay.keys()) {
      const monthKey = key.slice(0, 7);
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + (eventsByDay.get(key)?.length ?? 0));
    }
    if (!counts.size) return [analysisKey.slice(0, 7)];
    return [...counts.keys()].sort();
  }, [analysisKey, eventsByDay]);

  const preferredMonth = analysisKey.slice(0, 7);
  const fallbackMonth = monthCandidates.includes(preferredMonth)
    ? preferredMonth
    : (monthCandidates.find((candidate) => candidate >= preferredMonth) ?? monthCandidates[monthCandidates.length - 1] ?? preferredMonth);
  /** null = follow analysis month until the user navigates (avoids landing on 2023 history). */
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const requestedMonth = activeMonth ?? monthKey ?? preferredMonth;
  const activeMonthKey = monthCandidates.includes(requestedMonth) ? requestedMonth : fallbackMonth;
  const year = Number(activeMonthKey.slice(0, 4));
  const monthIndex = Number(activeMonthKey.slice(5, 7)) - 1;
  const cells = useMemo(() => monthMatrix(year, monthIndex), [monthIndex, year]);
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${activeMonthKey}-15T12:00:00+05:30`));

  const defaultSelectedDay = useMemo(() => {
    if (eventsByDay.has(analysisKey) && analysisKey.startsWith(activeMonthKey)) return analysisKey;
    const monthDays = [...eventsByDay.keys()].filter((key) => key.startsWith(activeMonthKey)).sort();
    return monthDays[0] ?? `${activeMonthKey}-01`;
  }, [activeMonthKey, analysisKey, eventsByDay]);

  const [selectedDay, setSelectedDay] = useState(defaultSelectedDay);
  const requestedDay = controlledSelectedDay ?? selectedDay;
  const activeDay = requestedDay.startsWith(activeMonthKey) && (eventsByDay.has(requestedDay) || cells.some((cell) => cell.key === requestedDay))
    ? requestedDay
    : defaultSelectedDay;
  const dayEvents = useMemo(() => eventsByDay.get(activeDay) ?? [], [activeDay, eventsByDay]);
  const visibleDayEvents = dayEvents.slice(0, TABLE_PREVIEW);
  const overflowDayEvents = dayEvents.slice(TABLE_PREVIEW);
  const columns = dayKpiSlots(dayEvents.length ? dayEvents : events.slice(0, 8));
  const monthIndexInCandidates = monthCandidates.indexOf(activeMonthKey);
  const monthEvents = useMemo(() => events.filter((event) => earningsEventDateKey(event, analysisKey)?.startsWith(activeMonthKey)), [activeMonthKey, analysisKey, events]);

  useEffect(() => {
    onActiveMonthChange?.(activeMonthKey, monthEvents);
  }, [activeMonthKey, monthEvents, onActiveMonthChange]);

  useEffect(() => {
    onActiveDayChange?.(activeDay, dayEvents);
  }, [activeDay, dayEvents, onActiveDayChange]);

  const selectMonth = (nextMonth: string) => {
    if (activeMonth === undefined) setMonthKey(nextMonth);
    onActiveMonthChange?.(nextMonth, events.filter((event) => earningsEventDateKey(event, analysisKey)?.startsWith(nextMonth)));
  };

  const selectDay = (nextDay: string) => {
    if (controlledSelectedDay === undefined) setSelectedDay(nextDay);
    onActiveDayChange?.(nextDay, eventsByDay.get(nextDay) ?? []);
  };

  return (
    <div className="earnings-month-calendar earnings-observatory">
      <div className="earnings-month-head">
        <div>
          <h4>{title} — {monthLabel}</h4>
          <p>{note ?? "Events from the Earnings calendar and tracked result rows. ★ marks a current holding."}</p>
        </div>
        {monthCandidates.length > 1 && (
          <div className="earnings-month-nav" role="group" aria-label="Select earnings month">
            {monthIndexInCandidates > 0 && <button type="button" onClick={() => selectMonth(monthCandidates[monthIndexInCandidates - 1])} aria-label="Previous month">‹</button>}
            {monthIndexInCandidates < monthCandidates.length - 1 && <button type="button" onClick={() => selectMonth(monthCandidates[monthIndexInCandidates + 1])} aria-label="Next month">›</button>}
          </div>
        )}
      </div>

      {showCalendarGrid && <><div className="earnings-month-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="earnings-month-grid" role="grid" aria-label={`${monthLabel} earnings calendar`}>
        {cells.map((cell, index) => {
          if (!cell.key || cell.day === null) {
            return <div key={`pad-${index}`} className="earnings-month-cell empty" role="gridcell" aria-hidden="true"/>;
          }
          const dayList = eventsByDay.get(cell.key) ?? [];
          const preview = dayList.slice(0, CELL_PREVIEW);
          const overflow = dayList.length - preview.length;
          const selected = cell.key === activeDay;
          const isToday = cell.key === analysisKey;
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              aria-selected={selected}
              className={`earnings-month-cell ${selected ? "selected" : ""} ${dayList.length ? "has-events" : ""} ${isToday ? "today" : ""}`}
              onClick={() => selectDay(cell.key!)}
            >
              <span className="earnings-month-daynum">{cell.day}</span>
              <ul>
                {preview.map((event) => {
                  const meta = sectorMetaForEvent(event);
                  return (
                    <li key={earningsEventKey(event)} style={{ "--dot": meta.color } as CSSProperties}>
                      <i aria-hidden="true"/>
                      <em>{event.name}{event.portfolio ? <span className="earnings-holding-star"> ★</span> : ""}</em>
                      {Boolean(event.holidayConflicts?.length) && <span className="market-conflict-badge">HOLIDAY</span>}
                    </li>
                  );
                })}
              </ul>
              {overflow > 0 && <small>+{overflow} more</small>}
            </button>
          );
        })}
      </div></>}

      {showDayTable && <div className="earnings-day-kpi">
        <div className="earnings-day-kpi-head">
          <h5>{formatDayHeading(activeDay)} — KPI analysis</h5>
          <span>{dayEvents.length} company {dayEvents.length === 1 ? "entry" : "entries"}</span>
        </div>
        {!dayEvents.length ? (
          <div className="earnings-day-empty">No earnings events on this date.</div>
        ) : (
          <div className="earnings-day-table-wrap">
            <table className="earnings-day-table earnings-result-telemetry">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Company</th>
                  {columns.map((column) => <th key={`col-${column.index}`}>{column.header}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleDayEvents.map((event) => {
                  const meta = sectorMetaForEvent(event);
                  const key = earningsEventKey(event);
                  const selected = selectedEventKey === key;
                  const tone = statusTone(event);
                  const scheduleOnly = !event.reported && !(event.kpis ?? []).some((kpi) => Boolean(kpi?.value));
                  return (
                    <tr
                      key={key}
                      className={`${tone} ${selected ? "selected" : ""} ${onSelectEvent ? "selectable" : ""}${scheduleOnly ? " schedule-evidence" : ""}`}
                      tabIndex={onSelectEvent ? 0 : undefined}
                      aria-selected={onSelectEvent ? selected : undefined}
                      onClick={onSelectEvent ? () => onSelectEvent(event) : undefined}
                      onKeyDown={onSelectEvent ? (press) => {
                        if (press.key === "Enter" || press.key === " ") {
                          press.preventDefault();
                          onSelectEvent(event);
                        }
                      } : undefined}
                    >
                      <td>
                        <b>{formatShortDate(activeDay)}</b>
                        <span className={`earnings-status ${tone}${!event.reported && /today/i.test(event.state) ? " pending-lock" : ""}`}>{event.reported ? "Reported" : /today/i.test(event.state) ? "Today" : "Due"}</span>
                        {scheduleOnly ? <small>schedule evidence</small> : null}
                      </td>
                      <td>
                        <b>{event.name}{event.portfolio ? <span className="earnings-holding-star"> ★</span> : ""}</b>
                        <small>{meta.name} · {event.symbol}</small>
                        {event.holidayConflicts?.map((conflict) => (
                          <span className="market-conflict-badge" key={`${conflict.market}-${conflict.holiday}`}>
                            {conflict.market} HOLIDAY · {conflict.holiday}
                          </span>
                        ))}
                      </td>
                      {columns.map((column) => {
                        const kpi = event.kpis[column.index];
                        return (
                          <td key={`${key}-${column.index}`} className={!kpi?.value ? "sealed" : undefined}>
                            {kpi?.value ? (
                              <>
                                {column.showPerRowLabel && kpi.label ? <em className="kpi-row-label">{kpi.label}</em> : null}
                                <b>{kpi.value}</b>
                                <small className={kpi.tone ?? ""}>{kpi.change || "\u00A0"}</small>
                              </>
                            ) : (
                              <>
                                {column.showPerRowLabel && kpi?.label ? <em className="kpi-row-label">{kpi.label}</em> : null}
                                <b className="blank">n/p</b>
                                <small>{event.reported ? "—" : "due"}</small>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {overflowDayEvents.length > 0 && (
                  <tr className="earnings-day-summary">
                    <td colSpan={2 + columns.length}>
                      <span>{overflowDayEvents.map((event) => event.name).slice(0, 3).join(" · ")}{overflowDayEvents.length > 3 ? ` + ${overflowDayEvents.length - 3} more on this day` : ""}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="earnings-day-footnote">
          <code>n/p</code> = not published · <code>est</code> = street estimate · <code>due</code> = not yet reported.
          Reported rows carry the actual printed KPIs from company or exchange sources; Today and Due rows show preview fields or blank values until publication.
          Calendar dates are scheduling evidence — refresh from Apple Calendar / company IR before treating a pending row as reported.
        </p>
      </div>}
      {showItemSummaries && dayEvents.length > 0 && (
        <div className="earnings-day-summaries" aria-label="Earnings item summaries">
          {dayEvents.map((event) => {
            const bullets = earningsEventBullets(event);
            return (
              <div key={`${earningsEventKey(event)}-summary`} className="earnings-day-summary-item">
                <h5>
                  {event.name}{event.portfolio ? " ★" : ""} <small>{event.symbol} · {event.period}</small>
                  {Boolean(event.holidayConflicts?.length) && <span className="market-conflict-badge">HOLIDAY CONFLICT</span>}
                </h5>
                <ul className="digest-summary-bullets">
                  {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
