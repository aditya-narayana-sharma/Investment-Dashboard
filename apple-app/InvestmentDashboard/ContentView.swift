import SwiftUI

struct ContentView: View {
    @AppStorage(PortfolioDashboardConfiguration.serverDefaultsKey)
    private var serverAddress = PortfolioDashboardConfiguration.defaultServerAddress
    @AppStorage(PortfolioDashboardConfiguration.onboardingDefaultsKey)
    private var onboardingComplete = false
    @AppStorage(PortfolioDashboardConfiguration.workspaceDefaultsKey)
    private var workspaceRawValue = DashboardWorkspace.investment.rawValue

    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var browser = PortfolioDashboardBrowserModel()
    @StateObject private var statusModel = DashboardStatusModel()
    @StateObject private var pairing = HealthPairingModel()
#if os(iOS)
    @StateObject private var healthSync = HealthKitSyncCoordinator()
#endif
    @State private var showingSettings = false
    @State private var showingOnboarding = false

    private var serverURL: URL? {
        PortfolioDashboardConfiguration.normalizedServerURL(from: serverAddress)
    }

    private var workspace: Binding<DashboardWorkspace> {
        Binding(
            get: {
                if workspaceRawValue == "market-intelligence" {
                    return .intelligence
                }
                if workspaceRawValue == "algorithm-canvas" {
                    return .builder
                }
                if workspaceRawValue == "strategy-library" {
                    return .strategies
                }
                if workspaceRawValue == "settings" {
                    return .integrations
                }
                return DashboardWorkspace(rawValue: workspaceRawValue) ?? .investment
            },
            set: { workspaceRawValue = $0.rawValue }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            nativeHeader

            NativeWorkspacePicker(selection: workspace)
            NativeFreshnessStrip(model: statusModel)

            ZStack {
                Color.black.ignoresSafeArea()
                PortfolioDashboardWebView(model: browser)
                    .ignoresSafeArea(edges: .bottom)

                if let message = browser.errorMessage {
                    DashboardOfflineOverlay(
                        message: message,
                        hasLastLoadedDashboard: browser.hasLastLoadedDashboard,
                        lastSuccessfulLoad: browser.lastSuccessfulLoad,
                        retry: retryConnection,
                        continueOffline: browser.continueWithLastLoadedDashboard,
                        settings: { showingSettings = true }
                    )
                }
            }
        }
        .sheet(isPresented: $showingSettings) {
            DashboardSettingsView(
                serverAddress: $serverAddress,
                statusModel: statusModel,
                pairing: pairing,
                onOpenIntegrations: openIntegrations
            )
        }
        .sheet(isPresented: $showingOnboarding) {
            DashboardOnboardingView(
                serverAddress: $serverAddress,
                isComplete: $onboardingComplete,
                statusModel: statusModel,
                pairing: pairing
            )
        }
#if os(iOS)
        .sheet(
            isPresented: Binding(
                get: { browser.shareURL != nil },
                set: { if !$0 { browser.shareURL = nil } }
            )
        ) {
            if let url = browser.shareURL {
                ShareSheet(items: [url])
            }
        }
#endif
        .onChange(of: workspaceRawValue) { _, _ in
            loadSelectedWorkspace()
        }
        .onReceive(NotificationCenter.default.publisher(for: .portfolioNativeRefresh)) { _ in
            refreshAll()
        }
        .onReceive(NotificationCenter.default.publisher(for: .portfolioOpenReport)) { _ in
            openReport()
        }
        .onReceive(NotificationCenter.default.publisher(for: .portfolioOpenIntegrations)) { _ in
            openIntegrations()
        }
        .onChange(of: serverAddress) { _, _ in
            startSession()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else {
                if phase == .background { statusModel.stopMonitoring() }
                return
            }
            startSession()
#if os(iOS)
            syncHealth()
#endif
        }
        .task {
            showingOnboarding = !onboardingComplete
            if onboardingComplete {
                startSession()
#if os(iOS)
                syncHealth()
#endif
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var nativeHeader: some View {
#if os(iOS)
        NativeDashboardHeader(
            browser: browser,
            statusModel: statusModel,
            healthSync: healthSync,
            refresh: refreshAll,
            report: openReport,
            settings: { showingSettings = true },
            integrations: openIntegrations
        )
#else
        NativeDashboardHeader(
            browser: browser,
            statusModel: statusModel,
            refresh: refreshAll,
            report: openReport,
            settings: { showingSettings = true },
            integrations: openIntegrations
        )
#endif
    }

    private func startSession() {
        guard onboardingComplete, let serverURL else { return }
        statusModel.startMonitoring(baseURL: serverURL)
        loadSelectedWorkspace()
    }

    private func loadSelectedWorkspace(force: Bool = false) {
        guard let serverURL else { return }
        browser.load(baseURL: serverURL, workspace: workspace.wrappedValue, force: force)
    }

    private func retryConnection() {
        guard let serverURL else {
            showingSettings = true
            return
        }
        Task {
            await statusModel.check(baseURL: serverURL)
            loadSelectedWorkspace(force: true)
        }
    }

    private func refreshAll() {
        guard let serverURL else { return }
        Task { await statusModel.check(baseURL: serverURL) }
        browser.refreshDashboard()
#if os(iOS)
        syncHealth()
#endif
    }

    private func openReport() {
        guard let serverURL else { return }
        browser.openReport(baseURL: serverURL)
    }

    private func openIntegrations() {
        workspace.wrappedValue = .integrations
        loadSelectedWorkspace()
    }

#if os(iOS)
    private func syncHealth() {
        guard let serverURL, onboardingComplete else { return }
        Task {
            await healthSync.sync(to: serverURL)
            await statusModel.check(baseURL: serverURL)
        }
    }
#endif
}
