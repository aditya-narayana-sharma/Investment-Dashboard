import Foundation
import WebKit
#if os(macOS)
import AppKit
import Combine
import SwiftUI
#endif

/// Compact citation kinds — same cluster as the web Satya reply (mail / pdf / podcast / earnings).
enum StratjiSatyaDraftCitationKind: String, Equatable, CaseIterable {
    case mail
    case pdf
    case podcast
    case earnings

    var title: String {
        switch self {
        case .mail: "Mail"
        case .pdf: "PDFs"
        case .podcast: "Podcasts"
        case .earnings: "Earnings KPIs"
        }
    }

    var systemImage: String {
        switch self {
        case .mail: "envelope"
        case .pdf: "doc.text"
        case .podcast: "mic"
        case .earnings: "chart.xyaxis.line"
        }
    }
}

struct StratjiSatyaDraftTurn: Equatable {
    var id: String
    var role: String
    var text: String
    var citationKinds: [StratjiSatyaDraftCitationKind]
}

/// Process labels only — never a claim that a source was read or a KPI exists.
enum StratjiSatyaDraftStatus {
    static let phrases = [
        "Thinking…",
        "Going through Research…",
        "Analyzing KPIs…",
        "Reading Axis notes…",
        "Checking earnings prints…",
    ]
    static let interval: TimeInterval = 2.5
    static let reduced = "Thinking…"

    static func phrase(tick: Int, reduceMotion: Bool) -> String {
        if reduceMotion { return reduced }
        let count = phrases.count
        guard count > 0 else { return reduced }
        let index = ((tick % count) + count) % count
        return phrases[index]
    }
}

/// JS posts `{ action, sessionId, drafting, turns }` to `webkit.messageHandlers.satyaDraft`.
struct StratjiSatyaDraftPayload: Equatable {
    var action: String
    var sessionId: String?
    var drafting: Bool
    var turns: [StratjiSatyaDraftTurn]

    static func parse(_ body: Any) -> StratjiSatyaDraftPayload? {
        let record: [String: Any]
        if let object = body as? [String: Any] {
            record = object
        } else if let raw = body as? String,
                  let data = raw.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            record = object
        } else {
            return nil
        }
        let action = String(describing: record["action"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !action.isEmpty else { return nil }
        let sessionId = (record["sessionId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let drafting = boolValue(record["drafting"])
        let turns = (record["turns"] as? [Any] ?? []).compactMap(parseTurn)
        return StratjiSatyaDraftPayload(
            action: action,
            sessionId: sessionId?.isEmpty == false ? sessionId : nil,
            drafting: drafting,
            turns: turns
        )
    }

    static func citationKinds(from citation: [String: Any]) -> [StratjiSatyaDraftCitationKind] {
        let family = (citation["family"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var seen = Set<StratjiSatyaDraftCitationKind>()
        var kinds: [StratjiSatyaDraftCitationKind] = []
        let push = { (kind: StratjiSatyaDraftCitationKind) in
            if seen.insert(kind).inserted {
                kinds.append(kind)
            }
        }
        if !stringValue(citation["messageUrl"]).isEmpty {
            if family == "podcasts" {
                push(.podcast)
            } else if family == "earnings" {
                push(.earnings)
            } else {
                push(.mail)
            }
        }
        if !stringValue(citation["pdfUrl"]).isEmpty {
            push(.pdf)
        }
        if !stringValue(citation["episodeUrl"]).isEmpty {
            push(.podcast)
        }
        if !stringValue(citation["sourceUrl"]).isEmpty {
            push(.earnings)
        }
        return kinds
    }

    private static func parseTurn(_ value: Any) -> StratjiSatyaDraftTurn? {
        guard let record = value as? [String: Any] else { return nil }
        let id = (record["id"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let role = (record["role"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty, role == "user" || role == "assistant" else { return nil }
        let citations = (record["citations"] as? [[String: Any]] ?? [])
        var kinds: [StratjiSatyaDraftCitationKind] = []
        var seen = Set<StratjiSatyaDraftCitationKind>()
        for citation in citations {
            for kind in citationKinds(from: citation) where seen.insert(kind).inserted {
                kinds.append(kind)
            }
        }
        return StratjiSatyaDraftTurn(
            id: id,
            role: role,
            text: record["text"] as? String ?? "",
            citationKinds: kinds
        )
    }

    private static func boolValue(_ value: Any?) -> Bool {
        if let flag = value as? Bool { return flag }
        if let number = value as? NSNumber { return number.boolValue }
        if let raw = value as? String {
            switch raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
            case "1", "true", "yes": return true
            default: return false
            }
        }
        return false
    }

    private static func stringValue(_ value: Any?) -> String {
        if value is NSNull { return "" }
        if let raw = value as? String { return raw.trimmingCharacters(in: .whitespacesAndNewlines) }
        return ""
    }
}

/// Native Stratji Mac WKWebView: `webkit.messageHandlers.satyaDraft`.
/// Opens an NSPanel for the current Satya turn. Closing the panel does not clear the JS thread.
final class StratjiSatyaDraftBridge: NSObject, WKScriptMessageHandler {
    static let messageName = "satyaDraft"

    weak var webView: WKWebView?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let payload = StratjiSatyaDraftPayload.parse(message.body) else { return }
        DispatchQueue.main.async { [weak self] in
            #if os(macOS)
            StratjiSatyaDraftPanelController.shared.attach(webView: self?.webView)
            StratjiSatyaDraftPanelController.shared.handle(payload)
            #endif
        }
    }
}

#if os(macOS)
final class StratjiSatyaDraftModel: ObservableObject {
    @Published var drafting = false
    @Published var turns: [StratjiSatyaDraftTurn] = []
    @Published var sessionId: String?

    func apply(_ payload: StratjiSatyaDraftPayload) {
        drafting = payload.drafting
        sessionId = payload.sessionId
        if payload.action != "close" {
            turns = payload.turns
        }
    }
}

final class StratjiSatyaDraftPanelController: NSObject, NSWindowDelegate {
    static let shared = StratjiSatyaDraftPanelController()

    private let model = StratjiSatyaDraftModel()
    private var panel: NSPanel?
    private weak var webView: WKWebView?

    func attach(webView: WKWebView?) {
        if let webView {
            self.webView = webView
        }
    }

    func handle(_ payload: StratjiSatyaDraftPayload) {
        switch payload.action {
        case "open":
            model.apply(payload)
            show()
        case "update":
            model.apply(payload)
        case "close":
            model.drafting = false
            panel?.orderOut(nil)
        default:
            break
        }
    }

    private func show() {
        let window = ensurePanel()
        if let parent = NSApp.mainWindow ?? NSApp.keyWindow, window.frameAutosaveName.isEmpty || !window.isVisible {
            var frame = window.frame
            frame.origin.x = parent.frame.maxX - min(frame.width, 80)
            frame.origin.y = parent.frame.minY + 48
            window.setFrame(frame, display: false)
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func ensurePanel() -> NSPanel {
        if let panel {
            return panel
        }
        let panel = StratjiSatyaDraftPanel(
            contentRect: NSRect(x: 0, y: 0, width: 760, height: 840),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.title = "Satya · current chat"
        panel.minSize = NSSize(width: 480, height: 420)
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.level = .floating
        panel.appearance = StratjiAppearanceStore.current.nsAppearance
        panel.titlebarAppearsTransparent = false
        panel.setFrameAutosaveName("StratjiSatyaDraft.v1")
        panel.delegate = self
        let hosting = NSHostingController(rootView: StratjiSatyaDraftView(model: model) { [weak self] in
            self?.panel?.performClose(nil)
        })
        panel.contentViewController = hosting
        self.panel = panel
        return panel
    }

    func windowWillClose(_ notification: Notification) {
        model.drafting = false
        notifyWebClose()
    }

    private func notifyWebClose() {
        let js = "(function(){var a=window.satyaDraft;if(a&&typeof a.onClose==='function')a.onClose();})();"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}

final class StratjiSatyaDraftPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    override func cancelOperation(_ sender: Any?) {
        performClose(sender)
    }
}

struct SatyaDraftStatusText: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if reduceMotion {
                Text(StratjiSatyaDraftStatus.reduced)
            } else {
                TimelineView(.periodic(from: .now, by: StratjiSatyaDraftStatus.interval)) { context in
                    let tick = Int(context.date.timeIntervalSinceReferenceDate / StratjiSatyaDraftStatus.interval)
                    Text(StratjiSatyaDraftStatus.phrase(tick: tick, reduceMotion: false))
                        .id(tick)
                        .transition(.opacity.combined(with: .offset(y: 3)))
                }
            }
        }
        .lineLimit(nil)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

struct StratjiSatyaDraftView: View {
    @ObservedObject var model: StratjiSatyaDraftModel
    var onClose: () -> Void
    @AppStorage(StratjiAppearanceStore.defaultsKey) private var appearanceRaw = StratjiAppearanceStore.defaultValue

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    if model.turns.isEmpty {
                        Text("Ask Satya. This window shows the current turn — closing it keeps the thread on M-2 and the orb.")
                            .foregroundStyle(appearance.canvasMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        ForEach(model.turns, id: \.id) { turn in
                            turnBlock(turn)
                        }
                    }
                }
                .padding(20)
            }
            Divider()
            footer
        }
        .background(appearance.canvasFill)
        .preferredColorScheme(appearance.colorScheme)
        .frame(minWidth: 480, minHeight: 420)
    }

    private var appearance: StratjiAppearance {
        StratjiAppearance(rawValue: appearanceRaw) ?? .black
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("SATYA")
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .tracking(1.2)
                    .foregroundStyle(appearance.canvasInk)
                Group {
                    if model.drafting {
                        SatyaDraftStatusText()
                    } else {
                        Text("Current chat")
                    }
                }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(appearance.canvasMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button("Close") { onClose() }
                .keyboardShortcut(.cancelAction)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    private var footer: some View {
        Text("Grounded on the Satya corpus. Machine-drafted, never a source for numbers. Closing keeps this thread on M-2 and the orb.")
            .font(.system(size: 12))
            .foregroundStyle(appearance.canvasMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
    }

    private func turnBlock(_ turn: StratjiSatyaDraftTurn) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(turn.role == "user" ? "You" : "Satya")
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .textCase(.uppercase)
                .tracking(0.6)
                .foregroundStyle(appearance.canvasMuted)
            if turn.text.isEmpty, turn.role == "assistant" {
                if model.drafting {
                    SatyaDraftStatusText()
                        .foregroundStyle(appearance.canvasMuted)
                } else {
                    Text("Waiting for Satya.")
                        .foregroundStyle(appearance.canvasMuted)
                }
            } else {
                Text(turn.text)
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundStyle(appearance.canvasInk)
                    .textSelection(.enabled)
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if turn.role == "assistant", !turn.citationKinds.isEmpty {
                HStack(spacing: 8) {
                    ForEach(turn.citationKinds, id: \.self) { kind in
                        Label(kind.title, systemImage: kind.systemImage)
                            .font(.system(size: 12, weight: .semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .overlay {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .strokeBorder(appearance.canvasMuted.opacity(0.45), lineWidth: 1)
                            }
                    }
                }
                .foregroundStyle(appearance.canvasInk)
                .accessibilityLabel("Cited source counts")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
#endif
