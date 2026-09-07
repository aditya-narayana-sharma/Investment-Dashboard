export type HealthTone = "green" | "amber" | "red" | "blue" | "muted";

export type HealthAveragePeriod = "weekly" | "monthly";
export type HealthAverageDirection = "up" | "down" | "same";

export type HealthMetricAverage = {
  value: string;
  direction: HealthAverageDirection;
  delta?: string;
};

/** One measured daily point for a KPI sparkline — never invent missing days. */
export type HealthMetricHistoryPoint = {
  date: string;
  value: number;
};

export type HealthMetric = {
  label: string;
  value: string;
  context?: string;
  tone?: HealthTone;
  averages?: Partial<Record<HealthAveragePeriod, HealthMetricAverage>>;
  /** Chronological daily series ending on the health target date (gaps omitted). */
  history?: Partial<Record<HealthAveragePeriod, HealthMetricHistoryPoint[]>>;
};

export const healthAsOf = "16 Jul 2026 · Apple Health verified directly through iPhone screenshots on 17 Jul at 03:10 IST";

export const healthCategories: Array<{ name: string; note: string; tone: HealthTone; metrics: HealthMetric[] }> = [
  {
    name: "Activity",
    note: "Apple Health · 16 Jul; weekly and monthly Health chart averages",
    tone: "green",
    metrics: [
      { label: "Active energy", value: "913 kcal", context: "Apple Health detail · 16 Jul", averages: { weekly: { value: "742 kcal", direction: "up", delta: "+23.0%" }, monthly: { value: "663 kcal", direction: "up", delta: "+37.7%" } } },
      { label: "Exercise minutes", value: "54 min", context: "Apple Health detail · 16 Jul", averages: { weekly: { value: "48 min", direction: "up", delta: "+12.5%" }, monthly: { value: "38 min", direction: "up", delta: "+42.1%" } } },
      { label: "Stand", value: "16 hr", context: "Apple Health detail · 16 Jul", averages: { weekly: { value: "14 hr", direction: "up", delta: "+14.3%" }, monthly: { value: "14 hr", direction: "up", delta: "+14.3%" } } },
      { label: "Resting energy", value: "2,539 kcal", context: "Apple Health detail · 16 Jul", averages: { weekly: { value: "2,185 kcal", direction: "up", delta: "+16.2%" }, monthly: { value: "2,245 kcal", direction: "up", delta: "+13.1%" } } },
      { label: "Steps", value: "10,495", context: "Apple Health detail · 16 Jul", averages: { weekly: { value: "7,796", direction: "up", delta: "+34.6%" }, monthly: { value: "7,823", direction: "up", delta: "+34.2%" } } },
      { label: "Physical effort", value: "4.5 METs", context: "Latest detailed reading · 14 Jul 21:45" },
      { label: "Walking + running", value: "8 km", context: "Apple Health detail · 16 Jul", averages: { weekly: { value: "6 km", direction: "up", delta: "+33.3%" }, monthly: { value: "6 km", direction: "up", delta: "+33.3%" } } },
      { label: "Stairs climbed", value: "16 floors", context: "Apple Health detail · 16 Jul", averages: { weekly: { value: "10 floors", direction: "up", delta: "+60.0%" }, monthly: { value: "12 floors", direction: "up", delta: "+33.3%" } } },
    ],
  },
  {
    name: "Sleep",
    note: "Direct Apple Health sleep record · 16 Jul; weekly and monthly Health chart averages",
    tone: "blue",
    metrics: [
      { label: "Time asleep", value: "6h 06m", context: "Apple Health · 16 Jul", tone: "amber", averages: { weekly: { value: "6h 53m", direction: "down", delta: "-11.4%" }, monthly: { value: "7h 36m", direction: "down", delta: "-19.7%" } } },
      { label: "Time in bed", value: "6h 34m", context: "Apple Health · 16 Jul", averages: { weekly: { value: "6h 35m", direction: "same", delta: "-0.3%" }, monthly: { value: "6h 57m", direction: "down", delta: "-5.5%" } } },
      { label: "Deep sleep", value: "45 min", context: "Apple Health stages · 16 Jul", averages: { weekly: { value: "53 min", direction: "down", delta: "-15.1%" } } },
      { label: "REM sleep", value: "39 min", context: "Apple Health stages · 16 Jul", averages: { weekly: { value: "1h 32m", direction: "down", delta: "-57.6%" } } },
      { label: "Core sleep", value: "1h 45m", context: "Apple Health stages · 16 Jul", averages: { weekly: { value: "3h 50m", direction: "down", delta: "-54.3%" } } },
      { label: "Awake", value: "1h 45m", context: "Apple Health stages · 16 Jul", averages: { weekly: { value: "1h", direction: "up", delta: "+75.0%" } } },
      { label: "Sleep score", value: "83 / 100", context: "Apple Health · High · 16 Jul", tone: "green" },
    ],
  },
  {
    name: "Heart",
    note: "Direct Apple Health readings · 16 Jul; weekly and monthly Health chart ranges/averages",
    tone: "red",
    metrics: [
      { label: "Heart rate", value: "51-150 bpm", context: "Apple Health daily range · 16 Jul", averages: { weekly: { value: "45-175 bpm", direction: "same" }, monthly: { value: "42-197 bpm", direction: "same" } } },
      { label: "Resting heart rate", value: "71 bpm", context: "Apple Health · 16 Jul", tone: "green", averages: { weekly: { value: "73 bpm", direction: "down", delta: "-2.7%" }, monthly: { value: "75 bpm", direction: "down", delta: "-5.3%" } } },
      { label: "Walking HR avg", value: "129 bpm", context: "Apple Health · 16 Jul", averages: { weekly: { value: "134 bpm", direction: "down", delta: "-3.7%" }, monthly: { value: "128 bpm", direction: "up", delta: "+0.8%" } } },
      { label: "HRV", value: "18-89 ms", context: "Apple Health daily range · 16 Jul", tone: "green", averages: { weekly: { value: "10-147 ms", direction: "same" }, monthly: { value: "10-231 ms", direction: "same" } } },
      { label: "ECG", value: "Sinus Rhythm", context: "Latest ECG · 14 Jul · 96 bpm", tone: "green" },
      { label: "Cardio recovery", value: "14 bpm", context: "11 Jul" },
      { label: "Cardio fitness", value: "26.4 VO2 max", context: "19:55 · Apple classification: Low", tone: "red" },
    ],
  },
  {
    name: "Respiratory",
    note: "Respiratory rate verified for 16 Jul; other respiratory metrics retain their latest explicit date",
    tone: "blue",
    metrics: [
      { label: "Blood oxygen", value: "92-99%", context: "15 Jul range", tone: "amber" },
      { label: "Respiratory rate", value: "14-22 / min", context: "Apple Health daily range · 16 Jul; latest 16.5 / min", averages: { weekly: { value: "15.5-17.5 / min daily-average range", direction: "same", delta: "overlapping range" }, monthly: { value: "14.7-18.5 / min daily-average range", direction: "same", delta: "overlapping range" } } },
      { label: "Breathing disturbances", value: "Not elevated", context: "15 Jul", tone: "green" },
      { label: "FEV1 / FVC", value: "No data", context: "No recent spirometry", tone: "muted" },
    ],
  },
  {
    name: "Mobility",
    note: "Apple Health · 16 Jul daily ranges with Health weekly/monthly comparison ranges",
    tone: "amber",
    metrics: [
      { label: "Walking speed", value: "2.2-5.9 km/h", context: "Apple Health daily range · 16 Jul;  Health Daily recorded 4.08 km/h", averages: { weekly: { value: "2.7-4.7 km/h daily-average range", direction: "same", delta: "within range" }, monthly: { value: "2.7-5.0 km/h daily-average range", direction: "same", delta: "within range" } } },
      { label: "Step length", value: "42-101 cm", context: "Apple Health daily range · 16 Jul", averages: { weekly: { value: "56.5-72 cm daily-average range", direction: "same", delta: "overlapping range" }, monthly: { value: "55.7-72 cm daily-average range", direction: "same", delta: "overlapping range" } } },
      { label: "Double support", value: "36.1%", context: "Apple Health latest 16 Jul reading" },
      { label: "Walking asymmetry", value: "1.9%", context: "Apple Health · 15 Jul average", tone: "green" },
      { label: "Walking steadiness", value: "OK", context: "6-13 Jul", tone: "green" },
      { label: "Stair speed up", value: "0.21 m/s", context: "21:44" },
      { label: "Stair speed down", value: "0.22 m/s", context: "21:25" },
      { label: "Six-minute walk", value: "500 m", context: "11 Jul" },
    ],
  },
  {
    name: "Nutrition",
    note: "Direct Apple Health nutrition records · 16 Jul; logged intake, not verified total consumption",
    tone: "green",
    metrics: [
      { label: "Dietary energy", value: "681 kcal", context: "Apple Health · 16 Jul", tone: "amber", averages: { weekly: { value: "823 kcal", direction: "down", delta: "-17.3%" }, monthly: { value: "817 kcal", direction: "down", delta: "-16.6%" } } },
      { label: "Carbohydrate", value: "95 g", context: "Apple Health · 16 Jul", averages: { weekly: { value: "130 g", direction: "down", delta: "-26.9%" }, monthly: { value: "130 g", direction: "down", delta: "-26.9%" } } },
      { label: "Protein", value: "22 g", context: "Apple Health · 16 Jul", tone: "amber", averages: { weekly: { value: "24.3 g", direction: "down", delta: "-9.5%" }, monthly: { value: "27.1 g", direction: "down", delta: "-18.8%" } } },
      { label: "Total fat", value: "23 g", context: "Apple Health · 16 Jul", averages: { weekly: { value: "23 g", direction: "same", delta: "0.0%" }, monthly: { value: "21.8 g", direction: "up", delta: "+5.5%" } } },
      { label: "Saturated fat", value: "5 g", context: "Apple Health · 16 Jul", averages: { weekly: { value: "5.4 g", direction: "down", delta: "-7.4%" }, monthly: { value: "5.8 g", direction: "down", delta: "-13.8%" } } },
      { label: "Fibre", value: "8.9 g", context: "Apple Health · 16 Jul", tone: "amber", averages: { weekly: { value: "13.8 g", direction: "down", delta: "-35.5%" }, monthly: { value: "17.6 g", direction: "down", delta: "-49.4%" } } },
      { label: "Sugar", value: "7.6 g", context: "Apple Health · 16 Jul", averages: { weekly: { value: "18.5 g", direction: "down", delta: "-58.9%" }, monthly: { value: "29.2 g", direction: "down", delta: "-74.0%" } } },
      { label: "Sodium", value: "2,506 mg", context: "Apple Health · 16 Jul", tone: "amber", averages: { weekly: { value: "1,209 mg", direction: "up", delta: "+107.3%" }, monthly: { value: "937 mg", direction: "up", delta: "+167.4%" } } },
      { label: "Potassium", value: "217 mg", context: "Apple Health · 16 Jul", tone: "amber", averages: { weekly: { value: "420 mg", direction: "down", delta: "-48.3%" }, monthly: { value: "481 mg", direction: "down", delta: "-54.9%" } } },
      { label: "Dietary cholesterol", value: "6 mg", context: "Apple Health · 16 Jul", averages: { weekly: { value: "7.3 mg", direction: "down", delta: "-17.8%" }, monthly: { value: "7.9 mg", direction: "down", delta: "-24.1%" } } },
      { label: "Water", value: "4,500 ml", context: "Apple Health · 16 Jul", tone: "green", averages: { weekly: { value: "3,908 ml", direction: "up", delta: "+15.1%" }, monthly: { value: "2,916 ml", direction: "up", delta: "+54.3%" } } },
      { label: "Caffeine", value: "No 16 Jul entry", context: "Latest Apple Health record: 75 mg · 12 Jul", tone: "muted" },
    ],
  },
];

export const healthSources = [
  { source: "Apple Health", status: "Read", detail: "Direct 16 Jul Activity, Nutrition, Sleep, Heart, Mobility and Respiratory Rate records were read through iPhone Mirroring/screenshots, including Health chart weekly/monthly comparisons where displayed.", tone: "green" },
  { source: "Lifesum", status: "Read", detail: "15 Jul: 731 kcal consumed; carbs 77/378 g, protein 12/151 g, fat 44/101 g, water 3.5 L; 6,285 steps and 741 active kcal imported from Apple Health", tone: "green" },
  { source: "Guava", status: "Synced", detail: "15 Jul: HRV 45.1 ms, resting HR 72 bpm and sleep 6h 16m; stage detail shows 52m deep, 35m REM and 1h 29m awake. Sleep total differs from the direct Apple Health view.", tone: "amber" },
  { source: " Health Daily Note", status: "Read", detail: "The complete 16 Jul entry includes 4.08 km/h walking speed, 9,619 steps and 51 workout minutes. It is an earlier shortcut snapshot; later direct Apple Health totals take precedence where they differ.", tone: "green" },
];

export const healthActions = [
  { tone: "green", title: "Activity recovered on 16 July", text: "Apple Health recorded 913 active kcal, 54 exercise minutes, 16 stand hours and 10,495 steps. Each is above its displayed Health weekly average." },
  { tone: "amber", title: "Nutrition log is incomplete by definition", text: "The 16 July Apple Health nutrition record contains 681 kcal, 22 g protein and 8.9 g fibre. These are logged entries, not proof of total daily intake, so do not treat low totals as measured consumption." },
  { tone: "blue", title: "Keep hydration steady", text: "4.50 L was logged on 16 July versus a 3.91 L Health seven-day average. Interpret the difference in the context of heat, sweat and any clinician guidance rather than forcing a fixed target." },
  { tone: "amber", title: "Sleep duration was below its baselines", text: "Apple Health recorded 6h 06m asleep on 16 July versus 6h 53m weekly and 7h 36m monthly chart averages. Stage totals and the top-line duration do not fully reconcile, so retain the source values without combining them." },
  { tone: "amber", title: "Treat respiratory ranges as wellness signals", text: "Apple Health shows a 16 July respiratory-rate range of 14-22/min with a latest reading of 16.5/min. Blood oxygen (92-99%) and breathing disturbances (not elevated) remain dated 15 July. Apple Watch readings are not diagnostic; interpret the pattern cautiously and use appropriate clinical guidance for persistent concerns or symptoms." },
  { tone: "amber", title: "Build cardio gradually", text: "Apple Health classifies the 26.4 VO2 max estimate as Low. Use gradual, repeatable aerobic work and review the trend over time; discuss persistent concerns with a clinician." },
];

export const healthCaveats = [
  "Body measurements are intentionally excluded.",
  "Nutrition values reflect logged entries, not verified total intake.",
  "Apple Health is primary. Sleep stages and top-line time-asleep are retained as separate source aggregates when they do not reconcile.",
  "The weekly and monthly toggles use 7-day and 30-day HealthKit aggregates when a live iPhone snapshot is available.",
  "Mobility screenshots report daily ranges and ranges of daily averages. These are shown as ranges and are not converted into unsupported point estimates.",
  "Respiratory-rate ranges are preserved as ranges rather than converted into unsupported point estimates.",
  "A  Health Daily entry can be an earlier shortcut-time snapshot. Direct HealthKit aggregates take precedence when a newer iPhone sync is available.",
  "This is a private local wellness snapshot, not a diagnosis or medical record.",
];
