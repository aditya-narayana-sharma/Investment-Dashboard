import Foundation

enum StratjiLocalSecrets {
    struct LLMKeys: Equatable {
        var openai = ""
        var claude = ""
        var gemini = ""
        var cursor = ""

        var filledProviders: [String] {
            var names: [String] = []
            if !openai.isEmpty { names.append("OpenAI") }
            if !claude.isEmpty { names.append("Claude") }
            if !gemini.isEmpty { names.append("Gemini") }
            if !cursor.isEmpty { names.append("Cursor") }
            return names
        }
    }

    static func llmKeys() -> LLMKeys {
        var keys = LLMKeys()
        mergeJSON(url: repoFile(["artifacts", "private", "integrations-config.json"]), into: &keys)
        mergeJSON(url: supportFile("integrations-config.json"), into: &keys)
        mergeEnv(url: repoFile([".env"]), into: &keys)
        mergeEnv(url: repoFile([".env.local"]), into: &keys)
        mergeEnv(url: repoFile(["artifacts", "private", "auth0.env"]), into: &keys)
        return keys
    }

    private static func repoFile(_ parts: [String]) -> URL {
        var url = StratjiConfiguration.repoRoot ?? URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
        for part in parts {
            url.appendPathComponent(part)
        }
        return url
    }

    private static func supportFile(_ name: String) -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Stratji", isDirectory: true)
            .appendingPathComponent(name)
    }

    private static func mergeEnv(url: URL, into keys: inout LLMKeys) {
        guard let text = try? String(contentsOf: url, encoding: .utf8) else { return }
        apply(parseEnv(text), to: &keys)
    }

    private static func mergeJSON(url: URL, into keys: inout LLMKeys) {
        guard let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        let llm = object["llm"] as? [String: Any] ?? object
        apply(llm, to: &keys)
    }

    private static func apply(_ record: [String: Any], to keys: inout LLMKeys) {
        if keys.openai.isEmpty { keys.openai = firstSecret(record, ["openaiApiKey", "OPENAI_API_KEY", "OPENAI_KEY"]) }
        if keys.claude.isEmpty { keys.claude = firstSecret(record, ["anthropicApiKey", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY"]) }
        if keys.gemini.isEmpty { keys.gemini = firstSecret(record, ["geminiApiKey", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_GEMINI_API_KEY"]) }
        if keys.cursor.isEmpty { keys.cursor = firstSecret(record, ["cursorApiKey", "CURSOR_API_KEY", "CURSOR_API_TOKEN"]) }
    }

    private static func firstSecret(_ record: [String: Any], _ names: [String]) -> String {
        for name in names {
            if let value = usable(record[name] as? String) { return value }
        }
        return ""
    }

    private static func usable(_ raw: String?) -> String? {
        guard let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines), trimmed.count >= 8 else { return nil }
        if trimmed.range(of: "^(your[-_]?|changeme|placeholder|xxx+|todo|replace)", options: [.regularExpression, .caseInsensitive]) != nil {
            return nil
        }
        return trimmed
    }

    private static func parseEnv(_ text: String) -> [String: Any] {
        var out: [String: Any] = [:]
        for line in text.split(whereSeparator: \.isNewline) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            guard let eq = trimmed.firstIndex(of: "=") else { continue }
            let key = String(trimmed[..<eq]).trimmingCharacters(in: .whitespacesAndNewlines)
            var value = String(trimmed[trimmed.index(after: eq)...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if (value.hasPrefix("\"") && value.hasSuffix("\"")) || (value.hasPrefix("'") && value.hasSuffix("'")) {
                value = String(value.dropFirst().dropLast())
            }
            if !key.isEmpty { out[key] = value }
        }
        return out
    }
}
