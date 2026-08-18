import Foundation
#if os(macOS)
import AppKit
#endif

enum StratjiKiteAuthPhase: Equatable {
    case idle
    case prompt
    case waitingForBrowser
}

struct KiteLoginDTO: Codable, Equatable {
    var status: String?
    var loginUrl: String?
    var message: String?
    var force: Bool?
}

enum StratjiKiteAuth {
    static func loginURL(baseURL: URL) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        let trimmedPath = components.path.hasSuffix("/")
            ? String(components.path.dropLast())
            : components.path
        components.path = trimmedPath + "/api/kite/login"
        components.queryItems = [
            URLQueryItem(name: "force", value: "1"),
            URLQueryItem(name: "redirect", value: "1"),
        ]
        components.fragment = nil
        return components.url ?? baseURL.appendingPathComponent("api/kite/login")
    }

    /// Zerodha login must run in the system browser so WKWebView keeps the dashboard.
    static func shouldOpenInSystemBrowser(_ url: URL) -> Bool {
        let host = url.host?.lowercased() ?? ""
        let path = url.path.lowercased()
        if path.contains("/api/kite/login") { return true }
        if host == "kite.zerodha.com" || host.hasSuffix(".kite.zerodha.com") { return true }
        if host == "kite.trade" || host.hasSuffix(".kite.trade") { return true }
        return false
    }

    static func resolvedLoginURL(_ raw: String, baseURL: URL) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let absolute = URL(string: trimmed), absolute.scheme != nil {
            return absolute
        }
        return URL(string: trimmed, relativeTo: baseURL)?.absoluteURL
    }

    /// Flask follows 302s, so `/api/kite/login?redirect=1` never reaches kite.zerodha.com in Safari.
    static func jsonLoginURL(from dashboardURL: URL) -> URL {
        var components = URLComponents(url: dashboardURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        var items = (components.queryItems ?? []).filter { $0.name != "redirect" }
        if !items.contains(where: { $0.name == "force" }) {
            items.append(URLQueryItem(name: "force", value: "1"))
        }
        components.queryItems = items.isEmpty ? nil : items
        return components.url ?? dashboardURL
    }

#if os(macOS)
    static func openInBrowser(_ url: URL) {
        NSWorkspace.shared.open(url)
    }

    static func openFromDashboard(_ url: URL) async {
        if url.path.lowercased().contains("/api/kite/login") {
            let jsonURL = jsonLoginURL(from: url)
            var request = URLRequest(url: jsonURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            do {
                let (data, _) = try await URLSession.shared.data(for: request)
                let payload = try JSONDecoder().decode(KiteLoginDTO.self, from: data)
                if let raw = payload.loginUrl, let loginURL = resolvedLoginURL(raw, baseURL: url) {
                    openInBrowser(loginURL)
                    return
                }
            } catch {
                // Fall through so the user still gets a browser window.
            }
        }
        openInBrowser(url)
    }
#endif
}
