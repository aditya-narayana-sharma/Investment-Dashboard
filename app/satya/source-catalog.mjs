import {
  classifySatyaFamily,
  NAMED_NEWSLETTER_FAMILIES,
  parseMailSender,
  SATYA_FAMILY_LABELS,
  SATYA_SOURCE_FAMILIES,
  satyaSenderId,
} from "../../scripts/satya-classify.mjs";

export {
  classifySatyaFamily,
  NAMED_NEWSLETTER_FAMILIES,
  parseMailSender,
  SATYA_FAMILY_LABELS,
  SATYA_SOURCE_FAMILIES,
  satyaSenderId,
};

const LIVE_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;

function familyOf(item) {
  if (item?.family) return item.family;
  return classifySatyaFamily({
    mailbox: item?.mailbox,
    sender: item?.sender ?? item?.source,
    senderEmail: item?.senderEmail,
    subject: item?.subject ?? item?.title,
    title: item?.title,
    contentSource: item?.contentSource,
  });
}

function senderStatus(latestAt, messageCount) {
  if (messageCount <= 0 || !latestAt) return "empty";
  const parsed = Date.parse(latestAt);
  if (!Number.isFinite(parsed)) return "stale";
  return Date.now() - parsed <= LIVE_MAX_AGE_MS ? "live" : "stale";
}

export function buildSatyaCatalog(items = [], options = {}) {
  const asOf = options.asOf ?? new Date().toISOString();
  const senders = new Map();
  const familyCounts = new Map(SATYA_SOURCE_FAMILIES.map((family) => [family, 0]));

  for (const item of items) {
    const family = familyOf(item);
    const parsed = parseMailSender(item.sender ?? item.source ?? "");
    const senderEmail = item.senderEmail || parsed.email || undefined;
    const sender = parsed.name || item.source || "Unknown sender";
    const id = satyaSenderId(sender, senderEmail, family);
    const receivedAt = item.receivedAt ?? null;
    const increment = Math.max(1, Number(item.messageCount) || 1);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + increment);

    const existing = senders.get(id);
    if (!existing) {
      senders.set(id, {
        id,
        family,
        label: sender,
        sender,
        ...(senderEmail ? { senderEmail } : {}),
        messageCount: increment,
        latestAt: receivedAt,
        status: senderStatus(receivedAt, increment),
      });
      continue;
    }
    const latestAt = [existing.latestAt, receivedAt]
      .filter(Boolean)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
    existing.messageCount += increment;
    existing.latestAt = latestAt;
    existing.status = senderStatus(latestAt, existing.messageCount);
    if (senderEmail && !existing.senderEmail) existing.senderEmail = senderEmail;
  }

  return {
    asOf,
    families: SATYA_SOURCE_FAMILIES.map((family) => ({
      family,
      label: SATYA_FAMILY_LABELS[family],
      count: familyCounts.get(family) ?? 0,
    })),
    senders: [...senders.values()].sort((left, right) => {
      const byDate = Date.parse(right.latestAt ?? "") - Date.parse(left.latestAt ?? "");
      if (Number.isFinite(byDate) && byDate !== 0) return byDate;
      return left.label.localeCompare(right.label);
    }),
  };
}
