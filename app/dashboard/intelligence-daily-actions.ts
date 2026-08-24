import type { ContentDigestSnapshot, ContentSourceState, DigestItem, SatyaSourceFamily } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import { earningsEventDateKey } from "../earnings-verify.ts";
import { axisMessageDateKey, isNseTradingDay, istDateKey, lastNseTradingDay, shiftIstDateKey } from "../nse-trading-day.ts";
import {
  actionKeysCollide,
  CORPUS_SMART_ACTION_CAP,
  finalizeDailyActions,
  isRelevantActionCopy,
  normalizeActionKey,
  SMART_ACTIONS_LABEL,
} from "./daily-action-policy.ts";
import { classifyAxisCategory } from "../satya/axis-categories.ts";
import { axisCategoryForItem, resolveNewsletterFamily } from "./digest-newsletter-groups.ts";
import type { KanbanItem } from "./types";

/** Axis result-update families that mint To do cards. */
const RESULT_CATEGORIES = new Set([
  "result_update",
  "quarterly_result_updates",
]);

/** Conviction, punch, and target-achieved families that mint Monitor cards. */
const CONVICTION_CATEGORIES = new Set([
  "top_conviction_ideas",
  "axis_punch",
  "target_achieved",
]);

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
}

function stalePrefix(stale: boolean, title: string) {
  return stale ? `Stale · ${title}` : title;
}

/** Live/verified mail is today's work; cached/partial/error evidence belongs on Monitor. */
function actionableLane(stale: boolean): KanbanItem["lane"] {
  return stale ? "monitor" : "today";
}

function sourceNotLive(source?: ContentSourceState): boolean {
  const status = source?.status;
  if (!status) return true;
  switch (status) {
    case "live":
    case "verified":
      return false;
    case "partial":
    case "cached":
    case "stale":
    case "error":
    case "permission_required":
      return true;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function corpusFamilyStale(
  family: SatyaSourceFamily,
  newslettersStale: boolean,
  axisStale: boolean,
  podcastsStale: boolean,
): boolean {
  switch (family) {
    case "axis_research":
      return axisStale;
    case "podcasts":
      return podcastsStale;
    case "axis_mutual_fund":
    case "groww_digest":
    case "flipboard_tech":
    case "newsletter_other":
      return newslettersStale;
    case "earnings":
      return false;
    default: {
      const _exhaustive: never = family;
      return _exhaustive;
    }
  }
}

/** Last NSE equity session on or before the IST calendar date. */
export function intelligenceEvidenceDateKey(calendarDate = istDateKey()) {
  return lastNseTradingDay(calendarDate);
}

function dateKeysInclusive(from: string, to: string) {
  if (from > to) return [to];
  const keys: string[] = [];
  let key = from;
  for (let step = 0; step < 21; step += 1) {
    keys.push(key);
    if (key === to) return keys;
    key = shiftIstDateKey(key, 1);
  }
  return keys;
}

function itemsOnDate(items: DigestItem[], asOf: string) {
  const year = Number(asOf.slice(0, 4));
  return items.filter((item) => axisMessageDateKey(item, year) === asOf);
}

function axisHasMintableCards(items: DigestItem[], asOf: string) {
  return itemsOnDate(items, asOf).some((item) => {
    const category = axisCategoryForItem(item);
    if (category === "daily_morning_note" || /daily morning note/i.test(item.title)) return false;
    return RESULT_CATEGORIES.has(category) || CONVICTION_CATEGORIES.has(category);
  });
}

function earningsHasMintableCards(snapshot: EarningsSnapshot, asOf: string) {
  if (snapshot.status === "unavailable") return false;
  const analysisDate = /^\d{4}-\d{2}-\d{2}$/.test(snapshot.analysisDate)
    ? snapshot.analysisDate
    : asOf;
  return snapshot.events.some((event) => {
    if (earningsEventDateKey(event, analysisDate) !== asOf) return false;
    if (!event.reported) return false;
    return filledKpis(event).length > 0;
  });
}

function corpusHasMintableCards(
  docs: Array<{ receivedAt: string }> | undefined,
  asOf: string,
) {
  return (docs ?? []).some((doc) => doc.receivedAt.slice(0, 10) === asOf);
}

function sessionHasMintableCards(options: {
  content: ContentDigestSnapshot;
  earningsSnapshot: EarningsSnapshot;
  corpusDocuments?: Array<{ receivedAt: string }>;
}, asOf: string) {
  return axisHasMintableCards(options.content.axisResearch, asOf)
    || itemsOnDate(options.content.newsletters, asOf).length > 0
    || itemsOnDate(options.content.podcasts, asOf).length > 0
    || earningsHasMintableCards(options.earningsSnapshot, asOf)
    || corpusHasMintableCards(options.corpusDocuments, asOf);
}

/**
 * Calendar days Satya M-1 may preview after a weekend or an empty open:
 * the prior NSE session through today's session, inclusive.
 */
export function intelligenceCorpusPreviewDateKeys(calendarDate = istDateKey()) {
  const session = intelligenceEvidenceDateKey(calendarDate);
  if (!isNseTradingDay(calendarDate)) return [session];
  const prior = lastNseTradingDay(shiftIstDateKey(calendarDate, -1));
  return dateKeysInclusive(prior, session);
}

/**
 * Prefer today's / this session's evidence only. On a trading day with no
 * mintable cards yet (Monday 12:01 before the digest lands), walk backward
 * through yesterday and the weekend to the prior NSE session and use the
 * newest of those days that has cards. Do not jump over Sunday mail to
 * Friday, and do not mix Thursday into a Friday that already has cards.
 */
export function resolveIntelligenceEvidenceDateKeys(options: {
  content: ContentDigestSnapshot;
  earningsSnapshot: EarningsSnapshot;
  calendarDate?: string;
  corpusDocuments?: Array<{ receivedAt: string }>;
}) {
  const calendarDate = options.calendarDate ?? istDateKey();
  const session = intelligenceEvidenceDateKey(calendarDate);
  if (sessionHasMintableCards(options, session) || !isNseTradingDay(calendarDate)) {
    return [session];
  }
  const prior = lastNseTradingDay(shiftIstDateKey(calendarDate, -1));
  const window = dateKeysInclusive(prior, shiftIstDateKey(session, -1));
  for (let index = window.length - 1; index >= 0; index -= 1) {
    const day = window[index];
    if (sessionHasMintableCards(options, day)) return [day];
  }
  return [prior];
}

export function resolveIntelligenceEvidenceDateKey(options: {
  content: ContentDigestSnapshot;
  earningsSnapshot: EarningsSnapshot;
  calendarDate?: string;
  corpusDocuments?: Array<{ receivedAt: string }>;
}) {
  const keys = resolveIntelligenceEvidenceDateKeys(options);
  return keys[keys.length - 1] ?? intelligenceEvidenceDateKey(options.calendarDate);
}

function filledKpis(event: EarningsSnapshot["events"][number]) {
  return event.kpis.filter((kpi) => kpi.value.trim());
}

function resultTitle(item: DigestItem) {
  const match = item.title.match(/^Result Update:\s*(.+?)(?:\s*[-–—]|$)/i);
  if (match?.[1]) return `${match[1].trim()} result update`;
  return `${item.title.replace(/\s+/g, " ").trim()} result update`;
}

function namedNewsletterFamily(family: SatyaSourceFamily | undefined): boolean {
  switch (family) {
    case "axis_mutual_fund":
    case "groww_digest":
    case "flipboard_tech":
      return true;
    case "newsletter_other":
    case "axis_research":
    case "podcasts":
    case "earnings":
    case undefined:
      return false;
    default: {
      const _exhaustive: never = family;
      return _exhaustive;
    }
  }
}

function convictionTitle(item: DigestItem) {
  const category = axisCategoryForItem(item);
  if (category === "target_achieved" || /target achieved/i.test(item.title)) {
    const name = item.title.replace(/^Target Achieved:\s*/i, "").split(" - ")[0]?.trim() || item.title;
    return `${name} target achieved`;
  }
  if (category === "axis_punch" || /\bpunch\b/i.test(item.title)) {
    return item.title.includes("Punch") ? item.title.replace(/\s+/g, " ").trim() : `Axis Punch · ${item.title}`;
  }
  if (category === "top_conviction_ideas" || /conviction/i.test(item.title)) {
    const about = item.summary.match(/\b([A-Z]{2,}(?:\s+[A-Z][a-z]+)*)\b/)?.[1];
    return about ? `${about} conviction` : `${item.title.replace(/\s+/g, " ").trim()} conviction`;
  }
  return item.title.replace(/\s+/g, " ").trim();
}

function newsletterTitle(item: DigestItem) {
  const sender = item.source.trim() || "Newsletter";
  const headline = item.title.replace(/\s+/g, " ").trim();
  return `${sender} · ${headline}`;
}

function podcastTitle(item: DigestItem) {
  return item.source.trim() || item.title.replace(/\s+/g, " ").trim() || "Podcast";
}

function earningsTitle(event: EarningsSnapshot["events"][number]) {
  return `${event.name} reported KPIs`;
}

function kpiDetail(event: EarningsSnapshot["events"][number]) {
  const filled = filledKpis(event);
  const lines = filled.slice(0, 2).map((kpi) => `${kpi.label} ${kpi.value}${kpi.change.trim() ? ` (${kpi.change.trim()})` : ""}`);
  return `${event.symbol} ${event.period}: ${lines.join("; ")}. Unpublished stay blank.`;
}

function newestFirst<T extends { receivedAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => String(right.receivedAt ?? "").localeCompare(String(left.receivedAt ?? "")));
}

/**
 * Build Market Intelligence kanban cards from that day's (or last NSE session's)
 * digest and verified earnings. Empty or stale sources keep the last snapshot,
 * prefix Stale, and park those cards on Monitor — never invented companies or KPI values.
 */
export function buildIntelligenceDailyActions(options: {
  content: ContentDigestSnapshot;
  earningsSnapshot: EarningsSnapshot;
  calendarDate?: string;
  corpusDocuments?: Array<{
    family: SatyaSourceFamily;
    title: string;
    receivedAt: string;
    axisCategory?: string | null;
  }>;
}): KanbanItem[] {
  const asOfs = resolveIntelligenceEvidenceDateKeys(options);
  const { content, earningsSnapshot } = options;
  const newslettersStale = sourceNotLive(content.sources.newsletters);
  const axisStale = sourceNotLive(content.sources.axisResearch);
  const podcastsStale = sourceNotLive(content.sources.podcasts);
  const earningsStale = earningsSnapshot.status !== "verified";
  const actions: KanbanItem[] = [];

  for (const asOf of asOfs) {
  const axisItems = newestFirst(itemsOnDate(content.axisResearch, asOf));
  const newsItems = newestFirst(itemsOnDate(content.newsletters, asOf));
  const podItems = newestFirst(itemsOnDate(content.podcasts, asOf));

  for (const item of axisItems) {
    const category = axisCategoryForItem(item);
    if (category === "daily_morning_note" || /daily morning note/i.test(item.title)) continue;
    if (!isRelevantActionCopy(item.title, item.summary)) continue;
    if (RESULT_CATEGORIES.has(category)) {
      const title = resultTitle(item);
      actions.push({
        id: `intel-axis-result-${asOf}-${slug(item.title)}`,
        title: stalePrefix(axisStale, title),
        detail: item.summary || "Axis result-update mail. Do not invent KPIs.",
        numericAdvantage: axisStale ? "Axis stale" : "result update",
        strategicAdvantage: axisStale ? "Stale Axis mailbox" : "Unpublished figures stay blank",
        sourceLabel: "Mail",
        sourceKind: "source",
        lane: actionableLane(axisStale),
        tone: axisStale ? "amber" : "blue",
      });
      continue;
    }
    if (CONVICTION_CATEGORIES.has(category)) {
      const title = convictionTitle(item);
      actions.push({
        id: `intel-axis-conviction-${asOf}-${slug(item.title)}`,
        title: stalePrefix(axisStale, title),
        detail: item.summary || "Axis conviction / punch / target-achieved mail.",
        numericAdvantage: axisStale ? "Axis stale" : category.replaceAll("_", " "),
        strategicAdvantage: axisStale ? "Stale Axis mailbox" : "Research opinion, not a live price",
        sourceLabel: "Mail",
        sourceKind: "source",
        lane: "monitor",
        tone: axisStale ? "amber" : category === "target_achieved" || category === "axis_punch" ? "red" : "amber",
      });
    }
  }

  for (const item of newsItems) {
    if (!isRelevantActionCopy(item.title, item.summary)) continue;
    const family = resolveNewsletterFamily(item);
    actions.push({
      id: `intel-newsletter-${asOf}-${slug(`${item.source}-${item.title}`)}`,
      title: stalePrefix(newslettersStale, newsletterTitle(item)),
      detail: item.summary || "Newsletter theme from iCloud → Newsletters.",
      numericAdvantage: newslettersStale ? "Newsletters stale" : (item.sourceFamily ?? "newsletter"),
      strategicAdvantage: newslettersStale ? "Stale Newsletters mailbox" : "Named families stay Satya source of truth",
      sourceLabel: "Mail",
      sourceKind: "source",
      lane: actionableLane(newslettersStale),
      tone: newslettersStale ? "amber" : namedNewsletterFamily(family) ? "green" : "blue",
    });
  }

  for (const item of podItems) {
    if (!isRelevantActionCopy(item.title, item.summary)) continue;
    const evidence = item.contentSource === "transcript" ? "transcript" : "description";
    actions.push({
      id: `intel-podcast-${asOf}-${slug(`${item.source}-${item.title}`)}`,
      title: stalePrefix(podcastsStale, podcastTitle(item)),
      detail: item.summary || "Podcast episode in the Satya corpus window.",
      numericAdvantage: podcastsStale ? "Podcasts stale" : evidence,
      strategicAdvantage: podcastsStale ? "Stale podcasts source" : "Transcript only when a local transcript existed",
      sourceLabel: "Podcasts",
      sourceKind: "source",
      lane: actionableLane(podcastsStale),
      tone: "red",
    });
  }

  if (earningsSnapshot.status !== "unavailable") {
    const analysisDate = /^\d{4}-\d{2}-\d{2}$/.test(earningsSnapshot.analysisDate)
      ? earningsSnapshot.analysisDate
      : asOf;
    for (const event of earningsSnapshot.events) {
      const key = earningsEventDateKey(event, analysisDate);
      if (key !== asOf) continue;
      if (!event.reported) continue;
      const filled = filledKpis(event);
      if (!filled.length) continue;
      actions.push({
        id: `intel-earn-${asOf}-${slug(event.symbol)}`,
        title: stalePrefix(earningsStale, earningsTitle(event)),
        detail: filled.length
          ? kpiDetail(event)
          : `${event.symbol} ${event.period}: KPI fields unpublished.`,
        numericAdvantage: earningsStale
          ? "Earnings stale"
          : filled.length
            ? `${filled.length} verified KPIs`
            : "0 filled KPIs",
        strategicAdvantage: earningsStale
          ? "Stale earnings snapshot"
          : "Only verified IR/NSE KPIs may populate values",
        sourceLabel: "Earnings",
        sourceKind: "source",
        lane: "monitor",
        tone: earningsStale ? "red" : "amber",
      });
    }
  }

  const seenTitles = new Set(actions.map((item) => normalizeActionKey(item.title)));
  let corpusMinted = 0;
  const digestHasPodcast = podItems.length > 0;
  for (const doc of newestFirst(options.corpusDocuments ?? [])) {
    if (corpusMinted >= CORPUS_SMART_ACTION_CAP) break;
    const receivedKey = doc.receivedAt.slice(0, 10);
    if (receivedKey !== asOf) continue;
    const title = doc.title.replace(/\s+/g, " ").trim();
    const titleKey = normalizeActionKey(title);
    if (!title || [...seenTitles].some((existing) => actionKeysCollide(existing, titleKey))) continue;
    if (!isRelevantActionCopy(title)) continue;
    if (doc.axisCategory === "live_webinars" || /webinar/i.test(title)) continue;
    const axisCategory = doc.axisCategory || classifyAxisCategory(title);
    const axisMintable = doc.family === "axis_research"
      && axisCategory !== "daily_morning_note"
      && axisCategory !== "live_webinars";
    const namedMail = namedNewsletterFamily(doc.family);
    const otherMail = doc.family === "newsletter_other";
    const podcastGap = doc.family === "podcasts" && !digestHasPodcast;
    if (!axisMintable && !namedMail && !otherMail && !podcastGap) continue;
    seenTitles.add(titleKey);
    const familyStale = corpusFamilyStale(doc.family, newslettersStale, axisStale, podcastsStale);
    actions.push({
      id: `intel-corpus-${asOf}-${slug(title)}`,
      title: stalePrefix(familyStale, title),
      detail: "Satya-indexed for this session. Open M-2; do not invent KPIs.",
      numericAdvantage: SMART_ACTIONS_LABEL,
      strategicAdvantage: "Machine-drafted from the Satya corpus as-of",
      sourceLabel: SMART_ACTIONS_LABEL,
      sourceKind: "smart",
      lane: "monitor",
      tone: familyStale ? "amber" : "blue",
    });
    corpusMinted += 1;
  }
  }

  return finalizeDailyActions(actions);
}

/** Workspace alias: M-1 may pass `{ content, earnings }`. */
export function generateIntelligenceKanbanItems(options: {
  content: ContentDigestSnapshot;
  earnings: EarningsSnapshot;
  now?: Date;
  calendarDate?: string;
}): KanbanItem[] {
  return buildIntelligenceDailyActions({
    content: options.content,
    earningsSnapshot: options.earnings,
    calendarDate: options.calendarDate ?? istDateKey(options.now ?? new Date()),
  });
}
