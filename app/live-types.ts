export type LiveHolding = {
  symbol: string;
  name: string;
  sector: string;
  subSector: string;
  marketCap: string;
  qty: number;
  avg: number;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  dayPnl: number;
  dayPct: number;
  weight: number;
  risk: string;
  stance: string;
  oil: number;
  flow: number;
  quarter: string;
  color: string;
  donutOrder: number;
  classificationStatus: "verified" | "pending";
};

export type AllocationSlice = {
  name: string;
  value: number;
  weight: number;
  color: string;
};

export type LiveOrder = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  type: string;
  price: number;
  status: string;
};

export type LiveGtt = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  trigger: number;
  limit: number;
  status: string;
  expiry: string;
};

export type KiteSnapshot = {
  status: "live" | "partial" | "snapshot" | "auth_required" | "unavailable";
  asOf: string;
  message: string;
  authUrl?: string;
  unavailableSections?: string[];
  portfolio: {
    invested: number;
    value: number;
    pnl: number;
    pnlPct: number;
    dayPnl: number;
    dayPct: number;
    topTwo: number;
    equityMargin: number;
  };
  holdings: LiveHolding[];
  orders: LiveOrder[];
  gtts: LiveGtt[];
  marketCapAllocation: AllocationSlice[];
  sectorAllocation: AllocationSlice[];
  subSectorAllocation: AllocationSlice[];
  classification: {
    industrySource: string;
    marketCapSource: string;
    industryUrl: string;
    marketCapUrl: string;
    asOf: string;
    pendingSymbols: string[];
  };
};

export const emptySnapshot: KiteSnapshot = {
  status: "unavailable",
  asOf: "Waiting for Kite Connect",
  message: "Live Kite data has not loaded yet.",
  portfolio: { invested: 0, value: 0, pnl: 0, pnlPct: 0, dayPnl: 0, dayPct: 0, topTwo: 0, equityMargin: 0 },
  holdings: [],
  orders: [],
  gtts: [],
  marketCapAllocation: [],
  sectorAllocation: [],
  subSectorAllocation: [],
  classification: { industrySource: "NSE basic industry", marketCapSource: "AMFI categorisation", industryUrl: "https://www.nseindia.com/market-data/live-equity-market", marketCapUrl: "https://www.amfiindia.com/otherdata/categorisation-of-stocks", asOf: "Waiting for verification", pendingSymbols: [] },
};
