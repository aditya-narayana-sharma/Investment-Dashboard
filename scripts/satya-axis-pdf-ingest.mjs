/**
 * Index local Axis Research PDFs into the Satya corpus.
 * Validates headers, extracts text-layer only, never invents KPIs.
 * Failed extracts skip that file and do not replace a valid mail snapshot.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, openSync, readFileSync, readSync, closeSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { classifyAxisCategory } from "../app/satya/axis-categories.mjs";
import { axisMailAttachmentRoot, axisPdfRoots } from "../app/axis-pdf-roots.mjs";
import { saveAxisMailAttachments } from "./axis-mail-attachments.mjs";
import {
  indexAxisPdfArchive,
  mailMessageUrl,
  matchAxisResearchPdf,
} from "./axis-digest-links.mjs";
import {
  setSatyaMeta,
  upsertSatyaDocument,
} from "./satya-store.mjs";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const EXTRACTOR = join(SCRIPT_DIR, "extract-axis-pdf-recommendations.py");
const PYTHON = process.env.PORTFOLIO_FLASK_PYTHON
  ?? join(REPO_ROOT, ".venv-flask", "bin", "python");
/** Empty text plus no OCR must be recorded, never indexed as a blank document. */
const OCR_ENABLED = process.env.SATYA_OCR_ENABLED === "1";
const EXTRACT_BATCH = 40;
const EXTRACT_TIMEOUT_MS = 120_000;

export function axisPdfApiUrl(fileName) {
  const base = basename(String(fileName || ""));
  if (!base || !/\.pdf$/i.test(base)) return null;
  return `/api/axis-research/pdf?file=${encodeURIComponent(base)}`;
}

export function isValidPdfHeader(path) {
  let fd;
  try {
    fd = openSync(path, "r");
    const buf = Buffer.alloc(5);
    const n = readSync(fd, buf, 0, 5, 0);
    return n >= 5 && buf.toString("ascii") === "%PDF-";
  } catch {
    return false;
  } finally {
    if (fd != null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
}

function dateFromPdfName(name) {
  const match = String(name ?? "").match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return `${match[1]}T00:00:00+05:30`;
}

function receivedAtForPdf(path, name) {
  const fromName = dateFromPdfName(name);
  if (fromName) return new Date(fromName).toISOString();
  try {
    return new Date(statSync(path).mtimeMs).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function pdfMessageId(path) {
  const digest = createHash("sha256").update(String(path)).digest("hex").slice(0, 24);
  return `pdf:${digest}`;
}

function mailLinkMap(mailItems, archiveIndex) {
  const byFile = new Map();
  for (const item of mailItems ?? []) {
    const messageUrl = item.messageUrl || (item.messageId ? mailMessageUrl(item.messageId) : "");
    const link = {
      messageUrl: messageUrl || "",
      messageId: item.messageId || "",
      title: item.title || item.subject || "",
    };
    const explicit = item.pdfFile || (String(item.pdfUrl || "").match(/[?&]file=([^&]+)/)?.[1]);
    if (explicit) {
      const name = decodeURIComponent(explicit);
      if (/\.pdf$/i.test(name) && !byFile.has(name.toLowerCase())) byFile.set(name.toLowerCase(), link);
    }
    const match = matchAxisResearchPdf({
      subject: item.title ?? item.subject,
      receivedAt: item.receivedAt,
      attachmentNames: Array.isArray(item.attachmentNames) ? item.attachmentNames : item.pdfFile ? [item.pdfFile] : [],
      archiveIndex,
    });
    if (!match?.file) continue;
    const key = match.file.toLowerCase();
    if (byFile.has(key)) continue;
    byFile.set(key, link);
  }
  return byFile;
}

async function extractPdfBatch(paths) {
  if (!paths.length) return [];
  if (!existsSync(PYTHON) || !existsSync(EXTRACTOR)) {
    return paths.map((path) => ({
      path,
      ok: false,
      text: "",
      skipReason: "pdf_extractor_unavailable",
    }));
  }
  try {
    const { stdout } = await execFileAsync(PYTHON, [EXTRACTOR, "--text-jsonl", ...paths], {
      timeout: EXTRACT_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
    const rows = String(stdout || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const byPath = new Map(rows.map((row) => [String(row.path), row]));
    return paths.map((path) => byPath.get(path) ?? {
      path,
      ok: false,
      text: "",
      skipReason: "extract_missing_row",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return paths.map((path) => ({
      path,
      ok: false,
      text: "",
      skipReason: `extract_failed:${reason.slice(0, 180)}`,
    }));
  }
}

/**
 * Merge the per-root indexes into one.
 *
 * The curated archive is listed first, so when the same report exists both as a
 * hand-filed copy and as a saved mail attachment the archive path wins by name.
 * Content-level de-duplication happens separately, by SHA-256, because the same
 * report frequently arrives under two different attachment names.
 */
function indexAxisPdfRoots(roots) {
  const byName = new Map();
  const files = [];
  for (const root of roots) {
    const index = indexAxisPdfArchive(root);
    for (const [key, value] of index.byName) {
      if (!byName.has(key)) byName.set(key, value);
    }
    for (const file of index.files ?? []) files.push(file);
  }
  return { roots, byName, files };
}

function sha256Of(path) {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "";
  }
}

/**
 * Recursively index Axis Research PDFs into the Satya corpus.
 * @returns {Promise<{ attempted: number, valid: number, indexed: number, unchanged: number, skippedCorrupt: number, skippedEmpty: number, skippedPromo: number, linkedMail: number, liveWebinars: number }>}
 */
export async function ingestSatyaAxisPdfArchive({
  archiveRoot,
  archiveRoots,
  mailItems = [],
  corpusPath,
  sender = "Axis Direct",
} = {}) {
  const stats = {
    attempted: 0,
    valid: 0,
    indexed: 0,
    unchanged: 0,
    skippedCorrupt: 0,
    skippedEmpty: 0,
    skippedPromo: 0,
    skippedDuplicate: 0,
    needsOcr: 0,
    linkedMail: 0,
    liveWebinars: 0,
    roots: [],
    fromMailbox: 0,
  };
  // Callers may still pass a single `archiveRoot`; the default now spans the
  // curated archive AND the mailbox attachment store, which is what made
  // mail-attachment-only reports invisible to Satya.
  const roots = archiveRoots
    ?? (archiveRoot ? [archiveRoot] : axisPdfRoots());
  stats.roots = roots;
  const mailboxRoot = axisMailAttachmentRoot();
  const index = indexAxisPdfRoots(roots);
  const files = index.files ?? [];
  stats.attempted = files.length;
  if (!files.length) {
    if (corpusPath) setSatyaMeta("lastPdfIngestAt", new Date().toISOString(), corpusPath);
    else setSatyaMeta("lastPdfIngestAt", new Date().toISOString());
    return stats;
  }

  const links = mailLinkMap(mailItems, index);
  const validPaths = [];
  const seenHashes = new Set();
  for (const path of files) {
    if (!isValidPdfHeader(path)) {
      stats.skippedCorrupt += 1;
      continue;
    }
    // The same report routinely exists both hand-filed and as a saved
    // attachment. De-duplicate on content, not on filename.
    const hash = sha256Of(path);
    if (hash && seenHashes.has(hash)) {
      stats.skippedDuplicate += 1;
      continue;
    }
    if (hash) seenHashes.add(hash);
    if (path.startsWith(mailboxRoot)) stats.fromMailbox += 1;
    validPaths.push(path);
  }
  stats.valid = validPaths.length;

  for (let offset = 0; offset < validPaths.length; offset += EXTRACT_BATCH) {
    const batch = validPaths.slice(offset, offset + EXTRACT_BATCH);
    const extracted = await extractPdfBatch(batch);
    for (const row of extracted) {
      const path = String(row.path || "");
      const name = basename(path);
      const axisCategory = classifyAxisCategory(name);
      if (axisCategory === "live_webinars") stats.liveWebinars += 1;
      if (!row.ok || row.skipReason === "invalid_pdf_header" || row.skipReason?.startsWith("open_failed") || row.skipReason?.startsWith("extract_failed")) {
        stats.skippedCorrupt += 1;
        continue;
      }
      const text = String(row.text || "").trim();
      if (text.length < 40 && axisCategory !== "live_webinars") {
        // A scanned/image-only Axis note has no text layer. Record why it is
        // absent instead of indexing an empty document that Satya would then
        // silently fail to cite.
        if (!OCR_ENABLED) stats.needsOcr += 1;
        stats.skippedEmpty += 1;
        continue;
      }
      const linked = links.get(name.toLowerCase());
      if (linked?.messageUrl) stats.linkedMail += 1;
      const result = upsertSatyaDocument({
        messageId: pdfMessageId(path),
        mailbox: "Axis Research",
        family: "axis_research",
        sender,
        title: name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "),
        subject: name,
        receivedAt: receivedAtForPdf(path, name),
        content: text || name,
        sanitizedText: text || name,
        pdfUrl: axisPdfApiUrl(name),
        pdfPath: path,
        messageUrl: linked?.messageUrl || "",
        contentSource: "pdf",
        axisCategory,
      }, corpusPath);
      if (result.skipped === "promo_or_empty") stats.skippedPromo += 1;
      else if (result.skipped === "unchanged") stats.unchanged += 1;
      else if (result.upserted) stats.indexed += 1;
    }
  }

  const stamp = new Date().toISOString();
  if (corpusPath) {
    setSatyaMeta("lastPdfIngestAt", stamp, corpusPath);
    setSatyaMeta("lastPdfIngestStats", JSON.stringify(stats), corpusPath);
  } else {
    setSatyaMeta("lastPdfIngestAt", stamp);
    setSatyaMeta("lastPdfIngestStats", JSON.stringify(stats));
  }
  return stats;
}

function isMain() {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  // Save mailbox attachments first, then index every root. Running the ingest
  // alone would reproduce the original gap on a machine whose curated archive
  // is empty.
  (async () => {
    const attachments = await saveAxisMailAttachments();
    const ingest = await ingestSatyaAxisPdfArchive();
    return { attachments, ingest };
  })()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      console.error("[satya-axis-pdf-ingest] failed:", error);
      process.exitCode = 1;
    });
}
