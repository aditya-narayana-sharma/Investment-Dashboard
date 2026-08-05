/** Shared digest summary bullets for Market Intelligence (Mail, Axis, Podcasts, Earnings). */

export const DIGEST_BULLET_TARGET = 5;
export const DIGEST_BULLET_MAX = 8;

/**
 * Mail boilerplate + podcast CTA / promo / credit-roll lines.
 * Content takeaways only — never follow/subscribe/learn-more padding.
 */
const NOISE =
  /unsubscribe|disclaimer|market risks|contact us|view online|sign up|advertise|forward to your friends|read report|tap the link|click here|privacy policy|terms of (?:use|service)|manage preferences|open in (?:browser|app)|tldr together with|reality bites|^(?:follow|subscribe|check out|learn more|see|catch|support|listen|join|rate|share|send us|put your email)\b|follow (?:us|me|@)|follow\b.{0,80}\bon\b.{0,40}(?:twitter|x\b|instagram|tiktok|substack|facebook|linkedin|youtube)|subscribe (?:to|on|now|here|for)|(?:^|\b)subscribe\b.{0,40}(?:youtube|spotify|apple podcasts|patreon|substack|newsletter|channel)|patreon|sponsor(?:ed|ship)?\b|learn more\b|check out\b|see (?:more|show notes|omnystudio|acast|the (?:full|latest)|our)|catch (?:the )?latest|support .{0,60}(?:by|on|via|with)\b|leave a (?:rating|review)|rate (?:and|&) review|share (?:this|with friends)|join (?:our|the) (?:newsletter|mailing|patreon|discord|community)|mailing list|youtube channel|podcastchoices|ad choices|without ads|ad[- ]free|hosted on acast|our (?:editor|producer|intern|executive producer) is|theme music (?:is )?by|additional help from|read a transcript|transcript of this episode|for access to future|send us your (?:questions|comments)|visit (?:podcastchoices|omnystudio|acast|ft\.com|bloomberg\.com)|@\w{2,30}\b.{0,40}\b(?:twitter|x\b|instagram|tiktok|substack)|listen (?:and subscribe|on apple|on spotify)|available on (?:apple podcasts|spotify|youtube)|put your email|make you smart every day|informational purposes only|none of the (?:stocks|brands|products).{0,40}recommendations?|mentioned in this (?:podcast|episode)|we also send out|daily newsletter|^\d{1,2}:\d{2}\b|your morning briefing|top stories,? with context|all the news you need|business and finance news from|share this email|brought to you by|presented by|read in browser|welcome back[,.]|dear (?:reader|investor|client)\b|registered office|sebi registration|cin\s*:|gstin\s*:|zero entry barriers|international portfolio is waiting|diversify across top (?:us|global) stocks|as low as\s*\$\s*1\b|stop limiting your wealth|axis direct brings you|stories we(?:'|\u2019)?ll be tracking|take a look at some of the stories|hellyeah|\bbruh\b|\blmao\b|\bwtf\b|quick gut check|in partnership with|want a free |use code:|rozana sip|shop\b.{0,20}presented|buy you a stake|favourite global company|favorite global company|start investing today|retail broking|not a cup of coffee|not a magazine|unleash your investment|exclusive picks by axis|curated stock picks by axis|don’t miss out on these curated|don't miss out on these curated|you received this email because you subscribed|alert list\b|carefully before investing|only for consumption by the client|should not be redistributed|sebi research analyst|research analyst reg|in[hzap]\d{6,}|related documents carefully|compliance officer|for private circulation|not an offer to (?:buy|sell)|investment in securities market|past performance is not|mutual fund investments are subject|pop registration|portfolio manager reg|amfi\b|arn[-\s]?\d{4,}|mutual fund distributor|hope this email finds you|valued (?:investor|client)|handpicked stocks|unlock wealth|remarkable potential|assuring you the best|kindly refer to the attached|please find the attached|please review the attached|excited to (?:present|bring) you|thank you for taking the time to read|thriving in your investment journey|encourag(?:e|ing) you to examine these opportunities|best of our services at all times|let(?:'|\u2019)?s (?:shift our attention|delve into)|now let(?:'|\u2019)?s\b|what(?:'|\u2019)s the real return on slack|forrester total economic impact|made their money back in just six months|\$50m in efficiency gains|312% collective roi|whatsapp (?:us|me)\b|\bdm (?:us|me)\b|message us on|reach (?:us|out to us)\b|write to us\b|call our (?:helpline|support|team)|toll[- ]free\b|customer care\b|helpline number|scan the qr code|download (?:the|our) app\b|install (?:the|our) app\b|get the app\b|book (?:a|your) (?:demo|call|slot|seat)|schedule a (?:call|demo)|request a callback|\btelegram\b|\bdiscord\b|snapchat/i;

/** Provenance / scheduling labels — never used as content summary bullets for Mail or Podcasts. */
const PROVENANCE_LINE =
  /^(?:headline|source|show|as of|received|published|reminders list|calendar|topic|starts|ends|due|episode|reminder|event|list|schedule|status|marked)\s*:/i;

const EMAIL_LIKE =
  /(?:\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\[email redacted\]|\b\w{1,12}@\w{2,})/i;

/** Bare company / ticker labels without explanatory content. */
const BARE_NAME_LINE =
  /^(?:Nifty(?:\s*50)?|Sensex|[A-Z][A-Za-z0-9.&'/-]*(?:\s+[A-Z][A-Za-z0-9.&'/-]*){0,5}(?:\s+(?:Ltd|Limited|Inc|Corp|Corporation|Plc|Bank|Hotels?))?)\.?$/;

/** International/US-style phone numbers — beyond the India-only 10-digit mobile format. */
const PHONE_INTL_PREFIX = /\+\d{1,3}[\s.-]?\(?\d{1,5}\)?(?:[\s.-]?\d{2,5}){1,4}\b/g;
const PHONE_PARENS_AREA = /\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
const PHONE_TRIPLE_GROUP = /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g;

/**
 * Bare domain tokens embedded mid-sentence (no scheme) — website links must never leak into
 * content. Deliberately excludes ambiguous short suffixes ("in", "co") that collide with common
 * English words when a sentence-ending period is glued to the next word without a space.
 */
const BARE_DOMAIN_INLINE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,}(?:com|org|net|io|gov|edu|info|biz|ai|app|news|xyz|substack)\b(?:\/[^\s)]*)?/gi;

function stripContactDetails(value: string) {
  return String(value ?? "")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/\[email redacted\]/gi, " ")
    .replace(/\b\w{1,12}@\w{2,}/g, " ")
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, " ")
    .replace(PHONE_INTL_PREFIX, " ")
    .replace(PHONE_PARENS_AREA, " ")
    .replace(PHONE_TRIPLE_GROUP, " ")
    .replace(BARE_DOMAIN_INLINE, " ");
}

function cleanFragment(value: string) {
  return stripContactDetails(
    String(value ?? "")
      .replace(/[\u200B-\u200D\uFEFF\u00A0\uFFFC]/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/g, " "),
  )
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—•·*]+/, "")
    .replace(/\s*[·•]\s*$/, "")
    .trim();
}

function normalizeKey(value: string) {
  return cleanFragment(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function wordCount(value: string) {
  return cleanFragment(value).split(/\s+/).filter(Boolean).length;
}

function hasFinancialSignal(value: string) {
  return /(?:₹|rs\.?\s*\d|%\s*(?:yoy|qoq|mom)?|\b(?:yoy|qoq|bps|crore|cr\b|tp|target|pat|revenue|nifty|sensex|buy|sell|hold|reduce|add)\b|\d{2,}(?:\.\d+)?\s*%)/i.test(
    value,
  );
}

/**
 * True when a fragment is a grammatical content takeaway about a real topic —
 * not a CTA, address block, slang blurt, incomplete heading, or email residue.
 */
export function isDigestContentWorthy(value: string): boolean {
  const item = cleanFragment(value);
  if (!item) return false;
  if (isDigestPromoOrNoise(item) || PROVENANCE_LINE.test(item)) return false;
  if (EMAIL_LIKE.test(item)) return false;
  if (/[.!?…,:;]\s*$/.test(item) === false && item.endsWith(":")) return false;
  if (BARE_NAME_LINE.test(item)) return false;
  if (/^[\W\d_\s]+$/.test(item)) return false;
  // Truncated / glued OCR-ish residue.
  if (/\b\w{1,2}@[a-z]/i.test(item)) return false;
  if (/(?:^|\s)(?:okay no seriously|all i can see is drum rolls)/i.test(item)) return false;

  const words = wordCount(item);
  if (words < 5 && !hasFinancialSignal(item)) return false;
  if (words < 3) return false;

  // Prefer prose / claims: at least one verb-ish token or a clear metric clause.
  const looksProse =
    /\b(?:is|are|was|were|be|been|being|has|have|had|will|would|can|could|may|might|should|do|does|did|said|says|closed|rose|fell|grew|cut|hit|missed|beat|raised|launched|announced|reported|expects?|expected|discuss(?:es|ed)?|explore(?:s|d)?|cover(?:s|ed)?|marks?|prompted|forced|agreed|claimed|threatened|stayed|remained|led|kept|pushed|weighed|formed|extended|joined|delayed|printed|due|jumped|sold|delivered|held|argue(?:s|d)?|explain(?:s|ed)?|interview(?:s|ed)?|talk(?:s|ed)?|examine(?:s|d)?|walk(?:s|ed)?\s+through|break(?:s|ing)?\s+down|look(?:s|ed)?\s+at|dig(?:s|ging)?\s+into|debate(?:s|d)?|unpack(?:s|ed)?|highlight(?:s|ed)?|warn(?:s|ed)?)\b/i.test(
      item,
    ) || hasFinancialSignal(item);
  if (!looksProse && words < 8) return false;

  // Reject irregular shouty fragments and trailing-comma transition stubs.
  if (/^[A-Z0-9 ?!]{0,40}$/.test(item) && /(?:\?|!)/.test(item) && words <= 6) return false;
  if (/,\s*$/.test(item)) return false;
  return true;
}

/** True when a candidate is CTA, promo, credit-roll, or empty — not episode/mail content. */
export function isDigestPromoOrNoise(value: string): boolean {
  const item = cleanFragment(value);
  if (!item) return true;
  if (NOISE.test(item)) return true;
  if (EMAIL_LIKE.test(item)) return true;
  // Bare URL / handle leftovers after URL stripping.
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(item)) return true;
  if (/^@\w+$/i.test(item)) return true;
  if (BARE_NAME_LINE.test(item)) return true;
  if (/^red flags to watch out for:?$/i.test(item)) return true;
  // Registration / licence residue after SEBI chrome stripping.
  if (/\b(?:IN[HZAP]|POP)\d{5,}\b/i.test(item) && wordCount(item) <= 16) return true;
  return false;
}

/**
 * Accept locally available transcript text only. Publisher descriptions are
 * metadata and must never become summary content.
 */
export function preferPodcastContentSource(
  transcript?: string | null,
  description?: string | null,
): { text: string; source: "transcript" | "none" } {
  const transcriptText = cleanFragment(String(transcript ?? "").replace(/\n+/g, "\n")).trim();
  if (transcriptText.length >= 40) {
    return { text: String(transcript ?? "").trim(), source: "transcript" };
  }
  void description;
  return { text: "", source: "none" };
}

/** Strip common newsletter / Axis / podcast chrome before sentence extraction. */
export function stripDigestChrome(text: string): string {
  return stripContactDetails(
    String(text ?? "")
      .replace(/\uFFFC/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/g, " "),
  )
    .replace(/\r\n?/g, "\n")
    .replace(/(?:^|\n)\s*(?:sign up|advertise|view online|shop|read online|read in browser)(?:\s*[|/]\s*(?:sign up|advertise|view online|shop|read online))*\s*(?:\n|$)/gi, "\n")
    .replace(/(?:^|\n)\s*(?:share this email|brought to you by|presented by|forward to your friends|tldr together with)[^\n]*/gi, "\n")
    .replace(/(?:^|\n)\s*registered office address[^\n]*/gi, "\n")
    .replace(/(?:^|\n)\s*learn more about your ad choices[^\n]*/gi, "\n")
    // Podcast credit-roll / promo tails — keep editorial body only.
    .replace(/(?:^|\n)\s*(?:mentioned in this (?:podcast|episode)|links?(?:\s+(?:and|&)\s+resources)?|show notes|production credits?|credits?)\s*:?\s*[\s\S]*$/i, "\n")
    .replace(/(?:^|\n)\s*(?:follow (?:us|me|@)|subscribe to|support .{0,60}(?:by|on|via|with)\b|listen (?:and subscribe|on apple|on spotify)|join (?:our|the)|rate (?:and|&) review|share (?:this|with)|send us your|check out (?:our|the|more)|learn more about|visit (?:podcastchoices|omnystudio|acast)|hosted on|available on (?:apple|spotify|youtube)|catch the latest)[^\n]*/gi, "\n")
    .replace(/(?:^|\n)\s*(?:our (?:editor|producer|intern|executive producer) is|theme music|additional help from|this episode (?:was )?(?:produced|edited) by)[^\n]*/gi, "\n")
    .replace(/\b(?:on today(?:'|\u2019)?s (?:show|podcast|episode)|in this episode|today(?:'|\u2019)?s topics?(?:\s+include)?)\s*:?\s*/gi, "")
    .trim();
}

/** Split source text into candidate bullet fragments without inventing claims. */
export function extractContentBullets(text: string, limit = DIGEST_BULLET_MAX): string[] {
  const source = stripDigestChrome(text);
  if (!source) return [];

  const chunks: string[] = [];
  for (const line of source.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\s*(?:\(?\d+[).:]|[-–—*•·]|[a-z][).])\s+/i.test(trimmed)) {
      chunks.push(trimmed.replace(/^\s*(?:\(?\d+[).:]|[-–—*•·]|[a-z][).])\s+/i, ""));
      continue;
    }
    // Inline numbered show notes: "On today's podcast:(1) ... (2) ..."
    if (/\(\d+[).]/.test(trimmed) || /(?:^|\s)\d+[).]\s+\S/.test(trimmed)) {
      for (const part of trimmed.split(/(?=\(\d+[).])|(?=(?:^|\s)\d+[).]\s+)/)) {
        const cleaned = part.replace(/^\s*(?:\(?\d+[).:]|[a-z][).])\s*/i, "").trim();
        if (cleaned) chunks.push(cleaned);
      }
      continue;
    }
    for (const part of trimmed.split(/\s*[·|•]\s*/)) {
      if (part.trim()) chunks.push(part);
    }
  }

  const sentenceSplit = source
    .replace(/\n+/g, " ")
    .replace(/\b(U\.S|U\.K|E\.U|Mr|Mrs|Ms|Dr|Prof|Inc|Ltd|Jr|Sr)\./gi, "$1\u2024")
    .split(/(?<=[.!?])\s+|(?<=;)\s+/)
    .map((part) => part.replace(/\u2024/g, ".").trim())
    .filter(Boolean);
  for (const sentence of sentenceSplit) chunks.push(sentence);

  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const raw of chunks) {
    const item = cleanFragment(raw);
    if (item.length < 18 || item.length > 280) continue;
    if (!isDigestContentWorthy(item)) continue;
    const key = normalizeKey(item);
    if (!key || seen.has(key)) continue;
    // Drop near-duplicates / truncated prefixes already kept.
    if ([...seen].some((existing) => existing.length > 24 && (existing.startsWith(key) || key.startsWith(existing)))) continue;
    seen.add(key);
    bullets.push(item.length > 220 ? `${item.slice(0, 217).trim()}…` : item);
    if (bullets.length >= limit) break;
  }
  return bullets;
}

function pushUnique(target: string[], seen: Set<string>, value: string | undefined | null, minLength = 8) {
  const item = cleanFragment(value ?? "");
  if (item.length < minLength) return;
  if (!isDigestContentWorthy(item) && !hasFinancialSignal(item)) return;
  if (isDigestPromoOrNoise(item) || PROVENANCE_LINE.test(item) || EMAIL_LIKE.test(item)) return;
  const key = normalizeKey(item);
  if (!key || seen.has(key)) return;
  seen.add(key);
  target.push(item.length > 220 ? `${item.slice(0, 217).trim()}…` : item);
}

export type DigestBulletContext = {
  title?: string;
  summary?: string;
  bullets?: string[] | null;
  source?: string;
  time?: string;
  detail?: string;
  notes?: string;
  list?: string;
  calendar?: string;
  topic?: string;
  dueAt?: string;
  startsAt?: string;
  endsAt?: string;
  kind?: "mail" | "podcast" | "calendar" | "reminder" | "earnings" | "generic";
};

/**
 * Content-only summary bullets for Mail / Axis / Podcasts.
 * Never pads with provenance (source, mailbox, show, timestamps, calendar metadata).
 * Calendar and Reminder kinds always return [] — those feeds render title/meta only.
 */
export function digestItemBullets(
  item: DigestBulletContext,
  opts: { target?: number; max?: number } = {},
): string[] {
  const max = opts.max ?? DIGEST_BULLET_MAX;
  const kind = item.kind ?? "generic";

  if (kind === "calendar" || kind === "reminder") return [];

  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const existing of item.bullets ?? []) {
    if (!isDigestContentWorthy(existing)) continue;
    pushUnique(bullets, seen, existing);
    if (bullets.length >= max) break;
  }

  if (bullets.length < max) {
    const bodyPools = [item.summary, item.detail, item.notes].filter(Boolean).join("\n");
    for (const extracted of extractContentBullets(bodyPools, max)) {
      pushUnique(bullets, seen, extracted);
      if (bullets.length >= max) break;
    }
  }

  // Prefer real content only — do not pad to target with Headline/Source/As of fillers.
  return bullets.slice(0, max);
}

export type EarningsBulletEvent = {
  symbol: string;
  name: string;
  date: string;
  period: string;
  state: string;
  reported: boolean;
  portfolio: boolean;
  summary?: string;
  source?: string;
  kpis: Array<{ label: string; value: string; change: string }>;
};

/**
 * Narrative / content bullets for an earnings day item.
 * Prefers IR summary prose; KPI lines are written as short explanations.
 * Calendar meta (schedule, holding flag, source URL) is omitted — shown elsewhere in the UI.
 */
export function earningsEventBullets(event: EarningsBulletEvent): string[] {
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const extracted of extractContentBullets(event.summary ?? "", DIGEST_BULLET_MAX)) {
    pushUnique(bullets, seen, extracted);
    if (bullets.length >= DIGEST_BULLET_MAX) break;
  }

  for (const kpi of event.kpis) {
    if (!kpi.value) continue;
    const label = cleanFragment(kpi.label);
    const value = cleanFragment(kpi.value);
    const change = cleanFragment(kpi.change);
    if (!label || !value) continue;
    const narrative = change
      ? `${event.name} ${label} printed at ${value} (${change}) for ${event.period}.`
      : `${event.name} ${label} printed at ${value} for ${event.period}.`;
    pushUnique(bullets, seen, narrative, 16);
    if (bullets.length >= DIGEST_BULLET_MAX) break;
  }

  if (event.reported && bullets.length < DIGEST_BULLET_TARGET) {
    pushUnique(
      bullets,
      seen,
      `${event.name} (${event.symbol}) reported ${event.period}; unpublished KPI fields stay blank.`,
      16,
    );
  } else if (!event.reported && bullets.length < DIGEST_BULLET_TARGET) {
    pushUnique(
      bullets,
      seen,
      `${event.name} (${event.symbol}) is due ${event.date}; treat the calendar date as scheduling evidence until IR/NSE confirms publication.`,
      16,
    );
  }

  return bullets.slice(0, DIGEST_BULLET_MAX);
}
