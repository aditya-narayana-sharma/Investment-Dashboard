import Combine
import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

extension Notification.Name {
    static let stratjiConnectAppleSource = Notification.Name("StratjiConnectAppleSource")
}

@MainActor
final class StratjiDocumentBrowser: NSObject, ObservableObject {
    @Published private(set) var isLoading = true
    @Published private(set) var errorMessage: String?
    @Published private(set) var currentWorkspace: StratjiWorkspace = .investment
    @Published private(set) var currentDestinationID: String = DashboardOutline.defaultDestination.id
    @Published var showingIntegrations = false

    private(set) lazy var webView: WKWebView = makeWebView()
    private var requestedURL: URL?
    private var pendingDestination: DashboardDestination?

    func load(baseURL: URL, workspace: StratjiWorkspace, force: Bool = false) {
        load(baseURL: baseURL, destination: workspace.defaultDestination, force: force)
    }

    func load(baseURL: URL, destination: DashboardDestination, force: Bool = false) {
        showingIntegrations = false
        let target = destination.clickTarget
        currentWorkspace = StratjiWorkspace(rawValue: target.view) ?? .investment
        currentDestinationID = target.id
        pendingDestination = target
        let url = target.url(baseURL: baseURL, nativeChrome: true)
        NSLog("[Stratji] webView.load destination=%@ url=%@", target.id, url.absoluteString)
        if !force, canReuseHydratedDashboard(url) {
            requestedURL = url
            errorMessage = nil
            isLoading = false
            DashboardNativeRoute.apply(in: webView, url: url, destination: target)
            return
        }
        load(url, force: force)
        DashboardNativeRoute.apply(in: webView, url: url, destination: target)
    }

    func loadIntegrations(baseURL: URL, force: Bool = false) {
        showingIntegrations = true
        pendingDestination = nil
        load(StratjiWorkspace.integrationsURL(baseURL: baseURL), force: force)
    }

    func load(_ url: URL, force: Bool = false) {
        guard force || requestedURL != url || webView.url == nil else { return }
        requestedURL = url
        errorMessage = nil
        isLoading = true
        let policy: URLRequest.CachePolicy = .reloadIgnoringLocalCacheData
        webView.load(URLRequest(url: url, cachePolicy: policy, timeoutInterval: 45))
    }

    func refreshDashboard() {
        errorMessage = nil
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('portfolio-native-refresh'))"
        ) { [weak self] _, error in
            if error != nil {
                self?.retry()
            }
        }
    }

    private func canReuseHydratedDashboard(_ url: URL) -> Bool {
        guard let current = webView.url ?? requestedURL else { return false }
        return current.scheme == url.scheme
            && current.host == url.host
            && current.port == url.port
            && current.path == url.path
    }

    func retry() {
        if let requestedURL {
            load(requestedURL, force: true)
        } else {
            webView.reload()
        }
    }

    private func updateNavigationState() {
        if let destination = DashboardOutline.match(url: webView.url) {
            showingIntegrations = false
            currentDestinationID = destination.id
            currentWorkspace = StratjiWorkspace(rawValue: destination.view) ?? .investment
        } else if let workspace = StratjiWorkspace.from(url: webView.url) {
            showingIntegrations = false
            currentWorkspace = workspace
        }
    }

    private func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let hideChrome = WKUserScript(
            source: """
            document.documentElement.classList.add('native-chrome-embed');
            document.documentElement.dataset.nativeChrome = '1';
            \(StratjiLicenseStore.webBootstrapScript())
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(hideChrome)
        configuration.applicationNameForUserAgent = "Stratji/1"
        let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 1100, height: 800), configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
#if os(macOS)
        view.setValue(true, forKey: "drawsBackground")
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.black.cgColor
#endif
        return view
    }

    private func handleNavigationError(_ error: Error) {
        let nsError = error as NSError
        guard nsError.code != NSURLErrorCancelled else { return }
        isLoading = false
        errorMessage = "The dashboard document could not be loaded. Confirm the local Stratji service is running, then Retry."
        updateNavigationState()
    }

    private func openExternally(_ url: URL) {
#if os(iOS)
        UIApplication.shared.open(url)
#elseif os(macOS)
        NSWorkspace.shared.open(url)
#endif
    }

#if os(macOS)
    private func handleStratjiURL(_ url: URL) {
        let host = url.host?.lowercased() ?? ""
        let path = url.path.lowercased()
        let source = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "source" })?
            .value
        if host == "permissions" && (path.contains("connect") || url.path.isEmpty || path == "/connect") {
            NotificationCenter.default.post(
                name: .stratjiConnectAppleSource,
                object: source,
                userInfo: source.map { ["source": $0] }
            )
            return
        }
        if host == "permissions" && path.contains("privacy") {
            openExternally(url)
        }
    }
#endif
}

extension StratjiDocumentBrowser: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isLoading = true
        errorMessage = nil
        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        errorMessage = nil
        updateNavigationState()
        if !showingIntegrations,
           let url = requestedURL ?? webView.url,
           let destination = pendingDestination ?? DashboardOutline.match(url: url) {
            DashboardNativeRoute.apply(in: webView, url: url, destination: destination)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleNavigationError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleNavigationError(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        retry()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "stratji" {
#if os(macOS)
            handleStratjiURL(url)
#endif
            decisionHandler(.cancel)
            return
        }
        // fetch/XHR POSTs often arrive with targetFrame == nil. Reloading them as
        // document navigations drops the body, so only intercept actual new-window links.
        if navigationAction.targetFrame == nil {
            if navigationAction.navigationType == .linkActivated, ["http", "https"].contains(scheme) {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
                return
            }
            if ["http", "https", "about", "blob", "data"].contains(scheme) {
                decisionHandler(.allow)
                return
            }
            openExternally(url)
            decisionHandler(.cancel)
            return
        }
        if ["http", "https", "about", "blob", "data"].contains(scheme) {
            decisionHandler(.allow)
            return
        }
        openExternally(url)
        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let requestURL = navigationAction.request.url {
            webView.load(URLRequest(url: requestURL))
        }
        return nil
    }
}

#if os(macOS)
final class StratjiFilledWebHost: NSView {
    let webView: WKWebView

    init(webView: WKWebView) {
        self.webView = webView
        super.init(frame: NSRect(x: 0, y: 0, width: 1100, height: 800))
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        webView.setValue(true, forKey: "drawsBackground")
        webView.autoresizingMask = [.width, .height]
        webView.translatesAutoresizingMaskIntoConstraints = true
        if webView.superview !== self {
            webView.removeFromSuperview()
            addSubview(webView)
        }
        webView.frame = bounds
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layout() {
        super.layout()
        webView.frame = bounds
    }
}
#endif
