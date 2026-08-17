import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyCanonicalDashboardUrl, isIntegrationsView } from "../app/dashboard/workspace-routing.ts";
import { readKiteTicketResponse } from "../app/dashboard/kite-ticket-request.ts";

test("settings and integrations are chrome, not a seventh workspace", () => {
  assert.equal(isIntegrationsView("integrations"), true);
  assert.equal(isIntegrationsView("settings"), true);
  assert.equal(isIntegrationsView("investment"), false);

  const settings = new URL("http://localhost/?view=settings");
  assert.deepEqual(applyCanonicalDashboardUrl(settings), {
    chrome: "integrations",
    view: "investment",
    rewritten: true,
  });
  assert.equal(settings.searchParams.get("view"), "integrations");

  const integrations = new URL("http://localhost/?view=integrations");
  assert.deepEqual(applyCanonicalDashboardUrl(integrations), {
    chrome: "integrations",
    view: "investment",
    rewritten: false,
  });
});

test("integrations chrome does not mount workspace tabs or a kanban board", async () => {
  const [page, chrome] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntegrationsChrome.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /if \(chrome === "integrations"\)/);
  assert.match(page, /<IntegrationsChrome/);
  assert.match(chrome, /STRATJI CHROME · NOT A WORKSPACE/);
  assert.match(chrome, /<h1>Integrations<\/h1>/);
  assert.doesNotMatch(chrome, /DailyKanbanBoard/);
  assert.doesNotMatch(chrome, /DashboardTabs/);
  assert.doesNotMatch(chrome, /Investment Brief/);
});

test("Kite ticket responses reject HTML page-load intercepts", () => {
  assert.throws(
    () => readKiteTicketResponse("<!doctype html><title>Settings</title>", 200, "place order"),
    /never reached Kite as JSON/,
  );
  const ok = readKiteTicketResponse(JSON.stringify({ status: "submitted", message: "BUY 1 ICICIBANK was submitted to Kite." }), 201, "place order");
  assert.equal(ok.message, "BUY 1 ICICIBANK was submitted to Kite.");
  assert.throws(
    () => readKiteTicketResponse(JSON.stringify({ message: "Token expired" }), 401, "place order"),
    /Token expired/,
  );
});
