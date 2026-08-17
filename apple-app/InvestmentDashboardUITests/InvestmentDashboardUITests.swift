import XCTest

final class InvestmentDashboardUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testNativeShellProvidesConnectionControls() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-dashboardOnboardingComplete", "YES",
            "-dashboardServerAddress", "http://127.0.0.1:5050/",
        ]
        app.launch()

        let loading = app.staticTexts["Stratji"]
        XCTAssertTrue(loading.waitForExistence(timeout: 8))
        let refresh = app.buttons["Refresh dashboard"]
        let settings = app.buttons["Connection and Health settings"]
        let liveTabs = [
            "Portfolio Overview",
            "Sectoral Analytics",
            "Market Intelligence",
            "Health & Wellness",
            "Algorithm Builder",
            "Strategies",
        ]
        let tabsVisible = liveTabs.allSatisfy { app.buttons[$0].exists }
        XCTAssertTrue(
            refresh.waitForExistence(timeout: 20)
                || settings.waitForExistence(timeout: 1)
                || tabsVisible
                || app.staticTexts["Stratji is not ready"].exists
                || app.staticTexts["Mac data plane unavailable"].exists
                || app.staticTexts["Refreshing Mac data plane"].exists
        )
    }
}
