import {
  AXIS_RESEARCH_CATEGORIES,
  axisCategoryLabel,
  classifyAxisCategory,
  isAxisResearchCategoryId,
} from "../satya/axis-categories.ts";
import { classifySatyaFamily, NAMED_NEWSLETTER_FAMILIES } from "../satya/source-catalog.ts";
import type { AxisResearchCategoryId, DigestItem, SatyaSourceFamily } from "../content-types";

export type DigestKind = "mail" | "podcast";
export type DigestGroupLayout = "mail" | "axis" | "podcasts";
export type NewsletterFamily = Extract<
  SatyaSourceFamily,
  "axis_mutual_fund" | "groww_digest" | "flipboard_tech" | "newsletter_other"
>;

export type DigestItemGroup = {
  label: string;
  items: DigestItem[];
  categoryId?: AxisResearchCategoryId;
  colorToken?: string;
};

export type NewsletterFamilyGroup = DigestItemGroup & {
  family: NewsletterFamily;
};

export const SENDER_GROUP_COLORS = [
  "#4f8ff7",
  "#35c98b",
  "#f0b429",
  "#ef6a78",
  "#9b7de3",
  "#35b6c8",
  "#ef8f61",
  "#ca70ae",
];

function namedNewsletterLabel(family: string): string {
  switch (family) {
    case "axis_mutual_fund":
      return "Axis Mutual Fund";
    case "groww_digest":
      return "Groww Digest";
    case "flipboard_tech":
      return "Flipboard Tech Briefing";
    default:
      return family;
  }
}

export function digestSender(item: DigestItem, kind: DigestKind) {
  const sender = item.source.trim();
  if (sender) return sender;
  return kind === "podcast" ? "Unknown show" : "Unknown sender";
}

export function axisCategoryForItem(item: DigestItem): AxisResearchCategoryId {
  if (item.axisCategory && isAxisResearchCategoryId(item.axisCategory)) return item.axisCategory;
  return classifyAxisCategory(item.title);
}

export function axisTopicFromTitle(title: string) {
  return axisCategoryLabel(classifyAxisCategory(title));
}

export function digestGroupLabel(item: DigestItem, kind: DigestKind, layout: DigestGroupLayout) {
  switch (layout) {
    case "axis":
      return axisCategoryLabel(axisCategoryForItem(item));
    case "mail":
    case "podcasts":
      return digestSender(item, kind);
    default: {
      const _exhaustive: never = layout;
      return _exhaustive;
    }
  }
}

export function senderGroupColor(sender: string) {
  const hash = Array.from(sender).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return SENDER_GROUP_COLORS[hash % SENDER_GROUP_COLORS.length];
}

function asNewsletterFamily(value: string | undefined): NewsletterFamily | undefined {
  switch (value) {
    case "axis_mutual_fund":
    case "groww_digest":
    case "flipboard_tech":
    case "newsletter_other":
      return value;
    default:
      return undefined;
  }
}

/** Prefer ingest `sourceFamily`; old snapshots fall back to the shared Satya classifier. */
export function resolveNewsletterFamily(item: DigestItem): NewsletterFamily {
  const tagged = asNewsletterFamily(item.sourceFamily);
  if (tagged) return tagged;
  return asNewsletterFamily(classifySatyaFamily({
    mailbox: "Newsletters",
    sender: item.source,
    subject: item.title,
    title: item.title,
  })) ?? "newsletter_other";
}

export function groupNewsletterItems(items: DigestItem[]): NewsletterFamilyGroup[] {
  const named = NAMED_NEWSLETTER_FAMILIES
    .map((family) => {
      const panel = asNewsletterFamily(family);
      if (!panel || panel === "newsletter_other") return null;
      return {
        family: panel,
        label: namedNewsletterLabel(panel),
        items: [] as DigestItem[],
      };
    })
    .filter((group): group is NewsletterFamilyGroup => Boolean(group));
  const otherBySender = new Map<string, DigestItem[]>();
  for (const item of items) {
    const family = resolveNewsletterFamily(item);
    const namedGroup = named.find((group) => group.family === family);
    if (namedGroup) {
      namedGroup.items.push(item);
      continue;
    }
    const sender = digestSender(item, "mail");
    otherBySender.set(sender, [...(otherBySender.get(sender) ?? []), item]);
  }
  const others: NewsletterFamilyGroup[] = Array.from(otherBySender, ([label, groupItems]) => ({
    family: "newsletter_other",
    label,
    items: groupItems,
  }));
  return [...named.filter((group) => group.items.length > 0), ...others];
}

export function newsletterFamilyCounts(items: DigestItem[]): Partial<Record<SatyaSourceFamily, number>> {
  const counts: Partial<Record<SatyaSourceFamily, number>> = {
    axis_mutual_fund: 0,
    groww_digest: 0,
    flipboard_tech: 0,
    newsletter_other: 0,
  };
  for (const item of items) {
    const family = resolveNewsletterFamily(item);
    counts[family] = (counts[family] ?? 0) + 1;
  }
  return counts;
}

export function groupAxisResearchItems(items: DigestItem[]): DigestItemGroup[] {
  const byId = new Map<AxisResearchCategoryId, DigestItem[]>();
  for (const item of items) {
    const id = axisCategoryForItem(item);
    byId.set(id, [...(byId.get(id) ?? []), item]);
  }
  return AXIS_RESEARCH_CATEGORIES
    .filter((category) => (byId.get(category.id as AxisResearchCategoryId) ?? []).length > 0)
    .map((category) => ({
      categoryId: category.id as AxisResearchCategoryId,
      label: category.label,
      colorToken: category.colorToken,
      items: byId.get(category.id as AxisResearchCategoryId) ?? [],
    }));
}

export function groupDigestItems(items: DigestItem[], kind: DigestKind, layout: DigestGroupLayout): DigestItemGroup[] {
  if (layout === "axis") return groupAxisResearchItems(items);
  const groups = new Map<string, DigestItem[]>();
  items.forEach((item) => {
    const label = digestGroupLabel(item, kind, layout);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  });
  return Array.from(groups, ([label, groupItems]) => ({ label, items: groupItems }));
}

export function digestItemId(item: DigestItem) {
  return `${item.receivedAt ?? item.time}|${item.source}|${item.title}`;
}
