import SwiftUI
#if canImport(WebKit)
import WebKit
#endif

struct StratjiLoadingView: View {
    @ObservedObject var session: StratjiSessionModel

    /// Compact two-row glyph strip. Keep these tight; a lazy grid between Spacers inflates row gap.
    private enum SplashMetrics {
        static let glyphRowsSpacing: CGFloat = 8
        static let glyphColumnsSpacing: CGFloat = 8
        static let glyphSize: CGFloat = 22
        static let glyphDrawSize: CGFloat = 16
        static let glyphLabelSpacing: CGFloat = 4
        static let cellPadding: CGFloat = 4
    }

    var body: some View {
        VStack(spacing: 16) {
            Spacer(minLength: 0)
            Text("Stratji")
                .font(.largeTitle.bold())
            Text(session.stageLabel)
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 520)
            ProgressView(value: session.progress, total: 1)
                .progressViewStyle(.linear)
                .tint(.accentColor)
                .frame(maxWidth: 420)
                .animation(.easeInOut(duration: SplashProgressInterpolator.animationDuration), value: session.progress)
                .accessibilityLabel("Startup progress")
                .accessibilityValue("\(Int((session.progress * 100).rounded())) percent")
            Text("\(Int((session.progress * 100).rounded()))% · \(session.stage.title)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            let stages = StratjiLoadStage.allCases
            VStack(alignment: .center, spacing: SplashMetrics.glyphRowsSpacing) {
                splashStageRow(Array(stages.prefix(6)))
                splashStageRow(Array(stages.suffix(from: 6)))
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: 520)
            Spacer(minLength: 0)
        }
        .padding(36)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }

    private func splashStageRow(_ stages: [StratjiLoadStage]) -> some View {
        HStack(alignment: .top, spacing: SplashMetrics.glyphColumnsSpacing) {
            ForEach(stages) { stage in
                splashStageCell(stage)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func splashStageCell(_ stage: StratjiLoadStage) -> some View {
        let isCurrent = session.stage == stage
        let isComplete = session.completedStages.contains(stage)
        return VStack(spacing: SplashMetrics.glyphLabelSpacing) {
            splashStageGlyph(stage: stage, isCurrent: isCurrent, isComplete: isComplete)
            Text(stage.title)
                .font(.caption2)
                .foregroundStyle(isCurrent || isComplete ? Color.primary : Color.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(SplashMetrics.cellPadding)
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
        .background(isCurrent ? Color.accentColor.opacity(0.18) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .opacity(isComplete && !isCurrent ? 0.7 : 1)
    }

    private func splashStageGlyph(stage: StratjiLoadStage, isCurrent: Bool, isComplete: Bool) -> some View {
        let dimOpacity = isComplete ? 0.7 : 0.45
        return splashStageIcon(stage: stage, isCurrent: isCurrent, dimOpacity: dimOpacity)
            .frame(width: SplashMetrics.glyphSize, height: SplashMetrics.glyphSize)
    }

    @ViewBuilder
    private func splashStageIcon(stage: StratjiLoadStage, isCurrent: Bool, dimOpacity: Double) -> some View {
        switch stage {
        case .kite:
            Image("KiteLogo")
                .renderingMode(.original)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: SplashMetrics.glyphSize, height: SplashMetrics.glyphSize)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                .saturation(isCurrent ? 1 : 0)
                .opacity(isCurrent ? 1 : dimOpacity)
                .accessibilityLabel("Kite")
        case .service:
            splashSFSymbol("server.rack", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .calendar:
            splashSFSymbol("calendar", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .mail:
            splashSFSymbol("envelope.fill", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .axis:
            splashSFSymbol("doc.richtext.fill", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .reminders:
            splashSFSymbol("checklist", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .podcasts:
            splashSFSymbol("mic.fill", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .sectors:
            splashSFSymbol("square.grid.2x2.fill", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .earnings:
            splashSFSymbol("chart.bar.doc.horizontal.fill", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .health:
            splashSFSymbol("heart.fill", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        case .hydrate:
            splashSFSymbol("macwindow", isCurrent: isCurrent, dimOpacity: dimOpacity, tint: splashLoadingTint(stage))
        }
    }

    private func splashSFSymbol(_ name: String, isCurrent: Bool, dimOpacity: Double, tint: Color) -> some View {
        Image(systemName: name)
            .resizable()
            .scaledToFit()
            .frame(width: SplashMetrics.glyphDrawSize, height: SplashMetrics.glyphDrawSize)
            .foregroundStyle(isCurrent ? tint : Color.secondary)
            .opacity(isCurrent ? 1 : dimOpacity)
            .frame(width: SplashMetrics.glyphSize, height: SplashMetrics.glyphSize)
    }

    private func splashLoadingTint(_ stage: StratjiLoadStage) -> Color {
        switch stage {
        case .service: Color(red: 0.52, green: 0.60, blue: 0.72)
        case .kite: Color(red: 1.00, green: 0.42, blue: 0.20)
        case .mail: Color(red: 0.10, green: 0.48, blue: 1.00)
        case .axis: Color(red: 0.85, green: 0.62, blue: 0.12)
        case .calendar: Color(red: 1.00, green: 0.23, blue: 0.19)
        case .reminders: Color(red: 1.00, green: 0.62, blue: 0.04)
        case .podcasts: Color(red: 0.62, green: 0.27, blue: 0.87)
        case .sectors: Color(red: 0.18, green: 0.66, blue: 0.66)
        case .earnings: Color(red: 0.22, green: 0.72, blue: 0.36)
        case .health: Color(red: 0.86, green: 0.08, blue: 0.24)
        case .hydrate: Color.accentColor
        }
    }
}

struct StratjiOfflineView: View {
    @ObservedObject var session: StratjiSessionModel
    @State private var showTechnicalDetails = false

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: session.needsFullDiskAccess ? "lock.trianglebadge.exclamationmark.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(.orange)
            Text("Stratji is not ready")
                .font(.title2.bold())
            Text(session.offlineMessage ?? "The local Stratji service did not start.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 480)
            HStack(spacing: 10) {
                Button("Retry") {
                    Task { await session.reload() }
                }
                .buttonStyle(.borderedProminent)
                Button("Open Console logs") {
                    session.openConsoleLogs()
                }
                .buttonStyle(.bordered)
                if session.needsFullDiskAccess {
                    Button("Grant Full Disk Access") {
                        session.openFullDiskAccess()
                    }
                    .buttonStyle(.bordered)
                }
            }
            DisclosureGroup("Technical details", isExpanded: $showTechnicalDetails) {
                ScrollView {
                    Text(session.logTail.isEmpty ? "No extra detail is available yet." : session.logTail)
                        .font(.system(.caption, design: .monospaced))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 160)
            }
            .frame(maxWidth: 560)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

#if canImport(WebKit)
struct StratjiInspectorView: View {
    let url: URL

    var body: some View {
        VStack(spacing: 0) {
            Text("Advanced inspector · \(url.absoluteString)")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(8)
            StratjiSimpleWebView(url: url)
        }
    }
}

#if os(macOS)
struct StratjiFilledWebView: NSViewRepresentable {
    @ObservedObject var model: StratjiDocumentBrowser

    func makeNSView(context: Context) -> StratjiFilledWebHost {
        StratjiFilledWebHost(webView: model.webView)
    }

    func updateNSView(_ nsView: StratjiFilledWebHost, context: Context) {
        nsView.webView.frame = nsView.bounds
    }
}

struct StratjiSimpleWebView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 800, height: 600))
        view.setValue(true, forKey: "drawsBackground")
        view.autoresizingMask = [.width, .height]
        view.load(URLRequest(url: url))
        return view
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        nsView.autoresizingMask = [.width, .height]
    }
}
#endif
#endif
