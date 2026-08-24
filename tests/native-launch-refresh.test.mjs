import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("Mac Stratji maps splash progress through named refresh stages instead of a single Kite percentage", async () => {
  const [session, supervisor, client, browser, appDelegate, page, workspace, views, script, digest, flask] = await Promise.all([
    readFile(new URL("apple-app/Stratji/StratjiSessionModel.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/FlaskServiceSupervisor.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiAPIClient.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/AppDelegate.swift", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiWorkspace.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiNativeViews.swift", root), "utf8"),
    readFile(new URL("scripts/refresh-dashboard-data.sh", root), "utf8"),
    readFile(new URL("scripts/content-digest-server.mjs", root), "utf8"),
    readFile(new URL("flask_gateway.py", root), "utf8"),
  ]);

  assert.match(session, /includeStartupScript: true/);
  assert.match(session, /runCompleteRefresh/);
  assert.match(session, /runIncrementalRefresh/);
  assert.match(session, /refreshDashboard\(baseURL: baseURL, force:/);
  assert.match(session, /startupRefreshCompleted/);
  assert.match(session, /guard startupRefreshCompleted else \{ return \}/);
  assert.match(session, /func refreshOnForeground/);
  assert.match(session, /func refreshIncremental/);
  assert.match(session, /Task.sleep\(for: \.seconds\(DashboardRefreshSchedule.interval\)\)/);
  assert.doesNotMatch(session, /NSApp.isActive/);
  assert.match(session, /applyProgress/);
  assert.match(session, /pollRefreshProgress/);
  assert.match(session, /waitForDocumentReady/);
  assert.match(session, /waitUntilFlaskReady/);
  assert.match(session, /attempts: Int = 180/);
  assert.match(session, /health.serviceReady/);
  assert.match(session, /recoverIfServiceAlreadyLive/);
  assert.match(session, /The local Stratji service did not become ready/);
  assert.match(session, /StratjiLoadStage\.hydrate\.startProgress/);
  assert.match(session, /document\.isLoading/);
  assert.match(session, /isHydrateReady/);
  assert.match(session, /captionBelongs/);
  assert.doesNotMatch(session, /snapshot\.stage = \.health/);
  assert.doesNotMatch(session, /2\.0 \/ 7\.0/);
  assert.match(supervisor, /refresh-dashboard-data\.sh/);
  assert.match(supervisor, /PORTFOLIO_REFRESH_MODE/);
  assert.match(supervisor, /completeRefreshTimeout/);
  assert.match(supervisor, /35 \* 60/);
  assert.match(supervisor, /runIncrementalRefresh/);
  assert.match(supervisor, /Health ZIP ingest enabled/);
  assert.doesNotMatch(supervisor, /PORTFOLIO_SKIP_HEALTH_ZIP"\] = "1"/);
  assert.doesNotMatch(supervisor, /Health ZIP skipped/);
  assert.match(supervisor, /removeValue\(forKey: "PORTFOLIO_SKIP_HEALTH_ZIP"\)/);
  assert.match(supervisor, /hasPrefix\("PORTFOLIO_SKIP_"\)/);
  assert.match(supervisor, /onProgress/);
  assert.match(supervisor, /latestRefreshProgress/);
  assert.match(supervisor, /return process.terminationStatus == 0/);
  assert.match(supervisor, /if timedOut \{ return false \}/);
  assert.match(script, /SECTORS=\(it pharma power infrastructure auto telecom banking nbfc fmcg consumer energy metals defence\)/);
  assert.match(client, /URLQueryItem\(name: "force", value: "1"\)/);
  assert.match(client, /forcedRequestTimeout/);
  assert.match(client, /_startup\/progress/);
  assert.match(browser, /portfolio-native-refresh/);
  assert.match(browser, /applicationNameForUserAgent = "Stratji\/1"/);
  assert.match(browser, /StratjiAppearanceStore\.webBootstrapScript/);
  assert.match(browser, /func applyPreferences/);
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    /dataset\.appearance/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    /var canvasFill: Color/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    /Absolute RGB only/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    /static let defaultsKey = "stratji\.appearance"/,
  );
  assert.match(appDelegate, /refreshOnForeground/);
  assert.match(appDelegate, /startupRefreshCompleted/);
  assert.match(page, /params.set\("force", "1"\)/);
  assert.match(page, /refreshAll\(true\)/);
  assert.match(page, /startupRefreshCompletedRef/);
  assert.match(page, /silent: true/);
  assert.doesNotMatch(page, /5 \* 60 \* 1000/);
  assert.doesNotMatch(page, /visibilitychange/);
  assert.match(browser, /canReuseHydratedDashboard/);
  assert.match(workspace, /case calendar/);
  assert.match(workspace, /case reminders/);
  assert.match(workspace, /case podcasts/);
  assert.match(workspace, /case axis/);
  assert.match(workspace, /case hydrate/);
  const stageStart = workspace.indexOf("enum StratjiLoadStage");
  const stageDecl = workspace.slice(stageStart, workspace.indexOf("var id: String", stageStart));
  assert.ok(stageDecl.indexOf("case kite") < stageDecl.indexOf("case calendar"));
  assert.ok(stageDecl.indexOf("case calendar") < stageDecl.indexOf("case mail"));
  assert.ok(stageDecl.indexOf("case mail") < stageDecl.indexOf("case axis"));
  assert.ok(stageDecl.indexOf("case axis") < stageDecl.indexOf("case reminders"));
  assert.ok(stageDecl.indexOf("case reminders") < stageDecl.indexOf("case podcasts"));
  assert.match(workspace, /"mic.fill"/);
  assert.match(workspace, /"envelope.fill"/);
  assert.match(workspace, /"heart.fill"/);
  assert.match(workspace, /"checklist"/);
  assert.match(workspace, /"calendar"/);
  assert.match(session, /Last Health Session on/);
  assert.match(session, /Last Health Session unavailable/);
  assert.match(session, /health\.dataDate \?\? health\.completedHealthThrough/);
  assert.match(session, /formatHealthSessionDate/);
  assert.match(session, /d MMM yyyy/);
  assert.match(views, /Image\("KiteLogo"\)/);
  assert.match(views, /splashLoadingTint/);
  assert.match(views, /0\.10, green: 0\.48, blue: 1\.00/);
  assert.match(views, /0\.86, green: 0\.08, blue: 0\.24/);
  assert.match(views, /static let glyphRowsSpacing: CGFloat = 8/);
  assert.match(views, /static let glyphColumnsSpacing: CGFloat = 8/);
  assert.match(views, /static let glyphSize: CGFloat = 22/);
  assert.match(views, /static let glyphLabelSpacing: CGFloat = 4/);
  assert.match(views, /static let cellPadding: CGFloat = 4/);
  assert.match(views, /static let idleGlyphOpacity: CGFloat = 1/);
  assert.match(views, /appearance\.canvasFill/);
  assert.match(views, /appearance\.canvasInk/);
  assert.match(views, /foregroundColor\(appearance\.canvasInk\)/);
  assert.match(views, /foregroundColor\(appearance\.canvasMuted\)/);
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    /0\.97, green: 0\.98, blue: 1\.0/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    /NSHostingView stays light/,
  );
  assert.doesNotMatch(
    await readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    /case \.black, \.dark: Color\.white/,
  );
  assert.match(
    await readFile(new URL("apple-app/Stratji/StratjiDashboardViewController.swift", root), "utf8"),
    /loadingHosting\?\.layer\?\.isOpaque = true/,
  );
  assert.match(
    await readFile(new URL("apple-app/Stratji/StratjiDashboardViewController.swift", root), "utf8"),
    /recoverIfServiceAlreadyLive/,
  );
  assert.match(views, /preferredColorScheme\(appearance\.colorScheme\)/);
  assert.doesNotMatch(views, /saturation\(isCurrent \? 1 : 0\)/);
  assert.doesNotMatch(views, /Color\.primary : Color\.secondary/);
  assert.doesNotMatch(views, /Color\.primary/);
  assert.doesNotMatch(views, /Color\.secondary/);
  assert.doesNotMatch(views, /Color\.white/);
  assert.doesNotMatch(views, /\.background\(Color\.black\)/);
  assert.match(views, /VStack\(alignment: \.center, spacing: SplashMetrics.glyphRowsSpacing\)/);
  assert.match(views, /splashStageRow\(Array\(stages.prefix\(6\)\)\)/);
  assert.match(views, /splashStageRow\(Array\(stages.suffix\(from: 6\)\)\)/);
  assert.match(views, /HStack\(alignment: \.top, spacing: SplashMetrics.glyphColumnsSpacing\)/);
  assert.match(views, /splashSFSymbol\("mic.fill"/);
  assert.match(views, /splashSFSymbol\("heart.fill"/);
  assert.match(views, /recoverIfServiceAlreadyLive/);
  assert.doesNotMatch(views, /exclamationmark\.circle\.fill/);
  assert.doesNotMatch(views, /LazyVGrid\(/);
  assert.doesNotMatch(views, /Color\.clear\.frame\(maxWidth: \.infinity\)/);
  assert.doesNotMatch(views, /isFailed \? "exclamationmark\.triangle\.fill"/);
  assert.match(views, /SplashProgressInterpolator.animationDuration/);
  assert.match(views, /Log in to Kite/);
  assert.match(views, /Continue without live Kite \(cached\)/);
  assert.match(views, /splashKiteAuthPrompt/);
  assert.match(session, /promptKiteLoginIfNeeded/);
  assert.match(session, /beginKiteLogin/);
  assert.match(session, /skipKiteLogin/);
  assert.match(session, /kiteAuthPhase/);
  assert.match(session, /openKiteLoginFromSplash/);
  assert.match(client, /api\/kite\/login/);
  assert.match(client, /extraAcceptedStatusCodes: \[503\]/);
  assert.match(browser, /shouldOpenInSystemBrowser/);
  assert.match(browser, /openFromDashboard/);
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiKiteAuth.swift", root), "utf8"),
    /NSWorkspace\.shared\.open/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiKiteAuth.swift", root), "utf8"),
    /jsonLoginURL/,
  );
  assert.match(session, /tickSplashProgress/);
  assert.match(session, /startProgressInterpolator/);
  assert.match(session, /SplashProgressInterpolator.displayedProgress/);
  assert.match(session, /SplashProgressInterpolator.nextStage/);
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiRefreshProgress.swift", root), "utf8"),
    /static let animationDuration: TimeInterval = 0\.4/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiRefreshProgress.swift", root), "utf8"),
    /trickleCap \* \(1 - exp/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiRefreshProgress.swift", root), "utf8"),
    /static let trickleCap: Double = 0\.88/,
  );
  assert.match(
    await readFile(new URL("apple-app/Shared/StratjiRefreshProgress.swift", root), "utf8"),
    /static let hydrateTimeout: TimeInterval = 3/,
  );
  assert.match(session, /frozenHydrateCaption/);
  assert.match(session, /freezeHydrateCaptionIfNeeded/);
  assert.match(session, /SplashProgressInterpolator.hydrateTimeout/);
  assert.doesNotMatch(session, /stage == snapshot.stage \|\| stage == \.hydrate/);
  assert.match(
    await readFile(new URL("apple-app/Stratji/Assets.xcassets/KiteLogo.imageset/Contents.json", root), "utf8"),
    /KiteLogo\.png/,
  );
  assert.match(script, /emit_progress kite/);
  assert.match(script, /emit_progress mail ensure/);
  assert.match(script, /emit_progress sectors/);
  assert.match(script, /emit_progress earnings/);
  assert.match(script, /emit_progress health/);
  assert.match(script, /PROGRESS\\t/);
  assert.match(digest, /writeStartupProgress/);
  assert.match(digest, /MAIL_STAGE_TIMEOUT_MS = 40_000/);
  assert.match(digest, /FORCE_REFRESH_BUDGET_MS = 90_000/);
  assert.match(digest, /NEWSLETTER_LIST_TIMEOUT_MS = 20_000/);
  assert.match(digest, /mailJxaTimedOut/);
  assert.match(digest, /killOsascriptTree/);
  assert.match(digest, /process\.kill\(-child\.pid/);
  assert.match(digest, /Newsletters osascript timed out/);
  assert.match(digest, /refreshSource\("calendar"/);
  assert.match(digest, /refreshSource\("mail"/);
  assert.match(digest, /refreshSource\("axis"/);
  assert.match(digest, /refreshSource\("reminders"/);
  assert.match(digest, /refreshSource\("podcasts"/);
  assert.match(digest, /pathname === "\/progress"/);
  assert.match(flask, /_startup\/progress/);
});

test("Mac Stratji adopts a live serviceReady stack; leftover teardown is Retry/quit, not every launch", async () => {
  const [supervisor, appDelegate, session, config, install, start, stop] = await Promise.all([
    readFile(new URL("apple-app/Stratji/FlaskServiceSupervisor.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/AppDelegate.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiSessionModel.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiConfiguration.swift", root), "utf8"),
    readFile(new URL("scripts/install-macos-service.sh", root), "utf8"),
    readFile(new URL("scripts/start-flask-app.sh", root), "utf8"),
    readFile(new URL("scripts/stop-flask-app.sh", root), "utf8"),
  ]);

  assert.match(appDelegate, /kickoffAtLaunch/);
  assert.ok(appDelegate.indexOf("kickoffAtLaunch") < appDelegate.indexOf("finishLaunchingOnMain"));
  assert.match(appDelegate, /applicationShouldTerminate/);
  assert.match(appDelegate, /FlaskServiceSupervisor.stopDataPlane\(\)/);
  assert.match(appDelegate, /terminateLater/);
  assert.match(supervisor, /func kickoffAtLaunch/);
  assert.match(supervisor, /func stopDataPlane/);
  assert.match(supervisor, /isReachable\(\)/);
  assert.match(supervisor, /gateway already serviceReady; skip stop/);
  assert.ok(supervisor.indexOf("if await isReachable()") < supervisor.indexOf("stopDataPlane()", supervisor.indexOf("func kickoffAtLaunch")));
  assert.match(supervisor, /ensureRunning\(recycle:/);
  assert.match(supervisor, /Retry: recycling dashboard processes for a fresh start/);
  assert.match(supervisor, /waitUntilDashboardPortsFree/);
  assert.match(supervisor, /ports :3000 and :5050 are free/);
  assert.match(supervisor, /isDashStartRunning/);
  assert.match(supervisor, /waiting for leftover :3000\/:5050 listeners to exit/);
  assert.match(supervisor, /not starting a second stack/);
  assert.match(supervisor, /dash-start still running; waiting for serviceReady/);
  assert.match(supervisor, /return health\.serviceReady/);
  assert.doesNotMatch(supervisor, /\(200 \.\.< 300\)\.contains\(http\.statusCode\)/);
  assert.match(supervisor, /Gateway reachable; skip a second dash-start/);
  assert.match(supervisor, /adoptLiveGatewayWithoutRecycle/);
  assert.match(supervisor, /healthTimeout: TimeInterval = 8/);
  assert.match(supervisor, /runDashStartInBackground/);
  assert.match(supervisor, /stop-flask-app\.sh/);
  assert.match(supervisor, /ensureRunning\(recycle:/);
  assert.match(session, /bootstrap\(forceRestartService: true\)/);
  assert.match(session, /startDataPlane\(forceRestartService\)/);
  assert.match(session, /isDashStartRunning/);
  assert.match(session, /attempts: Int = 180/);
  assert.match(session, /extraWhileStarting/);
  assert.doesNotMatch(session, /The local Stratji service is still starting\./);
  assert.match(config, /stopScriptRelativePath = "scripts\/stop-flask-app.sh"/);
  assert.match(stop, /launchctl bootout/);
  assert.match(stop, /kill_listeners_on_port 5050/);
  assert.match(stop, /kill_listeners_on_port 3000/);
  assert.match(stop, /kill_listeners_on_port 3002/);
  assert.match(stop, /kill_listeners_on_port 3003/);
  assert.match(stop, /wait_until_port_free 5050/);
  assert.match(stop, /wait_until_port_free 3000/);
  assert.match(stop, /run-dashboard-service\.sh/);
  assert.match(stop, /content-digest-server\.mjs/);
  assert.match(supervisor, /exec \\"\$1\\"/);
  assert.match(supervisor, /started dash-start in background/);
  assert.match(supervisor, /dashStartStarted = false/);
  assert.match(supervisor, /dash-start flag reset/);
  assert.match(supervisor, /keep waiting before launchd fallback/);
  assert.match(supervisor, /private static let pollLimit = 180/);
  assert.match(start, /flask_bound/);
  assert.match(start, /wait_until_ports_free/);
  assert.match(start, /wait_until_healthy 180/);
  assert.match(start, /Leftover Flask on :5050 is not ready/);
  assert.match(start, /not starting a second copy on :5050/);
  assert.match(start, /start_vinext_only/);
  assert.match(start, /starting Vinext only/);
  assert.match(config, /flask_bound/);
  assert.match(config, /"gateway": "flask"/);
  assert.match(install, /flask_bound/);
  assert.match(install, /"gateway": "flask"/);
  assert.doesNotMatch(supervisor, /osascript/);
  assert.doesNotMatch(supervisor, /tell application \\"Terminal\\"/);
  assert.doesNotMatch(supervisor, /do script/);
  assert.doesNotMatch(supervisor, /\/usr\/bin\/open/);
  assert.doesNotMatch(supervisor, /open -g -j/);
  assert.doesNotMatch(config, /open -g -j/);
  assert.doesNotMatch(install, /open -g -j/);
  assert.doesNotMatch(start, /open -a Terminal/);
  assert.match(supervisor, /startHeadlessService/);
  assert.match(supervisor, /falling back to headless start/);
  assert.match(config, /\/bin\/bash "\$START_SCRIPT"/);
  assert.match(install, /\/bin\/bash "\\\$START_SCRIPT"/);
  assert.match(start, /run-dashboard-service\.sh/);
});

test("native splash runs a complete Health ZIP ingest; later ticks are incremental", async () => {
  const [session, coordinator, page, contentView, browser, supervisor, script, health] = await Promise.all([
    readFile(new URL("apple-app/Stratji/StratjiSessionModel.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/NativeRefreshCoordinator.swift", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/ContentView.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/FlaskServiceSupervisor.swift", root), "utf8"),
    readFile(new URL("scripts/refresh-dashboard-data.sh", root), "utf8"),
    readFile(new URL("scripts/refresh-apple-health.sh", root), "utf8"),
  ]);

  assert.match(session, /startupRefreshCompleted = true/);
  assert.match(session, /await waitForDocumentReady\(\)/);
  assert.match(session, /waitUntilFlaskReady/);
  assert.match(session, /startPeriodicRefresh\(\)/);
  assert.match(session, /runIncrementalRefresh/);
  assert.match(session, /incremental: true/);
  assert.match(session, /guard startupRefreshCompleted else \{ return \}/);
  assert.match(coordinator, /startupRefreshCompleted = true/);
  assert.match(coordinator, /if monitorTask != nil \|\| startupRefreshCompleted/);
  assert.doesNotMatch(coordinator, /onRefreshCompleted\?\(\)/);
  assert.doesNotMatch(coordinator, /Task.sleep\(for: \.seconds\(DashboardRefreshSchedule.interval\)\)/);
  assert.doesNotMatch(contentView, /onRefreshCompleted/);
  assert.match(page, /refreshAll\(false, \{ silent: true \}\)/);
  assert.match(page, /autoRefreshStartedRef/);
  assert.doesNotMatch(page, /setInterval\(\(\) => void refreshAll/);
  assert.doesNotMatch(page, /addEventListener\("focus"/);
  assert.doesNotMatch(page, /addEventListener\("online"/);
  assert.match(page, /Sources keep the last validated snapshot until Refresh all/);
  assert.match(browser, /canReuseHydratedDashboard/);
  assert.match(session, /document.load\(baseURL: baseURL, destination: target, force: false\)/);
  assert.match(session, /promptKiteLoginIfNeeded/);
  assert.match(supervisor, /mode: "complete"/);
  assert.doesNotMatch(supervisor, /PORTFOLIO_SKIP_HEALTH_ZIP"\] = "1"/);
  assert.match(supervisor, /hasPrefix\("PORTFOLIO_SKIP_"\)/);
  assert.match(script, /PORTFOLIO_REFRESH_MODE:-complete/);
  assert.doesNotMatch(script, /PORTFOLIO_SKIP_HEALTH_ZIP/);
  assert.doesNotMatch(script, /Health ZIP\\tskipped/);
  assert.match(script, /refresh-apple-health\.sh/);
  assert.match(script, /--if-changed/);
  assert.match(script, /run_check_bg/);
  assert.match(script, /wait \|\| true/);
  assert.match(health, /--if-changed/);
  assert.match(health, /waiting to acquire the lock/);
  assert.doesNotMatch(health, /waiting for the validated snapshot/);
  assert.match(health, /import_health_shortcut\.py/);
  assert.match(health, /prepare_apple_health_export\.py/);
  assert.match(health, /import_apple_health\.py/);
  assert.match(health, /if import_health_shortcut_if_present; then/);
  assert.match(health, /run_apple_health_import/);
});

test("complete load fans out mail kite sectors composite podcasts health calendar; incremental skips unchanged Health ZIP", async () => {
  const [script, service, supervisor, health, digest, sectorData, page] = await Promise.all([
    readFile(new URL("scripts/refresh-dashboard-data.sh", root), "utf8"),
    readFile(new URL("scripts/run-dashboard-service.sh", root), "utf8"),
    readFile(new URL("apple-app/Stratji/FlaskServiceSupervisor.swift", root), "utf8"),
    readFile(new URL("scripts/refresh-apple-health.sh", root), "utf8"),
    readFile(new URL("scripts/content-digest-server.mjs", root), "utf8"),
    readFile(new URL("app/sector-data.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);

  assert.match(script, /REFRESH_MODE="complete"/);
  assert.match(script, /grep '\^PORTFOLIO_SKIP_'/);
  assert.match(script, /run_check_bg kite/);
  assert.match(script, /run_check_bg content/);
  assert.match(script, /\/api\/kite\/snapshot/);
  assert.match(script, /\/api\/content\/refresh\?\$\{CONTENT_QUERY\}/);
  assert.match(script, /CONTENT_QUERY="force=1&startup=/);
  assert.match(script, /REFRESH_MODE" == "incremental"[\s\S]*CONTENT_QUERY="refresh=/);
  assert.match(script, /\/api\/sectors\/snapshot\?sector=\$\{sector\}/);
  assert.match(script, /SECTORS=\(it pharma power infrastructure auto telecom banking nbfc fmcg consumer energy metals defence\)/);
  assert.match(script, /composite-scoring inputs/);
  assert.match(script, /\/api\/sectors\/news/);
  assert.match(script, /\/api\/sectors\/benchmarks/);
  assert.match(script, /\/api\/earnings\/snapshot/);
  assert.match(script, /\/_health\/snapshot/);
  assert.match(script, /emit_progress calendar start/);
  assert.match(script, /emit_progress mail start/);
  assert.match(script, /emit_progress axis start/);
  assert.match(script, /emit_progress reminders start/);
  assert.match(script, /emit_progress podcasts start/);
  assert.match(script, /Health ZIP\\tcomplete\\tvalidate newest iCloud ZIP/);
  assert.match(script, /Health ZIP\\tincremental\\tre-extract only if the export mtime changed/);
  assert.match(script, /REFRESH_MODE" == "incremental"[\s\S]*"\$HEALTH_SCRIPT" --if-changed/);
  assert.doesNotMatch(script, /PORTFOLIO_SKIP_HEALTH_ZIP/);
  assert.match(script, /wait \|\| true/);
  assert.match(sectorData, /export function sectorComposite/);
  assert.match(digest, /refreshSource\("calendar"/);
  assert.match(digest, /refreshSource\("mail"/);
  assert.match(digest, /refreshSource\("axis"/);
  assert.match(digest, /refreshSource\("reminders"/);
  assert.match(digest, /refreshSource\("podcasts"/);
  assert.match(digest, /summarizePodcastTranscript/);
  assert.match(digest, /readLocalPodcastTranscript/);
  assert.match(digest, /ingestSatyaDigestRefresh/);
  assert.match(digest, /ingestSatyaAxisPdfArchive/);
  assert.match(health, /health_export_unchanged/);
  assert.match(health, /Apple Health export unchanged; skipped re-extract/);
  assert.match(health, /waiting to acquire the lock/);
  assert.match(service, /PORTFOLIO_REFRESH_MODE=complete/);
  assert.match(service, /grep '\^PORTFOLIO_SKIP_'/);
  assert.match(service, /--threads=24/);
  assert.match(service, /refresh-apple-health\.sh/);
  assert.match(supervisor, /mode: "complete"/);
  assert.match(supervisor, /mode: "incremental"/);
  assert.match(supervisor, /hasPrefix\("PORTFOLIO_SKIP_"\)/);
  assert.match(supervisor, /runIncrementalRefresh/);
  assert.match(page, /refreshAll\(true\)/);
  assert.match(page, /refreshAll\(false, \{ silent: true \}\)/);
  assert.match(page, /Promise\.allSettled\(\s*Object\.keys\(sectorCompanies\)/);
});

test("iOS splash refresh does not schedule a second complete refresh on become-active", async () => {
  const [coordinator, status, contentView] = await Promise.all([
    readFile(new URL("apple-app/InvestmentDashboard/NativeRefreshCoordinator.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/DashboardStatus.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/ContentView.swift", root), "utf8"),
  ]);

  assert.match(coordinator, /await self.refreshAll\(baseURL: baseURL, showLoading: showLoading\)/);
  assert.match(coordinator, /startupRefreshCompleted/);
  assert.match(coordinator, /DashboardRefreshSchedule.isStale/);
  assert.doesNotMatch(coordinator, /DashboardRefreshSchedule.interval/);
  assert.match(coordinator, /dashboardRefresh\(baseURL: baseURL, force: true\)/);
  assert.match(coordinator, /contentRefresh/);
  assert.match(coordinator, /refreshTrackedSectors/);
  assert.match(coordinator, /failOffline/);
  assert.match(coordinator, /pollStartupProgress/);
  assert.match(coordinator, /RefreshStage\.hydrate\.startProgress/);
  assert.match(status, /URLQueryItem\(name: "force", value: "1"\)/);
  assert.match(status, /api\/content\/refresh/);
  assert.match(status, /_startup\/progress/);
  assert.match(contentView, /scenePhase == .active|phase == .active/);
  assert.match(contentView, /startSession\(\)/);
  assert.match(contentView, /session.stopMonitoring\(\)/);
});

test("Settings Black shares stratji.appearance into the WKWebView at document start", async () => {
  const [store, browser, settings, page, iosBrowser] = await Promise.all([
    readFile(new URL("apple-app/Shared/StratjiAppearanceStore.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiSettingsWindow.swift", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/DashboardBrowser.swift", root), "utf8"),
  ]);

  assert.match(store, /static let defaultsKey = "stratji\.appearance"/);
  assert.match(store, /static let webStorageKey = "dashboard-appearance"/);
  assert.match(store, /dataset\.appearance/);
  assert.match(store, /localStorage.setItem\(/);
  assert.match(store, /dashboard-appearance/);
  assert.match(browser, /StratjiAppearanceStore\.webBootstrapScript/);
  assert.match(browser, /injectionTime: \.atDocumentStart/);
  assert.match(browser, /func applyPreferences/);
  assert.match(browser, /applyPreferences\(\)/);
  assert.match(settings, /@AppStorage\(StratjiAppearanceStore\.defaultsKey\)/);
  assert.match(settings, /onChange\(of: appearanceRaw\)/);
  assert.match(settings, /session\.document\.applyPreferences/);
  assert.match(iosBrowser, /StratjiAppearanceStore\.webBootstrapScript/);
  assert.match(page, /stratji-preferences-changed/);
  assert.match(page, /fromDom = document\.documentElement\.dataset\.appearance/);
});
