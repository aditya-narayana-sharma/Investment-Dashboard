export type PodcastInsight = {
  text: string;
  outcome: "Positive" | "Mixed" | "Negative";
  sentiment: "Positive" | "Neutral" | "Negative";
};

export type DigestItem = {
  source: string;
  time: string;
  receivedAt?: string;
  title: string;
  summary: string;
  /** Source-backed summary points for Market Intelligence (≥5 when body supports it). */
  bullets?: string[];
  /** Podcast evidence. Descriptions are sanitized and explicitly labelled when no transcript exists. */
  contentSource?: "transcript" | "description" | "none";
  /** Deterministic newsletter tone; absent on older snapshots and non-newsletters. */
  sentiment?: "Positive" | "Neutral" | "Negative";
  /** Deterministic Axis Research classification; empty arrays mean no keyword match. */
  tags?: {
    sector: string[];
    thesis: string[];
    conviction: string[];
  };
  /**
   * Apple Mail Message-ID when captured from the exact mailbox read.
   * Used only to build messageUrl — never fabricated.
   */
  messageId?: string;
  /** `message://…` deep link into Apple Mail when messageId is available. */
  messageUrl?: string;
  /** Axis Research topic/subject collapsible group (Punch, Result Updates, …). */
  topicGroup?: string;
  /** Local Axis PDF basename when matched under the Axis Research archive. */
  pdfFile?: string | null;
  /** Dashboard route that serves the matched local Axis PDF inline. */
  pdfUrl?: string | null;
  /** Podcast URL from the local Podcasts database, when available. */
  episodeUrl?: string;
  /** AI-generated takeaways; `contentSource` identifies transcript versus description evidence. */
  keyTakeaways?: string[];
  /** Per-bullet outcome and sentiment metadata used by Podcast insight cards. */
  podcastInsights?: PodcastInsight[];
  /** Generated only from the exact episode evidence identified by `contentSource`. */
  summaryStatus?: "generated" | "unavailable" | "error";
  summaryReason?: "transcript_unavailable" | "transcript_too_short" | "evidence_too_short" | "summarizer_not_configured" | "summarizer_failed" | null;
  summaryModel?: string | null;
  summaryGeneratedAt?: string | null;
  summaryChunkCount?: number;
  /** Hash for reusing an unchanged transcript or description summary. */
  evidenceFingerprint?: string | null;
  /** Hash for summary reuse without persisting or exposing transcript text. */
  transcriptFingerprint?: string;
  /** Safe timestamp links derived from local transcript markers and the episode URL. */
  timestampLinks?: Array<{ label: string; seconds: number; href: string }>;
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
  tags?: DigestItem["tags"];
  /** Local Axis PDF filename when the call came from the archive extract. */
  evidenceFile?: string | null;
  /** YYYY-MM-DD when known from PDF filename / mail as-of. */
  dateKey?: string | null;
  bucket?: "fundamental" | "technical" | "trading";
  origin?: "pdf" | "mail";
};

export type AxisPdfArchiveAudit = {
  filesAttempted: number;
  validPdfs: number;
  pagesRead: number;
  duplicateGroups?: number;
  invalidFiles: string[];
  recommendations?: number;
  withCmpAndTarget?: number | null;
  missingProgressInputs?: number | null;
  asOf?: string | null;
  sinceDate?: string;
  counts?: {
    total?: number;
    fundamental?: number;
    technical?: number;
    trading?: number;
    withCmpAndTarget?: number;
    missingProgressInputs?: number;
    latestUnique?: number;
  } | null;
  mailWindowCalls?: number;
  shownCalls?: number;
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
  /** ISO timestamp of the latest successful Axis mailbox read. */
  axisLastFetchedAt?: string;
  latestNewsletterAt: string;
  axisRecommendations: MailRecommendation[];
  /** Live PDF-archive audit for Axis Recommended Stocks (overrides static portfolio-data audit when present). */
  axisPdfArchive?: AxisPdfArchiveAudit;
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
  /** Apple Reminders priority value; zero means no explicit priority. */
  priority?: number;
  /** Explicit Apple Reminders flag. */
  flagged?: boolean;
  /** Explicit urgent state for the current user. */
  urgent?: boolean;
  /** True when Apple Reminders has a recurrence rule for this item. */
  repeating?: boolean;
  /** Human label such as "Daily", "Weekly", "Every 3 months". */
  repeatsOn?: string | null;
  topic: "Earnings" | "Work/Jobs" | "Health" | "Personal" | "Other";
  /** Deterministic topic color and derived accessible presentation values. */
  topicColor?: string;
  backgroundColor?: string;
  textColor?: "#000" | "#FFF";
  /** Unused for reminders — Calendar + Reminder feeds render title/meta only. */
  bullets?: string[];
};

export type MarketCalendarKind = "NSE" | "US" | "CRYPTO";

export type MarketHoliday = {
  market: Exclude<MarketCalendarKind, "CRYPTO">;
  sourceName: string;
  sourceUrl: string;
  asOf: string;
};

export type AppleCalendarItem = {
  id: string;
  title: string;
  calendar: string;
  startsAt: string;
  endsAt: string;
  /** Apple Calendar all-day flag; sourceDate is authoritative when true. */
  allDay?: boolean;
  /** Source-local YYYY-MM-DD, preserved to prevent all-day timezone shifts. */
  sourceDate?: string;
  startTimeZone?: string | null;
  endTimeZone?: string | null;
  topic: AppleTaskItem["topic"];
  notes?: string;
  marketHoliday?: MarketHoliday;
  /** Unused for calendar events — feeds render title/schedule meta only. */
  bullets?: string[];
};

export type MarketCalendarSnapshot = {
  status: "live" | "unavailable";
  asOf: string;
  message: string;
  holidays: AppleCalendarItem[];
  crypto: {
    market: "CRYPTO";
    semantics: "24/7";
    message: string;
  };
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
  marketCalendar?: MarketCalendarSnapshot;
  healthNote: AppleNoteSnapshot | null;
  investment: InvestmentMailIntelligence;
  sources: {
    newsletters: ContentSourceState;
    axisResearch: ContentSourceState;
    podcasts: ContentSourceState;
    reminders: ContentSourceState;
    calendar: ContentSourceState;
    marketCalendar?: ContentSourceState;
    healthNote: ContentSourceState;
  };
};
