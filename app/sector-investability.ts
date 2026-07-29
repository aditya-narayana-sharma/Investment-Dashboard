import type { SectorCompany } from "./sector-company-data";
import type { SectorView } from "./sector-data";
import type { SectorMarketSnapshot } from "./sector-live-types";

export type InvestabilityFactorId =
  | "growth"
  | "earnings"
  | "valuation"
  | "macro"
  | "momentum"
  | "balance";

export type InvestabilityFactor = {
  id: InvestabilityFactorId;
  axis: string;
  score: number | null;
  basis: string;
};

const clampScore = (value: number) => Math.min(5, Math.max(1, value));
const roundedScore = (value: number) => Number(clampScore(value).toFixed(1));

function weightedCompanyScore(
  companies: SectorCompany[],
  selector: (company: SectorCompany) => number,
) {
  const totalWeight = companies.reduce((total, company) => total + company.universeShare, 0);
  if (!companies.length || totalWeight <= 0) return null;
  return companies.reduce(
    (total, company) => total + selector(company) * company.universeShare,
    0,
  ) / totalWeight;
}

function breadthMomentumScore(snapshot: SectorMarketSnapshot | undefined) {
  const returns = snapshot?.companies
    .map((company) => company.returns.month)
    .filter((value): value is number => value !== null) ?? [];
  if (!returns.length) return null;

  const advancingShare = returns.filter((value) => value > 0).length / returns.length;
  const averageReturn = returns.reduce((total, value) => total + value, 0) / returns.length;
  const breadthScore = 1 + advancingShare * 4;
  const priceMomentumScore = clampScore(3 + averageReturn / 5);

  return {
    score: roundedScore(breadthScore * 0.6 + priceMomentumScore * 0.4),
    basis: `${returns.filter((value) => value > 0).length}/${returns.length} constituents advancing; ${averageReturn >= 0 ? "+" : ""}${averageReturn.toFixed(1)}% average 1M return`,
  };
}

export function buildInvestabilityFactors(
  sector: SectorView,
  companies: SectorCompany[],
  market: SectorMarketSnapshot | undefined,
): InvestabilityFactor[] {
  const companyGrowth = weightedCompanyScore(companies, (company) => company.scores.growth);
  const companyProfitability = weightedCompanyScore(companies, (company) => company.scores.profitability);
  const companyMargin = weightedCompanyScore(companies, (company) => company.scores.margin);
  const companyQuality = weightedCompanyScore(companies, (company) => company.scores.quality);
  const breadthMomentum = breadthMomentumScore(market);

  return [
    {
      id: "growth",
      axis: "Growth",
      score: roundedScore(
        sector.scores.demand * 0.55
        + (companyGrowth ?? sector.scores.demand) * 0.45,
      ),
      basis: "55% sector demand score + 45% constituent growth score",
    },
    {
      id: "earnings",
      axis: "Earnings delivery",
      score: roundedScore(
        sector.scores.earnings * 0.55
        + (companyProfitability ?? sector.scores.earnings) * 0.25
        + (companyMargin ?? sector.scores.earnings) * 0.2,
      ),
      basis: "55% sector earnings + 25% constituent profitability + 20% margin resilience",
    },
    {
      id: "valuation",
      axis: "Valuation support",
      score: roundedScore(sector.scores.valuation),
      basis: "Sector valuation room versus growth, execution risk and current expectations",
    },
    {
      id: "macro",
      axis: "Macro resilience",
      score: roundedScore(
        sector.scores.policy * 0.4
        + sector.scores.cost * 0.35
        + sector.scores.demand * 0.25,
      ),
      basis: "40% policy support + 35% cost position + 25% demand durability",
    },
    {
      id: "momentum",
      axis: "Breadth / momentum",
      score: breadthMomentum?.score ?? null,
      basis: breadthMomentum?.basis ?? "Unavailable until constituent 1M returns are refreshed",
    },
    {
      id: "balance",
      axis: "Balance-sheet / execution",
      score: companyQuality === null
        ? null
        : roundedScore(companyQuality * 0.65 + (companyMargin ?? companyQuality) * 0.35),
      basis: "65% constituent balance-sheet quality + 35% margin resilience, universe-weighted",
    },
  ];
}

export function investabilityComposite(factors: InvestabilityFactor[]) {
  const available = factors
    .map((factor) => factor.score)
    .filter((score): score is number => score !== null);
  return available.length
    ? Number((available.reduce((total, score) => total + score, 0) / available.length).toFixed(1))
    : null;
}

export function factorMedian(
  sectorFactors: InvestabilityFactor[][],
  factorId: InvestabilityFactorId,
) {
  const values = sectorFactors
    .map((factors) => factors.find((factor) => factor.id === factorId)?.score ?? null)
    .filter((score): score is number => score !== null)
    .sort((left, right) => left - right);
  if (!values.length) return null;

  const middle = Math.floor(values.length / 2);
  const median = values.length % 2
    ? values[middle]!
    : (values[middle - 1]! + values[middle]!) / 2;
  return Number(median.toFixed(1));
}
