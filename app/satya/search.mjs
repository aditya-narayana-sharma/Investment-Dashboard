import { resolveAxisCategoryFilter } from "./axis-categories.mjs";
import {
  SATYA_FAMILY_BOOST,
  SATYA_SOURCE_FAMILIES,
} from "../../scripts/satya-classify.mjs";
import {
  countSatyaDocuments,
  getSatyaMeta,
  sanitizeSatyaText,
  satyaCatalogPath,
  satyaCorpusPath,
  withCorpus,
} from "../../scripts/satya-store.mjs";

export { countSatyaDocuments, getSatyaMeta, satyaCatalogPath, satyaCorpusPath };

/** Instruction / English glue that must not be AND-required in FTS MATCH. */
const SATYA_FTS_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "so", "as", "at", "by", "for",
  "from", "into", "onto", "of", "on", "off", "to", "in", "is", "it", "its", "be", "been",
  "was", "were", "are", "am", "do", "does", "did", "not", "no", "nor", "only", "own",
  "same", "too", "very", "just", "with", "without", "within", "across", "about", "after",
  "before", "over", "under", "again", "further", "once", "here", "there", "when", "where",
  "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "this", "that", "these", "those", "they", "them", "their", "what", "which",
  "who", "whom", "will", "would", "could", "should", "can", "cannot", "cant", "dont",
  "never", "always", "also", "please", "using", "based", "provided",
]);

const SATYA_FTS_BOILERPLATE = new Set([
  "summarize", "summarise", "summary", "supplied", "digest", "leave", "unpublished",
  "kpis", "kpi", "blank", "invent", "invented", "inventing", "figures", "figure",
  "numbers", "number", "prices", "price", "quantities", "quantity", "ignore", "ads",
  "ctas", "cta", "promotions", "promotion", "treat", "transcript", "transcripts",
  "derived", "items", "descriptions", "description", "quotes", "quote", "flag",
  "risks", "downgrades", "cautionary", "compare", "current", "holdings", "missing",
  "say", "keep", "still", "cite", "sources", "source", "use", "short", "factual",
  "paragraphs", "bullets", "written", "spoken", "answer", "concise", "sentences",
  "sentence", "remain", "remains", "truth", "extractive", "machine", "drafted",
  "ask", "available", "local", "words", "topics", "topic", "categories", "category",
  "families", "family", "comprehensive", "complete", "overview", "briefing",
]);

function stripSatyaInstructionPhrases(query) {
  return String(query ?? "")
    .replace(/\bleave unpublished kpis blank\b/gi, " ")
    .replace(/\bnever invent (?:figures|numbers|prices|quotes)\b/gi, " ")
    .replace(/\bdo not invent\b[^.!]*/gi, " ")
    .replace(/\bfrom the supplied digest only\b/gi, " ")
    .replace(/\bin the supplied (?:digest|text)\b/gi, " ");
}

/**
 * Content tokens for FTS / excerpts. Drops stopwords and "do not invent" boilerplate
 * so instruction prompts cannot AND-fail against the corpus.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function satyaFtsContentTokens(query) {
  const cleaned = stripSatyaInstructionPhrases(query).replace(/['"^:*(){}\[\]-]+/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2)
    .filter((token) => /^[a-z0-9]+$/i.test(token))
    .filter((token) => !SATYA_FTS_STOPWORDS.has(token))
    .filter((token) => !SATYA_FTS_BOILERPLATE.has(token))
    .filter((token) => !["and", "or", "not", "near"].includes(token));
  return [...new Set(tokens)].slice(0, 8);
}

/**
 * FTS5 MATCH string from content terms. Unquoted so porter stemming applies;
 * OR so "result updates" hits `result_update` rows without requiring "summarize".
 *
 * @param {string} query
 * @returns {string}
 */
export function buildSatyaFtsQuery(query) {
  const tokens = satyaFtsContentTokens(query);
  if (!tokens.length) return "";
  return tokens.join(" OR ");
}

function ftsMatchQuery(query) {
  return buildSatyaFtsQuery(query);
}

function excerptFor(text, query, max = 480) {
  const hay = sanitizeSatyaText(text);
  if (!hay) return "";
  const tokens = satyaFtsContentTokens(query);
  const fallback = String(query ?? "").toLowerCase().split(/\s+/).filter((token) => token.length >= 2);
  const seek = tokens.length ? tokens : fallback;
  const lower = hay.toLowerCase();
  let idx = -1;
  for (const token of seek) {
    idx = lower.indexOf(token);
    if (idx >= 0) break;
  }
  if (idx < 0) {
    return hay.length > max ? `${hay.slice(0, max - 1).trim()}…` : hay;
  }
  const start = Math.max(0, idx - 70);
  const slice = hay.slice(start, start + max).trim();
  return `${start > 0 ? "…" : ""}${slice}${start + max < hay.length ? "…" : ""}`;
}

function recencyWeight(receivedAt, now = Date.now()) {
  const parsed = Date.parse(receivedAt);
  if (!Number.isFinite(parsed)) return 0.5;
  const ageDays = Math.max(0, (now - parsed) / 86_400_000);
  return Math.exp(-ageDays / 45);
}

function familyBoost(family) {
  return SATYA_FAMILY_BOOST[family] ?? SATYA_FAMILY_BOOST.newsletter_other;
}

function workspaceFamilyBoost(family, workspaceHints = []) {
  const hints = (workspaceHints ?? []).map((hint) => String(hint).toLowerCase());
  if (!hints.length) return 1;
  if (hints.includes(family)) return 1.2;
  if (hints.some((hint) => hint === "investment" || hint === "intelligence" || hint === "market-intelligence")) {
    if (family === "axis_research" || family === "axis_mutual_fund") return 1.12;
    if (family === "groww_digest" || family === "flipboard_tech") return 1.08;
  }
  return 1;
}

function rowToCitation(row, query, excerptMax = 480) {
  const evidenceKind = row.evidence_kind === "transcript" || row.evidence_kind === "description"
    ? row.evidence_kind
    : null;
  return {
    family: row.family,
    title: row.title,
    date: row.received_at,
    sender: row.sender,
    excerpt: excerptFor(row.sanitized_text, query, excerptMax),
    ...(row.message_url ? { messageUrl: row.message_url } : {}),
    ...(row.family === "podcasts" && row.message_url ? { episodeUrl: row.message_url } : {}),
    pdfUrl: row.pdf_url ?? null,
    axisCategory: row.axis_category ?? null,
    contentSource: row.content_source ?? null,
    evidenceKind,
    score: row.score,
    messageId: row.message_id,
  };
}

function coverageBucketKey(row) {
  if (row.family === "axis_research") {
    return `axis:${row.axis_category || "other_research"}`;
  }
  return String(row.family || "other");
}

function coverageSample(rows, { limit, perFamilyCap, perCategoryCap }) {
  const buckets = new Map();
  for (const row of rows) {
    const key = coverageBucketKey(row);
    if (!buckets.has(key)) buckets.set(key, []);
    const bucket = buckets.get(key);
    const cap = row.family === "axis_research"
      ? Math.max(1, perCategoryCap)
      : Math.max(1, perFamilyCap);
    if (bucket.length < cap) bucket.push(row);
  }
  const queues = [...buckets.values()].map((bucket) => [...bucket]);
  const picked = [];
  const seen = new Set();
  let added = true;
  while (picked.length < limit && added) {
    added = false;
    for (const queue of queues) {
      while (queue.length) {
        const next = queue.shift();
        const id = next.message_id || `${next.family}:${next.title}:${next.received_at}`;
        if (seen.has(id)) continue;
        seen.add(id);
        picked.push(next);
        added = true;
        break;
      }
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

function mergeScoredRows(primary, extra) {
  const byId = new Map();
  for (const row of primary) {
    byId.set(row.message_id || `${row.family}:${row.title}:${row.received_at}`, row);
  }
  for (const row of extra) {
    const id = row.message_id || `${row.family}:${row.title}:${row.received_at}`;
    if (!byId.has(id)) byId.set(id, row);
  }
  return [...byId.values()].sort((left, right) => (Number(right.score) || 0) - (Number(left.score) || 0));
}

/**
 * BM25 + recency + family boost. Named/mailbox families rank above newsletter_other.
 * Broad surveys may union recency rows and sample across families/Axis categories.
 *
 * @param {string} query
 * @param {{
 *   limit?: number,
 *   families?: string[],
 *   axisCategories?: string[],
 *   workspaceHints?: string[],
 *   path?: string,
 *   recencyFallback?: boolean,
 *   coverageSampling?: boolean,
 *   perFamilyCap?: number,
 *   perCategoryCap?: number,
 *   innerLimit?: number,
 *   excerptMax?: number,
 * }} [options]
 */
function allowlistedFamilies(value) {
  if (!Array.isArray(value) || !value.length) return [];
  return [...new Set(value.filter((family) => SATYA_SOURCE_FAMILIES.includes(family)))];
}

function familySql(families) {
  if (!families.length) return { sql: "", params: [] };
  return {
    sql: ` AND d.family IN (${families.map(() => "?").join(", ")})`,
    params: families,
  };
}

function axisCategorySql(axisCategories) {
  const ids = resolveAxisCategoryFilter(axisCategories);
  return {
    sql: ` AND (d.family <> 'axis_research' OR IFNULL(d.axis_category, 'other_research') IN (${ids.map(() => "?").join(", ")}))`,
    params: ids,
  };
}

export function searchSatyaCorpus(query, options = {}) {
  const limit = Math.max(1, Math.min(120, Number(options.limit) || 16));
  const families = allowlistedFamilies(options.families);
  const family = familySql(families);
  const axis = axisCategorySql(options.axisCategories);
  const match = ftsMatchQuery(query);
  const path = options.path ?? satyaCorpusPath();
  const recencyFallback = options.recencyFallback === true;
  const coverageSampling = options.coverageSampling === true;
  const innerLimit = Math.max(limit, Math.min(600, Number(options.innerLimit) || (coverageSampling ? 480 : 80)));
  const excerptMax = Math.max(280, Math.min(1200, Number(options.excerptMax) || 480));
  const perFamilyCap = Math.max(1, Math.min(limit, Number(options.perFamilyCap) || (coverageSampling ? 12 : 8)));
  const perCategoryCap = Math.max(1, Math.min(limit, Number(options.perCategoryCap) || (coverageSampling ? 4 : 4)));

  return withCorpus((db) => {
    const scoreRows = (rows, usedFts, now) => rows.map((row) => {
      const bm25 = Number(row.bm25) || 0;
      const lexical = usedFts ? Math.max(0.05, -bm25) : 1;
      const score = lexical
        * recencyWeight(row.received_at, now)
        * familyBoost(row.family)
        * workspaceFamilyBoost(row.family, options.workspaceHints);
      return { ...row, score };
    });

    let ftsRows = [];
    if (match) {
      try {
        ftsRows = db.prepare(`
          SELECT
            d.*,
            bm25(documents_fts) AS bm25
          FROM documents_fts
          JOIN documents d ON d.id = documents_fts.rowid
          WHERE documents_fts MATCH ?
          ${family.sql}
          ${axis.sql}
          LIMIT ?
        `).all(match, ...family.params, ...axis.params, innerLimit);
      } catch {
        ftsRows = [];
      }
    }

    const shouldFetchRecency = coverageSampling
      || ((!ftsRows.length) && (recencyFallback || !match));
    let recencyRows = [];
    if (shouldFetchRecency) {
      recencyRows = db.prepare(`
        SELECT d.*, 0 AS bm25
        FROM documents d
        WHERE 1=1
        ${family.sql}
        ${axis.sql}
        ORDER BY d.received_at DESC
        LIMIT ?
      `).all(...family.params, ...axis.params, innerLimit);
    }

    const now = Date.now();
    const scoredFts = scoreRows(ftsRows, true, now);
    const scoredRecency = scoreRows(recencyRows, false, now);
    let scored = coverageSampling
      ? mergeScoredRows(scoredFts, scoredRecency)
      : (scoredFts.length ? scoredFts : scoredRecency);
    scored.sort((left, right) => right.score - left.score);
    if (coverageSampling) {
      scored = coverageSample(scored, { limit, perFamilyCap, perCategoryCap });
    } else {
      scored = scored.slice(0, limit);
    }

    return scored.map((row) => rowToCitation(row, query, excerptMax));
  }, path);
}

export function listSatyaDocuments(options = {}) {
  const path = options.path ?? satyaCorpusPath();
  return withCorpus((db) => db.prepare(`
    SELECT message_id, mailbox, family, sender, sender_email, title, received_at, content_source, evidence_kind, axis_category, pdf_path, pdf_url, message_url
    FROM documents
    ORDER BY received_at DESC
  `).all(), path);
}

export function catalogSeedsFromCorpus(path) {
  return withCorpus((db) => db.prepare(`
    SELECT
      family,
      mailbox,
      sender,
      sender_email AS senderEmail,
      MAX(received_at) AS receivedAt,
      COUNT(*) AS messageCount
    FROM documents
    GROUP BY family, mailbox, sender, IFNULL(sender_email, '')
  `).all(), path);
}

export function axisCategoryCountsFromCorpus(path) {
  return withCorpus((db) => db.prepare(`
    SELECT IFNULL(axis_category, 'other_research') AS id, COUNT(*) AS count
    FROM documents
    WHERE family = 'axis_research'
    GROUP BY IFNULL(axis_category, 'other_research')
  `).all(), path);
}
