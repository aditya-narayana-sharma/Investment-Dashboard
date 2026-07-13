"use client";

import { useState } from "react";
import { Activity, CalendarDays, ChevronRight, CircleDollarSign, FileText, Gauge, ShieldAlert, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analystCalls, asOf, gtts, holdings, orders, portfolio, scenarios } from "./portfolio-data";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
type ScenarioKey = keyof typeof scenarios;

function RiskPill({ value }: { value: string }) {
  const tone = value.toLowerCase().includes("high") ? "red" : value.toLowerCase().includes("low") ? "green" : "amber";
  return <span className={`pill ${tone}`}>{value}</span>;
}

function SectionHeading({ number, title, note }: { number: string; title: string; note: string }) {
  return <div className="section-heading"><span>{number}</span><div><h2>{title}</h2><p>{note}</p></div></div>;
}

export default function Home() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("base");
  const [view, setView] = useState<"holdings" | "activity">("holdings");
  const scenario = scenarios[scenarioKey];

  return (
    <main>
      <header className="masthead">
        <div>
          <div className="eyebrow">PORTFOLIO INTELLIGENCE</div>
          <h1>Investment Brief</h1>
          <p>Quarter outlook, oil/geopolitical exposure, flows and analyst positioning</p>
        </div>
        <div className="status-panel">
          <div><Activity size={16}/><span>Kite snapshot</span><b>Connected</b></div>
          <small>As of {asOf}</small>
          <a href="/report"><FileText size={15}/> Open print report</a>
        </div>
      </header>

      <section className="metrics-strip">
        <article><span>Portfolio value</span><b>{inr.format(portfolio.value)}</b><small>Five open equity exposures</small></article>
        <article><span>Unrealised P&amp;L</span><b className="positive">+{inr.format(portfolio.pnl)}</b><small>+{portfolio.pnlPct.toFixed(2)}% on invested cost</small></article>
        <article><span>Top-two concentration</span><b className="warning">{portfolio.topTwo.toFixed(1)}%</b><small>ICICI Bank + Eternal</small></article>
        <article><span>Available equity margin</span><b>{inr.format(portfolio.equityMargin)}</b><small>Low tactical liquidity</small></article>
      </section>

      <section className="executive-band">
        <div className="signal"><ShieldAlert size={22}/><div><b>Portfolio stance: moderately constructive, concentration-limited</b><p>Airtel and ICICI Bank provide relative resilience; Eternal and Aether carry the highest valuation and oil-linked risk.</p></div></div>
        <div className="market-ticker"><span>BRENT</span><b>$78.8-79.6</b><small>13 Jul range from AP updates</small></div>
        <div className="market-ticker"><span>10 JUL FLOWS</span><b>FII +₹2,604cr</b><small>DII +₹2,020cr, provisional</small></div>
      </section>

      <SectionHeading number="1" title="Portfolio snapshot" note="Kite holdings plus deduplicated CNC positions" />
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-title"><div><h3>Allocation</h3><p>Market-value weight by position</p></div><Gauge size={18}/></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={270}>
              <PieChart><Pie data={holdings} dataKey="value" nameKey="name" innerRadius={66} outerRadius={98} paddingAngle={2} isAnimationActive={false}>{holdings.map(h => <Cell key={h.symbol} fill={h.color}/>)}</Pie><Tooltip formatter={(v) => inr.format(Number(v))}/><Legend verticalAlign="bottom" height={42}/></PieChart>
            </ResponsiveContainer>
            <div className="donut-label"><b>{inr.format(portfolio.value)}</b><span>Total value</span></div>
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-title"><div><h3>Exposure scores</h3><p>Analyst-assigned qualitative scale, 1 low to 5 high</p></div><ShieldAlert size={18}/></div>
          <ResponsiveContainer width="100%" height={292}>
            <BarChart data={holdings} layout="vertical" margin={{left:4,right:12}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" domain={[0,5]} tickCount={6}/><YAxis dataKey="symbol" type="category" width={92} tick={{fontSize:11}}/><Tooltip/><Legend/><Bar dataKey="oil" name="Oil / war" fill="#df6651" radius={[0,3,3,0]} isAnimationActive={false}/><Bar dataKey="flow" name="FII / flow" fill="#2563a6" radius={[0,3,3,0]} isAnimationActive={false}/></BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="panel holdings-panel">
        <div className="panel-title"><div><h3>Positions</h3><p>Live-session prices from Kite; no intraday quote history was available</p></div><div className="segmented"><button onClick={()=>setView("holdings")} className={view==="holdings"?"active":""}>Holdings</button><button onClick={()=>setView("activity")} className={view==="activity"?"active":""}>Orders &amp; GTTs</button></div></div>
        {view === "holdings" ? <div className="table-scroll"><table><thead><tr><th>Position</th><th>Qty</th><th>Avg</th><th>Last</th><th>Value</th><th>P&amp;L</th><th>Weight</th><th>Quarter stance</th><th>Risk</th></tr></thead><tbody>{holdings.map(h=><tr key={h.symbol}><td><b>{h.name}</b><small>{h.symbol} · {h.sector}</small></td><td>{h.qty}</td><td>{inr.format(h.avg)}</td><td>{inr.format(h.price)}</td><td>{inr.format(h.value)}</td><td className={h.pnl>=0?"positive":"negative"}>{h.pnl>=0?"+":""}{inr.format(h.pnl)}<small>{h.pnlPct>=0?"+":""}{h.pnlPct.toFixed(2)}%</small></td><td><div className="weight-cell"><span style={{width:`${Math.min(100,h.weight*2.1)}%`,background:h.color}}/>{h.weight.toFixed(1)}%</div></td><td><b>{h.quarter}</b><small>{h.stance}</small></td><td><RiskPill value={h.risk}/></td></tr>)}</tbody></table></div> : <div className="activity-grid"><div><h4>Completed orders</h4>{orders.map(o=><div className="activity-row" key={o.symbol}><div><b>{o.symbol}</b><small>{o.side} {o.qty} · {o.type}</small></div><strong>{inr.format(o.price)}</strong><span className="pill green">{o.status}</span></div>)}</div><div><h4>GTT register</h4>{gtts.map(g=><div className="activity-row" key={`${g.symbol}-${g.status}`}><div><b>{g.symbol}</b><small>{g.side} {g.qty} · trigger {inr.format(g.trigger)}</small></div><strong>{inr.format(g.limit)}</strong><span className={`pill ${g.status==="Active"?"amber":"green"}`}>{g.status}</span></div>)}</div></div>}
      </section>

      <SectionHeading number="2" title="Macro scenario lab" note="Relative portfolio impact, not a forecast of returns" />
      <section className="scenario-shell">
        <div className="scenario-tabs">{(Object.keys(scenarios) as ScenarioKey[]).map(key=><button key={key} className={scenarioKey===key?"active":""} onClick={()=>setScenarioKey(key)}><span className={`dot ${scenarios[key].tone}`}/><b>{scenarios[key].label}</b><small>{scenarios[key].oil}</small></button>)}</div>
        <div className={`scenario-body ${scenario.tone}`}><div className="scenario-copy"><span>CURRENT VIEW</span><h3>{scenario.label}</h3><p>{scenario.summary}</p></div><div><small>Relative leaders</small><b>{scenario.leaders}</b></div><div><small>Relative laggards</small><b>{scenario.laggards}</b></div><div><small>Framework response</small><b>{scenario.action}</b></div></div>
      </section>

      <SectionHeading number="3" title="Analyst call matrix" note="Targets are reference points, not quarter forecasts" />
      <section className="panel table-scroll"><table><thead><tr><th>Stock</th><th>Source / house</th><th>Call</th><th>Target</th><th>Implied</th><th>Published</th><th>What matters</th></tr></thead><tbody>{analystCalls.map(a=><tr key={a.symbol}><td><b>{a.symbol}</b></td><td>{a.house}</td><td><span className="pill blue">{a.rating}</span></td><td>{inr.format(a.target)}</td><td className={a.implied>=0?"positive":"negative"}>{a.implied>=0?"+":""}{a.implied.toFixed(1)}%</td><td>{a.date}</td><td>{a.thesis}</td></tr>)}</tbody></table><div className="table-note"><Target size={16}/><span>NSE is used for filings, results and flow data; it does not issue buy/sell recommendations.</span></div></section>

      <section className="bottom-grid">
        <article className="panel catalyst-card"><div className="panel-title"><div><h3>Earnings calendar</h3><p>Apple Calendar cross-check</p></div><CalendarDays size={18}/></div><div className="calendar-date"><span>18</span><div><b>ICICI Bank Q1 FY27</b><small>Saturday, 18 Jul 2026</small></div><ChevronRight size={18}/></div><p>No portfolio holding was listed as reporting today or during 6-12 Jul. LTF was the only earnings event in that local calendar last week.</p></article>
        <article className="panel"><div className="panel-title"><div><h3>Decision framework</h3><p>Research actions, not trade instructions</p></div><CircleDollarSign size={18}/></div><ul className="action-list"><li><span className="dot red"/><b>Concentration:</b> use new capital to dilute the 72.9% top-two weight.</li><li><span className="dot amber"/><b>Oil trigger:</b> above $90 for two weeks, re-underwrite Aether and Eternal risk.</li><li><span className="dot green"/><b>Defensive anchor:</b> Airtel has the lowest direct oil sensitivity.</li></ul></article>
      </section>

      <footer><p>Educational portfolio research. Not personalised investment advice and no orders were placed.</p><p>Kite values: {asOf} · External sources linked in the print report.</p></footer>
    </main>
  );
}
