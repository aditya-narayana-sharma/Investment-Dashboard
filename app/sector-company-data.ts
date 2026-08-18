export type FundamentalMetricKey = "growth" | "profitability" | "margin" | "quality";

export type SectorCompany = {
  symbol: string;
  name: string;
  universeShare: number;
  scores: Record<FundamentalMetricKey, number>;
  filingPeriod: string;
};

const company = (symbol: string, name: string, universeShare: number, scores: [number, number, number, number]): SectorCompany => ({
  symbol,
  name,
  universeShare,
  scores: { growth: scores[0], profitability: scores[1], margin: scores[2], quality: scores[3] },
  filingPeriod: "Latest available company filing",
});

export const sectorCompanies: Record<string, SectorCompany[]> = {
  it: [
    company("TCS", "Tata Consultancy Services", 24, [3.7, 4.6, 4.7, 4.8]), company("INFY", "Infosys", 22, [4.0, 4.5, 4.5, 4.6]),
    company("HCLTECH", "HCL Technologies", 13, [4.2, 4.3, 4.3, 4.4]), company("WIPRO", "Wipro", 9, [3.5, 3.8, 3.9, 4.0]),
    company("TECHM", "Tech Mahindra", 8, [4.3, 4.0, 3.8, 3.8]), company("LTIM", "LTIMindtree", 7, [4.1, 4.2, 4.1, 4.2]),
    company("PERSISTENT", "Persistent Systems", 5, [4.5, 4.1, 4.0, 3.9]), company("COFORGE", "Coforge", 4, [4.4, 3.9, 3.8, 3.8]),
    company("LTTS", "L&T Technology Services", 4, [4.2, 4.1, 4.0, 4.1]), company("MPHASIS", "Mphasis", 4, [3.8, 3.7, 3.6, 3.7]),
  ],
  pharma: [
    company("SUNPHARMA", "Sun Pharmaceutical", 24, [4.4, 4.5, 4.1, 4.5]), company("DIVISLAB", "Divi's Laboratories", 12, [4.1, 4.4, 4.6, 4.6]),
    company("CIPLA", "Cipla", 11, [3.9, 4.2, 4.3, 4.3]), company("DRREDDY", "Dr. Reddy's Laboratories", 11, [4.0, 4.1, 4.0, 4.2]),
    company("LUPIN", "Lupin", 9, [4.5, 4.0, 4.2, 3.9]), company("AUROPHARMA", "Aurobindo Pharma", 8, [3.8, 3.8, 3.7, 3.8]),
    company("ZYDUSLIFE", "Zydus Lifesciences", 8, [4.2, 3.9, 4.0, 4.0]), company("TORNTPHARM", "Torrent Pharmaceuticals", 7, [3.7, 4.3, 4.4, 4.1]),
    company("ALKEM", "Alkem Laboratories", 6, [3.5, 3.9, 3.8, 3.8]), company("GLENMARK", "Glenmark Pharmaceuticals", 4, [3.6, 3.2, 3.3, 3.1]),
  ],
  power: [
    company("NTPC", "NTPC", 22, [4.2, 4.4, 4.0, 4.4]), company("POWERGRID", "Power Grid Corporation", 18, [3.8, 4.5, 4.6, 4.6]),
    company("ADANIPOWER", "Adani Power", 13, [4.5, 4.1, 4.3, 3.1]), company("TATAPOWER", "Tata Power", 12, [4.3, 3.9, 3.7, 3.8]),
    company("ADANIGREEN", "Adani Green Energy", 10, [4.6, 2.9, 3.2, 2.8]), company("JSWENERGY", "JSW Energy", 8, [4.4, 3.7, 3.6, 3.4]),
    company("NHPC", "NHPC", 6, [3.7, 3.8, 4.2, 4.0]), company("TORNTPOWER", "Torrent Power", 5, [3.9, 4.0, 4.1, 4.1]),
    company("SJVN", "SJVN", 3, [3.5, 3.2, 3.3, 3.5]), company("CESC", "CESC", 3, [3.1, 3.6, 3.9, 3.8]),
  ],
  infrastructure: [
    company("LT", "Larsen & Toubro", 28, [4.5, 4.5, 4.2, 4.7]), company("RVNL", "Rail Vikas Nigam", 13, [4.6, 4.0, 3.8, 3.3]),
    company("IRCON", "Ircon International", 9, [4.0, 3.8, 3.7, 3.6]), company("KEC", "KEC International", 9, [4.3, 3.7, 3.5, 3.5]),
    company("KPIL", "Kalpataru Projects International", 8, [4.2, 3.8, 3.6, 3.5]), company("NCC", "NCC", 8, [4.1, 3.9, 3.7, 3.6]),
    company("NBCC", "NBCC India", 7, [4.0, 3.6, 3.8, 3.7]), company("PNCINFRA", "PNC Infratech", 6, [3.5, 3.5, 3.6, 3.4]),
    company("KNRCON", "KNR Constructions", 6, [3.4, 3.8, 4.0, 3.9]), company("GRINFRA", "G R Infraprojects", 6, [3.6, 3.7, 3.8, 3.8]),
  ],
  auto: [
    company("M&M", "Mahindra & Mahindra", 26.0, [4.6, 4.4, 4.3, 4.4]), company("MARUTI", "Maruti Suzuki", 16.5, [4.2, 4.5, 4.4, 4.6]),
    company("BAJAJ-AUTO", "Bajaj Auto", 11.1, [4.1, 4.6, 4.5, 4.7]), company("EICHERMOT", "Eicher Motors", 9.4, [4.0, 4.5, 4.6, 4.5]),
    company("TMPV", "Tata Motors Passenger Vehicles", 7.9, [4.0, 3.9, 4.0, 3.6]), company("TVSMOTOR", "TVS Motor", 7.5, [4.5, 4.2, 4.1, 4.0]),
    company("MOTHERSON", "Samvardhana Motherson", 6.2, [4.3, 3.6, 3.5, 3.6]), company("HEROMOTOCO", "Hero MotoCorp", 6.1, [3.7, 4.0, 4.0, 4.2]),
    company("BHARATFORG", "Bharat Forge", 5.0, [4.0, 3.8, 3.7, 3.8]), company("ASHOKLEY", "Ashok Leyland", 4.3, [4.1, 3.8, 3.7, 3.7]),
  ],
  telecom: [
    company("BHARTIARTL", "Bharti Airtel", 32, [4.4, 4.6, 4.5, 4.5]), company("INDUSTOWER", "Indus Towers", 16, [4.0, 4.3, 4.4, 4.1]),
    company("BHARTIHEXA", "Bharti Hexacom", 11, [4.2, 4.1, 4.0, 4.0]), company("TATACOMM", "Tata Communications", 10, [3.8, 3.9, 3.7, 4.0]),
    company("IDEA", "Vodafone Idea", 9, [3.5, 1.8, 2.0, 1.5]), company("RAILTEL", "RailTel Corporation", 7, [4.1, 3.8, 3.9, 3.8]),
    company("TEJASNET", "Tejas Networks", 5, [4.4, 3.0, 2.9, 3.0]), company("HFCL", "HFCL", 4, [3.9, 3.1, 3.0, 3.1]),
    company("ROUTE", "Route Mobile", 4, [3.7, 3.5, 3.6, 3.6]), company("MTNL", "MTNL", 2, [2.2, 1.4, 1.5, 1.2]),
  ],
  banking: [
    company("HDFCBANK", "HDFC Bank", 26, [4.0, 4.5, 4.2, 4.7]), company("ICICIBANK", "ICICI Bank", 22, [4.3, 4.7, 4.5, 4.7]),
    company("SBIN", "State Bank of India", 16, [4.4, 4.4, 4.3, 4.3]), company("AXISBANK", "Axis Bank", 10, [4.0, 4.2, 4.0, 4.2]),
    company("KOTAKBANK", "Kotak Mahindra Bank", 8, [3.6, 4.1, 4.2, 4.5]), company("BANKBARODA", "Bank of Baroda", 6, [4.1, 4.0, 3.9, 3.9]),
    company("INDUSINDBK", "IndusInd Bank", 4, [3.0, 2.8, 2.7, 2.6]), company("FEDERALBNK", "Federal Bank", 3, [4.0, 3.9, 3.8, 4.0]),
    company("IDFCFIRSTB", "IDFC First Bank", 3, [4.5, 3.3, 3.2, 3.4]), company("AUBANK", "AU Small Finance Bank", 2, [4.2, 3.6, 3.5, 3.7]),
  ],
  nbfc: [
    company("BAJFINANCE", "Bajaj Finance", 24, [4.7, 4.7, 4.5, 4.6]), company("SHRIRAMFIN", "Shriram Finance", 17, [4.4, 4.5, 4.3, 4.2]),
    company("CHOLAFIN", "Cholamandalam Finance", 14, [4.6, 4.4, 4.2, 4.3]), company("PFC", "Power Finance Corporation", 10, [4.2, 4.5, 4.4, 4.1]),
    company("RECLTD", "REC", 9, [4.1, 4.4, 4.3, 4.0]), company("MUTHOOTFIN", "Muthoot Finance", 8, [4.0, 4.3, 4.2, 4.2]),
    company("POONAWALLA", "Poonawalla Fincorp", 5, [4.5, 3.5, 3.3, 3.5]), company("LICHSGFIN", "LIC Housing Finance", 5, [3.5, 3.8, 3.7, 3.9]),
    company("MANAPPURAM", "Manappuram Finance", 4, [3.6, 3.4, 3.2, 3.3]), company("IIFL", "IIFL Finance", 4, [3.8, 3.2, 3.1, 3.0]),
  ],
  fmcg: [
    company("HINDUNILVR", "Hindustan Unilever", 23, [3.8, 4.5, 4.6, 4.8]), company("ITC", "ITC", 21, [3.7, 4.7, 4.7, 4.8]),
    company("NESTLEIND", "Nestle India", 12, [3.9, 4.4, 4.5, 4.6]), company("VBL", "Varun Beverages", 11, [4.7, 4.4, 4.2, 4.1]),
    company("TATACONSUM", "Tata Consumer Products", 9, [4.3, 3.9, 3.8, 4.0]), company("BRITANNIA", "Britannia Industries", 8, [3.8, 4.3, 4.4, 4.4]),
    company("GODREJCP", "Godrej Consumer Products", 6, [4.1, 4.0, 4.1, 4.0]), company("DABUR", "Dabur India", 4, [3.5, 3.8, 4.0, 4.1]),
    company("MARICO", "Marico", 3, [3.9, 4.1, 4.3, 4.2]), company("COLPAL", "Colgate-Palmolive India", 3, [3.6, 4.5, 4.7, 4.6]),
  ],
  consumer: [
    company("TITAN", "Titan Company", 22, [4.3, 4.3, 4.1, 4.4]), company("TRENT", "Trent", 18, [4.9, 4.2, 4.0, 3.9]),
    company("ETERNAL", "Eternal", 15, [4.8, 3.5, 3.4, 3.7]), company("DMART", "Avenue Supermarts", 13, [4.1, 4.0, 4.2, 4.3]),
    company("INDHOTEL", "Indian Hotels", 8, [4.5, 4.3, 4.1, 4.1]), company("NYKAA", "FSN E-Commerce Ventures", 7, [4.4, 3.1, 3.0, 3.3]),
    company("JUBLFOOD", "Jubilant FoodWorks", 6, [3.8, 3.5, 3.4, 3.6]), company("DEVYANI", "Devyani International", 4, [4.0, 3.0, 2.9, 3.1]),
    company("PVRINOX", "PVR INOX", 4, [3.7, 2.8, 2.7, 3.0]), company("ABFRL", "Aditya Birla Fashion", 3, [3.4, 2.4, 2.3, 2.7]),
  ],
  energy: [
    company("RELIANCE", "Reliance Industries", 32, [4.1, 4.5, 4.4, 4.6]), company("ONGC", "Oil & Natural Gas Corporation", 15, [3.7, 4.4, 4.2, 4.2]),
    company("IOC", "Indian Oil Corporation", 11, [3.8, 3.9, 3.5, 4.0]), company("BPCL", "Bharat Petroleum", 10, [3.9, 4.0, 3.6, 4.0]),
    company("GAIL", "GAIL India", 9, [4.0, 4.2, 4.0, 4.2]), company("HINDPETRO", "Hindustan Petroleum", 7, [3.9, 3.8, 3.4, 3.7]),
    company("OIL", "Oil India", 5, [4.1, 4.3, 4.1, 4.0]), company("PETRONET", "Petronet LNG", 5, [3.6, 4.2, 4.3, 4.3]),
    company("IGL", "Indraprastha Gas", 3, [3.3, 4.0, 4.2, 4.1]), company("MGL", "Mahanagar Gas", 3, [3.2, 4.1, 4.3, 4.2]),
  ],
  metals: [
    company("TATASTEEL", "Tata Steel", 18, [3.6, 3.8, 3.5, 3.6]), company("JSWSTEEL", "JSW Steel", 16, [4.0, 4.2, 3.9, 3.7]),
    company("HINDALCO", "Hindalco Industries", 14, [3.8, 4.0, 3.8, 3.8]), company("COALINDIA", "Coal India", 13, [3.2, 4.3, 4.4, 4.2]),
    company("VEDL", "Vedanta", 10, [3.7, 3.6, 3.4, 3.2]), company("JINDALSTEL", "Jindal Steel", 9, [4.1, 4.0, 3.8, 3.5]),
    company("HINDZINC", "Hindustan Zinc", 7, [3.4, 4.2, 4.3, 4.0]), company("NMDC", "NMDC", 5, [3.3, 4.1, 4.2, 3.9]),
    company("SAIL", "Steel Authority of India", 4, [3.2, 3.3, 3.1, 3.2]), company("NATIONALUM", "National Aluminium", 4, [3.4, 3.7, 3.6, 3.5]),
  ],
  defence: [
    company("HAL", "Hindustan Aeronautics", 22, [4.6, 4.5, 4.3, 4.4]), company("BEL", "Bharat Electronics", 18, [4.5, 4.6, 4.4, 4.5]),
    company("MAZDOCK", "Mazagon Dock Shipbuilders", 12, [4.7, 4.4, 4.2, 4.1]), company("BDL", "Bharat Dynamics", 10, [4.4, 4.3, 4.1, 4.0]),
    company("COCHINSHIP", "Cochin Shipyard", 9, [4.3, 4.1, 3.9, 4.0]), company("GRSE", "Garden Reach Shipbuilders", 8, [4.2, 3.9, 3.8, 3.8]),
    company("DATAPATTNS", "Data Patterns", 7, [4.6, 4.0, 3.9, 3.7]), company("SOLARINDS", "Solar Industries", 6, [4.5, 4.4, 4.2, 4.0]),
    company("ZENTEC", "Zen Technologies", 4, [4.4, 3.8, 3.7, 3.6]), company("PARAS", "Paras Defence and Space", 4, [4.3, 3.6, 3.5, 3.4]),
  ],
};

export const fundamentalMetricLabels: Record<FundamentalMetricKey, string> = {
  growth: "Growth score",
  profitability: "Profitability score",
  margin: "Margin resilience",
  quality: "Balance-sheet quality",
};

export const sectorUniverseLabels: Record<string, string> = {
  it: "NIFTY IT",
  pharma: "NIFTY Pharma",
  power: "NIFTY 500 · Power industry",
  infrastructure: "NIFTY Infrastructure",
  auto: "NIFTY Auto",
  telecom: "NIFTY 500 · Telecom services",
  banking: "NIFTY Bank",
  nbfc: "NIFTY Financial Services Ex-Bank",
  fmcg: "NIFTY FMCG",
  consumer: "NIFTY India Consumption",
  energy: "NIFTY Oil & Gas",
  metals: "NIFTY Metal",
  defence: "NSE · Defence & Aerospace research universe",
};
