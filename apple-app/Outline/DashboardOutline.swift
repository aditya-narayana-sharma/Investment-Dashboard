import Foundation
import SwiftUI

/// Historical 5-minute cadence. After splash, Stratji.app uses this interval for incremental ticks only.
enum DashboardRefreshSchedule {
    static let interval: TimeInterval = 5 * 60
    /// Forced Mail/Podcasts/Calendar/Reminders + Kite bundle (`?force=1`).
    static let forcedRequestTimeout: TimeInterval = 320

    static func isStale(lastSuccess: Date?, now: Date = Date()) -> Bool {
        guard let lastSuccess else { return true }
        return now.timeIntervalSince(lastSuccess) >= interval
    }
}

/// Hierarchical workspace → section → page destinations matching `?view=` / `section` / `page`
/// in `app/dashboard/workspace-routing.ts` and the six workspace components.
struct DashboardDestination: Identifiable, Hashable {
    let id: String
    let title: String
    let systemImage: String?
    let view: String
    let section: String?
    let page: String?
    let defaultChildID: String?
    var children: [DashboardDestination]

    init(
        id: String,
        title: String,
        systemImage: String? = nil,
        view: String,
        section: String? = nil,
        page: String? = nil,
        defaultChildID: String? = nil,
        children: [DashboardDestination] = []
    ) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
        self.view = view
        self.section = section
        self.page = page
        self.defaultChildID = defaultChildID
        self.children = children
    }

    var isLeaf: Bool { children.isEmpty }

    /// Node that should actually load when this row is clicked (parent → default section/page).
    var clickTarget: DashboardDestination {
        var current = self
        while let childID = current.defaultChildID,
              let child = current.children.first(where: { $0.id == childID }) {
            current = child
        }
        return current
    }

    /// CollapsibleSection number matching `dashboardSectionNumberFromNavId` in shared-ui.
    var dashboardSectionNumber: String? {
        guard let section = clickTarget.section ?? section else { return nil }
        switch section {
        case "board":
            return "B-1"
        case "canvas":
            return "B-2"
        case "json":
            return "B-3"
        case "y1":
            return "Y-1"
        case "y2":
            return "Y-2"
        default:
            let letters = section.prefix { $0.isLetter }
            let digits = section.drop { $0.isLetter }
            if !letters.isEmpty, !digits.isEmpty, digits.allSatisfy(\.isNumber) {
                return "\(letters.uppercased())-\(digits)"
            }
            return section.uppercased()
        }
    }

    func url(baseURL: URL, nativeChrome: Bool) -> URL {
        clickTarget.ownURL(baseURL: baseURL, nativeChrome: nativeChrome)
    }

    func ownURL(baseURL: URL, nativeChrome: Bool) -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return baseURL
        }
        components.path = "/"
        var items = [URLQueryItem(name: "view", value: view)]
        if let section {
            items.append(URLQueryItem(name: "section", value: section))
        }
        if let page {
            items.append(URLQueryItem(name: "page", value: page))
        }
        if nativeChrome {
            items.append(URLQueryItem(name: "nativeChrome", value: "1"))
        }
        components.queryItems = items
        components.fragment = nil
        return components.url ?? baseURL
    }
}

enum DashboardOutline {
    static let sidebarWidth: CGFloat = 300

    static let workspaces: [DashboardDestination] = [
        investment,
        sectors,
        intelligence,
        health,
        builder,
        strategies,
    ]

    /// Top-level section chips for the native glass droplet. Nested pages are not chips.
    static func sectionDestinations(forView rawView: String) -> [DashboardDestination] {
        let view = canonicalView(rawView)
        return workspaces.first(where: { $0.view == view })?.children ?? []
    }

    static var defaultDestination: DashboardDestination { investment.clickTarget }

    static func destination(id: String) -> DashboardDestination? {
        lookup[canonicalDestinationID(id)]
    }

    static func defaultDestination(forView rawView: String) -> DashboardDestination {
        let view = canonicalView(rawView)
        guard let workspace = workspaces.first(where: { $0.view == view }) else {
            return defaultDestination
        }
        return workspace.clickTarget
    }

    static func workspaceID(containing id: String) -> String? {
        var current: DashboardDestination? = destination(id: id)
        while let node = current {
            if workspaces.contains(where: { $0.id == node.id }) {
                return node.id
            }
            current = parent(of: node.id)
        }
        return nil
    }

    static func expansionIDs(forSelected id: String) -> Set<String> {
        var ids: Set<String> = []
        var currentID: String? = canonicalDestinationID(id)
        while let nodeID = currentID {
            if let parent = parent(of: nodeID) {
                ids.insert(parent.id)
                currentID = parent.id
            } else {
                ids.insert(nodeID)
                break
            }
        }
        return ids
    }

    static func match(url: URL?) -> DashboardDestination? {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        let items = components.queryItems ?? []
        func value(_ name: String) -> String? {
            items.first(where: { $0.name == name })?.value
        }
        var view = canonicalView(value("view"))
        guard workspaces.contains(where: { $0.view == view }) else { return nil }
        var section = canonicalSection(view: view, section: value("section"))
        if view == "intelligence", let currentSection = section, ["m4", "calendar", "calendar-reminders"].contains(currentSection) {
            view = "health"
            section = "h4"
        }
        let page = canonicalPage(view: view, page: value("page"))
        let focus = value("focus")

        let candidates = flattened.filter { $0.view == view }
        if let page, let exact = candidates.first(where: { $0.section == section && $0.page == page }) {
            return exact
        }
        if let section, let exact = candidates.first(where: { $0.section == section && $0.page == nil }) {
            return exact
        }
        if let section, let group = candidates.first(where: { $0.section == section && !$0.children.isEmpty }) {
            return group
        }
        if let focus, let exact = candidates.first(where: { $0.section == focus && $0.page == nil }) {
            return exact
        }
        return candidates.first(where: { $0.section == nil && $0.page == nil })
            ?? workspaces.first(where: { $0.view == view })
    }

    static func canonicalView(_ raw: String?) -> String {
        switch raw {
        case "investment":
            return "investment"
        case "sectors":
            return "sectors"
        case "intelligence":
            return "intelligence"
        case "health":
            return "health"
        case "builder":
            return "builder"
        case "strategies":
            return "strategies"
        case "market-intelligence":
            return "intelligence"
        case "algorithm-canvas":
            return "builder"
        case "strategy-library":
            return "strategies"
        case "feed", "my-feed":
            return "health"
        case "portfolio", "portfolio-overview":
            return "investment"
        default:
            return raw ?? ""
        }
    }

    static func allClickURLs(baseURL: URL, nativeChrome: Bool) -> [(DashboardDestination, URL)] {
        flattened.map { ($0, $0.url(baseURL: baseURL, nativeChrome: nativeChrome)) }
    }

    private static func canonicalSection(view: String, section: String?) -> String? {
        guard let section else { return nil }
        switch view {
        case "strategies":
            switch section {
            case "board":
                return "y1"
            case "library":
                return "y2"
            default:
                return section
            }
        case "health":
            switch section {
            case "calendar", "calendar-reminders":
                return "h4"
            default:
                return section
            }
        default:
            return section
        }
    }

    private static func canonicalPage(view: String, page: String?) -> String? {
        guard let page else { return nil }
        switch view {
        case "health":
            switch page {
            case "nutrition-1", "nutrition-2":
                return "nutrition"
            default:
                return page
            }
        default:
            return page
        }
    }

    private static func canonicalDestinationID(_ id: String) -> String {
        switch id {
        case "sectors/s2/pulse":
            return "sectors/s2"
        case "sectors/s3/benchmarks":
            return "sectors/s3"
        case "health/h2/optimism":
            return "health/h2"
        case "health/h3/metrics-overview":
            return "health/h3"
        case "health/h3/nutrition-1", "health/h3/nutrition-2":
            return "health/h3/nutrition"
        case "intelligence/m4":
            return "health/h4"
        default:
            return id
        }
    }

    private static let flattened: [DashboardDestination] = {
        var items: [DashboardDestination] = []
        func walk(_ node: DashboardDestination) {
            items.append(node)
            for child in node.children { walk(child) }
        }
        for workspace in workspaces { walk(workspace) }
        return items
    }()

    private static let lookup: [String: DashboardDestination] = {
        Dictionary(uniqueKeysWithValues: flattened.map { ($0.id, $0) })
    }()

    private static let parentByChild: [String: String] = {
        var map: [String: String] = [:]
        func walk(_ node: DashboardDestination) {
            for child in node.children {
                map[child.id] = node.id
                walk(child)
            }
        }
        for workspace in workspaces { walk(workspace) }
        return map
    }()

    private static func parent(of id: String) -> DashboardDestination? {
        guard let parentID = parentByChild[id] else { return nil }
        return lookup[parentID]
    }
}

private extension DashboardOutline {
    static let investment = DashboardDestination(
        id: "investment",
        title: "Portfolio Overview",
        systemImage: "chart.pie.fill",
        view: "investment",
        defaultChildID: "investment/i1",
        children: [
            leaf("investment/i1", "Action Board", view: "investment", section: "i1", image: "checklist"),
            leaf("investment/i2", "Portfolio", view: "investment", section: "i2", image: "chart.bar.fill"),
            leaf("investment/i3", "Risk", view: "investment", section: "i3", image: "shield.lefthalf.filled"),
            leaf("investment/i4", "Axis picks", view: "investment", section: "i4", image: "sparkles"),
        ]
    )

    static let sectors = DashboardDestination(
        id: "sectors",
        title: "Sectoral Analytics",
        systemImage: "square.grid.2x2.fill",
        view: "sectors",
        defaultChildID: "sectors/s1",
        children: [
            leaf("sectors/s1", "Action Board", view: "sectors", section: "s1", image: "checklist"),
            DashboardDestination(
                id: "sectors/s2",
                title: "Industry Analytics",
                systemImage: "chart.xyaxis.line",
                view: "sectors",
                section: "s2",
                page: "pulse",
                children: [
                    leaf("sectors/s2/companies", "Companies", view: "sectors", section: "s2", page: "companies"),
                    leaf("sectors/s2/rankings", "Rankings", view: "sectors", section: "s2", page: "rankings"),
                    leaf("sectors/s2/lifecycle", "Life cycle", view: "sectors", section: "s2", page: "lifecycle"),
                    leaf("sectors/s2/structure", "Market structure", view: "sectors", section: "s2", page: "structure"),
                    leaf("sectors/s2/mece", "MECE map", view: "sectors", section: "s2", page: "mece"),
                ]
            ),
            DashboardDestination(
                id: "sectors/s3",
                title: "Decision Framework",
                systemImage: "chart.line.uptrend.xyaxis",
                view: "sectors",
                section: "s3",
                page: "benchmarks",
                children: [
                    leaf("sectors/s3/investability", "Investability", view: "sectors", section: "s3", page: "investability"),
                    leaf("sectors/s3/pestel", "PESTEL", view: "sectors", section: "s3", page: "pestel"),
                    leaf("sectors/s3/porter", "Porter", view: "sectors", section: "s3", page: "porter"),
                    leaf("sectors/s3/macro", "Macro triggers", view: "sectors", section: "s3", page: "macro"),
                ]
            ),
        ]
    )

    static let intelligence = DashboardDestination(
        id: "intelligence",
        title: "Market Intelligence",
        systemImage: "newspaper.fill",
        view: "intelligence",
        defaultChildID: "intelligence/m1",
        children: [
            leaf("intelligence/m1", "Action Board", view: "intelligence", section: "m1", image: "checklist"),
            leaf("intelligence/m2", "Satya", view: "intelligence", section: "m2", image: "dot.radiowaves.up.forward"),
            leaf("intelligence/m3", "Earnings Calendar", view: "intelligence", section: "m3", image: "calendar"),
        ]
    )

    static let health = DashboardDestination(
        id: "health",
        title: "My Feed",
        systemImage: "heart.text.square.fill",
        view: "health",
        defaultChildID: "health/h1",
        children: [
            leaf("health/h1", "Action Board", view: "health", section: "h1", image: "checklist"),
            DashboardDestination(
                id: "health/h2",
                title: "Daily Optimism",
                systemImage: "sun.max.fill",
                view: "health",
                section: "h2",
                page: "optimism",
                children: [
                    leaf("health/h2/insights", "Insights", view: "health", section: "h2", page: "insights"),
                    leaf("health/h2/guidance", "Guidance", view: "health", section: "h2", page: "guidance"),
                    leaf("health/h2/guardrails", "Guardrails", view: "health", section: "h2", page: "guardrails"),
                ]
            ),
            DashboardDestination(
                id: "health/h3",
                title: "Vital Metrics",
                systemImage: "heart.fill",
                view: "health",
                section: "h3",
                page: "metrics-overview",
                children: [
                    leaf("health/h3/activity", "Activity", view: "health", section: "h3", page: "activity"),
                    leaf("health/h3/sleep", "Sleep", view: "health", section: "h3", page: "sleep"),
                    leaf("health/h3/heart", "Heart", view: "health", section: "h3", page: "heart"),
                    leaf("health/h3/respiratory", "Respiratory", view: "health", section: "h3", page: "respiratory"),
                    leaf("health/h3/mobility", "Mobility", view: "health", section: "h3", page: "mobility"),
                    leaf("health/h3/nutrition", "Nutrition", view: "health", section: "h3", page: "nutrition"),
                ]
            ),
            leaf("health/h4", "Calendar + Reminders", view: "health", section: "h4", image: "bell.fill"),
        ]
    )

    static let builder = DashboardDestination(
        id: "builder",
        title: "Algorithm Builder",
        systemImage: "point.3.connected.trianglepath.dotted",
        view: "builder",
        defaultChildID: "builder/canvas",
        children: [
            leaf("builder/board", "Action Board", view: "builder", section: "board", image: "checklist"),
            leaf("builder/canvas", "Canvas", view: "builder", section: "canvas", image: "square.on.circle"),
            leaf("builder/json", "JSON", view: "builder", section: "json", image: "curlybraces"),
        ]
    )

    static let strategies = DashboardDestination(
        id: "strategies",
        title: "Strategies",
        systemImage: "arrow.triangle.branch",
        view: "strategies",
        defaultChildID: "strategies/y2",
        children: [
            leaf("strategies/y1", "Action Board", view: "strategies", section: "y1", image: "checklist"),
            leaf("strategies/y2", "Library", view: "strategies", section: "y2", image: "books.vertical.fill"),
            leaf("strategies/y3", "Signals", view: "strategies", section: "y3", image: "waveform.path.ecg"),
        ]
    )

    static func leaf(
        _ id: String,
        _ title: String,
        view: String,
        section: String,
        page: String? = nil,
        image: String? = nil
    ) -> DashboardDestination {
        DashboardDestination(
            id: id,
            title: title,
            systemImage: image,
            view: view,
            section: section,
            page: page
        )
    }
}

struct DashboardOutlineList: View {
    let selectedID: String
    let onSelect: (DashboardDestination) -> Void
#if os(iOS)
    @State private var expandedIDs: Set<String> = DashboardOutline.expansionIDs(
        forSelected: DashboardOutline.defaultDestination.id
    )
#endif

    var body: some View {
        #if os(macOS)
        DashboardOutlineSidebarRepresentable(selectedID: selectedID, onSelect: onSelect)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        #else
        iosOutline
        #endif
    }

#if os(iOS)
    private var iosOutline: some View {
        List(selection: selectionBinding) {
            ForEach(DashboardOutline.workspaces) { workspace in
                DisclosureGroup(isExpanded: expansionBinding(workspace.id)) {
                    ForEach(workspace.children) { section in
                        if section.children.isEmpty {
                            outlineRow(section)
                        } else {
                            DisclosureGroup(isExpanded: expansionBinding(section.id)) {
                                ForEach(section.children) { page in
                                    outlineRow(page)
                                }
                            } label: {
                                outlineRow(section, opensOverview: true)
                            }
                            .tag(section.id)
                        }
                    }
                } label: {
                    outlineRow(workspace, opensOverview: true)
                }
                .tag(workspace.id)
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .environment(\.defaultMinListRowHeight, 26)
        .onChange(of: selectedID) { _, newValue in
            expandedIDs.formUnion(DashboardOutline.expansionIDs(forSelected: newValue))
        }
        .onAppear {
            expandedIDs.formUnion(DashboardOutline.expansionIDs(forSelected: selectedID))
        }
    }

    private var selectionBinding: Binding<String?> {
        Binding(
            get: { selectedID },
            set: { newValue in
                guard let newValue, let destination = DashboardOutline.destination(id: newValue) else { return }
                onSelect(destination)
            }
        )
    }

    private func outlineRow(_ item: DashboardDestination, opensOverview: Bool = false) -> some View {
        let isExact = selectedID == item.id || selectedID == item.clickTarget.id
        return Label {
            Text(item.title)
                .lineLimit(1)
        } icon: {
            Image(systemName: item.systemImage ?? "circle")
                .foregroundStyle(isExact ? Color.accentColor : Color.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .tag(item.id)
        .listRowBackground(isExact ? Color.accentColor.opacity(0.16) : Color.clear)
        .accessibilityLabel(item.title)
        .accessibilityAddTraits(isExact ? .isSelected : [])
        .accessibilityIdentifier(workspaceAccessibilityID(item))
        .highPriorityGesture(TapGesture().onEnded {
            if opensOverview {
                expandedIDs.insert(item.id)
            }
            onSelect(item)
        })
    }

    private func workspaceAccessibilityID(_ item: DashboardDestination) -> String {
        if DashboardOutline.workspaces.contains(where: { $0.id == item.id }) {
            return "workspace-tab-\(item.view)"
        }
        return "outline-\(item.id)"
    }

    private func expansionBinding(_ id: String) -> Binding<Bool> {
        Binding(
            get: { expandedIDs.contains(id) },
            set: { isExpanded in
                if isExpanded {
                    expandedIDs.insert(id)
                } else {
                    expandedIDs.remove(id)
                }
            }
        )
    }
#endif
}
