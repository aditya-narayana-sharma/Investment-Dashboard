import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("Mac outline click loads the row URL including section=i3", async () => {
  const [outline, outlineView, browser, nativeRoute, session] = await Promise.all([
    readFile(new URL("apple-app/Outline/DashboardOutline.swift", root), "utf8"),
    readFile(new URL("apple-app/Outline/DashboardOutlineView.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiDocumentBrowser.swift", root), "utf8"),
    readFile(new URL("apple-app/Outline/DashboardNativeRoute.swift", root), "utf8"),
    readFile(new URL("apple-app/Shared/StratjiSessionModel.swift", root), "utf8"),
  ]);

  assert.match(outline, /leaf\("investment\/i3"/);
  assert.match(outline, /section: "i3"/);
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
  assert.match(nativeRoute, /history\.replaceState/);
  assert.match(nativeRoute, /PopStateEvent/);
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
  assert.match(dashboard, /webHostView\.topAnchor\.constraint\(equalTo: glass\.bottomAnchor\)/);
  assert.match(dashboard, /StratjiWorkspaceChromeMetrics\.barHostHeight/);
  assert.match(glassBar, /static let extraTopOffset: CGFloat = 12/);
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
