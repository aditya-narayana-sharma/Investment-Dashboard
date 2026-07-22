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
    pulse: "Leadership",
    stance: "Strong operating momentum; retain valuation discipline",
    summary: "Export growth, defensive demand and complex-product pipelines support earnings breadth. The sector remains exposed to USFDA observations, US generic pricing and rich multiples.",
    scores: { demand: 4.7, earnings: 4.5, policy: 4.2, cost: 3.7, valuation: 3.3 },
    pestel: [4.1, 4.3, 4.8, 4.7, 3.8, 3.2],
    porter: [3.6, 3.8, 2.9, 2.4, 3.0],
    cage: [2.4, 4.1, 3.5, 4.2],
    kpis: [
      { label: "Nifty Pharma", value: "25,205", context: "+0.4% latest NSE Indices snapshot" },
      { label: "Drug exports", value: "$20.48bn", context: "Apr-Nov FY26; +6.5% YoY" },
      { label: "Export share", value: "7.0%", context: "Share of India merchandise exports" },
    ],
    mece: ["Domestic chronic therapies + exports", "Complex generics and CDMO mix", "USFDA, pricing and product approvals", "Premium multiples require execution"],
    watch: "USFDA clearance cadence, US price erosion, specialty launches, R&D productivity and INR translation.",
    sourceLabel: "NSE Indices + Department of Commerce",
    sourceUrl: "https://trade-analytics.commerce.gov.in/public/media-insights",
  },
  {
    id: "power",
    name: "Power",
    color: "#ffd166",
    pulse: "Leadership",
    stance: "Structural demand and capacity cycle remain supportive",
    summary: "Peak demand, transmission investment, renewables and storage create a long project runway. Leverage, execution slippage and merchant-price volatility separate operators.",
    scores: { demand: 4.6, earnings: 4.2, policy: 4.8, cost: 3.5, valuation: 3.2 },
    pestel: [4.8, 4.3, 4.3, 4.6, 4.9, 3.8],
    porter: [3.0, 2.8, 3.6, 2.4, 3.1],
    cage: [1.7, 3.8, 2.6, 3.4],
    kpis: [
      { label: "Non-fossil capacity", value: "52.57%", context: "Installed capacity at 28 Feb 2026" },
      { label: "Peak demand", value: "245,444 MW", context: "FY26 through Feb; peak met 245,416 MW" },
      { label: "Peak deficit", value: "28 MW", context: "About 0.01% of recorded peak demand" },
    ],
    mece: ["Electrification and industrial load", "Regulated returns + merchant mix", "Renewables, storage and grid policy", "Debt, COD timing and equipment cost"],
    watch: "Peak demand, receivables, plant load factors, storage economics, commissioning and net debt/EBITDA.",
    sourceLabel: "Ministry of Power FY26 Annual Report",
    sourceUrl: "https://powermin.gov.in/sites/default/files/uploads/MOP_Annual_Report_Eng_2025_26.pdf",
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    color: "#ff9f6e",
    pulse: "Leadership",
    stance: "Capex visibility is high; execution quality is the differentiator",
    summary: "Public capex, rail, logistics and urban infrastructure support multi-year order books. Working capital, land clearance and fixed-price contract exposure remain the main earnings traps.",
    scores: { demand: 4.5, earnings: 4.3, policy: 4.8, cost: 3.2, valuation: 3.3 },
    pestel: [4.9, 4.5, 4.1, 4.0, 4.1, 3.2],
    porter: [3.7, 3.9, 3.5, 1.8, 2.7],
    cage: [1.5, 3.8, 2.2, 3.5],
    kpis: [
      { label: "FY27 public capex", value: "₹12.2L Cr", context: "Budget proposal; up from ₹11.2L Cr" },
      { label: "May capital spend", value: "₹2.51L Cr", context: "16.5% of FY27 budget by May" },
      { label: "Capex step-up", value: "1.09x", context: "FY27 proposal versus FY26 allocation" },
    ],
    mece: ["Roads, rail, urban and logistics capex", "Order conversion and operating leverage", "Budget allocation and project awards", "Working capital, land and commodity risk"],
    watch: "Awarding pace, budget execution, receivable days, project clearances, order quality and fixed-price exposure.",
    sourceLabel: "Union Budget 2026-27 / PIB",
    sourceUrl: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2221425&lang=1&reg=6",
  },
  {
    id: "auto",
    name: "Auto",
    color: "#64b5ff",
    pulse: "Constructive",
    stance: "Record volumes, easier finance and premiumisation support growth",
    summary: "Passenger vehicles and two-wheelers entered FY27 with strong volumes. The debate shifts to sustainability after the low base, EV economics and margin pressure from commodities and discounting.",
    scores: { demand: 4.6, earnings: 4.1, policy: 4.2, cost: 3.4, valuation: 3.1 },
    pestel: [4.2, 4.5, 4.3, 4.6, 4.4, 3.5],
    porter: [4.3, 4.0, 3.4, 3.5, 3.7],
    cage: [2.5, 3.2, 3.3, 3.7],
    kpis: [
      { label: "FY26 PV sales", value: "46.43L", context: "+7.9% YoY; record fiscal year" },
      { label: "May 2026 PV", value: "4.39L", context: "+27.3% YoY" },
      { label: "EV registrations", value: "+80%", context: "Passenger EV registrations in FY26" },
    ],
    mece: ["Affordability, replacement and rural demand", "Mix, discounts and commodity pass-through", "GST, finance and EV incentives", "EV capex and competitive intensity"],
    watch: "Retail versus wholesale, inventory days, discounts, EV losses, commodity basket and export demand.",
    sourceLabel: "SIAM FY26 and May 2026 releases",
    sourceUrl: "https://www.siam.in/pressrelease-details.aspx?mpgid=53&pgidtrail=50&pid=609",
  },
  {
    id: "telecom",
    name: "Telecom",
    color: "#b794f6",
    pulse: "Constructive",
    stance: "Tariff repair and data monetisation support cash generation",
    summary: "ARPU expansion, 5G monetisation and falling rollout intensity improve the earnings setup. Spectrum liabilities, competitive pricing and enterprise monetisation remain key differentiators.",
    scores: { demand: 4.0, earnings: 4.4, policy: 3.9, cost: 3.6, valuation: 3.1 },
    pestel: [4.0, 4.1, 4.7, 4.8, 3.5, 3.6],
    porter: [3.4, 3.1, 2.8, 2.2, 1.8],
    cage: [1.9, 3.5, 2.3, 2.9],
    kpis: [
      { label: "Wireless subscribers", value: "1,294.46m", context: "+0.43% MoM at 31 May 2026" },
      { label: "Wireless teledensity", value: "90.61%", context: "Up from 90.28% in April 2026" },
      { label: "Rural subscriber share", value: "42.50%", context: "550.11m rural wireless subscribers" },
    ],
    mece: ["Data usage and premiumisation", "Tariff flow-through and capex moderation", "Spectrum, AGR and consumer regulation", "ARPU expectations already partly priced"],
    watch: "ARPU, subscriber mix, churn, 5G capex, spectrum payments and home/enterprise conversion.",
    sourceLabel: "TRAI subscription reports",
    sourceUrl: "https://www.trai.gov.in/release-publication/reports/telecom-subscriptions-reports",
  },
  {
    id: "banking",
    name: "Banking",
    color: "#4f8cff",
    pulse: "Constructive",
    stance: "Asset quality is resilient; deposits and margins set the ranking",
    summary: "Credit demand and clean balance sheets support profitability, while lower policy rates and deposit competition pressure NIM. Liability franchises should command the quality premium.",
    scores: { demand: 4.1, earnings: 4.2, policy: 3.6, cost: 3.8, valuation: 3.3 },
    pestel: [4.1, 4.2, 4.3, 4.0, 2.9, 4.0],
    porter: [4.0, 3.8, 4.3, 3.0, 2.7],
    cage: [1.5, 3.0, 1.6, 3.2],
    kpis: [
      { label: "Policy repo", value: "5.25%", context: "RBI snapshot at 30 Jun 2026" },
      { label: "Cash reserve ratio", value: "3.00%", context: "RBI requirement at 30 Jun 2026" },
      { label: "Statutory liquidity", value: "18.00%", context: "RBI requirement at 30 Jun 2026" },
    ],
    mece: ["Retail, SME and corporate credit", "NIM, fees and benign credit costs", "RBI liquidity and prudential rules", "Deposit franchise versus multiple"],
    watch: "Deposit growth, LDR, NIM, unsecured slippages, credit cost and treasury gains from lower yields.",
    sourceLabel: "RBI June 2026 market snapshot",
    sourceUrl: "https://m.rbi.org.in/Scripts/BS_ViewBulletin.aspx?Id=22100",
  },
  {
    id: "nbfc",
    name: "NBFC",
    color: "#35c2d6",
    pulse: "Constructive",
    stance: "Rate relief helps, but funding and underwriting create dispersion",
    summary: "Lower benchmark rates can aid funding costs and demand. The strongest setup is in diversified lenders with stable liabilities; unsecured and microfinance books require proof on collections.",
    scores: { demand: 4.2, earnings: 3.9, policy: 3.5, cost: 3.5, valuation: 3.0 },
    pestel: [3.8, 4.2, 4.0, 4.1, 2.8, 4.1],
    porter: [4.2, 4.0, 4.5, 3.4, 3.3],
    cage: [1.3, 2.9, 1.5, 3.4],
    kpis: [
      { label: "Policy repo", value: "5.25%", context: "Funding tailwind is not uniform" },
      { label: "1Y+ deposit range", value: "6.00-6.60%", context: "Bank funding benchmark at 30 Jun 2026" },
      { label: "Repo corridor", value: "50 bps", context: "5.00% SDF to 5.50% MSF" },
    ],
    mece: ["Consumer, vehicle, SME and housing demand", "Spreads, opex and credit costs", "RBI scale-based supervision", "Funding access and underwriting premium"],
    watch: "Cost of funds, spreads, collection efficiency, Stage 2/3 assets, capital adequacy and ALM gaps.",
    sourceLabel: "RBI June 2026 Financial Stability update",
    sourceUrl: "https://m.rbi.org.in/Scripts/BS_ViewBulletin.aspx?Id=22100",
  },
  {
    id: "fmcg",
    name: "FMCG",
    color: "#f58fd2",
    pulse: "Selective",
    stance: "Volume recovery is improving; valuation and input costs matter",
    summary: "Rural demand and tax-led disposable income support volumes, but premium valuations leave little tolerance for weak pricing or gross-margin pressure.",
    scores: { demand: 3.9, earnings: 3.7, policy: 3.5, cost: 3.6, valuation: 2.9 },
    pestel: [3.8, 4.1, 4.7, 3.8, 4.0, 3.6],
    porter: [4.2, 4.3, 3.9, 3.8, 3.5],
    cage: [2.2, 2.8, 2.0, 2.9],
    kpis: [
      { label: "FY26 PFCE", value: "+7.7%", context: "Private consumption growth" },
      { label: "Consumption share", value: "55.7%", context: "Private consumption share of GDP" },
      { label: "Growth acceleration", value: "+1.9 pp", context: "FY26 PFCE growth versus prior 5.8%" },
    ],
    mece: ["Rural recovery and premiumisation", "Volume-price mix and gross margin", "Tax, food inflation and rural schemes", "Defensive premium limits rerating"],
    watch: "Underlying volume growth, rural/urban split, input basket, ad spend, pricing and premiumisation.",
    sourceLabel: "MoSPI FY26 GDP estimates",
    sourceUrl: "https://mospi.gov.in/uploads/latestReleases/latest_release_1772189865181_f040336d-bc57-4aed-b80f-586d9ccb279e_Press_Note_on_New_Series_of_GDP_Estimates_with_Base_Year_2022-23_27022026.pdf",
  },
  {
    id: "consumer",
    name: "Consumer",
    color: "#ff7b87",
    pulse: "Selective",
    stance: "Demand improves, but category and valuation dispersion is wide",
    summary: "Consumption growth supports discretionary categories, travel and retail. Internet and premium-consumption names still require close attention to unit economics and high expectations.",
    scores: { demand: 4.0, earnings: 3.6, policy: 3.7, cost: 3.2, valuation: 2.8 },
    pestel: [3.7, 4.3, 4.6, 4.5, 3.5, 3.4],
    porter: [4.6, 4.4, 3.6, 4.2, 4.0],
    cage: [2.0, 2.6, 1.8, 3.1],
    kpis: [
      { label: "FY26 PFCE", value: "+7.7%", context: "Consumption accelerated from 5.8%" },
      { label: "GDP share", value: "55.7%", context: "Private consumption share" },
      { label: "Growth acceleration", value: "+1.9 pp", context: "FY26 PFCE growth versus prior year" },
    ],
    mece: ["Income, finance and category penetration", "Unit economics and operating leverage", "Tax, data and platform regulation", "Premium valuations and crowded themes"],
    watch: "Like-for-like growth, cohorts, customer acquisition cost, take rates, inventory turns and discretionary inflation.",
    sourceLabel: "MoSPI FY26 GDP estimates",
    sourceUrl: "https://mospi.gov.in/uploads/latestReleases/latest_release_1772189865181_f040336d-bc57-4aed-b80f-586d9ccb279e_Press_Note_on_New_Series_of_GDP_Estimates_with_Base_Year_2022-23_27022026.pdf",
  },
  {
    id: "energy",
    name: "Energy",
    color: "#f3a83b",
    pulse: "Selective",
    stance: "Cash flows can be strong, but oil and policy volatility dominate",
    summary: "Refining, upstream and gas economics diverge sharply. High crude can support upstream earnings but pressure OMC marketing margins, inflation and downstream demand.",
    scores: { demand: 3.8, earnings: 3.5, policy: 3.2, cost: 2.6, valuation: 3.2 },
    pestel: [3.2, 2.8, 3.6, 3.8, 2.5, 3.4],
    porter: [3.5, 3.7, 4.6, 3.4, 2.4],
    cage: [2.1, 4.4, 4.8, 4.7],
    kpis: [
      { label: "Crude regime", value: "$79/bbl", context: "Approximate current Brent range" },
      { label: "Refining capacity", value: "258.12 MMTPA", context: "PPAC installed capacity, updated 8 Jul 2026" },
      { label: "Jamnagar share", value: "26.4%", context: "68.2 MMTPA of all-India capacity" },
    ],
    mece: ["Fuel, petchem and industrial gas demand", "GRM, realisation and marketing margin", "Taxes, subsidies and price intervention", "Crude, FX and geopolitical volatility"],
    watch: "Brent curve, INR, product cracks, marketing margins, domestic gas pricing and policy intervention.",
    sourceLabel: "PPAC oil and gas data",
    sourceUrl: "https://ppac.gov.in/",
  },
];

export function sectorComposite(sector: SectorView) {
  const values = Object.values(sector.scores);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const sectorSourceNote = "All ten tracked sector sections reviewed on 16 Jul 2026. Each KPI retains its stated official reporting period; live prices and return horizons refresh separately. Scores are a transparent 1-5 monitoring model, not forecasts or recommendations.";
