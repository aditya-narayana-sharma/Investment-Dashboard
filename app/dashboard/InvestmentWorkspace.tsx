"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, CheckCircle2, ChevronDown, ExternalLink, Gauge, Globe2, ScanSearch, ShieldAlert, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analystCallTone, groupAnalystRows, type AnalystGroupMode, type AnalystMatrixRow } from "../analyst-matrix-groups";
import { axisArchiveAudit, type RiskProfile } from "../portfolio-data";
import type { ContentDigestSnapshot, MailRecommendation } from "../content-types";
import type { KiteSnapshot } from "../live-types";
import { portfolioReturnTone } from "../portfolio-concentration.mjs";
import type { MacroBandKey, MacroEventKey } from "./types";
import { AllocationLabel, CollapsibleSection, DailyKanbanBoard, DemoSensitive, HoldingLabel, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection, nativeChromeHidesSection, revealDashboardSection } from "./shared-ui";
import { KiteAlertTicket, type KiteAlertSelection } from "./KiteAlertTicket";
import { KiteGttTicket, type KiteGttSelection } from "./KiteGttTicket";
import { KiteOrderTicket, type KiteOrderSelection } from "./KiteOrderTicket";
import { LlmAssistPanel } from "./LlmAssistPanel";
import { InstrumentGauge } from "./visual-components";
import { analysisWindowLabel, exposureFactors, holdingOuterFill, inr, type ExposureDriverBullet } from "./utils";
import {
  AxisRecommendationWorkbench,
  MacroScenarioBoard,
  RiskRadar,
  ThesisBulletList,
  layoutPortfolioMap,
  portfolioMapTooltip,
  portfolioReturnColor,
  type PortfolioMapDatum,
} from "./InvestmentPanels";

export type PortfolioActivityView = "holdings" | "orders" | "positions" | "gtts" | "tsls" | "alerts";

const INVESTMENT_SECTIONS = [
  { id: "i1", label: "Action Board" },
  { id: "i2", label: "Portfolio" },
  { id: "i3", label: "Risk" },
  { id: "i4", label: "Axis picks" },
] as const;

function investmentSectionFromUrl(): string {
  if (typeof window === "undefined") return "i1";
  const requested = new URLSearchParams(window.location.search).get("section");
  return INVESTMENT_SECTIONS.some((section) => section.id === requested) ? requested! : "i1";
}

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
    weight: number;
    dayPct: number;
    pnlPct: number;
    event: string;
    kpis: string;
    eventBullets: ExposureDriverBullet[];
    kpiBullets: ExposureDriverBullet[];
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
  const [activeSection, setActiveSection] = useState<string>(investmentSectionFromUrl);
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
      const section = investmentSectionFromUrl();
      setActiveSection(section);
      if (section) revealDashboardSection(section, `investment-${section}`);
    };
    sync();
    const retry = window.setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  const selectSection = (section: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.delete("page");
    window.history.pushState({}, "", url);
    setActiveSection(section);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
  };

  return <div className="investment-workspace-shell" data-focus-section={activeSection ?? undefined}>
      <WorkspaceSectionNav
        label="Investment sections"
        sections={INVESTMENT_SECTIONS}
        activeId={activeSection ?? "i1"}
        onSelect={selectSection}
      />
      <div id="investment-i1" className="workspace-section action-board-workspace-section" hidden={nativeChromeHidesSection(activeSection, "i1")}>
      <CollapsibleSection number="I-1" title="Investment action board" note="Clickable daily actions, numeric advantages and strategic rationale" defaultOpen={activeSection === "i1"}>
        <DailyKanbanBoard workspace="investment"/>
      </CollapsibleSection>
      </div>

      <div id="investment-i2" className="workspace-section" hidden={nativeChromeHidesSection(activeSection, "i2")}>
      <CollapsibleSection number="I-2" title="Portfolio" note="Holdings, orders, positions, GTTs, TSLs, alerts and nested allocation" defaultOpen={activeSection === "i2"}>
      <section className="instrument-cluster" aria-label="Portfolio instrument cluster">
        <InstrumentGauge
          label="Portfolio value"
          value={portfolioMoney(portfolio.value)}
          detail={hasPortfolio ? `${holdings.length} open equity exposures${isSnapshot ? " · snapshot" : ""}` : "Live Kite data required"}
          ratio={hasPortfolio ? Math.min(1, portfolio.value / Math.max(portfolio.value * 1.15, 1)) : 0}
          tone="neutral"
          sensitive
        />
        <InstrumentGauge
          label="Unrealised P&L"
          value={hasPortfolio ? `${portfolio.pnl >= 0 ? "+" : ""}${inr.format(portfolio.pnl)}` : "—"}
          detail={hasPortfolio ? `${portfolio.pnlPct >= 0 ? "+" : ""}${portfolio.pnlPct.toFixed(2)}% on invested cost${isSnapshot ? " · snapshot" : ""}` : "Kite portfolio unavailable"}
          ratio={hasPortfolio ? Math.min(1, Math.abs(portfolio.pnlPct) / 40) : 0}
          tone={hasPortfolio ? (portfolio.pnl >= 0 ? "positive" : "danger") : "neutral"}
          sensitive
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
          sensitive
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
          <div className="nested-center"><b className={portfolio.pnl>=0?"positive":"negative"}><DemoSensitive>{portfolio.pnl>=0?"+":""}{inr.format(portfolio.pnl)}</DemoSensitive></b><span>Unrealised · {portfolio.pnlPct>=0?"+":""}{portfolio.pnlPct.toFixed(2)}%</span><strong className={portfolio.dayPnl>=0?"positive":"negative"}><DemoSensitive>{portfolio.dayPnl>=0?"+":""}{inr.format(portfolio.dayPnl)}</DemoSensitive></strong><span>Day · {portfolio.dayPct>=0?"+":""}{portfolio.dayPct.toFixed(2)}%</span></div>
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
                  <tr><th scope="row">Qty</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}><DemoSensitive>{holding.qty}</DemoSensitive></td>)}</tr>
                  <tr><th scope="row">Avg</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}><DemoSensitive>{inr.format(holding.avg)}</DemoSensitive></td>)}</tr>
                  <tr><th scope="row">Last</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}><DemoSensitive>{inr.format(holding.price)}</DemoSensitive></td>)}</tr>
                  <tr><th scope="row">Value</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}><DemoSensitive>{inr.format(holding.value)}</DemoSensitive></td>)}</tr>
                  <tr><th scope="row">Unrealised</th>{holdings.map((holding) => <td className={`${holding.pnl >= 0 ? "positive heat-gain" : "negative heat-loss"}${activeHoldingSymbol === holding.symbol ? " holding-column-active" : ""}`} key={holding.symbol}><b><DemoSensitive>{holding.pnl >= 0 ? "+" : ""}{inr.format(holding.pnl)}</DemoSensitive></b><small>{holding.pnlPct >= 0 ? "+" : ""}{holding.pnlPct.toFixed(2)}%</small></td>)}</tr>
                  <tr><th scope="row">Day P&amp;L</th>{holdings.map((holding) => <td className={`${holding.dayPnl >= 0 ? "positive heat-gain" : "negative heat-loss"}${activeHoldingSymbol === holding.symbol ? " holding-column-active" : ""}`} key={holding.symbol}><b><DemoSensitive>{holding.dayPnl >= 0 ? "+" : ""}{inr.format(holding.dayPnl)}</DemoSensitive></b><small>{holding.dayPct >= 0 ? "+" : ""}{holding.dayPct.toFixed(2)}%</small></td>)}</tr>
                  <tr><th scope="row">Weight</th>{holdings.map((holding) => <td className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined} key={holding.symbol}><b className="compact-weight" style={{color:holding.color}}>{holding.weight.toFixed(1)}%</b></td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="portfolio-activity-mobile" aria-label="Portfolio activity holdings">
              {holdings.map((holding) => <article key={holding.symbol} className={activeHoldingSymbol === holding.symbol ? "holding-column-active" : undefined}>
                <header><b>{holding.symbol}</b><span className="holding-mobile-order-actions"><button type="button" className="buy" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "BUY" })}>BUY</button><button type="button" className="sell" disabled={!isLive} onClick={() => setOrderSelection({ holding, side: "SELL" })}>SELL</button></span><strong>{holding.weight.toFixed(1)}%</strong></header>
                <dl>
                  <div><dt>Qty</dt><dd><DemoSensitive>{holding.qty}</DemoSensitive></dd></div>
                  <div><dt>Avg</dt><dd><DemoSensitive>{inr.format(holding.avg)}</DemoSensitive></dd></div>
                  <div><dt>Last</dt><dd><DemoSensitive>{inr.format(holding.price)}</DemoSensitive></dd></div>
                  <div><dt>Value</dt><dd><DemoSensitive>{inr.format(holding.value)}</DemoSensitive></dd></div>
                  <div><dt>Unrealised</dt><dd className={holding.pnl >= 0 ? "positive" : "negative"}><DemoSensitive>{holding.pnl >= 0 ? "+" : ""}{inr.format(holding.pnl)}</DemoSensitive> <small>{holding.pnlPct >= 0 ? "+" : ""}{holding.pnlPct.toFixed(2)}%</small></dd></div>
                  <div><dt>Day P&amp;L</dt><dd className={holding.dayPnl >= 0 ? "positive" : "negative"}><DemoSensitive>{holding.dayPnl >= 0 ? "+" : ""}{inr.format(holding.dayPnl)}</DemoSensitive> <small>{holding.dayPct >= 0 ? "+" : ""}{holding.dayPct.toFixed(2)}%</small></dd></div>
                </dl>
              </article>)}
            </div></>
          : <div className="table-empty">No static positions are shown. Connect Kite to load the live portfolio.</div>)}
        {view === "orders" && <div className="activity-single"><div className="activity-create-bar"><button type="button" className="create-order" disabled={!isLive} title={isLive ? "Trade any NSE cash equity" : "Live Kite authentication is required"} onClick={() => setOrderSelection({ side: "BUY" })}>Create NSE order</button></div>{orders.map(o=><div className="activity-row" key={o.id}><div><b>{o.symbol}</b><small>{o.side} <DemoSensitive>{o.qty}</DemoSensitive> · {o.type}{o.statusMessage ? ` · ${o.statusMessage}` : ""}</small></div><strong><DemoSensitive>{inr.format(o.price)}</DemoSensitive></strong><span className={`pill ${o.status.toLowerCase()==="complete"?"green":"amber"}`}>{o.status}</span></div>)}{!orders.length&&<div className="table-empty">{unavailable.has("orders") ? "Kite orders are temporarily unavailable." : "No live orders."}</div>}</div>}
        {view === "positions" && <div className="activity-single">{positions.map(p=><div className="activity-row" key={p.id}><div><b>{p.symbol}</b><small>{p.side} <DemoSensitive>{p.qty}</DemoSensitive> · {p.product}</small></div><strong className={p.pnl>=0?"positive":"negative"}><DemoSensitive>{p.pnl>=0?"+":""}{inr.format(p.pnl)}</DemoSensitive></strong><span className="pill blue"><DemoSensitive>{inr.format(p.price)}</DemoSensitive></span></div>)}{!positions.length&&<div className="table-empty">{unavailable.has("positions") ? "Kite positions are temporarily unavailable." : "No open day/net positions beyond the holdings book."}</div>}</div>}
        {view === "gtts" && <div className="activity-single">
          <div className="activity-create-bar"><button type="button" className="create-gtt" disabled={!isLive} title={isLive ? "Open Create GTT ticket" : "Live Kite authentication is required"} onClick={() => setGttSelection({ kind: "gtt" })}>Create GTT</button></div>
          {entryGtts.map(g=><div className="activity-row" key={g.id}><div><b>{g.symbol}</b><small>{g.side} <DemoSensitive>{g.qty}</DemoSensitive> · trigger <DemoSensitive>{inr.format(g.trigger)}</DemoSensitive></small></div><strong><DemoSensitive>{inr.format(g.limit)}</DemoSensitive></strong><span className={`pill ${g.status.toLowerCase()==="active"?"amber":"green"}`}>{g.status}</span></div>)}
          {!entryGtts.length&&<div className="table-empty">{unavailable.has("GTTs") ? "Kite GTTs are temporarily unavailable." : "No active entry GTTs."}</div>}
        </div>}
        {view === "tsls" && <div className="activity-single">
          <div className="activity-create-bar"><button type="button" className="create-tsl" disabled={!isLive} title={isLive ? "Open Create TSL ticket" : "Live Kite authentication is required"} onClick={() => setGttSelection({ kind: "tsl" })}>Create TSL</button></div>
          {tsls.map(g=><div className="activity-row" key={g.id}><div><b>{g.symbol}</b><small>{g.side} <DemoSensitive>{g.qty}</DemoSensitive> · stop <DemoSensitive>{inr.format(g.trigger)}</DemoSensitive></small></div><strong><DemoSensitive>{inr.format(g.limit)}</DemoSensitive></strong><span className={`pill ${g.status.toLowerCase()==="active"?"amber":"green"}`}>{g.status}</span></div>)}
          {!tsls.length&&<div className="table-empty">{unavailable.has("GTTs") ? "Kite GTTs/TSLs are temporarily unavailable." : "No protective TSL / stop-loss GTTs."}</div>}
        </div>}
        {view === "alerts" && <div className="activity-single">
          <div className="activity-create-bar"><button type="button" className="create-alert" disabled={!isLive} title={isLive ? "Open Create price alert ticket" : "Live Kite authentication is required"} onClick={() => setAlertSelection({})}>Create price alert</button></div>
          {alerts.map((alert) => <div className="activity-row" key={alert.id}><div><b>{alert.symbol}</b><small>{alert.exchange} · LTP {alert.operator || (alert.direction === "above" ? "≥" : alert.direction === "below" ? "≤" : "?")} <DemoSensitive>{inr.format(alert.trigger)}</DemoSensitive>{alert.note ? ` · ${alert.note}` : ""}</small></div><strong>{alert.direction === "above" ? "Above" : alert.direction === "below" ? "Below" : alert.operator}</strong><span className={`pill ${alert.status.toLowerCase()==="enabled"?"amber":"green"}`}>{alert.status}</span></div>)}
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
              <span className="portfolio-map-primary"><b title={holding.symbol}>{holding.symbol}</b><strong>{holding.weight.toFixed(1)}%</strong><em><DemoSensitive>{inr.format(holding.value)}</DemoSensitive></em></span>
              {showSecondary && <span className="portfolio-map-secondary"><span>U <DemoSensitive>{holding.pnl >= 0 ? "+" : ""}{inr.format(holding.pnl)}</DemoSensitive></span><span>Day <DemoSensitive>{holding.dayPnl >= 0 ? "+" : ""}{inr.format(holding.dayPnl)}</DemoSensitive></span></span>}
            </button>;
          })}
          {activeMapHolding && <aside className="portfolio-map-tooltip" role="status">
            <b>{activeMapHolding.name} · {activeMapHolding.symbol}</b>
            <span>Qty <DemoSensitive>{activeMapHolding.qty}</DemoSensitive> · Avg <DemoSensitive>{inr.format(activeMapHolding.avg)}</DemoSensitive> · Last <DemoSensitive>{inr.format(activeMapHolding.price)}</DemoSensitive></span>
            <span>Value <DemoSensitive>{inr.format(activeMapHolding.value)}</DemoSensitive> · Weight {activeMapHolding.weight.toFixed(2)}%</span>
            <span>Unrealised <DemoSensitive>{activeMapHolding.pnl >= 0 ? "+" : ""}{inr.format(activeMapHolding.pnl)}</DemoSensitive> ({activeMapHolding.pnlPct >= 0 ? "+" : ""}{activeMapHolding.pnlPct.toFixed(2)}%) · Day <DemoSensitive>{activeMapHolding.dayPnl >= 0 ? "+" : ""}{inr.format(activeMapHolding.dayPnl)}</DemoSensitive></span>
            <span>{activeMapHolding.sector} · {activeMapHolding.subSector} · Risk {activeMapHolding.risk}</span>
          </aside>}
        </div> : <div className="live-empty compact"><Activity size={22}/><b>Concentration map unavailable</b><p>Connect Kite to load current holding values.</p></div>}
      </section>
      </div>
      </CollapsibleSection>
      </div>

      <div id="investment-i3" className="workspace-section" hidden={nativeChromeHidesSection(activeSection, "i3")}>
      <CollapsibleSection number="I-3" title="Risk" note="Risk composition, holdings radar and macro scenario lab" defaultOpen={activeSection === "i3"}>
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
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={exposureComposition} layout="vertical" margin={{top:8,right:56,bottom:10,left:2}} barCategoryGap="14%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                  <XAxis type="number" domain={[0,5]} ticks={[0,1,2,3,4,5]} tick={{fill:"var(--chart-tick)",fontSize:13}} label={{value:"COMPOSITE MONITORING INDEX",position:"insideBottom",offset:-2,fill:"var(--chart-tick)",fontSize:13}}/>
                  <YAxis dataKey="symbol" type="category" width={72} tick={{fill:"var(--chart-label)",fontSize:13,fontWeight:800}}/>
                  <Tooltip formatter={(value,name) => [`${(Number(value) * exposureFactors.length).toFixed(1)} / 5 raw · ${Number(value).toFixed(2)} points`, String(name)]} labelFormatter={(label) => `${label} · equal-weighted composition`}/>
                  {exposureFactors.map((factor,index) => <Bar key={factor.key} dataKey={factor.key} name={factor.label} stackId="exposure" fill={factor.color} radius={index === exposureFactors.length - 1 ? [0,3,3,0] : 0} isAnimationActive={false}>
                    {index === exposureFactors.length - 1 && <LabelList dataKey="total" position="right" className="exposure-total-label" formatter={(value) => `${Number(value).toFixed(1)}/5`}/>}
                  </Bar>)}
                </BarChart>
              </ResponsiveContainer>
              <div className="exposure-driver-map">
                <div className="exposure-driver-head"><span>Holding</span><span>Event transmission</span><span>KPI watch</span></div>
                {exposureComposition.map((item) => (
                  <div className="exposure-driver-row" key={item.fullSymbol}>
                    <b>
                      {item.symbol}
                      <small>{item.total.toFixed(1)}/5 composite</small>
                      <small className="exposure-driver-meta">{item.weight.toFixed(1)}% wt · day {item.dayPct >= 0 ? "+" : ""}{item.dayPct.toFixed(1)}% · P&L {item.pnlPct >= 0 ? "+" : ""}{item.pnlPct.toFixed(1)}%</small>
                    </b>
                    <ul className="exposure-driver-list" aria-label={`${item.symbol} event transmission`}>
                      {item.eventBullets.map((bullet) => (
                        <li key={bullet.key} data-tone={bullet.tone}>
                          <span className="exposure-driver-kpi">{bullet.label}</span>
                          <strong>{bullet.value}</strong>
                          <span className="exposure-driver-detail">{bullet.detail}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="exposure-driver-list" aria-label={`${item.symbol} KPI watch`}>
                      {item.kpiBullets.map((bullet) => (
                        <li key={bullet.key} data-tone={bullet.tone}>
                          <span className="exposure-driver-kpi">{bullet.label}</span>
                          <strong>{bullet.value}</strong>
                          <span className="exposure-driver-detail">{bullet.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="exposure-method">Method: six 1-5 monitoring inputs contribute equally. Segment width = raw score ÷ 6; the full bar = their average. Bullet scores: ≤2 supportive (green), 3 watch (amber), ≥4 elevated (red). This is a prioritisation aid, not probability of loss.</p>
            </> : <div className="live-empty compact"><ShieldAlert size={24}/><b>Risk composition waits for live positions</b><p>No stored price snapshot is displayed.</p></div>}
          </section>
          <article className="panel risk-panel threat-flower holdings-stack"><div className="panel-title"><div><h3>Portfolio / holdings risk</h3><p>{livePortfolioRiskProfiles.length} current Kite holdings · selectable against live-portfolio average</p></div><ScanSearch size={18}/></div><RiskRadar profiles={livePortfolioRiskProfiles} selected={portfolioRisk} onSelect={setPortfolioRisk} averageLabel="Current portfolio average" idPrefix="portfolio-holdings-risk" explainSelected evidenceContext={{ holdings, asOf: snapshot.asOf, classification }} emptyLabel="No live holding risk profiles" /></article>
        </div>
      </CollapsibleSection>
      </div>

      <div id="investment-i4" className="workspace-section" hidden={nativeChromeHidesSection(activeSection, "i4")}>
      <CollapsibleSection number="I-4" title="Axis picks" note={`Call matrix · Axis recommended stocks · recommended risk radar · as-of ${axisAsOfLabel}${content.investment.axisUsedLastTradingDay ? " · weekend/holiday fallback" : ""}`} defaultOpen={activeSection === "i4"}>
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
          <LlmAssistPanel
            task="composite"
            hint="Does not change composite scores or invent CMP/targets. Missing fields stay missing."
            context={`Analyst matrix grouped by ${analystGroupMode}. Groups: ${analystGroups.map((group) => `${group.label} (${group.rows.length})`).join("; ")}.`}
            placeholder="e.g. What stands out in Target achieved vs active BUY rows?"
          />
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
        <AxisRecommendationWorkbench recommendations={mailAxisRecommendations} analystRows={analystRows} content={content} kiteBySymbol={resolvedKiteBySymbol} yfinanceBySymbol={resolvedYfinanceBySymbol}/>
        <article className="panel risk-panel threat-flower"><div className="panel-title"><div><h3>Recommended risk radar</h3><p>{axisAsOfLabel} · {mailAxisProfiles.length} deduplicated Axis calls from iCloud → Axis Research</p></div><Target size={18}/></div><RiskRadar profiles={mailAxisProfiles} selected={axisRisk} onSelect={setAxisRisk} averageLabel="Axis list average" idPrefix="axis-recommended-risk" emptyLabel={`No Axis risk profiles for ${mailWindow}`} /></article>
      </CollapsibleSection>
      </div>
      {orderSelection && <KiteOrderTicket key={`${orderSelection.side}-${orderSelection.holding?.symbol ?? "new"}`} selection={orderSelection} holdings={holdings} kiteSessionLive={isLive} equityMargin={portfolio.equityMargin} marginsKnown={isLive && !unavailable.has("margins")} onClose={() => setOrderSelection(null)} onSubmitted={async () => { setView("orders"); await onKiteRefresh(); }}/>}
      {gttSelection && <KiteGttTicket key={`${gttSelection.kind}-${gttSelection.holding?.symbol ?? "new"}`} selection={gttSelection} holdings={holdings} kiteSessionLive={isLive} onClose={() => setGttSelection(null)} onSubmitted={async () => { setView(gttSelection.kind === "tsl" ? "tsls" : "gtts"); await onKiteRefresh(); }}/>}
      {alertSelection && <KiteAlertTicket key={alertSelection.holding?.symbol ?? "new-alert"} selection={alertSelection} holdings={holdings} kiteSessionLive={isLive} onClose={() => setAlertSelection(null)} onSubmitted={async () => { setView("alerts"); await onKiteRefresh(); }}/>}
  </div>;
}
