import ApplicationServices
import AppKit
import AVFoundation
import EventKit
import Foundation
import Speech

enum StratjiAppleSource: String, CaseIterable, Identifiable {
    case mail
    case calendars
    case reminders
    case podcasts
    case notes
    case speech

    var id: String { rawValue }

    var title: String {
        switch self {
        case .mail: "Mail"
        case .calendars: "Calendar"
        case .reminders: "Reminders"
        case .podcasts: "Podcasts"
        case .notes: "Notes"
        case .speech: "Speech / Mic"
        }
    }

    var isFirstRunRequired: Bool {
        switch self {
        case .mail, .calendars, .reminders, .podcasts: true
        case .notes, .speech: false
        }
    }

    var tcc: StratjiAppleTCC {
        switch self {
        case .calendars: .eventKitCalendars
        case .reminders: .eventKitReminders
        case .mail, .podcasts, .notes: .appleEvents
        case .speech: .speechMicrophone
        }
    }

    var detail: String {
        switch self {
        case .mail:
            "Only iCloud → Newsletters and iCloud → Axis Research. Connect asks macOS to let Stratji control Mail."
        case .calendars:
            "EventKit full calendar access. Earnings and other events are scheduling evidence, not published-results proof."
        case .reminders:
            "EventKit full access for Job 🔍 and Earnings. Incomplete stay actionable; completed are evidence only."
        case .podcasts:
            "Connect asks macOS to let Stratji control Apple Podcasts. Eligible episodes then refresh through the existing digest pipeline. Transcript is labelled only when a local transcript exists."
        case .notes:
            "Optional research notes. Never a Health source — Health stays HealthKit / export / Health Shortcut."
        case .speech:
            "Optional Satya push-to-talk. Microphone + speech recognition on this Mac only. No wake word. Mailboxes stay iCloud → Newsletters and iCloud → Axis Research."
        }
    }

    var bundleIdentifiers: [String] {
        switch self {
        case .mail: ["com.apple.mail"]
        case .calendars: []
        case .reminders: []
        case .podcasts: ["com.apple.podcasts"]
        case .notes: ["com.apple.Notes"]
        case .speech: []
        }
    }

    /// Mail and Notes are scriptable; the probe can show the Automation sheet.
    /// Podcasts.app is not AppleScript-enabled — a tell-application probe only launches it.
    var usesAppleScriptProbe: Bool {
        switch self {
        case .mail, .notes: true
        case .podcasts, .calendars, .reminders, .speech: false
        }
    }

    init?(rawSource: String) {
        self.init(rawValue: rawSource)
    }
}

enum StratjiApplePermissionStatus: String {
    case connected
    case permissionRequired = "permission_required"
    case denied

    var label: String {
        switch self {
        case .connected: "Connected"
        case .permissionRequired: "Permission required"
        case .denied: "Denied"
        }
    }
}

enum StratjiAppleTCC: String {
    case eventKitCalendars = "eventkit-calendars"
    case eventKitReminders = "eventkit-reminders"
    case appleEvents = "apple-events"
    case speechMicrophone = "speech-microphone"
}

struct StratjiApplePermissionState: Equatable, Identifiable {
    var source: StratjiAppleSource
    var status: StratjiApplePermissionStatus
    var tcc: StratjiAppleTCC
    var lastChecked: Date?
    var notes: String

    var id: String { source.rawValue }

    var dto: ApplePermissionDTO {
        ApplePermissionDTO(
            status: status.rawValue,
            tcc: tcc.rawValue,
            lastChecked: lastChecked.map { ISO8601DateFormatter().string(from: $0) },
            notes: notes
        )
    }
}

enum StratjiApplePermissions {
    private static let onboardingKey = "stratji.applePermissions.sheetPresented"
    private static let errAEEventWouldRequireUserConsent: OSStatus = -1744
    private static let errAEEventNotPermittedStatus: OSStatus = -1743

    static func shouldPresentOnboarding() -> Bool {
        if UserDefaults.standard.bool(forKey: onboardingKey) { return false }
        return snapshot().contains { $0.source.isFirstRunRequired && $0.status != .connected }
    }

    static func markOnboardingPresented() {
        UserDefaults.standard.set(true, forKey: onboardingKey)
    }

    static func snapshot() -> [StratjiApplePermissionState] {
        StratjiAppleSource.allCases.map { source in
            makeState(source: source, status: currentStatus(for: source))
        }
    }

    static func request(_ source: StratjiAppleSource) async -> StratjiApplePermissionState {
        switch source {
        case .calendars:
            return await requestEventKit(.event, source: source)
        case .reminders:
            return await requestEventKit(.reminder, source: source)
        case .mail, .podcasts, .notes:
            return await requestAppleEvents(source)
        case .speech:
            return await requestSpeech(source)
        }
    }

    static func openPrivacySettings(for source: StratjiAppleSource) {
        let queries: [String]
        switch source {
        case .calendars:
            queries = [
                "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Calendars",
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars",
            ]
        case .reminders:
            queries = [
                "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Reminders",
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders",
            ]
        case .mail, .podcasts, .notes:
            queries = [
                "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation",
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
            ]
        case .speech:
            queries = [
                "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_SpeechRecognition",
                "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
                "x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition",
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
            ]
        }
        for value in queries {
            if let url = URL(string: value) {
                NSWorkspace.shared.open(url)
                return
            }
        }
    }

    static func dtoMap(_ rows: [StratjiApplePermissionState]) -> [String: ApplePermissionDTO] {
        Dictionary(uniqueKeysWithValues: rows.map { ($0.source.rawValue, $0.dto) })
    }

    private static func makeState(source: StratjiAppleSource, status: StratjiApplePermissionStatus) -> StratjiApplePermissionState {
        StratjiApplePermissionState(
            source: source,
            status: status,
            tcc: source.tcc,
            lastChecked: Date(),
            notes: source.detail
        )
    }

    private static func currentStatus(for source: StratjiAppleSource) -> StratjiApplePermissionStatus {
        switch source {
        case .calendars:
            return mapEventKit(EKEventStore.authorizationStatus(for: .event))
        case .reminders:
            return mapEventKit(EKEventStore.authorizationStatus(for: .reminder))
        case .mail, .podcasts, .notes:
            guard let bundleID = source.bundleIdentifiers.first else { return .permissionRequired }
            return determineAutomation(bundleID: bundleID, prompt: false)
        case .speech:
            return mapSpeechStatus()
        }
    }

    /// Used by Satya push-to-talk so listen can request TCC without opening Settings.
    static func ensureSpeechAccess() async -> Bool {
        let state = await requestSpeech(.speech)
        return state.status == .connected
    }

    private static func mapSpeechStatus() -> StratjiApplePermissionStatus {
        let speech = SFSpeechRecognizer.authorizationStatus()
        let mic = AVCaptureDevice.authorizationStatus(for: .audio)
        if speech == .authorized && mic == .authorized {
            return .connected
        }
        if speech == .denied || speech == .restricted || mic == .denied || mic == .restricted {
            return .denied
        }
        return .permissionRequired
    }

    private static func requestSpeech(_ source: StratjiAppleSource) async -> StratjiApplePermissionState {
        if mapSpeechStatus() == .connected {
            return makeState(source: source, status: .connected)
        }
        let speechGranted: Bool = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
        let micGranted: Bool = await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted)
            }
        }
        let status: StratjiApplePermissionStatus
        if speechGranted && micGranted {
            status = .connected
        } else {
            status = mapSpeechStatus()
        }
        return makeState(source: source, status: status)
    }

    private static func requestEventKit(_ entity: EKEntityType, source: StratjiAppleSource) async -> StratjiApplePermissionState {
        if mapEventKit(EKEventStore.authorizationStatus(for: entity)) == .connected {
            return makeState(source: source, status: .connected)
        }
        let granted: Bool = await withCheckedContinuation { continuation in
            Task { @MainActor in
                let store = EKEventStore()
                switch entity {
                case .event:
                    store.requestFullAccessToEvents { ok, _ in
                        continuation.resume(returning: ok)
                    }
                case .reminder:
                    store.requestFullAccessToReminders { ok, _ in
                        continuation.resume(returning: ok)
                    }
                @unknown default:
                    continuation.resume(returning: false)
                }
            }
        }
        let status: StratjiApplePermissionStatus = granted
            ? .connected
            : mapEventKit(EKEventStore.authorizationStatus(for: entity))
        return makeState(source: source, status: status)
    }

    private static func requestAppleEvents(_ source: StratjiAppleSource) async -> StratjiApplePermissionState {
        guard let bundleID = source.bundleIdentifiers.first else {
            return makeState(source: source, status: .permissionRequired)
        }

        let existing = await MainActor.run { lookupAutomation(bundleID: bundleID, prompt: false) }
        switch existing {
        case .connected:
            return makeState(source: source, status: .connected)
        case .denied:
            return makeState(source: source, status: .denied)
        case .needsPrompt, .targetNotRunning, .unknown:
            break
        }

        // Prefer the Automation TCC sheet. Do not open the target app first.
        // Podcasts.app is not scriptable; an AppleScript tell only launched it.
        var lookup = await MainActor.run { lookupAutomation(bundleID: bundleID, prompt: true) }
        if lookup == .targetNotRunning {
            await ensureRunningHidden(bundleID: bundleID)
            lookup = await MainActor.run { lookupAutomation(bundleID: bundleID, prompt: true) }
        }

        switch lookup {
        case .connected:
            return makeState(source: source, status: .connected)
        case .denied:
            return makeState(source: source, status: .denied)
        case .needsPrompt, .targetNotRunning, .unknown:
            break
        }

        if source.usesAppleScriptProbe {
            let probed: StratjiApplePermissionStatus = await MainActor.run {
                runProbeScript(for: source)
            }
            return makeState(source: source, status: probed)
        }

        return makeState(source: source, status: mapAutomation(lookup))
    }

    private static func mapEventKit(_ status: EKAuthorizationStatus) -> StratjiApplePermissionStatus {
        switch status {
        case .fullAccess:
            return .connected
        case .denied, .restricted:
            return .denied
        case .notDetermined, .writeOnly:
            return .permissionRequired
        @unknown default:
            return .permissionRequired
        }
    }

    private enum AutomationLookup {
        case connected
        case denied
        case needsPrompt
        case targetNotRunning
        case unknown
    }

    private static func determineAutomation(bundleID: String, prompt: Bool) -> StratjiApplePermissionStatus {
        mapAutomation(lookupAutomation(bundleID: bundleID, prompt: prompt))
    }

    private static func mapAutomation(_ lookup: AutomationLookup) -> StratjiApplePermissionStatus {
        switch lookup {
        case .connected:
            return .connected
        case .denied:
            return .denied
        case .needsPrompt, .targetNotRunning, .unknown:
            return .permissionRequired
        }
    }

    private static func lookupAutomation(bundleID: String, prompt: Bool) -> AutomationLookup {
        let target = NSAppleEventDescriptor(bundleIdentifier: bundleID)
        let status = AEDeterminePermissionToAutomateTarget(
            target.aeDesc,
            typeWildCard,
            typeWildCard,
            prompt
        )
        switch status {
        case noErr:
            return .connected
        case errAEEventNotPermittedStatus:
            return .denied
        case errAEEventWouldRequireUserConsent:
            return .needsPrompt
        case OSStatus(procNotFound):
            return .targetNotRunning
        default:
            return .unknown
        }
    }

    private static func runProbeScript(for source: StratjiAppleSource) -> StratjiApplePermissionStatus {
        let sourceText: String
        switch source {
        case .mail:
            sourceText = """
            tell application "Mail"
              get name of every account
            end tell
            """
        case .notes:
            sourceText = """
            tell application "Notes"
              get name of first account
            end tell
            """
        case .podcasts, .calendars, .reminders, .speech:
            return .permissionRequired
        }
        var error: NSDictionary?
        let script = NSAppleScript(source: sourceText)
        _ = script?.executeAndReturnError(&error)
        if let error {
            let number = error[NSAppleScript.errorNumber] as? Int ?? 0
            if number == Int(errAEEventNotPermittedStatus) || number == -1743 {
                return .denied
            }
            return .permissionRequired
        }
        return .connected
    }

    /// Launch the target only after AEDeterminePermissionToAutomateTarget returned procNotFound.
    /// Hidden + non-activating so Connect is the TCC sheet, not the target app's UI.
    @MainActor
    private static func ensureRunningHidden(bundleID: String) async {
        if NSWorkspace.shared.runningApplications.contains(where: { $0.bundleIdentifier == bundleID }) {
            return
        }
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else { return }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        configuration.hides = true
        configuration.addsToRecentItems = false
        let running = try? await NSWorkspace.shared.openApplication(at: url, configuration: configuration)
        running?.hide()
        try? await Task.sleep(for: .milliseconds(800))
    }
}

enum StratjiApplePermissionActions {
    @MainActor
    static func connect(_ source: StratjiAppleSource, session: StratjiSessionModel) async {
        let state = await StratjiApplePermissions.request(source)
        await persist(session: session)
        guard state.status == .connected else { return }
        switch source {
        case .notes, .speech:
            break
        case .mail, .calendars, .reminders, .podcasts:
            await session.reload(keepDocument: true)
        }
    }

    @MainActor
    static func persist(session: StratjiSessionModel) async {
        let rows = StratjiApplePermissions.snapshot()
        let client = StratjiAPIClient()
        if let saved = try? await client.saveApplePermissions(
            baseURL: session.baseURL,
            permissions: StratjiApplePermissions.dtoMap(rows)
        ) {
            session.integrations = saved
        }
    }
}
