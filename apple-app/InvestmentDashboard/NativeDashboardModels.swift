import Foundation
import SwiftUI

enum FreshnessLabel {
    static func displayName(for state: String) -> String {
        switch state.lowercased() {
        case "live":
            return "Live"
        case "verified":
            return "Verified"
        case "partial":
            return "Partial"
        case "cached", "snapshot":
            return "Cached"
        case "stale":
            return "Stale"
        case "unavailable":
            return "Unavailable"
        case "permission_required":
            return "Permission required"
        case "auth_required":
            return "Auth required"
        case "public_delayed":
            return "Public delayed"
        default:
            return state.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    static func isLive(_ state: String) -> Bool {
        state.lowercased() == "live"
    }

    static func color(for state: String) -> Color {
        switch state.lowercased() {
        case "live", "verified":
            return .green
        case "partial", "public_delayed":
            return .orange
        case "cached", "snapshot", "permission_required", "auth_required":
            return .yellow
        case "stale", "unavailable":
            return .red
        default:
            return .secondary
        }
    }
}

enum NativeFormat {
    static func inr(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = abs(value) >= 100 ? 0 : 2
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "₹%.2f", value)
    }

    static func signedInr(_ value: Double) -> String {
        let prefix = value > 0 ? "+" : ""
        return prefix + inr(value)
    }

    static func percent(_ value: Double) -> String {
        String(format: "%+.2f%%", value)
    }
}

private struct FailableDecodable<T: Decodable>: Decodable {
    let value: T?

    init(from decoder: Decoder) throws {
        value = try? T(from: decoder)
    }
}

struct SourceFreshnessRow: Codable, Identifiable, Equatable {
    var id: String { source }
    let source: String
    let state: String
    let observedAt: String?
    let period: String?
    let required: Bool?
    let message: String?

    var displayState: String { FreshnessLabel.displayName(for: state) }
    var isLive: Bool { FreshnessLabel.isLive(state) }

    init(source: String, state: String, observedAt: String?, period: String?, required: Bool?, message: String?) {
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
        state = (try container.decodeIfPresent(String.self, forKey: .state)) ?? "unavailable"
        observedAt = try container.decodeIfPresent(String.self, forKey: .observedAt)
        period = try container.decodeIfPresent(String.self, forKey: .period)
        required = try container.decodeIfPresent(Bool.self, forKey: .required)
        message = try container.decodeIfPresent(String.self, forKey: .message)
    }
}

struct KitePortfolioPayload: Codable, Equatable {
    let invested: Double?
    let value: Double?
    let pnl: Double?
    let pnlPct: Double?
    let dayPnl: Double?
    let dayPct: Double?
    let topTwo: Double?
    let equityMargin: Double?
}

struct KiteHoldingPayload: Codable, Identifiable, Equatable {
    var id: String { symbol }
    let symbol: String
    let name: String?
    let sector: String?
    let marketCap: String?
    let qty: Double?
    let avg: Double?
    let price: Double?
    let value: Double?
    let pnl: Double?
    let pnlPct: Double?
    let dayPnl: Double?
    let dayPct: Double?
    let weight: Double?
    let stance: String?
}

struct KiteSnapshotPayload: Codable, Equatable {
    let status: String
    let authStatus: String?
    let asOf: String?
    let message: String?
    let portfolio: KitePortfolioPayload?
    let holdings: [KiteHoldingPayload]?

    var displayStatus: String { FreshnessLabel.displayName(for: status) }
    var isLive: Bool { FreshnessLabel.isLive(status) }
}

struct DigestItemPayload: Codable, Identifiable, Equatable {
    var id: String { "\(source)-\(time)-\(title)" }
    let source: String
    let time: String
    let title: String
    let summary: String
    let contentSource: String?
    let sentiment: String?

    init(source: String, time: String, title: String, summary: String, contentSource: String?, sentiment: String?) {
        self.source = source
        self.time = time
        self.title = title
        self.summary = summary
        self.contentSource = contentSource
        self.sentiment = sentiment
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        source = (try container.decodeIfPresent(String.self, forKey: .source)) ?? ""
        time = (try container.decodeIfPresent(String.self, forKey: .time)) ?? ""
        title = (try container.decodeIfPresent(String.self, forKey: .title)) ?? "Untitled"
        summary = (try container.decodeIfPresent(String.self, forKey: .summary)) ?? ""
        contentSource = try container.decodeIfPresent(String.self, forKey: .contentSource)
        sentiment = try container.decodeIfPresent(String.self, forKey: .sentiment)
    }
}

struct ContentDigestPayload: Codable, Equatable {
    let status: String?
    let asOf: String?
    let newsletters: [DigestItemPayload]?
    let axisResearch: [DigestItemPayload]?
    let podcasts: [DigestItemPayload]?
}

struct EarningsEventPayload: Codable, Identifiable, Equatable {
    var id: String { "\(date)-\(symbol)-\(name)" }
    let date: String
    let day: String?
    let symbol: String
    let name: String
    let state: String?
    let reported: Bool?
    let period: String?
    let summary: String?
}

struct EarningsSnapshotPayload: Codable, Equatable {
    let status: String
    let asOf: String?
    let analysisDate: String?
    let message: String?
    let events: [EarningsEventPayload]?

    var displayStatus: String { FreshnessLabel.displayName(for: status) }
}

struct HealthMetricAveragePayload: Codable, Equatable {
    let value: String
    let direction: String
    let delta: String?
}

struct HealthMetricPayload: Codable, Identifiable, Equatable {
    var id: String { label }
    let label: String
    let value: String
    let context: String?
    let tone: String?
    let averages: [String: HealthMetricAveragePayload]?
}

struct HealthCategoryPayload: Codable, Identifiable, Equatable {
    var id: String { name }
    let name: String
    let note: String?
    let tone: String?
    let metrics: [HealthMetricPayload]
}

struct HealthSnapshotPayload: Codable, Equatable {
    let status: String
    let dataDate: String?
    let capturedAt: String?
    let message: String?
    let targetDate: String?
    let targetLabel: String?
    let categories: [HealthCategoryPayload]?

    var displayStatus: String { FreshnessLabel.displayName(for: status) }
    var isLive: Bool { FreshnessLabel.isLive(status) }
}

struct DashboardRefreshPayload: Codable, Equatable {
    let status: String
    let refreshedAt: String?
    let analysisDate: String?
    let completedHealthThrough: String?
    let partialToday: Bool?
    let sources: [SourceFreshnessRow]
    let kite: KiteSnapshotPayload?
    let content: ContentDigestPayload?
    let earnings: EarningsSnapshotPayload?
    let health: HealthSnapshotPayload?

    init(
        status: String,
        refreshedAt: String?,
        analysisDate: String?,
        completedHealthThrough: String?,
        partialToday: Bool?,
        sources: [SourceFreshnessRow],
        kite: KiteSnapshotPayload?,
        content: ContentDigestPayload?,
        earnings: EarningsSnapshotPayload?,
        health: HealthSnapshotPayload?
    ) {
        self.status = status
        self.refreshedAt = refreshedAt
        self.analysisDate = analysisDate
        self.completedHealthThrough = completedHealthThrough
        self.partialToday = partialToday
        self.sources = sources
        self.kite = kite
        self.content = content
        self.earnings = earnings
        self.health = health
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = (try container.decodeIfPresent(String.self, forKey: .status)) ?? "unavailable"
        refreshedAt = try container.decodeIfPresent(String.self, forKey: .refreshedAt)
        analysisDate = try container.decodeIfPresent(String.self, forKey: .analysisDate)
        completedHealthThrough = try container.decodeIfPresent(String.self, forKey: .completedHealthThrough)
        partialToday = try container.decodeIfPresent(Bool.self, forKey: .partialToday)
        let rows = try? container.decode([FailableDecodable<SourceFreshnessRow>].self, forKey: .sources)
        sources = rows?.compactMap(\.value).filter { !$0.source.isEmpty } ?? []
        kite = try? container.decodeIfPresent(KiteSnapshotPayload.self, forKey: .kite)
        content = try? container.decodeIfPresent(ContentDigestPayload.self, forKey: .content)
        earnings = try? container.decodeIfPresent(EarningsSnapshotPayload.self, forKey: .earnings)
        health = try? container.decodeIfPresent(HealthSnapshotPayload.self, forKey: .health)
    }
}

struct IntegrationPipelinePayload: Codable, Equatable {
    let status: String
    let lastValidated: String?
    let connected: Bool
    let notes: String

    var displayStatus: String { FreshnessLabel.displayName(for: status) }

    init(status: String, lastValidated: String?, connected: Bool, notes: String) {
        self.status = status
        self.lastValidated = lastValidated
        self.connected = connected
        self.notes = notes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = (try container.decodeIfPresent(String.self, forKey: .status)) ?? "unavailable"
        lastValidated = try container.decodeIfPresent(String.self, forKey: .lastValidated)
        connected = (try container.decodeIfPresent(Bool.self, forKey: .connected)) ?? false
        notes = (try container.decodeIfPresent(String.self, forKey: .notes)) ?? ""
    }
}

struct IntegrationsPayload: Codable, Equatable {
    let version: Int?
    let wizardComplete: Bool?
    let pipelines: [String: IntegrationPipelinePayload]

    init(version: Int?, wizardComplete: Bool?, pipelines: [String: IntegrationPipelinePayload]) {
        self.version = version
        self.wizardComplete = wizardComplete
        self.pipelines = pipelines
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decodeIfPresent(Int.self, forKey: .version)
        wizardComplete = try container.decodeIfPresent(Bool.self, forKey: .wizardComplete)
        pipelines = (try container.decodeIfPresent([String: IntegrationPipelinePayload].self, forKey: .pipelines)) ?? [:]
    }
}

struct StrategyLibraryItemPayload: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let updatedAt: String?
    let createdAt: String?

    init(id: String, name: String, updatedAt: String?, createdAt: String?) {
        self.id = id
        self.name = name
        self.updatedAt = updatedAt
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = (try container.decodeIfPresent(String.self, forKey: .name)) ?? "Untitled"
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }
}

struct StrategyListPayload: Codable, Equatable {
    let status: String?
    let strategies: [StrategyLibraryItemPayload]

    init(status: String?, strategies: [StrategyLibraryItemPayload]) {
        self.status = status
        self.strategies = strategies
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        strategies = (try container.decodeIfPresent([StrategyLibraryItemPayload].self, forKey: .strategies)) ?? []
    }
}

struct SectorCompanyMarketPayload: Codable, Identifiable, Equatable {
    var id: String { symbol }
    let symbol: String
    let price: Double?
    let previousClose: Double?
}

struct SectorSnapshotPayload: Codable, Equatable {
    let status: String
    let sectorId: String
    let asOf: String?
    let message: String?
    let companies: [SectorCompanyMarketPayload]?

    var displayStatus: String { FreshnessLabel.displayName(for: status) }
    var isLive: Bool { FreshnessLabel.isLive(status) }
}

struct NativeCachePayload: Codable, Equatable {
    var savedAt: Date
    var refresh: DashboardRefreshPayload?
    var kite: KiteSnapshotPayload?
    var integrations: IntegrationsPayload?
    var strategies: [StrategyLibraryItemPayload]
    var sector: SectorSnapshotPayload?
}

struct NativeActionItem: Identifiable, Equatable {
    let id: String
    let title: String
    let detail: String
    let numericAdvantage: String
    let strategicAdvantage: String
    let lane: NativeActionLane
    let tone: NativeActionTone
}

enum NativeActionLane: String, Codable {
    case today
    case monitor
}

enum NativeActionTone: String {
    case green, amber, red, blue

    var color: Color {
        switch self {
        case .green: .green
        case .amber: .orange
        case .red: .red
        case .blue: .blue
        }
    }
}

enum NativeActionCatalog {
    static func items(for workspace: DashboardWorkspace) -> [NativeActionItem] {
        switch workspace {
        case .investment:
            return [
                .init(id: "inv-kite", title: "Refresh Kite and validate holdings", detail: "Reconcile holdings, positions, orders and GTTs before acting on allocation.", numericAdvantage: "100% live-position coverage", strategicAdvantage: "Prevents stale portfolio decisions", lane: .today, tone: .blue),
                .init(id: "inv-concentration", title: "Review top-two concentration", detail: "Use new capital to dilute concentration before adding to the largest positions.", numericAdvantage: "Target <65% top-two weight", strategicAdvantage: "Improves shock resilience", lane: .today, tone: .amber),
                .init(id: "inv-macro", title: "Monitor oil, INR and institutional flows", detail: "Apply the macro triggers before increasing high-beta exposure.", numericAdvantage: "5 regime signals", strategicAdvantage: "Links macro evidence to action", lane: .monitor, tone: .red),
                .init(id: "inv-earnings", title: "Update post-result theses", detail: "Replace pending KPI fields only after official results are published.", numericAdvantage: "4 KPIs per event", strategicAdvantage: "Reduces narrative bias", lane: .monitor, tone: .green),
            ]
        case .sectors:
            return [
                .init(id: "sec-breadth", title: "Refresh sector breadth and rankings", detail: "Validate prices, horizons and constituent coverage across all tracked sectors.", numericAdvantage: "11 sector universes", strategicAdvantage: "Separates broad leadership from single-stock moves", lane: .today, tone: .blue),
                .init(id: "sec-kpis", title: "Check sector KPI freshness", detail: "Review each metric's source date before using it in allocation decisions.", numericAdvantage: "30 numeric KPI cards", strategicAdvantage: "Makes stale evidence visible", lane: .today, tone: .green),
                .init(id: "sec-framework", title: "Run the selected sector through frameworks", detail: "Use PESTEL, Porter, life-cycle and market-structure evidence together before forming a sector stance.", numericAdvantage: "4 independent lenses", strategicAdvantage: "Reduces one-factor conclusions", lane: .monitor, tone: .amber),
                .init(id: "sec-earnings", title: "Fill pending earnings KPIs", detail: "Keep unpublished values blank and populate only from official releases.", numericAdvantage: "0 fabricated values", strategicAdvantage: "Preserves research integrity", lane: .monitor, tone: .red),
            ]
        case .intelligence:
            return [
                .init(id: "intel-mail", title: "Refresh exact Mail intelligence sources", detail: "Reconcile every item from iCloud Newsletters and Axis Research before using the digest.", numericAdvantage: "2 exact mailbox scopes", strategicAdvantage: "Prevents misfiled evidence", lane: .today, tone: .blue),
                .init(id: "intel-calendar", title: "Reconcile Calendar and Reminders", detail: "Merge current events and incomplete actions without treating schedules as published results.", numericAdvantage: "2 action sources", strategicAdvantage: "Separates plans from evidence", lane: .today, tone: .green),
                .init(id: "intel-earnings", title: "Monitor reported earnings evidence", detail: "Promote KPI rows only after company, exchange, or validated research evidence is available.", numericAdvantage: "0 inferred result fields", strategicAdvantage: "Protects decision quality", lane: .monitor, tone: .amber),
                .init(id: "intel-podcasts", title: "Review Podcast freshness and coverage", detail: "Use local transcripts when available and label description-only summaries explicitly.", numericAdvantage: "30-minute refresh", strategicAdvantage: "Keeps evidence provenance clear", lane: .monitor, tone: .red),
            ]
        case .health:
            return [
                .init(id: "health-sync", title: "Verify the operational Health target", detail: "After the 8 PM cutoff, confirm the newest archive advances the target date and the dashboard badge changes to SYNCED.", numericAdvantage: "8 PM date roll", strategicAdvantage: "Keeps the wellness record auditable", lane: .today, tone: .blue),
                .init(id: "health-averages", title: "Reconcile weekly and monthly averages", detail: "Show trends only where a complete comparison window is available.", numericAdvantage: "7-day + 30-day baselines", strategicAdvantage: "Avoids overreading one day", lane: .today, tone: .green),
                .init(id: "health-sleep", title: "Resolve cross-app sleep variance", detail: "Keep Apple Health primary and retain Guava as a separate comparison.", numericAdvantage: "2-source reconciliation", strategicAdvantage: "Prevents incompatible totals being merged", lane: .monitor, tone: .amber),
                .init(id: "health-diary", title: "Complete nutrition diary", detail: "Treat logged intake as incomplete until all meals and portions are entered.", numericAdvantage: "100% meal coverage target", strategicAdvantage: "Improves nutrition signal quality", lane: .monitor, tone: .red),
            ]
        case .builder:
            return [
                .init(id: "builder-validate", title: "Validate the strategy tree", detail: "Confirm Weight percents, If/Else operands and compiled StrategyGraphV2 before paper or broker preview.", numericAdvantage: "0 invalid trees", strategicAdvantage: "Blocks broken logic from leaving the canvas", lane: .today, tone: .blue),
                .init(id: "builder-asset", title: "Add Indian assets on the tree", detail: "Use Add a Block → Asset. Resolve symbols against live Kite holdings and watchlist, not a static US list.", numericAdvantage: "Holdings ∪ watchlist", strategicAdvantage: "Keeps the sleeve on real NSE instruments", lane: .today, tone: .green),
                .init(id: "builder-export", title: "Export the tree plus compiled graph", detail: "Save StrategyTreeV1 with compiled schemaVersion 2 before switching machines or sessions.", numericAdvantage: "Round-trip identical tree", strategicAdvantage: "Protects canvas work from session loss", lane: .monitor, tone: .amber),
                .init(id: "builder-else", title: "Fill or accept an empty ELSE", detail: "If/Else THEN can hold assets; empty ELSE is allowed and warned. Do not draw wires.", numericAdvantage: "THEN / ELSE wells", strategicAdvantage: "Completes the condition without a flowchart", lane: .monitor, tone: .red),
            ]
        case .strategies:
            return [
                .init(id: "strat-review", title: "Review the nine NSE library trees", detail: "Open a card to read the full vertical tree before sending it to Algorithm Canvas.", numericAdvantage: "9 NSE ETF trees", strategicAdvantage: "Keeps research scoped to Indian-listed sleeves", lane: .today, tone: .blue),
                .init(id: "strat-stats", title: "Do not treat empty OOS tiles as live alpha", detail: "Library KPIs stay em dash until an Indian-market engine run exists. Composer US figures are not copied.", numericAdvantage: "— until ran", strategicAdvantage: "Prevents fabricated performance", lane: .today, tone: .green),
                .init(id: "strat-market", title: "Confirm every leaf is a Nifty 500 name", detail: "Sleeves use RELIANCE, TCS, HDFCBANK, INFY, ITC and other official NSE constituent names. No SPY/TQQQ/SOXL.", numericAdvantage: "NSE only", strategicAdvantage: "Keeps Stratji on Indian markets", lane: .monitor, tone: .amber),
                .init(id: "strat-open", title: "Open one tree in Algorithm Builder", detail: "Deep-link a reconstruction into the tree editor when you want to edit. The library stays read-only.", numericAdvantage: "Algorithm Builder", strategicAdvantage: "Edits stay on the canvas, not in Health or Sectors", lane: .monitor, tone: .red),
            ]
        }
    }
}

enum NativeSectorCatalog {
    static let all: [(id: String, title: String)] = [
        ("pharma", "Pharma"),
        ("power", "Power"),
        ("infrastructure", "Infrastructure"),
        ("auto", "Auto"),
        ("telecom", "Telecom"),
        ("banking", "Banking"),
        ("nbfc", "NBFC"),
        ("fmcg", "FMCG"),
        ("consumer", "Consumer"),
        ("energy", "Energy"),
        ("defence", "Defence"),
    ]
}

enum RefreshStage: Int, CaseIterable, Equatable, Hashable {
    case idle
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

    var startProgress: Double {
        guard self != .idle else { return 0 }
        let visible = Self.allCases.filter { $0 != .idle }
        let index = visible.firstIndex(of: self) ?? 0
        return Double(index) / Double(visible.count)
    }

    var endProgress: Double {
        guard self != .idle else { return 0 }
        let visible = Self.allCases.filter { $0 != .idle }
        let index = visible.firstIndex(of: self) ?? 0
        return Double(index + 1) / Double(visible.count)
    }

    var progress: Double { endProgress }

    var title: String {
        switch self {
        case .idle: "Waiting for Mac"
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

    var detail: String {
        switch self {
        case .idle: "The iPhone waits for the Mac data plane before opening live workspaces."
        case .service: "Checking Flask at /_flask/health."
        case .kite: "Refreshing Kite holdings, positions, orders, GTT, margins, and quotes."
        case .mail: "Refreshing iCloud Newsletters."
        case .axis: "Refreshing the Axis Research mailbox."
        case .calendar: "Refreshing Apple Calendar."
        case .reminders: "Refreshing Apple Reminders."
        case .podcasts: "Refreshing Apple Podcasts."
        case .sectors: "Refreshing sector snapshots."
        case .earnings: "Refreshing earnings verification."
        case .health: "Refreshing Health through the operational target date."
        case .hydrate: "Opening the six live dashboard workspaces."
        }
    }

    static func fromProgressId(_ raw: String) -> RefreshStage? {
        switch raw {
        case "service": .service
        case "kite": .kite
        case "mail": .mail
        case "axis": .axis
        case "calendar": .calendar
        case "reminders": .reminders
        case "podcasts": .podcasts
        case "sectors": .sectors
        case "earnings": .earnings
        case "health": .health
        case "hydrate": .hydrate
        default: nil
        }
    }
}

enum NativeSessionPhase: Equatable {
    case idle
    case loading
    case ready
    case offline
}
