import type { SectorNewsItem, SectorNewsSentiment, SectorNewsSourceId } from "./sector-news-types";

/**
 * Scored sentiment and per-sector composites for the news pipeline.
 *
 * The previous classifier counted regex hits in two arrays and returned
 * Positive/Neutral/Negative on a +/-1 margin. Three values carry no magnitude and
 * no confidence, so they cannot be aggregated into a sector score without
 * inventing weight. This module keeps the same vocabulary for display but adds
 * the two things a composite needs: a signed magnitude and a confidence.
 *
 * Everything here is deterministic. An optional LLM re-rank can refine ordering
 * later, but the numbers below never depend on a model being available.
 */

/** Weighted cues. Stronger words move the score further. */
const POSITIVE_CUES: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(?:surge|surges|soar|soars|crash(?:es)? higher|record high)\b/i, weight: 3 },
  { pattern: /\b(?:rally|rallies|jump|jumps|beat|beats|upgrade|upgrades|outperform)\b/i, weight: 2 },
  { pattern: /\b(?:gain|gains|rise|rises|bullish|optimism|recover|recovers)\b/i, weight: 1 },
  { pattern: /\b(?:strong growth|better.?than.?expected|raises guidance|profit jumps|order win)\b/i, weight: 3 },
];

const NEGATIVE_CUES: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(?:crash|crashes|slump|slumps|plunge|plunges|record low|default|fraud)\b/i, weight: 3 },
  { pattern: /\b(?:sell.?off|downgrade|downgrades|miss(?:es)? estimates|cuts guidance)\b/i, weight: 2 },
  { pattern: /\b(?:fall|falls|drop|drops|decline|declines|bearish|warning|loss|losses|weak demand)\b/i, weight: 1 },
  { pattern: /\b(?:profit falls|probe|penalt(?:y|ies)|downtrend)\b/i, weight: 2 },
];

/** Hedges reduce confidence without flipping direction. */
const HEDGES = /\b(?:may|might|could|likely|expected to|reportedly|rumou?r|speculat)\w*\b/i;

export type ScoredSentiment = {
  label: SectorNewsSentiment;
  /** Signed magnitude in [-1, 1]. */
  score: number;
  /** [0, 1]. Low when cues are sparse, contradictory, or hedged. */
  confidence: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreSentiment(value: string): ScoredSentiment {
  const text = String(value ?? "").normalize("NFKC");
  let positive = 0;
  let negative = 0;
  let hits = 0;
  for (const cue of POSITIVE_CUES) {
    if (cue.pattern.test(text)) { positive += cue.weight; hits += 1; }
  }
  for (const cue of NEGATIVE_CUES) {
    if (cue.pattern.test(text)) { negative += cue.weight; hits += 1; }
  }

  const total = positive + negative;
  if (total === 0) return { label: "Neutral", score: 0, confidence: 0 };

  // Normalise by total weight so a 3-vs-0 headline scores higher than 1-vs-0.
  const score = clamp((positive - negative) / total, -1, 1);

  // Confidence rises with corroborating cues, falls when both sides fire.
  const agreement = Math.abs(positive - negative) / total;
  let confidence = clamp(agreement * (1 - 1 / (1 + hits)), 0, 1);
  if (HEDGES.test(text)) confidence *= 0.6;

  const label: SectorNewsSentiment = score > 0.15 ? "Positive" : score < -0.15 ? "Negative" : "Neutral";
  return { label, score: Math.round(score * 1000) / 1000, confidence: Math.round(confidence * 1000) / 1000 };
}

/**
 * Vendor weights. Primary-market wires outrank aggregated search results,
 * because a Google-News-sourced row is a syndication of something else.
 */
export const SOURCE_WEIGHTS: Record<SectorNewsSourceId, number> = {
  economic_times: 1,
  financial_times: 1,
  bloomberg: 1,
  ndtv_profit: 0.9,
  zerodha: 0.8,
  moneycontrol: 0.7,
};

/** Half-life decay: a 7-day-old headline carries half the weight of today's. */
export const RECENCY_HALF_LIFE_DAYS = 7;

export function recencyWeight(publishedAt: string | null, now: number): number {
  if (!publishedAt) return 0.5;
  const stamp = Date.parse(publishedAt);
  if (!Number.isFinite(stamp)) return 0.5;
  const ageDays = Math.max(0, (now - stamp) / 86_400_000);
  return 2 ** (-ageDays / RECENCY_HALF_LIFE_DAYS);
}

export type SectorNewsComposite = {
  sectorId: string;
  /** Weighted mean sentiment in [-1, 1], or null when nothing qualifies. */
  score: number | null;
  itemCount: number;
  /** Sum of applied weights; low totals mean a thin, low-trust read. */
  weightTotal: number;
  /** The decomposition, so the number is never presented bare. */
  contributors: Array<{
    id: string;
    title: string;
    sourceLabel: string;
    sentiment: number;
    confidence: number;
    recency: number;
    sourceWeight: number;
    weight: number;
  }>;
};

export type ScoredNewsItem = SectorNewsItem & { sentimentScore?: number; sentimentConfidence?: number };

/**
 * Composite = sum(sentiment x weight) / sum(weight), where
 * weight = confidence x recency x sourceWeight.
 *
 * An item with zero confidence contributes nothing rather than dragging the
 * mean toward zero, so a pile of unclassifiable headlines cannot manufacture a
 * neutral reading.
 */
export function sectorNewsComposite(
  sectorId: string,
  items: readonly ScoredNewsItem[],
  now: number = Date.now(),
): SectorNewsComposite {
  const relevant = items.filter((item) => item.sectorIds.includes(sectorId));
  const contributors: SectorNewsComposite["contributors"] = [];
  let weighted = 0;
  let weightTotal = 0;

  for (const item of relevant) {
    const scored = typeof item.sentimentScore === "number" && typeof item.sentimentConfidence === "number"
      ? { score: item.sentimentScore, confidence: item.sentimentConfidence }
      : scoreSentiment(`${item.title} ${item.summary}`);
    const recency = recencyWeight(item.publishedAt, now);
    const sourceWeight = SOURCE_WEIGHTS[item.sourceId] ?? 0.5;
    const weight = scored.confidence * recency * sourceWeight;
    if (weight <= 0) continue;
    weighted += scored.score * weight;
    weightTotal += weight;
    contributors.push({
      id: item.id,
      title: item.title,
      sourceLabel: item.sourceLabel,
      sentiment: scored.score,
      confidence: scored.confidence,
      recency: Math.round(recency * 1000) / 1000,
      sourceWeight,
      weight: Math.round(weight * 1000) / 1000,
    });
  }

  contributors.sort((left, right) => right.weight - left.weight);

  return {
    sectorId,
    score: weightTotal > 0 ? Math.round((weighted / weightTotal) * 1000) / 1000 : null,
    itemCount: relevant.length,
    weightTotal: Math.round(weightTotal * 1000) / 1000,
    contributors,
  };
}
