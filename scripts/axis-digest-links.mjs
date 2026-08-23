/**
 * Axis Research digest topic grouping + local PDF archive matching.
 * Never invents PDF paths: only returns files that exist under the archive root.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import {
  axisCategoryLabel,
  classifyAxisCategory,
} from "../app/satya/axis-categories.mjs";

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Normalize raw Apple Mail source before extracting report anchors.
 *
 * Some Axis 8-bit HTML messages hard-wrap a tracker parameter immediately
 * after its assignment (for example `&ul=\nVALUE`). Preserve that assignment
 * before removing genuine quoted-printable soft line breaks, otherwise the
 * URL becomes `&ulVALUE` and Axis responds with its 404 page.
 */
export function normalizeMailSourceForLinks(source) {
  return String(source ?? "")
    .replace(/([?&][A-Za-z][A-Za-z0-9_-]*)=\r?\n(?=[A-Za-z0-9+/])/g, "$1=")
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/&amp;/gi, "&")
    .replace(/&#x3D;/gi, "=");
}

/** Collapse Axis mail subjects into the canonical 28-category labels. */
export function axisTopicGroup(subject) {
  return axisCategoryLabel(classifyAxisCategory(subject));
}

/** Canonical Axis category id for PDF matching and digest `axisCategory`. */
export function axisTopicCategoryId(subject) {
  return classifyAxisCategory(subject);
}

export function istDateKeyFromIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function walkPdfFiles(root, limit = 4000) {
  const files = [];
  const stack = [root];
  while (stack.length && files.length < limit) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "Icon\r") continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (/duplicates|_try/i.test(entry.name)) continue;
        stack.push(path);
        continue;
      }
      if (entry.isFile() && /\.pdf$/i.test(entry.name) && !/^_try/i.test(entry.name)) {
        files.push(path);
      }
    }
  }
  return files;
}

/** Index PDF basenames under the Axis archive (newest mtime first per basename). */
export function indexAxisPdfArchive(archiveRoot) {
  const root = resolve(String(archiveRoot || ""));
  if (!root || !existsSync(root)) return { root, byName: new Map(), files: [] };
  const files = walkPdfFiles(root);
  const byName = new Map();
  for (const path of files) {
    const name = basename(path);
    const key = name.toLowerCase();
    const prev = byName.get(key);
    let mtime = 0;
    try {
      mtime = statSync(path).mtimeMs;
    } catch {
      mtime = 0;
    }
    if (!prev || mtime >= prev.mtime) byName.set(key, { path, name, mtime });
  }
  return { root, byName, files };
}

function companyToken(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:ltd|limited|inc|corp|company|co|the|and|&)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function findBySubstring(index, needle) {
  const want = String(needle || "").toLowerCase();
  if (!want) return null;
  const matches = [];
  for (const entry of index.byName.values()) {
    if (entry.name.toLowerCase().includes(want)) matches.push(entry);
  }
  matches.sort((left, right) => right.mtime - left.mtime);
  return matches[0] ?? null;
}

function findExact(index, fileName) {
  if (!fileName) return null;
  return index.byName.get(String(fileName).toLowerCase()) ?? null;
}

/**
 * Resolve a local Axis PDF for a digest mail item from attachment names and/or subject cues.
 * Returns null when no archive file can be matched.
 */
export function matchAxisResearchPdf({
  subject,
  receivedAt,
  attachmentNames = [],
  archiveIndex,
} = {}) {
  const index = archiveIndex ?? { byName: new Map(), files: [], root: "" };
  if (!index.byName.size) return null;

  for (const name of attachmentNames) {
    const base = basename(String(name || ""));
    if (!/\.pdf$/i.test(base)) continue;
    const hit = findExact(index, base);
    if (hit) return { file: hit.name, path: hit.path };
  }

  const title = cleanText(subject);
  const dateKey = istDateKeyFromIso(receivedAt);
  const category = classifyAxisCategory(title);

  // Daily publications are date-specific. Never fall back to the newest file
  // from another day: that can make a current mail open stale evidence.
  const dated = (kind) => (dateKey ? findBySubstring(index, `${kind}-${dateKey}`) : null);

  switch (category) {
    case "daily_morning_note": {
      const hit = dated("MorningNote");
      return hit ? { file: hit.name, path: hit.path } : null;
    }
    case "daily_technical_outlook": {
      const hit = dated("TechnicalOutlook");
      return hit ? { file: hit.name, path: hit.path } : null;
    }
    case "monthly_quant_report": {
      const hit = dated("MonthlyQuant") ?? findBySubstring(index, "MonthlyQuantReport");
      return hit ? { file: hit.name, path: hit.path } : null;
    }
    case "other_research": {
      if (!/\bevent update|\bmonetary policy|\brbi\b/i.test(title)) return null;
      const hit = findBySubstring(index, "RBIMonetary")
        ?? findBySubstring(index, "MonetaryPolicy")
        ?? findBySubstring(index, "EventUpdate");
      return hit ? { file: hit.name, path: hit.path } : null;
    }
    case "axis_punch":
    case "target_achieved":
    case "axis_alpha":
    case "pick_of_the_week":
    case "company_update":
    case "axis_annual_analysis":
    case "result_update":
    case "quarterly_result_updates": {
      const companyMatch = title.match(
        /(?:axis punch|target achieved|axis alpha|pick of the week|company update|annual analysis)\s*[:\-–]\s*([^|]+?)(?:\s*-\s*axis|\s*$)/i,
      ) ?? title.match(/:\s*([^|:]+?)(?:\s*-\s*(?:axis|our)|\s*$)/i);
      const company = companyToken(companyMatch?.[1] ?? "");
      const resultPack = category === "result_update" || category === "quarterly_result_updates";
      if (company) {
        const kindHints = {
          axis_punch: ["AxisPunch", "Punch"],
          target_achieved: ["AxisPunch", "Punch", "Target"],
          axis_alpha: ["AxisAlpha", "Alpha"],
          pick_of_the_week: ["PickOfWeek"],
          company_update: ["CompanyUpdate"],
          axis_annual_analysis: ["AnnualAnalysis", "CompanyUpdate"],
          result_update: ["ResultUpdate"],
          quarterly_result_updates: ["ResultUpdate"],
        }[category] ?? [];
        const candidates = [];
        for (const entry of index.byName.values()) {
          const lower = entry.name.toLowerCase();
          const companyHit = lower.includes(company) || company.includes(companyToken(entry.name.replace(/\.pdf$/i, "")));
          if (!companyHit) continue;
          const kindHit = kindHints.some((hint) => lower.includes(hint.toLowerCase())) || resultPack;
          if (!kindHit && !resultPack) continue;
          const dateBoost = dateKey && lower.includes(dateKey) ? 10 : 0;
          candidates.push({ entry, score: dateBoost + entry.mtime / 1e13 });
        }
        candidates.sort((left, right) => right.score - left.score);
        if (candidates[0]) return { file: candidates[0].entry.name, path: candidates[0].entry.path };
      }
      if (resultPack && dateKey) {
        const hit = findBySubstring(index, `ResultUpdate-${dateKey}`);
        if (hit) return { file: hit.name, path: hit.path };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Select explicit report/PDF links extracted from an Axis Research mail.
 * Links remain source-backed: this only validates and ranks anchors that were
 * present in the exact mailbox message; it never constructs a remote URL.
 */
export function selectAxisResearchReportLinks(reportLinks = []) {
  const selected = [];
  const seen = new Set();
  for (const candidate of reportLinks) {
    const href = cleanText(candidate?.url);
    const label = cleanText(candidate?.label);
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const decodedHref = decodeURIComponent(url.toString().replace(/\+/g, "%20"));
    const evidence = `${label} ${url.hostname} ${url.pathname} ${decodedHref}`;
    if (/unsubscribe|opt.?out|preference|privacy|terms|social|facebook|instagram|linkedin|twitter|youtube|whatsapp|app.?store|play\.google|contact.?us|feedback/i.test(evidence)) continue;

    const directPdf = /\.pdf(?:$|[?#])/i.test(url.toString());
    const explicitReportLabel = /\bpdf\b|\b(?:download|view|read|open)\s+(?:the\s+|full\s+|detailed\s+)?(?:pdf|report|research|note|outlook)\b|\b(?:full|detailed)\s+report\b/i.test(label);
    const reportUrlEvidence = /pdf|download|document|report|research|attachment|file/i.test(`${url.hostname}${url.pathname}${decodedHref}`);
    // Axis mails also contain generic tracked CTAs such as “Click Here”. Those
    // are not evidence that the mail has a PDF and must not create a button.
    if (!directPdf && !explicitReportLabel && !reportUrlEvidence) continue;

    let score = 0;
    if (directPdf) score += 100;
    if (/\bpdf\b/i.test(label)) score += 80;
    if (/\b(?:download|view|read|open)\b|full report|detailed report/i.test(label)) score += 40;
    if (/report|research|outlook|morning note|result update|sector seasonality|technical/i.test(label)) score += 30;
    if (reportUrlEvidence) score += 35;
    if (/axisdirect|axissecurities/i.test(url.hostname)) score += 20;
    if (score < 50) continue;

    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    selected.push({ url: normalized, label: label || "Axis Research report" });
  }
  return selected.slice(0, 20);
}

/** Ensure a resolved archive path stays inside the configured Axis PDF root. */
export function resolveAxisPdfWithinArchive(archiveRoot, fileName) {
  const root = resolve(String(archiveRoot || ""));
  const base = basename(String(fileName || ""));
  if (!root || !base || !/\.pdf$/i.test(base) || base.includes("..") || base.includes(sep)) return null;
  const index = indexAxisPdfArchive(root);
  const hit = findExact(index, base);
  if (!hit) return null;
  const resolved = resolve(hit.path);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) return null;
  return resolved;
}

/** Build Apple Mail message:// URL from a Message-ID header value. */
export function mailMessageUrl(messageId) {
  const id = cleanText(messageId);
  if (!id) return "";
  return `message://${encodeURIComponent(id)}`;
}

/**
 * Prefer an Apple Podcasts episode URL when store collection + track IDs exist.
 * Falls back to publisher webpage / enclosure URLs already present on the row.
 */
export function preferApplePodcastsEpisodeUrl({
  storeCollectionId,
  storeTrackId,
  storeCleanUrl,
  storeShortUrl,
  episodeUrl,
} = {}) {
  const collection = Number(storeCollectionId);
  const track = Number(storeTrackId);
  if (Number.isFinite(collection) && collection > 0 && Number.isFinite(track) && track > 0) {
    return `https://podcasts.apple.com/podcast/id${collection}?i=${track}`;
  }
  for (const candidate of [storeCleanUrl, storeShortUrl, episodeUrl]) {
    const value = cleanText(candidate);
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {
      // skip invalid
    }
  }
  return "";
}
