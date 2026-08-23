/**
 * Canonical Axis Research subject categories (28 named + other_research).
 * One matcher for digest grouping, PDF archive hints, and Satya retrieval.
 * Scripts and the app both import this file — do not duplicate TOPIC_RULES.
 */

/** @typedef {typeof AXIS_RESEARCH_CATEGORIES[number]["id"]} AxisResearchCategoryId */

/**
 * @typedef {{
 *   id: AxisResearchCategoryId,
 *   label: string,
 *   matchers: RegExp[],
 *   colorToken: string,
 *   defaultRetrieve: boolean,
 * }} AxisResearchCategory
 */

function colorTokenFor(id) {
  return `--axis-cat-${String(id).replaceAll("_", "-")}`;
}

/**
 * Most-specific subject matchers first. Labels are the operator-facing names.
 * `live_webinars` is classified but excluded from default Satya retrieval.
 */
export const AXIS_RESEARCH_CATEGORIES = Object.freeze([
  {
    id: "live_webinars",
    label: "Live Webinars",
    matchers: [/\blive\s+webinars?\b/i, /\bwebinars?\b/i],
    colorToken: colorTokenFor("live_webinars"),
    defaultRetrieve: false,
  },
  {
    id: "quarterly_result_updates",
    label: "Quarterly Result Updates",
    matchers: [/\bquarterly result updates?\b/i, /\bresult updates\b/i],
    colorToken: colorTokenFor("quarterly_result_updates"),
    defaultRetrieve: true,
  },
  {
    id: "monthly_technical_outlook_picks",
    label: "Monthly Technical Outlook & Picks",
    matchers: [/\bmonthly technical outlook\b/i],
    colorToken: colorTokenFor("monthly_technical_outlook_picks"),
    defaultRetrieve: true,
  },
  {
    id: "daily_technical_outlook",
    label: "Daily Technical Outlook",
    matchers: [/\bdaily technical outlook\b/i],
    colorToken: colorTokenFor("daily_technical_outlook"),
    defaultRetrieve: true,
  },
  {
    id: "daily_stock_derivative_lens",
    label: "Daily Stock Derivative Lens",
    matchers: [/\bstock derivative lens\b/i, /\bderivative lens\b/i],
    colorToken: colorTokenFor("daily_stock_derivative_lens"),
    defaultRetrieve: true,
  },
  {
    id: "daily_derivatives_insights",
    label: "Daily Derivatives Insights",
    matchers: [/\bdaily derivatives insights?\b/i],
    colorToken: colorTokenFor("daily_derivatives_insights"),
    defaultRetrieve: true,
  },
  {
    id: "weekly_derivatives_insights",
    label: "Weekly Derivatives Insights",
    matchers: [/\bweekly derivatives insights?\b/i],
    colorToken: colorTokenFor("weekly_derivatives_insights"),
    defaultRetrieve: true,
  },
  {
    id: "weekly_technical_picks",
    label: "Weekly Technical Picks",
    matchers: [/\bweekly technical picks?\b/i],
    colorToken: colorTokenFor("weekly_technical_picks"),
    defaultRetrieve: true,
  },
  {
    id: "auto_monthly_sales_volume",
    label: "Auto Monthly Sales Volume",
    matchers: [/\bauto monthly sales\b/i, /\bmonthly sales volume\b/i, /\bmonthly auto monitor\b/i],
    colorToken: colorTokenFor("auto_monthly_sales_volume"),
    defaultRetrieve: true,
  },
  {
    id: "monthly_quant_report",
    label: "Monthly Quant Report",
    matchers: [/\bmonthly quant\b/i, /\bquant report\b/i],
    colorToken: colorTokenFor("monthly_quant_report"),
    defaultRetrieve: true,
  },
  {
    id: "sector_seasonality_report",
    label: "Sector Seasonality Report",
    matchers: [/\bsector seasonality\b/i],
    colorToken: colorTokenFor("sector_seasonality_report"),
    defaultRetrieve: true,
  },
  {
    id: "sector_opportunity",
    label: "Sector Opportunity",
    matchers: [/\bsector opportunit(?:y|ies)\b/i, /\bsector opp+ortunity\b/i],
    colorToken: colorTokenFor("sector_opportunity"),
    defaultRetrieve: true,
  },
  {
    id: "sector_update",
    label: "Sector Update",
    matchers: [/\bsector updates?\b/i],
    colorToken: colorTokenFor("sector_update"),
    defaultRetrieve: true,
  },
  {
    id: "earnings_preview",
    label: "Earnings Preview",
    matchers: [/\bearnings preview\b/i],
    colorToken: colorTokenFor("earnings_preview"),
    defaultRetrieve: true,
  },
  {
    id: "result_preview",
    label: "Result Preview",
    matchers: [/\bresult preview\b/i],
    colorToken: colorTokenFor("result_preview"),
    defaultRetrieve: true,
  },
  {
    id: "result_update",
    label: "Result Update",
    matchers: [/\bresult update\b/i],
    colorToken: colorTokenFor("result_update"),
    defaultRetrieve: true,
  },
  {
    id: "axis_annual_analysis",
    label: "Axis Annual Analysis",
    matchers: [/\b(?:axis\s+)?annual analysis\b/i],
    colorToken: colorTokenFor("axis_annual_analysis"),
    defaultRetrieve: true,
  },
  {
    id: "company_update",
    label: "Company Update",
    matchers: [/\bcompany updates?\b/i],
    colorToken: colorTokenFor("company_update"),
    defaultRetrieve: true,
  },
  {
    id: "axis_top_picks",
    label: "Axis Top Picks",
    matchers: [/\baxis top picks?\b/i, /^top picks?\b/i],
    colorToken: colorTokenFor("axis_top_picks"),
    defaultRetrieve: true,
  },
  {
    id: "top_conviction_ideas",
    label: "Top Conviction Ideas",
    matchers: [/\btop conviction ideas?\b/i],
    colorToken: colorTokenFor("top_conviction_ideas"),
    defaultRetrieve: true,
  },
  {
    id: "pick_of_the_week",
    label: "Pick of the Week",
    matchers: [/\bpick of the week\b/i],
    colorToken: colorTokenFor("pick_of_the_week"),
    defaultRetrieve: true,
  },
  {
    id: "axis_alpha",
    label: "Axis Alpha",
    matchers: [/\baxis alpha\b/i],
    colorToken: colorTokenFor("axis_alpha"),
    defaultRetrieve: true,
  },
  {
    id: "target_achieved",
    label: "Target Achieved",
    matchers: [/\btarget achieved\b/i],
    colorToken: colorTokenFor("target_achieved"),
    defaultRetrieve: true,
  },
  {
    id: "axis_punch",
    label: "Axis Punch",
    matchers: [/\baxis punch\b/i],
    colorToken: colorTokenFor("axis_punch"),
    defaultRetrieve: true,
  },
  {
    id: "book_profits",
    label: "Book Profits",
    matchers: [/\bbook profits?\b/i],
    colorToken: colorTokenFor("book_profits"),
    defaultRetrieve: true,
  },
  {
    id: "call_closure",
    label: "Call Closure",
    matchers: [/\bcall closure\b/i],
    colorToken: colorTokenFor("call_closure"),
    defaultRetrieve: true,
  },
  {
    id: "daily_morning_note",
    label: "Daily Morning Note",
    matchers: [/\bdaily morning note\b/i, /\bmorning note\b/i, /\btrade setup for the day\b/i],
    colorToken: colorTokenFor("daily_morning_note"),
    defaultRetrieve: true,
  },
  {
    id: "important_update",
    label: "Important Update",
    matchers: [/\bimportant updates?\b/i],
    colorToken: colorTokenFor("important_update"),
    defaultRetrieve: true,
  },
  {
    id: "other_research",
    label: "Other research",
    matchers: [],
    colorToken: colorTokenFor("other_research"),
    defaultRetrieve: true,
  },
]);

const CATEGORY_BY_ID = new Map(AXIS_RESEARCH_CATEGORIES.map((category) => [category.id, category]));

export const AXIS_RESEARCH_CATEGORY_IDS = Object.freeze(
  AXIS_RESEARCH_CATEGORIES.map((category) => category.id),
);

export const DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS = Object.freeze(
  AXIS_RESEARCH_CATEGORIES
    .filter((category) => category.defaultRetrieve)
    .map((category) => category.id),
);

/** Alias used by corpus ingest/retrieval. */
export const DEFAULT_RETRIEVE_AXIS_CATEGORIES = DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS;

/** SQL filter for the "Axis result updates" briefing suggestion. */
export const RESULT_UPDATE_INTENT_CATEGORY_IDS = Object.freeze([
  "result_update",
  "quarterly_result_updates",
  "company_update",
]);

/**
 * True for the Axis result-updates suggestion and close paraphrases.
 * Instruction boilerplate ("never invent figures") is ignored by the FTS builder;
 * this helper is for SQL category narrowing.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isAxisResultUpdatesIntent(text) {
  const query = String(text ?? "").toLowerCase();
  if (!query.trim()) return false;
  const hasResultUpdate = /\bresult updates?\b/.test(query);
  const hasCompanyNotes = /\bcompany (?:notes?|updates?)\b/.test(query);
  const hasAxis = /\baxis\b/.test(query);
  return (hasResultUpdate && (hasAxis || hasCompanyNotes)) || (hasCompanyNotes && hasAxis);
}

/**
 * When Axis Research is in scope and the question is result-updates, narrow to
 * `axis_research` plus result/company categories so SQL helps FTS instead of
 * requiring every instruction token to appear in a document.
 *
 * @param {{ query?: string, families?: string[], axisCategories?: string[] }} options
 */
export function resolveResultUpdateRetrieval(options = {}) {
  const families = Array.isArray(options.families) ? options.families : undefined;
  const axisCategories = Array.isArray(options.axisCategories) ? options.axisCategories : undefined;
  if (!isAxisResultUpdatesIntent(options.query)) {
    return { families, axisCategories, recencyFallback: false };
  }
  if (families?.length && !families.includes("axis_research")) {
    return { families, axisCategories, recencyFallback: false };
  }
  const requested = parseAxisCategories(axisCategories);
  const intentIds = [...RESULT_UPDATE_INTENT_CATEGORY_IDS];
  let nextCategories = intentIds;
  if (requested?.length) {
    const overlap = requested.filter((id) => intentIds.includes(id));
    const isBroad = requested.length > intentIds.length;
    nextCategories = !isBroad && overlap.length ? overlap : intentIds;
  }
  return {
    families: ["axis_research"],
    axisCategories: nextCategories,
    recencyFallback: true,
  };
}

const LOGIN_OR_KYC_SUBJECT =
  /\b(?:kyc|otp|password|access code|log[\s-]?in|contract note|nps account|nominee|demat statement|security alert|new device)\b/i;

/** Greek Alpha (U+0391 / U+03B1) folds to Latin A so "Axis Αlpha" matches Axis Alpha. */
export function normalizeAxisSubject(subject) {
  return String(subject ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .normalize("NFKC")
    .replaceAll("\u0391", "A")
    .replaceAll("\u03B1", "a")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^(?:\[?\s*(?:fwd|fw|re)\s*\]?\s*[:\-]\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAxisResearchCategoryId(value) {
  return typeof value === "string" && CATEGORY_BY_ID.has(value);
}

export function axisCategoryById(id) {
  return CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get("other_research");
}

export function axisCategoryLabel(id) {
  return axisCategoryById(id)?.label ?? "Other research";
}

export function axisCategoryColorToken(id) {
  return axisCategoryById(id)?.colorToken ?? colorTokenFor("other_research");
}

function matchesImportantUpdate(normalized) {
  if (LOGIN_OR_KYC_SUBJECT.test(normalized)) return false;
  if (/\bimportant updates?\b/i.test(normalized)) return true;
  return /^(?:axis\s+)?updates?\s*[-:]/i.test(normalized);
}

/**
 * Classify an Axis Research subject. Unmatched research → `other_research`.
 * Non-research KYC/login subjects still return `other_research` if called;
 * mailbox filters must drop those rows before indexing.
 *
 * @param {string} subject
 * @returns {AxisResearchCategoryId}
 */
export function classifyAxisCategory(subject) {
  const normalized = normalizeAxisSubject(subject);
  if (!normalized) return "other_research";
  for (const category of AXIS_RESEARCH_CATEGORIES) {
    if (category.id === "other_research") continue;
    if (category.id === "important_update") {
      if (matchesImportantUpdate(normalized)) return "important_update";
      continue;
    }
    if (category.matchers.some((matcher) => matcher.test(normalized))) return category.id;
  }
  return "other_research";
}

/**
 * Parse a chat/API `axisCategories` body.
 * Omitted or empty → `undefined` so retrieval can apply the default allow-list
 * (every research category except live webinars). Never treat empty as "all including webinars".
 *
 * @param {unknown} value
 * @returns {AxisResearchCategoryId[] | undefined}
 */
export function parseAxisCategories(value) {
  if (!Array.isArray(value) || !value.length) return undefined;
  const ids = [];
  for (const item of value) {
    if (!isAxisResearchCategoryId(item)) continue;
    if (!ids.includes(item)) ids.push(item);
  }
  return ids.length ? ids : undefined;
}

/** Valid ids only. Empty input → `[]` (callers that need the webinar default use `resolveAxisCategoryFilter`). */
export function allowlistedAxisCategories(value) {
  return parseAxisCategories(value) ?? [];
}

/** Resolved allow-list for SQL: explicit selection, else default retrieve (no webinars). */
export function resolveAxisCategoryFilter(value) {
  const parsed = Array.isArray(value) ? parseAxisCategories(value) : undefined;
  return parsed ?? [...DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS];
}

export function isDefaultRetrieveAxisCategory(id) {
  return DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS.includes(id);
}
