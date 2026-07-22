"use client";

import { useState, type CSSProperties } from "react";
import { Activity, CheckCircle2, Database, ExternalLink, FileText, Gauge, Mail, ScanSearch, ShieldAlert, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisArchiveAudit, riskAxes, type RiskProfile } from "../portfolio-data";
import type { ContentDigestSnapshot, MailRecommendation } from "../content-types";
import type { KiteSnapshot } from "../live-types";
import { thesisBullets, type ThesisBullet } from "../thesis-bullets";
import type { MacroBandKey, MacroEventKey } from "./types";
import { AllocationLabel, CollapsibleSection, DailyKanbanBoard, HoldingLabel, RiskPill } from "./shared-ui";
import { analysisWindowLabel, exposureFactors, gainShades, inr, macroEvents } from "./utils";

function ThesisBulletList({ bullets, className = "thesis-bullet-list" }: { bullets: ThesisBullet[]; className?: string }) {
  if (!bullets.length) return <span className="thesis-empty">No scoped thesis in readable Mail content</span>;
  return <ul className={className}>{bullets.map((bullet) => <li key={`${bullet.marker}-${bullet.text}`} className={bullet.tone}><span aria-hidden="true">{bullet.marker}</span><span>{bullet.text}</span></li>)}</ul>;
}

function RiskRadar({ profiles, selected, onSelect, averageLabel, emptyLabel = "No current risk profiles" }: { profiles: RiskProfile[]; selected: string; onSelect: (symbol: string) => void; averageLabel: string; emptyLabel?: string }) {
  if (!profiles.length) return <div className="live-empty compact"><Mail size={22}/><b>{emptyLabel}</b><p>The refreshed source set did not produce a verified profile for the selected analysis window.</p></div>;
  const profile = profiles.find((item) => item.symbol === selected) ?? profiles[0];
  const data = riskAxes.map((axis, index) => ({
    axis,
    score: profile.scores[index],
    average: Number((profiles.reduce((sum, item) => sum + item.scores[index], 0) / profiles.length).toFixed(1)),
  }));

  return <>
    <div className="risk-selector" aria-label="Select risk profile">{profiles.map((item) => <button key={item.symbol} onClick={() => onSelect(item.symbol)} className={item.symbol === profile.symbol ? "active" : ""}>{item.symbol}</button>)}</div>
    <div className="risk-chart"><ResponsiveContainer width="100%" height={330}>
      <RadarChart data={data} outerRadius="72%" margin={{ top: 16, right: 38, bottom: 12, left: 38 }}>
        <PolarGrid stroke="#3b444e" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "#f4f5f6", fontSize: 11, fontWeight: 700 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fill: "#8d97a1", fontSize: 9 }} />
        <Radar name={averageLabel} dataKey="average" stroke="#8f98a2" fill="#8f98a2" fillOpacity={0.08} strokeDasharray="5 4" isAnimationActive={false} />
        <Radar name={profile.name} dataKey="score" stroke={profile.color} fill={profile.color} fillOpacity={0.25} strokeWidth={2.5} isAnimationActive={false} />
        <Legend />
        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 5`, "Risk score"]} />
      </RadarChart>
    </ResponsiveContainer></div>
    <div className="risk-scale"><span><i className="dot green"/>1-2 lower</span><span><i className="dot amber"/>3 moderate</span><span><i className="dot red"/>4-5 elevated</span><em>Qualitative monitoring score, not probability of loss.</em></div>
  </>;
}

function MacroScenarioBoard({ eventKey, bandKey, onEventChange, onBandChange, content }: { eventKey: MacroEventKey; bandKey: MacroBandKey; onEventChange: (key: MacroEventKey) => void; onBandChange: (key: MacroBandKey) => void; content: ContentDigestSnapshot }) {
  const event = macroEvents[eventKey];
  const band = event.bands[bandKey];
  const mail = content.investment.macroEvidence.find((item) => item.key === eventKey);
  return <section className="macro-workbench">
    <div className={`investment-mail-source ${content.status}`}><Mail size={16}/><span><b>Investment evidence refreshed from Mail for {analysisWindowLabel(content)}</b><small>iCloud → Axis Research ({content.sources.axisResearch.displayedCount ?? content.axisResearch.length} qualifying reports) + iCloud → Newsletters ({content.sources.newsletters.displayedCount ?? content.newsletters.length} items) · refreshed {content.asOf}</small></span></div>
    <div className="macro-event-tabs" role="tablist" aria-label="Select macro event">{(Object.keys(macroEvents) as MacroEventKey[]).map((key) => <button type="button" role="tab" aria-selected={eventKey === key} key={key} className={eventKey === key ? "active" : ""} onClick={() => onEventChange(key)}><span className={`dot ${key === "breadth" ? "red" : key === "earnings" ? "green" : key === "flows" ? "blue" : "amber"}`}/><b>{macroEvents[key].shortLabel}</b><small>{macroEvents[key].label}</small></button>)}</div>
    <div className="scenario-shell">
      <div className="scenario-tabs" role="tablist" aria-label={`${event.label} decision ranges`}>{(Object.keys(event.bands) as MacroBandKey[]).map((key) => <button type="button" role="tab" aria-selected={bandKey === key} key={key} className={bandKey === key ? "active" : ""} onClick={() => onBandChange(key)}><span className={`dot ${event.bands[key].tone}`}/><b>{event.bands[key].label}</b><small>{event.bands[key].range}</small></button>)}</div>
      <div className={`scenario-body ${band.tone}`}><div className="scenario-copy"><span>SELECTED {event.label.toUpperCase()} RANGE</span><h3>{band.label}</h3><b className="scenario-range">{band.range}</b><p>{band.summary}</p></div><div><small>Relative leaders</small><b>{band.leaders}</b></div><div><small>Relative laggards</small><b>{band.laggards}</b></div><div><small>Framework response</small><b>{band.action}</b></div></div>
    </div>
    <div className="macro-event-detail">
      <article className={`macro-regime-card ${band.tone}`}><div><span className={`dot ${band.tone}`}/><b>{event.label}</b></div><strong>{band.range}</strong><p>{event.evidence}</p><small>{event.sectors}</small><em>{event.trigger}</em></article>
      <article className="macro-selected-evidence"><header><Mail size={16}/><div><b>{event.label} evidence</b><small>{mail?.count ?? 0} matching Axis Research and Newsletter items</small></div></header>{mail?.items?.length ? <div>{mail.items.map((item) => <section key={`${item.receivedAt ?? item.time}-${item.title}`}><span>{item.source} · {item.time}</span><b>{item.title}</b><p>{item.summary}</p></section>)}</div> : <div className="macro-no-evidence"><b>No event-specific Mail evidence found</b><p>The selected decision ranges remain framework thresholds, not claims about the current market state.</p></div>}</article>
    </div>
    <div className="macro-method"><ShieldAlert size={15}/><span><b>Decision sequence:</b> establish regime → test flow and rate confirmation → identify sector transmission → verify company KPIs → size the portfolio response.</span></div>
  </section>;
}

function AxisRecommendationWorkbench({ recommendations, content }: { recommendations: MailRecommendation[]; content: ContentDigestSnapshot }) {
  const [selectedSymbol, setSelectedSymbol] = useState(recommendations[0]?.symbol ?? "");
  const selected = recommendations.find((item) => item.symbol === selectedSymbol) ?? recommendations[0];
  if (!selected) return <section className="axis-workbench"><div className="live-empty"><Mail size={24}/><b>No Axis recommendation was parsed for {analysisWindowLabel(content)}</b><p>The exact iCloud → Axis Research mailbox refreshed successfully, but no qualifying BUY/HOLD/SELL target was found in readable Mail text for the selected analysis window. PDF attachments are not OCR’d into calls. No older static call is being presented as current.</p></div></section>;
  const categories = [
    { label: "Fundamental", count: recommendations.filter((item) => !item.call.includes("TECHNICAL") && !item.call.includes("TRADING")).length, tone: "green" },
    { label: "Technical", count: recommendations.filter((item) => item.call.includes("TECHNICAL")).length, tone: "blue" },
    { label: "Trading", count: recommendations.filter((item) => item.call.includes("TRADING")).length, tone: "amber" },
  ];
  const upside = selected.target && selected.cmp ? (selected.target / selected.cmp - 1) * 100 : null;
  const category = selected.call.includes("TECHNICAL") ? "Technical" : selected.call.includes("TRADING") ? "Trading" : "Fundamental";
  const detailBullets = thesisBullets(selected.thesis, { symbol: selected.symbol, name: selected.name, call: selected.call, limit: 5 });

  return <section className="axis-workbench">
    <div className="axis-audit-strip">
      <div><Mail size={18}/><span><b>{recommendations.length} mail-window calls</b><small>Parsed BUY/HOLD/SELL from iCloud → Axis Research · {analysisWindowLabel(content)}</small></span></div>
      <div><Database size={18}/><span><b>{axisArchiveAudit.validPdfs} archive PDFs</b><small>Local evidence inventory · not a stock-call count ({axisArchiveAudit.filesAttempted} files scanned)</small></span></div>
      <div className="warning"><b>{axisArchiveAudit.invalidFiles.length}</b><small>invalid non-PDF payloads</small></div>
    </div>
    <div className="axis-category-strip">{categories.map((item) => <div className={item.tone} key={item.label}><span>{item.label}</span><b>{item.count}</b><small>{item.count === 1 ? "active call" : "active calls"}</small></div>)}</div>
    <div className="axis-visual-grid">
      <nav className="axis-pick-list" aria-label="Select Axis recommendation">{recommendations.map((item) => {
        const itemUpside = item.target && item.cmp ? (item.target / item.cmp - 1) * 100 : null;
        const tone = item.call.includes("TECHNICAL") ? "blue" : item.call.includes("TRADING") ? "amber" : "green";
        return <button type="button" className={`${selected.symbol === item.symbol ? "active" : ""} ${tone}`} onClick={() => setSelectedSymbol(item.symbol)} key={item.symbol}><span><b>{item.symbol}</b><small>{item.name}</small></span><em>{itemUpside === null ? item.upside : `${itemUpside.toFixed(1)}%`}</em><i style={{width:`${Math.min(100, Math.max(8, itemUpside ?? 12))}%`}}/></button>;
      })}</nav>
      <article className="panel axis-pick-detail" style={{"--axis-color": selected.color} as CSSProperties}>
        <div className="axis-pick-heading"><div><span>{category} · {selected.date}</span><h3>{selected.name}</h3><p>{selected.symbol} · {selected.source}</p></div><span className="pill blue">{selected.call}</span></div>
        <div className="axis-numeric-grid"><div><span>CMP</span><b>{selected.cmp ? inr.format(selected.cmp) : "—"}</b></div><div><span>Target</span><b>{selected.target ? inr.format(selected.target) : "No explicit TP"}</b></div><div className={upside !== null && upside >= 0 ? "positive" : ""}><span>Indicated upside</span><b>{upside === null ? selected.upside : `${upside.toFixed(1)}%`}</b></div><div><span>Horizon</span><b>{selected.horizon}</b></div></div>
        <div className="axis-upside-track"><span style={{width:`${Math.min(100, Math.max(0, upside ?? 0) * 4)}%`}}/><i>0%</i><i>25%+</i></div>
        <ThesisBulletList bullets={detailBullets} className="axis-thesis-bullets" />
        <div className="axis-evidence"><FileText size={15}/><span><b>Evidence:</b> {selected.source} · {selected.date} · scoped to {selected.symbol}</span></div>
      </article>
    </div>
    <div className="table-note"><FileText size={16}/><span>Mail-first policy: I-6 lists symbol-deduplicated calls from readable Axis Research mail in {analysisWindowLabel(content)}. The {axisArchiveAudit.filesAttempted}-file archive audit is supplementary evidence only — it does not mean {axisArchiveAudit.filesAttempted} stock recommendations. PDF attachments are not parsed into calls. Refreshed {content.asOf}.</span></div>
  </section>;
}

export type InvestmentWorkspaceProps = {
  snapshot: KiteSnapshot;
  content: ContentDigestSnapshot;
  view: "holdings" | "activity";
  setView: (view: "holdings" | "activity") => void;
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
}: InvestmentWorkspaceProps) {
  const { holdings, portfolio, orders, gtts, marketCapAllocation, sectorAllocation, subSectorAllocation, classification, asOf } = snapshot;
  const unavailable = new Set(snapshot.unavailableSections ?? []);
  const portfolioMoney = (value: number) => hasPortfolio ? inr.format(value) : "—";

  return <>
      <div className="workspace-section">
      <CollapsibleSection number="I-1" title="Investment action board" note="Clickable daily actions, numeric advantages and strategic rationale">
        <DailyKanbanBoard workspace="investment"/>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="I-2" title="Portfolio snapshot" note="Live Kite allocation, P&L, risk composition, positions, orders and GTTs">
      <section className="metrics-strip">
        <article><span>Portfolio value</span><b>{portfolioMoney(portfolio.value)}</b><small>{hasPortfolio ? `${holdings.length} open equity exposures${isSnapshot ? " · snapshot" : ""}` : "Live Kite data required"}</small></article>
        <article><span>Unrealised P&amp;L</span><b className={portfolio.pnl>=0?"positive":"negative"}>{hasPortfolio ? `${portfolio.pnl>=0?"+":""}${inr.format(portfolio.pnl)}` : "—"}</b><small>{hasPortfolio ? `${portfolio.pnlPct>=0?"+":""}${portfolio.pnlPct.toFixed(2)}% on invested cost${isSnapshot ? " · snapshot" : ""}` : "Kite portfolio unavailable"}</small></article>
        <article><span>Top-two concentration</span><b className="warning">{hasPortfolio ? `${portfolio.topTwo.toFixed(1)}%` : "—"}</b><small>{hasPortfolio ? holdings.slice(0,2).map(h=>h.name).join(" + ") : "Calculated from Kite positions"}</small></article>
        <article><span>Available equity margin</span><b>{isLive && !unavailable.has("margins") ? inr.format(portfolio.equityMargin) : isSnapshot ? inr.format(portfolio.equityMargin) : "n/a"}</b><small>{isSnapshot ? "Last validated margin snapshot" : unavailable.has("margins") ? "Kite margins temporarily unavailable" : "Live equity segment net margin"}</small></article>
      </section>

      <section className="executive-band">
        <div className="signal"><ShieldAlert size={22}/><div><b>Portfolio stance: moderately constructive, concentration-limited</b><p>Airtel and ICICI Bank provide relative resilience; Eternal and Aether carry the highest valuation and oil-linked risk.</p></div></div>
        <div className="market-ticker"><span>AXIS RESEARCH · {analysisWindowLabel(content).toUpperCase()}</span><b>{content.sources.axisResearch.displayedCount ?? content.axisResearch.length} reports</b><small>{content.investment.latestAxisAt}</small></div>
        <div className="market-ticker"><span>NEWSLETTERS · {analysisWindowLabel(content).toUpperCase()}</span><b>{content.sources.newsletters.displayedCount ?? content.newsletters.length} items</b><small>{content.investment.latestNewsletterAt}</small></div>
      </section>
      <div className="dashboard-grid">
        <section className="panel chart-panel nested-chart-panel">
          <div className="panel-title"><div><h3>Nested portfolio allocation</h3><p>Outer: live Kite holdings and P&amp;L · upper-middle: sub-sector · lower-middle: industry · inner: AMFI market-cap tier</p></div><Gauge size={18}/></div>
          {hasPortfolio ? <><div className="nested-chart-wrap">
            <ResponsiveContainer width="100%" height={410}>
              <PieChart margin={{top:12,right:12,bottom:12,left:12}}>
                <Pie data={marketCapAllocation} dataKey="value" nameKey="name" innerRadius="18%" outerRadius="31%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="inner"/>}>{marketCapAllocation.map((item) => <Cell key={item.id ?? item.name} fill={item.color}/>)}</Pie>
                <Pie data={sectorAllocation} dataKey="value" nameKey="name" innerRadius="34%" outerRadius="50%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="industry"/>}>{sectorAllocation.map((item) => <Cell key={item.id ?? item.name} fill={item.color}/>)}</Pie>
                <Pie data={subSectorAllocation} dataKey="value" nameKey="name" innerRadius="53%" outerRadius="70%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="subsector"/>}>{subSectorAllocation.map((item) => <Cell key={item.id ?? item.name} fill={item.color}/>)}</Pie>
                <Pie data={donutHoldings} dataKey="value" nameKey="symbol" innerRadius="73%" outerRadius="96%" startAngle={90} endAngle={-270} paddingAngle={0} isAnimationActive={false} labelLine={false} label={(props) => <HoldingLabel {...props}/> }>
                  {donutHoldings.map((h,index) => <Cell key={h.symbol} fill={h.pnl >= 0 ? gainShades[index] : "#c33f47"} fillOpacity={h.dayPnl >= 0 ? 1 : .52} stroke={h.dayPnl >= 0 ? "#ffffff" : "#9b2f36"} strokeWidth={h.dayPnl >= 0 ? 2 : 1.5}/>) }
                </Pie>
                <Tooltip formatter={(value,name) => [inr.format(Number(value)),String(name)]}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="nested-center"><b className={portfolio.pnl>=0?"positive":"negative"}>{portfolio.pnl>=0?"+":""}{inr.format(portfolio.pnl)}</b><span>Unrealised · {portfolio.pnlPct>=0?"+":""}{portfolio.pnlPct.toFixed(2)}%</span><strong className={portfolio.dayPnl>=0?"positive":"negative"}>{portfolio.dayPnl>=0?"+":""}{inr.format(portfolio.dayPnl)}</strong><span>Day · {portfolio.dayPct>=0?"+":""}{portfolio.dayPct.toFixed(2)}%</span></div>
          </div>
          <div className="ring-key"><span><i className="ring outer"/>Outer · holding weight + U/Day P&amp;L</span><span><i className="ring subsector"/>Upper-middle · sub-sector</span><span><i className="ring industry"/>Lower-middle · industry</span><span><i className="ring inner"/>Inner · AMFI market-cap tier</span><span><i className="shade"/>Shaded outer segment = negative day P&amp;L</span></div><div className={"classification-audit " + (classification.pendingSymbols.length ? "pending" : "verified")}><CheckCircle2 size={14}/><span>{classification.pendingSymbols.length ? "Verification pending: " + classification.pendingSymbols.join(", ") : "Verified industry and sub-sector · " + classification.industrySource + " · " + classification.marketCapSource + " · as of " + classification.asOf}{!classification.pendingSymbols.length && <> · <a href={classification.industryUrl} target="_blank" rel="noreferrer">NSE</a> · <a href={classification.marketCapUrl} target="_blank" rel="noreferrer">AMFI</a></>}{holdings.some((holding) => holding.symbol === "ADANIGREEN") && <small>ADANIGREEN · Power Generation · Renewable Power · Large Cap #46</small>}</span></div></> : <div className="live-empty"><Activity size={24}/><b>Live allocation is unavailable</b><p>{snapshot.message}</p>{snapshot.authUrl && <a href={snapshot.authUrl} target="_blank" rel="noreferrer">Authenticate Kite <ExternalLink size={14}/></a>}</div>}
        </section>
        <section className="panel chart-panel exposure-composition-panel">
          <div className="panel-title"><div><h3>Risk composition</h3><p>Equal-weighted event and KPI drivers · each segment shows its share of the total</p></div><ShieldAlert size={18}/></div>
          {hasPortfolio ? <>
            <div className="exposure-group-key"><span><i className="event"/>EVENTS · oil, geopolitics and flows</span><span><i className="kpi"/>KPIs · valuation, liquidity, volatility and leverage</span></div>
            <div className="exposure-factor-key">{exposureFactors.map((factor) => <span key={factor.key}><i style={{background:factor.color}}/><b>{factor.label}</b><small>{factor.group}</small></span>)}</div>
            <ResponsiveContainer width="100%" height={286}>
              <BarChart data={exposureComposition} layout="vertical" margin={{top:8,right:52,bottom:6,left:2}} barCategoryGap="27%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                <XAxis type="number" domain={[0,5]} ticks={[0,1,2,3,4,5]} tick={{fontSize:10}} label={{value:"COMPOSITE MONITORING INDEX",position:"insideBottom",offset:-3,fill:"#8d97a1",fontSize:9}}/>
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
      </div>

      <section className="panel holdings-panel">
        <div className="panel-title"><div><h3>Positions</h3><p>{isLive ? "Live-session prices from Kite; no intraday quote history was available" : isSnapshot ? `Last validated Kite snapshot · ${asOf}` : "Waiting for Kite positions"}</p></div><div className="segmented"><button onClick={()=>setView("holdings")} className={view==="holdings"?"active":""}>Holdings</button><button onClick={()=>setView("activity")} className={view==="activity"?"active":""}>Orders &amp; GTTs</button></div></div>
        {view === "holdings" ? <div className="table-scroll"><table className="positions-table"><thead><tr><th>Position</th><th>Qty</th><th>Avg</th><th>Last</th><th>Value</th><th>Unrealised P&amp;L</th><th>Day P&amp;L</th><th>Weight</th><th>Quarter stance</th><th>Risk</th></tr></thead><tbody>{holdings.map(h=><tr key={h.symbol}><td><b>{h.name}</b><small className="position-symbol">{h.symbol}</small><span className="position-tags"><i>{h.sector}</i><i>{h.subSector}</i><i>{h.marketCap}</i></span></td><td>{h.qty}</td><td>{inr.format(h.avg)}</td><td>{inr.format(h.price)}</td><td>{inr.format(h.value)}</td><td className={h.pnl>=0?"positive":"negative"}>{h.pnl>=0?"+":""}{inr.format(h.pnl)}<small>{h.pnlPct>=0?"+":""}{h.pnlPct.toFixed(2)}%</small></td><td className={h.dayPnl>=0?"positive":"negative"}>{h.dayPnl>=0?"+":""}{inr.format(h.dayPnl)}<small>{h.dayPct>=0?"+":""}{h.dayPct.toFixed(2)}%</small></td><td><div className="weight-cell"><span style={{width:`${Math.min(100,h.weight*2.1)}%`,background:h.color}}/>{h.weight.toFixed(1)}%</div></td><td><b>{h.quarter}</b><small>{h.stance}</small></td><td><RiskPill value={h.risk}/></td></tr>)}{!holdings.length && <tr><td colSpan={10}><div className="table-empty">No static positions are shown. Connect Kite to load the live portfolio.</div></td></tr>}</tbody></table></div> : <div className="activity-grid"><div><h4>Orders</h4>{orders.map(o=><div className="activity-row" key={o.id}><div><b>{o.symbol}</b><small>{o.side} {o.qty} · {o.type}</small></div><strong>{inr.format(o.price)}</strong><span className={`pill ${o.status.toLowerCase()==="complete"?"green":"amber"}`}>{o.status}</span></div>)}{!orders.length&&<div className="table-empty">{unavailable.has("orders") ? "Kite orders are temporarily unavailable." : "No live orders."}</div>}</div><div><h4>GTT register</h4>{gtts.map(g=><div className="activity-row" key={g.id}><div><b>{g.symbol}</b><small>{g.side} {g.qty} · trigger {inr.format(g.trigger)}</small></div><strong>{inr.format(g.limit)}</strong><span className={`pill ${g.status.toLowerCase()==="active"?"amber":"green"}`}>{g.status}</span></div>)}{!gtts.length&&<div className="table-empty">{unavailable.has("GTTs") ? "Kite GTTs are temporarily unavailable." : "No active GTTs."}</div>}</div></div>}
      </section>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="I-3" title="Macro scenario lab" note="Select an event, its decision range and the matching Mail evidence">
        <MacroScenarioBoard eventKey={macroEventKey} bandKey={macroBandKey} onEventChange={(key) => { setMacroEventKey(key); setMacroBandKey("base"); }} onBandChange={setMacroBandKey} content={content}/>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="I-4" title="Analyst call matrix" note="Targets are reference points, not quarter forecasts">
      <section className="panel analyst-matrix">
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
        <div className="table-note"><Target size={16}/><span>Axis Mail calls from {analysisWindowLabel(content)} are prioritised and deduplicated by symbol; What matters bullets are scoped to that row’s symbol. Other houses remain explicitly labelled supplementary references. Implied upside uses each live Kite last price.</span></div>
      </section>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="I-5" title="Risk radar" note="Six-factor comparison for live holdings and current Axis recommendations">
      <section className="risk-grid">
        <article className="panel risk-panel"><div className="panel-title"><div><h3>Portfolio / holdings risk</h3><p>{livePortfolioRiskProfiles.length} current Kite holdings · selectable against live-portfolio average</p></div><ScanSearch size={18}/></div><RiskRadar profiles={livePortfolioRiskProfiles} selected={portfolioRisk} onSelect={setPortfolioRisk} averageLabel="Current portfolio average" emptyLabel="No live holding risk profiles" /></article>
        <article className="panel risk-panel"><div className="panel-title"><div><h3>Axis recommended stocks risk</h3><p>{mailWindow} · {mailAxisProfiles.length} deduplicated Axis calls from iCloud → Axis Research</p></div><Target size={18}/></div><RiskRadar profiles={mailAxisProfiles} selected={axisRisk} onSelect={setAxisRisk} averageLabel="Axis list average" emptyLabel={`No Axis risk profiles for ${mailWindow}`} /></article>
      </section>
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="I-6" title="Axis recommended stocks" note="Mail-window calls with scoped thesis · archive PDFs are evidence inventory only">
        <AxisRecommendationWorkbench recommendations={mailAxisRecommendations} content={content}/>
      </CollapsibleSection>
      </div>
  </>;
}
