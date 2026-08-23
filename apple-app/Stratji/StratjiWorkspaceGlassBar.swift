import SwiftUI

/// Overlay metrics for the native combined workspace + section droplet.
/// The bar is always visible; WKWebView stays full-height and native-chrome.css
/// clears the overlap so Refresh / Kite are not covered.
enum StratjiWorkspaceChromeMetrics {
    /// Extra space below the title bar / traffic lights.
    static let extraTopOffset: CGFloat = 12
    static let stackGap: CGFloat = 16
    static let contentTopPadding: CGFloat = 8 + extraTopOffset
    /// Overlay host only — never a reserved WKWebView gap.
    static let barHostHeight: CGFloat = 58 + extraTopOffset + stackGap
    /// Hover scale on the small native toggles only. Anchor to the bottom so the pop lifts into top padding.
    static let hoverPopScale: CGFloat = 1.06
}

/// Native macOS 26/27 Liquid Glass workspace switcher.
///
/// One frosted capsule: unselected workspaces are glyphs only; the click-selected
/// workspace expands with its name and that workspace’s section titles. Hover
/// scales a glyph — it does not preview another workspace’s sections. Uses Apple’s
/// `GlassEffectContainer`, `.glassEffect(_:in:)`, and `.glassEffectID(_:in:)`.
/// CSS cannot do this; the WKWebView bar is a localhost fallback only.
struct StratjiWorkspaceGlassBar: View {
    @ObservedObject var session: StratjiSessionModel
    @AppStorage(StratjiAppearanceStore.defaultsKey) private var appearanceRaw = StratjiAppearanceStore.defaultValue
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var workspaceGlass
    @State private var hoveredWorkspace: StratjiWorkspace?

    private var license: StratjiLicenseSnapshot { StratjiLicenseStore.current() }
    private var appearance: StratjiAppearance {
        StratjiAppearance(rawValue: appearanceRaw) ?? .black
    }

    /// Click-selected workspace owns the expanded cluster (name + that workspace’s
    /// section titles). Hover only scales the glyph — it must not expand a foreign
    /// cell while destinations still come from Investment.
    private var clusterWorkspace: StratjiWorkspace {
        session.workspace
    }

    private var activeSectionValue: String? {
        session.currentDestination.section
    }

    private func sectionDestinations(for workspace: StratjiWorkspace) -> [DashboardDestination] {
        DashboardOutline.sectionDestinations(forView: workspace.rawValue)
    }

    var body: some View {
        Group {
            if #available(macOS 26.0, *) {
                liquidGlassBar
            } else {
                materialFallbackBar
            }
        }
        .padding(.top, StratjiWorkspaceChromeMetrics.contentTopPadding)
        .padding(.bottom, StratjiWorkspaceChromeMetrics.stackGap)
        .padding(.horizontal, 12)
        .fixedSize(horizontal: true, vertical: true)
        .allowsHitTesting(true)
        .background(appearance.prefersDarkChrome ? Color.clear : Color(red: 0.98, green: 0.97, blue: 0.95).opacity(0.01))
        .preferredColorScheme(appearance.colorScheme)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Dashboard workspaces")
    }

    private var glassCapsule: Capsule { Capsule(style: .continuous) }

    @available(macOS 26.0, *)
    private var liquidGlassBar: some View {
        GlassEffectContainer(spacing: 8) {
            combinedGlassCapsule
        }
    }

    @available(macOS 26.0, *)
    private var combinedGlassCapsule: some View {
        HStack(spacing: 2) {
            ForEach(StratjiWorkspace.allCases) { workspace in
                dropletCell(workspace)
            }
        }
        .padding(4)
        .fixedSize(horizontal: true, vertical: true)
        .clipShape(Capsule(style: .continuous))
        .glassEffect(.regular, in: Capsule(style: .continuous))
        .onHover { hovering in
            clearHoverIfLeavingCapsule(hovering)
        }
    }

    @available(macOS 26.0, *)
    private func dropletCell(_ workspace: StratjiWorkspace) -> some View {
        let expanded = clusterWorkspace == workspace
        return HStack(spacing: 0) {
            workspaceButton(workspace)
            if expanded {
                sectionDroplet(for: workspace)
            }
        }
        .fixedSize(horizontal: true, vertical: true)
        .background {
            if expanded {
                selectedGlassBubble(for: workspace)
            }
        }
        .clipShape(Capsule(style: .continuous))
        .animation(dropletAnimation, value: expanded)
    }

    @available(macOS 26.0, *)
    private func sectionDroplet(for workspace: StratjiWorkspace) -> some View {
        HStack(spacing: 0) {
            ForEach(sectionDestinations(for: workspace)) { destination in
                sectionButton(destination)
            }
        }
        .id(workspace.rawValue)
        .fixedSize(horizontal: true, vertical: true)
        .transition(dropletTransition)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Workspace sections")
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
    private var sectionSelectedBubble: some View {
        let tint = clusterWorkspace.barTint
        return glassCapsule
            .fill(tint.opacity(0.28))
            .overlay {
                glassCapsule.fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.22),
                            tint.opacity(0.18),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .glassEffectID("selected-section", in: workspaceGlass)
            .matchedGeometryEffect(id: "section-pill", in: workspaceGlass)
    }

    @available(macOS 26.0, *)
    private func workspaceButton(_ workspace: StratjiWorkspace) -> some View {
        let selected = session.workspace == workspace
        let locked = !license.allows(workspace)
        let emphasized = selected
        let hovered = hoveredWorkspace == workspace
        return Button {
            animateDroplet {
                hoveredWorkspace = nil
                session.select(workspace.defaultDestination)
            }
        } label: {
            workspaceLabel(workspace, locked: locked, emphasized: emphasized)
        }
        .buttonStyle(.plain)
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

    @available(macOS 26.0, *)
    private func sectionButton(_ destination: DashboardDestination) -> some View {
        let title = destination.title
        let selected = destination.view == session.workspace.rawValue
            && destination.section == activeSectionValue
        return Button {
            animateDroplet {
                session.select(destination)
            }
        } label: {
            Text(title)
                .font(.system(size: 11, weight: selected ? .bold : .semibold, design: .default))
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .background {
            if selected {
                sectionSelectedBubble
            }
        }
        .clipShape(Capsule(style: .continuous))
        .foregroundStyle(labelForeground(emphasized: selected))
        .accessibilityLabel(title)
        .accessibilityIdentifier("workspace-section-tab-\(destination.section ?? destination.id)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .accessibilityAddTraits(.isButton)
        .help(title)
    }

    private var materialFallbackBar: some View {
        HStack(spacing: 2) {
            ForEach(StratjiWorkspace.allCases) { workspace in
                fallbackDropletCell(workspace)
            }
        }
        .padding(4)
        .fixedSize(horizontal: true, vertical: true)
        .clipShape(Capsule(style: .continuous))
        .background(.ultraThinMaterial, in: Capsule(style: .continuous))
        .overlay(Capsule(style: .continuous).strokeBorder(Color.white.opacity(0.28), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.28), radius: 12, y: 6)
        .onHover { hovering in
            clearHoverIfLeavingCapsule(hovering)
        }
    }

    private func fallbackDropletCell(_ workspace: StratjiWorkspace) -> some View {
        let expanded = clusterWorkspace == workspace
        return HStack(spacing: 0) {
            fallbackButton(workspace)
            if expanded {
                fallbackSectionDroplet(for: workspace)
            }
        }
        .fixedSize(horizontal: true, vertical: true)
        .background {
            if expanded {
                fallbackBubble(for: workspace, locked: !license.allows(workspace))
            }
        }
        .clipShape(Capsule(style: .continuous))
        .animation(dropletAnimation, value: expanded)
    }

    private func fallbackSectionDroplet(for workspace: StratjiWorkspace) -> some View {
        HStack(spacing: 0) {
            ForEach(sectionDestinations(for: workspace)) { destination in
                fallbackSectionButton(destination)
            }
        }
        .id(workspace.rawValue)
        .fixedSize(horizontal: true, vertical: true)
        .transition(dropletTransition)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Workspace sections")
    }

    private func fallbackSectionButton(_ destination: DashboardDestination) -> some View {
        let title = destination.title
        let selected = destination.view == session.workspace.rawValue
            && destination.section == activeSectionValue
        return Button {
            animateDroplet {
                session.select(destination)
            }
        } label: {
            Text(title)
                .font(.system(size: 11, weight: selected ? .bold : .semibold, design: .default))
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .background {
                    if selected {
                        Capsule(style: .continuous)
                            .fill(clusterWorkspace.barTint.opacity(0.52))
                    }
                }
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .clipShape(Capsule(style: .continuous))
        .foregroundStyle(fallbackLabelForeground(emphasized: selected))
        .accessibilityLabel(title)
        .accessibilityIdentifier("workspace-section-tab-\(destination.section ?? destination.id)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .help(title)
    }

    private func fallbackButton(_ workspace: StratjiWorkspace) -> some View {
        let selected = session.workspace == workspace
        let locked = !license.allows(workspace)
        let emphasized = selected
        let hovered = hoveredWorkspace == workspace
        return Button {
            animateDroplet {
                hoveredWorkspace = nil
                session.select(workspace.defaultDestination)
            }
        } label: {
            workspaceLabel(workspace, locked: locked, emphasized: emphasized)
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
        HStack(spacing: 6) {
            Image(systemName: workspace.systemImage)
                .font(.system(size: 14, weight: .semibold))
                .symbolRenderingMode(.monochrome)
                .frame(width: 16, height: 16)
                .accessibilityHidden(true)
            if emphasized {
                Text(workspace.barLabel)
                    .font(.system(size: 12, weight: .bold, design: .default))
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .transition(.opacity.combined(with: .move(edge: .leading)))
            }
            if locked {
                Image(systemName: "lock.fill")
                    .font(.system(size: 8, weight: .bold))
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, emphasized ? 10 : 9)
        .frame(minWidth: emphasized ? nil : 32)
        .contentShape(Capsule(style: .continuous))
        .animation(dropletAnimation, value: emphasized)
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
    /// Never `Color.primary` — NSHostingView over a clear overlay often stays light, so primary is black on black.
    private func labelForeground(emphasized: Bool) -> Color {
        if appearance.prefersDarkChrome {
            Color.white.opacity(emphasized ? 0.98 : 0.86)
        } else {
            Color.black.opacity(emphasized ? 0.92 : 0.74)
        }
    }

    private func fallbackLabelForeground(emphasized: Bool) -> Color {
        if appearance.prefersDarkChrome {
            Color.white.opacity(emphasized ? 0.98 : 0.86)
        } else {
            Color.black.opacity(emphasized ? 0.92 : 0.74)
        }
    }

    private var dropletAnimation: Animation? {
        reduceMotion ? nil : .spring(response: 0.52, dampingFraction: 0.88, blendDuration: 0.16)
    }

    private var dropletTransition: AnyTransition {
        if reduceMotion {
            return .identity
        }
        return .asymmetric(
            insertion: .opacity.combined(with: .move(edge: .leading)),
            removal: .opacity.combined(with: .move(edge: .leading))
        )
    }

    private func animateDroplet(_ body: () -> Void) {
        if reduceMotion {
            body()
        } else {
            withAnimation(.spring(response: 0.52, dampingFraction: 0.88, blendDuration: 0.16), body)
        }
    }

    private func setHover(_ workspace: StratjiWorkspace, hovering: Bool) {
        guard hovering else { return }
        animateDroplet {
            hoveredWorkspace = workspace
        }
    }

    private func clearHoverIfLeavingCapsule(_ hovering: Bool) {
        guard !hovering else { return }
        animateDroplet {
            hoveredWorkspace = nil
        }
    }
}
