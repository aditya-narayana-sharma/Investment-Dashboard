import SwiftUI

struct NativeRootShell: View {
    @Binding var workspace: DashboardWorkspace
    @ObservedObject var session: NativeRefreshCoordinator
    @ObservedObject var browser: PortfolioDashboardBrowserModel
    var serverURL: URL
#if os(iOS)
    @ObservedObject var healthSync: HealthKitSyncCoordinator
#endif
    let refresh: () -> Void
    let settings: () -> Void
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var actions = NativeActionBoardModel()
    @State private var destinationID = DashboardOutline.defaultDestination.id
    @State private var showingOutline = false
    @State private var columnVisibility = NavigationSplitViewVisibility.all

    var body: some View {
        Group {
            if sizeClass == .regular {
                NavigationSplitView(columnVisibility: $columnVisibility) {
                    DashboardOutlineList(selectedID: destinationID) { destination in
                        select(destination)
                    }
                    .navigationSplitViewColumnWidth(min: 268, ideal: DashboardOutline.sidebarWidth, max: 380)
                    .navigationTitle("Stratji")
                } detail: {
                    documentNavigation
                }
            } else {
                documentNavigation
                    .safeAreaInset(edge: .bottom) {
                        compactWorkspaceBar
                    }
                    .sheet(isPresented: $showingOutline) {
                        NavigationStack {
                            DashboardOutlineList(selectedID: destinationID) { destination in
                                showingOutline = false
                                select(destination)
                            }
                            .navigationTitle("Stratji")
#if os(iOS)
                            .navigationBarTitleDisplayMode(.inline)
#endif
                            .toolbar {
                                ToolbarItem(placement: .cancellationAction) {
                                    Button("Close") { showingOutline = false }
                                }
                            }
                        }
                    }
            }
        }
        .onAppear {
            let destination = DashboardOutline.defaultDestination(forView: workspace.rawValue)
            destinationID = destination.id
            browser.applyDeviceCookie(for: serverURL)
        }
        .onChange(of: workspace) { _, newValue in
            if browser.currentWorkspace != newValue {
                let destination = DashboardOutline.defaultDestination(forView: newValue.rawValue)
                destinationID = destination.id
            }
        }
        .onChange(of: browser.currentWorkspace) { _, newValue in
            if workspace != newValue {
                workspace = newValue
            }
        }
        .onChange(of: browser.currentDestinationID) { _, newValue in
            if destinationID != newValue {
                destinationID = newValue
            }
        }
    }

    private func select(_ destination: DashboardDestination) {
        let target = destination.clickTarget
        destinationID = target.id
        if let nextWorkspace = DashboardWorkspace(rawValue: target.view), workspace != nextWorkspace {
            workspace = nextWorkspace
        }
    }

    private var documentNavigation: some View {
        NavigationStack {
            ZStack {
                NativeWorkspacePage(
                    workspace: workspace,
                    section: DashboardOutline.destination(id: destinationID)?.section,
                    session: session,
                    actions: actions,
                    serverURL: serverURL
                )
                if session.viewingCachedSnapshot {
                    VStack {
                        NativeCachedBanner(session: session)
                            .padding(12)
                        Spacer()
                    }
                }
            }
            .background(Color(white: 0.07))
            .navigationTitle(workspace.title)
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
#if os(iOS)
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 8) {
                        if sizeClass != .regular {
                            Button {
                                showingOutline = true
                            } label: {
                                Image(systemName: "sidebar.left")
                            }
                            .accessibilityLabel("Open workspace outline")
                            .accessibilityIdentifier("compact-outline")
                        } else if columnVisibility == .detailOnly {
                            Button {
                                columnVisibility = .all
                            } label: {
                                Image(systemName: "sidebar.left")
                            }
                            .accessibilityLabel("Show Sidebar")
                        }
                        NativeConnectionBadge(session: session)
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button(action: refresh) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Refresh dashboard")
                    Button(action: settings) {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Connection and Health settings")
                }
#else
                ToolbarItemGroup {
                    Button(action: refresh) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .help("Refresh dashboard")
                    Button(action: settings) {
                        Image(systemName: "gearshape")
                    }
                    .help("Connection and Health settings")
                }
#endif
            }
#if os(iOS)
            .safeAreaInset(edge: .top) {
                NativeHealthSyncStrip(healthSync: healthSync)
            }
#endif
        }
    }

    private var compactWorkspaceBar: some View {
        HStack(spacing: 0) {
            ForEach(DashboardWorkspace.primaryWorkspaces) { item in
                Button {
                    workspace = item
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: item.systemImage)
                        Text(item.tabTitle)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .foregroundStyle(workspace == item ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.title)
                .accessibilityIdentifier("workspace-tab-\(item.rawValue)")
                .accessibilityAddTraits(workspace == item ? .isSelected : [])
            }
        }
        .padding(.horizontal, 6)
        .background(.bar)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Live dashboard workspaces")
    }
}

struct NativeConnectionBadge: View {
    @ObservedObject var session: NativeRefreshCoordinator

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(session.connection.color)
                .frame(width: 7, height: 7)
            Text(session.connection.label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(session.connection.label)
    }
}

#if os(iOS)
struct NativeHealthSyncStrip: View {
    @ObservedObject var healthSync: HealthKitSyncCoordinator

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: healthSync.isSyncing ? "arrow.triangle.2.circlepath" : "heart.fill")
                .foregroundStyle(healthSync.isSyncing ? .orange : .pink)
            Text(healthSync.status)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
    }
}
#endif

struct NativeCachedBanner: View {
    @ObservedObject var session: NativeRefreshCoordinator

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "externaldrive.badge.timemachine")
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text("Cached")
                    .font(.caption.bold())
                Text(lastSuccessText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(10)
        .background(Color.orange.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityLabel("Cached snapshot. \(lastSuccessText)")
    }

    private var lastSuccessText: String {
        if let last = session.lastSuccessfulRefresh {
            return "Mac unavailable. Last success \(last.formatted(date: .abbreviated, time: .shortened)). Never treated as live."
        }
        return "Mac unavailable. Showing the last stored snapshot. Never treated as live."
    }
}

struct NativeStatusChip: View {
    let state: String

    var body: some View {
        Text(FreshnessLabel.displayName(for: state))
            .font(.caption2.bold())
            .foregroundStyle(FreshnessLabel.color(for: state))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(FreshnessLabel.color(for: state).opacity(0.14))
            .clipShape(Capsule())
            .accessibilityLabel(FreshnessLabel.displayName(for: state))
    }
}

struct NativeRefreshProgressView: View {
    @ObservedObject var session: NativeRefreshCoordinator

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "desktopcomputer")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Color.accentColor)
            Text("Stratji")
                .font(.title3.bold())
            Text("Refreshing Mac data plane")
                .font(.headline)
            Text(session.stage.title)
                .font(.subheadline)
            Text(session.stage.detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            ProgressView(value: session.progress)
                .progressViewStyle(.linear)
                .frame(maxWidth: 320)
                .animation(.easeInOut(duration: 0.55), value: session.progress)
                .accessibilityLabel("Refresh progress")
                .accessibilityValue("\(Int(session.progress * 100)) percent")
            Text("\(Int((session.progress * 100).rounded()))% · \(session.stage.title)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(RefreshStage.allCases.filter { $0 != .idle }, id: \.self) { stage in
                        let isCurrent = session.stage == stage
                        let isFailed = session.failedStages.contains(stage)
                        Text(stage.title)
                            .font(.caption2.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .foregroundStyle(isFailed ? Color.orange : Color.primary)
                            .background(isCurrent ? Color.accentColor.opacity(0.28) : Color.secondary.opacity(0.12))
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 12)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.07))
    }
}

struct NativeOfflineScreen: View {
    let message: String
    let lastSuccessfulLoad: Date?
    let hasCachedSnapshot: Bool
    let retry: () -> Void
    let viewLastSnapshot: () -> Void
    let settings: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "network.slash")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(.orange)
            Text("Mac data plane unavailable")
                .font(.title3.bold())
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let lastSuccessfulLoad {
                Text("Last success \(lastSuccessfulLoad.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("No successful refresh on this iPhone yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 10) {
                Button("Settings", action: settings)
                    .buttonStyle(.bordered)
                if hasCachedSnapshot {
                    Button("View last snapshot", action: viewLastSnapshot)
                        .buttonStyle(.bordered)
                }
                Button("Try again", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.07))
    }
}
