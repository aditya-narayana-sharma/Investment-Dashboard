import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  axisTopicGroup,
  indexAxisPdfArchive,
  mailMessageUrl,
  matchAxisResearchPdf,
  preferApplePodcastsEpisodeUrl,
  resolveAxisPdfWithinArchive,
} from "../scripts/axis-digest-links.mjs";

test("axisTopicGroup collapses Axis subjects into stable digest topics", () => {
  assert.equal(axisTopicGroup("Target Achieved: Cholamandalam Investment and Fin Co Ltd - Axis Punch"), "Target Achieved");
  assert.equal(axisTopicGroup("Axis Punch - Oberoi Realty Limited"), "Punch");
  assert.equal(axisTopicGroup("Result Updates - Q1FY27: Our Latest Stock Recommendations & Target Prices"), "Result Updates");
  assert.equal(axisTopicGroup("Daily Technical Outlook"), "Daily Technical Outlook");
  assert.equal(axisTopicGroup("Daily Morning Note & Trade Setup for the Day - August 06, 2026"), "Daily Morning Note");
  assert.equal(axisTopicGroup("Axis Alpha: TBO Tek Ltd - BUY"), "Axis Alpha");
  assert.equal(axisTopicGroup("Monthly Quant Report August 2026"), "Monthly Quant");
});

test("mailMessageUrl builds message:// links from Message-ID values only", () => {
  assert.equal(mailMessageUrl(""), "");
  assert.equal(mailMessageUrl("<abc@example.com>"), `message://${encodeURIComponent("<abc@example.com>")}`);
});

test("preferApplePodcastsEpisodeUrl prefers store IDs then https fallbacks", () => {
  assert.equal(
    preferApplePodcastsEpisodeUrl({ storeCollectionId: 123, storeTrackId: 456, episodeUrl: "https://omny.fm/x" }),
    "https://podcasts.apple.com/podcast/id123?i=456",
  );
  assert.equal(
    preferApplePodcastsEpisodeUrl({ episodeUrl: "https://omny.fm/shows/example/ep" }),
    "https://omny.fm/shows/example/ep",
  );
  assert.equal(preferApplePodcastsEpisodeUrl({ episodeUrl: "javascript:alert(1)" }), "");
});

test("matchAxisResearchPdf only returns files present in the archive", () => {
  const root = mkdtempSync(join(tmpdir(), "axis-pdf-"));
  mkdirSync(join(root, "Axis Reports"), { recursive: true });
  writeFileSync(join(root, "Axis_MorningNote-2026-08-06.pdf"), "%PDF-1.4");
  writeFileSync(join(root, "Axis Reports", "Axis_OberoiRealty-AxisPunch-2026-08-06.pdf"), "%PDF-1.4");
  writeFileSync(join(root, "Axis_TechnicalOutlook-2026-08-06.pdf"), "%PDF-1.4");
  const index = indexAxisPdfArchive(root);

  assert.deepEqual(
    matchAxisResearchPdf({
      subject: "Daily Morning Note & Trade Setup for the Day - August 06, 2026",
      receivedAt: "2026-08-06T02:00:00.000Z",
      archiveIndex: index,
    }),
    { file: "Axis_MorningNote-2026-08-06.pdf", path: join(root, "Axis_MorningNote-2026-08-06.pdf") },
  );

  assert.equal(
    matchAxisResearchPdf({
      subject: "Axis Punch - Oberoi Realty Limited",
      receivedAt: "2026-08-06T02:00:00.000Z",
      attachmentNames: ["Axis_OberoiRealty-AxisPunch-2026-08-06.pdf"],
      archiveIndex: index,
    })?.file,
    "Axis_OberoiRealty-AxisPunch-2026-08-06.pdf",
  );

  assert.equal(
    matchAxisResearchPdf({
      subject: "Daily Technical Outlook",
      receivedAt: "2026-08-06T02:00:00.000Z",
      archiveIndex: index,
    })?.file,
    "Axis_TechnicalOutlook-2026-08-06.pdf",
  );

  assert.equal(
    matchAxisResearchPdf({
      subject: "Unmatched research note without archive file",
      receivedAt: "2026-08-06T02:00:00.000Z",
      archiveIndex: index,
    }),
    null,
  );

  assert.equal(resolveAxisPdfWithinArchive(root, "Axis_MorningNote-2026-08-06.pdf"), join(root, "Axis_MorningNote-2026-08-06.pdf"));
  assert.equal(resolveAxisPdfWithinArchive(root, "../secret.pdf"), null);
  assert.equal(resolveAxisPdfWithinArchive(root, "missing.pdf"), null);
});
