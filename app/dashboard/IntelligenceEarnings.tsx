"use client";

import { useMemo } from "react";
import type { ContentDigestSnapshot } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import type { LiveHolding } from "../live-types";
import { findEarningsHolidayConflicts } from "../market-calendar";
import { EarningsMonthCalendar } from "./EarningsMonthCalendar";
import { earningsReconciliationStats, mergeEarningsCalendarEvents } from "./utils";
import { useSatyaTaskContext } from "./satya-workspace";
import { EARNINGS_SATYA_SUGGESTIONS, satyaSuggestionsForWorkspace } from "./satya-suggestions";

const EARNINGS_LLM_SUGGESTIONS = EARNINGS_SATYA_SUGGESTIONS;
export function MarketEarningsCalendar({
  content,
  snapshot,
  holdings,
}: {
  content: ContentDigestSnapshot;
  snapshot: EarningsSnapshot;
  holdings: LiveHolding[];
}) {
  const events = useMemo(() => mergeEarningsCalendarEvents(snapshot, content, holdings), [content, holdings, snapshot]);
  const reconciliation = useMemo(
    () => earningsReconciliationStats(snapshot, content, holdings, events),
    [content, events, holdings, snapshot],
  );
  const holidayConflicts = useMemo(
    () => findEarningsHolidayConflicts(events, content.calendar, snapshot.analysisDate || content.investment.analysisDate),
    [content.calendar, content.investment.analysisDate, events, snapshot.analysisDate],
  );
  const conflictByEvent = useMemo(() => {
    const map = new Map<string, typeof holidayConflicts>();
    for (const conflict of holidayConflicts) {
      map.set(conflict.eventKey, [...(map.get(conflict.eventKey) ?? []), conflict]);
    }
    return map;
  }, [holidayConflicts]);
  const eventsWithConflicts = useMemo(
    () => events.map((event) => ({
      ...event,
      holidayConflicts: conflictByEvent.get(`${event.date}|${event.symbol}|${event.name}`) ?? [],
    })),
    [conflictByEvent, events],
  );

  useSatyaTaskContext("intelligence-m3", {
    task: "summarize",
    hint: satyaSuggestionsForWorkspace("intelligence", { section: "m3" }).hint
      ?? "Uses verified reported KPIs only. Unpublished fields stay blank. Calendar rows stay scheduling evidence.",
    suggestions: EARNINGS_LLM_SUGGESTIONS,
    context: events.slice(0, 12).map((event) => {
      const kpis = event.reported
        ? event.kpis.map((kpi) => `${kpi.label} ${kpi.value || "—"}`).join(", ")
        : "unpublished KPIs blank";
      return `${event.date} ${event.symbol} ${event.state} reported=${event.reported} ${kpis}`;
    }).join("\n"),
    placeholder: "e.g. What did independently verified prints say this week?",
  });

  return <article className="panel earnings-workbench market-earnings-workbench" data-earnings-owner="m3">
    <div className="panel-title">
      <div>
        <h3>Complete earnings calendar</h3>
        <p>{events.length} tracked events · {events.filter((event) => event.reported).length} independently verified reported · calendar-only rows remain pending</p>
      </div>
      <span className={`pill ${snapshot.status === "verified" ? "green" : "amber"}`}>{snapshot.status} · {snapshot.asOf}</span>
    </div>
    <div className="earnings-reconciliation-strip" aria-label="Sanitized earnings reconciliation counts">
      <span><b>{reconciliation.discovered}</b> discovered</span>
      <span><b>{reconciliation.newlyAdded}</b> new</span>
      <span><b>{reconciliation.updated}</b> updated</span>
      <span><b>{reconciliation.deduplicated}</b> deduplicated</span>
      <span><b>{reconciliation.verifiedReported}</b> verified reported</span>
      <span><b>{reconciliation.pendingUpcoming}</b> pending / upcoming</span>
    </div>
    {eventsWithConflicts.length ? (
      <EarningsMonthCalendar
        events={eventsWithConflicts}
        analysisDate={snapshot.analysisDate || content.investment.analysisDate}
        title="Earnings calendar"
        note="Apple Calendar entries are scheduling evidence only. KPI values require company IR or NSE verification."
        showItemSummaries
      />
    ) : (
      <p className="intelligence-feed-empty">No tracked earnings events were available.</p>
    )}
  </article>;
}
