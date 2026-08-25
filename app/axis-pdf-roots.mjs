import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

/**
 * Where Axis Research PDFs live.
 *
 * Historically there was exactly one root: a local folder the operator had
 * manually saved reports into (`~/Downloads/Axis Research`). Any report that
 * only ever arrived as a Mail attachment was therefore invisible to both the
 * Satya corpus and the PDF viewer route -- the reported "ALL Axis Research PDFs
 * from MAILBOX are NOT INCLUDED in SATYA".
 *
 * `scripts/axis-mail-attachments.mjs` now saves attachments out of the exact
 * `iCloud -> Axis Research` mailbox into a second root, and every consumer
 * resolves across both.
 */

/** Manually curated local archive. */
export function axisLocalArchiveRoot() {
  return process.env.AXIS_PDF_ARCHIVE_PATH
    ?? process.env.AXIS_RESEARCH_DIR
    ?? join(process.env.HOME ?? "", "Downloads", "Axis Research");
}

/** PDFs saved directly out of the Axis Research mailbox. Private, gitignored. */
export function axisMailAttachmentRoot() {
  return process.env.AXIS_MAIL_PDF_STORE_PATH
    ?? join(process.cwd(), "artifacts", "private", "satya", "axis-pdf");
}

/**
 * Every root a PDF may legitimately come from, de-duplicated and ordered with
 * the curated archive first so a manually filed copy wins on name collisions.
 */
export function axisPdfRoots() {
  const roots = [axisLocalArchiveRoot(), axisMailAttachmentRoot()]
    .map((root) => String(root || "").trim())
    .filter(Boolean)
    .map((root) => resolve(root));
  return [...new Set(roots)];
}

/**
 * Resolve a bare PDF filename inside the allowed roots.
 *
 * Path traversal is rejected before the walk, and every candidate is confirmed
 * to still sit under its root after resolution, so a symlink cannot escape.
 */
export function findAxisPdf(fileName, roots = axisPdfRoots()) {
  const base = basename(String(fileName || ""));
  if (!base || !/\.pdf$/i.test(base) || base.includes("..") || base.includes(sep)) return null;
  const wanted = base.toLowerCase();

  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    const rootResolved = resolve(root);
    const stack = [rootResolved];
    while (stack.length) {
      const current = stack.pop();
      let entries;
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
        if (entry.isFile() && entry.name.toLowerCase() === wanted) {
          const resolvedPath = resolve(path);
          if (resolvedPath === rootResolved || resolvedPath.startsWith(rootResolved + sep)) {
            try {
              if (statSync(resolvedPath).size > 0) return resolvedPath;
            } catch {
              // fall through to keep scanning
            }
          }
        }
      }
    }
  }
  return null;
}
