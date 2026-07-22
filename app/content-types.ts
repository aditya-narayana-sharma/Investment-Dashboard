export type DigestItem = {
  source: string;
  time: string;
  receivedAt?: string;
  title: string;
  summary: string;
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
  topic: "Earnings" | "Work/Jobs" | "Health" | "Personal" | "Other";
};

export type AppleCalendarItem = {
  id: string;
  title: string;
  calendar: string;
  startsAt: string;
  endsAt: string;
  topic: AppleTaskItem["topic"];
  notes?: string;
};

export type AppleNoteSnapshot = {
  title: " Health Daily";
  modifiedAt: string;
  summary: string;
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
