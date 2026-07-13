import Link from "next/link";
import { analystCalls, asOf, gtts, holdings, orders, podcastNotes, portfolio, scenarios, sources } from "../portfolio-data";
import styles from "./report.module.css";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const donut = `conic-gradient(${holdings.map((h,i)=>`${h.color} ${holdings.slice(0,i).reduce((s,x)=>s+x.weight,0)}% ${holdings.slice(0,i+1).reduce((s,x)=>s+x.weight,0)}%`).join(",")})`;

function PageHeader({ section, page }: { section: string; page: number }) {
  return <><header className={styles.pageHeader}><div><b>INVESTMENT BRIEF</b><span>{section}</span></div><div><b>{asOf}</b><span>Live-session Kite snapshot</span></div></header><div className={styles.pageNum}>{page}</div></>;
}

function Callout({ tone="blue", title, children }: { tone?: string; title: string; children: React.ReactNode }) {
  return <div className={`${styles.callout} ${styles[tone]}`}><b>{title}</b><p>{children}</p></div>;
}

function Risk({ value }: { value: string }) {
  const tone=value.toLowerCase().includes("high")?"red":value.toLowerCase().includes("low")?"green":"amber";
  return <span className={`${styles.pill} ${styles[tone]}`}>{value}</span>;
}

export default function Report() {
  return <main className={styles.report}>
    <nav className={styles.noPrint}><Link href="/">Back to dashboard</Link><span>Use browser Print to save PDF</span></nav>

    <section className={`${styles.page} ${styles.cover}`}>
      <div className={styles.coverTop}><span>PORTFOLIO RESEARCH · 13 JULY 2026</span><b>Kite + public research + local briefings</b></div>
      <div className={styles.coverTitle}><p>INVESTMENT BRIEF</p><h1>Portfolio Analysis<br/>Quarter Outlook</h1><h2>Oil, war risk, flows, analyst calls and catalysts</h2></div>
      <div className={styles.coverMetrics}><div><span>Portfolio value</span><b>{inr.format(portfolio.value)}</b></div><div><span>Unrealised P&amp;L</span><b className={styles.pos}>+{inr.format(portfolio.pnl)} · +{portfolio.pnlPct.toFixed(2)}%</b></div><div><span>Top-two weight</span><b className={styles.warn}>{portfolio.topTwo.toFixed(1)}%</b></div></div>
      <Callout title="Core conclusion">The portfolio owns high-quality growth franchises, but 72.9% sits in ICICI Bank and Eternal. Airtel is the clearest oil-shock insulator; Aether and Eternal carry the highest second-order sensitivity. The quarter stance is constructive, with concentration and liquidity as the binding constraints.</Callout>
      <div className={styles.coverFooter}><span>Educational research; not personalised investment advice</span><span>No orders were placed</span></div>
    </section>

    <section className={styles.page}><PageHeader section="Portfolio snapshot" page={2}/>
      <h1 className={styles.title}>1. Portfolio at a glance</h1><p className={styles.deck}>Five open equity exposures reconciled from Kite holdings and deduplicated CNC positions.</p>
      <div className={styles.metricRow}><div><span>Invested</span><b>{inr.format(portfolio.invested)}</b></div><div><span>Current value</span><b>{inr.format(portfolio.value)}</b></div><div><span>P&amp;L</span><b className={styles.pos}>+{inr.format(portfolio.pnl)}</b></div><div><span>Margin</span><b>{inr.format(portfolio.equityMargin)}</b></div></div>
      <div className={styles.twoCol}>
        <div className={styles.chartBox}><h3>Allocation by market value</h3><div className={styles.donut} style={{background:donut}}><div><b>{inr.format(portfolio.value)}</b><span>total</span></div></div><div className={styles.legend}>{holdings.map(h=><div key={h.symbol}><i style={{background:h.color}}/><span>{h.name}</span><b>{h.weight.toFixed(1)}%</b></div>)}</div></div>
        <div className={styles.chartBox}><h3>Concentration diagnostic</h3>{holdings.map(h=><div className={styles.barRow} key={h.symbol}><span>{h.symbol}</span><div><i style={{width:`${h.weight*2.2}%`,background:h.color}}/></div><b>{h.weight.toFixed(1)}%</b></div>)}<Callout tone="amber" title="Risk flag">ICICI Bank and Eternal together represent {portfolio.topTwo.toFixed(1)}% of current value. Diversification should be achieved primarily through new capital.</Callout></div>
      </div>
      <table><thead><tr><th>Holding</th><th>Qty</th><th>Avg</th><th>Last</th><th>Value</th><th>P&amp;L</th><th>Weight</th><th>Risk</th></tr></thead><tbody>{holdings.map(h=><tr key={h.symbol}><td><b>{h.name}</b><small>{h.sector}</small></td><td>{h.qty}</td><td>{inr.format(h.avg)}</td><td>{inr.format(h.price)}</td><td>{inr.format(h.value)}</td><td className={h.pnl>=0?styles.pos:styles.neg}>{h.pnl>=0?"+":""}{inr.format(h.pnl)}<small>{h.pnlPct.toFixed(2)}%</small></td><td>{h.weight.toFixed(1)}%</td><td><Risk value={h.risk}/></td></tr>)}</tbody></table>
    </section>

    <section className={styles.page}><PageHeader section="Quarter outlook" page={3}/>
      <h1 className={styles.title}>2. Position outlook for the quarter</h1><p className={styles.deck}>Research posture based on earnings durability, valuation sensitivity, macro transmission and portfolio role.</p>
      <table className={styles.roomy}><thead><tr><th>Position</th><th>Quarter view</th><th>What supports it</th><th>What can break</th><th>Framework response</th></tr></thead><tbody>
        <tr><td><b>ICICI Bank</b><small>39.1% · core financial</small></td><td className={styles.pos}>Constructive</td><td>Liability franchise, loan growth and robust asset quality; broker TP ₹1,750.</td><td>Oil-led inflation, bond yields, NIM pressure and FII selling.</td><td>Retain as core; add only after diversification improves.</td></tr>
        <tr><td><b>Eternal</b><small>33.8% · growth</small></td><td className={styles.pos}>Positive, volatile</td><td>Quick-commerce scaling and possible MSCI full-weight restoration.</td><td>High-duration valuation, competition, logistics and discretionary-demand risk.</td><td>Hold; cap additions while weight remains above one-third.</td></tr>
        <tr><td><b>Bharti Airtel</b><small>13.2% · defensive growth</small></td><td className={styles.pos}>Constructive</td><td>Tariff/ARPU cycle, recurring revenue and capex moderation.</td><td>FII de-risking, capex or competitive intensity.</td><td>Portfolio stabiliser; accumulate only on broad corrections.</td></tr>
        <tr><td><b>Aether Industries</b><small>10.1% · specialty chemicals</small></td><td className={styles.warn}>Cautious</td><td>Exclusive manufacturing, R&amp;D and new capacity.</td><td>Feedstock/freight, working capital and heavy capex. HDFC target is below current price.</td><td>Keep small; require margin and cash-flow confirmation.</td></tr>
        <tr><td><b>JSW Energy</b><small>3.8% · power</small></td><td className={styles.pos}>Constructive</td><td>Renewable/storage pipeline and contracted capacity.</td><td>Leverage, interest cost and project execution; recent profit quality softer.</td><td>Keep small until capacity and debt trajectory are clearer.</td></tr>
      </tbody></table>
      <div className={styles.threeCol}><Callout tone="green" title="Most insulated">Bharti Airtel: low direct oil linkage, recurring revenue and pricing power.</Callout><Callout tone="amber" title="Most flow-sensitive">ICICI Bank and Eternal: liquid institutional holdings with valuation sensitivity.</Callout><Callout tone="red" title="Most oil-sensitive">Aether: feedstock, energy, freight and working-capital channels.</Callout></div>
      <h2 className={styles.subTitle}>Portfolio risk ladder</h2><div className={styles.riskLadder}><span className={styles.green}>LOWER · Airtel</span><span className={styles.amber}>MEDIUM · ICICI / JSW</span><span className={styles.red}>HIGHER · Eternal / Aether</span></div>
    </section>

    <section className={styles.page}><PageHeader section="Oil, war and flows" page={4}/>
      <h1 className={styles.title}>3. Macro shock map</h1><p className={styles.deck}>The portfolio has limited direct oil revenue exposure; the main channel is India’s import bill, INR, inflation, yields and institutional risk appetite.</p>
      <Callout tone="red" title="13 July update">Renewed US-Iran attacks and conflicting Hormuz claims replaced the calmer weekend narrative. AP market updates placed Brent around $78.8-79.6, up roughly 3.6-4.7% intraday. Treat the strait as unresolved, not reopened.</Callout>
      <div className={styles.flowChain}><span>Hormuz disruption</span><b>→</b><span>Crude / freight</span><b>→</b><span>INR / inflation</span><b>→</b><span>Yields / FII risk</span><b>→</b><span>Portfolio multiples</span></div>
      <table><thead><tr><th>Holding</th><th>US-Iran</th><th>Oil</th><th>FII/DII</th><th>Insulation</th></tr></thead><tbody>
        <tr><td>Bharti Airtel</td><td>Low-medium</td><td>Low</td><td>High</td><td>Recurring telecom revenue, pricing power</td></tr><tr><td>ICICI Bank</td><td>Medium</td><td>Medium</td><td>Very high</td><td>Large, liquid franchise and strong balance sheet</td></tr><tr><td>Eternal</td><td>Medium-high</td><td>High</td><td>Very high</td><td>Platform growth and potential index inflows</td></tr><tr><td>Aether</td><td>High</td><td>High</td><td>Medium</td><td>Specialty mix and export offset, if margins hold</td></tr><tr><td>JSW Energy</td><td>Medium</td><td>Low-medium</td><td>Medium-high</td><td>Domestic power demand and contracted assets</td></tr>
      </tbody></table>
      <h2 className={styles.subTitle}>Scenario matrix</h2><div className={styles.scenarioGrid}>{Object.values(scenarios).map(s=><div className={`${styles.scenarioCard} ${styles[s.tone]}`} key={s.label}><span>{s.oil}</span><h3>{s.label}</h3><p>{s.summary}</p><dl><dt>Leaders</dt><dd>{s.leaders}</dd><dt>Laggards</dt><dd>{s.laggards}</dd><dt>Response</dt><dd>{s.action}</dd></dl></div>)}</div>
      <Callout title="FII/DII context">On 10 July, provisional flows were positive: FII +₹2,603.72 crore and DII +₹2,019.68 crore. NSE Market Pulse shows domestic mutual-fund ownership at a record 11.4%, which cushions volatility but does not eliminate oil-INR drawdown risk.</Callout>
    </section>

    <section className={styles.page}><PageHeader section="Analyst positioning" page={5}/>
      <h1 className={styles.title}>4. Analyst recommendations</h1><p className={styles.deck}>Targets are expectations anchors. They are not live fair values and can change after results, macro shocks or model revisions.</p>
      <table className={styles.roomy}><thead><tr><th>Stock</th><th>House / source</th><th>Rating</th><th>Target</th><th>Implied</th><th>Evidence and caveat</th></tr></thead><tbody>{analystCalls.map(a=><tr key={a.symbol}><td><b>{a.symbol}</b></td><td>{a.house}<small>{a.date} 2026</small></td><td><span className={`${styles.pill} ${styles.blue}`}>{a.rating}</span></td><td>{inr.format(a.target)}</td><td className={a.implied>=0?styles.pos:styles.neg}>{a.implied>=0?"+":""}{a.implied.toFixed(1)}%</td><td>{a.thesis}</td></tr>)}</tbody></table>
      <div className={styles.targetBars}>{analystCalls.map(a=><div key={a.symbol}><span>{a.symbol}</span><div><i className={a.implied<0?styles.down:undefined} style={{width:`${Math.max(3,Math.min(100,Math.abs(a.implied)*2.6))}%`}}/></div><b className={a.implied>=0?styles.pos:styles.neg}>{a.implied>=0?"+":""}{a.implied.toFixed(1)}%</b></div>)}</div>
      <div className={styles.twoCol}><Callout title="What is broadly agreed">Airtel, ICICI Bank, Eternal and JSW Energy retain favourable broker framing. The recurring positive factors are pricing power, balance-sheet quality, platform growth and capacity expansion.</Callout><Callout tone="amber" title="Where consensus is weakest">Aether’s cited ₹1,429 target is below the current Kite price. JSW’s earnings revisions and leverage make execution more important than headline upside.</Callout></div>
      <Callout tone="blue" title="NSE source role">NSE is the primary source for corporate filings, board meetings, financial results and market/flow data. It does not publish buy/sell recommendations.</Callout>
    </section>

    <section className={styles.page}><PageHeader section="Catalysts and activity" page={6}/>
      <h1 className={styles.title}>5. Earnings, orders and GTTs</h1><p className={styles.deck}>Catalyst calendar from Apple Calendar; order state from authenticated Kite MCP.</p>
      <div className={styles.calendarHero}><span>18</span><div><small>JULY · SATURDAY</small><h2>ICICI Bank Q1 FY27 results</h2><p>Largest portfolio weight. Watch NIM, deposit growth, unsecured stress, credit costs and management’s growth outlook.</p></div></div>
      <Callout tone="green" title="Reported today / last week">No portfolio holding was listed as reporting on 13 July or during 6-12 July. The local Earnings calendar showed LTF on 10 July; Axis Research’s 13 July result update covered Avenue Supermarts and LTIMindtree, neither held here.</Callout>
      <div className={styles.twoCol}><div><h2 className={styles.subTitle}>Completed orders</h2><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Type</th><th>Price</th><th>Status</th></tr></thead><tbody>{orders.map(o=><tr key={o.symbol}><td>{o.symbol}</td><td>{o.side}</td><td>{o.qty}</td><td>{o.type}</td><td>{inr.format(o.price)}</td><td><span className={`${styles.pill} ${styles.green}`}>{o.status}</span></td></tr>)}</tbody></table></div><div><h2 className={styles.subTitle}>GTT register</h2><table><thead><tr><th>Symbol</th><th>Qty</th><th>Trigger</th><th>Limit</th><th>Status</th></tr></thead><tbody>{gtts.map(g=><tr key={`${g.symbol}-${g.status}`}><td>{g.symbol}</td><td>{g.qty}</td><td>{inr.format(g.trigger)}</td><td>{inr.format(g.limit)}</td><td><span className={`${styles.pill} ${styles[g.status==="Active"?"amber":"green"]}`}>{g.status}</span></td></tr>)}</tbody></table></div></div>
      <Callout tone="amber" title="Liquidity constraint">Equity margin was only ₹50.20 at the snapshot. Any action framework must assume minimal spare broker cash and avoid treating analyst upside as deployable capacity.</Callout>
    </section>

    <section className={styles.page}><PageHeader section="Briefings and podcasts" page={7}/>
      <h1 className={styles.title}>6. Local research digest</h1><p className={styles.deck}>Apple Mail, Axis Research and Apple Podcasts were reviewed for 13 July context.</p>
      <div className={styles.mailGrid}><Callout title="Axis morning note">Asian markets were softer on renewed US-Iran tension; Axis expected a lower Indian open, with GIFT Nifty at 24,041 versus Nifty futures 24,242. It highlighted Rainbow Children’s Medicare, LTIMindtree and DMart, not portfolio holdings.</Callout><Callout tone="green" title="Axis Q1 update">Avenue Supermarts: Buy, TP ₹4,845, 19% upside; LTIMindtree: Buy, TP ₹4,560. Useful market breadth, but not direct position calls.</Callout><Callout tone="amber" title="Moneycontrol newsletter">The day’s framing was Q1 earnings under geopolitical uncertainty, consistent with the portfolio’s event-risk and oil-risk focus.</Callout></div>
      <h2 className={styles.subTitle}>Today’s Podcast library</h2><div className={styles.podcastList}>{podcastNotes.map(([name,note],i)=><div key={name}><span>{String(i+1).padStart(2,"0")}</span><div><b>{name}</b><p>{note}</p></div></div>)}</div>
      <Callout tone="blue" title="Transcript limitation">Apple Podcasts exposed seven episodes published today and their detailed descriptions. The transcript pane remained attached to a previously loaded episode, so these are description-backed summaries rather than full-transcript extractions.</Callout>
    </section>

    <section className={styles.page}><PageHeader section="Action framework and sources" page={8}/>
      <h1 className={styles.title}>7. Portfolio action framework</h1><p className={styles.deck}>Decision triggers designed to improve concentration, oil resilience and catalyst discipline without issuing trade instructions.</p>
      <table className={styles.roomy}><thead><tr><th>Priority</th><th>Current condition</th><th>Trigger</th><th>Framework response</th></tr></thead><tbody>
        <tr><td><b>1 · Concentration</b></td><td>Top two = 72.9%</td><td>Any new capital</td><td>Direct additions toward differentiated exposure before increasing ICICI or Eternal.</td></tr><tr><td><b>2 · Oil</b></td><td>Brent near $79</td><td>&gt;$90 for two weeks</td><td>Re-underwrite Aether/Eternal margin and valuation assumptions.</td></tr><tr><td><b>3 · Stress</b></td><td>Hormuz unresolved</td><td>Brent &gt;$100 plus INR weakness</td><td>Prioritise liquidity and pause high-beta additions.</td></tr><tr><td><b>4 · Earnings</b></td><td>ICICI 39.1%</td><td>18 Jul result</td><td>Focus on NIM, deposits, credit costs and unsecured stress before changing conviction.</td></tr><tr><td><b>5 · Flow</b></td><td>10 Jul FII/DII positive</td><td>Persistent FII selling without DII absorption</td><td>Reduce confidence in valuation-driven upside scenarios.</td></tr>
      </tbody></table>
      <h2 className={styles.subTitle}>Source register</h2><div className={styles.sources}>{sources.map((s,i)=><a href={s.url} key={s.url}><span>{i+1}</span>{s.label}</a>)}</div>
      <div className={styles.limitations}><h3>Method and limitations</h3><p>Kite values are a point-in-time broker snapshot. Quote/OHLC endpoints were unavailable, so no intraday history or volatility statistic is claimed. Scenario scores are qualitative analyst judgments, not modelled return forecasts. Public targets were compared with the current Kite price but not normalised for report date or corporate actions. Apple Calendar and Podcasts are user-maintained/local surfaces and may be incomplete.</p><p>This report is educational research only. It does not account for the investor’s income, liabilities, tax profile, time horizon or full asset allocation, and it should not be treated as personalised financial advice.</p></div>
    </section>
  </main>;
}
