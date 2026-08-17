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

        XCTAssertTrue(app.staticTexts["Portfolio Intelligence"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Refresh dashboard"].exists)
        XCTAssertTrue(app.buttons["Connection and Health settings"].exists)
        XCTAssertTrue(app.buttons["Portfolio Overview"].exists)
        XCTAssertTrue(app.buttons["Sectoral"].exists)
        XCTAssertTrue(app.buttons["Health"].exists)
        XCTAssertTrue(app.buttons["Integrations"].exists)
    }
}
