"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Activity, CheckCircle2, Database, ExternalLink, FileText, Gauge, Globe2, Mail, ScanSearch, ShieldAlert, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fiiDiiFlowsSnapshot, fiveDayDiiNetCr, fiveDayFiiNetCr, flowCompositionSlices, formatFlowCr, formatFlowDeltaCr } from "../fii-dii-flows";
import { axisArchiveAudit, riskAxes, type RiskProfile } from "../portfolio-data";
import type { ContentDigestSnapshot, MailRecommendation } from "../content-types";
import type { KiteSnapshot, LiveHolding } from "../live-types";
import { portfolioReturnTone } from "../portfolio-concentration.mjs";
import { buildRiskExplanation } from "../risk-explanations";
import { thesisBullets, type ThesisBullet } from "../thesis-bullets";
import type { MacroBandKey, MacroEventKey } from "./types";
import { AllocationLabel, CollapsibleSection, DailyKanbanBoard, HoldingLabel, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import { KiteOrderTicket, type KiteOrderSelection } from "./KiteOrderTicket";
import { analysisWindowLabel, exposureFactors, holdingOuterFill, inr, macroEvents } from "./utils";

type PortfolioMapDatum = Pick<LiveHolding, "symbol" | "name" | "qty" | "avg" | "price" | "value" | "pnl" | "pnlPct" | "dayPnl" | "dayPct" | "sector" | "subSector" | "risk"> & {
  weight: number;
  displayColor: string;
  returnTone: "gain" | "flat" | "loss";
};

type PortfolioMapRect = PortfolioMapDatum & { x: number; y: number; width: number; height: number };

function portfolioReturnColor(returnPct: number): string {
  const tone = portfolioReturnTone(returnPct);
  return tone === "gain" ? "#137a43" : tone === "loss" ? "#a92f39" : "#9a6b12";
}

function layoutPortfolioMap(data: PortfolioMapDatum[], x = 0, y = 0, width = 100, height = 100): PortfolioMapRect[] {
  if (!data.length) return [];
  if (data.length === 1) return [{ ...data[0], x, y, width, height }];

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const target = total / 2;
  let running = 0;
  let splitAt = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < data.length; index += 1) {
    running += data[index - 1].value;
    const distance = Math.abs(target - running);
    if (distance < bestDistance) {
      bestDistance = distance;
      splitAt = index;
    }
  }

  const first = data.slice(0, splitAt);
  const second = data.slice(splitAt);
  const firstValue = first.reduce((sum, item) => sum + item.value, 0);
  const ratio = total > 0 ? firstValue / total : first.length / data.length;
  if (width >= height) {
    const firstWidth = width * ratio;
    return [...layoutPortfolioMap(first, x, y, firstWidth, height), ...layoutPortfolioMap(second, x + firstWidth, y, width - firstWidth, height)];
  }
  const firstHeight = height * ratio;
  return [...layoutPortfolioMap(first, x, y, width, firstHeight), ...layoutPortfolioMap(second, x, y + firstHeight, width, height - firstHeight)];
}

function portfolioMapTooltip(holding: PortfolioMapDatum): string {
  return `${holding.name} (${holding.symbol})\nQuantity: ${holding.qty}\nAverage price: ${inr.format(holding.avg)}\nLast price: ${inr.format(holding.price)}\nValue: ${inr.format(holding.value)}\nUnrealised P&L: ${holding.pnl >= 0 ? "+" : ""}${inr.format(holding.pnl)} (${holding.pnlPct >= 0 ? "+" : ""}${holding.pnlPct.toFixed(2)}%)\nDay P&L: ${holding.dayPnl >= 0 ? "+" : ""}${inr.format(holding.dayPnl)} (${holding.dayPct >= 0 ? "+" : ""}${holding.dayPct.toFixed(2)}%)\nIndustry: ${holding.sector}\nSubsector: ${holding.subSector}\nRisk: ${holding.risk}`;
}

function ThesisBulletList({ bullets, className = "thesis-bullet-list" }: { bullets: ThesisBullet[]; className?: string }) {
  if (!bullets.length) return <span className="thesis-empty">No scoped thesis in readable Mail content</span>;
  return <ul className={className}>{bullets.map((bullet) => <li key={`${bullet.marker}-${bullet.text}`} className={bullet.tone}><span aria-hidden="true">{bullet.marker}</span><span>{bullet.text}</span></li>)}</ul>;
}

function RiskRadar({ profiles, selected, onSelect, averageLabel, idPrefix, explainSelected = false, emptyLabel = "No current risk profiles" }: { profiles: RiskProfile[]; selected: string; onSelect: (symbol: string) => void; averageLabel: string; idPrefix: string; explainSelected?: boolean; emptyLabel?: string }) {
  if (!profiles.length) return <div className="live-empty compact"><Mail size={22}/><b>{emptyLabel}</b><p>The refreshed source set did not produce a verified profile for the selected analysis window.</p></div>;
  const profile = profiles.find((item) => item.symbol === selected) ?? profiles[0];
  const explanation = explainSelected ? buildRiskExplanation(profile, riskAxes) : null;
  const data = riskAxes.map((axis, index) => ({
    axis,
    score: profile.scores[index],
    average: Number((profiles.reduce((sum, item) => sum + item.scores[index], 0) / profiles.length).toFixed(1)),
  }));
  const tabPanelId = `${idPrefix}-panel`;

  return <>
    <div className="risk-selector" role="tablist" aria-label="Select risk profile">{profiles.map((item) => <button type="button" role="tab" id={`${idPrefix}-tab-${item.symbol}`} aria-controls={tabPanelId} aria-selected={item.symbol === profile.symbol} key={item.symbol} onClick={() => onSelect(item.symbol)} className={item.symbol === profile.symbol ? "active" : ""} aria-label={`${item.name} (${item.symbol})`}>{item.symbol}</button>)}</div>
    <div role="tabpanel" id={tabPanelId} aria-labelledby={`${idPrefix}-tab-${profile.symbol}`}>
    <div className="risk-chart"><ResponsiveContainer width="100%" height={330}>
      <RadarChart data={data} outerRadius="72%" margin={{ top: 16, right: 38, bottom: 12, left: 38 }}>
        <PolarGrid stroke="#3b444e" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "#f4f5f6", fontSize: 11, fontWeight: 700 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fill: "#8d97a1", fontSize: 10 }} />
        <Radar name={averageLabel} dataKey="average" stroke="#8f98a2" fill="#8f98a2" fillOpacity={0.08} strokeDasharray="5 4" isAnimationActive={false} />
        <Radar name={profile.name} dataKey="score" stroke={profile.color} fill={profile.color} fillOpacity={0.25} strokeWidth={2.5} isAnimationActive={false} />
        <Legend />
        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 5`, "Risk score"]} />
      </RadarChart>
    </ResponsiveContainer></div>
    <div className="risk-scale"><span><i className="dot green"/>1-2 lower</span><span><i className="dot amber"/>3 moderate</span><span><i className="dot red"/>4-5 elevated</span><em>Qualitative monitoring score, not a probability of loss or investment recommendation.</em></div>
    {explanation && <aside className="risk-explanation" aria-live="polite" aria-labelledby={`${idPrefix}-explanation-title`}>
      <header><span>Selected holding</span><h4 id={`${idPrefix}-explanation-title`}>{explanation.profileLabel}</h4></header>
      <section><h5>Overview</h5><ul className="risk-overview-list">{explanation.overview.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></section>
      <section><h5>Axis explanations</h5><ul className="risk-axis-list">{explanation.axes.map((item) => <li key={item.axis} data-band={item.band}><b>{item.axis}</b><span>{item.score}/5 · {item.band}</span><p>{item.text.slice(item.text.indexOf(":") + 2)}</p></li>)}</ul></section>
    </aside>}
    </div>
  </>;
}

function FlowsRegimePanel({ bandTone, range, evidence, sectors, trigger }: { bandTone: string; range: string; evidence: string; sectors: string; trigger: string }) {
  const snapshot = fiiDiiFlowsSnapshot;
  const fiveDayFii = fiveDayFiiNetCr(snapshot);
  const fiveDayDii = fiveDayDiiNetCr(snapshot);
  const slices = flowCompositionSlices(snapshot);
  const deltaTone = fiveDayFii > 5000 ? "positive" : fiveDayFii < -5000 ? "negative" : "neutral";

  return <article className={`macro-regime-card flows-regime-panel ${bandTone}`}>
    <div><span className={`dot ${bandTone}`}/><b>FII / DII flows</b></div>
    <div className="flows-donut-card" aria-label="FII versus DII composition donut">
      <div className="flows-donut-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="48%" outerRadius="92%" startAngle={90} endAngle={-270} paddingAngle={2} stroke="#0d1013" strokeWidth={4} isAnimationActive={false}>
              {slices.map((slice) => <Cell key={slice.name} fill={slice.color}/>)}
            </Pie>
            <Tooltip formatter={(_value, _name, item) => {
              const payload = item?.payload as { signedNetCr?: number; name?: string } | undefined;
              return [formatFlowCr(payload?.signedNetCr ?? 0), `${payload?.name ?? "Net"} · latest session`];
            }}/>
          </PieChart>
        </ResponsiveContainer>
        <div className={`flows-donut-center ${deltaTone}`}>
          <b>{formatFlowDeltaCr(fiveDayFii)}</b>
          <span>Δ 5D FII</span>
        </div>
      </div>
      <div className="flows-donut-legend">
        {slices.map((slice) => <span key={slice.name}><i style={{background: slice.color}}/>{slice.name} {formatFlowCr(slice.signedNetCr)}</span>)}
      </div>
      <p className="flows-donut-note">
        <span>Slices = latest |net| composition · centre = five-session FII cash</span>
        <span>5D DII {formatFlowCr(fiveDayDii, 0)} · provisional · NSE primary + cited cross-checks</span>
      </p>
    </div>
    <strong>{range}</strong>
    <p>{evidence}</p>
    <small>{sectors}</small>
    <em>{trigger}</em>
  </article>;
}

function FlowsEvidencePanel({ content, mailCount, mailItems }: { content: ContentDigestSnapshot; mailCount: number; mailItems: ContentDigestSnapshot["investment"]["macroEvidence"][number]["items"] }) {
  const snapshot = fiiDiiFlowsSnapshot;
  const latest = snapshot.sessions[0];
  const webCount = snapshot.evidence.length;
  const subtitle = mailCount
    ? `${mailCount} Mail · ${webCount} web sources · as-of ${latest?.dateLabel ?? snapshot.dataDate}`
    : `${webCount} web sources (0 Mail matches) · as-of ${latest?.dateLabel ?? snapshot.dataDate}`;

  return <article className="macro-selected-evidence flows-evidence-panel">
    <header><Globe2 size={16}/><div><b>FII / DII flows evidence</b><small>{subtitle}</small></div></header>
    <div className="flows-evidence-list">
      {snapshot.evidence.map((item) => (
        <section key={item.url} className={item.kind === "primary" ? "primary" : ""}>
          <span>{item.source} · {item.asOf}{item.kind === "primary" ? " · PRIMARY" : ""}</span>
          <b>{item.title}</b>
          <p>{item.summary}</p>
          <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={11}/>Source</a>
        </section>
      ))}
      {mailItems.length ? mailItems.map((item) => (
        <section key={`mail-${item.receivedAt ?? item.time}-${item.title}`}>
          <span>{item.source} · {item.time} · MAIL</span>
          <b>{item.title}</b>
          <p>{item.summary}</p>
        </section>
      )) : (
        <section className="flows-mail-empty">
          <span>Mail · {analysisWindowLabel(content)}</span>
          <b>No event-specific Mail evidence in this window</b>
          <p>Axis/Newsletter titles and summaries did not match FII/DII flow keywords. Decision ranges stay framework thresholds; web prints above are the live evidence layer.</p>
        </section>
      )}
    </div>
  </article>;
}

function MacroScenarioBoard({ eventKey, bandKey, onEventChange, onBandChange, content }: { eventKey: MacroEventKey; bandKey: MacroBandKey; onEventChange: (key: MacroEventKey) => void; onBandChange: (key: MacroBandKey) => void; content: ContentDigestSnapshot }) {
  const event = macroEvents[eventKey];
  const band = event.bands[bandKey];
  const mail = content.investment.macroEvidence.find((item) => item.key === eventKey);
  const mailCount = mail?.count ?? 0;
  const mailItems = mail?.items ?? [];
  return <section className="macro-workbench">
    <div className={`investment-mail-source ${content.status}`}><Mail size={16}/><span><b>Investment evidence refreshed from Mail for {analysisWindowLabel(content)}</b><small>iCloud → Axis Research ({content.sources.axisResearch.displayedCount ?? content.axisResearch.length} qualifying reports) + iCloud → Newsletters ({content.sources.newsletters.displayedCount ?? content.newsletters.length} items) · refreshed {content.asOf}</small></span></div>
    <div className="macro-event-tabs" role="tablist" aria-label="Select macro event">{(Object.keys(macroEvents) as MacroEventKey[]).map((key) => <button type="button" role="tab" aria-selected={eventKey === key} key={key} className={eventKey === key ? "active" : ""} onClick={() => onEventChange(key)}><span className={`dot ${key === "breadth" ? "red" : key === "earnings" ? "green" : key === "flows" ? "blue" : "amber"}`}/><b>{macroEvents[key].shortLabel}</b><small>{macroEvents[key].label}</small></button>)}</div>
    <div className="scenario-shell">
      <div className="scenario-tabs" role="tablist" aria-label={`${event.label} decision ranges`}>{(Object.keys(event.bands) as MacroBandKey[]).map((key) => <button type="button" role="tab" aria-selected={bandKey === key} key={key} className={bandKey === key ? "active" : ""} onClick={() => onBandChange(key)}><span className={`dot ${event.bands[key].tone}`}/><b>{event.bands[key].label}</b><small>{event.bands[key].range}</small></button>)}</div>
      <div className={`scenario-body ${band.tone}`}><div className="scenario-copy"><span>SELECTED {event.label.toUpperCase()} RANGE</span><h3>{band.label}</h3><b className="scenario-range">{band.range}</b><p>{band.summary}</p></div><div><small>Relative leaders</small><b>{band.leaders}</b></div><div><small>Relative laggards</small><b>{band.laggards}</b></div><div><small>Framework response</small><b>{band.action}</b></div></div>
    </div>
    <div className={`macro-event-detail${eventKey === "flows" ? " flows-detail" : ""}`}>
      {eventKey === "flows" ? (
        <FlowsRegimePanel bandTone={band.tone} range={band.range} evidence={event.evidence} sectors={event.sectors} trigger={event.trigger}/>
      ) : (
        <article className={`macro-regime-card ${band.tone}`}><div><span className={`dot ${band.tone}`}/><b>{event.label}</b></div><strong>{band.range}</strong><p>{event.evidence}</p><small>{event.sectors}</small><em>{event.trigger}</em></article>
      )}
      {eventKey === "flows" ? (
        <FlowsEvidencePanel content={content} mailCount={mailCount} mailItems={mailItems}/>
      ) : (
        <article className="macro-selected-evidence"><header><Mail size={16}/><div><b>{event.label} evidence</b><small>{mailCount} matching Axis Research and Newsletter items</small></div></header>{mailItems.length ? <div>{mailItems.map((item) => <section key={`${item.receivedAt ?? item.time}-${item.title}`}><span>{item.source} · {item.time}</span><b>{item.title}</b><p>{item.summary}</p></section>)}</div> : <div className="macro-no-evidence"><b>No event-specific Mail evidence found</b><p>The selected decision ranges remain framework thresholds, not claims about the current market state.</p></div>}</article>
      )}
    </div>
    <div className="macro-method"><ShieldAlert size={15}/><span><b>Decision sequence:</b> establish regime → test flow and rate confirmation → identify sector transmission → verify company KPIs → size the portfolio response.</span></div>
  </section>;
}

/** Implied upside % from Axis target vs CMP; null when either side is missing. */
function axisImpliedUpsidePct(target: number | null | undefined, cmp: number | null | undefined): number | null {
  if (target == null || cmp == null || cmp <= 0) return null;
  return (target / cmp - 1) * 100;
}

/** Compact line under the company name: `TARGET - XX% (Axis Mail)` or price fallback. */
function formatAxisTargetLine(target: number | null | undefined, cmp: number | null | undefined): string {
  const upside = axisImpliedUpsidePct(target, cmp);
  if (upside !== null) {
    const label = Number.isInteger(Number(upside.toFixed(1))) ? `${Math.round(upside)}%` : `${upside.toFixed(1)}%`;
    return `TARGET - ${label} (Axis Mail)`;
  }
  if (target != null) return `TARGET - ${inr.format(target)} (Axis Mail)`;
  return "TARGET — (Axis Mail)";
}

function formatAxisIndicatedUpside(target: number | null | undefined, cmp: number | null | undefined): string {
  const upside = axisImpliedUpsidePct(target, cmp);
  return upside === null ? "—" : `${upside.toFixed(1)}%`;
}

function formatAxisCmp(cmp: number | null): string {
  return cmp != null && cmp > 0 ? inr.format(cmp) : "—";
}

type AxisProgress = {
  /** Display CMP: live holding price preferred, else mail CMP. Never fabricated. */
  cmp: number | null;
  cmpSource: "live" | "mail" | null;
  /**
   * Progress to Axis target, 0–100.
   * When mail CMP (entry) and live price both exist: (live − entry) / (target − entry), clamped.
   * Otherwise: min(100%, CMP / target × 100) using the best available price.
   */
  pct: number | null;
  metricNote: string;
};

/** Resolve display CMP + progress-to-target from real mail/live prices only. */
function axisProgressToTarget(item: MailRecommendation, liveBySymbol: Map<string, number>): AxisProgress {
  const liveRaw = liveBySymbol.get(item.symbol);
  const live = liveRaw != null && liveRaw > 0 ? liveRaw : null;
  const mail = item.cmp != null && item.cmp > 0 ? item.cmp : null;
  const cmp = live ?? mail;
  const cmpSource: AxisProgress["cmpSource"] = live != null ? "live" : mail != null ? "mail" : null;
  const target = item.target != null && item.target > 0 ? item.target : null;

  if (cmp == null || target == null) {
    return { cmp, cmpSource, pct: null, metricNote: "Needs CMP and Axis target" };
  }

  if (live != null && mail != null && target !== mail) {
    const raw = ((live - mail) / (target - mail)) * 100;
    const pct = Math.min(100, Math.max(0, raw));
    return { cmp: live, cmpSource: "live", pct, metricNote: "Live vs mail CMP → Axis target" };
  }

  const pct = Math.min(100, Math.max(0, (cmp / target) * 100));
  return { cmp, cmpSource, pct, metricNote: "CMP ÷ Axis target (capped 100%)" };
}

function formatAxisProgressPct(pct: number | null): string {
  if (pct == null) return "—";
  return Number.isInteger(Number(pct.toFixed(1))) ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
}

function AxisCmpProgressBar({ progress, compact = false }: { progress: AxisProgress; compact?: boolean }) {
  const width = progress.pct == null ? 0 : progress.pct;
  const reached = progress.pct != null && progress.pct >= 100;
  return <div className={`axis-target-progress${compact ? " compact" : ""}${reached ? " reached" : ""}${progress.pct == null ? " empty" : ""}`} role="meter" aria-label="Progress to Axis target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct == null ? undefined : Math.round(progress.pct)} aria-valuetext={progress.pct == null ? "Unavailable" : formatAxisProgressPct(progress.pct)}>
    {!compact && <div className="axis-target-progress-meta"><span>Progress to target</span><b>{formatAxisProgressPct(progress.pct)}</b></div>}
    <i className="axis-target-progress-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></i>
    {compact ? <em>{formatAxisProgressPct(progress.pct)}</em> : <small>{progress.metricNote}</small>}
  </div>;
}

function AxisRecommendationWorkbench({ recommendations, content, currentBySymbol }: { recommendations: MailRecommendation[]; content: ContentDigestSnapshot; currentBySymbol: Map<string, number> }) {
  const [selectedSymbol, setSelectedSymbol] = useState(recommendations[0]?.symbol ?? "");
  const selected = recommendations.find((item) => item.symbol === selectedSymbol) ?? recommendations[0];
  if (!selected) return <section className="axis-workbench"><div className="live-empty"><Mail size={24}/><b>No Axis recommendation was parsed for {analysisWindowLabel(content)}</b><p>The exact iCloud → Axis Research mailbox refreshed successfully, but no qualifying BUY/HOLD/SELL target was found in readable Mail text for the selected analysis window. PDF attachments are not OCR’d into calls. No older static call is being presented as current.</p></div></section>;
  const selectedProgress = axisProgressToTarget(selected, currentBySymbol);
  const selectedCmp = selectedProgress.cmp;
  const categories = [
    { label: "Fundamental", count: recommendations.filter((item) => !item.call.includes("TECHNICAL") && !item.call.includes("TRADING")).length, tone: "green" },
    { label: "Technical", count: recommendations.filter((item) => item.call.includes("TECHNICAL")).length, tone: "blue" },
    { label: "Trading", count: recommendations.filter((item) => item.call.includes("TRADING")).length, tone: "amber" },
  ];
  const upside = axisImpliedUpsidePct(selected.target, selectedCmp);
  const category = selected.call.includes("TECHNICAL") ? "Technical" : selected.call.includes("TRADING") ? "Trading" : "Fundamental";
  const detailBullets = thesisBullets(selected.thesis, { symbol: selected.symbol, name: selected.name, call: selected.call, limit: 5 });
  const cmpSourceLabel = selectedProgress.cmpSource === "live" ? "Kite holding" : selectedProgress.cmpSource === "mail" ? "Axis Mail" : "Unavailable";

  return <section className="axis-workbench">
    <div className="axis-audit-strip">
      <div><Mail size={18}/><span><b>{recommendations.length} mail-window calls</b><small>Parsed BUY/HOLD/SELL from iCloud → Axis Research · as-of {content.investment.axisTradingAsOfLabel ?? analysisWindowLabel(content)}</small></span></div>
      <div><Database size={18}/><span><b>{axisArchiveAudit.validPdfs} archive PDFs</b><small>Local evidence inventory · not a stock-call count ({axisArchiveAudit.filesAttempted} files scanned)</small></span></div>
      <div className="warning"><b>{axisArchiveAudit.invalidFiles.length}</b><small>invalid non-PDF payloads</small></div>
    </div>
    <div className="axis-category-strip">{categories.map((item) => <div className={item.tone} key={item.label}><span>{item.label}</span><b>{item.count}</b><small>{item.count === 1 ? "active call" : "active calls"}</small></div>)}</div>
    <div className="axis-visual-grid">
      <nav className="axis-pick-list" aria-label="Select Axis recommendation">{recommendations.map((item) => {
        const progress = axisProgressToTarget(item, currentBySymbol);
        const tone = item.call.includes("TECHNICAL") ? "blue" : item.call.includes("TRADING") ? "amber" : "green";
        return <button type="button" className={`${selected.symbol === item.symbol ? "active" : ""} ${tone}`} onClick={() => setSelectedSymbol(item.symbol)} key={item.symbol}>
          <b>{item.symbol}</b>
          <small>{item.name}</small>
          <span className="axis-pick-cmp">CMP {formatAxisCmp(progress.cmp)}</span>
          <em>{formatAxisTargetLine(item.target, progress.cmp)}</em>
          <AxisCmpProgressBar progress={progress} compact />
        </button>;
      })}</nav>
      <article className="panel axis-pick-detail" style={{"--axis-color": selected.color} as CSSProperties}>
        <div className="axis-pick-heading"><div><span>{category} · {selected.date}</span><h3>{selected.name}</h3><p className="axis-target-line">{formatAxisTargetLine(selected.target, selectedCmp)}</p><p>{selected.symbol} · {selected.source}</p></div><span className="pill blue">{selected.call}</span></div>
        <div className="axis-numeric-grid">
          <div><span>CMP · {cmpSourceLabel}</span><b>{formatAxisCmp(selectedCmp)}</b></div>
          <div><span>Target</span><b>{selected.target ? inr.format(selected.target) : "No explicit TP"}</b></div>
          <div className={upside !== null && upside >= 0 ? "positive" : ""}><span>Indicated upside</span><b>{formatAxisIndicatedUpside(selected.target, selectedCmp)}</b></div>
          <div><span>Horizon</span><b>{selected.horizon}</b></div>
        </div>
        <AxisCmpProgressBar progress={selectedProgress} />
        <ThesisBulletList bullets={detailBullets} className="axis-thesis-bullets" />
        <div className="axis-evidence"><FileText size={15}/><span><b>Evidence:</b> {selected.source} · {selected.date} · scoped to {selected.symbol}</span></div>
      </article>
    </div>
    <div className="table-note"><FileText size={16}/><span>Mail-first policy: Axis Recommended Stocks use today&apos;s Axis Research when NSE is open; on weekends/holidays they use the last trading day&apos;s mails (as-of {content.investment.axisTradingAsOfLabel ?? analysisWindowLabel(content)}). The {axisArchiveAudit.filesAttempted}-file archive audit is supplementary evidence only. PDF attachments are not parsed into calls. CMP prefers live Kite holding price, else Axis Mail CMP. Refreshed {content.asOf}.</span></div>
  </section>;
}

export type PortfolioActivityView = "holdings" | "orders" | "positions" | "gtts" | "tsls";

const INVESTMENT_SECTIONS = [
  { id: "i1", label: "Action Board" },
  { id: "i2", label: "Portfolio" },
  { id: "i3", label: "Risk" },
  { id: "i4", label: "Axis picks" },
] as const;

export type InvestmentWorkspaceProps = {
  snapshot: KiteSnapshot;
  content: ContentDigestSnapshot;
  view: PortfolioActivityView;
  setView: (view: PortfolioActivityView) => void;
  macroEventKey: MacroEventKey;
  setMacroEventKey: (key: MacroEventKey) => void;
  macroBandKey: MacroBandKey;
  setMacroBandKey: (key: MacroBandKey) => void;
  portfolioRisk: string;
  setPortfolioRisk: (symbol: string) => void;
  axisRisk: string;
  setAxisRisk: (symbol: string) => void;
  isLive: boolean;
  isPartial: boolean;
  isSnapshot: boolean;
  hasPortfolio: boolean;
  mailWindow: string;
  mailAxisRecommendations: MailRecommendation[];
  mailAxisProfiles: RiskProfile[];
  livePortfolioRiskProfiles: RiskProfile[];
  analystRows: Array<{ symbol: string; house: string; rating: string; target: number | null | undefined; date: string; thesis: string; mail: boolean }>;
  donutHoldings: KiteSnapshot["holdings"];
  exposureComposition: Array<{
    symbol: string;
    fullSymbol: string;
    total: number;
    event: string;
    kpis: string;
    oilWar?: number;
    fiiFlow?: number;
    valuation?: number;
    liquidity?: number;
    volatility?: number;
    leverage?: number;
    [key: string]: unknown;
  }>;
  currentBySymbol: Map<string, number>;
  onKiteRefresh: () => Promise<void>;
};

export function InvestmentWorkspace({
  snapshot,
  content,
  view,
  setView,
  macroEventKey,
  setMacroEventKey,
  macroBandKey,
  setMacroBandKey,
  portfolioRisk,
  setPortfolioRisk,
  axisRisk,
  setAxisRisk,
  isLive,
  isSnapshot,
  hasPortfolio,
  mailWindow,
  mailAxisRecommendations,
  mailAxisProfiles,
  livePortfolioRiskProfiles,
  analystRows,
  donutHoldings,
  exposureComposition,
  currentBySymbol,
  onKiteRefresh,
}: InvestmentWorkspaceProps) {
  const [activeSection, setActiveSection] = useState("i1");
  const [selectedHoldingSymbol, setSelectedHoldingSymbol] = useState<string | null>(null);
  const [engagedHoldingSymbol, setEngagedHoldingSymbol] = useState<string | null>(null);
  const [orderSelection, setOrderSelection] = useState<KiteOrderSelection>(null);
  const { holdings, portfolio, orders, gtts, marketCapAllocation, sectorAllocation, subSectorAllocation, classification } = snapshot;
  const positions = snapshot.positions ?? [];
  const entryGtts = gtts.filter((item) => (item.kind ?? "gtt") !== "tsl");
  const tsls = gtts.filter((item) => item.kind === "tsl");
  const unavailable = new Set(snapshot.unavailableSections ?? []);
  const portfolioMoney = (value: number) => hasPortfolio ? inr.format(value) : "—";
  const axisAsOfLabel = content.investment.axisTradingAsOfLabel
    ?? (content.investment.axisUsedLastTradingDay ? `${content.investment.axisTradingAsOf ?? "last trading day"} (last NSE trading day)` : analysisWindowLabel(content));
  const activityTabs: Array<{ key: PortfolioActivityView; label: string }> = [
    { key: "holdings", label: "Holdings" },
    { key: "orders", label: "Orders" },
    { key: "positions", label: "Positions" },
    { key: "gtts", label: "GTTs" },
    { key: "tsls", label: "TSLs" },
  ];
  const positiveValueHoldings = holdings.filter((holding) => holding.value > 0);
  const currentPortfolioValue = positiveValueHoldings.reduce((sum, holding) => sum + holding.value, 0);
  const portfolioMapData: PortfolioMapDatum[] = positiveValueHoldings
    .map((holding) => ({
      symbol: holding.symbol,
      name: holding.name,
      qty: holding.qty,
      avg: holding.avg,
      price: holding.price,
      value: holding.value,
      pnl: holding.pnl,
      pnlPct: holding.pnlPct,
      dayPnl: holding.dayPnl,
      dayPct: holding.dayPct,
      sector: holding.sector,
      subSector: holding.subSector,
      risk: holding.risk,
      weight: currentPortfolioValue > 0 ? holding.value / currentPortfolioValue * 100 : 0,
      displayColor: portfolioReturnColor(holding.pnlPct),
      returnTone: portfolioReturnTone(holding.pnlPct),
    }))
    .sort((left, right) => right.value - left.value);
  const portfolioMapRects = layoutPortfolioMap(portfolioMapData);
  const activeHoldingSymbol = engagedHoldingSymbol ?? selectedHoldingSymbol;
  const activeMapHolding = portfolioMapData.find((holding) => holding.symbol === activeHoldingSymbol) ?? null;
  const toggleHoldingSelection = (symbol: string) => setSelectedHoldingSymbol((current) => current === symbol ? null : symbol);
  const holdingBySymbol = new Map(holdings.map((holding) => [holding.symbol.toUpperCase(), holding]));
  const matchedAxisTargets = Array.from(new Map(mailAxisRecommendations
    .filter((recommendation) => recommendation.target && holdingBySymbol.has(recommendation.symbol.toUpperCase()))
    .map((recommendation) => [recommendation.symbol.toUpperCase(), recommendation])).values())
    .map((recommendation) => {
      const holding = holdingBySymbol.get(recommendation.symbol.toUpperCase())!;
      const upside = recommendation.target && holding.price > 0 ? (recommendation.target / holding.price - 1) * 100 : null;
      return { recommendation, holding, upside };
    })
    .filter((item) => item.upside !== null);
  const axisCoveredValue = matchedAxisTargets.reduce((sum, item) => sum + item.holding.value, 0);
  const axisCoveragePct = portfolio.value > 0 ? axisCoveredValue / portfolio.value * 100 : 0;
  const weightedAxisUpside = axisCoveredValue > 0
    ? matchedAxisTargets.reduce((sum, item) => sum + item.holding.value * (item.upside ?? 0), 0) / axisCoveredValue
    : null;
  const highRiskWeight = holdings.filter((holding) => holding.risk.toLowerCase().includes("high")).reduce((sum, holding) => sum + holding.weight, 0);
  const negativeWeight = holdings.filter((holding) => holding.pnl < 0).reduce((sum, holding) => sum + holding.weight, 0);
  const overviewTone = !hasPortfolio || portfolio.pnlPct < 0 || portfolio.dayPct < -1 ? "negative" : portfolio.pnlPct > 0 && portfolio.dayPct >= 0 ? "positive" : "neutral";
  const overviewHeadline = !hasPortfolio
    ? "Live portfolio required"
    : overviewTone === "negative"
      ? "Capital preservation takes priority"
      : overviewTone === "positive"
        ? "Constructive returns, concentration still binding"
        : "Mixed tape: hold quality and rebalance selectively";

  useEffect(() => {
    const sync = () => {
      const requested = new URLSearchParams(window.location.search).get("section");
      if (INVESTMENT_SECTIONS.some((section) => section.id === requested)) setActiveSection(requested!);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const selectSection = (section: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.delete("page");
    window.history.pushState({}, "", url);
    setActiveSection(section);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
    document.getElementById(`investment-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <div className="investment-workspace-shell">
      <WorkspaceSectionNav
        label="Investment sections"
        sections={INVESTMENT_SECTIONS}
        activeId={activeSection}
        onSelect={selectSection}
      />
      <div id="investment-i1" className="workspace-section action-board-workspace-section">
      <CollapsibleSection number="I-1" title="Investment action board" note="Clickable daily actions, numeric advantages and strategic rationale">
        <DailyKanbanBoard workspace="investment"/>
      </CollapsibleSection>
      </div>

      <div id="investment-i2" className="workspace-section">
      <CollapsibleSection number="I-2" title="Portfolio" note="Holdings, orders, positions, GTTs, TSLs and nested allocation">
      <section className="metrics-strip">
        <article><span>Portfolio value</span><b>{portfolioMoney(portfolio.value)}</b><small>{hasPortfolio ? `${holdings.length} open equity exposures${isSnapshot ? " · snapshot" : ""}` : "Live Kite data required"}</small></article>
        <article><span>Unrealised P&amp;L</span><b className={portfolio.pnl>=0?"positive":"negative"}>{hasPortfolio ? `${portfolio.pnl>=0?"+":""}${inr.format(portfolio.pnl)}` : "—"}</b><small>{hasPortfolio ? `${portfolio.pnlPct>=0?"+":""}${portfolio.pnlPct.toFixed(2)}% on invested cost${isSnapshot ? " · snapshot" : ""}` : "Kite portfolio unavailable"}</small></article>
        <article><span>Top-two concentration</span><b className="warning">{hasPortfolio ? `${portfolio.topTwo.toFixed(1)}%` : "—"}</b><small>{hasPortfolio ? holdings.slice(0,2).map(h=>h.name).join(" + ") : "Calculated from Kite positions"}</small></article>
        <article><span>Available equity margin</span><b>{isLive && !unavailable.has("margins") ? inr.format(portfolio.equityMargin) : isSnapshot ? inr.format(portfolio.equityMargin) : "n/a"}</b><small>{isSnapshot ? "Last validated margin snapshot" : unavailable.has("margins") ? "Kite margins temporarily unavailable" : "Live equity segment net margin"}</small></article>
      </section>

      <section className="portfolio-management" aria-labelledby="portfolio-management-title">
        <div className="portfolio-management-heading"><div><Sparkles size={20}/><span><b id="portfolio-management-title">Portfolio management</b><small>Live Kite baseline + explicit Axis targets + audited local research coverage</small></span></div><span className="pill blue">{axisAsOfLabel}</span></div>
        <div className="portfolio-management-grid">
          <article className={`portfolio-management-card portfolio-overview ${overviewTone}`}>
            <span>Portfolio overview</span><b>{overviewHeadline}</b>
            <p>{hasPortfolio ? `${portfolio.pnlPct >= 0 ? "+" : ""}${portfolio.pnlPct.toFixed(2)}% unrealised · ${portfolio.dayPct >= 0 ? "+" : ""}${portfolio.dayPct.toFixed(2)}% today · ${portfolio.topTwo.toFixed(1)}% in the two largest positions.` : "Authenticate Kite to calculate the current portfolio stance."}</p>
          </article>
          <article className="portfolio-management-card mitigation">
            <span><ShieldCheck size={15}/>Risk mitigation</span><b>{Math.max(highRiskWeight, negativeWeight).toFixed(1)}% priority exposure</b>
            <ul><li>Cap additions to the largest two holdings until concentration falls below 65%.</li><li>Stage high-risk purchases; use verified results and protective exits rather than headline reactions.</li></ul>
          </article>
          <article className="portfolio-management-card upside">
            <span><TrendingUp size={15}/>Axis-linked upside</span><b>{weightedAxisUpside === null ? "No matched target" : `${weightedAxisUpside >= 0 ? "+" : ""}${weightedAxisUpside.toFixed(1)}%`}</b>
            <p>{matchedAxisTargets.length} live holding{matchedAxisTargets.length === 1 ? "" : "s"} with explicit current Axis target · {axisCoveragePct.toFixed(1)}% portfolio coverage.</p>
            <small>{axisArchiveAudit.validPdfs} valid PDFs / {axisArchiveAudit.pagesRead.toLocaleString("en-IN")} pages audited. Archive-only documents are coverage evidence, not invented targets.</small>
          </article>
          <article className="portfolio-management-card alpha">
            <span><Target size={15}/>Actions to maximise α</span><b>Rebalance by evidence, not turnover</b>
            <ul><li>Direct new capital toward verified positive-upside calls outside the largest weights.</li><li>Re-underwrite negative-P&amp;L and high-risk positions after each reported KPI set.</li><li>Keep cash capacity for dislocations; review oil, INR and FII triggers before sizing.</li></ul>
          </article>
        </div>
        <div className="portfolio-management-sources"><span>Axis Research: {mailAxisRecommendations.length} current calls · {content.investment.latestAxisAt}</span><span>Newsletters: {content.sources.newsletters.displayedCount ?? content.newsletters.length} items · {content.investment.latestNewsletterAt}</span></div>
      </section>

      <div className="portfolio-analysis-grid">
      <section className="panel chart-panel nested-chart-panel">
        <div className="panel-title"><div><h3>Nested portfolio allocation</h3><p>Outer: live Kite holdings and P&amp;L · upper-middle: sub-sector · lower-middle: industry · inner: AMFI market-cap tier</p></div><Gauge size={18}/></div>
        {hasPortfolio ? <><div className="nested-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{top:4,right:4,bottom:4,left:4}}>
              <Pie data={marketCapAllocation} dataKey="value" nameKey="name" innerRadius="18%" outerRadius="31%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="inner"/>}>{marketCapAllocation.map((item) => <Cell key={item.id ?? item.name} fill={item.color}/>)}</Pie>
              <Pie data={sectorAllocation} dataKey="value" nameKey="name" innerRadius="34%" outerRadius="50%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="industry"/>}>{sectorAllocation.map((item) => <Cell key={item.id ?? item.name} fill={item.color}/>)}</Pie>
              <Pie data={subSectorAllocation} dataKey="value" nameKey="name" innerRadius="53%" outerRadius="70%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="subsector"/>}>{subSectorAllocation.map((item) => <Cell key={item.id ?? item.name} fill={item.color}/>)}</Pie>
              <Pie data={donutHoldings} dataKey="value" nameKey="symbol" innerRadius="73%" outerRadius="96%" startAngle={90} endAngle={-270} paddingAngle={0} isAnimationActive={false} labelLine={false} label={(props) => <HoldingLabel {...props}/> }>
                {donutHoldings.map((h,index) => <Cell key={h.symbol} fill={holdingOuterFill(h.pnl, index)} fillOpacity={h.dayPnl >= 0 ? 1 : .52} stroke={h.dayPnl >= 0 ? "#ffffff" : "#9b2f36"} strokeWidth={h.dayPnl >= 0 ? 2 : 1.5}/>) }
              </Pie>
              <Tooltip formatter={(value,name) => [inr.format(Number(value)),String(name)]}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="nested-center"><b className={portfolio.pnl>=0?"positive":"negative"}>{portfolio.pnl>=0?"+":""}{inr.format(portfolio.pnl)}</b><span>Unrealised · {portfolio.pnlPct>=0?"+":""}{portfolio.pnlPct.toFixed(2)}%</span><strong className={portfolio.dayPnl>=0?"positive":"negative"}>{portfolio.dayPnl>=0?"+":""}{inr.format(portfolio.dayPnl)}</strong><span>Day · {portfolio.dayPct>=0?"+":""}{portfolio.dayPct.toFixed(2)}%</span></div>
        </div>
        <div className="ring-key"><span><i className="ring outer"/>Outer · holding weight + U/Day P&amp;L (green gain / red loss)</span><span><i className="ring subsector"/>Upper-middle · sub-sector</span><span><i className="ring industry"/>Lower-middle · industry</span><span><i className="ring inner"/>Inner · AMFI market-cap tier</span><span><i className="shade"/>Shaded outer segment = negative day P&amp;L</span></div><div className={"classification-audit " + (classification.pendingSymbols.length ? "pending" : "verified")}><CheckCircle2 size={14}/><span>{classification.pendingSymbols.length ? "Verification pending: " + classification.pendingSymbols.join(", ") : "Verified industry and sub-sector · " + classification.industrySource + " · " + classification.marketCapSource + " · as of " + classification.asOf}{!classification.pendingSymbols.length && <> · <a href={classification.industryUrl} target="_blank" rel="noreferrer">NSE</a> · <a href={classification.marketCapUrl} target="_blank" rel="noreferrer">AMFI</a></>}{holdings.some((holding) => holding.symbol === "ADANIGREEN") && <small>ADANIGREEN · Power Generation · Renewable Power · Large Cap</small>}{holdings.some((holding) => holding.symbol === "LTF") && <small>LTF · Non Banking Financial Company · Diversified Retail NBFC · Mid Cap</small>}</span></div></> : <div className="live-empty"><Activity size={24}/><b>Live allocation is unavailable</b><p>{snapshot.message}</p>{snapshot.authUrl && <a href={snapshot.authUrl} target="_blank" rel="noreferrer">Authenticate Kite <ExternalLink size={14}/></a>}</div>}
      </section>

      <div className="portfolio-analysis-stack">
      <section className="panel holdings-panel portfolio-activity-panel">
        <div className="panel-title"><div><h3>Portfolio activity</h3></div>
          <div className="segmented portfolio-activity-tabs">{activityTabs.map((tab) => <button key={tab.key} type="button" onClick={() => setView(tab.key)} className={view === tab.key ? "active" : ""}>{tab.label}</button>)}</div>
        </div>
        {view === "holdings" && (holdings.length
          ? <><div className="portfolio-activity-table">
              <table className="positions-table portfolio-activity-matrix">
                <colgroup><col className="metric-col"/>{holdings.map((holding) => <col className="holding-data-col" key={holding.symbol}/>)}</colgroup>
                <thead><tr><th scope="col">Metric</th>{holdings.map((holding) => <th scope="col" key={holding.symbol} title={holding.name} data-symbol={holding.symbol} className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined}><span className="holding-ticker-actions"><b>{holding.symbol}</b><span><button type="button" className="buy" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "BUY" })} title={isLive ? `Open BUY order ticket for ${holding.symbol}` : "Live Kite authentication is required"}>BUY</button><button type="button" className="sell" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "SELL" })} title={isLive ? `Open SELL order ticket for ${holding.symbol}` : "Live Kite authentication is required"}>SELL</button></span></span></th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">Qty</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{holding.qty}</td>)}</tr>
                  <tr><th scope="row">Avg</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{inr.format(holding.avg)}</td>)}</tr>
                  <tr><th scope="row">Last</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{inr.format(holding.price)}</td>)}</tr>
                  <tr><th scope="row">Value</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{inr.format(holding.value)}</td>)}</tr>
                  <tr><th scope="row">Unrealised</th>{holdings.map((holding) => <td className={`${holding.pnl >= 0 ? "positive" : "negative"}${activeHoldingSymbol === holding.symbol ? " holding-column-active" : ""}`} key={holding.symbol}><b>{holding.pnl >= 0 ? "+" : ""}{inr.format(holding.pnl)}</b><small>{holding.pnlPct >= 0 ? "+" : ""}{holding.pnlPct.toFixed(2)}%</small></td>)}</tr>
                  <tr><th scope="row">Day P&amp;L</th>{holdings.map((holding) => <td className={`${holding.dayPnl >= 0 ? "positive" : "negative"}${activeHoldingSymbol === holding.symbol ? " holding-column-active" : ""}`} key={holding.symbol}><b>{holding.dayPnl >= 0 ? "+" : ""}{inr.format(holding.dayPnl)}</b><small>{holding.dayPct >= 0 ? "+" : ""}{holding.dayPct.toFixed(2)}%</small></td>)}</tr>
                  <tr><th scope="row">Weight</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}><b className="compact-weight" style={{color:holding.color}}>{holding.weight.toFixed(1)}%</b></td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="portfolio-activity-mobile" aria-label="Portfolio activity holdings">
              {holdings.map((holding) => <article key={holding.symbol} className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined}>
                <header><b>{holding.symbol}</b><span className="holding-mobile-order-actions"><button type="button" className="buy" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "BUY" })}>BUY</button><button type="button" className="sell" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "SELL" })}>SELL</button></span><strong>{holding.weight.toFixed(1)}%</strong></header>
                <dl>
                  <div><dt>Qty</dt><dd>{holding.qty}</dd></div>
                  <div><dt>Avg</dt><dd>{inr.format(holding.avg)}</dd></div>
                  <div><dt>Last</dt><dd>{inr.format(holding.price)}</dd></div>
                  <div><dt>Value</dt><dd>{inr.format(holding.value)}</dd></div>
                  <div><dt>Unrealised</dt><dd className={holding.pnl >= 0 ? "positive" : "negative"}>{holding.pnl >= 0 ? "+" : ""}{inr.format(holding.pnl)} <small>{holding.pnlPct >= 0 ? "+" : ""}{holding.pnlPct.toFixed(2)}%</small></dd></div>
                  <div><dt>Day P&amp;L</dt><dd className={holding.dayPnl >= 0 ? "positive" : "negative"}>{holding.dayPnl >= 0 ? "+" : ""}{inr.format(holding.dayPnl)} <small>{holding.dayPct >= 0 ? "+" : ""}{holding.dayPct.toFixed(2)}%</small></dd></div>
                </dl>
              </article>)}
            </div></>
          : <div className="table-empty">No static positions are shown. Connect Kite to load the live portfolio.</div>)}
        {view === "orders" && <div className="activity-single">{orders.map(o=><div className="activity-row" key={o.id}><div><b>{o.symbol}</b><small>{o.side} {o.qty} · {o.type}</small></div><strong>{inr.format(o.price)}</strong><span className={`pill ${o.status.toLowerCase()==="complete"?"green":"amber"}`}>{o.status}</span></div>)}{!orders.length&&<div className="table-empty">{unavailable.has("orders") ? "Kite orders are temporarily unavailable." : "No live orders."}</div>}</div>}
        {view === "positions" && <div className="activity-single">{positions.map(p=><div className="activity-row" key={p.id}><div><b>{p.symbol}</b><small>{p.side} {p.qty} · {p.product}</small></div><strong className={p.pnl>=0?"positive":"negative"}>{p.pnl>=0?"+":""}{inr.format(p.pnl)}</strong><span className="pill blue">{inr.format(p.price)}</span></div>)}{!positions.length&&<div className="table-empty">{unavailable.has("positions") ? "Kite positions are temporarily unavailable." : "No open day/net positions beyond the holdings book."}</div>}</div>}
        {view === "gtts" && <div className="activity-single">{entryGtts.map(g=><div className="activity-row" key={g.id}><div><b>{g.symbol}</b><small>{g.side} {g.qty} · trigger {inr.format(g.trigger)}</small></div><strong>{inr.format(g.limit)}</strong><span className={`pill ${g.status.toLowerCase()==="active"?"amber":"green"}`}>{g.status}</span></div>)}{!entryGtts.length&&<div className="table-empty">{unavailable.has("GTTs") ? "Kite GTTs are temporarily unavailable." : "No active entry GTTs."}</div>}</div>}
        {view === "tsls" && <div className="activity-single">{tsls.map(g=><div className="activity-row" key={g.id}><div><b>{g.symbol}</b><small>{g.side} {g.qty} · stop {inr.format(g.trigger)}</small></div><strong>{inr.format(g.limit)}</strong><span className={`pill ${g.status.toLowerCase()==="active"?"amber":"green"}`}>{g.status}</span></div>)}{!tsls.length&&<div className="table-empty">{unavailable.has("GTTs") ? "Kite GTTs/TSLs are temporarily unavailable." : "No protective TSL / stop-loss GTTs."}</div>}</div>}
      </section>

      <section className="panel portfolio-map-panel" aria-labelledby="portfolio-map-title">
        <div className="portfolio-map-heading">
          <div><h3 id="portfolio-map-title">Portfolio concentration map</h3><p>Live Kite holdings · market-value area</p></div>
          <div className="portfolio-map-legend" aria-label="Concentration map legend"><span>Tile size = portfolio weight</span><span>Color = unrealised return</span></div>
        </div>
        {portfolioMapRects.length ? <div className="portfolio-map" role="group" aria-label="Interactive portfolio concentration treemap">
          {portfolioMapRects.map((holding) => {
            const selected = selectedHoldingSymbol === holding.symbol;
            const dimmed = selectedHoldingSymbol !== null && !selected;
            const showSecondary = holding.width >= 24 && holding.height >= 32;
            return <button
              type="button"
              key={holding.symbol}
              className={`portfolio-map-tile ${holding.returnTone}${selected ? " selected" : ""}${dimmed ? " dimmed" : ""}`}
              style={{ left: `${holding.x}%`, top: `${holding.y}%`, width: `${holding.width}%`, height: `${holding.height}%`, "--portfolio-map-color": holding.displayColor } as CSSProperties}
              aria-pressed={selected}
              aria-label={portfolioMapTooltip(holding).replaceAll("\n", ". ")}
              title={portfolioMapTooltip(holding)}
              onMouseEnter={() => setEngagedHoldingSymbol(holding.symbol)}
              onMouseLeave={() => setEngagedHoldingSymbol(null)}
              onFocus={() => setEngagedHoldingSymbol(holding.symbol)}
              onBlur={() => setEngagedHoldingSymbol(null)}
              onClick={() => toggleHoldingSelection(holding.symbol)}
            >
              <span className="portfolio-map-primary"><b>{holding.symbol}</b><strong>{holding.weight.toFixed(1)}%</strong><em>{inr.format(holding.value)}</em></span>
              {showSecondary && <span className="portfolio-map-secondary"><span>U {holding.pnl >= 0 ? "+" : ""}{inr.format(holding.pnl)}</span><span>Day {holding.dayPnl >= 0 ? "+" : ""}{inr.format(holding.dayPnl)}</span></span>}
            </button>;
          })}
          {activeMapHolding && <aside className="portfolio-map-tooltip" role="status">
            <b>{activeMapHolding.name} · {activeMapHolding.symbol}</b>
            <span>Qty {activeMapHolding.qty} · Avg {inr.format(activeMapHolding.avg)} · Last {inr.format(activeMapHolding.price)}</span>
            <span>Value {inr.format(activeMapHolding.value)} · Weight {activeMapHolding.weight.toFixed(2)}%</span>
            <span>Unrealised {activeMapHolding.pnl >= 0 ? "+" : ""}{inr.format(activeMapHolding.pnl)} ({activeMapHolding.pnlPct >= 0 ? "+" : ""}{activeMapHolding.pnlPct.toFixed(2)}%) · Day {activeMapHolding.dayPnl >= 0 ? "+" : ""}{inr.format(activeMapHolding.dayPnl)}</span>
            <span>{activeMapHolding.sector} · {activeMapHolding.subSector} · Risk {activeMapHolding.risk}</span>
          </aside>}
        </div> : <div className="live-empty compact"><Activity size={22}/><b>Concentration map unavailable</b><p>Connect Kite to load current holding values.</p></div>}
      </section>
      </div>
      {orderSelection && <KiteOrderTicket key={`${orderSelection.side}-${orderSelection.holding.symbol}`} selection={orderSelection} onClose={() => setOrderSelection(null)} onSubmitted={onKiteRefresh}/>} 
      </div>
      </CollapsibleSection>
      </div>

      <div id="investment-i3" className="workspace-section">
      <CollapsibleSection number="I-3" title="Risk" note="Risk composition, holdings radar and macro scenario lab">
        <section className="panel macro-scenario-panel" aria-label="Macro scenario lab">
          <div className="panel-title"><div><h3>Macro scenario lab</h3><p>Select an event, its decision range and the matching Mail evidence</p></div><Globe2 size={18}/></div>
          <MacroScenarioBoard eventKey={macroEventKey} bandKey={macroBandKey} onEventChange={(key) => { setMacroEventKey(key); setMacroBandKey("base"); }} onBandChange={setMacroBandKey} content={content}/>
        </section>

        <div className="dashboard-grid investment-risk-grid">
          <section className="panel chart-panel exposure-composition-panel">
            <div className="panel-title"><div><h3>Risk composition</h3><p>Equal-weighted event and KPI drivers · each segment shows its share of the total</p></div><ShieldAlert size={18}/></div>
            {hasPortfolio ? <>
              <div className="exposure-group-key"><span><i className="event"/>EVENTS · oil, geopolitics and flows</span><span><i className="kpi"/>KPIs · valuation, liquidity, volatility and leverage</span></div>
              <div className="exposure-factor-key">{exposureFactors.map((factor) => <span key={factor.key}><i style={{background:factor.color}}/><b>{factor.label}</b><small>{factor.group}</small></span>)}</div>
              <ResponsiveContainer width="100%" height={286}>
                <BarChart data={exposureComposition} layout="vertical" margin={{top:8,right:52,bottom:6,left:2}} barCategoryGap="27%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                  <XAxis type="number" domain={[0,5]} ticks={[0,1,2,3,4,5]} tick={{fontSize:10}} label={{value:"COMPOSITE MONITORING INDEX",position:"insideBottom",offset:-3,fill:"#8d97a1",fontSize:10}}/>
                  <YAxis dataKey="symbol" type="category" width={58} tick={{fontSize:10,fontWeight:800}}/>
                  <Tooltip formatter={(value,name) => [`${(Number(value) * exposureFactors.length).toFixed(1)} / 5 raw · ${Number(value).toFixed(2)} points`, String(name)]} labelFormatter={(label) => `${label} · equal-weighted composition`}/>
                  {exposureFactors.map((factor,index) => <Bar key={factor.key} dataKey={factor.key} name={factor.label} stackId="exposure" fill={factor.color} radius={index === exposureFactors.length - 1 ? [0,3,3,0] : 0} isAnimationActive={false}>
                    {index === exposureFactors.length - 1 && <LabelList dataKey="total" position="right" className="exposure-total-label" formatter={(value) => `${Number(value).toFixed(1)}/5`}/>}
                  </Bar>)}
                </BarChart>
              </ResponsiveContainer>
              <div className="exposure-driver-map"><div className="exposure-driver-head"><span>Holding</span><span>Event transmission</span><span>KPI watch</span></div>{exposureComposition.map(item => <div className="exposure-driver-row" key={item.fullSymbol}><b>{item.symbol}<small>{item.total.toFixed(1)}/5 composite</small></b><span>{item.event}</span><span>{item.kpis}</span></div>)}</div>
              <p className="exposure-method">Method: six 1-5 monitoring inputs contribute equally. Segment width = raw score ÷ 6; the full bar = their average. This is a prioritisation aid, not probability of loss.</p>
            </> : <div className="live-empty compact"><ShieldAlert size={24}/><b>Risk composition waits for live positions</b><p>No stored price snapshot is displayed.</p></div>}
          </section>
          <article className="panel risk-panel"><div className="panel-title"><div><h3>Portfolio / holdings risk</h3><p>{livePortfolioRiskProfiles.length} current Kite holdings · selectable against live-portfolio average</p></div><ScanSearch size={18}/></div><RiskRadar profiles={livePortfolioRiskProfiles} selected={portfolioRisk} onSelect={setPortfolioRisk} averageLabel="Current portfolio average" idPrefix="portfolio-holdings-risk" explainSelected emptyLabel="No live holding risk profiles" /></article>
        </div>
      </CollapsibleSection>
      </div>

      <div id="investment-i4" className="workspace-section">
      <CollapsibleSection number="I-4" title="Axis picks" note={`Call matrix · Axis recommended stocks · recommended risk radar · as-of ${axisAsOfLabel}${content.investment.axisUsedLastTradingDay ? " · weekend/holiday fallback" : ""}`}>
        <section className="panel analyst-matrix">
          <div className="panel-title"><div><h3>Analyst call matrix</h3><p>Targets are reference points, not quarter forecasts</p></div><Target size={18}/></div>
          <div className="table-scroll">
            <table className="analyst-table">
              <thead><tr><th>Stock</th><th>Source / house</th><th>Call</th><th>Target</th><th>Implied vs live</th><th>Published</th><th>What matters</th></tr></thead>
              <tbody>{analystRows.map((a) => {
                const current = currentBySymbol.get(a.symbol);
                const implied = current && a.target ? (a.target / current - 1) * 100 : null;
                const bullets = thesisBullets(a.thesis, { symbol: a.symbol, call: a.rating, limit: 4 });
                return <tr key={`${a.symbol}-${a.house}`}>
                  <td data-label="Stock"><b>{a.symbol}</b>{a.mail && <small className="mail-row-label">WINDOW MAIL</small>}</td>
                  <td data-label="Source / house">{a.house}</td>
                  <td data-label="Call"><span className="pill blue">{a.rating}</span></td>
                  <td data-label="Target">{a.target ? inr.format(a.target) : "—"}</td>
                  <td data-label="Implied vs live" className={implied === null ? "" : implied >= 0 ? "positive" : "negative"}>{implied === null ? "—" : `${implied >= 0 ? "+" : ""}${implied.toFixed(1)}%`}</td>
                  <td data-label="Published">{a.date}</td>
                  <td data-label="What matters"><ThesisBulletList bullets={bullets} className="thesis-bullet-list" /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="table-note"><Target size={16}/><span>Axis Mail calls as-of {axisAsOfLabel} are prioritised and deduplicated by symbol. Other houses remain explicitly labelled supplementary references. Implied upside uses each live Kite last price.</span></div>
        </section>
        <AxisRecommendationWorkbench recommendations={mailAxisRecommendations} content={content} currentBySymbol={currentBySymbol}/>
        <article className="panel risk-panel"><div className="panel-title"><div><h3>Recommended risk radar</h3><p>{axisAsOfLabel} · {mailAxisProfiles.length} deduplicated Axis calls from iCloud → Axis Research</p></div><Target size={18}/></div><RiskRadar profiles={mailAxisProfiles} selected={axisRisk} onSelect={setAxisRisk} averageLabel="Axis list average" idPrefix="axis-recommended-risk" emptyLabel={`No Axis risk profiles for ${mailWindow}`} /></article>
      </CollapsibleSection>
      </div>
  </div>;
}
