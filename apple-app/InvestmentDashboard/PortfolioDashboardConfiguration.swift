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
    case health

    var id: String { rawValue }

    var title: String {
        switch self {
        case .investment: "Investment"
        case .sectors: "Sectoral"
        case .health: "Health"
        }
    }

    var systemImage: String {
        switch self {
        case .investment: "chart.pie.fill"
        case .sectors: "square.grid.2x2.fill"
        case .health: "heart.text.square.fill"
        }
    }

    func dashboardURL(baseURL: URL) -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return baseURL
        }
        components.path = "/"
        components.queryItems = [URLQueryItem(name: "view", value: rawValue)]
        components.fragment = nil
        return components.url ?? baseURL
    }

    static func from(url: URL?) -> DashboardWorkspace? {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let value = components.queryItems?.first(where: { $0.name == "view" })?.value else {
            return nil
        }
        return DashboardWorkspace(rawValue: value)
    }
}
