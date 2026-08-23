import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("Mac outline click loads the row URL including section=i3", async () => {
  const [outline, outlineView, browser, nativeRoute, session, layout] = await Promise.all([
    readFile(new URL("apple-app/Outline/DashboardOutline.swift", root), "utf8"),
    readFile(new URL("apple-app/Outline/DashboardOutlineView.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Outline/DashboardNativeRoute.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiSessionModel.swift", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(outline, /leaf\("investment\/i3"/);
  assert.match(outline, /section: "i3"/);
  assert.doesNotMatch(outline, /leaf\("intelligence\/m4"/);
  assert.match(outline, /leaf\("intelligence\/m3", "Earnings Calendar"/);
  assert.match(outline, /leaf\("health\/h4", "Calendar \+ Reminders", view: "health", section: "h4"/);
  assert.match(outline, /case "intelligence\/m4":\s*return "health\/h4"/);
  assert.match(outlineView, /@objc private func outlineClicked/);
  assert.match(outlineView, /func outlineViewSelectionDidChange/);
  assert.match(outlineView, /onSelect\?\(node\.destination\)/);
  assert.match(session, /func select\(_ destination: DashboardDestination\)/);
  assert.match(session, /document\.load\(baseURL: baseURL, destination: target, force: false\)/);
  assert.match(browser, /canReuseHydratedDashboard/);
  assert.match(browser, /webView\.load\(URLRequest\(url: url/);
  assert.match(browser, /NSLog\("\[Stratji\] webView\.load destination=%@ url=%@"/);
  assert.match(browser, /DashboardNativeRoute\.apply\(in: webView/);
  assert.match(browser, /applicationNameForUserAgent = "Stratji\/1"/);
  assert.match(browser, /dataset.nativeChrome = '1'/);
  assert.match(browser, /dataset.nativeOwnsSections = '1'/);
  assert.match(layout, /dataset\.nativeOwnsSections="1"/);
  assert.match(layout, /dataset\.nativeWebNav="1"/);
  assert.match(layout, /var macOverlay=stratji&&\/Macintosh\/i\.test\(ua\)/);
  assert.match(nativeRoute, /history\.replaceState/);
  assert.match(nativeRoute, /PopStateEvent/);
  assert.match(nativeRoute, /stratji:navigate/);
  assert.match(nativeRoute, /dashboard-expand-section/);
});

test("group titles match overview URLs and Stratji has no sidebar", async () => {
  const [outline, dashboard, window, menu, iosShell, glassBar] = await Promise.all([
    readFile(new URL("apple-app/Outline/DashboardOutline.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiDashboardViewController.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiWindowController.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiMenuBuilder.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/NativeWorkspaceViews.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiWorkspaceGlassBar.swift", root), "utf8"),
  ]);
  assert.match(outline, /title: "Industry Analytics"/);
  assert.match(outline, /page: "pulse"/);
  assert.doesNotMatch(outline, /leaf\("sectors\/s2\/pulse", "Sector pulse"/);
  assert.match(outline, /title: "Vital Metrics"/);
  assert.match(outline, /page: "metrics-overview"/);
  assert.doesNotMatch(outline, /leaf\("health\/h3\/metrics-overview", "Overview"/);
  assert.match(outline, /highPriorityGesture/);
  assert.doesNotMatch(dashboard, /Button\("Hide Sidebar"/);
  assert.doesNotMatch(dashboard, /DashboardOutlineList/);
  assert.doesNotMatch(dashboard, /NSSplitViewController/);
  assert.doesNotMatch(dashboard, /NSSplitViewItem\(sidebarWithViewController/);
  assert.doesNotMatch(dashboard, /StratjiSidebarView/);
  assert.doesNotMatch(dashboard, /func toggleSidebar/);
  assert.doesNotMatch(dashboard, /func setSidebarCollapsed/);
  assert.match(dashboard, /StratjiWorkspaceGlassBar/);
  assert.match(dashboard, /loadingHosting\?\.appearance/);
  assert.match(glassBar, /prefersDarkChrome/);
  assert.doesNotMatch(glassBar, /Color\.primary\.opacity/);
  assert.match(dashboard, /webHostView\.topAnchor\.constraint\(equalTo: view\.safeAreaLayoutGuide\.topAnchor\)/);
  assert.doesNotMatch(dashboard, /webHostView\.topAnchor\.constraint\(equalTo: glass\.bottomAnchor\)/);
  assert.match(dashboard, /StratjiWorkspaceChromeMetrics\.barHostHeight/);
  assert.match(dashboard, /glass\.alphaValue = 1/);
  assert.match(dashboard, /sizingOptions = \[\.intrinsicContentSize\]/);
  assert.doesNotMatch(dashboard, /greaterThanOrEqualToConstant: 900/);
  assert.doesNotMatch(dashboard, /glassMinWidth/);
  assert.doesNotMatch(dashboard, /hoverRevealStripHeight/);
  assert.doesNotMatch(dashboard, /hideDelay/);
  assert.doesNotMatch(dashboard, /func revealGlass/);
  assert.doesNotMatch(dashboard, /glassOverlay\.ignoresHits/);
  assert.doesNotMatch(dashboard, /alphaValue = 0/);
  assert.match(glassBar, /static let extraTopOffset: CGFloat = 12/);
  assert.match(glassBar, /static let stackGap: CGFloat = 16/);
  assert.match(glassBar, /barHostHeight: CGFloat = 58 \+ extraTopOffset \+ stackGap/);
  assert.match(glassBar, /sectionDestinations/);
  assert.match(glassBar, /DashboardOutline\.sectionDestinations\(forView:/);
  assert.match(glassBar, /sectionDestinations\(forView: workspace\.rawValue\)/);
  assert.match(glassBar, /sectionDestinations\(for: workspace\)/);
  assert.match(glassBar, /let expanded = clusterWorkspace == workspace/);
  assert.match(glassBar, /clusterWorkspace: StratjiWorkspace \{\s*session\.workspace/);
  assert.doesNotMatch(glassBar, /pillWorkspace/);
  assert.doesNotMatch(glassBar, /hoveredWorkspace \?\? session\.workspace/);
  assert.doesNotMatch(glassBar, /sectionDestinations\(forView: pillWorkspace/);
  assert.doesNotMatch(glassBar, /sectionDestinations\(forView: session\.workspace/);
  assert.match(glassBar, /session\.select\(workspace\.defaultDestination\)/);
  assert.match(glassBar, /destination\.title/);
  assert.match(glassBar, /workspace\.systemImage/);
  assert.match(glassBar, /if emphasized/);
  assert.match(glassBar, /spring\(response: 0\.52/);
  assert.match(glassBar, /fixedSize\(horizontal: true, vertical: true\)/);
  assert.match(glassBar, /accessibilityReduceMotion/);
  assert.match(glassBar, /accessibilityLabel\("Workspace sections"\)/);
  assert.match(glassBar, /accessibilityIdentifier\("workspace-section-tab-/);
  assert.doesNotMatch(glassBar, /layoutPriority\(1\)/);
  assert.doesNotMatch(glassBar, /\.snappy\(duration: 0\.28\)/);
  assert.doesNotMatch(glassBar, /hoverRevealStripHeight/);
  assert.doesNotMatch(glassBar, /hideDelay/);
  assert.match(glassBar, /padding\(\.bottom, StratjiWorkspaceChromeMetrics\.stackGap\)/);
  assert.match(glassBar, /padding\(\.top, StratjiWorkspaceChromeMetrics\.contentTopPadding\)/);
  assert.doesNotMatch(glassBar, /DashboardTabs|workspace-tab-investment/);
  assert.doesNotMatch(window, /NSToolbarItem\.Identifier\.toggleSidebar|\.toggleSidebar/);
  assert.doesNotMatch(window, /\.sidebarTrackingSeparator/);
  assert.doesNotMatch(window, /func toggleSidebar/);
  assert.doesNotMatch(menu, /Hide Sidebar/);
  assert.doesNotMatch(menu, /toggleSidebar/);
  assert.doesNotMatch(iosShell, /Button\("Hide Sidebar"\)/);
  assert.match(iosShell, /accessibilityLabel\("Show Sidebar"\)/);
});

test("native Portfolio row loads I-2 and WKWebView allows same-origin ticket POSTs", async () => {
  const [outline, browser, documentBrowser, iosShell, pbx, infoPlist] = await Promise.all([
    readFile(new URL("apple-app/Outline/DashboardOutline.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/DashboardBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/NativeWorkspaceViews.swift", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard.xcodeproj/project.pbxproj", root), "utf8"),
    readFile(new URL("apple-app/InvestmentDashboard/Info.plist", root), "utf8"),
  ]);
  assert.match(outline, /leaf\("investment\/i2", "Portfolio", view: "investment", section: "i2"/);
  assert.match(browser, /navigationType == \.linkActivated/);
  assert.match(browser, /decisionHandler\(\.allow\)/);
  assert.match(documentBrowser, /navigationType == \.linkActivated/);
  assert.doesNotMatch(browser, /if navigationAction\.targetFrame == nil, \["http", "https"\]/);
  assert.doesNotMatch(documentBrowser, /if navigationAction\.targetFrame == nil, \["http", "https"\]/);
  assert.match(iosShell, /Open workspace outline/);
  assert.match(iosShell, /showingOutline = true/);
  assert.match(pbx, /NSAllowsArbitraryLoadsInWebContent = YES/);
  assert.match(infoPlist, /NSAllowsArbitraryLoadsInWebContent/);
  assert.doesNotMatch(browser, /api_key|api_secret|kite_dashboard_session/);
  assert.doesNotMatch(documentBrowser, /api_key|api_secret|kite_dashboard_session/);
});

test("glass bar cluster lists each workspace's own titles, never Investment leftovers", async () => {
  const [outline, glassBar, routing] = await Promise.all([
    readFile(new URL("apple-app/Outline/DashboardOutline.swift", root), "utf8"),
    readFile(new URL("apple-app/Stratji/StratjiWorkspaceGlassBar.swift", root), "utf8"),
    readFile(new URL("app/dashboard/workspace-routing.ts", root), "utf8"),
  ]);

  const expected = {
    investment: ["Action Board", "Portfolio", "Risk", "Axis picks"],
    sectors: ["Action Board", "Industry Analytics", "Decision Framework"],
    intelligence: ["Action Board", "Satya", "Earnings Calendar"],
    health: ["Action Board", "Daily Optimism", "Vital Metrics", "Calendar + Reminders"],
    builder: ["Action Board", "Canvas", "JSON"],
    strategies: ["Action Board", "Library"],
  };
  const investmentOnly = ["Axis picks"];
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function outlineLetBlock(name) {
    const needle = `static let ${name} = DashboardDestination(`;
    const start = outline.indexOf(needle);
    assert.ok(start >= 0, `missing DashboardOutline.${name}`);
    const nextStatic = outline.indexOf("\n    static let ", start + needle.length);
    const nextFunc = outline.indexOf("\n    static func ", start + needle.length);
    const end = [nextStatic, nextFunc].filter((index) => index >= 0).sort((a, b) => a - b)[0]
      ?? outline.length;
    return outline.slice(start, end);
  }

  for (const [view, titles] of Object.entries(expected)) {
    const block = outlineLetBlock(view);
    for (const title of titles) {
      assert.match(block, new RegExp(`"${escapeRegExp(title)}"`));
      assert.match(routing, new RegExp(`label: "${escapeRegExp(title)}"`));
    }
    if (view !== "investment") {
      for (const leak of investmentOnly) {
        assert.doesNotMatch(block, new RegExp(escapeRegExp(leak)));
      }
      assert.doesNotMatch(block, /leaf\("investment\/i2", "Portfolio"/);
      assert.doesNotMatch(block, /section: "i4"/);
    }
  }

  const sectors = outlineLetBlock("sectors");
  assert.doesNotMatch(sectors, /Axis picks/);
  assert.doesNotMatch(sectors, /title: "Portfolio"/);
  assert.doesNotMatch(sectors, /title: "Risk"/);

  const intel = outlineLetBlock("intelligence");
  assert.match(intel, /leaf\("intelligence\/m1", "Action Board"/);
  assert.match(intel, /leaf\("intelligence\/m2", "Satya"/);
  assert.match(intel, /leaf\("intelligence\/m3", "Earnings Calendar"/);
  assert.doesNotMatch(intel, /Axis picks/);
  assert.doesNotMatch(intel, /Industry Analytics/);
  assert.doesNotMatch(intel, /leaf\("intelligence\/m4"/);

  assert.match(glassBar, /sectionDroplet\(for: workspace\)/);
  assert.match(glassBar, /fallbackSectionDroplet\(for: workspace\)/);
  assert.match(glassBar, /let expanded = clusterWorkspace == workspace/);
  assert.match(glassBar, /let emphasized = selected/);
  assert.doesNotMatch(glassBar, /let expanded = pillWorkspace/);
  assert.doesNotMatch(glassBar, /let emphasized = pillWorkspace/);
});
