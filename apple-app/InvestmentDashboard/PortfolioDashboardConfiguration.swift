import Foundation

enum PortfolioDashboardConfiguration {
    static let serverDefaultsKey = "dashboardServerAddress"
    static let onboardingDefaultsKey = "dashboardOnboardingComplete"
    static let workspaceDefaultsKey = "dashboardSelectedWorkspace"
    static let lastSuccessDefaultsKey = "dashboardLastSuccessfulRefresh"
    static let actionBoardDefaultsKey = "dashboardNativeActionBoard"
    static let defaultServerAddress = ""
    static let bonjourServiceType = "_stratji._tcp"

    static func isTailscaleAddress(_ value: String) -> Bool {
        value.lowercased().contains(".ts.net")
    }

    static func migratedServerAddress(_ value: String) -> String {
        isTailscaleAddress(value) ? "" : value
    }

    static func normalizedServerURL(from value: String) -> URL? {
        var candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return nil }

        if !candidate.contains("://") {
            candidate = "http://" + candidate
        }

        guard var components = URLComponents(string: candidate),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host != nil else {
            return nil
        }

        if components.path.isEmpty {
            components.path = "/"
        }
        components.fragment = nil
        return components.url
    }
}

enum DashboardWorkspace: String, CaseIterable, Identifiable, Codable {
    case investment
    case sectors
    case intelligence
    case health
    case builder
    case strategies

    var id: String { rawValue }

    static var primaryWorkspaces: [DashboardWorkspace] { Array(allCases) }

    var title: String {
        switch self {
        case .investment: "Portfolio Overview"
        case .sectors: "Sectoral Analytics"
        case .intelligence: "Market Intelligence"
        case .health: "My Feed"
        case .builder: "Algorithm Builder"
        case .strategies: "Strategies"
        }
    }

    var tabTitle: String {
        switch self {
        case .investment: "Portfolio"
        case .sectors: "Sectors"
        case .intelligence: "Intel"
        case .health: "My Feed"
        case .builder: "Builder"
        case .strategies: "Strategies"
        }
    }

    var systemImage: String {
        switch self {
        case .investment: "chart.pie.fill"
        case .sectors: "square.grid.2x2.fill"
        case .intelligence: "newspaper.fill"
        case .health: "heart.text.square.fill"
        case .builder: "point.3.connected.trianglepath.dotted"
        case .strategies: "arrow.triangle.branch"
        }
    }

    func dashboardURL(baseURL: URL) -> URL {
        DashboardOutline.defaultDestination(forView: rawValue).url(baseURL: baseURL, nativeChrome: true)
    }

    static func integrationsURL(baseURL: URL) -> URL {
        makeURL(baseURL: baseURL, view: "integrations")
    }

    private static func makeURL(
        baseURL: URL,
        view: String
    ) -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return baseURL
        }
        components.path = "/"
        var queryItems = [URLQueryItem(name: "view", value: view)]
        queryItems.append(URLQueryItem(name: "nativeChrome", value: "1"))
        components.queryItems = queryItems
        components.fragment = nil
        return components.url ?? baseURL
    }

    static func from(viewValue: String) -> DashboardWorkspace? {
        switch viewValue {
        case "market-intelligence":
            return .intelligence
        case "algorithm-canvas":
            return .builder
        case "strategy-library":
            return .strategies
        case "feed", "my-feed":
            return .health
        case "integrations", "settings":
            return nil
        case "portfolio", "portfolio-overview":
            return .investment
        default:
            return DashboardWorkspace(rawValue: viewValue)
        }
    }

    static func from(url: URL?) -> DashboardWorkspace? {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let value = components.queryItems?.first(where: { $0.name == "view" })?.value else {
            return nil
        }
        return from(viewValue: value)
    }
}
