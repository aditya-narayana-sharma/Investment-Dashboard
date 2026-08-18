import Darwin
import Foundation
#if os(macOS)
import AppKit
#endif

enum FlaskServiceStatus: Equatable {
    case checking
    case starting
    case live
    case unavailable(message: String, needsFullDiskAccess: Bool)
}

enum FlaskServiceSupervisor {
    private static let healthTimeout: TimeInterval = 3
    private static let pollLimit = 90
    /// Incremental ticks: source HTTP checks without a full Health XML re-extract.
    private static let incrementalRefreshTimeout: TimeInterval = 200
    /// Splash / Refresh all: Health ZIP validate+extract+import can take many minutes.
    private static let completeRefreshTimeout: TimeInterval = 35 * 60
    private static let launchLock = NSLock()
    nonisolated(unsafe) private static var headlessStartProcess: Process?

    static func isHealthy() async -> Bool {
        await isReachable()
    }

    static func isReachable() async -> Bool {
        var request = URLRequest(url: StratjiConfiguration.healthURL)
        request.timeoutInterval = healthTimeout
        request.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            if (200 ..< 300).contains(http.statusCode) {
                return true
            }
            if let health = try? JSONDecoder().decode(FlaskHealthDTO.self, from: data) {
                return health.serviceReady
            }
            return false
        } catch {
            return false
        }
    }

    static func logExcerpt(lines: Int = 24) -> String {
        lastLogExcerpt(lines: lines)
    }

    static func ensureRunning(onTick: (() -> Void)? = nil) async -> FlaskServiceStatus {
        StratjiConfiguration.persistRepoRoot()
        onTick?()
        let alreadyLive = await isReachable()
        appendDesktopLog(
            alreadyLive
                ? "Gateway reachable; replacing LaunchAgent watchdog without Terminal.app\n"
                : "Starting Stratji service via LaunchAgent \(StratjiConfiguration.launchAgentTarget)\n"
        )
        onTick?()
        await Task.detached {
            startViaLaunchd(startNow: !alreadyLive)
        }.value
        if alreadyLive {
            return .live
        }

        for _ in 0 ..< pollLimit {
            onTick?()
            if await isReachable() {
                return .live
            }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }

        return .unavailable(message: failureSummary().message, needsFullDiskAccess: failureSummary().needsFullDiskAccess)
    }

    /// Splash / Reload All: every source including Health ZIP ingest. Never sets `PORTFOLIO_SKIP_HEALTH_ZIP`.
    @discardableResult
    static func runCompleteRefresh(onProgress: ((StratjiRefreshProgressSnapshot) -> Void)? = nil) async -> Bool {
        await runRefreshScript(mode: "complete", timeout: completeRefreshTimeout, onProgress: onProgress)
    }

    /// Post-hydrate ticks: skip Health XML re-extract unless the export mtime changed.
    @discardableResult
    static func runIncrementalRefresh(onProgress: ((StratjiRefreshProgressSnapshot) -> Void)? = nil) async -> Bool {
        await runRefreshScript(mode: "incremental", timeout: incrementalRefreshTimeout, onProgress: onProgress)
    }

    @discardableResult
    private static func runRefreshScript(
        mode: String,
        timeout: TimeInterval,
        onProgress: ((StratjiRefreshProgressSnapshot) -> Void)?
    ) async -> Bool {
        guard let repoRoot = StratjiConfiguration.repoRoot else { return false }
        let script = repoRoot.appendingPathComponent(StratjiConfiguration.refreshScriptRelativePath)
        guard FileManager.default.fileExists(atPath: script.path) else { return false }

        let logDirectory = StratjiConfiguration.logDirectory
        let logFile = logDirectory.appendingPathComponent("startup-refresh.log")
        try? FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: logFile.path) {
            FileManager.default.createFile(atPath: logFile.path, contents: nil)
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [script.path]
        process.currentDirectoryURL = repoRoot
        var environment = ProcessInfo.processInfo.environment
        var dashboard = StratjiConfiguration.dashboardURL.absoluteString
        if dashboard.hasSuffix("/") { dashboard.removeLast() }
        environment["DASHBOARD_PUBLIC_URL"] = dashboard
        environment["PORTFOLIO_REFRESH_MODE"] = mode
        environment.removeValue(forKey: "PORTFOLIO_SKIP_HEALTH_ZIP")
        environment["PORTFOLIO_STARTUP_PROGRESS_PATH"] = repoRoot
            .appendingPathComponent("artifacts/private/startup-progress.json").path
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        process.environment = environment

        let publishProgress = {
            if let snapshot = latestRefreshProgress(repoRoot: repoRoot, logFile: logFile) {
                onProgress?(snapshot)
            }
        }
        let deadline = Date().addingTimeInterval(timeout)
        let healthNote = mode == "complete" ? "Health ZIP ingest enabled" : "Health ZIP re-extract only if export mtime changed"

        if let handle = try? FileHandle(forWritingTo: logFile) {
            handle.seekToEndOfFile()
            process.standardOutput = handle
            process.standardError = handle
            appendDesktopLog("Running \(script.lastPathComponent) (mode=\(mode); \(healthNote))\n")
            do {
                try process.run()
            } catch {
                appendDesktopLog("refresh-dashboard-data.sh failed to start: \(error.localizedDescription)\n")
                try? handle.close()
                return false
            }
            while process.isRunning {
                publishProgress()
                if Date() > deadline {
                    process.terminate()
                    appendDesktopLog("refresh-dashboard-data.sh timed out after \(Int(timeout))s\n")
                    break
                }
                try? await Task.sleep(for: .milliseconds(400))
            }
            try? handle.close()
            publishProgress()
            appendDesktopLog("refresh-dashboard-data.sh finished (\(process.terminationStatus))\n")
            return true
        }

        appendDesktopLog("Running \(script.lastPathComponent) (mode=\(mode); \(healthNote))\n")
        do {
            try process.run()
        } catch {
            appendDesktopLog("refresh-dashboard-data.sh failed to start: \(error.localizedDescription)\n")
            return false
        }
        while process.isRunning {
            publishProgress()
            if Date() > deadline {
                process.terminate()
                appendDesktopLog("refresh-dashboard-data.sh timed out after \(Int(timeout))s\n")
                break
            }
            try? await Task.sleep(for: .milliseconds(400))
        }
        publishProgress()
        appendDesktopLog("refresh-dashboard-data.sh finished (\(process.terminationStatus))\n")
        return true
    }

    static func latestRefreshProgress(repoRoot: URL, logFile: URL? = nil) -> StratjiRefreshProgressSnapshot? {
        let logs = StratjiConfiguration.logDirectory
        let progressFile = repoRoot.appendingPathComponent("artifacts/private/startup-progress.json")
        let logCopy = logs.appendingPathComponent("startup-progress.json")
        let json = StratjiRefreshProgress.merge(
            StratjiRefreshProgress.load(from: progressFile),
            StratjiRefreshProgress.load(from: logCopy)
        )
        let refreshLog = logFile ?? logs.appendingPathComponent("startup-refresh.log")
        let logUpdated = (try? refreshLog.resourceValues(forKeys: [URLResourceKey.contentModificationDateKey]))?.contentModificationDate ?? Date()
        let parsedLog: StratjiRefreshProgressSnapshot?
        if let text = try? String(contentsOf: refreshLog, encoding: .utf8) {
            parsedLog = StratjiRefreshProgress.parseLog(text, updatedAt: logUpdated)
        } else {
            parsedLog = nil
        }
        return StratjiRefreshProgress.merge(json, parsedLog)
    }

#if os(macOS)
    static func openConsoleLogs() {
        NSWorkspace.shared.open(StratjiConfiguration.logDirectory)
    }

    static func openFullDiskAccess() {
        let urls = [
            "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
            "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
        ]
        for value in urls {
            if let url = URL(string: value) {
                NSWorkspace.shared.open(url)
                return
            }
        }
    }
#endif

    private static func failureSummary() -> (message: String, needsFullDiskAccess: Bool) {
        let excerpt = lastLogExcerpt(lines: 40).lowercased()
        if excerpt.contains("operation not permitted") || excerpt.contains("getcwd") {
            return (
                "macOS blocked Stratji from starting the local service. Grant Full Disk Access, then Retry.",
                true
            )
        }
        if excerpt.contains("syntax error") {
            return ("The local Stratji service failed to start. Retry, then open Console logs if it happens again.", false)
        }
        if excerpt.contains("upstream") || excerpt.contains("did not start") || excerpt.contains("eaddrinuse") {
            return ("The dashboard document server did not come online. Retry to start it again.", false)
        }
        return ("The local Stratji service did not start. Retry, or grant Full Disk Access if macOS is blocking it.", true)
    }

    /// Writes the LaunchAgent, optionally starts the data plane, and replaces any
    /// older watchdog that used `open` on a `.command` file (that opens Terminal.app).
    nonisolated private static func startViaLaunchd(startNow: Bool) {
        launchLock.lock()
        defer { launchLock.unlock() }

        let logDirectory = StratjiConfiguration.logDirectory
        try? FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        StratjiConfiguration.writeLaunchAgent()

        if startNow {
            startHeadlessService()
        }
        recycleLaunchAgent()
    }

    /// Run Application Support `start-dashboard.command` with `/bin/bash`.
    /// Do not `open` that file — Launch Services would attach Terminal.app.
    nonisolated private static func startHeadlessService() {
        let command = StratjiConfiguration.startCommand
        guard FileManager.default.fileExists(atPath: command.path) else {
            appendDesktopLog("start-dashboard.command missing; LaunchAgent watchdog will retry\n")
            return
        }
        if let existing = headlessStartProcess, existing.isRunning {
            appendDesktopLog("headless start already running (pid \(existing.processIdentifier))\n")
            return
        }

        let logFile = StratjiConfiguration.logDirectory.appendingPathComponent("desktop-app.log")
        if !FileManager.default.fileExists(atPath: logFile.path) {
            FileManager.default.createFile(atPath: logFile.path, contents: nil)
        }
        guard let handle = try? FileHandle(forWritingTo: logFile) else {
            appendDesktopLog("could not open desktop-app.log for headless start\n")
            return
        }
        handle.seekToEndOfFile()

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [command.path]
        process.currentDirectoryURL = StratjiConfiguration.applicationSupportDirectory
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = handle
        process.standardError = handle
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        process.environment = environment

        do {
            try process.run()
            headlessStartProcess = process
            appendDesktopLog("started start-dashboard via bash (pid \(process.processIdentifier))\n")
        } catch {
            appendDesktopLog("headless start failed: \(error.localizedDescription)\n")
            try? handle.close()
        }
    }

    /// Reload the watchdog so a previously loaded `open .command` loop is replaced.
    /// The data plane is `nohup`'d by start-flask-app.sh, so bootout does not kill Flask/Next.
    nonisolated private static func recycleLaunchAgent() {
        let uid = getuid()
        let domain = "gui/\(uid)"
        let label = StratjiConfiguration.launchAgentLabel
        let target = "\(domain)/\(label)"
        let plist = StratjiConfiguration.launchAgentPlist

        if FileManager.default.fileExists(atPath: plist.path) {
            _ = runLaunchctl(["bootout", target])
            _ = runLaunchctl(["bootstrap", domain, plist.path])
            _ = runLaunchctl(["enable", target])
        }
        let kickstart = runLaunchctl(["kickstart", target])
        if kickstart.status != 0 {
            appendDesktopLog("launchctl kickstart failed (\(kickstart.status))\n")
        }
    }

    nonisolated private static func runLaunchctl(_ arguments: [String]) -> (status: Int32, output: String) {
        runTool(URL(fileURLWithPath: "/bin/launchctl"), arguments)
    }

    nonisolated private static func runTool(_ executable: URL, _ arguments: [String]) -> (status: Int32, output: String) {
        let process = Process()
        process.executableURL = executable
        process.arguments = arguments
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            let message = "\(executable.lastPathComponent) failed: \(error.localizedDescription)"
            appendDesktopLog(message + "\n")
            return (1, message)
        }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !output.isEmpty {
            appendDesktopLog("\(executable.lastPathComponent): \(output)\n")
        }
        return (process.terminationStatus, output)
    }

    nonisolated private static func lastLogExcerpt(lines: Int) -> String {
        let directory = StratjiConfiguration.logDirectory
        var chunks: [String] = []
        for name in ["desktop-app.log", "launchd.err.log", "vinext.log", "service.log"] {
            let url = directory.appendingPathComponent(name)
            guard let contents = try? String(contentsOf: url, encoding: .utf8) else { continue }
            let trimmed = contents
                .split(whereSeparator: \.isNewline)
                .suffix(name == "desktop-app.log" ? lines : 6)
                .map(String.init)
                .joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                chunks.append("— \(name) —\n\(trimmed)")
            }
        }
        return chunks.joined(separator: "\n\n")
    }

    nonisolated private static func appendDesktopLog(_ message: String) {
        let logDirectory = StratjiConfiguration.logDirectory
        try? FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        let logFile = logDirectory.appendingPathComponent("desktop-app.log")
        if !FileManager.default.fileExists(atPath: logFile.path) {
            FileManager.default.createFile(atPath: logFile.path, contents: nil)
        }
        guard let handle = try? FileHandle(forWritingTo: logFile) else { return }
        defer { try? handle.close() }
        handle.seekToEndOfFile()
        try? handle.write(contentsOf: Data(message.utf8))
    }
}
