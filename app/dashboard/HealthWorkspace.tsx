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
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  HeartPulse,
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
import { CollapsibleSection, DailyKanbanBoard, HealthCategoryIcon, HealthMasonryGrid, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import { compactHealthDate, healthTrendTone } from "./utils";

export type HealthWorkspaceSection = "h2" | "h3";
export type HealthTopSection = "h1" | HealthWorkspaceSection;
export type HealthSectionPage =
  | "optimism" | "insights" | "guidance" | "guardrails"
  | "metrics-overview" | "activity" | "sleep" | "heart" | "respiratory" | "mobility" | "nutrition-1" | "nutrition-2";

const HEALTH_TOP_SECTIONS = [
  { id: "h1", label: "Action Board" },
  { id: "h2", label: "Daily Optimism" },
  { id: "h3", label: "Vital Metrics" },
] as const;

const GUIDANCE_PAGES = ["optimism", "insights", "guidance", "guardrails"] as const;
const LEGACY_STATUS_PAGES = ["summary", "coverage", "archive"] as const;

const SECTION_PAGES: Record<HealthWorkspaceSection, Array<{ id: HealthSectionPage; label: string }>> = {
  h2: [
    { id: "optimism", label: "Optimism" },
    { id: "insights", label: "Insights" },
    { id: "guidance", label: "Guidance" },
    { id: "guardrails", label: "Guardrails" },
  ],
  h3: [
    { id: "metrics-overview", label: "Overview" },
    { id: "activity", label: "Activity" },
    { id: "sleep", label: "Sleep" },
    { id: "heart", label: "Heart" },
    { id: "respiratory", label: "Respiratory" },
    { id: "mobility", label: "Mobility" },
    { id: "nutrition-1", label: "Nutrition I" },
    { id: "nutrition-2", label: "Nutrition II" },
  ],
};

const SECTION_META = {
  h2: { number: "H-2", title: "Daily Optimism", note: "Exact  Health Daily optimism plus HealthKit guidance and guardrails", icon: Sparkles },
  h3: { number: "H-3", title: "Vital Metrics", note: "Direction columns with category-coloured KPIs and weekly/monthly comparisons", icon: HeartPulse },
} as const;

const HEALTH_CATEGORY_PAGE: Record<string, HealthSectionPage> = {
  Activity: "activity",
  Sleep: "sleep",
  Heart: "heart",
  Respiratory: "respiratory",
  Mobility: "mobility",
  Nutrition: "nutrition-1",
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
  if (!rawSection) return null;
  // Legacy: Vital Metrics lived at h4; retired status subviews (summary/coverage/archive) are ignored.
  if (rawSection === "h4") return "h3";
  if (rawSection === "h2" && LEGACY_STATUS_PAGES.includes(rawPage as typeof LEGACY_STATUS_PAGES[number])) return null;
  if (rawSection === "h3" && GUIDANCE_PAGES.includes(rawPage as typeof GUIDANCE_PAGES[number])) return "h2";
  if (rawSection in SECTION_PAGES) return rawSection as HealthWorkspaceSection;
  return null;
}

function healthRouteFromUrl() {
  if (typeof window === "undefined") {
    return {
      section: null as HealthWorkspaceSection | null,
      page: null as HealthSectionPage | null,
      focus: "h1" as HealthTopSection,
    };
  }
  const search = new URLSearchParams(window.location.search);
  const rawSection = search.get("section");
  const rawPage = search.get("page");
  const section = resolveHealthSection(rawSection, rawPage);
  const page = section && SECTION_PAGES[section].some((item) => item.id === rawPage)
    ? rawPage as HealthSectionPage
    : section ? SECTION_PAGES[section][0]!.id : null;
  const rawFocus = search.get("focus");
  const focus = section
    ? section
    : HEALTH_TOP_SECTIONS.some((item) => item.id === rawFocus)
      ? rawFocus as HealthTopSection
      : rawSection === "h4"
        ? "h3"
        : HEALTH_TOP_SECTIONS.some((item) => item.id === rawSection)
          ? rawSection as HealthTopSection
          : "h1";
  return { section, page, focus };
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
  page,
  healthSnapshot,
  healthCurrent,
  healthNote,
  healthNoteSource,
}: {
  page: "optimism" | "insights" | "guidance" | "guardrails";
  healthSnapshot: HealthLiveSnapshot;
  healthCurrent: boolean;
  healthNote: AppleNoteSnapshot | null;
  healthNoteSource: ContentSourceState;
}) {
  const optimismText = healthNote?.dailyOptimism?.trim() || "";
  const optimismLive = healthNoteSource.status === "live" && Boolean(healthNote);
  const optimismDate = healthNote?.observedDate || healthNote?.modifiedAt?.slice(0, 10) || "";
  const guidanceItems = enrichHealthGuidanceActions(healthSnapshot);
  const noteStats = parseHealthDailyNoteStats(healthNote?.summary);
  const operationalDate = healthSnapshot.requiredThrough ?? healthSnapshot.targetDate ?? healthSnapshot.dataDate;
  const noteLagging = Boolean(optimismDate && operationalDate && optimismDate < operationalDate);
  const optimismSubtitle = optimismText
    ? `Exact  Health Daily note · ${optimismDate ? compactHealthDate(optimismDate) : "latest entry"} · plus HealthKit guidance`
    : healthCurrent
      ? `Prioritised suggestions from ${compactHealthDate(healthSnapshot.dataDate)} HealthKit aggregates`
      : "Last validated guidance; sync the iPhone before relying on it";
  const attentionCount = guidanceItems.filter((item) => item.tone === "red" || item.tone === "amber").length;

  if (page === "optimism") {
    return <article className={`panel health-optimism-panel viewport ${optimismText ? "has-entry" : ""}`} aria-label="Daily Optimism">
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
          ? "Suggestions combine the exact  Health Daily entry with validated HealthKit aggregates."
          : optimismLive === false
            ? `Written optimism ${healthNoteSource.status === "permission_required" ? "needs Notes permission" : "is unavailable"}; the brief uses validated HealthKit aggregates only.`
            : noteLagging
              ? `Written optimism was last observed ${compactHealthDate(optimismDate)}; the brief uses the ${compactHealthDate(operationalDate)} operational Health target.`
              : "No written Daily Optimism entry was present; the brief uses validated HealthKit aggregates only."}
      </p>
    </article>;
  }

  if (page === "insights") {
    return <section className="health-insights-page" aria-label="Health insights">
      <div className="health-mirroring-banner" role="status">
        <ShieldAlert size={16}/>
        <div>
          <b>Livity / iPhone Mirroring unavailable this session</b>
          <span>Computer Use could not open Livity. Insights below use only the validated HealthKit snapshot and the exact  Health Daily note — no fabricated Livity numbers.</span>
        </div>
      </div>
      {noteStats.length ? <div className="health-note-stats" aria-label=" Health Daily shortcut stats">
        <header><b> Health Daily shortcut snapshot</b><span>{optimismDate ? compactHealthDate(optimismDate) : "latest note"} · evidence only · HealthKit takes precedence</span></header>
        <div>{noteStats.map((stat) => <article key={stat.label}><small>{stat.label}</small><b>{stat.value}</b></article>)}</div>
      </div> : null}
      <div className="health-action-list viewport" aria-label="Metric-derived health insights">
        {guidanceItems.map((item) => <div key={item.title}><span className={`dot ${item.tone}`}/><div><b>{item.title}</b><p>{item.text}</p></div></div>)}
      </div>
    </section>;
  }

  if (page === "guidance") {
    return <section className="health-guidance-page">
      <div className="health-action-list viewport" aria-label="HealthKit daily guidance">
        {guidanceItems.map((item) => <div key={item.title}><span className={`dot ${item.tone}`}/><div><b>{item.title}</b><p>{item.text}</p></div></div>)}
      </div>
    </section>;
  }

  return <article className="panel health-caveat-panel viewport">
    <div className="panel-title"><div><h3>Interpretation guardrails</h3><p>What this snapshot can and cannot support</p></div><ShieldAlert size={18}/></div>
    <ul>{healthCaveats.map((item) => <li key={item}>{item}</li>)}</ul>
    <p className="medical-note">Wellness summary only. It is not medical advice and should not be used to diagnose or change treatment.</p>
  </article>;
}

function HealthMetricsWorkbench({
  page,
  categories,
  onOpenPage,
}: {
  page: Exclude<HealthSectionPage, "optimism" | "insights" | "guidance" | "guardrails">;
  categories: HealthCategorySnapshot[];
  onOpenPage: (page: HealthSectionPage) => void;
}) {
  if (page === "metrics-overview") {
    return <section className="health-metrics-overview">
      {categories.map((category) => {
        const primary = primaryHealthMetric(category);
        const supporting = category.metrics.filter((metric) => metric !== primary).slice(0, 6);
        return <button type="button" className={`health-metric-preview ${category.tone}`} onClick={() => onOpenPage(HEALTH_CATEGORY_PAGE[category.name] ?? "metrics-overview")} aria-label={`Open ${category.name} metrics`} key={category.name}>
          <header><span><HealthCategoryIcon name={category.name}/><b>{category.name}</b></span><em>{category.metrics.length} KPIs</em></header>
          {primary ? <div className="health-preview-hero">
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
  }

  const categoryName = page.startsWith("nutrition") ? "Nutrition" : page.charAt(0).toUpperCase() + page.slice(1);
  const category = categories.find((item) => item.name === categoryName);
  if (!category) return <div className="health-guidance-empty"><b>{categoryName} data unavailable</b><span>The current Health snapshot does not include this category.</span></div>;
  const metrics = page === "nutrition-1" ? category.metrics.slice(0, 6)
    : page === "nutrition-2" ? category.metrics.slice(6)
      : category.metrics;
  return <HealthMasonryGrid categories={[{ ...category, metrics }]} compact/>;
}

export function HealthWorkspace({
  healthIncognito,
  setHealthIncognito,
  healthSnapshot,
  healthCurrent,
  healthError: _healthError,
  healthRequiredDate: _healthRequiredDate,
  healthMissingDates: _healthMissingDates,
  healthNote,
  healthNoteSource,
}: {
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
  void _healthMissingDates;
  const shellRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<{ section: HealthWorkspaceSection | null; page: HealthSectionPage | null; focus: HealthTopSection }>({ section: null, page: null, focus: "h1" });
  const healthStatusLabel = healthSnapshot.status === "live" ? "SYNCED"
    : healthSnapshot.status === "cached" ? "CACHED"
      : healthSnapshot.status === "partial" ? "PARTIAL"
        : healthSnapshot.status === "stale" ? "STALE"
          : "UNAVAILABLE";
  const healthStatusTone = healthSnapshot.status === "live" ? "green"
    : healthSnapshot.status === "stale" || healthSnapshot.status === "unavailable" ? "red"
      : "amber";
  useEffect(() => {
    const sync = () => setRoute(healthRouteFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("health-console-active", Boolean(route.section));
    document.documentElement.classList.toggle("viewport-console-active", Boolean(route.section));
    return () => document.documentElement.classList.remove("health-console-active", "viewport-console-active");
  }, [route.section]);

  useLayoutEffect(() => {
    if (!route.section) {
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
    document.querySelectorAll(".masthead, .live-feed-banner, .source-freshness-strip, .workspace-navigation").forEach((element) => layoutObserver.observe(element));
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
  }, [route.page, route.section]);

  const navigate = useCallback((section: HealthWorkspaceSection | null, page?: HealthSectionPage, replace = false) => {
    const url = new URL(window.location.href);
    if (!section) {
      const previous = url.searchParams.get("section");
      url.searchParams.delete("section");
      url.searchParams.delete("page");
      const focus = previous === "h4"
        ? "h3"
        : previous && HEALTH_TOP_SECTIONS.some((item) => item.id === previous)
          ? previous
          : null;
      if (focus) url.searchParams.set("focus", focus);
    } else {
      url.searchParams.set("section", section);
      url.searchParams.set("page", page ?? SECTION_PAGES[section][0]!.id);
      url.searchParams.delete("focus");
    }
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(healthRouteFromUrl());
  }, []);

  const selectTopSection = useCallback((sectionId: string) => {
    const section = sectionId as HealthTopSection;
    if (section === "h1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("section");
      url.searchParams.delete("page");
      url.searchParams.set("focus", "h1");
      window.history.pushState({}, "", url);
      setRoute(healthRouteFromUrl());
      expandDashboardSection(dashboardSectionNumberFromNavId(section));
      window.requestAnimationFrame(() => {
        document.getElementById("health-h1")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    if (route.section) {
      navigate(section, SECTION_PAGES[section][0]!.id);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("section");
    url.searchParams.delete("page");
    url.searchParams.set("focus", section);
    window.history.pushState({}, "", url);
    setRoute(healthRouteFromUrl());
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
    document.getElementById(`health-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [navigate, route.section]);

  const pages = route.section ? SECTION_PAGES[route.section] : [];
  const pageIndex = pages.findIndex((item) => item.id === route.page);
  const changePage = (index: number) => route.section && navigate(route.section, pages[Math.max(0, Math.min(pages.length - 1, index))]!.id);
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!route.section) return;
    if (event.key === "Escape") { event.preventDefault(); navigate(null); }
    if (event.key === "ArrowLeft") { event.preventDefault(); changePage(pageIndex - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); changePage(pageIndex + 1); }
    if (event.key === "Home") { event.preventDefault(); changePage(0); }
    if (event.key === "End") { event.preventDefault(); changePage(pages.length - 1); }
  };
  const showHealth = () => setHealthIncognito(false);
  const activeTopSection = route.section ?? route.focus;

  return <div className={`sector-workspace-shell health-workspace-shell ${route.section ? "" : "health-full-workspace"}`} ref={shellRef} tabIndex={-1} onKeyDown={onKeyDown}>
    <WorkspaceSectionNav
      label="Health & Wellness sections"
      sections={HEALTH_TOP_SECTIONS}
      activeId={activeTopSection}
      onSelect={selectTopSection}
    />
    {!route.section ? <>
      <div id="health-h1" className="workspace-section action-board-workspace-section">
        <CollapsibleSection number="H-1" title="Health action board" note="Clickable daily source, trend and optimisation actions">
          <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
            <DailyKanbanBoard workspace="health"/>
          </HealthIncognitoGate>
        </CollapsibleSection>
      </div>
      <div id="health-h2" className="workspace-section health-full-section health-guidance-full-section">
        <CollapsibleSection number="H-2" title="Daily Optimism" note={healthIncognito ? "Daily Optimism hidden by Incognito" : SECTION_META.h2.note} headerAction={<span className={`pill ${healthIncognito ? "amber" : healthStatusTone}`}>{healthIncognito ? "INCOGNITO" : healthStatusLabel}</span>}>
          <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
            <div className="health-full-section-stack">
              <HealthGuidanceWorkbench page="optimism" healthSnapshot={healthSnapshot} healthCurrent={healthCurrent} healthNote={healthNote} healthNoteSource={healthNoteSource}/>
              <HealthGuidanceWorkbench page="guardrails" healthSnapshot={healthSnapshot} healthCurrent={healthCurrent} healthNote={healthNote} healthNoteSource={healthNoteSource}/>
            </div>
          </HealthIncognitoGate>
        </CollapsibleSection>
      </div>
      <div id="health-h3" className="workspace-section health-full-section">
        <CollapsibleSection number="H-3" title="Vital Metrics" note={healthIncognito ? "Vital metrics hidden by Incognito" : SECTION_META.h3.note}>
          <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
            <HealthMasonryGrid categories={healthSnapshot.categories}/>
          </HealthIncognitoGate>
        </CollapsibleSection>
      </div>
    </> : <section className={`sector-detail-shell health-detail-shell ${route.section}`} aria-label={SECTION_META[route.section].title}>
      <header className="sector-detail-header">
        <button type="button" className="sector-back-button" onClick={() => navigate(null)}><ArrowLeft size={17}/><span>Overview</span></button>
        <div><span>{SECTION_META[route.section].number}</span><h2>{SECTION_META[route.section].title}</h2><p>{healthIncognito ? "Hidden while Health Incognito is active" : SECTION_META[route.section].note}</p></div>
        <em className={`pill ${healthIncognito ? "amber" : healthStatusTone}`}>{healthIncognito ? "INCOGNITO" : healthStatusLabel}</em>
      </header>
      {pages.length > 1 && <nav className="sector-page-nav" aria-label={`${SECTION_META[route.section].title} pages`}>
        <button type="button" disabled={pageIndex <= 0} onClick={() => changePage(pageIndex - 1)} aria-label="Previous page"><ChevronLeft size={17}/></button>
        <div role="tablist">{pages.map((item) => <button type="button" role="tab" aria-selected={route.page === item.id} className={route.page === item.id ? "active" : ""} onClick={() => navigate(route.section!, item.id)} key={item.id}><i/><span>{item.label}</span></button>)}</div>
        <button type="button" disabled={pageIndex >= pages.length - 1} onClick={() => changePage(pageIndex + 1)} aria-label="Next page"><ChevronRight size={17}/></button>
      </nav>}
      <div className="sector-detail-body health-detail-body">
        <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
          {route.section === "h2" && <HealthGuidanceWorkbench page={route.page as "optimism" | "insights" | "guidance" | "guardrails"} healthSnapshot={healthSnapshot} healthCurrent={healthCurrent} healthNote={healthNote} healthNoteSource={healthNoteSource}/>}
          {route.section === "h3" && <HealthMetricsWorkbench page={route.page as "metrics-overview" | "activity" | "sleep" | "heart" | "respiratory" | "mobility" | "nutrition-1" | "nutrition-2"} categories={healthSnapshot.categories} onOpenPage={(page) => navigate("h3", page)}/>}
        </HealthIncognitoGate>
      </div>
    </section>}
  </div>;
}
