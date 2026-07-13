export const asOf = "13 Jul 2026, 15:41 IST";

export const holdings = [
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials", qty: 4, avg: 1350.3, price: 1411.5, value: 5646, pnl: 244.8, pnlPct: 4.53, weight: 39.10, risk: "Medium", stance: "Core hold", oil: 3, flow: 5, quarter: "Constructive", color: "#2563a6" },
  { symbol: "ETERNAL", name: "Eternal", sector: "Consumer internet", qty: 17, avg: 249.352941, price: 286.75, value: 4874.75, pnl: 635.75, pnlPct: 15.00, weight: 33.76, risk: "High", stance: "Hold / cap additions", oil: 4, flow: 5, quarter: "Positive, volatile", color: "#13a08f" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom", qty: 1, avg: 1921.9, price: 1905.4, value: 1905.4, pnl: -16.5, pnlPct: -0.86, weight: 13.20, risk: "Low-medium", stance: "Defensive hold", oil: 2, flow: 4, quarter: "Constructive", color: "#7659c8" },
  { symbol: "AETHER", name: "Aether Industries", sector: "Specialty chemicals", qty: 1, avg: 1455, price: 1458.6, value: 1458.6, pnl: 3.6, pnlPct: 0.25, weight: 10.10, risk: "High", stance: "Small hold / watch", oil: 5, flow: 3, quarter: "Cautious", color: "#e6a11a" },
  { symbol: "JSWENERGY", name: "JSW Energy", sector: "Power", qty: 1, avg: 550, price: 554.25, value: 554.25, pnl: 4.25, pnlPct: 0.77, weight: 3.84, risk: "Medium-high", stance: "Small hold", oil: 2, flow: 3, quarter: "Constructive, execution-led", color: "#df6651" },
];

export const portfolio = {
  invested: 13567.10,
  value: 14439.00,
  pnl: 871.90,
  pnlPct: 6.43,
  topTwo: 72.86,
  equityMargin: 50.20,
};

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
  { label: "NSE Market Pulse: domestic ownership and FPI positioning", url: "https://nsearchives.nseindia.com/web/mediaattachment/2026-05/Market_Pulse_May_2026.pdf" },
  { label: "Moneycontrol: Bharti Airtel / Nomura", url: "https://www.moneycontrol.com/news/business/markets/nomura-reiterates-buy-on-bharti-airtel-raises-target-price-to-rs-2-355-13961831.html" },
  { label: "Moneycontrol: Eternal MSCI scenario", url: "https://www.moneycontrol.com/news/business/markets/eternal-rises-3-as-stock-could-be-restored-to-full-weight-in-msci-august-review-here-s-why-13969664.html" },
  { label: "Moneycontrol: ICICI Bank / Motilal Oswal", url: "https://www.moneycontrol.com/news/business/stocks/buy-icici-bank-target-of-rs-1750-motilal-oswal-4-13941183.html" },
  { label: "NDTV Profit: Aether / HDFC Securities", url: "https://www.ndtvprofit.com/markets/ather-energy-shares-in-focus-as-hdfc-securities-raises-target-price-buy-sell-or-hold-11716125" },
  { label: "Moneycontrol: JSW Energy broker calls", url: "https://www.moneycontrol.com/india/stockpricequote/power-generationdistribution/jswenergy/JE01" },
];

export const podcastNotes = [
  ["Bloomberg Daybreak US", "Renewed strikes and conflicting claims over Hormuz keep shipping and energy risk elevated."],
  ["Prof G Markets", "SpaceX pricing highlights analyst-conflict and target-setting risk, relevant to how broker targets should be weighted."],
  ["Bloomberg Daybreak Europe", "Hormuz remains binary; the macro channel is energy inflation and policy uncertainty."],
  ["FT News Briefing", "Bank fee strength contrasts with geopolitical risk; US-Iran strikes remain a global risk premium."],
  ["Economist World in Brief", "Missile and drone attacks confirm that a durable reopening of Hormuz is not established."],
  ["Bloomberg Daybreak Asia", "Higher oil may keep inflation and rates elevated, tightening financial conditions in Asia."],
  ["The Daily Brief", "Cult.fit IPO and AI disruption are useful sentiment gauges, but not direct portfolio catalysts."],
];
