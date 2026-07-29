"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, CheckCircle2, ChevronDown, Eye, EyeOff, Footprints, HeartPulse, Moon, Target, Utensils, Wind } from "lucide-react";
import type { HealthAveragePeriod, HealthMetric } from "../health-data";
import type { HealthLiveSnapshot } from "../health-live-types";
import type { LiveHolding } from "../live-types";
import type { DonutLabelProps, KanbanWorkspace, WorkspaceKey } from "./types";
import { healthTrendTone, kanbanItems, labelPoint, localDateKey, number, workspaces } from "./utils";

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
  if (name === "Respiratory") return <Wind size={18}/>;
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


export function HealthMasonryGrid({ categories, compact = false }: { categories: HealthLiveSnapshot["categories"]; compact?: boolean }) {
  const [averagePeriod, setAveragePeriod] = useState<HealthAveragePeriod>("weekly");
  const [averagePeriodHydrated, setAveragePeriodHydrated] = useState(false);

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

  return <>
    <section className={`health-average-toolbar${compact ? " compact" : ""}`} aria-label="Health metric average comparison controls">
      <div><b>Vital cadence</b><span>Weekly or month-to-date rhythm for every KPI below</span></div>
      <div className="segmented health-average-toggle" role="group" aria-label="Compare health metrics with weekly or monthly average">
        <button type="button" className={averagePeriod === "weekly" ? "active" : ""} aria-pressed={averagePeriod === "weekly"} onClick={() => setAveragePeriod("weekly")}>Weekly</button>
        <button type="button" className={averagePeriod === "monthly" ? "active" : ""} aria-pressed={averagePeriod === "monthly"} onClick={() => setAveragePeriod("monthly")}>Monthly (MTD)</button>
      </div>
      <p><span className="trend-good-key">Green · favourable direction</span><span className="trend-moderate-key">Gold · context dependent</span><span className="trend-bad-key">Red · unfavourable direction</span><span>— Average unavailable</span><em>Direction-aware wellness context, not a diagnosis.</em></p>
    </section>
    <section className={`health-category-grid${compact ? " compact" : ""}`}>
      {categories.map(category=><article className={`panel health-category ${category.tone}`} key={category.name}><div className="health-category-title"><div><HealthCategoryIcon name={category.name}/><span><h3>{category.name}</h3><p>{category.note}</p></span></div><span className={`dot ${category.tone}`}/></div><div className="health-kpi-grid">{category.metrics.map(metric=><div className={`health-kpi-tile ${metric.tone ?? ""}`} key={`${category.name}-${metric.label}`}><span>{metric.label}</span><b>{metric.value}</b><HealthMetricComparison metric={metric} averagePeriod={averagePeriod}/><small>{metric.context ?? ""}</small></div>)}</div></article>)}
    </section>
  </>;
}

export function DashboardTabs({ active, onChange, kiteLive, contentLive, healthIncognito, healthStatus }: { active: WorkspaceKey; onChange: (workspace: WorkspaceKey) => void; kiteLive: boolean; contentLive: boolean; healthIncognito: boolean; healthStatus: HealthLiveSnapshot["status"] }) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectByIndex = (index: number) => {
    const normalized = (index + workspaces.length) % workspaces.length;
    const workspace = workspaces[normalized];
    tabsRef.current[normalized]?.focus();
    onChange(workspace.key);
  };
  useEffect(() => {
    const activeIndex = workspaces.findIndex((workspace) => workspace.key === active);
    const timer = window.setTimeout(() => {
      const tab = tabsRef.current[activeIndex];
      const tabList = tab?.parentElement;
      if (tab && tabList) tabList.scrollLeft = Math.max(0, tab.offsetLeft - (tabList.clientWidth - tab.clientWidth) / 2);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [active]);

  return <nav className="workspace-navigation" aria-label="Dashboard workspaces">
    <div className="workspace-tabs" role="tablist" aria-orientation="horizontal">
      {workspaces.map((workspace, index) => {
        const Icon = workspace.icon;
        const badge = workspace.key === "investment"
          ? (kiteLive ? "LIVE" : "KITE")
          : workspace.key === "sectors"
            ? "S-2"
            : workspace.key === "intelligence"
              ? (contentLive ? "FRESH" : "SYNC")
              : healthIncognito
                ? "INCOGNITO"
                : healthStatus === "live"
                  ? "SYNCED"
                  : healthStatus === "cached"
                    ? "CACHED"
                    : healthStatus === "partial"
                      ? "PARTIAL"
                      : healthStatus === "stale"
                        ? "STALE"
                        : "UNAVAILABLE";
        return <button
          ref={(node) => { tabsRef.current[index] = node; }}
          id={`workspace-tab-${workspace.key}`}
          key={workspace.key}
          type="button"
          role="tab"
          aria-selected={active === workspace.key}
          aria-controls="dashboard-workspace-panel"
          tabIndex={active === workspace.key ? 0 : -1}
          className={active === workspace.key ? "active" : ""}
          onClick={() => onChange(workspace.key)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); selectByIndex(index + 1); }
            if (event.key === "ArrowLeft") { event.preventDefault(); selectByIndex(index - 1); }
            if (event.key === "Home") { event.preventDefault(); selectByIndex(0); }
            if (event.key === "End") { event.preventDefault(); selectByIndex(workspaces.length - 1); }
          }}
        >
          <Icon size={18}/><span><b>{workspace.label}</b><small>{workspace.note}</small></span><em>{badge}</em>
        </button>;
      })}
    </div>
  </nav>;
}

export function CollapsibleSection({ number, title, note, children, headerAction }: { number: string; title: string; note: string; children: ReactNode; headerAction?: ReactNode }) {
  const storageKey = `portfolio-section-${number}-open`;
  const [open, setOpen] = useState(true);
  const [openStateHydrated, setOpenStateHydrated] = useState(false);
  const contentId = `dashboard-section-${number}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(window.localStorage.getItem(storageKey) !== "false");
      setOpenStateHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!openStateHydrated) return;
    window.localStorage.setItem(storageKey, String(open));
  }, [open, openStateHydrated, storageKey]);

  return <section className={`collapsible-section ${open ? "open" : "collapsed"}`}>
    <div className="section-heading collapsible-heading">
      <span>{number}</span>
      <div><h2>{title}</h2><p>{note}</p></div>
      {headerAction && <div className="section-header-action">{headerAction}</div>}
      <button className="collapse-button" type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)} title={`${open ? "Collapse" : "Expand"} ${title}`}>
        <ChevronDown size={18}/><span className="sr-only">{open ? "Collapse" : "Expand"} {title}</span>
      </button>
    </div>
    {open && <div className="collapsible-content" id={contentId}>{children}</div>}
  </section>;
}

export function HealthIncognitoToggle({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  return <label className={`incognito-toggle ${active ? "active" : ""}`}>
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
  const toggle = (id: string) => setState((current) => ({ ...current, completed: current.completed.includes(id) ? current.completed.filter((item) => item !== id) : [...current.completed, id] }));
  const lanes = [{ key: "today", label: "To do today" }, { key: "monitor", label: "Monitor" }, { key: "done", label: "Completed today" }] as const;
  return <section className="kanban-board canonical-action-board">
    <div className="kanban-summary"><div><Target size={18}/><span><b>Daily action board</b><small>{Math.max(items.length - state.completed.length, 0)} active · {state.completed.length} completed · resets at local midnight</small></span></div><em>{localDateKey()}</em></div>
    <div className="kanban-lanes">{lanes.map((lane) => {
      const laneItems = items.filter((item) => lane.key === "done" ? state.completed.includes(item.id) : item.lane === lane.key && !state.completed.includes(item.id));
      return <article className={`kanban-lane ${lane.key} ${laneItems.length ? "" : "empty"}`} key={lane.key}><header><b>{lane.label}</b><span>{laneItems.length}</span></header><div>{laneItems.map((item) => {
        const completed = state.completed.includes(item.id);
        const cardLabel = `${completed ? "Mark incomplete" : "Mark complete"}: ${item.title}. ${item.detail} ${item.numericAdvantage}. ${item.strategicAdvantage}`;
        return <button type="button" className={`kanban-card ${item.tone} ${completed ? "completed" : ""}`} aria-label={cardLabel} title={completed ? `${item.detail} · ${item.numericAdvantage} · ${item.strategicAdvantage}` : undefined} onClick={() => toggle(item.id)} key={item.id}><span className="kanban-check">{completed ? <CheckCircle2 size={17}/> : <i/>}</span><strong>{item.title}</strong><p>{item.detail}</p><small><b>{item.numericAdvantage}</b><em>{item.strategicAdvantage}</em></small></button>;
      })}{!laneItems.length && <p className="kanban-empty">Empty</p>}</div></article>;
    })}</div>
  </section>;
}
