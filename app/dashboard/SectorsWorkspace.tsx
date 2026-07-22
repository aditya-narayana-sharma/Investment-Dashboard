"use client";

import { lazy, Suspense, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, CircleDollarSign, ExternalLink, Mail, Mic2, Newspaper, NotebookTabs, ShieldAlert } from "lucide-react";
import { earningsCalendar, type EarningsEvent } from "../portfolio-data";
import { pestelAxes, porterAxes, sectorComposite, sectors } from "../sector-data";
import type { ContentDigestSnapshot } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import type { SectorMarketSnapshot } from "../sector-live-types";
import type { LiveHolding } from "../live-types";
import { CollapsibleSection, DailyKanbanBoard } from "./shared-ui";
import { DIGEST_PAGE_SIZE, earningsEventMonthLabel, resolveEarningsIdentity } from "./utils";

const SectoralAnalytics = lazy(() => import("./SectoralAnalytics"));

export function SectorIntelligenceDigest({ content, mailWindow }: { content: ContentDigestSnapshot; mailWindow: string }) {
  const newsletters = content.newsletters;
  const axisResearch = content.axisResearch;
  const podcasts = content.podcasts;
  const calendar = content.calendar;
  const reminders = content.reminders.filter((item) => !item.completed);
  const [showAllNewsletters, setShowAllNewsletters] = useState(false);
  const [showAllAxis, setShowAllAxis] = useState(false);
  const [showAllPodcasts, setShowAllPodcasts] = useState(false);
  const visibleNewsletters = showAllNewsletters ? newsletters : newsletters.slice(0, DIGEST_PAGE_SIZE);
  const visibleAxis = showAllAxis ? axisResearch : axisResearch.slice(0, DIGEST_PAGE_SIZE);
  const visiblePodcasts = showAllPodcasts ? podcasts : podcasts.slice(0, DIGEST_PAGE_SIZE);

  return <section className="digest-grid">
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Newsletter digest</h3><p>iCloud · Newsletters · {mailWindow} · {newsletters.length} items</p></div><Mail size={18}/></div><div className="digest-list">{visibleNewsletters.map(item=><div key={`${item.time}-${item.source}-${item.title}`}><span>{item.time}</span><div><b>{item.source}</b><h4>{item.title}</h4><p>{item.summary}</p></div></div>)}{!newsletters.length&&<div className="digest-empty">No item was available from the exact iCloud → Newsletters mailbox in this window.</div>}{newsletters.length > DIGEST_PAGE_SIZE && !showAllNewsletters && <button type="button" className="digest-show-all" onClick={() => setShowAllNewsletters(true)}>Show all {newsletters.length}</button>}{showAllNewsletters && newsletters.length > DIGEST_PAGE_SIZE && <button type="button" className="digest-show-all" onClick={() => setShowAllNewsletters(false)}>Show fewer</button>}</div></article>
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Axis Research</h3><p>iCloud · Axis Research · {axisResearch.length} reports · {mailWindow}</p></div><Newspaper size={18}/></div><div className="digest-list">{visibleAxis.map(item=><div key={`${item.time}-${item.title}`}><span>{item.time}</span><div><b>{item.source}</b><h4>{item.title}</h4><p>{item.summary}</p></div></div>)}{!axisResearch.length&&<div className="digest-empty">No Axis Research item was available for this window.</div>}{axisResearch.length > DIGEST_PAGE_SIZE && !showAllAxis && <button type="button" className="digest-show-all" onClick={() => setShowAllAxis(true)}>Show all {axisResearch.length}</button>}{showAllAxis && axisResearch.length > DIGEST_PAGE_SIZE && <button type="button" className="digest-show-all" onClick={() => setShowAllAxis(false)}>Show fewer</button>}</div></article>
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Calendar + action feeds</h3><p>{calendar.length} events · {reminders.length} active reminders</p></div><NotebookTabs size={18}/></div><div className="topic-feed">{(["Earnings","Work/Jobs","Personal","Other"] as const).map((topic)=>{const events=calendar.filter((item)=>item.topic===topic);const tasks=reminders.filter((item)=>item.topic===topic);if(!events.length&&!tasks.length)return null;return <section key={topic}><h4>{topic}<span>{events.length+tasks.length}</span></h4>{events.slice(0,4).map((item)=><p key={item.id}><b>{new Date(item.startsAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</b>{item.title}<small>{item.calendar}</small></p>)}{tasks.slice(0,4).map((item)=><p key={item.id}><b>TODO</b>{item.title}<small>{item.list}</small></p>)}</section>})}{!calendar.length&&!reminders.length&&<div className="digest-empty">No Calendar or active Reminder items were available.</div>}</div></article>
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Podcast summaries</h3><p>{podcasts.length} episodes from the latest local refresh</p></div><Mic2 size={18}/></div><div className="digest-list podcast-digest">{visiblePodcasts.map((item,index)=><div key={`${item.time}-${item.source}-${item.title}`}><span>{item.time || String(index+1).padStart(2,"0")}</span><div><b>{item.source}</b><h4>{item.title}</h4><p>{item.summary}</p></div></div>)}{!podcasts.length&&<div className="digest-empty">No podcast episode was available in this window.</div>}{podcasts.length > DIGEST_PAGE_SIZE && !showAllPodcasts && <button type="button" className="digest-show-all" onClick={() => setShowAllPodcasts(true)}>Show all {podcasts.length}</button>}{showAllPodcasts && podcasts.length > DIGEST_PAGE_SIZE && <button type="button" className="digest-show-all" onClick={() => setShowAllPodcasts(false)}>Show fewer</button>}</div><div className="digest-note">This complete intelligence digest is local and read-only. Mail bodies and Podcast descriptions remain on this Mac.</div></article>
  </section>;
}

function calendarEarningsEvents(content: ContentDigestSnapshot, existing: EarningsEvent[]): EarningsEvent[] {
  const knownSymbols = new Set(existing.map((event) => event.symbol.toLowerCase()));
  return content.calendar.filter((item) => item.topic === "Earnings").flatMap((item) => {
    const identity = resolveEarningsIdentity(item.title, existing);
    if (knownSymbols.has(identity.symbol.toLowerCase())) return [];
    const parsed = new Date(item.startsAt);
    if (Number.isNaN(parsed.getTime())) return [];
    knownSymbols.add(identity.symbol.toLowerCase());
    const day = new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }).format(parsed);
    const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(parsed);
    const banking = /bank|finance|nbfc|insurance/i.test(`${identity.name} ${item.title}`);
    const technology = /tech|software|digital|infosys|tcs|wipro/i.test(`${identity.name} ${item.title}`);
    const kpiLabels = banking ? ["PAT", "NII / income", "Asset quality", "Margin / credit cost"] : technology ? ["Revenue / CC growth", "Operating margin", "Deal wins", "Guidance"] : ["Revenue", "Profit", "Operating margin", "Management guidance"];
    return [{ date, day, symbol: identity.symbol, name: identity.name, state: "Pending · Apple Calendar", portfolio: false, period: "Latest quarter", reported: false, kpis: kpiLabels.map((label) => ({ label, value: "", change: "" })), summary: item.notes || "Calendar event imported from Apple Calendar. KPI fields remain blank until a cited company or exchange result is available." }];
  });
}

function earningsEventKey(event: EarningsEvent) {
  return `${event.date}|${event.symbol}|${event.name}`;
}

export function EarningsCalendarWorkbench({ snapshot, content }: { snapshot: EarningsSnapshot; content: ContentDigestSnapshot }) {
  const baseEvents = snapshot.events.length ? snapshot.events : earningsCalendar;
  const events = useMemo(() => [...baseEvents, ...calendarEarningsEvents(content, baseEvents)].sort((left, right) => Number(left.day) - Number(right.day)), [baseEvents, content]);
  const [selectedKey, setSelectedKey] = useState(() => earningsEventKey(events[0]));
  const selected = events.find((event) => earningsEventKey(event) === selectedKey) ?? events[0];
  const reportedCount = events.filter((event) => event.reported).length;

  return <article className="panel catalyst-card earnings-workbench">
    <div className="panel-title"><div><h3>Earnings calendar</h3><p>{events.length} events across all tracked industries · select any company for reported KPIs or pending fields</p></div><span className={`pill ${snapshot.status === "verified" ? "green" : snapshot.status === "stale" ? "amber" : "red"}`}>{snapshot.status} · {snapshot.asOf}</span></div>
    <div className="earnings-progress"><span><b>{reportedCount}</b> reported</span><i><span style={{width:`${reportedCount / events.length * 100}%`}}/></i><span><b>{events.length - reportedCount}</b> pending</span></div>
    <div className="earnings-rail" role="tablist" aria-label="Select earnings event">{events.map((event) => {
      const key = earningsEventKey(event);
      return <button type="button" role="tab" aria-selected={key === earningsEventKey(selected)} className={`${key === earningsEventKey(selected) ? "active" : ""} ${event.reported ? "reported" : "pending"} ${event.portfolio ? "portfolio" : ""}`} key={key} title={`${event.name} (${event.symbol})`} onClick={() => setSelectedKey(key)}>
        <span>{event.day}<small>{earningsEventMonthLabel(event.date)}</small></span>
        <b>{event.name}</b>
        <code>{event.symbol}</code>
        <i aria-hidden="true"/>
        <em>{event.reported ? "Reported" : event.portfolio ? "Holding" : "Pending"}</em>
      </button>;
    })}</div>
    <section className={`earnings-detail ${selected.reported ? "reported" : "pending"}`} role="tabpanel">
      <div className="earnings-detail-heading"><div><span>{selected.period} · {selected.date}</span><h4>{selected.name}</h4><p>NSE · {selected.symbol}{selected.portfolio ? " · Current portfolio holding" : ""}</p></div><span className={`pill ${selected.reported ? "green" : selected.portfolio ? "red" : "amber"}`}>{selected.state}</span></div>
      <div className="earnings-kpi-grid">{selected.kpis.map((kpi) => <div className={kpi.value ? "filled" : "empty"} key={`${selected.symbol}-${kpi.label}`}><span>{kpi.label}</span>{kpi.value ? <><b>{kpi.value}</b><small className={kpi.tone ?? ""}>{kpi.change}</small></> : <><b className="blank-value" aria-label="Pending result value"/><small aria-hidden="true">&nbsp;</small></>}</div>)}</div>
      {selected.reported ? <div className="earnings-result-note"><CheckCircle2 size={17}/><p>{selected.summary}</p>{selected.source && <a href={selected.source} target="_blank" rel="noreferrer" title="Open company investor presentation">Source <ExternalLink size={12}/></a>}</div> : <div className="earnings-pending-note"><span/><p>{selected.summary ?? "KPI fields are intentionally blank and will be populated only after the company publishes its result."}</p>{selected.source && <a href={selected.source} target="_blank" rel="noreferrer" title="Open official earnings source">Official source <ExternalLink size={12}/></a>}</div>}
    </section>
    <p className="earnings-footnote">Calendar dates refresh through the current analysis day. Reported rows require a cited company/exchange source; pending KPI fields stay blank until publication.</p>
  </article>;
}

export function SectorDecisionFramework() {
  const [framework, setFramework] = useState<"pestel" | "porter" | "mece" | "allocation">("pestel");
  const [frameworkSectorId, setFrameworkSectorId] = useState("pharma");
  const sector = sectors.find((item) => item.id === frameworkSectorId) ?? sectors[0];
  const frameworks = {
    pestel: { label: "PESTEL", question: "Is the external environment supportive?", items: pestelAxes.map((axis, index) => ({ title: axis, value: `${sector.pestel[index].toFixed(1)} / 5`, text: index < 2 ? sector.watch : sector.mece[index % sector.mece.length] })) },
    porter: { label: "Porter", question: "Where is competitive pressure concentrated?", items: porterAxes.map((axis, index) => ({ title: axis, value: `${sector.porter[index].toFixed(1)} / 5 pressure`, text: sector.mece[(index + 1) % sector.mece.length] })) },
    mece: { label: "MECE", question: "Which independent driver changes the decision?", items: ["Demand engines", "Profit pool", "Policy / structure", "Valuation / risk"].map((title, index) => ({ title, value: `Lens ${index + 1}`, text: sector.mece[index] })) },
    allocation: { label: "Decision gates", question: "What must happen before capital is committed?", items: [
      { title: "Evidence gate", value: "Official + current", text: `Confirm KPI direction and reporting period. ${sector.watch}` },
      { title: "Breadth gate", value: "Constituent-confirmed", text: "Require leadership across multiple constituents, not one index heavyweight." },
      { title: "Valuation gate", value: "Risk-adjusted", text: "Compare earnings revisions, cash conversion and balance-sheet risk with the price paid." },
      { title: "Execution gate", value: "Staged", text: "Size gradually, define invalidation triggers and review after the next reported catalyst." },
    ] },
  } as const;
  const active = frameworks[framework];
  return <article className="panel decision-workbench" style={{"--sector":sector.color} as CSSProperties}>
    <div className="panel-title"><div><h3>Decision framework</h3><p>{sector.name} · business-framework evidence before allocation</p></div><CircleDollarSign size={18}/></div>
    <div className="decision-sector-tabs" role="tablist" aria-label="Select decision-framework industry">{sectors.map((item) => <button type="button" role="tab" aria-selected={frameworkSectorId === item.id} className={frameworkSectorId === item.id ? "active" : ""} onClick={() => setFrameworkSectorId(item.id)} key={item.id}>{item.name}</button>)}</div>
    <div className="decision-tabs" role="tablist">{(Object.keys(frameworks) as Array<keyof typeof frameworks>).map((key) => <button type="button" role="tab" aria-selected={framework === key} className={framework === key ? "active" : ""} onClick={() => setFramework(key)} key={key}>{frameworks[key].label}</button>)}</div>
    <div className="decision-question"><b>{active.question}</b><span>{sector.pulse} pulse · composite {sectorComposite(sector).toFixed(1)} / 5</span></div>
    <div className="decision-card-grid">{active.items.map((item) => <div key={item.title}><span>{item.title}</span><b>{item.value}</b><p>{item.text}</p></div>)}</div>
    <div className="decision-sequence"><span>1 · Source</span><span>2 · Compare</span><span>3 · Stress-test</span><span>4 · Size</span><span>5 · Monitor</span></div>
  </article>;
}

export function SectorsWorkspace({
  content,
  contentError,
  mailWindow,
  selectedSectorIds,
  onToggleSector,
  sectorMarket,
  sectorMarketById,
  holdings,
  earningsSnapshot,
  earningsError,
}: {
  content: ContentDigestSnapshot;
  contentError: string;
  mailWindow: string;
  selectedSectorIds: string[];
  onToggleSector: (sectorId: string) => void;
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  holdings: LiveHolding[];
  earningsSnapshot: EarningsSnapshot;
  earningsError: string;
}) {
  return <>
      <div className="workspace-section">
      <CollapsibleSection number="S-1" title="Sector action board" note="Clickable research actions with measurable and strategic advantages">
        <DailyKanbanBoard workspace="sectors"/>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="S-2" title="Sectoral analytics" note="Impact matrix, framework comparison, industry life cycle, market structure and macro dials">
        <Suspense fallback={<div className="live-empty compact"><b>Loading sectoral analytics…</b></div>}>
          <SectoralAnalytics selectedIds={selectedSectorIds} onToggle={onToggleSector} market={sectorMarket} marketsBySector={sectorMarketById} holdings={holdings}/>
        </Suspense>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="S-3" title="Live intelligence digest" note={`Mail, Calendar, Reminders, Notes and Podcasts · ${content.status === "live" ? `updated ${content.asOf}` : contentError ? `refresh issue: ${contentError}` : "waiting for local refresh"}`}>
      <SectorIntelligenceDigest content={content} mailWindow={mailWindow}/>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="S-4" title="Earnings & decision framework" note="Full-width result tracker plus multi-framework sector decisions">
      <section className="earnings-decision-stack">
        {earningsError && <div className="refresh-error"><ShieldAlert size={15}/><span>{earningsError}</span></div>}
        <EarningsCalendarWorkbench snapshot={earningsSnapshot} content={content}/>
        <SectorDecisionFramework/>
      </section>
      </CollapsibleSection>
      </div>
  </>;
}
