import SwiftUI

/// Shared Y layout for the native six-workspace capsule and the WKWebView inset.
enum StratjiWorkspaceChromeMetrics {
    /// Extra space below the title bar / traffic lights. Was flush at 8pt top padding in a 58pt host.
    static let extraTopOffset: CGFloat = 12
    static let contentTopPadding: CGFloat = 8 + extraTopOffset
    static let barHostHeight: CGFloat = 58 + extraTopOffset
}

/// Native macOS 26/27 Liquid Glass workspace switcher.
///
/// Uses Apple’s `GlassEffectContainer`, `.glassEffect(_:in:)`, and
/// `.glassEffectID(_:in:)` so the six workspaces sit in one frosted capsule
/// with a morphing inner selected pill. CSS cannot do this; the WKWebView bar
/// is a localhost fallback only.
struct StratjiWorkspaceGlassBar: View {
    @ObservedObject var session: StratjiSessionModel
    @Namespace private var workspaceGlass

    private var license: StratjiLicenseSnapshot { StratjiLicenseStore.current() }

    var body: some View {
        Group {
            if #available(macOS 26.0, *) {
                liquidGlassBar
            } else {
                materialFallbackBar
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.top, StratjiWorkspaceChromeMetrics.contentTopPadding)
        .padding(.horizontal, 20)
        .allowsHitTesting(true)
        .background(Color.clear)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Dashboard workspaces")
    }

    private var glassCapsule: Capsule { Capsule(style: .continuous) }

    @available(macOS 26.0, *)
    private var liquidGlassBar: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 0) {
                ForEach(StratjiWorkspace.allCases) { workspace in
                    workspaceButton(workspace)
                        .background {
                            if session.workspace == workspace {
                                glassCapsule
                                    .fill(.clear)
                                    .glassEffect(.regular.interactive(), in: Capsule(style: .continuous))
                                    .glassEffectID("selected-workspace", in: workspaceGlass)
                            }
                        }
                        .clipShape(Capsule(style: .continuous))
                }
            }
            .padding(4)
            .frame(maxWidth: 840)
            .clipShape(Capsule(style: .continuous))
            .glassEffect(.regular, in: Capsule(style: .continuous))
        }
        .frame(maxWidth: .infinity)
    }

    @available(macOS 26.0, *)
    private func workspaceButton(_ workspace: StratjiWorkspace) -> some View {
        let selected = session.workspace == workspace
        let locked = !license.allows(workspace)
        return Button {
            withAnimation(.snappy(duration: 0.28)) {
                session.select(workspace.defaultDestination)
            }
        } label: {
            HStack(spacing: 4) {
                Text(workspace.barLabel)
                    .font(.system(size: 12, weight: .semibold, design: .default))
                    .lineLimit(1)
                if locked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 8, weight: .bold))
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal, 6)
            .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .clipShape(Capsule(style: .continuous))
        .foregroundStyle(selected ? Color.primary : Color.secondary)
        .accessibilityLabel(locked ? "\(workspace.title) (locked)" : workspace.title)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .help(workspace.title)
    }

    private var materialFallbackBar: some View {
        HStack(spacing: 0) {
            ForEach(StratjiWorkspace.allCases) { workspace in
                fallbackButton(workspace)
            }
        }
        .padding(4)
        .frame(maxWidth: 840)
        .clipShape(Capsule(style: .continuous))
        .background(.ultraThinMaterial, in: Capsule(style: .continuous))
        .overlay(Capsule(style: .continuous).strokeBorder(Color.white.opacity(0.28), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.28), radius: 12, y: 6)
        .frame(maxWidth: .infinity)
    }

    private func fallbackButton(_ workspace: StratjiWorkspace) -> some View {
        let selected = session.workspace == workspace
        let locked = !license.allows(workspace)
        return Button {
            session.select(workspace.defaultDestination)
        } label: {
            HStack(spacing: 4) {
                Text(workspace.barLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                if locked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 8, weight: .bold))
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal, 6)
            .background {
                if selected {
                    Capsule(style: .continuous).fill(Color.white.opacity(0.22))
                }
            }
            .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .clipShape(Capsule(style: .continuous))
        .foregroundStyle(selected ? Color.white : Color.white.opacity(0.7))
        .accessibilityLabel(locked ? "\(workspace.title) (locked)" : workspace.title)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .help(workspace.title)
    }
}
