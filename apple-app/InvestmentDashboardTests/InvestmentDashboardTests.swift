import Testing
@testable import InvestmentDashboard

struct InvestmentDashboardTests {
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
        #expect(DashboardWorkspace.health.dashboardURL(baseURL: base).absoluteString == "https://dashboard.example.ts.net/?view=health")
    }

    @Test func readsWorkspaceFromDashboardURL() {
        #expect(DashboardWorkspace.from(url: URL(string: "https://dashboard.example/?view=sectors")) == .sectors)
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
