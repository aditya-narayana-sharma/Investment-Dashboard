import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { classifyAxisCategory } from "../app/satya/axis-categories.mjs";
import { mailMessageUrl } from "./axis-digest-links.mjs";
import {
  classifySatyaFamily,
  parseMailSender,
  shouldIndexSatyaDocument,
} from "./satya-classify.mjs";

const SATYA_CONTENT_SOURCES = Object.freeze(["mail", "podcast", "pdf"]);
const MAX_PDF_TEXT_CHARS = 24_000;

function isSatyaRepoRoot(dir) {
  return existsSync(join(dir, "flask_gateway.py")) && existsSync(join(dir, "artifacts"));
}

function walkToSatyaRepoRoot(start) {
  let dir = resolve(String(start || ""));
  for (let i = 0; i < 12; i += 1) {
    if (isSatyaRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function moduleDirCandidate() {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

function defaultSatyaRootCandidates() {
  const candidates = [];
  const envRoot = String(process.env.STRATJI_REPO_ROOT ?? "").trim();
  if (envRoot) candidates.push(envRoot);
  candidates.push(process.cwd());
  const moduleDir = moduleDirCandidate();
  if (moduleDir) candidates.push(moduleDir);
  return candidates;
}

/**
 * Repo root for the single Satya sqlite. Vinext bundles this file into
 * `dist/server/index.js`, so `join(dirname(import.meta.url), "..")` would
 * resolve to `dist/` and open a second empty corpus. Walk up until
 * `flask_gateway.py` is found so digest ingest and the Next API share one file.
 */
export function resolveSatyaRepoRoot(startDirs = defaultSatyaRootCandidates()) {
  for (const dir of startDirs) {
    if (!dir) continue;
    const found = walkToSatyaRepoRoot(dir);
    if (found) return found;
  }
  return resolve(process.cwd());
}

function absolutePathFromRoot(override, fallbackRelative) {
  const trimmed = String(override ?? "").trim();
  if (trimmed) return isAbsolute(trimmed) ? trimmed : join(resolveSatyaRepoRoot(), trimmed);
  return join(resolveSatyaRepoRoot(), ...fallbackRelative);
}

export function satyaCorpusPath() {
  return absolutePathFromRoot(
    process.env.SATYA_CORPUS_PATH,
    ["artifacts", "private", "satya", "corpus.sqlite"],
  );
}

export function satyaCatalogPath() {
  return absolutePathFromRoot(
    process.env.SATYA_CATALOG_PATH,
    ["artifacts", "private", "satya", "catalog.json"],
  );
}

function schemaSql() {
  return `
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      mailbox TEXT NOT NULL,
      family TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_email TEXT,
      title TEXT NOT NULL,
      received_at TEXT NOT NULL,
      sanitized_text TEXT NOT NULL,
      bullets_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      pdf_url TEXT,
      pdf_path TEXT,
      message_url TEXT,
      content_hash TEXT NOT NULL,
      content_source TEXT NOT NULL,
      axis_category TEXT,
      evidence_kind TEXT,
      indexed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS documents_family_received ON documents (family, received_at DESC);
    CREATE INDEX IF NOT EXISTS documents_mailbox_received ON documents (mailbox, received_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      title,
      sanitized_text,
      sender,
      tags,
      tokenize = 'porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;
}

function documentColumns(db) {
  return new Set(db.prepare("PRAGMA table_info(documents)").all().map((row) => String(row.name)));
}

function migrateSatyaCorpus(db) {
  const cols = documentColumns(db);
  if (!cols.has("axis_category")) {
    db.exec("ALTER TABLE documents ADD COLUMN axis_category TEXT");
  }
  if (!cols.has("pdf_path")) {
    db.exec("ALTER TABLE documents ADD COLUMN pdf_path TEXT");
  }
  if (!cols.has("evidence_kind")) {
    db.exec("ALTER TABLE documents ADD COLUMN evidence_kind TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS documents_family_axis_category_received ON documents (family, axis_category, received_at DESC)");
}

export function openSatyaCorpus(path = satyaCorpusPath()) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(schemaSql());
  migrateSatyaCorpus(db);
  return db;
}

export function withCorpus(fn, path = satyaCorpusPath()) {
  const db = openSatyaCorpus(path);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export function getSatyaMeta(key, path = satyaCorpusPath()) {
  return withCorpus((db) => {
    const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
    return row ? String(row.value) : null;
  }, path);
}

export function setSatyaMeta(key, value, path = satyaCorpusPath()) {
  withCorpus((db) => {
    db.prepare("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, String(value ?? ""));
  }, path);
}

export function countSatyaDocuments(path = satyaCorpusPath()) {
  return withCorpus((db) => {
    const row = db.prepare("SELECT COUNT(*) AS n FROM documents").get();
    return Number(row?.n) || 0;
  }, path);
}

export function countSatyaDocumentsByFamily(path = satyaCorpusPath()) {
  return withCorpus((db) => {
    const rows = db.prepare("SELECT family, COUNT(*) AS n FROM documents GROUP BY family").all();
    return Object.fromEntries(rows.map((row) => [String(row.family), Number(row.n) || 0]));
  }, path);
}

export function recordSatyaIngestError(error, path = satyaCorpusPath()) {
  const message = error instanceof Error ? error.message : String(error ?? "ingest failed");
  try {
    setSatyaMeta("ingestError", message.slice(0, 500), path);
    setSatyaMeta("ingestErrorAt", new Date().toISOString(), path);
  } catch {
    /* status keeps the previous ingestError when the corpus is unwritable */
  }
}

export function clearSatyaIngestError(path = satyaCorpusPath()) {
  setSatyaMeta("ingestError", "", path);
}

export function sanitizeSatyaText(value) {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF\u00A0\uFFFC]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/\[email redacted\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (!tags || typeof tags !== "object") return [];
  return Object.values(tags)
    .flat()
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function contentHashOf({ title, sanitizedText, bullets, tags }) {
  return createHash("sha256")
    .update(JSON.stringify({ title, sanitizedText, bullets, tags }))
    .digest("hex");
}

function normalizeContentSource(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "podcast" || raw === "podcasts" || raw === "transcript" || raw === "description") return "podcast";
  if (raw === "pdf") return "pdf";
  return "mail";
}

/** Podcast passages only. Descriptions must never be stored as transcripts. */
function podcastEvidenceKind(value, family) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "transcript") return "transcript";
  if (raw === "description") return "description";
  if (family === "podcasts" && (raw === "podcast" || raw === "podcasts" || !raw)) return null;
  return null;
}

function stableMessageId(input) {
  const explicit = String(input.messageId ?? "").trim();
  if (explicit) return explicit;
  const contentSource = normalizeContentSource(input.contentSource);
  const basis = [
    contentSource,
    input.mailbox ?? "",
    input.pdfPath ?? "",
    input.sender ?? "",
    input.title ?? "",
    input.receivedAt ?? "",
  ].join("\0");
  const prefix = SATYA_CONTENT_SOURCES.includes(contentSource) ? contentSource : "mail";
  return `${prefix}:${createHash("sha256").update(basis).digest("hex").slice(0, 24)}`;
}

function mailboxForFamily(family, fallback) {
  if (family === "axis_research") return "Axis Research";
  if (family === "podcasts") return "Podcasts";
  return fallback || "Newsletters";
}

export function upsertSatyaDocumentOn(db, input) {
  const parsed = parseMailSender(input.sender ?? input.source ?? "");
  const senderEmail = input.senderEmail || parsed.email || "";
  const sender = parsed.name || input.source || "Unknown sender";
  const title = sanitizeSatyaText(input.title || input.subject || "Untitled");
  const bullets = Array.isArray(input.bullets) ? input.bullets.map((item) => sanitizeSatyaText(item)).filter(Boolean) : [];
  const tags = flattenTags(input.tags);
  const contentSource = normalizeContentSource(input.contentSource);
  const family = input.family
    ?? classifySatyaFamily({
      mailbox: input.mailbox,
      sender: input.sender ?? sender,
      senderEmail,
      subject: input.subject ?? title,
      title,
      contentSource,
    });
  const evidenceKind = family === "podcasts"
    ? podcastEvidenceKind(input.evidenceKind ?? input.contentSource, family)
    : null;
  const mailbox = input.mailbox || mailboxForFamily(family);
  const axisCategory = family === "axis_research"
    ? (input.axisCategory || classifyAxisCategory(input.subject ?? title))
    : null;
  let sanitizedText = sanitizeSatyaText(
    input.sanitizedText
      || [input.content, input.summary, ...bullets].filter(Boolean).join("\n"),
  );
  if (contentSource === "pdf" && sanitizedText.length > MAX_PDF_TEXT_CHARS) {
    sanitizedText = sanitizedText.slice(0, MAX_PDF_TEXT_CHARS).trim();
  }
  const receivedAt = input.receivedAt || new Date().toISOString();

  if (!shouldIndexSatyaDocument({
    mailbox,
    sender: input.sender ?? sender,
    senderEmail,
    subject: input.subject ?? title,
    title,
    summary: input.summary,
    content: input.content ?? sanitizedText,
    bullets,
    sanitizedText,
    family,
    axisCategory,
  })) {
    return { upserted: false, skipped: "promo_or_empty" };
  }

  const messageId = stableMessageId({
    messageId: input.messageId,
    contentSource,
    mailbox,
    sender,
    title,
    receivedAt,
    pdfPath: input.pdfPath,
  });
  const hash = contentHashOf({ title, sanitizedText, bullets, tags });
  const messageUrl = input.messageUrl
    || (contentSource === "mail" && input.messageId ? mailMessageUrl(input.messageId) : input.episodeUrl)
    || "";
  const pdfUrl = input.pdfUrl ?? null;
  const pdfPath = input.pdfPath ?? null;
  const indexedAt = new Date().toISOString();

  const existing = db.prepare("SELECT id, content_hash, message_url, pdf_url, pdf_path, axis_category, evidence_kind FROM documents WHERE message_id = ?").get(messageId);
  if (existing && String(existing.content_hash) === hash) {
    const nextMessageUrl = messageUrl || existing.message_url || null;
    const nextPdfUrl = pdfUrl || existing.pdf_url || null;
    const nextPdfPath = pdfPath || existing.pdf_path || null;
    const nextAxis = axisCategory || existing.axis_category || null;
    const nextEvidence = evidenceKind || existing.evidence_kind || null;
    if (
      nextMessageUrl !== (existing.message_url || null)
      || nextPdfUrl !== (existing.pdf_url || null)
      || nextPdfPath !== (existing.pdf_path || null)
      || nextAxis !== (existing.axis_category || null)
      || nextEvidence !== (existing.evidence_kind || null)
    ) {
      db.prepare(`
        UPDATE documents SET message_url = ?, pdf_url = ?, pdf_path = ?, axis_category = ?, evidence_kind = ?
        WHERE id = ?
      `).run(nextMessageUrl, nextPdfUrl, nextPdfPath, nextAxis, nextEvidence, Number(existing.id));
    }
    return { upserted: false, skipped: "unchanged", id: Number(existing.id), axisCategory: nextAxis };
  }

  const columns = [
    messageId,
    mailbox,
    family,
    sender,
    senderEmail || null,
    title,
    receivedAt,
    sanitizedText,
    JSON.stringify(bullets),
    JSON.stringify(tags),
    pdfUrl,
    pdfPath,
    messageUrl || null,
    hash,
    contentSource,
    axisCategory,
    evidenceKind,
    indexedAt,
  ];

  let id;
  if (existing) {
    id = Number(existing.id);
    db.prepare(`
      UPDATE documents SET
        mailbox = ?, family = ?, sender = ?, sender_email = ?, title = ?,
        received_at = ?, sanitized_text = ?, bullets_json = ?, tags_json = ?,
        pdf_url = ?, pdf_path = ?, message_url = ?, content_hash = ?, content_source = ?,
        axis_category = ?, evidence_kind = ?, indexed_at = ?
      WHERE id = ?
    `).run(
      mailbox, family, sender, senderEmail || null, title, receivedAt,
      sanitizedText, JSON.stringify(bullets), JSON.stringify(tags),
      pdfUrl, pdfPath, messageUrl || null, hash, contentSource, axisCategory, evidenceKind, indexedAt, id,
    );
    db.prepare("DELETE FROM documents_fts WHERE rowid = ?").run(id);
  } else {
    const inserted = db.prepare(`
      INSERT INTO documents (
        message_id, mailbox, family, sender, sender_email, title, received_at,
        sanitized_text, bullets_json, tags_json, pdf_url, pdf_path, message_url,
        content_hash, content_source, axis_category, evidence_kind, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...columns);
    id = Number(inserted.lastInsertRowid);
  }

  db.prepare(`
    INSERT INTO documents_fts(rowid, title, sanitized_text, sender, tags)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title, sanitizedText, sender, tags.join(" "));

  return { upserted: true, id, axisCategory };
}

/**
 * @param {object} input
 * @returns {{ upserted: boolean, skipped?: string, id?: number }}
 */
export function upsertSatyaDocument(input, path = satyaCorpusPath()) {
  return withCorpus((db) => upsertSatyaDocumentOn(db, input), path);
}
