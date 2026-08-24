import Combine
import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

@MainActor
final class PortfolioDashboardBrowserModel: NSObject, ObservableObject {
    @Published private(set) var isLoading = true
    @Published private(set) var canGoBack = false
    @Published private(set) var canGoForward = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var lastSuccessfulLoad: Date?
    @Published private(set) var currentWorkspace: DashboardWorkspace = .investment
    @Published private(set) var currentDestinationID: String = DashboardOutline.defaultDestination.id
#if os(iOS)
    @Published var shareURL: URL?
#endif

    private(set) lazy var webView: WKWebView = makeWebView()
    private var requestedURL: URL?
    private var pendingDestination: DashboardDestination?
    private var downloadDestination: URL?

    var hasLastLoadedDashboard: Bool {
        lastSuccessfulLoad != nil
    }

    func load(baseURL: URL, workspace: DashboardWorkspace, force: Bool = false) {
        load(baseURL: baseURL, destination: DashboardOutline.defaultDestination(forView: workspace.rawValue), force: force)
    }

    func load(baseURL: URL, destination: DashboardDestination, force: Bool = false) {
        let target = destination.clickTarget
        currentWorkspace = DashboardWorkspace(rawValue: target.view) ?? .investment
        currentDestinationID = target.id
        pendingDestination = target
        let url = target.url(baseURL: baseURL, nativeChrome: true)
        NSLog("[Stratji] webView.load destination=%@ url=%@", target.id, url.absoluteString)
        applyDeviceCookie(for: baseURL)
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

    func load(_ url: URL, force: Bool = false) {
        guard force || requestedURL != url || webView.url == nil else { return }
        requestedURL = url
        errorMessage = nil
        isLoading = true
        let policy: URLRequest.CachePolicy = .reloadIgnoringLocalCacheData
        webView.load(URLRequest(url: url, cachePolicy: policy, timeoutInterval: 45))
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

    func continueWithLastLoadedDashboard() {
        guard hasLastLoadedDashboard else { return }
        errorMessage = nil
    }

    func applyDeviceCookie(for baseURL: URL) {
        guard let token = try? HealthCredentialStore.token(),
              let host = baseURL.host else { return }
        var properties: [HTTPCookiePropertyKey: Any] = [
            .domain: host,
            .path: "/",
            .name: "stratji_device",
            .value: token,
        ]
        if let cookie = HTTPCookie(properties: properties) {
            webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
        }
    }

    func openReport(baseURL: URL) {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return }
        components.path = "/report"
        components.queryItems = [URLQueryItem(name: "export", value: "1")]
        guard let url = components.url else { return }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45))
    }

    private func updateNavigationState() {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        if let destination = DashboardOutline.match(url: webView.url) {
            currentDestinationID = destination.id
            currentWorkspace = DashboardWorkspace(rawValue: destination.view) ?? .investment
        } else if let workspace = DashboardWorkspace.from(url: webView.url) {
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
            \(StratjiAppearanceStore.webBootstrapScript())
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true,
            in: .page
        )
        configuration.userContentController.addUserScript(hideChrome)
        let satyaSpeech = StratjiSatyaSpeechBridge()
        configuration.userContentController.add(satyaSpeech, name: StratjiSatyaSpeechBridge.messageName)
#if os(macOS)
        let satyaDraft = StratjiSatyaDraftBridge()
        configuration.userContentController.add(satyaDraft, name: StratjiSatyaDraftBridge.messageName)
#endif
        configuration.applicationNameForUserAgent = "Stratji/1"
#if os(iOS)
        configuration.allowsInlineMediaPlayback = true
#endif
        let view = WKWebView(frame: .zero, configuration: configuration)
        satyaSpeech.webView = view
#if os(macOS)
        satyaDraft.webView = view
#endif
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
#if os(iOS)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.scrollView.contentInsetAdjustmentBehavior = .never
#elseif os(macOS)
        view.setValue(false, forKey: "drawsBackground")
#endif
        return view
    }

    private func handleNavigationError(_ error: Error) {
        let nsError = error as NSError
        guard nsError.code != NSURLErrorCancelled else { return }
        isLoading = false
        errorMessage = "The Mac dashboard could not be reached. Keep the Mac awake on the same Wi-Fi and start Stratji."
        updateNavigationState()
    }

    private func openExternally(_ url: URL) {
#if os(iOS)
        UIApplication.shared.open(url)
#elseif os(macOS)
        NSWorkspace.shared.open(url)
#endif
    }
}

extension PortfolioDashboardBrowserModel: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isLoading = true
        errorMessage = nil
        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        errorMessage = nil
        lastSuccessfulLoad = Date()
        updateNavigationState()
        webView.evaluateJavaScript(
            """
            document.documentElement.classList.add('native-chrome-embed');
            document.documentElement.dataset.nativeChrome = '1';
            \(StratjiAppearanceStore.applyJavaScript())
            document.querySelectorAll('.masthead').forEach((el) => {
              el.setAttribute('hidden', '');
            });
            """
        )
        if let url = requestedURL ?? webView.url,
           let destination = pendingDestination ?? DashboardOutline.match(url: url) {
            DashboardNativeRoute.apply(in: webView, url: url, destination: destination)
        }
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
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
        if StratjiKiteAuth.shouldOpenInSystemBrowser(url) {
            openExternally(url)
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
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        let response = navigationResponse.response
        if response.mimeType == "application/pdf" || !navigationResponse.canShowMIMEType {
            decisionHandler(.download)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let requestURL = navigationAction.request.url {
            if StratjiKiteAuth.shouldOpenInSystemBrowser(requestURL) {
                openExternally(requestURL)
                return nil
            }
            webView.load(URLRequest(url: requestURL))
        }
        return nil
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }
}

extension PortfolioDashboardBrowserModel: WKDownloadDelegate {
    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let safeFilename = suggestedFilename.isEmpty ? "Portfolio-Intelligence.pdf" : suggestedFilename
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension((safeFilename as NSString).pathExtension.isEmpty ? "pdf" : (safeFilename as NSString).pathExtension)
        downloadDestination = destination
        completionHandler(destination)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let location = downloadDestination else { return }
#if os(iOS)
        shareURL = location
#else
        NSWorkspace.shared.activateFileViewerSelecting([location])
#endif
        downloadDestination = nil
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadDestination = nil
        errorMessage = "The report could not be downloaded: \(error.localizedDescription)"
    }
}

#if os(iOS)
struct PortfolioDashboardWebView: UIViewRepresentable {
    @ObservedObject var model: PortfolioDashboardBrowserModel

    func makeUIView(context: Context) -> WKWebView {
        model.webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
#elseif os(macOS)
struct PortfolioDashboardWebView: NSViewRepresentable {
    @ObservedObject var model: PortfolioDashboardBrowserModel

    func makeNSView(context: Context) -> WKWebView {
        model.webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}
}
#endif
