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
#if os(iOS)
    @Published var shareURL: URL?
#endif

    private(set) lazy var webView: WKWebView = makeWebView()
    private var requestedURL: URL?
    private var downloadDestination: URL?

    var hasLastLoadedDashboard: Bool {
        lastSuccessfulLoad != nil
    }

    func load(baseURL: URL, workspace: DashboardWorkspace, force: Bool = false) {
        currentWorkspace = workspace
        load(workspace.dashboardURL(baseURL: baseURL), force: force)
    }

    func load(_ url: URL, force: Bool = false) {
        guard force || requestedURL != url || webView.url == nil else { return }
        requestedURL = url
        errorMessage = nil
        isLoading = true
        let policy: URLRequest.CachePolicy = force ? .reloadIgnoringLocalCacheData : .useProtocolCachePolicy
        webView.load(URLRequest(url: url, cachePolicy: policy, timeoutInterval: 45))
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

    func openReport(baseURL: URL) {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return }
        components.path = "/report"
        components.queryItems = [URLQueryItem(name: "export", value: "1")]
        guard let url = components.url else { return }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45))
    }

    func openIntegrations(baseURL: URL) {
        load(baseURL: baseURL, workspace: .integrations, force: true)
    }

    private func updateNavigationState() {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        if let workspace = DashboardWorkspace.from(url: webView.url) {
            currentWorkspace = workspace
        }
    }

    private func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
#if os(iOS)
        configuration.allowsInlineMediaPlayback = true
#endif
        let view = WKWebView(frame: .zero, configuration: configuration)
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
        errorMessage = "The Mac dashboard could not be reached. Keep the Mac awake, start Portfolio Intelligence, and confirm Tailscale is connected on both devices."
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

        if navigationAction.targetFrame == nil, ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            webView.load(navigationAction.request)
            decisionHandler(.cancel)
            return
        }

        if ["http", "https", "about", "blob", "data"].contains(url.scheme?.lowercased() ?? "") {
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
