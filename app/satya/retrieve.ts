import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  axisCategoryCountsFromCorpus,
  catalogSeedsFromCorpus,
  countSatyaDocuments,
  getSatyaMeta,
  listSatyaDocuments,
  satyaCatalogPath as corpusCatalogPath,
  satyaCorpusPath as corpusSqlitePath,
  searchSatyaCorpus as searchSatyaCorpusImpl,
} from "./search.ts";
import type { AxisResearchCategoryId, SatyaCatalog, SatyaCitation, SatyaSourceFamily } from "../content-types";
import type { EarningsSnapshot } from "../earnings-live-types";
import { buildEarningsSnapshot } from "../earnings-verify.ts";
import { earningsCalendar } from "../portfolio-data.ts";
import { AXIS_RESEARCH_CATEGORIES, isAxisResultUpdatesIntent, resolveResultUpdateRetrieval } from "./axis-categories.mjs";
import { buildSatyaCatalog, SATYA_FAMILY_LABELS, SATYA_SOURCE_FAMILIES } from "./source-catalog.mjs";

export type SatyaRetrieveOptions = {
  limit?: number;
  families?: SatyaSourceFamily[];
  axisCategories?: AxisResearchCategoryId[];
  workspaceHints?: string[];
  path?: string;
  recencyFallback?: boolean;
  coverageSampling?: boolean;
  perFamilyCap?: number;
  perCategoryCap?: number;
  innerLimit?: number;
  excerptMax?: number;
};

export type SatyaRetrieveBudget = {
  limit: number;
  corpusLimit: number;
  earningsLimit: number;
  perFamilyCap: number;
  perCategoryCap: number;
  innerLimit: number;
  excerptMax: number;
  recencyFallback: boolean;
  coverageSampling: boolean;
};

export type SatyaRetrievedChunk = SatyaCitation & {
  score?: number;
  messageId?: string;
  contentSource?: string | null;
  evidenceKind?: "transcript" | "description" | null;
};

export type SatyaPdfIngestStatus = "pending" | "ok" | "error" | "idle";

export type SatyaCorpusStats = {
  documentCount: number;
  lastBackfillAt: string | null;
  families: Record<string, number>;
  ingestError: string | null;
  pdfIngest: SatyaPdfIngestStatus;
  lastPdfIngestAt: string | null;
};

export type SatyaCorpusDocumentPreview = {
  family: SatyaSourceFamily;
  title: string;
  receivedAt: string;
  axisCategory?: string | null;
};

export type SatyaSourceFreshness = {
  status?: string;
  count?: number;
  observedAt?: string;
  message?: string;
};

export type SatyaMailFreshness = {
  newsletters?: SatyaSourceFreshness;
  axisResearch?: SatyaSourceFreshness;
  asOf?: string;
};

export type { SatyaCatalog, SatyaCitation, SatyaSourceFamily };

type CatalogSeedRow = {
  family?: SatyaSourceFamily;
  mailbox?: string;
  sender?: string;
  senderEmail?: string;
  receivedAt?: string | null;
  messageCount?: number;
};

/** SQLite FTS5 corpus at repo `artifacts/private/satya/corpus.sqlite` — same file digest ingest writes. */
export function satyaCorpusPath(): string {
  return corpusSqlitePath();
}

export function satyaCatalogFilePath(): string {
  return corpusCatalogPath();
}

function corpusExists(filePath = satyaCorpusPath()): boolean {
  return existsSync(filePath);
}

export function satyaCorpusDocumentCount(filePath = satyaCorpusPath()): number {
  if (!corpusExists(filePath)) return 0;
  try {
    return countSatyaDocuments(filePath);
  } catch {
    return 0;
  }
}

/** Missing file or zero indexed documents — chat must refuse rather than invent. */
export function isSatyaCorpusEmpty(filePath = satyaCorpusPath()): boolean {
  return satyaCorpusDocumentCount(filePath) === 0;
}

/** FTS search via `app/satya/search.mjs`. Missing corpus files return [] and never invent hits. */
export function searchSatyaCorpus(
  query: string,
  options: SatyaRetrieveOptions = {},
): SatyaRetrievedChunk[] {
  const filePath = options.path ?? satyaCorpusPath();
  if (!corpusExists(filePath)) return [];
  try {
    return searchSatyaCorpusImpl(query, options) as SatyaRetrievedChunk[];
  } catch {
    return [];
  }
}

/** Holding-style tokens only — numeric workspace fragments are dropped. */
export function workspaceQueryHints(workspace?: string): string[] {
  if (!workspace?.trim()) return [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of workspace.split(/[^A-Za-z.+-]+/)) {
    const trimmed = token.trim();
    if (trimmed.length < 2 || /^\d+(\.\d+)?$/.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}

const EARNINGS_QUERY_MARK =
  /\b(earnings|results?|kpis?|pat|revenue|nim|ebit|reported|prints?|ir\/nse|investor relations)\b/i;

/** Operator asks to survey many families/topics rather than a single name. Result-update intent stays narrow. */
export function isSatyaBroadSurveyQuery(query: string): boolean {
  const q = String(query ?? "").toLowerCase();
  if (!q.trim() || isAxisResultUpdatesIntent(q)) return false;
  const survey = /\b(summarize|summarise|overview|brief(?:ing)?s?|recap|survey|round[- ]?up|comprehensive|what changed|changed across|detailed|analysis)\b/.test(q)
    || /\bby\s+topics?\b/.test(q)
    || /\b\d+\s*words?\b/.test(q)
    || /\b\d+\s*(?:to|-)\s*\d+\s*bullet/.test(q)
    || /\bbullet points?\b/.test(q);
  const breadth = /\b(all|every|entire|across|complete)\b/.test(q)
    || /\beach\s+(?:research\s+)?categor(?:y|ies)\b/.test(q)
    || /\bby\s+(?:topics?|categor(?:y|ies)|families|sources)\b/.test(q)
    || (/\baxis\b/.test(q) && /\bnewsletters?\b/.test(q))
    || (/\baxis\b/.test(q) && /\bpodcasts?\b/.test(q))
    || (/\bnewsletters?\b/.test(q) && /\bpodcasts?\b/.test(q));
  const categorySweep = /\b(research\s+)?categor(?:y|ies)\b/.test(q)
    && /\b(all|every|each|across|complete)\b/.test(q);
  return (survey && breadth) || categorySweep;
}

export const SATYA_RETRIEVE_LIMIT_MAX = 120;

/** Packed evidence budget for the model input window (chars, not tokens). */
export const SATYA_PROMPT_INPUT_CHAR_CAP = 14_000;
export const SATYA_PACKED_EXCERPT_MAX = 360;
export const SATYA_PACKED_PER_HEADING_CAP = 3;
const SATYA_PACKED_PASSAGE_OVERHEAD = 160;

export function satyaRetrieveBudget(query: string): SatyaRetrieveBudget {
  if (isSatyaBroadSurveyQuery(query)) {
    return {
      limit: 96,
      corpusLimit: 88,
      earningsLimit: 8,
      perFamilyCap: 12,
      perCategoryCap: 4,
      innerLimit: 480,
      excerptMax: 900,
      recencyFallback: true,
      coverageSampling: true,
    };
  }
  return {
    limit: 16,
    corpusLimit: 12,
    earningsLimit: 6,
    perFamilyCap: 8,
    perCategoryCap: 4,
    innerLimit: 80,
    excerptMax: 480,
    recencyFallback: false,
    coverageSampling: false,
  };
}

function corpusFamiliesOf(families: SatyaSourceFamily[] | undefined): SatyaSourceFamily[] | undefined {
  if (!families?.length) return families;
  const corpus = families.filter((family) => family !== "earnings");
  return corpus.length ? corpus : undefined;
}

function packHeadingKey(passage: SatyaRetrievedChunk): string {
  if (passage.family === "axis_research") return `axis:${passage.axisCategory || "other_research"}`;
  return passage.family;
}

function truncatePackedExcerpt(value: string, maxChars: number): string {
  const text = String(value ?? "").trim();
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const space = slice.lastIndexOf(" ");
  const clipped = (space > maxChars * 0.6 ? slice.slice(0, space) : slice).trim();
  return `${clipped}…`;
}

export function packedSatyaEvidenceChars(passages: SatyaRetrievedChunk[]): number {
  return passages.reduce((sum, passage) => (
    sum + SATYA_PACKED_PASSAGE_OVERHEAD + passage.title.length + passage.excerpt.length
  ), 0);
}

/**
 * Keep one heading per family/Axis category that has evidence, then cap excerpts
 * so the packed prompt fits the model input window. Never invents KPIs.
 */
export function packSatyaPassages(
  passages: SatyaRetrievedChunk[],
  charCap = SATYA_PROMPT_INPUT_CHAR_CAP,
): SatyaRetrievedChunk[] {
  if (!passages.length) return [];
  const groups = new Map<string, SatyaRetrievedChunk[]>();
  const order: string[] = [];
  for (const passage of passages) {
    const key = packHeadingKey(passage);
    const bucket = groups.get(key);
    if (bucket) bucket.push(passage);
    else {
      groups.set(key, [passage]);
      order.push(key);
    }
  }

  const excerptCaps = [SATYA_PACKED_EXCERPT_MAX, 280, 200];
  const headingCaps = [SATYA_PACKED_PER_HEADING_CAP, 2, 1];
  let packed: SatyaRetrievedChunk[] = [];
  for (const headingCap of headingCaps) {
    for (const excerptCap of excerptCaps) {
      packed = [];
      const queues = order.map((key) => (groups.get(key) ?? []).slice(0, headingCap));
      let added = true;
      while (added) {
        added = false;
        for (const queue of queues) {
          const next = queue.shift();
          if (!next) continue;
          packed.push({ ...next, excerpt: truncatePackedExcerpt(next.excerpt, excerptCap) });
          added = true;
        }
      }
      if (packedSatyaEvidenceChars(packed) <= charCap) return packed;
    }
  }

  packed = [];
  for (const key of order) {
    const row = groups.get(key)?.[0];
    if (!row) continue;
    packed.push({ ...row, excerpt: truncatePackedExcerpt(row.excerpt, 160) });
  }
  while (packed.length > 1 && packedSatyaEvidenceChars(packed) > charCap) {
    packed.pop();
  }
  return packed;
}

function tokenizeQuery(query: string): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of query.toLowerCase().split(/[^a-z0-9.+-]+/)) {
    const trimmed = token.trim();
    if (trimmed.length < 2 || /^\d+$/.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

function verifiedKpiLines(event: EarningsSnapshot["events"][number]): string[] {
  return event.kpis
    .filter((kpi) => kpi.value.trim())
    .map((kpi) => `${kpi.label}: ${kpi.value}${kpi.change.trim() ? ` (${kpi.change.trim()})` : ""}`);
}

/** Verified IR/NSE prints only — unpublished KPI fields stay out of the excerpt. */
export function earningsPassagesFromSnapshot(
  query: string,
  snapshot: EarningsSnapshot,
  limit = 6,
): SatyaRetrievedChunk[] {
  if (snapshot.status === "unavailable") return [];
  const tokens = tokenizeQuery(query);
  const generic = EARNINGS_QUERY_MARK.test(query);
  const scored: Array<{ score: number; chunk: SatyaRetrievedChunk }> = [];
  for (const event of snapshot.events) {
    if (!event.reported) continue;
    const kpis = verifiedKpiLines(event);
    if (!kpis.length) continue;
    const hay = `${event.symbol} ${event.name} ${event.summary ?? ""} ${event.period}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (event.symbol.toLowerCase() === token) score += 6;
      else if (event.name.toLowerCase().includes(token)) score += 3;
      else if (hay.includes(token)) score += 1;
    }
    if (score === 0 && !generic) continue;
    scored.push({
      score: score || 1,
      chunk: {
        family: "earnings",
        title: `${event.symbol} ${event.period} verified print`,
        date: event.dateKey ?? event.date,
        sender: "IR/NSE verified",
        excerpt: [event.summary?.trim(), kpis.join("; ")].filter(Boolean).join("\n"),
        ...(event.source ? { sourceUrl: event.source } : {}),
        pdfUrl: null,
      },
    });
  }
  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, Math.max(1, Math.min(50, limit))).map((row) => row.chunk);
}

export function retrieveSatyaPassages(options: {
  query: string;
  workspace?: string;
  path?: string;
  limit?: number;
  families?: SatyaSourceFamily[];
  axisCategories?: AxisResearchCategoryId[];
  earnings?: EarningsSnapshot;
}): SatyaRetrievedChunk[] {
  const hints = workspaceQueryHints(options.workspace);
  const query = [options.query, ...hints.filter((hint) => hint === hint.toUpperCase() && hint.length <= 20)].join(" ").trim();
  const resolved = resolveResultUpdateRetrieval({
    query: options.query,
    families: options.families,
    axisCategories: options.axisCategories,
  });
  const budget = satyaRetrieveBudget(options.query);
  const limit = Math.max(1, Math.min(SATYA_RETRIEVE_LIMIT_MAX, options.limit ?? budget.limit));
  const resolvedFamilies = resolved.families as SatyaSourceFamily[] | undefined;
  const wantEarnings = !options.families?.length || options.families.includes("earnings");
  const corpusOnly = corpusFamiliesOf(resolvedFamilies);
  const skipCorpus = Array.isArray(options.families)
    && options.families.length > 0
    && options.families.every((family) => family === "earnings");
  const earningsLimit = wantEarnings
    ? Math.max(2, Math.min(budget.earningsLimit, limit))
    : 0;
  const corpusLimit = skipCorpus
    ? 0
    : wantEarnings
      ? Math.max(1, Math.min(budget.corpusLimit, limit - Math.min(earningsLimit, budget.earningsLimit)))
      : limit;
  const corpusHits = skipCorpus
    ? []
    : searchSatyaCorpus(query, {
      limit: corpusLimit,
      families: corpusOnly ?? resolvedFamilies,
      axisCategories: resolved.axisCategories as AxisResearchCategoryId[] | undefined,
      workspaceHints: hints,
      path: options.path,
      recencyFallback: resolved.recencyFallback || budget.recencyFallback,
      coverageSampling: budget.coverageSampling,
      perFamilyCap: budget.perFamilyCap,
      perCategoryCap: budget.perCategoryCap,
      innerLimit: budget.innerLimit,
      excerptMax: budget.excerptMax,
    });
  const earningsHits = wantEarnings
    ? earningsPassagesFromSnapshot(
      budget.coverageSampling ? `${options.query} earnings reported KPIs` : options.query,
      options.earnings ?? buildEarningsSnapshot(earningsCalendar),
      earningsLimit,
    )
    : [];
  const combined = [...corpusHits, ...earningsHits];
  return combined.slice(0, limit);
}

function emptyCatalog(asOf = new Date().toISOString()): SatyaCatalog {
  return {
    asOf,
    families: SATYA_SOURCE_FAMILIES.map((family) => ({
      family,
      label: SATYA_FAMILY_LABELS[family],
      count: 0,
    })),
    senders: [],
    axisCategories: AXIS_RESEARCH_CATEGORIES.map((category) => ({
      id: category.id as AxisResearchCategoryId,
      label: String(category.label),
      count: 0,
    })),
  };
}

function attachAxisCategoryCounts(catalog: SatyaCatalog, corpusPath?: string): SatyaCatalog {
  if (catalog.axisCategories?.length) return catalog;
  const counts = new Map<string, number>();
  try {
    for (const row of axisCategoryCountsFromCorpus(corpusPath) as Array<{ id?: string; count?: number }>) {
      if (typeof row.id === "string") counts.set(row.id, Number(row.count) || 0);
    }
  } catch {
    /* missing corpus or unmigrated schema */
  }
  return {
    ...catalog,
    axisCategories: AXIS_RESEARCH_CATEGORIES.map((category) => ({
      id: category.id as AxisResearchCategoryId,
      label: String(category.label),
      count: counts.get(category.id) ?? 0,
    })),
  };
}

function isSatyaCatalog(value: unknown): value is SatyaCatalog {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.asOf === "string" && Array.isArray(record.families) && Array.isArray(record.senders);
}

export async function readSatyaCatalogFile(): Promise<SatyaCatalog | null> {
  try {
    const parsed = JSON.parse(await readFile(satyaCatalogFilePath(), "utf8")) as unknown;
    return isSatyaCatalog(parsed) ? attachAxisCategoryCounts(parsed) : null;
  } catch {
    return null;
  }
}

/** Read-only catalog from SQLite GROUP BY seeds. Does not write `catalog.json`. */
export function deriveSatyaCatalogFromSqlite(corpusPath?: string): SatyaCatalog {
  const filePath = corpusPath ?? satyaCorpusPath();
  if (!corpusExists(filePath)) return emptyCatalog();
  try {
    const rows = catalogSeedsFromCorpus(filePath) as CatalogSeedRow[];
    return attachAxisCategoryCounts(buildSatyaCatalog(rows), filePath);
  } catch {
    return emptyCatalog();
  }
}

export async function loadSatyaCatalog(): Promise<SatyaCatalog> {
  return (await readSatyaCatalogFile()) ?? deriveSatyaCatalogFromSqlite();
}

function asPdfIngestStatus(value: string | null, lastPdfIngestAt: string | null): SatyaPdfIngestStatus {
  switch (value) {
    case "pending":
    case "ok":
    case "error":
    case "idle":
      return value;
    default:
      return lastPdfIngestAt ? "ok" : "idle";
  }
}

function asCorpusFamily(value: unknown): SatyaSourceFamily | undefined {
  switch (value) {
    case "axis_research":
    case "axis_mutual_fund":
    case "groww_digest":
    case "flipboard_tech":
    case "newsletter_other":
    case "podcasts":
    case "earnings":
      return value;
    default:
      return undefined;
  }
}

/** Titles only — no sender emails. Used for M-1 corpus-as-of cards. */
export function listRecentSatyaCorpusDocuments(asOf: string, filePath = satyaCorpusPath()): SatyaCorpusDocumentPreview[] {
  if (!corpusExists(filePath)) return [];
  try {
    const rows = listSatyaDocuments({ path: filePath }) as Array<Record<string, unknown>>;
    const previews: SatyaCorpusDocumentPreview[] = [];
    for (const row of rows) {
      const receivedAt = typeof row.received_at === "string" ? row.received_at : "";
      if (!receivedAt.startsWith(asOf)) continue;
      const family = asCorpusFamily(row.family);
      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!family || family === "earnings" || !title) continue;
      previews.push({
        family,
        title,
        receivedAt,
        axisCategory: typeof row.axis_category === "string" ? row.axis_category : null,
      });
    }
    return previews;
  } catch {
    return [];
  }
}

export async function loadSatyaCorpusStats(): Promise<SatyaCorpusStats> {
  const catalog = await loadSatyaCatalog();
  const families: Record<string, number> = {};
  for (const row of catalog.families) {
    families[row.family] = row.count;
  }
  const documentCount = satyaCorpusDocumentCount();
  let lastBackfillAt: string | null = null;
  let ingestError: string | null = null;
  let lastPdfIngestAt: string | null = null;
  let pdfIngest: SatyaPdfIngestStatus = "idle";
  if (corpusExists()) {
    try {
      if (documentCount > 0) {
        lastBackfillAt = getSatyaMeta("lastBackfillAt") ?? getSatyaMeta("lastDigestIngestAt");
      }
      const recorded = getSatyaMeta("ingestError")?.trim();
      ingestError = recorded ? recorded : null;
      lastPdfIngestAt = getSatyaMeta("lastPdfIngestAt");
      pdfIngest = asPdfIngestStatus(getSatyaMeta("pdfIngest"), lastPdfIngestAt);
    } catch {
      lastBackfillAt = null;
      ingestError = null;
      lastPdfIngestAt = null;
      pdfIngest = "idle";
    }
  }
  return { documentCount, lastBackfillAt, families, ingestError, pdfIngest, lastPdfIngestAt };
}

function pickSourceFreshness(value: unknown): SatyaSourceFreshness | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    status: typeof record.status === "string" ? record.status : undefined,
    count: typeof record.count === "number" ? record.count : undefined,
    observedAt: typeof record.observedAt === "string" ? record.observedAt : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

export function contentSnapshotPath(root = process.cwd()): string {
  const override = process.env.CONTENT_SNAPSHOT_PATH?.trim();
  if (override && root === process.cwd()) return override;
  return path.join(root, "artifacts", "private", "content-snapshot.json");
}

export async function readMailFreshness(root = process.cwd()): Promise<SatyaMailFreshness | null> {
  try {
    const parsed = JSON.parse(await readFile(contentSnapshotPath(root), "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const sources = record.sources && typeof record.sources === "object"
      ? record.sources as Record<string, unknown>
      : {};
    return {
      newsletters: pickSourceFreshness(sources.newsletters),
      axisResearch: pickSourceFreshness(sources.axisResearch),
      asOf: typeof record.asOf === "string" ? record.asOf : undefined,
    };
  } catch {
    return null;
  }
}
