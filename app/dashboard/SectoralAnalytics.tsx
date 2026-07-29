"use client";

import { useState, type CSSProperties } from "react";
import { Activity, Database, ExternalLink, Layers3 } from "lucide-react";
import { CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { sectorComposite, sectorSourceNote, sectors } from "../sector-data";
import { fundamentalMetricLabels, sectorCompanies, sectorUniverseLabels, type FundamentalMetricKey, type SectorCompany } from "../sector-company-data";
import { type SectorMarketSnapshot, type SectorReturnHorizon } from "../sector-live-types";
import { lifeCyclePoints, marketStructurePoints, sectorImpactRows, type ImpactSignal } from "../sector-analytics-data";
import type { LiveHolding } from "../live-types";
import type { SectorRankingView } from "./types";
import { currentIstDateLabel, inr } from "./utils";

const impactGlyph: Record<ImpactSignal, string> = { tailwind: "▲", headwind: "▼", "two-way": "●", na: "—" };
const LIFE_CYCLE_STAGES = ["", "Growth", "Shakeout", "Mature", "Decline", "Legacy"];
const axisLabelStyle = { fill: "#9ba6b2", fontSize: 11, fontWeight: 700 };

export type SectorAnalyticsPage = "pulse" | "companies" | "rankings" | "lifecycle" | "structure" | "mece";

type CompanyBubblePoint = {
  kind: "company";
  id: string;
  symbol: string;
  name: string;
  label: string;
  industryName: string;
  color: string;
  stage: number;
  growth: number;
  margin: number;
  concentration: number;
  size: number;
  growthScore: number;
  marginScore: number;
  held: boolean;
  anchorName: string;
};

type IndustryAnchorPoint = {
  kind: "industry";
  id: string;
  name: string;
  label: string;
  industryName: string;
  color: string;
  stage: number;
  growth: number;
  margin: number;
  concentration: number;
  size: number;
  profit: number;
};

function isFocused(selectedIds: string[], sectorId: string) {
  return selectedIds.length === 0 || selectedIds.includes(sectorId);
}

function sectorMeta(sectorId: string) {
  return sectors.find((sector) => sector.id === sectorId);
}

function pickLifeCycleAnchor(sectorId: string, company: SectorCompany) {
  const anchors = lifeCyclePoints.filter((point) => point.id === sectorId);
  if (!anchors.length) return null;
  if (anchors.length === 1) return anchors[0];
  const ordered = [...anchors].sort((a, b) => a.stage - b.stage);
  const growthRank = Math.max(0, Math.min(1, (company.scores.growth - 1) / 4));
  const index = Math.min(ordered.length - 1, Math.round((1 - growthRank) * (ordered.length - 1)));
  return ordered[index];
}

function pickStructureAnchor(sectorId: string) {
  return marketStructurePoints.find((point) => point.id === sectorId) ?? null;
}

function buildCompanyLifeCyclePoints(heldSymbols: Set<string>): CompanyBubblePoint[] {
  return sectors.flatMap((sector) => {
    const companies = sectorCompanies[sector.id] ?? [];
    return companies.flatMap((company) => {
      const anchor = pickLifeCycleAnchor(sector.id, company);
      if (!anchor) return [];
      const growthDelta = (company.scores.growth - 3.5) * 5.5;
      const stageDelta = (3.5 - company.scores.growth) * 0.22;
      return [{
        kind: "company" as const,
        id: sector.id,
        symbol: company.symbol,
        name: company.name,
        label: company.symbol,
        industryName: sector.name,
        color: sector.color,
        stage: Number(Math.max(0.7, Math.min(5.1, anchor.stage + stageDelta)).toFixed(2)),
        growth: Number((anchor.growth + growthDelta).toFixed(1)),
        margin: 0,
        concentration: 0,
        size: company.universeShare,
        growthScore: company.scores.growth,
        marginScore: company.scores.margin,
        held: heldSymbols.has(company.symbol),
        anchorName: anchor.name,
      }];
    });
  });
}

function buildCompanyStructurePoints(heldSymbols: Set<string>): CompanyBubblePoint[] {
  return sectors.flatMap((sector) => {
    const anchor = pickStructureAnchor(sector.id);
    if (!anchor) return [];
    return (sectorCompanies[sector.id] ?? []).map((company) => {
      const marginDelta = (company.scores.margin - 3.5) * 3.8;
      const concentrationDelta = (company.universeShare / 40 - 0.25) + (company.scores.quality - 3.5) * 0.12;
      return {
        kind: "company" as const,
        id: sector.id,
        symbol: company.symbol,
        name: company.name,
        label: company.symbol,
        industryName: sector.name,
        color: sector.color,
        stage: 0,
        growth: 0,
        margin: Number(Math.max(1, Math.min(55, anchor.margin + marginDelta)).toFixed(1)),
        concentration: Number(Math.max(1.6, Math.min(5.1, anchor.concentration + concentrationDelta)).toFixed(2)),
        size: company.universeShare,
        growthScore: company.scores.growth,
        marginScore: company.scores.margin,
        held: heldSymbols.has(company.symbol),
        anchorName: anchor.name,
      };
    });
  });
}

function industryLifeCycleAnchors(): IndustryAnchorPoint[] {
  return lifeCyclePoints.map((point) => ({
    kind: "industry" as const,
    id: point.id,
    name: point.name,
    label: point.name,
    industryName: sectorMeta(point.id)?.name ?? point.name,
    color: point.color,
    stage: point.stage,
    growth: point.growth,
    margin: 0,
    concentration: 0,
    size: Math.max(18, point.profit * 0.55),
    profit: point.profit,
  }));
}

function industryStructureAnchors(): IndustryAnchorPoint[] {
  return marketStructurePoints.map((point) => ({
    kind: "industry" as const,
    id: point.id,
    name: point.name,
    label: point.name,
    industryName: sectorMeta(point.id)?.name ?? point.name,
    color: point.color,
    stage: 0,
    growth: 0,
    margin: point.margin,
    concentration: point.concentration,
    size: Math.max(18, point.profit * 0.55),
    profit: point.profit,
  }));
}

type LabelBox = { x: number; y: number; w: number; h: number };

function boxesOverlap(a: LabelBox, b: LabelBox, pad = 2) {
  return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
}

/** Greedy label placer — caller owns a mutable `boxes` array reset each render. */
function placeBubbleLabel(
  boxes: LabelBox[],
  cx: number,
  cy: number,
  text: string,
  radius: number,
  topBound = 22,
) {
  const w = Math.max(28, text.length * 5.5);
  const h = 12;
  const clearance = Math.max(10, radius + 6);
  const candidates: Array<[number, number]> = [
    [0, -clearance],
    [0, clearance + 4],
    [Math.max(16, w * 0.35), -clearance * 0.55],
    [-Math.max(16, w * 0.35), -clearance * 0.55],
    [Math.max(18, w * 0.4), clearance * 0.45],
    [-Math.max(18, w * 0.4), clearance * 0.45],
    [0, -clearance - 10],
    [w * 0.55, 0],
    [-w * 0.55, 0],
  ];
  // Prefer below-bubble when the default top slot would clip the chart top.
  if (cy - clearance < topBound) {
    candidates.unshift([0, clearance + 4], [Math.max(16, w * 0.35), clearance * 0.5], [-Math.max(16, w * 0.35), clearance * 0.5]);
  }
  for (const [dx, dy] of candidates) {
    const lx = cx + dx;
    const ly = cy + dy;
    if (ly < topBound) continue;
    const box: LabelBox = { x: lx - w / 2, y: ly - h + 2, w, h };
    if (boxes.some((placed) => boxesOverlap(placed, box))) continue;
    boxes.push(box);
    return { x: lx, y: ly };
  }
  return null;
}

function SmartBubbleLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value = "",
  visibleLabels,
  placeLabel,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: string;
  visibleLabels: Set<string>;
  // Callback closes over a mutable boxes array so React cannot freeze shared placement state.
  placeLabel: (cx: number, cy: number, text: string, radius: number) => { x: number; y: number } | null;
}) {
  if (!visibleLabels.has(value)) return null;
  // Recharts Scatter LabelList passes the bubble AABB (x/y = top-left), not the center.
  const radius = Math.max(width, height) / 2 || 8;
  const cx = x + (width || radius * 2) / 2;
  const cy = y + (height || radius * 2) / 2;
  const placed = placeLabel(cx, cy, value, radius);
  if (!placed) return null;
  return <text x={placed.x} y={placed.y} textAnchor="middle" className="bubble-label selected">{value}</text>;
}

function BubbleTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CompanyBubblePoint | IndustryAnchorPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (point.kind === "industry") {
    if (point.concentration > 0) {
      return <div className="bubble-tooltip"><b>{point.name}</b><span>{point.industryName} · industry anchor</span><small>{point.margin}% margin · {point.concentration.toFixed(1)}/5 concentration · profit pool {point.profit}</small></div>;
    }
    return <div className="bubble-tooltip"><b>{point.name}</b><span>{point.industryName} · industry anchor</span><small>Growth {point.growth}% · profit pool {point.profit}</small></div>;
  }
  return <div className="bubble-tooltip">
    <b>{point.name}</b>
    <span style={{ color: point.color }}>{point.industryName} · {point.symbol}{point.held ? " · OWNED" : ""}</span>
    <small>Universe weight {point.size.toFixed(1)}% · {point.anchorName}</small>
    {point.concentration > 0
      ? <small>Mapped margin {point.margin}% · concentration {point.concentration.toFixed(1)}/5 · margin score {point.marginScore.toFixed(1)}/5</small>
      : <small>Mapped growth {point.growth}% · stage score via growth {point.growthScore.toFixed(1)}/5</small>}
  </div>;
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

function SectorAnalyticalCharts({ selectedIds, holdings, page }: { selectedIds: string[]; holdings: LiveHolding[]; page: "lifecycle" | "structure" }) {
  const filterActive = selectedIds.length > 0;
  const heldSymbols = new Set(holdings.map((holding) => holding.symbol));
  const companyLife = buildCompanyLifeCyclePoints(heldSymbols);
  const companyStructure = buildCompanyStructurePoints(heldSymbols);
  const lifeAnchors = industryLifeCycleAnchors();
  const structureAnchors = industryStructureAnchors();
  const focusedCompaniesLife = companyLife.filter((point) => isFocused(selectedIds, point.id));
  const focusedCompaniesStructure = companyStructure.filter((point) => isFocused(selectedIds, point.id));
  const labelThreshold = filterActive ? 6 : 14;
  const lifeLabels = new Set(
    (filterActive ? focusedCompaniesLife : companyLife)
      .filter((point) => point.held || point.size >= labelThreshold || (filterActive && point.size >= 8))
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, filterActive ? 16 : 12)
      .map((point) => point.label),
  );
  const structureLabels = new Set(
    (filterActive ? focusedCompaniesStructure : companyStructure)
      .filter((point) => point.held || point.size >= labelThreshold || (filterActive && point.size >= 8))
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, filterActive ? 16 : 12)
      .map((point) => point.label),
  );
  // Reset each render so LabelList greedy placement starts clean.
  // Keep boxes in a render-local closure (not a React prop) — frozen props break .push().
  const lifeLabelBoxes: LabelBox[] = [];
  const structureLabelBoxes: LabelBox[] = [];
  const placeLifeLabel = (cx: number, cy: number, text: string, radius: number) =>
    placeBubbleLabel(lifeLabelBoxes, cx, cy, text, radius);
  const placeStructureLabel = (cx: number, cy: number, text: string, radius: number) =>
    placeBubbleLabel(structureLabelBoxes, cx, cy, text, radius);
  // Largest first: greedy label placer keeps high-weight names; Cells follow same order.
  const companyLifePlot = companyLife.slice().sort((a, b) => b.size - a.size);
  const companyStructurePlot = companyStructure.slice().sort((a, b) => b.size - a.size);
  const industryLegend = sectors.filter((sector) => (sectorCompanies[sector.id] ?? []).length > 0);
  const insightLife = (filterActive ? focusedCompaniesLife : companyLife).slice().sort((a, b) => b.size - a.size).slice(0, 8);
  const insightStructure = (filterActive ? focusedCompaniesStructure : companyStructure).slice().sort((a, b) => b.size - a.size).slice(0, 8);
  return <div className="sector-analytical-stack">
    {page === "lifecycle" && <section className="analytics-band lifecycle-band">
      <div className="analytics-subhead"><div><b>C · Company life-cycle map</b><span>Companies plotted by mapped stage and growth · industry color · bubble size = universe weight</span></div></div>
      <div className="analytics-split bubble-split">
        <article className="panel bubble-panel">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 36, right: 28, bottom: 52, left: 36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a333c"/>
              <XAxis type="number" dataKey="stage" domain={[0.6, 5.2]} ticks={[1, 2, 3, 4, 5]} tickFormatter={(value) => LIFE_CYCLE_STAGES[Number(value)] ?? ""} tick={{ fill: "#c5ced6", fontSize: 10 }} label={{ value: "X · Life-cycle stage", position: "insideBottom", offset: -28, ...axisLabelStyle }}/>
              <YAxis type="number" dataKey="growth" tick={{ fill: "#c5ced6", fontSize: 10 }} width={48} label={{ value: "Y · Expected revenue growth %", angle: -90, position: "insideLeft", offset: 18, ...axisLabelStyle }}/>
              <ZAxis type="number" dataKey="size" range={[36, 280]}/>
              <ReferenceLine y={10} stroke="#65717c" strokeDasharray="5 5"/>
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<BubbleTooltip/>}/>
              <Scatter data={lifeAnchors} name="Industry anchors" fillOpacity={0.16} shape="circle">
                {lifeAnchors.map((point) => {
                  const focused = isFocused(selectedIds, point.id);
                  return <Cell key={`life-anchor-${point.name}`} fill={point.color} fillOpacity={!filterActive || focused ? 0.18 : 0.05} stroke={point.color} strokeOpacity={!filterActive || focused ? 0.55 : 0.12} strokeWidth={2}/>;
                })}
              </Scatter>
              <Scatter data={companyLifePlot} name="Companies" shape="circle">
                {companyLifePlot.map((point) => {
                  const focused = isFocused(selectedIds, point.id);
                  return <Cell key={`life-${point.symbol}`} fill={point.color} fillOpacity={!filterActive || focused ? (point.held ? 1 : 0.88) : 0.1} stroke={point.held || (!filterActive || focused) ? "#fff" : point.color} strokeOpacity={!filterActive || focused ? 1 : 0.15} strokeWidth={point.held ? 2.5 : (!filterActive || focused ? 1.4 : 1)}/>;
                })}
                <LabelList dataKey="label" content={<SmartBubbleLabel visibleLabels={lifeLabels} placeLabel={placeLifeLabel}/>}/>
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="bubble-axis-legend" aria-hidden="true">
            {industryLegend.map((sector) => <span key={sector.id} className={!filterActive || isFocused(selectedIds, sector.id) ? "" : "dimmed"}><i style={{ background: sector.color }}/><small>{sector.name}</small></span>)}
            <em>Size = universe weight % · hollow rings = industry anchors · white stroke = focused / owned</em>
          </div>
        </article>
        <aside className="panel linked-insight">
          <h4>Company outliers vs industry stage</h4>
          <div className="linked-insight-scroll" role="list">
            {insightLife.length
              ? insightLife.map((point) => <div role="listitem" key={point.symbol} style={{ "--sector": point.color } as CSSProperties}><b>{point.name}</b><span>{point.industryName} · weight {point.size.toFixed(1)}% · growth {point.growth}% · stage {LIFE_CYCLE_STAGES[Math.round(point.stage)] ?? point.stage.toFixed(1)}</span></div>)
              : <p>Select an industry to isolate its companies on the life-cycle map.</p>}
          </div>
          <p className="linked-insight-note">Individual companies can sit ahead of or behind their industry anchor. Bubble area uses tracked universe weight (market-cap / AUM proxy), not industry profit pool.</p>
        </aside>
      </div>
    </section>}

    {page === "structure" && <section className="analytics-band structure-band">
      <div className="analytics-subhead"><div><b>D · Company market-structure map</b><span>Operating margin vs concentration · industry color · bubble size = universe weight</span></div></div>
      <div className="analytics-split bubble-split">
        <article className="panel bubble-panel">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 36, right: 28, bottom: 52, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a333c"/>
              <XAxis type="number" dataKey="margin" unit="%" tick={{ fill: "#c5ced6", fontSize: 10 }} label={{ value: "X · Operating margin %", position: "insideBottom", offset: -28, ...axisLabelStyle }}/>
              <YAxis type="number" dataKey="concentration" domain={[1.5, 5.2]} tick={{ fill: "#c5ced6", fontSize: 10 }} width={52} label={{ value: "Y · Profit-pool concentration / 5", angle: -90, position: "insideLeft", offset: 18, ...axisLabelStyle }}/>
              <ZAxis type="number" dataKey="size" range={[36, 280]}/>
              <ReferenceLine x={20} stroke="#65717c" strokeDasharray="5 5"/>
              <ReferenceLine y={3.5} stroke="#65717c" strokeDasharray="5 5"/>
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<BubbleTooltip/>}/>
              <Scatter data={structureAnchors} name="Industry anchors" shape="circle">
                {structureAnchors.map((point) => {
                  const focused = isFocused(selectedIds, point.id);
                  return <Cell key={`struct-anchor-${point.name}`} fill={point.color} fillOpacity={!filterActive || focused ? 0.18 : 0.05} stroke={point.color} strokeOpacity={!filterActive || focused ? 0.55 : 0.12} strokeWidth={2}/>;
                })}
              </Scatter>
              <Scatter data={companyStructurePlot} name="Companies" shape="circle">
                {companyStructurePlot.map((point) => {
                  const focused = isFocused(selectedIds, point.id);
                  return <Cell key={`struct-${point.symbol}`} fill={point.color} fillOpacity={!filterActive || focused ? (point.held ? 1 : 0.88) : 0.1} stroke={point.held || (!filterActive || focused) ? "#fff" : point.color} strokeOpacity={!filterActive || focused ? 1 : 0.15} strokeWidth={point.held ? 2.5 : (!filterActive || focused ? 1.4 : 1)}/>;
                })}
                <LabelList dataKey="label" content={<SmartBubbleLabel visibleLabels={structureLabels} placeLabel={placeStructureLabel}/>}/>
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="bubble-axis-legend" aria-hidden="true">
            {industryLegend.map((sector) => <span key={`d-${sector.id}`} className={!filterActive || isFocused(selectedIds, sector.id) ? "" : "dimmed"}><i style={{ background: sector.color }}/><small>{sector.name}</small></span>)}
            <em>Top-right = stronger margins in more concentrated profit pools · size = universe weight %</em>
          </div>
        </article>
        <aside className="panel linked-insight">
          <h4>Value-chain sweet spot · companies</h4>
          <div className="linked-insight-scroll" role="list">
            {insightStructure.map((point) => <div role="listitem" key={point.symbol} style={{ "--sector": point.color } as CSSProperties}><b>{point.name}</b><span>{point.industryName} · {point.margin}% margin · {point.concentration.toFixed(1)}/5 concentration · weight {point.size.toFixed(1)}%</span></div>)}
          </div>
          <p className="linked-insight-note">Industry rings show the sector sweet-spot; company bubbles reveal names that deviate on margin quality or universe weight within the same industry color.</p>
        </aside>
      </div>
    </section>}
  </div>;
}

export default function SectoralAnalytics({ selectedIds, onToggle, market, marketsBySector = {}, holdings, page }: { selectedIds: string[]; onToggle: (sectorId: string) => void; market: SectorMarketSnapshot; marketsBySector?: Record<string, SectorMarketSnapshot>; holdings: LiveHolding[]; page: SectorAnalyticsPage }) {
  const [rankingView, setRankingView] = useState<SectorRankingView>("market");
  const [returnHorizon, setReturnHorizon] = useState<SectorReturnHorizon>("month");
  const [fundamentalMetric, setFundamentalMetric] = useState<FundamentalMetricKey>("growth");
  const [companyPage, setCompanyPage] = useState(0);
  const filterActive = selectedIds.length > 0;
  const primaryId = selectedIds[selectedIds.length - 1] ?? null;
  const selected = primaryId ? sectors.find((sector) => sector.id === primaryId) ?? null : null;
  const accent = selected?.color ?? "#4c8fff";
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
  const companyPageSize = 6;
  const companyPageCount = Math.max(1, Math.ceil(companies.length / companyPageSize));
  const safeCompanyPage = Math.min(companyPage, companyPageCount - 1);
  const visibleCompanies = companies.slice(safeCompanyPage * companyPageSize, (safeCompanyPage + 1) * companyPageSize);

  return <section className={`sector-overview sector-analytics-page-${page}`} data-sector-filter={filterActive ? selectedIds.join(",") : "all"} style={{ "--selected-sector": accent } as CSSProperties}>
    {page === "pulse" && <div className="sector-lead" style={{ "--sector": accent } as CSSProperties}>
      <div>
        <span>INDIA SECTOR PULSE · REVIEWED THROUGH {currentIstDateLabel().toUpperCase()}</span>
        <h3>{selected ? `${selected.name}: ${selected.stance}` : "All industries"}</h3>
        <p>{selected ? selected.summary : "All industries are shown at full strength. Select one or more industries to focus analytics and dim the rest. Deselect the last industry to restore the full view."}</p>
      </div>
      <div className="sector-lead-score"><b>{selected ? sectorComposite(selected).toFixed(1) : sectors.length}</b><span>{selected ? "/ 5 composite" : "industries"}</span><em>{selected ? selected.pulse : "unfiltered"}</em></div>
    </div>}

    {page === "pulse" && <div className="sector-filter-status" style={{ "--sector": accent } as CSSProperties}>
      <span>{filterActive ? "ACTIVE INDUSTRY FILTER" : "ALL INDUSTRIES"}</span>
      <b>{filterActive ? selectedNames : "No filter"}</b>
      <small>{filterActive
        ? `${selectedIds.length} selected · dimmed industries remain available as toggles · click a selected industry again to remove it`
        : "Select any industry to dim the others. Multiple industries can stay selected together."}</small>
    </div>}
    <div className="sector-selector" role="toolbar" aria-label="Filter every Sectoral Analytics section by industry">
      {sectors.map((sector) => {
        const selected = selectedIds.includes(sector.id);
        const className = !filterActive ? "active" : selected ? "active" : "sector-dimmed";
        return <button type="button" aria-pressed={selected} key={sector.id} onClick={() => { onToggle(sector.id); setCompanyPage(0); }} className={className} style={{ "--sector": sector.color } as CSSProperties}><i/><span>{sector.name}</span><small>{sectorComposite(sector).toFixed(1)}</small></button>;
      })}
    </div>

    {page === "pulse" && <SectorImpactMatrix selectedIds={selectedIds} onToggle={(sectorId) => { if (sectors.some((sector) => sector.id === sectorId)) onToggle(sectorId); }}/>}

    {selected ? <>
      {page === "pulse" && <div className="sector-kpi-grid">
        {selected.kpis.map((kpi) => <article key={kpi.label} title={`${selected.sourceLabel} · ${kpi.context}`} style={{ "--sector": selected.color } as CSSProperties}><span>{kpi.label}</span><b>{kpi.value}</b><small>{kpi.context}</small></article>)}
        <article className="sector-watch" style={{ "--sector": selected.color } as CSSProperties}><span>MONITOR NEXT</span><p>{selected.watch}</p></article>
      </div>}

      {(page === "companies" || page === "rankings") && <article className={`panel sector-company-workbench ${page}`} style={{ "--sector": selected.color } as CSSProperties}>
        <div className="panel-title sector-company-title"><div><h3>Company composition and performance</h3><p>{sectorUniverseLabels[selected.id]} · {companies.length} tracked companies · {market.status === "live" ? "live yfinance market data" : market.status === "public_delayed" ? "public delayed market data" : `market data ${market.status}`}</p></div><span className={`pill ${market.status === "live" ? "green" : market.status === "cached" || market.status === "public_delayed" ? "amber" : "red"}`}>{market.status === "live" ? "LIVE YFINANCE" : market.status === "public_delayed" ? "PUBLIC DELAYED" : market.status.toUpperCase()}</span></div>
        <div className="sector-breadth-strip">
          <div><span>Universe coverage</span><b>{companies.reduce((sum, company) => sum + company.universeShare, 0).toFixed(0)}%</b><small>Research-snapshot share</small></div>
          <div><span>Advancers</span><b className="positive">{priced.length ? advancers : "—"}</b><small>{market.status === "live" ? "Latest yfinance session" : market.status === "public_delayed" ? "Public delayed session" : "Latest available session"}</small></div>
          <div><span>Decliners</span><b className="negative">{priced.length ? decliners : "—"}</b><small>{market.status === "live" ? "Latest yfinance session" : market.status === "public_delayed" ? "Public delayed session" : "Latest available session"}</small></div>
          <div><span>Median 1M return</span><b className={medianMonth === null ? "" : medianMonth >= 0 ? "positive" : "negative"}>{medianMonth === null ? "—" : `${medianMonth >= 0 ? "+" : ""}${medianMonth.toFixed(2)}%`}</b><small>{market.asOf}</small></div>
        </div>
        {market.status === "public_delayed" && <div className="sector-market-source-note"><Activity size={16}/><span><b>Public delayed fallback active</b>{market.message}</span><a href="https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/what-are-the-charges-for-kite-apis" target="_blank" rel="noreferrer">Kite data plans <ExternalLink size={12}/></a></div>}
        {page === "rankings" && <div className="sector-ranking-controls">
          <div className="segmented" aria-label="Ranking model"><button type="button" className={rankingView === "market" ? "active" : ""} onClick={() => setRankingView("market")}>Market performance</button><button type="button" className={rankingView === "fundamentals" ? "active" : ""} onClick={() => setRankingView("fundamentals")}>Fundamentals</button></div>
          {rankingView === "market" ? <label>Return horizon<select value={returnHorizon} onChange={(event) => setReturnHorizon(event.target.value as SectorReturnHorizon)}><option value="day">1 day</option><option value="week">1 week</option><option value="month">1 month</option><option value="quarter">3 months</option></select></label> : <label>Research metric<select value={fundamentalMetric} onChange={(event) => setFundamentalMetric(event.target.value as FundamentalMetricKey)}>{Object.entries(fundamentalMetricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        </div>}
        {page === "rankings" && (ranked.length ? <div className="sector-rank-grid">
          <section><div className="sector-rank-heading positive"><span>Top {leaders.length} leaders</span><small>{rankingView === "market" ? `${returnHorizon} price return` : fundamentalMetricLabels[fundamentalMetric]}</small></div>{leaders.map((company, index) => <div className="sector-rank-row" key={`leader-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.universeShare}% universe share</small></div><strong className={Number(company.rankValue) >= 0 ? "positive" : "negative"}>{formatRankValue(company.rankValue)}</strong></div>)}</section>
          <section><div className="sector-rank-heading negative"><span>Top {laggards.length} laggards</span><small>{rankingView === "market" ? `${returnHorizon} price return` : fundamentalMetricLabels[fundamentalMetric]}</small></div>{laggards.map((company, index) => <div className="sector-rank-row" key={`laggard-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.universeShare}% universe share</small></div><strong className={rankingView === "market" && Number(company.rankValue) < 0 ? "negative" : "amber-text"}>{formatRankValue(company.rankValue)}</strong></div>)}</section>
        </div> : <div className="sector-market-empty"><Activity size={20}/><div><b>{market.status === "auth_required" ? "Authenticate Kite to load return rankings" : "Market return ranking is temporarily unavailable"}</b><p>{market.message}</p></div></div>)}
        {page === "rankings" && rankingView === "fundamentals" && <p className="sector-model-note">Fundamental values are transparent 1-5 research scores, not reported percentages. They rank relative growth, profitability, margin resilience and balance-sheet quality; company filing ingestion remains separately dated.</p>}
        {page === "companies" && <><div className="sector-company-table table-scroll"><table><thead><tr><th>Company</th><th>Universe share</th><th>Live price</th><th>1D</th><th>1W</th><th>1M</th><th>3M</th><th>Growth</th><th>Profitability</th><th>Margin</th><th>Quality</th><th>Portfolio</th></tr></thead><tbody>{visibleCompanies.map((company) => <tr key={company.symbol}><td><b>{company.name}</b><small>{company.symbol} · {company.filingPeriod}</small></td><td>{company.universeShare.toFixed(1)}%</td><td>{company.market?.price === null || company.market?.price === undefined ? "—" : inr.format(company.market.price)}</td>{(["day", "week", "month", "quarter"] as SectorReturnHorizon[]).map((horizon) => { const value = company.market?.returns[horizon]; return <td key={horizon} className={value === null || value === undefined ? "" : value >= 0 ? "positive" : "negative"}>{value === null || value === undefined ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`}</td>; })}<td>{company.scores.growth.toFixed(1)}</td><td>{company.scores.profitability.toFixed(1)}</td><td>{company.scores.margin.toFixed(1)}</td><td>{company.scores.quality.toFixed(1)}</td><td>{company.holding ? <span className="portfolio-company"><b>OWNED</b><small>U {company.holding.pnl >= 0 ? "+" : ""}{inr.format(company.holding.pnl)} · Day {company.holding.dayPnl >= 0 ? "+" : ""}{inr.format(company.holding.dayPnl)}</small></span> : "—"}</td></tr>)}</tbody></table></div><div className="sector-table-pager"><button type="button" disabled={safeCompanyPage === 0} onClick={() => setCompanyPage((value) => Math.max(0, value - 1))}>Previous</button><span>Page {safeCompanyPage + 1} / {companyPageCount}</span><button type="button" disabled={safeCompanyPage >= companyPageCount - 1} onClick={() => setCompanyPage((value) => Math.min(companyPageCount - 1, value + 1))}>Next</button></div></>}
      </article>}
    </> : <>
      {page === "pulse" && <div className="sector-kpi-grid">
        <article style={{ "--sector": accent } as CSSProperties}><span>Tracked companies</span><b>{crossIndustryCompanies.length}</b><small>Across {sectors.length} industries</small></article>
        <article style={{ "--sector": "#42d98b" } as CSSProperties}><span>Advancers</span><b className="positive">{crossPriced.length ? crossAdvancers : "—"}</b><small>{crossPriced.length ? `${crossUnchanged} unchanged · ${crossPriced.length} priced` : "Awaiting market quotes"}</small></article>
        <article style={{ "--sector": "#ff6b72" } as CSSProperties}><span>Decliners</span><b className="negative">{crossPriced.length ? crossDecliners : "—"}</b><small>{crossMarketStatus === "live" ? "Latest yfinance session" : crossMarketStatus === "public_delayed" ? "Public delayed session" : "Latest available session"}</small></article>
        <article style={{ "--sector": accent } as CSSProperties}><span>Industries advancing</span><b className={industriesAdvancing >= industriesDeclining ? "positive" : "negative"}>{crossPriced.length ? `${industriesAdvancing} / ${sectors.length}` : "—"}</b><small>{industriesDeclining} industries declining on breadth</small></article>
        <article style={{ "--sector": accent } as CSSProperties}><span>Median 1M return</span><b className={crossMedianMonth === null ? "" : crossMedianMonth >= 0 ? "positive" : "negative"}>{crossMedianMonth === null ? "—" : formatDay(crossMedianMonth)}</b><small>{crossMarketAsOf}</small></article>
        <article className="sector-watch" style={{ "--sector": accent } as CSSProperties}><span>ALL-INDUSTRY READ</span><p>Average composite {avgComposite} / 5. Select an industry for company composition, KPI cards and framework detail.</p></article>
      </div>}

      {(page === "companies" || page === "rankings") && <article className={`panel sector-company-workbench ${page}`}>
        <div className="panel-title sector-company-title"><div><h3>Cross-industry breadth and common data</h3><p>Advances / declines for every tracked industry · {crossIndustryCompanies.length} companies · {crossMarketStatus === "live" ? "live yfinance market data" : crossMarketStatus === "public_delayed" ? "public delayed market data" : `market data ${crossMarketStatus}`}</p></div><span className={`pill ${crossMarketStatus === "live" ? "green" : crossMarketStatus === "cached" || crossMarketStatus === "public_delayed" ? "amber" : "red"}`}>{crossMarketStatus === "live" ? "LIVE YFINANCE" : crossMarketStatus === "public_delayed" ? "PUBLIC DELAYED" : crossMarketStatus.toUpperCase()}</span></div>
        <div className="sector-breadth-strip">
          <div><span>Priced names</span><b>{crossPriced.length || "—"}</b><small>of {crossIndustryCompanies.length} tracked</small></div>
          <div><span>Advancers</span><b className="positive">{crossPriced.length ? crossAdvancers : "—"}</b><small>Day return &gt; 0</small></div>
          <div><span>Decliners</span><b className="negative">{crossPriced.length ? crossDecliners : "—"}</b><small>Day return &lt; 0</small></div>
          <div><span>Industry breadth</span><b className={industriesAdvancing >= industriesDeclining ? "positive" : "negative"}>{crossPriced.length ? `${industriesAdvancing}↑ ${industriesDeclining}↓` : "—"}</b><small>{crossMarketAsOf}</small></div>
        </div>
        {(crossMarketStatus === "public_delayed" || crossMarketStatus === "auth_required") && <div className="sector-market-source-note"><Activity size={16}/><span><b>{crossMarketStatus === "auth_required" ? "Kite authentication required" : "Public delayed fallback active"}</b>{crossMarketMessage}</span><a href="https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/what-are-the-charges-for-kite-apis" target="_blank" rel="noreferrer">Kite data plans <ExternalLink size={12}/></a></div>}
        {page === "rankings" && <div className="sector-ranking-controls">
          <label>Return horizon<select value={returnHorizon} onChange={(event) => setReturnHorizon(event.target.value as SectorReturnHorizon)}><option value="day">1 day</option><option value="week">1 week</option><option value="month">1 month</option><option value="quarter">3 months</option></select></label>
          <small className="sector-all-industry-hint">Showing common breadth across all industries. Pick an industry above for single-sector KPIs and the full company table.</small>
        </div>}
        {page === "companies" && <div className="industry-breadth-table table-scroll">
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
        </div>}
        {page === "rankings" && (crossRanked.length ? <div className="sector-rank-grid">
          <section><div className="sector-rank-heading positive"><span>Top {crossLeaders.length} leaders</span><small>{returnHorizon} price return · all industries</small></div>{crossLeaders.map((company, index) => <div className="sector-rank-row" key={`cross-leader-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.sectorName}</small></div><strong className={Number(company.rankValue) >= 0 ? "positive" : "negative"}>{formatDay(company.rankValue)}</strong></div>)}</section>
          <section><div className="sector-rank-heading negative"><span>Top {crossLaggards.length} laggards</span><small>{returnHorizon} price return · all industries</small></div>{crossLaggards.map((company, index) => <div className="sector-rank-row" key={`cross-laggard-${company.symbol}`}><em>{index + 1}</em><div><b>{company.name}</b><small>{company.symbol} · {company.sectorName}</small></div><strong className={Number(company.rankValue) < 0 ? "negative" : "amber-text"}>{formatDay(company.rankValue)}</strong></div>)}</section>
        </div> : <div className="sector-market-empty"><Activity size={20}/><div><b>{crossMarketStatus === "auth_required" ? "Authenticate Kite to load cross-industry rankings" : "Cross-industry return ranking is loading or unavailable"}</b><p>{crossMarketMessage}</p></div></div>)}
      </article>}
    </>}

    {(page === "lifecycle" || page === "structure") && <SectorAnalyticalCharts selectedIds={selectedIds} holdings={holdings} page={page}/>}

    {page === "mece" && <article className="panel mece-panel">
      <div className="panel-title"><div><h3>MECE sector driver map</h3><p>Every sector is decomposed into non-overlapping demand, earnings, policy and market-pricing lenses</p></div><Layers3 size={18}/></div>
      <div className="mece-matrix"><div className="mece-head"><span>Sector</span><span>Demand engines</span><span>Profit pool</span><span>Policy / structure</span><span>Valuation / risk</span></div>{sectors.map((sector) => {
        const selectedRow = selectedIds.includes(sector.id);
        const rowClass = !filterActive ? "" : selectedRow ? "selected" : "sector-dimmed";
        return <button type="button" aria-pressed={selectedRow} onClick={() => onToggle(sector.id)} className={`mece-row ${rowClass}`} key={sector.id} style={{ "--sector": sector.color } as CSSProperties}><b><i/>{sector.name}<small>{sector.pulse} · {sectorComposite(sector).toFixed(1)}/5</small></b>{sector.mece.map((driver,index) => <div className="mece-cell" key={`${sector.id}-${index}`}><ul>{meceBullets(driver).map((bullet, bulletIndex) => <li key={`${bullet}-${bulletIndex}`}><span aria-hidden="true">{bulletIndex === 0 ? meceEmojis[index] : "🔎"}</span>{bullet}</li>)}</ul></div>)}</button>;
      })}</div>
    </article>}

    <div className="sector-source-note"><Database size={16}/><span>{sectorSourceNote}{selected ? ` Company universe: ${sectorUniverseLabels[selected.id]}. ${market.message}` : ` Cross-industry breadth uses every tracked sector universe. ${crossMarketMessage}`}</span>{selected && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceLabel} <ExternalLink size={12}/></a>}</div>
  </section>;
}
