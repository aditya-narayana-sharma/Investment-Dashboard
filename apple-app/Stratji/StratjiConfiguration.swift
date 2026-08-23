import Darwin
import Foundation

enum StratjiConfiguration {
    static let applicationSupportDirectoryName = "Stratji"
    static let repoRootFilename = "repo-root"
    static let repoRootDefaultsKey = "StratjiRepoRoot"
    static let launchAgentLabel = "com.adityasharma.portfolio-intelligence"
    static let trampolineFilename = "run-service.sh"
    static let startCommandFilename = "start-dashboard.command"
    static let defaultDashboardURL = URL(string: "http://127.0.0.1:5050/")!
    static let healthPath = "/_flask/health"
    static let startScriptRelativePath = "scripts/start-flask-app.sh"
    static let stopScriptRelativePath = "scripts/stop-flask-app.sh"
    static let setupScriptRelativePath = "scripts/setup-flask-app.sh"
    static let serviceScriptRelativePath = "scripts/run-dashboard-service.sh"
    static let refreshScriptRelativePath = "scripts/refresh-dashboard-data.sh"

    static var dashboardURL: URL {
        let envKeys = ["STRATJI_DASHBOARD_URL", "PORTFOLIO_DESKTOP_URL"]
        for key in envKeys {
            if let value = ProcessInfo.processInfo.environment[key],
               let url = URL(string: value),
               url.scheme == "http" || url.scheme == "https" {
                return url
            }
        }
        if let bundled = Bundle.main.object(forInfoDictionaryKey: "StratjiDashboardURL") as? String,
           let url = URL(string: bundled),
           url.scheme == "http" || url.scheme == "https" {
            return url
        }
        return defaultDashboardURL
    }

    static var healthURL: URL {
        var components = URLComponents(url: dashboardURL, resolvingAgainstBaseURL: false)
        let basePath = components?.path ?? "/"
        let trimmedBase = basePath.hasSuffix("/") ? String(basePath.dropLast()) : basePath
        components?.path = trimmedBase + healthPath
        return components?.url ?? defaultDashboardURL
    }

    static var repoRoot: URL? {
        if let env = ProcessInfo.processInfo.environment["STRATJI_REPO_ROOT"], !env.isEmpty {
            return directoryIfValid(URL(fileURLWithPath: env, isDirectory: true))
        }

        if let stored = UserDefaults.standard.string(forKey: repoRootDefaultsKey), !stored.isEmpty {
            if let url = directoryIfValid(URL(fileURLWithPath: stored, isDirectory: true)) {
                return url
            }
        }

        let supportFile = applicationSupportDirectory.appendingPathComponent(repoRootFilename)
        if let contents = try? String(contentsOf: supportFile, encoding: .utf8) {
            let trimmed = contents.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                if let url = directoryIfValid(URL(fileURLWithPath: trimmed, isDirectory: true)) {
                    return url
                }
            }
        }

        if let bundled = Bundle.main.object(forInfoDictionaryKey: "StratjiRepoRoot") as? String,
           !bundled.isEmpty,
           bundled != "$(STRATJI_REPO_ROOT)" {
            return directoryIfValid(URL(fileURLWithPath: bundled, isDirectory: true))
        }

        return nil
    }

    static var startFlaskScript: URL? {
        scriptURL(relativePath: startScriptRelativePath)
    }

    static var stopFlaskScript: URL? {
        scriptURL(relativePath: stopScriptRelativePath)
    }

    static var setupFlaskScript: URL? {
        scriptURL(relativePath: setupScriptRelativePath)
    }

    static var runServiceScript: URL? {
        scriptURL(relativePath: serviceScriptRelativePath)
    }

    static var trampolineScript: URL {
        applicationSupportDirectory.appendingPathComponent(trampolineFilename)
    }

    static var startCommand: URL {
        applicationSupportDirectory.appendingPathComponent(startCommandFilename)
    }

    static var launchAgentPlist: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/LaunchAgents/\(launchAgentLabel).plist")
    }

    static var launchAgentTarget: String {
        "gui/\(getuid())/\(launchAgentLabel)"
    }

    static var applicationSupportDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
                .appendingPathComponent("Library/Application Support", isDirectory: true)
        return base.appendingPathComponent(applicationSupportDirectoryName, isDirectory: true)
    }

    static var logDirectory: URL {
        URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
            .appendingPathComponent("Library/Logs/PortfolioIntelligence", isDirectory: true)
    }

    static func persistRepoRoot() {
        guard let repoRoot else { return }
        UserDefaults.standard.set(repoRoot.path, forKey: repoRootDefaultsKey)
        try? FileManager.default.createDirectory(at: applicationSupportDirectory, withIntermediateDirectories: true)
        let supportFile = applicationSupportDirectory.appendingPathComponent(repoRootFilename)
        try? (repoRoot.path + "\n").write(to: supportFile, atomically: true, encoding: .utf8)
        writeLaunchAgent()
    }

    static func writeLaunchAgent() {
        guard let repoRoot else { return }
        let fm = FileManager.default
        try? fm.createDirectory(at: applicationSupportDirectory, withIntermediateDirectories: true)
        let trampoline = trampolineScript
        let script = """
        #!/bin/bash
        set -euo pipefail
        LOG_DIR="$HOME/Library/Logs/PortfolioIntelligence"
        SUPPORT_DIR="$HOME/Library/Application Support/Stratji"
        START_SCRIPT="$SUPPORT_DIR/start-dashboard.command"
        mkdir -p "$LOG_DIR"
        flask_bound() {
          body=$(curl -sS --max-time 8 http://127.0.0.1:5050/_flask/health 2>/dev/null || true)
          printf '%s' "$body" | grep -q '"gateway": "flask"'
        }
        while true; do
          if flask_bound; then
            sleep 12
            continue
          fi
          # Invoke with bash. Never `open` a .command file — Launch Services attaches Terminal.app.
          if [[ -f "$START_SCRIPT" ]]; then
            /bin/bash "$START_SCRIPT" >>"$LOG_DIR/desktop-app.log" 2>&1 || true
          fi
          sleep 20
        done
        """
        try? script.write(to: trampoline, atomically: true, encoding: .utf8)
        try? fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: trampoline.path)

        let command = """
        #!/bin/bash
        # Headless wrapper. Invoke with /bin/bash — do not `open` this .command file.
        set -euo pipefail
        ROOT_DIR=$(cat "$HOME/Library/Application Support/Stratji/repo-root" 2>/dev/null || true)
        if [[ -z "$ROOT_DIR" || ! -d "$ROOT_DIR" ]]; then
          ROOT_DIR=\(shellQuote(repoRoot.path))
        fi
        export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        exec /bin/bash "$ROOT_DIR/scripts/start-flask-app.sh"
        """
        try? command.write(to: startCommand, atomically: true, encoding: .utf8)
        try? fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: startCommand.path)

        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
          <key>Label</key>
          <string>\(launchAgentLabel)</string>
          <key>ProgramArguments</key>
          <array>
            <string>/bin/bash</string>
            <string>\(trampoline.path)</string>
          </array>
          <key>WorkingDirectory</key>
          <string>\(applicationSupportDirectory.path)</string>
          <key>EnvironmentVariables</key>
          <dict>
            <key>PATH</key>
            <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
            <key>HOME</key>
            <string>\(NSHomeDirectory())</string>
          </dict>
          <key>RunAtLoad</key>
          <true/>
          <key>KeepAlive</key>
          <dict>
            <key>SuccessfulExit</key>
            <false/>
          </dict>
          <key>ProcessType</key>
          <string>Background</string>
          <key>ThrottleInterval</key>
          <integer>10</integer>
          <key>StandardOutPath</key>
          <string>\(logDirectory.path)/launchd.out.log</string>
          <key>StandardErrorPath</key>
          <string>\(logDirectory.path)/launchd.err.log</string>
        </dict>
        </plist>
        """
        let agents = fm.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents", isDirectory: true)
        try? fm.createDirectory(at: agents, withIntermediateDirectories: true)
        try? plist.write(to: launchAgentPlist, atomically: true, encoding: .utf8)
    }

    private static func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    private static func directoryIfValid(_ url: URL) -> URL? {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return nil
        }
        return url
    }

    private static func scriptURL(relativePath: String) -> URL? {
        guard let repoRoot else { return nil }
        let url = repoRoot.appendingPathComponent(relativePath)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }
}
