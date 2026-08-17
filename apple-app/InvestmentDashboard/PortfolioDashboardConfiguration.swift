import Foundation

enum PortfolioDashboardConfiguration {
    static let serverDefaultsKey = "dashboardServerAddress"
    static let onboardingDefaultsKey = "dashboardOnboardingComplete"
    static let workspaceDefaultsKey = "dashboardSelectedWorkspace"
    static let defaultServerAddress = "https://adis-mbp.tailfd8d7f.ts.net/"

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
    case integrations

    var id: String { rawValue }

    var title: String {
        switch self {
        case .investment: "Portfolio Overview"
        case .sectors: "Sectoral"
        case .intelligence: "Market Intel"
        case .health: "Health"
        case .builder: "Algorithm Canvas"
        case .strategies: "Strategies"
        case .integrations: "Integrations"
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
        case .integrations: "cable.connector"
        }
    }

    func dashboardURL(baseURL: URL) -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return baseURL
        }
        components.path = "/"
        var queryItems = [URLQueryItem(name: "view", value: rawValue)]
        if self == .builder {
            queryItems.append(URLQueryItem(name: "section", value: "canvas"))
        }
        if self == .strategies {
            queryItems.append(URLQueryItem(name: "section", value: "y2"))
        }
        components.queryItems = queryItems
        components.fragment = nil
        return components.url ?? baseURL
    }

    static func from(url: URL?) -> DashboardWorkspace? {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let value = components.queryItems?.first(where: { $0.name == "view" })?.value else {
            return nil
        }
        if value == "market-intelligence" {
            return .intelligence
        }
        if value == "algorithm-canvas" {
            return .builder
        }
        if value == "strategy-library" {
            return .strategies
        }
        if value == "settings" {
            return .integrations
        }
        return DashboardWorkspace(rawValue: value)
    }
}

extension Notification.Name {
    static let portfolioNativeRefresh = Notification.Name("portfolioNativeRefresh")
    static let portfolioOpenReport = Notification.Name("portfolioOpenReport")
    static let portfolioOpenIntegrations = Notification.Name("portfolioOpenIntegrations")
}
