import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getSatyaThread,
  setSatyaThread,
} from "../app/dashboard/satya-client.ts";
import {
  closeSatyaDraftPopout,
  currentSatyaTurn,
  hasNativeSatyaDraftPopout,
  isSatyaDraftPopoutDrafting,
  isSatyaDraftPopoutOpen,
  openSatyaDraftPopout,
  satyaDraftPopoutPayload,
  syncSatyaDraftPopout,
} from "../app/dashboard/satya-draft-popout.ts";

function resetThread() {
  closeSatyaDraftPopout();
  setSatyaThread({ sessionId: null, turns: [] }, false);
}

test("draft pop-out opens the current turn and closing keeps the thread", () => {
  resetThread();
  setSatyaThread({
    sessionId: "sess-pop",
    turns: [
      { id: "user-old", role: "user", text: "Older question", citations: [] },
      { id: "asst-old", role: "assistant", text: "Older answer", citations: [] },
      { id: "user-now", role: "user", text: "What started the HDFC print?", citations: [] },
      { id: "asst-now", role: "assistant", text: "Drafting a long-form story…", citations: [] },
    ],
  }, false);
  assert.equal(isSatyaDraftPopoutOpen(), false);
  openSatyaDraftPopout({ drafting: true });
  assert.equal(isSatyaDraftPopoutOpen(), true);
  assert.equal(isSatyaDraftPopoutDrafting(), true);
  const payload = satyaDraftPopoutPayload("open");
  assert.equal(payload.sessionId, "sess-pop");
  assert.equal(payload.drafting, true);
  assert.deepEqual(payload.turns.map((turn) => turn.id), ["user-now", "asst-now"]);
  assert.equal(hasNativeSatyaDraftPopout(), false);
  closeSatyaDraftPopout();
  assert.equal(isSatyaDraftPopoutOpen(), false);
  assert.equal(isSatyaDraftPopoutDrafting(), false);
  assert.equal(getSatyaThread().sessionId, "sess-pop");
  assert.equal(getSatyaThread().turns.length, 4);
  assert.equal(currentSatyaTurn(getSatyaThread().turns)[0]?.text, "What started the HDFC print?");
});

test("draft pop-out update keeps drafting false after the answer finishes", () => {
  resetThread();
  setSatyaThread({
    sessionId: "sess-done",
    turns: [
      { id: "user-1", role: "user", text: "Overnight newsletter themes", citations: [] },
      { id: "asst-1", role: "assistant", text: "A long story from the digest.", citations: [] },
    ],
  }, false);
  openSatyaDraftPopout({ drafting: true });
  syncSatyaDraftPopout({ drafting: false });
  assert.equal(isSatyaDraftPopoutOpen(), true);
  assert.equal(isSatyaDraftPopoutDrafting(), false);
  assert.equal(satyaDraftPopoutPayload("update").turns.at(-1)?.text, "A long story from the digest.");
  closeSatyaDraftPopout();
});

test("native Satya draft panel and web pop-out stay wired together", async () => {
  const [client, draftModule, presence, room, popout, css, browser, iosBrowser, bridge] = await Promise.all([
    readFile(new URL("../app/dashboard/satya-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya-draft-popout.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SatyaPresence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SatyaBriefingRoom.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SatyaDraftPopout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya-draft-popout.css", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Shared/StratjiDocumentBrowser.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/InvestmentDashboard/DashboardBrowser.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Shared/StratjiSatyaDraftBridge.swift", import.meta.url), "utf8"),
  ]);
  assert.match(client, /onSatyaThreadNotify/);
  assert.match(draftModule, /openSatyaDraftPopout/);
  assert.match(draftModule, /messageHandlers\?\.satyaDraft/);
  assert.match(draftModule, /Does not clear/);
  assert.match(presence, /openSatyaDraftPopout\(\{ drafting: true \}\)/);
  assert.match(presence, /<SatyaDraftPopout/);
  assert.match(presence, /Pop out/);
  assert.match(room, /openSatyaDraftPopout\(\{ drafting: true \}\)/);
  assert.match(room, /Pop out/);
  assert.match(popout, /aria-modal="true"/);
  assert.match(popout, /hasNativeSatyaDraftPopout/);
  assert.match(popout, /Escape/);
  assert.match(popout, /SatyaCitationIcons/);
  assert.match(popout, /SatyaDraftStatusLine/);
  assert.doesNotMatch(popout, />Drafting…</);
  assert.match(css, /\.satya-draft-popout-body[\s\S]*max-height:\s*none/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(browser, /StratjiSatyaDraftBridge/);
  assert.match(popout, /satya-draft-popout\.css/);
  assert.match(iosBrowser, /#if os\(macOS\)[\s\S]*add\(satyaDraft/);
  assert.ok(iosBrowser.indexOf("#if os(macOS)") < iosBrowser.indexOf("add(satyaDraft"));
  assert.match(bridge, /webkit\.messageHandlers\.satyaDraft/);
  assert.match(bridge, /NSPanel/);
  assert.match(bridge, /cancelOperation/);
  assert.match(bridge, /Closing the panel does not clear the JS thread/);
  assert.doesNotMatch(popout, /citation wall|Open PDF<\/a>/i);
});
