import type { ContentDigestSnapshot, ContentSourceState, DigestItem, SatyaSourceFamily } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import { earningsEventDateKey } from "../earnings-verify.ts";
import { axisMessageDateKey, istDateKey, lastNseTradingDay } from "../nse-trading-day.ts";
import { axisCategoryForItem } from "./digest-newsletter-groups.ts";
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

function itemsOnDate(items: DigestItem[], asOf: string) {
  const year = Number(asOf.slice(0, 4));
  return items.filter((item) => axisMessageDateKey(item, year) === asOf);
}

function filledKpis(event: EarningsSnapshot["events"][number]) {
  return event.kpis.filter((kpi) => kpi.value.trim());
}

function resultTitle(item: DigestItem) {
  const match = item.title.match(/^Result Update:\s*(.+?)(?:\s*[-–—]|$)/i);
  if (match?.[1]) return `${match[1].trim()} result update`;
  return `${item.title.replace(/\s+/g, " ").trim()} result update`;
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
  const lines = filled.map((kpi) => `${kpi.label} ${kpi.value}${kpi.change.trim() ? ` (${kpi.change.trim()})` : ""}`);
  return `${event.symbol} ${event.period}: ${lines.join("; ")}. Unpublished KPI fields stay blank. Calendar rows are scheduling evidence only.`;
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
  const asOf = intelligenceEvidenceDateKey(options.calendarDate ?? istDateKey());
  const { content, earningsSnapshot } = options;
  const newslettersStale = sourceNotLive(content.sources.newsletters);
  const axisStale = sourceNotLive(content.sources.axisResearch);
  const podcastsStale = sourceNotLive(content.sources.podcasts);
  const earningsStale = earningsSnapshot.status !== "verified";
  const axisItems = itemsOnDate(content.axisResearch, asOf);
  const newsItems = itemsOnDate(content.newsletters, asOf);
  const podItems = itemsOnDate(content.podcasts, asOf);
  const actions: KanbanItem[] = [];

  for (const item of axisItems) {
    const category = axisCategoryForItem(item);
    if (category === "daily_morning_note" || /daily morning note/i.test(item.title)) continue;
    if (RESULT_CATEGORIES.has(category)) {
      const title = resultTitle(item);
      actions.push({
        id: `intel-axis-result-${asOf}-${slug(item.title)}`,
        title: stalePrefix(axisStale, title),
        detail: item.summary || "Axis result-update mail. Do not invent KPIs.",
        numericAdvantage: axisStale ? "Axis stale" : "result update",
        strategicAdvantage: axisStale ? "Stale Axis mailbox — not live evidence" : "Extractive result note; unpublished figures stay blank",
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
        strategicAdvantage: axisStale ? "Stale Axis mailbox — not live evidence" : "Conviction is research opinion, not a live price",
        lane: "monitor",
        tone: axisStale ? "amber" : category === "target_achieved" || category === "axis_punch" ? "red" : "amber",
      });
    }
  }

  for (const item of newsItems) {
    actions.push({
      id: `intel-newsletter-${asOf}-${slug(`${item.source}-${item.title}`)}`,
      title: stalePrefix(newslettersStale, newsletterTitle(item)),
      detail: item.summary || "Newsletter theme from iCloud → Newsletters.",
      numericAdvantage: newslettersStale ? "Newsletters stale" : (item.sourceFamily ?? "newsletter"),
      strategicAdvantage: newslettersStale ? "Stale Newsletters mailbox" : "Named families remain Satya source of truth",
      lane: actionableLane(newslettersStale),
      tone: newslettersStale ? "amber" : "green",
    });
  }

  for (const item of podItems) {
    const evidence = item.contentSource === "transcript" ? "transcript" : "description";
    actions.push({
      id: `intel-podcast-${asOf}-${slug(`${item.source}-${item.title}`)}`,
      title: stalePrefix(podcastsStale, podcastTitle(item)),
      detail: item.summary || "Podcast episode in the Satya corpus window.",
      numericAdvantage: podcastsStale ? "Podcasts stale" : evidence,
      strategicAdvantage: podcastsStale ? "Stale podcasts source" : "Label as a transcript only when a local transcript existed",
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
          ? "Stale earnings snapshot — not fully verified"
          : "Only independently verified IR/NSE KPIs may populate values",
        lane: "monitor",
        tone: earningsStale ? "red" : "amber",
      });
    }
  }

  const seenTitles = new Set(actions.map((item) => item.title.replace(/^Stale · /, "").toLowerCase()));
  for (const doc of options.corpusDocuments ?? []) {
    const receivedKey = doc.receivedAt.slice(0, 10);
    if (receivedKey !== asOf) continue;
    const title = doc.title.replace(/\s+/g, " ").trim();
    if (!title || seenTitles.has(title.toLowerCase())) continue;
    seenTitles.add(title.toLowerCase());
    const familyLabel = doc.family === "podcasts"
      ? "Podcast"
      : doc.family === "axis_research"
        ? "Axis Research"
        : "Newsletter";
    const familyStale = corpusFamilyStale(doc.family, newslettersStale, axisStale, podcastsStale);
    actions.push({
      id: `intel-corpus-${asOf}-${slug(title)}`,
      title: stalePrefix(familyStale, `${familyLabel} · ${title}`),
      detail: "Indexed Satya corpus title for this trading day. Open Satya on M-2 for extractive context. Do not invent KPIs.",
      numericAdvantage: familyStale ? "Corpus stale" : "corpus as-of",
      strategicAdvantage: "Corpus-backed M-1 card; numbers stay in Mail/PDF/earnings SoT",
      lane: "monitor",
      tone: familyStale ? "amber" : "blue",
    });
  }

  return actions;
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
