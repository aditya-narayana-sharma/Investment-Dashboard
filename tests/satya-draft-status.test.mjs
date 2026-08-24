import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SATYA_DRAFT_STATUS_INTERVAL_MS,
  SATYA_DRAFT_STATUS_PHRASES,
  SATYA_DRAFT_STATUS_REDUCED,
  satyaDraftStatusPhrase,
  satyaDraftStatusPhraseFromSse,
  satyaDraftStatusStageFromSse,
} from "../app/dashboard/satya-draft-status.ts";

test("Satya draft status rotates corpus-faithful process labels", () => {
  assert.ok(SATYA_DRAFT_STATUS_PHRASES.includes("Thinking…"));
  assert.ok(SATYA_DRAFT_STATUS_PHRASES.includes("Going through Research…"));
  assert.ok(SATYA_DRAFT_STATUS_PHRASES.includes("Analyzing KPIs…"));
  assert.equal(SATYA_DRAFT_STATUS_REDUCED, "Thinking…");
  assert.ok(SATYA_DRAFT_STATUS_INTERVAL_MS >= 2000 && SATYA_DRAFT_STATUS_INTERVAL_MS <= 3000);
  assert.doesNotMatch(SATYA_DRAFT_STATUS_PHRASES.join(" "), /Drafting…/);
  assert.equal(satyaDraftStatusPhrase(0), "Thinking…");
  assert.equal(satyaDraftStatusPhrase(1), "Going through Research…");
  assert.equal(satyaDraftStatusPhrase(2), "Analyzing KPIs…");
  assert.equal(
    satyaDraftStatusPhrase(SATYA_DRAFT_STATUS_PHRASES.length),
    SATYA_DRAFT_STATUS_PHRASES[0],
  );
});

test("Satya draft status maps SSE retrieve vs generate and honors reduced motion", () => {
  assert.equal(satyaDraftStatusStageFromSse("Retrieving Satya corpus…"), "retrieve");
  assert.equal(satyaDraftStatusStageFromSse("Going through Research…"), "retrieve");
  assert.equal(satyaDraftStatusStageFromSse("Drafting from retrieved passages…"), "generate");
  assert.equal(satyaDraftStatusStageFromSse("Thinking…"), "generate");
  assert.equal(satyaDraftStatusPhraseFromSse("Retrieving Satya corpus…"), "Going through Research…");
  assert.equal(satyaDraftStatusPhraseFromSse("Drafting from retrieved passages…"), null);
  assert.equal(satyaDraftStatusPhrase(4, { stageMessage: "Retrieving Satya corpus…" }), "Going through Research…");
  assert.equal(satyaDraftStatusPhrase(4, { stageMessage: "Thinking…" }), SATYA_DRAFT_STATUS_PHRASES[4 % SATYA_DRAFT_STATUS_PHRASES.length]);
  assert.equal(satyaDraftStatusPhrase(9, { reducedMotion: true }), "Thinking…");
  assert.equal(satyaDraftStatusPhrase(9, { reducedMotion: true, stageMessage: "Retrieving Satya corpus…" }), "Thinking…");
});

test("Satya wait UI and CSS drop frozen Drafting copy and wrap reply text", async () => {
  const [statusLine, room, presence, popout, css, statusCss, popoutCss, client, chat] = await Promise.all([
    readFile(new URL("../app/dashboard/SatyaDraftStatusLine.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SatyaBriefingRoom.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SatyaPresence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SatyaDraftPopout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya-draft-status.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya-draft-popout.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/satya/chat.ts", import.meta.url), "utf8"),
  ]);
  assert.match(statusLine, /aria-live=\{live \? "polite" : undefined\}/);
  assert.match(statusLine, /prefers-reduced-motion: reduce/);
  assert.match(statusLine, /satyaDraftStatusPhrase/);
  assert.doesNotMatch(room, />Drafting…</);
  assert.doesNotMatch(presence, />Drafting…</);
  assert.doesNotMatch(popout, />Drafting…</);
  assert.match(room, /SatyaDraftStatusLine/);
  assert.match(presence, /SatyaDraftStatusLine/);
  assert.match(popout, /SatyaDraftStatusLine/);
  assert.match(client, /publishSatyaDraftStatusMessage/);
  assert.match(chat, /Going through Research…/);
  assert.match(chat, /event: "status", data: \{ message: "Thinking…" \}/);
  assert.match(statusCss, /satya-draft-status-shimmer/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*satya-draft-status-phrase/);
  assert.match(css, /\.satya-turn pre[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.satya-turn pre[\s\S]*white-space:\s*pre-wrap/);
  assert.match(popoutCss, /\.satya-draft-popout-body[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(popoutCss, /word-break:\s*break-word/);
});
