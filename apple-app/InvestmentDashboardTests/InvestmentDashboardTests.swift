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
}
