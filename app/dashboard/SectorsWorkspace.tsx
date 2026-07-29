"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers3,
  ShieldAlert,
} from "lucide-react";
import { sectors } from "../sector-data";
import type { ContentDigestSnapshot } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import { earningsEventDateKey } from "../earnings-verify";
import type { SectorBenchmarkSnapshot, SectorMarketSnapshot } from "../sector-live-types";
import type { LiveHolding } from "../live-types";
import type { EarningsEvent } from "../portfolio-data";
import { EarningsMonthCalendar, earningsEventKey, resolveAnalysisDateKey } from "./EarningsMonthCalendar";
import { SectorDecisionLab, type SectorDecisionPage } from "./SectorDecisionLab";
import { CollapsibleSection, DailyKanbanBoard } from "./shared-ui";
import { mergeEarningsCalendarEvents } from "./utils";

const SectoralAnalytics = lazy(() => import("./SectoralAnalytics"));
type SectorAnalyticsPage = import("./SectoralAnalytics").SectorAnalyticsPage;

export type SectorWorkspaceSection = "s2" | "s3" | "s4";
export type SectorSectionPage =
  | SectorAnalyticsPage
  | SectorDecisionPage
  | "calendar" | "day" | "catalysts" | "summary";

const SECTION_PAGES: Record<SectorWorkspaceSection, Array<{ id: SectorSectionPage; label: string }>> = {
  s2: [
    { id: "pulse", label: "Sector pulse" },
    { id: "companies", label: "Companies" },
    { id: "rankings", label: "Rankings" },
    { id: "lifecycle", label: "Life cycle" },
    { id: "structure", label: "Market structure" },
    { id: "mece", label: "MECE map" },
  ],
  s3: [
    { id: "benchmarks", label: "Benchmarks" },
    { id: "investability", label: "Investability" },
    { id: "pestel", label: "PESTEL" },
    { id: "porter", label: "Porter" },
    { id: "macro", label: "Macro triggers" },
  ],
  s4: [
    { id: "calendar", label: "Month calendar" },
    { id: "day", label: "Day KPIs" },
    { id: "catalysts", label: "Holding catalysts" },
    { id: "summary", label: "Status summary" },
  ],
};

const SECTION_META = {
  s2: { number: "S-2", title: "Industry Analytics", note: "Pulse, companies, rankings and structure", icon: Layers3 },
  s3: { number: "S-3", title: "Benchmarks & Decision Lab", note: "Reference indices, radars and decision gates", icon: BarChart3 },
  s4: { number: "S-4", title: "Earnings Calendar", note: "Month-scoped catalysts and reported KPIs", icon: CalendarDays },
} as const;

function sectionFromUrl() {
  if (typeof window === "undefined") return { section: null as SectorWorkspaceSection | null, page: null as SectorSectionPage | null };
  const search = new URLSearchParams(window.location.search);
  const rawSection = search.get("section");
  const section = rawSection && rawSection in SECTION_PAGES ? rawSection as SectorWorkspaceSection : null;
  const rawPage = search.get("page");
  const page = section && SECTION_PAGES[section].some((item) => item.id === rawPage)
    ? rawPage as SectorSectionPage
    : section ? SECTION_PAGES[section][0]!.id : null;
  return { section, page };
}

function eventMonth(event: EarningsEvent, analysisDate: string) {
  return earningsEventDateKey(event, analysisDate)?.slice(0, 7) ?? "";
}

function formatMonth(monthKey: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
    .format(new Date(`${monthKey}-15T12:00:00+05:30`));
}

function EarningsCalendarWorkbench({
  snapshot,
  content,
  holdings,
  page,
}: {
  snapshot: EarningsSnapshot;
  content: ContentDigestSnapshot;
  holdings: LiveHolding[];
  page: "calendar" | "day" | "catalysts" | "summary";
}) {
  const events = useMemo(() => mergeEarningsCalendarEvents(snapshot, content, holdings), [snapshot, content, holdings]);
  const analysisKey = resolveAnalysisDateKey(snapshot.analysisDate);
  const monthKeys = useMemo(() => [...new Set(events.map((event) => eventMonth(event, analysisKey)).filter(Boolean))].sort(), [analysisKey, events]);
  const preferredMonth = monthKeys.includes(analysisKey.slice(0, 7)) ? analysisKey.slice(0, 7) : monthKeys[0] ?? analysisKey.slice(0, 7);
  const [activeMonth, setActiveMonth] = useState(preferredMonth);
  const initialMonthEvents = events.filter((event) => eventMonth(event, analysisKey) === preferredMonth);
  const initialDay = initialMonthEvents[0] ? earningsEventDateKey(initialMonthEvents[0], analysisKey) ?? `${preferredMonth}-01` : `${preferredMonth}-01`;
  const [activeDay, setActiveDay] = useState(initialDay);
  const [selectedKey, setSelectedKey] = useState(initialMonthEvents[0] ? earningsEventKey(initialMonthEvents[0]) : "");
  const monthEvents = useMemo(() => events.filter((event) => eventMonth(event, analysisKey) === activeMonth), [activeMonth, analysisKey, events]);
  const selected = monthEvents.find((event) => earningsEventKey(event) === selectedKey) ?? monthEvents[0];
  const reportedCount = monthEvents.filter((event) => event.reported).length;
  const holdingEvents = events.filter((event) => event.portfolio);

  const handleMonthChange = useCallback((nextMonth: string, nextEvents: EarningsEvent[]) => {
    setActiveMonth((current) => current === nextMonth ? current : nextMonth);
    const first = nextEvents[0];
    setSelectedKey(first ? earningsEventKey(first) : "");
    setActiveDay(first ? earningsEventDateKey(first, analysisKey) ?? `${nextMonth}-01` : `${nextMonth}-01`);
  }, [analysisKey, setActiveDay, setActiveMonth, setSelectedKey]);

  const handleDayChange = useCallback((nextDay: string, nextEvents: EarningsEvent[]) => {
    setActiveDay(nextDay);
    if (nextEvents[0]) setSelectedKey(earningsEventKey(nextEvents[0]));
  }, [setActiveDay, setSelectedKey]);

  const detail = selected && eventMonth(selected, analysisKey) === activeMonth ? <section className={`earnings-detail compact ${selected.reported ? "reported" : "pending"}`} role="tabpanel">
    <div className="earnings-detail-heading">
      <div><span>{selected.period} · {selected.date}</span><h4>{selected.name}{selected.portfolio ? " ★" : ""}</h4><p>NSE · {selected.symbol}{selected.portfolio ? " · Current Kite holding" : ""}</p></div>
      <span className={`pill ${selected.reported ? "green" : "amber"}`}>{selected.state}</span>
    </div>
    <div className="earnings-kpi-grid">{selected.kpis.map((kpi) => <div className={kpi.value ? "filled" : "empty"} key={`${selected.symbol}-${kpi.label}`}><span>{kpi.label}</span>{kpi.value ? <><b>{kpi.value}</b><small className={kpi.tone ?? ""}>{kpi.change}</small></> : <><b className="blank-value" aria-label="Pending result value"/><small>Pending publication</small></>}</div>)}</div>
    <div className={selected.reported ? "earnings-result-note" : "earnings-pending-note"}><CheckCircle2 size={16}/><p>{selected.summary ?? "KPI fields remain blank until a verified result is published."}</p></div>
  </section> : null;

  if (page === "catalysts") {
    return <section className="holding-catalyst-page">
      <div className="analytics-subhead"><div><b>Verified holding catalysts</b><span>Stars are matched dynamically against the latest Kite holding symbols.</span></div><em>{holdingEvents.length} matched</em></div>
      <div className="holding-catalyst-grid">{holdingEvents.length ? holdingEvents.map((event) => <button type="button" onClick={() => { setActiveMonth(eventMonth(event, analysisKey)); setActiveDay(earningsEventDateKey(event, analysisKey) ?? activeDay); setSelectedKey(earningsEventKey(event)); }} key={earningsEventKey(event)}>
        <span>{event.date}</span><b>{event.name} ★</b><small>{event.reported ? "Reported" : event.state} · {event.period}</small>
      </button>) : <div className="earnings-day-empty">No current holding has a verified earnings date in the refreshed calendar.</div>}</div>
      {detail}
    </section>;
  }

  if (page === "summary") {
    const allReported = events.filter((event) => event.reported).length;
    return <section className="earnings-status-page">
      <div className="earnings-status-cards">
        <article><span>Visible month</span><b>{formatMonth(activeMonth)}</b><small>{monthEvents.length} events</small></article>
        <article><span>Reported</span><b>{reportedCount}</b><small>{monthEvents.length ? (reportedCount / monthEvents.length * 100).toFixed(0) : 0}% of visible month</small></article>
        <article><span>Pending</span><b>{Math.max(monthEvents.length - reportedCount, 0)}</b><small>KPI fields stay blank</small></article>
        <article><span>Full calendar</span><b>{allReported}/{events.length}</b><small>reported / tracked</small></article>
      </div>
      <div className="earnings-progress"><span><b>{reportedCount}</b> reported</span><i><span style={{ width: `${monthEvents.length ? reportedCount / monthEvents.length * 100 : 0}%` }}/></i><span><b>{Math.max(monthEvents.length - reportedCount, 0)}</b> pending</span></div>
      <div className="earnings-summary-list">{monthEvents.map((event) => <div key={earningsEventKey(event)}><span className={event.reported ? "reported" : "pending"}/><b>{event.name}{event.portfolio ? " ★" : ""}</b><small>{event.date} · {event.reported ? "Reported" : event.state}</small></div>)}</div>
    </section>;
  }

  return <article className="earnings-workbench viewport-earnings">
    <div className="panel-title"><div><h3>{page === "calendar" ? "Month calendar" : "Selected-day KPIs"}</h3><p>{formatMonth(activeMonth)} · {monthEvents.length} month-scoped events · ★ denotes a live Kite holding</p></div><span className={`pill ${snapshot.status === "verified" ? "green" : "amber"}`}>{snapshot.status} · {snapshot.asOf}</span></div>
    {events.length ? <EarningsMonthCalendar
      events={events}
      analysisDate={snapshot.analysisDate}
      title="F · Earnings calendar"
      activeMonth={activeMonth}
      selectedDay={activeDay}
      onActiveMonthChange={handleMonthChange}
      onActiveDayChange={handleDayChange}
      selectedEventKey={selected ? earningsEventKey(selected) : undefined}
      onSelectEvent={(event) => setSelectedKey(earningsEventKey(event))}
      showCalendarGrid={page === "calendar"}
      showDayTable={page === "day"}
    /> : <div className="earnings-day-empty">No earnings events are available.</div>}
    {page === "day" && detail}
  </article>;
}

function SectorThumbnail({
  section,
  onOpen,
  children,
}: {
  section: SectorWorkspaceSection;
  onOpen: (section: SectorWorkspaceSection, page?: SectorSectionPage) => void;
  children: React.ReactNode;
}) {
  const meta = SECTION_META[section];
  const Icon = meta.icon;
  return <article className={`sector-thumbnail ${section}`}>
    <header>
      <span><Icon size={18}/><b>{meta.number}</b></span>
      <div><h2>{meta.title}</h2><p>{meta.note}</p></div>
      <button type="button" className="sector-thumbnail-launch" onClick={() => onOpen(section)} aria-label={`Open ${meta.title}`}><ChevronRight size={19}/></button>
    </header>
    <div className="sector-thumbnail-body">{children}</div>
    <footer><button type="button" onClick={() => onOpen(section)}>Explore {SECTION_PAGES[section].length} views <ChevronRight size={14}/></button><i/></footer>
  </article>;
}

function SectorWorkspaceShell({
  benchmarks,
  earningsSnapshot,
  earningsError,
  content,
  selectedSectorIds,
  onToggleSector,
  sectorMarket,
  sectorMarketById,
  holdings,
}: {
  benchmarks: SectorBenchmarkSnapshot;
  earningsSnapshot: EarningsSnapshot;
  earningsError: string;
  content: ContentDigestSnapshot;
  selectedSectorIds: string[];
  onToggleSector: (sectorId: string) => void;
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  holdings: LiveHolding[];
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<{ section: SectorWorkspaceSection | null; page: SectorSectionPage | null }>({ section: null, page: null });

  useEffect(() => {
    const sync = () => setRoute(sectionFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    document.documentElement.classList.add("sector-console-active", "viewport-console-active");
    return () => {
      window.removeEventListener("popstate", sync);
      document.documentElement.classList.remove("sector-console-active", "viewport-console-active");
    };
  }, []);

  useLayoutEffect(() => {
    const fit = () => {
      if (!shellRef.current) return;
      const top = shellRef.current.getBoundingClientRect().top;
      const minimumHeight = window.innerHeight <= 700
        ? 180
        : window.innerWidth <= 760 ? 360 : 420;
      const viewportReserve = window.innerHeight <= 700 ? 20 : 8;
      shellRef.current.style.height = `${Math.max(minimumHeight, window.innerHeight - top - viewportReserve)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    const layoutObserver = new ResizeObserver(fit);
    document.querySelectorAll(".masthead, .live-feed-banner, .source-freshness-strip, .workspace-navigation")
      .forEach((element) => layoutObserver.observe(element));
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

  const navigate = useCallback((section: SectorWorkspaceSection | null, page?: SectorSectionPage, replace = false) => {
    const url = new URL(window.location.href);
    if (!section) {
      url.searchParams.delete("section");
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("section", section);
      url.searchParams.set("page", page ?? SECTION_PAGES[section][0]!.id);
    }
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(sectionFromUrl());
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

  const benchmarkRanking = benchmarks.indices.filter((item) => item.returns.month !== null).sort((a, b) => (b.returns.month ?? 0) - (a.returns.month ?? 0));
  const currentBenchmark = benchmarkRanking[0];
  const marketCompanies = Object.values(sectorMarketById).flatMap((snapshot) => snapshot.companies);
  const advancers = marketCompanies.filter((company) => (company.returns.month ?? 0) > 0).length;
  const decliners = marketCompanies.filter((company) => (company.returns.month ?? 0) < 0).length;
  const sectorPulse = sectors.map((sector) => {
    const companies = sectorMarketById[sector.id]?.companies ?? [];
    const returns = companies.map((company) => company.returns.month).filter((value): value is number => value !== null);
    const averageReturn = returns.length ? returns.reduce((total, value) => total + value, 0) / returns.length : null;
    return {
      ...sector,
      averageReturn,
      advancing: returns.filter((value) => value > 0).length,
      tracked: returns.length,
    };
  });
  const rankedSectorPulse = [...sectorPulse].filter((sector) => sector.averageReturn !== null)
    .sort((a, b) => (b.averageReturn ?? 0) - (a.averageReturn ?? 0));
  const mergedEvents = mergeEarningsCalendarEvents(earningsSnapshot, content, holdings);
  const analysisKey = resolveAnalysisDateKey(earningsSnapshot.analysisDate);
  const activeMonth = analysisKey.slice(0, 7);
  const monthEvents = mergedEvents.filter((event) => eventMonth(event, analysisKey) === activeMonth);
  const monthReported = monthEvents.filter((event) => event.reported).length;
  const upcomingMonthEvents = [...monthEvents].sort((a, b) => (earningsEventDateKey(a, analysisKey) ?? "").localeCompare(earningsEventDateKey(b, analysisKey) ?? ""));
  const nextHolding = mergedEvents
    .filter((event) => event.portfolio && !event.reported)
    .sort((a, b) => (earningsEventDateKey(a, analysisKey) ?? "").localeCompare(earningsEventDateKey(b, analysisKey) ?? ""))[0];
  const maxBenchmarkMove = Math.max(...benchmarkRanking.slice(0, 5).map((item) => Math.abs(item.returns.month ?? 0)), 1);

  return <div className="sector-workspace-shell" ref={shellRef} tabIndex={-1} onKeyDown={onKeyDown}>
    {!route.section ? <>
      <div className="workspace-section">
        <CollapsibleSection number="S-1" title="Sectoral action board" note="Clickable daily sector research priorities and monitoring actions">
          <DailyKanbanBoard workspace="sectors"/>
        </CollapsibleSection>
      </div>
      <div className="sector-overview-grid sector-overview-trio" aria-label="Sectoral Analytics sections">
      <SectorThumbnail section="s2" onOpen={(section, page) => navigate(section, page)}>
        <div className="thumbnail-summary-line"><b>Industry breadth · 1 month</b><span>{advancers} advancing · {decliners} declining</span></div>
        <div className="thumbnail-sector-pulse" aria-label="Interactive industry filters">
          {sectorPulse.slice(0, 8).map((sector) => {
            const active = !selectedSectorIds.length || selectedSectorIds.includes(sector.id);
            return <button
              type="button"
              aria-pressed={selectedSectorIds.includes(sector.id)}
              className={active ? "active" : "dimmed"}
              onClick={() => onToggleSector(sector.id)}
              style={{ "--sector": sector.color } as React.CSSProperties}
              key={sector.id}
            >
              <i/><span>{sector.name}</span><b className={(sector.averageReturn ?? 0) >= 0 ? "positive" : "negative"}>{sector.averageReturn === null ? "—" : `${sector.averageReturn >= 0 ? "+" : ""}${sector.averageReturn.toFixed(1)}%`}</b>
              <small>{sector.advancing}/{sector.tracked || 0} advancing</small>
            </button>;
          })}
        </div>
        <div className="thumbnail-leader-strip"><span><small>Leader</small><b>{rankedSectorPulse[0]?.name ?? "Awaiting prices"}</b></span><span><small>Laggard</small><b>{rankedSectorPulse.at(-1)?.name ?? "Awaiting prices"}</b></span><button type="button" onClick={() => navigate("s2", "rankings")}>{selectedSectorIds.length ? `${selectedSectorIds.length} selected` : "All industries"} <ChevronRight size={13}/></button></div>
      </SectorThumbnail>
      <SectorThumbnail section="s3" onOpen={(section, page) => navigate(section, page)}>
        <div className="thumbnail-summary-line"><b>Benchmark decision tape</b><span>{benchmarks.indices.length} configured · {benchmarks.status}</span></div>
        <div className="thumbnail-benchmark-bars">
          {benchmarkRanking.slice(0, 4).map((benchmark) => {
            const value = benchmark.returns.month ?? 0;
            return <button type="button" onClick={() => navigate("s3", "benchmarks")} key={benchmark.id}>
              <span>{benchmark.officialName}</span><i><b className={value >= 0 ? "positive" : "negative"} style={{ width: `${Math.max(10, Math.abs(value) / maxBenchmarkMove * 100)}%` }}/></i><strong className={value >= 0 ? "positive" : "negative"}>{value >= 0 ? "+" : ""}{value.toFixed(1)}%</strong>
            </button>;
          })}
          {!benchmarkRanking.length && <div className="thumbnail-decision-grid" aria-label="Decision tools available while benchmark history refreshes">
            <button type="button" onClick={() => navigate("s3", "investability")}><span className="blue">ALLOCATE</span><b>Investability</b><small>6 evidence lenses</small></button>
            <button type="button" onClick={() => navigate("s3", "porter")}><span className="purple">COMPETE</span><b>Porter pressure</b><small>5 industry forces</small></button>
            <button type="button" onClick={() => navigate("s3", "macro")}><span className="amber">MONITOR</span><b>Macro triggers</b><small>5 decision gates</small></button>
          </div>}
        </div>
        <div className="thumbnail-leader-strip"><span><small>Strongest 1M</small><b>{currentBenchmark?.officialName ?? "Waiting"}</b></span><span><small>Decision tools</small><b>3 radars · 5 triggers</b></span><button type="button" onClick={() => navigate("s3", "investability")}>Open radars <ChevronRight size={13}/></button></div>
      </SectorThumbnail>
      <SectorThumbnail section="s4" onOpen={(section, page) => navigate(section, page)}>
        <div className="thumbnail-summary-line"><b>{formatMonth(activeMonth)} earnings</b><span>{monthReported}/{monthEvents.length} reported · ★ Kite holding</span></div>
        <div className="thumbnail-earnings-progress"><i><b style={{ width: `${monthEvents.length ? monthReported / monthEvents.length * 100 : 0}%` }}/></i><span className="green">{monthReported} reported</span><span className="amber">{Math.max(monthEvents.length - monthReported, 0)} pending</span></div>
        <div className="thumbnail-event-list">
          {upcomingMonthEvents.slice(0, 4).map((event) => <button type="button" onClick={() => navigate("s4", event.reported ? "day" : "calendar")} key={earningsEventKey(event)}>
            <time>{earningsEventDateKey(event, analysisKey)?.slice(-2) ?? event.date}</time><span><b>{event.name}{event.portfolio ? " ★" : ""}</b><small>{event.reported ? "Reported" : event.state} · {event.period}</small></span><i className={event.reported ? "green" : "amber"}/>
          </button>)}
          {!upcomingMonthEvents.length && <div className="thumbnail-empty-signal">No verified earnings events in the visible month.</div>}
        </div>
        <div className="thumbnail-leader-strip"><span><small>Next holding catalyst</small><b>{nextHolding?.name ?? "No verified date"}</b></span><button type="button" onClick={() => navigate("s4", "catalysts")}>Holding catalysts <ChevronRight size={13}/></button></div>
      </SectorThumbnail>
    </div>
    </> : <section className={`sector-detail-shell ${route.section}`} aria-label={SECTION_META[route.section].title}>
      <header className="sector-detail-header">
        <button type="button" className="sector-back-button" onClick={() => navigate(null)}><ArrowLeft size={17}/><span>Overview</span></button>
        <div><span>{SECTION_META[route.section].number}</span><h2>{SECTION_META[route.section].title}</h2><p>{SECTION_META[route.section].note}</p></div>
        <em className={`pill ${route.section === "s4" && earningsSnapshot.status !== "verified" ? "amber" : "green"}`}>{route.section === "s4" ? earningsSnapshot.status : route.section === "s3" ? benchmarks.status : sectorMarket.status}</em>
      </header>
      {earningsError && route.section === "s4" && <div className="refresh-error compact"><ShieldAlert size={14}/><span>{earningsError}</span></div>}
      {pages.length > 1 && <nav className="sector-page-nav" aria-label={`${SECTION_META[route.section].title} pages`}>
        <button type="button" disabled={pageIndex <= 0} onClick={() => changePage(pageIndex - 1)} aria-label="Previous page"><ChevronLeft size={17}/></button>
        <div role="tablist">{pages.map((item) => <button type="button" role="tab" aria-selected={route.page === item.id} className={route.page === item.id ? "active" : ""} onClick={() => navigate(route.section!, item.id)} key={item.id}><i/><span>{item.label}</span></button>)}</div>
        <button type="button" disabled={pageIndex >= pages.length - 1} onClick={() => changePage(pageIndex + 1)} aria-label="Next page"><ChevronRight size={17}/></button>
      </nav>}
      <div className="sector-detail-body">
        {route.section === "s2" && <Suspense fallback={<div className="live-empty compact"><b>Loading industry analytics…</b></div>}><SectoralAnalytics selectedIds={selectedSectorIds} onToggle={onToggleSector} market={sectorMarket} marketsBySector={sectorMarketById} holdings={holdings} page={route.page as SectorAnalyticsPage}/></Suspense>}
        {route.section === "s3" && <SectorDecisionLab
          page={route.page as SectorDecisionPage}
          benchmarks={benchmarks}
          marketsBySector={sectorMarketById}
        />}
        {route.section === "s4" && <EarningsCalendarWorkbench snapshot={earningsSnapshot} content={content} holdings={holdings} page={route.page as "calendar" | "day" | "catalysts" | "summary"}/>}
      </div>
    </section>}
  </div>;
}

export function SectorsWorkspace({
  content,
  selectedSectorIds,
  onToggleSector,
  sectorMarket,
  sectorMarketById,
  holdings,
  earningsSnapshot,
  earningsError,
  benchmarks,
}: {
  content: ContentDigestSnapshot;
  selectedSectorIds: string[];
  onToggleSector: (sectorId: string) => void;
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  holdings: LiveHolding[];
  earningsSnapshot: EarningsSnapshot;
  earningsError: string;
  benchmarks: SectorBenchmarkSnapshot;
}) {
  return <SectorWorkspaceShell
    content={content}
    selectedSectorIds={selectedSectorIds}
    onToggleSector={onToggleSector}
    sectorMarket={sectorMarket}
    sectorMarketById={sectorMarketById}
    holdings={holdings}
    earningsSnapshot={earningsSnapshot}
    earningsError={earningsError}
    benchmarks={benchmarks}
  />;
}
