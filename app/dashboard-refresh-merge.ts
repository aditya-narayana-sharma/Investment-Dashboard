import type { ContentDigestSnapshot, ContentSourceState, InvestmentMailIntelligence } from "./content-types";
import type { SourceFreshness } from "./dashboard-types";
import type { EarningsSnapshot } from "./earnings-live-types";
import type { HealthLiveSnapshot } from "./health-live-types";
import type { KiteSnapshot } from "./live-types";
import type { SectorBenchmarkSnapshot, SectorMarketSnapshot } from "./sector-live-types";
import type { SectorNewsSnapshot } from "./sector-news-types";

/** Parse ISO, YYYY-MM-DD (IST noon), or Date.parse-able as-of labels into epoch ms. */
export function parseFreshnessMs(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(`${trimmed}T12:00:00+05:30`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when incoming is newer, equal, or either stamp is unparseable (treat unknown as equal). */
export function isAtLeastAsFresh(incoming: string | undefined | null, current: string | undefined | null): boolean {
  const incomingMs = parseFreshnessMs(incoming);
  const currentMs = parseFreshnessMs(current);
  if (incomingMs == null || currentMs == null) return true;
  return incomingMs >= currentMs;
}

function contentSourceSuccessful(status: ContentSourceState["status"]): boolean {
  switch (status) {
    case "live":
    case "verified":
      return true;
    case "partial":
    case "cached":
    case "stale":
    case "error":
    case "permission_required":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function kiteSuccessful(status: KiteSnapshot["status"]): boolean {
  switch (status) {
    case "live":
    case "partial":
      return true;
    case "snapshot":
    case "auth_required":
    case "unavailable":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function kiteHasHoldings(snapshot: KiteSnapshot): boolean {
  return snapshot.holdings.length > 0
    || snapshot.positions.length > 0
    || snapshot.orders.length > 0
    || snapshot.gtts.length > 0
    || (snapshot.alerts?.length ?? 0) > 0;
}

function earningsSuccessful(status: EarningsSnapshot["status"]): boolean {
  switch (status) {
    case "verified":
      return true;
    case "stale":
    case "unavailable":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function healthHasMetrics(snapshot: HealthLiveSnapshot): boolean {
  return snapshot.categories.some((category) => category.metrics.length > 0);
}

/** Prefer a newer Health day over live/stale rank. Stale means behind the operational target, not discard this XML. */
function healthStatusRank(status: HealthLiveSnapshot["status"]): number {
  switch (status) {
    case "live":
      return 4;
    case "partial":
      return 3;
    case "cached":
      return 2;
    case "stale":
      return 1;
    case "unavailable":
      return 0;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function sectorMarketRank(status: SectorMarketSnapshot["status"]): number {
  switch (status) {
    case "live":
      return 3;
    case "public_delayed":
      return 2;
    case "cached":
      return 1;
    case "auth_required":
    case "unavailable":
      return 0;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function benchmarkRank(status: SectorBenchmarkSnapshot["status"]): number {
  switch (status) {
    case "live":
      return 3;
    case "partial":
      return 2;
    case "cached":
      return 1;
    case "unavailable":
      return 0;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function benchmarkHasHistory(snapshot: SectorBenchmarkSnapshot): boolean {
  return snapshot.indices.some((index) => index.level !== null || index.indexedHistory.length > 0);
}

function newsSuccessful(status: SectorNewsSnapshot["status"]): boolean {
  switch (status) {
    case "live":
    case "partial":
      return true;
    case "unavailable":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function shouldReplacePopulated(args: {
  currentHasData: boolean;
  incomingHasData: boolean;
  incomingSuccessful: boolean;
  freshnessOk: boolean;
  incomingRank?: number;
  currentRank?: number;
}): boolean {
  const incomingRank = args.incomingRank ?? (args.incomingSuccessful ? 1 : 0);
  const currentRank = args.currentRank ?? (args.currentHasData ? 1 : 0);
  if (!args.currentHasData) return args.incomingHasData || args.incomingSuccessful || incomingRank > 0;
  if (!args.incomingHasData) return false;
  if (incomingRank > currentRank) return true;
  if (incomingRank < currentRank) return false;
  if (!args.incomingSuccessful) return false;
  return args.freshnessOk;
}

export function mergeKiteSnapshot(current: KiteSnapshot, incoming: KiteSnapshot): KiteSnapshot {
  const currentHasData = kiteHasHoldings(current) || kiteSuccessful(current.status) || current.status === "snapshot";
  const incomingHasData = kiteHasHoldings(incoming) || kiteSuccessful(incoming.status);
  if (shouldReplacePopulated({
    currentHasData,
    incomingHasData,
    incomingSuccessful: kiteSuccessful(incoming.status),
    freshnessOk: isAtLeastAsFresh(incoming.asOf, current.asOf),
    incomingRank: kiteSuccessful(incoming.status) ? 2 : incoming.status === "snapshot" && incomingHasData ? 1 : 0,
    currentRank: kiteSuccessful(current.status) ? 2 : current.status === "snapshot" && kiteHasHoldings(current) ? 1 : 0,
  })) {
    return incoming;
  }
  return current;
}

/** Keep last-good holdings when a refresh fails; never flash the empty waiting shell. */
export function retainKiteOnFailure(current: KiteSnapshot, message: string): KiteSnapshot {
  if (kiteHasHoldings(current) || current.status === "live" || current.status === "partial" || current.status === "snapshot") {
    return {
      ...current,
      status: "snapshot",
      authStatus: current.authStatus === "authenticated" || current.authStatus === "partial" ? "unknown" : current.authStatus,
      message,
    };
  }
  return { ...current, status: "unavailable", message };
}

function retainedContentSource(current: ContentSourceState, incoming: ContentSourceState): ContentSourceState {
  const status: ContentSourceState["status"] = incoming.status === "permission_required"
    ? "permission_required"
    : incoming.status === "stale"
      ? "stale"
      : current.status === "live" || current.status === "verified"
        ? "cached"
        : current.status;
  return {
    ...current,
    status,
    message: incoming.message
      ? `${incoming.message} Retaining the last validated snapshot.`
      : current.message,
  };
}

function patchContentSource(
  current: ContentSourceState,
  incoming: ContentSourceState | undefined,
  currentHasData: boolean,
  incomingHasData: boolean,
): { apply: boolean; source: ContentSourceState } {
  if (!incoming) return { apply: false, source: current };
  const successful = contentSourceSuccessful(incoming.status);
  if (shouldReplacePopulated({
    currentHasData,
    incomingHasData,
    incomingSuccessful: successful,
    freshnessOk: isAtLeastAsFresh(incoming.observedAt, current.observedAt),
  })) {
    return { apply: true, source: incoming };
  }
  if (currentHasData && !successful) {
    return { apply: false, source: retainedContentSource(current, incoming) };
  }
  return { apply: false, source: current };
}

const AXIS_INVESTMENT_KEYS = [
  "axisLookbackDays",
  "axisTradingAsOf",
  "axisTradingAsOfLabel",
  "axisUsedLastTradingDay",
  "latestAxisAt",
  "axisLastFetchedAt",
  "axisRecommendations",
  "axisTargetAchievements",
  "axisPdfArchive",
] as const satisfies ReadonlyArray<keyof InvestmentMailIntelligence>;

const NEWSLETTER_INVESTMENT_KEYS = [
  "policy",
  "analysisWindowStart",
  "analysisDate",
  "latestNewsletterAt",
  "macroEvidence",
] as const satisfies ReadonlyArray<keyof InvestmentMailIntelligence>;

function pickInvestment(
  base: InvestmentMailIntelligence,
  incoming: InvestmentMailIntelligence,
  keys: ReadonlyArray<keyof InvestmentMailIntelligence>,
): InvestmentMailIntelligence {
  const next = { ...base };
  for (const key of keys) {
    (next as Record<string, unknown>)[key] = incoming[key];
  }
  return next;
}

function contentOverallStatus(sources: ContentDigestSnapshot["sources"]): ContentDigestSnapshot["status"] {
  const required: Array<keyof ContentDigestSnapshot["sources"]> = ["newsletters", "axisResearch", "reminders", "calendar"];
  const allLive = required.every((key) => {
    const status = sources[key]?.status;
    return status === "live" || status === "verified";
  });
  if (allLive) return "live";
  const anyUsable = required.some((key) => {
    const status = sources[key]?.status;
    return status === "live" || status === "verified" || status === "cached" || status === "partial";
  });
  return anyUsable ? "partial" : "unavailable";
}

export function mergeContentSnapshot(current: ContentDigestSnapshot, incoming: ContentDigestSnapshot): ContentDigestSnapshot {
  const newsletterPatch = patchContentSource(
    current.sources.newsletters,
    incoming.sources.newsletters,
    current.newsletters.length > 0,
    incoming.newsletters.length > 0,
  );
  const axisPatch = patchContentSource(
    current.sources.axisResearch,
    incoming.sources.axisResearch,
    current.axisResearch.length > 0 || (current.investment.axisRecommendations?.length ?? 0) > 0,
    incoming.axisResearch.length > 0 || (incoming.investment.axisRecommendations?.length ?? 0) > 0,
  );
  const podcastPatch = patchContentSource(
    current.sources.podcasts,
    incoming.sources.podcasts,
    current.podcasts.length > 0,
    incoming.podcasts.length > 0,
  );
  const reminderPatch = patchContentSource(
    current.sources.reminders,
    incoming.sources.reminders,
    current.reminders.length > 0,
    incoming.reminders.length > 0,
  );
  const calendarPatch = patchContentSource(
    current.sources.calendar,
    incoming.sources.calendar,
    current.calendar.length > 0,
    incoming.calendar.length > 0,
  );
  const healthNotePatch = patchContentSource(
    current.sources.healthNote,
    incoming.sources.healthNote,
    Boolean(current.healthNote),
    Boolean(incoming.healthNote),
  );

  let investment = current.investment;
  if (axisPatch.apply) investment = pickInvestment(investment, incoming.investment, AXIS_INVESTMENT_KEYS);
  if (newsletterPatch.apply) investment = pickInvestment(investment, incoming.investment, NEWSLETTER_INVESTMENT_KEYS);

  const marketCalendarIncoming = incoming.sources.marketCalendar;
  const marketCalendarCurrent = current.sources.marketCalendar;
  let marketCalendar = current.marketCalendar;
  let marketCalendarSource = marketCalendarCurrent;
  if (marketCalendarIncoming) {
    const successful = marketCalendarIncoming.status === "live" || marketCalendarIncoming.status === "verified";
    const currentHas = Boolean(current.marketCalendar?.holidays.length);
    const incomingHas = Boolean(incoming.marketCalendar?.holidays.length);
    if (shouldReplacePopulated({
      currentHasData: currentHas,
      incomingHasData: incomingHas,
      incomingSuccessful: successful,
      freshnessOk: isAtLeastAsFresh(marketCalendarIncoming.observedAt, marketCalendarCurrent?.observedAt),
    })) {
      marketCalendar = incoming.marketCalendar;
      marketCalendarSource = marketCalendarIncoming;
    } else if (currentHas && !successful) {
      marketCalendarSource = retainedContentSource(marketCalendarCurrent ?? marketCalendarIncoming, marketCalendarIncoming);
    }
  }

  const sources: ContentDigestSnapshot["sources"] = {
    newsletters: newsletterPatch.source,
    axisResearch: axisPatch.source,
    podcasts: podcastPatch.source,
    reminders: reminderPatch.source,
    calendar: calendarPatch.source,
    healthNote: healthNotePatch.source,
    ...(marketCalendarSource ? { marketCalendar: marketCalendarSource } : {}),
  };

  const anyPatch = newsletterPatch.apply || axisPatch.apply || podcastPatch.apply || reminderPatch.apply || calendarPatch.apply || healthNotePatch.apply;
  return {
    ...current,
    status: contentOverallStatus(sources),
    asOf: anyPatch && isAtLeastAsFresh(incoming.asOf, current.asOf) ? incoming.asOf : current.asOf,
    newsletters: newsletterPatch.apply ? incoming.newsletters : current.newsletters,
    axisResearch: axisPatch.apply ? incoming.axisResearch : current.axisResearch,
    podcasts: podcastPatch.apply ? incoming.podcasts : current.podcasts,
    reminders: reminderPatch.apply ? incoming.reminders : current.reminders,
    calendar: calendarPatch.apply ? incoming.calendar : current.calendar,
    healthNote: healthNotePatch.apply ? incoming.healthNote : current.healthNote,
    marketCalendar,
    investment,
    sources,
  };
}

export function mergeEarningsSnapshot(current: EarningsSnapshot, incoming: EarningsSnapshot): EarningsSnapshot {
  if (shouldReplacePopulated({
    currentHasData: current.events.length > 0 && current.status === "verified",
    incomingHasData: incoming.events.length > 0,
    incomingSuccessful: earningsSuccessful(incoming.status),
    freshnessOk: isAtLeastAsFresh(incoming.analysisDate, current.analysisDate) && isAtLeastAsFresh(incoming.asOf, current.asOf),
    incomingRank: earningsSuccessful(incoming.status) ? 2 : incoming.events.length > 0 ? 1 : 0,
    currentRank: current.status === "verified" ? 2 : current.events.length > 0 ? 1 : 0,
  })) {
    return incoming;
  }
  return current;
}

export function mergeHealthSnapshot(current: HealthLiveSnapshot, incoming: HealthLiveSnapshot): HealthLiveSnapshot {
  const currentHasData = healthHasMetrics(current);
  const incomingHasData = healthHasMetrics(incoming);
  if (!incomingHasData) return currentHasData ? current : incoming;
  if (!currentHasData) return incoming;

  const incomingDateMs = parseFreshnessMs(incoming.dataDate);
  const currentDateMs = parseFreshnessMs(current.dataDate);
  if (incomingDateMs != null && currentDateMs != null) {
    if (incomingDateMs > currentDateMs) return incoming;
    if (incomingDateMs < currentDateMs) return current;
  }

  const incomingRank = healthStatusRank(incoming.status);
  const currentRank = healthStatusRank(current.status);
  if (incomingRank > currentRank) return incoming;
  if (incomingRank < currentRank) return current;
  if (isAtLeastAsFresh(incoming.capturedAt, current.capturedAt)) return incoming;
  return current;
}

export function retainHealthOnFailure(current: HealthLiveSnapshot, message: string): HealthLiveSnapshot {
  if (!healthHasMetrics(current)) {
    return { ...current, status: "unavailable", message };
  }
  return {
    ...current,
    status: current.status === "live" || current.status === "partial" ? "stale" : current.status,
    message: current.status === "unavailable"
      ? message
      : "The latest HealthKit refresh failed; retaining the last validated snapshot.",
  };
}

function sectorMarketUsable(status: SectorMarketSnapshot["status"]): boolean {
  switch (status) {
    case "live":
    case "cached":
    case "public_delayed":
      return true;
    case "auth_required":
    case "unavailable":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function mergeSectorMarketSnapshot(current: SectorMarketSnapshot | undefined, incoming: SectorMarketSnapshot): SectorMarketSnapshot {
  if (!current) return incoming;
  const currentUsable = sectorMarketUsable(current.status) && current.companies.some((company) => company.price != null);
  const incomingUsable = sectorMarketUsable(incoming.status) && incoming.companies.some((company) => company.price != null);
  if (shouldReplacePopulated({
    currentHasData: currentUsable,
    incomingHasData: incomingUsable,
    incomingSuccessful: incoming.status === "live",
    freshnessOk: isAtLeastAsFresh(incoming.asOf, current.asOf),
    incomingRank: sectorMarketRank(incoming.status),
    currentRank: sectorMarketRank(current.status),
  })) {
    return incoming;
  }
  return current;
}

export function mergeSectorNewsSnapshot(current: SectorNewsSnapshot, incoming: SectorNewsSnapshot): SectorNewsSnapshot {
  if (shouldReplacePopulated({
    currentHasData: current.items.length > 0,
    incomingHasData: incoming.items.length > 0,
    incomingSuccessful: newsSuccessful(incoming.status),
    freshnessOk: isAtLeastAsFresh(incoming.asOf, current.asOf),
  })) {
    return incoming;
  }
  if (current.items.length > 0 && !newsSuccessful(incoming.status)) {
    return {
      ...current,
      status: current.status === "unavailable" ? "partial" : current.status,
      message: `${current.message} Could not refresh: ${incoming.message}`,
    };
  }
  return current;
}

export function mergeBenchmarkSnapshot(current: SectorBenchmarkSnapshot, incoming: SectorBenchmarkSnapshot): SectorBenchmarkSnapshot {
  if (shouldReplacePopulated({
    currentHasData: benchmarkHasHistory(current),
    incomingHasData: benchmarkHasHistory(incoming),
    incomingSuccessful: incoming.status === "live" || incoming.status === "partial",
    freshnessOk: isAtLeastAsFresh(incoming.asOf, current.asOf),
    incomingRank: benchmarkRank(incoming.status),
    currentRank: benchmarkRank(current.status),
  })) {
    return incoming;
  }
  if (benchmarkHasHistory(current) && benchmarkRank(incoming.status) < benchmarkRank(current.status)) {
    return {
      ...current,
      message: `${current.message} Latest dedicated benchmark refresh failed: ${incoming.message}`,
    };
  }
  return current;
}

export function mergeSourceFreshness(current: SourceFreshness[], incoming: SourceFreshness[]): SourceFreshness[] {
  if (!incoming.length) return current;
  if (!current.length) return incoming;
  const retained = new Map(current.map((row) => [row.source, row]));
  const next: SourceFreshness[] = incoming.map((row) => {
    retained.delete(row.source);
    return row;
  });
  for (const row of current) {
    if (retained.has(row.source)) next.push(row);
  }
  return next;
}

export function mergeYfinanceQuotes(current: Map<string, number>, incoming: Map<string, number>): Map<string, number> {
  if (!incoming.size) return current;
  const next = new Map(current);
  for (const [symbol, price] of incoming) {
    if (price > 0) next.set(symbol, price);
  }
  return next;
}
