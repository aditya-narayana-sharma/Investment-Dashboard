export type SectorScoreSet = {
  demand: number;
  earnings: number;
  policy: number;
  cost: number;
  valuation: number;
};

export type SectorView = {
  id: string;
  name: string;
  color: string;
  pulse: "Leadership" | "Constructive" | "Selective";
  stance: string;
  summary: string;
  scores: SectorScoreSet;
  pestel: [number, number, number, number, number, number];
  porter: [number, number, number, number, number];
  cage: [number, number, number, number];
  kpis: Array<{ label: string; value: string; context: string }>;
  mece: [string, string, string, string];
  watch: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const sectorScoreLabels: Array<{ key: keyof SectorScoreSet; label: string }> = [
  { key: "demand", label: "Demand" },
  { key: "earnings", label: "Earnings" },
  { key: "policy", label: "Policy" },
  { key: "cost", label: "Cost position" },
  { key: "valuation", label: "Valuation room" },
];

export const pestelAxes = ["Political", "Economic", "Social", "Technology", "Environmental", "Legal"];
export const porterAxes = ["Competitive intensity", "Customer leverage", "Supplier / input leverage", "Substitution risk", "New-entry risk"];
export const cageAxes = ["Cultural", "Administrative", "Geographic", "Economic"];

export const sectors: SectorView[] = [
  {
    id: "pharma",
    name: "Pharma",
    color: "#52d6a3",
    pulse: "Constructive",
    stance: "Fundamentals intact; US generic tariff roadmap adds near-term policy volatility",
    summary:
      "Defensive demand and complex-product pipelines still support the medium-term setup, but the Jul 2026 US generic-tariff roadmap (zero for two years, then 100%/200%) triggered a broad Nifty Pharma sell-off. Management commentary (e.g. Dr Reddy's) argues large-scale US reshoring is impractical and higher US prices are the likelier outcome if duties land.",
    scores: { demand: 4.6, earnings: 4.2, policy: 3.4, cost: 3.7, valuation: 3.5 },
    pestel: [3.6, 4.2, 4.8, 4.7, 3.8, 3.0],
    porter: [3.6, 3.8, 2.9, 2.4, 3.0],
    cage: [2.4, 4.3, 3.5, 4.2],
    kpis: [
      { label: "Nifty Pharma", value: "25,748", context: "NDTV Profit early trade 22 Jul 2026; all 19 constituents red on tariff news" },
      { label: "US tariff path", value: "0→100→200%", context: "Zero for ~2 years from Aug 2026, then 100% (2028) and 200% thereafter" },
      { label: "India US generics", value: "40-50%", context: "Share of US generic prescriptions supplied by Indian makers (MC/NDTV)" },
    ],
    mece: ["Domestic chronic therapies + exports", "Complex generics and CDMO mix", "USFDA, US tariff roadmap and pricing", "Premium multiples require execution"],
    watch: "US tariff rule text and negotiation outcomes, USFDA clearance cadence, US price erosion, specialty launches and INR translation.",
    sourceLabel: "Moneycontrol · Pharma funds after tariff sell-off (23 Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/business/personal-finance/pharma-funds-slip-after-sector-sell-off-should-investors-stay-invested-or-wait-13981469.html",
  },
  {
    id: "power",
    name: "Power",
    color: "#ffd166",
    pulse: "Leadership",
    stance: "Peak-demand and RE build-out remain supportive; storage and grid decide quality",
    summary:
      "India recorded all-time peak demand near 270.8 GW in May 2026, with July peaks easing toward ~222-230 GW as temperatures cooled. Clean energy met over half of daytime demand on 6 Jul 2026, while grid-scale BESS, pumped hydro and transmission remain the binding constraints for round-the-clock renewables.",
    scores: { demand: 4.7, earnings: 4.2, policy: 4.8, cost: 3.5, valuation: 3.2 },
    pestel: [4.8, 4.4, 4.3, 4.7, 4.9, 3.8],
    porter: [3.0, 2.8, 3.6, 2.4, 3.1],
    cage: [1.7, 3.8, 2.6, 3.4],
    kpis: [
      { label: "Peak demand (May)", value: "270.8 GW", context: "All-time high on 21 May 2026; Moneycontrol / Grid India" },
      { label: "Clean share at peak hour", value: "50.02%", context: "221.5 GW demand at 11:46 on 6 Jul 2026; RE+hydro+nuclear" },
      { label: "Installed mix", value: "542.3 GW", context: "As of 31 May 2026; RE 282.7 GW vs thermal 250.8 GW" },
    ],
    mece: ["Electrification and industrial load", "Regulated returns + merchant mix", "Renewables, storage and grid policy", "Debt, COD timing and equipment cost"],
    watch: "Evening peak coverage, BESS/FDRE commissioning, curtailment, receivables, net debt/EBITDA and coal stock adequacy.",
    sourceLabel: "Moneycontrol · Clean energy >50% of peak-hour demand (Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/power/clean-energy-meets-over-50-of-india-s-power-demand-during-peak-hours-for-second-straight-year-13969076.html",
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    color: "#ff9f6e",
    pulse: "Leadership",
    stance: "Capex and BOT pipeline are large; delays and working capital still bind",
    summary:
      "FY27 public capex of ₹12.2 lakh crore and a roads BOT push (about 5,000 km / ₹75,000 crore targeted) keep order visibility high. Execution risk is explicit: Parliament was told 629 of 1,191 under-construction national highway projects have missed original completion schedules.",
    scores: { demand: 4.5, earnings: 4.2, policy: 4.7, cost: 3.2, valuation: 3.3 },
    pestel: [4.9, 4.5, 4.1, 4.0, 4.1, 3.2],
    porter: [3.7, 3.9, 3.5, 1.8, 2.7],
    cage: [1.5, 3.8, 2.2, 3.5],
    kpis: [
      { label: "FY27 public capex", value: "₹12.2L Cr", context: "Budget proposal; up from ₹11.2L Cr (Moneycontrol Budget 2026)" },
      { label: "BOT highway FY27", value: "5,000 km", context: "~₹75,000 Cr targeted; ~50% of highway awards under BOT" },
      { label: "NH delays", value: "629 / 1,191", context: "Projects past original schedule; Gadkari reply 22 Jul 2026" },
    ],
    mece: ["Roads, rail, urban and logistics capex", "Order conversion and operating leverage", "Budget allocation and BOT/EPC awards", "Working capital, land and commodity risk"],
    watch: "BOT MCA finalisation, awarding pace, receivable days, project clearances, fixed-price exposure and blacklisting/penalties.",
    sourceLabel: "Moneycontrol · 629 NH projects behind schedule (22 Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/business/govt-says-629-national-highway-projects-behind-original-completion-schedule-13980720.html",
  },
  {
    id: "auto",
    name: "Auto",
    color: "#64b5ff",
    pulse: "Constructive",
    stance: "Record Q1FY27 volumes; commodity and West Asia costs remain the margin risk",
    summary:
      "SIAM reported record Q1FY27 industry sales: overall auto +21.4% to 73.82 lakh units and passenger vehicles +25.9% to 12.74 lakh units, with UVs ~68% of PVs. GST 2.0, softer financing and monsoon pickup support Q2 demand, while West Asia tensions and commodity inflation threaten margins.",
    scores: { demand: 4.7, earnings: 4.0, policy: 4.3, cost: 3.2, valuation: 3.1 },
    pestel: [4.2, 4.6, 4.3, 4.6, 4.4, 3.5],
    porter: [4.3, 4.0, 3.5, 3.5, 3.7],
    cage: [2.5, 3.2, 3.3, 3.7],
    kpis: [
      { label: "Q1FY27 PV sales", value: "12.74L", context: "+25.9% YoY; SIAM record quarter (NDTV Profit / Moneycontrol)" },
      { label: "Q1FY27 total auto", value: "73.82L", context: "+21.4% YoY industry wholesales" },
      { label: "UV share of PV", value: "~68%", context: "Utility vehicles +28.6% YoY in Q1FY27" },
    ],
    mece: ["Affordability, replacement and rural demand", "Mix, discounts and commodity pass-through", "GST, finance and EV incentives", "EV capex and competitive intensity"],
    watch: "Retail versus wholesale, inventory days, discounts, EV losses, commodity basket, freight costs and export demand.",
    sourceLabel: "Moneycontrol · SIAM Q1FY27 / Q2 outlook (Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/automobile/auto-industry-enters-q2-on-strong-footing-after-record-q1-but-west-asia-tensions-commodity-costs-remain-concerns-siam-article-13974465.html",
  },
  {
    id: "telecom",
    name: "Telecom",
    color: "#b794f6",
    pulse: "Constructive",
    stance: "ARPU premiumisation continues; tariff and IPO narratives drive valuation debate",
    summary:
      "Airtel India mobile ARPU reached about ₹257-259 through FY26 quarters while Jio's March-2026 ARPU was ₹214, leaving a ~20% gap that still frames relative quality. Street narratives around mid-2026 tariff repair and the Jio Platforms IPO keep sector multiples sensitive to ARPU delivery versus spectrum and competitive intensity.",
    scores: { demand: 4.0, earnings: 4.4, policy: 3.9, cost: 3.6, valuation: 3.2 },
    pestel: [4.0, 4.1, 4.7, 4.8, 3.5, 3.6],
    porter: [3.4, 3.1, 2.8, 2.2, 1.8],
    cage: [1.9, 3.5, 2.3, 2.9],
    kpis: [
      { label: "Airtel India ARPU", value: "₹257-259", context: "Q4FY26 ~₹257.2 (MC); Q3FY26 ₹259 (NDTV Profit)" },
      { label: "Jio ARPU", value: "₹214", context: "March 2026 quarter; ~20% below Airtel India mobile" },
      { label: "Jio Platforms EPS", value: "₹33.59", context: "FY26 diluted EPS cited in Moneycontrol DRHP valuation note" },
    ],
    mece: ["Data usage and premiumisation", "Tariff flow-through and capex moderation", "Spectrum, AGR and consumer regulation", "ARPU expectations already partly priced"],
    watch: "ARPU, postpaid mix, churn, 5G monetisation, spectrum payments, home/enterprise conversion and IPO valuation marks.",
    sourceLabel: "Moneycontrol · Jio Platforms valuation vs Airtel ARPU (Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/business/markets/jio-platforms-may-be-worth-rs-12-7-lakh-crore-at-airtel-like-valuation-13954140.html",
  },
  {
    id: "banking",
    name: "Banking",
    color: "#4f8cff",
    pulse: "Constructive",
    stance: "Loan growth healthy; deposit lag and NIM compression set rankings",
    summary:
      "Q1FY27 previews and early prints show intact credit demand with NIMs flat to modestly lower as deposits trail advances and funding costs stay sticky. FCNR(B) mobilisation is the near-term liquidity offset; liability franchises and fee/credit-cost control still separate leaders from the pack.",
    scores: { demand: 4.2, earnings: 4.1, policy: 3.6, cost: 3.7, valuation: 3.3 },
    pestel: [4.1, 4.2, 4.3, 4.0, 2.9, 4.0],
    porter: [4.0, 3.8, 4.3, 3.0, 2.7],
    cage: [1.5, 3.0, 1.6, 3.2],
    kpis: [
      { label: "Q1 NIM setup", value: "Flat to -15 bp", context: "Street consensus for sequential NIM pressure (Moneycontrol / NDTV)" },
      { label: "ICICI Q1 PAT", value: "+16% YoY", context: "NDTV Profit Q1 review; NII +13%; margins resilient vs peers" },
      { label: "Policy repo", value: "5.25%", context: "RBI policy rate backdrop into Q1FY27 prints" },
    ],
    mece: ["Retail, SME and corporate credit", "NIM, fees and benign credit costs", "RBI liquidity and prudential rules", "Deposit franchise versus multiple"],
    watch: "Deposit growth, LDR, NIM troughing, FCNR inflows, unsecured/MFI slippages, credit cost and treasury income.",
    sourceLabel: "Moneycontrol · Banks Q1 NIM preview (10 Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/business/banks/banks-to-see-flat-to-marginal-contraction-in-nims-for-q1-as-deposits-continue-to-lag-13970776.html",
  },
  {
    id: "nbfc",
    name: "NBFC",
    color: "#35c2d6",
    pulse: "Constructive",
    stance: "Diversified lenders preferred; MFI funding still needs proof",
    summary:
      "Jefferies (via NDTV Profit) flags healthier Apr-May collections across personal, business and microfinance books after tighter underwriting, while still preferring diversified NBFCs over monsoon-sensitive specialists. Policy support includes the limited-period ₹20,000 crore CGSMFI-2.0 guarantee to reopen bank funding to MFIs.",
    scores: { demand: 4.2, earnings: 3.9, policy: 3.7, cost: 3.5, valuation: 3.1 },
    pestel: [3.9, 4.2, 4.0, 4.1, 2.9, 4.1],
    porter: [4.2, 4.0, 4.5, 3.4, 3.3],
    cage: [1.3, 2.9, 1.5, 3.4],
    kpis: [
      { label: "CGSMFI-2.0", value: "₹20,000 Cr", context: "Govt credit-guarantee window for bank funding to MFIs (NDTV Profit)" },
      { label: "NBFC profit CAGR view", value: "~23%", context: "Jefferies FY26-28 coverage profit CAGR; loan growth ~18%" },
      { label: "Policy repo", value: "5.25%", context: "Funding tailwind remains uneven across liability mixes" },
    ],
    mece: ["Consumer, vehicle, SME and housing demand", "Spreads, opex and credit costs", "RBI scale-based supervision + MFI guarantees", "Funding access and underwriting premium"],
    watch: "Cost of funds, spreads, collection efficiency, Stage 2/3 assets, monsoon/rural stress and ALM gaps.",
    sourceLabel: "NDTV Profit · Diversified NBFCs preferred (Jefferies)",
    sourceUrl: "https://www.ndtvprofit.com/markets/diversified-nbfcs-better-placed-than-peers-says-jefferies-as-monsoon-risks-remain-top-picks-bajaj-finance-aditya-birla-capital-shriram-finance-11673948",
  },
  {
    id: "fmcg",
    name: "FMCG",
    color: "#f58fd2",
    pulse: "Selective",
    stance: "Rural recovery visible in prints; valuations still leave little room for error",
    summary:
      "Company updates and Q1FY27 leaders (e.g. Nestlé India via NDTV Profit) show volume-led growth with rural reach expanding, while Moneycontrol commentary flags El Niño/weather volatility as the residual demand risk. Premium staples multiples still require consistent volume and gross-margin delivery.",
    scores: { demand: 4.1, earnings: 3.9, policy: 3.5, cost: 3.5, valuation: 2.9 },
    pestel: [3.8, 4.2, 4.7, 3.8, 3.8, 3.6],
    porter: [4.2, 4.3, 3.9, 3.8, 3.5],
    cage: [2.2, 2.8, 2.0, 2.9],
    kpis: [
      { label: "Nestlé India Q1 rev", value: "+25.2%", context: "Q1FY27 revenue ₹6,378 Cr; PAT +48% (NDTV Profit)" },
      { label: "Domestic volume proxy", value: "~16%", context: "HDFC Sec estimate of Nestlé India domestic volume growth" },
      { label: "Rural vs urban", value: "Rural > urban", context: "Dabur/Marico commentary via Moneycontrol on rural outperformance" },
    ],
    mece: ["Rural recovery and premiumisation", "Volume-price mix and gross margin", "Tax, food inflation and weather risk", "Defensive premium limits rerating"],
    watch: "Underlying volume growth, rural/urban split, input basket, ad spend, pricing and monsoon/El Niño effects.",
    sourceLabel: "Moneycontrol · FMCG optimism despite inflation / El Niño",
    sourceUrl: "https://www.moneycontrol.com/news/business/companies/why-fmcg-firms-remain-optimistic-despite-inflation-and-el-nino-concerns-13966405.html",
  },
  {
    id: "consumer",
    name: "Consumer",
    color: "#ff7b87",
    pulse: "Selective",
    stance: "Q-commerce scale is real; discounting intensity and unit economics decide winners",
    summary:
      "Blinkit (Eternal) delivered ~36 lakh daily orders in Q1FY27 with 2,443 dark stores, while management told NDTV Profit that current discounting is the highest yet and not sustainable beyond the near term. Growth remains high across platforms and retail digital arms, but AOV pressure and subsidy wars keep valuations selective.",
    scores: { demand: 4.3, earnings: 3.5, policy: 3.7, cost: 3.0, valuation: 2.7 },
    pestel: [3.7, 4.3, 4.6, 4.6, 3.5, 3.4],
    porter: [4.8, 4.4, 3.6, 4.2, 4.1],
    cage: [2.0, 2.6, 1.8, 3.1],
    kpis: [
      { label: "Blinkit daily orders", value: "36L", context: "Q1FY27; 331m orders; Moneycontrol 22 Jul 2026" },
      { label: "Blinkit dark stores", value: "2,443", context: "Across 300+ cities; vs Zepto ~1,139 / Instamart ~1,143" },
      { label: "Blinkit net AOV", value: "₹518", context: "Down from ₹521 YoY / ₹525 QoQ on competition" },
    ],
    mece: ["Income, finance and category penetration", "Unit economics and operating leverage", "Discounting intensity and platform regulation", "Premium valuations and crowded themes"],
    watch: "Like-for-like growth, AOV, contribution margins, dark-store ROI, subsidy intensity and discretionary inflation.",
    sourceLabel: "Moneycontrol · Blinkit Q1FY27 operating metrics (22 Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/business/earnings/blinkit-q1fy27-36-lakh-daily-orders-aov-slips-to-rs-518-dark-store-count-at-over-2-400-13980696.html",
  },
  {
    id: "energy",
    name: "Energy",
    color: "#f3a83b",
    pulse: "Selective",
    stance: "OMC marketing losses dominate; upstream/refining dispersion is wide",
    summary:
      "West Asia volatility pushed Brent back above ~$90 after a brief dip near $71, leaving PSU OMCs with ~₹74,781 Cr fuel-sale losses in Apr-Jun and LPG under-recovery above ₹51,000 Cr by 30 Jun 2026. Relief-package talks and Russian crude share help cash flow narratives, but marketing-margin suppression still separates OMC prints.",
    scores: { demand: 3.7, earnings: 3.0, policy: 2.9, cost: 2.3, valuation: 3.3 },
    pestel: [3.0, 2.6, 3.6, 3.8, 2.4, 3.2],
    porter: [3.5, 3.7, 4.7, 3.4, 2.4],
    cage: [2.1, 4.4, 4.9, 4.7],
    kpis: [
      { label: "OMC Q1 fuel losses", value: "₹74,781 Cr", context: "Apr-Jun losses cited by Petroleum Minister; Moneycontrol Jul 2026" },
      { label: "LPG under-recovery", value: ">₹51,000 Cr", context: "PSU OMC accumulated under-recovery at 30 Jun 2026" },
      { label: "Brent regime", value: ">$90/bbl", context: "Rebound after brief ~$71 ceasefire print; West Asia risk premium" },
    ],
    mece: ["Fuel, petchem and industrial gas demand", "GRM, realisation and marketing margin", "Taxes, subsidies and price intervention", "Crude, FX and geopolitical volatility"],
    watch: "Brent curve, INR, product cracks, marketing margins, LPG compensation, Russian crude share and policy relief.",
    sourceLabel: "Moneycontrol · LPG under-recovery / OMC losses (23 Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/business/commodities/amid-west-asia-tensions-lpg-under-recovery-tops-rs-51-000-crore-govt-tells-lok-sabha-13981791.html",
  },
  {
    id: "defence",
    name: "Defence",
    color: "#e76f51",
    pulse: "Leadership",
    stance: "Order pipeline and budget runway intact; delivery and valuation still bind",
    summary:
      "FY27 MoD budget of ₹7.85 lakh crore and capital outlay of ₹2.19 lakh crore continue to back multi-year OEMs. Fresh contract flow includes MoD deals totaling ₹5,083 Cr (HAL ALH Mk-III ₹2,901 Cr plus Shtil missiles) and HAL's Jul 2026 long-term Safran LEAP forging pact, while rich multiples still require on-time execution.",
    scores: { demand: 4.7, earnings: 4.3, policy: 4.9, cost: 3.6, valuation: 2.9 },
    pestel: [4.9, 4.2, 3.8, 4.7, 3.2, 4.1],
    porter: [3.2, 2.4, 3.5, 2.1, 2.6],
    cage: [2.0, 4.6, 3.1, 3.8],
    kpis: [
      { label: "MoD budget", value: "₹7.85L Cr", context: "Union Budget 2026-27; Moneycontrol defence anniversary note" },
      { label: "Fresh MoD deals", value: "₹5,083 Cr", context: "HAL ALH ₹2,901 Cr + Shtil missiles ₹2,182 Cr (NDTV Profit)" },
      { label: "Capital outlay", value: "₹2.19L Cr", context: "+21.8% vs FY26 RE; domestic acquisition tilt continues" },
    ],
    mece: ["Platform, electronics and shipyard demand", "Order conversion and execution margins", "Indigenisation and capital acquisition policy", "Delivery risk and premium valuations"],
    watch: "Order inflows, Tejas/engine timelines, export clearances, receivable days, indigenisation content and valuation versus order-book duration.",
    sourceLabel: "Moneycontrol · HAL–Safran LEAP forging pact (22 Jul 2026)",
    sourceUrl: "https://www.moneycontrol.com/news/business/hal-safran-aircraft-engines-sign-long-term-pact-for-leap-engine-components-13981010.html",
  },
];

export function sectorComposite(sector: SectorView) {
  const values = Object.values(sector.scores);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const sectorSourceNote =
  "Sector research narratives and KPIs refreshed 24 Jul 2026 from Moneycontrol and NDTV Profit primary articles (with official SIAM/RBI/Budget figures where those outlets cite them). Live prices and return horizons continue to refresh separately via yfinance sector snapshots. Scores are a transparent 1-5 monitoring model, not forecasts or recommendations.";
