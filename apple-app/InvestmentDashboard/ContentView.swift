import Combine
import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

enum PortfolioDashboardConfiguration {
    static let serverDefaultsKey = "dashboardServerAddress"
    static let defaultServerAddress = "https://adis-mbp.tailfd8d7f.ts.net/"

    static func normalizedServerURL(from value: String) -> URL? {
        var candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return nil }

        if !candidate.contains("://") {
            candidate = "http://" + candidate
        }

        guard var components = URLComponents(string: candidate),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host != nil else {
            return nil
        }

        if components.path.isEmpty {
            components.path = "/"
        }

        return components.url
    }
}

@MainActor
final class PortfolioDashboardBrowserModel: NSObject, ObservableObject {
    @Published private(set) var isLoading = true
    @Published private(set) var canGoBack = false
    @Published private(set) var canGoForward = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var lastSuccessfulLoad: Date?

    private(set) weak var webView: WKWebView?
    private var requestedURL: URL?

    var statusText: String {
        if errorMessage != nil { return "Connection unavailable" }
        if isLoading { return "Connecting securely" }
        return "Private live connection"
    }

    var statusColor: Color {
        if errorMessage != nil { return .red }
        if isLoading { return .orange }
        return .green
    }

    func attach(_ webView: WKWebView) {
        self.webView = webView
        updateNavigationState()
    }

    func load(_ url: URL, force: Bool = false) {
        guard let webView else { return }
        guard force || requestedURL != url || webView.url == nil else { return }

        requestedURL = url
        errorMessage = nil
        isLoading = true
        let policy: URLRequest.CachePolicy = force ? .reloadIgnoringLocalCacheData : .useProtocolCachePolicy
        webView.load(URLRequest(url: url, cachePolicy: policy, timeoutInterval: 30))
    }

    func retry() {
        if let requestedURL {
            load(requestedURL, force: true)
        } else {
            webView?.reload()
        }
    }

    func reload() {
        if let requestedURL {
            load(requestedURL, force: true)
        } else {
            webView?.reload()
        }
    }

    func goBack() {
        webView?.goBack()
        updateNavigationState()
    }

    func goForward() {
        webView?.goForward()
        updateNavigationState()
    }

    private func updateNavigationState() {
        canGoBack = webView?.canGoBack ?? false
        canGoForward = webView?.canGoForward ?? false
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
        reload()
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
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let requestURL = navigationAction.request.url {
            webView.load(URLRequest(url: requestURL))
        }
        return nil
    }

    private func handleNavigationError(_ error: Error) {
        let nsError = error as NSError
        guard nsError.code != NSURLErrorCancelled else { return }
        isLoading = false
        errorMessage = "The Mac dashboard could not be reached. Confirm that Flask is running and Tailscale is connected on both devices."
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

struct ContentView: View {
    @AppStorage(PortfolioDashboardConfiguration.serverDefaultsKey)
    private var serverAddress = PortfolioDashboardConfiguration.defaultServerAddress

    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var browser = PortfolioDashboardBrowserModel()
#if os(iOS)
    @StateObject private var healthSync = HealthKitSyncCoordinator()
#endif
    @State private var showingSettings = false

    private var serverURL: URL? {
        PortfolioDashboardConfiguration.normalizedServerURL(from: serverAddress)
    }

    var body: some View {
        ZStack {
            Color(red: 0.02, green: 0.025, blue: 0.03)
                .ignoresSafeArea()

            if let serverURL {
                PortfolioDashboardWebView(url: serverURL, model: browser)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                InvalidAddressView {
                    showingSettings = true
                }
            }

            if let message = browser.errorMessage {
                ConnectionErrorView(
                    message: message,
                    retry: browser.retry,
                    editAddress: { showingSettings = true }
                )
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            PortfolioDashboardHeader(
                browser: browser,
                openSettings: { showingSettings = true }
            )
        }
        .sheet(isPresented: $showingSettings) {
            PortfolioDashboardSettingsView(serverAddress: $serverAddress)
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, let serverURL else { return }
            let isStale = browser.lastSuccessfulLoad.map { Date().timeIntervalSince($0) > 60 } ?? true
            browser.load(serverURL, force: isStale)
#if os(iOS)
            Task {
                await healthSync.sync(to: serverURL)
                browser.load(serverURL, force: true)
            }
#endif
        }
#if os(iOS)
        .task(id: serverURL) {
            guard let serverURL else { return }
            await healthSync.sync(to: serverURL)
            browser.load(serverURL, force: true)
        }
#endif
        .preferredColorScheme(.dark)
    }
}

private struct PortfolioDashboardHeader: View {
    @ObservedObject var browser: PortfolioDashboardBrowserModel
    let openSettings: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(Color(red: 0.08, green: 0.32, blue: 0.58))
                .clipShape(RoundedRectangle(cornerRadius: 7))

            VStack(alignment: .leading, spacing: 2) {
                Text("Portfolio Intelligence")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                HStack(spacing: 5) {
                    Circle()
                        .fill(browser.statusColor)
                        .frame(width: 6, height: 6)
                    Text(browser.statusText)
                        .font(.caption2)
                        .foregroundStyle(Color.white.opacity(0.66))
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 6)

            HeaderButton(
                title: "Back",
                systemImage: "chevron.left",
                enabled: browser.canGoBack,
                action: browser.goBack
            )
            HeaderButton(
                title: "Forward",
                systemImage: "chevron.right",
                enabled: browser.canGoForward,
                action: browser.goForward
            )
            HeaderButton(
                title: "Refresh dashboard",
                systemImage: "arrow.clockwise",
                enabled: !browser.isLoading,
                action: browser.reload
            )
            HeaderButton(
                title: "PortfolioDashboard settings",
                systemImage: "gearshape",
                enabled: true,
                action: openSettings
            )
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)
        }
    }
}

private struct HeaderButton: View {
    let title: String
    let systemImage: String
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(enabled ? Color.white : Color.white.opacity(0.25))
        .disabled(!enabled)
        .accessibilityLabel(title)
    }
}

private struct ConnectionErrorView: View {
    let message: String
    let retry: () -> Void
    let editAddress: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "network.slash")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(.orange)
            Text("PortfolioDashboard offline")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Color.white.opacity(0.68))
                .multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("Edit server", action: editAddress)
                    .buttonStyle(.bordered)
                Button("Try again", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(maxWidth: 430)
        .background(Color(red: 0.055, green: 0.065, blue: 0.075))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        }
        .padding(20)
    }
}

private struct InvalidAddressView: View {
    let editAddress: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Server address required", systemImage: "server.rack")
        } description: {
            Text("Enter the Flask dashboard address for your Mac.")
        } actions: {
            Button("Open settings", action: editAddress)
                .buttonStyle(.borderedProminent)
        }
    }
}

private struct PortfolioDashboardSettingsView: View {
    @Binding var serverAddress: String
    @Environment(\.dismiss) private var dismiss
    @State private var draftAddress: String

    init(serverAddress: Binding<String>) {
        _serverAddress = serverAddress
        _draftAddress = State(initialValue: serverAddress.wrappedValue)
    }

    private var normalizedURL: URL? {
        PortfolioDashboardConfiguration.normalizedServerURL(from: draftAddress)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Private dashboard server") {
                    TextField("https://adis-mbp.tailfd8d7f.ts.net/", text: $draftAddress)
                        .textContentType(.URL)
                        .autocorrectionDisabled()

                    if let normalizedURL {
                        Label(normalizedURL.absoluteString, systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.green)
                    } else {
                        Label("Enter a valid HTTP or HTTPS address.", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }

                Section("Mobile-data access") {
                    Label("Keep the Mac awake with the Flask dashboard running.", systemImage: "desktopcomputer")
                    Label("Connect this iPhone and the Mac to the same Tailscale account.", systemImage: "lock.shield")
                    Label("Wi-Fi is not required after Tailscale is connected.", systemImage: "antenna.radiowaves.left.and.right")
                }

                Section {
                    Text("Default remote address: \(PortfolioDashboardConfiguration.defaultServerAddress)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Connection")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Connect") {
                        guard let normalizedURL else { return }
                        serverAddress = normalizedURL.absoluteString
                        dismiss()
                    }
                    .disabled(normalizedURL == nil)
                }
            }
        }
        .frame(minWidth: 420, minHeight: 390)
    }
}

@MainActor
private func makePortfolioDashboardWebView(model: PortfolioDashboardBrowserModel) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true

#if os(iOS)
    configuration.allowsInlineMediaPlayback = true
#endif

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = model
    webView.uiDelegate = model
    webView.allowsBackForwardNavigationGestures = true

#if os(iOS)
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.backgroundColor = .clear
    webView.scrollView.contentInsetAdjustmentBehavior = .never
#elseif os(macOS)
    webView.setValue(false, forKey: "drawsBackground")
#endif

    model.attach(webView)
    return webView
}

#if os(iOS)
private struct PortfolioDashboardWebView: UIViewRepresentable {
    let url: URL
    @ObservedObject var model: PortfolioDashboardBrowserModel

    func makeUIView(context: Context) -> WKWebView {
        makePortfolioDashboardWebView(model: model)
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.attach(webView)
        model.load(url)
    }
}
#elseif os(macOS)
private struct PortfolioDashboardWebView: NSViewRepresentable {
    let url: URL
    @ObservedObject var model: PortfolioDashboardBrowserModel

    func makeNSView(context: Context) -> WKWebView {
        makePortfolioDashboardWebView(model: model)
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        model.attach(webView)
        model.load(url)
    }
}
#endif
