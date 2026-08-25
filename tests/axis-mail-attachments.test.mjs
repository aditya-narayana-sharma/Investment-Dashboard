import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hasPdfMagic,
  indexStoreByHash,
  isPdfAttachmentName,
  safeAttachmentName,
  saveAxisMailAttachments,
  sha256File,
  uniqueStorePath,
} from "../scripts/axis-mail-attachments.mjs";
import { axisPdfRoots, findAxisPdf } from "../app/axis-pdf-roots.mjs";
import { ingestSatyaAxisPdfArchive } from "../scripts/satya-axis-pdf-ingest.mjs";

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("attachment names cannot escape the destination directory", () => {
  assert.equal(safeAttachmentName("../../etc/passwd.pdf"), "passwd.pdf");
  assert.equal(safeAttachmentName("Axis Alpha/August.pdf"), "August.pdf");
  assert.equal(safeAttachmentName(""), "");
  assert.equal(safeAttachmentName("."), "");
  assert.equal(safeAttachmentName(".."), "");
  assert.ok(safeAttachmentName(`${"a".repeat(400)}.pdf`).length <= 180);
});

test("only PDF attachments are considered", () => {
  assert.equal(isPdfAttachmentName("Axis Punch.pdf"), true);
  assert.equal(isPdfAttachmentName("Axis Punch.PDF"), true);
  assert.equal(isPdfAttachmentName("logo.png"), false);
  assert.equal(isPdfAttachmentName("report.pdf.exe"), false);
  assert.equal(isPdfAttachmentName(null), false);
});

test("a saved file must really be a PDF before it enters the corpus", () => {
  const dir = tempDir("axis-magic-");
  const real = join(dir, "real.pdf");
  const fake = join(dir, "fake.pdf");
  writeFileSync(real, "%PDF-1.7\nbody");
  // Mail sometimes saves an HTML error page under a .pdf name.
  writeFileSync(fake, "<html>session expired</html>");
  assert.equal(hasPdfMagic(real), true);
  assert.equal(hasPdfMagic(fake), false);
  assert.equal(hasPdfMagic(join(dir, "missing.pdf")), false);
});

test("the store is indexed by content, so one report under two names is one entry", () => {
  const dir = tempDir("axis-store-");
  writeFileSync(join(dir, "Axis Alpha Aug.pdf"), "%PDF-1.4\nidentical");
  writeFileSync(join(dir, "axis-alpha-august-copy.pdf"), "%PDF-1.4\nidentical");
  writeFileSync(join(dir, "Axis Punch.pdf"), "%PDF-1.4\ndifferent");

  const byHash = indexStoreByHash(dir);
  assert.equal(byHash.size, 2, "identical bytes must collapse to one hash");
});

test("uniqueStorePath reuses the path for identical bytes and suffixes on a real collision", () => {
  const dir = tempDir("axis-unique-");
  const existing = join(dir, "Axis Punch.pdf");
  writeFileSync(existing, "%PDF-1.4\noriginal");
  const sameHash = sha256File(existing);

  assert.equal(uniqueStorePath(dir, "Axis Punch.pdf", sameHash), existing, "same content must not duplicate");

  const otherHash = "f".repeat(64);
  const suffixed = uniqueStorePath(dir, "Axis Punch.pdf", otherHash);
  assert.notEqual(suffixed, existing, "different content must never overwrite");
  assert.ok(suffixed.endsWith("-ffffffff.pdf"));

  assert.equal(indexStoreByHash(tempDir("axis-empty-")).size, 0);
});

test("saveAxisMailAttachments reports unavailability instead of claiming coverage", async () => {
  const dir = tempDir("axis-unavail-");
  const ledger = await saveAxisMailAttachments({
    destDir: dir,
    accountName: "NoSuchAccount__stratji_test",
    mailboxName: "NoSuchMailbox__stratji_test",
    limit: 1,
  });
  assert.equal(ledger.saved, 0);
  assert.equal(ledger.attachmentsFound, 0);
  assert.ok(ledger.reason.startsWith("apple_mail_unavailable"), `unexpected reason: ${ledger.reason}`);
  assert.equal(ledger.available, false, "a failed Mail read must never report itself as available");
  assert.equal(ledger.storeRoot, dir);
});

test("axisPdfRoots spans the curated archive and the mailbox store", () => {
  const archive = tempDir("axis-archive-");
  const mailbox = tempDir("axis-mailbox-");
  const previous = [process.env.AXIS_PDF_ARCHIVE_PATH, process.env.AXIS_MAIL_PDF_STORE_PATH];
  process.env.AXIS_PDF_ARCHIVE_PATH = archive;
  process.env.AXIS_MAIL_PDF_STORE_PATH = mailbox;
  try {
    const roots = axisPdfRoots();
    assert.equal(roots.length, 2);
    assert.ok(roots.includes(archive));
    assert.ok(roots.includes(mailbox));

    // A report that exists ONLY as a saved mail attachment must resolve.
    writeFileSync(join(mailbox, "Axis Punch 25 Aug 2026.pdf"), "%PDF-1.4\nbody");
    assert.ok(findAxisPdf("Axis Punch 25 Aug 2026.pdf"), "mailbox-only PDF must be servable");
    assert.equal(findAxisPdf("../../etc/passwd.pdf"), null, "traversal must be refused");
    assert.equal(findAxisPdf("notes.txt"), null);
    assert.equal(findAxisPdf("absent.pdf"), null);
  } finally {
    [process.env.AXIS_PDF_ARCHIVE_PATH, process.env.AXIS_MAIL_PDF_STORE_PATH] = previous;
    if (previous[0] === undefined) delete process.env.AXIS_PDF_ARCHIVE_PATH;
    if (previous[1] === undefined) delete process.env.AXIS_MAIL_PDF_STORE_PATH;
  }
});

test("ingest spans both roots and de-duplicates identical reports by content", async () => {
  const corpusDir = tempDir("axis-corpus-");
  const corpusPath = join(corpusDir, "satya.sqlite");
  const archive = join(corpusDir, "archive");
  const mailbox = join(corpusDir, "mailbox");
  mkdirSync(archive, { recursive: true });
  mkdirSync(mailbox, { recursive: true });

  // Same report, filed by hand and saved from Mail under a different name.
  writeFileSync(join(archive, "Axis Alpha 2026-08-20.pdf"), "%PDF-1.4\nsame-bytes");
  writeFileSync(join(mailbox, "Axis_Alpha_Aug20.pdf"), "%PDF-1.4\nsame-bytes");
  // A report that exists ONLY in the mailbox — the RC-6 case.
  writeFileSync(join(mailbox, "Axis Punch 2026-08-25.pdf"), "%PDF-1.4\nmailbox-only");

  const stats = await ingestSatyaAxisPdfArchive({
    archiveRoots: [archive, mailbox],
    mailItems: [],
    corpusPath,
  });

  assert.equal(stats.attempted, 3, "every file across both roots is attempted");
  assert.equal(stats.skippedDuplicate, 1, "identical bytes are indexed once");
  assert.equal(stats.valid, 2);
  assert.deepEqual(stats.roots, [archive, mailbox]);
});

test("a header-only PDF is recorded as needing OCR, never indexed as blank", async () => {
  const corpusDir = tempDir("axis-ocr-");
  const corpusPath = join(corpusDir, "satya.sqlite");
  const mailbox = join(corpusDir, "mailbox");
  mkdirSync(mailbox, { recursive: true });
  // Valid header, no extractable text layer — a scanned Axis note.
  writeFileSync(join(mailbox, "Scanned Axis Note 2026-08-25.pdf"), "%PDF-1.4\n");

  const stats = await ingestSatyaAxisPdfArchive({
    archiveRoots: [mailbox],
    mailItems: [],
    corpusPath,
  });

  assert.equal(stats.indexed, 0, "an empty extraction must not become a blank document");
  assert.ok(
    stats.needsOcr + stats.skippedEmpty + stats.skippedCorrupt >= 1,
    "the reason must be recorded somewhere in the ledger",
  );
});
