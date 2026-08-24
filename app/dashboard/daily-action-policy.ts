import { isDigestPromoOrNoise } from "../digest-bullets.ts";
import type { KanbanItem, KanbanWorkspace } from "./types";

/** Composer-sparse caps so each workspace Action Board fits the viewport. */
export const ACTION_BOARD_CAPS = { today: 5, monitor: 8 } as const;

/** Max Satya-corpus Smart Actions after digest/earnings cards are minted. */
export const CORPUS_SMART_ACTION_CAP = 3;

export const SMART_ACTIONS_LABEL = "Smart Actions";

export const ACTION_TITLE_MAX = 72;
export const ACTION_DETAIL_MAX = 160;

const FAMILY_PREFIX =
  /^(?:stale\s*·\s*)?(?:newsletter|axis research|podcast|smart actions|satya|mail|kite|health|canvas|library|sectors|earnings|macro)\s*[·:-]\s*/i;

export function normalizeActionKey(title: string): string {
  let text = title.replace(FAMILY_PREFIX, "").trim();
  const senderSplit = text.split(/\s*[·|]\s+/);
  if (senderSplit.length > 1) text = senderSplit.slice(1).join(" ");
  return text
    .toLowerCase()
    .replace(/\b\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function actionKeysCollide(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 16 && longer.startsWith(shorter);
}

export function shortenActionTitle(title: string, max = ACTION_TITLE_MAX): string {
  const one = title.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1).replace(/\s+\S*$/, "").trimEnd()}…`;
}

export function shortenActionDetail(detail: string, max = ACTION_DETAIL_MAX): string {
  const cleaned = detail.replace(/\s+/g, " ").trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const limited = sentences.slice(0, 2).join(" ").trim();
  if (limited.length <= max) return limited;
  return `${limited.slice(0, max - 1).replace(/\s+\S*$/, "").trimEnd()}…`;
}

const INVITE_OR_WEBINAR =
  /you(?:'re| are) invited|join us for|virtual event|live webinar|\bwebinar\b|register now|save (?:your|the) (?:seat|spot)|book (?:a|your) (?:demo|seat)/i;

const PRODUCT_CTA =
  /worry-free retirement|dreaming of a|unlock wealth|start investing today|handpicked stocks|curated stock picks|exclusive picks/i;

export function isRelevantActionCopy(title: string, summary = ""): boolean {
  const headline = title.replace(/\s+/g, " ").trim();
  if (!headline || headline.length < 8) return false;
  if (isDigestPromoOrNoise(headline) || (summary && isDigestPromoOrNoise(summary))) return false;
  if (INVITE_OR_WEBINAR.test(headline) || INVITE_OR_WEBINAR.test(summary)) return false;
  if (PRODUCT_CTA.test(headline) || PRODUCT_CTA.test(summary)) return false;
  if (/daily morning note/i.test(headline)) return false;
  return true;
}

function sourceChrome(item: KanbanItem): Pick<KanbanItem, "sourceKind" | "sourceLabel" | "numericAdvantage"> {
  if (item.sourceKind === "smart") {
    return {
      sourceKind: "smart",
      sourceLabel: SMART_ACTIONS_LABEL,
      numericAdvantage: SMART_ACTIONS_LABEL,
    };
  }
  return {
    sourceKind: item.sourceKind ?? "source",
    sourceLabel: item.sourceLabel,
    numericAdvantage: item.numericAdvantage,
  };
}

function actionRank(item: KanbanItem): number {
  if (item.id.includes("intel-axis-result")) return 0;
  if (item.id.includes("intel-earn")) return 1;
  if (item.id.includes("intel-newsletter")) return 2;
  if (item.id.includes("intel-axis-conviction")) return 3;
  if (item.id.includes("intel-podcast")) return 4;
  if (item.sourceKind === "smart") return 5;
  return 6;
}

export function finalizeDailyActions(items: KanbanItem[]): KanbanItem[] {
  const ranked = [...items].sort((left, right) => actionRank(left) - actionRank(right));
  const seen = new Set<string>();
  const unique: KanbanItem[] = [];
  for (const item of ranked) {
    const chrome = sourceChrome(item);
    const next: KanbanItem = {
      ...item,
      ...chrome,
      title: shortenActionTitle(item.title),
      detail: shortenActionDetail(item.detail),
      strategicAdvantage: shortenActionDetail(item.strategicAdvantage, 96),
    };
    const key = normalizeActionKey(next.title);
    if (!key || [...seen].some((existing) => actionKeysCollide(existing, key))) continue;
    seen.add(key);
    unique.push(next);
  }
  const take = (lane: KanbanItem["lane"]) => unique.filter((item) => item.lane === lane).slice(0, ACTION_BOARD_CAPS[lane]);
  return [...take("today"), ...take("monitor")];
}

export function cardChromeLabel(item: KanbanItem): string {
  return item.sourceLabel ?? item.numericAdvantage;
}

export function cardChromeMeta(item: KanbanItem): string {
  if (item.sourceLabel && item.numericAdvantage !== item.sourceLabel) {
    return `${item.numericAdvantage} · ${item.strategicAdvantage}`;
  }
  return item.strategicAdvantage;
}

export function resolveWorkspaceKanbanItems(
  workspace: KanbanWorkspace,
  catalog: Record<KanbanWorkspace, KanbanItem[]>,
  items?: KanbanItem[],
): KanbanItem[] {
  return finalizeDailyActions(items ?? catalog[workspace]);
}
