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
    var integrations: (() -> Void)? = nil

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
                if let integrations {
                    HeaderAction(title: "Integrations", systemImage: "cable.connector", action: integrations)
                }
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
        HStack(spacing: 6) {
            ForEach(DashboardWorkspace.allCases) { workspace in
                Button {
                    selection = workspace
                } label: {
                    Label(workspace.title, systemImage: workspace.systemImage)
                        .font(.caption.bold())
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(selection == workspace ? Color.white : Color.secondary)
                .background(selection == workspace ? Color.accentColor : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .accessibilityAddTraits(selection == workspace ? .isSelected : [])
            }
        }
        .padding(6)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 11))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
    }
}

struct NativeFreshnessStrip: View {
    @ObservedObject var model: DashboardStatusModel

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: model.audit?.isCurrent == false ? "exclamationmark.shield.fill" : "checkmark.shield.fill")
                .foregroundStyle(model.audit?.isCurrent == false ? .orange : model.connection.color)

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

            if let failures = model.audit?.failures, failures > 0 {
                Text("\(failures) source\(failures == 1 ? "" : "s")")
                    .font(.caption2.bold())
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.14))
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color.primary.opacity(0.04))
        .accessibilityElement(children: .combine)
    }

    private var statusTitle: String {
        if let audit = model.audit {
            return audit.isCurrent ? "Complete startup audit passed" : "Startup audit needs attention"
        }
        return model.connection.label
    }

    private var statusDetail: String {
        if let audit = model.audit {
            return audit.message
        }
        switch model.connection {
        case .degraded(let message), .offline(let message):
            return message
        default:
            return "Checking Kite, Mail, Podcasts, earnings, sectors, and the Health operational day."
        }
    }
}

struct DashboardOfflineOverlay: View {
    let message: String
    let hasLastLoadedDashboard: Bool
    let lastSuccessfulLoad: Date?
    let retry: () -> Void
    let continueOffline: () -> Void
    let settings: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "network.slash")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(.orange)
            Text("Mac dashboard unavailable")
                .font(.title3.bold())
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let lastSuccessfulLoad {
                Text("Last loaded \(lastSuccessfulLoad.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 10) {
                Button("Settings", action: settings)
                    .buttonStyle(.bordered)
                if hasLastLoadedDashboard {
                    Button("View last loaded", action: continueOffline)
                        .buttonStyle(.bordered)
                }
                Button("Try again", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(maxWidth: 460)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.secondary.opacity(0.25), lineWidth: 1)
        }
        .padding(20)
    }
}

struct DashboardSettingsView: View {
    @Binding var serverAddress: String
    @ObservedObject var statusModel: DashboardStatusModel
    @ObservedObject var pairing: HealthPairingModel
    var onOpenIntegrations: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var draftAddress: String
    @State private var pairingCode = ""

    init(
        serverAddress: Binding<String>,
        statusModel: DashboardStatusModel,
        pairing: HealthPairingModel
    ) {
        _serverAddress = serverAddress
        self.statusModel = statusModel
        self.pairing = pairing
        _draftAddress = State(initialValue: serverAddress.wrappedValue)
    }

    private var normalizedURL: URL? {
        PortfolioDashboardConfiguration.normalizedServerURL(from: draftAddress)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Private Mac dashboard") {
                    TextField("https://your-mac.tailnet.ts.net/", text: $draftAddress)
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
                        Label("Enter a valid HTTP or HTTPS address.", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }

                Section("Private access") {
                    Label("Keep the Mac awake with Portfolio Intelligence running.", systemImage: "desktopcomputer")
                    Label("Use the same Tailscale account on this iPhone and Mac.", systemImage: "lock.shield")
                    Label("Tailscale HTTPS is preferred; LAN is a fallback.", systemImage: "network")
                    Button("Open Integrations workspace") {
                        onOpenIntegrations?()
                        dismiss()
                    }
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
                }
#endif
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
                    Button(step == 2 ? "Open dashboard" : "Continue") {
                        advance()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canAdvance)
                }
            }
            .padding(24)
            .navigationTitle("Set up Portfolio Intelligence")
        }
        .interactiveDismissDisabled()
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0:
            VStack(spacing: 12) {
                Label("Investment, Sectoral Analytics, and Health", systemImage: "rectangle.3.group.fill")
                Label("Kite and Apple-source secrets stay on your Mac", systemImage: "lock.shield.fill")
                Label("The Mac must stay awake and connected", systemImage: "desktopcomputer")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case 1:
            VStack(spacing: 12) {
                TextField("https://your-mac.tailnet.ts.net/", text: $draftAddress)
                    .textFieldStyle(.roundedBorder)
                    .dashboardDisablesAutocapitalization()
                    .autocorrectionDisabled()
                Button("Test Mac connection") {
                    guard let normalizedURL else { return }
                    Task { await statusModel.check(baseURL: normalizedURL) }
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
        case 0: "Your private dashboard on iPhone"
        case 1: "Connect to the Mac"
        default: "Pair HealthKit"
        }
    }

    private var stepBody: String {
        switch step {
        case 0:
            "The app provides the complete live dashboard while keeping brokerage and Apple content access on your Mac."
        case 1:
            "Enter the Tailscale HTTPS address for the Mac running Portfolio Intelligence, then verify the gateway."
        default:
            "Generate a short-lived pairing code on the Mac. The resulting upload credential is stored only in this iPhone's Keychain."
        }
    }

    private var stepImage: String {
        switch step {
        case 0: "chart.line.uptrend.xyaxis"
        case 1: "lock.icloud.fill"
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
