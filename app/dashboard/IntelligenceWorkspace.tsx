"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { ContentDigestSnapshot } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import type { LiveHolding } from "../live-types";
import { istDateKey } from "../nse-trading-day";
import { fetchSatyaSources } from "./satya-client";
import { listenToStratjiLocation } from "./stratji-navigate";
import { buildIntelligenceDailyActions } from "./intelligence-daily-actions";
import { MarketEarningsCalendar } from "./IntelligenceEarnings";
import { SatyaBriefingRoom } from "./SatyaBriefingRoom";
import { CollapsibleSection, DailyKanbanBoard, nativeChromeHidesSection, revealDashboardSection } from "./shared-ui";
import { isLocationView } from "./workspace-routing";

const INTELLIGENCE_SECTIONS = [
  { id: "m1", label: "Action Board" },
  { id: "m2", label: "Satya" },
  { id: "m3", label: "Earnings Calendar" },
] as const;

function intelligenceSectionFromUrl(): string {
  if (typeof window === "undefined") return "m1";
  const requested = new URLSearchParams(window.location.search).get("section");
  return INTELLIGENCE_SECTIONS.some((section) => section.id === requested) ? requested! : "m1";
}

function satyaSourceNote(content: ContentDigestSnapshot, contentError: string): string {
  if (content.status === "live") {
    const hasTranscript = content.podcasts.some((item) => item.contentSource === "transcript");
    const podcastLabel = hasTranscript
      ? "Podcasts (transcript when local, otherwise description)"
      : "Podcasts (description unless a local transcript was available)";
    return `Newsletters, Axis Research mail and PDFs, ${podcastLabel}, and verified IR/NSE earnings KPIs as source of truth · ${content.asOf}`;
  }
  if (contentError) return `refresh issue: ${contentError}`;
  return "waiting for local refresh";
}

export function IntelligenceWorkspace({
  content,
  contentError,
  earningsSnapshot,
  earningsError,
  holdings,
}: {
  content: ContentDigestSnapshot;
  contentError: string;
  earningsSnapshot: EarningsSnapshot;
  earningsError: string;
  holdings: LiveHolding[];
}) {
  const [activeSection, setActiveSection] = useState<string>(intelligenceSectionFromUrl);
  useEffect(() => {
    const sync = () => {
      if (!isLocationView("intelligence")) return;
      const section = intelligenceSectionFromUrl();
      setActiveSection(section);
      if (section) revealDashboardSection(section, `intelligence-${section}`);
    };
    sync();
    const retry = window.setTimeout(sync, 0);
    const stopListening = listenToStratjiLocation(sync);
    return () => {
      window.clearTimeout(retry);
      stopListening();
    };
  }, []);
  const [calendarDate, setCalendarDate] = useState(istDateKey);
  const [corpusDocuments, setCorpusDocuments] = useState<Array<{
    family: "axis_research" | "axis_mutual_fund" | "groww_digest" | "flipboard_tech" | "newsletter_other" | "podcasts";
    title: string;
    receivedAt: string;
    axisCategory?: string | null;
  }>>([]);
  useEffect(() => {
    const tick = window.setInterval(() => setCalendarDate(istDateKey()), 60_000);
    const abort = new AbortController();
    void fetchSatyaSources(abort.signal).then((payload) => {
      setCorpusDocuments((payload.recent ?? []).flatMap((row) => {
        if (row.family === "earnings") return [];
        return [{
          family: row.family,
          title: row.title,
          receivedAt: row.receivedAt,
          axisCategory: row.axisCategory,
        }];
      }));
    });
    return () => {
      window.clearInterval(tick);
      abort.abort();
    };
  }, []);
  const intelligenceActions = useMemo(
    () => buildIntelligenceDailyActions({
      content,
      earningsSnapshot,
      calendarDate,
      corpusDocuments,
    }),
    [content, earningsSnapshot, calendarDate, corpusDocuments],
  );
  const satyaSubtitle = satyaSourceNote(content, contentError);
  const hasLocalPodcastTranscript = content.podcasts.some((item) => item.contentSource === "transcript");

  return (
    <div className="intelligence-workspace-shell" data-focus-section={activeSection ?? undefined}>
      <div id="intelligence-m1" className="workspace-section action-board-workspace-section" hidden={nativeChromeHidesSection(activeSection, "m1")}>
        <CollapsibleSection
          number="M-1" title="Action Board"
          note="Daily source-backed actions from today's / last NSE trading day's Mail, Axis, podcasts, and verified earnings"
          defaultOpen={activeSection === "m1"}
        >
          <DailyKanbanBoard workspace="intelligence" items={intelligenceActions} />
        </CollapsibleSection>
      </div>
      <div id="intelligence-m2" className="workspace-section" hidden={nativeChromeHidesSection(activeSection, "m2")}>
        <CollapsibleSection
          number="M-2" title="Satya"
          note={satyaSubtitle}
          defaultOpen={activeSection === "m2"}
        >
          <SatyaBriefingRoom
            className="llm-assist-span"
            subtitle={
              hasLocalPodcastTranscript
                ? "Newsletters + Axis Research + Axis PDFs + Podcast Transcript Summaries + verified earnings KPIs, as Source of Truth"
                : "Newsletters + Axis Research + Axis PDFs + podcast summaries (description unless a local transcript was available) + verified earnings KPIs, as Source of Truth"
            }
            stale={content.status !== "live"}
          />
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
    </div>
  );
}
