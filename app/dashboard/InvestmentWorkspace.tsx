"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, CheckCircle2, ChevronDown, Database, ExternalLink, FileText, Gauge, Globe2, Mail, ScanSearch, ShieldAlert, ShieldCheck, Sparkles, Target, TrendingUp, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analystCallTone, groupAnalystRows, type AnalystGroupMode } from "../analyst-matrix-groups";
import { fiiDiiFlowsSnapshot, fiveDayDiiNetCr, fiveDayFiiNetCr, flowCompositionSlices, formatFlowCr, formatFlowDeltaCr } from "../fii-dii-flows";
import { axisArchiveAudit, riskAxes, type RiskProfile } from "../portfolio-data";
import { axisImpliedUpsidePct, resolveAxisCmp } from "../axis-pick-metrics";
import type { ContentDigestSnapshot, MailRecommendation } from "../content-types";
import type { KiteSnapshot, LiveHolding } from "../live-types";
import { portfolioReturnTone } from "../portfolio-concentration.mjs";
import { scenarioEvidenceItems, scenarioEvidenceSentence } from "../macro-scenario-evidence";
import { buildRiskExplanation } from "../risk-explanations";
import { thesisBullets, type ThesisBullet } from "../thesis-bullets";
import type { MacroBandKey, MacroEventKey } from "./types";
import { AllocationLabel, CollapsibleSection, DailyKanbanBoard, HoldingLabel, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import { KiteAlertTicket, type KiteAlertSelection } from "./KiteAlertTicket";
import { KiteGttTicket, type KiteGttSelection } from "./KiteGttTicket";
import { KiteOrderTicket, type KiteOrderSelection } from "./KiteOrderTicket";
import { InstrumentGauge } from "./visual-components";
import { analysisWindowLabel, exposureFactors, holdingOuterFill, inr, macroEvents } from "./utils";

type PortfolioMapDatum = Pick<LiveHolding, "symbol" | "name" | "qty" | "avg" | "price" | "value" | "pnl" | "pnlPct" | "dayPnl" | "dayPct" | "sector" | "subSector" | "risk"> & {
  weight: number;
  displayColor: string;
  returnTone: "gain" | "flat" | "loss";
};

type PortfolioMapRect = PortfolioMapDatum & { x: number; y: number; width: number; height: number };

type RiskEvidenceContext = {
  holdings: LiveHolding[];
  asOf: string;
  classification: KiteSnapshot["classification"];
};

type MacroEvidenceOutcome = "positive" | "neutral" | "negative";

type MacroEvidenceSummary = {
  text: string;
  outcome: MacroEvidenceOutcome;
  source: string;
};

function portfolioReturnColor(returnPct: number): string {
  const tone = portfolioReturnTone(returnPct);
  return tone === "gain" ? "#137a43" : tone === "loss" ? "#a92f39" : "#9a6b12";
}

function layoutPortfolioMap(data: PortfolioMapDatum[]): PortfolioMapRect[] {
  if (!data.length) return [];

  // The rendered map is consistently wider than tall. Packing against that
  // physical aspect ratio prevents the smallest holdings becoming unreadably
  // narrow while preserving exact market-value area.
  const frameWidth = 1.46;
  const frameHeight = 1;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const remaining = data.map((item) => ({ item, area: total > 0 ? item.value / total * frameWidth * frameHeight : 0 }));
  const rects: Array<PortfolioMapDatum & { x: number; y: number; width: number; height: number }> = [];

  function worstAspect(row: typeof remaining, shortSide: number) {
    if (!row.length || shortSide <= 0) return Number.POSITIVE_INFINITY;
    const sum = row.reduce((value, entry) => value + entry.area, 0);
    const largest = Math.max(...row.map((entry) => entry.area));
    const smallest = Math.min(...row.map((entry) => entry.area));
    if (sum <= 0 || smallest <= 0) return Number.POSITIVE_INFINITY;
    const sideSquared = shortSide * shortSide;
    return Math.max(sideSquared * largest / (sum * sum), (sum * sum) / (sideSquared * smallest));
  }

  function placeRow(row: typeof remaining, frame: { x: number; y: number; width: number; height: number }) {
    const area = row.reduce((sum, entry) => sum + entry.area, 0);
    if (frame.width >= frame.height) {
      const columnWidth = frame.height > 0 ? area / frame.height : 0;
      let offsetY = frame.y;
      for (const entry of row) {
        const tileHeight = columnWidth > 0 ? entry.area / columnWidth : 0;
        rects.push({ ...entry.item, x: frame.x, y: offsetY, width: columnWidth, height: tileHeight });
        offsetY += tileHeight;
      }
      return { x: frame.x + columnWidth, y: frame.y, width: Math.max(0, frame.width - columnWidth), height: frame.height };
    }
    const rowHeight = frame.width > 0 ? area / frame.width : 0;
    let offsetX = frame.x;
    for (const entry of row) {
      const tileWidth = rowHeight > 0 ? entry.area / rowHeight : 0;
      rects.push({ ...entry.item, x: offsetX, y: frame.y, width: tileWidth, height: rowHeight });
      offsetX += tileWidth;
    }
    return { x: frame.x, y: frame.y + rowHeight, width: frame.width, height: Math.max(0, frame.height - rowHeight) };
  }

  let frame = { x: 0, y: 0, width: frameWidth, height: frameHeight };
  let row: typeof remaining = [];
  while (remaining.length) {
    const candidate = remaining[0];
    const shortSide = Math.min(frame.width, frame.height);
    if (!row.length || worstAspect([...row, candidate], shortSide) <= worstAspect(row, shortSide)) {
      row.push(remaining.shift()!);
    } else {
      frame = placeRow(row, frame);
      row = [];
    }
  }
  if (row.length) placeRow(row, frame);

  return rects.map((rect) => ({
    ...rect,
    x: rect.x / frameWidth * 100,
    y: rect.y / frameHeight * 100,
    width: rect.width / frameWidth * 100,
    height: rect.height / frameHeight * 100,
  }));
}

function portfolioMapTooltip(holding: PortfolioMapDatum): string {
  return `${holding.name} (${holding.symbol})\nQuantity: ${holding.qty}\nAverage price: ${inr.format(holding.avg)}\nLast price: ${inr.format(holding.price)}\nValue: ${inr.format(holding.value)}\nUnrealised P&L: ${holding.pnl >= 0 ? "+" : ""}${inr.format(holding.pnl)} (${holding.pnlPct >= 0 ? "+" : ""}${holding.pnlPct.toFixed(2)}%)\nDay P&L: ${holding.dayPnl >= 0 ? "+" : ""}${inr.format(holding.dayPnl)} (${holding.dayPct >= 0 ? "+" : ""}${holding.dayPct.toFixed(2)}%)\nIndustry: ${holding.sector}\nSubsector: ${holding.subSector}\nRisk: ${holding.risk}`;
}

function ThesisBulletList({ bullets, className = "thesis-bullet-list" }: { bullets: ThesisBullet[]; className?: string }) {
  if (!bullets.length) return <span className="thesis-empty">No scoped thesis in readable Mail content</span>;
  return <ul className={className}>{bullets.map((bullet) => <li key={`${bullet.marker}-${bullet.text}`} className={bullet.tone}><span aria-hidden="true">{bullet.marker}</span><span>{bullet.text}</span></li>)}</ul>;
}

function macroEvidenceOutcome(item: Pick<ContentDigestSnapshot["investment"]["macroEvidence"][number]["items"][number], "sentiment">, text: string): MacroEvidenceOutcome {
  if (item.sentiment === "Positive") return "positive";
  if (item.sentiment === "Negative") return "negative";
  if (item.sentiment === "Neutral") return "neutral";
  const inferred = thesisBullets(text, { limit: 1 })[0]?.tone;
  return inferred === "positive" ? "positive" : inferred === "negative" ? "negative" : "neutral";
}

function buildMacroEvidenceSummaries(
  items: ContentDigestSnapshot["investment"]["macroEvidence"][number]["items"],
  eventKey: MacroEventKey,
  bandKey: MacroBandKey,
  limit = 5,
): MacroEvidenceSummary[] {
  const summaries: MacroEvidenceSummary[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const text = scenarioEvidenceSentence(item, eventKey, bandKey);
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!text || text.length < 18 || seen.has(key)) continue;
    seen.add(key);
    summaries.push({ text, outcome: macroEvidenceOutcome(item, `${item.title}. ${text}`), source: item.source });
    if (summaries.length >= limit) break;
  }
  return summaries;
}

function AiEvidenceSummaries({ summaries }: { summaries: MacroEvidenceSummary[] }) {
  return <section className="macro-ai-evidence" aria-labelledby="macro-ai-evidence-title">
    <header><Sparkles size={14}/><div><b id="macro-ai-evidence-title">AI-generated evidence summaries</b><span>Source-derived · outcome classified</span></div></header>
    {summaries.length ? <ul>{summaries.map((summary) => <li key={`${summary.source}-${summary.text}`} className={`outcome-${summary.outcome}`} aria-label={`${summary.outcome} outcome`}>
      <span className="macro-ai-bullet" aria-hidden="true">•</span>
      <div><small>{summary.outcome} outcome · {summary.source}</small><p>{summary.text}</p></div>
    </li>)}</ul> : <p className="macro-ai-empty">No source-derived summary is available for this event window.</p>}
  </section>;
}

function riskScoreBand(score: number): "green" | "amber" | "red" {
  if (score <= 2) return "green";
  if (score <= 3) return "amber";
  return "red";
}

function riskScoreColor(score: number): string {
  const band = riskScoreBand(score);
  if (band === "green") return "#42c878";
  if (band === "amber") return "#e6a11a";
  return "#ff6b72";
}

function RiskRadar({ profiles, selected, onSelect, averageLabel, idPrefix, explainSelected = false, evidenceContext, emptyLabel = "No current risk profiles" }: { profiles: RiskProfile[]; selected: string; onSelect: (symbol: string) => void; averageLabel: string; idPrefix: string; explainSelected?: boolean; evidenceContext?: RiskEvidenceContext; emptyLabel?: string }) {
  if (!profiles.length) return <div className="live-empty compact"><Mail size={22}/><b>{emptyLabel}</b><p>The refreshed source set did not produce a verified profile for the selected analysis window.</p></div>;
  const profile = profiles.find((item) => item.symbol === selected) ?? profiles[0];
  const explanation = explainSelected ? buildRiskExplanation(profile, riskAxes) : null;
  const evidenceHolding = evidenceContext?.holdings.find((holding) => holding.symbol === profile.symbol);
  const data = riskAxes.map((axis, index) => ({
    axis,
    score: profile.scores[index],
    average: Number((profiles.reduce((sum, item) => sum + item.scores[index], 0) / profiles.length).toFixed(1)),
    tone: riskScoreBand(profile.scores[index]),
    toneColor: riskScoreColor(profile.scores[index]),
  }));
  const meanScore = Number((profile.scores.reduce((sum, score) => sum + score, 0) / profile.scores.length).toFixed(1));
  const seriesColor = riskScoreColor(meanScore);
  const tabPanelId = `${idPrefix}-panel`;
  const chartHeight = explainSelected ? 480 : 620;
  const selectorLabel = (item: RiskProfile) => explainSelected ? (item.name || item.symbol) : item.symbol;
  const renderAxisTick = (props: { x?: number; y?: number; payload?: { value?: string }; textAnchor?: string }) => {
    const label = String(props.payload?.value ?? "");
    const point = data.find((item) => item.axis === label);
    const fill = point?.toneColor ?? "var(--chart-label)";
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    return <text x={x} y={y} dy={4} textAnchor={props.textAnchor ?? "middle"} fill={fill} fontSize={12} fontWeight={800}>{label}</text>;
  };
  const renderScoreDot = (props: { cx?: number; cy?: number; payload?: { score?: number; toneColor?: string } }) => {
    const cx = Number(props.cx ?? 0);
    const cy = Number(props.cy ?? 0);
    const fill = props.payload?.toneColor ?? riskScoreColor(Number(props.payload?.score ?? 0));
    return <circle cx={cx} cy={cy} r={5.5} fill={fill} stroke="#0a0a0a" strokeWidth={1.5} />;
  };

  const selector = <div className={`risk-selector${explainSelected ? " risk-selector-names" : ""}`} role="tablist" aria-label="Select risk profile">{profiles.map((item) => <button type="button" role="tab" id={`${idPrefix}-tab-${item.symbol}`} aria-controls={tabPanelId} aria-selected={item.symbol === profile.symbol} key={item.symbol} onClick={() => onSelect(item.symbol)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(item.symbol); } }} className={item.symbol === profile.symbol ? "active" : ""} aria-label={`${item.name} (${item.symbol})`} title={`${item.name} (${item.symbol})`}>{selectorLabel(item)}</button>)}</div>;
  const chartPanel = <div className="risk-radar-chart-col" role="tabpanel" id={tabPanelId} aria-labelledby={`${idPrefix}-tab-${profile.symbol}`}>
      <div className="risk-chart"><ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart data={data} outerRadius={explainSelected ? "78%" : "88%"} margin={explainSelected ? { top: 16, right: 36, bottom: 12, left: 36 } : { top: 4, right: 18, bottom: 4, left: 18 }}>
          <PolarGrid stroke="#3b444e" />
          <PolarAngleAxis dataKey="axis" tick={renderAxisTick} />
          <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fill: "var(--chart-tick)", fontSize: 10 }} />
          <Radar name={averageLabel} dataKey="average" stroke="#8f98a2" fill="#8f98a2" fillOpacity={0.06} strokeDasharray="5 4" isAnimationActive={false} dot={false} />
          <Radar name={profile.name} dataKey="score" stroke={seriesColor} fill={seriesColor} fillOpacity={0.22} strokeWidth={2.75} isAnimationActive={false} dot={renderScoreDot} />
          {!explainSelected && <Legend />}
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 5`, "Risk score"]} />
        </RadarChart>
      </ResponsiveContainer></div>
      {explainSelected && <div className="risk-series-key" aria-label="Radar series"><span><i style={{background:seriesColor}}/>{profile.name}</span><span><i className="average"/>{averageLabel}</span></div>}
      <div className="risk-scale"><span><i className="dot green"/>1-2 lower</span><span><i className="dot amber"/>3 moderate</span><span><i className="dot red"/>4-5 elevated</span><em>Qualitative monitoring score, not a probability of loss or investment recommendation.</em></div>
    </div>;
  const explanationPanel = explanation && <aside className="risk-explanation" aria-live="polite" aria-labelledby={`${idPrefix}-explanation-title`}>
        <header><span>Selected holding</span><h4 id={`${idPrefix}-explanation-title`}>{explanation.profileLabel}</h4></header>
        <section><h5>Overview</h5><ul className="risk-overview-list">{explanation.overview.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></section>
        <section><h5>Axis explanations</h5><ul className="risk-axis-list">{explanation.axes.map((item) => <li key={item.axis} data-band={item.band}><b>{item.axis}</b><span>{item.score}/5 · {item.band}</span><p>{item.text.slice(item.text.indexOf(":") + 2)}</p></li>)}</ul></section>
        <section className="risk-evidence"><h5>Evidence</h5>{evidenceHolding && evidenceContext ? <dl>
          <div><dt>Live exposure</dt><dd>{inr.format(evidenceHolding.value)} · {evidenceHolding.weight.toFixed(2)}% weight</dd></div>
          <div><dt>Position</dt><dd>{evidenceHolding.qty} @ {inr.format(evidenceHolding.avg)} · last {inr.format(evidenceHolding.price)}</dd></div>
          <div><dt>Unrealised P&amp;L</dt><dd className={evidenceHolding.pnl >= 0 ? "positive" : "negative"}>{evidenceHolding.pnl >= 0 ? "+" : ""}{inr.format(evidenceHolding.pnl)} · {evidenceHolding.pnlPct >= 0 ? "+" : ""}{evidenceHolding.pnlPct.toFixed(2)}%</dd></div>
          <div><dt>Day P&amp;L</dt><dd className={evidenceHolding.dayPnl >= 0 ? "positive" : "negative"}>{evidenceHolding.dayPnl >= 0 ? "+" : ""}{inr.format(evidenceHolding.dayPnl)} · {evidenceHolding.dayPct >= 0 ? "+" : ""}{evidenceHolding.dayPct.toFixed(2)}%</dd></div>
          <div><dt>Classification</dt><dd>{evidenceHolding.sector} · {evidenceHolding.subSector} · {evidenceHolding.marketCap} · {evidenceHolding.risk} risk</dd></div>
          <div><dt>Sources</dt><dd>Kite {evidenceContext.asOf} · <a href={evidenceContext.classification.industryUrl} target="_blank" rel="noreferrer">{evidenceContext.classification.industrySource}</a> + <a href={evidenceContext.classification.marketCapUrl} target="_blank" rel="noreferrer">{evidenceContext.classification.marketCapSource}</a> ({evidenceContext.classification.asOf})</dd></div>
        </dl> : <p>Live holding evidence is unavailable for this profile.</p>}</section>
      </aside>;

  return explainSelected
    ? <div className="risk-radar-layout risk-radar-workbench holdings-risk-stack">{selector}{chartPanel}{explanationPanel}</div>
    : <div className="risk-radar-layout axis-risk-stack">{selector}{chartPanel}</div>;
}

function FlowsRegimePanel({ bandTone, range, evidence, sectors, trigger, summaries }: { bandTone: string; range: string; evidence: string; sectors: string; trigger: string; summaries: MacroEvidenceSummary[] }) {
  const snapshot = fiiDiiFlowsSnapshot;
  const fiveDayFii = fiveDayFiiNetCr(snapshot);
  const fiveDayDii = fiveDayDiiNetCr(snapshot);
  const slices = flowCompositionSlices(snapshot);
  const deltaTone = fiveDayFii > 5000 ? "positive" : fiveDayFii < -5000 ? "negative" : "neutral";

  return <article className={`macro-regime-card flows-regime-panel tide-clock ${bandTone}`}>
    <div><span className={`dot ${bandTone}`}/><b>FII / DII flows</b></div>
    <div className="flows-donut-card" aria-label="FII versus DII composition donut">
      <div className="flows-donut-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="46%" outerRadius="88%" startAngle={90} endAngle={-270} paddingAngle={2} stroke="#0d1013" strokeWidth={3} isAnimationActive={false}>
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
    <AiEvidenceSummaries summaries={summaries}/>
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
  const mailItems = mail?.items ?? [];
  const candidateItems = eventKey === "flows"
    ? [
        ...fiiDiiFlowsSnapshot.evidence.map((item) => ({ source: item.source, time: item.asOf, title: item.title, summary: item.summary })),
        ...mailItems,
      ]
    : mailItems;
  const selectedEvidenceItems = scenarioEvidenceItems(candidateItems, eventKey, bandKey);
  const selectedMailItems = scenarioEvidenceItems(mailItems, eventKey, bandKey);
  const evidenceSummaries = buildMacroEvidenceSummaries(selectedEvidenceItems, eventKey, bandKey);
  const evidenceCount = selectedEvidenceItems.length;
  const evidenceRangeLabel = `${band.label} · ${band.range}`;
  return <section className="macro-workbench scenario-weather">
    <div className={`investment-mail-source ${content.status}`}><Mail size={16}/><span><b>Investment evidence refreshed from Mail for {analysisWindowLabel(content)}</b><small>iCloud → Axis Research ({content.sources.axisResearch.displayedCount ?? content.axisResearch.length} qualifying reports) + iCloud → Newsletters ({content.sources.newsletters.displayedCount ?? content.newsletters.length} items) · refreshed {content.asOf}</small></span></div>
    <div className="weather-altitude" aria-hidden="true"><span className={bandKey === "supportive" ? "active" : ""}>Supportive altitude</span><span className={bandKey === "base" ? "active" : ""}>Base altitude</span><span className={bandKey === "stress" ? "active" : ""}>Stress altitude</span></div>
    <div className="macro-event-tabs" role="tablist" aria-label="Select macro event">{(Object.keys(macroEvents) as MacroEventKey[]).map((key) => <button type="button" role="tab" aria-selected={eventKey === key} key={key} className={eventKey === key ? "active" : ""} onClick={() => onEventChange(key)}><span className={`dot ${key === "breadth" ? "red" : key === "earnings" ? "green" : key === "flows" ? "blue" : "amber"}`}/><b>{macroEvents[key].shortLabel}</b><small>{macroEvents[key].label}</small></button>)}</div>
    <div className="scenario-shell">
      <div className="scenario-tabs" role="tablist" aria-label={`${event.label} decision ranges`}>{(Object.keys(event.bands) as MacroBandKey[]).map((key) => <button type="button" role="tab" aria-selected={bandKey === key} key={key} className={bandKey === key ? "active" : ""} onClick={() => onBandChange(key)}><span className={`dot ${event.bands[key].tone}`}/><b>{event.bands[key].label}</b><small>{event.bands[key].range}</small></button>)}</div>
      <div className={`scenario-body ${band.tone}`}><div className="scenario-copy"><span>SELECTED {event.label.toUpperCase()} RANGE</span><h3>{band.label}</h3><b className="scenario-range">{band.range}</b><p>{band.summary}</p></div><div><small>Relative leaders</small><b>{band.leaders}</b></div><div><small>Relative laggards</small><b>{band.laggards}</b></div><div><small>Framework response</small><b>{band.action}</b></div></div>
    </div>
    <div className={`macro-event-detail${eventKey === "flows" ? " flows-detail" : ""}`}>
      {eventKey === "flows" ? (
        <FlowsRegimePanel bandTone={band.tone} range={band.range} evidence={event.evidence} sectors={event.sectors} trigger={event.trigger} summaries={evidenceSummaries}/>
      ) : (
        <article className={`macro-regime-card ${band.tone}`}><div><span className={`dot ${band.tone}`}/><b>{event.label}</b></div><strong>{band.range}</strong><p>{event.evidence}</p><small>{event.sectors}</small><AiEvidenceSummaries summaries={evidenceSummaries}/><em>{event.trigger}</em></article>
      )}
      {eventKey === "flows" ? (
        <FlowsEvidencePanel content={content} mailCount={selectedMailItems.length} mailItems={selectedMailItems}/>
      ) : (
        <article className="macro-selected-evidence"><header><Mail size={16}/><div><b>{event.label} evidence</b><small>{evidenceCount} items matching {evidenceRangeLabel}</small></div></header>{selectedEvidenceItems.length ? <div>{selectedEvidenceItems.map((item) => <section key={`${item.receivedAt ?? item.time}-${item.title}`}><span>{item.source} · {item.time}</span><b>{item.title}</b><p>{scenarioEvidenceSentence(item, eventKey, bandKey) || item.summary}</p></section>)}</div> : <div className="macro-no-evidence"><b>No source evidence matches {evidenceRangeLabel}</b><p>Broader {event.label.toLowerCase()} items are withheld because they do not support this selected range. Decision ranges remain framework thresholds, not claims about the current market state.</p></div>}</article>
      )}
    </div>
    <div className="macro-method"><ShieldAlert size={15}/><span><b>Decision sequence:</b> establish regime → test flow and rate confirmation → identify sector transmission → verify company KPIs → size the portfolio response.</span></div>
  </section>;
}

/** Compact line under the company name: `TARGET - XX% (Axis PDF|Mail)` or price fallback. */
function formatAxisTargetLine(target: number | null | undefined, cmp: number | null | undefined, sourceLabel = "Axis"): string {
  const upside = axisImpliedUpsidePct(target, cmp);
  if (upside !== null) {
    const label = Number.isInteger(Number(upside.toFixed(1))) ? `${Math.round(upside)}%` : `${upside.toFixed(1)}%`;
    return `TARGET - ${label} (${sourceLabel})`;
  }
  if (target != null) return `TARGET - ${inr.format(target)} (${sourceLabel})`;
  return `TARGET — (${sourceLabel})`;
}

function formatAxisIndicatedUpside(target: number | null | undefined, cmp: number | null | undefined): string {
  const upside = axisImpliedUpsidePct(target, cmp);
  return upside === null ? "—" : `${upside.toFixed(1)}%`;
}

function formatAxisCmp(cmp: number | null): string {
  return cmp != null && cmp > 0 ? inr.format(cmp) : "—";
}

type AxisProgress = {
  /** Display CMP: Kite holding preferred, else yfinance, else Axis PDF/mail CMP. Never fabricated. */
  cmp: number | null;
  cmpSource: "live" | "yfinance" | "mail" | null;
  /**
   * Progress to Axis target, 0–100.
   * When Axis CMP (entry) and live price both exist: (live − entry) / (target − entry), clamped.
   * Otherwise: min(100%, CMP / target × 100) using the best available price.
   */
  pct: number | null;
  metricNote: string;
};

/** Resolve display CMP + progress-to-target from Kite → yfinance → Axis PDF/mail CMP. */
function axisProgressToTarget(
  item: MailRecommendation,
  kiteBySymbol: Map<string, number>,
  yfinanceBySymbol: Map<string, number> = new Map(),
): AxisProgress {
  const resolved = resolveAxisCmp(item, kiteBySymbol, yfinanceBySymbol);
  const cmp = resolved.cmp;
  const cmpSource: AxisProgress["cmpSource"] = resolved.source === "kite"
    ? "live"
    : resolved.source === "yfinance"
      ? "yfinance"
      : resolved.source === "axis"
        ? "mail"
        : null;
  const target = item.target != null && item.target > 0 ? item.target : null;

  if (cmp == null || target == null) {
    const missing = [
      cmp == null ? "CMP" : null,
      target == null ? "Axis target" : null,
    ].filter(Boolean).join(" + ");
    return { cmp, cmpSource, pct: null, metricNote: `Needs ${missing}` };
  }

  // Progress-to-target = live/fallback CMP ÷ Axis PDF target, capped at 100%.
  const pct = Math.min(100, Math.max(0, (cmp / target) * 100));
  const sourceNote = cmpSource === "live" ? "Kite" : cmpSource === "yfinance" ? "yfinance" : "Axis";
  return { cmp, cmpSource, pct, metricNote: `${sourceNote} CMP ÷ Axis target (capped 100%)` };
}

function formatAxisProgressPct(pct: number | null): string {
  if (pct == null) return "—";
  return Number.isInteger(Number(pct.toFixed(1))) ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
}

function AxisCmpProgressBar({ progress, compact = false }: { progress: AxisProgress; compact?: boolean }) {
  const width = progress.pct == null ? 0 : progress.pct;
  const reached = progress.pct != null && progress.pct >= 100;
  return <div className={`axis-target-progress axis-cmp-progress${compact ? " compact" : ""}${reached ? " reached" : ""}${progress.pct == null ? " empty" : ""}`} role="meter" aria-label="Progress to Axis target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct == null ? undefined : Math.round(progress.pct)} aria-valuetext={progress.pct == null ? "Unavailable" : formatAxisProgressPct(progress.pct)}>
    {!compact && <div className="axis-target-progress-meta"><span>Progress to target</span><b>{formatAxisProgressPct(progress.pct)}</b></div>}
    <i className="axis-target-progress-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></i>
    {compact ? <em>{formatAxisProgressPct(progress.pct)}</em> : <small>{progress.metricNote}</small>}
  </div>;
}

function AxisRecommendationWorkbench({ recommendations, content, kiteBySymbol, yfinanceBySymbol }: { recommendations: MailRecommendation[]; content: ContentDigestSnapshot; kiteBySymbol: Map<string, number>; yfinanceBySymbol: Map<string, number> }) {
  const archive = content.investment.axisPdfArchive;
  const audit = {
    filesAttempted: archive?.filesAttempted ?? axisArchiveAudit.filesAttempted,
    validPdfs: archive?.validPdfs ?? axisArchiveAudit.validPdfs,
    pagesRead: archive?.pagesRead ?? axisArchiveAudit.pagesRead,
    invalidFiles: archive?.invalidFiles ?? axisArchiveAudit.invalidFiles,
    shownCalls: archive?.shownCalls ?? recommendations.length,
    withProgress: archive?.withCmpAndTarget ?? recommendations.filter((item) => item.cmp && item.target).length,
    missingProgress: archive?.missingProgressInputs ?? null,
  };
  const axisBucket = (item: MailRecommendation): "fundamental" | "technical" | "trading" => {
    if (item.bucket === "fundamental" || item.bucket === "technical" || item.bucket === "trading") return item.bucket;
    const call = item.call.toUpperCase();
    const horizon = item.horizon.toLowerCase();
    if (call.includes("TECHNICAL") || horizon.includes("technical")) return "technical";
    if (call.includes("TRADING") || horizon.includes("punch") || horizon.includes("investment picks")) return "trading";
    return "fundamental";
  };
  const categories = [
    { label: "Fundamental", key: "fundamental" as const, tone: "green", match: (item: MailRecommendation) => axisBucket(item) === "fundamental" },
    { label: "Technical", key: "technical" as const, tone: "blue", match: (item: MailRecommendation) => axisBucket(item) === "technical" },
    { label: "Trading", key: "trading" as const, tone: "amber", match: (item: MailRecommendation) => axisBucket(item) === "trading" },
  ];
  const defaultCategory = recommendations.some((item) => axisBucket(item) === "trading")
    ? "trading" as const
    : (categories.find((category) => recommendations.some(category.match)) ?? categories[0]).key;
  const [activeCategory, setActiveCategory] = useState<"fundamental" | "technical" | "trading">(defaultCategory);
  const categoryRecs = recommendations.filter((item) => (categories.find((category) => category.key === activeCategory) ?? categories[0]).match(item));
  const visibleRecs = categoryRecs.length ? categoryRecs : recommendations;
  const [selectedSymbol, setSelectedSymbol] = useState(visibleRecs[0]?.symbol ?? recommendations[0]?.symbol ?? "");
  const [detailOpen, setDetailOpen] = useState(false);
  const selected = visibleRecs.find((item) => item.symbol === selectedSymbol)
    ?? recommendations.find((item) => item.symbol === selectedSymbol)
    ?? visibleRecs[0]
    ?? recommendations[0];
  useEffect(() => {
    if (!detailOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen]);
  if (!selected) {
    return <section className="axis-workbench target-hud"><div className="live-empty"><Mail size={24}/><b>No Axis recommendation was parsed from the PDF archive or mail window</b><p>Scanned {audit.filesAttempted} archive files ({audit.validPdfs} valid PDFs). PDFs without a reliable BUY/HOLD/SELL + target text layer are skipped — they are not OCR’d into calls. No older static call is being presented as current.</p></div></section>;
  }
  const selectedProgress = axisProgressToTarget(selected, kiteBySymbol, yfinanceBySymbol);
  const selectedCmp = selectedProgress.cmp;
  const sourceLabel = /pdf/i.test(selected.source) ? "Axis PDF" : /mail/i.test(selected.source) ? "Axis Mail" : selected.source || "Axis";
  const upside = axisImpliedUpsidePct(selected.target, selectedCmp);
  const category = axisBucket(selected) === "technical" ? "Technical" : axisBucket(selected) === "trading" ? "Trading" : "Fundamental";
  const detailBullets = thesisBullets(selected.thesis, { symbol: selected.symbol, name: selected.name, call: selected.call, limit: 5 });
  const cmpSourceLabel = selectedProgress.cmpSource === "live"
    ? "Kite holding"
    : selectedProgress.cmpSource === "yfinance"
      ? "yfinance"
      : selectedProgress.cmpSource === "mail"
        ? (sourceLabel.includes("PDF") ? "Axis PDF" : "Axis Mail")
        : "Unavailable";
  const evidenceBits = [selected.source, selected.date, `scoped to ${selected.symbol}`];
  if (selected.evidenceFile) {
    evidenceBits.splice(1, 0, selected.evidenceFile);
  }
  const openPick = (symbol: string) => {
    setSelectedSymbol(symbol);
    setDetailOpen(true);
  };

  return <section className="axis-workbench target-hud">
    <div className="axis-audit-strip">
      <div><Database size={18}/><span><b>{audit.shownCalls} archive calls</b><small>Parsed from {audit.validPdfs} valid Axis PDFs · {audit.filesAttempted} files scanned</small></span></div>
      <div><Mail size={18}/><span><b>{archive?.mailWindowCalls ?? "—"} mail-window</b><small>Merged when they add a newer/gap call · as-of {content.investment.axisTradingAsOfLabel ?? analysisWindowLabel(content)}</small></span></div>
      <div className={audit.invalidFiles.length ? "warning" : ""}><b>{audit.invalidFiles.length}</b><small>invalid non-PDF payloads</small></div>
    </div>
    <div className="axis-category-strip" role="tablist" aria-label="Axis recommendation categories">{categories.map((item) => {
      const count = recommendations.filter(item.match).length;
      const selectedTab = activeCategory === item.key;
      return <button type="button" role="tab" aria-selected={selectedTab} className={`${item.tone}${selectedTab ? " active" : ""}`} key={item.label} onClick={() => {
        setActiveCategory(item.key);
        const next = recommendations.find(item.match);
        if (next) setSelectedSymbol(next.symbol);
        setDetailOpen(false);
      }}>
        <span>{item.label}</span><b>{count}</b><small>{count === 1 ? "active call" : "active calls"}</small>
      </button>;
    })}</div>
    <div className="axis-visual-grid">
      <nav className="axis-pick-list" aria-label="Select Axis recommendation">{visibleRecs.map((item) => {
        const progress = axisProgressToTarget(item, kiteBySymbol, yfinanceBySymbol);
        const tone = axisBucket(item) === "technical" ? "blue" : axisBucket(item) === "trading" ? "amber" : "green";
        const itemSource = /pdf/i.test(item.source) ? "Axis PDF" : /mail/i.test(item.source) ? "Axis Mail" : "Axis";
        return <button type="button" className={`${selected.symbol === item.symbol && detailOpen ? "active" : ""} ${tone}`} onClick={() => openPick(item.symbol)} key={`${item.symbol}-${axisBucket(item)}-${item.call}`}>
          <b>{item.symbol}</b>
          <small>{item.name}</small>
          <span className="axis-pick-cmp">CMP {formatAxisCmp(progress.cmp)}</span>
          <em>{formatAxisTargetLine(item.target, progress.cmp, itemSource)}</em>
          <AxisCmpProgressBar progress={progress} compact />
        </button>;
      })}</nav>
    </div>
    {detailOpen && <div className="axis-pick-backdrop" role="presentation" onClick={() => setDetailOpen(false)}>
      <article className="panel axis-pick-detail" style={{"--axis-color": selected.color} as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="axis-pick-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="axis-pick-heading"><div><span>{category} · {selected.date}</span><h3 id="axis-pick-detail-title">{selected.name}</h3><p className="axis-target-line">{formatAxisTargetLine(selected.target, selectedCmp, sourceLabel)}</p><p>{selected.symbol} · {selected.source}</p></div><div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}><span className="pill blue">{selected.call}</span><button type="button" className="axis-pick-close" aria-label="Close Axis pick detail" onClick={() => setDetailOpen(false)}><X size={18}/></button></div></div>
        <div className="axis-numeric-grid">
          <div><span>CMP · {cmpSourceLabel}</span><b>{formatAxisCmp(selectedCmp)}</b></div>
          <div><span>Target</span><b>{selected.target ? inr.format(selected.target) : "No explicit TP"}</b></div>
          <div className={upside !== null && upside >= 0 ? "positive" : ""}><span>Indicated upside</span><b>{formatAxisIndicatedUpside(selected.target, selectedCmp)}</b></div>
          <div><span>Horizon</span><b>{selected.horizon}</b></div>
        </div>
        <AxisCmpProgressBar progress={selectedProgress} />
        <ThesisBulletList bullets={detailBullets} className="axis-thesis-bullets" />
        <div className="axis-evidence"><FileText size={15}/><span><b>Evidence:</b> {evidenceBits.join(" · ")}</span></div>
      </article>
    </div>}
    <div className="table-note"><FileText size={16}/><span>PDF-archive policy: Axis Recommended Stocks are driven by text-layer extraction across the local Axis Research archive ({audit.validPdfs} valid PDFs / {audit.pagesRead.toLocaleString("en-IN")} pages), merged with the NSE trading-day mail window (as-of {content.investment.axisTradingAsOfLabel ?? analysisWindowLabel(content)}). Holding Trading Calls (ETERNAL, ICICIBANK, JSWENERGY, BHARTIARTL) use Axis Investment Picks targets with progress-to-target. CMP prefers Kite holding price, else yfinance, else Axis PDF CMP. Refreshed {content.asOf}.</span></div>
  </section>;
}

export type PortfolioActivityView = "holdings" | "orders" | "positions" | "gtts" | "tsls" | "alerts";

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
  analystRows: AnalystMatrixRow[];
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
  kiteBySymbol?: Map<string, number>;
  yfinanceBySymbol?: Map<string, number>;
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
  kiteBySymbol,
  yfinanceBySymbol,
  onKiteRefresh,
}: InvestmentWorkspaceProps) {
  const resolvedKiteBySymbol = kiteBySymbol ?? currentBySymbol;
  const resolvedYfinanceBySymbol = yfinanceBySymbol ?? new Map<string, number>();
  const [activeSection, setActiveSection] = useState("i1");
  const [selectedHoldingSymbol, setSelectedHoldingSymbol] = useState<string | null>(null);
  const [engagedHoldingSymbol, setEngagedHoldingSymbol] = useState<string | null>(null);
  const [orderSelection, setOrderSelection] = useState<KiteOrderSelection>(null);
  const [gttSelection, setGttSelection] = useState<KiteGttSelection>(null);
  const [alertSelection, setAlertSelection] = useState<KiteAlertSelection>(null);
  const [analystGroupMode, setAnalystGroupMode] = useState<AnalystGroupMode>("calls");
  const [collapsedAnalystGroups, setCollapsedAnalystGroups] = useState<Set<string>>(() => new Set());
  const { holdings, portfolio, orders, gtts, marketCapAllocation, sectorAllocation, subSectorAllocation, classification } = snapshot;
  const positions = snapshot.positions ?? [];
  const alerts = snapshot.alerts ?? [];
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
    { key: "alerts", label: "Alerts" },
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
  const analystGroups = useMemo(
    () => groupAnalystRows(analystRows, analystGroupMode, currentBySymbol, holdings),
    [analystGroupMode, analystRows, currentBySymbol, holdings],
  );
  const toggleAnalystGroup = (groupKey: string) => {
    const scopedKey = `${analystGroupMode}:${groupKey}`;
    setCollapsedAnalystGroups((current) => {
      const next = new Set(current);
      if (next.has(scopedKey)) next.delete(scopedKey);
      else next.add(scopedKey);
      return next;
    });
  };
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
      <CollapsibleSection number="I-2" title="Portfolio" note="Holdings, orders, positions, GTTs, TSLs, alerts and nested allocation">
      <section className="instrument-cluster" aria-label="Portfolio instrument cluster">
        <InstrumentGauge
          label="Portfolio value"
          value={portfolioMoney(portfolio.value)}
          detail={hasPortfolio ? `${holdings.length} open equity exposures${isSnapshot ? " · snapshot" : ""}` : "Live Kite data required"}
          ratio={hasPortfolio ? Math.min(1, portfolio.value / Math.max(portfolio.value * 1.15, 1)) : 0}
          tone="neutral"
        />
        <InstrumentGauge
          label="Unrealised P&L"
          value={hasPortfolio ? `${portfolio.pnl >= 0 ? "+" : ""}${inr.format(portfolio.pnl)}` : "—"}
          detail={hasPortfolio ? `${portfolio.pnlPct >= 0 ? "+" : ""}${portfolio.pnlPct.toFixed(2)}% on invested cost${isSnapshot ? " · snapshot" : ""}` : "Kite portfolio unavailable"}
          ratio={hasPortfolio ? Math.min(1, Math.abs(portfolio.pnlPct) / 40) : 0}
          tone={hasPortfolio ? (portfolio.pnl >= 0 ? "positive" : "danger") : "neutral"}
        />
        <InstrumentGauge
          label="Top-two concentration"
          value={hasPortfolio ? `${portfolio.topTwo.toFixed(1)}%` : "—"}
          detail={hasPortfolio ? holdings.slice(0, 2).map((h) => h.name).join(" + ") : "Calculated from Kite positions"}
          ratio={hasPortfolio ? Math.min(1, portfolio.topTwo / 100) : 0}
          tone={hasPortfolio && portfolio.topTwo >= 65 ? "danger" : hasPortfolio && portfolio.topTwo >= 50 ? "warning" : "neutral"}
          redline={hasPortfolio && portfolio.topTwo >= 65 ? "redline" : undefined}
        />
        <InstrumentGauge
          label="Available equity margin"
          value={isLive && !unavailable.has("margins") ? inr.format(portfolio.equityMargin) : isSnapshot ? inr.format(portfolio.equityMargin) : "n/a"}
          detail={isSnapshot ? "Last validated margin snapshot" : unavailable.has("margins") ? "Kite margins temporarily unavailable" : "Live equity segment net margin"}
          ratio={portfolio.equityMargin > 0 ? Math.min(1, portfolio.equityMargin / Math.max(portfolio.value * 0.25, 1)) : 0}
          tone={portfolio.equityMargin > 0 && portfolio.equityMargin < portfolio.value * 0.05 ? "warning" : "neutral"}
          redline={portfolio.equityMargin > 0 && portfolio.equityMargin < portfolio.value * 0.05 ? "thin" : undefined}
        />
      </section>

      <div className="portfolio-analysis-grid orbital-planet">
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
            <small>{(content.investment.axisPdfArchive?.validPdfs ?? axisArchiveAudit.validPdfs)} valid PDFs / {(content.investment.axisPdfArchive?.pagesRead ?? axisArchiveAudit.pagesRead).toLocaleString("en-IN")} pages · {(content.investment.axisPdfArchive?.shownCalls ?? mailAxisRecommendations.length)} extracted calls with progress-to-target.</small>
          </article>
          <article className="portfolio-management-card alpha">
            <span><Target size={15}/>Actions to maximise α</span><b>Rebalance by evidence, not turnover</b>
            <ul><li>Direct new capital toward verified positive-upside calls outside the largest weights.</li><li>Re-underwrite negative-P&amp;L and high-risk positions after each reported KPI set.</li><li>Keep cash capacity for dislocations; review oil, INR and FII triggers before sizing.</li></ul>
          </article>
        </div>
        <div className="portfolio-management-sources"><span>Axis Research: {mailAxisRecommendations.length} current calls · {content.investment.latestAxisAt}</span><span>Newsletters: {content.sources.newsletters.displayedCount ?? content.newsletters.length} items · {content.investment.latestNewsletterAt}</span></div>
      </section>

      <section className="panel holdings-panel portfolio-activity-panel spectrum-sheet">
        <div className="panel-title"><div><h3>Portfolio activity</h3></div>
          <div className="segmented portfolio-activity-tabs">{activityTabs.map((tab) => <button key={tab.key} type="button" onClick={() => setView(tab.key)} className={`vo-pop${view === tab.key ? " active" : ""}`}>{tab.label}</button>)}</div>
        </div>
        {view === "holdings" && (holdings.length
          ? <><div className="portfolio-activity-table">
              <table className="positions-table portfolio-activity-matrix holdings-matrix">
                <colgroup><col className="metric-col"/>{holdings.map((holding) => <col className="holding-data-col" key={holding.symbol}/>)}</colgroup>
                <thead><tr><th scope="col">Metric</th>{holdings.map((holding) => <th scope="col" key={holding.symbol} title={holding.name} data-symbol={holding.symbol} className={`stock-flag${activeHoldingSymbol === holding.symbol ? " holding-column-active" : ""}`}><span className="holding-ticker-actions"><b>{holding.symbol}</b><span><button type="button" className="buy" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "BUY" })} title={isLive ? `Open BUY order ticket for ${holding.symbol}` : "Live Kite authentication is required"}>BUY</button><button type="button" className="sell" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "SELL" })} title={isLive ? `Open SELL order ticket for ${holding.symbol}` : "Live Kite authentication is required"}>SELL</button></span></span></th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">Qty</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{holding.qty}</td>)}</tr>
                  <tr><th scope="row">Avg</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{inr.format(holding.avg)}</td>)}</tr>
                  <tr><th scope="row">Last</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{inr.format(holding.price)}</td>)}</tr>
                  <tr><th scope="row">Value</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}>{inr.format(holding.value)}</td>)}</tr>
                  <tr><th scope="row">Unrealised</th>{holdings.map((holding) => <td className={`${holding.pnl >= 0 ? "positive heat-gain" : "negative heat-loss"}${activeHoldingSymbol === holding.symbol ? " holding-column-active" : ""}`} key={holding.symbol}><b>{holding.pnl >= 0 ? "+" : ""}{inr.format(holding.pnl)}</b><small>{holding.pnlPct >= 0 ? "+" : ""}{holding.pnlPct.toFixed(2)}%</small></td>)}</tr>
                  <tr><th scope="row">Day P&amp;L</th>{holdings.map((holding) => <td className={`${holding.dayPnl >= 0 ? "positive heat-gain" : "negative heat-loss"}${activeHoldingSymbol === holding.symbol ? " holding-column-active" : ""}`} key={holding.symbol}><b>{holding.dayPnl >= 0 ? "+" : ""}{inr.format(holding.dayPnl)}</b><small>{holding.dayPct >= 0 ? "+" : ""}{holding.dayPct.toFixed(2)}%</small></td>)}</tr>
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
        {view === "orders" && <div className="activity-single"><div className="activity-create-bar"><button type="button" className="create-order" disabled={!isLive} title={isLive ? "Trade any NSE cash equity" : "Live Kite authentication is required"} onClick={() => setOrderSelection({ side: "BUY" })}>Create NSE order</button></div>{orders.map(o=><div className="activity-row" key={o.id}><div><b>{o.symbol}</b><small>{o.side} {o.qty} · {o.type}{o.statusMessage ? ` · ${o.statusMessage}` : ""}</small></div><strong>{inr.format(o.price)}</strong><span className={`pill ${o.status.toLowerCase()==="complete"?"green":"amber"}`}>{o.status}</span></div>)}{!orders.length&&<div className="table-empty">{unavailable.has("orders") ? "Kite orders are temporarily unavailable." : "No live orders."}</div>}</div>}
        {view === "positions" && <div className="activity-single">{positions.map(p=><div className="activity-row" key={p.id}><div><b>{p.symbol}</b><small>{p.side} {p.qty} · {p.product}</small></div><strong className={p.pnl>=0?"positive":"negative"}>{p.pnl>=0?"+":""}{inr.format(p.pnl)}</strong><span className="pill blue">{inr.format(p.price)}</span></div>)}{!positions.length&&<div className="table-empty">{unavailable.has("positions") ? "Kite positions are temporarily unavailable." : "No open day/net positions beyond the holdings book."}</div>}</div>}
        {view === "gtts" && <div className="activity-single">
          <div className="activity-create-bar"><button type="button" className="create-gtt" disabled={!isLive} title={isLive ? "Open Create GTT ticket" : "Live Kite authentication is required"} onClick={() => setGttSelection({ kind: "gtt" })}>Create GTT</button></div>
          {entryGtts.map(g=><div className="activity-row" key={g.id}><div><b>{g.symbol}</b><small>{g.side} {g.qty} · trigger {inr.format(g.trigger)}</small></div><strong>{inr.format(g.limit)}</strong><span className={`pill ${g.status.toLowerCase()==="active"?"amber":"green"}`}>{g.status}</span></div>)}
          {!entryGtts.length&&<div className="table-empty">{unavailable.has("GTTs") ? "Kite GTTs are temporarily unavailable." : "No active entry GTTs."}</div>}
        </div>}
        {view === "tsls" && <div className="activity-single">
          <div className="activity-create-bar"><button type="button" className="create-tsl" disabled={!isLive} title={isLive ? "Open Create TSL ticket" : "Live Kite authentication is required"} onClick={() => setGttSelection({ kind: "tsl" })}>Create TSL</button></div>
          {tsls.map(g=><div className="activity-row" key={g.id}><div><b>{g.symbol}</b><small>{g.side} {g.qty} · stop {inr.format(g.trigger)}</small></div><strong>{inr.format(g.limit)}</strong><span className={`pill ${g.status.toLowerCase()==="active"?"amber":"green"}`}>{g.status}</span></div>)}
          {!tsls.length&&<div className="table-empty">{unavailable.has("GTTs") ? "Kite GTTs/TSLs are temporarily unavailable." : "No protective TSL / stop-loss GTTs."}</div>}
        </div>}
        {view === "alerts" && <div className="activity-single">
          <div className="activity-create-bar"><button type="button" className="create-alert" disabled={!isLive} title={isLive ? "Open Create price alert ticket" : "Live Kite authentication is required"} onClick={() => setAlertSelection({})}>Create price alert</button></div>
          {alerts.map((alert) => <div className="activity-row" key={alert.id}><div><b>{alert.symbol}</b><small>{alert.exchange} · LTP {alert.operator || (alert.direction === "above" ? "≥" : alert.direction === "below" ? "≤" : "?")} {inr.format(alert.trigger)}{alert.note ? ` · ${alert.note}` : ""}</small></div><strong>{alert.direction === "above" ? "Above" : alert.direction === "below" ? "Below" : alert.operator}</strong><span className={`pill ${alert.status.toLowerCase()==="enabled"?"amber":"green"}`}>{alert.status}</span></div>)}
          {!alerts.length&&<div className="table-empty">{unavailable.has("alerts") ? "Kite price alerts are temporarily unavailable." : "No Kite price alerts."}</div>}
        </div>}
      </section>

      <section className="panel portfolio-map-panel gravity-well" aria-labelledby="portfolio-map-title">
        <div className="portfolio-map-heading">
          <div><h3 id="portfolio-map-title">Portfolio concentration map</h3><p>Live Kite holdings · market-value area</p></div>
          <div className="portfolio-map-legend" aria-label="Concentration map legend"><span>Tile size = portfolio weight</span><span>Color = unrealised return</span></div>
        </div>
        {portfolioMapRects.length ? <div className="portfolio-map" role="group" aria-label="Interactive portfolio concentration treemap">
          {portfolioMapRects.map((holding) => {
            const selected = selectedHoldingSymbol === holding.symbol;
            const dimmed = selectedHoldingSymbol !== null && !selected;
            const showSecondary = holding.width >= 24 && holding.height >= 32;
            const density = holding.width < 15 || holding.height < 17 ? "micro" : holding.width < 24 || holding.height < 25 ? "compact" : "roomy";
            return <button
              type="button"
              key={holding.symbol}
              className={`portfolio-map-tile ${holding.returnTone} ${density}${selected ? " selected" : ""}${dimmed ? " dimmed" : ""}`}
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
              <span className="portfolio-map-primary"><b title={holding.symbol}>{holding.symbol}</b><strong>{holding.weight.toFixed(1)}%</strong><em>{inr.format(holding.value)}</em></span>
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
      {orderSelection && <KiteOrderTicket key={`${orderSelection.side}-${orderSelection.holding?.symbol ?? "new"}`} selection={orderSelection} holdings={holdings} onClose={() => setOrderSelection(null)} onSubmitted={onKiteRefresh}/>} 
      {gttSelection && <KiteGttTicket key={`${gttSelection.kind}-${gttSelection.holding?.symbol ?? "new"}`} selection={gttSelection} holdings={holdings} onClose={() => setGttSelection(null)} onSubmitted={onKiteRefresh}/>}
      {alertSelection && <KiteAlertTicket key={alertSelection.holding?.symbol ?? "new-alert"} selection={alertSelection} holdings={holdings} onClose={() => setAlertSelection(null)} onSubmitted={onKiteRefresh}/>}
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
          <section className="panel chart-panel exposure-composition-panel exposure-spine-panel">
            <div className="panel-title"><div><h3>Risk composition</h3><p>Equal-weighted event and KPI drivers · each segment shows its share of the total</p></div><ShieldAlert size={18}/></div>
            {hasPortfolio ? <>
              <div className="exposure-group-key"><span><i className="event"/>EVENTS · oil, geopolitics and flows</span><span><i className="kpi"/>KPIs · valuation, liquidity, volatility and leverage</span></div>
              <div className="exposure-factor-key">{exposureFactors.map((factor) => <span key={factor.key}><i style={{background:factor.color}}/><b>{factor.label}</b><small>{factor.group}</small></span>)}</div>
              <ResponsiveContainer width="100%" height={286}>
                <BarChart data={exposureComposition} layout="vertical" margin={{top:8,right:52,bottom:6,left:2}} barCategoryGap="27%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                  <XAxis type="number" domain={[0,5]} ticks={[0,1,2,3,4,5]} tick={{fill:"var(--chart-tick)",fontSize:10}} label={{value:"COMPOSITE MONITORING INDEX",position:"insideBottom",offset:-3,fill:"var(--chart-tick)",fontSize:10}}/>
                  <YAxis dataKey="symbol" type="category" width={58} tick={{fill:"var(--chart-label)",fontSize:10,fontWeight:800}}/>
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
          <article className="panel risk-panel threat-flower holdings-stack"><div className="panel-title"><div><h3>Portfolio / holdings risk</h3><p>{livePortfolioRiskProfiles.length} current Kite holdings · selectable against live-portfolio average</p></div><ScanSearch size={18}/></div><RiskRadar profiles={livePortfolioRiskProfiles} selected={portfolioRisk} onSelect={setPortfolioRisk} averageLabel="Current portfolio average" idPrefix="portfolio-holdings-risk" explainSelected evidenceContext={{ holdings, asOf: snapshot.asOf, classification }} emptyLabel="No live holding risk profiles" /></article>
        </div>
      </CollapsibleSection>
      </div>

      <div id="investment-i4" className="workspace-section">
      <CollapsibleSection number="I-4" title="Axis picks" note={`Call matrix · Axis recommended stocks · recommended risk radar · as-of ${axisAsOfLabel}${content.investment.axisUsedLastTradingDay ? " · weekend/holiday fallback" : ""}`}>
        <section className="panel analyst-matrix" data-visual="axis-call-constellation">
          <div className="panel-title"><div><h3>Analyst call matrix</h3><p>Targets are reference points, not quarter forecasts</p></div><Target size={18}/></div>
          <div className="analyst-matrix-controls">
            <label htmlFor="analyst-group-by">Group by
              <select id="analyst-group-by" value={analystGroupMode} onChange={(event) => setAnalystGroupMode(event.target.value as AnalystGroupMode)}>
                <option value="calls">Analyst calls</option>
                <option value="industries">Industries</option>
                <option value="performance">Performance</option>
                <option value="posted-month">Posted-in-month</option>
                <option value="target-achieved">Target achieved</option>
              </select>
            </label>
          </div>
          {analystGroups.length ? analystGroups.map((group) => {
            const groupStateKey = `${analystGroupMode}:${group.key}`;
            const groupControlId = `analyst-group-${groupStateKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
            const isCollapsed = collapsedAnalystGroups.has(groupStateKey);
            return <div className={`analyst-group-block${isCollapsed ? " collapsed" : ""}`} key={`${analystGroupMode}-${group.key}`}>
            <button type="button" className={`analyst-group-header call-${group.tone}`} aria-expanded={!isCollapsed} aria-controls={groupControlId} onClick={() => toggleAnalystGroup(group.key)}><span className="analyst-group-title"><ChevronDown size={15} aria-hidden="true"/><b>{group.label}</b></span><span>{group.rows.length} call{group.rows.length === 1 ? "" : "s"}</span></button>
            <div className="table-scroll" id={groupControlId} hidden={isCollapsed}>
              <table className="analyst-table">
                <thead><tr><th>Stock</th><th>Source / house</th><th>Call</th><th>CMP</th><th>Target</th><th>Implied vs CMP</th><th>Published</th><th>What matters</th></tr></thead>
                <tbody>{group.rows.map((a) => {
                  const current = currentBySymbol.get(a.symbol);
                  const implied = !a.targetAchieved && current && a.target ? (a.target / current - 1) * 100 : null;
                  const bullets = thesisBullets(a.thesis, { symbol: a.symbol, call: a.rating, limit: 4 });
                  const callTone = analystCallTone(a.rating);
                  return <tr key={`${a.symbol}-${a.house}-${a.rating}-${a.target ?? "na"}-${a.date}`}>
                    <td data-label="Stock"><b>{a.symbol}</b></td>
                    <td data-label="Source / house">{a.house}</td>
                    <td data-label="Call"><span className={`pill ${callTone}`}>{a.rating}</span></td>
                    <td data-label="CMP">{current ? inr.format(current) : "—"}</td>
                    <td data-label="Target">{a.target ? inr.format(a.target) : "—"}</td>
                    <td data-label="Implied vs CMP" className={implied === null ? "" : implied >= 0 ? "positive" : "negative"}>{implied === null ? "—" : `${implied >= 0 ? "+" : ""}${implied.toFixed(1)}%`}</td>
                    <td data-label="Published">{a.date}</td>
                    <td data-label="What matters"><ThesisBulletList bullets={bullets} className="thesis-bullet-list" /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>;
          }) : <div className="analyst-matrix-empty"><Target size={18}/><b>No source-backed rows in this group</b><span>Target achieved includes only explicit Axis Research Mail/PDF closure evidence.</span></div>}
          <div className="table-note"><Target size={16}/><span>Axis Mail calls as-of {axisAsOfLabel} are prioritised and deduplicated by symbol. Plain BUY variants resolve to one BUY category; Trading and Technical BUY remain distinct. Target achieved is a separate closed-call view sourced from explicit Axis Research Mail/PDF evidence and is never treated as an active recommendation. CMP prefers Kite last price when held; otherwise a yfinance delayed NSE quote.</span></div>
        </section>
        <AxisRecommendationWorkbench recommendations={mailAxisRecommendations} content={content} kiteBySymbol={resolvedKiteBySymbol} yfinanceBySymbol={resolvedYfinanceBySymbol}/>
        <article className="panel risk-panel threat-flower"><div className="panel-title"><div><h3>Recommended risk radar</h3><p>{axisAsOfLabel} · {mailAxisProfiles.length} deduplicated Axis calls from iCloud → Axis Research</p></div><Target size={18}/></div><RiskRadar profiles={mailAxisProfiles} selected={axisRisk} onSelect={setAxisRisk} averageLabel="Axis list average" idPrefix="axis-recommended-risk" emptyLabel={`No Axis risk profiles for ${mailWindow}`} /></article>
      </CollapsibleSection>
      </div>
  </div>;
}
