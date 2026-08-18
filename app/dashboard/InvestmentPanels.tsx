"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Database, ExternalLink, FileText, Globe2, Mail, ShieldAlert, Sparkles, X } from "lucide-react";
import { Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AnalystMatrixRow } from "../analyst-matrix-groups";
import { axisCallBucket, mergeActiveMatrixRowsIntoWorkbench } from "../axis-holding-trading-calls";
import { fiiDiiFlowsSnapshot, fiveDayDiiNetCr, fiveDayFiiNetCr, flowCompositionSlices, formatFlowCr, formatFlowDeltaCr } from "../fii-dii-flows";
import { axisArchiveAudit, portfolioRiskProfiles, riskAxes, type RiskProfile } from "../portfolio-data";
import { axisImpliedUpsidePct, resolveAxisCmp } from "../axis-pick-metrics";
import type { ContentDigestSnapshot, MailRecommendation } from "../content-types";
import type { KiteSnapshot, LiveHolding } from "../live-types";
import { portfolioReturnTone } from "../portfolio-concentration.mjs";
import { assembleScenarioEvidence, evidenceCardLabel, scenarioEvidenceSentence, type ScenarioEvidenceCard } from "../macro-scenario-evidence";
import { buildRiskExplanation } from "../risk-explanations";
import { thesisBullets, type ThesisBullet } from "../thesis-bullets";
import type { MacroBandKey, MacroEventKey } from "./types";
import { DemoSensitive } from "./shared-ui";
import { analysisWindowLabel, inr, macroEvents } from "./utils";

export type PortfolioMapDatum = Pick<LiveHolding, "symbol" | "name" | "qty" | "avg" | "price" | "value" | "pnl" | "pnlPct" | "dayPnl" | "dayPct" | "sector" | "subSector" | "risk"> & {
  weight: number;
  displayColor: string;
  returnTone: "gain" | "flat" | "loss";
};

export type PortfolioMapRect = PortfolioMapDatum & { x: number; y: number; width: number; height: number };

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

export function portfolioReturnColor(returnPct: number): string {
  const tone = portfolioReturnTone(returnPct);
  return tone === "gain" ? "#137a43" : tone === "loss" ? "#a92f39" : "#9a6b12";
}

export function layoutPortfolioMap(data: PortfolioMapDatum[]): PortfolioMapRect[] {
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

export function portfolioMapTooltip(holding: PortfolioMapDatum): string {
  return `${holding.name} (${holding.symbol})\nQuantity: ${holding.qty}\nAverage price: ${inr.format(holding.avg)}\nLast price: ${inr.format(holding.price)}\nValue: ${inr.format(holding.value)}\nUnrealised P&L: ${holding.pnl >= 0 ? "+" : ""}${inr.format(holding.pnl)} (${holding.pnlPct >= 0 ? "+" : ""}${holding.pnlPct.toFixed(2)}%)\nDay P&L: ${holding.dayPnl >= 0 ? "+" : ""}${inr.format(holding.dayPnl)} (${holding.dayPct >= 0 ? "+" : ""}${holding.dayPct.toFixed(2)}%)\nIndustry: ${holding.sector}\nSubsector: ${holding.subSector}\nRisk: ${holding.risk}`;
}

export function ThesisBulletList({ bullets, className = "thesis-bullet-list" }: { bullets: ThesisBullet[]; className?: string }) {
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
  items: ScenarioEvidenceCard[],
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
    const source = item.kind === "framework" ? "Framework note" : item.source;
    summaries.push({ text, outcome: macroEvidenceOutcome(item, `${item.title}. ${text}`), source });
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

export function RiskRadar({ profiles, selected, onSelect, averageLabel, idPrefix, explainSelected = false, evidenceContext, emptyLabel = "No current risk profiles" }: { profiles: RiskProfile[]; selected: string; onSelect: (symbol: string) => void; averageLabel: string; idPrefix: string; explainSelected?: boolean; evidenceContext?: RiskEvidenceContext; emptyLabel?: string }) {
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
          <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fill: "var(--chart-tick)", fontSize: 13 }} />
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
          <div><dt>Live exposure</dt><dd><DemoSensitive>{inr.format(evidenceHolding.value)}</DemoSensitive> · {evidenceHolding.weight.toFixed(2)}% weight</dd></div>
          <div><dt>Position</dt><dd><DemoSensitive>{evidenceHolding.qty}</DemoSensitive> @ <DemoSensitive>{inr.format(evidenceHolding.avg)}</DemoSensitive> · last <DemoSensitive>{inr.format(evidenceHolding.price)}</DemoSensitive></dd></div>
          <div><dt>Unrealised P&amp;L</dt><dd className={evidenceHolding.pnl >= 0 ? "positive" : "negative"}><DemoSensitive>{evidenceHolding.pnl >= 0 ? "+" : ""}{inr.format(evidenceHolding.pnl)}</DemoSensitive> · {evidenceHolding.pnlPct >= 0 ? "+" : ""}{evidenceHolding.pnlPct.toFixed(2)}%</dd></div>
          <div><dt>Day P&amp;L</dt><dd className={evidenceHolding.dayPnl >= 0 ? "positive" : "negative"}><DemoSensitive>{evidenceHolding.dayPnl >= 0 ? "+" : ""}{inr.format(evidenceHolding.dayPnl)}</DemoSensitive> · {evidenceHolding.dayPct >= 0 ? "+" : ""}{evidenceHolding.dayPct.toFixed(2)}%</dd></div>
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

function evidenceSourceCount(items: ScenarioEvidenceCard[]): string {
  const mail = items.filter((item) => item.kind === "mail").length;
  const web = items.filter((item) => item.kind === "web").length;
  const framework = items.filter((item) => item.kind === "framework").length;
  const parts = [
    mail ? `${mail} Mail` : null,
    web ? `${web} web` : null,
    framework ? `${framework} framework` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "0 items";
}

function ScenarioEvidenceCardList({ items, eventKey, bandKey }: { items: ScenarioEvidenceCard[]; eventKey: MacroEventKey; bandKey: MacroBandKey }) {
  return <div>{items.map((item) => <section key={`${item.kind}-${item.receivedAt ?? item.time}-${item.title}`} className={`evidence-${item.kind} evidence-${item.rangeSupport}`}>
    <span>{evidenceCardLabel(item)}</span>
    <b>{item.title}</b>
    <p>{scenarioEvidenceSentence(item, eventKey, bandKey) || item.summary}</p>
    {item.url ? <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={11}/>Source</a> : null}
  </section>)}</div>;
}

function FlowsEvidencePanel({ content, items, eventKey, bandKey, rangeLabel }: { content: ContentDigestSnapshot; items: ScenarioEvidenceCard[]; eventKey: MacroEventKey; bandKey: MacroBandKey; rangeLabel: string }) {
  const snapshot = fiiDiiFlowsSnapshot;
  const latest = snapshot.sessions[0];
  const subtitle = `${evidenceSourceCount(items)} · ${rangeLabel} · as-of ${latest?.dateLabel ?? snapshot.dataDate} · Mail window ${analysisWindowLabel(content)}`;

  return <article className="macro-selected-evidence flows-evidence-panel">
    <header><Globe2 size={16}/><div><b>FII / DII flows evidence</b><small>{subtitle}</small></div></header>
    <div className="flows-evidence-list">
      {items.length ? items.map((item) => (
        <section key={`${item.kind}-${item.receivedAt ?? item.time}-${item.title}`} className={`evidence-${item.kind} evidence-${item.rangeSupport}${item.url === snapshot.primarySourceUrl ? " primary" : ""}`}>
          <span>{evidenceCardLabel(item)}</span>
          <b>{item.title}</b>
          <p>{scenarioEvidenceSentence(item, eventKey, bandKey) || item.summary}</p>
          {item.url ? <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={11}/>Source</a> : null}
        </section>
      )) : (
        <section className="flows-mail-empty">
          <span>Mail · {analysisWindowLabel(content)}</span>
          <b>No event-specific evidence in this window</b>
          <p>Decision ranges stay framework thresholds until Mail or exchange prints match this selected range.</p>
        </section>
      )}
    </div>
  </article>;
}

export function MacroScenarioBoard({ eventKey, bandKey, onEventChange, onBandChange, content }: { eventKey: MacroEventKey; bandKey: MacroBandKey; onEventChange: (key: MacroEventKey) => void; onBandChange: (key: MacroBandKey) => void; content: ContentDigestSnapshot }) {
  const event = macroEvents[eventKey];
  const band = event.bands[bandKey];
  const mail = content.investment.macroEvidence.find((item) => item.key === eventKey);
  const candidateItems = [
    ...(eventKey === "flows" ? fiiDiiFlowsSnapshot.evidence.map((item) => ({
      source: item.source,
      time: item.asOf,
      title: item.title,
      summary: item.summary,
      url: item.url,
      evidenceKind: "web" as const,
    })) : []),
    ...(content.axisResearch ?? []),
    ...(content.newsletters ?? []),
    ...(mail?.items ?? []),
  ];
  const selectedEvidenceItems = assembleScenarioEvidence(candidateItems, eventKey, bandKey, event);
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
        <FlowsEvidencePanel content={content} items={selectedEvidenceItems} eventKey={eventKey} bandKey={bandKey} rangeLabel={evidenceRangeLabel}/>
      ) : (
        <article className="macro-selected-evidence"><header><Mail size={16}/><div><b>{event.label} evidence</b><small>{evidenceCount} items for {evidenceRangeLabel} · {evidenceSourceCount(selectedEvidenceItems)}</small></div></header>{selectedEvidenceItems.length ? <ScenarioEvidenceCardList items={selectedEvidenceItems} eventKey={eventKey} bandKey={bandKey}/> : <div className="macro-no-evidence"><b>No source evidence matches {evidenceRangeLabel}</b><p>Broader {event.label.toLowerCase()} items are withheld because they do not support this selected range. Decision ranges remain framework thresholds, not claims about the current market state.</p></div>}</article>
      )}
    </div>
    <div className="macro-method"><ShieldAlert size={15}/><span><b>Decision sequence:</b> establish regime → test flow and rate confirmation → identify sector transmission → verify company KPIs → size the portfolio response.</span></div>
  </section>;
}

/** Compact source chip: Axis PDF/Mail when that is the house, otherwise the matrix house as published. */
function axisCardSourceLabel(source: string): string {
  const text = String(source ?? "").trim();
  if (/pdf/i.test(text)) return "Axis PDF";
  if (/mail/i.test(text) || /icloud axis/i.test(text)) return "Axis Mail";
  if (/axis/i.test(text) && !/\//.test(text)) return "Axis";
  return text || "Research";
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

export function AxisRecommendationWorkbench({ recommendations, analystRows, content, kiteBySymbol, yfinanceBySymbol }: { recommendations: MailRecommendation[]; analystRows: AnalystMatrixRow[]; content: ContentDigestSnapshot; kiteBySymbol: Map<string, number>; yfinanceBySymbol: Map<string, number> }) {
  const archive = content.investment.axisPdfArchive;
  const namesBySymbol = useMemo(() => {
    const map = new Map<string, string>(portfolioRiskProfiles.map((profile) => [profile.symbol, profile.name]));
    for (const item of recommendations) map.set(item.symbol, item.name);
    return map;
  }, [recommendations]);
  const cards = useMemo(
    () => mergeActiveMatrixRowsIntoWorkbench(recommendations, analystRows, namesBySymbol),
    [analystRows, namesBySymbol, recommendations],
  );
  const audit = {
    filesAttempted: archive?.filesAttempted ?? axisArchiveAudit.filesAttempted,
    validPdfs: archive?.validPdfs ?? axisArchiveAudit.validPdfs,
    pagesRead: archive?.pagesRead ?? axisArchiveAudit.pagesRead,
    invalidFiles: archive?.invalidFiles ?? axisArchiveAudit.invalidFiles,
    shownCalls: archive?.shownCalls ?? recommendations.length,
    withProgress: archive?.withCmpAndTarget ?? recommendations.filter((item) => item.cmp && item.target).length,
    missingProgress: archive?.missingProgressInputs ?? null,
  };
  const categories = [
    { label: "Fundamental", key: "fundamental" as const, tone: "green" },
    { label: "Technical", key: "technical" as const, tone: "blue" },
    { label: "Trading", key: "trading" as const, tone: "amber" },
  ];
  const groupedCards = categories.map((category) => ({
    ...category,
    items: cards.filter((item) => axisCallBucket(item) === category.key),
  }));
  const [selectedKey, setSelectedKey] = useState(`${cards[0]?.symbol ?? ""}|${cards[0] ? axisCallBucket(cards[0]) : "fundamental"}`);
  const [detailOpen, setDetailOpen] = useState(false);
  const selected = cards.find((item) => `${item.symbol}|${axisCallBucket(item)}` === selectedKey)
    ?? cards[0];
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
  const sourceLabel = axisCardSourceLabel(selected.source);
  const upside = axisImpliedUpsidePct(selected.target, selectedCmp);
  const selectedBucket = axisCallBucket(selected);
  const category = selectedBucket === "technical" ? "Technical" : selectedBucket === "trading" ? "Trading" : "Fundamental";
  const detailBullets = thesisBullets(selected.thesis, { symbol: selected.symbol, name: selected.name, call: selected.call, limit: 5 });
  const cmpSourceLabel = selectedProgress.cmpSource === "live"
    ? "Kite holding"
    : selectedProgress.cmpSource === "yfinance"
      ? "yfinance"
      : selectedProgress.cmpSource === "mail"
        ? (sourceLabel.includes("PDF") ? "Axis PDF" : sourceLabel.includes("Mail") ? "Axis Mail" : sourceLabel)
        : "Unavailable";
  const evidenceBits = [selected.source, selected.date, `scoped to ${selected.symbol}`];
  if (selected.evidenceFile) {
    evidenceBits.splice(1, 0, selected.evidenceFile);
  }
  const openPick = (item: MailRecommendation) => {
    setSelectedKey(`${item.symbol}|${axisCallBucket(item)}`);
    setDetailOpen(true);
  };

  return <section className="axis-workbench target-hud">
    <div className="axis-audit-strip">
      <div><Database size={18}/><span><b>{audit.shownCalls} archive calls</b><small>Parsed from {audit.validPdfs} valid Axis PDFs · {audit.filesAttempted} files scanned</small></span></div>
      <div><Mail size={18}/><span><b>{archive?.mailWindowCalls ?? "—"} mail-window</b><small>Merged when they add a newer/gap call · as-of {content.investment.axisTradingAsOfLabel ?? analysisWindowLabel(content)}</small></span></div>
      <div className={audit.invalidFiles.length ? "warning" : ""}><b>{audit.invalidFiles.length}</b><small>invalid non-PDF payloads</small></div>
    </div>
    <div className="axis-category-strip" role="group" aria-label="Active analyst call counts">{groupedCards.map((item) => {
      const count = item.items.length;
      return <div className={item.tone} key={item.label}>
        <span>{item.label}</span><b>{count}</b><small>{count === 1 ? "active call" : "active calls"}</small>
      </div>;
    })}</div>
    <div className="axis-visual-grid">{groupedCards.map((group) => {
      if (!group.items.length) return null;
      return <section className="axis-pick-group" key={group.key} aria-label={`${group.label} analyst calls`}>
        <h3 className="axis-pick-group-title">{group.label}</h3>
        <nav className="axis-pick-list" aria-label={`Select ${group.label} recommendation`}>{group.items.map((item) => {
          const progress = axisProgressToTarget(item, kiteBySymbol, yfinanceBySymbol);
          const tone = axisCallBucket(item) === "technical" ? "blue" : axisCallBucket(item) === "trading" ? "amber" : "green";
          const itemKey = `${item.symbol}|${axisCallBucket(item)}`;
          return <button type="button" className={`${selectedKey === itemKey && detailOpen ? "active" : ""} ${tone}`} onClick={() => openPick(item)} key={`${item.symbol}-${axisCallBucket(item)}-${item.call}`}>
            <b>{item.symbol}</b>
            <small>{item.name}</small>
            <span className="axis-pick-cmp">CMP {formatAxisCmp(progress.cmp)}</span>
            <em>{formatAxisTargetLine(item.target, progress.cmp, axisCardSourceLabel(item.source))}</em>
            <AxisCmpProgressBar progress={progress} compact />
          </button>;
        })}</nav>
      </section>;
    })}</div>
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
    <div className="table-note"><FileText size={16}/><span>I-4 workbench shows every active analyst-call category the matrix exposes (Fundamental, Technical, and Trading together), filling Axis PDF/mail gaps from the call matrix without inventing targets. Closed target-achieved rows stay in the matrix view only. CMP prefers Kite holding price, else yfinance, else research CMP. Archive: {audit.validPdfs} valid PDFs / {audit.pagesRead.toLocaleString("en-IN")} pages · mail window as-of {content.investment.axisTradingAsOfLabel ?? analysisWindowLabel(content)}. Refreshed {content.asOf}.</span></div>
  </section>;
}
