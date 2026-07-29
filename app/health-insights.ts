import type { AppleNoteSnapshot, ContentSourceState } from "./content-types";
import type { HealthMetric, HealthTone } from "./health-data";
import type { HealthActionSnapshot, HealthCategorySnapshot, HealthLiveSnapshot, HealthSourceSnapshot } from "./health-live-types";

export type HealthInsight = HealthActionSnapshot & {
  evidence: string;
};

const HIGHER_IS_FAVOURABLE = new Set([
  "Active energy", "Exercise minutes", "Stand", "Stand time", "Steps", "Walking + running", "Stairs climbed",
  "Time asleep", "Deep sleep", "REM sleep", "Core sleep", "Cardio fitness", "Walking speed", "Step length",
  "Protein", "Fibre", "Potassium", "Water", "HRV",
]);

const LOWER_IS_FAVOURABLE = new Set([
  "Resting heart rate", "Walking asymmetry", "Double support", "Awake", "Sodium", "Sugar", "Saturated fat",
]);

const PRIORITY_LABELS = [
  "Active energy", "Steps", "Exercise minutes", "Time asleep", "Deep sleep", "REM sleep",
  "Resting heart rate", "HRV", "Cardio fitness", "Dietary energy", "Protein", "Fibre", "Water",
  "Walking asymmetry", "Blood oxygen",
];

const SECONDARY_SOURCES = [
  {
    source: "Livity",
    detail: "iPhone Mirroring / Livity was not available in this agent session. No Livity values were read for the operational target.",
  },
  {
    source: "Lifesum",
    detail: "Lifesum was not verified through iPhone Mirroring for the current operational target.",
  },
  {
    source: "Guava",
    detail: "Guava was not verified through iPhone Mirroring for the current operational target.",
  },
  {
    source: "iPhone Mirroring",
    detail: "Computer Use / iPhone Mirroring was unavailable; HealthKit export and  Health Daily remain the only evidence for this session.",
  },
] as const;

function compactHealthDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function healthTrendTone(metric: HealthMetric, direction: "up" | "down" | "same") {
  if (direction === "same") return "moderate";
  if (HIGHER_IS_FAVOURABLE.has(metric.label)) return direction === "up" ? "good" : "bad";
  if (LOWER_IS_FAVOURABLE.has(metric.label)) return direction === "down" ? "good" : "bad";
  return "moderate";
}

function parseDeltaPercent(delta?: string) {
  if (!delta) return null;
  const match = delta.replace(/,/g, "").match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function insightTone(label: string, direction: "up" | "down" | "same"): HealthTone {
  if (direction === "same") return "blue";
  if (HIGHER_IS_FAVOURABLE.has(label)) return direction === "up" ? "green" : "amber";
  if (LOWER_IS_FAVOURABLE.has(label)) return direction === "down" ? "green" : "amber";
  return "blue";
}

function metricInsight(category: HealthCategorySnapshot, dataDate: string): HealthInsight[] {
  const insights: HealthInsight[] = [];
  const ranked = [...category.metrics].sort((left, right) => {
    const leftRank = PRIORITY_LABELS.indexOf(left.label);
    const rightRank = PRIORITY_LABELS.indexOf(right.label);
    return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
  });

  for (const metric of ranked) {
    const weekly = metric.averages?.weekly;
    if (!weekly?.direction || weekly.direction === "same") continue;
    const deltaPct = parseDeltaPercent(weekly.delta);
    if (deltaPct == null || Math.abs(deltaPct) < 8) continue;
    const tone = insightTone(metric.label, weekly.direction);
    const trend = healthTrendTone(metric, weekly.direction);
    const qualifier = trend === "good" ? "favourable vs 7-day" : trend === "bad" ? "weaker vs 7-day" : "changed vs 7-day";
    insights.push({
      tone,
      title: `${category.name}: ${metric.label}`,
      text: `${compactHealthDate(dataDate)} recorded ${metric.value} (${weekly.delta ?? weekly.direction} vs 7-day average ${weekly.value}). Treat as ${qualifier}; this is a wellness signal, not a diagnosis.`,
      evidence: `${category.name} · HealthKit`,
    });
    if (insights.length >= 2) break;
  }
  return insights;
}

function nutritionIncompleteInsight(categories: HealthCategorySnapshot[], dataDate: string): HealthInsight | null {
  const nutrition = categories.find((item) => item.name === "Nutrition");
  const energy = nutrition?.metrics.find((metric) => metric.label === "Dietary energy");
  if (!energy) return null;
  const weekly = energy.averages?.weekly;
  const deltaPct = parseDeltaPercent(weekly?.delta);
  if (deltaPct == null || deltaPct > -25) return null;
  return {
    tone: "amber",
    title: "Nutrition log is incomplete by definition",
    text: `${compactHealthDate(dataDate)} logged dietary energy ${energy.value}${weekly ? ` versus 7-day average ${weekly.value} (${weekly.delta})` : ""}. Logged nutrition is not verified total intake.`,
    evidence: "Nutrition · HealthKit",
  };
}

function noteDateGapInsight(
  healthNote: AppleNoteSnapshot | null,
  healthNoteSource: ContentSourceState | null | undefined,
  operationalDate: string,
): HealthInsight | null {
  if (!healthNoteSource || healthNoteSource.status === "error" || healthNoteSource.status === "permission_required" || healthNoteSource.status === "stale") {
    return {
      tone: "amber",
      title: " Health Daily note unavailable",
      text: "The exact  Health Daily note could not be read. Guidance below uses validated HealthKit aggregates only.",
      evidence: " Health Daily",
    };
  }
  const observed = healthNote?.observedDate || healthNote?.modifiedAt?.slice(0, 10) || "";
  if (!healthNote?.dailyOptimism?.trim() && observed && observed < operationalDate) {
    return {
      tone: "amber",
      title: "Daily Optimism missing for operational target",
      text: ` Health Daily was last observed on ${compactHealthDate(observed)}; operational Health target is ${compactHealthDate(operationalDate)}. No Daily Optimism section was present — shortcut stats below are evidence only.`,
      evidence: " Health Daily",
    };
  }
  if (!healthNote?.dailyOptimism?.trim()) {
    return {
      tone: "blue",
      title: "No Daily Optimism section",
      text: "The exact  Health Daily note is readable but has no Daily Optimism text. Metric insights remain HealthKit-derived.",
      evidence: " Health Daily",
    };
  }
  return null;
}

/** Parse label/value pairs already present in the  Health Daily summary — never invents values. */
export function parseHealthDailyNoteStats(summary: string | null | undefined): Array<{ label: string; value: string }> {
  if (!summary?.trim()) return [];
  const cleaned = summary
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pairs: Array<{ label: string; value: string }> = [];
  const pattern = /([A-Za-z][A-Za-z +/%-]{1,40}?)\s*[-–:]\s*([0-9][0-9,.]*(?:\s*(?:kcal|g|mg|ml|L|km|min|hr|bpm|ms|%|METs|floors?))?)/g;
  for (const match of cleaned.matchAll(pattern)) {
    const label = match[1]!.trim().replace(/\s+/g, " ");
    const value = match[2]!.trim();
    if (!label || !value) continue;
    if (pairs.some((item) => item.label.toLowerCase() === label.toLowerCase())) continue;
    pairs.push({ label, value });
    if (pairs.length >= 12) break;
  }
  return pairs;
}

export function buildHealthInsights(
  healthSnapshot: HealthLiveSnapshot,
  healthNote: AppleNoteSnapshot | null = null,
  healthNoteSource: ContentSourceState | null = null,
): HealthInsight[] {
  const dataDate = healthSnapshot.dataDate;
  const operationalDate = healthSnapshot.requiredThrough ?? healthSnapshot.targetDate ?? dataDate;
  const insights: HealthInsight[] = [];

  const gap = noteDateGapInsight(healthNote, healthNoteSource, operationalDate);
  if (gap) insights.push(gap);

  const nutrition = nutritionIncompleteInsight(healthSnapshot.categories, dataDate);
  if (nutrition) insights.push(nutrition);

  for (const category of healthSnapshot.categories) {
    insights.push(...metricInsight(category, dataDate));
  }

  if (healthSnapshot.missingDates?.length) {
    insights.unshift({
      tone: "amber",
      title: "Operational-day coverage gap",
      text: `Missing source dates: ${healthSnapshot.missingDates.map(compactHealthDate).join(", ")}.`,
      evidence: "HealthKit coverage",
    });
  }

  const seen = new Set<string>();
  return insights.filter((item) => {
    const key = `${item.title}|${item.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

export function enrichHealthGuidanceActions(
  healthSnapshot: HealthLiveSnapshot,
  healthNote: AppleNoteSnapshot | null = null,
  healthNoteSource: ContentSourceState | null = null,
): HealthActionSnapshot[] {
  const derived = buildHealthInsights(healthSnapshot, healthNote, healthNoteSource).map(({ tone, title, text }) => ({ tone, title, text }));
  const existing = healthSnapshot.actions ?? [];
  const genericTitles = new Set([
    "Operational-day coverage",
    "Partial export-day isolation",
    "Trend interpretation",
  ]);
  const retainedOperational = existing.filter((item) => !genericTitles.has(item.title) || derived.length === 0);
  const merged = [...derived];
  for (const item of retainedOperational) {
    if (!merged.some((candidate) => candidate.title === item.title)) merged.push(item);
  }
  for (const item of existing.filter((entry) => genericTitles.has(entry.title))) {
    if (merged.length >= 8) break;
    if (!merged.some((candidate) => candidate.title === item.title)) merged.push(item);
  }
  return merged.slice(0, 10);
}

export function enrichHealthSources(healthSnapshot: HealthLiveSnapshot): HealthSourceSnapshot[] {
  const sources = [...(healthSnapshot.sources ?? [])];
  const present = new Set(sources.map((item) => item.source.toLowerCase()));
  for (const secondary of SECONDARY_SOURCES) {
    if ([...present].some((name) => name.includes(secondary.source.toLowerCase()))) continue;
    sources.push({
      source: secondary.source,
      status: "Unavailable",
      detail: secondary.detail,
      tone: "amber",
    });
  }
  const notePresent = sources.some((item) => item.source.includes("Health Daily"));
  if (!notePresent) {
    sources.push({
      source: " Health Daily Note",
      status: "Separate content source",
      detail: "Optimism and shortcut stats are read from the exact  Health Daily note via the content digest, not from the HealthKit ZIP.",
      tone: "blue",
    });
  }
  return sources;
}
