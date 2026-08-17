import Foundation

struct StratjiAPIClient {
    var session: URLSession = .shared
    var timeout: TimeInterval = 90

    func flaskHealth(baseURL: URL) async throws -> FlaskHealthDTO {
        var request = URLRequest(url: url(baseURL, path: "/_flask/health"), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw StratjiClientError.invalidResponse
        }
        if let decoded = try? JSONDecoder().decode(FlaskHealthDTO.self, from: data) {
            return decoded
        }
        throw StratjiClientError.http(http.statusCode)
    }

    func startupAudit(baseURL: URL) async throws -> StartupAuditDTO {
        try await get(baseURL: baseURL, path: "/_startup/audit", timeout: 12)
    }

    func startupProgress(baseURL: URL) async throws -> StartupProgressDTO {
        try await get(baseURL: baseURL, path: "/_startup/progress", timeout: 4)
    }

    func healthFreshness(baseURL: URL) async throws -> HealthFreshnessDTO {
        try await get(baseURL: baseURL, path: "/api/dashboard/freshness", timeout: 12)
    }

    func refreshDashboard(baseURL: URL, force: Bool = true) async throws -> DashboardRefreshDTO {
        try await get(
            baseURL: baseURL,
            path: "/api/dashboard/refresh",
            query: force ? [URLQueryItem(name: "force", value: "1")] : [],
            timeout: force ? DashboardRefreshSchedule.forcedRequestTimeout : timeout
        )
    }

    func kiteSnapshot(baseURL: URL) async throws -> KiteSnapshotDTO {
        try await get(baseURL: baseURL, path: "/api/kite/snapshot", timeout: 45)
    }

    func integrations(baseURL: URL, includeSecrets: Bool = false) async throws -> IntegrationsConfigDTO {
        try await get(
            baseURL: baseURL,
            path: "/api/integrations",
            query: includeSecrets ? [URLQueryItem(name: "secrets", value: "1")] : [],
            timeout: 12
        )
    }

    func saveIntegrations(baseURL: URL, body: IntegrationsSettingsUpdate) async throws -> IntegrationsConfigDTO {
        try await send(baseURL: baseURL, path: "/api/integrations", method: "PUT", body: body)
    }

    func license(baseURL: URL) async throws -> PublicLicenseDTO {
        try await get(baseURL: baseURL, path: "/api/license", timeout: 12)
    }

    func saveLicense(baseURL: URL, body: LicenseUpdateBody) async throws -> PublicLicenseDTO {
        try await send(baseURL: baseURL, path: "/api/license", method: "PUT", body: body)
    }

    func saveApplePermissions(baseURL: URL, permissions: [String: ApplePermissionDTO]) async throws -> IntegrationsConfigDTO {
        try await send(
            baseURL: baseURL,
            path: "/api/integrations",
            method: "POST",
            body: ApplePermissionsUpdateBody(applePermissions: permissions)
        )
    }

    private func get<T: Decodable>(baseURL: URL, path: String, query: [URLQueryItem] = [], timeout: TimeInterval) async throws -> T {
        var request = URLRequest(url: url(baseURL, path: path, query: query), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await decode(request)
    }

    private func send<T: Decodable, B: Encodable>(baseURL: URL, path: String, method: String, body: B) async throws -> T {
        var request = URLRequest(url: url(baseURL, path: path), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await decode(request)
    }

    private func url(_ baseURL: URL, path: String, query: [URLQueryItem] = []) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        components.path = path
        components.query = nil
        components.queryItems = query.isEmpty ? nil : query
        components.fragment = nil
        return components.url ?? baseURL.appendingPathComponent(path)
    }

    private func decode<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw StratjiClientError.invalidResponse
        }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw StratjiClientError.http(http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum StratjiClientError: LocalizedError {
    case invalidResponse
    case http(Int)
    case gateway(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            "The Mac returned an unreadable response."
        case .http(let code):
            "The Mac data plane returned HTTP \(code)."
        case .gateway(let message):
            message
        }
    }
}
