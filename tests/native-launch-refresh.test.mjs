import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("Mac Stratji maps splash progress through named refresh stages instead of a single Kite percentage", async () => {
  const [session, supervisor, client, browser, appDelegate, page, workspace, views, script, digest, flask] = await Promise.all([
    readFile(new URL("apple-app/Shared/StratjiSessionModel.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/FlaskServiceSupervisor.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiAPIClient.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/AppDelegate.swift", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiWorkspace.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiNativeViews.swift", root), "utf8"),
    readFile(new URL("scripts/refresh-dashboard-data.sh", root), "utf8"),
    readFile(new URL("scripts/content-digest-server.mjs", root), "utf8"),
    readFile(new URL("flask_gateway.py", root), "utf8"),
  ]);

  assert.match(session, /includeStartupScript: true/);
  assert.match(session, /runCompleteRefresh/);
  assert.match(session, /refreshDashboard\(baseURL: baseURL, force:/);
  assert.match(session, /startupRefreshCompleted/);
  assert.match(session, /guard !startupRefreshCompleted else \{ return \}/);
  assert.match(session, /func refreshOnForeground/);
  assert.doesNotMatch(session, /NSApp.isActive/);
  assert.doesNotMatch(session, /Task.sleep\(for: \.seconds\(DashboardRefreshSchedule.interval\)\)/);
  assert.match(session, /applyProgress/);
  assert.match(session, /pollRefreshProgress/);
  assert.match(session, /waitForDocumentReady/);
  assert.match(session, /StratjiLoadStage\.hydrate\.startProgress/);
  assert.match(session, /document\.isLoading/);
  assert.match(session, /isHydrateReady/);
  assert.match(session, /captionBelongs/);
  assert.doesNotMatch(session, /snapshot\.stage = \.health/);
  assert.doesNotMatch(session, /2\.0 \/ 7\.0/);
  assert.match(supervisor, /refresh-dashboard-data\.sh/);
  assert.match(supervisor, /PORTFOLIO_SKIP_HEALTH_ZIP/);
  assert.match(supervisor, /onProgress/);
  assert.match(supervisor, /latestRefreshProgress/);
  assert.match(client, /URLQueryItem\(name: "force", value: "1"\)/);
  assert.match(client, /forcedRequestTimeout/);
  assert.match(client, /_startup\/progress/);
  assert.match(browser, /portfolio-native-refresh/);
  assert.match(browser, /applicationNameForUserAgent = "Stratji\/1"/);
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
  assert.match(views, /VStack\(alignment: \.center, spacing: SplashMetrics.glyphRowsSpacing\)/);
  assert.match(views, /splashStageRow\(Array\(stages.prefix\(6\)\)\)/);
  assert.match(views, /splashStageRow\(Array\(stages.suffix\(from: 6\)\)\)/);
  assert.match(views, /HStack\(alignment: \.top, spacing: SplashMetrics.glyphColumnsSpacing\)/);
  assert.match(views, /splashSFSymbol\("mic.fill"/);
  assert.match(views, /splashSFSymbol\("heart.fill"/);
  assert.doesNotMatch(views, /exclamationmark\.circle\.fill/);
  assert.doesNotMatch(views, /LazyVGrid\(/);
  assert.doesNotMatch(views, /Color\.clear\.frame\(maxWidth: \.infinity\)/);
  assert.doesNotMatch(views, /isFailed \? "exclamationmark\.triangle\.fill"/);
  assert.match(views, /SplashProgressInterpolator.animationDuration/);
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
  assert.match(digest, /MAIL_STAGE_TIMEOUT_MS/);
  assert.match(digest, /killSignal: "SIGKILL"/);
  assert.match(digest, /refreshSource\("calendar"/);
  assert.match(digest, /refreshSource\("mail"/);
  assert.match(digest, /refreshSource\("axis"/);
  assert.match(digest, /refreshSource\("reminders"/);
  assert.match(digest, /refreshSource\("podcasts"/);
  assert.match(digest, /pathname === "\/progress"/);
  assert.match(flask, /_startup\/progress/);
});

test("native splash is the only automatic complete refresh after hydrate", async () => {
  const [session, coordinator, page, contentView, browser] = await Promise.all([
    readFile(new URL("apple-app/Shared/StratjiSessionModel.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/NativeRefreshCoordinator.swift", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/ContentView.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
  ]);

  assert.match(session, /startupRefreshCompleted = true/);
  assert.match(session, /await waitForDocumentReady\(\)/);
  assert.doesNotMatch(session, /startPeriodicRefresh\(\)\n        \}/);
  assert.match(session, /guard !startupRefreshCompleted else \{ return \}/);
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
