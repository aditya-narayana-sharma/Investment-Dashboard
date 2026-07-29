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

    @Test func rejectsUnsafeSchemes() {
        #expect(PortfolioDashboardConfiguration.normalizedServerURL(from: "file:///tmp/private") == nil)
        #expect(PortfolioDashboardConfiguration.normalizedServerURL(from: "") == nil)
    }

    @Test func buildsWorkspaceDeepLinksWithoutLeakingPriorPaths() {
        let base = URL(string: "https://dashboard.example.ts.net/report?old=1")!
        #expect(DashboardWorkspace.investment.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=investment")
        #expect(DashboardWorkspace.sectors.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=sectors")
        #expect(DashboardWorkspace.intelligence.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=intelligence")
        #expect(DashboardWorkspace.health.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=health")
    }

    @Test func readsWorkspaceFromDashboardURL() {
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=sectors")) == .sectors)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=intelligence")) == .intelligence)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=market-intelligence")) == .intelligence)
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=unknown")) == nil)
    }

    @Test func decodesStartupAuditSemantics() throws {
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
}
