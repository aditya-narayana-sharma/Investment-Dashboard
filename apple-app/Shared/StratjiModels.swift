import Foundation

struct HealthFreshnessDTO: Codable, Equatable {
    var status: String
    /// Last HealthKit / Shortcut session day from the stored snapshot (`YYYY-MM-DD`).
    var dataDate: String?
    var completedHealthThrough: String?
    var capturedAt: String?
    var targetDate: String?
    var archiveStatus: String?
    var message: String?

    var sourceState: StratjiSourceState {
        switch status {
        case "live": .live
        case "verified": .verified
        case "partial": .partial
        case "cached", "snapshot": .cached
        case "stale": .stale
        default: .unavailable
        }
    }
}

struct FlaskHealthDTO: Codable, Equatable {
    var status: String
    var app: String?
    var gateway: String?
    var upstreamStatus: Int?
    var message: String?

    var flaskReachable: Bool {
        gateway == "flask" || status == "ok" || status == "degraded"
    }

    var serviceReady: Bool {
        flaskReachable && upstreamLive
    }

    var upstreamLive: Bool {
        upstreamStatus == 200
    }
}

struct StartupAuditDTO: Codable, Equatable {
    var status: String
    var failures: Int?
    var failedSources: [String]?
    var finishedAt: String?
    var message: String?

    var isCurrent: Bool {
        status == "ok" && (failures ?? 0) == 0
    }
}

private struct FailableDecodable<T: Decodable>: Decodable {
    let value: T?

    init(from decoder: Decoder) throws {
        value = try? T(from: decoder)
    }
}

struct SourceFreshnessDTO: Codable, Equatable, Identifiable {
    var source: String
    var state: StratjiSourceState
    var observedAt: String?
    var period: String?
    var required: Bool?
    var message: String?

    var id: String { source }

    var displayState: StratjiSourceState {
        state
    }

    init(source: String, state: StratjiSourceState, observedAt: String? = nil, period: String? = nil, required: Bool? = nil, message: String? = nil) {
        self.source = source
        self.state = state
        self.observedAt = observedAt
        self.period = period
        self.required = required
        self.message = message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let name = (try container.decodeIfPresent(String.self, forKey: .source))?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !name.isEmpty else {
            throw DecodingError.dataCorruptedError(forKey: .source, in: container, debugDescription: "Source name is required")
        }
        source = name
        state = (try? container.decode(StratjiSourceState.self, forKey: .state)) ?? .unknown
        observedAt = try container.decodeIfPresent(String.self, forKey: .observedAt)
        period = try container.decodeIfPresent(String.self, forKey: .period)
        required = try container.decodeIfPresent(Bool.self, forKey: .required)
        message = try container.decodeIfPresent(String.self, forKey: .message)
    }

    /// Dashboard `PulseConstellation` title: source name with CSS `text-transform: uppercase`.
    var chipTitle: String { source.uppercased() }

    /// Dashboard strip subtext: `{state} · {period}` with CSS `text-transform: capitalize`.
    var chipSubtitle: String {
        let statePart = state.rawValue.replacingOccurrences(of: "_", with: " ")
        guard let period, !period.isEmpty else {
            return Self.cssCapitalize(statePart)
        }
        return Self.cssCapitalize("\(statePart) · \(period)")
    }

    /// CSS `text-transform: capitalize` — first letter of each space-delimited word, remaining characters unchanged.
    static func cssCapitalize(_ text: String) -> String {
        text.split(separator: " ", omittingEmptySubsequences: false).map { part in
            guard let first = part.first else { return String(part) }
            return String(first).uppercased() + part.dropFirst()
        }.joined(separator: " ")
    }
}

struct KitePortfolioDTO: Codable, Equatable {
    var invested: Double?
    var value: Double?
    var pnl: Double?
    var pnlPct: Double?
    var dayPnl: Double?
    var dayPct: Double?
    var topTwo: Double?
    var equityMargin: Double?
}

struct KiteHoldingDTO: Codable, Equatable, Identifiable {
    var symbol: String
    var name: String?
    var sector: String?
    var qty: Double?
    var avg: Double?
    var price: Double?
    var value: Double?
    var pnl: Double?
    var weight: Double?
    var stance: String?

    var id: String { symbol }
}

struct KitePositionDTO: Codable, Equatable, Identifiable {
    var id: String?
    var symbol: String
    var product: String?
    var side: String?
    var qty: Double?
    var pnl: Double?

    var stableID: String { id ?? "\(symbol)-\(product ?? "")-\(side ?? "")" }
}

struct KiteSnapshotDTO: Codable, Equatable {
    var status: String?
    var authStatus: String?
    var asOf: String?
    var message: String?
    var authUrl: String?
    var portfolio: KitePortfolioDTO?
    var holdings: [KiteHoldingDTO]?
    var positions: [KitePositionDTO]?

    var sourceState: StratjiSourceState {
        switch status {
        case "live": .live
        case "partial": .partial
        case "snapshot": .cached
        case "auth_required": .unavailable
        default: .unavailable
        }
    }

    /// True when the daily Kite token can serve live/partial holdings.
    var hasUsableLiveSession: Bool {
        let authenticated = authStatus == nil
            || authStatus == "authenticated"
            || authStatus == "partial"
        switch status {
        case "live", "partial":
            return authenticated
        case "snapshot":
            return authStatus == "authenticated"
        default:
            return false
        }
    }

    /// Splash should pause for Zerodha login whenever the daily token cannot serve live data.
    var needsSplashLogin: Bool {
        !hasUsableLiveSession
    }
}

struct DashboardRefreshDTO: Codable, Equatable {
    enum CodingKeys: String, CodingKey {
        case status, refreshedAt, sources, kite
    }

    var status: String?
    var refreshedAt: String?
    var sources: [SourceFreshnessDTO]?
    var kite: KiteSnapshotDTO?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        refreshedAt = try container.decodeIfPresent(String.self, forKey: .refreshedAt)
        let rows = try? container.decode([FailableDecodable<SourceFreshnessDTO>].self, forKey: .sources)
        sources = rows?.compactMap(\.value).filter { !$0.source.isEmpty }
        kite = try? container.decode(KiteSnapshotDTO.self, forKey: .kite)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(refreshedAt, forKey: .refreshedAt)
        try container.encodeIfPresent(sources, forKey: .sources)
        try container.encodeIfPresent(kite, forKey: .kite)
    }
}

struct IntegrationsWizardDTO: Codable, Equatable {
    var kiteMcpProjectDir: String?
    var newslettersMailbox: String?
    var researchMailbox: String?
    var reminderListNames: [String]?
    var healthZipFolder: String?
    var tailscaleUrl: String?
    var calendarNames: String?
    var podcastsLibrary: String?
    var pythonPath: String?
    var nodePath: String?
    var npmPath: String?
    var yfinanceNotes: String?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(kiteMcpProjectDir, forKey: .kiteMcpProjectDir)
        try container.encodeIfPresent(newslettersMailbox, forKey: .newslettersMailbox)
        try container.encodeIfPresent(researchMailbox, forKey: .researchMailbox)
        try container.encodeIfPresent(reminderListNames, forKey: .reminderListNames)
        try container.encodeIfPresent(healthZipFolder, forKey: .healthZipFolder)
        try container.encodeIfPresent(tailscaleUrl, forKey: .tailscaleUrl)
        try container.encodeIfPresent(calendarNames, forKey: .calendarNames)
        try container.encodeIfPresent(podcastsLibrary, forKey: .podcastsLibrary)
        try container.encodeIfPresent(pythonPath, forKey: .pythonPath)
        try container.encodeIfPresent(nodePath, forKey: .nodePath)
        try container.encodeIfPresent(npmPath, forKey: .npmPath)
        try container.encodeIfPresent(yfinanceNotes, forKey: .yfinanceNotes)
    }
}

struct IntegrationPipelineDTO: Codable, Equatable {
    var status: String?
    var lastValidated: String?
    var connected: Bool?
    var notes: String?
}

struct ApplePermissionDTO: Codable, Equatable {
    var status: String?
    var tcc: String?
    var lastChecked: String?
    var notes: String?
}

struct IntegrationsLlmPublicDTO: Codable, Equatable {
    var anthropicKeyConfigured: Bool?
    var openaiKeyConfigured: Bool?
    var geminiKeyConfigured: Bool?
    var cursorKeyConfigured: Bool?
    var anthropicApiKey: String?
    var openaiApiKey: String?
    var geminiApiKey: String?
    var cursorApiKey: String?
}

struct IntegrationsLlmSecretsDTO: Encodable, Equatable {
    var anthropicApiKey: String?
    var openaiApiKey: String?
    var geminiApiKey: String?
    var cursorApiKey: String?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(anthropicApiKey, forKey: .anthropicApiKey)
        try container.encodeIfPresent(openaiApiKey, forKey: .openaiApiKey)
        try container.encodeIfPresent(geminiApiKey, forKey: .geminiApiKey)
        try container.encodeIfPresent(cursorApiKey, forKey: .cursorApiKey)
    }

    private enum CodingKeys: String, CodingKey {
        case anthropicApiKey, openaiApiKey, geminiApiKey, cursorApiKey
    }
}

struct IntegrationsConfigDTO: Codable, Equatable {
    var version: Int?
    var wizardComplete: Bool?
    var wizard: IntegrationsWizardDTO?
    var pipelines: [String: IntegrationPipelineDTO]?
    var applePermissions: [String: ApplePermissionDTO]?
    var appearance: String?
    var healthIncognito: Bool?
    var llm: IntegrationsLlmPublicDTO?
}

struct IntegrationsSettingsUpdate: Encodable {
    var wizardComplete: Bool?
    var wizard: IntegrationsWizardDTO?
    var appearance: String?
    var healthIncognito: Bool?
    var llm: IntegrationsLlmSecretsDTO?
    var clearLlmKeys: Bool?
    var applePermissions: [String: ApplePermissionDTO]?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(wizardComplete, forKey: .wizardComplete)
        try container.encodeIfPresent(wizard, forKey: .wizard)
        try container.encodeIfPresent(appearance, forKey: .appearance)
        try container.encodeIfPresent(healthIncognito, forKey: .healthIncognito)
        try container.encodeIfPresent(llm, forKey: .llm)
        try container.encodeIfPresent(clearLlmKeys, forKey: .clearLlmKeys)
        try container.encodeIfPresent(applePermissions, forKey: .applePermissions)
    }

    private enum CodingKeys: String, CodingKey {
        case wizardComplete, wizard, appearance, healthIncognito, llm, clearLlmKeys, applePermissions
    }
}

struct ApplePermissionsUpdateBody: Encodable {
    var action = "apple-permissions"
    var applePermissions: [String: ApplePermissionDTO]?
    var source: String?
    var status: String?
    var tcc: String?
    var notes: String?
    var lastChecked: String?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(action, forKey: .action)
        try container.encodeIfPresent(applePermissions, forKey: .applePermissions)
        try container.encodeIfPresent(source, forKey: .source)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(tcc, forKey: .tcc)
        try container.encodeIfPresent(notes, forKey: .notes)
        try container.encodeIfPresent(lastChecked, forKey: .lastChecked)
    }

    private enum CodingKeys: String, CodingKey {
        case action, applePermissions, source, status, tcc, notes, lastChecked
    }
}

struct PublicLicenseDTO: Codable, Equatable {
    var tier: String?
    var keyPresent: Bool?
    var source: String?
    var updatedAt: String?
    var message: String?
    var author: Bool?
    var operatorTier: String?
    var key: String?
}

struct LicenseUpdateBody: Encodable {
    var key: String?
    var tier: String?
    var operatorOverride: Bool?
    var author: Bool?
    var operatorTier: String?
    var clearKey: Bool?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(key, forKey: .key)
        try container.encodeIfPresent(tier, forKey: .tier)
        try container.encodeIfPresent(operatorOverride, forKey: .operatorOverride)
        try container.encodeIfPresent(author, forKey: .author)
        try container.encodeIfPresent(operatorTier, forKey: .operatorTier)
        try container.encodeIfPresent(clearKey, forKey: .clearKey)
    }

    private enum CodingKeys: String, CodingKey {
        case key, tier, operatorOverride, author, operatorTier, clearKey
    }
}

struct StratjiActionItem: Identifiable, Equatable, Codable {
    var id: String
    var title: String
    var detail: String
    var numericAdvantage: String
    var strategicAdvantage: String
    var lane: String
    var tone: String
}

enum StratjiActionLane: String, CaseIterable, Identifiable {
    case today
    case monitor
    case done

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "To Do Today"
        case .monitor: "Monitor"
        case .done: "Completed Today"
        }
    }
}
