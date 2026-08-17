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
    detail: "Computer Use / iPhone Mirroring was unavailable; HealthKit export and Health Shortcut / Health Stats remain the only evidence for this session.",
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

function findHealthMetric(categories: HealthCategorySnapshot[], categoryName: string, metricLabel: string) {
  return categories.find((category) => category.name === categoryName)?.metrics.find((metric) => metric.label === metricLabel);
}

function firstNumericValue(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function durationHours(value: string) {
  const hours = value.match(/(\d+(?:\.\d+)?)\s*h(?:r)?/i);
  const minutes = value.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/i);
  if (!hours && !minutes) return null;
  return Number(hours?.[1] ?? 0) + Number(minutes?.[1] ?? 0) / 60;
}

function metricVsWeekly(metric: HealthMetric) {
  const weekly = metric.averages?.weekly;
  return `${metric.value}${weekly ? ` vs ${weekly.value} 7-day average${weekly.delta ? ` (${weekly.delta})` : ""}` : ""}`;
}

/**
 * Build a short decision brief from validated aggregates. This intentionally
 * avoids treating every numerical change as good or bad and never upgrades a
 * logged nutrition value, range, or wearable estimate into a diagnosis.
 */
export function buildDailyHealthBrief(healthSnapshot: HealthLiveSnapshot): HealthActionSnapshot[] {
  const { categories, dataDate } = healthSnapshot;
  const brief: HealthActionSnapshot[] = [];

  if (healthSnapshot.missingDates?.length) {
    brief.push({
      tone: "red",
      title: "Refresh the missing Health days first",
      text: `The operational record is missing ${healthSnapshot.missingDates.map(compactHealthDate).join(", ")}. Do not act on trend comparisons until coverage is complete.`,
    });
  }

  const bloodOxygen = findHealthMetric(categories, "Respiratory", "Blood oxygen");
  const bloodOxygenLow = bloodOxygen ? firstNumericValue(bloodOxygen.value) : null;
  if (bloodOxygen && bloodOxygenLow != null && bloodOxygenLow < 92) {
    brief.push({
      tone: "red",
      title: "Recheck the low blood-oxygen reading",
      text: `${compactHealthDate(dataDate)} includes a wearable blood-oxygen range of ${bloodOxygen.value}. Wearable readings can be inaccurate; recheck an unexpected low and seek medical guidance if it repeats or accompanies breathing difficulty, chest pain or worsening symptoms.`,
    });
  }

  const cardioFitness = findHealthMetric(categories, "Heart", "Cardio fitness");
  if (cardioFitness?.tone === "red") {
    brief.push({
      tone: "amber",
      title: "Make cardio fitness the gradual training priority",
      text: `${compactHealthDate(dataDate)} shows ${metricVsWeekly(cardioFitness)} and remains flagged red in the validated snapshot. Build repeatable moderate aerobic work gradually; use the trend, not one estimate, to judge progress.`,
    });
  }

  const timeAsleep = findHealthMetric(categories, "Sleep", "Time asleep");
  const sleepHours = timeAsleep ? durationHours(timeAsleep.value) : null;
  if (timeAsleep && sleepHours != null && sleepHours < 7) {
    brief.push({
      tone: sleepHours < 6 ? "red" : "amber",
      title: "Protect tonight’s sleep window",
      text: `${compactHealthDate(dataDate)} recorded ${metricVsWeekly(timeAsleep)}. That is just under the 7-hour benchmark used for most adults, so favour a consistent wind-down and recovery over adding more load tonight.`,
    });
  }

  const dietaryEnergy = findHealthMetric(categories, "Nutrition", "Dietary energy");
  if (dietaryEnergy) {
    brief.push({
      tone: "amber",
      title: "Complete the nutrition diary before interpreting it",
      text: `${compactHealthDate(dataDate)} logged ${metricVsWeekly(dietaryEnergy)}. These are recorded entries, not verified total intake; finish meals and portions before treating the difference as a nutrition signal.`,
    });
  }

  const steps = findHealthMetric(categories, "Activity", "Steps");
  const activeEnergy = findHealthMetric(categories, "Activity", "Active energy");
  if (steps || activeEnergy) {
    brief.push({
      tone: "blue",
      title: "Recover from a high-output movement day",
      text: `${compactHealthDate(dataDate)} recorded ${steps ? `${metricVsWeekly(steps)} steps` : "elevated movement"}${activeEnergy ? ` and ${metricVsWeekly(activeEnergy)} active energy` : ""}. Bank the activity; prioritise recovery instead of chasing another one-day spike.`,
    });
  }

  const restingHeartRate = findHealthMetric(categories, "Heart", "Resting heart rate");
  const hrv = findHealthMetric(categories, "Heart", "HRV");
  if (restingHeartRate?.averages?.weekly?.direction === "down" && hrv?.averages?.weekly?.direction === "up") {
    brief.push({
      tone: "green",
      title: "Recovery signals moved in a supportive direction",
      text: `Resting heart rate was ${metricVsWeekly(restingHeartRate)} and HRV was ${metricVsWeekly(hrv)}. Use the paired movement as encouraging context, not as a diagnosis or a reason to ignore symptoms.`,
    });
  }

  if (!brief.length) {
    brief.push({
      tone: "blue",
      title: "Hold the routine and watch the trend",
      text: `${compactHealthDate(dataDate)} has no validated priority exception. Keep the routine steady and use the 7-day and 30-day views before changing course.`,
    });
  }

  return brief.slice(0, 6);
}

/** Parse label/value pairs already present in a Health Shortcut / Health Stats summary — never invents values. */
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
  _healthNote: AppleNoteSnapshot | null = null,
  _healthNoteSource: ContentSourceState | null = null,
): HealthInsight[] {
  void _healthNote;
  void _healthNoteSource;
  const dataDate = healthSnapshot.dataDate;
  const insights: HealthInsight[] = [];

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
): HealthActionSnapshot[] {
  return buildDailyHealthBrief(healthSnapshot);
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
  return sources;
}
