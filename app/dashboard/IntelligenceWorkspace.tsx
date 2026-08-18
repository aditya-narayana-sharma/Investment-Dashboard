"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { ContentDigestSnapshot } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import type { LiveHolding } from "../live-types";
import { SectorIntelligenceDigest } from "./IntelligenceDigest";
import { MarketEarningsCalendar } from "./IntelligenceEarnings";
import { CollapsibleSection, DailyKanbanBoard, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection, nativeChromeHidesSection, revealDashboardSection } from "./shared-ui";

const INTELLIGENCE_SECTIONS = [
  { id: "m1", label: "Action Board" },
  { id: "m2", label: "Live Intelligence" },
  { id: "m3", label: "Earnings Calendar" },
  { id: "m4", label: "Calendar + Reminders" },
] as const;

function intelligenceSectionFromUrl(): string {
  if (typeof window === "undefined") return "m1";
  const requested = new URLSearchParams(window.location.search).get("section");
  return INTELLIGENCE_SECTIONS.some((section) => section.id === requested) ? requested! : "m1";
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
  const [activeSection, setActiveSection] = useState<string>(intelligenceSectionFromUrl);
  useEffect(() => {
    const sync = () => {
      const section = intelligenceSectionFromUrl();
      setActiveSection(section);
      if (section) revealDashboardSection(section, `intelligence-${section}`);
    };
    sync();
    const retry = window.setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  const selectSection = (section: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.delete("page");
    window.history.pushState({}, "", url);
    setActiveSection(section);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
  };

  return (
    <div className="intelligence-workspace-shell" data-focus-section={activeSection ?? undefined}>
      <WorkspaceSectionNav
        label="Market Intelligence sections"
        sections={INTELLIGENCE_SECTIONS}
        activeId={activeSection ?? "m1"}
        onSelect={selectSection}
      />
      <div id="intelligence-m1" className="workspace-section action-board-workspace-section" hidden={nativeChromeHidesSection(activeSection, "m1")}>
        <CollapsibleSection
          number="M-1" title="Action Board"
          note="Clickable daily source, evidence and monitoring actions"
          defaultOpen={activeSection === "m1"}
        >
          <DailyKanbanBoard workspace="intelligence"/>
        </CollapsibleSection>
      </div>
      <div id="intelligence-m2" className="workspace-section" hidden={nativeChromeHidesSection(activeSection, "m2")}>
        <CollapsibleSection
          number="M-2" title="Live Intelligence"
          note={
            content.status === "live"
              ? `Newsletters, Axis Research and Podcasts · updated ${content.asOf}`
              : contentError
                ? `refresh issue: ${contentError}`
                : "waiting for local refresh"
          }
          defaultOpen={activeSection === "m2"}
        >
          <SectorIntelligenceDigest content={content} mailWindow={mailWindow} view="live" />
        </CollapsibleSection>
      </div>
      <div id="intelligence-m3" className="workspace-section" hidden={nativeChromeHidesSection(activeSection, "m3")}>
        <CollapsibleSection
          number="M-3" title="Earnings Calendar"
          note="Complete Apple Calendar schedule plus independently verified reported results"
          defaultOpen={activeSection === "m3"}
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
      <div id="intelligence-m4" className="workspace-section" hidden={nativeChromeHidesSection(activeSection, "m4")}>
        <CollapsibleSection
          number="M-4" title="Calendar + Reminders"
          note="Complete non-earnings calendars and the three-group reminders experience"
          defaultOpen={activeSection === "m4"}
        >
          <SectorIntelligenceDigest content={content} mailWindow={mailWindow} view="calendar-reminders" />
        </CollapsibleSection>
      </div>
    </div>
  );
}
