import SwiftUI

struct ContentView: View {
    @AppStorage(PortfolioDashboardConfiguration.serverDefaultsKey)
    private var serverAddress = PortfolioDashboardConfiguration.defaultServerAddress
    @AppStorage(PortfolioDashboardConfiguration.onboardingDefaultsKey)
    private var onboardingComplete = false
    @AppStorage(PortfolioDashboardConfiguration.workspaceDefaultsKey)
    private var workspaceRawValue = DashboardWorkspace.investment.rawValue

    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var auth = AuthenticationService()
    @StateObject private var session = NativeRefreshCoordinator()
    @StateObject private var statusModel = DashboardStatusModel()
    @StateObject private var pairing = HealthPairingModel()
    @StateObject private var browser = PortfolioDashboardBrowserModel()
#if os(iOS)
    @StateObject private var healthSync = HealthKitSyncCoordinator()
#endif
    @State private var showingSettings = false
    @State private var showingOnboarding = false
    @State private var showingInspector = false

    private var serverURL: URL? {
        PortfolioDashboardConfiguration.normalizedServerURL(from: serverAddress)
    }

    private var workspace: Binding<DashboardWorkspace> {
        Binding(
            get: {
                DashboardWorkspace.from(viewValue: workspaceRawValue) ?? .investment
            },
            set: { workspaceRawValue = $0.rawValue }
        )
    }

    var body: some View {
        ZStack {
            Color(white: 0.07).ignoresSafeArea()
            if !auth.isAuthenticated {
                AuthorLoginView(auth: auth) {
                    if let serverURL {
                        Task { await auth.establishWebSession(baseURL: serverURL) }
                    }
                }
            } else {
                switch session.phase {
            case .idle, .loading:
                NativeRefreshProgressView(session: session)
            case .offline:
                NativeOfflineScreen(
                    message: session.offlineMessage,
                    lastSuccessfulLoad: session.lastSuccessfulRefresh,
                    hasCachedSnapshot: session.hasCachedSnapshot,
                    retry: retryConnection,
                    viewLastSnapshot: { session.viewLastSnapshot() },
                    settings: { showingSettings = true }
                )
            case .ready:
                if let serverURL {
#if os(iOS)
                    NativeRootShell(
                        workspace: workspace,
                        session: session,
                        browser: browser,
                        serverURL: serverURL,
                        healthSync: healthSync,
                        refresh: refreshAll,
                        settings: { showingSettings = true }
                    )
#else
                    NativeRootShell(
                        workspace: workspace,
                        session: session,
                        browser: browser,
                        serverURL: serverURL,
                        refresh: refreshAll,
                        settings: { showingSettings = true }
                    )
#endif
                }
            }
            }
        }
        .environmentObject(auth)
        .sheet(isPresented: $showingSettings) {
            DashboardSettingsView(
                serverAddress: $serverAddress,
                statusModel: statusModel,
                pairing: pairing,
                session: session,
                openDashboard: { showingInspector = true },
                openIntegrations: {
                    showingSettings = false
                    if let serverURL {
                        browser.load(DashboardWorkspace.integrationsURL(baseURL: serverURL), force: true)
                    }
                }
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
        .sheet(isPresented: $showingInspector) {
            NavigationStack {
                Group {
                    if let serverURL {
                        PortfolioDashboardWebView(model: browser)
                            .ignoresSafeArea()
                            .onAppear {
                                browser.load(baseURL: serverURL, workspace: workspace.wrappedValue, force: true)
                            }
                    } else {
                        Text("Set the Mac LAN address in Settings before inspecting the data plane.")
                            .padding()
                    }
                }
                .navigationTitle("Inspect Data Plane")
#if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
#endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { showingInspector = false }
                    }
                }
            }
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
        .onChange(of: serverAddress) { _, _ in
            startSession()
        }
        .onChange(of: scenePhase) { _, phase in
            guard auth.isAuthenticated else { return }
            guard phase == .active else {
                if phase == .background { session.stopMonitoring() }
                return
            }
            startSession()
#if os(iOS)
            syncHealth()
#endif
        }
        .onChange(of: auth.isAuthenticated) { _, authenticated in
            showingOnboarding = authenticated && !onboardingComplete
            guard authenticated else {
                session.stopMonitoring()
                return
            }
            if let serverURL {
                Task { await auth.establishWebSession(baseURL: serverURL) }
            }
            if onboardingComplete {
                startSession()
#if os(iOS)
                syncHealth()
#endif
            }
        }
        .task {
            if PortfolioDashboardConfiguration.isTailscaleAddress(serverAddress) {
                serverAddress = ""
                onboardingComplete = false
            }
            showingOnboarding = auth.isAuthenticated && !onboardingComplete
            if auth.isAuthenticated && onboardingComplete {
                startSession()
#if os(iOS)
                syncHealth()
#endif
            }
        }
        .preferredColorScheme(.dark)
    }

    private func startSession() {
        guard auth.isAuthenticated, onboardingComplete, let serverURL else { return }
        session.startMonitoring(baseURL: serverURL)
        statusModel.startMonitoring(baseURL: serverURL)
    }

    private func retryConnection() {
        guard let serverURL else {
            showingSettings = true
            return
        }
        Task { await session.retry(baseURL: serverURL) }
    }

    private func refreshAll() {
        guard let serverURL else { return }
        Task { await session.retry(baseURL: serverURL) }
        browser.refreshDashboard()
#if os(iOS)
        syncHealth()
#endif
    }

#if os(iOS)
    private func syncHealth() {
        guard auth.isAuthenticated, let serverURL, onboardingComplete else { return }
        Task {
            await healthSync.sync(to: serverURL)
            await statusModel.check(baseURL: serverURL)
        }
    }
#endif
}
