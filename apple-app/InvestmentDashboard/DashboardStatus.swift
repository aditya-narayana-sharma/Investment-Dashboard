import Combine
import Foundation
import SwiftUI

struct FlaskHealthResponse: Codable, Equatable {
    let status: String
    let app: String?
    let gateway: String?
    let upstreamStatus: Int?
    let installUrl: String?

    var isHealthy: Bool {
        status == "ok" && upstreamStatus == 200
    }
}

struct StartupAuditResponse: Codable, Equatable {
    let status: String
    let failures: Int
    let failedSources: [String]?
    let finishedAt: String?
    let message: String

    var isCurrent: Bool {
        status == "ok" && failures == 0
    }
}

struct HealthFreshnessResponse: Codable, Equatable {
    let status: String
    let completedHealthThrough: String?
    let partialToday: Bool?
    let capturedAt: String?
}

enum DashboardConnectionState: Equatable {
    case idle
    case checking
    case online
    case degraded(String)
    case offline(String)

    var label: String {
        switch self {
        case .idle: "Not checked"
        case .checking: "Checking Mac"
        case .online: "Private live connection"
        case .degraded: "Sources need attention"
        case .offline: "Mac unavailable"
        }
    }

    var color: Color {
        switch self {
        case .idle: .secondary
        case .checking: .orange
        case .online: .green
        case .degraded: .orange
        case .offline: .red
        }
    }
}

enum DashboardClientError: LocalizedError {
    case invalidURL
    case invalidResponse
    case gateway(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            "The dashboard address is invalid."
        case .invalidResponse:
            "The Mac returned an unreadable response."
        case .gateway(let message):
            message
        }
    }
}

struct DashboardAPIClient {
    var session: URLSession = .shared

    func health(baseURL: URL) async throws -> FlaskHealthResponse {
        try await get(baseURL: baseURL, path: "/_flask/health")
    }

    func audit(baseURL: URL) async throws -> StartupAuditResponse {
        try await get(baseURL: baseURL, path: "/_startup/audit")
    }

    func healthFreshness(baseURL: URL) async throws -> HealthFreshnessResponse {
        try await get(baseURL: baseURL, path: "/api/dashboard/freshness")
    }

    private func get<T: Decodable>(baseURL: URL, path: String) async throws -> T {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw DashboardClientError.invalidURL
        }
        components.path = path
        components.query = nil
        guard let url = components.url else { throw DashboardClientError.invalidURL }

        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw DashboardClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(ServerMessage.self, from: data).message)
                ?? "The Mac dashboard returned HTTP \(http.statusCode)."
            throw DashboardClientError.gateway(message)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private struct ServerMessage: Decodable {
        let message: String
    }
}

@MainActor
final class DashboardStatusModel: ObservableObject {
    @Published private(set) var connection: DashboardConnectionState = .idle
    @Published private(set) var audit: StartupAuditResponse?
    @Published private(set) var healthFreshness: HealthFreshnessResponse?
    @Published private(set) var lastChecked: Date?

    private let client: DashboardAPIClient
    private var checkTask: Task<Void, Never>?

    init(client: DashboardAPIClient = DashboardAPIClient()) {
        self.client = client
    }

    deinit {
        checkTask?.cancel()
    }

    func check(baseURL: URL) async {
        connection = .checking
        do {
            let gateway = try await client.health(baseURL: baseURL)
            guard gateway.isHealthy else {
                connection = .offline("Flask is reachable, but the dashboard upstream is not healthy.")
                lastChecked = Date()
                return
            }

            let latestAudit = try? await client.audit(baseURL: baseURL)
            let latestHealth = try? await client.healthFreshness(baseURL: baseURL)
            audit = latestAudit
            healthFreshness = latestHealth
            lastChecked = Date()

            if let latestAudit, !latestAudit.isCurrent {
                connection = .degraded(latestAudit.message)
            } else {
                connection = .online
            }
        } catch {
            connection = .offline(error.localizedDescription)
            lastChecked = Date()
        }
    }

    func startMonitoring(baseURL: URL) {
        checkTask?.cancel()
        checkTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                await self.check(baseURL: baseURL)
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }

    func stopMonitoring() {
        checkTask?.cancel()
        checkTask = nil
    }
}
