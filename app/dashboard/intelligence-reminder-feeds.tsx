"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { AppleTaskItem } from "../content-types";

const COMPLETED_PAGE_SIZE = 24;
const SCHEDULED_PAGE_SIZE = 24;
const BOX_PAGE_SIZE = 12;

export { COMPLETED_PAGE_SIZE, SCHEDULED_PAGE_SIZE };

const REMINDER_TOPIC_FALLBACKS: Record<AppleTaskItem["topic"], { color: string; text: "#000" | "#FFF" }> = {
  Earnings: { color: "#2563EB", text: "#FFF" },
  "Work/Jobs": { color: "#F97316", text: "#000" },
  Health: { color: "#16A34A", text: "#FFF" },
  Personal: { color: "#9333EA", text: "#FFF" },
  Other: { color: "#64748B", text: "#FFF" },
};

const REMINDER_LIST_COLORS: Record<string, string> = {
  "guitar chords": "#8B5CF6",
  subscriptions: "#06B6D4",
  tasks: "#F59E0B",
  log: "#10B981",
  earnings: "#2563EB",
  daily: "#EC4899",
  "job 🔍": "#F97316",
};

function reminderListColor(list?: string) {
  const normalized = (list || "Unknown list").trim().toLocaleLowerCase("en");
  const configured = REMINDER_LIST_COLORS[normalized];
  if (configured) return configured;

  // Keep every Apple Reminders list visually stable across refreshes without
  // coupling presentation to the reminder's topic or scheduled state.
  let hash = 0;
  for (const character of normalized) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return `hsl(${hash % 360} 72% 52%)`;
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
  const listColor = reminderListColor(item.list);
  const reminderStyle = {
    "--reminder-list-color": listColor,
    "--reminder-text": "var(--ink)",
    "--reminder-topic": topicColor,
  } as CSSProperties;
  return (
    <div
      className={`topic-feed-item topic-feed-reminder${item.completed ? " topic-feed-item-done" : ""}`}
      style={reminderStyle}
      data-reminder-list={item.list || "Unknown list"}
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

export function IntelligenceFeedSection({
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

export function ReminderBox({
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
