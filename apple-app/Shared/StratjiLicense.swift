import Foundation

enum StratjiLicenseTier: String, Codable, CaseIterable, Identifiable {
    case basic
    case pro
    case ultra

    var id: String { rawValue }

    var title: String {
        switch self {
        case .basic: "Basic"
        case .pro: "Pro"
        case .ultra: "Ultra"
        }
    }

    var rank: Int {
        switch self {
        case .basic: 0
        case .pro: 1
        case .ultra: 2
        }
    }

    func allows(_ feature: StratjiLicenseFeature) -> Bool {
        rank >= feature.requiredTier.rank
    }
}

enum StratjiLicenseFeature: String {
    case investment
    case sectors
    case sectorsS3
    case intelligence
    case health
    case pdf
    case builder
    case strategies
    case streak
    case integrations

    var requiredTier: StratjiLicenseTier {
        switch self {
        case .investment, .sectors, .integrations:
            return .basic
        case .sectorsS3, .intelligence, .health, .pdf:
            return .pro
        case .builder, .strategies, .streak:
            return .ultra
        }
    }

    static func workspace(_ workspace: StratjiWorkspace) -> StratjiLicenseFeature {
        switch workspace {
        case .investment: .investment
        case .sectors: .sectors
        case .intelligence: .intelligence
        case .health: .health
        case .builder: .builder
        case .strategies: .strategies
        }
    }
}

struct StratjiLicenseSnapshot: Equatable {
    var tier: StratjiLicenseTier
    var key: String
    var operatorOverride: Bool
    var author: Bool
    var operatorTier: StratjiLicenseTier?
    var updatedAt: String

    static let basic = StratjiLicenseSnapshot(
        tier: .basic,
        key: "",
        operatorOverride: false,
        author: false,
        operatorTier: nil,
        updatedAt: ""
    )

    func allows(_ workspace: StratjiWorkspace) -> Bool {
        tier.allows(StratjiLicenseFeature.workspace(workspace))
    }

    func allows(_ feature: StratjiLicenseFeature) -> Bool {
        tier.allows(feature)
    }
}

enum StratjiLicenseStore {
    private static let defaultsKey = "StratjiLicenseJSON"

    static var fileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Stratji", isDirectory: true)
            .appendingPathComponent("license.json")
    }

    static func current() -> StratjiLicenseSnapshot {
        if let fromFile = readFile() {
            let resolved = resolve(fromFile)
            if resolved.author || isMasterKey(resolved.key) { return resolved }
            if let master = repoMasterKey() {
                return StratjiLicenseSnapshot(tier: .ultra, key: master, operatorOverride: false, author: true, operatorTier: .ultra, updatedAt: resolved.updatedAt)
            }
            return resolved
        }
        if let data = UserDefaults.standard.data(forKey: defaultsKey),
           let stored = try? JSONDecoder().decode(Stored.self, from: data) {
            return resolve(stored)
        }
        if let master = repoMasterKey() {
            return StratjiLicenseSnapshot(tier: .ultra, key: master, operatorOverride: false, author: true, operatorTier: .ultra, updatedAt: "")
        }
        return .basic
    }

    static func allows(_ workspace: StratjiWorkspace) -> Bool {
        current().allows(workspace)
    }

    @discardableResult
    static func ensureAuthorLicense() -> StratjiLicenseSnapshot {
        let stored = readFile()
        let existing = stored.map(resolve) ?? current()
        if parseKey(existing.key) != nil, !isMasterKey(existing.key), existing.author == false {
            return existing
        }
        let key = repoMasterKey() ?? (isMasterKey(existing.key) ? existing.key : "")
        guard !key.isEmpty else { return existing }
        let snapshot = StratjiLicenseSnapshot(
            tier: .ultra,
            key: key,
            operatorOverride: false,
            author: true,
            operatorTier: .ultra,
            updatedAt: existing.updatedAt.isEmpty ? ISO8601DateFormatter().string(from: Date()) : existing.updatedAt
        )
        if existing.author, existing.tier == .ultra, existing.key == key, existing.operatorTier == .ultra {
            return existing
        }
        try? save(snapshot)
        return snapshot
    }

    static func save(_ snapshot: StratjiLicenseSnapshot) throws {
        let stored = Stored(
            version: 1,
            tier: snapshot.tier.rawValue,
            key: snapshot.key,
            operatorOverride: snapshot.operatorOverride,
            author: snapshot.author,
            operatorTier: snapshot.operatorTier?.rawValue ?? snapshot.tier.rawValue,
            updatedAt: snapshot.updatedAt.isEmpty ? ISO8601DateFormatter().string(from: Date()) : snapshot.updatedAt
        )
        let data = try JSONEncoder().encode(stored)
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: fileURL, options: [.atomic])
        UserDefaults.standard.set(data, forKey: defaultsKey)
        if let json = String(data: data, encoding: .utf8) {
            let pretty = prettyJSON(from: stored) ?? json
            try pretty.write(to: fileURL, atomically: true, encoding: .utf8)
        }
    }

    private struct Stored: Codable {
        var version: Int?
        var tier: String?
        var key: String?
        var operatorOverride: Bool?
        var author: Bool?
        var operatorTier: String?
        var updatedAt: String?
    }

    private static func prettyJSON(from stored: Stored) -> String? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(stored), let text = String(data: data, encoding: .utf8) else {
            return nil
        }
        return text.hasSuffix("\n") ? text : text + "\n"
    }

    private static func readFile() -> Stored? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(Stored.self, from: data)
    }

    private static func resolve(_ stored: Stored) -> StratjiLicenseSnapshot {
        let key = stored.key?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if stored.author == true || isMasterKey(key) {
            return StratjiLicenseSnapshot(
                tier: .ultra,
                key: key,
                operatorOverride: false,
                author: true,
                operatorTier: .ultra,
                updatedAt: stored.updatedAt ?? ""
            )
        }
        if let fromKey = parseKey(key) {
            return StratjiLicenseSnapshot(
                tier: fromKey,
                key: key,
                operatorOverride: false,
                author: false,
                operatorTier: fromKey,
                updatedAt: stored.updatedAt ?? ""
            )
        }
        if stored.operatorOverride == true, let tier = StratjiLicenseTier(rawValue: stored.tier ?? "") {
            return StratjiLicenseSnapshot(
                tier: tier,
                key: key,
                operatorOverride: true,
                author: false,
                operatorTier: StratjiLicenseTier(rawValue: stored.operatorTier ?? "") ?? tier,
                updatedAt: stored.updatedAt ?? ""
            )
        }
        if let envKey = ProcessInfo.processInfo.environment["STRATJI_LICENSE_KEY"],
           let fromEnv = parseKey(envKey) {
            return StratjiLicenseSnapshot(tier: fromEnv, key: envKey, operatorOverride: false, author: false, operatorTier: fromEnv, updatedAt: stored.updatedAt ?? "")
        }
        if let envTier = ProcessInfo.processInfo.environment["STRATJI_LICENSE_TIER"],
           let tier = StratjiLicenseTier(rawValue: envTier.lowercased()) {
            return StratjiLicenseSnapshot(tier: tier, key: "", operatorOverride: false, author: false, operatorTier: tier, updatedAt: stored.updatedAt ?? "")
        }
        return .basic
    }

    static func webBootstrapScript() -> String {
        let snapshot = current()
        let source = snapshot.author ? "author" : (snapshot.key.isEmpty ? "default" : "key")
        return """
        document.documentElement.dataset.licenseTier = "\(snapshot.tier.rawValue)";
        document.documentElement.dataset.licenseSource = "\(source)";
        """
    }

    static func isMasterKey(_ raw: String) -> Bool {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let regex = try? NSRegularExpression(pattern: "^(?:stratji[-_])ultra[-_]master[-_](.+)$", options: [.caseInsensitive]) else {
            return false
        }
        let range = NSRange(key.startIndex..<key.endIndex, in: key)
        guard let match = regex.firstMatch(in: key, options: [], range: range),
              match.numberOfRanges >= 2,
              let tokenRange = Range(match.range(at: 1), in: key) else {
            return false
        }
        return String(key[tokenRange]).trimmingCharacters(in: .whitespacesAndNewlines).count >= 4
    }

    static func parseKey(_ raw: String) -> StratjiLicenseTier? {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if isMasterKey(key) { return .ultra }
        guard let regex = try? NSRegularExpression(pattern: "^(?:stratji[-_])(basic|pro|ultra)[-_](.+)$", options: [.caseInsensitive]) else {
            return nil
        }
        let range = NSRange(key.startIndex..<key.endIndex, in: key)
        guard let match = regex.firstMatch(in: key, options: [], range: range),
              match.numberOfRanges >= 3,
              let tierRange = Range(match.range(at: 1), in: key),
              let tokenRange = Range(match.range(at: 2), in: key) else {
            return nil
        }
        let token = String(key[tokenRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard token.count >= 4 else { return nil }
        return StratjiLicenseTier(rawValue: String(key[tierRange]).lowercased())
    }

    static func repoMasterKey() -> String? {
        #if os(macOS)
        let root: URL?
        if let env = ProcessInfo.processInfo.environment["STRATJI_REPO_ROOT"], !env.isEmpty {
            root = URL(fileURLWithPath: env, isDirectory: true)
        } else if let stored = UserDefaults.standard.string(forKey: "StratjiRepoRoot"), !stored.isEmpty {
            root = URL(fileURLWithPath: stored, isDirectory: true)
        } else {
            root = nil
        }
        guard let root else { return nil }
        let url = root.appendingPathComponent("artifacts/private/license-master.txt")
        guard let text = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        let key = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return isMasterKey(key) ? key : nil
        #else
        return nil
        #endif
    }
}
