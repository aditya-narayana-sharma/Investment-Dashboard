import SwiftUI

#if os(iOS)
import UIKit
#endif

struct NativeDashboardHeader: View {
    @ObservedObject var browser: PortfolioDashboardBrowserModel
    @ObservedObject var statusModel: DashboardStatusModel
#if os(iOS)
    @ObservedObject var healthSync: HealthKitSyncCoordinator
#endif
    let refresh: () -> Void
    let report: () -> Void
    let settings: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(Color.accentColor)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 1) {
                    Text("Portfolio Intelligence")
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Circle()
                            .fill(statusModel.connection.color)
                            .frame(width: 6, height: 6)
                        Text(statusModel.connection.label)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 4)

                HeaderAction(title: "Refresh dashboard", systemImage: "arrow.clockwise", action: refresh)
                HeaderAction(title: "Prepare report", systemImage: "square.and.arrow.up", action: report)
                HeaderAction(title: "Connection and Health settings", systemImage: "gearshape", action: settings)
            }

#if os(iOS)
            HStack(spacing: 8) {
                Image(systemName: healthSync.isSyncing ? "arrow.triangle.2.circlepath" : "heart.fill")
                    .foregroundStyle(healthSync.isSyncing ? .orange : .pink)
                Text(healthSync.status)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
            }
#endif
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }
}

private struct HeaderAction: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

struct NativeWorkspacePicker: View {
    @Binding var selection: DashboardWorkspace

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(DashboardWorkspace.allCases) { workspace in
                    Button {
                        selection = workspace
                    } label: {
                        Label(workspace.title, systemImage: workspace.systemImage)
                            .font(.caption.bold())
                            .padding(.horizontal, 10)
                            .padding(.vertical, 9)
                            .fixedSize(horizontal: true, vertical: false)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(selection == workspace ? Color.white : Color.secondary)
                    .background(selection == workspace ? Color.accentColor : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .accessibilityAddTraits(selection == workspace ? .isSelected : [])
                }
            }
        }
        .padding(6)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 11))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
    }
}

struct DashboardAuditFreshnessStrip: View {
    @ObservedObject var session: NativeRefreshCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: session.audit?.isCurrent == false ? "exclamationmark.shield.fill" : "checkmark.shield.fill")
                    .foregroundStyle(session.audit?.isCurrent == false ? .orange : session.connection.color)

                VStack(alignment: .leading, spacing: 1) {
                    Text(statusTitle)
                        .font(.caption.bold())
                        .lineLimit(1)
                    Text(statusDetail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer(minLength: 4)

                if let failures = session.audit?.failures, failures > 0 {
                    Text("\(failures) source\(failures == 1 ? "" : "s")")
                        .font(.caption2.bold())
                        .foregroundStyle(.orange)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.14))
                        .clipShape(Capsule())
                }
            }

            if let sources = session.refresh?.sources, !sources.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(sources) { source in
                            HStack(spacing: 4) {
                                Text(source.source)
                                Text(source.displayState)
                                    .bold()
                                    .foregroundStyle(FreshnessLabel.color(for: source.state))
                            }
                            .font(.caption2)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 4)
                            .background(Color.primary.opacity(0.06))
                            .clipShape(Capsule())
                            .accessibilityLabel("\(source.source) \(source.displayState)")
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color.primary.opacity(0.04))
        .accessibilityElement(children: .contain)
    }

    private var statusTitle: String {
        if session.viewingCachedSnapshot {
            return "Cached Mac snapshot"
        }
        if let audit = session.audit {
            return audit.isCurrent ? "Complete startup audit passed" : "Startup audit needs attention"
        }
        return session.connection.label
    }

    private var statusDetail: String {
        if session.viewingCachedSnapshot {
            if let last = session.lastSuccessfulRefresh {
                return "Last success \(last.formatted(date: .abbreviated, time: .shortened)). Not live."
            }
            return "Showing the last stored snapshot. Not live."
        }
        if let audit = session.audit {
            return audit.message
        }
        switch session.connection {
        case .degraded(let message), .offline(let message):
            return message
        default:
            return "Checking Kite, Mail, Podcasts, earnings, sectors, and the Health operational day."
        }
    }
}

struct DashboardSettingsView: View {
    @Binding var serverAddress: String
    @ObservedObject var statusModel: DashboardStatusModel
    @ObservedObject var pairing: HealthPairingModel
    @ObservedObject var session: NativeRefreshCoordinator
    @EnvironmentObject private var auth: AuthenticationService
    let openDashboard: () -> Void
    var openIntegrations: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var draftAddress: String
    @State private var pairingCode = ""

    init(
        serverAddress: Binding<String>,
        statusModel: DashboardStatusModel,
        pairing: HealthPairingModel,
        session: NativeRefreshCoordinator,
        openDashboard: @escaping () -> Void,
        openIntegrations: (() -> Void)? = nil
    ) {
        _serverAddress = serverAddress
        self.statusModel = statusModel
        self.pairing = pairing
        self.session = session
        self.openDashboard = openDashboard
        self.openIntegrations = openIntegrations
        _draftAddress = State(initialValue: serverAddress.wrappedValue)
    }

    private var normalizedURL: URL? {
        PortfolioDashboardConfiguration.normalizedServerURL(from: draftAddress)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Author") {
                    if let email = auth.authorEmail {
                        Label(email, systemImage: "person.crop.circle")
                    } else {
                        Text("Signed in with Auth0 Universal Login.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Button("Log out", role: .destructive) {
                        Task {
                            if let normalizedURL {
                                await auth.clearWebSession(baseURL: normalizedURL)
                            }
                            await auth.logout()
                            dismiss()
                        }
                    }
                }

                Section("Private Mac dashboard") {
                    TextField("http://192.168.1.10:5050/", text: $draftAddress)
                        .textContentType(.URL)
                        .dashboardDisablesAutocapitalization()
                        .autocorrectionDisabled()

                    if let normalizedURL {
                        Label(normalizedURL.absoluteString, systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.green)
                        Button("Test connection") {
                            Task { await statusModel.check(baseURL: normalizedURL) }
                        }
                    } else {
                        Label("Enter the Mac LAN address from npm run remote, or pick a discovered Mac during onboarding.", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }

                Section("Private access") {
                    Label("Keep the Mac awake with Stratji running on the same Wi-Fi.", systemImage: "desktopcomputer")
                    Label("Pair this iPhone with npm run iphone:pair before private data loads.", systemImage: "lock.shield")
                    Label("Bonjour finds Stratji automatically. Tailscale is not required.", systemImage: "network")
                }

#if os(iOS)
                Section("HealthKit pairing") {
                    Text(pairing.message)
                        .font(.caption)
                        .foregroundStyle(pairing.isPaired ? .green : .secondary)
                    if pairing.isPaired {
                        Button("Remove Health pairing", role: .destructive) {
                            guard let normalizedURL else { return }
                            Task { _ = await pairing.unpair(baseURL: normalizedURL) }
                        }
                    } else {
                        TextField("Pairing code from Mac", text: $pairingCode)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        Button(pairing.isPairing ? "Pairing…" : "Pair HealthKit") {
                            guard let normalizedURL else { return }
                            Task { _ = await pairing.pair(baseURL: normalizedURL, code: pairingCode) }
                        }
                        .disabled(pairing.isPairing || pairingCode.trimmingCharacters(in: .whitespacesAndNewlines).count < 6)
                    }
                    Text("On the Mac run npm run iphone:pair. The code expires after five minutes.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
#endif
                Section("Integrations") {
                    Text("The Integrations page is Settings, not a seventh workspace.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let openIntegrations {
                        Button("Open Integrations") {
                            openIntegrations()
                        }
                    }
                    if let pipelines = session.integrations?.pipelines, !pipelines.isEmpty {
                        ForEach(pipelines.keys.sorted(), id: \.self) { key in
                            if let pipeline = pipelines[key] {
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(key.replacingOccurrences(of: "_", with: " ").capitalized)
                                            .font(.subheadline.bold())
                                        Spacer()
                                        NativeStatusChip(state: pipeline.status)
                                    }
                                    Text(pipeline.notes)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    if let last = pipeline.lastValidated {
                                        Text("Last validated \(last)")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    } else {
                        Text("Integrations appear after a successful Mac refresh.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Debug") {
                    Button("Inspect data plane") {
                        dismiss()
                        openDashboard()
                    }
                    Text("Full-screen sheet of the same Mac workspace already shown after the native loading bar.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Connection & Health")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let normalizedURL else { return }
                        serverAddress = normalizedURL.absoluteString
                        dismiss()
                    }
                    .disabled(normalizedURL == nil)
                }
            }
        }
#if os(macOS)
        .frame(minWidth: 500, minHeight: 520)
#endif
    }
}

struct DashboardOnboardingView: View {
    @Binding var serverAddress: String
    @Binding var isComplete: Bool
    @ObservedObject var statusModel: DashboardStatusModel
    @ObservedObject var pairing: HealthPairingModel
    @StateObject private var discovery = NativeMacDiscovery()
    @State private var draftAddress: String
    @State private var pairingCode = ""
    @State private var step = 0

    init(
        serverAddress: Binding<String>,
        isComplete: Binding<Bool>,
        statusModel: DashboardStatusModel,
        pairing: HealthPairingModel
    ) {
        _serverAddress = serverAddress
        _isComplete = isComplete
        self.statusModel = statusModel
        self.pairing = pairing
        _draftAddress = State(initialValue: serverAddress.wrappedValue)
    }

    private var normalizedURL: URL? {
        PortfolioDashboardConfiguration.normalizedServerURL(from: draftAddress)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: stepImage)
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
                Text(stepTitle)
                    .font(.title2.bold())
                    .multilineTextAlignment(.center)
                Text(stepBody)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 520)

                stepContent
                    .frame(maxWidth: 520)

                Spacer()

                HStack {
                    if step > 0 {
                        Button("Back") { step -= 1 }
                            .buttonStyle(.bordered)
                    }
                    Spacer()
                    Button(step == 2 ? "Open Stratji" : "Continue") {
                        advance()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canAdvance)
                }
            }
            .padding(24)
            .navigationTitle("Set up Portfolio Intelligence")
            .onAppear { discovery.start() }
            .onDisappear { discovery.stop() }
        }
        .interactiveDismissDisabled()
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0:
            VStack(spacing: 12) {
                Label("Native workspaces: Portfolio, Sectors, Intel, Health, Builder, Strategies", systemImage: "rectangle.3.group.fill")
                Label("Kite and Apple-source secrets stay on your Mac", systemImage: "lock.shield.fill")
                Label("Same Wi-Fi as the Mac. No Tailscale.", systemImage: "wifi")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case 1:
            VStack(alignment: .leading, spacing: 12) {
                Text(discovery.status)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if discovery.endpoints.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    ForEach(discovery.endpoints) { endpoint in
                        Button {
                            draftAddress = endpoint.url.absoluteString
                            Task { await statusModel.check(baseURL: endpoint.url) }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(endpoint.name)
                                        .font(.subheadline.bold())
                                    Text(endpoint.url.absoluteString)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if draftAddress == endpoint.url.absoluteString {
                                    Image(systemName: "checkmark.circle.fill")
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                TextField("http://192.168.1.10:5050/", text: $draftAddress)
                    .textFieldStyle(.roundedBorder)
                    .dashboardDisablesAutocapitalization()
                    .autocorrectionDisabled()
                HStack {
                    Button("Find Macs") { discovery.start() }
                    Button("Test Mac connection") {
                        guard let normalizedURL else { return }
                        Task { await statusModel.check(baseURL: normalizedURL) }
                    }
                }
                .buttonStyle(.bordered)
                if case .online = statusModel.connection {
                    Label("Mac dashboard is healthy", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Text(statusModel.connection.label)
                        .font(.caption)
                        .foregroundStyle(statusModel.connection.color)
                }
            }
        default:
#if os(iOS)
            VStack(spacing: 12) {
                if pairing.isPaired {
                    Label("HealthKit upload is paired", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    TextField("Pairing code shown on Mac", text: $pairingCode)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button(pairing.isPairing ? "Pairing…" : "Pair HealthKit") {
                        guard let normalizedURL else { return }
                        Task { _ = await pairing.pair(baseURL: normalizedURL, code: pairingCode) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(pairing.isPairing || pairingCode.count < 6)
                    Text(pairing.message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
#else
            Label("HealthKit pairing is completed on iPhone.", systemImage: "iphone")
#endif
        }
    }

    private var stepTitle: String {
        switch step {
        case 0: "Your private Stratji client"
        case 1: "Connect to the Mac"
        default: "Pair HealthKit"
        }
    }

    private var stepBody: String {
        switch step {
        case 0:
            "This iPhone is a native Stratji client. The Mac stays the data plane. After pairing, each tab renders Portfolio, Sectors, Market Intelligence, Health, Algorithm Builder, and Strategies from JSON — not a Tailscale browser."
        case 1:
            "Run npm run remote on the Mac, stay on the same Wi-Fi, then pick the discovered Stratji Mac or enter its LAN address."
        default:
            "Generate a short-lived pairing code on the Mac with npm run iphone:pair. The resulting credential is stored only in this iPhone's Keychain and is required for LAN access."
        }
    }

    private var stepImage: String {
        switch step {
        case 0: "chart.line.uptrend.xyaxis"
        case 1: "wifi"
        default: "heart.text.square.fill"
        }
    }

    private var canAdvance: Bool {
        switch step {
        case 0:
            return true
        case 1:
            if case .online = statusModel.connection { return normalizedURL != nil }
            return false
        default:
#if os(iOS)
            return pairing.isPaired
#else
            return true
#endif
        }
    }

    private func advance() {
        if step < 2 {
            step += 1
            return
        }
        guard let normalizedURL else { return }
        serverAddress = normalizedURL.absoluteString
        isComplete = true
    }
}

private extension View {
    @ViewBuilder
    func dashboardDisablesAutocapitalization() -> some View {
#if os(iOS)
        textInputAutocapitalization(.never)
#else
        self
#endif
    }
}

#if os(iOS)
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif
