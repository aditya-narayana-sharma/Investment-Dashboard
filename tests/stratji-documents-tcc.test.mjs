import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

function functionBody(source, needle) {
  const start = source.indexOf(needle);
  assert.notEqual(start, -1, `missing ${needle}`);
  let depth = 0;
  let began = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
      began = true;
    } else if (char === "}") {
      depth -= 1;
      if (began && depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`could not slice ${needle}`);
}

test("workspace navigation does not re-stat Documents or restart the data plane", async () => {
  const [session, browser, dashboard, config, supervisor, entitlements, info] = await Promise.all([
    readFile(new URL("apple-app/Stratji/StratjiSessionModel.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiDashboardViewController.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiConfiguration.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/FlaskServiceSupervisor.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/Stratji.entitlements", root), "utf8"),
    readFile(new URL("apple-app/Stratji/Info.plist", root), "utf8"),
  ]);

  const select = functionBody(session, "func select(_ destination: DashboardDestination)");
  assert.match(select, /document\.load\(baseURL: baseURL, destination: target, force: false\)/);
  assert.doesNotMatch(select, /persistRepoRoot/);
  assert.doesNotMatch(select, /StratjiConfiguration\.repoRoot/);
  assert.doesNotMatch(select, /ensureRunning/);
  assert.doesNotMatch(select, /runDashStart/);
  assert.doesNotMatch(select, /start-flask-app/);
  assert.doesNotMatch(select, /fileExists/);
  assert.doesNotMatch(select, /directoryIfValid/);

  const showWorkspace = functionBody(dashboard, "func showWorkspace(");
  assert.match(showWorkspace, /session\.select\(workspace\.defaultDestination\)/);
  assert.doesNotMatch(showWorkspace, /persistRepoRoot/);
  assert.doesNotMatch(showWorkspace, /ensureRunning/);
  assert.doesNotMatch(showWorkspace, /start-flask-app/);

  const load = functionBody(browser, "func load(baseURL: URL, destination: DashboardDestination");
  assert.match(load, /canReuseHydratedDashboard/);
  assert.doesNotMatch(load, /persistRepoRoot/);
  assert.doesNotMatch(load, /StratjiConfiguration\.repoRoot/);
  assert.doesNotMatch(load, /ensureRunning/);
  assert.doesNotMatch(load, /start-flask-app/);
  assert.doesNotMatch(load, /fileExists/);

  const poll = functionBody(session, "func pollRefreshProgress(");
  assert.doesNotMatch(poll, /StratjiConfiguration\.repoRoot/);
  assert.doesNotMatch(poll, /artifacts\/private/);
  assert.match(poll, /latestRefreshProgress\(\)/);

  assert.match(config, /cachedRepoRoot/);
  assert.match(config, /repoRootBookmarkDefaultsKey/);
  assert.match(config, /startAccessingSecurityScopedResource/);
  assert.match(config, /declaredRepoRootPath/);
  assert.doesNotMatch(config, /directoryIfValid/);
  assert.doesNotMatch(config, /fileExists\(atPath: url\.path/);

  const repoRoot = config.slice(config.indexOf("static var repoRoot"), config.indexOf("static var startFlaskScript"));
  assert.match(repoRoot, /if let cachedRepoRoot/);
  assert.doesNotMatch(repoRoot, /fileExists/);

  const ensureRunning = functionBody(supervisor, "func ensureRunning(");
  assert.match(ensureRunning, /startCommand\.path/);
  assert.match(ensureRunning, /if !FileManager\.default\.fileExists\(atPath: StratjiConfiguration\.startCommand\.path\)/);

  const latest = functionBody(supervisor, "func latestRefreshProgress(");
  assert.match(latest, /StratjiConfiguration\.logDirectory/);
  assert.doesNotMatch(latest, /artifacts\/private/);
  assert.doesNotMatch(latest, /appendingPathComponent\("artifacts/);

  const refresh = functionBody(supervisor, "func runRefreshScript(");
  assert.match(refresh, /applicationSupportDirectory/);
  assert.match(refresh, /cd \\"\$1\\" && exec \\"\$2\\"/);
  assert.doesNotMatch(refresh, /process\.currentDirectoryURL = repoRoot/);

  const dashStart = functionBody(supervisor, "func runDashStartInBackground(");
  assert.match(dashStart, /StratjiConfiguration\.startCommand/);
  assert.match(dashStart, /applicationSupportDirectory/);
  assert.match(dashStart, /exec \\"\$1\\"/);

  // App Sandbox is OFF, so the sandbox-only file entitlements are omitted (they are
  // inert without the sandbox); the checkout is persisted via a plain, non-security-scoped
  // bookmark plus Full Disk Access instead.
  assert.match(entitlements, /com\.apple\.security\.app-sandbox<\/key>\s*<false\/>/);
  assert.doesNotMatch(entitlements, /com\.apple\.security\.files\.user-selected\.read-write/);
  assert.doesNotMatch(entitlements, /com\.apple\.security\.files\.bookmarks\.app-scope/);
  assert.doesNotMatch(config, /withSecurityScope/);
  assert.match(info, /NSDocumentsFolderUsageDescription/);
  assert.match(info, /Stratji starts the local dashboard from your Git checkout/);
});
