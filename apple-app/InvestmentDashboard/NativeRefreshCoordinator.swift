import Combine
import Foundation

@MainActor
final class NativeRefreshCoordinator: ObservableObject {
    @Published private(set) var phase: NativeSessionPhase = .idle
    @Published private(set) var stage: RefreshStage = .idle
    @Published private(set) var progress: Double = 0
    @Published private(set) var completedStages: Set<RefreshStage> = []
    @Published private(set) var failedStages: Set<RefreshStage> = []
    @Published private(set) var connection: DashboardConnectionState = .idle
    @Published private(set) var audit: StartupAuditResponse?
    @Published private(set) var healthFreshness: HealthFreshnessResponse?
    @Published private(set) var refresh: DashboardRefreshPayload?
    @Published private(set) var kite: KiteSnapshotPayload?
    @Published private(set) var integrations: IntegrationsPayload?
    @Published private(set) var strategies: [StrategyLibraryItemPayload] = []
    @Published private(set) var sector: SectorSnapshotPayload?
    @Published private(set) var lastSuccessfulRefresh: Date?
    @Published private(set) var lastChecked: Date?
    @Published private(set) var viewingCachedSnapshot = false
    @Published private(set) var selectedSectorId = "pharma"
    @Published private(set) var degradedNames: [String] = []
    @Published private(set) var offlineMessage = "Keep the Mac awake on the same Wi-Fi, run npm run remote, and pair this iPhone."

    var hasCachedSnapshot: Bool { lastSuccessfulRefresh != nil || refresh != nil || kite != nil }
    @Published private(set) var startupRefreshCompleted = false

    private let client: DashboardAPIClient
    nonisolated(unsafe) private var monitorTask: Task<Void, Never>?
    private var lastBaseURL: URL?
    private var refreshInFlight = false

    init(client: DashboardAPIClient) {
        self.client = client
        restoreCache()
    }

    convenience init() {
        self.init(client: DashboardAPIClient())
    }

    deinit {
        monitorTask?.cancel()
    }

    func startMonitoring(baseURL: URL) {
        if lastBaseURL != baseURL {
            stopMonitoring()
        }
        lastBaseURL = baseURL
        if monitorTask != nil || startupRefreshCompleted {
            return
        }
        let showLoading = phase != .ready
        monitorTask = Task { [weak self] in
            guard let self else { return }
            await self.refreshAll(baseURL: baseURL, showLoading: showLoading)
        }
    }

    func refreshIfStale(baseURL: URL) async {
        lastBaseURL = baseURL
        guard !startupRefreshCompleted else { return }
        guard DashboardRefreshSchedule.isStale(lastSuccess: lastSuccessfulRefresh) else { return }
        await refreshAll(baseURL: baseURL, showLoading: false)
    }

    func stopMonitoring() {
        monitorTask?.cancel()
        monitorTask = nil
    }

    func retry(baseURL: URL) async {
        viewingCachedSnapshot = false
        await refreshAll(baseURL: baseURL)
    }

    func viewLastSnapshot() {
        guard hasCachedSnapshot else { return }
        viewingCachedSnapshot = true
        phase = .ready
        connection = .offline(offlineMessage)
    }

    func selectSector(_ sectorId: String) async {
        await selectSector(sectorId, baseURL: lastBaseURL)
    }

    func selectSector(_ sectorId: String, baseURL: URL?) async {
        selectedSectorId = sectorId
        guard let baseURL else { return }
        do {
            sector = try await client.sectorSnapshot(baseURL: baseURL, sectorId: sectorId)
            persistCache()
        } catch {
            if sector?.sectorId != sectorId {
                sector = SectorSnapshotPayload(
                    status: "unavailable",
                    sectorId: sectorId,
                    asOf: nil,
                    message: error.localizedDescription,
                    companies: []
                )
            }
        }
    }

    func refreshAll(baseURL: URL, showLoading: Bool = true) async {
        guard !refreshInFlight else { return }
        refreshInFlight = true
        defer { refreshInFlight = false }
        lastBaseURL = baseURL
        if showLoading {
            phase = .loading
            stage = .service
            progress = RefreshStage.service.startProgress
            completedStages = []
            failedStages = []
            connection = .checking
            viewingCachedSnapshot = false
            degradedNames = []
        }

        do {
            advance(.service, complete: false)
            let gateway = try await client.health(baseURL: baseURL)
            guard gateway.flaskReachable else {
                failOffline("The Mac Stratji service is not reachable.", showLoading: showLoading)
                return
            }
            advance(.service)

            advance(.kite, complete: false)
            healthFreshness = try? await client.healthFreshness(baseURL: baseURL)
            audit = try? await client.audit(baseURL: baseURL)
            let progressPoll = Task { [weak self] in
                while !Task.isCancelled {
                    await self?.pollStartupProgress(baseURL: baseURL)
                    try? await Task.sleep(for: .milliseconds(400))
                }
            }
            var latestRefresh = try? await client.dashboardRefresh(baseURL: baseURL, force: true)
            if !Self.containsAppleContent(latestRefresh) {
                try? await client.contentRefresh(baseURL: baseURL)
                latestRefresh = try? await client.dashboardRefresh(baseURL: baseURL, force: false)
            }
            progressPoll.cancel()
            await pollStartupProgress(baseURL: baseURL)
            if let latestRefresh {
                refresh = latestRefresh
                applyStages(from: latestRefresh.sources)
            }

            advance(.hydrate, complete: false)
            if let snapshot = try? await client.kiteSnapshot(baseURL: baseURL) {
                kite = snapshot
            } else {
                kite = latestRefresh?.kite
            }
            integrations = try? await client.integrations(baseURL: baseURL)
            if let list = try? await client.strategies(baseURL: baseURL) {
                strategies = list.strategies
            }
            await refreshTrackedSectors(baseURL: baseURL)

            lastChecked = Date()
            if latestRefresh != nil {
                lastSuccessfulRefresh = Date()
                persistCache()
            }
            startupRefreshCompleted = true
            viewingCachedSnapshot = false
            var rows = latestRefresh?.sources ?? []
            if !rows.contains(where: { $0.source.caseInsensitiveCompare("Kite") == .orderedSame }), let kite {
                rows.append(SourceFreshnessRow(source: "Kite", state: kite.status, observedAt: kite.asOf, period: nil, required: true, message: kite.message))
            }
            if !rows.contains(where: { $0.source.caseInsensitiveCompare("Apple Health export") == .orderedSame }), let healthFreshness {
                rows.append(SourceFreshnessRow(source: "Apple Health export", state: healthFreshness.status, observedAt: healthFreshness.capturedAt, period: nil, required: true, message: nil))
            }
            evaluateRequiredSources(rows, refreshReturnedRows: !(latestRefresh?.sources.isEmpty ?? true))
            advance(.hydrate)
            phase = .ready
            if latestRefresh?.status == "current", degradedNames.isEmpty, audit?.isCurrent != false {
                connection = .online
            } else {
                connection = .degraded("Sources need attention")
                if let audit, !audit.isCurrent {
                    degradedNames = audit.failedSources ?? degradedNames
                }
            }
        } catch {
            failOffline(error.localizedDescription, showLoading: showLoading)
        }
    }

    private func failOffline(_ message: String, showLoading: Bool) {
        offlineMessage = message
        lastChecked = Date()
        connection = .offline(message)
        if viewingCachedSnapshot || (!showLoading && hasCachedSnapshot && phase == .ready) {
            phase = .ready
            viewingCachedSnapshot = true
            return
        }
        phase = .offline
        stage = .idle
    }

    private func applyStages(from sources: [SourceFreshnessRow]) {
        func mark(_ name: String, _ loadStage: RefreshStage) {
            guard let row = sources.first(where: { $0.source.caseInsensitiveCompare(name) == .orderedSame }) else { return }
            if row.state != "live" && row.state != "verified" {
                failedStages.insert(loadStage)
            }
            advance(loadStage)
        }
        mark("Kite", .kite)
        mark("Apple Calendar", .calendar)
        mark("iCloud / Newsletters", .mail)
        mark("iCloud / Axis Research", .axis)
        mark("Apple Reminders", .reminders)
        mark("Apple Podcasts", .podcasts)
        mark("NSE benchmarks", .sectors)
        mark("Earnings", .earnings)
        mark("Apple Health export", .health)
    }

    private func pollStartupProgress(baseURL: URL) async {
        guard let dto = try? await client.startupProgress(baseURL: baseURL) else { return }
        var completed = Set((dto.completed ?? []).compactMap(RefreshStage.fromProgressId))
        completed.remove(.hydrate)
        let failed = Set((dto.failed ?? []).compactMap(RefreshStage.fromProgressId))
        completedStages.formUnion(completed)
        failedStages.formUnion(failed)
        if let mapped = RefreshStage.fromProgressId(dto.stage ?? ""), mapped != .hydrate, mapped != .idle {
            if mapped.rawValue >= stage.rawValue {
                stage = mapped
            }
        }
        let incoming = dto.percent ?? mappedPercent(completed: completed, current: stage, fraction: dto.fraction ?? 0)
        progress = max(progress, min(incoming, RefreshStage.hydrate.startProgress))
    }

    private func mappedPercent(completed: Set<RefreshStage>, current: RefreshStage, fraction: Double) -> Double {
        if completed.contains(.hydrate) { return 1 }
        let visible = RefreshStage.allCases.filter { $0 != .idle }
        let done = visible.filter { $0 != .hydrate && completed.contains($0) }.count
        let inProgress = current != .hydrate && !completed.contains(current) ? min(max(fraction, 0), 0.99) : 0
        return (Double(done) + inProgress) / Double(visible.count)
    }

    private func advance(_ stage: RefreshStage, complete: Bool = true) {
        self.stage = stage
        if complete {
            completedStages.insert(stage)
        }
        let target: Double
        if stage == .hydrate {
            target = complete ? 1 : stage.startProgress
        } else {
            target = complete ? min(stage.endProgress, RefreshStage.hydrate.startProgress) : stage.startProgress
        }
        progress = max(progress, target)
    }

    private func evaluateRequiredSources(_ sources: [SourceFreshnessRow], refreshReturnedRows: Bool) {
        var failed: [String] = []
        func require(_ name: String, ready: (String) -> Bool) {
            guard let row = sources.first(where: { $0.source.caseInsensitiveCompare(name) == .orderedSame }) else {
                if refreshReturnedRows || audit?.isCurrent != true {
                    failed.append("\(name) (missing)")
                }
                return
            }
            if !ready(row.state) {
                failed.append("\(name) (\(FreshnessLabel.displayName(for: row.state).lowercased()))")
            }
        }
        require("Kite") { $0 == "live" }
        require("NSE benchmarks") { $0 == "live" }
        require("iCloud / Newsletters") { $0 == "live" }
        require("Apple Podcasts") { $0 == "live" }
        require("Earnings") { $0 == "verified" }
        require("Apple Health export") { $0 == "live" || $0 == "verified" }
        if let audit, !audit.isCurrent {
            for name in audit.failedSources ?? [] {
                if !failed.contains(where: { $0.localizedCaseInsensitiveContains(name) }) {
                    failed.append(name)
                }
            }
        }
        degradedNames = failed
    }

    private func refreshTrackedSectors(baseURL: URL) async {
        let selected = selectedSectorId
        let api = client
        var selectedSnapshot: SectorSnapshotPayload?
        await withTaskGroup(of: (String, SectorSnapshotPayload?).self) { group in
            for entry in NativeSectorCatalog.all {
                group.addTask {
                    let snapshot = try? await api.sectorSnapshot(baseURL: baseURL, sectorId: entry.id)
                    return (entry.id, snapshot)
                }
            }
            for await (id, snapshot) in group {
                if id == selected {
                    selectedSnapshot = snapshot
                }
            }
        }
        if let selectedSnapshot {
            sector = selectedSnapshot
        } else {
            sector = try? await client.sectorSnapshot(baseURL: baseURL, sectorId: selected)
        }
    }

    private static func containsAppleContent(_ refresh: DashboardRefreshPayload?) -> Bool {
        refresh?.sources.contains { $0.source.localizedCaseInsensitiveContains("Newsletters") } == true
    }

    private var cacheURL: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Stratji", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("ios-last-snapshot.json")
    }

    private func persistCache() {
        let payload = NativeCachePayload(
            savedAt: lastSuccessfulRefresh ?? Date(),
            refresh: refresh,
            kite: kite,
            integrations: integrations,
            strategies: strategies,
            sector: sector
        )
        guard let data = try? JSONEncoder().encode(payload) else { return }
        try? data.write(to: cacheURL, options: .atomic)
        UserDefaults.standard.set(payload.savedAt, forKey: PortfolioDashboardConfiguration.lastSuccessDefaultsKey)
    }

    private func restoreCache() {
        if let stored = UserDefaults.standard.object(forKey: PortfolioDashboardConfiguration.lastSuccessDefaultsKey) as? Date {
            lastSuccessfulRefresh = stored
        }
        guard let data = try? Data(contentsOf: cacheURL),
              let payload = try? JSONDecoder().decode(NativeCachePayload.self, from: data) else {
            return
        }
        lastSuccessfulRefresh = payload.savedAt
        refresh = payload.refresh
        kite = payload.kite
        integrations = payload.integrations
        strategies = payload.strategies
        sector = payload.sector
        selectedSectorId = payload.sector?.sectorId ?? selectedSectorId
    }
}
