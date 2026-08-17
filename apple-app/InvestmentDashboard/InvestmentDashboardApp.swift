import SwiftUI

@main
struct InvestmentDashboardApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
#if os(macOS)
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1360, height: 900)
        .commands {
            CommandMenu("Dashboard") {
                Button("Refresh") {
                    NotificationCenter.default.post(name: .portfolioNativeRefresh, object: nil)
                }
                .keyboardShortcut("r", modifiers: [.command])
                Button("Report") {
                    NotificationCenter.default.post(name: .portfolioOpenReport, object: nil)
                }
                .keyboardShortcut("p", modifiers: [.command])
                Button("Integrations") {
                    NotificationCenter.default.post(name: .portfolioOpenIntegrations, object: nil)
                }
                .keyboardShortcut(",", modifiers: [.command])
            }
        }
#endif
    }
}
