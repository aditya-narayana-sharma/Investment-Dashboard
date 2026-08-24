"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
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
import { LicenseGate } from "./LicenseGate";
import { tierAllows, type PublicLicense } from "../license";
import { useLicenseSnapshot } from "../license-snapshot";
import { CollapsibleSection, DailyKanbanBoard, nativeChromeHidesSection, revealDashboardSection } from "./shared-ui";
import { listenToStratjiLocation, stratjiPushState } from "./stratji-navigate";
import { isLocationView } from "./workspace-routing";
import { buildSectorDailyActions } from "./workspace-daily-actions";

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
  { id: "s3", label: "Decision Framework" },
] as const;

const SECTION_PAGES: Record<SectorWorkspaceSection, Array<{ id: SectorSectionPage; label: string }>> = {
  s2: [
    { id: "pulse", label: "Industry Analytics" },
    { id: "companies", label: "Companies" },
    { id: "rankings", label: "Rankings" },
    { id: "lifecycle", label: "Life cycle" },
    { id: "structure", label: "Market structure" },
    { id: "mece", label: "MECE map" },
  ],
  s3: [
    { id: "benchmarks", label: "Benchmarks & Decision Lab" },
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
      exclusive: true,
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
  return { topSection, section, page, exclusive: true };
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
  s3Locked,
  license,
}: {
  benchmarks: SectorBenchmarkSnapshot;
  selectedSectorIds: string[];
  onToggleSector: (sectorId: string) => void;
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  sectorNews: SectorNewsSnapshot;
  sectorMarketsLoading: boolean;
  holdings: LiveHolding[];
  s3Locked: boolean;
  license: PublicLicense;
}) {
  const [activePages, setActivePages] = useState<Record<SectorWorkspaceSection, SectorSectionPage>>(DEFAULT_SECTION_PAGES);
  const [activeSection, setActiveSection] = useState<SectorTopSection>(() => sectionFromUrl().topSection);
  const [exclusive, setExclusive] = useState(() => sectionFromUrl().exclusive);
  const focusedSection = exclusive ? activeSection : null;
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
      if (!isLocationView("sectors")) return;
      const route = sectionFromUrl();
      setActiveSection(route.topSection);
      setExclusive(route.exclusive);
      if (route.section && route.page) {
        setActivePages((current) => ({ ...current, [route.section!]: route.page! }));
      }
      if (route.exclusive) revealDashboardSection(route.topSection, `sector-${route.topSection}`);
    };
    sync();
    const retry = window.setTimeout(sync, 0);
    const stopListening = listenToStratjiLocation(sync);
    return () => {
      window.clearTimeout(retry);
      stopListening();
    };
  }, []);

  const sectorActions = useMemo(
    () => buildSectorDailyActions({
      sectorMarket,
      sectorMarketById,
      benchmarks,
      loading: sectorMarketsLoading,
    }),
    [benchmarks, sectorMarket, sectorMarketById, sectorMarketsLoading],
  );

  const selectPage = useCallback((section: SectorWorkspaceSection, page: SectorSectionPage) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.set("page", page);
    stratjiPushState(url);
    setActiveSection(section);
    setExclusive(true);
    setActivePages((current) => ({ ...current, [section]: page }));
  }, []);

  return <div className="sector-workspace-shell sector-full-workspace" data-focus-section={focusedSection ?? undefined}>
    <div id="sector-s1" className="workspace-section action-board-workspace-section" hidden={nativeChromeHidesSection(focusedSection, "s1")}>
      <CollapsibleSection number="S-1" title="Sectoral action board" note="Clickable daily sector research priorities and monitoring actions" defaultOpen={focusedSection === "s1"}>
        <DailyKanbanBoard workspace="sectors" items={sectorActions}/>
      </CollapsibleSection>
    </div>

    <div id="sector-s2" className="workspace-section sector-full-section" hidden={nativeChromeHidesSection(focusedSection, "s2")}>
      <CollapsibleSection number={SECTION_META.s2.number} title={SECTION_META.s2.title} note={SECTION_META.s2.note} headerAction={<span className={`pill ${s2StatusPill}`}>{s2Status}</span>} defaultOpen={focusedSection === "s2"}>
        <SectionPageNav section="s2" activePage={activePages.s2} onSelect={selectPage}/>
        <div id="sector-s2-panel" className="sector-full-section-body s2" role="tabpanel" aria-labelledby={`sector-s2-tab-${activePages.s2}`}>
          <Suspense fallback={<div className="live-empty compact"><b>Loading industry analytics…</b></div>}>
            <SectoralAnalytics selectedIds={selectedSectorIds} onToggle={onToggleSector} market={sectorMarket} marketsBySector={sectorMarketById} news={sectorNews} holdings={holdings} page={activePages.s2 as SectorAnalyticsPage} benchmarks={benchmarks}/>
          </Suspense>
        </div>
      </CollapsibleSection>
    </div>

    <div id="sector-s3" className="workspace-section sector-full-section" hidden={nativeChromeHidesSection(focusedSection, "s3")}>
      <CollapsibleSection number={SECTION_META.s3.number} title={SECTION_META.s3.title} note={SECTION_META.s3.note} headerAction={<span className={`pill ${benchmarks.status === "live" ? "green" : "amber"}`}>{benchmarks.status === "live" ? "EOD" : benchmarks.status}</span>} defaultOpen={focusedSection === "s3"}>
        <SectionPageNav section="s3" activePage={activePages.s3} onSelect={selectPage}/>
        <div id="sector-s3-panel" className="sector-full-section-body s3" role="tabpanel" aria-labelledby={`sector-s3-tab-${activePages.s3}`}>
          {s3Locked
            ? <LicenseGate feature="sectorsS3" license={license} title="S-3 Benchmarks & Decision Lab" />
            : <SectorDecisionLab page={activePages.s3 as SectorDecisionPage} benchmarks={benchmarks} marketsBySector={sectorMarketById}/>}
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
  s3Locked,
  license,
}: {
  selectedSectorIds: string[];
  onToggleSector: (sectorId: string) => void;
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  sectorNews: SectorNewsSnapshot;
  sectorMarketsLoading?: boolean;
  holdings: LiveHolding[];
  benchmarks: SectorBenchmarkSnapshot;
  s3Locked?: boolean;
  license?: PublicLicense;
}) {
  const { license: snapshotLicense } = useLicenseSnapshot();
  const resolvedLicense = license ?? snapshotLicense;
  const resolvedS3Locked = s3Locked ?? !tierAllows(resolvedLicense.tier, "sectorsS3");
  return <SectorWorkspaceShell
    selectedSectorIds={selectedSectorIds}
    onToggleSector={onToggleSector}
    sectorMarket={sectorMarket}
    sectorMarketById={sectorMarketById}
    sectorNews={sectorNews}
    sectorMarketsLoading={sectorMarketsLoading}
    holdings={holdings}
    benchmarks={benchmarks}
    s3Locked={resolvedS3Locked}
    license={resolvedLicense}
  />;
}
