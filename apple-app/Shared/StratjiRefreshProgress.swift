import Foundation

struct StratjiRefreshProgressSnapshot: Equatable {
    var stage: StratjiLoadStage
    var state: String
    var label: String
    var fraction: Double
    var completed: Set<StratjiLoadStage>
    var failed: Set<StratjiLoadStage>
    var updatedAt: Date

    static let epoch = Date(timeIntervalSince1970: 0)

    static func empty() -> StratjiRefreshProgressSnapshot {
        StratjiRefreshProgressSnapshot(
            stage: .service,
            state: "start",
            label: "Starting Stratji…",
            fraction: 0,
            completed: [],
            failed: [],
            updatedAt: epoch
        )
    }

    var percent: Double {
        if completed.contains(.hydrate) { return 1 }
        let stages = StratjiLoadStage.allCases
        let sourceDone = stages.filter { $0 != .hydrate && completed.contains($0) }.count
        let inProgress: Double
        if stage != .hydrate, !completed.contains(stage) {
            inProgress = min(max(fraction, 0), 0.99)
        } else {
            inProgress = 0
        }
        return (Double(sourceDone) + inProgress) / Double(stages.count)
    }

    var isHydrateReady: Bool {
        StratjiLoadStage.allCases
            .filter { $0 != .hydrate }
            .allSatisfy { completed.contains($0) }
    }
}

enum StratjiRefreshProgress {
    static func parseLog(_ text: String, updatedAt: Date = Date()) -> StratjiRefreshProgressSnapshot? {
        var snapshot: StratjiRefreshProgressSnapshot?
        for line in text.split(whereSeparator: \.isNewline) {
            let parts = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
            guard parts.count >= 3, parts[0] == "PROGRESS" else { continue }
            guard let event = event(
                stage: parts[1],
                state: parts[2],
                label: parts.count > 3 ? parts[3...].joined(separator: "\t") : "",
                updatedAt: updatedAt
            ) else { continue }
            snapshot = apply(event, onto: snapshot)
        }
        return snapshot
    }

    static func load(from url: URL) -> StratjiRefreshProgressSnapshot? {
        guard let data = try? Data(contentsOf: url),
              let dto = try? JSONDecoder().decode(StartupProgressDTO.self, from: data) else {
            return nil
        }
        return from(dto: dto)
    }

    static func from(dto: StartupProgressDTO) -> StratjiRefreshProgressSnapshot {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var updatedAt = StratjiRefreshProgressSnapshot.empty().updatedAt
        if let raw = dto.updatedAt {
            updatedAt = formatter.date(from: raw)
                ?? ISO8601DateFormatter().date(from: raw)
                ?? updatedAt
        }
        let completed = Set((dto.completed ?? []).compactMap(StratjiLoadStage.init(rawValue:)))
        let failed = Set((dto.failed ?? []).compactMap(StratjiLoadStage.init(rawValue:)))
        return StratjiRefreshProgressSnapshot(
            stage: StratjiLoadStage(rawValue: dto.stage ?? "service") ?? .service,
            state: dto.state ?? "start",
            label: dto.label ?? "",
            fraction: dto.fraction ?? 0,
            completed: completed,
            failed: failed,
            updatedAt: updatedAt
        )
    }

    static func merge(
        _ left: StratjiRefreshProgressSnapshot?,
        _ right: StratjiRefreshProgressSnapshot?
    ) -> StratjiRefreshProgressSnapshot? {
        guard let left else { return right }
        guard let right else { return left }
        // Never union completed across refresh cycles — that pinned splash at 10/11 (91%).
        return left.updatedAt >= right.updatedAt ? left : right
    }

    static func apply(
        _ incoming: StratjiRefreshProgressSnapshot,
        onto current: StratjiRefreshProgressSnapshot?
    ) -> StratjiRefreshProgressSnapshot {
        if incoming.stage == .service, incoming.state == "start" || incoming.state == "ok" || incoming.state == "failed" {
            return incoming
        }
        guard let current else { return incoming }
        var failed = current.failed.union(incoming.failed)
        if incoming.state == "ok" {
            failed.remove(incoming.stage)
        }
        return StratjiRefreshProgressSnapshot(
            stage: incoming.stage,
            state: incoming.state,
            label: incoming.label.isEmpty ? current.label : incoming.label,
            fraction: incoming.fraction,
            completed: current.completed.union(incoming.completed),
            failed: failed,
            updatedAt: incoming.updatedAt
        )
    }

    private static func event(
        stage rawStage: String,
        state: String,
        label: String,
        fraction: Double = 0,
        updatedAt: Date
    ) -> StratjiRefreshProgressSnapshot? {
        guard let stage = StratjiLoadStage(rawValue: rawStage) else { return nil }
        var completed: Set<StratjiLoadStage> = stage == .service ? [] : [.service]
        var failed: Set<StratjiLoadStage> = []
        switch state {
        case "ok", "failed", "ensure", "ensure-failed":
            completed.insert(stage)
            if state == "failed" || state == "ensure-failed" {
                failed.insert(stage)
            }
        default:
            break
        }
        return StratjiRefreshProgressSnapshot(
            stage: stage,
            state: state,
            label: label,
            fraction: (state == "ok" || state == "failed" || state == "ensure" || state == "ensure-failed") ? 1 : fraction,
            completed: completed,
            failed: failed,
            updatedAt: updatedAt
        )
    }
}

enum SplashProgressInterpolator {
    static let animationDuration: TimeInterval = 0.4
    static let tickMilliseconds: UInt64 = 100
    /// Time constant for 1 - e^(-t/τ). About 63% of the stage cap in 1.2s, ~95% by 3.6s.
    static let trickleTau: Double = 1.2
    /// Never fill the whole slice until the stage actually completes.
    static let trickleCap: Double = 0.88
    /// WKWebView hydrate must reach 100% and dismiss; do not sit on 88% of the last slice.
    static let hydrateTimeout: TimeInterval = 3

    static func sliceEnd(for stage: StratjiLoadStage) -> Double {
        stage == .hydrate ? 1 : min(stage.endProgress, StratjiLoadStage.hydrate.startProgress)
    }

    /// Ease toward 88% of the current stage slice, then sit until the stage completes.
    static func displayedProgress(
        stage: StratjiLoadStage,
        elapsed: TimeInterval,
        committed: Double,
        stageCompleted: Bool
    ) -> Double {
        let start = stage.startProgress
        let end = sliceEnd(for: stage)
        if stageCompleted {
            return end
        }
        let slice = max(end - start, 0)
        let trickled = start + slice * trickleCap * (1 - exp(-max(elapsed, 0) / trickleTau))
        let floor = min(max(committed, start), start + slice * trickleCap)
        return min(max(trickled, floor), start + slice * trickleCap)
    }

    /// Walk exactly one pipeline stage at a time so the highlight never skips.
    static func nextStage(
        current: StratjiLoadStage,
        snapshotStage: StratjiLoadStage,
        completed: Set<StratjiLoadStage>,
        hydrateReady: Bool
    ) -> StratjiLoadStage? {
        if current == .hydrate { return nil }
        let movedPast = snapshotStage.index > current.index || completed.contains(current)
        guard movedPast, let next = current.next else { return nil }
        if next == .hydrate {
            return hydrateReady || completed.contains(.health) ? next : nil
        }
        return next
    }
}

struct StartupProgressDTO: Codable, Equatable {
    var stage: String?
    var state: String?
    var label: String?
    var fraction: Double?
    var completed: [String]?
    var failed: [String]?
    var percent: Double?
    var updatedAt: String?
    var status: String?
}
