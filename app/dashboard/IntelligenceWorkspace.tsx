"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Bookmark, BookmarkCheck, ChevronDown, ExternalLink, FileText, Mail, Mic2, Newspaper, NotebookTabs, ShieldAlert } from "lucide-react";
import {
  COMPLETED_FEED_LABEL,
  SCHEDULED_FEED_LABEL,
  WORK_JOBS_LABEL,
  groupCalendarItemsBySource,
  isEarningsCalendar,
  isScheduledRemindersCalendar,
  partitionReminderSmartGroups,
  sortCalendarItems,
} from "../calendar-action-feeds";
import type { AppleCalendarItem, AppleTaskItem, ContentDigestSnapshot, DigestItem } from "../content-types";
import { digestItemBullets, isDigestContentWorthy } from "../digest-bullets";
import type { EarningsSnapshot } from "../earnings-live-types";
import type { LiveHolding } from "../live-types";
import { findEarningsHolidayConflicts } from "../market-calendar";
import { EarningsMonthCalendar } from "./EarningsMonthCalendar";
import { CollapsibleSection, DailyKanbanBoard, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import { WaveformStrip } from "./visual-components";
import { DIGEST_PAGE_SIZE, earningsReconciliationStats, mergeEarningsCalendarEvents } from "./utils";

const COMPLETED_PAGE_SIZE = 24;
const SCHEDULED_PAGE_SIZE = 24;
const BOX_PAGE_SIZE = 12;
const AXIS_TOPIC_RULES: Array<{ label: string; matcher: RegExp }> = [
  { label: "Target Achieved", matcher: /\btarget achieved\b/i },
  { label: "Punch", matcher: /\baxis punch\b|\bpunch\b/i },
  { label: "Result Updates", matcher: /\bresult updates?\b|\bresult update\b/i },
  { label: "Daily Technical Outlook", matcher: /\bdaily technical outlook\b|\btechnical outlook\b/i },
  { label: "Daily Morning Note", matcher: /\bdaily morning note\b|\bmorning note\b|\btrade setup for the day\b/i },
  { label: "Axis Alpha", matcher: /\baxis alpha\b/i },
  { label: "Event Updates", matcher: /\bevent update\b|\bmonetary policy\b/i },
  { label: "Monthly Quant", matcher: /\bmonthly quant\b|\bquant report\b/i },
  { label: "Pick of the Week", matcher: /\bpick of the week\b/i },
  { label: "Company Update", matcher: /\bcompany update\b|\bannual analysis\b/i },
];
const REMINDER_TOPIC_FALLBACKS: Record<AppleTaskItem["topic"], { color: string; text: "#000" | "#FFF" }> = {
  Earnings: { color: "#2563EB", text: "#FFF" },
  "Work/Jobs": { color: "#F97316", text: "#000" },
  Health: { color: "#16A34A", text: "#FFF" },
  Personal: { color: "#9333EA", text: "#FFF" },
  Other: { color: "#64748B", text: "#FFF" },
};

function DigestBulletList({ bullets, evidenceChips = false }: { bullets: string[]; evidenceChips?: boolean }) {
  const [focused, setFocused] = useState<string | null>(null);
  if (!bullets.length) return null;
  if (!evidenceChips) return <ul className="digest-summary-bullets">{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>;
  return <div className="digest-evidence-chips" role="list">
    {bullets.map((bullet) => (
      <button
        type="button"
        role="listitem"
        key={bullet}
        className={`evidence-chip${focused === bullet ? " focused" : focused ? "" : " focused"}`}
        onClick={() => setFocused((current) => current === bullet ? null : bullet)}
      >{bullet}</button>
    ))}
  </div>;
}

type DigestKind = "mail" | "podcast";
type DigestGroupLayout = "mail" | "axis" | "podcasts";

const SENDER_GROUP_COLORS = [
  "#4f8ff7",
  "#35c98b",
  "#f0b429",
  "#ef6a78",
  "#9b7de3",
  "#35b6c8",
  "#ef8f61",
  "#ca70ae",
];

function digestSender(item: DigestItem, kind: DigestKind) {
  const sender = item.source.trim();
  if (sender) return sender;
  return kind === "podcast" ? "Unknown show" : "Unknown sender";
}

function axisTopicFromTitle(title: string) {
  const value = title.trim();
  if (!value) return "Other research";
  for (const rule of AXIS_TOPIC_RULES) {
    if (rule.matcher.test(value)) return rule.label;
  }
  const stem = value
    .replace(/\s*[-|:].*$/, "")
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b.*$/i, "")
    .replace(/\bq[1-4]fy\d{2,4}\b.*$/i, "")
    .trim();
  return stem || "Other research";
}

function digestGroupLabel(item: DigestItem, kind: DigestKind, layout: DigestGroupLayout) {
  switch (layout) {
    case "axis": {
      const topic = item.topicGroup?.trim();
      if (topic) return topic;
      return axisTopicFromTitle(item.title);
    }
    case "mail":
    case "podcasts":
      return digestSender(item, kind);
    default: {
      const _exhaustive: never = layout;
      return _exhaustive;
    }
  }
}

function senderGroupColor(sender: string) {
  const hash = Array.from(sender).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return SENDER_GROUP_COLORS[hash % SENDER_GROUP_COLORS.length];
}

function groupDigestItems(items: DigestItem[], kind: DigestKind, layout: DigestGroupLayout) {
  const groups = new Map<string, DigestItem[]>();
  items.forEach((item) => {
    const label = digestGroupLabel(item, kind, layout);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  });
  return Array.from(groups, ([label, groupItems]) => ({ label, items: groupItems }));
}

const READ_LATER_KEY = "dashboard-saved-items-v1";

function digestItemId(item: DigestItem) {
  return `${item.receivedAt ?? item.time}|${item.source}|${item.title}`;
}

function DigestSourceLinks({ item, kind }: { item: DigestItem; kind: DigestKind }) {
  const links: Array<{ href: string; label: string; icon: "mail" | "pdf" | "episode" }> = [];
  if (item.messageUrl) links.push({ href: item.messageUrl, label: "Open in Mail", icon: "mail" });
  if (item.pdfUrl) links.push({ href: item.pdfUrl, label: "Open PDF", icon: "pdf" });
  if (kind === "podcast" && item.episodeUrl) {
    links.push({ href: item.episodeUrl, label: "Open in Podcasts", icon: "episode" });
  }
  if (!links.length) return null;
  return (
    <div className="digest-item-links" aria-label="Source links">
      {links.map((link) => (
        <a
          key={`${link.label}-${link.href}`}
          className="digest-source-link"
          href={link.href}
          target={link.icon === "mail" ? undefined : "_blank"}
          rel={link.icon === "mail" ? undefined : "noopener noreferrer"}
        >
          {link.icon === "mail" ? <Mail size={12} aria-hidden="true" /> : null}
          {link.icon === "pdf" ? <FileText size={12} aria-hidden="true" /> : null}
          {link.icon === "episode" ? <ExternalLink size={12} aria-hidden="true" /> : null}
          {link.label}
        </a>
      ))}
    </div>
  );
}

function DigestMailItem({
  item,
  kind,
  saved = false,
  onToggleSaved,
}: {
  item: DigestItem;
  kind: DigestKind;
  saved?: boolean;
  onToggleSaved?: (item: DigestItem) => void;
}) {
  const hasTranscriptSummary = kind === "podcast"
    && item.contentSource === "transcript"
    && item.summaryStatus === "generated";
  const bullets = kind === "podcast"
    // Defense-in-depth: re-apply the shared promo/CTA/contact filter client-side too, so a
    // summarizer-generated takeaway that slipped past server-side filtering never renders.
    ? (hasTranscriptSummary ? (item.keyTakeaways ?? []).filter(isDigestContentWorthy) : [])
    : digestItemBullets({ ...item, kind });
  const tags = item.tags ? [...item.tags.sector, ...item.tags.thesis, ...item.tags.conviction] : [];
  const sentimentClass = item.sentiment ? `sentiment-${item.sentiment.toLowerCase()}` : "sentiment-neutral";
  const podcastEvidenceLabel = (() => {
    if (kind !== "podcast") return null;
    if (hasTranscriptSummary) return "Transcript summary";
    if (item.contentSource === "transcript") return "Summary not generated";
    // AGENTS.md: label non-transcript podcast evidence as description, never as transcript.
    return "Description";
  })();
  return (
    <article className={`digest-item ${sentimentClass}`}>
      <time className="digest-item-time">{item.time}</time>
      <div>
        <div className="digest-item-heading">
          <h4>{item.title}</h4>
          {onToggleSaved && (
            <button
              type="button"
              className={`digest-save-action${saved ? " saved" : ""}`}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${item.title} from Read Later` : `Save ${item.title} to Read Later`}
              onClick={() => onToggleSaved(item)}
            >
              {saved ? <BookmarkCheck size={13}/> : <Bookmark size={13}/>}
              {saved ? "Saved" : "Read Later"}
            </button>
          )}
        </div>
        <div className="digest-item-badges">
          {item.sentiment && <span className={`digest-badge sentiment-${item.sentiment.toLowerCase()}`}>{item.sentiment}</span>}
          {tags.map((tag) => <span className="digest-badge" key={tag}>{tag}</span>)}
          {kind === "podcast" && podcastEvidenceLabel && (
            <span className={`digest-badge evidence-${
              hasTranscriptSummary
                ? "transcript"
                : item.contentSource === "transcript"
                  ? "unavailable"
                  : "description"
            }`}>
              {podcastEvidenceLabel}
            </span>
          )}
        </div>
        {kind === "podcast" && <WaveformStrip seed={item.title.length} />}
        <DigestBulletList bullets={bullets} evidenceChips={kind !== "podcast"} />
        {kind === "podcast" && hasTranscriptSummary && bullets.length > 0 && (
          <div className="podcast-chapters" aria-label="Key takeaway markers">
            {bullets.slice(0, 4).map((bullet, index) => <span className="chapter-marker" key={`${bullet}-${index}`}>Ch {index + 1}</span>)}
          </div>
        )}
        {kind === "podcast" && !hasTranscriptSummary && (
          <p className="podcast-summary-unavailable">
            {item.contentSource === "transcript"
              ? item.summaryReason === "transcript_too_short"
                ? "Transcript available, but too little substantive content remained after sanitization."
                : "Transcript available — summary not generated. Configure the private local summarizer to create it."
              : "Description evidence only — transcript summary not generated"}
          </p>
        )}
        <DigestSourceLinks item={item} kind={kind} />
        {kind === "podcast" && item.contentSource === "transcript" && Boolean(item.timestampLinks?.length) && (
          <div className="podcast-timestamp-links" aria-label="Transcript timestamps">
            {item.timestampLinks?.map((link) => (
              <a key={`${link.seconds}-${link.href}`} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function SenderDigestGroups({
  items,
  kind,
  emptyMessage,
  layout = "mail",
  savedIds,
  onToggleSaved,
}: {
  items: DigestItem[];
  kind: DigestKind;
  emptyMessage: string;
  layout?: DigestGroupLayout;
  savedIds?: Set<string>;
  onToggleSaved?: (item: DigestItem) => void;
}) {
  if (!items.length) return <div className="digest-empty">{emptyMessage}</div>;

  return (
    <div className={`sender-groups sender-groups-${layout}`}>
      {groupDigestItems(items, kind, layout).map(({ label, items: groupItems }) => {
        const style = { "--sender-color": senderGroupColor(label) } as CSSProperties;
        const groupBody = <div className="sender-group-items">
          {groupItems.map((item) => (
            <DigestMailItem
              key={`${item.time}-${item.source}-${item.title}`}
              item={item}
              kind={kind}
              saved={savedIds?.has(digestItemId(item))}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </div>;
        return (
          <details className="sender-group sender-group-collapsible" style={style} key={label}>
            <summary className="sender-group-header" onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              const details = event.currentTarget.parentElement as HTMLDetailsElement | null;
              if (details) details.open = !details.open;
            }}>
              <span className="sender-group-swatch" aria-hidden="true" />
              <h3>{label}</h3>
              <span className="sender-group-count">{groupItems.length}</span>
              <ChevronDown className="sender-group-chevron" size={15} aria-hidden="true" />
            </summary>
            {groupBody}
          </details>
        );
      })}
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
  const sourceDate = item.allDay && /^\d{4}-\d{2}-\d{2}$/.test(item.sourceDate ?? "")
    ? new Date(`${item.sourceDate}T12:00:00+05:30`)
    : new Date(item.startsAt);
  const starts = item.allDay ? "All day" : formatShortWhen(item.startsAt);
  const ends = !item.allDay && item.endsAt && item.endsAt !== item.startsAt ? formatShortWhen(item.endsAt) : "";
  return (
    <div className="topic-feed-item">
      <b>{Number.isNaN(sourceDate.getTime()) ? "Undated" : sourceDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</b>
      <div>
        <strong>{item.title}</strong>
        {item.marketHoliday && <span className="market-holiday-badge">{item.marketHoliday.market} CLOSED</span>}
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
  const fallbackVisual = REMINDER_TOPIC_FALLBACKS[item.topic];
  const topicColor = item.topicColor ?? fallbackVisual.color;
  const reminderStyle = {
    "--reminder-bg": item.backgroundColor ?? `${topicColor}80`,
    "--reminder-text": item.textColor ?? fallbackVisual.text,
    "--reminder-topic": topicColor,
  } as CSSProperties;
  return (
    <div
      className={`topic-feed-item topic-feed-reminder${item.completed ? " topic-feed-item-done" : ""}`}
      style={reminderStyle}
    >
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
        <span className="reminder-topic-label">{item.topic}</span>
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
    <button type="button" className="digest-show-all vo-pop" onClick={onCollapse}>
      Show fewer
    </button>
  ) : (
    <button type="button" className="digest-show-all vo-pop" onClick={onExpand}>
      Show all {total}
    </button>
  );
}

function IntelligenceFeedSection({
  kind,
  title,
  count,
  note,
  children,
}: {
  kind: "calendar" | "reminders";
  title: string;
  count: number;
  note: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <section className={`intelligence-feed-section intelligence-${kind}-section`} data-feed-section={kind}>
      <button
        type="button"
        className="intelligence-feed-collapse"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>{title}</strong>
          <small>{note}</small>
        </span>
        <b>{count}</b>
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      <div id={contentId} className="intelligence-feed-content" hidden={!open}>
        {children}
      </div>
    </section>
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
    <div className={`reminder-smart-group ${className ?? ""}`} role="group" aria-label={label} data-reminder-group={label}>
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
    </div>
  );
}

/** Complete, unfiltered Live Intelligence Digest — single source for Market Intelligence. */
export function SectorIntelligenceDigest({
  content,
  mailWindow,
  view,
}: {
  content: ContentDigestSnapshot;
  mailWindow: string;
  view: "live" | "calendar-reminders";
}) {
  const allNewsletters = content.newsletters;
  const axisResearch = content.axisResearch;
  const podcasts = content.podcasts;
  const [savedNewsletterIds, setSavedNewsletterIds] = useState<Set<string>>(() => new Set());
  const [newsletterView, setNewsletterView] = useState<"all" | "saved">("all");
  const [completedOverrides, setCompletedOverrides] = useState<Map<string, AppleTaskItem>>(() => new Map());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState("");

  useEffect(() => {
    let parsedIds: string[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(READ_LATER_KEY) ?? "[]");
      if (Array.isArray(parsed)) parsedIds = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      parsedIds = [];
    }
    const timer = window.setTimeout(() => setSavedNewsletterIds(new Set(parsedIds)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleSavedNewsletter = (item: DigestItem) => {
    const id = digestItemId(item);
    setSavedNewsletterIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(READ_LATER_KEY, JSON.stringify([...next]));
      return next;
    });
  };
  const newsletters = newsletterView === "saved"
    ? allNewsletters.filter((item) => savedNewsletterIds.has(digestItemId(item)))
    : allNewsletters;
  const savedNewsletterCount = allNewsletters.filter((item) => savedNewsletterIds.has(digestItemId(item))).length;

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
  const calendarGroups = useMemo(() => groupCalendarItemsBySource(calendar), [calendar]);
  const reminderGroups = useMemo(() => partitionReminderSmartGroups(reminders), [reminders]);
  const {
    completedReminders,
    scheduledImportantReminders,
    workJobReminders,
    omittedUnimportantCount,
    allowedCount,
  } = reminderGroups;
  const displayedReminderCount = completedReminders.length + scheduledImportantReminders.length + workJobReminders.length;

  const [showAllNewsletters, setShowAllNewsletters] = useState(false);
  const [showAllAxis, setShowAllAxis] = useState(false);
  const [showAllPodcasts, setShowAllPodcasts] = useState(false);

  const visibleNewsletters = showAllNewsletters ? newsletters : newsletters.slice(0, DIGEST_PAGE_SIZE);
  const visibleAxis = showAllAxis ? axisResearch : axisResearch.slice(0, DIGEST_PAGE_SIZE);
  const visiblePodcasts = showAllPodcasts ? podcasts : podcasts.slice(0, DIGEST_PAGE_SIZE);
  const generatedPodcastCount = podcasts.filter(
    (item) => item.contentSource === "transcript" && item.summaryStatus === "generated",
  ).length;

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
      {view === "live" && <>
      <article className="panel digest-panel briefing-rail">
        <div className="panel-title">
          <div>
            <h3>Newsletter digest</h3>
            <p>
              iCloud · Newsletters · {mailWindow} · {allNewsletters.length} items · content bullets from mail body only
            </p>
          </div>
          <Mail size={18} />
        </div>
        <div className="digest-list">
          <div className="digest-filter-toolbar" role="group" aria-label="Newsletter view">
            <button type="button" className={newsletterView === "all" ? "active" : ""} onClick={() => setNewsletterView("all")}>
              All {allNewsletters.length}
            </button>
            <button type="button" className={newsletterView === "saved" ? "active" : ""} onClick={() => setNewsletterView("saved")}>
              <Bookmark size={13}/> Read Later <span>{savedNewsletterCount}</span>
            </button>
          </div>
          <SenderDigestGroups
            items={visibleNewsletters}
            kind="mail"
            emptyMessage={newsletterView === "saved"
              ? "No newsletters are saved for Read Later."
              : "No item was available from the exact iCloud → Newsletters mailbox in this window."}
            savedIds={savedNewsletterIds}
            onToggleSaved={toggleSavedNewsletter}
          />
          {newsletters.length > DIGEST_PAGE_SIZE && !showAllNewsletters && (
            <button type="button" className="digest-show-all vo-pop" onClick={() => setShowAllNewsletters(true)}>
              Show all {newsletters.length}
            </button>
          )}
          {showAllNewsletters && newsletters.length > DIGEST_PAGE_SIZE && (
            <button type="button" className="digest-show-all vo-pop" onClick={() => setShowAllNewsletters(false)}>
              Show fewer
            </button>
          )}
        </div>
      </article>
      <article className="panel digest-panel briefing-rail">
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
          <SenderDigestGroups
            items={visibleAxis}
            kind="mail"
            layout="axis"
            emptyMessage="No Axis Research item was available for this window."
          />
          {axisResearch.length > DIGEST_PAGE_SIZE && !showAllAxis && (
            <button type="button" className="digest-show-all vo-pop" onClick={() => setShowAllAxis(true)}>
              Show all {axisResearch.length}
            </button>
          )}
          {showAllAxis && axisResearch.length > DIGEST_PAGE_SIZE && (
            <button type="button" className="digest-show-all vo-pop" onClick={() => setShowAllAxis(false)}>
              Show fewer
            </button>
          )}
        </div>
      </article>
      <article className="panel digest-panel digest-panel-podcasts waveform-dossiers">
        <div className="panel-title">
          <div>
            <h3>Podcast summaries</h3>
            <p>
              {generatedPodcastCount} transcript summaries · {podcasts.length - generatedPodcastCount} not generated · complete unfiltered episode list
            </p>
          </div>
          <Mic2 size={18} />
        </div>
        <div className="digest-list">
          <SenderDigestGroups
            items={visiblePodcasts.map((item, index) => ({
              ...item,
              time: item.time || String(index + 1).padStart(2, "0"),
            }))}
            kind="podcast"
            layout="podcasts"
            emptyMessage="No podcast episode was available in this window."
          />
          {podcasts.length > DIGEST_PAGE_SIZE && !showAllPodcasts && (
            <button type="button" className="digest-show-all vo-pop" onClick={() => setShowAllPodcasts(true)}>
              Show all {podcasts.length}
            </button>
          )}
          {showAllPodcasts && podcasts.length > DIGEST_PAGE_SIZE && (
            <button type="button" className="digest-show-all vo-pop" onClick={() => setShowAllPodcasts(false)}>
              Show fewer
            </button>
          )}
        </div>
      </article>
      </>}
      {view === "calendar-reminders" && (
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
            <div className="calendar-complete-feed" aria-label="All calendar events grouped by source">
              {calendarGroups.map((group, groupIndex) => {
                const headingId = `calendar-source-${groupIndex}`;
                return (
                  <section className="calendar-source-group" aria-labelledby={headingId} key={group.calendar}>
                    <h4 id={headingId}>
                      <span>{group.calendar}</span>
                      <b aria-label={`${group.items.length} events`}>{group.items.length}</b>
                    </h4>
                    <div className="calendar-source-items">
                      {group.items.map((item) => <CalendarFeedItem key={`${item.id}-${item.sourceDate ?? item.startsAt}`} item={item} />)}
                    </div>
                  </section>
                );
              })}
            </div>
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
          This complete intelligence digest is local and read-only except Reminder checkboxes. Mail bodies and Podcast
          descriptions remain on this Mac. Newsletter, Axis, and Podcast bullets are content takeaways only —
          Calendar and Reminders show title/meta without 5-bullet padding.
        </div>
      </article>
      )}
    </section>
  );
}

const INTELLIGENCE_SECTIONS = [
  { id: "m1", label: "Action Board" },
  { id: "m2", label: "Live Intelligence" },
  { id: "m3", label: "Earnings Calendar" },
  { id: "m4", label: "Calendar + Reminders" },
] as const;

function MarketEarningsCalendar({
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

export function IntelligenceWorkspace({
  content,
  contentError,
  mailWindow,
  earningsSnapshot,
  earningsError,
  holdings,
}: {
  content: ContentDigestSnapshot;
  contentError: string;
  mailWindow: string;
  earningsSnapshot: EarningsSnapshot;
  earningsError: string;
  holdings: LiveHolding[];
}) {
  const [activeSection, setActiveSection] = useState("m1");
  useEffect(() => {
    const sync = () => {
      const requested = new URLSearchParams(window.location.search).get("section");
      if (INTELLIGENCE_SECTIONS.some((section) => section.id === requested)) setActiveSection(requested!);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const selectSection = (section: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.delete("page");
    window.history.pushState({}, "", url);
    setActiveSection(section);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
    document.getElementById(`intelligence-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="intelligence-workspace-shell">
      <WorkspaceSectionNav
        label="Market Intelligence sections"
        sections={INTELLIGENCE_SECTIONS}
        activeId={activeSection}
        onSelect={selectSection}
      />
      <div id="intelligence-m1" className="workspace-section action-board-workspace-section">
        <CollapsibleSection
          number="M-1" title="Action Board"
          note="Clickable daily source, evidence and monitoring actions"
        >
          <DailyKanbanBoard workspace="intelligence"/>
        </CollapsibleSection>
      </div>
      <div id="intelligence-m2" className="workspace-section">
        <CollapsibleSection
          number="M-2" title="Live Intelligence"
          note={
            content.status === "live"
              ? `Newsletters, Axis Research and Podcasts · updated ${content.asOf}`
              : contentError
                ? `refresh issue: ${contentError}`
                : "waiting for local refresh"
          }
        >
          <SectorIntelligenceDigest content={content} mailWindow={mailWindow} view="live" />
        </CollapsibleSection>
      </div>
      <div id="intelligence-m3" className="workspace-section">
        <CollapsibleSection
          number="M-3" title="Earnings Calendar"
          note="Complete Apple Calendar schedule plus independently verified reported results"
        >
          {earningsError && (
            <div className="refresh-error">
              <ShieldAlert size={15} />
              <span>{earningsError}</span>
            </div>
          )}
          <MarketEarningsCalendar content={content} snapshot={earningsSnapshot} holdings={holdings} />
        </CollapsibleSection>
      </div>
      <div id="intelligence-m4" className="workspace-section">
        <CollapsibleSection
          number="M-4" title="Calendar + Reminders"
          note="Complete non-earnings calendars and the three-group reminders experience"
        >
          <SectorIntelligenceDigest content={content} mailWindow={mailWindow} view="calendar-reminders" />
        </CollapsibleSection>
      </div>
    </div>
  );
}
