export type ImpactSignal = "tailwind" | "headwind" | "two-way" | "na";

export type SectorImpactRow = {
  id: string;
  name: string;
  stance: string;
  color: string;
  subsectors: string[];
  crude: ImpactSignal;
  inr: ImpactSignal;
  rates: ImpactSignal;
  monsoon: ImpactSignal;
  aiCapex: ImpactSignal;
  earnings: ImpactSignal;
  read: string;
};

export const sectorImpactRows: SectorImpactRow[] = [
  { id: "it", name: "IT / Tech", stance: "Constructive", color: "#4c8fff", subsectors: ["Services", "ER&D", "Product / SaaS", "Platforms"], crude: "two-way", inr: "tailwind", rates: "two-way", monsoon: "na", aiCapex: "tailwind", earnings: "tailwind", read: "AI-led deal conversion and margin execution matter more than broad demand commentary." },
  { id: "banking", name: "Banking / BFSI", stance: "Two-way", color: "#42c878", subsectors: ["Private banks", "PSU banks", "SFB / MFI", "NBFC", "Insurance"], crude: "headwind", inr: "two-way", rates: "two-way", monsoon: "two-way", aiCapex: "two-way", earnings: "tailwind", read: "Deposit growth, NIM, credit cost and liability quality separate leaders from the index." },
  { id: "auto", name: "Auto", stance: "Two-way", color: "#64b5ff", subsectors: ["PV", "2W", "CV", "Parts", "EV", "Tractors"], crude: "headwind", inr: "two-way", rates: "two-way", monsoon: "tailwind", aiCapex: "two-way", earnings: "tailwind", read: "Volumes are firm; discounts, EV economics and commodity pass-through decide margins." },
  { id: "pharma", name: "Pharma / Healthcare", stance: "Constructive", color: "#52d6a3", subsectors: ["US generics", "Domestic branded", "CDMO / CRAMS", "Hospitals", "Diagnostics"], crude: "two-way", inr: "tailwind", rates: "two-way", monsoon: "na", aiCapex: "two-way", earnings: "tailwind", read: "Defensive demand and export FX help; USFDA and valuation remain the binding risks." },
  { id: "fmcg", name: "FMCG / Consumer", stance: "Pressured", color: "#f58fd2", subsectors: ["Staples", "Discretionary", "QSR", "Beverages"], crude: "headwind", inr: "headwind", rates: "tailwind", monsoon: "headwind", aiCapex: "two-way", earnings: "headwind", read: "Rural recovery helps volumes, while input costs and premium valuations limit rerating." },
  { id: "energy", name: "Energy / Oil & Gas", stance: "Two-way", color: "#f3a83b", subsectors: ["Upstream E&P", "Refining", "OMC", "Gas", "Renewable fuels"], crude: "tailwind", inr: "tailwind", rates: "two-way", monsoon: "two-way", aiCapex: "two-way", earnings: "two-way", read: "High crude supports upstream but compresses OMC marketing and India macro conditions." },
  { id: "power", name: "Power / Utilities", stance: "Two-way", color: "#ffd166", subsectors: ["Thermal", "Renewables", "Transmission", "Exchanges", "Equipment"], crude: "two-way", inr: "headwind", rates: "tailwind", monsoon: "tailwind", aiCapex: "tailwind", earnings: "two-way", read: "Demand and grid capex support growth; leverage, COD timing and receivables decide quality." },
  { id: "telecom", name: "Telecom", stance: "Constructive", color: "#b794f6", subsectors: ["Wireless", "Broadband", "Towers", "Enterprise", "Data centres"], crude: "two-way", inr: "headwind", rates: "two-way", monsoon: "na", aiCapex: "tailwind", earnings: "two-way", read: "Tariff repair and ARPU are supportive; fixed debt and spectrum liabilities remain key." },
  { id: "metals", name: "Metals & Mining", stance: "Two-way", color: "#9aa6b2", subsectors: ["Steel", "Aluminium", "Mining", "Speciality", "Recycling"], crude: "headwind", inr: "tailwind", rates: "two-way", monsoon: "headwind", aiCapex: "two-way", earnings: "two-way", read: "China demand, spreads, safeguard policy and input inflation drive the cycle." },
  { id: "infrastructure", name: "Realty / Infra", stance: "Constructive", color: "#ff9f6e", subsectors: ["Residential", "Commercial", "Roads", "EPC", "Cement"], crude: "headwind", inr: "headwind", rates: "tailwind", monsoon: "headwind", aiCapex: "two-way", earnings: "two-way", read: "Order books are strong; rates, working capital and execution govern cash conversion." },
  { id: "consumer", name: "Consumer Tech", stance: "Two-way", color: "#ff7b87", subsectors: ["Food delivery", "Q-commerce", "Fintech", "E-commerce", "Gaming"], crude: "two-way", inr: "two-way", rates: "two-way", monsoon: "two-way", aiCapex: "two-way", earnings: "tailwind", read: "Growth remains high; profitability, retention and rich multiples determine durability." },
  { id: "defence", name: "Defence & Aerospace", stance: "Constructive", color: "#e76f51", subsectors: ["Aerospace", "Electronics", "Shipbuilding", "Missiles", "Drones / Space"], crude: "na", inr: "two-way", rates: "two-way", monsoon: "na", aiCapex: "tailwind", earnings: "tailwind", read: "Order visibility and indigenisation support the cycle; delivery schedules and valuation remain the binding risks." },
];

export const lifeCyclePoints = [
  { id: "defence", name: "Drones / Space", stage: 1.1, growth: 42, profit: 22, color: "#e76f51" },
  { id: "defence", name: "Defence electronics", stage: 1.6, growth: 24, profit: 36, color: "#e76f51" },
  { id: "power", name: "Renewables", stage: 1.8, growth: 27, profit: 34, color: "#ffd166" },
  { id: "auto", name: "EV", stage: 2.0, growth: 33, profit: 25, color: "#64b5ff" },
  { id: "consumer", name: "Q-commerce", stage: 2.2, growth: 40, profit: 27, color: "#ff7b87" },
  { id: "banking", name: "Fintech lending", stage: 2.8, growth: 18, profit: 29, color: "#42c878" },
  { id: "it", name: "IT services", stage: 3.4, growth: 9, profit: 44, color: "#4c8fff" },
  { id: "banking", name: "Private banking", stage: 3.7, growth: 13, profit: 48, color: "#42c878" },
  { id: "telecom", name: "Wireless", stage: 4.0, growth: 11, profit: 50, color: "#b794f6" },
  { id: "pharma", name: "Branded pharma", stage: 3.1, growth: 12, profit: 38, color: "#52d6a3" },
  { id: "fmcg", name: "Staples", stage: 4.2, growth: 7, profit: 42, color: "#f58fd2" },
  { id: "energy", name: "Legacy oil", stage: 4.8, growth: -2, profit: 46, color: "#f3a83b" },
];

export const marketStructurePoints = [
  { id: "it", name: "IT Services", margin: 13, concentration: 4.5, profit: 44, color: "#4c8fff" },
  { id: "banking", name: "Private Banks", margin: 16, concentration: 4.2, profit: 48, color: "#42c878" },
  { id: "auto", name: "Auto OEM", margin: 12, concentration: 4.5, profit: 38, color: "#64b5ff" },
  { id: "pharma", name: "Pharma", margin: 22, concentration: 2.7, profit: 38, color: "#52d6a3" },
  { id: "fmcg", name: "FMCG", margin: 22, concentration: 4.3, profit: 42, color: "#f58fd2" },
  { id: "energy", name: "OMC / Refining", margin: 4, concentration: 4.4, profit: 46, color: "#f3a83b" },
  { id: "power", name: "Power", margin: 15, concentration: 3.4, profit: 34, color: "#ffd166" },
  { id: "telecom", name: "Telecom", margin: 49, concentration: 4.8, profit: 50, color: "#b794f6" },
  { id: "infrastructure", name: "Infra EPC", margin: 10, concentration: 2.4, profit: 31, color: "#ff9f6e" },
  { id: "defence", name: "Defence OEMs", margin: 18, concentration: 3.8, profit: 36, color: "#e76f51" },
];

export const macroDials = [
  { name: "Brent", value: 88.4, min: 65, max: 105, trigger: 90, unit: "$", tone: "amber" },
  { name: "USD / INR", value: 96.43, min: 93, max: 102, trigger: 97, unit: "", tone: "amber" },
  { name: "Nifty", value: 24186, min: 23000, max: 25500, trigger: 24300, unit: "", tone: "amber" },
  { name: "Bank Nifty", value: 57310, min: 54000, max: 60000, trigger: 57843, unit: "", tone: "green" },
  { name: "India VIX", value: 15.8, min: 10, max: 25, trigger: 18, unit: "", tone: "green" },
];

export const squeezeWidths = [
  { name: "Nifty", value: 0.83, color: "#42c878" }, { name: "Bank Nifty", value: 1.83, color: "#4c8fff" },
  { name: "ETERNAL", value: 4.2, color: "#ff6b72" }, { name: "AXISBANK", value: 3.1, color: "#ff6b72" },
  { name: "ICICIBANK", value: 1.2, color: "#4c8fff" },
];
