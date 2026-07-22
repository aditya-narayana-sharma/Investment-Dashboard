"use client";

import { useState, type CSSProperties } from "react";
import { Activity, BarChart3, Database, ExternalLink, Gauge, Layers3, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { pestelAxes, porterAxes, sectorComposite, sectorScoreLabels, sectorSourceNote, sectors } from "../sector-data";
import { fundamentalMetricLabels, sectorCompanies, sectorUniverseLabels, type FundamentalMetricKey } from "../sector-company-data";
import { type SectorMarketSnapshot, type SectorReturnHorizon } from "../sector-live-types";
import { lifeCyclePoints, macroDials, marketStructurePoints, sectorImpactRows, squeezeWidths, type ImpactSignal } from "../sector-analytics-data";
import type { LiveHolding } from "../live-types";
import type { SectorRankingView } from "./types";
import { currentIstDateLabel, inr, matchesSelectedSector } from "./utils";

const impactGlyph: Record<ImpactSignal, string> = { tailwind: "▲", headwind: "▼", "two-way": "●", na: "—" };

function isFocused(selectedIds: string[], sectorId: string) {
  return selectedIds.length === 0 || selectedIds.includes(sectorId);
}

function SectorImpactMatrix({ selectedIds, onToggle }: { selectedIds: string[]; onToggle: (sectorId: string) => void }) {
  const headers = [["crude", "Crude"], ["inr", "USD/INR"], ["rates", "Rates"], ["monsoon", "Monsoon"], ["aiCapex", "AI capex"], ["earnings", "Q1 earnings"]] as const;
  return <article className="panel impact-matrix-panel">
    <div className="analytics-subhead"><div><b>A · Sector map + impact matrix (MECE)</b><span>One row per sector · ▲ tailwind · ▼ headwind · ● two-way</span></div><em>{currentIstDateLabel().toUpperCase()}</em></div>
    <div className="impact-matrix-scroll"><div className="impact-matrix">
      <div className="impact-row impact-head"><span>Sector &amp; stance</span><span>Sub-sectors</span>{headers.map(([, label]) => <span key={label}>{label}</span>)}<span>Current read</span></div>
      {sectorImpactRows.map((row) => {
        const selectable = sectors.some((sector) => sector.id === row.id);
        const selected = selectedIds.includes(row.id);
        const rowClass = selectedIds.length === 0 ? "" : selected ? "selected" : "sector-dimmed";
        return <button type="button" onClick={() => selectable && onToggle(row.id)} aria-pressed={selected} aria-disabled={!selectable} className={`impact-row ${rowClass} ${selectable ? "selectable" : "reference-only"}`} style={{ "--sector": row.color } as CSSProperties} key={row.id}>
          <span><b>{row.name}</b><small>{row.stance}</small></span><span className="subsector-chips">{row.subsectors.map((item) => <i key={item}>{item}</i>)}</span>
          {headers.map(([key, label]) => <span className={`signal ${row[key]}`} data-label={label} key={key}>{impactGlyph[row[key]]}</span>)}<span className="impact-read">{row.read}</span>
        </button>;
      })}
    </div></div>
  </article>;
}

function BubbleLabel({ x = 0, y = 0, value = "", activeNames = new Set<string>(), filterActive = false }: { x?: number; y?: number; value?: string; activeNames?: Set<string>; filterActive?: boolean }) {
  const selected = activeNames.has(value);
  const className = !filterActive ? "selected" : selected ? "selected" : "dimmed";
  return <text x={x} y={y - 12} textAnchor="middle" className={`bubble-label ${className}`}>{value}</text>;
}

function SectorAnalyticalCharts({ selectedIds, holdings }: { selectedIds: string[]; holdings: LiveHolding[] }) {
  const filterActive = selectedIds.length > 0;
  const selectedLife = lifeCyclePoints.filter((point) => isFocused(selectedIds, point.id));
  const selectedStructure = marketStructurePoints.filter((point) => isFocused(selectedIds, point.id));
  const activeLifeNames = new Set(selectedLife.map((point) => point.name));
  const activeStructureNames = new Set(selectedStructure.map((point) => point.name));
  const heldSymbols = new Set(holdings.map((holding) => holding.symbol));
  const relevantDialNames = selectedIds.includes("energy") || selectedIds.length === 0
    ? new Set(["Brent", "USD / INR", "Nifty", "India VIX"])
    : selectedIds.includes("banking") || selectedIds.includes("nbfc")
      ? new Set(["USD / INR", "Nifty", "Bank Nifty", "India VIX"])
      : new Set(["Brent", "USD / INR", "Nifty", "India VIX"]);
  return <div className="sector-analytical-stack">
    <section className="analytics-band"><div className="analytics-subhead"><b>C · Industry life cycle</b><span>Growth stage, expected revenue growth and relative profit pool</span></div><div className="analytics-split bubble-split">
      <article className="panel bubble-panel"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 28, right: 30, bottom: 38, left: 14 }}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="stage" domain={[0.6,5.2]} ticks={[1,2,3,4,5]} tickFormatter={(value) => (["", "Growth", "Shakeout", "Mature", "Decline", "Legacy"][Number(value)] ?? "")}/><YAxis type="number" dataKey="growth" unit="%"/><ZAxis type="number" dataKey="profit" range={[120, 900]}/><ReferenceLine y={10} stroke="#65717c" strokeDasharray="5 5"/><Tooltip cursor={{strokeDasharray:"3 3"}} formatter={(value,name) => [name === "growth" ? `${value}%` : value, String(name)]}/><Scatter data={lifeCyclePoints} name="Subsectors" shape="circle">{lifeCyclePoints.map((point) => {
        const focused = isFocused(selectedIds, point.id);
        return <Cell key={point.name} fill={point.color} fillOpacity={!filterActive || focused ? 1 : .12} stroke={!filterActive || focused ? "#fff" : point.color} strokeOpacity={!filterActive || focused ? 1 : .18} strokeWidth={!filterActive || focused ? 3 : 1}/>;
      }) }<LabelList dataKey="name" content={<BubbleLabel activeNames={activeLifeNames} filterActive={filterActive}/>}/></Scatter></ScatterChart></ResponsiveContainer></article>
      <aside className="panel linked-insight">
        <h4>Where your money actually sits</h4>
        <div className="linked-insight-scroll" role="list">
          {selectedLife.length
            ? selectedLife.map((point) => <div role="listitem" key={point.name} style={{"--sector":point.color} as CSSProperties}><b>{point.name}</b><span>Expected growth {point.growth}% · profit pool {point.profit}</span></div>)
            : <p>Select a plotted sector to isolate its subsectors.</p>}
        </div>
        <p className="linked-insight-note">White outlines identify selected or portfolio-linked sectors. Bubble area represents relative profit pool, not market capitalisation.</p>
      </aside>
    </div></section>
    <section className="analytics-band"><div className="analytics-subhead"><b>D · Market structure + value-chain sweet spot</b><span>Profitability versus concentration</span></div><div className="analytics-split bubble-split">
      <article className="panel bubble-panel"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 28, right: 28, bottom: 34, left: 12 }}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="margin" unit="%" name="Operating margin"/><YAxis type="number" dataKey="concentration" domain={[1.5,5.2]} name="Concentration"/><ZAxis type="number" dataKey="profit" range={[140,900]}/><ReferenceLine x={20} stroke="#65717c" strokeDasharray="5 5"/><ReferenceLine y={3.5} stroke="#65717c" strokeDasharray="5 5"/><Tooltip/><Scatter data={marketStructurePoints}>{marketStructurePoints.map((point) => {
        const focused = isFocused(selectedIds, point.id);
        return <Cell key={point.name} fill={point.color} fillOpacity={!filterActive || focused ? 1 : .12} stroke={!filterActive || focused ? "#fff" : point.color} strokeOpacity={!filterActive || focused ? 1 : .18} strokeWidth={!filterActive || focused ? 3 : 1}/>;
      }) }<LabelList dataKey="name" content={<BubbleLabel activeNames={activeStructureNames} filterActive={filterActive}/>}/></Scatter></ScatterChart></ResponsiveContainer></article>
      <aside className="panel linked-insight">
        <h4>Value-chain sweet spot</h4>
        <div className="linked-insight-scroll" role="list">
          {(selectedStructure.length ? selectedStructure : marketStructurePoints.slice(0,4)).map((point) => <div role="listitem" key={point.name} style={{"--sector":point.color} as CSSProperties}><b>{point.name}</b><span>{point.margin}% margin · {point.concentration.toFixed(1)}/5 concentration</span></div>)}
        </div>
        <p className="linked-insight-note">Top-right combines stronger operating economics with concentrated profit pools; verify regulation and valuation before treating it as attractive.</p>
      </aside>
    </div></section>
    <section className="analytics-band"><div className="analytics-subhead"><b>E · Macro dials + volatility squeeze watch</b><span>Distance to decision triggers and current band width</span></div><div className="analytics-split macro-chart-split">
      <article className="panel macro-dial-list">{macroDials.map((dial) => {
        const focused = !filterActive || relevantDialNames.has(dial.name);
        const position = (dial.value-dial.min)/(dial.max-dial.min)*100;
        const trigger = (dial.trigger-dial.min)/(dial.max-dial.min)*100;
        return <div className={focused ? "selected" : "sector-dimmed"} key={dial.name}><header><b>{dial.name}</b><span>{dial.unit}{dial.value.toLocaleString("en-IN")}</span></header><div><i style={{width:`${Math.max(0,Math.min(100,position))}%`}} className={dial.tone}/><em style={{left:`${Math.max(0,Math.min(100,trigger))}%`}}/></div><small>Trigger {dial.unit}{dial.trigger.toLocaleString("en-IN")}</small></div>;
      })}</article>
      <article className="panel squeeze-chart"><ResponsiveContainer width="100%" height={300}><BarChart data={squeezeWidths} layout="vertical" margin={{top:10,right:34,bottom:18,left:16}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" unit="%"/><YAxis type="category" dataKey="name" width={82}/><Tooltip formatter={(value)=>[`${value}% of price`,"Band width"]}/><Bar dataKey="value" radius={[0,4,4,0]}>{squeezeWidths.map((item)=>{
        const selectedCompany = selectedIds.some((sectorId) => (sectorCompanies[sectorId] ?? []).some((company) => company.symbol === item.name) || (heldSymbols.has(item.name) && matchesSelectedSector(sectorId, item.name)));
        const focused = !filterActive || selectedCompany;
        return <Cell key={item.name} fill={item.color} fillOpacity={focused ? 1 : .18}/>;
      })}<LabelList dataKey="value" position="right" formatter={(value)=>`${value}%`}/></Bar></BarChart></ResponsiveContainer></article>
    </div></section>
  </div>;
}

export default function SectoralAnalytics({ selectedIds, onToggle, market, marketsBySector = {}, holdings }: { selectedIds: string[]; onToggle: (sectorId: string) => void; market: SectorMarketSnapshot; marketsBySector?: Record<string, SectorMarketSnapshot>; holdings: LiveHolding[] }) {
  const [rankingView, setRankingView] = useState<SectorRankingView>("market");
  const [returnHorizon, setReturnHorizon] = useState<SectorReturnHorizon>("month");
  const [fundamentalMetric, setFundamentalMetric] = useState<FundamentalMetricKey>("growth");
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const filterActive = selectedIds.length > 0;
  const primaryId = selectedIds[selectedIds.length - 1] ?? null;
  const selected = primaryId ? sectors.find((sector) => sector.id === primaryId) ?? null : null;
  const accent = selected?.color ?? "#4c8fff";
  const pulseData = sectors.map((sector) => ({
    name: sector.name,
    color: sector.color,
    composite: Number(sectorComposite(sector).toFixed(1)),
    ...Object.fromEntries(sectorScoreLabels.map(({ key }) => [key, Number((sector.scores[key] / sectorScoreLabels.length).toFixed(2))])),
  }));
  const pestelData = selected ? pestelAxes.map((axis, index) => ({ axis, score: selected.pestel[index] })) : [];
  const porterData = selected ? porterAxes.map((axis, index) => ({
    axis,
    score: selected.porter[index],
    median: Number((sectors.reduce((sum, sector) => sum + sector.porter[index], 0) / sectors.length).toFixed(1)),
  })) : [];
  const marketBySymbol = new Map<string, SectorMarketSnapshot["companies"][number]>();
  for (const snapshot of Object.values(marketsBySector)) {
    for (const company of snapshot.companies) marketBySymbol.set(company.symbol, company);
  }
  for (const company of market.companies) marketBySymbol.set(company.symbol, company);
  const holdingBySymbol = new Map(holdings.map((holding) => [holding.symbol, holding]));
  const companies = selected ? (sectorCompanies[selected.id] ?? []).map((company) => ({ ...company, market: marketBySymbol.get(company.symbol), holding: holdingBySymbol.get(company.symbol) })) : [];
  const ranked = companies.map((company) => ({
    ...company,
    rankValue: rankingView === "market" ? company.market?.returns[returnHorizon] ?? null : company.scores[fundamentalMetric],
  })).filter((company) => company.rankValue !== null).sort((a, b) => Number(b.rankValue) - Number(a.rankValue));
  const rankCount = Math.min(5, Math.floor(ranked.length / 2));
  const leaders = ranked.slice(0, rankCount);
  const laggards = ranked.slice(-rankCount).reverse();
  const priced = companies.filter((company) => company.market?.returns.day !== null && company.market?.returns.day !== undefined);
  const advancers = priced.filter((company) => Number(company.market?.returns.day) > 0).length;
  const decliners = priced.filter((company) => Number(company.market?.returns.day) < 0).length;
  const monthlyReturns = companies.map((company) => company.market?.returns.month).filter((value): value is number => value !== null && value !== undefined).sort((a, b) => a - b);
  const medianMonth = monthlyReturns.length ? monthlyReturns[Math.floor(monthlyReturns.length / 2)] : null;

  const crossIndustryCompanies = sectors.flatMap((sector) => (sectorCompanies[sector.id] ?? []).map((company) => ({
    ...company,
    sectorId: sector.id,
    sectorName: sector.name,
    sectorColor: sector.color,
    market: marketBySymbol.get(company.symbol),
    holding: holdingBySymbol.get(company.symbol),
  })));
  const crossPriced = crossIndustryCompanies.filter((company) => company.market?.returns.day !== null && company.market?.returns.day !== undefined);
  const crossAdvancers = crossPriced.filter((company) => Number(company.market?.returns.day) > 0).length;
  const crossDecliners = crossPriced.filter((company) => Number(company.market?.returns.day) < 0).length;
  const crossUnchanged = crossPriced.length - crossAdvancers - crossDecliners;
  const crossMonthly = crossIndustryCompanies.map((company) => company.market?.returns.month).filter((value): value is number => value !== null && value !== undefined).sort((a, b) => a - b);
  const crossMedianMonth = crossMonthly.length ? crossMonthly[Math.floor(crossMonthly.length / 2)] : null;
  const industryBreadth = sectors.map((sector) => {
    const names = sectorCompanies[sector.id] ?? [];
    const pricedNames = names.map((company) => marketBySymbol.get(company.symbol)).filter((row) => row?.returns.day !== null && row?.returns.day !== undefined);
    const up = pricedNames.filter((row) => Number(row?.returns.day) > 0).length;
    const down = pricedNames.filter((row) => Number(row?.returns.day) < 0).length;
    const dayReturns = pricedNames.map((row) => Number(row?.returns.day)).filter((value) => Number.isFinite(value));
    const avgDay = dayReturns.length ? dayReturns.reduce((sum, value) => sum + value, 0) / dayReturns.length : null;
    return {
      id: sector.id,
      name: sector.name,
      color: sector.color,
      composite: sectorComposite(sector),
      pulse: sector.pulse,
      stance: sector.stance,
      tracked: names.length,
      priced: pricedNames.length,
      advancers: up,
      decliners: down,
      avgDay,
      snapshot: marketsBySector[sector.id],
    };
  });
  const industriesAdvancing = industryBreadth.filter((row) => row.priced > 0 && row.advancers > row.decliners).length;
  const industriesDeclining = industryBreadth.filter((row) => row.priced > 0 && row.decliners > row.advancers).length;
  const crossRanked = crossIndustryCompanies.map((company) => ({
    ...company,
    rankValue: company.market?.returns[returnHorizon] ?? null,
  })).filter((company) => company.rankValue !== null).sort((a, b) => Number(b.rankValue) - Number(a.rankValue));
  const crossLeaders = crossRanked.slice(0, 5);
  const crossLaggards = crossRanked.slice(-5).reverse();
  const marketSnapshots = Object.values(marketsBySector);
  const crossMarketStatus = marketSnapshots.some((item) => item.status === "live")
    ? "live"
    : marketSnapshots.some((item) => item.status === "public_delayed")
      ? "public_delayed"
      : marketSnapshots.some((item) => item.status === "cached")
        ? "cached"
        : marketSnapshots.some((item) => item.status === "auth_required")
          ? "auth_required"
          : "unavailable";
  const crossMarketAsOf = marketSnapshots.find((item) => item.status === crossMarketStatus)?.asOf
    ?? marketSnapshots.find((item) => item.asOf)?.asOf
    ?? market.asOf;
  const crossMarketMessage = marketSnapshots.find((item) => item.status === crossMarketStatus)?.message
    ?? market.message
    ?? "Waiting for sector market refresh across all industries.";
  const avgComposite = Number((sectors.reduce((sum, sector) => sum + sectorComposite(sector), 0) / sectors.length).toFixed(1));

  const meceEmojis = ["📈", "💰", "⚖️", "⚠️"];
  const meceBullets = (driver: string) => {
    const parts = driver.split(/\s(?:\+|and|versus)\s|,\s/).map((part) => part.trim()).filter(Boolean).slice(0, 3);
    return parts.length > 1 ? parts : [driver, "Track direction and rate of change"];
  };
  const formatRankValue = (value: number | null) => value === null ? "—" : rankingView === "market" ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : `${value.toFixed(1)} / 5`;
  const formatDay = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  const selectedNames = selectedIds.map((id) => sectors.find((sector) => sector.id === id)?.name ?? id).join(", ");

  return <section className="sector-overview" data-sector-filter={filterActive ? selectedIds.join(",") : "all"} style={{ "--selected-sector": accent } as CSSProperties}>
    <div className="sector-lead" style={{ "--sector": accent } as CSSProperties}>
      <div>
        <span>INDIA SECTOR PULSE · REVIEWED THROUGH {currentIstDateLabel().toUpperCase()}</span>
        <h3>{selected ? `${selected.name}: ${selected.stance}` : "All industries"}</h3>
        <p>{selected ? selected.summary : "All industries are shown at full strength. Select one or more industries to focus analytics and dim the rest. Deselect the last industry to restore the full view."}</p>
      </div>
      <div className="sector-lead-score"><b>{selected ? sectorComposite(selected).toFixed(1) : sectors.length}</b><span>{selected ? "/ 5 composite" : "industries"}</span><em>{selected ? selected.pulse : "unfiltered"}</em></div>
    </div>

    <div className="sector-filter-status" style={{ "--sector": accent } as CSSProperties}>
      <span>{filterActive ? "ACTIVE INDUSTRY FILTER" : "ALL INDUSTRIES"}</span>
      <b>{filterActive ? selectedNames : "No filter"}</b>
      <small>{filterActive
        ? `${selectedIds.length} selected · dimmed industries remain available as toggles · click a selected industry again to remove it`
        : "Select any industry to dim the others. Multiple industries can stay selected together."}</small>
    </div>
    <div className="sector-selector" role="toolbar" aria-label="Filter every Sectoral Analytics section by industry">
      {sectors.map((sector) => {
        const selected = selectedIds.includes(sector.id);
        const className = !filterActive ? "active" : selected ? "active" : "sector-dimmed";
        return <button type="button" aria-pressed={selected} key={sector.id} onClick={() => { onToggle(sector.id); setShowAllCompanies(false); }} className={className} style={{ "--sector": sector.color } as CSSProperties}><i/><span>{sector.name}</span><small>{sectorComposite(sector).toFixed(1)}</small></button>;
      })}
    </div>

    <SectorImpactMatrix selectedIds={selectedIds} onToggle={(sectorId) => { if (sectors.some((sector) => sector.id === sectorId)) onToggle(sectorId); }}/>

    {selected ? <>
      <div className="sector-kpi-grid">
        {selected.kpis.map((kpi) => <article key={kpi.label} title={`${selected.sourceLabel} · ${kpi.context}`} style={{ "--sector": selected.color } as CSSProperties}><span>{kpi.label}</span><b>{kpi.value}</b><small>{kpi.context}</small></article>)}
        <article className="sector-watch" style={{ "--sector": selected.color } as CSSProperties}><span>MONITOR NEXT</span><p>{selected.watch}</p></article>
      </div>

      <article className="panel sector-company-workbench" style={{ "--sector": selected.color } as CSSProperties}>
        <div className="panel-title sector-company-title"><div><h3>Company composition and performance</h3><p>{sectorUniverseLabels[selected.id]} · {companies.length} tracked companies · {market.status === "live" ? "live Kite market data" : market.status === "public_delayed" ? "public delayed market data" : `market data ${market.status}`}</p></div><span className={`pill ${market.status === "live" ? "green" : market.status === "cached" || market.status === "public_delayed" ? "amber" : "red"}`}>{market.status === "live" ? "LIVE KITE" : market.status === "public_delayed" ? "PUBLIC DELAYED" : market.status.toUpperCase()}</span></div>
        <div className="sector-breadth-strip">
          <div><span>Universe coverage</span><b>{companies.reduce((sum, company) => sum + company.universeShare, 0).toFixed(0)}%</b><small>Research-snapshot share</small></div>
          <div><span>Advancers</span><b className="positive">{priced.length ? advancers : "—"}</b><small>{market.status === "live" ? "Latest Kite session" : market.status === "public_delayed" ? "Public delayed session" : "Latest available session"}</small></div>
          <div><span>Decliners</span><b className="negative">{priced.length ? decliners : "—"}</b><small>{market.status === "live" ? "Latest Kite session" : market.status === "public_delayed" ? "Public delayed session" : "Latest available session"}</small></div>
          <div><span>Median 1M return</span><b className={medianMonth === null ? "" : medianMonth >= 0 ? "positive" : "negative"}>{medianMonth === null ? "—" : `${medianMonth >= 0 ? "+" : ""}${medianMonth.toFixed(2)}%`}</b><small>{market.asOf}</small></div>
        </div>
        {market.status === "public_delayed" && <div className="sector-market-source-note"><Activity size={16}/><span><b>Public delayed fallback active</b>{market.message}</span><a href="https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/what-are-the-charges-for-kite-apis" target="_blank" rel="noreferrer">Kite data plans <ExternalLink size={12}/></a></div>}
        <div className="sector-ranking-controls">
          <div className="segmented" aria-label="Ranking model"><button type="button" className={rankingView === "market" ? "active" : ""} onClick={() => setRankingView("market")}>Market performance</button><button type="button" className={rankingView === "fundamentals" ? "active" : ""} onClick={() => setRankingView("fundamentals")}>Fundamentals</button></div>
          {rankingView === "market" ? <label>Return horizon<select value={returnHorizon} onChange={(event) => setReturnHorizon(event.target.value as SectorReturnHorizon)}><option value="day">1 day</option><option value="week">1 week</option><option value="month">1 month</option><option value="quarter">3 months</option></select></label> : <label>Research metric<select value={fundamentalMetric} onChange={(event) => setFundamentalMetric(event.target.value as FundamentalMetricKey)}>{Object.entries(fundamentalMetricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        </div>
        {ranked.length ? <div className="sector-rank-grid">
          <section><div className="sector-rank-heading positive"><span>Top {leaders.length} leaders</span><small>{rankingView === "market" ? `${returnHorizon} price return` : fundamentalMetricLabels[fundamentalMetric]}</small></div>{leaders.map((company, index) => <div className="sector-rank-row" key={`leader-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.universeShare}% universe share</small></div><strong className={Number(company.rankValue) >= 0 ? "positive" : "negative"}>{formatRankValue(company.rankValue)}</strong></div>)}</section>
          <section><div className="sector-rank-heading negative"><span>Top {laggards.length} laggards</span><small>{rankingView === "market" ? `${returnHorizon} price return` : fundamentalMetricLabels[fundamentalMetric]}</small></div>{laggards.map((company, index) => <div className="sector-rank-row" key={`laggard-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.universeShare}% universe share</small></div><strong className={rankingView === "market" && Number(company.rankValue) < 0 ? "negative" : "amber-text"}>{formatRankValue(company.rankValue)}</strong></div>)}</section>
        </div> : <div className="sector-market-empty"><Activity size={20}/><div><b>{market.status === "auth_required" ? "Authenticate Kite to load return rankings" : "Market return ranking is temporarily unavailable"}</b><p>{market.message}</p></div></div>}
        {rankingView === "fundamentals" && <p className="sector-model-note">Fundamental values are transparent 1-5 research scores, not reported percentages. They rank relative growth, profitability, margin resilience and balance-sheet quality; company filing ingestion remains separately dated.</p>}
        <div className="sector-company-table table-scroll"><table><thead><tr><th>Company</th><th>Universe share</th><th>Live price</th><th>1D</th><th>1W</th><th>1M</th><th>3M</th><th>Growth</th><th>Profitability</th><th>Margin</th><th>Quality</th><th>Portfolio</th></tr></thead><tbody>{companies.slice(0, showAllCompanies ? companies.length : 6).map((company) => <tr key={company.symbol}><td><b>{company.name}</b><small>{company.symbol} · {company.filingPeriod}</small></td><td>{company.universeShare.toFixed(1)}%</td><td>{company.market?.price === null || company.market?.price === undefined ? "—" : inr.format(company.market.price)}</td>{(["day", "week", "month", "quarter"] as SectorReturnHorizon[]).map((horizon) => { const value = company.market?.returns[horizon]; return <td key={horizon} className={value === null || value === undefined ? "" : value >= 0 ? "positive" : "negative"}>{value === null || value === undefined ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`}</td>; })}<td>{company.scores.growth.toFixed(1)}</td><td>{company.scores.profitability.toFixed(1)}</td><td>{company.scores.margin.toFixed(1)}</td><td>{company.scores.quality.toFixed(1)}</td><td>{company.holding ? <span className="portfolio-company"><b>OWNED</b><small>U {company.holding.pnl >= 0 ? "+" : ""}{inr.format(company.holding.pnl)} · Day {company.holding.dayPnl >= 0 ? "+" : ""}{inr.format(company.holding.dayPnl)}</small></span> : "—"}</td></tr>)}</tbody></table></div>
        <button className="sector-company-toggle" type="button" onClick={() => setShowAllCompanies((value) => !value)}>{showAllCompanies ? "Show compact composition" : `Show all ${companies.length} companies`}</button>
      </article>
    </> : <>
      <div className="sector-kpi-grid">
        <article style={{ "--sector": accent } as CSSProperties}><span>Tracked companies</span><b>{crossIndustryCompanies.length}</b><small>Across {sectors.length} industries</small></article>
        <article style={{ "--sector": "#42d98b" } as CSSProperties}><span>Advancers</span><b className="positive">{crossPriced.length ? crossAdvancers : "—"}</b><small>{crossPriced.length ? `${crossUnchanged} unchanged · ${crossPriced.length} priced` : "Awaiting market quotes"}</small></article>
        <article style={{ "--sector": "#ff6b72" } as CSSProperties}><span>Decliners</span><b className="negative">{crossPriced.length ? crossDecliners : "—"}</b><small>{crossMarketStatus === "live" ? "Latest Kite session" : crossMarketStatus === "public_delayed" ? "Public delayed session" : "Latest available session"}</small></article>
        <article style={{ "--sector": accent } as CSSProperties}><span>Industries advancing</span><b className={industriesAdvancing >= industriesDeclining ? "positive" : "negative"}>{crossPriced.length ? `${industriesAdvancing} / ${sectors.length}` : "—"}</b><small>{industriesDeclining} industries declining on breadth</small></article>
        <article style={{ "--sector": accent } as CSSProperties}><span>Median 1M return</span><b className={crossMedianMonth === null ? "" : crossMedianMonth >= 0 ? "positive" : "negative"}>{crossMedianMonth === null ? "—" : formatDay(crossMedianMonth)}</b><small>{crossMarketAsOf}</small></article>
        <article className="sector-watch" style={{ "--sector": accent } as CSSProperties}><span>ALL-INDUSTRY READ</span><p>Average composite {avgComposite} / 5. Select an industry for company composition, KPI cards and framework detail.</p></article>
      </div>

      <article className="panel sector-company-workbench">
        <div className="panel-title sector-company-title"><div><h3>Cross-industry breadth and common data</h3><p>Advances / declines for every tracked industry · {crossIndustryCompanies.length} companies · {crossMarketStatus === "live" ? "live Kite market data" : crossMarketStatus === "public_delayed" ? "public delayed market data" : `market data ${crossMarketStatus}`}</p></div><span className={`pill ${crossMarketStatus === "live" ? "green" : crossMarketStatus === "cached" || crossMarketStatus === "public_delayed" ? "amber" : "red"}`}>{crossMarketStatus === "live" ? "LIVE KITE" : crossMarketStatus === "public_delayed" ? "PUBLIC DELAYED" : crossMarketStatus.toUpperCase()}</span></div>
        <div className="sector-breadth-strip">
          <div><span>Priced names</span><b>{crossPriced.length || "—"}</b><small>of {crossIndustryCompanies.length} tracked</small></div>
          <div><span>Advancers</span><b className="positive">{crossPriced.length ? crossAdvancers : "—"}</b><small>Day return &gt; 0</small></div>
          <div><span>Decliners</span><b className="negative">{crossPriced.length ? crossDecliners : "—"}</b><small>Day return &lt; 0</small></div>
          <div><span>Industry breadth</span><b className={industriesAdvancing >= industriesDeclining ? "positive" : "negative"}>{crossPriced.length ? `${industriesAdvancing}↑ ${industriesDeclining}↓` : "—"}</b><small>{crossMarketAsOf}</small></div>
        </div>
        {(crossMarketStatus === "public_delayed" || crossMarketStatus === "auth_required") && <div className="sector-market-source-note"><Activity size={16}/><span><b>{crossMarketStatus === "auth_required" ? "Kite authentication required" : "Public delayed fallback active"}</b>{crossMarketMessage}</span><a href="https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/what-are-the-charges-for-kite-apis" target="_blank" rel="noreferrer">Kite data plans <ExternalLink size={12}/></a></div>}
        <div className="sector-ranking-controls">
          <label>Return horizon<select value={returnHorizon} onChange={(event) => setReturnHorizon(event.target.value as SectorReturnHorizon)}><option value="day">1 day</option><option value="week">1 week</option><option value="month">1 month</option><option value="quarter">3 months</option></select></label>
          <small className="sector-all-industry-hint">Showing common breadth across all industries. Pick an industry above for single-sector KPIs and the full company table.</small>
        </div>
        <div className="industry-breadth-table table-scroll">
          <table>
            <thead><tr><th>Industry</th><th>Pulse</th><th>Composite</th><th>Tracked</th><th>Advancers</th><th>Decliners</th><th>Avg 1D</th><th>Market</th></tr></thead>
            <tbody>
              {industryBreadth.map((row) => <tr key={row.id}>
                <td><button type="button" className="industry-breadth-name" style={{ "--sector": row.color } as CSSProperties} onClick={() => onToggle(row.id)}><i/><b>{row.name}</b><small>{row.stance}</small></button></td>
                <td>{row.pulse}</td>
                <td>{row.composite.toFixed(1)} / 5</td>
                <td>{row.tracked}</td>
                <td className="positive">{row.priced ? row.advancers : "—"}</td>
                <td className="negative">{row.priced ? row.decliners : "—"}</td>
                <td className={row.avgDay === null ? "" : row.avgDay >= 0 ? "positive" : "negative"}>{formatDay(row.avgDay)}</td>
                <td>{row.snapshot?.status?.replace(/_/g, " ") ?? "pending"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {crossRanked.length ? <div className="sector-rank-grid">
          <section><div className="sector-rank-heading positive"><span>Top {crossLeaders.length} leaders</span><small>{returnHorizon} price return · all industries</small></div>{crossLeaders.map((company, index) => <div className="sector-rank-row" key={`cross-leader-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.sectorName}</small></div><strong className={Number(company.rankValue) >= 0 ? "positive" : "negative"}>{formatDay(company.rankValue)}</strong></div>)}</section>
          <section><div className="sector-rank-heading negative"><span>Top {crossLaggards.length} laggards</span><small>{returnHorizon} price return · all industries</small></div>{crossLaggards.map((company, index) => <div className="sector-rank-row" key={`cross-laggard-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.sectorName}</small></div><strong className={Number(company.rankValue) < 0 ? "negative" : "amber-text"}>{formatDay(company.rankValue)}</strong></div>)}</section>
        </div> : <div className="sector-market-empty"><Activity size={20}/><div><b>{crossMarketStatus === "auth_required" ? "Authenticate Kite to load cross-industry rankings" : "Cross-industry return ranking is loading or unavailable"}</b><p>{crossMarketMessage}</p></div></div>}
      </article>
    </>}

    <SectorAnalyticalCharts selectedIds={selectedIds} holdings={holdings}/>

    <div className="sector-chart-grid">
      <article className="panel sector-pulse-panel">
        <div className="panel-title"><div><h3>All-sector momentum composition</h3><p>Five equal-weighted pillars · segment width shows its contribution to the 1-5 composite</p></div><BarChart3 size={18}/></div>
        <div className="sector-score-key">{sectorScoreLabels.map(({ key, label }, index) => <span key={key}><i style={{opacity:1-index*.13}}/>{label}</span>)}</div>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={pulseData} layout="vertical" margin={{top:8,right:48,bottom:8,left:6}} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
            <XAxis type="number" domain={[0,5]} ticks={[0,1,2,3,4,5]} tick={{fill:"#fff",fontSize:10}}/>
            <YAxis dataKey="name" type="category" width={84} tick={{fill:"#fff",fontSize:10,fontWeight:800}}/>
            <Tooltip formatter={(value, name) => [`${(Number(value) * sectorScoreLabels.length).toFixed(1)} / 5 raw`, sectorScoreLabels.find((item) => item.key === name)?.label ?? String(name)]} labelFormatter={(label) => `${label} · sector color is consistent across the section`}/>
            {sectorScoreLabels.map(({ key }, factorIndex) => <Bar key={key} dataKey={key} stackId="sector-pulse" isAnimationActive={false} radius={factorIndex === sectorScoreLabels.length - 1 ? [0,3,3,0] : 0}>
              {sectors.map((sector) => <Cell key={`${key}-${sector.id}`} fill={sector.color} fillOpacity={isFocused(selectedIds, sector.id) ? 1-factorIndex*.13 : .1}/>) }
              {factorIndex === sectorScoreLabels.length - 1 && <LabelList dataKey="composite" position="right" className="sector-total-label" formatter={(value) => `${Number(value).toFixed(1)}/5`}/>}
            </Bar>)}
          </BarChart>
        </ResponsiveContainer>
      </article>

      {selected ? <article className="panel sector-pestel-panel" style={{ "--sector": selected.color } as CSSProperties}>
        <div className="panel-title"><div><h3>PESTEL tailwind radar</h3><p>{selected.name} · higher score means a more supportive external environment</p></div><Layers3 size={18}/></div>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={pestelData} outerRadius="70%" margin={{top:18,right:42,bottom:18,left:42}}>
            <PolarGrid stroke="#49515a"/>
            <PolarAngleAxis dataKey="axis" tick={{fill:"#fff",fontSize:10,fontWeight:800}}/>
            <PolarRadiusAxis angle={90} domain={[0,5]} tickCount={6} tick={{fill:"#dfe5ec",fontSize:8}}/>
            <Radar name={`${selected.name} PESTEL support`} dataKey="score" stroke={selected.color} fill={selected.color} fillOpacity={.3} strokeWidth={2.5} isAnimationActive={false}/>
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 5`, "Tailwind intensity"]}/>
          </RadarChart>
        </ResponsiveContainer>
        <p className="sector-chart-note">Political, economic, social, technology, environmental and legal conditions are scored independently. This radar measures supportiveness, not risk.</p>
      </article> : <article className="panel sector-pestel-panel"><div className="panel-title"><div><h3>PESTEL tailwind radar</h3><p>Select an industry to load its PESTEL support radar</p></div><Layers3 size={18}/></div><div className="sector-market-empty"><Layers3 size={20}/><div><b>Waiting for an industry selection</b><p>PESTEL detail follows the latest selected industry.</p></div></div></article>}
    </div>

    {selected ? <div className="sector-framework-grid">
      <article className="panel porter-panel" style={{ "--sector": selected.color } as CSSProperties}>
        <div className="panel-title"><div><h3>Porter competitive-pressure radar</h3><p>{selected.name} versus the all-sector median · higher means greater pressure</p></div><Target size={18}/></div>
        <ResponsiveContainer width="100%" height={300}><RadarChart data={porterData} outerRadius="67%" margin={{top:20,right:56,bottom:18,left:56}}><PolarGrid stroke="#49515a"/><PolarAngleAxis dataKey="axis" tick={{fill:"#fff",fontSize:9,fontWeight:800}}/><PolarRadiusAxis angle={90} domain={[0,5]} tickCount={6} tick={{fill:"#dfe5ec",fontSize:8}}/><Radar name="All-sector median" dataKey="median" stroke="#9ca4ad" fill="#9ca4ad" fillOpacity={.08} strokeDasharray="5 4" isAnimationActive={false}/><Radar name={selected.name} dataKey="score" stroke={selected.color} fill={selected.color} fillOpacity={.3} strokeWidth={2.5} isAnimationActive={false}/><Legend/><Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} / 5`, String(name)]}/></RadarChart></ResponsiveContainer>
        <p className="sector-chart-note">Competitive intensity, bargaining leverage, input dependence, substitutes and entry risk are scored independently from 1 (lower pressure) to 5 (higher pressure).</p>
      </article>
      <article className="panel framework-interpretation" style={{ "--sector": selected.color } as CSSProperties}>
        <div className="panel-title"><div><h3>What the shape means</h3><p>{selected.name} · evidence-led interpretation</p></div><Gauge size={18}/></div>
        <h4>{selected.stance}</h4><p>{selected.summary}</p><div className="framework-pressure-list">{porterAxes.map((axis,index) => <div key={axis}><span>{axis}</span><b>{selected.porter[index].toFixed(1)} / 5</b><i style={{width:`${selected.porter[index]/5*100}%`}}/></div>)}</div><small><b>Monitor:</b> {selected.watch}</small>
      </article>
    </div> : null}

    <article className="panel mece-panel">
      <div className="panel-title"><div><h3>MECE sector driver map</h3><p>Every sector is decomposed into non-overlapping demand, earnings, policy and market-pricing lenses</p></div><Layers3 size={18}/></div>
      <div className="mece-matrix"><div className="mece-head"><span>Sector</span><span>Demand engines</span><span>Profit pool</span><span>Policy / structure</span><span>Valuation / risk</span></div>{sectors.map((sector) => {
        const selectedRow = selectedIds.includes(sector.id);
        const rowClass = !filterActive ? "" : selectedRow ? "selected" : "sector-dimmed";
        return <button type="button" aria-pressed={selectedRow} onClick={() => onToggle(sector.id)} className={`mece-row ${rowClass}`} key={sector.id} style={{ "--sector": sector.color } as CSSProperties}><b><i/>{sector.name}<small>{sector.pulse} · {sectorComposite(sector).toFixed(1)}/5</small></b>{sector.mece.map((driver,index) => <div className="mece-cell" key={`${sector.id}-${index}`}><ul>{meceBullets(driver).map((bullet, bulletIndex) => <li key={`${bullet}-${bulletIndex}`}><span aria-hidden="true">{bulletIndex === 0 ? meceEmojis[index] : "🔎"}</span>{bullet}</li>)}</ul></div>)}</button>;
      })}</div>
    </article>

    <div className="sector-source-note"><Database size={16}/><span>{sectorSourceNote}{selected ? ` Company universe: ${sectorUniverseLabels[selected.id]}. ${market.message}` : ` Cross-industry breadth uses every tracked sector universe. ${crossMarketMessage}`}</span>{selected && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceLabel} <ExternalLink size={12}/></a>}</div>
  </section>;
}
