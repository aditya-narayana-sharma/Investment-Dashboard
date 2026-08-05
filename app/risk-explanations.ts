export type RiskScoreBand = "lower" | "moderate" | "elevated";

export type RiskAxisExplanation = {
  axis: string;
  score: number;
  band: RiskScoreBand;
  text: string;
};

export type RiskExplanation = {
  profileLabel: string;
  overview: string[];
  axes: RiskAxisExplanation[];
};

type RiskExplanationProfile = {
  symbol: string;
  name: string;
  scores: readonly number[];
};

const riskAxisMeanings: Record<string, string> = {
  Valuation: "monitors how demanding market pricing is relative to fundamentals and expectations",
  Sector: "monitors exposure to industry-cycle, policy, and competitive pressures",
  Liquidity: "monitors how easily the holding can be traded without material price impact",
  Volatility: "monitors the size and frequency of price swings",
  Event: "monitors sensitivity to results, regulation, macro, and company-specific catalysts",
  Leverage: "monitors balance-sheet and financing sensitivity to debt and interest rates",
};

export function riskScoreBand(score: number): RiskScoreBand {
  if (score <= 2) return "lower";
  if (score >= 4) return "elevated";
  return "moderate";
}

function formatAxisList(axes: string[]): string {
  if (axes.length < 2) return axes[0] ?? "";
  if (axes.length === 2) return `${axes[0]} and ${axes[1]}`;
  return `${axes.slice(0, -1).join(", ")}, and ${axes.at(-1)}`;
}

export function buildRiskExplanation(
  profile: RiskExplanationProfile,
  axes: readonly string[],
): RiskExplanation {
  const dimensions = axes.map((axis, index) => {
    const score = profile.scores[index];
    const band = riskScoreBand(score);
    const meaning = riskAxisMeanings[axis] ?? `monitors the holding's ${axis.toLowerCase()} risk exposure`;
    return {
      axis,
      score,
      band,
      text: `${axis} — ${score}/5, ${band}: ${meaning}.`,
    };
  });
  const highestScore = Math.max(...dimensions.map((item) => item.score));
  const lowestScore = Math.min(...dimensions.map((item) => item.score));
  const highestAxes = dimensions.filter((item) => item.score === highestScore).map((item) => item.axis);
  const lowestAxes = dimensions.filter((item) => item.score === lowestScore).map((item) => item.axis);
  const profileLabel = `${profile.name} (${profile.symbol})`;
  const overview = highestScore === lowestScore
    ? [`All displayed dimensions for ${profileLabel} are tied at ${highestScore}/5 (${riskScoreBand(highestScore)}); there is no single highest or lowest dimension.`]
    : [
        `${profileLabel} has its highest monitoring score${highestAxes.length === 1 ? "" : "s"} in ${formatAxisList(highestAxes)}: ${highestScore}/5 (${riskScoreBand(highestScore)}).`,
        `${profileLabel} has its lowest monitoring score${lowestAxes.length === 1 ? "" : "s"} in ${formatAxisList(lowestAxes)}: ${lowestScore}/5 (${riskScoreBand(lowestScore)}), the comparatively more protective dimension${lowestAxes.length === 1 ? "" : "s"} in this profile.`,
      ];

  return { profileLabel, overview, axes: dimensions };
}
