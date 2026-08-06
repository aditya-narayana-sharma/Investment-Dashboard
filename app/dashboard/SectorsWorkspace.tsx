"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { SectorBenchmarkSnapshot, SectorMarketSnapshot } from "../sector-live-types";
import { aggregateSectorMarketStatus, isUsableSectorMarketStatus } from "../sector-live-types";
import type { SectorNewsSnapshot } from "../sector-news-types";
import type { LiveHolding } from "../live-types";
import { SectorDecisionLab, type SectorDecisionPage } from "./SectorDecisionLab";
import { CollapsibleSection, DailyKanbanBoard, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";

const SectoralAnalytics = lazy(() => import("./SectoralAnalytics"));
type SectorAnalyticsPage = import("./SectoralAnalytics").SectorAnalyticsPage;

export type SectorWorkspaceSection = "s2" | "s3";
export type SectorTopSection = "s1" | SectorWorkspaceSection;
export type SectorSectionPage =
  | SectorAnalyticsPage
  | SectorDecisionPage;

const SECTOR_TOP_SECTIONS = [
  { id: "s1", label: "Action Board" },
  { id: "s2", label: "Industry Analytics" },
  { id: "s3", label: "Benchmarks & Decision Lab" },
] as const;

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
};

const SECTION_META = {
  s2: { number: "S-2", title: "Industry Analytics", note: "Pulse, companies, rankings and structure" },
  s3: { number: "S-3", title: "Benchmarks & Decision Lab", note: "Reference indices, radars and decision gates" },
} as const;

const DEFAULT_SECTION_PAGES: Record<SectorWorkspaceSection, SectorSectionPage> = {
  s2: "pulse",
  s3: "benchmarks",
};

function sectionFromUrl() {
  if (typeof window === "undefined") {
    return {
      topSection: "s1" as SectorTopSection,
      section: null as SectorWorkspaceSection | null,
      page: null as SectorSectionPage | null,
    };
  }
  const search = new URLSearchParams(window.location.search);
  const rawSection = search.get("section");
  const topSection = SECTOR_TOP_SECTIONS.some((item) => item.id === rawSection)
    ? rawSection as SectorTopSection
    : "s1";
  const section = rawSection && rawSection in SECTION_PAGES ? rawSection as SectorWorkspaceSection : null;
  const rawPage = search.get("page");
  const page = section && SECTION_PAGES[section].some((item) => item.id === rawPage)
    ? rawPage as SectorSectionPage
    : section ? SECTION_PAGES[section][0]!.id : null;
  return { topSection, section, page };
}

function SectionPageNav({
  section,
  activePage,
  onSelect,
}: {
  section: SectorWorkspaceSection;
  activePage: SectorSectionPage;
  onSelect: (section: SectorWorkspaceSection, page: SectorSectionPage) => void;
}) {
  const pages = SECTION_PAGES[section];
  const activeIndex = Math.max(0, pages.findIndex((item) => item.id === activePage));
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectByIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(pages.length - 1, index));
    onSelect(section, pages[nextIndex]!.id);
    tabsRef.current[nextIndex]?.focus();
  };
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); selectByIndex(index - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); selectByIndex(index + 1); }
    if (event.key === "Home") { event.preventDefault(); selectByIndex(0); }
    if (event.key === "End") { event.preventDefault(); selectByIndex(pages.length - 1); }
  };

  return <nav className="sector-page-nav sector-inline-page-nav" aria-label={`${SECTION_META[section].title} views`}>
    <button type="button" disabled={activeIndex <= 0} onClick={() => selectByIndex(activeIndex - 1)} aria-label={`Previous ${SECTION_META[section].title} view`}><ChevronLeft size={17}/></button>
    <div role="tablist" aria-label={`${SECTION_META[section].title} view selector`}>
      {pages.map((item, index) => <button
        ref={(node) => { tabsRef.current[index] = node; }}
        id={`sector-${section}-tab-${item.id}`}
        type="button"
        role="tab"
        aria-selected={activePage === item.id}
        aria-controls={`sector-${section}-panel`}
        tabIndex={activePage === item.id ? 0 : -1}
        className={activePage === item.id ? "active" : ""}
        onClick={() => onSelect(section, item.id)}
        onKeyDown={(event) => onTabKeyDown(event, index)}
        key={item.id}
      ><i/><span>{item.label}</span></button>)}
    </div>
    <button type="button" disabled={activeIndex >= pages.length - 1} onClick={() => selectByIndex(activeIndex + 1)} aria-label={`Next ${SECTION_META[section].title} view`}><ChevronRight size={17}/></button>
  </nav>;
}

function SectorWorkspaceShell({
  benchmarks,
  selectedSectorIds,
  onToggleSector,
  sectorMarket,
  sectorMarketById,
  sectorNews,
  sectorMarketsLoading,
  holdings,
}: {
  benchmarks: SectorBenchmarkSnapshot;
  selectedSectorIds: string[];
  onToggleSector: (sectorId: string) => void;
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  sectorNews: SectorNewsSnapshot;
  sectorMarketsLoading: boolean;
  holdings: LiveHolding[];
}) {
  const [activePages, setActivePages] = useState<Record<SectorWorkspaceSection, SectorSectionPage>>(DEFAULT_SECTION_PAGES);
  const [activeSection, setActiveSection] = useState<SectorTopSection>("s1");
  const primarySectorId = selectedSectorIds[selectedSectorIds.length - 1];
  const marketSnapshots = Object.values(sectorMarketById);
  const aggregatedMarketStatus = aggregateSectorMarketStatus(marketSnapshots);
  // Prefer live breadth across industries. Empty byId must not render as
  // "unavailable" while yfinance sector fetches are still in flight.
  const resolvedMarketStatus = primarySectorId
    ? (sectorMarketById[primarySectorId]?.status
      ?? (isUsableSectorMarketStatus(sectorMarket.status) ? sectorMarket.status : null)
      ?? (sectorMarketsLoading || !marketSnapshots.length ? null : sectorMarket.status))
    : marketSnapshots.length
      ? aggregatedMarketStatus
      : null;
  const s2Status = resolvedMarketStatus
    ?? (sectorMarketsLoading || !marketSnapshots.length ? "loading" : "unavailable");
  const s2StatusPill = s2Status === "live"
    ? "green"
    : s2Status === "cached" || s2Status === "public_delayed" || s2Status === "loading"
      ? "amber"
      : "red";

  useEffect(() => {
    const sync = () => {
      const route = sectionFromUrl();
      setActiveSection(route.topSection);
      if (route.section && route.page) {
        setActivePages((current) => ({ ...current, [route.section!]: route.page! }));
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const selectPage = useCallback((section: SectorWorkspaceSection, page: SectorSectionPage) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.set("page", page);
    window.history.pushState({}, "", url);
    setActiveSection(section);
    setActivePages((current) => ({ ...current, [section]: page }));
  }, []);

  const selectTopSection = useCallback((sectionId: string) => {
    const section = sectionId as SectorTopSection;
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    if (section === "s1") {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", activePages[section]);
    }
    window.history.pushState({}, "", url);
    setActiveSection(section);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
    document.getElementById(`sector-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activePages]);

  return <div className="sector-workspace-shell sector-full-workspace">
    <WorkspaceSectionNav
      label="Sectoral Analytics sections"
      sections={SECTOR_TOP_SECTIONS}
      activeId={activeSection}
      onSelect={selectTopSection}
    />
    <div id="sector-s1" className="workspace-section action-board-workspace-section">
      <CollapsibleSection number="S-1" title="Sectoral action board" note="Clickable daily sector research priorities and monitoring actions">
        <DailyKanbanBoard workspace="sectors"/>
      </CollapsibleSection>
    </div>

    <div id="sector-s2" className="workspace-section sector-full-section">
      <CollapsibleSection number={SECTION_META.s2.number} title={SECTION_META.s2.title} note={SECTION_META.s2.note} headerAction={<span className={`pill ${s2StatusPill}`}>{s2Status}</span>}>
        <SectionPageNav section="s2" activePage={activePages.s2} onSelect={selectPage}/>
        <div id="sector-s2-panel" className="sector-full-section-body s2" role="tabpanel" aria-labelledby={`sector-s2-tab-${activePages.s2}`}>
          <Suspense fallback={<div className="live-empty compact"><b>Loading industry analytics…</b></div>}>
            <SectoralAnalytics selectedIds={selectedSectorIds} onToggle={onToggleSector} market={sectorMarket} marketsBySector={sectorMarketById} news={sectorNews} holdings={holdings} page={activePages.s2 as SectorAnalyticsPage}/>
          </Suspense>
        </div>
      </CollapsibleSection>
    </div>

    <div id="sector-s3" className="workspace-section sector-full-section">
      <CollapsibleSection number={SECTION_META.s3.number} title={SECTION_META.s3.title} note={SECTION_META.s3.note} headerAction={<span className={`pill ${benchmarks.status === "live" ? "green" : "amber"}`}>{benchmarks.status}</span>}>
        <SectionPageNav section="s3" activePage={activePages.s3} onSelect={selectPage}/>
        <div id="sector-s3-panel" className="sector-full-section-body s3" role="tabpanel" aria-labelledby={`sector-s3-tab-${activePages.s3}`}>
          <SectorDecisionLab page={activePages.s3 as SectorDecisionPage} benchmarks={benchmarks} marketsBySector={sectorMarketById}/>
        </div>
      </CollapsibleSection>
    </div>
  </div>;
}

export function SectorsWorkspace({
  selectedSectorIds,
  onToggleSector,
  sectorMarket,
  sectorMarketById,
  sectorNews,
  sectorMarketsLoading = false,
  holdings,
  benchmarks,
}: {
  selectedSectorIds: string[];
  onToggleSector: (sectorId: string) => void;
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  sectorNews: SectorNewsSnapshot;
  sectorMarketsLoading?: boolean;
  holdings: LiveHolding[];
  benchmarks: SectorBenchmarkSnapshot;
}) {
  return <SectorWorkspaceShell
    selectedSectorIds={selectedSectorIds}
    onToggleSector={onToggleSector}
    sectorMarket={sectorMarket}
    sectorMarketById={sectorMarketById}
    sectorNews={sectorNews}
    sectorMarketsLoading={sectorMarketsLoading}
    holdings={holdings}
    benchmarks={benchmarks}
  />;
}
