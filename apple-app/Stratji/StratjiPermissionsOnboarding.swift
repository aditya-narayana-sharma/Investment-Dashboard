import AppKit
import SwiftUI

struct StratjiPermissionsOnboardingView: View {
    var onConnect: (StratjiAppleSource) async -> Void
    var onDismiss: () -> Void

    @State private var rows: [StratjiApplePermissionState] = StratjiApplePermissions.snapshot()
    @State private var busySource: StratjiAppleSource?
    @State private var message = ""
    @AppStorage(StratjiAppearanceStore.defaultsKey) private var appearanceRaw = StratjiAppearanceStore.defaultValue

    private var appearance: StratjiAppearance {
        StratjiAppearance(rawValue: appearanceRaw) ?? .black
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(rows.filter(\.source.isFirstRunRequired)) { row in
                        permissionRow(row)
                    }
                    ForEach(rows.filter { !$0.source.isFirstRunRequired }) { row in
                        permissionRow(row)
                    }
                }
                .padding(16)
            }
            if !message.isEmpty {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }
            Divider()
            HStack {
                Button("Not now") {
                    StratjiApplePermissions.markOnboardingPresented()
                    onDismiss()
                }
                Spacer()
                Button("Continue") {
                    StratjiApplePermissions.markOnboardingPresented()
                    onDismiss()
                }
                .buttonStyle(.borderedProminent)
                .disabled(busySource != nil)
            }
            .padding(16)
        }
        .frame(minWidth: 560, minHeight: 520)
        .background(appearance.canvasFill)
        .foregroundStyle(appearance.canvasInk)
        .preferredColorScheme(appearance.colorScheme)
        .environment(\.colorScheme, appearance.colorScheme)
        .onAppear {
            rows = StratjiApplePermissions.snapshot()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Grant Apple permissions")
                .font(.title2.bold())
            Text("Stratji reads Mail, Calendar, Reminders, and Podcasts on this Mac to keep Market Intelligence current. Connect asks macOS for access. You can use the dashboard without granting everything now.")
                .font(.callout)
                .foregroundStyle(.secondary)
            Text("Mail uses only iCloud → Newsletters and iCloud → Axis Research. Reminders uses Job 🔍 and Earnings. Calendar is scheduling evidence, not published-results proof. Notes is optional and is never a Health source. Speech / Mic is optional Satya push-to-talk on this Mac only.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
    }

    private func permissionRow(_ row: StratjiApplePermissionState) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(row.source.title)
                    .font(.headline)
                Spacer()
                Text(row.status.label)
                    .font(.caption.weight(.heavy).monospaced())
                    .textCase(.uppercase)
                    .foregroundStyle(color(for: row.status))
            }
            Text(row.notes)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Button(busySource == row.source ? "Asking…" : "Connect") {
                    Task { await connect(row.source) }
                }
                .disabled(busySource != nil)
                if row.status == .denied {
                    Button("Open Privacy Settings") {
                        StratjiApplePermissions.openPrivacySettings(for: row.source)
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(white: 0.08))
        .overlay(Rectangle().stroke(Color(white: 0.22), lineWidth: 2))
    }

    private func color(for status: StratjiApplePermissionStatus) -> Color {
        switch status {
        case .connected: Color.green
        case .permissionRequired: Color.yellow
        case .denied: Color.red
        }
    }

    private func connect(_ source: StratjiAppleSource) async {
        busySource = source
        defer { busySource = nil }
        await onConnect(source)
        rows = StratjiApplePermissions.snapshot()
        let latest = rows.first { $0.source == source }
        switch latest?.status {
        case .connected:
            message = "\(source.title) connected. Stratji will refresh that source the same way it does today."
        case .denied:
            message = "\(source.title) was denied. Open Privacy Settings to allow Stratji, then Connect again."
        default:
            message = "macOS did not grant \(source.title) yet. Use Connect to ask again, or Not now to keep using the dashboard."
        }
    }
}

enum StratjiPermissionsOnboardingPresenter {
    private static var sheetWindow: NSWindow?

    @MainActor
    static func presentIfNeeded(session: StratjiSessionModel, on parent: NSWindow?) {
        guard StratjiApplePermissions.shouldPresentOnboarding(), sheetWindow == nil, let parent else { return }
        let hosting = NSHostingController(
            rootView: StratjiPermissionsOnboardingView(
                onConnect: { source in
                    await StratjiApplePermissionActions.connect(source, session: session)
                },
                onDismiss: {
                    StratjiApplePermissions.markOnboardingPresented()
                    dismiss(from: parent)
                }
            )
        )
        let window = NSWindow(contentViewController: hosting)
        window.title = "Apple permissions"
        window.styleMask = [.titled, .closable]
        window.setContentSize(NSSize(width: 580, height: 560))
        window.isReleasedWhenClosed = false
        sheetWindow = window
        parent.beginSheet(window) { _ in
            StratjiApplePermissions.markOnboardingPresented()
            sheetWindow = nil
        }
    }

    @MainActor
    private static func dismiss(from parent: NSWindow) {
        if let sheetWindow {
            parent.endSheet(sheetWindow)
            sheetWindow.close()
        }
        sheetWindow = nil
    }
}
