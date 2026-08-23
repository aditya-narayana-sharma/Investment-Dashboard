/**
 * Index local Axis Research PDFs into the Satya corpus.
 * Validates headers, extracts text-layer only, never invents KPIs.
 * Failed extracts skip that file and do not replace a valid mail snapshot.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { classifyAxisCategory } from "../app/satya/axis-categories.mjs";
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
const DEFAULT_ARCHIVE = process.env.AXIS_PDF_ARCHIVE_PATH
  ?? process.env.AXIS_RESEARCH_DIR
  ?? join(process.env.HOME ?? "", "Downloads", "Axis Research");
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
 * Recursively index Axis Research PDFs into the Satya corpus.
 * @returns {Promise<{ attempted: number, valid: number, indexed: number, unchanged: number, skippedCorrupt: number, skippedEmpty: number, skippedPromo: number, linkedMail: number, liveWebinars: number }>}
 */
export async function ingestSatyaAxisPdfArchive({
  archiveRoot = DEFAULT_ARCHIVE,
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
    linkedMail: 0,
    liveWebinars: 0,
  };
  const index = indexAxisPdfArchive(archiveRoot);
  const files = index.files ?? [];
  stats.attempted = files.length;
  if (!files.length) {
    if (corpusPath) setSatyaMeta("lastPdfIngestAt", new Date().toISOString(), corpusPath);
    else setSatyaMeta("lastPdfIngestAt", new Date().toISOString());
    return stats;
  }

  const links = mailLinkMap(mailItems, index);
  const validPaths = [];
  for (const path of files) {
    if (!isValidPdfHeader(path)) {
      stats.skippedCorrupt += 1;
      continue;
    }
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
  ingestSatyaAxisPdfArchive()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      console.error("[satya-axis-pdf-ingest] failed:", error);
      process.exitCode = 1;
    });
}
