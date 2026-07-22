"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Activity, BarChart3, CheckCircle2, ChevronDown, CircleDollarSign, Database, Eye, EyeOff, ExternalLink, FileText, Footprints, Gauge, HeartPulse, Layers3, LogIn, Mail, Mic2, Moon, Newspaper, NotebookTabs, RefreshCw, ScanSearch, ShieldAlert, Target, Utensils, Wind } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { analystCalls, axisArchiveAudit, axisRecommendations, axisResearchDigest, earningsCalendar, newsletterDigest, podcastNotes, portfolioRiskProfiles, riskAxes, type EarningsEvent, type RiskProfile } from "./portfolio-data";
import { healthActions, healthCategories, healthCaveats, healthSources, type HealthAveragePeriod, type HealthMetric } from "./health-data";
import type { HealthLiveSnapshot } from "./health-live-types";
import { emptySnapshot, type AllocationSlice, type KiteSnapshot, type LiveHolding } from "./live-types";
import type { ContentDigestSnapshot, MailRecommendation } from "./content-types";
import type { EarningsSnapshot } from "./earnings-live-types";
import type { DashboardRefreshResult, SourceFreshness } from "./dashboard-types";
import { pestelAxes, porterAxes, sectorComposite, sectorScoreLabels, sectorSourceNote, sectors } from "./sector-data";
import { fundamentalMetricLabels, sectorCompanies, sectorUniverseLabels, type FundamentalMetricKey } from "./sector-company-data";
import { emptySectorSnapshot, type SectorMarketSnapshot, type SectorReturnHorizon } from "./sector-live-types";
import { lifeCyclePoints, macroDials, marketStructurePoints, sectorImpactRows, squeezeWidths, type ImpactSignal } from "./sector-analytics-data";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const analysisDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const currentIstDateKey = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const currentIstDateLabel = () => analysisDay.format(new Date(`${currentIstDateKey()}T12:00:00+05:30`));
type MacroEventKey = "oilWar" | "flows" | "rates" | "breadth" | "earnings";
type MacroBandKey = "supportive" | "base" | "stress";
type WorkspaceKey = "investment" | "sectors" | "health";
type SectorRankingView = "market" | "fundamentals";
type KanbanWorkspace = WorkspaceKey;

const sectorSearchTerms: Record<string, string[]> = {
  pharma: ["pharma", "healthcare", "drug", "hospital", "diagnostic", "cipla", "sun pharma", "lupin"],
  power: ["power", "utility", "utilities", "renewable", "electricity", "ntpc", "adani green", "jsw energy"],
  infrastructure: ["infrastructure", "infra", "realty", "construction", "epc", "cement", "larsen", "l&t"],
  auto: ["auto", "automobile", "vehicle", "ev", "maruti", "mahindra", "tata motors", "bajaj auto"],
  telecom: ["telecom", "wireless", "broadband", "tower", "airtel", "vodafone idea"],
  banking: ["bank", "banking", "hdfc", "icici", "axis bank", "kotak", "sbi", "federal bank"],
  nbfc: ["nbfc", "finance", "lending", "microfinance", "bajaj finance", "shriram", "muthoot"],
  fmcg: ["fmcg", "staples", "consumer goods", "hul", "itc", "nestle", "britannia", "dabur"],
  consumer: ["consumer", "retail", "e-commerce", "ecommerce", "quick commerce", "eternal", "zomato", "titan", "trent"],
  energy: ["energy", "oil", "gas", "refining", "upstream", "ongc", "reliance", "bpcl", "ioc"],
};

function matchesSelectedSector(sectorId: string, ...values: Array<string | undefined>) {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  const companyTerms = (sectorCompanies[sectorId] ?? []).flatMap((company) => [company.symbol.toLowerCase(), company.name.toLowerCase()]);
  return [...(sectorSearchTerms[sectorId] ?? [sectorId]), ...companyTerms].some((term) => haystack.includes(term.toLowerCase()));
}
type KanbanItem = {
  id: string;
  title: string;
  detail: string;
  numericAdvantage: string;
  strategicAdvantage: string;
  lane: "today" | "monitor";
  tone: "green" | "amber" | "red" | "blue";
};

function analysisWindowLabel(content: ContentDigestSnapshot) {
  const start = new Date(`${content.investment.analysisWindowStart}T12:00:00+05:30`);
  const end = new Date(`${content.investment.analysisDate}T12:00:00+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "current analysis window";
  return content.investment.analysisWindowStart === content.investment.analysisDate
    ? analysisDay.format(end)
    : `${analysisDay.format(start)}–${analysisDay.format(end)}`;
}
const gainShades = ["#0f704f", "#178c61", "#23a472", "#39b785", "#63c99e"];
const RADIAN = Math.PI / 180;
const fallbackContent: ContentDigestSnapshot = {
  status: "unavailable",
  asOf: "Bundled fallback · refresh required",
  newsletters: newsletterDigest,
  axisResearch: axisResearchDigest.map((item) => ({ ...item, source: "Axis Research" })),
  podcasts: podcastNotes.map(([source, summary], index) => ({ source, title: "Latest captured episode", summary, time: String(index + 1).padStart(2, "0") })),
  reminders: [],
  calendar: [],
  healthNote: null,
  investment: {
    policy: "Static research fallback. Refresh Mail before using investment analysis.",
    analysisWindowStart: currentIstDateKey(),
    analysisDate: currentIstDateKey(),
    axisLookbackDays: 3,
    latestAxisAt: "Unavailable",
    latestNewsletterAt: "Unavailable",
    axisRecommendations: [],
    macroEvidence: ["oilWar", "flows", "rates", "breadth", "earnings"].map((key) => ({ key: key as MacroEventKey, count: 0, latestTitle: "Mail unavailable", latestAt: "—", items: [] })),
  },
  sources: {
    newsletters: { status: "error", count: newsletterDigest.length, displayedCount: newsletterDigest.length },
    axisResearch: { status: "error", count: axisResearchDigest.length },
    podcasts: { status: "error", count: podcastNotes.length },
    reminders: { status: "error", count: 0 },
    calendar: { status: "error", count: 0 },
    healthNote: { status: "error", count: 0 },
  },
};

const fallbackEarnings: EarningsSnapshot = {
  status: "stale",
  asOf: "Bundled fallback",
  analysisDate: currentIstDateLabel(),
  events: earningsCalendar,
  message: "Using the last bundled earnings calendar until the earnings refresh endpoint responds.",
};

const fallbackHealth: HealthLiveSnapshot = {
  schemaVersion: 1,
  status: "stale",
  source: "Apple Health",
  dataDate: "2026-07-16",
  capturedAt: "2026-07-17T03:10:00+05:30",
  message: "No newer iPhone HealthKit snapshot has reached this Mac. Showing the last directly verified capture.",
  categories: healthCategories,
  sources: healthSources.map((item) => ({ ...item, status: "Stale", tone: "amber" as const })),
  actions: healthActions,
};
const exposureFactors = [
  { key: "oilWar", label: "Oil / war", group: "EVENT", color: "#df6651" },
  { key: "fiiFlow", label: "FII / flow", group: "EVENT", color: "#d8942f" },
  { key: "valuation", label: "Valuation", group: "KPI", color: "#7659c8" },
  { key: "liquidity", label: "Liquidity", group: "KPI", color: "#2563a6" },
  { key: "volatility", label: "Volatility", group: "KPI", color: "#21a5b5" },
  { key: "leverage", label: "Leverage / execution", group: "KPI", color: "#3fa36c" },
] as const;

const exposureContext: Record<string, { event: string; kpis: string }> = {
  ICICIBANK: { event: "Oil inflation, INR, yields and FII selling", kpis: "NIM, deposits, credit costs, asset quality" },
  ETERNAL: { event: "Fuel/logistics costs, index flows and risk-off", kpis: "Quick-commerce margin, order growth, valuation" },
  BHARTIARTL: { event: "Tariff cycle and institutional risk appetite", kpis: "ARPU, subscriber mix, capex and leverage" },
  AETHER: { event: "Crude feedstock, freight, FX and geopolitical supply", kpis: "Gross margin, utilisation and working capital" },
  JSWENERGY: { event: "Rates, power demand and project commissioning", kpis: "Net debt, capacity additions and interest cost" },
  ADANIGREEN: { event: "Rates, grid demand and renewable policy execution", kpis: "Net debt, commissioning, CUF and cash conversion" },
};

const macroEvents: Record<MacroEventKey, {
  label: string;
  shortLabel: string;
  evidence: string;
  sectors: string;
  trigger: string;
  bands: Record<MacroBandKey, { label: string; range: string; tone: "green" | "amber" | "red"; summary: string; leaders: string; laggards: string; action: string }>;
}> = {
  oilWar: {
    label: "Crude + geopolitics", shortLabel: "Oil / war", evidence: "Import bill, INR and inflation are the principal India transmission channels.", sectors: "Support: telecom, domestic power · Pressure: chemicals, transport, discretionary", trigger: "Escalate controls if Brent remains above $90 for two weeks.",
    bands: {
      supportive: { label: "De-escalation", range: "Brent $70-75", tone: "green", summary: "Lower imported inflation and a steadier rupee support domestic risk appetite.", leaders: "Eternal, banks, chemicals", laggards: "Defensives may trail", action: "Use staged additions within target weights." },
      base: { label: "Controlled conflict", range: "Brent $78-90", tone: "amber", summary: "Elevated volatility with manageable earnings damage and repeated headline shocks.", leaders: "Airtel, ICICI Bank", laggards: "Aether, Eternal on risk-off days", action: "Stagger additions; monitor INR, yields and FII persistence." },
      stress: { label: "Hormuz disruption", range: "Brent $100-120", tone: "red", summary: "Import costs, inflation, INR and yields create a broad India risk-off shock.", leaders: "Airtel; domestic contracted power", laggards: "Aether, Eternal, leveraged growth", action: "Preserve liquidity and avoid high-beta additions." },
    },
  },
  flows: {
    label: "FII / DII flows", shortLabel: "Flows", evidence: "Persistent FII selling first affects liquid index weights and high-duration growth multiples.", sectors: "FII-sensitive: private banks, internet, telecom · DII cushion: quality large caps", trigger: "Use five-session cumulative cash flows, not one provisional print.",
    bands: {
      supportive: { label: "Foreign inflow", range: "5D FII > +₹5,000cr", tone: "green", summary: "Broad foreign buying supports index liquidity and valuation rerating.", leaders: "Private banks, telecom, internet", laggards: "Cash-like defensives", action: "Add only where earnings confirmation matches flows." },
      base: { label: "Domestic absorption", range: "5D FII ±₹5,000cr", tone: "amber", summary: "DII buying offsets uneven foreign participation; leadership stays selective.", leaders: "Quality large caps", laggards: "Crowded mid/small caps", action: "Track breadth and avoid treating index stability as broad strength." },
      stress: { label: "Persistent outflow", range: "5D FII < -₹5,000cr", tone: "red", summary: "Liquid index weights and high-duration growth absorb the first de-risking wave.", leaders: "Domestic defensives", laggards: "Banks, internet, high-beta growth", action: "Reduce addition size until selling and breadth stabilise." },
    },
  },
  rates: {
    label: "INR + rates", shortLabel: "INR / rates", evidence: "A weaker rupee raises imported inflation while higher yields compress equity duration.", sectors: "Potential offset: IT/pharma exporters · Pressure: leveraged and import-intensive businesses", trigger: "Re-underwrite leverage when INR weakness and bond yields rise together.",
    bands: {
      supportive: { label: "Stable currency", range: "INR ≤84 · 10Y <6.5%", tone: "green", summary: "Benign currency and discount-rate conditions support domestic valuation multiples.", leaders: "Growth, consumers, banks", laggards: "Export hedges", action: "Prioritise company earnings over macro hedges." },
      base: { label: "Watch zone", range: "INR 84-86 · 10Y 6.5-7.0%", tone: "amber", summary: "Imported inflation and valuation pressure remain manageable but require monitoring.", leaders: "IT/pharma exporters", laggards: "Leveraged, import-intensive names", action: "Test interest cover, pricing power and FX sensitivity." },
      stress: { label: "Currency-rate shock", range: "INR >86 · 10Y >7.0%", tone: "red", summary: "A weaker rupee and rising yields jointly pressure earnings and valuation.", leaders: "Net exporters", laggards: "Leveraged power, discretionary, chemicals", action: "Raise balance-sheet quality thresholds before adding." },
    },
  },
  breadth: {
    label: "Breadth + volatility", shortLabel: "Breadth / VIX", evidence: "Narrow breadth can hide corrections beneath stable headline indices.", sectors: "Prefer earnings-backed leaders · Reduce reliance on momentum-only signals", trigger: "Pause additions when breadth weakens alongside rising India VIX.",
    bands: {
      supportive: { label: "Broad participation", range: "A/D >60% · VIX <14", tone: "green", summary: "More stocks participate and volatility remains contained.", leaders: "Mid caps, cyclicals, growth", laggards: "Low-beta defensives", action: "Allow measured risk while respecting position caps." },
      base: { label: "Selective tape", range: "A/D 40-60% · VIX 14-18", tone: "amber", summary: "Headline indices can hold while stock-level outcomes diverge.", leaders: "Earnings-backed large caps", laggards: "Weak-balance-sheet momentum", action: "Require price breadth plus earnings confirmation." },
      stress: { label: "Risk-off breadth", range: "A/D <40% · VIX >18", tone: "red", summary: "Falling participation and rising volatility increase concentration risk.", leaders: "Cash, defensives", laggards: "Mid/small caps and crowded themes", action: "Pause additions and protect liquidity." },
    },
  },
  earnings: {
    label: "Earnings + rotation", shortLabel: "Earnings", evidence: "Margins, guidance and cash conversion determine whether sector leadership persists.", sectors: "Reward upgrades and cash flow · Penalise leverage, misses and guidance cuts", trigger: "Update decisions after each reported KPI set, not only price reaction.",
    bands: {
      supportive: { label: "Upgrade cycle", range: ">60% tracked results beat", tone: "green", summary: "Broad beats and guidance upgrades validate sector leadership.", leaders: "Upgraded sectors and cash generators", laggards: "Unchanged defensives", action: "Add where valuation still supports the revised earnings path." },
      base: { label: "Mixed evidence", range: "40-60% tracked results beat", tone: "amber", summary: "Company selection matters more than broad sector narratives.", leaders: "Margin and cash-flow beaters", laggards: "Guidance misses", action: "Re-rank holdings after every official release." },
      stress: { label: "Downgrade cycle", range: "<40% tracked results beat", tone: "red", summary: "Misses and guidance cuts weaken the case for high valuation multiples.", leaders: "Balance-sheet defensives", laggards: "Leveraged and richly valued names", action: "Cut unsupported assumptions and wait for estimate stability." },
    },
  },
};

const kanbanItems: Record<KanbanWorkspace, KanbanItem[]> = {
  investment: [
    { id: "inv-kite", title: "Refresh Kite and validate holdings", detail: "Reconcile holdings, positions, orders and GTTs before acting on allocation.", numericAdvantage: "100% live-position coverage", strategicAdvantage: "Prevents stale portfolio decisions", lane: "today", tone: "blue" },
    { id: "inv-concentration", title: "Review top-two concentration", detail: "Use new capital to dilute concentration before adding to the largest positions.", numericAdvantage: "Target <65% top-two weight", strategicAdvantage: "Improves shock resilience", lane: "today", tone: "amber" },
    { id: "inv-macro", title: "Monitor oil, INR and institutional flows", detail: "Apply the macro triggers before increasing high-beta exposure.", numericAdvantage: "5 regime signals", strategicAdvantage: "Links macro evidence to action", lane: "monitor", tone: "red" },
    { id: "inv-earnings", title: "Update post-result theses", detail: "Replace pending KPI fields only after official results are published.", numericAdvantage: "4 KPIs per event", strategicAdvantage: "Reduces narrative bias", lane: "monitor", tone: "green" },
  ],
  sectors: [
    { id: "sec-breadth", title: "Refresh sector breadth and rankings", detail: "Validate prices, horizons and constituent coverage across all tracked sectors.", numericAdvantage: "10 sector universes", strategicAdvantage: "Separates broad leadership from single-stock moves", lane: "today", tone: "blue" },
    { id: "sec-kpis", title: "Check sector KPI freshness", detail: "Review each metric's source date before using it in allocation decisions.", numericAdvantage: "30 numeric KPI cards", strategicAdvantage: "Makes stale evidence visible", lane: "today", tone: "green" },
    { id: "sec-framework", title: "Run the selected sector through frameworks", detail: "Use PESTEL, Porter, life-cycle and market-structure evidence together before forming a sector stance.", numericAdvantage: "4 independent lenses", strategicAdvantage: "Reduces one-factor conclusions", lane: "monitor", tone: "amber" },
    { id: "sec-earnings", title: "Fill pending earnings KPIs", detail: "Keep unpublished values blank and populate only from official releases.", numericAdvantage: "0 fabricated values", strategicAdvantage: "Preserves research integrity", lane: "monitor", tone: "red" },
  ],
  health: [
    { id: "health-sync", title: "Verify latest completed-day HealthKit sync", detail: "Open the iPhone app after the day closes and confirm the dashboard freshness badge changes to SYNCED.", numericAdvantage: "1-day maximum lag", strategicAdvantage: "Keeps the wellness record auditable", lane: "today", tone: "blue" },
    { id: "health-averages", title: "Reconcile weekly and monthly averages", detail: "Show trends only where a complete comparison window is available.", numericAdvantage: "7-day + 30-day baselines", strategicAdvantage: "Avoids overreading one day", lane: "today", tone: "green" },
    { id: "health-sleep", title: "Resolve cross-app sleep variance", detail: "Keep Apple Health primary and retain Guava as a separate comparison.", numericAdvantage: "2-source reconciliation", strategicAdvantage: "Prevents incompatible totals being merged", lane: "monitor", tone: "amber" },
    { id: "health-diary", title: "Complete nutrition diary", detail: "Treat logged intake as incomplete until all meals and portions are entered.", numericAdvantage: "100% meal coverage target", strategicAdvantage: "Improves nutrition signal quality", lane: "monitor", tone: "red" },
  ],
};

const workspaces: Array<{ key: WorkspaceKey; label: string; note: string; icon: typeof CircleDollarSign }> = [
  { key: "investment", label: "Investment", note: "Portfolio, macro and research", icon: CircleDollarSign },
  { key: "sectors", label: "Sectoral Analytics", note: "Sectors, intelligence and earnings", icon: Layers3 },
  { key: "health", label: "Health & Wellness", note: "Private local wellness", icon: HeartPulse },
];

type DonutLabelProps = {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  percent?: number;
  name?: string;
  payload?: AllocationSlice | LiveHolding;
};

function number(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function labelPoint({ cx, cy, midAngle, innerRadius, outerRadius }: DonutLabelProps, radialPosition = 0.5) {
  const inner = number(innerRadius);
  const radius = inner + (number(outerRadius) - inner) * radialPosition;
  return {
    x: number(cx) + radius * Math.cos(-number(midAngle) * RADIAN),
    y: number(cy) + radius * Math.sin(-number(midAngle) * RADIAN),
  };
}

function AllocationLabel(props: DonutLabelProps & { ring: "inner" | "industry" | "subsector" }) {
  const { x, y } = labelPoint(props, props.ring === "inner" ? 0.62 : 0.5);
  const percent = number(props.percent) * 100;
  const name = String(props.name ?? "");
  const compactName = props.ring === "inner"
    ? name.replace(" cap", "")
    : name.replace("Private Sector Bank", "Private Bank").replace("E-Commerce", "E-Commerce").replace("Telecom", "Telecom").replace("Power Generation", "Power Gen").replace("Consumer internet", "Consumer").replace("Specialty chemicals", "Chemicals").replace("Commercial Banking", "Banking").replace("Food Delivery & Quick Commerce", "Food + Quick").replace("Wireless & Digital Services", "Wireless").replace("Renewable Power", "Renewables").replace("Integrated Power & Storage", "Power + Storage").replace("Specialty & Fine Chemicals", "Specialty Chem.");

  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className={`donut-data-label ${props.ring}${percent < 6 ? " compact" : ""}`}>
      <tspan x={x} dy="-0.45em">{compactName}</tspan>
      <tspan x={x} dy="1.15em">{percent.toFixed(1)}%</tspan>
    </text>
  );
}

function HoldingLabel(props: DonutLabelProps) {
  const { x, y } = labelPoint(props);
  const holding = props.payload as LiveHolding | undefined;
  if (!holding) return null;
  const symbol = holding.symbol.replace("ICICIBANK", "ICICI").replace("BHARTIARTL", "AIRTEL").replace("JSWENERGY", "JSW");
  const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="donut-data-label outer">
      <tspan x={x} dy="-1.35em" className="symbol">{symbol}</tspan>
      <tspan x={x} dy="1.05em">{holding.weight.toFixed(1)}%</tspan>
      <tspan x={x} dy="1.05em">U {signed(holding.pnlPct)}</tspan>
      <tspan x={x} dy="1.05em">D {signed(holding.dayPct)}</tspan>
    </text>
  );
}

function RiskPill({ value }: { value: string }) {
  const tone = value.toLowerCase().includes("high") ? "red" : value.toLowerCase().includes("low") ? "green" : "amber";
  return <span className={`pill ${tone}`}>{value}</span>;
}

function HealthCategoryIcon({ name }: { name: string }) {
  if (name === "Sleep") return <Moon size={18}/>;
  if (name === "Heart") return <HeartPulse size={18}/>;
  if (name === "Respiratory") return <Wind size={18}/>;
  if (name === "Mobility") return <Footprints size={18}/>;
  if (name === "Nutrition") return <Utensils size={18}/>;
  return <Activity size={18}/>;
}

function healthTrendTone(metric: HealthMetric, direction: "up" | "down" | "same") {
  if (direction === "same") return "moderate";
  const higherIsGenerallyFavourable = new Set([
    "Active energy", "Exercise minutes", "Stand", "Steps", "Walking + running", "Stairs climbed",
    "Time asleep", "Deep sleep", "REM sleep", "Core sleep", "Cardio recovery", "Cardio fitness",
    "Walking speed", "Step length", "Protein", "Fibre", "Potassium",
  ]);
  const lowerIsGenerallyFavourable = new Set([
    "Resting heart rate", "Walking asymmetry", "Double support", "Awake", "Sodium", "Sugar", "Saturated fat",
  ]);
  if (higherIsGenerallyFavourable.has(metric.label)) return direction === "up" ? "good" : "bad";
  if (lowerIsGenerallyFavourable.has(metric.label)) return direction === "down" ? "good" : "bad";
  return "moderate";
}

function HealthMetricComparison({ metric, averagePeriod }: { metric: HealthMetric; averagePeriod: HealthAveragePeriod }) {
  const average = metric.averages?.[averagePeriod];
  const periodLabel = averagePeriod === "weekly" ? "7-day" : "month-to-date";

  if (!average) {
    return <span className="health-metric-comparison unavailable" aria-label={`${metric.label}: ${periodLabel} average unavailable`}><i>—</i><span>No {periodLabel} avg</span></span>;
  }

  const arrow = average.direction === "up" ? "▲" : average.direction === "down" ? "▼" : "•";
  const direction = average.direction === "up" ? "higher" : average.direction === "down" ? "lower" : "similar";
  const trendTone = healthTrendTone(metric, average.direction);
  return <span className={`health-metric-comparison ${average.direction} trend-${trendTone}`} aria-label={`${metric.label}: ${direction} than ${periodLabel} average of ${average.value}${average.delta ? ` by ${average.delta}` : ""}; optimization tone ${trendTone}`}>
    <i>{arrow}</i><span>{average.delta ?? direction}</span><small>vs {average.value} {periodLabel} avg</small>
  </span>;
}

function HealthMasonryGrid({ categories }: { categories: HealthLiveSnapshot["categories"] }) {
  const [averagePeriod, setAveragePeriod] = useState<HealthAveragePeriod>("weekly");
  const [averagePeriodHydrated, setAveragePeriodHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAveragePeriod(window.localStorage.getItem("health-average-period") === "monthly" ? "monthly" : "weekly");
      setAveragePeriodHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!averagePeriodHydrated) return;
    window.localStorage.setItem("health-average-period", averagePeriod);
  }, [averagePeriod, averagePeriodHydrated]);

  return <>
    <section className="health-average-toolbar" aria-label="Health metric average comparison controls">
      <div><b>Default comparison</b><span>Applied to every KPI below</span></div>
      <div className="segmented health-average-toggle" role="group" aria-label="Compare health metrics with weekly or monthly average">
        <button type="button" className={averagePeriod === "weekly" ? "active" : ""} aria-pressed={averagePeriod === "weekly"} onClick={() => setAveragePeriod("weekly")}>Weekly</button>
        <button type="button" className={averagePeriod === "monthly" ? "active" : ""} aria-pressed={averagePeriod === "monthly"} onClick={() => setAveragePeriod("monthly")}>Monthly (MTD)</button>
      </div>
      <p><span className="trend-good-key">Green · favourable direction</span><span className="trend-moderate-key">Gold · context dependent</span><span className="trend-bad-key">Red · unfavourable direction</span><span>— Average unavailable</span><em>Direction-aware wellness context, not a diagnosis.</em></p>
    </section>
    <section className="health-category-grid">
      {categories.map(category=><article className={`panel health-category ${category.tone}`} key={category.name}><div className="health-category-title"><div><HealthCategoryIcon name={category.name}/><span><h3>{category.name}</h3><p>{category.note}</p></span></div><span className={`dot ${category.tone}`}/></div><div className="health-kpi-grid">{category.metrics.map(metric=><div className={`health-kpi-tile ${metric.tone ?? ""}`} key={`${category.name}-${metric.label}`}><span>{metric.label}</span><b>{metric.value}</b><HealthMetricComparison metric={metric} averagePeriod={averagePeriod}/><small>{metric.context ?? ""}</small></div>)}</div></article>)}
    </section>
  </>;
}

function DashboardTabs({ active, onChange, kiteLive, contentLive, healthIncognito, healthCurrent }: { active: WorkspaceKey; onChange: (workspace: WorkspaceKey) => void; kiteLive: boolean; contentLive: boolean; healthIncognito: boolean; healthCurrent: boolean }) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectByIndex = (index: number) => {
    const normalized = (index + workspaces.length) % workspaces.length;
    const workspace = workspaces[normalized];
    tabsRef.current[normalized]?.focus();
    onChange(workspace.key);
  };
  useEffect(() => {
    const activeIndex = workspaces.findIndex((workspace) => workspace.key === active);
    const timer = window.setTimeout(() => {
      const tab = tabsRef.current[activeIndex];
      const tabList = tab?.parentElement;
      if (tab && tabList) tabList.scrollLeft = Math.max(0, tab.offsetLeft - (tabList.clientWidth - tab.clientWidth) / 2);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [active]);

  return <nav className="workspace-navigation" aria-label="Dashboard workspaces">
    <div className="workspace-tabs" role="tablist" aria-orientation="horizontal">
      {workspaces.map((workspace, index) => {
        const Icon = workspace.icon;
        const badge = workspace.key === "investment" ? (kiteLive ? "LIVE" : "KITE") : workspace.key === "sectors" ? (contentLive ? "FRESH" : "SYNC") : healthIncognito ? "INCOGNITO" : healthCurrent ? "SYNCED" : "STALE";
        return <button
          ref={(node) => { tabsRef.current[index] = node; }}
          id={`workspace-tab-${workspace.key}`}
          key={workspace.key}
          type="button"
          role="tab"
          aria-selected={active === workspace.key}
          aria-controls="dashboard-workspace-panel"
          tabIndex={active === workspace.key ? 0 : -1}
          className={active === workspace.key ? "active" : ""}
          onClick={() => onChange(workspace.key)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); selectByIndex(index + 1); }
            if (event.key === "ArrowLeft") { event.preventDefault(); selectByIndex(index - 1); }
            if (event.key === "Home") { event.preventDefault(); selectByIndex(0); }
            if (event.key === "End") { event.preventDefault(); selectByIndex(workspaces.length - 1); }
          }}
        >
          <Icon size={18}/><span><b>{workspace.label}</b><small>{workspace.note}</small></span><em>{badge}</em>
        </button>;
      })}
    </div>
  </nav>;
}

function CollapsibleSection({ number, title, note, children, headerAction }: { number: string; title: string; note: string; children: ReactNode; headerAction?: ReactNode }) {
  const storageKey = `portfolio-section-${number}-open`;
  const [open, setOpen] = useState(true);
  const [openStateHydrated, setOpenStateHydrated] = useState(false);
  const contentId = `dashboard-section-${number}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(window.localStorage.getItem(storageKey) !== "false");
      setOpenStateHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!openStateHydrated) return;
    window.localStorage.setItem(storageKey, String(open));
  }, [open, openStateHydrated, storageKey]);

  return <section className={`collapsible-section ${open ? "open" : "collapsed"}`}>
    <div className="section-heading collapsible-heading">
      <span>{number}</span>
      <div><h2>{title}</h2><p>{note}</p></div>
      {headerAction && <div className="section-header-action">{headerAction}</div>}
      <button className="collapse-button" type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)} title={`${open ? "Collapse" : "Expand"} ${title}`}>
        <ChevronDown size={18}/><span className="sr-only">{open ? "Collapse" : "Expand"} {title}</span>
      </button>
    </div>
    {open && <div className="collapsible-content" id={contentId}>{children}</div>}
  </section>;
}

function HealthIncognitoToggle({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  return <label className={`incognito-toggle ${active ? "active" : ""}`}>
    {active ? <EyeOff size={17}/> : <Eye size={17}/>}
    <span><b>Health incognito</b><small>{active ? "Stats hidden" : "Hide health stats"}</small></span>
    <input type="checkbox" checked={active} onChange={(event) => onChange(event.target.checked)} aria-label="Hide health statistics"/>
    <i aria-hidden="true"/>
  </label>;
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

const impactGlyph: Record<ImpactSignal, string> = { tailwind: "▲", headwind: "▼", "two-way": "●", na: "—" };

function SectorImpactMatrix({ selectedId, onSelect }: { selectedId: string; onSelect: (sectorId: string) => void }) {
  const headers = [["crude", "Crude"], ["inr", "USD/INR"], ["rates", "Rates"], ["monsoon", "Monsoon"], ["aiCapex", "AI capex"], ["earnings", "Q1 earnings"]] as const;
  return <article className="panel impact-matrix-panel">
    <div className="analytics-subhead"><div><b>A · Sector map + impact matrix (MECE)</b><span>One row per sector · ▲ tailwind · ▼ headwind · ● two-way</span></div><em>21 JUL 2026</em></div>
    <div className="impact-matrix-scroll"><div className="impact-matrix">
      <div className="impact-row impact-head"><span>Sector &amp; stance</span><span>Sub-sectors</span>{headers.map(([, label]) => <span key={label}>{label}</span>)}<span>Current read</span></div>
      {sectorImpactRows.map((row) => { const selectable = sectors.some((sector) => sector.id === row.id); return <button type="button" onClick={() => selectable && onSelect(row.id)} aria-pressed={row.id === selectedId} aria-disabled={!selectable} className={`impact-row ${row.id === selectedId ? "selected" : "sector-dimmed"} ${selectable ? "selectable" : "reference-only"}`} style={{ "--sector": row.color } as CSSProperties} key={row.id}>
        <span><b>{row.name}</b><small>{row.stance}</small></span><span className="subsector-chips">{row.subsectors.map((item) => <i key={item}>{item}</i>)}</span>
        {headers.map(([key]) => <span className={`signal ${row[key]}`} key={key}>{impactGlyph[row[key]]}</span>)}<span className="impact-read">{row.read}</span>
      </button>; })}
    </div></div>
  </article>;
}

function BubbleLabel({ x = 0, y = 0, value = "", activeNames = new Set<string>() }: { x?: number; y?: number; value?: string; activeNames?: Set<string> }) {
  return <text x={x} y={y - 12} textAnchor="middle" className={`bubble-label ${activeNames.has(value) ? "selected" : "dimmed"}`}>{value}</text>;
}

function SectorAnalyticalCharts({ selectedId, holdings }: { selectedId: string; holdings: LiveHolding[] }) {
  const selectedLife = lifeCyclePoints.filter((point) => point.id === selectedId);
  const selectedStructure = marketStructurePoints.filter((point) => point.id === selectedId);
  const activeLifeNames = new Set(selectedLife.map((point) => point.name));
  const activeStructureNames = new Set(selectedStructure.map((point) => point.name));
  const heldSymbols = new Set(holdings.map((holding) => holding.symbol));
  const relevantDialNames = selectedId === "energy" ? new Set(["Brent", "USD / INR", "Nifty", "India VIX"]) : selectedId === "banking" || selectedId === "nbfc" ? new Set(["USD / INR", "Nifty", "Bank Nifty", "India VIX"]) : new Set(["Brent", "USD / INR", "Nifty", "India VIX"]);
  return <div className="sector-analytical-stack">
    <section className="analytics-band"><div className="analytics-subhead"><b>C · Industry life cycle</b><span>Growth stage, expected revenue growth and relative profit pool</span></div><div className="analytics-split">
      <article className="panel bubble-panel"><ResponsiveContainer width="100%" height={360}><ScatterChart margin={{ top: 28, right: 30, bottom: 38, left: 14 }}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="stage" domain={[0.6,5.2]} ticks={[1,2,3,4,5]} tickFormatter={(value) => (["", "Growth", "Shakeout", "Mature", "Decline", "Legacy"][Number(value)] ?? "")}/><YAxis type="number" dataKey="growth" unit="%"/><ZAxis type="number" dataKey="profit" range={[120, 900]}/><ReferenceLine y={10} stroke="#65717c" strokeDasharray="5 5"/><Tooltip cursor={{strokeDasharray:"3 3"}} formatter={(value,name) => [name === "growth" ? `${value}%` : value, String(name)]}/><Scatter data={lifeCyclePoints} name="Subsectors" shape="circle">{lifeCyclePoints.map((point) => <Cell key={point.name} fill={point.color} fillOpacity={point.id === selectedId ? 1 : .12} stroke={point.id === selectedId ? "#fff" : point.color} strokeOpacity={point.id === selectedId ? 1 : .18} strokeWidth={point.id === selectedId ? 3 : 1}/>) }<LabelList dataKey="name" content={<BubbleLabel activeNames={activeLifeNames}/>}/></Scatter></ScatterChart></ResponsiveContainer></article>
      <aside className="panel linked-insight"><h4>Where your money actually sits</h4>{selectedLife.length ? selectedLife.map((point) => <div key={point.name} style={{"--sector":point.color} as CSSProperties}><b>{point.name}</b><span>Expected growth {point.growth}% · profit pool {point.profit}</span></div>) : <p>Select a plotted sector to isolate its subsectors.</p>}<hr/><p>White outlines identify a selected or portfolio-linked sector. Bubble area represents relative profit pool, not market capitalisation.</p></aside>
    </div></section>
    <section className="analytics-band"><div className="analytics-subhead"><b>D · Market structure + value-chain sweet spot</b><span>Profitability versus concentration</span></div><div className="analytics-split">
      <article className="panel bubble-panel"><ResponsiveContainer width="100%" height={340}><ScatterChart margin={{ top: 28, right: 28, bottom: 34, left: 12 }}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="margin" unit="%" name="Operating margin"/><YAxis type="number" dataKey="concentration" domain={[1.5,5.2]} name="Concentration"/><ZAxis type="number" dataKey="profit" range={[140,900]}/><ReferenceLine x={20} stroke="#65717c" strokeDasharray="5 5"/><ReferenceLine y={3.5} stroke="#65717c" strokeDasharray="5 5"/><Tooltip/><Scatter data={marketStructurePoints}>{marketStructurePoints.map((point) => <Cell key={point.name} fill={point.color} fillOpacity={point.id === selectedId ? 1 : .12} stroke={point.id === selectedId ? "#fff" : point.color} strokeOpacity={point.id === selectedId ? 1 : .18} strokeWidth={point.id === selectedId ? 3 : 1}/>) }<LabelList dataKey="name" content={<BubbleLabel activeNames={activeStructureNames}/>}/></Scatter></ScatterChart></ResponsiveContainer></article>
      <aside className="panel linked-insight"><h4>Value-chain sweet spot</h4>{(selectedStructure.length ? selectedStructure : marketStructurePoints.slice(0,4)).map((point) => <div key={point.name} style={{"--sector":point.color} as CSSProperties}><b>{point.name}</b><span>{point.margin}% margin · {point.concentration.toFixed(1)}/5 concentration</span></div>)}<hr/><p>Top-right combines stronger operating economics with concentrated profit pools; verify regulation and valuation before treating it as attractive.</p></aside>
    </div></section>
    <section className="analytics-band"><div className="analytics-subhead"><b>E · Macro dials + volatility squeeze watch</b><span>Distance to decision triggers and current band width</span></div><div className="analytics-split macro-chart-split">
      <article className="panel macro-dial-list">{macroDials.map((dial) => { const position = (dial.value-dial.min)/(dial.max-dial.min)*100; const trigger = (dial.trigger-dial.min)/(dial.max-dial.min)*100; return <div className={relevantDialNames.has(dial.name) ? "selected" : "sector-dimmed"} key={dial.name}><header><b>{dial.name}</b><span>{dial.unit}{dial.value.toLocaleString("en-IN")}</span></header><div><i style={{width:`${Math.max(0,Math.min(100,position))}%`}} className={dial.tone}/><em style={{left:`${Math.max(0,Math.min(100,trigger))}%`}}/></div><small>Trigger {dial.unit}{dial.trigger.toLocaleString("en-IN")}</small></div>})}</article>
      <article className="panel squeeze-chart"><ResponsiveContainer width="100%" height={300}><BarChart data={squeezeWidths} layout="vertical" margin={{top:10,right:34,bottom:18,left:16}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" unit="%"/><YAxis type="category" dataKey="name" width={82}/><Tooltip formatter={(value)=>[`${value}% of price`,"Band width"]}/><Bar dataKey="value" radius={[0,4,4,0]}>{squeezeWidths.map((item)=>{ const selectedCompany = (sectorCompanies[selectedId] ?? []).some((company) => company.symbol === item.name) || heldSymbols.has(item.name) && matchesSelectedSector(selectedId, item.name); return <Cell key={item.name} fill={item.color} fillOpacity={selectedCompany ? 1 : .18}/>; })}<LabelList dataKey="value" position="right" formatter={(value)=>`${value}%`}/></Bar></BarChart></ResponsiveContainer></article>
    </div></section>
  </div>;
}

function SectoralAnalytics({ selectedId, onSelect, market, holdings }: { selectedId: string; onSelect: (sectorId: string) => void; market: SectorMarketSnapshot; holdings: LiveHolding[] }) {
  const [rankingView, setRankingView] = useState<SectorRankingView>("market");
  const [returnHorizon, setReturnHorizon] = useState<SectorReturnHorizon>("month");
  const [fundamentalMetric, setFundamentalMetric] = useState<FundamentalMetricKey>("growth");
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const selected = sectors.find((sector) => sector.id === selectedId) ?? sectors[0];
  const pulseData = sectors.map((sector) => ({
    name: sector.name,
    color: sector.color,
    composite: Number(sectorComposite(sector).toFixed(1)),
    ...Object.fromEntries(sectorScoreLabels.map(({ key }) => [key, Number((sector.scores[key] / sectorScoreLabels.length).toFixed(2))])),
  }));
  const pestelData = pestelAxes.map((axis, index) => ({ axis, score: selected.pestel[index] }));
  const porterData = porterAxes.map((axis, index) => ({
    axis,
    score: selected.porter[index],
    median: Number((sectors.reduce((sum, sector) => sum + sector.porter[index], 0) / sectors.length).toFixed(1)),
  }));
  const marketBySymbol = new Map(market.companies.map((company) => [company.symbol, company]));
  const holdingBySymbol = new Map(holdings.map((holding) => [holding.symbol, holding]));
  const companies = (sectorCompanies[selected.id] ?? []).map((company) => ({ ...company, market: marketBySymbol.get(company.symbol), holding: holdingBySymbol.get(company.symbol) }));
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
  const meceEmojis = ["📈", "💰", "⚖️", "⚠️"];
  const meceBullets = (driver: string) => {
    const parts = driver.split(/\s(?:\+|and|versus)\s|,\s/).map((part) => part.trim()).filter(Boolean).slice(0, 3);
    return parts.length > 1 ? parts : [driver, "Track direction and rate of change"];
  };
  const formatRankValue = (value: number | null) => value === null ? "—" : rankingView === "market" ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : `${value.toFixed(1)} / 5`;

  return <section className="sector-overview" data-sector-filter={selected.id} style={{ "--selected-sector": selected.color } as CSSProperties}>
    <div className="sector-lead" style={{ "--sector": selected.color } as CSSProperties}>
      <div><span>INDIA SECTOR PULSE · REVIEWED THROUGH {currentIstDateLabel().toUpperCase()}</span><h3>{selected.name}: {selected.stance}</h3><p>{selected.summary}</p></div>
      <div className="sector-lead-score"><b>{sectorComposite(selected).toFixed(1)}</b><span>/ 5 composite</span><em>{selected.pulse}</em></div>
    </div>

    <div className="sector-filter-status" style={{ "--sector": selected.color } as CSSProperties}><span>ACTIVE INDUSTRY FILTER</span><b>{selected.name}</b><small>All analytics below are linked to this selection. Dimmed industries remain available as filter toggles.</small></div>
    <div className="sector-selector" role="toolbar" aria-label="Filter every Sectoral Analytics section by industry">
      {sectors.map((sector) => <button type="button" aria-pressed={sector.id === selected.id} key={sector.id} onClick={() => { onSelect(sector.id); setShowAllCompanies(false); }} className={sector.id === selected.id ? "active" : "sector-dimmed"} style={{ "--sector": sector.color } as CSSProperties}><i/><span>{sector.name}</span><small>{sectorComposite(sector).toFixed(1)}</small></button>)}
    </div>

    <SectorImpactMatrix selectedId={selected.id} onSelect={(sectorId) => { if (sectors.some((sector) => sector.id === sectorId)) onSelect(sectorId); }}/>

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

    <SectorAnalyticalCharts selectedId={selected.id} holdings={holdings}/>

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
              {sectors.map((sector) => <Cell key={`${key}-${sector.id}`} fill={sector.color} fillOpacity={sector.id === selected.id ? 1-factorIndex*.13 : .1}/>) }
              {factorIndex === sectorScoreLabels.length - 1 && <LabelList dataKey="composite" position="right" className="sector-total-label" formatter={(value) => `${Number(value).toFixed(1)}/5`}/>}
            </Bar>)}
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article className="panel sector-pestel-panel" style={{ "--sector": selected.color } as CSSProperties}>
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
      </article>
    </div>

    <div className="sector-framework-grid">
      <article className="panel porter-panel" style={{ "--sector": selected.color } as CSSProperties}>
        <div className="panel-title"><div><h3>Porter competitive-pressure radar</h3><p>{selected.name} versus the all-sector median · higher means greater pressure</p></div><Target size={18}/></div>
        <ResponsiveContainer width="100%" height={300}><RadarChart data={porterData} outerRadius="67%" margin={{top:20,right:56,bottom:18,left:56}}><PolarGrid stroke="#49515a"/><PolarAngleAxis dataKey="axis" tick={{fill:"#fff",fontSize:9,fontWeight:800}}/><PolarRadiusAxis angle={90} domain={[0,5]} tickCount={6} tick={{fill:"#dfe5ec",fontSize:8}}/><Radar name="All-sector median" dataKey="median" stroke="#9ca4ad" fill="#9ca4ad" fillOpacity={.08} strokeDasharray="5 4" isAnimationActive={false}/><Radar name={selected.name} dataKey="score" stroke={selected.color} fill={selected.color} fillOpacity={.3} strokeWidth={2.5} isAnimationActive={false}/><Legend/><Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} / 5`, String(name)]}/></RadarChart></ResponsiveContainer>
        <p className="sector-chart-note">Competitive intensity, bargaining leverage, input dependence, substitutes and entry risk are scored independently from 1 (lower pressure) to 5 (higher pressure).</p>
      </article>
      <article className="panel framework-interpretation" style={{ "--sector": selected.color } as CSSProperties}>
        <div className="panel-title"><div><h3>What the shape means</h3><p>{selected.name} · evidence-led interpretation</p></div><Gauge size={18}/></div>
        <h4>{selected.stance}</h4><p>{selected.summary}</p><div className="framework-pressure-list">{porterAxes.map((axis,index) => <div key={axis}><span>{axis}</span><b>{selected.porter[index].toFixed(1)} / 5</b><i style={{width:`${selected.porter[index]/5*100}%`}}/></div>)}</div><small><b>Monitor:</b> {selected.watch}</small>
      </article>
    </div>

    <article className="panel mece-panel">
      <div className="panel-title"><div><h3>MECE sector driver map</h3><p>Every sector is decomposed into non-overlapping demand, earnings, policy and market-pricing lenses</p></div><Layers3 size={18}/></div>
      <div className="mece-matrix"><div className="mece-head"><span>Sector</span><span>Demand engines</span><span>Profit pool</span><span>Policy / structure</span><span>Valuation / risk</span></div>{sectors.map((sector) => <button type="button" aria-pressed={sector.id === selected.id} onClick={() => onSelect(sector.id)} className={`mece-row ${sector.id === selected.id ? "selected" : "sector-dimmed"}`} key={sector.id} style={{ "--sector": sector.color } as CSSProperties}><b><i/>{sector.name}<small>{sector.pulse} · {sectorComposite(sector).toFixed(1)}/5</small></b>{sector.mece.map((driver,index) => <div className="mece-cell" key={`${sector.id}-${index}`}><ul>{meceBullets(driver).map((bullet, bulletIndex) => <li key={`${bullet}-${bulletIndex}`}><span aria-hidden="true">{bulletIndex === 0 ? meceEmojis[index] : "🔎"}</span>{bullet}</li>)}</ul></div>)}</button>)}</div>
    </article>

    <div className="sector-source-note"><Database size={16}/><span>{sectorSourceNote} Company universe: {sectorUniverseLabels[selected.id]}. {market.message}</span><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceLabel} <ExternalLink size={12}/></a></div>
  </section>;
}

function SectorIntelligenceDigest({ content, mailWindow }: { content: ContentDigestSnapshot; mailWindow: string }) {
  const newsletters = content.newsletters;
  const axisResearch = content.axisResearch;
  const podcasts = content.podcasts;
  const calendar = content.calendar;
  const reminders = content.reminders.filter((item) => !item.completed);

  return <section className="digest-grid">
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Newsletter digest</h3><p>iCloud · Newsletters · {mailWindow} · {newsletters.length} items</p></div><Mail size={18}/></div><div className="digest-list">{newsletters.map(item=><div key={`${item.time}-${item.source}-${item.title}`}><span>{item.time}</span><div><b>{item.source}</b><h4>{item.title}</h4><p>{item.summary}</p></div></div>)}{!newsletters.length&&<div className="digest-empty">No item was available from the exact iCloud → Newsletters mailbox in this window.</div>}</div></article>
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Axis Research</h3><p>iCloud · Axis Research · {axisResearch.length} reports · {mailWindow}</p></div><Newspaper size={18}/></div><div className="digest-list">{axisResearch.map(item=><div key={`${item.time}-${item.title}`}><span>{item.time}</span><div><b>{item.source}</b><h4>{item.title}</h4><p>{item.summary}</p></div></div>)}{!axisResearch.length&&<div className="digest-empty">No Axis Research item was available for this window.</div>}</div></article>
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Calendar + action feeds</h3><p>{calendar.length} events · {reminders.length} active reminders</p></div><NotebookTabs size={18}/></div><div className="topic-feed">{(["Earnings","Work/Jobs","Personal","Other"] as const).map((topic)=>{const events=calendar.filter((item)=>item.topic===topic);const tasks=reminders.filter((item)=>item.topic===topic);if(!events.length&&!tasks.length)return null;return <section key={topic}><h4>{topic}<span>{events.length+tasks.length}</span></h4>{events.slice(0,4).map((item)=><p key={item.id}><b>{new Date(item.startsAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</b>{item.title}<small>{item.calendar}</small></p>)}{tasks.slice(0,4).map((item)=><p key={item.id}><b>TODO</b>{item.title}<small>{item.list}</small></p>)}</section>})}{!calendar.length&&!reminders.length&&<div className="digest-empty">No Calendar or active Reminder items were available.</div>}</div></article>
    <article className="panel digest-panel"><div className="panel-title"><div><h3>Podcast summaries</h3><p>{podcasts.length} episodes from the latest local refresh</p></div><Mic2 size={18}/></div><div className="digest-list podcast-digest">{podcasts.map((item,index)=><div key={`${item.time}-${item.source}-${item.title}`}><span>{item.time || String(index+1).padStart(2,"0")}</span><div><b>{item.source}</b><h4>{item.title}</h4><p>{item.summary}</p></div></div>)}{!podcasts.length&&<div className="digest-empty">No podcast episode was available in this window.</div>}</div><div className="digest-note">This complete intelligence digest is local and read-only. Mail bodies and Podcast descriptions remain on this Mac.</div></article>
  </section>;
}

function calendarEarningsEvents(content: ContentDigestSnapshot, existing: EarningsEvent[]): EarningsEvent[] {
  const known = existing.map((event) => `${event.symbol} ${event.name}`.toLowerCase());
  return content.calendar.filter((item) => item.topic === "Earnings").flatMap((item, index) => {
    const normalized = item.title.toLowerCase();
    if (known.some((identity) => identity.split(" ").some((token) => token.length > 3 && normalized.includes(token)))) return [];
    const parsed = new Date(item.startsAt);
    if (Number.isNaN(parsed.getTime())) return [];
    const day = new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }).format(parsed);
    const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(parsed);
    const symbol = `CAL-${index + 1}`;
    const banking = /bank|finance|nbfc|insurance/i.test(item.title);
    const technology = /tech|software|digital|infosys|tcs|wipro/i.test(item.title);
    const kpiLabels = banking ? ["PAT", "NII / income", "Asset quality", "Margin / credit cost"] : technology ? ["Revenue / CC growth", "Operating margin", "Deal wins", "Guidance"] : ["Revenue", "Profit", "Operating margin", "Management guidance"];
    return [{ date, day, symbol, name: item.title, state: "Pending · Apple Calendar", portfolio: false, period: "Latest quarter", reported: false, kpis: kpiLabels.map((label) => ({ label, value: "", change: "" })), summary: item.notes || "Calendar event imported from Apple Calendar. KPI fields remain blank until a cited company or exchange result is available." }];
  });
}

function EarningsCalendarWorkbench({ snapshot, content }: { snapshot: EarningsSnapshot; content: ContentDigestSnapshot }) {
  const baseEvents = snapshot.events.length ? snapshot.events : earningsCalendar;
  const events = useMemo(() => [...baseEvents, ...calendarEarningsEvents(content, baseEvents)].sort((left, right) => Number(left.day) - Number(right.day)), [baseEvents, content]);
  const [selectedSymbol, setSelectedSymbol] = useState(events[0].symbol);
  const selected = events.find((event) => event.symbol === selectedSymbol) ?? events[0];
  const reportedCount = events.filter((event) => event.reported).length;

  return <article className="panel catalyst-card earnings-workbench">
    <div className="panel-title"><div><h3>Earnings calendar</h3><p>{events.length} events across all tracked industries · select any company for reported KPIs or pending fields</p></div><span className={`pill ${snapshot.status === "verified" ? "green" : snapshot.status === "stale" ? "amber" : "red"}`}>{snapshot.status} · {snapshot.asOf}</span></div>
    <div className="earnings-progress"><span><b>{reportedCount}</b> reported</span><i><span style={{width:`${reportedCount / events.length * 100}%`}}/></i><span><b>{events.length - reportedCount}</b> pending</span></div>
    <div className="earnings-rail" role="tablist" aria-label="Select earnings event">{events.map((event) => <button type="button" role="tab" aria-selected={event.symbol === selected.symbol} className={`${event.symbol === selected.symbol ? "active" : ""} ${event.reported ? "reported" : "pending"} ${event.portfolio ? "portfolio" : ""}`} key={`${event.date}-${event.symbol}`} onClick={() => setSelectedSymbol(event.symbol)}>
      <span>{event.day}<small>JUL</small></span><b>{event.symbol}</b><i aria-hidden="true"/><em>{event.reported ? "Reported" : event.portfolio ? "Holding" : "Pending"}</em>
    </button>)}</div>
    <section className={`earnings-detail ${selected.reported ? "reported" : "pending"}`} role="tabpanel">
      <div className="earnings-detail-heading"><div><span>{selected.period} · {selected.date}</span><h4>{selected.name}</h4><p>{selected.symbol}{selected.portfolio ? " · Current portfolio holding" : ""}</p></div><span className={`pill ${selected.reported ? "green" : selected.portfolio ? "red" : "amber"}`}>{selected.state}</span></div>
      <div className="earnings-kpi-grid">{selected.kpis.map((kpi) => <div className={kpi.value ? "filled" : "empty"} key={`${selected.symbol}-${kpi.label}`}><span>{kpi.label}</span>{kpi.value ? <><b>{kpi.value}</b><small className={kpi.tone ?? ""}>{kpi.change}</small></> : <><b className="blank-value" aria-label="Pending result value"/><small aria-hidden="true">&nbsp;</small></>}</div>)}</div>
      {selected.reported ? <div className="earnings-result-note"><CheckCircle2 size={17}/><p>{selected.summary}</p>{selected.source && <a href={selected.source} target="_blank" rel="noreferrer" title="Open company investor presentation">Source <ExternalLink size={12}/></a>}</div> : <div className="earnings-pending-note"><span/><p>{selected.summary ?? "KPI fields are intentionally blank and will be populated only after the company publishes its result."}</p>{selected.source && <a href={selected.source} target="_blank" rel="noreferrer" title="Open official earnings source">Official source <ExternalLink size={12}/></a>}</div>}
    </section>
    <p className="earnings-footnote">Calendar dates refresh through the current analysis day. Reported rows require a cited company/exchange source; pending KPI fields stay blank until publication.</p>
  </article>;
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
  if (!selected) return <section className="axis-workbench"><div className="live-empty"><Mail size={24}/><b>No Axis recommendation was parsed for {analysisWindowLabel(content)}</b><p>The exact iCloud → Axis Research mailbox refreshed successfully, but no qualifying BUY/HOLD/SELL target was found in the selected analysis window. No older static call is being presented as current.</p></div></section>;
  const categories = [
    { label: "Fundamental", count: recommendations.filter((item) => !item.call.includes("TECHNICAL") && !item.call.includes("TRADING")).length, tone: "green" },
    { label: "Technical", count: recommendations.filter((item) => item.call.includes("TECHNICAL")).length, tone: "blue" },
    { label: "Trading", count: recommendations.filter((item) => item.call.includes("TRADING")).length, tone: "amber" },
  ];
  const upside = selected.target && selected.cmp ? (selected.target / selected.cmp - 1) * 100 : null;
  const category = selected.call.includes("TECHNICAL") ? "Technical" : selected.call.includes("TRADING") ? "Trading" : "Fundamental";
  const thesisBullets = selected.thesis.split(/;|, and |, /).map((item) => item.trim()).filter(Boolean).slice(0, 3);

  return <section className="axis-workbench">
    <div className="axis-audit-strip">
      <div><Database size={18}/><span><b>{axisArchiveAudit.filesAttempted} files attempted</b><small>{axisArchiveAudit.validPdfs} valid PDFs · {axisArchiveAudit.pagesRead.toLocaleString("en-IN")} pages extracted</small></span></div>
      <div><b>{axisArchiveAudit.duplicateGroups}</b><small>exact duplicate group</small></div>
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
        <ul className="axis-thesis-bullets">{thesisBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
        <div className="axis-evidence"><FileText size={15}/><span><b>Evidence:</b> {selected.source} · {selected.date}</span></div>
      </article>
    </div>
    <div className="table-note"><FileText size={16}/><span>Mail-first policy: qualifying Axis reports from {analysisWindowLabel(content)} are shown. Refreshed {content.asOf}; archive PDFs remain supplementary evidence only.</span></div>
  </section>;
}

function SectorDecisionFramework() {
  const [framework, setFramework] = useState<"pestel" | "porter" | "mece" | "allocation">("pestel");
  const [frameworkSectorId, setFrameworkSectorId] = useState("pharma");
  const sector = sectors.find((item) => item.id === frameworkSectorId) ?? sectors[0];
  const frameworks = {
    pestel: { label: "PESTEL", question: "Is the external environment supportive?", items: pestelAxes.map((axis, index) => ({ title: axis, value: `${sector.pestel[index].toFixed(1)} / 5`, text: index < 2 ? sector.watch : sector.mece[index % sector.mece.length] })) },
    porter: { label: "Porter", question: "Where is competitive pressure concentrated?", items: porterAxes.map((axis, index) => ({ title: axis, value: `${sector.porter[index].toFixed(1)} / 5 pressure`, text: sector.mece[(index + 1) % sector.mece.length] })) },
    mece: { label: "MECE", question: "Which independent driver changes the decision?", items: ["Demand engines", "Profit pool", "Policy / structure", "Valuation / risk"].map((title, index) => ({ title, value: `Lens ${index + 1}`, text: sector.mece[index] })) },
    allocation: { label: "Decision gates", question: "What must happen before capital is committed?", items: [
      { title: "Evidence gate", value: "Official + current", text: `Confirm KPI direction and reporting period. ${sector.watch}` },
      { title: "Breadth gate", value: "Constituent-confirmed", text: "Require leadership across multiple constituents, not one index heavyweight." },
      { title: "Valuation gate", value: "Risk-adjusted", text: "Compare earnings revisions, cash conversion and balance-sheet risk with the price paid." },
      { title: "Execution gate", value: "Staged", text: "Size gradually, define invalidation triggers and review after the next reported catalyst." },
    ] },
  } as const;
  const active = frameworks[framework];
  return <article className="panel decision-workbench" style={{"--sector":sector.color} as CSSProperties}>
    <div className="panel-title"><div><h3>Decision framework</h3><p>{sector.name} · business-framework evidence before allocation</p></div><CircleDollarSign size={18}/></div>
    <div className="decision-sector-tabs" role="tablist" aria-label="Select decision-framework industry">{sectors.map((item) => <button type="button" role="tab" aria-selected={frameworkSectorId === item.id} className={frameworkSectorId === item.id ? "active" : ""} onClick={() => setFrameworkSectorId(item.id)} key={item.id}>{item.name}</button>)}</div>
    <div className="decision-tabs" role="tablist">{(Object.keys(frameworks) as Array<keyof typeof frameworks>).map((key) => <button type="button" role="tab" aria-selected={framework === key} className={framework === key ? "active" : ""} onClick={() => setFramework(key)} key={key}>{frameworks[key].label}</button>)}</div>
    <div className="decision-question"><b>{active.question}</b><span>{sector.pulse} pulse · composite {sectorComposite(sector).toFixed(1)} / 5</span></div>
    <div className="decision-card-grid">{active.items.map((item) => <div key={item.title}><span>{item.title}</span><b>{item.value}</b><p>{item.text}</p></div>)}</div>
    <div className="decision-sequence"><span>1 · Source</span><span>2 · Compare</span><span>3 · Stress-test</span><span>4 · Size</span><span>5 · Monitor</span></div>
  </article>;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function latestCompletedHealthDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function missingHealthDateKeys(dataDate: string, requiredDate = latestCompletedHealthDateKey()) {
  const start = new Date(`${dataDate}T12:00:00`);
  const end = new Date(`${requiredDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return [];
  const dates: string[] = [];
  for (const date = new Date(start); date < end;) {
    date.setDate(date.getDate() + 1);
    dates.push(localDateKey(date));
  }
  return dates;
}

function compactHealthDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function DailyKanbanBoard({ workspace }: { workspace: KanbanWorkspace }) {
  const storageKey = `dashboard-kanban-${workspace}-v2`;
  const [state, setState] = useState<{ date: string; completed: string[] }>({ date: "", completed: [] });
  const [kanbanHydrated, setKanbanHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as { date?: string; completed?: string[] } | null;
        const today = localDateKey();
        if (!stored || stored.date !== today) setState({ date: today, completed: [] });
        else setState({ date: today, completed: stored.completed ?? [] });
      } catch {
        setState({ date: localDateKey(), completed: [] });
      }
      setKanbanHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (kanbanHydrated) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [kanbanHydrated, state, storageKey]);
  useEffect(() => {
    if (!kanbanHydrated || !state.date) return;
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setState({ date: localDateKey(midnight), completed: [] }), midnight.getTime() - now.getTime() + 1000);
    return () => window.clearTimeout(timer);
  }, [kanbanHydrated, state.date]);

  const items = kanbanItems[workspace];
  const toggle = (id: string) => setState((current) => ({ ...current, completed: current.completed.includes(id) ? current.completed.filter((item) => item !== id) : [...current.completed, id] }));
  const lanes = [{ key: "today", label: "To do today" }, { key: "monitor", label: "Monitor" }, { key: "done", label: "Completed today" }] as const;
  return <section className="kanban-board">
    <div className="kanban-summary"><div><Target size={18}/><span><b>Daily action board</b><small>{items.length} active · {state.completed.length} completed · resets at local midnight</small></span></div><em>{localDateKey()}</em></div>
    <div className="kanban-lanes">{lanes.map((lane) => {
      const laneItems = items.filter((item) => lane.key === "done" ? state.completed.includes(item.id) : item.lane === lane.key && !state.completed.includes(item.id));
      return <article className={`kanban-lane ${lane.key} ${laneItems.length ? "" : "empty"}`} key={lane.key}><header><b>{lane.label}</b><span>{laneItems.length}</span></header><div>{laneItems.map((item) => {
        const completed = state.completed.includes(item.id);
        const cardLabel = `${completed ? "Mark incomplete" : "Mark complete"}: ${item.title}. ${item.detail} ${item.numericAdvantage}. ${item.strategicAdvantage}`;
        return <button type="button" className={`kanban-card ${item.tone} ${completed ? "completed" : ""}`} aria-label={cardLabel} title={completed ? `${item.detail} · ${item.numericAdvantage} · ${item.strategicAdvantage}` : undefined} onClick={() => toggle(item.id)} key={item.id}><span className="kanban-check">{completed ? <CheckCircle2 size={17}/> : <i/>}</span><strong>{item.title}</strong><p>{item.detail}</p><small><b>{item.numericAdvantage}</b><em>{item.strategicAdvantage}</em></small></button>;
      })}{!laneItems.length && <p className="kanban-empty">Empty</p>}</div></article>;
    })}</div>
  </section>;
}

export default function Home() {
  const [workspace, setWorkspace] = useState<WorkspaceKey>("investment");
  const [macroEventKey, setMacroEventKey] = useState<MacroEventKey>("oilWar");
  const [macroBandKey, setMacroBandKey] = useState<MacroBandKey>("base");
  const [view, setView] = useState<"holdings" | "activity">("holdings");
  const [snapshot, setSnapshot] = useState<KiteSnapshot>(emptySnapshot);
  const [content, setContent] = useState<ContentDigestSnapshot>(fallbackContent);
  const [contentError, setContentError] = useState("");
  const [earningsSnapshot, setEarningsSnapshot] = useState<EarningsSnapshot>(fallbackEarnings);
  const [earningsError, setEarningsError] = useState("");
  const [healthSnapshot, setHealthSnapshot] = useState<HealthLiveSnapshot>(fallbackHealth);
  const [healthError, setHealthError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [sourceFreshness, setSourceFreshness] = useState<SourceFreshness[]>([]);
  const [portfolioRisk, setPortfolioRisk] = useState("ICICIBANK");
  const [axisRisk, setAxisRisk] = useState("RSYSTEMS");
  const [healthIncognito, setHealthIncognito] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState("pharma");
  const [sectorMarket, setSectorMarket] = useState<SectorMarketSnapshot>(() => emptySectorSnapshot("pharma"));
  const selectedSectorRef = useRef("pharma");
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const { holdings, portfolio, orders, gtts, marketCapAllocation, sectorAllocation, subSectorAllocation, classification, asOf } = snapshot;
  const isLive = snapshot.status === "live";
  const isSnapshot = snapshot.status === "snapshot";
  const hasPortfolio = isLive || isSnapshot;
  const healthCurrent = healthSnapshot.status === "live" && healthSnapshot.dataDate >= latestCompletedHealthDateKey();
  const healthRequiredDate = latestCompletedHealthDateKey();
  const healthMissingDates = useMemo(() => missingHealthDateKeys(healthSnapshot.dataDate, healthRequiredDate), [healthSnapshot.dataDate, healthRequiredDate]);
  const unavailable = new Set(snapshot.unavailableSections ?? []);
  const currentBySymbol = useMemo(() => new Map(holdings.map((holding) => [holding.symbol, holding.price])), [holdings]);
  const mailAxisRecommendations = useMemo<MailRecommendation[]>(() => content.sources.axisResearch.status === "live"
    ? content.investment.axisRecommendations
    : axisRecommendations.map((item) => ({ ...item })), [content]);
  const mailAxisProfiles = useMemo<RiskProfile[]>(() => Array.from(new Map(mailAxisRecommendations.map((item) => [item.symbol, { symbol: item.symbol, name: item.name, color: item.color, scores: item.scores }])).values()), [mailAxisRecommendations]);
  const livePortfolioRiskProfiles = useMemo<RiskProfile[]>(() => {
    const known = new Map(portfolioRiskProfiles.map((profile) => [profile.symbol, profile]));
    return holdings.map((holding) => known.get(holding.symbol) ?? {
      symbol: holding.symbol,
      name: holding.name,
      color: holding.color,
      scores: [
        3,
        Math.max(1, Math.min(5, Math.round((holding.oil + holding.flow) / 2))),
        /large/i.test(holding.marketCap) ? 1 : /mid/i.test(holding.marketCap) ? 3 : 4,
        /high/i.test(holding.risk) ? 4 : /low/i.test(holding.risk) ? 2 : 3,
        Math.max(holding.oil, holding.flow),
        3,
      ] as RiskProfile["scores"],
    });
  }, [holdings]);
  const mailWindow = useMemo(() => analysisWindowLabel(content), [content]);
  const analystRows = useMemo(() => [
    ...mailAxisRecommendations.map((item) => ({ symbol: item.symbol, house: `${item.source} / iCloud Axis Research`, rating: item.call, target: item.target, date: item.date, thesis: item.thesis, mail: true })),
    ...analystCalls.filter((item) => !mailAxisRecommendations.some((axis) => axis.symbol === item.symbol)).map((item) => ({ ...item, mail: false })),
  ], [mailAxisRecommendations]);
  const donutHoldings = useMemo(() => holdings.slice().sort((a, b) => `${a.marketCap}|${a.sector}|${a.subSector}|${a.symbol}`.localeCompare(`${b.marketCap}|${b.sector}|${b.subSector}|${b.symbol}`)), [holdings]);
  const exposureComposition = useMemo(() => {
    const profileBySymbol = new Map(portfolioRiskProfiles.map((profile) => [profile.symbol, profile]));
    return holdings.map((holding) => {
      const scores = profileBySymbol.get(holding.symbol)?.scores ?? [3, 3, 3, 3, 3, 3];
      const rawScores = {
        oilWar: holding.oil,
        fiiFlow: holding.flow,
        valuation: scores[0],
        liquidity: scores[2],
        volatility: scores[3],
        leverage: scores[5],
      };
      const contributions = Object.fromEntries(
        Object.entries(rawScores).map(([key, score]) => [key, Number((score / exposureFactors.length).toFixed(3))]),
      );
      const total = Object.values(rawScores).reduce((sum, score) => sum + score, 0) / exposureFactors.length;
      return {
        symbol: holding.symbol.replace("ICICIBANK", "ICICI").replace("BHARTIARTL", "AIRTEL").replace("JSWENERGY", "JSW"),
        fullSymbol: holding.symbol,
        total: Number(total.toFixed(1)),
        rawScores,
        ...contributions,
        ...(exposureContext[holding.symbol] ?? { event: "Company and macro events", kpis: "Earnings, valuation and balance-sheet KPIs" }),
      };
    });
  }, [holdings]);

  const loadKite = useCallback(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`/api/kite/snapshot?refresh=${Date.now()}-${attempt}`, { cache: "no-store" });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Kite refresh returned ${response.status} ${contentType || "without JSON"}`);
        }
        const data = await response.json() as KiteSnapshot;
        if (!response.ok) throw new Error(data.message || `Kite refresh returned ${response.status}`);
        setSnapshot(data);
        return;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    }

    setSnapshot((current) => current.status === "live" || current.status === "snapshot"
      ? { ...current, message: `${current.message} Latest refresh failed; retaining the last validated values.` }
      : { ...emptySnapshot, message: lastError instanceof Error ? lastError.message : "Could not load live Kite data." });
  }, []);

  const loadContent = useCallback(async () => {
    try {
      const response = await fetch(`/api/content/refresh?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Content refresh returned ${response.status}`);
      const data = await response.json() as ContentDigestSnapshot;
      setContent(data);
      setContentError("");
    } catch (error) {
      setContentError(error instanceof Error ? error.message : "Mail and Podcasts refresh failed.");
    }
  }, []);

  const loadEarnings = useCallback(async () => {
    try {
      const response = await fetch(`/api/earnings/snapshot?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as EarningsSnapshot;
      if (!response.ok || !Array.isArray(data.events)) throw new Error(data.message || `Earnings refresh returned ${response.status}`);
      setEarningsSnapshot(data);
      setEarningsError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Earnings refresh failed.";
      setEarningsError(message);
      setEarningsSnapshot((current) => ({ ...current, status: "stale", message: `${current.message} Latest refresh failed: ${message}` }));
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch(`/_health/snapshot?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as HealthLiveSnapshot & { message?: string };
      if (!response.ok) {
        if (response.status === 404) {
          setHealthSnapshot(fallbackHealth);
          setHealthError("");
          return;
        }
        throw new Error(data.message || `Health sync returned ${response.status}`);
      }
      if (data.schemaVersion !== 1 || !Array.isArray(data.categories)) throw new Error("Health sync returned an invalid snapshot");
      const current = data.dataDate >= latestCompletedHealthDateKey();
      setHealthSnapshot({
        ...data,
        status: current ? "live" : "stale",
        message: current
          ? `Latest completed-day HealthKit data is available through ${data.dataDate}.`
          : `HealthKit data currently stops at ${data.dataDate}; latest completed day is ${latestCompletedHealthDateKey()}.`,
      });
      setHealthError("");
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "HealthKit sync is unavailable.");
      setHealthSnapshot((current) => ({
        ...current,
        status: "stale",
        message: current === fallbackHealth
          ? fallbackHealth.message
          : "The latest HealthKit refresh failed; retaining the last validated snapshot.",
      }));
    }
  }, []);

  const loadSectorMarket = useCallback(async (sectorId: string) => {
    try {
      const response = await fetch(`/api/sectors/snapshot?sector=${encodeURIComponent(sectorId)}&refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Sector refresh returned ${response.status}`);
      const data = await response.json() as SectorMarketSnapshot;
      if (data.sectorId === selectedSectorRef.current) setSectorMarket(data);
    } catch (error) {
      if (sectorId === selectedSectorRef.current) setSectorMarket({ ...emptySectorSnapshot(sectorId), message: error instanceof Error ? error.message : "Sector market refresh failed." });
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const run = (async () => {
      setRefreshing(true);
      try {
        try {
          const response = await fetch(`/api/dashboard/refresh?refresh=${Date.now()}`, { cache: "no-store" });
          const result = await response.json() as DashboardRefreshResult;
          if (!response.ok) throw new Error(`Complete refresh returned ${response.status}`);
          setSourceFreshness(result.sources);
          if (result.kite) setSnapshot(result.kite);
          if (result.content) { setContent(result.content); setContentError(""); }
          if (result.earnings) { setEarningsSnapshot(result.earnings); setEarningsError(""); }
          if (result.health) { setHealthSnapshot(result.health); setHealthError(""); }
        } catch (error) {
          setContentError(error instanceof Error ? error.message : "Complete refresh failed; source adapters are retrying.");
          await Promise.allSettled([loadKite(), loadContent(), loadEarnings(), loadHealth()]);
        }
        await Promise.allSettled(Object.keys(sectorCompanies).map((sectorId) => loadSectorMarket(sectorId)));
      } finally {
        setRefreshing(false);
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = run;
    return run;
  }, [loadContent, loadEarnings, loadHealth, loadKite, loadSectorMarket]);

  const selectWorkspace = useCallback((next: WorkspaceKey, historyMode: "push" | "replace" = "push") => {
    setWorkspace(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history[historyMode === "push" ? "pushState" : "replaceState"]({ view: next }, "", url);
  }, []);

  const selectSector = useCallback((sectorId: string) => {
    selectedSectorRef.current = sectorId;
    setSelectedSectorId(sectorId);
    setSectorMarket(emptySectorSnapshot(sectorId));
    void loadSectorMarket(sectorId);
  }, [loadSectorMarket]);

  useEffect(() => {
    const fromUrl = () => {
      const value = new URL(window.location.href).searchParams.get("view");
      const next = workspaces.some((item) => item.key === value) ? value as WorkspaceKey : "investment";
      setWorkspace(next);
      if (value !== next) {
        const url = new URL(window.location.href);
        url.searchParams.set("view", next);
        window.history.replaceState({ view: next }, "", url);
      }
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, []);

  useEffect(() => {
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [workspace]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshAll(), 0);
    const interval = window.setInterval(() => void refreshAll(), 5 * 60 * 1000);
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void refreshAll();
    };
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
    };
  }, [refreshAll]);

  const portfolioMoney = (value: number) => hasPortfolio ? inr.format(value) : "—";

  return (
    <main className="dashboard-app">
      <header className="masthead">
        <div>
          <div className="eyebrow">PORTFOLIO INTELLIGENCE</div>
          <h1>Investment Brief</h1>
          <p>Quarter outlook, oil/geopolitical exposure, flows and analyst positioning</p>
        </div>
        <div className="status-panel">
          <div><Activity size={16}/><span>Kite snapshot</span><b className={snapshot.status}>{isLive ? "Live" : isSnapshot ? "Snapshot" : snapshot.status === "auth_required" ? "Authenticate" : "Unavailable"}</b></div>
          <small>As of {asOf}</small>
          <HealthIncognitoToggle active={healthIncognito} onChange={setHealthIncognito}/>
          <a href="/report?export=1"><FileText size={15}/> Refresh &amp; Export PDF</a>
        </div>
      </header>

      <section className={`live-feed-banner ${snapshot.status}`}>
        <div><Activity size={17}/><span><b>{isLive ? "Live Kite Connect data" : isSnapshot ? "Last validated Kite snapshot" : snapshot.status === "auth_required" ? "Kite authentication required" : "Waiting for live Kite data"}</b><small>{snapshot.message}</small></span></div>
        <div className="live-feed-actions">
          {isLive
            ? <button className="kite-auth-control authenticated" type="button" disabled title="Kite is already authenticated"><CheckCircle2 size={15}/><span>Kite authenticated</span></button>
            : snapshot.authUrl
              ? <a className="kite-auth-control" href={snapshot.authUrl} target="_blank" rel="noreferrer" title="Open Zerodha Kite login"><LogIn size={15}/><span>Authenticate Kite</span><ExternalLink size={13}/></a>
              : <button className="kite-auth-control unavailable" type="button" disabled title="The Kite login link is not available yet"><LogIn size={15}/><span>Kite login unavailable</span></button>}
          <button onClick={()=>void refreshAll()} disabled={refreshing} title="Refresh Kite, earnings, HealthKit snapshot, Mail, Podcasts and every tracked sector now"><RefreshCw size={15} className={refreshing?"spin":""}/><span>{refreshing?"Refreshing complete dashboard":"Refresh all"}</span></button>
          <em>All sources · 5 min</em>
        </div>
      </section>
      {sourceFreshness.length>0&&<section className="source-freshness-strip" aria-label="Complete dashboard source freshness">{sourceFreshness.map((source)=><div key={source.source} title={source.message}><i className={source.state}/><span><b>{source.source}</b><small>{source.state.replaceAll("_"," ")} · {source.period}</small></span></div>)}</section>}

      <DashboardTabs active={workspace} onChange={selectWorkspace} kiteLive={isLive} contentLive={content.status === "live"} healthIncognito={healthIncognito} healthCurrent={healthCurrent}/>

      <section id="dashboard-workspace-panel" className="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${workspace}`}>

      {workspace === "investment" && <div className="workspace-section">
      <CollapsibleSection number="I-1" title="Investment action board" note="Clickable daily actions, numeric advantages and strategic rationale">
        <DailyKanbanBoard workspace="investment"/>
      </CollapsibleSection>
      </div>}

      {workspace === "sectors" && <div className="workspace-section">
      <CollapsibleSection number="S-1" title="Sector action board" note="Clickable research actions with measurable and strategic advantages">
        <DailyKanbanBoard workspace="sectors"/>
      </CollapsibleSection>
      </div>}

      {workspace === "health" && <div className="workspace-section">
      <CollapsibleSection number="H-1" title="Health action board" note={healthIncognito ? "Hidden while Health Incognito is active" : "Daily source, trend and optimisation actions"}>
        {healthIncognito ? <section className="health-incognito-placeholder"><EyeOff size={28}/><h3>Health action board hidden</h3><p>Incognito also hides health-related actions and strategic notes.</p></section> : <DailyKanbanBoard workspace="health"/>}
      </CollapsibleSection>
      </div>}

      {workspace === "investment" && <div className="workspace-section">
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
                <Pie data={marketCapAllocation} dataKey="value" nameKey="name" innerRadius="18%" outerRadius="31%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="inner"/>}>{marketCapAllocation.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie>
                <Pie data={sectorAllocation} dataKey="value" nameKey="name" innerRadius="34%" outerRadius="50%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="industry"/>}>{sectorAllocation.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie>
                <Pie data={subSectorAllocation} dataKey="value" nameKey="name" innerRadius="53%" outerRadius="70%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="#ffffff" strokeWidth={1.25} isAnimationActive={false} labelLine={false} label={(props) => <AllocationLabel {...props} ring="subsector"/>}>{subSectorAllocation.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie>
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
      </div>}

      {workspace === "investment" && <div className="workspace-section">
      <CollapsibleSection number="I-3" title="Macro scenario lab" note="Select an event, its decision range and the matching Mail evidence">
        <MacroScenarioBoard eventKey={macroEventKey} bandKey={macroBandKey} onEventChange={(key) => { setMacroEventKey(key); setMacroBandKey("base"); }} onBandChange={setMacroBandKey} content={content}/>
      </CollapsibleSection>
      </div>}

      {workspace === "investment" && <div className="workspace-section">
      <CollapsibleSection number="I-4" title="Analyst call matrix" note="Targets are reference points, not quarter forecasts">
      <section className="panel table-scroll"><table><thead><tr><th>Stock</th><th>Source / house</th><th>Call</th><th>Target</th><th>Implied vs live</th><th>Published</th><th>What matters</th></tr></thead><tbody>{analystRows.map(a=>{const current=currentBySymbol.get(a.symbol);const implied=current&&a.target?(a.target/current-1)*100:null;return <tr key={`${a.symbol}-${a.house}`}><td><b>{a.symbol}</b>{a.mail&&<small className="mail-row-label">WINDOW MAIL</small>}</td><td>{a.house}</td><td><span className="pill blue">{a.rating}</span></td><td>{a.target?inr.format(a.target):"—"}</td><td className={implied===null?"":implied>=0?"positive":"negative"}>{implied===null?"—":`${implied>=0?"+":""}${implied.toFixed(1)}%`}</td><td>{a.date}</td><td>{a.thesis}</td></tr>})}</tbody></table><div className="table-note"><Target size={16}/><span>Axis Mail calls from {analysisWindowLabel(content)} are prioritised and deduplicated by symbol; other houses remain explicitly labelled supplementary references. Implied upside uses each live Kite last price.</span></div></section>
      </CollapsibleSection>
      </div>}

      {workspace === "sectors" && <div className="workspace-section">
      <CollapsibleSection number="S-2" title="Sectoral analytics" note="Impact matrix, framework comparison, industry life cycle, market structure and macro dials">
        <SectoralAnalytics selectedId={selectedSectorId} onSelect={selectSector} market={sectorMarket} holdings={holdings}/>
      </CollapsibleSection>
      </div>}

      {workspace === "investment" && <div className="workspace-section">
      <CollapsibleSection number="I-5" title="Risk radar" note="Six-factor comparison for live holdings and current Axis recommendations">
      <section className="risk-grid">
        <article className="panel risk-panel"><div className="panel-title"><div><h3>Portfolio / holdings risk</h3><p>{livePortfolioRiskProfiles.length} current Kite holdings · selectable against live-portfolio average</p></div><ScanSearch size={18}/></div><RiskRadar profiles={livePortfolioRiskProfiles} selected={portfolioRisk} onSelect={setPortfolioRisk} averageLabel="Current portfolio average" emptyLabel="No live holding risk profiles" /></article>
        <article className="panel risk-panel"><div className="panel-title"><div><h3>Axis recommended stocks risk</h3><p>{mailWindow} · {mailAxisProfiles.length} deduplicated Axis calls from iCloud → Axis Research</p></div><Target size={18}/></div><RiskRadar profiles={mailAxisProfiles} selected={axisRisk} onSelect={setAxisRisk} averageLabel="Axis list average" emptyLabel={`No Axis risk profiles for ${mailWindow}`} /></article>
      </section>
      </CollapsibleSection>
      </div>}

      {workspace === "investment" && <div className="workspace-section">
      <CollapsibleSection number="I-6" title="Axis recommended stocks" note="Visual call categories, upside, horizon and evidence · iCloud Axis Research plus validated archive PDFs">
        <AxisRecommendationWorkbench recommendations={mailAxisRecommendations} content={content}/>
      </CollapsibleSection>
      </div>}

      {workspace === "sectors" && <div className="workspace-section">
      <CollapsibleSection number="S-3" title="Live intelligence digest" note={`Mail, Calendar, Reminders, Notes and Podcasts · ${content.status === "live" ? `updated ${content.asOf}` : contentError ? `refresh issue: ${contentError}` : "waiting for local refresh"}`}>
      <SectorIntelligenceDigest content={content} mailWindow={mailWindow}/>
      </CollapsibleSection>
      </div>}

      {workspace === "health" && <div className="workspace-section">
      <CollapsibleSection number="H-2" title="Health & wellness" note={healthIncognito ? "Health statistics hidden by Incognito" : `Private HealthKit snapshot · data through ${healthSnapshot.dataDate}`} headerAction={healthIncognito ? <span className="pill amber"><EyeOff size={12}/> INCOGNITO</span> : <span className={`pill ${healthCurrent ? "green" : "amber"}`}>{healthCurrent ? "LATEST" : "STALE"}</span>}>
      {healthIncognito ? <section className="health-incognito-placeholder"><EyeOff size={28}/><h3>Health statistics hidden</h3><p>Incognito removes all health values, comparisons and recommendations from the rendered dashboard.</p><button type="button" onClick={() => setHealthIncognito(false)}><Eye size={15}/> Show health statistics</button></section> : <>
        <section className={`health-privacy ${healthCurrent ? "current" : "stale"}`}><HeartPulse size={18}/><div><b>{healthCurrent ? "Latest completed-day HealthKit data" : `Missing completed-day HealthKit data: ${healthMissingDates.map(compactHealthDate).join(", ") || "iPhone sync required"}`}</b><span>{healthSnapshot.message}{healthError ? ` ${healthError}.` : ""} The dashboard checks again on open, focus, network reconnection and every five minutes. Body Measurements, Hearing and medication details remain excluded.</span></div><span className={`pill ${healthCurrent ? "green" : "amber"}`}>{healthCurrent ? "SYNCED" : "STALE"}</span></section>

        <section className="health-coverage-strip" aria-label="HealthKit completed-day coverage">
          <div><span>Required through</span><b>{compactHealthDate(healthRequiredDate)}</b><small>D-1 policy</small></div>
          <div><span>Latest received</span><b>{compactHealthDate(healthSnapshot.dataDate)}</b><small>{healthSnapshot.status === "live" ? "iPhone HealthKit" : "verified fallback"}</small></div>
          <div className={healthMissingDates.length ? "missing" : "complete"}><span>Missing days</span><b>{healthMissingDates.length ? healthMissingDates.map(compactHealthDate).join(" · ") : "None"}</b><small>{healthMissingDates.length ? "No source data received" : "Coverage complete"}</small></div>
        </section>

        <article className="panel health-source-panel health-source-compact"><div className="panel-title"><div><h3>Source reconciliation</h3><p>Latest normalized aggregates received from the iPhone</p></div><NotebookTabs size={18}/></div><div className="health-source-list">{healthSnapshot.sources.map(item=><div key={item.source}><span className={`dot ${item.tone}`}/><div><b>{item.source}</b><small>{item.detail}</small></div><span className={`pill ${item.tone}`}>{item.status}</span></div>)}</div><div className="health-source-warning"><ShieldAlert size={16}/><span>The iPhone app reads the latest completed day and computes 7-day and 30-day comparisons locally. Only normalized aggregates are sent privately to this Mac; raw HealthKit samples are not uploaded.</span></div></article>

        <HealthMasonryGrid categories={healthSnapshot.categories}/>

        <section className="health-action-grid">
          <article className="panel health-actions"><div className="panel-title"><div><h3>Daily optimisation</h3><p>{healthCurrent ? `Generated from ${healthSnapshot.dataDate} HealthKit aggregates` : "Last validated guidance; sync the iPhone before relying on it"}</p></div><Target size={18}/></div><div className="health-action-list">{(healthSnapshot.actions ?? healthActions).map(item=><div key={item.title}><span className={`dot ${item.tone}`}/><div><b>{item.title}</b><p>{item.text}</p></div></div>)}</div></article>
          <article className="panel health-caveat-panel"><div className="panel-title"><div><h3>Interpretation guardrails</h3><p>What this snapshot can and cannot support</p></div><ShieldAlert size={18}/></div><ul>{healthCaveats.map(item=><li key={item}>{item}</li>)}</ul><div className="health-guidance-links"><a href="https://support.apple.com/en-ie/120358" target="_blank" rel="noreferrer">Apple Watch oxygen limitations <ExternalLink size={13}/></a><a href="https://medlineplus.gov/lab-tests/pulse-oximetry/" target="_blank" rel="noreferrer">MedlinePlus pulse oximetry <ExternalLink size={13}/></a></div><p className="medical-note">Wellness summary only. It is not medical advice and should not be used to diagnose or change treatment.</p></article>
        </section>
      </>}
      </CollapsibleSection>
      </div>}

      {workspace === "sectors" && <div className="workspace-section">
      <CollapsibleSection number="S-4" title="Earnings & decision framework" note="Full-width result tracker plus multi-framework sector decisions">
      <section className="earnings-decision-stack">
        {earningsError && <div className="refresh-error"><ShieldAlert size={15}/><span>{earningsError}</span></div>}
        <EarningsCalendarWorkbench snapshot={earningsSnapshot} content={content}/>
        <SectorDecisionFramework/>
      </section>
      </CollapsibleSection>
      </div>}

      </section>

      <footer><p>Educational portfolio research and private wellness tracking. Not investment or medical advice; no orders were placed.</p><p>{isLive ? `Live Kite values: ${asOf}` : isSnapshot ? `Kite snapshot: ${asOf}` : "Kite values unavailable"} · All refresh-capable sources refresh on open, focus and every five minutes · {healthIncognito ? "Health statistics hidden by Incognito." : `HealthKit data through ${healthSnapshot.dataDate}${healthCurrent ? " (latest completed day)" : " (stale)"}.`}</p></footer>
    </main>
  );
}
