import Foundation
import Testing
@testable import InvestmentDashboard

struct InvestmentDashboardTests {
    private func date(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }

    @Test func healthOperationalDayRollsAtEightPMIST() {
        let cases: [(String, String, HealthTargetPolicy)] = [
            ("2026-07-26T19:59:00+05:30", "2026-07-25", .previousDay),
            ("2026-07-26T20:00:00+05:30", "2026-07-26", .evening),
            ("2026-07-26T23:59:00+05:30", "2026-07-26", .evening),
            ("2026-07-27T00:00:00+05:30", "2026-07-26", .overnight),
            ("2026-07-27T01:59:00+05:30", "2026-07-26", .overnight),
            ("2026-07-27T02:00:00+05:30", "2026-07-26", .previousDay),
            ("2026-07-27T21:00:00+05:30", "2026-07-27", .evening),
        ]
        for (instant, targetDate, policy) in cases {
            let context = HealthOperationalDatePolicy.context(for: date(instant))
            #expect(context.targetDateKey == targetDate)
            #expect(context.policy == policy)
        }
    }

    @Test func normalizesMagicDNSAddress() {
        let url = PortfolioDashboardConfiguration.normalizedServerURL(from: "localhost:5050")
        #expect(url?.absoluteString == "http://localhost:5050/")
    }

    @Test func preservesSecureAddressAndPath() {
        let url = PortfolioDashboardConfiguration.normalizedServerURL(from: "https://dashboard.example.ts.net/report")
        #expect(url?.absoluteString == "https://dashboard.example.ts.net/report")
    }

    @Test func migratesTailscaleAddressesAway() {
        #expect(PortfolioDashboardConfiguration.isTailscaleAddress("https://adis-mbp.tailfd8d7f.ts.net/"))
        #expect(PortfolioDashboardConfiguration.migratedServerAddress("https://adis-mbp.tailfd8d7f.ts.net/") == "")
        #expect(PortfolioDashboardConfiguration.migratedServerAddress("http://192.168.1.20:5050/") == "http://192.168.1.20:5050/")
    }

    @Test func buildsWorkspaceDeepLinksWithoutLeakingPriorPaths() {
        let base = URL(string: "https://dashboard.example.ts.net/report?old=1")!
        #expect(DashboardWorkspace.investment.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=investment&section=i1&nativeChrome=1")
        #expect(DashboardWorkspace.sectors.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=sectors&section=s1&nativeChrome=1")
        #expect(DashboardWorkspace.intelligence.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=intelligence&section=m1&nativeChrome=1")
        #expect(DashboardWorkspace.health.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=health&section=h1&nativeChrome=1")
        #expect(DashboardWorkspace.builder.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=builder&section=canvas&nativeChrome=1")
        #expect(DashboardWorkspace.strategies.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=strategies&section=y2&nativeChrome=1")
        #expect(DashboardWorkspace.integrationsURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=integrations&nativeChrome=1")
    }

    @Test func readsWorkspaceFromDashboardURL() {
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=sectors")) == .sectors)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=intelligence")) == .intelligence)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=market-intelligence")) == .intelligence)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=builder")) == .builder)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=algorithm-canvas")) == .builder)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=strategies")) == .strategies)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=strategy-library")) == .strategies)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=integrations")) == nil)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=settings")) == nil)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=portfolio")) == .investment)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=unknown")) == nil)
    }

    @Test func periodicRefreshIntervalMatchesWebSpa() {
        #expect(DashboardRefreshSchedule.interval == 5 * 60)
        #expect(DashboardRefreshSchedule.forcedRequestTimeout == 320)
        #expect(DashboardRefreshSchedule.isStale(lastSuccess: nil))
        #expect(!DashboardRefreshSchedule.isStale(lastSuccess: Date()))
        #expect(DashboardRefreshSchedule.isStale(lastSuccess: Date().addingTimeInterval(-5 * 60)))
    }

    @Test func neverLabelsStaleOrCachedAsLive() {
        #expect(FreshnessLabel.displayName(for: "stale") == "Stale")
        #expect(FreshnessLabel.displayName(for: "snapshot") == "Cached")
        #expect(FreshnessLabel.displayName(for: "cached") == "Cached")
        #expect(FreshnessLabel.displayName(for: "live") == "Live")
        #expect(FreshnessLabel.displayName(for: "verified") == "Verified")
        #expect(!FreshnessLabel.isLive("stale"))
        #expect(!FreshnessLabel.isLive("snapshot"))
        #expect(!FreshnessLabel.isLive("cached"))
        #expect(FreshnessLabel.isLive("live"))
    }

    @Test @MainActor func decodesKiteHoldingsWithoutClaimingCachedLive() throws {
        let data = Data("""
        {
          "status": "snapshot",
          "authStatus": "authenticated",
          "asOf": "17 Aug 2026, 6:00 pm · cached",
          "message": "Retained holdings.",
          "portfolio": { "invested": 100, "value": 110, "pnl": 10, "pnlPct": 10, "dayPnl": 1, "dayPct": 1, "topTwo": 70, "equityMargin": 0 },
          "holdings": [{ "symbol": "ICICIBANK", "name": "ICICI Bank", "qty": 4, "price": 1411.5, "value": 5646, "dayPnl": 40.2 }]
        }
        """.utf8)
        let snapshot = try JSONDecoder().decode(KiteSnapshotPayload.self, from: data)
        #expect(snapshot.displayStatus == "Cached")
        #expect(!snapshot.isLive)
        #expect(snapshot.holdings?.first?.symbol == "ICICIBANK")
    }

    @Test @MainActor func decodesRefreshSourcesAndProgressStages() throws {
        let data = Data("""
        {
          "status": "partial",
          "refreshedAt": "2026-08-17T12:00:00Z",
          "sources": [
            { "source": "Kite", "state": "live", "required": true, "message": "Holdings live" },
            { "source": "Apple Health export", "state": "stale", "required": true, "message": "Target missing" }
          ]
        }
        """.utf8)
        let refresh = try JSONDecoder().decode(DashboardRefreshPayload.self, from: data)
        #expect(refresh.status == "partial")
        #expect(refresh.sources[0].isLive)
        #expect(refresh.sources[1].displayState == "Stale")
        #expect(!refresh.sources[1].isLive)

        let lossy = Data("""
        {
          "status": "current",
          "sources": [
            { "state": "live" },
            { "source": "Kite", "state": "live", "required": true },
            { "source": "NSE benchmarks", "state": "live" }
          ]
        }
        """.utf8)
        let recovered = try JSONDecoder().decode(DashboardRefreshPayload.self, from: lossy)
        #expect(recovered.sources.map(\.source) == ["Kite", "NSE benchmarks"])
        #expect(RefreshStage.service.title == "Service up")
        #expect(RefreshStage.mail.title == "Mail")
        #expect(RefreshStage.calendar.title == "Calendar")
        #expect(RefreshStage.reminders.title == "Reminders")
        #expect(RefreshStage.podcasts.title == "Podcasts")
        #expect(RefreshStage.health.endProgress > RefreshStage.kite.endProgress)
        #expect(RefreshStage.hydrate.progress == 1)
        #expect(RefreshStage.hydrate.startProgress < 1)
        #expect(RefreshStage.kite.startProgress < RefreshStage.kite.endProgress)
    }

    @Test func primaryWorkspacesMatchSixNativeTabs() {
        #expect(DashboardWorkspace.primaryWorkspaces.map(\.title) == [
            "Portfolio Overview",
            "Sectoral Analytics",
            "Market Intelligence",
            "Health & Wellness",
            "Algorithm Builder",
            "Strategies",
        ])
        #expect(DashboardWorkspace.primaryWorkspaces.map(\.rawValue) == [
            "investment",
            "sectors",
            "intelligence",
            "health",
            "builder",
            "strategies",
        ])
        #expect(DashboardWorkspace.primaryWorkspaces.map(\.tabTitle) == [
            "Portfolio",
            "Sectors",
            "Intel",
            "Health",
            "Builder",
            "Strategies",
        ])
        #expect(NativeActionCatalog.items(for: .investment).contains(where: { $0.lane == .today }))
        #expect(NativeActionCatalog.items(for: .investment).contains(where: { $0.lane == .monitor }))
        #expect(DashboardWorkspace.allCases.count == 6)
    }

    @Test func sidebarOutlineMatchesWorkspaceSectionURLs() {
        let base = URL(string: "http://127.0.0.1:5050/")!
        #expect(DashboardOutline.workspaces.map(\.title) == [
            "Portfolio Overview",
            "Sectoral Analytics",
            "Market Intelligence",
            "Health & Wellness",
            "Algorithm Builder",
            "Strategies",
        ])
        #expect(DashboardOutline.defaultDestination(forView: "investment").ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=investment&section=i1")
        #expect(DashboardOutline.destination(id: "investment/i2")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=investment&section=i2")
        #expect(DashboardOutline.destination(id: "investment/i4")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=investment&section=i4")
        #expect(DashboardOutline.destination(id: "sectors/s2/rankings")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=sectors&section=s2&page=rankings")
        #expect(DashboardOutline.destination(id: "sectors/s2")?.url(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=sectors&section=s2&page=pulse")
        #expect(DashboardOutline.destination(id: "sectors/s2")?.title == "Industry Analytics")
        #expect(DashboardOutline.destination(id: "sectors/s2")?.children.contains(where: { $0.title == "Sector pulse" }) == false)
        #expect(DashboardOutline.destination(id: "sectors/s3")?.url(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=sectors&section=s3&page=benchmarks")
        #expect(DashboardOutline.destination(id: "health/h2")?.url(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=health&section=h2&page=optimism")
        #expect(DashboardOutline.destination(id: "health/h2")?.title == "Daily Optimism")
        #expect(DashboardOutline.destination(id: "health/h3")?.url(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=health&section=h3&page=metrics-overview")
        #expect(DashboardOutline.destination(id: "health/h3")?.title == "Vital Metrics")
        #expect(DashboardOutline.destination(id: "health/h3/metrics-overview")?.id == "health/h3")
        #expect(DashboardOutline.destination(id: "intelligence/m3")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=intelligence&section=m3")
        #expect(DashboardOutline.destination(id: "health/h2/guardrails")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=health&section=h2&page=guardrails")
        #expect(DashboardOutline.destination(id: "health/h3/nutrition")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=health&section=h3&page=nutrition")
        #expect(DashboardOutline.destination(id: "health/h3/nutrition-2")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=health&section=h3&page=nutrition")
        #expect(DashboardOutline.destination(id: "builder")?.url(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=builder&section=canvas")
        #expect(DashboardOutline.destination(id: "builder/board")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=builder&section=board")
        #expect(DashboardOutline.destination(id: "strategies")?.url(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=strategies&section=y2")
        #expect(DashboardOutline.destination(id: "strategies/y1")?.ownURL(baseURL: base, nativeChrome: false).absoluteString == "http://127.0.0.1:5050/?view=strategies&section=y1")
        #expect(DashboardOutline.match(url: URL(string: "http://127.0.0.1:5050/?view=algorithm-canvas&section=json"))?.id == "builder/json")
        #expect(DashboardOutline.match(url: URL(string: "http://127.0.0.1:5050/?view=strategy-library&section=board"))?.id == "strategies/y1")
        #expect(DashboardOutline.match(url: URL(string: "http://127.0.0.1:5050/?view=health&section=h3&page=sleep"))?.id == "health/h3/sleep")
        #expect(DashboardOutline.match(url: URL(string: "http://127.0.0.1:5050/?view=health&section=h3&page=nutrition-1"))?.id == "health/h3/nutrition")
    }

    @Test func selectingRiskLoadsURLContainingSectionI3() {
        let base = URL(string: "http://127.0.0.1:5050/")!
        let destination = DashboardOutline.destination(id: "investment/i3")!
        var loadedURL: URL?
        func handleOutlineSelection(_ item: DashboardDestination) {
            loadedURL = item.url(baseURL: base, nativeChrome: false)
        }
        handleOutlineSelection(destination)
        #expect(loadedURL?.absoluteString.contains("section=i3") == true)
        #expect(loadedURL?.absoluteString.contains("view=investment") == true)

        let heart = DashboardOutline.destination(id: "health/h3/heart")!
        handleOutlineSelection(heart)
        #expect(loadedURL?.absoluteString.contains("section=h3") == true)
        #expect(loadedURL?.absoluteString.contains("page=heart") == true)

        let script = DashboardNativeRoute.applyJavaScript(url: destination.url(baseURL: base, nativeChrome: true), destination: destination)
        #expect(script.contains("section=i3"))
        #expect(script.contains("PopStateEvent"))
        #expect(script.contains("dashboard-expand-section"))
        #expect(script.contains("I-3"))
    }

    @Test @MainActor func actionBoardMidnightClearsCompleted() {
        let model = NativeActionBoardModel()
        model.toggle("inv-kite", workspace: .investment)
        #expect(model.isCompleted("inv-kite", workspace: .investment))
        model.toggle("inv-kite", workspace: .investment)
        #expect(!model.isCompleted("inv-kite", workspace: .investment))
    }

    @Test @MainActor func decodesStartupAuditSemantics() throws {
        let data = Data("""
        {
          "status": "failed",
          "failures": 2,
          "failedSources": ["Sector: power", "Sector: defence"],
          "finishedAt": "2026-07-22T12:00:00Z",
          "message": "Two sources are not live."
        }
        """.utf8)
        let audit = try JSONDecoder().decode(StartupAuditResponse.self, from: data)
        #expect(!audit.isCurrent)
        #expect(audit.failures == 2)
        #expect(audit.failedSources == ["Sector: power", "Sector: defence"])
    }

    @Test func auth0CustomSchemeCallbacksMatchBundleIds() {
        #expect(
            StratjiAuth0.callbackURL(
                bundleIdentifier: StratjiAuth0.macosBundleID,
                domain: "example.us.auth0.com",
                platform: "macos"
            ) == "com.adityasharma.Stratji://example.us.auth0.com/macos/com.adityasharma.Stratji/callback"
        )
        #expect(
            StratjiAuth0.callbackURL(
                bundleIdentifier: StratjiAuth0.iosBundleID,
                domain: "example.us.auth0.com",
                platform: "ios"
            ) == "com.adityasharma.InvestmentDashboard://example.us.auth0.com/ios/com.adityasharma.InvestmentDashboard/callback"
        )
    }
}
