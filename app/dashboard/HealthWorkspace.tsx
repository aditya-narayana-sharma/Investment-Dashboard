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
  Activity,
  ArrowLeft,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileCheck2,
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
  enrichHealthSources,
  parseHealthDailyNoteStats,
} from "../health-insights";
import type { HealthCategorySnapshot, HealthLiveSnapshot } from "../health-live-types";
import { CollapsibleSection, DailyKanbanBoard, HealthCategoryIcon, HealthMasonryGrid } from "./shared-ui";
import { compactHealthDate, healthTrendTone } from "./utils";

export type HealthWorkspaceSection = "h2" | "h3" | "h4";
export type HealthSectionPage =
  | "summary" | "coverage" | "archive"
  | "optimism" | "insights" | "guidance" | "guardrails"
  | "metrics-overview" | "activity" | "sleep" | "heart" | "respiratory" | "mobility" | "nutrition-1" | "nutrition-2";

const SECTION_PAGES: Record<HealthWorkspaceSection, Array<{ id: HealthSectionPage; label: string }>> = {
  h2: [
    { id: "summary", label: "Status" },
    { id: "coverage", label: "Coverage" },
    { id: "archive", label: "Archive" },
  ],
  h3: [
    { id: "optimism", label: "Optimism" },
    { id: "insights", label: "Insights" },
    { id: "guidance", label: "Guidance" },
    { id: "guardrails", label: "Guardrails" },
  ],
  h4: [
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
  h2: { number: "H-2", title: "Health Status", note: "Operational target, coverage and archive integrity", icon: FileCheck2 },
  h3: { number: "H-3", title: "Daily Guidance", note: "Optimism, metric insights, evidence-backed actions and guardrails", icon: Sparkles },
  h4: { number: "H-4", title: "Vital Metrics", note: "Category KPIs with weekly and monthly comparisons", icon: HeartPulse },
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

function healthRouteFromUrl() {
  if (typeof window === "undefined") {
    return { section: null as HealthWorkspaceSection | null, page: null as HealthSectionPage | null };
  }
  const search = new URLSearchParams(window.location.search);
  const rawSection = search.get("section");
  const section = rawSection && rawSection in SECTION_PAGES ? rawSection as HealthWorkspaceSection : null;
  const rawPage = search.get("page");
  const page = section && SECTION_PAGES[section].some((item) => item.id === rawPage)
    ? rawPage as HealthSectionPage
    : section ? SECTION_PAGES[section][0]!.id : null;
  return { section, page };
}

function HealthThumbnail({
  section,
  onOpen,
  children,
  incognito,
}: {
  section: HealthWorkspaceSection;
  onOpen: (section: HealthWorkspaceSection, page?: HealthSectionPage) => void;
  children: ReactNode;
  incognito: boolean;
}) {
  const meta = SECTION_META[section];
  const Icon = meta.icon;
  return <article className={`sector-thumbnail health-thumbnail ${section}`}>
    <header>
      <span><Icon size={18}/><b>{meta.number}</b></span>
      <div><h2>{meta.title}</h2><p>{incognito ? "Hidden while Health Incognito is active" : meta.note}</p></div>
      <button type="button" className="sector-thumbnail-launch" onClick={() => onOpen(section)} aria-label={`Open ${meta.title}`}><ChevronRight size={19}/></button>
    </header>
    <div className="sector-thumbnail-body">{incognito ? <div className="health-thumbnail-incognito"><EyeOff size={22}/><b>Health data hidden</b><span>Open to manage Incognito</span></div> : children}</div>
    <footer><button type="button" onClick={() => onOpen(section)}>Explore {SECTION_PAGES[section].length} views <ChevronRight size={14}/></button><i/></footer>
  </article>;
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

function HealthStatusWorkbench({
  page,
  healthSnapshot,
  healthCurrent,
  healthError,
  healthRequiredDate,
  healthMissingDates,
  healthStatusLabel,
  healthStatusTone,
  targetPolicyLabel,
  rejectedArchiveName,
}: {
  page: "summary" | "coverage" | "archive";
  healthSnapshot: HealthLiveSnapshot;
  healthCurrent: boolean;
  healthError: string;
  healthRequiredDate: string;
  healthMissingDates: string[];
  healthStatusLabel: string;
  healthStatusTone: string;
  targetPolicyLabel: string;
  rejectedArchiveName: string;
}) {
  if (page === "summary") {
    return <section className="health-status-page">
      <section className={`health-privacy ${healthCurrent ? "current" : "stale"}`}>
        <HeartPulse size={18}/>
        <div>
          <b>{healthCurrent ? `Operational Health target verified through ${compactHealthDate(healthSnapshot.dataDate)}` : `Health source state: ${healthStatusLabel.toLowerCase()}${healthMissingDates.length ? ` · missing ${healthMissingDates.map(compactHealthDate).join(", ")}` : ""}`}</b>
          <span>{healthSnapshot.message}{healthError ? ` ${healthError}.` : ""}</span>
        </div>
        <span className={`pill ${healthStatusTone}`}>{healthStatusLabel}</span>
      </section>
      <div className="health-status-cards">
        <article><span>Operational target</span><b>{compactHealthDate(healthSnapshot.requiredThrough ?? healthRequiredDate)}</b><small>{targetPolicyLabel}</small></article>
        <article><span>Data through</span><b>{compactHealthDate(healthSnapshot.dataDate)}</b><small>{healthSnapshot.partialToday ? "Partial operational day" : "Completed records"}</small></article>
        <article className={healthMissingDates.length ? "missing" : "complete"}><span>Missing days</span><b>{healthMissingDates.length || "None"}</b><small>{healthMissingDates.length ? healthMissingDates.map(compactHealthDate).join(" · ") : "Coverage complete"}</small></article>
        <article className={rejectedArchiveName ? "missing" : "complete"}><span>Archive state</span><b>{rejectedArchiveName ? "Rejected latest" : "Validated"}</b><small>{healthSnapshot.archiveStatus ?? healthStatusLabel}</small></article>
      </div>
      <p className="health-console-note">The dashboard checks the Health archive on open, focus, network reconnection and every five minutes. Body Measurements, Hearing and medication details remain excluded.</p>
    </section>;
  }

  if (page === "coverage") {
    const categoryCoverage = healthSnapshot.categoryCoverage ?? {};
    return <section className="health-coverage-page">
      <section className="health-coverage-strip" aria-label="HealthKit operational-day coverage">
        <div><span>Operational target</span><b>{compactHealthDate(healthSnapshot.requiredThrough ?? healthRequiredDate)}</b><small>{targetPolicyLabel}</small></div>
        <div><span>Eligible through</span><b>{compactHealthDate(healthSnapshot.eligibleThrough ?? healthSnapshot.dataDate)}</b><small>{healthSnapshot.status === "live" ? "newest validated ZIP" : "validated fallback"}</small></div>
        <div className={healthMissingDates.length ? "missing" : "complete"}><span>Missing days</span><b>{healthMissingDates.length ? healthMissingDates.length : "None"}</b><small>{healthMissingDates.length ? healthMissingDates.map(compactHealthDate).join(" · ") : "Coverage complete"}</small></div>
        <div className={rejectedArchiveName ? "missing" : "complete"}><span>Latest archive</span><b>{rejectedArchiveName ? "Rejected" : healthSnapshot.archiveStatus === "verified_latest" ? "Verified" : healthStatusLabel}</b><small>{rejectedArchiveName || healthSnapshot.activeArchive?.split("/").pop() || "Export source"}</small></div>
      </section>
      <div className="health-category-coverage">
        {healthSnapshot.categories.map((category) => {
          const coverage = categoryCoverage[category.name] ?? categoryCoverage[category.name.toLowerCase()];
          return <article className={coverage?.available === false ? "missing" : category.tone} key={category.name}>
            <HealthCategoryIcon name={category.name}/>
            <div><b>{category.name}</b><span>{coverage?.date ? compactHealthDate(coverage.date) : compactHealthDate(healthSnapshot.dataDate)}</span></div>
            <strong>{coverage?.metricCount ?? category.metrics.length}</strong>
            <small>KPIs</small>
          </article>;
        })}
      </div>
      <div className="health-source-ledger" aria-label="Health evidence sources">
        {enrichHealthSources(healthSnapshot).map((source) => (
          <article className={source.status.toLowerCase().includes("unavailable") || source.status === "Rejected" ? "missing" : source.tone} key={source.source}>
            <span>{source.source}</span>
            <b>{source.status}</b>
            <small>{source.detail}</small>
          </article>
        ))}
      </div>
    </section>;
  }

  return <section className="health-archive-page">
    <div className="health-archive-grid">
      <article><FileCheck2 size={20}/><span>Active archive</span><b>{healthSnapshot.activeArchive?.split("/").pop() || "Validated extracted XML"}</b><small>{healthSnapshot.archiveStatus ?? "Active fallback"}</small></article>
      <article className={rejectedArchiveName ? "missing" : "complete"}><ShieldAlert size={20}/><span>Rejected archive</span><b>{rejectedArchiveName || "None"}</b><small>{healthSnapshot.fallbackReason || "No archive validation failure"}</small></article>
      <article><CalendarCheck2 size={20}/><span>Export captured</span><b>{healthSnapshot.exportCapturedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(healthSnapshot.exportCapturedAt)) : "Unavailable"}</b><small>Eligible through {compactHealthDate(healthSnapshot.eligibleThrough ?? healthSnapshot.dataDate)}</small></article>
      <article><Activity size={20}/><span>Snapshot received</span><b>{healthSnapshot.receivedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(healthSnapshot.receivedAt)) : healthSnapshot.capturedAt}</b><small>{healthSnapshot.source} · local private data</small></article>
    </div>
    <p className="health-console-note">A rejected or incomplete ZIP never replaces the last validated Health export. Cached records retain their original observation date and are not presented as newly collected values.</p>
  </section>;
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
  const guidanceItems = enrichHealthGuidanceActions(healthSnapshot, healthNote, healthNoteSource);
  const noteStats = parseHealthDailyNoteStats(healthNote?.summary);
  const operationalDate = healthSnapshot.requiredThrough ?? healthSnapshot.targetDate ?? healthSnapshot.dataDate;
  const noteLagging = Boolean(optimismDate && operationalDate && optimismDate < operationalDate);
  const optimismSubtitle = optimismText
    ? `Exact  Health Daily note · ${optimismDate ? compactHealthDate(optimismDate) : "latest entry"} · plus HealthKit guidance`
    : healthCurrent
      ? `Generated from ${healthSnapshot.dataDate} HealthKit aggregates`
      : "Last validated guidance; sync the iPhone before relying on it";

  if (page === "optimism") {
    return <article className={`panel health-optimism-panel viewport ${optimismText ? "has-entry" : ""}`} aria-label="Daily Optimism">
      <div className="panel-title"><div><h3>Daily Optimism</h3><p>{optimismSubtitle}</p></div><Sparkles size={18}/></div>
      {optimismText ? <p className="health-optimism-text">{optimismText}</p> : <div className="health-guidance-empty"><b>No optimism entry available</b><span>Open Insights for HealthKit-derived comparisons and note shortcut stats.</span></div>}
      {!optimismText ? <p className="health-optimism-footnote">
        {optimismLive === false
          ? ` Health Daily note ${healthNoteSource.status === "permission_required" ? "needs permission" : "unavailable"} — guidance is generated from validated HealthKit aggregates only.`
          : noteLagging
            ? ` Health Daily last observed ${compactHealthDate(optimismDate)}; operational target is ${compactHealthDate(operationalDate)}. No Daily Optimism section was present.`
            : " Health Daily is readable but has no Daily Optimism section."}
      </p> : null}
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
  page: Exclude<HealthSectionPage, "summary" | "coverage" | "archive" | "optimism" | "insights" | "guidance" | "guardrails">;
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
  healthError,
  healthRequiredDate,
  healthMissingDates,
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
  const shellRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<{ section: HealthWorkspaceSection | null; page: HealthSectionPage | null }>({ section: null, page: null });
  const healthStatusLabel = healthSnapshot.status === "live" ? "SYNCED"
    : healthSnapshot.status === "cached" ? "CACHED"
      : healthSnapshot.status === "partial" ? "PARTIAL"
        : healthSnapshot.status === "stale" ? "STALE"
          : "UNAVAILABLE";
  const healthStatusTone = healthSnapshot.status === "live" ? "green"
    : healthSnapshot.status === "stale" || healthSnapshot.status === "unavailable" ? "red"
      : "amber";
  const targetPolicyLabel = healthSnapshot.targetLabel
    ?? (healthSnapshot.targetPolicy === "D_EVENING" ? "D · evening cutoff"
      : healthSnapshot.targetPolicy === "D_OVERNIGHT" ? "D · overnight window"
        : "D-1");
  const rejectedArchiveName = healthSnapshot.rejectedArchive?.split("/").pop() ?? "";
  const guidanceItems = enrichHealthGuidanceActions(healthSnapshot, healthNote, healthNoteSource);
  const optimismText = healthNote?.dailyOptimism?.trim() || "";
  const metricCount = healthSnapshot.categories.reduce((total, category) => total + category.metrics.length, 0);
  const baselineCount = healthSnapshot.categories.flatMap((category) => category.metrics).filter((metric) => metric.averages?.weekly || metric.averages?.monthly).length;

  useEffect(() => {
    const sync = () => setRoute(healthRouteFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    document.documentElement.classList.add("health-console-active", "viewport-console-active");
    return () => {
      window.removeEventListener("popstate", sync);
      document.documentElement.classList.remove("health-console-active", "viewport-console-active");
    };
  }, []);

  useLayoutEffect(() => {
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
      url.searchParams.delete("section");
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("section", section);
      url.searchParams.set("page", page ?? SECTION_PAGES[section][0]!.id);
    }
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(healthRouteFromUrl());
  }, []);

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

  return <div className="sector-workspace-shell health-workspace-shell" ref={shellRef} tabIndex={-1} onKeyDown={onKeyDown}>
    {!route.section ? <>
      <div className="workspace-section">
        <CollapsibleSection number="H-1" title="Health action board" note="Clickable daily source, trend and optimisation actions">
          <HealthIncognitoGate active={healthIncognito} onShow={showHealth}>
            <DailyKanbanBoard workspace="health"/>
          </HealthIncognitoGate>
        </CollapsibleSection>
      </div>
      <div className="sector-overview-grid sector-overview-trio health-overview-console" aria-label="Health & Wellness sections">
      <HealthThumbnail section="h2" onOpen={(section, page) => navigate(section, page)} incognito={healthIncognito}>
        <div className={`health-thumbnail-status ${healthStatusTone}`}><HeartPulse size={25}/><div><b>{healthStatusLabel}</b><span>{targetPolicyLabel} · complete through {compactHealthDate(healthSnapshot.dataDate)}</span></div></div>
        <div className="health-status-preview">
          <button type="button" onClick={() => navigate("h2", "summary")}><small>Operational target</small><b>{compactHealthDate(healthSnapshot.requiredThrough ?? healthRequiredDate)}</b><span className={healthCurrent ? "good" : "bad"}>{healthCurrent ? "Target met" : `${healthMissingDates.length || 1} date gap`}</span></button>
          <button type="button" onClick={() => navigate("h2", "coverage")}><small>Category coverage</small><b>{healthSnapshot.categories.length}/6</b><span>{metricCount} validated KPIs</span></button>
          <button type="button" onClick={() => navigate("h2", "archive")}><small>Archive integrity</small><b>{rejectedArchiveName ? "Fallback" : "Valid"}</b><span className={rejectedArchiveName ? "bad" : "good"}>{rejectedArchiveName ? "Newest rejected" : "Validated source"}</span></button>
        </div>
      </HealthThumbnail>
      <HealthThumbnail section="h3" onOpen={(section, page) => navigate(section, page)} incognito={healthIncognito}>
        <div className="health-thumbnail-guidance"><Sparkles size={23}/><div><small>DAILY CONTEXT</small><p>{optimismText || guidanceItems[0]?.title || "Waiting for validated Health guidance"}</p></div></div>
        <div className="health-guidance-preview">
          {guidanceItems.slice(0, 3).map((item) => <button type="button" onClick={() => navigate("h3", "insights")} key={item.title}><i className={item.tone}/><span><b>{item.title}</b><small>{item.text}</small></span><ChevronRight size={13}/></button>)}
        </div>
        <div className="thumbnail-leader-strip"><span><small>Evidence</small><b>{optimismText ? " Health Daily + HealthKit" : "HealthKit · Livity unavailable"}</b></span><button type="button" onClick={() => navigate("h3", "insights")}>{guidanceItems.length} insights <ChevronRight size={13}/></button></div>
      </HealthThumbnail>
      <HealthThumbnail section="h4" onOpen={(section, page) => navigate(section, page)} incognito={healthIncognito}>
        <div className="thumbnail-summary-line"><b>Current values vs 7-day average</b><span>{baselineCount}/{metricCount} comparison-ready</span></div>
        <div className="health-thumbnail-categories">
          {healthSnapshot.categories.map((category) => {
            const metric = primaryHealthMetric(category);
            return <button type="button" className={category.tone} onClick={() => navigate("h4", HEALTH_CATEGORY_PAGE[category.name] ?? "metrics-overview")} key={category.name}>
              <span><HealthCategoryIcon name={category.name}/><b>{category.name}</b></span>
              <strong>{metric?.value ?? "No data"}</strong>
              {metric ? <HealthTrend metric={metric} compact/> : null}
            </button>;
          })}
        </div>
        <div className="thumbnail-leader-strip"><span><small>Coverage</small><b>{healthSnapshot.categories.length} categories · {metricCount} KPIs</b></span><button type="button" onClick={() => navigate("h4", "metrics-overview")}>Compare all <ChevronRight size={13}/></button></div>
      </HealthThumbnail>
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
          {route.section === "h2" && <HealthStatusWorkbench page={route.page as "summary" | "coverage" | "archive"} healthSnapshot={healthSnapshot} healthCurrent={healthCurrent} healthError={healthError} healthRequiredDate={healthRequiredDate} healthMissingDates={healthMissingDates} healthStatusLabel={healthStatusLabel} healthStatusTone={healthStatusTone} targetPolicyLabel={targetPolicyLabel} rejectedArchiveName={rejectedArchiveName}/>}
          {route.section === "h3" && <HealthGuidanceWorkbench page={route.page as "optimism" | "insights" | "guidance" | "guardrails"} healthSnapshot={healthSnapshot} healthCurrent={healthCurrent} healthNote={healthNote} healthNoteSource={healthNoteSource}/>}
          {route.section === "h4" && <HealthMetricsWorkbench page={route.page as "metrics-overview" | "activity" | "sleep" | "heart" | "respiratory" | "mobility" | "nutrition-1" | "nutrition-2"} categories={healthSnapshot.categories} onOpenPage={(page) => navigate("h4", page)}/>}
        </HealthIncognitoGate>
      </div>
    </section>}
  </div>;
}
