import SwiftUI

/// Overlay metrics for the native six-workspace capsule. The bar does not inset WKWebView.
enum StratjiWorkspaceChromeMetrics {
    /// Extra space below the title bar / traffic lights when the overlay is revealed.
    static let extraTopOffset: CGFloat = 12
    static let stackGap: CGFloat = 16
    static let contentTopPadding: CGFloat = 8 + extraTopOffset
    /// Overlay host only — never a reserved WKWebView gap.
    static let barHostHeight: CGFloat = 58 + extraTopOffset + stackGap
    /// Hover scale on the small native toggles only. Anchor to the bottom so the pop lifts into top padding.
    static let hoverPopScale: CGFloat = 1.06
    /// Thin content-top band that reveals the overlay without stealing layout.
    static let hoverRevealStripHeight: CGFloat = 14
    static let hideDelay: TimeInterval = 0.8
    static let revealAnimationDuration: TimeInterval = 0.22
}

/// Native macOS 26/27 Liquid Glass workspace switcher.
///
/// Uses Apple’s `GlassEffectContainer`, `.glassEffect(_:in:)`, and
/// `.glassEffectID(_:in:)` so the six workspaces sit in one frosted capsule
/// with a morphing inner selected pill. CSS cannot do this; the WKWebView bar
/// is a localhost fallback only.
struct StratjiWorkspaceGlassBar: View {
    @ObservedObject var session: StratjiSessionModel
    var onPointerInsideChange: ((Bool) -> Void)? = nil
    @AppStorage(StratjiAppearanceStore.defaultsKey) private var appearanceRaw = StratjiAppearanceStore.defaultValue
    @Namespace private var workspaceGlass
    @State private var hoveredWorkspace: StratjiWorkspace?

    private var license: StratjiLicenseSnapshot { StratjiLicenseStore.current() }
    private var appearance: StratjiAppearance {
        StratjiAppearance(rawValue: appearanceRaw) ?? .black
    }

    /// Hover previews the sliding pill; leaving the capsule snaps back to the selected workspace.
    private var pillWorkspace: StratjiWorkspace {
        hoveredWorkspace ?? session.workspace
    }

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
        .padding(.bottom, StratjiWorkspaceChromeMetrics.stackGap)
        .padding(.horizontal, 20)
        .allowsHitTesting(true)
        .background(appearance.prefersDarkChrome ? Color.clear : Color(red: 0.98, green: 0.97, blue: 0.95).opacity(0.01))
        .preferredColorScheme(appearance.colorScheme)
        .onHover { hovering in
            onPointerInsideChange?(hovering)
        }
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
                }
            }
            .padding(4)
            .frame(maxWidth: 840)
            .clipShape(Capsule(style: .continuous))
            .glassEffect(.regular, in: Capsule(style: .continuous))
            .onHover { hovering in
                clearHoverIfLeavingCapsule(hovering)
            }
        }
        .frame(maxWidth: .infinity)
    }

    @available(macOS 26.0, *)
    private func selectedGlassBubble(for workspace: StratjiWorkspace) -> some View {
        let locked = !license.allows(workspace)
        let tint = workspace.barTint
        return glassCapsule
            .fill(tint.opacity(locked ? 0.22 : 0.38))
            .overlay {
                glassCapsule.fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.24),
                            tint.opacity(locked ? 0.14 : 0.28),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .glassEffect(
                .regular.tint(tint.opacity(locked ? 0.40 : 0.78)).interactive(),
                in: Capsule(style: .continuous)
            )
            .glassEffectID("selected-workspace", in: workspaceGlass)
            .matchedGeometryEffect(id: "workspace-pill", in: workspaceGlass)
    }

    @available(macOS 26.0, *)
    private func workspaceButton(_ workspace: StratjiWorkspace) -> some View {
        let selected = session.workspace == workspace
        let locked = !license.allows(workspace)
        let emphasized = pillWorkspace == workspace
        let hovered = hoveredWorkspace == workspace
        return Button {
            withAnimation(.snappy(duration: 0.28)) {
                session.select(workspace.defaultDestination)
            }
        } label: {
            workspaceLabel(workspace, locked: locked, emphasized: emphasized)
        }
        .buttonStyle(.plain)
        .background {
            if pillWorkspace == workspace {
                selectedGlassBubble(for: workspace)
            }
        }
        .clipShape(Capsule(style: .continuous))
        .foregroundStyle(labelForeground(emphasized: emphasized))
        .scaleEffect(
            hovered ? StratjiWorkspaceChromeMetrics.hoverPopScale : 1,
            anchor: .bottom
        )
        .zIndex(hovered ? 1 : 0)
        .onHover { hovering in
            setHover(workspace, hovering: hovering)
        }
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
        .onHover { hovering in
            clearHoverIfLeavingCapsule(hovering)
        }
    }

    private func fallbackButton(_ workspace: StratjiWorkspace) -> some View {
        let selected = session.workspace == workspace
        let locked = !license.allows(workspace)
        let emphasized = pillWorkspace == workspace
        let hovered = hoveredWorkspace == workspace
        return Button {
            withAnimation(.snappy(duration: 0.28)) {
                session.select(workspace.defaultDestination)
            }
        } label: {
            workspaceLabel(workspace, locked: locked, emphasized: emphasized)
                .background {
                    if pillWorkspace == workspace {
                        fallbackBubble(for: workspace, locked: locked)
                    }
                }
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .clipShape(Capsule(style: .continuous))
        .foregroundStyle(fallbackLabelForeground(emphasized: emphasized))
        .scaleEffect(
            hovered ? StratjiWorkspaceChromeMetrics.hoverPopScale : 1,
            anchor: .bottom
        )
        .zIndex(hovered ? 1 : 0)
        .onHover { hovering in
            setHover(workspace, hovering: hovering)
        }
        .accessibilityLabel(locked ? "\(workspace.title) (locked)" : workspace.title)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .help(workspace.title)
    }

    private func workspaceLabel(_ workspace: StratjiWorkspace, locked: Bool, emphasized: Bool) -> some View {
        HStack(spacing: 4) {
            Text(workspace.barLabel)
                .font(.system(size: 12, weight: emphasized ? .bold : .semibold, design: .default))
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

    private func fallbackBubble(for workspace: StratjiWorkspace, locked: Bool) -> some View {
        let tint = workspace.barTint
        return Capsule(style: .continuous)
            .fill(tint.opacity(locked ? 0.28 : 0.52))
            .overlay {
                Capsule(style: .continuous).fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.28),
                            tint.opacity(0.18),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .overlay {
                Capsule(style: .continuous).strokeBorder(Color.white.opacity(0.28), lineWidth: 0.5)
            }
            .matchedGeometryEffect(id: "workspace-pill", in: workspaceGlass)
    }

    /// Selected (or hover-preview) labels stay near-opaque; idle labels stay readable on frost.
    private func labelForeground(emphasized: Bool) -> Color {
        Color.primary.opacity(emphasized ? 0.98 : 0.84)
    }

    private func fallbackLabelForeground(emphasized: Bool) -> Color {
        Color.white.opacity(emphasized ? 0.98 : 0.86)
    }

    private func setHover(_ workspace: StratjiWorkspace, hovering: Bool) {
        guard hovering else { return }
        withAnimation(.snappy(duration: 0.22)) {
            hoveredWorkspace = workspace
        }
    }

    private func clearHoverIfLeavingCapsule(_ hovering: Bool) {
        guard !hovering else { return }
        withAnimation(.snappy(duration: 0.22)) {
            hoveredWorkspace = nil
        }
    }
}
