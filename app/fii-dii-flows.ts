/**
 * Cash-market FII/DII flow evidence for Macro scenario lab (Flows).
 * Prefer NSE/BSE provisional exchange prints; third-party articles are cross-checks only.
 * Do not fabricate — refresh figures from cited sources before claiming a new as-of.
 */

export type FlowEvidenceKind = "primary" | "cross-check";

export type FiiDiiEvidenceItem = {
  source: string;
  asOf: string;
  title: string;
  summary: string;
  url: string;
  kind: FlowEvidenceKind;
};

export type FiiDiiSession = {
  date: string;
  dateLabel: string;
  fiiNetCr: number;
  diiNetCr: number;
  fiiBuyCr?: number;
  fiiSellCr?: number;
  diiBuyCr?: number;
  diiSellCr?: number;
  provisional?: boolean;
};

export type FiiDiiFlowsSnapshot = {
  status: "live" | "cached" | "stale" | "unavailable";
  asOf: string;
  dataDate: string;
  segment: "Cash market";
  note: string;
  primarySourceUrl: string;
  sessions: FiiDiiSession[];
  evidence: FiiDiiEvidenceItem[];
};

/** Latest verified five cash sessions ending 24 Jul 2026 (₹ crore). */
export const fiiDiiFlowsSnapshot: FiiDiiFlowsSnapshot = {
  status: "cached",
  asOf: "24 Jul 2026, evening (provisional exchange prints via cited reports)",
  dataDate: "2026-07-24",
  segment: "Cash market",
  note: "Five-session cumulative FII cash net is the Macro lab decision metric. Latest-session FII/DII |net| magnitudes drive the composition donut; centre Δ is 5D FII.",
  primarySourceUrl: "https://www.nseindia.com/reports/fii-dii",
  sessions: [
    {
      date: "2026-07-24",
      dateLabel: "24 Jul 2026",
      fiiNetCr: -3892.77,
      diiNetCr: 5453.55,
      fiiBuyCr: 11123.86,
      fiiSellCr: 15016.63,
      diiBuyCr: 18959.43,
      diiSellCr: 13505.88,
      provisional: true,
    },
    {
      date: "2026-07-23",
      dateLabel: "23 Jul 2026",
      fiiNetCr: -2999.23,
      diiNetCr: 2947.14,
      fiiBuyCr: 11472.08,
      fiiSellCr: 14471.31,
      diiBuyCr: 16575.3,
      diiSellCr: 13628.16,
      provisional: true,
    },
    {
      date: "2026-07-22",
      dateLabel: "22 Jul 2026",
      fiiNetCr: -819.2,
      diiNetCr: -418.26,
    },
    {
      date: "2026-07-21",
      dateLabel: "21 Jul 2026",
      fiiNetCr: 1650.16,
      diiNetCr: -656.88,
      fiiBuyCr: 16327.88,
      fiiSellCr: 14677.72,
      diiBuyCr: 14638.54,
      diiSellCr: 15295.42,
    },
    {
      date: "2026-07-20",
      dateLabel: "20 Jul 2026",
      fiiNetCr: -1121.04,
      diiNetCr: 1312.03,
    },
  ],
  evidence: [
    {
      source: "NSE India",
      asOf: "Report page · cash FII/FPI & DII",
      title: "FII/FPI & DII trading activity (NSE reports)",
      summary: "Primary exchange report for capital-market FII/FPI and DII buy/sell/net values. Provisional prints are subject to custodial confirmation; prefer five-session cumulative FII cash, not a single day.",
      url: "https://www.nseindia.com/reports/fii-dii",
      kind: "primary",
    },
    {
      source: "CNBC TV18",
      asOf: "24 Jul 2026, 7:38 pm IST",
      title: "FIIs keep selling, DIIs continue to hold the fort",
      summary: "Provisional exchange data: FII net −₹3,892.77cr (buy ₹11,123.86cr / sell ₹15,016.63cr); DII net +₹5,453.55cr (buy ₹18,959.43cr / sell ₹13,505.88cr). Week table matches five-session cash prints used below.",
      url: "https://www.cnbctv18.com/market/fiis-keep-selling-diis-continue-to-hold-the-fort-19953570.htm",
      kind: "cross-check",
    },
    {
      source: "CNBC TV18",
      asOf: "23 Jul 2026, 8:28 pm IST",
      title: "FIIs sell shares worth ₹3,000 crore; DIIs nearly offset",
      summary: "Provisional: FII −₹2,999.23cr; DII +₹2,947.14cr. Prior sessions in the same article: Mon FII −1,121.04 / DII +1,312.03; Tue +1,650.16 / −656.88; Wed −819.20 / −418.26.",
      url: "https://www.cnbctv18.com/market/fiis-sell-shares-worth-%e2%82%b93000-crore-diis-nearly-offset-outflows-with-fresh-buying-19952623.htm",
      kind: "cross-check",
    },
    {
      source: "Kotak Neo",
      asOf: "24 Jul 2026 cash table",
      title: "FII & DII trading activity (cash segment)",
      summary: "Daily cash gross/net table through 24 Jul 2026 aligns with CNBC provisional prints (FII −3,892.77; DII +5,453.55; combined +1,560.78). Cross-check of exchange-sourced aggregates.",
      url: "https://www.kotakneo.com/share-market-today/fii-dii-data/",
      kind: "cross-check",
    },
    {
      source: "Moneycontrol",
      asOf: "FII/DII activity hub · Jul 2026",
      title: "FII/DII trading activity tracker",
      summary: "Moneycontrol FII/DII cash hub for the July 2026 window. Use alongside NSE primary prints; page notes provisional exchange data typically posts 4:00–5:30 pm IST.",
      url: "https://www.moneycontrol.com/markets/fii-dii-data/",
      kind: "cross-check",
    },
  ],
};

export function fiveDayFiiNetCr(snapshot: FiiDiiFlowsSnapshot = fiiDiiFlowsSnapshot, days = 5): number {
  return snapshot.sessions.slice(0, days).reduce((sum, session) => sum + session.fiiNetCr, 0);
}

export function fiveDayDiiNetCr(snapshot: FiiDiiFlowsSnapshot = fiiDiiFlowsSnapshot, days = 5): number {
  return snapshot.sessions.slice(0, days).reduce((sum, session) => sum + session.diiNetCr, 0);
}

export function formatFlowCr(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}cr`;
}

/** Compact signed crore label for donut centre (e.g. −₹7,182cr). */
export function formatFlowDeltaCr(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}₹${Math.abs(rounded).toLocaleString("en-IN")}cr`;
}

export type FlowDonutSlice = {
  name: string;
  value: number;
  signedNetCr: number;
  color: string;
};

/** Absolute |net| composition of latest FII vs DII session — centre Δ remains signed 5D FII. */
export function flowCompositionSlices(snapshot: FiiDiiFlowsSnapshot = fiiDiiFlowsSnapshot): FlowDonutSlice[] {
  const latest = snapshot.sessions[0];
  if (!latest) return [];
  return [
    { name: "FII", value: Math.max(Math.abs(latest.fiiNetCr), 0.01), signedNetCr: latest.fiiNetCr, color: "#d8942f" },
    { name: "DII", value: Math.max(Math.abs(latest.diiNetCr), 0.01), signedNetCr: latest.diiNetCr, color: "#4c8fff" },
  ];
}
