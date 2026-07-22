import Combine
import Foundation
import Security
#if os(iOS)
import UIKit
#endif

enum HealthCredentialError: LocalizedError {
    case missingToken
    case keychain(OSStatus)
    case invalidPairingCode
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .missingToken:
            "Pair this iPhone with the Mac before syncing HealthKit."
        case .keychain(let status):
            "Keychain could not store the Health credential (\(status))."
        case .invalidPairingCode:
            "Enter the active pairing code shown on the Mac."
        case .invalidResponse:
            "The Mac returned an unreadable pairing response."
        case .server(let message):
            message
        }
    }
}

enum HealthCredentialStore {
    private static let service = "com.adityasharma.InvestmentDashboard.health"
    private static let account = "health-upload-token"

    static func token() throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8),
              !value.isEmpty else {
            if status == errSecItemNotFound { throw HealthCredentialError.missingToken }
            throw HealthCredentialError.keychain(status)
        }
        return value
    }

    static func save(token: String) throws {
        guard let data = token.data(using: .utf8), !token.isEmpty else {
            throw HealthCredentialError.missingToken
        }
        let lookup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(lookup as CFDictionary)
        let item: [String: Any] = lookup.merging([
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]) { _, new in new }
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw HealthCredentialError.keychain(status) }
    }

    static func remove() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }

    static var isPaired: Bool {
        (try? token()) != nil
    }
}

struct HealthPairingResponse: Decodable {
    let status: String
    let installId: String
    let token: String
    let createdAt: String
}

struct HealthPairingClient {
    var session: URLSession = .shared

    func pair(baseURL: URL, code: String, installId: String, label: String) async throws -> HealthPairingResponse {
        let normalizedCode = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard normalizedCode.count >= 6 else { throw HealthCredentialError.invalidPairingCode }
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw DashboardClientError.invalidURL
        }
        components.path = "/_health/pair"
        components.query = nil
        guard let url = components.url else { throw DashboardClientError.invalidURL }

        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "code": normalizedCode,
            "installId": installId,
            "label": label,
        ])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HealthCredentialError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let serverMessage = (try? JSONDecoder().decode(ServerMessage.self, from: data).message)
                ?? "Pairing failed with HTTP \(http.statusCode)."
            throw HealthCredentialError.server(serverMessage)
        }
        return try JSONDecoder().decode(HealthPairingResponse.self, from: data)
    }

    func revoke(baseURL: URL, installId: String, token: String) async throws {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw DashboardClientError.invalidURL
        }
        components.path = "/_health/pair/\(installId)"
        components.query = nil
        guard let url = components.url else { throw DashboardClientError.invalidURL }

        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HealthCredentialError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let serverMessage = (try? JSONDecoder().decode(ServerMessage.self, from: data).message)
                ?? "Pairing removal failed with HTTP \(http.statusCode)."
            throw HealthCredentialError.server(serverMessage)
        }
    }

    private struct ServerMessage: Decodable {
        let message: String
    }
}

@MainActor
final class HealthPairingModel: ObservableObject {
    @Published private(set) var isPaired = HealthCredentialStore.isPaired
    @Published private(set) var isPairing = false
    @Published private(set) var message = HealthCredentialStore.isPaired
        ? "HealthKit upload is paired with this Mac."
        : "HealthKit upload is not paired."

    private let client = HealthPairingClient()
    private let installIdDefaultsKey = "healthInstallId"

    var installId: String {
        if let existing = UserDefaults.standard.string(forKey: installIdDefaultsKey) {
            return existing
        }
        let created = UUID().uuidString.lowercased()
        UserDefaults.standard.set(created, forKey: installIdDefaultsKey)
        return created
    }

    func pair(baseURL: URL, code: String) async -> Bool {
        isPairing = true
        defer { isPairing = false }
        do {
            let response = try await client.pair(
                baseURL: baseURL,
                code: code,
                installId: installId,
                label: deviceLabel
            )
            try HealthCredentialStore.save(token: response.token)
            isPaired = true
            message = "HealthKit upload paired successfully."
            return true
        } catch {
            isPaired = false
            message = error.localizedDescription
            return false
        }
    }

    func unpair(baseURL: URL) async -> Bool {
        do {
            let token = try HealthCredentialStore.token()
            try await client.revoke(baseURL: baseURL, installId: installId, token: token)
            HealthCredentialStore.remove()
            isPaired = false
            message = "HealthKit upload pairing removed."
            return true
        } catch {
            message = "Could not remove Health pairing: \(error.localizedDescription)"
            return false
        }
    }

    private var deviceLabel: String {
#if os(iOS)
        UIDevice.current.name
#else
        Host.current().localizedName ?? "Portfolio Intelligence Mac"
#endif
    }
}
