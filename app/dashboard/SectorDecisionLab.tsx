"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Activity, BarChart3, Gauge, ShieldCheck, Target } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { macroDials, squeezeWidths } from "../sector-analytics-data";
import { sectorCompanies } from "../sector-company-data";
import { pestelAxes, porterAxes, sectorComposite, sectors } from "../sector-data";
import {
  buildInvestabilityFactors,
  factorMedian,
  investabilityComposite,
} from "../sector-investability";
import type { SectorBenchmarkSnapshot, SectorMarketSnapshot } from "../sector-live-types";

export type SectorDecisionPage = "benchmarks" | "investability" | "pestel" | "porter" | "macro";

const INDEX_COLORS = ["#4c8fff", "#42d98b", "#e9ae2f", "#ff6b72", "#b794f6", "#35c2d6", "#f58fd2"];

function sectorMedian(values: number[][], index: number) {
  const sorted = values.map((row) => row[index] ?? 0).sort((left, right) => left - right);
  return Number((sorted[Math.floor(sorted.length / 2)] ?? 0).toFixed(1));
}

function decisionFromScore(score: number) {
  if (score >= 4) return { label: "Allocate", tone: "green", action: "Evidence supports staged allocation inside portfolio limits." };
  if (score >= 3.2) return { label: "Monitor", tone: "amber", action: "Wait for the next KPI or breadth confirmation before sizing." };
  if (score >= 2.5) return { label: "Reassess", tone: "amber", action: "Re-underwrite the thesis and define a tighter invalidation gate." };
  return { label: "Avoid", tone: "red", action: "Pressure exceeds support; preserve capital until evidence changes." };
}

export function SectorDecisionLab({
  page,
  benchmarks,
  marketsBySector,
}: {
  page: SectorDecisionPage;
  benchmarks: SectorBenchmarkSnapshot;
  marketsBySector: Record<string, SectorMarketSnapshot>;
}) {
  const [sectorId, setSectorId] = useState("pharma");
  const [selectedIndices, setSelectedIndices] = useState(["nifty-50", "nifty-bank", "nifty-it"]);
  const sector = sectors.find((item) => item.id === sectorId) ?? sectors[0];
  const composite = sectorComposite(sector);
  const selectedBenchmarks = benchmarks.indices.filter((index) => selectedIndices.includes(index.id));
  const history = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>();
    for (const index of selectedBenchmarks) {
      for (const point of index.indexedHistory.slice(-126)) {
        const row = rows.get(point.date) ?? { date: point.date };
        row[index.id] = point.value;
        rows.set(point.date, row);
      }
    }
    return [...rows.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)));
  }, [selectedBenchmarks]);
  const allInvestabilityFactors = sectors.map((item) => buildInvestabilityFactors(
    item,
    sectorCompanies[item.id] ?? [],
    marketsBySector[item.id],
  ));
  const selectedInvestabilityFactors = buildInvestabilityFactors(
    sector,
    sectorCompanies[sector.id] ?? [],
    marketsBySector[sector.id],
  );
  const investabilityData = selectedInvestabilityFactors.map((factor) => ({
    axis: factor.axis,
    score: factor.score,
    median: factorMedian(allInvestabilityFactors, factor.id),
    basis: factor.basis,
  }));
  const investabilityScore = investabilityComposite(selectedInvestabilityFactors);
  const decisionScore = page === "investability" ? investabilityScore ?? composite : composite;
  const decision = decisionFromScore(decisionScore);
  const pestelData = pestelAxes.map((axis, index) => ({
    axis,
    score: sector.pestel[index],
    median: sectorMedian(sectors.map((item) => item.pestel), index),
  }));
  const porterData = porterAxes.map((axis, index) => ({
    axis,
    score: sector.porter[index],
    median: sectorMedian(sectors.map((item) => item.porter), index),
  }));
  const macroData = macroDials.map((dial) => ({
    name: dial.name,
    current: Number((((dial.value - dial.min) / (dial.max - dial.min || 1)) * 100).toFixed(1)),
    trigger: Number((((dial.trigger - dial.min) / (dial.max - dial.min || 1)) * 100).toFixed(1)),
    raw: `${dial.unit}${dial.value.toLocaleString("en-IN")}`,
  }));

  const sectorSelector = <div className="decision-lab-sector-selector" role="tablist" aria-label="Decision Lab sector">
    {sectors.map((item) => <button type="button" role="tab" aria-selected={item.id === sectorId} className={item.id === sectorId ? "active" : ""} style={{ "--sector": item.color } as CSSProperties} onClick={() => setSectorId(item.id)} key={item.id}><i/>{item.name}</button>)}
  </div>;

  if (page === "benchmarks") {
    return <section className="decision-lab-page benchmark-page">
      <div className="decision-purpose"><BarChart3 size={17}/><span><b>Reference-index comparison</b><small>Compare sector leadership with broad, sector and factor benchmarks. Delayed/EOD series are never labelled live.</small></span><em className={`pill ${benchmarks.status === "live" ? "green" : benchmarks.status === "partial" || benchmarks.status === "cached" ? "amber" : "red"}`}>{benchmarks.status}</em></div>
      <div className="benchmark-selector" role="group" aria-label="Select up to three benchmark indices">
        {benchmarks.indices.map((index) => {
          const active = selectedIndices.includes(index.id);
          return <button type="button" aria-pressed={active} className={active ? "active" : ""} disabled={!active && selectedIndices.length >= 3} onClick={() => setSelectedIndices((current) => current.includes(index.id) ? current.filter((id) => id !== index.id) : [...current, index.id].slice(-3))} key={index.id}><i style={{ background: INDEX_COLORS[benchmarks.indices.indexOf(index)] }}/><span>{index.officialName}</span><small>{index.freshness.replace("_", " ")}</small></button>;
        })}
      </div>
      <div className="decision-chart-layout">
        <article className="panel decision-main-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 18, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="date" minTickGap={48} tick={{ fill: "#9ba6b2", fontSize: 10 }}/>
              <YAxis domain={["auto", "auto"]} width={42} tick={{ fill: "#9ba6b2", fontSize: 10 }}/>
              <Tooltip/>
              <Legend/>
              {selectedBenchmarks.map((index) => <Line key={index.id} dataKey={index.id} name={index.officialName} stroke={INDEX_COLORS[benchmarks.indices.findIndex((item) => item.id === index.id)]} dot={false} strokeWidth={2} connectNulls/>)}
            </LineChart>
          </ResponsiveContainer>
        </article>
        <aside className="benchmark-return-grid">
          {selectedBenchmarks.map((index) => <article className="panel" key={index.id}><span>{index.officialName}</span><b>{index.level === null ? "Unavailable" : index.level.toLocaleString("en-IN")}</b><div>{(["day", "month", "quarter", "year"] as const).map((period) => <small className={(index.returns[period] ?? 0) >= 0 ? "positive" : "negative"} key={period}>{period}: {index.returns[period] === null ? "—" : `${index.returns[period]! >= 0 ? "+" : ""}${index.returns[period]!.toFixed(2)}%`}</small>)}</div><em>{index.source} · {index.observedAt}</em></article>)}
        </aside>
      </div>
    </section>;
  }

  const radarConfig = page === "pestel"
    ? { title: "PESTEL external-environment support", note: "Higher means the external environment is more supportive.", data: pestelData, icon: <Gauge size={18}/> }
    : page === "porter"
      ? { title: "Porter competitive pressure", note: "Higher means tougher industry economics and more value competed away.", data: porterData, icon: <Target size={18}/> }
      : { title: "Investability decision radar", note: "Converts sector evidence into allocate, monitor, avoid or reassess gates.", data: investabilityData, icon: <ShieldCheck size={18}/> };

  if (page !== "macro") {
    return <section className="decision-lab-page">
      {sectorSelector}
      <div className="decision-purpose"><span>{radarConfig.icon}</span><span><b>{radarConfig.title}</b><small>{radarConfig.note}</small></span><em className={`pill ${decision.tone}`}>{decision.label}</em></div>
      <div className="decision-chart-layout">
        <article className="panel decision-main-chart">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarConfig.data} outerRadius="70%" margin={{ top: 18, right: 54, bottom: 18, left: 54 }}>
              <PolarGrid stroke="#46515b"/>
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#fff", fontSize: 10, fontWeight: 800 }}/>
              <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fill: "#9ba6b2", fontSize: 10 }}/>
              <Radar name="All-sector median" dataKey="median" stroke="#9ca4ad" fill="#9ca4ad" fillOpacity={0.07} strokeDasharray="5 4"/>
              <Radar name={sector.name} dataKey="score" stroke={sector.color} fill={sector.color} fillOpacity={0.3} strokeWidth={2.5}/>
              <Legend/><Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} / 5`, String(name)]}/>
            </RadarChart>
          </ResponsiveContainer>
        </article>
        <aside className="panel decision-evidence">
          <h3>Decision gate</h3><strong>{decision.label} · {decisionScore.toFixed(1)} / 5</strong><p>{decision.action}</p>
          {page === "investability" && <div className="investability-factor-grid" aria-label={`${sector.name} investability factor scores`}>
            {investabilityData.map((factor) => <div className={factor.score === null ? "unavailable" : ""} key={factor.axis}>
              <span>{factor.axis}</span>
              <b>{factor.score === null ? "Unavailable" : `${factor.score.toFixed(1)} / 5`}</b>
              <small>{factor.basis}</small>
            </div>)}
          </div>}
          <div><b>Evidence</b><span>{sector.summary}</span></div>
          <div><b>Monitor</b><span>{sector.watch}</span></div>
          <div><b>Invalidation</b><span>Reassess when reported KPIs, breadth or macro conditions move against the current stance.</span></div>
          <small>Confidence: research framework · methodology: six equally weighted factors after each factor&apos;s stated composition. Unsupported evidence remains unavailable.</small>
        </aside>
      </div>
    </section>;
  }

  return <section className="decision-lab-page">
    {sectorSelector}
    <div className="decision-purpose"><Activity size={18}/><span><b>Macro triggers and volatility squeeze</b><small>Distance to trigger is context for sizing, not an automatic trading signal.</small></span></div>
    <div className="decision-chart-layout macro-decision-chart-layout">
      <article className="panel decision-main-chart macro-chart-panel">
        <header className="macro-chart-header">
          <span><b>Distance to macro trigger</b><small>Current level versus the decision threshold, normalized to 100.</small></span>
        </header>
        <div className="macro-chart-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={macroData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#9ba6b2", fontSize: 10 }}/>
              <YAxis dataKey="name" type="category" width={74} tick={{ fill: "#fff", fontSize: 10, fontWeight: 800 }}/>
              <Tooltip formatter={(value, name, item) => [`${Number(value).toFixed(1)} / 100 · ${item.payload.raw}`, String(name)]}/>
              <Legend/><Bar dataKey="current" name="Current" fill="#4c8fff"/><Bar dataKey="trigger" name="Decision trigger" fill="#e9ae2f"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="panel decision-main-chart macro-chart-panel">
        <header className="macro-chart-header">
          <span><b>Volatility squeeze width</b><small>Narrower bands indicate tighter compression and greater expansion risk.</small></span>
        </header>
        <div className="macro-chart-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={squeezeWidths} layout="vertical" margin={{ top: 8, right: 46, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" domain={[0, 5]} tick={{ fill: "#9ba6b2", fontSize: 10 }} unit="%"/>
              <YAxis dataKey="name" type="category" width={74} tick={{ fill: "#fff", fontSize: 10, fontWeight: 800 }}/>
              <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Band width"]}/>
              <Bar dataKey="value" name="Band width" radius={[0, 3, 3, 0]}>
                {squeezeWidths.map((item) => <Cell fill={item.color} key={item.name}/>)}
                <LabelList dataKey="value" position="right" fill="#fff" fontSize={10} fontWeight={800} formatter={(value: number) => `${value.toFixed(1)}%`}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  </section>;
}
