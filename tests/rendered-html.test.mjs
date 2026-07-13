import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the portfolio dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Portfolio Investment Brief<\/title>/i);
  assert.match(html, /Investment Brief/);
  assert.match(html, /₹14,439\.00/);
  assert.match(html, /Top-two concentration/);
  assert.match(html, /Macro scenario lab/);
  assert.match(html, /Analyst call matrix/);
  assert.match(html, /ICICI Bank Q1 FY27/);
});

test("server-renders the print report and keeps controls interactive", async () => {
  const [response, page] = await Promise.all([
    render("/report"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Portfolio Analysis/);
  assert.match(html, /Macro shock map/);
  assert.match(html, /Source register/);
  assert.match(html, /Transcript limitation/);

  assert.match(page, /setScenarioKey/);
  assert.match(page, /setView/);
  assert.match(page, /Orders &amp; GTTs/);
  assert.match(page, /isAnimationActive=\{false\}/);
});
