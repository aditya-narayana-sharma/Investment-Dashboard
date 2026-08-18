import Combine
import Foundation
import SwiftUI
#if os(macOS)
import AppKit
#endif

@MainActor
final class StratjiSessionModel: ObservableObject {
    @Published var isBootstrapping = true
    @Published var stage: StratjiLoadStage = .service
    @Published var progress: Double = 0
    @Published var stageLabel = "Starting Stratji…"
    @Published var completedStages: Set<StratjiLoadStage> = []
    @Published var failedStages: Set<StratjiLoadStage> = []
    @Published var logTail = ""
    @Published var sources: [SourceFreshnessDTO] = []
    @Published var kite: KiteSnapshotDTO?
    @Published var integrations: IntegrationsConfigDTO?
    @Published var audit: StartupAuditDTO?
    @Published var workspace: StratjiWorkspace = .investment
    @Published var destinationID: String = DashboardOutline.defaultDestination.id
    @Published var columnVisibility: NavigationSplitViewVisibility = .all
    @Published var isDegraded = false
    @Published var degradedNames: [String] = []
    @Published var lastLoadedAt: Date?
    @Published var offlineMessage: String?
    @Published var serviceFailed = false
    @Published var needsFullDiskAccess = false
    @Published var completedIds: Set<String> = []
    @Published var showingInspector = false
    @Published var kiteAuthPhase: StratjiKiteAuthPhase = .idle
    @Published var kiteAuthMessage = ""

    let document = StratjiDocumentBrowser()
    var baseURL: URL
    var startDataPlane: (() async -> FlaskServiceStatus)?
    var logProvider: (() -> String)?

    private let client = StratjiAPIClient()
    private let completedDefaultsKey = "stratji.completedActions"
    private let completedDayKey = "stratji.completedDay"
    nonisolated(unsafe) private var periodicTask: Task<Void, Never>?
    nonisolated(unsafe) private var interpolatorTask: Task<Void, Never>?
    private var refreshInFlight = false
    /// Splash finished one complete refresh. Later ticks are incremental only.
    private var startupRefreshCompleted = false
    /// Last Health snapshot session day (`YYYY-MM-DD`) from `dataDate`, else `completedHealthThrough`.
    private var lastHealthSessionDateKey: String?
    private var healthSessionResolved = false
    private var latestProgressSnapshot: StratjiRefreshProgressSnapshot?
    private var stageEnteredAt = Date()
    private var committedProgress: Double = 0
    /// Set once on UI hydrate so poll ticks cannot swap Health vs dashboard copy.
    private var frozenHydrateCaption: String?
    private var kiteAuthContinuation: CheckedContinuation<Bool, Never>?
    private var pendingKiteLoginURL: URL?

    init(baseURL: URL) {
        self.baseURL = baseURL
        restoreCompletedActions()
    }

    deinit {
        periodicTask?.cancel()
        interpolatorTask?.cancel()
    }

    var requiredPills: [SourceFreshnessDTO] {
        let names = ["Kite", "NSE benchmarks", "iCloud / Newsletters", "Apple Podcasts", "Earnings", "Apple Health export"]
        return names.compactMap { name in
            sources.first { $0.source.caseInsensitiveCompare(name) == .orderedSame }
        }
    }

    /// Full dashboard live-feed strip (`PulseConstellation` / `GET /api/dashboard/refresh` `sources`).
    var liveFeedSources: [SourceFreshnessDTO] { sources }

    func bootstrap() async {
        stopPeriodicRefresh()
        startupRefreshCompleted = false
        isBootstrapping = true
        isDegraded = false
        degradedNames = []
        offlineMessage = nil
        serviceFailed = false
        needsFullDiskAccess = false
        completedStages = []
        failedStages = []
        lastHealthSessionDateKey = nil
        healthSessionResolved = false
        latestProgressSnapshot = nil
        committedProgress = 0
        frozenHydrateCaption = nil
        progress = 0
        stage = .service
        stageEnteredAt = Date()
        restoreCompletedActions()
        await runAudit(includeStartupScript: true)
    }

    func reload() async {
        await bootstrap()
    }

    func reload(keepDocument: Bool) async {
        if keepDocument {
            guard !refreshInFlight else { return }
            isDegraded = false
            degradedNames = []
            await runAudit(showLoading: false, includeStartupScript: true, incremental: false)
            document.refreshDashboard()
            return
        }
        await bootstrap()
    }

    func refreshIfStale() async {
        guard !isBootstrapping else { return }
        guard startupRefreshCompleted else { return }
        guard DashboardRefreshSchedule.isStale(lastSuccess: lastLoadedAt) else { return }
        await refreshIncremental()
    }

    func refreshOnForeground() async {
        guard !isBootstrapping else { return }
        guard startupRefreshCompleted else { return }
        await refreshIncremental()
    }

    /// After splash, poll incrementally. Skip full Health XML re-extract unless the export mtime changed.
    func startPeriodicRefresh() {
        stopPeriodicRefresh()
        periodicTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(DashboardRefreshSchedule.interval))
                guard !Task.isCancelled else { return }
                await self?.refreshIncremental()
            }
        }
    }

    func refreshIncremental() async {
        guard !isBootstrapping else { return }
        guard startupRefreshCompleted else { return }
        guard !refreshInFlight else { return }
        await runAudit(showLoading: false, includeStartupScript: true, incremental: true)
    }

    func stopPeriodicRefresh() {
        periodicTask?.cancel()
        periodicTask = nil
    }

    func openConsoleLogs() {
#if os(macOS)
        FlaskServiceSupervisor.openConsoleLogs()
#endif
    }

    func openFullDiskAccess() {
#if os(macOS)
        FlaskServiceSupervisor.openFullDiskAccess()
#endif
    }

    func noteLogTick() {
        refreshLogTail()
    }

    func complete(_ item: StratjiActionItem) {
        completedIds.insert(item.id)
        persistCompletedActions()
    }

    func beginKiteLogin() {
        Task { await openKiteLoginFromSplash() }
    }

    func skipKiteLogin() {
        stageLabel = "Continuing with the last validated Kite snapshot…"
        finishKiteAuth(loggedIn: false)
    }

    func items(for workspace: StratjiWorkspace, lane targetLane: StratjiActionLane) -> [StratjiActionItem] {
        StratjiActionCatalog.items(for: workspace).filter { resolvedLane(for: $0) == targetLane }
    }

    func resolvedLane(for item: StratjiActionItem) -> StratjiActionLane {
        if completedIds.contains(item.id) {
            return .done
        }
        return StratjiActionLane(rawValue: item.lane) ?? .today
    }

    private func runAudit(showLoading: Bool = true, includeStartupScript: Bool = false, incremental: Bool = false) async {
        guard !refreshInFlight else { return }
        refreshInFlight = true
        defer { refreshInFlight = false }
        if showLoading {
            isBootstrapping = true
            completedStages = []
            failedStages = []
            lastHealthSessionDateKey = nil
            healthSessionResolved = false
            latestProgressSnapshot = nil
            committedProgress = 0
            frozenHydrateCaption = nil
            finishKiteAuth(loggedIn: false)
            kiteAuthPhase = .idle
            kiteAuthMessage = ""
            pendingKiteLoginURL = nil
            progress = 0
            startProgressInterpolator()
            advance(.service, "Starting the local Stratji service…", complete: false)
        }
        refreshLogTail()

        if let startDataPlane {
            let status = await startDataPlane()
            refreshLogTail()
            switch status {
            case .live:
                break
            case .unavailable(let message, let needsFDA):
                offlineMessage = message
                needsFullDiskAccess = needsFDA
                serviceFailed = true
                isDegraded = true
                degradedNames = ["Local Stratji service"]
                sources = []
                completeHydrate()
                return
            case .checking, .starting:
                offlineMessage = "The local Stratji service is still starting."
                serviceFailed = true
                completeHydrate()
                return
            }
        }

        do {
            let health = try await client.flaskHealth(baseURL: baseURL)
            refreshLogTail()
            if !health.flaskReachable {
                throw StratjiClientError.gateway("The local Stratji service is not reachable.")
            }
        } catch {
            offlineMessage = "The local Stratji service did not become ready. Retry to start it again."
            serviceFailed = true
            isDegraded = true
            degradedNames = ["Local Stratji service"]
            refreshLogTail()
            completeHydrate()
            return
        }

        serviceFailed = false
        advance(.service, "Local Stratji service is up.")
        await loadLastHealthSessionDate()
        if showLoading {
            await promptKiteLoginIfNeeded()
        }
        var forceBundle = true
        if includeStartupScript {
            if incremental {
                advance(.kite, "Refreshing live sources…", complete: false)
#if os(macOS)
                let audited = await FlaskServiceSupervisor.runIncrementalRefresh { snapshot in
                    Task { @MainActor [weak self] in
                        await self?.applyProgress(snapshot)
                        self?.noteLogTick()
                    }
                }
                forceBundle = !audited
#endif
            } else {
                advance(.kite, "Refreshing Kite holdings, positions, orders, GTT, margins, and quotes…", complete: false)
#if os(macOS)
                let audited = await FlaskServiceSupervisor.runCompleteRefresh { snapshot in
                    Task { @MainActor [weak self] in
                        await self?.applyProgress(snapshot)
                        self?.noteLogTick()
                    }
                }
                forceBundle = !audited
#endif
            }
        } else {
            advance(.kite, "Refreshing Kite, Mail, Calendar, Reminders, Podcasts, sectors, and Health snapshot…", complete: false)
        }

        var refresh: DashboardRefreshDTO?
        let progressPoll = Task { [weak self] in
            while !Task.isCancelled {
                await self?.pollRefreshProgress()
                try? await Task.sleep(for: .milliseconds(400))
            }
        }
        do {
            refresh = try await client.refreshDashboard(baseURL: baseURL, force: forceBundle)
            if !forceBundle, !Self.containsAppleContent(refresh) {
                refresh = try await client.refreshDashboard(baseURL: baseURL, force: true)
            }
        } catch {
            isDegraded = true
            if !forceBundle {
                refresh = try? await client.refreshDashboard(baseURL: baseURL, force: true)
            }
        }
        progressPoll.cancel()
        await pollRefreshProgress()
        refreshLogTail()

        if let refresh {
            sources = refresh.sources ?? []
            kite = refresh.kite
            lastLoadedAt = Date()
        }

        applyStageFromSources()
        if kite == nil || kite?.hasUsableLiveSession != true {
            if let snapshot = try? await client.kiteSnapshot(baseURL: baseURL) {
                kite = snapshot
            }
        }
        integrations = try? await client.integrations(baseURL: baseURL)
        audit = try? await client.startupAudit(baseURL: baseURL)
        let healthFreshness = try? await client.healthFreshness(baseURL: baseURL)
        if let healthFreshness {
            rememberHealthSession(from: healthFreshness)
        }
        mergeFallbackSources(kite: kite, health: healthFreshness)
        refreshLogTail()

        evaluateRequiredSources(refreshReturnedRows: !(refresh?.sources ?? []).isEmpty)
        if showLoading {
            if kite?.hasUsableLiveSession != true {
                await promptKiteLoginIfNeeded()
                if let latest = try? await client.kiteSnapshot(baseURL: baseURL, timeout: 12),
                   latest.hasUsableLiveSession {
                    kite = latest
                }
            }
            startupRefreshCompleted = true
            await waitForDocumentReady()
            completeHydrate()
            startPeriodicRefresh()
        }
    }

    var currentDestination: DashboardDestination {
        DashboardOutline.destination(id: destinationID)?.clickTarget
            ?? DashboardOutline.defaultDestination(forView: workspace.rawValue)
    }

    func select(_ destination: DashboardDestination) {
        let target = destination.clickTarget
        destinationID = target.id
        workspace = StratjiWorkspace(rawValue: target.view) ?? .investment
        NSLog("[Stratji] session.select %@ → %@/%@", destination.id, target.view, target.section ?? "")
        document.load(baseURL: baseURL, destination: target, force: false)
    }

    private func promptKiteLoginIfNeeded() async {
        advance(.kite, "Checking the Kite session…", complete: false)
        let snapshot = try? await client.kiteSnapshot(baseURL: baseURL, timeout: 12)
        if let snapshot {
            kite = snapshot
        }
        if snapshot?.hasUsableLiveSession == true {
            return
        }

        var shouldPrompt = snapshot == nil || snapshot?.needsSplashLogin == true
        if pendingKiteLoginURL == nil {
            if let login = try? await client.kiteLogin(baseURL: baseURL, force: false),
               let raw = login.loginUrl,
               let url = StratjiKiteAuth.resolvedLoginURL(raw, baseURL: baseURL) {
                pendingKiteLoginURL = url
                shouldPrompt = true
            }
        }
        guard shouldPrompt else { return }

        let expired = snapshot?.authStatus == "expired"
        stageLabel = expired ? "Kite session expired — log in to Kite" : "Log in to Kite to load live holdings"
        kiteAuthMessage = expired
            ? "Zerodha access tokens expire around 06:00 IST. Log in now for live holdings, or continue with the last validated snapshot."
            : "Live Kite data needs a Zerodha login. Cached holdings stay available if you continue without it. Stratji will not invent live quotes."
        let didLogin = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            kiteAuthContinuation = continuation
            kiteAuthPhase = .prompt
        }
        pendingKiteLoginURL = nil
        kiteAuthPhase = .idle
        kiteAuthMessage = ""
        if didLogin {
            stageLabel = "Kite session is live. Continuing refresh…"
        } else {
            stageLabel = "Continuing with the last validated Kite snapshot…"
        }
    }

    private func openKiteLoginFromSplash() async {
        kiteAuthPhase = .waitingForBrowser
        kiteAuthMessage = "Complete Zerodha login in your browser. Stratji continues automatically after the callback reaches this Mac (127.0.0.1)."
        stageLabel = "Waiting for Kite login…"

        if pendingKiteLoginURL == nil {
            do {
                let login = try await client.kiteLogin(baseURL: baseURL, force: true)
                if login.status == "error" || login.loginUrl == nil {
                    kiteAuthMessage = login.message ?? "Could not create a Kite login URL. Continue with cached data or try again."
                    kiteAuthPhase = .prompt
                    return
                }
                pendingKiteLoginURL = login.loginUrl.flatMap { StratjiKiteAuth.resolvedLoginURL($0, baseURL: baseURL) }
            } catch {
                kiteAuthMessage = "Could not open Kite login. Continue with cached data or try again."
                kiteAuthPhase = .prompt
                return
            }
        }

        guard let loginURL = pendingKiteLoginURL else {
            kiteAuthMessage = "Could not create a Kite login URL. Continue with cached data or try again."
            kiteAuthPhase = .prompt
            return
        }

#if os(macOS)
        StratjiKiteAuth.openInBrowser(loginURL)
#endif

        while kiteAuthPhase == .waitingForBrowser {
            if let latest = try? await client.kiteSnapshot(baseURL: baseURL, timeout: 12),
               latest.hasUsableLiveSession {
                kite = latest
                stageLabel = "Kite session is live. Continuing refresh…"
                finishKiteAuth(loggedIn: true)
#if os(macOS)
                NSApp.activate(ignoringOtherApps: true)
#endif
                return
            }
            try? await Task.sleep(for: .seconds(2))
        }
    }

    private func finishKiteAuth(loggedIn: Bool) {
        kiteAuthPhase = .idle
        kiteAuthMessage = ""
        guard let continuation = kiteAuthContinuation else { return }
        kiteAuthContinuation = nil
        continuation.resume(returning: loggedIn)
    }

    private func applyStageFromSources() {
        func mark(_ name: String, _ loadStage: StratjiLoadStage) {
            guard let row = source(name) else { return }
            if !row.state.isReady {
                failedStages.insert(loadStage)
            }
            completedStages.insert(loadStage)
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

    private func mergeFallbackSources(kite: KiteSnapshotDTO?, health: HealthFreshnessDTO?) {
        func upsert(_ name: String, state: StratjiSourceState, observedAt: String?, message: String?) {
            guard source(name) == nil else { return }
            sources.append(SourceFreshnessDTO(source: name, state: state, observedAt: observedAt, required: true, message: message))
        }
        if let kite {
            upsert("Kite", state: kite.sourceState, observedAt: kite.asOf, message: kite.message)
        }
        if let health {
            upsert("Apple Health export", state: health.sourceState, observedAt: health.capturedAt ?? health.completedHealthThrough, message: health.message)
        }
    }

    private func evaluateRequiredSources(refreshReturnedRows: Bool) {
        var failed: [String] = []
        func require(_ name: String, ready: (StratjiSourceState) -> Bool) {
            guard let row = source(name) else {
                if refreshReturnedRows || audit?.isCurrent != true {
                    failed.append("\(name) (missing)")
                }
                return
            }
            if !ready(row.state) {
                failed.append("\(name) (\(row.state.label))")
            }
        }

        require("Kite") { $0 == .live }
        require("NSE benchmarks") { $0 == .live }
        require("iCloud / Newsletters") { $0 == .live }
        require("Apple Podcasts") { $0 == .live }
        require("Earnings") { $0 == .verified }
        require("Apple Health export") { $0 == .live || $0 == .verified }

        if let audit, !audit.isCurrent {
            for name in audit.failedSources ?? [] {
                if !failed.contains(where: { $0.localizedCaseInsensitiveContains(name) }) {
                    failed.append(name)
                }
            }
        }

        if !refreshReturnedRows, failed.isEmpty, audit?.isCurrent != true, sources.isEmpty {
            failed.append("Dashboard refresh did not return source rows")
        }

        degradedNames = failed
        isDegraded = !failed.isEmpty
    }

    private func waitForDocumentReady() async {
        document.load(baseURL: baseURL, destination: currentDestination, force: true)
        let deadline = Date().addingTimeInterval(25)
        while document.isLoading, Date() < deadline {
            try? await Task.sleep(for: .milliseconds(120))
        }
    }

    private func completeHydrate() {
        guard isBootstrapping else { return }
        freezeHydrateCaptionIfNeeded()
        stage = .hydrate
        completedStages.insert(.hydrate)
        stopProgressInterpolator()
        withAnimation(.easeInOut(duration: SplashProgressInterpolator.animationDuration)) {
            progress = 1
        }
        isBootstrapping = false
    }

    private func applyProgress(_ snapshot: StratjiRefreshProgressSnapshot) async {
        latestProgressSnapshot = snapshot
        failedStages = snapshot.failed
        completedStages = snapshot.completed.subtracting([.hydrate])
        committedProgress = min(max(snapshot.percent, 0), StratjiLoadStage.hydrate.startProgress)
        if snapshot.stage == .health || snapshot.failed.contains(.health) {
            await loadLastHealthSessionDate()
        }
        guard isBootstrapping else { return }
        if stage == .hydrate {
            freezeHydrateCaptionIfNeeded()
            refreshLogTail()
            return
        }
        if stage == snapshot.stage {
            stageLabel = caption(for: snapshot)
        }
        refreshLogTail()
    }

    private func startProgressInterpolator() {
        interpolatorTask?.cancel()
        stageEnteredAt = Date()
        interpolatorTask = Task { @MainActor [weak self] in
            while let self, !Task.isCancelled, self.isBootstrapping {
                self.tickSplashProgress()
                try? await Task.sleep(for: .milliseconds(100))
            }
        }
    }

    private func stopProgressInterpolator() {
        interpolatorTask?.cancel()
        interpolatorTask = nil
    }

    private func tickSplashProgress() {
        guard isBootstrapping else { return }
        if kiteAuthPhase != .idle {
            if stage != .kite {
                adoptDisplayedStage(.kite, snapshot: latestProgressSnapshot)
            }
            let elapsed = Date().timeIntervalSince(stageEnteredAt)
            let target = SplashProgressInterpolator.displayedProgress(
                stage: .kite,
                elapsed: elapsed,
                committed: max(committedProgress, StratjiLoadStage.kite.startProgress),
                stageCompleted: false
            )
            withAnimation(.easeInOut(duration: SplashProgressInterpolator.animationDuration)) {
                progress = max(progress, target)
            }
            return
        }
        let snapshot = latestProgressSnapshot
        let snapshotStage = snapshot?.stage ?? stage
        let completed = (snapshot?.completed ?? []).union(completedStages).subtracting([.hydrate])
        if let next = SplashProgressInterpolator.nextStage(
            current: stage,
            snapshotStage: snapshotStage,
            completed: completed,
            hydrateReady: snapshot?.isHydrateReady ?? false
        ) {
            adoptDisplayedStage(next, snapshot: snapshot)
        }

        if stage == .hydrate {
            freezeHydrateCaptionIfNeeded()
            let hydrateElapsed = Date().timeIntervalSince(stageEnteredAt)
            if !document.isLoading || hydrateElapsed >= SplashProgressInterpolator.hydrateTimeout {
                completeHydrate()
                return
            }
            let target = SplashProgressInterpolator.displayedProgress(
                stage: .hydrate,
                elapsed: hydrateElapsed,
                committed: max(committedProgress, StratjiLoadStage.hydrate.startProgress),
                stageCompleted: false
            )
            withAnimation(.easeInOut(duration: SplashProgressInterpolator.animationDuration)) {
                progress = max(progress, target)
            }
            return
        }

        if let snapshot, stage == snapshot.stage {
            stageLabel = caption(for: snapshot)
        }

        let elapsed = Date().timeIntervalSince(stageEnteredAt)
        let stageCompleted = completed.contains(stage)
        let committed = max(committedProgress, stage.startProgress)
        let target = SplashProgressInterpolator.displayedProgress(
            stage: stage,
            elapsed: elapsed,
            committed: committed,
            stageCompleted: stageCompleted
        )
        withAnimation(.easeInOut(duration: SplashProgressInterpolator.animationDuration)) {
            progress = max(progress, target)
        }
    }

    private func adoptDisplayedStage(_ next: StratjiLoadStage, snapshot: StratjiRefreshProgressSnapshot?) {
        stage = next
        stageEnteredAt = Date()
        if next == .hydrate {
            freezeHydrateCaptionIfNeeded()
            document.load(baseURL: baseURL, destination: currentDestination, force: true)
        } else if let snapshot, snapshot.stage == next {
            stageLabel = caption(for: snapshot)
        } else {
            stageLabel = next.loadingLabel
        }
        let floor = next.startProgress
        if progress < floor {
            withAnimation(.easeInOut(duration: SplashProgressInterpolator.animationDuration)) {
                progress = floor
            }
        }
    }

    private func freezeHydrateCaptionIfNeeded() {
        let computed = hydrateCaption()
        if frozenHydrateCaption == nil {
            frozenHydrateCaption = computed
        } else if frozenHydrateCaption == "Last Health Session unavailable",
                  computed.hasPrefix("Last Health Session on ") {
            frozenHydrateCaption = computed
        }
        if let frozenHydrateCaption {
            stageLabel = frozenHydrateCaption
        }
    }

    private func caption(for snapshot: StratjiRefreshProgressSnapshot) -> String {
        if snapshot.stage == .health, snapshot.failed.contains(.health) || snapshot.state == "failed" {
            return lastHealthSessionCaption()
        }
        let label = snapshot.label.trimmingCharacters(in: .whitespacesAndNewlines)
        if label.isEmpty { return snapshot.stage.loadingLabel }
        if captionBelongs(label, to: snapshot.stage) { return label }
        return snapshot.stage.loadingLabel
    }

    private func hydrateCaption() -> String {
        if failedStages.contains(.health) {
            return lastHealthSessionCaption()
        }
        return "Opening the dashboard…"
    }

    /// Splash copy when Health is stale or unavailable. Date comes from snapshot `dataDate`.
    private func lastHealthSessionCaption() -> String {
        if let formatted = Self.formatHealthSessionDate(lastHealthSessionDateKey) {
            return "Last Health Session on \(formatted)"
        }
        return "Last Health Session unavailable"
    }

    private func loadLastHealthSessionDate() async {
        if healthSessionResolved { return }
        guard let health = try? await client.healthFreshness(baseURL: baseURL) else { return }
        rememberHealthSession(from: health)
    }

    private func rememberHealthSession(from health: HealthFreshnessDTO) {
        lastHealthSessionDateKey = Self.sessionDate(from: health)
        healthSessionResolved = true
    }

    /// Prefer snapshot `dataDate`; fall back to `completedHealthThrough`. Never uses the Health operational target.
    static func sessionDate(from health: HealthFreshnessDTO) -> String? {
        let raw = health.dataDate ?? health.completedHealthThrough
        let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else { return nil }
        return String(trimmed.prefix(10))
    }

    /// Formats `YYYY-MM-DD` as `16 Aug 2026`. Returns nil if the value is missing or unparseable.
    static func formatHealthSessionDate(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let day = String(raw.trimmingCharacters(in: .whitespacesAndNewlines).prefix(10))
        guard day.count == 10 else { return nil }
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "Asia/Kolkata")
        parser.dateFormat = "yyyy-MM-dd"
        parser.isLenient = false
        guard let date = parser.date(from: day) else { return nil }
        let output = DateFormatter()
        output.calendar = Calendar(identifier: .gregorian)
        output.locale = Locale(identifier: "en_GB")
        output.timeZone = TimeZone(identifier: "Asia/Kolkata")
        output.dateFormat = "d MMM yyyy"
        return output.string(from: date)
    }

    private func captionBelongs(_ label: String, to stage: StratjiLoadStage) -> Bool {
        let lower = label.lowercased()
        switch stage {
        case .service: return lower.contains("service") || lower.contains("starting stratji")
        case .kite: return lower.contains("kite")
        case .mail: return lower.contains("newsletter") || (lower.contains("mail") && !lower.contains("calendar"))
        case .axis: return lower.contains("axis")
        case .calendar: return lower.contains("calendar")
        case .reminders: return lower.contains("reminder")
        case .podcasts: return lower.contains("podcast")
        case .sectors: return lower.contains("sector")
        case .earnings: return lower.contains("earning")
        case .health: return lower.contains("health")
        case .hydrate: return lower.contains("dashboard") || lower.contains("opening") || lower.contains("hydrate") || lower.contains("last health session")
        }
    }

    private func pollRefreshProgress() async {
#if os(macOS)
        if let repoRoot = StratjiConfiguration.repoRoot,
           let snapshot = FlaskServiceSupervisor.latestRefreshProgress(repoRoot: repoRoot) {
            await applyProgress(snapshot)
        }
#endif
        if let dto = try? await client.startupProgress(baseURL: baseURL) {
            await applyProgress(StratjiRefreshProgress.from(dto: dto))
        }
        refreshLogTail()
    }

    private func advance(_ stage: StratjiLoadStage, _ label: String, complete: Bool = true) {
        self.stage = stage
        stageLabel = label
        stageEnteredAt = Date()
        if complete {
            completedStages.insert(stage)
        }
        let interpolating = interpolatorTask != nil && isBootstrapping
        let target: Double
        if interpolating {
            target = max(progress, stage.startProgress)
        } else if stage == .hydrate {
            target = complete ? 1 : stage.startProgress
        } else {
            target = complete ? min(stage.endProgress, StratjiLoadStage.hydrate.startProgress) : max(progress, stage.startProgress)
        }
        withAnimation(.easeInOut(duration: SplashProgressInterpolator.animationDuration)) {
            progress = target
        }
        refreshLogTail()
    }

    private func refreshLogTail() {
        logTail = logProvider?() ?? logTail
    }

    private func source(_ name: String) -> SourceFreshnessDTO? {
        sources.first { $0.source.caseInsensitiveCompare(name) == .orderedSame }
    }

    private static func containsAppleContent(_ refresh: DashboardRefreshDTO?) -> Bool {
        refresh?.sources?.contains { $0.source.localizedCaseInsensitiveContains("Newsletters") } == true
    }

    private func restoreCompletedActions() {
        let today = Self.localDayKey()
        let storedDay = UserDefaults.standard.string(forKey: completedDayKey)
        if storedDay != today {
            completedIds = []
            UserDefaults.standard.set(today, forKey: completedDayKey)
            UserDefaults.standard.set([String](), forKey: completedDefaultsKey)
            return
        }
        let stored = UserDefaults.standard.stringArray(forKey: completedDefaultsKey) ?? []
        completedIds = Set(stored)
    }

    private func persistCompletedActions() {
        UserDefaults.standard.set(Self.localDayKey(), forKey: completedDayKey)
        UserDefaults.standard.set(Array(completedIds), forKey: completedDefaultsKey)
    }

    private static func localDayKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
