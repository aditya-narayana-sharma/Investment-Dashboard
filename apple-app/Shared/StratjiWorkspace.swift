import Foundation
import SwiftUI

enum StratjiWorkspace: String, CaseIterable, Identifiable, Codable {
    case investment
    case sectors
    case intelligence
    case health
    case builder
    case strategies

    var id: String { rawValue }

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

    /// Compact glass-bar labels. URL keys stay investment|sectors|intelligence|health|builder|strategies.
    var barLabel: String {
        switch self {
        case .investment: "Portfolio"
        case .sectors: "Sectors"
        case .intelligence: "Intel"
        case .health: "My Feed"
        case .builder: "Canvas"
        case .strategies: "Strategies"
        }
    }

    /// Sliding-pill tints matching CSS `--vo-desk` / `--vo-map` / `--vo-news` / `--vo-body` / `--vo-canvas` / `--vo-strategies`.
    var barTint: Color {
        switch self {
        case .investment: Color(red: 29 / 255, green: 78 / 255, blue: 216 / 255) // #1d4ed8
        case .sectors: Color(red: 13 / 255, green: 148 / 255, blue: 136 / 255) // #0d9488
        case .intelligence: Color(red: 168 / 255, green: 85 / 255, blue: 247 / 255) // #a855f7
        case .health: Color(red: 244 / 255, green: 63 / 255, blue: 94 / 255) // #f43f5e
        case .builder: Color(red: 217 / 255, green: 119 / 255, blue: 6 / 255) // #d97706
        case .strategies: Color(red: 101 / 255, green: 163 / 255, blue: 13 / 255) // #65a30d
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

    var note: String {
        switch self {
        case .investment: "Holdings, action board, and Kite snapshot"
        case .sectors: "Sector snapshots and rankings"
        case .intelligence: "Satya, action board, and earnings"
        case .health: "Operational-day Health plus calendar and reminders"
        case .builder: "Strategy tree canvas"
        case .strategies: "NSE strategy library"
        }
    }
}

enum StratjiLoadStage: String, CaseIterable, Identifiable {
    case service
    case kite
    case calendar
    case mail
    case axis
    case reminders
    case podcasts
    case sectors
    case earnings
    case health
    case hydrate

    var id: String { rawValue }

    var title: String {
        switch self {
        case .service: "Service up"
        case .kite: "Kite"
        case .mail: "Mail"
        case .axis: "Axis"
        case .calendar: "Calendar"
        case .reminders: "Reminders"
        case .podcasts: "Podcasts"
        case .sectors: "Sectors"
        case .earnings: "Earnings"
        case .health: "Health"
        case .hydrate: "UI hydrate"
        }
    }

    var index: Int {
        Self.allCases.firstIndex(of: self) ?? 0
    }

    var startProgress: Double {
        Double(index) / Double(Self.allCases.count)
    }

    var endProgress: Double {
        Double(index + 1) / Double(Self.allCases.count)
    }

    var next: StratjiLoadStage? {
        let all = Self.allCases
        guard let index = all.firstIndex(of: self) else { return nil }
        let nextIndex = all.index(after: index)
        guard nextIndex < all.endIndex else { return nil }
        return all[nextIndex]
    }

    /// Completed-stage percent. Hydrate reaches 1 only after WKWebView is ready.
    var progress: Double { endProgress }

    var loadingLabel: String {
        switch self {
        case .service: "Starting the local Stratji service…"
        case .kite: "Refreshing Kite holdings, positions, orders, GTT, margins, and quotes…"
        case .mail: "Refreshing iCloud Newsletters…"
        case .axis: "Refreshing the Axis Research mailbox…"
        case .calendar: "Refreshing Apple Calendar…"
        case .reminders: "Refreshing Apple Reminders…"
        case .podcasts: "Refreshing Apple Podcasts…"
        case .sectors: "Refreshing sector snapshots…"
        case .earnings: "Refreshing earnings calendar…"
        case .health: "Refreshing Health snapshot…"
        case .hydrate: "Opening the dashboard…"
        }
    }

    var systemImage: String {
        switch self {
        case .service: "server.rack"
        case .kite: "chart.line.uptrend.xyaxis"
        case .mail: "envelope.fill"
        case .axis: "doc.richtext.fill"
        case .calendar: "calendar"
        case .reminders: "checklist"
        case .podcasts: "mic.fill"
        case .sectors: "square.grid.2x2.fill"
        case .earnings: "chart.bar.doc.horizontal.fill"
        case .health: "heart.fill"
        case .hydrate: "macwindow"
        }
    }
}

enum StratjiSourceState: String, Codable {
    case live
    case verified
    case partial
    case stale
    case cached
    case unavailable
    case permissionRequired = "permission_required"
    case unknown

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = (try? container.decode(String.self)) ?? ""
        self = StratjiSourceState(rawValue: raw) ?? .unknown
    }

    var label: String {
        switch self {
        case .live: "live"
        case .verified: "verified"
        case .partial: "partial"
        case .stale: "stale"
        case .cached: "cached"
        case .unavailable: "unavailable"
        case .permissionRequired: "permission"
        case .unknown: "unknown"
        }
    }

    var isReady: Bool {
        switch self {
        case .live, .verified: true
        case .partial, .stale, .cached, .unavailable, .permissionRequired, .unknown: false
        }
    }

    /// Dot fill matching `.source-freshness-strip i.{state}` / `.pulse-core.{state}`.
    var freshnessDotColor: Color {
        switch self {
        case .live, .verified:
            Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)
        case .partial, .cached:
            Color(red: 234 / 255, green: 179 / 255, blue: 8 / 255)
        case .unavailable, .permissionRequired, .stale:
            Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
        case .unknown:
            Color(red: 113 / 255, green: 113 / 255, blue: 122 / 255)
        }
    }
}

extension StratjiWorkspace {
    var defaultDestination: DashboardDestination {
        DashboardOutline.defaultDestination(forView: rawValue)
    }

    func documentURL(baseURL: URL, nativeChrome: Bool = false) -> URL {
        defaultDestination.url(baseURL: baseURL, nativeChrome: nativeChrome)
    }

    func inspectorURL(baseURL: URL) -> URL {
        documentURL(baseURL: baseURL, nativeChrome: false)
    }

    static func integrationsURL(baseURL: URL) -> URL {
        makeURL(baseURL: baseURL, view: "integrations", nativeChrome: true)
    }

    private static func makeURL(
        baseURL: URL,
        view: String,
        nativeChrome: Bool
    ) -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return baseURL
        }
        components.path = "/"
        var queryItems = [URLQueryItem(name: "view", value: view)]
        if nativeChrome {
            queryItems.append(URLQueryItem(name: "nativeChrome", value: "1"))
        }
        components.queryItems = queryItems
        components.fragment = nil
        return components.url ?? baseURL
    }

    static func from(viewValue: String) -> StratjiWorkspace? {
        switch viewValue {
        case "market-intelligence":
            return .intelligence
        case "algorithm-canvas":
            return .builder
        case "strategy-library":
            return .strategies
        case "feed", "my-feed":
            return .health
        case "portfolio", "portfolio-overview":
            return .investment
        case "integrations", "settings":
            return nil
        default:
            return StratjiWorkspace(rawValue: viewValue)
        }
    }

    static func from(url: URL?) -> StratjiWorkspace? {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let value = components.queryItems?.first(where: { $0.name == "view" })?.value else {
            return nil
        }
        return from(viewValue: value)
    }
}
