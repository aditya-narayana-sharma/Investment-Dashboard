"use client";

import { useMemo, useState } from "react";
import { NotebookTabs, ShieldAlert } from "lucide-react";
import {
  COMPLETED_FEED_LABEL,
  SCHEDULED_FEED_LABEL,
  WORK_JOBS_LABEL,
  isEarningsCalendar,
  isScheduledRemindersCalendar,
  partitionReminderSmartGroups,
  sortCalendarItems,
} from "../calendar-action-feeds";
import type { AppleTaskItem, ContentDigestSnapshot } from "../content-types";
import { AppleMonthlyCalendar } from "./AppleMonthlyCalendar";
import {
  COMPLETED_PAGE_SIZE,
  IntelligenceFeedSection,
  ReminderBox,
  SCHEDULED_PAGE_SIZE,
} from "./intelligence-reminder-feeds";
import { SATYA_BRIEFING_SUGGESTIONS } from "./SatyaBriefingRoom";

export { SATYA_BRIEFING_SUGGESTIONS as LIVE_INTELLIGENCE_LLM_SUGGESTIONS };

/** My Feed H-4 Calendar + Reminders only — Satya owns M-2; digest walls are not mounted here. */
export function SectorIntelligenceDigest({
  content,
  view,
}: {
  content: ContentDigestSnapshot;
  mailWindow?: string;
  view: "calendar-reminders";
}) {
  void view;
  const [completedOverrides, setCompletedOverrides] = useState<Map<string, AppleTaskItem>>(() => new Map());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState("");

  const reminders = useMemo(() => {
    if (!completedOverrides.size) return content.reminders;
    const byId = new Map(content.reminders.map((row) => [row.id, row]));
    for (const [id, item] of completedOverrides) {
      const source = byId.get(id);
      if (source?.completed) continue;
      byId.set(id, item);
    }
    return [...byId.values()];
  }, [completedOverrides, content.reminders]);
  const calendar = useMemo(
    () => sortCalendarItems(content.calendar.filter((item) => !isScheduledRemindersCalendar(item) && !isEarningsCalendar(item.calendar))),
    [content.calendar],
  );
  const reminderGroups = useMemo(() => partitionReminderSmartGroups(reminders), [reminders]);
  const {
    completedReminders,
    scheduledImportantReminders,
    workJobReminders,
    omittedUnimportantCount,
    allowedCount,
  } = reminderGroups;
  const displayedReminderCount = completedReminders.length + scheduledImportantReminders.length + workJobReminders.length;

  async function completeReminder(item: AppleTaskItem) {
    if (item.completed || completingId) return;
    const completedAt = new Date().toISOString();
    setCompletingId(item.id);
    setCompleteError("");
    setCompletedOverrides((previous) => {
      const next = new Map(previous);
      next.set(item.id, { ...item, completed: true, completedAt });
      return next;
    });
    const rollbackOptimistic = () => {
      setCompletedOverrides((previous) => {
        const next = new Map(previous);
        next.delete(item.id);
        return next;
      });
    };
    try {
      const response = await fetch("/api/content/reminders/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, title: item.title, list: item.list ?? "" }),
        cache: "no-store",
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; blocker?: string };
      if (!response.ok || payload.ok === false) {
        rollbackOptimistic();
        setCompleteError(
          payload.blocker ||
            payload.error ||
            "Apple Reminders write-back failed. Item was not marked complete in the Reminders app.",
        );
        return;
      }
      void fetch(`/api/content/refresh?force=1&refresh=${Date.now()}`, { cache: "no-store" }).catch(() => undefined);
    } catch (error) {
      rollbackOptimistic();
      setCompleteError(
        error instanceof Error
          ? error.message
          : "Could not reach the reminders complete endpoint. Item was not marked complete in Apple Reminders.",
      );
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <section className="digest-grid">
      <article className="panel digest-panel digest-panel-span">
        <div className="panel-title">
          <div>
            <h3>Calendar + action feeds</h3>
            <p>
              One complete Calendar section · one allowed Reminders section · {calendar.length} calendar entries ·{" "}
              {displayedReminderCount} reminders shown
            </p>
          </div>
          <NotebookTabs size={18} />
        </div>
        <div className="intelligence-feed-stack agenda-ribbon triptych-command">
          <IntelligenceFeedSection
            kind="calendar"
            title="Calendar"
            count={calendar.length}
            note={`${calendar.length} complete, unfiltered non-earnings calendar entries`}
          >
            {calendar.length === 0 && (
              <p className="intelligence-feed-empty">No Apple Calendar events were available in the refreshed window.</p>
            )}
            {calendar.length > 0 && <AppleMonthlyCalendar events={calendar} />}
          </IntelligenceFeedSection>
          <IntelligenceFeedSection
            kind="reminders"
            title="Reminders"
            count={displayedReminderCount}
            note={`${displayedReminderCount} shown from ${allowedCount} allowed · ${omittedUnimportantCount} unscheduled non-important omitted`}
          >
            {completeError && (
              <div className="refresh-error topic-feed-complete-error">
                <ShieldAlert size={15} />
                <span>{completeError}</span>
              </div>
            )}
            <div className="reminder-smart-groups">
              <ReminderBox
                label={COMPLETED_FEED_LABEL}
                className="topic-feed-completed"
                note="Evidence only — completed reminders remain completed and are never restored to active."
                items={completedReminders}
                marker="DONE"
                pageSize={COMPLETED_PAGE_SIZE}
                emptyText="No completed reminder evidence in this refresh."
              />
              <ReminderBox
                label={SCHEDULED_FEED_LABEL}
                className="topic-feed-scheduled"
                note="Active due, flagged, urgent, priority, or earnings reminders."
                items={scheduledImportantReminders}
                marker="DUE"
                pageSize={SCHEDULED_PAGE_SIZE}
                emptyText="No scheduled or important reminders."
                onComplete={completeReminder}
                completingId={completingId}
              />
              <ReminderBox
                label={WORK_JOBS_LABEL}
                className="topic-feed-work"
                note="Active actionable reminders from the exact Job 🔍 list."
                items={workJobReminders}
                marker="JOB"
                emptyText="No active Work / Job 🔍 reminders."
                onComplete={completeReminder}
                completingId={completingId}
              />
            </div>
            {displayedReminderCount === 0 && (
              <p className="intelligence-feed-empty">No allowed reminder matched the three smart groups.</p>
            )}
          </IntelligenceFeedSection>
        </div>
        <div className="digest-note">
          Calendar and Reminders show title/meta without 5-bullet padding. Apple Calendar entries are scheduling evidence
          only. Mail, Axis PDFs, podcasts, and verified earnings stay in Satya.
        </div>
      </article>
    </section>
  );
}
