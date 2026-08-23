import { AXIS_RESEARCH_SENDER, isAxisLiveWebinarSubject, isAxisResearchMail, isNonResearchSubject } from "./axis-mail-filter.mjs";
import { classifyAxisCategory } from "../app/satya/axis-categories.mjs";

/** @typedef {"axis_research" | "axis_mutual_fund" | "groww_digest" | "flipboard_tech" | "newsletter_other" | "podcasts"} SatyaSourceFamily */

export const SATYA_SOURCE_FAMILIES = Object.freeze([
  "axis_research",
  "axis_mutual_fund",
  "groww_digest",
  "flipboard_tech",
  "newsletter_other",
  "podcasts",
]);

export const SATYA_FAMILY_LABELS = Object.freeze({
  axis_research: "Axis Research",
  axis_mutual_fund: "Axis Mutual Fund",
  groww_digest: "Groww Digest",
  flipboard_tech: "Flipboard Tech",
  newsletter_other: "Other newsletters",
  podcasts: "Podcasts",
});

/** Named families that live inside iCloud → Newsletters (not a third mailbox). */
export const NAMED_NEWSLETTER_FAMILIES = Object.freeze([
  "axis_mutual_fund",
  "groww_digest",
  "flipboard_tech",
]);

export const SATYA_FAMILY_BOOST = Object.freeze({
  axis_research: 1.45,
  axis_mutual_fund: 1.35,
  groww_digest: 1.3,
  flipboard_tech: 1.3,
  podcasts: 1.05,
  newsletter_other: 0.75,
});

const AXIS_MF_NAME = /\baxis\s*(?:mutual\s*fund|mf\b|amc\b|asset\s*management)\b/i;
const AXIS_MF_DOMAIN = /@(?:[\w.-]+\.)?(?:axismf|axismutualfund|axisamc)\.(?:in|com)\b/i;
/** Subject prefix only — a mid-subject mention from another sender stays `newsletter_other`. */
const AXIS_MF_SUBJECT_PREFIX = /^(?:\[?\s*(?:fwd|fw|re)\s*\]?\s*[:\-]?\s*)*axis\s*(?:mutual\s*fund|mf\b|amc\b)/i;
const AXIS_DIRECT_BROKERAGE = /(?:\baxis\s*direct\b|@(?:[\w.-]+\.)?(?:axisdirect|axissecurities)\.(?:in|com)\b)/i;

const GROWW_NAME = /\bgroww\b/i;
const GROWW_DOMAIN = /@(?:[\w.-]+\.)?groww\.(?:in|com)\b/i;
const GROWW_DIGEST_MARK = /\b(?:groww\s+digest|daily\s+digest|market\s+digest|editorial)\b/i;

const FLIPBOARD_NAME = /\bflipboard\b/i;
const FLIPBOARD_DOMAIN = /@(?:[\w.-]+\.)?flipboard\.(?:com|net)\b/i;
const FLIPBOARD_TECH = /\btech\s+briefing\b/i;

/** Same promotional-message patterns as scripts/content-digest-server.mjs isPromotionalMessage. */
const PROMOTIONAL_MESSAGE =
  /\*{3,}\s*spam\s*\*{3,}|today(?:'|\u2019)s paper|daily newspaper is now ready|read complete epaper|micro investing|invest ₹?1,?000|invest today|start investing today|webinar|masterclass|workshop|wealth expo|wealth gathering|limited[- ]time offer|exclusive offer|special offer|register now|book your seat|buy now|shop now|unlock (?:your )?(?:wealth|investment)|gift city.{0,80}(?:summit|conference)|where the conversations shaping|axis mutual fund.{0,80}(?:invest|sip|fund)|meet axis direct learn|explore [^.!?]{0,60}\bfund\b|iphone upgrade you didn(?:'|\u2019)t know you needed|find the right partnership for your brand|want to invest ₹/i;

function slugPart(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

export function isSatyaSourceFamily(value) {
  return SATYA_SOURCE_FAMILIES.includes(value);
}

export function parseMailSender(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  const angle = text.match(/^(.*?)\s*<([^>]+@[^>]+)>\s*$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    const email = angle[2].trim().toLowerCase();
    return { name: name || email.split("@")[0], email, raw: text };
  }
  const emailOnly = text.match(/^[^\s<]+@[^\s>]+$/);
  if (emailOnly) {
    return { name: text.split("@")[0], email: text.toLowerCase(), raw: text };
  }
  return { name: text || "Unknown sender", email: "", raw: text };
}

export function satyaSenderId(name, email, family) {
  const familyKey = isSatyaSourceFamily(family) ? family : "newsletter_other";
  return `${familyKey}:${slugPart(name)}:${slugPart(email || "none")}`;
}

function normalizeMailbox(mailbox) {
  return String(mailbox ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
}

function isAxisDirectBrokerage(sender, email) {
  const haystack = `${sender} ${email}`;
  if (AXIS_MF_NAME.test(haystack) || AXIS_MF_DOMAIN.test(haystack)) return false;
  return AXIS_DIRECT_BROKERAGE.test(haystack) || AXIS_RESEARCH_SENDER.test(haystack);
}

export function matchesAxisMutualFund({ sender = "", senderEmail = "", subject = "" } = {}) {
  if (isNonResearchSubject(subject)) return false;
  const haystack = `${sender} ${senderEmail} ${subject}`;
  if (isAxisDirectBrokerage(sender, senderEmail)) return false;
  const nameOrDomain = AXIS_MF_NAME.test(`${sender} ${senderEmail}`) || AXIS_MF_DOMAIN.test(senderEmail) || AXIS_MF_DOMAIN.test(sender);
  const subjectPrefix = AXIS_MF_SUBJECT_PREFIX.test(String(subject).trim());
  return nameOrDomain || (subjectPrefix && !AXIS_DIRECT_BROKERAGE.test(haystack));
}

export function matchesGrowwDigest({ sender = "", senderEmail = "", subject = "" } = {}) {
  const identity = GROWW_NAME.test(sender) || GROWW_DOMAIN.test(sender) || GROWW_DOMAIN.test(senderEmail);
  if (!identity) return false;
  return GROWW_DIGEST_MARK.test(`${sender} ${subject}`) || /\bdigest\b/i.test(sender);
}

export function matchesFlipboardTech({ sender = "", senderEmail = "", subject = "" } = {}) {
  const identity = FLIPBOARD_NAME.test(sender) || FLIPBOARD_DOMAIN.test(sender) || FLIPBOARD_DOMAIN.test(senderEmail);
  if (!identity) return false;
  return FLIPBOARD_TECH.test(`${sender} ${subject}`) || FLIPBOARD_TECH.test(sender);
}

/**
 * Classify a Mail/podcast item into a Satya family.
 * Axis Research is mailbox-backed. Named families match inside Newsletters only.
 *
 * @param {{
 *   mailbox?: string,
 *   sender?: string,
 *   senderEmail?: string,
 *   subject?: string,
 *   title?: string,
 *   contentSource?: string,
 * }} input
 * @returns {SatyaSourceFamily}
 */
export function classifySatyaFamily(input = {}) {
  const contentSource = String(input.contentSource ?? "").toLowerCase();
  const mailbox = normalizeMailbox(input.mailbox);
  if (
    contentSource === "podcast"
    || contentSource === "podcasts"
    || contentSource === "transcript"
    || contentSource === "description"
    || mailbox === "podcasts"
    || mailbox === "apple podcasts"
  ) {
    return "podcasts";
  }
  if (mailbox === "axis research" || mailbox === "axisresearch") return "axis_research";

  const parsed = parseMailSender(input.sender);
  const senderEmail = String(input.senderEmail || parsed.email || "");
  const subject = String(input.subject ?? input.title ?? "");
  const senderRaw = String(input.sender ?? parsed.name ?? "");

  if (matchesAxisMutualFund({ sender: senderRaw, senderEmail, subject })) return "axis_mutual_fund";
  if (matchesGrowwDigest({ sender: senderRaw, senderEmail, subject })) return "groww_digest";
  if (matchesFlipboardTech({ sender: senderRaw, senderEmail, subject })) return "flipboard_tech";
  return "newsletter_other";
}

export function isSatyaPromotionalMessage({ subject = "", sender = "", content = "", summary = "", bullets = [] } = {}) {
  const title = String(subject ?? "");
  const source = String(sender ?? "");
  const body = [content, summary, ...(Array.isArray(bullets) ? bullets : [])].filter(Boolean).join(" ");
  if (PROMOTIONAL_MESSAGE.test(`${source} ${title} ${body}`)) return true;
  if (!(Array.isArray(bullets) && bullets.length) && /read|paper|edition|digest|alert|notification/i.test(title) && !matchesGrowwDigest({ sender: source, subject: title })) {
    const hasBody = String(body).replace(/\s+/g, " ").trim().length >= 80;
    if (!hasBody) return true;
  }
  return false;
}

/**
 * Skip promo-only / KYC / contract-note mail using the same rules as the M-2 digest.
 * Axis Research items must still pass isAxisResearchMail.
 */
export function shouldIndexSatyaDocument(input = {}) {
  const mailbox = normalizeMailbox(input.mailbox);
  const subject = String(input.subject ?? input.title ?? "");
  const sender = String(input.sender ?? "");
  const axisCategory = input.axisCategory
    || (mailbox === "axis research" ? classifyAxisCategory(subject) : "");
  const liveWebinar = axisCategory === "live_webinars" || isAxisLiveWebinarSubject(subject);

  if (isNonResearchSubject(subject)) return false;
  if (mailbox === "axis research" && !isAxisResearchMail({ sender, subject })) return false;

  if (mailbox === "axis research" && liveWebinar) {
    return subject.replace(/\s+/g, " ").trim().length >= 8;
  }

  if (isSatyaPromotionalMessage(input)) return false;

  const bullets = Array.isArray(input.bullets) ? input.bullets : [];
  const text = [input.summary, input.sanitizedText, input.content, ...bullets]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length >= 40 || bullets.length > 0;
}
