import SwiftUI

@main
struct InvestmentDashboardApp: App {
    var body: some Scene {
        WindowGroup("Portfolio Intelligence") {
            ContentView()
        }
#if os(macOS)
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1360, height: 900)
#endif
    }
}
