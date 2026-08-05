export const asOf = "13 Jul 2026, 15:41 IST";

export const classificationSources = {
  industry: "NSE basic industry",
  marketCap: "AMFI January-June 2026 categorisation",
  asOf: "30 Jun 2026",
  marketCapUrl: "https://www.amfiindia.com/otherdata/categorisation-of-stocks",
  industryUrl: "https://www.nseindia.com/market-data/live-equity-market",
};

export const securityClassifications = {
  ICICIBANK: { name: "ICICI Bank", sector: "Private Sector Bank", subSector: "Commercial Banking", marketCap: "Large cap", donutOrder: 10, risk: "Medium", stance: "Core hold", oil: 3, flow: 5, quarter: "Constructive", color: "#2563a6" },
  ETERNAL: { name: "Eternal", sector: "E-Commerce", subSector: "Food Delivery & Quick Commerce", marketCap: "Large cap", donutOrder: 20, risk: "High", stance: "Hold / cap additions", oil: 4, flow: 5, quarter: "Positive, volatile", color: "#13a08f" },
  BHARTIARTL: { name: "Bharti Airtel", sector: "Telecom", subSector: "Wireless & Digital Services", marketCap: "Large cap", donutOrder: 30, risk: "Low-medium", stance: "Defensive hold", oil: 2, flow: 4, quarter: "Constructive", color: "#7659c8" },
  ADANIGREEN: { name: "Adani Green Energy", sector: "Power Generation", subSector: "Renewable Power", marketCap: "Large cap", donutOrder: 40, risk: "High", stance: "Hold / monitor leverage", oil: 2, flow: 5, quarter: "Execution-led", color: "#2aa889" },
  AXISBANK: { name: "Axis Bank", sector: "Private Sector Bank", subSector: "Commercial Banking", marketCap: "Large cap", donutOrder: 45, risk: "Medium", stance: "Core bank / result watch", oil: 3, flow: 5, quarter: "Constructive", color: "#4c8fff" },
  JSWENERGY: { name: "JSW Energy", sector: "Power Generation", subSector: "Integrated Power & Storage", marketCap: "Mid cap", donutOrder: 50, risk: "Medium-high", stance: "Small hold", oil: 2, flow: 3, quarter: "Constructive, execution-led", color: "#df6651" },
  /** NSE: Non Banking Financial Company · AMFI Mid cap (Jan–Jun 2026 band; ~₹77k Cr). */
  LTF: { name: "L&T Finance", sector: "Non Banking Financial Company", subSector: "Diversified Retail NBFC", marketCap: "Mid cap", donutOrder: 55, risk: "Medium-high", stance: "Small hold / watch", oil: 2, flow: 4, quarter: "Constructive", color: "#c9893a" },
  AETHER: { name: "Aether Industries", sector: "Specialty Chemicals", subSector: "Specialty & Fine Chemicals", marketCap: "Small cap", donutOrder: 60, risk: "High", stance: "Small hold / watch", oil: 5, flow: 3, quarter: "Cautious", color: "#e6a11a" },
} as const;

/** Kite / exchange symbol aliases → canonical classification key. */
export const securitySymbolAliases: Record<string, keyof typeof securityClassifications> = {
  LTFINANCE: "LTF",
  LTFH: "LTF",
};

export const holdings = [
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials", marketCap: "Large cap", qty: 4, avg: 1350.3, price: 1411.5, value: 5646, pnl: 244.8, pnlPct: 4.53, dayPnl: 40.2, dayPct: 0.72, weight: 39.10, risk: "Medium", stance: "Core hold", oil: 3, flow: 5, quarter: "Constructive", color: "#2563a6" },
  { symbol: "ETERNAL", name: "Eternal", sector: "Consumer internet", marketCap: "Large cap", qty: 17, avg: 249.352941, price: 286.75, value: 4874.75, pnl: 635.75, pnlPct: 15.00, dayPnl: -49.3, dayPct: -1.00, weight: 33.76, risk: "High", stance: "Hold / cap additions", oil: 4, flow: 5, quarter: "Positive, volatile", color: "#13a08f" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom", marketCap: "Large cap", qty: 1, avg: 1921.9, price: 1905.4, value: 1905.4, pnl: -16.5, pnlPct: -0.86, dayPnl: -15.7, dayPct: -0.82, weight: 13.20, risk: "Low-medium", stance: "Defensive hold", oil: 2, flow: 4, quarter: "Constructive", color: "#7659c8" },
  { symbol: "AETHER", name: "Aether Industries", sector: "Specialty chemicals", marketCap: "Small cap", qty: 1, avg: 1455, price: 1458.6, value: 1458.6, pnl: 3.6, pnlPct: 0.25, dayPnl: -42.2, dayPct: -2.81, weight: 10.10, risk: "High", stance: "Small hold / watch", oil: 5, flow: 3, quarter: "Cautious", color: "#e6a11a" },
  { symbol: "JSWENERGY", name: "JSW Energy", sector: "Power", marketCap: "Mid cap", qty: 1, avg: 550, price: 554.25, value: 554.25, pnl: 4.25, pnlPct: 0.77, dayPnl: 0.8, dayPct: 0.14, weight: 3.84, risk: "Medium-high", stance: "Small hold", oil: 2, flow: 3, quarter: "Constructive, execution-led", color: "#df6651" },
];

export const portfolio = {
  invested: 13567.10,
  value: 14439.00,
  pnl: 871.90,
  pnlPct: 6.43,
  dayPnl: -66.20,
  dayPct: -0.46,
  topTwo: 72.86,
  equityMargin: 50.20,
};

export const marketCapAllocation = [
  { name: "Large cap", value: 12426.15, weight: 86.06, color: "#315f91" },
  { name: "Mid cap", value: 554.25, weight: 3.84, color: "#8aa4bd" },
  { name: "Small cap", value: 1458.60, weight: 10.10, color: "#c1ceda" },
];

export const sectorAllocation = [
  { name: "Financials", value: 5646.00, weight: 39.10, color: "#276fb0" },
  { name: "Consumer internet", value: 4874.75, weight: 33.76, color: "#1ba58f" },
  { name: "Telecom", value: 1905.40, weight: 13.20, color: "#7a62c7" },
  { name: "Specialty chemicals", value: 1458.60, weight: 10.10, color: "#e5a11d" },
  { name: "Power", value: 554.25, weight: 3.84, color: "#d96d58" },
];

export const newsletterDigest = [
  { source: "Bay Area Times", time: "3:57 PM", title: "Meta kills Muse", summary: "AI product rationalisation remains rapid; platform spending and model portfolios are still being reprioritised.", bullets: ["Meta ended the Muse product effort amid broader AI portfolio pruning.", "Platform spending is still being reprioritised across model and product bets.", "Competitive pressure around AI assistants remains elevated.", "Source: Bay Area Times", "As of: 3:57 PM"] },
  { source: "Morning Brew", time: "3:06 PM", title: "Apple of discord", summary: "Apple-related competitive and regulatory friction remains the lead global technology theme.", bullets: ["Apple competitive and regulatory friction led the technology tape.", "Device and services narratives remain intertwined with AI positioning.", "Policy scrutiny of large platforms continues as a cross-market theme.", "Source: Morning Brew", "As of: 3:06 PM"] },
  { source: "Economic Times", time: "4:03 PM", title: "Trading ideas for a volatile week", summary: "The latest issue focuses on analyst-selected Nifty 50 opportunities under elevated market volatility.", bullets: ["Coverage centres on analyst-selected Nifty 50 ideas.", "Elevated market volatility frames the trading-week setup.", "Ideas are sourced from the newsletter body, not broker confirmation.", "Source: Economic Times", "As of: 4:03 PM"] },
  { source: "TLDR", time: "4:14 PM", title: "Apple sues OpenAI / Apple AI chips", summary: "AI litigation, custom silicon and codebase comprehension dominate the technology news cycle.", bullets: ["AI litigation headlines include Apple versus OpenAI coverage.", "Custom silicon and on-device AI remain a recurring chip narrative.", "Codebase comprehension tools are a secondary developer-theme.", "Source: TLDR", "As of: 4:14 PM"] },
  { source: "TLDR Data", time: "3:39 PM", title: "Broken SQL benchmarks", summary: "Data-team themes include benchmark quality, faster experimentation and shifting controls earlier in development.", bullets: ["SQL benchmark quality is questioned as a reliability signal.", "Faster experimentation remains a data-team priority.", "Controls are shifting earlier in the development lifecycle.", "Source: TLDR Data", "As of: 3:39 PM"] },
];

export const axisResearchDigest = [
  { time: "8:46 AM", title: "Sector Seasonality: Week 29", summary: "Historical seasonal tendencies for NSE sectors; the email provides a report link but no sector table in the message body.", bullets: ["Axis flagged historical seasonal tendencies for NSE sectors.", "The message body points to a report link rather than embedding the full table.", "No sector matrix was readable in the plain-text body.", "Source: Axis Research", "As of: 8:46 AM"] },
  { time: "8:51 AM", title: "Daily Morning Note", summary: "Featured Rainbow Children's (BUY), LTIMindtree (BUY) and Avenue Supermarts (BUY). Asian markets were lower on renewed US-Iran tension and GIFT Nifty indicated a weaker open.", bullets: ["Rainbow Children's featured as BUY in the morning note.", "LTIMindtree featured as BUY in the morning note.", "Avenue Supermarts featured as BUY in the morning note.", "Asian markets were lower on renewed US-Iran tension.", "GIFT Nifty indicated a weaker open."] },
  { time: "10:44 AM", title: "Q1 FY27 Result Updates", summary: "Avenue Supermarts: BUY, TP INR 4,845, 19% indicated upside. LTIMindtree: BUY, TP INR 4,560, supported by the Lakshya 31 AI-led growth plan.", bullets: ["Avenue Supermarts: BUY, TP INR 4,845 (19% indicated upside in the mail).", "LTIMindtree: BUY, TP INR 4,560.", "LTIMindtree thesis references the Lakshya 31 AI-led growth plan.", "Source: Axis Research result-update mail", "As of: 10:44 AM"] },
  { time: "2:17 PM", title: "Axis Alpha: R Systems", summary: "BUY at CMP INR 247, target INR 272, stop INR 235 and 30-day duration. Thesis: digital engineering scale, repeat revenue, Blackstone backing and AI capability.", bullets: ["R Systems Axis Alpha call: BUY at CMP INR 247.", "Target INR 272 with stop INR 235.", "Stated duration: 30 days.", "Thesis cites digital engineering scale and repeat revenue.", "Thesis also cites Blackstone backing and AI capability."] },
];

export const riskAxes = ["Valuation", "Sector", "Liquidity", "Volatility", "Event", "Leverage"] as const;

export type RiskProfile = {
  symbol: string;
  name: string;
  color: string;
  scores: [number, number, number, number, number, number];
};

export const portfolioRiskProfiles: RiskProfile[] = [
  { symbol: "ICICIBANK", name: "ICICI Bank", color: "#4c8fff", scores: [2, 4, 1, 2, 4, 3] },
  { symbol: "ETERNAL", name: "Eternal", color: "#42c878", scores: [5, 4, 2, 4, 4, 1] },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", color: "#b38cff", scores: [3, 2, 1, 2, 3, 4] },
  { symbol: "ADANIGREEN", name: "Adani Green Energy", color: "#21b5c5", scores: [4, 4, 3, 5, 4, 5] },
  { symbol: "AXISBANK", name: "Axis Bank", color: "#4c8fff", scores: [2, 4, 1, 2, 4, 3] },
  { symbol: "AETHER", name: "Aether Industries", color: "#e3b844", scores: [4, 4, 4, 5, 4, 2] },
  { symbol: "JSWENERGY", name: "JSW Energy", color: "#ff7f6e", scores: [4, 3, 3, 4, 4, 5] },
  { symbol: "LTF", name: "L&T Finance", color: "#c9893a", scores: [3, 4, 3, 4, 3, 4] },
];

export const axisRecommendations = [
  { symbol: "RSYSTEMS", name: "R Systems International", call: "BUY", target: 272, cmp: 247, upside: "10%", horizon: "30 days", source: "Axis Alpha email", date: "13 Jul", thesis: "Mid-market digital engineering, 90%+ repeat business, AI capability and Blackstone backing.", color: "#4c8fff", scores: [4, 4, 4, 5, 4, 1] as RiskProfile["scores"] },
  { symbol: "DMART", name: "Avenue Supermarts", call: "BUY", target: 4845, cmp: 4071, upside: "19%", horizon: "Result update", source: "Axis email", date: "13 Jul", thesis: "Long runway and store expansion offset softer like-for-like growth and near-term margin pressure.", color: "#42c878", scores: [5, 3, 1, 3, 4, 1] as RiskProfile["scores"] },
  { symbol: "LTIM", name: "LTIMindtree", call: "BUY", target: 4560, cmp: null, upside: "Not stated", horizon: "Result update", source: "Axis email", date: "13 Jul", thesis: "Lakshya 31 targets roughly USD 10bn revenue through AI-led platforms, organic growth and selective M&A.", color: "#b38cff", scores: [3, 4, 1, 4, 4, 1] as RiskProfile["scores"] },
  { symbol: "RAINBOW", name: "Rainbow Children's Medicare", call: "BUY", target: 1617, cmp: 1470, upside: "10%", horizon: "6-9 months", source: "Mail + PDF", date: "11-13 Jul", thesis: "Bed expansion, stabilising margins and ARPOB growth; featured as Pick of the Week.", color: "#ff7f6e", scores: [4, 4, 3, 4, 4, 3] as RiskProfile["scores"] },
  { symbol: "TCS", name: "Tata Consultancy Services", call: "BUY", target: 2360, cmp: null, upside: "15% in report", horizon: "12 months", source: "Result update PDF", date: "10 Jul", thesis: "Stable Q1 delivery and accelerating AI services, tempered by cautious demand and estimate cuts.", color: "#21b5c5", scores: [3, 4, 1, 3, 4, 1] as RiskProfile["scores"] },
  { symbol: "ETERNAL", name: "Eternal", call: "TRADING BUY", target: null, cmp: null, upside: "5-10% basket", horizon: "Earnings play", source: "Q1 preview PDF", date: "9 Jul", thesis: "Internet growth momentum and platform expansion; valuation and event sensitivity remain high.", color: "#42c878", scores: [5, 4, 2, 4, 4, 1] as RiskProfile["scores"] },
  { symbol: "DLF", name: "DLF", call: "TECHNICAL BUY", target: 750, cmp: 686, upside: "11-14%", horizon: "3-4 weeks", source: "Weekly picks PDF", date: "10 Jul", thesis: "Breakout above resistance with volume confirmation and positive RSI structure.", color: "#e3b844", scores: [4, 5, 1, 4, 3, 4] as RiskProfile["scores"] },
  { symbol: "CDSL", name: "CDSL", call: "TECHNICAL BUY", target: 1525, cmp: 1432, upside: "9-12%", horizon: "3-4 weeks", source: "Weekly picks PDF", date: "10 Jul", thesis: "Trendline and Bollinger-band breakout with rising moving averages and supportive RSI.", color: "#f08bd3", scores: [4, 4, 1, 4, 3, 1] as RiskProfile["scores"] },
  { symbol: "KSL", name: "Kalyani Steels", call: "TECHNICAL BUY", target: 1025, cmp: 959, upside: "10-13%", horizon: "3-4 weeks", source: "Weekly picks PDF", date: "10 Jul", thesis: "Medium-term trendline breakout, Fibonacci support and strengthening weekly momentum.", color: "#79a7ff", scores: [4, 5, 4, 5, 3, 3] as RiskProfile["scores"] },
];

export const axisArchiveAudit = {
  filesAttempted: 188,
  validPdfs: 183,
  pagesRead: 2479,
  duplicateGroups: 1,
  invalidFiles: [
    "Archive/DailyReports/Axis_MorningNote-2026-06-29.pdf",
    "Archive/DailyReports/Axis_MorningNote-2026-06-30.pdf",
    "Axis_MorningNote-2026-07-01.pdf",
    "_try_mn.pdf",
    "_tryx.pdf",
  ],
};

export type EarningsKpi = { label: string; value: string; change: string; tone?: "green" | "amber" | "red" };
export type EarningsEvent = {
  date: string;
  /** Authoritative YYYY-MM-DD when supplied by a source calendar. */
  dateKey?: string;
  day: string;
  symbol: string;
  name: string;
  state: string;
  portfolio: boolean;
  period: string;
  reported: boolean;
  kpis: EarningsKpi[];
  summary?: string;
  source?: string;
  /** Stable Apple Calendar source identifier for scheduling evidence. */
  calendarEventId?: string;
  /** Distinguishes results, calls, and board meetings on the same date. */
  eventKind?: string;
  /** Scheduling warnings produced by canonical market-holiday overlap checks. */
  holidayConflicts?: Array<{
    eventKey: string;
    date: string;
    market: "NSE" | "US";
    holiday: string;
  }>;
};

export const earningsAsOf = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
}).format(new Date());

export const earningsCalendar: EarningsEvent[] = [
  { date: "10 Jul", day: "10", symbol: "LTF", name: "L&T Finance", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "PAT", value: "₹902 Cr", change: "+29% YoY", tone: "green" },
    { label: "Loan book", value: "₹1,29,634 Cr", change: "+27% YoY", tone: "green" },
    { label: "Return on assets", value: "2.48%", change: "+11 bps YoY", tone: "green" },
    { label: "Credit cost", value: "2.54%", change: "vs 3.43% YoY", tone: "green" },
  ], summary: "Highest-ever quarterly PAT; disbursements reached ₹23,852 crore (+36% YoY), RoE improved to 12.71%, and NIM plus fees held at 10.47%.", source: "https://www.ltfinance.com/docs/default-source/default-document-library/investor_presentation_q1fy27.pdf" },
  { date: "14 Jul", day: "14", symbol: "LTTS", name: "L&T Technology Services", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Revenue", value: "₹2,940.1 Cr", change: "+2.9% QoQ · +11.5% YoY", tone: "green" },
    { label: "CC growth", value: "+1.9% YoY", change: "USD revenue $310m · +1.5% QoQ", tone: "green" },
    { label: "EBIT margin", value: "15.7%", change: "+50 bps QoQ · +200 bps YoY", tone: "green" },
    { label: "Large deals", value: "6 wins", change: "1×$30m+ · 1×$20m+ · 4×$10m+", tone: "green" },
  ], summary: "Revenue and margin expanded together. Net income was ₹351.8 crore (+17.4% YoY), while management reiterated its Lakshya 31 aspiration of 13-15% revenue CAGR over five years rather than issuing a one-year FY27 growth guide.", source: "https://www.ltts.com/press-release/Q1FY27-results" },
  { date: "16 Jul", day: "16", symbol: "TECHM", name: "Tech Mahindra", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Revenue", value: "₹15,712 Cr", change: "+4.2% QoQ · +17.7% YoY", tone: "green" },
    { label: "CC growth", value: "+2.6% QoQ", change: "+6.6% YoY · USD $1,660m", tone: "green" },
    { label: "EBIT margin", value: "14.4%", change: "+60 bps QoQ · +330 bps YoY", tone: "green" },
    { label: "New-deal TCV", value: "$1,078m", change: "+33.3% YoY · attrition 11.8%", tone: "green" },
  ], summary: "Broad-based growth and margin expansion accompanied a third consecutive quarter of $1bn-plus deal wins. PAT was ₹1,465 crore (+28.4% YoY); headcount fell by 863 QoQ to 146,760 and DSO improved to 84 days.", source: "https://www.techmahindra.com/insights/press-releases/techmahindra-q1-fy27-results/" },
  { date: "17 Jul", day: "17", symbol: "JSWSTEEL", name: "JSW Steel", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Revenue", value: "₹47,364 Cr", change: "+9.8% YoY", tone: "green" },
    { label: "Saleable sales", value: "6.25 MT", change: "+4% YoY", tone: "green" },
    { label: "Adj. EBITDA / tonne", value: "₹14,990", change: "+27% YoY", tone: "green" },
    { label: "Net debt", value: "₹46,157 Cr", change: "Down ₹7,713 Cr vs Mar", tone: "green" },
  ], summary: "PAT more than doubled to ₹4,696 crore. Revenue, volumes and unit economics improved while net debt declined materially from March.", source: "https://www.moneycontrol.com/news/business/markets/jsw-steel-q1-results-net-profit-more-than-doubles-to-rs-4-696-crore-beats-estimates-13976697.html" },
  { date: "18 Jul", day: "18", symbol: "ICICIBANK", name: "ICICI Bank", state: "Reported · portfolio catalyst", portfolio: true, period: "Q1 FY27", reported: true, kpis: [
    { label: "Net interest income", value: "₹24,384 Cr", change: "+12.7% YoY", tone: "green" },
    { label: "Net interest margin", value: "4.36%", change: "Quarterly reported NIM", tone: "green" },
    { label: "PAT", value: "₹14,804.5 Cr", change: "+15.9% YoY", tone: "green" },
    { label: "Gross / net NPA", value: "1.38% / 0.35%", change: "GNPA improved YoY", tone: "green" },
  ], summary: "Profit and net interest income grew double digits while gross asset quality improved. This is the calendar's directly held portfolio catalyst.", source: "https://www.business-standard.com/companies/quarterly-results/icici-bank-s-q1fy27-standalone-profit-rises-15-9-to-rs-14-804-cr-126071800665_1.html" },
  { date: "18 Jul", day: "18", symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Net interest income", value: "₹11,266 Cr", change: "+9% YoY", tone: "green" },
    { label: "Net interest margin", value: "4.53%", change: "vs 4.67% QoQ", tone: "amber" },
    { label: "Standalone PAT", value: "₹4,123 Cr", change: "+26% YoY", tone: "green" },
    { label: "Gross NPA", value: "1.18%", change: "vs 1.48% YoY", tone: "green" },
  ], summary: "Standalone profit and NII rose, with gross asset quality improving year on year. Margin moderated sequentially and remains the key watch item.", source: "https://www.business-standard.com/companies/quarterly-results/kotak-mahindra-bank-q1fy27-results-net-profit-rises-23-to-5-480-crore-126071800554_1.html" },
  { date: "18 Jul", day: "18", symbol: "AXISBANK", name: "Axis Bank", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Net interest income", value: "₹14,646 Cr", change: "+8% YoY", tone: "green" },
    { label: "Net interest margin", value: "3.46%", change: "Quarterly reported NIM", tone: "amber" },
    { label: "PAT", value: "₹7,114 Cr", change: "+23% YoY", tone: "green" },
    { label: "Gross / net NPA", value: "1.28% / 0.39%", change: "GNPA improved YoY", tone: "green" },
  ], summary: "Profit and NII advanced while gross asset quality improved. Net credit cost was 0.63%, providing a useful risk check alongside margin progression.", source: "https://www.moneycontrol.com/news/business/earnings/axis-bank-q1-profit-rises-23-to-rs-7-114-crore-nii-grows-8-asset-quality-improves-13977302.html" },
  { date: "30 Jul", day: "30", symbol: "IRFC", name: "Indian Railway Finance Corp", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Net interest income", value: "₹1,970 Cr", change: "+9.8% YoY", tone: "green" },
    { label: "PAT", value: "₹1,927.21 Cr", change: "+10.4% YoY", tone: "green" },
    { label: "AUM", value: "₹4.79 Lakh Cr", change: "vs ₹4.85 Lakh Cr QoQ", tone: "amber" },
    { label: "Net interest margin", value: "1.48%", change: "Annualised", tone: "green" },
  ], summary: "IRFC reported its highest-ever quarterly total income of ₹8,391.34 crore and PAT of ₹1,927.21 crore while retaining a zero-NPA asset book. AUM moderated sequentially to ₹4.79 lakh crore.", source: "https://irfc.co.in/investors/financial-information" },
  { date: "20 Jul", day: "20", symbol: "ULTRACEMCO", name: "UltraTech Cement", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Sales volume", value: "41.31 Mt", change: "+12.2% YoY", tone: "green" },
    { label: "Revenue", value: "₹24,648 Cr", change: "+15.9% YoY", tone: "green" },
    { label: "EBITDA / tonne", value: "₹1,214", change: "+1.3% YoY", tone: "green" },
    { label: "PAT", value: "₹2,599 Cr", change: "+16.8% YoY", tone: "green" },
  ], summary: "Double-digit volume and revenue growth supported profit expansion, while EBITDA per tonne improved modestly despite input-cost pressure.", source: "https://www.adityabirla.com/media/press-releases/ultratech-delivers-strong-q1-fy27-performance-net-sales-up-16-pat-up-17-domestic-volumes-up-131/" },
  { date: "21 Jul", day: "21", symbol: "BAJAJ-AUTO", name: "Bajaj Auto", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Revenue", value: "₹17,243 Cr", change: "+37% YoY", tone: "green" },
    { label: "EBITDA", value: "₹3,696 Cr", change: "Quarterly operating profit", tone: "green" },
    { label: "EBITDA margin", value: "21.4%", change: "Calculated from reported revenue", tone: "green" },
    { label: "PAT", value: "₹3,226 Cr", change: "+46% YoY", tone: "green" },
  ], summary: "Record volumes, exports and realisations supported strong revenue and profit growth. The company published its Q1 FY27 release on 21 July.", source: "https://www.bajajauto.com/investors/financial-and-operational-performance" },
  { date: "21 Jul", day: "21", symbol: "TVSMOTOR", name: "TVS Motor", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Revenue", value: "₹13,896 Cr", change: "+38% YoY", tone: "green" },
    { label: "EBITDA", value: "₹1,779 Cr", change: "+41% YoY", tone: "green" },
    { label: "EBITDA margin", value: "12.8%", change: "+30 bps YoY", tone: "green" },
    { label: "Standalone PAT", value: "₹1,174 Cr", change: "+51% YoY", tone: "green" },
  ], summary: "Highest-ever quarterly sales with 2W/3W volumes at 1.63 million (+28% YoY). Standalone revenue, EBITDA and PAT all rose sharply; consolidated PAT was ₹1,057.61 crore (+65% YoY) per the regulatory filing coverage.", source: "https://www.business-standard.com/markets/news/street-cheers-tvs-motor-s-q1-beat-stock-gains-3-analysts-see-15-upside-126072200176_1.html" },
  { date: "21 Jul", day: "21", symbol: "BPCL", name: "Bharat Petroleum", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Refinery throughput", value: "10.15 MMT", change: "vs 10.42 MMT YoY", tone: "amber" },
    { label: "Marketing volume", value: "14.13 MMT", change: "Domestic 13.62 · Export 0.51", tone: "green" },
    { label: "Revenue", value: "₹1,59,479 Cr", change: "+23.1% YoY standalone", tone: "green" },
    { label: "PAT", value: "Loss ₹3,962 Cr", change: "Standalone · consol. loss ₹1,873 Cr", tone: "red" },
  ], summary: "Revenue rose on higher fuel realisations, but suppressed marketing margins and LPG under-recoveries swung the quarter into a standalone loss despite stronger refining support.", source: "https://energy.economictimes.indiatimes.com/news/oil-and-gas/bpcl-reports-1873-crore-loss-in-q1-fy27-due-to-weak-fuel-marketing-margins/132555664" },
  { date: "22 Jul", day: "22", symbol: "ADANIGREEN", name: "Adani Green Energy", state: "Reported · portfolio catalyst", portfolio: true, period: "Q1 FY27", reported: true, kpis: [
    { label: "Operational capacity", value: "20,142 MW", change: "+27% YoY", tone: "green" },
    { label: "Energy sales", value: "13,657 MU", change: "+30% YoY", tone: "green" },
    { label: "EBITDA (power supply)", value: "₹4,122 Cr", change: "+33% YoY · 94% margin", tone: "green" },
    { label: "Cash profit", value: "₹2,225 Cr", change: "+28% YoY", tone: "green" },
  ], summary: "Crossed 20 GW operational capacity with record power-supply EBITDA. Revenue from power supply was ₹4,280 crore (+29% YoY); BESS installed capacity reached 3,551 MWh after 1,972 MWh commissioned at Khavda in the quarter.", source: "https://www.ndtvprofit.com/markets/adani-green-energy-q1-ebitda-rises-to-record-rs-4-122-crore-as-capacity-crosses-20-gw-11805479" },
  { date: "22 Jul", day: "22", symbol: "ADANIPOWER", name: "Adani Power", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Reported revenue", value: "₹19,322 Cr", change: "+32.6% YoY", tone: "green" },
    { label: "Reported EBITDA", value: "₹8,369 Cr", change: "+36% YoY", tone: "green" },
    { label: "PAT", value: "₹4,867 Cr", change: "+47.2% YoY", tone: "green" },
    { label: "Power sales", value: "28.8 BU", change: "+16.9% YoY · PLF 77.9%", tone: "green" },
  ], summary: "Highest-ever quarterly operating and financial print: continuing EBITDA ₹6,983 crore (+21.6% YoY), installed capacity 18,330 MW, and power dispatch 28.8 BU on strong summer demand.", source: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/0a67308a-1037-45a4-ab3c-4593628d851a.pdf" },
  { date: "22 Jul", day: "22", symbol: "ETERNAL", name: "Eternal", state: "Reported · portfolio catalyst", portfolio: true, period: "Q1 FY27", reported: true, kpis: [
    { label: "Adj. revenue", value: "₹20,648 Cr", change: "+173% YoY · +17% QoQ", tone: "green" },
    { label: "Adj. EBITDA", value: "₹555 Cr", change: "+223% YoY · +29% QoQ", tone: "green" },
    { label: "PAT", value: "₹92 Cr", change: "+268% YoY · -47% QoQ", tone: "amber" },
    { label: "B2C NOV", value: "₹31,120 Cr", change: "+54% YoY", tone: "green" },
  ], summary: "Blinkit-led scale lifted adjusted revenue and EBITDA sharply; consol. PAT of ₹92 crore rose YoY but missed Street estimates and fell sequentially. Food-delivery NOV was ₹10,769 crore and Blinkit NOV ₹17,132 crore (+86% YoY).", source: "https://www.eternal.com/blog/q1fy27/" },
  { date: "23 Jul", day: "23", symbol: "INFY", name: "Infosys", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Revenue / CC growth", value: "$5,082m · +2.4% YoY CC", change: "+1.0% QoQ CC · ₹48,211 Cr", tone: "green" },
    { label: "Operating margin", value: "21.1%", change: "+20 bps QoQ · +30 bps YoY", tone: "green" },
    { label: "Large-deal TCV", value: "$3.6bn", change: "61% net new", tone: "green" },
    { label: "FY27 guidance", value: "1.5%–3.0% CC", change: "OM retained 20%–22%", tone: "amber" },
  ], summary: "Q1 revenue $5,082m with resilient 21.1% operating margin and $3.6bn large-deal TCV. Management trimmed the upper end of FY27 CC revenue guidance to 1.5%–3.0% while retaining the 20%–22% margin band; AI revenues were 8.2% of the quarter.", source: "https://www.infosys.com/investors/reports-filings/quarterly-results/2026-2027/q1.html" },
  { date: "24 Jul", day: "24", symbol: "TATACONSUM", name: "Tata Consumer Products", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Revenue growth", value: "+12% YoY · ₹5,349 Cr", change: "+9% CC · PAT ₹427 Cr (+28% YoY)", tone: "green" },
    { label: "Operating margin", value: "10.56%", change: "Improved YoY · softer QoQ", tone: "amber" },
    { label: "India growth", value: "+13%", change: "Volume-backed India business", tone: "green" },
    { label: "International growth", value: "+5%", change: "Non-branded −10%", tone: "amber" },
  ], summary: "Double-digit consolidated revenue growth with India +13% and international +5%. PAT rose ~28% YoY to ₹427 crore; operating margin improved YoY to 10.56% while easing sequentially. Published EBITDA margin was not cited in the primary press coverage used here.", source: "https://economictimes.indiatimes.com/markets/stocks/earnings/tata-consumer-q1-results-net-profit-rises-28-yoy-to-rs-427-crore-revenue-up-12/articleshow/132603103.cms" },
  { date: "24 Jul", day: "24", symbol: "BANKBARODA", name: "Bank of Baroda", state: "Reported", portfolio: false, period: "Q1 FY27", reported: true, kpis: [
    { label: "Net interest income", value: "₹12,524 Cr", change: "+9.5% YoY", tone: "green" },
    { label: "PAT", value: "₹1,278 Cr", change: "-72% YoY · NMC settlement", tone: "red" },
    { label: "Gross NPA", value: "1.99%", change: "vs 2.24% YoY", tone: "green" },
    { label: "Net NPA", value: "0.5%", change: "vs 0.6% prior", tone: "green" },
  ], summary: "PAT fell 72% YoY to ₹1,278 crore after absorbing the ~₹5,700 crore out-of-court NMC Health settlement. NII still rose 9.5% YoY to ₹12,524 crore; GNPA improved to 1.99% and NNPA to 0.5%. NIM and credit cost were not cited in the Moneycontrol primary coverage used here, so those slots are omitted rather than fabricated.", source: "https://www.moneycontrol.com/news/business/earnings/bank-of-baroda-q1-net-profit-falls-72-to-rs-1-278-crore-on-nmc-settlement-13982781.html" },
];

export const analystCalls = [
  { symbol: "BHARTIARTL", house: "Nomura / Moneycontrol", rating: "Buy", target: 2355, implied: 23.6, date: "30 Jun", thesis: "Tariff hike, premiumisation and capex moderation." },
  { symbol: "ETERNAL", house: "Motilal Alternate / Moneycontrol", rating: "Positive", target: 380, implied: 32.5, date: "9 Jul", thesis: "Potential MSCI full-weight restoration and passive inflows." },
  { symbol: "ICICIBANK", house: "Motilal Oswal / Moneycontrol", rating: "Buy", target: 1750, implied: 24.0, date: "4 Jun", thesis: "Loan growth, liability franchise and robust asset quality." },
  { symbol: "AETHER", house: "HDFC Securities / NDTV Profit", rating: "Buy", target: 1429, implied: -2.0, date: "2 Jul", thesis: "Exclusive manufacturing and R&D-led growth; target below current price." },
  { symbol: "JSWENERGY", house: "Prabhudas / Moneycontrol", rating: "Buy", target: 646, implied: 16.6, date: "15 Jun", thesis: "Renewable and storage expansion; execution and leverage are key risks." },
];

export const scenarios = {
  deescalation: {
    label: "De-escalation",
    oil: "Brent $70-75",
    tone: "green",
    summary: "Rupee and inflation pressure ease; growth-duration and mid-cap multiples recover.",
    leaders: "Eternal, Aether",
    laggards: "No clear laggard; Airtel may underperform a risk-on rebound",
    action: "Keep quality; diversify with new capital rather than chase relief rallies.",
  },
  base: {
    label: "Controlled conflict",
    oil: "Brent $78-90",
    tone: "amber",
    summary: "Current regime: elevated volatility, manageable earnings damage, repeated headline shocks.",
    leaders: "Airtel, ICICI Bank",
    laggards: "Aether, Eternal on risk-off days",
    action: "Stagger additions; monitor INR, yields and FII persistence.",
  },
  stress: {
    label: "Hormuz disruption",
    oil: "Brent $100-120",
    tone: "red",
    summary: "India import-bill, INR, inflation and rate pressure reinforce FII de-risking.",
    leaders: "Airtel on relative resilience",
    laggards: "Aether, Eternal; ICICI multiple sensitivity",
    action: "Preserve liquidity and pause high-beta additions until oil and flows stabilise.",
  },
};

export const orders = [
  { symbol: "JSWENERGY", side: "BUY", qty: 1, type: "GTT limit", price: 550, status: "Complete" },
  { symbol: "AETHER", side: "BUY", qty: 1, type: "Limit", price: 1455, status: "Complete" },
];

export const gtts = [
  { symbol: "ALPHA", side: "BUY", qty: 25, trigger: 51, limit: 50, status: "Active", expiry: "9 Jul 2027" },
  { symbol: "JSWENERGY", side: "BUY", qty: 1, trigger: 550, limit: 550, status: "Triggered", expiry: "-" },
];

export const sources = [
  { label: "AP: renewed US-Iran attacks and Hormuz uncertainty", url: "https://apnews.com/article/iran-us-hormuz-strait-war-july-13-2026-6c2c44cfdd089d6393d18fa5930ed620" },
  { label: "AP: oil and market reaction", url: "https://apnews.com/article/stocks-markets-iran-trump-ai-2d6744b09c68b5473d0bc8584b89e60e" },
  { label: "Moneycontrol: 10 Jul FII/DII provisional flows", url: "https://www.moneycontrol.com/news/business/markets/fiis-net-buy-shares-worth-rs-2-604-crore-diis-add-rs-2-020-crore-on-july-10-13971189.html" },
  { label: "NSE: FII/FPI & DII trading activity reports", url: "https://www.nseindia.com/reports/fii-dii" },
  { label: "CNBC TV18: 24 Jul FII −₹3,892.77cr / DII +₹5,453.55cr", url: "https://www.cnbctv18.com/market/fiis-keep-selling-diis-continue-to-hold-the-fort-19953570.htm" },
  { label: "CNBC TV18: 23 Jul FII −₹2,999.23cr / DII +₹2,947.14cr", url: "https://www.cnbctv18.com/market/fiis-sell-shares-worth-%e2%82%b93000-crore-diis-nearly-offset-outflows-with-fresh-buying-19952623.htm" },
  { label: "Kotak Neo: FII/DII cash activity table", url: "https://www.kotakneo.com/share-market-today/fii-dii-data/" },
  { label: "Moneycontrol: FII/DII trading activity hub", url: "https://www.moneycontrol.com/markets/fii-dii-data/" },
  { label: "NSE Market Pulse: domestic ownership and FPI positioning", url: "https://nsearchives.nseindia.com/web/mediaattachment/2026-05/Market_Pulse_May_2026.pdf" },
  { label: "Moneycontrol: Bharti Airtel / Nomura", url: "https://www.moneycontrol.com/news/business/markets/nomura-reiterates-buy-on-bharti-airtel-raises-target-price-to-rs-2-355-13961831.html" },
  { label: "Moneycontrol: Eternal MSCI scenario", url: "https://www.moneycontrol.com/news/business/markets/eternal-rises-3-as-stock-could-be-restored-to-full-weight-in-msci-august-review-here-s-why-13969664.html" },
  { label: "Moneycontrol: ICICI Bank / Motilal Oswal", url: "https://www.moneycontrol.com/news/business/stocks/buy-icici-bank-target-of-rs-1750-motilal-oswal-4-13941183.html" },
  { label: "NDTV Profit: Aether / HDFC Securities", url: "https://www.ndtvprofit.com/markets/ather-energy-shares-in-focus-as-hdfc-securities-raises-target-price-buy-sell-or-hold-11716125" },
  { label: "Moneycontrol: JSW Energy broker calls", url: "https://www.moneycontrol.com/india/stockpricequote/power-generationdistribution/jswenergy/JE01" },
];

export const podcastNotes = [
  ["Bloomberg Daybreak US", "Renewed strikes and conflicting claims over Hormuz keep shipping and energy risk elevated.", ["Hormuz risk remains elevated after renewed strike claims.", "Shipping disruption risk is the immediate macro channel.", "Energy-price volatility is the linked market transmission.", "Source: Bloomberg Daybreak US", "Fallback digest until Apple Podcasts refresh succeeds."]],
  ["Prof G Markets", "SpaceX pricing highlights analyst-conflict and target-setting risk, relevant to how broker targets should be weighted.", ["SpaceX pricing discussion highlights analyst-conflict risk.", "Target-setting incentives remain a watchpoint for broker notes.", "Useful framing for how Axis and other house targets should be weighted.", "Source: Prof G Markets", "Fallback digest until Apple Podcasts refresh succeeds."]],
  ["Bloomberg Daybreak Europe", "Hormuz remains binary; the macro channel is energy inflation and policy uncertainty.", ["Hormuz remains a binary geopolitical risk.", "Energy inflation is the primary macro transmission.", "Policy uncertainty compounds the market risk premium.", "Source: Bloomberg Daybreak Europe", "Fallback digest until Apple Podcasts refresh succeeds."]],
  ["FT News Briefing", "Bank fee strength contrasts with geopolitical risk; US-Iran strikes remain a global risk premium.", ["Bank fee strength contrasts with geopolitical risk headlines.", "US-Iran strike risk remains a global risk premium.", "Risk-off tone can coexist with selected financials strength.", "Source: FT News Briefing", "Fallback digest until Apple Podcasts refresh succeeds."]],
  ["Economist World in Brief", "Missile and drone attacks confirm that a durable reopening of Hormuz is not established.", ["Missile and drone attacks remain part of the Hormuz evidence set.", "A durable reopening of Hormuz is not established.", "Energy logistics risk stays in the active watchlist.", "Source: Economist World in Brief", "Fallback digest until Apple Podcasts refresh succeeds."]],
  ["Bloomberg Daybreak Asia", "Higher oil may keep inflation and rates elevated, tightening financial conditions in Asia.", ["Higher oil can keep inflation elevated across Asia.", "Higher rates expectations tighten regional financial conditions.", "Asia risk premium remains tied to energy and policy paths.", "Source: Bloomberg Daybreak Asia", "Fallback digest until Apple Podcasts refresh succeeds."]],
  ["The Daily Brief", "Cult.fit IPO and AI disruption are useful sentiment gauges, but not direct portfolio catalysts.", ["Cult.fit IPO chatter is treated as a sentiment gauge.", "AI disruption narratives remain a secondary theme.", "Neither is treated as a direct portfolio catalyst here.", "Source: The Daily Brief", "Fallback digest until Apple Podcasts refresh succeeds."]],
];
