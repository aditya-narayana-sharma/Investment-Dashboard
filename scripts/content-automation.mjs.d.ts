export function classifyNewsletterSentiment(value: string): "Positive" | "Neutral" | "Negative";

export function classifyAxisTags(value: string): {
  sector: string[];
  thesis: string[];
  conviction: string[];
};
