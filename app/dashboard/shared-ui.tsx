"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Activity, CheckCircle2, ChevronDown, Eye, EyeOff, Footprints, HeartPulse, Lock, Moon, Target, Utensils, Wind } from "lucide-react";
import { featureForWorkspace, tierAllows, type LicenseTier } from "../license";
import { useLicenseSnapshot } from "../license-snapshot";
import type { HealthAveragePeriod, HealthMetric } from "../health-data";
import type { HealthLiveSnapshot } from "../health-live-types";
import type { LiveHolding } from "../live-types";
import type { DonutLabelProps, KanbanWorkspace, WorkspaceKey } from "./types";
import { builderSectionNumber, isBuilderSection, isStrategiesSection, strategiesSectionNumber } from "./workspace-routing";
import {
  HEALTH_DIRECTION_COLUMNS,
  groupHealthMetricsByDirection,
  healthTrendTone,
  kanbanItems,
  labelPoint,
  localDateKey,
  number,
  workspaces,
} from "./utils";
import { SparkFilament } from "./visual-components";

export type WorkspaceSectionNavItem = {
  id: string;
  label: string;
  /** Visible cyan prefix; defaults to uppercased id (e.g. m1 → M1). */
  prefix?: string;
};

export function WorkspaceSectionNav({
  label,
  sections,
  activeId,
  onSelect,
}: {
  label: string;
  sections: readonly WorkspaceSectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectByIndex = (index: number) => {
    const normalized = (index + sections.length) % sections.length;
    const section = sections[normalized];
    if (!section) return;
    tabsRef.current[normalized]?.focus();
    onSelect(section.id);
  };
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") { event.preventDefault(); selectByIndex(index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); selectByIndex(index - 1); }
    if (event.key === "Home") { event.preventDefault(); selectByIndex(0); }
    if (event.key === "End") { event.preventDefault(); selectByIndex(sections.length - 1); }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(sections[index]!.id); }
  };

  return <nav
    className="workspace-section-nav"
    role="tablist"
    aria-orientation="horizontal"
    aria-label={label}
    style={{ gridTemplateColumns: `repeat(${Math.max(sections.length, 1)},minmax(0,1fr))` }}
  >
    {sections.map((section, index) => {
      const selected = activeId === section.id;
      const prefix = section.prefix ?? section.id.toUpperCase();
      return <button
        ref={(node) => { tabsRef.current[index] = node; }}
        id={`workspace-section-tab-${section.id}`}
        key={section.id}
        type="button"
        role="tab"
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        className={selected ? "active" : ""}
        onClick={() => onSelect(section.id)}
        onKeyDown={(event) => onTabKeyDown(event, index)}
      ><span>{prefix}</span>{section.label}</button>;
    })}
  </nav>;
}

export function AllocationLabel(props: DonutLabelProps & { ring: "inner" | "industry" | "subsector" }) {
  const { x, y } = labelPoint(props, props.ring === "inner" ? 0.62 : 0.5);
  const percent = number(props.percent) * 100;
  const name = String(props.name ?? "");
  const compactName = props.ring === "inner"
    ? name.replace(" cap", "")
    : name.replace("Private Sector Bank", "Private Bank").replace("E-Commerce", "E-Commerce").replace("Telecom", "Telecom").replace("Power Generation", "Power Gen").replace("Consumer internet", "Consumer").replace("Specialty chemicals", "Chemicals").replace("Commercial Banking", "Commercial").replace("Food Delivery & Quick Commerce", "Food + Quick").replace("Wireless & Digital Services", "Wireless").replace("Renewable Power", "Renewables").replace("Integrated Power & Storage", "Power + Storage").replace("Specialty & Fine Chemicals", "Specialty Chem.");

  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className={`donut-data-label ${props.ring}${percent < 6 ? " compact" : ""}`}>
      <tspan x={x} dy="-0.45em">{compactName}</tspan>
      <tspan x={x} dy="1.15em">{percent.toFixed(1)}%</tspan>
    </text>
  );
}

export function HoldingLabel(props: DonutLabelProps) {
  const { x, y } = labelPoint(props);
  const holding = props.payload as LiveHolding | undefined;
  if (!holding) return null;
  const symbol = holding.symbol.replace("ICICIBANK", "ICICI").replace("BHARTIARTL", "AIRTEL").replace("JSWENERGY", "JSW");
  const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="donut-data-label outer">
      <tspan x={x} dy="-1.35em" className="symbol">{symbol}</tspan>
      <tspan x={x} dy="1.05em">{holding.weight.toFixed(1)}%</tspan>
      <tspan x={x} dy="1.05em">U {signed(holding.pnlPct)}</tspan>
      <tspan x={x} dy="1.05em">D {signed(holding.dayPct)}</tspan>
    </text>
  );
}


export function RiskPill({ value }: { value: string }) {
  const tone = value.toLowerCase().includes("high") ? "red" : value.toLowerCase().includes("low") ? "green" : "amber";
  return <span className={`pill ${tone}`}>{value}</span>;
}

export function HealthCategoryIcon({ name }: { name: string }) {
  if (name === "Sleep") return <Moon size={18}/>;
  if (name === "Heart") return <HeartPulse size={18}/>;
  if (name === "Respiratory" || name === "Mindfulness") return <Wind size={18}/>;
  if (name === "Mobility") return <Footprints size={18}/>;
  if (name === "Nutrition") return <Utensils size={18}/>;
  return <Activity size={18}/>;
}

export function HealthMetricComparison({ metric, averagePeriod }: { metric: HealthMetric; averagePeriod: HealthAveragePeriod }) {
  const average = metric.averages?.[averagePeriod];
  const periodLabel = averagePeriod === "weekly" ? "7-day" : "month-to-date";

  if (!average) {
    return <span className="health-metric-comparison unavailable" aria-label={`${metric.label}: ${periodLabel} average unavailable`}><i>—</i><span>No {periodLabel} avg</span></span>;
  }

  const arrow = average.direction === "up" ? "▲" : average.direction === "down" ? "▼" : "•";
  const direction = average.direction === "up" ? "higher" : average.direction === "down" ? "lower" : "similar";
  const trendTone = healthTrendTone(metric, average.direction);
  return <span className={`health-metric-comparison ${average.direction} trend-${trendTone}`} aria-label={`${metric.label}: ${direction} than ${periodLabel} average of ${average.value}${average.delta ? ` by ${average.delta}` : ""}; optimization tone ${trendTone}`}>
    <i>{arrow}</i><span>{average.delta ?? direction}</span><small>vs {average.value} {periodLabel} avg</small>
  </span>;
}

/** Pull the unit suffix from a live metric display value (e.g. "913 kcal" → "kcal"). */
function healthMetricUnit(value: string): string | undefined {
  const match = value.trim().match(/[A-Za-z%°µμ/]+(?:\s*[A-Za-z%°µμ/]+)*/);
  return match?.[0]?.trim() || undefined;
}

export function HealthMasonryGrid({ categories, compact = false }: { categories: HealthLiveSnapshot["categories"]; compact?: boolean }) {
  const [averagePeriod, setAveragePeriod] = useState<HealthAveragePeriod>("weekly");
  const [averagePeriodHydrated, setAveragePeriodHydrated] = useState(false);
  const [collapsedDirections, setCollapsedDirections] = useState<Set<string>>(
    () => (compact ? new Set() : new Set(["moderate", "bad"])),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAveragePeriod(window.localStorage.getItem("health-average-period") === "monthly" ? "monthly" : "weekly");
      setAveragePeriodHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!averagePeriodHydrated) return;
    window.localStorage.setItem("health-average-period", averagePeriod);
  }, [averagePeriod, averagePeriodHydrated]);

  const directionColumns = groupHealthMetricsByDirection(categories, averagePeriod);
  const unavailableCount = directionColumns.unavailable.length;
  const toggleDirection = (id: string) => {
    setCollapsedDirections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return <>
    <section className={`health-average-toolbar${compact ? " compact" : ""}`} aria-label="Health metric average comparison controls">
      <div><b>Vital cadence</b><span>Weekly or month-to-date rhythm · rows are comparison direction; tile colour is Health category</span></div>
      <div className="segmented health-average-toggle" role="group" aria-label="Compare health metrics with weekly or monthly average">
        <button type="button" className={`vo-pop${averagePeriod === "weekly" ? " active" : ""}`} aria-pressed={averagePeriod === "weekly"} onClick={() => setAveragePeriod("weekly")}>Weekly</button>
        <button type="button" className={`vo-pop${averagePeriod === "monthly" ? " active" : ""}`} aria-pressed={averagePeriod === "monthly"} onClick={() => setAveragePeriod("monthly")}>Monthly (MTD)</button>
      </div>
      <p>
        <span className="trend-good-key">Green row · favourable direction</span>
        <span className="trend-moderate-key">Gold row · context dependent</span>
        <span className="trend-bad-key">Red row · unfavourable direction</span>
        {unavailableCount > 0
          ? <span className="health-unavailable-inline-note">{unavailableCount} without {averagePeriod === "weekly" ? "7-day" : "MTD"} avg · shown under Context dependent</span>
          : null}
        <em>Tile accent = category (Heart, Activity, Nutrition, Respiratory/Mindfulness, Sleep, Mobility). Not a diagnosis.</em>
      </p>
    </section>
    <section className={`health-direction-grid quadrant-vitals-stage${compact ? " compact" : ""}`} aria-label="Vital Metrics by comparison direction">
      {HEALTH_DIRECTION_COLUMNS.map((column) => {
        // Unavailable averages stay visible inside Context dependent — no dedicated fourth column.
        const entries = column.id === "moderate"
          ? [...directionColumns.moderate, ...directionColumns.unavailable]
          : directionColumns[column.id];
        const isCollapsed = collapsedDirections.has(column.id);
        const groupControlId = `vital-direction-${column.id}`;
        return <div className={`health-direction-row ${column.className}${isCollapsed ? " collapsed" : ""}`} key={column.id}>
          <button
            type="button"
            className={`health-direction-header ${column.className}`}
            aria-expanded={!isCollapsed}
            aria-controls={groupControlId}
            onClick={() => toggleDirection(column.id)}
          >
            <span className="health-direction-title-group">
              <ChevronDown size={15} aria-hidden="true"/>
              <b id={`vital-direction-label-${column.id}`}>{column.title}</b>
            </span>
            <span>{entries.length} metric{entries.length === 1 ? "" : "s"}</span>
          </button>
          <div className="health-kpi-grid" id={groupControlId} role="group" aria-labelledby={`vital-direction-label-${column.id}`} hidden={isCollapsed}>
            {entries.length === 0
              ? <p className="health-direction-empty">No metrics in this direction for the selected cadence.</p>
              : entries.map((entry) => {
                const average = entry.metric.averages?.[averagePeriod];
                const filamentTone = average
                  ? (healthTrendTone(entry.metric, average.direction) === "good" ? "good" : healthTrendTone(entry.metric, average.direction) === "bad" ? "bad" : "neutral")
                  : undefined;
                return (
                <div
                  className={`health-kpi-tile biometric-capsule ${entry.categoryAccent}${average ? "" : " average-unavailable"}`}
                  key={`${entry.categoryName}-${entry.metric.label}`}
                >
                  <span className="health-kpi-label">{entry.metric.label}</span>
                  <b>{entry.metric.value}</b>
                  {average ? <SparkFilament tone={filamentTone} series={entry.metric.history?.[averagePeriod]} unit={healthMetricUnit(entry.metric.value)} /> : null}
                  <HealthMetricComparison metric={entry.metric} averagePeriod={averagePeriod}/>
                  <small>
                    <span className="health-kpi-category">{entry.categoryName}</span>
                    {entry.metric.context ? ` · ${entry.metric.context}` : ""}
                  </small>
                </div>
              );})}
          </div>
        </div>;
      })}
    </section>
  </>;
}

function workspaceOrbitalBadge(
  workspace: WorkspaceKey,
  kiteLive: boolean,
  contentLive: boolean,
  healthIncognito: boolean,
  healthStatus: HealthLiveSnapshot["status"],
): string {
  switch (workspace) {
    case "investment":
      return kiteLive ? "LIVE" : "KITE";
    case "sectors":
      return "S-2";
    case "intelligence":
      return contentLive ? "FRESH" : "SYNC";
    case "health":
      if (healthIncognito) return "INCOGNITO";
      switch (healthStatus) {
        case "live":
          return "SYNCED";
        case "cached":
          return "CACHED";
        case "partial":
          return "PARTIAL";
        case "stale":
          return "STALE";
        case "unavailable":
          return "UNAVAILABLE";
        default: {
          const _exhaustive: never = healthStatus;
          return _exhaustive;
        }
      }
    case "builder":
      return "TREE";
    case "strategies":
      return "OOS";
    default: {
      const _exhaustive: never = workspace;
      return _exhaustive;
    }
  }
}

export function DemoSensitive({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className} data-demo-sensitive="">{children}</span>;
}

export function DemoCaptionBar() {
  const [caption, setCaption] = useState("");
  useEffect(() => {
    const read = () => setCaption(document.documentElement.getAttribute("data-demo-caption") ?? "");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-demo-caption"] });
    return () => observer.disconnect();
  }, []);
  const [title, ...rest] = caption.split("\n");
  const body = rest.join("\n").trim();
  if (!title?.trim()) return null;
  return <aside id="demo-caption-bar" className="demo-caption-bar" aria-live="polite">
    <b>{title}</b>
    {body ? <span>{body}</span> : null}
  </aside>;
}

export function DashboardTabs({ active, onChange, kiteLive, contentLive, healthIncognito, healthStatus, hideHealth = false, licenseTier }: { active: WorkspaceKey | null; onChange: (workspace: WorkspaceKey) => void; kiteLive: boolean; contentLive: boolean; healthIncognito: boolean; healthStatus: HealthLiveSnapshot["status"]; hideHealth?: boolean; licenseTier?: LicenseTier }) {
  const { license } = useLicenseSnapshot();
  const resolvedTier = licenseTier ?? license.tier;
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const visibleWorkspaces = useMemo(
    () => (hideHealth ? workspaces.filter((workspace) => workspace.key !== "health") : workspaces),
    [hideHealth],
  );
  const activeIndex = Math.max(0, visibleWorkspaces.findIndex((workspace) => workspace.key === active));
  const selectByIndex = (index: number) => {
    const normalized = (index + visibleWorkspaces.length) % visibleWorkspaces.length;
    const workspace = visibleWorkspaces[normalized];
    if (!workspace) return;
    tabsRef.current[normalized]?.focus();
    onChange(workspace.key);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const tab = tabsRef.current[activeIndex];
      const tabList = tab?.parentElement;
      if (tab && tabList) tabList.scrollLeft = Math.max(0, tab.offsetLeft - (tabList.clientWidth - tab.clientWidth) / 2);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  return <nav className="workspace-navigation mode-dial glass-bar liquid-glass" aria-label="Dashboard workspaces">
    <div
      className="workspace-tabs"
      role="tablist"
      aria-orientation="horizontal"
      data-count={visibleWorkspaces.length}
      style={{ "--glass-count": visibleWorkspaces.length, "--glass-index": activeIndex } as CSSProperties}
    >
      {visibleWorkspaces.map((workspace, index) => {
        const badge = workspaceOrbitalBadge(workspace.key, kiteLive, contentLive, healthIncognito, healthStatus);
        const locked = !tierAllows(resolvedTier, featureForWorkspace(workspace.key));
        return <button
          ref={(node) => { tabsRef.current[index] = node; }}
          id={`workspace-tab-${workspace.key}`}
          key={workspace.key}
          type="button"
          role="tab"
          data-mode={workspace.key}
          data-locked={locked ? "1" : undefined}
          aria-selected={active === workspace.key}
          aria-controls="dashboard-workspace-panel"
          aria-label={locked ? `${workspace.label} (locked)` : `${workspace.label} · ${badge}`}
          tabIndex={active === workspace.key || (active === null && index === 0) ? 0 : -1}
          className={active === workspace.key ? "active" : ""}
          onClick={() => onChange(workspace.key)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); selectByIndex(index + 1); }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); selectByIndex(index - 1); }
            if (event.key === "Home") { event.preventDefault(); selectByIndex(0); }
            if (event.key === "End") { event.preventDefault(); selectByIndex(visibleWorkspaces.length - 1); }
          }}
        >
          <b>{workspace.barLabel}</b>
          {locked ? <em className="orbital-badge" aria-hidden="true"><Lock size={11}/></em> : null}
        </button>;
      })}
    </div>
  </nav>;
}

/** Map workspace nav ids (i1, s2, m3, h1, board) to CollapsibleSection numbers (I-1, S-2, B-1, …). */
export function dashboardSectionNumberFromNavId(id: string): string {
  if (isBuilderSection(id)) return builderSectionNumber(id);
  if (isStrategiesSection(id)) return strategiesSectionNumber(id);
  const match = /^([ismhy])(\d+)$/i.exec(id.trim());
  if (!match) return id.toUpperCase();
  return `${match[1]!.toUpperCase()}-${match[2]}`;
}

/** Expand one section by number after an explicit user nav/tab selection. */
export function expandDashboardSection(number: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dashboard-expand-section", { detail: { number } }));
}

/** Honor a `?section=` route: expand the collapsible and scroll it into view. */
export function revealDashboardSection(navId: string, scrollId: string) {
  if (typeof document === "undefined") return;
  expandDashboardSection(dashboardSectionNumberFromNavId(navId));
  document.getElementById(scrollId)?.scrollIntoView({ behavior: "auto", block: "start" });
}

/** Hide sibling collapsibles when the URL selected a section (`?section=` / `?page=`). */
export function nativeChromeHidesSection(activeId: string | null, sectionId: string): boolean {
  return activeId != null && activeId !== sectionId;
}

export function CollapsibleSection({ number, title, note, children, headerAction, defaultOpen = false }: { number: string; title: string; note: string; children: ReactNode; headerAction?: ReactNode; defaultOpen?: boolean }) {
  // v2 keys default missing → collapsed unless defaultOpen; ignore legacy portfolio-section-*-open expands.
  const storageKey = `portfolio-section-v2-${number}-open`;
  const expandRequestedRef = useRef(false);
  const [open, setOpen] = useState(defaultOpen);
  const [openStateHydrated, setOpenStateHydrated] = useState(false);
  const contentId = `dashboard-section-${number}`;

  useEffect(() => {
    if (!defaultOpen) return;
    expandRequestedRef.current = true;
    setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(storageKey);
      setOpen((current) => {
        if (expandRequestedRef.current || defaultOpen) return true;
        if (stored === "true") return true;
        if (stored === "false") return false;
        return current;
      });
      setOpenStateHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [defaultOpen, storageKey]);

  useEffect(() => {
    if (!openStateHydrated) return;
    window.localStorage.setItem(storageKey, String(open));
  }, [open, openStateHydrated, storageKey]);

  useEffect(() => {
    const onExpand = (event: Event) => {
      const detail = (event as CustomEvent<{ number?: string }>).detail;
      if (detail?.number !== number) return;
      expandRequestedRef.current = true;
      setOpen(true);
    };
    window.addEventListener("dashboard-expand-section", onExpand);
    return () => window.removeEventListener("dashboard-expand-section", onExpand);
  }, [number]);

  return <section className={`collapsible-section ${open ? "open" : "collapsed"} drawer-shutter`}>
    <div className="section-heading collapsible-heading">
      <span>{number}</span>
      <div><h2>{title}</h2><p>{note}</p></div>
      <span className="shutter-preview" aria-hidden="true"><i/><em>preview</em></span>
      {headerAction && <div className="section-header-action">{headerAction}</div>}
      <button className="collapse-button" type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)} title={`${open ? "Collapse" : "Expand"} ${title}`}>
        <ChevronDown size={18}/><span className="sr-only">{open ? "Collapse" : "Expand"} {title}</span>
      </button>
    </div>
    <div className="collapsible-content" id={contentId} hidden={!open}>{children}</div>
  </section>;
}

export type DashboardAppearance = "black" | "dark" | "sepia";

const APPEARANCE_OPTIONS: { value: DashboardAppearance; label: string }[] = [
  { value: "black", label: "Black" },
  { value: "dark", label: "Dark" },
  { value: "sepia", label: "Sepia" },
];

export function AppearanceToggle({ value, onChange }: { value: DashboardAppearance; onChange: (value: DashboardAppearance) => void }) {
  return <div className="appearance-toggle" role="group" aria-label="Dashboard appearance">
    {APPEARANCE_OPTIONS.map((option) => (
      <button
        key={option.value}
        type="button"
        className={`vo-pop${value === option.value ? " active" : ""}`}
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
      >{option.label}</button>
    ))}
  </div>;
}

export function HealthIncognitoToggle({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  return <label className={`incognito-toggle vo-pop ${active ? "active" : ""}`}>
    {active ? <EyeOff size={17}/> : <Eye size={17}/>}
    <span><b>Health incognito</b><small>{active ? "Stats hidden" : "Hide health stats"}</small></span>
    <input type="checkbox" checked={active} onChange={(event) => onChange(event.target.checked)} aria-label="Hide health statistics"/>
    <i aria-hidden="true"/>
  </label>;
}

export function DailyKanbanBoard({ workspace }: { workspace: KanbanWorkspace }) {
  const storageKey = `dashboard-kanban-${workspace}-v2`;
  const [state, setState] = useState<{ date: string; completed: string[] }>({ date: "", completed: [] });
  const [kanbanHydrated, setKanbanHydrated] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as { date?: string; completed?: string[] } | null;
        const today = localDateKey();
        if (!stored || stored.date !== today) setState({ date: today, completed: [] });
        else setState({ date: today, completed: stored.completed ?? [] });
      } catch {
        setState({ date: localDateKey(), completed: [] });
      }
      setKanbanHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (kanbanHydrated) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [kanbanHydrated, state, storageKey]);
  useEffect(() => {
    if (!kanbanHydrated || !state.date) return;
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setState({ date: localDateKey(midnight), completed: [] }), midnight.getTime() - now.getTime() + 1000);
    return () => window.clearTimeout(timer);
  }, [kanbanHydrated, state.date]);

  const items = kanbanItems[workspace];
  const toggle = (id: string) => {
    setCompletingId(id);
    window.setTimeout(() => setCompletingId(null), 320);
    setState((current) => ({ ...current, completed: current.completed.includes(id) ? current.completed.filter((item) => item !== id) : [...current.completed, id] }));
  };
  const lanes = [{ key: "today", label: "To do today" }, { key: "monitor", label: "Monitor" }, { key: "done", label: "Completed today" }] as const;
  return <section className="kanban-board canonical-action-board" data-visual="mission-chips">
    <div className="kanban-summary"><div><Target size={18}/><span><b>Daily action board</b><small>{Math.max(items.length - state.completed.length, 0)} active · {state.completed.length} completed · resets at local midnight</small></span></div><em>{localDateKey()}</em></div>
    <div className="kanban-lanes">{lanes.map((lane) => {
      const laneItems = items.filter((item) => lane.key === "done" ? state.completed.includes(item.id) : item.lane === lane.key && !state.completed.includes(item.id));
      return <article className={`kanban-lane ${lane.key} ${laneItems.length ? "" : "empty"}`} key={lane.key}><header><b>{lane.label}</b><span>{laneItems.length}</span></header><div>{laneItems.map((item) => {
        const completed = state.completed.includes(item.id);
        const cardLabel = `${completed ? "Mark incomplete" : "Mark complete"}: ${item.title}. ${item.detail} ${item.numericAdvantage}. ${item.strategicAdvantage}`;
        return <button type="button" className={`kanban-card vo-pop ${item.tone} ${completed ? "completed" : ""}${completingId === item.id ? " completing" : ""}`} aria-label={cardLabel} title={completed ? `${item.detail} · ${item.numericAdvantage} · ${item.strategicAdvantage}` : undefined} onClick={() => toggle(item.id)} key={item.id}><span className="kanban-check">{completed ? <CheckCircle2 size={17}/> : <i/>}</span><strong>{item.title}</strong><p>{item.detail}</p><small><b>{item.numericAdvantage}</b><em>{item.strategicAdvantage}</em></small></button>;
      })}{!laneItems.length && <p className="kanban-empty">Empty</p>}</div></article>;
    })}</div>
  </section>;
}
