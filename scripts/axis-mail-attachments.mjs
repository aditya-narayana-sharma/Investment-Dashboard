import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { axisMailAttachmentRoot } from "../app/axis-pdf-roots.mjs";
import { isAxisResearchMail } from "./axis-mail-filter.mjs";

const execFileAsync = promisify(execFile);

/**
 * Save Axis Research PDF attachments out of Apple Mail.
 *
 * `satya-axis-pdf-ingest.mjs` only ever indexed a manually curated local folder,
 * so a report that arrived as a Mail attachment and was never filed by hand was
 * invisible to Satya. This walks the exact `iCloud -> Axis Research` mailbox and
 * writes every PDF attachment into the private attachment store, which the
 * ingest and the PDF route both now resolve against.
 *
 * Nothing here interprets a PDF. It only moves bytes and records, per message,
 * what was found, saved or skipped -- so "not included" becomes visible instead
 * of silent.
 */

const DEFAULT_ACCOUNT = process.env.AXIS_MAIL_ACCOUNT ?? "iCloud";
const DEFAULT_MAILBOX = process.env.AXIS_MAIL_MAILBOX ?? "Axis Research";
const OSASCRIPT_TIMEOUT_MS = 180_000;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/** Filesystem-safe basename that cannot escape the destination directory. */
export function safeAttachmentName(value) {
  const base = basename(String(value ?? "")).normalize("NFKC");
  const cleaned = base.replace(CONTROL_CHARS, "").replace(/[/\\:]+/g, "-").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "";
  return cleaned.length > 180 ? cleaned.slice(0, 176) + ".pdf" : cleaned;
}

export function isPdfAttachmentName(value) {
  return /\.pdf$/i.test(String(value ?? "").trim());
}

/** A PDF must actually start with %PDF- before it enters the store. */
export function hasPdfMagic(path) {
  try {
    const bytes = readFileSync(path);
    return bytes.length > 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  } catch {
    return false;
  }
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Index the store by content hash so the same report saved under two different
 * attachment names is stored, and later indexed, only once.
 */
export function indexStoreByHash(root) {
  const byHash = new Map();
  if (!root || !existsSync(root)) return byHash;
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return byHash;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !isPdfAttachmentName(entry.name)) continue;
    const path = join(root, entry.name);
    try {
      if (statSync(path).size <= 0) continue;
      byHash.set(sha256File(path), path);
    } catch {
      // unreadable file: leave it out of the index rather than failing the run
    }
  }
  return byHash;
}

/** Disambiguate a name collision with a short content digest, never overwrite. */
export function uniqueStorePath(root, name, hash) {
  const safe = safeAttachmentName(name) || hash.slice(0, 16) + ".pdf";
  const direct = join(root, safe);
  if (!existsSync(direct)) return direct;
  try {
    if (sha256File(direct) === hash) return direct;
  } catch {
    // fall through and suffix
  }
  const stem = safe.slice(0, safe.length - extname(safe).length);
  return join(root, stem + "-" + hash.slice(0, 8) + ".pdf");
}

function attachmentScript({ accountName, mailboxName, destDir, limit }) {
  return [
    'const Mail = Application("Mail");',
    'function exactAccount(name) {',
    '  const account = Mail.accounts().find((candidate) => String(candidate.name()) === name);',
    '  if (!account) throw new Error(\'Mail account "\' + name + \'" was not found\');',
    '  return account;',
    '}',
    'function exactMailbox(account, name) {',
    '  const mailbox = account.mailboxes().find((candidate) => String(candidate.name()) === name);',
    '  if (!mailbox) throw new Error(\'Mailbox "\' + name + \'" was not found\');',
    '  return mailbox;',
    '}',
    'const account = exactAccount(' + JSON.stringify(accountName) + ');',
    'const mailbox = exactMailbox(account, ' + JSON.stringify(mailboxName) + ');',
    'const destDir = ' + JSON.stringify(destDir) + ';',
    'const messages = mailbox.messages();',
    'const rows = [];',
    'let seen = 0;',
    'for (let index = 0; index < messages.length && seen < ' + limit + '; index += 1) {',
    '  const message = messages[index];',
    '  let subject = ""; let sender = ""; let received = "";',
    '  try {',
    '    subject = String(message.subject() || "");',
    '    sender = String(message.sender() || "");',
    '    received = message.dateReceived().toISOString();',
    '  } catch (error) { continue; }',
    '  seen += 1;',
    '  let attachments = [];',
    '  try { attachments = message.mailAttachments(); }',
    '  catch (error) {',
    '    rows.push({ subject, sender, received, name: "", saved: false, reason: "attachments_unreadable" });',
    '    continue;',
    '  }',
    '  for (let a = 0; a < attachments.length; a += 1) {',
    '    const attachment = attachments[a];',
    '    let name = "";',
    '    try { name = String(attachment.name() || ""); }',
    '    catch (error) {',
    '      rows.push({ subject, sender, received, name: "", saved: false, reason: "attachment_name_unreadable" });',
    '      continue;',
    '    }',
    '    if (!/[.]pdf$/i.test(name)) continue;',
    '    let downloaded = true;',
    '    try { downloaded = attachment.downloaded(); } catch (error) { downloaded = true; }',
    '    if (!downloaded) {',
    '      rows.push({ subject, sender, received, name, saved: false, reason: "not_downloaded" });',
    '      continue;',
    '    }',
    '    const target = destDir + "/" + name.replace(/[/:]+/g, "-");',
    '    try {',
    '      Mail.save(attachment, { in: Path(target) });',
    '      rows.push({ subject, sender, received, name, saved: true, path: target, reason: "" });',
    '    } catch (error) {',
    '      rows.push({ subject, sender, received, name, saved: false, reason: "save_failed:" + String(error).slice(0, 120) });',
    '    }',
    '  }',
    '}',
    'JSON.stringify({ messagesSeen: seen, rows: rows });',
  ].join("\n");
}

/**
 * @returns {Promise<{ messagesSeen: number, attachmentsFound: number, saved: number,
 *   duplicates: number, skipped: Array<{name: string, reason: string}>, storeRoot: string,
 *   available: boolean, reason: string }>}
 */
export async function saveAxisMailAttachments({
  accountName = DEFAULT_ACCOUNT,
  mailboxName = DEFAULT_MAILBOX,
  destDir = axisMailAttachmentRoot(),
  limit = 4000,
  researchOnly = true,
} = {}) {
  const ledger = {
    messagesSeen: 0,
    attachmentsFound: 0,
    saved: 0,
    duplicates: 0,
    skipped: [],
    storeRoot: destDir,
    available: false,
    reason: "",
  };

  if (process.platform !== "darwin") {
    ledger.reason = "apple_mail_unavailable:not_macos";
    return ledger;
  }

  mkdirSync(destDir, { recursive: true });
  const before = indexStoreByHash(destDir);

  let parsed;
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-l", "JavaScript", "-e", attachmentScript({ accountName, mailboxName, destDir, limit })],
      { timeout: OSASCRIPT_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
    );
    parsed = JSON.parse(stdout);
  } catch (error) {
    // Mail not running, no Automation permission, or the mailbox is missing.
    // Never claim coverage we do not have.
    const detail = error instanceof Error ? error.message : String(error);
    ledger.reason = "apple_mail_unavailable:" + detail.slice(0, 180);
    return ledger;
  }

  ledger.available = true;
  ledger.messagesSeen = Number(parsed.messagesSeen) || 0;

  for (const row of parsed.rows ?? []) {
    if (!isPdfAttachmentName(row.name)) continue;
    ledger.attachmentsFound += 1;

    if (researchOnly && !isAxisResearchMail({ sender: row.sender, subject: row.subject })) {
      ledger.skipped.push({ name: row.name, reason: "not_axis_research_mail" });
      continue;
    }
    if (!row.saved) {
      ledger.skipped.push({ name: row.name, reason: row.reason || "save_failed" });
      continue;
    }

    const path = String(row.path || "");
    if (!existsSync(path)) {
      ledger.skipped.push({ name: row.name, reason: "saved_file_missing" });
      continue;
    }
    if (!hasPdfMagic(path)) {
      // A truncated or HTML "PDF" must not enter the corpus as an empty document.
      ledger.skipped.push({ name: row.name, reason: "invalid_pdf_header" });
      continue;
    }

    const hash = sha256File(path);
    if (before.has(hash)) {
      ledger.duplicates += 1;
      continue;
    }
    before.set(hash, path);
    ledger.saved += 1;
  }

  return ledger;
}

function isMain() {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  saveAxisMailAttachments()
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    })
    .catch((error) => {
      console.error("[axis-mail-attachments] failed:", error);
      process.exitCode = 1;
    });
}
