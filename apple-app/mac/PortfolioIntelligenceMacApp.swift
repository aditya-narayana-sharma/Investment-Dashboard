import AppKit
import WebKit

@main
final class PortfolioIntelligenceMacApp: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private let dashboardURL = URL(string: ProcessInfo.processInfo.environment["PORTFOLIO_DESKTOP_URL"] ?? "http://127.0.0.1:5050/")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let webView = WKWebView(frame: .zero)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        self.webView = webView

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Portfolio Intelligence"
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window

        NSApp.mainMenu = buildMenu()
        webView.load(URLRequest(url: dashboardURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    @objc func refreshDashboard() {
        webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('portfolio-native-refresh'))") { _, error in
            if error != nil { self.webView?.reload() }
        }
    }

    @objc func openReport() {
        guard var components = URLComponents(url: dashboardURL, resolvingAgainstBaseURL: false) else { return }
        components.path = "/report"
        components.queryItems = [URLQueryItem(name: "export", value: "1")]
        guard let url = components.url else { return }
        webView?.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45))
    }

    @objc func openIntegrations() {
        guard var components = URLComponents(url: dashboardURL, resolvingAgainstBaseURL: false) else { return }
        components.path = "/"
        components.queryItems = [URLQueryItem(name: "view", value: "integrations")]
        guard let url = components.url else { return }
        webView?.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45))
    }

    private func buildMenu() -> NSMenu {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Portfolio Intelligence", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)

        let dashboardItem = NSMenuItem()
        let dashboardMenu = NSMenu(title: "Dashboard")
        dashboardMenu.addItem(withTitle: "Refresh", action: #selector(refreshDashboard), keyEquivalent: "r")
        dashboardMenu.addItem(withTitle: "Report", action: #selector(openReport), keyEquivalent: "p")
        dashboardMenu.addItem(withTitle: "Integrations", action: #selector(openIntegrations), keyEquivalent: ",")
        dashboardItem.submenu = dashboardMenu
        menu.addItem(dashboardItem)
        return menu
    }
}
