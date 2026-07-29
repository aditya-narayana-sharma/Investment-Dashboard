export type DigestItem = {
  source: string;
  time: string;
  receivedAt?: string;
  title: string;
  summary: string;
  /** Source-backed summary points for Market Intelligence (≥5 when body supports it). */
  bullets?: string[];
  /** Podcast only: whether bullets came from a local transcript or episode description. */
  contentSource?: "transcript" | "description" | "none";
};

export type MailRecommendation = {
  symbol: string;
  name: string;
  call: string;
  target: number | null;
  cmp: number | null;
  upside: string;
  horizon: string;
  source: string;
  date: string;
  thesis: string;
  color: string;
  scores: [number, number, number, number, number, number];
};

export type MacroMailEvidence = {
  key: "oilWar" | "flows" | "rates" | "breadth" | "earnings";
  count: number;
  latestTitle: string;
  latestAt: string;
  items: DigestItem[];
};

export type InvestmentMailIntelligence = {
  policy: string;
  analysisWindowStart: string;
  analysisDate: string;
  axisLookbackDays: number;
  /** NSE trading as-of used for Axis Recommended Stocks (today or last trading day). */
  axisTradingAsOf?: string;
  axisTradingAsOfLabel?: string;
  axisUsedLastTradingDay?: boolean;
  latestAxisAt: string;
  latestNewsletterAt: string;
  axisRecommendations: MailRecommendation[];
  macroEvidence: MacroMailEvidence[];
};

export type ContentSourceState = {
  status: "live" | "verified" | "partial" | "cached" | "stale" | "error" | "permission_required";
  count: number;
  displayedCount?: number;
  message?: string;
  observedAt?: string;
};

export type AppleTaskItem = {
  id: string;
  title: string;
  detail: string;
  source: string;
  list?: string;
  dueAt?: string;
  completed: boolean;
  /** ISO completion timestamp when Reminder is completed (evidence only). */
  completedAt?: string | null;
  /** True when Apple Reminders has a recurrence rule for this item. */
  repeating?: boolean;
  /** Human label such as "Daily", "Weekly", "Every 3 months". */
  repeatsOn?: string | null;
  topic: "Earnings" | "Work/Jobs" | "Health" | "Personal" | "Other";
  /** Unused for reminders — Calendar + Reminder feeds render title/meta only. */
  bullets?: string[];
};

export type AppleCalendarItem = {
  id: string;
  title: string;
  calendar: string;
  startsAt: string;
  endsAt: string;
  topic: AppleTaskItem["topic"];
  notes?: string;
  /** Unused for calendar events — feeds render title/schedule meta only. */
  bullets?: string[];
};

export type AppleNoteSnapshot = {
  title: " Health Daily";
  modifiedAt: string;
  summary: string;
  /** Latest completed-day key parsed from the note, when available. */
  observedDate?: string | null;
  /**
   * Explicit Daily Optimism text from the exact  Health Daily note.
   * Null/undefined when the note has no Optimism section — never fabricated.
   */
  dailyOptimism?: string | null;
};

export type ContentDigestSnapshot = {
  status: "live" | "partial" | "unavailable";
  asOf: string;
  newsletters: DigestItem[];
  axisResearch: DigestItem[];
  podcasts: DigestItem[];
  reminders: AppleTaskItem[];
  calendar: AppleCalendarItem[];
  healthNote: AppleNoteSnapshot | null;
  investment: InvestmentMailIntelligence;
  sources: {
    newsletters: ContentSourceState;
    axisResearch: ContentSourceState;
    podcasts: ContentSourceState;
    reminders: ContentSourceState;
    calendar: ContentSourceState;
    healthNote: ContentSourceState;
  };
};
