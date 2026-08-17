import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyCanonicalAppUrl,
  applyCanonicalWorkspaceUrl,
  appViewFromPageSearch,
  isChromeView,
  isIntegrationsView,
  isNativeChromeEnabled,
  isStratjiNativeUserAgent,
  isWorkspaceKey,
  nativeChromeFromPageSearch,
  detectNativeChrome,
  parseAppView,
  parseWorkspaceView,
  workspaceFromPageSearch,
} from "../app/dashboard/workspace-routing.ts";
import {
  applyPipelineAction,
  defaultIntegrationsConfig,
  INTEGRATION_PIPELINE_IDS,
  APPLE_PERMISSION_SOURCE_IDS,
  INTEGRATIONS_SEED_WIZARD,
  mergeApplePermissionsUpdate,
  mergeIntegrationsUpdate,
  publicIntegrationsConfig,
  RESEARCH_HOUSES,
  sanitizeIntegrationsConfig,
  sanitizeStoredIntegrationsConfig,
  settingsIntegrationsConfig,
} from "../app/integrations-types.ts";
import {
  filledLocalLlmProviders,
  isLoopbackRequest,
  overlayLocalLlmSecrets,
} from "../app/local-llm-secrets.ts";

test("portfolio aliases resolve to investment and integrations is chrome not a workspace", () => {
  assert.equal(parseWorkspaceView("portfolio"), "investment");
  assert.equal(parseWorkspaceView("portfolio-overview"), "investment");
  assert.equal(parseWorkspaceView("integrations"), "investment");
  assert.equal(parseWorkspaceView("settings"), "investment");
  assert.equal(parseAppView("integrations"), "integrations");
  assert.equal(parseAppView("settings"), "integrations");
  assert.equal(parseAppView("portfolio"), "investment");
  assert.equal(parseAppView("portfolio-overview"), "investment");
  assert.equal(isWorkspaceKey("integrations"), false);
  assert.equal(isWorkspaceKey("investment"), true);
  assert.equal(isChromeView("integrations"), true);
  assert.equal(isIntegrationsView("settings"), true);
  assert.equal(workspaceFromPageSearch({ view: "portfolio-overview" }), "investment");
  assert.equal(appViewFromPageSearch({ view: "settings" }), "integrations");
  assert.equal(appViewFromPageSearch({ view: "integrations" }), "integrations");

  const settings = new URL("http://localhost/?view=settings&section=canvas");
  assert.deepEqual(applyCanonicalAppUrl(settings), { appView: "integrations", rewritten: true });
  assert.equal(settings.searchParams.get("view"), "integrations");
  assert.equal(settings.searchParams.get("section"), null);

  const integrations = new URL("http://localhost/?view=integrations");
  assert.deepEqual(applyCanonicalAppUrl(integrations), { appView: "integrations", rewritten: false });

  const workspaceFallback = new URL("http://localhost/?view=settings");
  assert.deepEqual(applyCanonicalWorkspaceUrl(workspaceFallback), { view: "investment", rewritten: true });
  assert.equal(workspaceFallback.searchParams.get("view"), "integrations");
});

test("nativeChrome query is detected and preserved", () => {
  assert.equal(isNativeChromeEnabled("nativeChrome=1"), true);
  assert.equal(isNativeChromeEnabled("nativeChrome=true"), true);
  assert.equal(isNativeChromeEnabled("native=1"), true);
  assert.equal(isNativeChromeEnabled("native=true"), true);
  assert.equal(isNativeChromeEnabled("nativeChrome=0"), false);
  assert.equal(isNativeChromeEnabled("nativeChrome=false"), false);
  assert.equal(isNativeChromeEnabled("view=investment"), false);
  assert.equal(nativeChromeFromPageSearch({ nativeChrome: "1" }), true);
  assert.equal(nativeChromeFromPageSearch({ nativeChrome: "true" }), true);
  assert.equal(nativeChromeFromPageSearch({ native: "1" }), true);
  assert.equal(nativeChromeFromPageSearch({ nativeChrome: "0" }), false);
  assert.equal(nativeChromeFromPageSearch(null, "?view=health&nativeChrome=true"), true);
  assert.equal(nativeChromeFromPageSearch(null, "?view=health&native=1"), true);
  const url = new URL("http://localhost/?view=investment&nativeChrome=1");
  assert.equal(isNativeChromeEnabled(url.searchParams), true);
  applyCanonicalAppUrl(url);
  assert.equal(url.searchParams.get("nativeChrome"), "1");
  assert.equal(isStratjiNativeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Stratji/1"), true);
  assert.equal(isStratjiNativeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"), false);
  assert.equal(detectNativeChrome({ userAgent: "Mozilla/5.0 Stratji/1" }), true);
  assert.equal(detectNativeChrome({ locationSearch: "?view=investment" }), false);
  assert.equal(detectNativeChrome({ searchParams: { native: "1" } }), true);
});

test("seed wizard uses generic placeholders, not a personal Mac path", () => {
  assert.equal(INTEGRATIONS_SEED_WIZARD.kiteMcpProjectDir, "");
  assert.equal(INTEGRATIONS_SEED_WIZARD.newslettersMailbox, "Newsletters");
  assert.equal(INTEGRATIONS_SEED_WIZARD.researchMailbox, "Axis Research");
  assert.deepEqual(INTEGRATIONS_SEED_WIZARD.reminderListNames, ["Job 🔍", "Earnings"]);
  assert.equal(INTEGRATIONS_SEED_WIZARD.healthZipFolder, "");
  assert.equal(INTEGRATIONS_SEED_WIZARD.tailscaleUrl, "");
  assert.equal(INTEGRATIONS_SEED_WIZARD.calendarNames, "Apple Calendar");
  assert.equal(INTEGRATIONS_SEED_WIZARD.podcastsLibrary, "Apple Podcasts");
  assert.deepEqual([...RESEARCH_HOUSES], ["Axis", "HDFC", "SBI", "ET-Prime", "Moneycontrol"]);
  assert.equal(INTEGRATION_PIPELINE_IDS.length, 12);
  assert.deepEqual([...APPLE_PERMISSION_SOURCE_IDS], ["mail", "calendars", "reminders", "podcasts", "notes"]);
});

test("public integrations config never echoes LLM secrets", () => {
  const stored = sanitizeStoredIntegrationsConfig({
    wizardComplete: true,
    llm: { anthropicApiKey: "sk-ant-secret", openaiApiKey: "sk-openai-secret" },
  });
  assert.equal(stored.llm.anthropicApiKey, "sk-ant-secret");
  const publicConfig = publicIntegrationsConfig(stored);
  assert.equal(publicConfig.llm.anthropicKeyConfigured, true);
  assert.equal(publicConfig.llm.openaiKeyConfigured, true);
  assert.equal(publicConfig.llm.geminiKeyConfigured, false);
  assert.equal(publicConfig.llm.cursorKeyConfigured, false);
  assert.equal("anthropicApiKey" in publicConfig.llm, false);
  assert.equal("openaiApiKey" in publicConfig.llm, false);
  assert.doesNotMatch(JSON.stringify(publicConfig), /sk-ant-secret|sk-openai-secret/);
  assert.doesNotMatch(JSON.stringify(sanitizeIntegrationsConfig(stored)), /sk-ant-secret/);
});

test("pipeline connect/test/disconnect are local placeholders and do not claim live orders", () => {
  const connected = applyPipelineAction(defaultIntegrationsConfig(), "broker", "connect");
  assert.equal(connected.pipelines.broker.connected, true);
  assert.equal(connected.pipelines.broker.status, "auth_required");
  const tested = applyPipelineAction(connected, "yfinance", "test");
  assert.equal(tested.pipelines.yfinance.status, "live");
  const disconnected = applyPipelineAction(connected, "broker", "disconnect");
  assert.equal(disconnected.pipelines.broker.connected, false);
  assert.equal(disconnected.pipelines.broker.status, "not_configured");
});

test("apple permission states sanitize, merge, and never carry secrets", () => {
  const seed = defaultIntegrationsConfig();
  assert.equal(seed.applePermissions.mail.status, "permission_required");
  assert.equal(seed.applePermissions.mail.tcc, "apple-events");
  assert.equal(seed.applePermissions.calendars.tcc, "eventkit-calendars");
  assert.equal(seed.applePermissions.reminders.tcc, "eventkit-reminders");
  assert.equal(seed.applePermissions.podcasts.tcc, "apple-events");
  assert.equal(seed.applePermissions.notes.tcc, "apple-events");
  assert.match(seed.applePermissions.notes.notes, /Never a Health source/);
  assert.doesNotMatch(seed.applePermissions.notes.notes, /Health Daily|H-2|H-3/);

  const connected = mergeApplePermissionsUpdate(seed, {
    action: "apple-permissions",
    source: "mail",
    status: "full_access",
    tcc: "apple-events",
  });
  assert.equal(connected.applePermissions.mail.status, "connected");
  assert.equal(connected.pipelines.newsletters.connected, true);
  assert.equal(connected.pipelines.research.connected, true);
  assert.equal(connected.pipelines.newsletters.status, "partial");

  const denied = mergeApplePermissionsUpdate(connected, {
    action: "apple-permissions",
    applePermissions: { reminders: { status: "denied" } },
  });
  assert.equal(denied.applePermissions.reminders.status, "denied");
  assert.equal(denied.pipelines.reminders.status, "auth_required");
  assert.equal(denied.applePermissions.mail.status, "connected");

  const publicConfig = publicIntegrationsConfig(denied);
  assert.equal(publicConfig.applePermissions.calendars.status, "permission_required");
  assert.doesNotMatch(JSON.stringify(publicConfig), /sk-|anthropicApiKey|openaiApiKey/);
});

test("wizard merge preserves stored secrets and never returns them publicly", () => {
  const withKey = mergeIntegrationsUpdate(
    sanitizeStoredIntegrationsConfig(defaultIntegrationsConfig()),
    { llm: { anthropicApiKey: "sk-keep-me" }, wizardComplete: true },
  );
  const afterWizard = mergeIntegrationsUpdate(withKey, {
    wizard: { newslettersMailbox: "Newsletters" },
    wizardComplete: true,
  });
  assert.equal(afterWizard.llm.anthropicApiKey, "sk-keep-me");
  const publicAfter = publicIntegrationsConfig(afterWizard);
  assert.equal(publicAfter.llm.anthropicKeyConfigured, true);
  assert.doesNotMatch(JSON.stringify(publicAfter), /sk-keep-me/);
  const cleared = mergeIntegrationsUpdate(afterWizard, { clearLlmKeys: true });
  assert.equal(cleared.llm.anthropicApiKey, undefined);
  assert.equal(cleared.llm.anthropicKeyConfigured, false);
});

test("Integrations page is chrome: six workspaces, no DailyKanbanBoard, isolation holds", async () => {
  const [page, utils, types, workspace, routing, gitignore] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntegrationsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/workspace-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);

  assert.match(utils, /key: "investment", label: "Portfolio Overview"/);
  assert.match(utils, /key: "sectors", label: "Sectoral Analytics"/);
  assert.match(utils, /key: "intelligence", label: "Market Intelligence"/);
  assert.match(utils, /key: "health", label: "Health & Wellness"/);
  assert.match(utils, /key: "builder", label: "Algorithm Canvas"/);
  assert.match(utils, /key: "strategies", label: "Strategies"/);
  assert.doesNotMatch(utils, /key: "integrations"/);
  const workspaceEntries = [...utils.matchAll(/\{ key: "(investment|sectors|intelligence|health|builder|strategies|integrations)"/g)].map((match) => match[1]);
  assert.deepEqual(workspaceEntries, ["investment", "sectors", "intelligence", "health", "builder", "strategies"]);

  assert.match(types, /type WorkspaceKey = "investment" \| "sectors" \| "intelligence" \| "health" \| "builder" \| "strategies"/);
  assert.doesNotMatch(types, /WorkspaceKey =[\s\S]*integrations/);
  assert.match(routing, /CHROME_VIEW_VALUES = \["integrations"\]/);
  assert.match(page, /IntegrationsWorkspace/);
  assert.doesNotMatch(page, /integrations-chrome-link/);
  assert.match(page, /DashboardTabs active=\{workspace\}/);
  assert.match(page, /showWorkspaceShell && !nativeChrome && <DashboardTabs/);
  assert.match(page, /showWorkspaceShell && \(workspace === "investment" \|\| stayMounted\)/);
  assert.doesNotMatch(page, /<DailyKanbanBoard workspace="integrations"/);

  assert.match(workspace, /id="integrations-chrome-heading">Settings/);
  assert.match(workspace, /id="integrations-appearance-heading">Appearance/);
  assert.match(workspace, /AppearanceToggle/);
  assert.match(workspace, /HealthIncognitoToggle/);
  assert.match(workspace, /data-chrome="integrations"/);
  assert.match(page, /isIntegrationsChrome && <IntegrationsWorkspace/);
  assert.match(workspace, /First-run \/ settings wizard/);
  assert.match(workspace, /Groww/);
  assert.match(workspace, /Google Tasks/);
  assert.match(workspace, /Obsidian/);
  assert.match(workspace, /Streak export checklist/);
  assert.match(workspace, /copy-only/);
  assert.match(workspace, /id="integrations-apple-heading">Apple apps/);
  assert.match(workspace, /data-apple-source/);
  assert.match(workspace, /data-apple-onboarding/);
  assert.match(workspace, /Permission required/);
  assert.match(workspace, /Open Privacy Settings/);
  assert.match(workspace, /stratji:\/\/permissions\/connect/);
  assert.match(workspace, /Never a Health source/);
  assert.doesNotMatch(workspace, /DailyKanbanBoard/);
  assert.doesNotMatch(workspace, /sector-dimmed|selectedSectorId|sector-intelligence-filter/);
  assert.doesNotMatch(workspace, /EarningsMonthCalendar|HealthWorkspace/);
  assert.match(workspace, /Confirmed BUY\/SELL and GTT from reviewed tickets ARE live Kite orders/);
  assert.match(workspace, /Stratji never silently auto-trades/);
  assert.match(workspace, /function SecretInput/);
  assert.match(workspace, /type=\{visible \? "text" : "password"\}/);
  assert.match(workspace, /label="Gemini API key"/);
  assert.match(workspace, /label="Cursor API key"/);
  assert.match(workspace, /\/api\/integrations\?secrets=1/);
  assert.match(gitignore, /\/artifacts\/private\//);
});

test("native Stratji Settings is a SwiftUI form, not a live dashboard WebView", async () => {
  const [settings, appDelegate, nativeViews, permissions, onboarding, info, entitlements] = await Promise.all([
    readFile(new URL("../apple-app/Stratji/StratjiSettingsWindow.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Stratji/AppDelegate.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Shared/StratjiNativeViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Stratji/StratjiApplePermissions.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Stratji/StratjiPermissionsOnboarding.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Stratji/Info.plist", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Stratji/Stratji.entitlements", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /struct StratjiSettingsView/);
  assert.match(settings, /formStyle\(\.grouped\)/);
  assert.match(settings, /Section\("License"\)/);
  assert.match(settings, /Section\("Appearance"\)/);
  assert.match(settings, /Section\("Apple apps"\)/);
  assert.match(settings, /Health Incognito/);
  assert.match(settings, /Kite MCP project dir/);
  assert.match(settings, /Newsletters/);
  assert.match(settings, /Axis Research/);
  assert.match(settings, /Paste keys locally/);
  assert.match(settings, /Claude API key/);
  assert.match(settings, /Full Disk Access/);
  assert.match(settings, /Connect/);
  assert.match(settings, /Open Privacy Settings/);
  assert.match(settings, /ensureAuthorLicense/);
  assert.match(settings, /StratjiApplePermissionActions\.connect/);
  assert.doesNotMatch(settings, /loadIntegrations/);
  assert.doesNotMatch(settings, /WKWebView/);
  assert.doesNotMatch(settings, /DailyKanbanBoard|workspace-tab-investment|STRATJI CHROME/);
  assert.match(settings, /Confirmed BUY\/SELL and GTT from reviewed tickets ARE live Kite orders/);
  assert.match(settings, /Stratji never silently auto-trades/);
  assert.match(settings, /applyLocalSecrets/);
  assert.match(settings, /StratjiLocalSecrets\.llmKeys/);
  assert.match(appDelegate, /StratjiSettingsView\(session: session\)/);
  assert.match(appDelegate, /StratjiPermissionsOnboardingPresenter\.presentIfNeeded/);
  assert.doesNotMatch(appDelegate, /StratjiSettingsView\(url:/);
  assert.doesNotMatch(nativeViews, /struct StratjiSettingsView/);
  assert.doesNotMatch(nativeViews, /loadIntegrations\(baseURL: url\)/);
  assert.match(permissions, /requestFullAccessToEvents/);
  assert.match(permissions, /requestFullAccessToReminders/);
  assert.match(permissions, /AEDeterminePermissionToAutomateTarget/);
  assert.match(permissions, /com.apple.mail/);
  assert.match(permissions, /com.apple.podcasts/);
  assert.match(permissions, /com.apple.Notes/);
  assert.match(permissions, /Never a Health source/);
  assert.doesNotMatch(permissions, /Health Daily/);
  assert.match(permissions, /usesAppleScriptProbe/);
  assert.match(permissions, /ensureRunningHidden/);
  assert.match(permissions, /configuration\.hides = true/);
  assert.match(permissions, /lookupAutomation\(bundleID: bundleID, prompt: true\)/);
  assert.doesNotMatch(permissions, /tell application "Podcasts"/);
  assert.doesNotMatch(permissions, /await ensureRunning\(bundleID/);
  const requestAppleEvents = permissions.slice(permissions.indexOf("private static func requestAppleEvents"));
  const promptIdx = requestAppleEvents.indexOf("lookupAutomation(bundleID: bundleID, prompt: true)");
  const launchIdx = requestAppleEvents.indexOf("ensureRunningHidden");
  assert.ok(promptIdx >= 0 && launchIdx > promptIdx, "Podcasts Connect must request Automation TCC before any hidden launch fallback");
  assert.match(permissions, /guard state.status == \.connected else \{ return \}/);
  assert.match(onboarding, /Grant Apple permissions/);
  assert.match(onboarding, /Not now/);
  assert.match(onboarding, /Connect/);
  assert.doesNotMatch(onboarding, /DailyKanbanBoard/);
  assert.match(info, /NSCalendarsUsageDescription/);
  assert.match(info, /NSCalendarsFullAccessUsageDescription/);
  assert.match(info, /NSRemindersUsageDescription/);
  assert.match(info, /NSRemindersFullAccessUsageDescription/);
  assert.match(info, /NSAppleEventsUsageDescription/);
  assert.match(entitlements, /com.apple.security.personal-information.calendars/);
  assert.match(entitlements, /com.apple.security.personal-information.reminders/);
  assert.match(entitlements, /com.apple.security.automation.apple-events/);
});

test("committed seed LLM keys stay empty and overlay only fills from local secrets", () => {
  const seed = defaultIntegrationsConfig();
  assert.equal(seed.llm.openaiApiKey, undefined);
  assert.equal(seed.llm.anthropicApiKey, undefined);
  assert.equal(seed.llm.geminiApiKey, undefined);
  assert.equal(seed.llm.cursorApiKey, undefined);
  assert.equal(INTEGRATIONS_SEED_WIZARD.kiteMcpProjectDir, "");
  const stored = sanitizeStoredIntegrationsConfig(seed);
  const filled = overlayLocalLlmSecrets(stored, {
    openaiApiKey: "sk-test-openai-local",
    anthropicApiKey: "sk-ant-test-local",
  });
  assert.equal(filled.llm.openaiApiKey, "sk-test-openai-local");
  assert.equal(filled.llm.anthropicApiKey, "sk-ant-test-local");
  assert.equal(filled.llm.geminiApiKey, undefined);
  assert.equal(filled.pipelines.llm.status, "partial");
  const publicConfig = publicIntegrationsConfig(filled);
  assert.equal("openaiApiKey" in publicConfig.llm, false);
  const settings = settingsIntegrationsConfig(filled);
  assert.equal(settings.llm.openaiApiKey, "sk-test-openai-local");
  assert.deepEqual(filledLocalLlmProviders({ openaiApiKey: "sk-test-openai-local" }), ["OpenAI"]);
  assert.equal(isLoopbackRequest(new Request("http://127.0.0.1:5050/api/integrations?secrets=1")), true);
  assert.equal(isLoopbackRequest(new Request("http://example.ts.net/api/integrations?secrets=1")), false);
});
