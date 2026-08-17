"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Minus,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { AppleNoteSnapshot, ContentSourceState } from "../content-types";
import { healthCaveats, type HealthMetric } from "../health-data";
import {
  enrichHealthGuidanceActions,
  parseHealthDailyNoteStats,
} from "../health-insights";
import type { HealthCategorySnapshot, HealthLiveSnapshot } from "../health-live-types";
import { CollapsibleSection, DailyKanbanBoard, HealthCategoryIcon, HealthMasonryGrid, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection, nativeChromeHidesSection } from "./shared-ui";
import { compactHealthDate, healthTrendTone } from "./utils";
import {
  parseHealthH2Page,
  parseHealthH3Page,
  parseHealthSectionPage,
  parseHealthTopSection,
  type HealthH2Page,
  type HealthH3Page,
  type HealthSectionPage,
} from "./workspace-routing";

export type HealthWorkspaceSection = "h2" | "h3";
export type HealthTopSection = "h1" | HealthWorkspaceSection;
export type { HealthSectionPage };

const HEALTH_TOP_SECTIONS = [
  { id: "h1", label: "Action Board" },
  { id: "h2", label: "Daily Optimism" },
  { id: "h3", label: "Vital Metrics" },
] as const;

const LEGACY_STATUS_PAGES = ["summary", "coverage", "archive"] as const;

const SECTION_PAGES: Record<HealthWorkspaceSection, Array<{ id: HealthSectionPage; label: string }>> = {
  h2: [
    { id: "optimism", label: "Daily Optimism" },
  ],
  h3: [
    { id: "metrics-overview", label: "Vital Metrics" },
    { id: "activity", label: "Activity" },
    { id: "sleep", label: "Sleep" },
    { id: "heart", label: "Heart" },
    { id: "respiratory", label: "Respiratory" },
    { id: "mobility", label: "Mobility" },
    { id: "nutrition", label: "Nutrition" },
  ],
};

const SECTION_META = {
  h2: { number: "H-2", title: "Daily Optimism", note: "HealthKit guidance plus Health Shortcut / Health Stats evidence and guardrails" },
  h3: { number: "H-3", title: "Vital Metrics", note: "Collapsible direction rows with category-coloured KPIs and weekly/monthly comparisons" },
} as const;

const HEALTH_CATEGORY_PAGE: Record<string, HealthH3Page> = {
  Activity: "activity",
  Sleep: "sleep",
  Heart: "heart",
  Respiratory: "respiratory",
  Mobility: "mobility",
  Nutrition: "nutrition",
};

type HealthRoute = {
  section: HealthWorkspaceSection | null;
  page: HealthSectionPage | null;
  focus: HealthTopSection;
  exclusive: boolean;
};

function primaryHealthMetric(category: HealthCategorySnapshot) {
  return category.metrics.find((metric) => metric.averages?.weekly) ?? category.metrics[0];
}

function HealthTrend({
  metric,
  compact = false,
}: {
  metric: HealthMetric;
  compact?: boolean;
}) {
  const weekly = metric.averages?.weekly;
  if (!weekly) return <span className={`health-preview-trend moderate ${compact ? "compact" : ""}`}><Minus size={compact ? 12 : 16}/><small>No 7-day comparison</small></span>;
  const tone = healthTrendTone(metric, weekly.direction);
  const Icon = weekly.direction === "up" ? TrendingUp : weekly.direction === "down" ? TrendingDown : Minus;
  return <span className={`health-preview-trend ${tone} ${compact ? "compact" : ""}`} title={`7-day average ${weekly.value}`}>
    <Icon size={compact ? 13 : 18}/>
    <small>{weekly.delta ?? "vs 7-day"}</small>
  </span>;
}

function resolveHealthSection(rawSection: string | null, rawPage: string | null): HealthWorkspaceSection | null {
  const top = parseHealthTopSection(rawSection);
  if (!top || top === "h1") return null;
  if (top === "h2" && LEGACY_STATUS_PAGES.includes(rawPage as typeof LEGACY_STATUS_PAGES[number])) return null;
  switch (rawPage) {
    case "optimism":
    case "insights":
    case "guidance":
    case "guardrails":
      if (top === "h3") return "h2";
      break;
    default:
      break;
  }
  return top;
}

function healthRouteFromUrl(): HealthRoute {
  if (typeof window === "undefined") {
    return {
      section: null,
      page: null,
      focus: "h1",
      exclusive: true,
    };
  }
  const search = new URLSearchParams(window.location.search);
  const rawSection = search.get("section");
  const rawPage = search.get("page");
  const section = resolveHealthSection(rawSection, rawPage);
  const exclusiveTop = parseHealthTopSection(rawSection) ?? "h1";
  const page = section ? parseHealthSectionPage(section, rawPage) : null;
  const rawFocus = search.get("focus");
  const focus = section
    ? section
    : exclusiveTop === "h1"
      ? "h1"
      : HEALTH_TOP_SECTIONS.some((item) => item.id === rawFocus)
        ? rawFocus as HealthTopSection
        : exclusiveTop;
  return { section, page, focus, exclusive: true };
}

function HealthIncognitoGate({
  active,
  onShow,
  children,
}: {
  active: boolean;
  onShow: () => void;
  children: ReactNode;
}) {
  if (!active) return children;
  return <section className="health-incognito-placeholder compact"><EyeOff size={28}/><h3>Health statistics hidden</h3><p>Incognito removes health values, source metadata, comparisons and recommendations from this view.</p><button type="button" onClick={onShow}><Eye size={15}/> Show health statistics</button></section>;
}

function HealthGuidanceWorkbench({
  focusPage,
  healthSnapshot,
  healthCurrent,
  healthNote,
  healthNoteSource,
}: {
  focusPage?: HealthH2Page;
  healthSnapshot: HealthLiveSnapshot;
  healthCurrent: boolean;
  healthNote: AppleNoteSnapshot | null;
  healthNoteSource: ContentSourceState;
}) {
  const stackRef = useRef<HTMLDivElement>(null);
  const optimismText = healthNote?.dailyOptimism?.trim() || "";
  const optimismLive = healthNoteSource.status === "live" && Boolean(healthNote);
  const optimismDate = healthNote?.observedDate || healthNote?.modifiedAt?.slice(0, 10) || "";
  const guidanceItems = enrichHealthGuidanceActions(healthSnapshot);
  const noteStats = parseHealthDailyNoteStats(healthNote?.summary);
  const operationalDate = healthSnapshot.requiredThrough ?? healthSnapshot.targetDate ?? healthSnapshot.dataDate;
  const noteLagging = Boolean(optimismDate && operationalDate && optimismDate < operationalDate);
  const optimismSubtitle = optimismText
    ? `Daily Optimism · ${optimismDate ? compactHealthDate(optimismDate) : "latest entry"} · plus HealthKit guidance`
    : healthCurrent
      ? `Prioritised suggestions from ${compactHealthDate(healthSnapshot.dataDate)} HealthKit aggregates`
      : "Last validated guidance; sync the iPhone before relying on it";
  const attentionCount = guidanceItems.filter((item) => item.tone === "red" || item.tone === "amber").length;

  useLayoutEffect(() => {
    if (!focusPage) return;
    const node = stackRef.current?.querySelector<HTMLElement>(`#health-h2-${focusPage}`);
    node?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [focusPage]);

  return <div className="health-full-section-stack health-optimism-combined" ref={stackRef}>
    <article id="health-h2-optimism" className={`panel health-optimism-panel morning-light viewport ${optimismText ? "has-entry" : ""}`} aria-label="Daily Optimism">
      <div className="panel-title"><div><h3>Daily Optimism</h3><p>{optimismSubtitle}</p></div><Sparkles size={18}/></div>
      {optimismText ? <p className="health-optimism-text">{optimismText}</p> : null}
      <section className="health-daily-brief" aria-label="Today’s prioritised health suggestions">
        <header><div><small>TODAY’S HEALTH BRIEF</small><b>{attentionCount ? `${attentionCount} items deserve attention` : "No priority exception detected"}</b></div><span>{guidanceItems.length} suggestions · critical first</span></header>
        <div className="health-action-list viewport health-brief-list">
          {guidanceItems.map((item) => <div key={item.title}><span className={`dot ${item.tone}`}/><div><b>{item.title}</b><p>{item.text}</p></div></div>)}
        </div>
      </section>
      <p className="health-optimism-footnote">
        {optimismText
          ? "Suggestions combine Daily Optimism text with validated HealthKit aggregates."
          : optimismLive === false
            ? "Written Daily Optimism is unavailable; the brief uses validated HealthKit aggregates only."
            : noteLagging
              ? `Written optimism was last observed ${compactHealthDate(optimismDate)}; the brief uses the ${compactHealthDate(operationalDate)} operational Health target.`
              : "No written Daily Optimism entry was present; the brief uses validated HealthKit aggregates only."}
      </p>
    </article>
    <section id="health-h2-insights" className="health-insights-page" aria-label="Insights">
      <div className="panel-title"><div><h3>Insights</h3><p>HealthKit snapshot and Health Shortcut / Health Stats evidence</p></div></div>
      <div className="health-mirroring-banner health-insight-crystal" role="status">
        <ShieldAlert size={16}/>
        <div>
          <b>Livity / iPhone Mirroring unavailable this session</b>
          <span>Computer Use could not open Livity. Insights below use only the validated HealthKit snapshot and Health Shortcut / Health Stats — no fabricated Livity numbers.</span>
        </div>
      </div>
      {noteStats.length ? <div className="health-note-stats health-insight-crystal" aria-label="Health Shortcut Health Stats snapshot">
        <header><b>Health Shortcut / Health Stats snapshot</b><span>{optimismDate ? compactHealthDate(optimismDate) : "latest export"} · evidence only · HealthKit takes precedence</span></header>
        <div>{noteStats.map((stat) => <article key={stat.label}><small>{stat.label}</small><b>{stat.value}</b></article>)}</div>
      </div> : null}
      <div className="health-action-list viewport" aria-label="Metric-derived health insights">
        {guidanceItems.map((item) => <div className="health-insight-crystal" key={item.title}><span className={`dot ${item.tone}`}/><div><b>{item.title}</b><p>{item.text}</p></div></div>)}
      </div>
    </section>
    <section id="health-h2-guidance" className="health-guidance-page" aria-label="Guidance">
      <div className="panel-title"><div><h3>Guidance</h3><p>HealthKit daily guidance</p></div></div>
      <div className="health-coach-lane" aria-label="HealthKit daily guidance">
        {guidanceItems.map((item) => <button type="button" className={`coach-item ${item.tone}`} key={item.title}><i/><div><b>{item.title}</b><p>{item.text}</p></div></button>)}
      </div>
    </section>
    <article id="health-h2-guardrails" className="panel health-caveat-panel health-guardrail-slab viewport">
      <div className="panel-title"><div><h3>Interpretation guardrails</h3><p>What this snapshot can and cannot support</p></div><ShieldAlert size={18}/></div>
      <ul>{healthCaveats.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="medical-note">Wellness summary only. It is not medical advice and should not be used to diagnose or change treatment.</p>
    </article>
  </div>;
}

function healthCategoryName(page: Exclude<HealthH3Page, "metrics-overview">): string {
  switch (page) {
    case "activity":
      return "Activity";
    case "sleep":
      return "Sleep";
    case "heart":
      return "Heart";
    case "respiratory":
      return "Respiratory";
    case "mobility":
      return "Mobility";
    case "nutrition":
      return "Nutrition";
    default: {
      const _exhaustive: never = page;
      return _exhaustive;
    }
  }
}

function HealthMetricsWorkbench({
  page,
  categories,
  onOpenPage,
}: {
  page: HealthH3Page;
  categories: HealthCategorySnapshot[];
  onOpenPage: (page: HealthH3Page) => void;
}) {
  switch (page) {
    case "metrics-overview":
      return <section className="health-metrics-overview health-organ-portals">
      {categories.map((category) => {
        const primary = primaryHealthMetric(category);
        const supporting = category.metrics.filter((metric) => metric !== primary).slice(0, 6);
        return <button type="button" className={`health-metric-preview health-organ-portal ${category.tone}`} onClick={() => onOpenPage(HEALTH_CATEGORY_PAGE[category.name] ?? "metrics-overview")} aria-label={`Open ${category.name} metrics`} key={category.name}>
          <header><span><HealthCategoryIcon name={category.name}/><b>{category.name}</b></span><em>{category.metrics.length} KPIs</em></header>
          {primary ? <div className="health-preview-hero portal-core">
            <span><small>{primary.label}</small><strong>{primary.value}</strong></span>
            <HealthTrend metric={primary}/>
          </div> : <div className="health-preview-empty">No validated metric</div>}
          <div className="health-preview-signal-list">
            {supporting.map((metric) => <span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b><HealthTrend metric={metric} compact/></span>)}
          </div>
          <footer><span>{category.note}</span><ChevronRight size={15}/></footer>
        </button>;
      })}
    </section>;
    case "activity":
    case "sleep":
    case "heart":
    case "respiratory":
    case "mobility":
    case "nutrition": {
      const categoryName = healthCategoryName(page);
      const category = categories.find((item) => item.name === categoryName);
      if (!category) return <div className="health-guidance-empty"><b>{categoryName} data unavailable</b><span>The current Health snapshot does not include this category.</span></div>;
      return <div className={page === "nutrition" ? "nutrition-lab-tray" : undefined}>
        <HealthMasonryGrid categories={[category]} compact/>
      </div>;
    }
    default: {
      const _exhaustive: never = page;
      return _exhaustive;
    }
  }
}

export function HealthWorkspace({
  active = true,
  healthIncognito,
  setHealthIncognito,
  healthSnapshot,
  healthCurrent,
  healthError: _healthError,
  healthRequiredDate: _healthRequiredDate,
  healthMissingDates,
  healthNote,
  healthNoteSource,
}: {
  active?: boolean;
  healthIncognito: boolean;
  setHealthIncognito: (active: boolean) => void;
  healthSnapshot: HealthLiveSnapshot;
  healthCurrent: boolean;
  healthError: string;
  healthRequiredDate: string;
  healthMissingDates: string[];
  healthNote: AppleNoteSnapshot | null;
  healthNoteSource: ContentSourceState;
}) {
  void _healthError;
  void _healthRequiredDate;
  const missingDates = healthMissingDates.length
    ? healthMissingDates
    : (healthSnapshot.missingDates ?? []);
  const shellRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<HealthRoute>(healthRouteFromUrl);
  const healthStatusLabel = healthSnapshot.status === "live" ? "SYNCED"
    : healthSnapshot.status === "cached" ? "CACHED"
      : healthSnapshot.status === "partial" ? "PARTIAL"
        : healthSnapshot.status === "stale" ? "STALE"
          : "UNAVAILABLE";
  const healthStatusTone = healthSnapshot.status === "live" ? "green"
    : healthSnapshot.status === "stale" || healthSnapshot.status === "unavailable" ? "red"
      : "amber";
  useEffect(() => {
    const sync = () => {
      const next = healthRouteFromUrl();
      setRoute(next);
      const navId = next.section ?? next.focus;
      expandDashboardSection(dashboardSectionNumberFromNavId(navId));
    };
    sync();
    const retry = window.setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  useEffect(() => {
    const on = active && route.exclusive;
    document.documentElement.classList.toggle("health-console-active", on);
    document.documentElement.classList.toggle("viewport-console-active", on);
    return () => document.documentElement.classList.remove("health-console-active", "viewport-console-active");
  }, [active, route.exclusive]);

  useLayoutEffect(() => {
    if (!active || !route.exclusive) {
      if (shellRef.current) shellRef.current.style.removeProperty("height");
      return;
    }
    const fit = () => {
      if (!shellRef.current) return;
      const top = shellRef.current.getBoundingClientRect().top;
      const minimumHeight = window.innerHeight <= 700 ? 180 : window.innerWidth <= 760 ? 360 : 420;
      const viewportReserve = window.innerHeight <= 700 ? 20 : 8;
      shellRef.current.style.height = `${Math.max(minimumHeight, window.innerHeight - top - viewportReserve)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    const layoutObserver = new ResizeObserver(fit);
    document.querySelectorAll(".masthead, .live-feed-banner, .source-freshness-region, .workspace-navigation").forEach((element) => layoutObserver.observe(element));
    const mutationObserver = new MutationObserver(() => window.requestAnimationFrame(fit));
    const dashboardRoot = document.querySelector(".dashboard-app");
    if (dashboardRoot) mutationObserver.observe(dashboardRoot, { childList: true, characterData: true, subtree: true });
    const delayedFits = [250, 1000, 3000].map((delay) => window.setTimeout(fit, delay));
    const frame = window.requestAnimationFrame(() => {
      fit();
      window.dispatchEvent(new Event("resize"));
    });
    return () => {
      window.cancelAnimationFrame(frame);
      delayedFits.forEach(window.clearTimeout);
      window.removeEventListener("resize", fit);
      layoutObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [active, route.exclusive, route.page, route.section]);

  const navigate = useCallback((section: HealthWorkspaceSection | null, page?: HealthSectionPage, replace = false) => {
    const url = new URL(window.location.href);
    if (!section) {
      url.searchParams.set("section", "h1");
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("section", section);
      url.searchParams.set("page", page ?? SECTION_PAGES[section][0]!.id);
    }
    url.searchParams.delete("focus");
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(healthRouteFromUrl());
  }, []);

  const selectTopSection = useCallback((sectionId: string) => {
    const section = sectionId as HealthTopSection;
    if (section === "h1") {
      navigate(null);
      expandDashboardSection(dashboardSectionNumberFromNavId(section));
      return;
    }
    navigate(section, SECTION_PAGES[section][0]!.id);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
  }, [navigate]);

  const pages = route.section === "h3" ? SECTION_PAGES.h3 : [];
  const pageIndex = pages.findIndex((item) => item.id === route.page);
  const changePage = (index: number) => route.section === "h3" && pages.length > 0 && navigate("h3", pages[Math.max(0, Math.min(pages.length - 1, index))]!.id);
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); selectTopSection("h1"); return; }
    if (route.section !== "h3" || pages.length <= 1) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); changePage(pageIndex - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); changePage(pageIndex + 1); }
    if (event.key === "Home") { event.preventDefault(); changePage(0); }
    if (event.key === "End") { event.preventDefault(); changePage(pages.length - 1); }
  };
  const showHealth = () => setHealthIncognito(false);
  const activeTopSection = route.section ?? route.focus;
  const focusedSection = route.exclusive ? activeTopSection : null;
  const h3Page = parseHealthH3Page(route.page);
  const h3ShowsCategory = route.section === "h3" && h3Page !== "metrics-overview";

  return <div className="health-workspace-shell" data-focus-section={focusedSection ?? undefined} ref={shellRef} tabIndex={-1} onKeyDown={onKeyDown}>
    <WorkspaceSectionNav
      label="Health & Wellness sections"
      sections={HEALTH_TOP_SECTIONS}
      activeId={activeTopSection}
      onSelect={selectTopSection}
    />
    <div id="health-h1" className="workspace-section action-board-workspace-section" hidden={nativeChromeHidesSection(focusedSection, "h1")}>
      <CollapsibleSection number="H-1" title="Health action board" note="Clickable daily source, trend and optimisation actions" defaultOpen={focusedSection === "h1"}>
        <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
          <DailyKanbanBoard workspace="health"/>
        </HealthIncognitoGate>
      </CollapsibleSection>
    </div>
    <div id="health-h2" className="workspace-section health-full-section health-guidance-full-section" hidden={nativeChromeHidesSection(focusedSection, "h2")}>
      <CollapsibleSection number="H-2" title="Daily Optimism" note={healthIncognito ? "Daily Optimism hidden by Incognito" : SECTION_META.h2.note} headerAction={<span className={`pill ${healthIncognito ? "amber" : healthStatusTone}`}>{healthIncognito ? "INCOGNITO" : healthStatusLabel}</span>} defaultOpen={focusedSection === "h2"}>
        <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
          <HealthGuidanceWorkbench focusPage={route.section === "h2" ? parseHealthH2Page(route.page) : undefined} healthSnapshot={healthSnapshot} healthCurrent={healthCurrent} healthNote={healthNote} healthNoteSource={healthNoteSource}/>
        </HealthIncognitoGate>
      </CollapsibleSection>
    </div>
    <div id="health-h3" className="workspace-section health-full-section" hidden={nativeChromeHidesSection(focusedSection, "h3")}>
      <CollapsibleSection number="H-3" title="Vital Metrics" note={healthIncognito ? "Vital metrics hidden by Incognito" : SECTION_META.h3.note} defaultOpen={focusedSection === "h3"}>
        <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
          {missingDates.length > 0 && (
            <p className="health-missing-ribbon" role="status">
              Missing Health days: {missingDates.join(", ")}. Refresh those dates before trusting 7-day or 30-day comparisons.
            </p>
          )}
          {route.section === "h3" && pages.length > 1 && <nav className="sector-page-nav sector-inline-page-nav" aria-label={`${SECTION_META.h3.title} pages`}>
            <button type="button" disabled={pageIndex <= 0} onClick={() => changePage(pageIndex - 1)} aria-label="Previous page"><ChevronLeft size={17}/></button>
            <div role="tablist">{pages.map((item) => <button type="button" role="tab" aria-selected={route.page === item.id} className={route.page === item.id ? "active" : ""} onClick={() => navigate("h3", item.id)} key={item.id}><i/><span>{item.label}</span></button>)}</div>
            <button type="button" disabled={pageIndex >= pages.length - 1} onClick={() => changePage(pageIndex + 1)} aria-label="Next page"><ChevronRight size={17}/></button>
          </nav>}
          {h3ShowsCategory
            ? <HealthMetricsWorkbench page={h3Page} categories={healthSnapshot.categories} onOpenPage={(page) => navigate("h3", page)}/>
            : <HealthMasonryGrid categories={healthSnapshot.categories}/>}
        </HealthIncognitoGate>
      </CollapsibleSection>
    </div>
  </div>;
}
