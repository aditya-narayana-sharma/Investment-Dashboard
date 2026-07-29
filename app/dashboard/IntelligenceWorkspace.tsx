"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Mail, Mic2, Newspaper, NotebookTabs, ShieldAlert } from "lucide-react";
import {
  ASTRONOMY_SPACE_LABEL,
  COMPLETED_FEED_LABEL,
  DAILY_FEED_LABEL,
  DOWNLOAD_LIST_FEED_LABEL,
  EARNINGS_FEED_LABEL,
  F1_LABEL,
  GUITAR_PRACTICE_LABEL,
  HINDU_HOLIDAYS_FEED_LABEL,
  INDIA_HOLIDAYS_FEED_LABEL,
  REPEATS_FEED_LABEL,
  SCHEDULED_FEED_LABEL,
  WATCHLIST_FEED_LABEL,
  WORK_JOBS_LABEL,
  isScheduledRemindersCalendar,
  partitionCalendarActionFeeds,
} from "../calendar-action-feeds";
import { holidayCalendarKind, partitionPersonalCalendarFeeds } from "../calendar-holiday-feeds";
import type { AppleCalendarItem, AppleTaskItem, ContentDigestSnapshot, DigestItem } from "../content-types";
import { digestItemBullets } from "../digest-bullets";
import type { EarningsSnapshot } from "../earnings-live-types";
import { EarningsMonthCalendar } from "./EarningsMonthCalendar";
import { CollapsibleSection, DailyKanbanBoard } from "./shared-ui";
import { DIGEST_PAGE_SIZE, mergeEarningsCalendarEvents, resolveEarningsIdentity } from "./utils";

const COMPLETED_PAGE_SIZE = 24;
const SCHEDULED_PAGE_SIZE = 24;
const BOX_PAGE_SIZE = 12;

function DigestBulletList({ bullets }: { bullets: string[] }) {
  if (!bullets.length) return null;
  return <ul className="digest-summary-bullets">{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>;
}

function DigestMailItem({ item, kind }: { item: DigestItem; kind: "mail" | "podcast" }) {
  const bullets = digestItemBullets({ ...item, kind });
  return (
    <div>
      <span>{item.time}</span>
      <div>
        <b>{item.source}</b>
        <h4>{item.title}</h4>
        <DigestBulletList bullets={bullets} />
      </div>
    </div>
  );
}

function formatShortWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function CalendarFeedItem({ item }: { item: AppleCalendarItem }) {
  const starts = formatShortWhen(item.startsAt);
  const ends = item.endsAt && item.endsAt !== item.startsAt ? formatShortWhen(item.endsAt) : "";
  return (
    <div className="topic-feed-item">
      <b>{new Date(item.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</b>
      <div>
        <strong>{item.title}</strong>
        <small className="topic-feed-meta">
          {[item.calendar, starts ? `Starts ${starts}` : "", ends ? `Ends ${ends}` : ""].filter(Boolean).join(" · ")}
        </small>
      </div>
    </div>
  );
}

function ReminderFeedItem({
  item,
  marker = "TODO",
  onComplete,
  completing,
}: {
  item: AppleTaskItem;
  marker?: string;
  onComplete?: (item: AppleTaskItem) => void;
  completing?: boolean;
}) {
  const due = formatShortWhen(item.dueAt);
  const done = formatShortWhen(item.completedAt);
  const meta = [
    item.list,
    due ? `Due ${due}` : "",
    item.completed && done ? `Completed ${done}` : "",
    item.repeating && item.repeatsOn ? item.repeatsOn : "",
  ].filter(Boolean);
  const canComplete = Boolean(onComplete) && !item.completed;
  return (
    <div className={`topic-feed-item${item.completed ? " topic-feed-item-done" : ""}`}>
      <label className="topic-feed-check">
        <input
          type="checkbox"
          checked={item.completed}
          disabled={!canComplete || completing}
          aria-label={item.completed ? `Completed: ${item.title}` : `Mark complete: ${item.title}`}
          onChange={(event) => {
            if (event.target.checked && canComplete) onComplete?.(item);
          }}
        />
      </label>
      <div>
        <strong>
          <span className="topic-feed-marker">{marker}</span> {item.title}
        </strong>
        {meta.length > 0 && <small className="topic-feed-meta">{meta.join(" · ")}</small>}
      </div>
    </div>
  );
}

function FeedShowAll({
  total,
  pageSize,
  expanded,
  onExpand,
  onCollapse,
}: {
  total: number;
  pageSize: number;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  if (total <= pageSize) return null;
  return expanded ? (
    <button type="button" className="digest-show-all" onClick={onCollapse}>
      Show fewer
    </button>
  ) : (
    <button type="button" className="digest-show-all" onClick={onExpand}>
      Show all {total}
    </button>
  );
}

function ReminderBox({
  label,
  className,
  note,
  items,
  marker,
  pageSize = BOX_PAGE_SIZE,
  emptyText,
  onComplete,
  completingId,
}: {
  label: string;
  className?: string;
  note?: string;
  items: AppleTaskItem[];
  marker: string;
  pageSize?: number;
  emptyText?: string;
  onComplete?: (item: AppleTaskItem) => void;
  completingId?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, pageSize);
  return (
    <section className={className} aria-label={label}>
      <h4>
        {label}
        <span>{items.length}</span>
      </h4>
      {note && <p className="topic-feed-section-note">{note}</p>}
      {items.length === 0 && <p className="topic-feed-section-note">{emptyText || "No items."}</p>}
      {visible.map((item) => (
        <ReminderFeedItem
          key={item.id}
          item={item}
          marker={marker}
          onComplete={item.completed ? undefined : onComplete}
          completing={completingId === item.id}
        />
      ))}
      <FeedShowAll
        total={items.length}
        pageSize={pageSize}
        expanded={showAll}
        onExpand={() => setShowAll(true)}
        onCollapse={() => setShowAll(false)}
      />
    </section>
  );
}

function CalendarBox({
  label,
  ariaLabel,
  items,
  pageSize = BOX_PAGE_SIZE,
  className,
  note,
  children,
}: {
  label: string;
  ariaLabel?: string;
  items: AppleCalendarItem[];
  pageSize?: number;
  className?: string;
  note?: string;
  children?: ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, pageSize);
  return (
    <section className={className} aria-label={ariaLabel || label}>
      <h4>
        {label}
        <span>{items.length}</span>
      </h4>
      {note && <p className="topic-feed-section-note">{note}</p>}
      {children}
      {items.length === 0 && !children && <p className="topic-feed-section-note">No events in this window.</p>}
      {visible.map((item) => (
        <CalendarFeedItem key={item.id} item={item} />
      ))}
      <FeedShowAll
        total={items.length}
        pageSize={pageSize}
        expanded={showAll}
        onExpand={() => setShowAll(true)}
        onCollapse={() => setShowAll(false)}
      />
    </section>
  );
}

/** Complete, unfiltered Live Intelligence Digest — single source for Market Intelligence. */
export function SectorIntelligenceDigest({
  content,
  mailWindow,
  earningsSnapshot,
}: {
  content: ContentDigestSnapshot;
  mailWindow: string;
  earningsSnapshot: EarningsSnapshot;
}) {
  const newsletters = content.newsletters;
  const axisResearch = content.axisResearch;
  const podcasts = content.podcasts;
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
    () => content.calendar.filter((item) => !isScheduledRemindersCalendar(item)),
    [content.calendar],
  );
  const feeds = useMemo(() => partitionCalendarActionFeeds(calendar, reminders), [calendar, reminders]);
  const holidayFeeds = useMemo(
    () => partitionPersonalCalendarFeeds(calendar.filter((item) => holidayCalendarKind(item.calendar) != null)),
    [calendar],
  );
  const {
    completedReminders,
    scheduledReminders,
    repeatingReminders,
    dailyReminders,
    astronomyEvents,
    f1Events,
    workEvents,
    jobReminders,
    earningsCalendarEvents,
    earningsReminders,
    guitarEvents,
    guitarReminders,
    watchlistReminders,
    downloadListReminders,
  } = feeds;
  const { indiaHolidays, hinduHolidays } = holidayFeeds;
  const contentForEarnings = useMemo(() => ({ ...content, calendar }), [content, calendar]);
  const earningsEvents = useMemo(
    () => mergeEarningsCalendarEvents(earningsSnapshot, contentForEarnings),
    [contentForEarnings, earningsSnapshot],
  );
  const earningsSymbols = useMemo(
    () => new Set(earningsEvents.map((event) => event.symbol.toLowerCase())),
    [earningsEvents],
  );
  const supplementalEarningsCalendar = useMemo(
    () =>
      earningsCalendarEvents.filter((item) => {
        const identity = resolveEarningsIdentity(item.title, earningsEvents);
        return !earningsSymbols.has(identity.symbol.toLowerCase());
      }),
    [earningsCalendarEvents, earningsEvents, earningsSymbols],
  );
  const workJobsCount = workEvents.length + jobReminders.length;
  const guitarCount = guitarEvents.length + guitarReminders.length;
  const earningsBoxCount = earningsEvents.length + supplementalEarningsCalendar.length + earningsReminders.length;

  const [showAllNewsletters, setShowAllNewsletters] = useState(false);
  const [showAllAxis, setShowAllAxis] = useState(false);
  const [showAllPodcasts, setShowAllPodcasts] = useState(false);
  const [showAllWorkJobs, setShowAllWorkJobs] = useState(false);
  const [showAllEarnReminders, setShowAllEarnReminders] = useState(false);
  const [showAllGuitarReminders, setShowAllGuitarReminders] = useState(false);

  const visibleNewsletters = showAllNewsletters ? newsletters : newsletters.slice(0, DIGEST_PAGE_SIZE);
  const visibleAxis = showAllAxis ? axisResearch : axisResearch.slice(0, DIGEST_PAGE_SIZE);
  const visiblePodcasts = showAllPodcasts ? podcasts : podcasts.slice(0, DIGEST_PAGE_SIZE);
  const visibleWorkEvents = showAllWorkJobs ? workEvents : workEvents.slice(0, BOX_PAGE_SIZE);
  const visibleJobReminders = showAllWorkJobs ? jobReminders : jobReminders.slice(0, BOX_PAGE_SIZE);
  const visibleEarningsReminders = showAllEarnReminders ? earningsReminders : earningsReminders.slice(0, BOX_PAGE_SIZE);
  const visibleGuitarReminders = showAllGuitarReminders ? guitarReminders : guitarReminders.slice(0, BOX_PAGE_SIZE);

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
      <article className="panel digest-panel">
        <div className="panel-title">
          <div>
            <h3>Newsletter digest</h3>
            <p>
              iCloud · Newsletters · {mailWindow} · {newsletters.length} items · content bullets from mail body only
            </p>
          </div>
          <Mail size={18} />
        </div>
        <div className="digest-list">
          {visibleNewsletters.map((item) => (
            <DigestMailItem key={`${item.time}-${item.source}-${item.title}`} item={item} kind="mail" />
          ))}
          {!newsletters.length && (
            <div className="digest-empty">No item was available from the exact iCloud → Newsletters mailbox in this window.</div>
          )}
          {newsletters.length > DIGEST_PAGE_SIZE && !showAllNewsletters && (
            <button type="button" className="digest-show-all" onClick={() => setShowAllNewsletters(true)}>
              Show all {newsletters.length}
            </button>
          )}
          {showAllNewsletters && newsletters.length > DIGEST_PAGE_SIZE && (
            <button type="button" className="digest-show-all" onClick={() => setShowAllNewsletters(false)}>
              Show fewer
            </button>
          )}
        </div>
      </article>
      <article className="panel digest-panel">
        <div className="panel-title">
          <div>
            <h3>Axis Research</h3>
            <p>
              iCloud · Axis Research · {axisResearch.length} reports · {mailWindow} · content bullets from research body only
            </p>
          </div>
          <Newspaper size={18} />
        </div>
        <div className="digest-list">
          {visibleAxis.map((item) => (
            <DigestMailItem key={`${item.time}-${item.title}`} item={item} kind="mail" />
          ))}
          {!axisResearch.length && <div className="digest-empty">No Axis Research item was available for this window.</div>}
          {axisResearch.length > DIGEST_PAGE_SIZE && !showAllAxis && (
            <button type="button" className="digest-show-all" onClick={() => setShowAllAxis(true)}>
              Show all {axisResearch.length}
            </button>
          )}
          {showAllAxis && axisResearch.length > DIGEST_PAGE_SIZE && (
            <button type="button" className="digest-show-all" onClick={() => setShowAllAxis(false)}>
              Show fewer
            </button>
          )}
        </div>
      </article>
      <article className="panel digest-panel digest-panel-podcasts">
        <div className="panel-title">
          <div>
            <h3>Podcast summaries</h3>
            <p>
              {podcasts.length} episodes from the latest local refresh · content bullets from transcript when cached,
              otherwise episode description
            </p>
          </div>
          <Mic2 size={18} />
        </div>
        <div className="digest-list podcast-digest">
          {visiblePodcasts.map((item, index) => (
            <DigestMailItem
              key={`${item.time}-${item.source}-${item.title}`}
              item={{ ...item, time: item.time || String(index + 1).padStart(2, "0") }}
              kind="podcast"
            />
          ))}
          {!podcasts.length && <div className="digest-empty">No podcast episode was available in this window.</div>}
          {podcasts.length > DIGEST_PAGE_SIZE && !showAllPodcasts && (
            <button type="button" className="digest-show-all" onClick={() => setShowAllPodcasts(true)}>
              Show all {podcasts.length}
            </button>
          )}
          {showAllPodcasts && podcasts.length > DIGEST_PAGE_SIZE && (
            <button type="button" className="digest-show-all" onClick={() => setShowAllPodcasts(false)}>
              Show fewer
            </button>
          )}
        </div>
      </article>
      <article className="panel digest-panel digest-panel-span">
        <div className="panel-title">
          <div>
            <h3>Calendar + action feeds</h3>
            <p>
              {calendar.length} calendar · {earningsEvents.length} earnings events · {scheduledReminders.length} scheduled ·{" "}
              {completedReminders.length} completed · {repeatingReminders.length} repeating · {dailyReminders.length} daily ·{" "}
              {watchlistReminders.length} watchlist · {downloadListReminders.length} downloads · title/meta only (no 5-bullet padding)
            </p>
          </div>
          <NotebookTabs size={18} />
        </div>
        {completeError && (
          <div className="refresh-error topic-feed-complete-error">
            <ShieldAlert size={15} />
            <span>{completeError}</span>
          </div>
        )}
        <div className="topic-feed">
          {/* Dense 3-col: Work full · Completed|Scheduled|Repeats · Daily|Watchlist|Download · Guitar|India|Hindu · Earnings full · Astronomy|F1 */}
          <section className="topic-feed-work" aria-label={WORK_JOBS_LABEL}>
            <h4>
              {WORK_JOBS_LABEL}
              <span>{workJobsCount}</span>
            </h4>
            <p className="topic-feed-section-note">Work / ANS calendar plus incomplete Job 🔍 reminders.</p>
            {workJobsCount === 0 && <p className="topic-feed-section-note">No work events or job reminders.</p>}
            {visibleWorkEvents.map((item) => (
              <CalendarFeedItem key={item.id} item={item} />
            ))}
            {visibleJobReminders.map((item) => (
              <ReminderFeedItem
                key={item.id}
                item={item}
                marker="JOB"
                onComplete={completeReminder}
                completing={completingId === item.id}
              />
            ))}
            <FeedShowAll
              total={Math.max(workEvents.length, jobReminders.length)}
              pageSize={BOX_PAGE_SIZE}
              expanded={showAllWorkJobs}
              onExpand={() => setShowAllWorkJobs(true)}
              onCollapse={() => setShowAllWorkJobs(false)}
            />
          </section>
          <ReminderBox
            label={COMPLETED_FEED_LABEL}
            className="topic-feed-completed"
            note="Evidence only — completed Reminders are not restored as actionable."
            items={completedReminders}
            marker="DONE"
            pageSize={COMPLETED_PAGE_SIZE}
            emptyText="No completed reminders in this refresh."
          />
          <ReminderBox
            label={SCHEDULED_FEED_LABEL}
            className="topic-feed-scheduled"
            note="Pending non-repeating reminders outside dedicated lists — Scheduled Reminders calendar clones excluded."
            items={scheduledReminders}
            marker="DUE"
            pageSize={SCHEDULED_PAGE_SIZE}
            emptyText="No scheduled reminders."
            onComplete={completeReminder}
            completingId={completingId}
          />
          <ReminderBox
            label={REPEATS_FEED_LABEL}
            className="topic-feed-repeats"
            note="Incomplete reminders with a recurrence rule, or from the 🔁 REPEATS ON list — excludes Daily/Log list items."
            items={repeatingReminders}
            marker="RPT"
            emptyText="No repeating reminders."
            onComplete={completeReminder}
            completingId={completingId}
          />
          <ReminderBox
            label={DAILY_FEED_LABEL}
            className="topic-feed-daily"
            note="All incomplete reminders from Daily and Log lists."
            items={dailyReminders}
            marker="DAY"
            emptyText="No daily reminders."
            onComplete={completeReminder}
            completingId={completingId}
          />
          <ReminderBox
            label={WATCHLIST_FEED_LABEL}
            className="topic-feed-watchlist"
            note="Incomplete items from the Watchlist reminders list."
            items={watchlistReminders}
            marker="WATCH"
            emptyText="No watchlist reminders."
            onComplete={completeReminder}
            completingId={completingId}
          />
          <ReminderBox
            label={DOWNLOAD_LIST_FEED_LABEL}
            className="topic-feed-download-list"
            note="Incomplete items from the Download List reminders list."
            items={downloadListReminders}
            marker="DL"
            emptyText="No download-list reminders."
            onComplete={completeReminder}
            completingId={completingId}
          />
          <section className="topic-feed-guitar" aria-label={GUITAR_PRACTICE_LABEL}>
            <h4>
              {GUITAR_PRACTICE_LABEL}
              <span>{guitarCount}</span>
            </h4>
            <p className="topic-feed-section-note">Guitar Practice calendar and Guitar Chords reminders.</p>
            {guitarCount === 0 && <p className="topic-feed-section-note">No guitar practice items.</p>}
            {guitarEvents.map((item) => (
              <CalendarFeedItem key={item.id} item={item} />
            ))}
            {visibleGuitarReminders.map((item) => (
              <ReminderFeedItem
                key={item.id}
                item={item}
                marker="GTR"
                onComplete={completeReminder}
                completing={completingId === item.id}
              />
            ))}
            <FeedShowAll
              total={guitarReminders.length}
              pageSize={BOX_PAGE_SIZE}
              expanded={showAllGuitarReminders}
              onExpand={() => setShowAllGuitarReminders(true)}
              onCollapse={() => setShowAllGuitarReminders(false)}
            />
          </section>
          <CalendarBox label={INDIA_HOLIDAYS_FEED_LABEL} className="topic-feed-india" ariaLabel="India Holidays" items={indiaHolidays} />
          <CalendarBox label={HINDU_HOLIDAYS_FEED_LABEL} className="topic-feed-hindu" ariaLabel="Hindu Holidays" items={hinduHolidays} />
          <section className="topic-feed-earnings" aria-label={EARNINGS_FEED_LABEL}>
            <h4>
              {EARNINGS_FEED_LABEL}
              <span>{earningsBoxCount}</span>
            </h4>
            <p className="topic-feed-section-note">Earnings month grid, Earnings calendar rows, and incomplete Earnings reminders.</p>
            {earningsEvents.length > 0 && (
              <EarningsMonthCalendar
                events={earningsEvents}
                analysisDate={earningsSnapshot.analysisDate || content.investment.analysisDate}
                title="Earnings calendar"
                note="Complete unfiltered earnings schedule · select a day for KPI analysis. ★ denotes a holding."
                showItemSummaries
              />
            )}
            {supplementalEarningsCalendar.slice(0, BOX_PAGE_SIZE).map((item) => (
              <CalendarFeedItem key={item.id} item={item} />
            ))}
            {visibleEarningsReminders.map((item) => (
              <ReminderFeedItem
                key={item.id}
                item={item}
                marker="ERN"
                onComplete={completeReminder}
                completing={completingId === item.id}
              />
            ))}
            {earningsBoxCount === 0 && <p className="topic-feed-section-note">No earnings items.</p>}
            <FeedShowAll
              total={earningsReminders.length}
              pageSize={BOX_PAGE_SIZE}
              expanded={showAllEarnReminders}
              onExpand={() => setShowAllEarnReminders(true)}
              onCollapse={() => setShowAllEarnReminders(false)}
            />
          </section>
          <CalendarBox label={ASTRONOMY_SPACE_LABEL} className="topic-feed-astronomy" items={astronomyEvents} pageSize={8} />
          <CalendarBox label={F1_LABEL} className="topic-feed-f1" items={f1Events} pageSize={8} />
        </div>
        <div className="digest-note">
          This complete intelligence digest is local and read-only except Reminder checkboxes. Mail bodies and Podcast
          descriptions remain on this Mac. Newsletter, Axis, Podcast, and Earnings bullets are content takeaways only —
          Calendar and Reminders show title/meta without 5-bullet padding.
        </div>
      </article>
    </section>
  );
}

export function IntelligenceWorkspace({
  content,
  contentError,
  mailWindow,
  earningsSnapshot,
  earningsError,
}: {
  content: ContentDigestSnapshot;
  contentError: string;
  mailWindow: string;
  earningsSnapshot: EarningsSnapshot;
  earningsError: string;
}) {
  return (
    <>
      <div className="workspace-section">
        <CollapsibleSection
          number="M-1" title="Market intelligence action board"
          note="Clickable daily source, evidence and monitoring actions"
        >
          <DailyKanbanBoard workspace="intelligence"/>
        </CollapsibleSection>
      </div>
      <div className="workspace-section">
        <CollapsibleSection
          number="M-2" title="Live intelligence digest"
          note={
            content.status === "live"
              ? `Mail, Calendar, earnings schedule, Reminders, Notes and Podcasts · updated ${content.asOf}`
              : contentError
                ? `refresh issue: ${contentError}`
                : "waiting for local refresh"
          }
        >
          {earningsError && (
            <div className="refresh-error">
              <ShieldAlert size={15} />
              <span>{earningsError}</span>
            </div>
          )}
          <SectorIntelligenceDigest content={content} mailWindow={mailWindow} earningsSnapshot={earningsSnapshot} />
        </CollapsibleSection>
      </div>
    </>
  );
}
