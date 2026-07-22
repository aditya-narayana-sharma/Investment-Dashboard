import XCTest

final class InvestmentDashboardUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testNativeShellProvidesConnectionControls() throws {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.staticTexts["Portfolio Intelligence"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Refresh dashboard"].exists)
        XCTAssertTrue(app.buttons["PortfolioDashboard settings"].exists)
    }
}
