import Auth0
import Combine
import Foundation
#if os(macOS)
import LocalAuthentication
#endif

enum StratjiAuth0 {
    static let macosBundleID = "com.adityasharma.Stratji"
    static let iosBundleID = "com.adityasharma.InvestmentDashboard"

    static func callbackURL(bundleIdentifier: String, domain: String, platform: String) -> String {
        "\(bundleIdentifier)://\(domain)/\(platform)/\(bundleIdentifier)/callback"
    }

#if os(macOS)
    static var currentPlatform: String { "macos" }
#else
    static var currentPlatform: String { "ios" }
#endif
}

enum AuthorAuthError: LocalizedError {
    case notConfigured
    case notAuthor
    case keychainWriteFailed
    case localUnlockUnavailable

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Auth0.plist still has placeholders. Create the Native Auth0 apps, then paste ClientId and Domain."
        case .notAuthor:
            return "This Auth0 account is not the Stratji author. Log in as the owner."
        case .keychainWriteFailed:
            return "Could not store the Auth0 session in Keychain."
        case .localUnlockUnavailable:
            return "This Mac cannot verify the owner with Touch ID or a login password."
        }
    }
}

struct Auth0PlistConfiguration: Equatable {
    var clientId: String
    var domain: String
    var authorEmail: String?

    var isPlaceholder: Bool {
        clientId.hasPrefix("YOUR_") || domain.hasPrefix("YOUR_") || !domain.contains(".")
    }
}

final class AuthenticationService: ObservableObject {
    @Published private(set) var isAuthenticated = false
    @Published private(set) var authorEmail: String?
    @Published private(set) var authorName: String?
    @Published private(set) var lastError: String?
    @Published private(set) var isBusy = false

    private var credentialsManager: CredentialsManager?

    init() {
#if os(macOS)
        isAuthenticated = false
        return
#else
        if let configuration = Self.loadConfiguration(), !configuration.isPlaceholder {
            let manager = CredentialsManager(authentication: Auth0.authentication())
            credentialsManager = manager
            isAuthenticated = manager.canRenew()
            if isAuthenticated {
                Task { await self.refreshProfile() }
            }
            return
        }
        isAuthenticated = false
#endif
    }

    var isConfigured: Bool {
        guard let configuration = Self.loadConfiguration() else { return false }
        return !configuration.isPlaceholder
    }

    var configuration: Auth0PlistConfiguration? {
        Self.loadConfiguration()
    }

    func login() async {
#if os(macOS)
        await unlockWithLocalAuthentication()
#else
        lastError = nil
        guard isConfigured else {
            lastError = AuthorAuthError.notConfigured.localizedDescription
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            let credentials = try await Auth0
                .webAuth()
                .scope("openid profile email offline_access")
                .start()
            try store(credentials: credentials)
            applyProfile(from: credentials.idToken)
            isAuthenticated = true
        } catch WebAuthError.userCancelled {
            return
        } catch {
            lastError = error.localizedDescription
        }
#endif
    }

    func logout() async {
#if os(macOS)
        lockSession()
#else
        lastError = nil
        guard isConfigured else { return }
        isBusy = true
        defer { isBusy = false }
        do {
            try await Auth0.webAuth().clearSession()
        } catch {
            lastError = error.localizedDescription
        }
        _ = credentialsManager?.clear()
        authorEmail = nil
        authorName = nil
        isAuthenticated = false
#endif
    }

#if os(macOS)
    func unlockWithLocalAuthentication() async {
        lastError = nil
        isBusy = true
        defer { isBusy = false }
        let context = LAContext()
        var evaluateError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &evaluateError) else {
            lastError = evaluateError?.localizedDescription ?? AuthorAuthError.localUnlockUnavailable.localizedDescription
            return
        }
        do {
            let ok = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock Stratji for this session."
            )
            guard ok else { return }
            isAuthenticated = true
            authorName = NSFullUserName()
        } catch let error as LAError {
            switch error.code {
            case .userCancel, .appCancel, .systemCancel:
                return
            default:
                lastError = error.localizedDescription
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func lockSession() {
        lastError = nil
        isAuthenticated = false
        authorEmail = nil
        authorName = nil
    }
#endif

    func establishWebSession(baseURL: URL) async {
        guard isConfigured, let manager = credentialsManager else { return }
        do {
            let credentials = try await manager.credentials()
            var request = URLRequest(url: baseURL.appendingPathComponent("_auth/session"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(WebSessionBody(
                accessToken: credentials.accessToken,
                idToken: credentials.idToken
            ))
            request.timeoutInterval = 12
            _ = try await URLSession.shared.data(for: request)
        } catch {
            return
        }
    }

    func clearWebSession(baseURL: URL) async {
        var request = URLRequest(url: baseURL.appendingPathComponent("_auth/logout"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 8
        _ = try? await URLSession.shared.data(for: request)
    }

    static func loadConfiguration(from bundle: Bundle = .main) -> Auth0PlistConfiguration? {
        guard let url = bundle.url(forResource: "Auth0", withExtension: "plist"),
              let dict = NSDictionary(contentsOf: url) else {
            return nil
        }
        guard let clientId = dict["ClientId"] as? String, !clientId.isEmpty,
              let domain = dict["Domain"] as? String, !domain.isEmpty else {
            return nil
        }
        let email = (dict["AuthorEmail"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return Auth0PlistConfiguration(
            clientId: clientId,
            domain: domain,
            authorEmail: (email?.isEmpty == false && email?.hasPrefix("YOUR_") == false) ? email : nil
        )
    }

    static func email(from idToken: String) -> String? {
        claims(from: idToken)?.email
    }

    private func store(credentials: Credentials) throws {
        let manager = credentialsManager ?? CredentialsManager(authentication: Auth0.authentication())
        credentialsManager = manager
        guard manager.store(credentials: credentials) else {
            throw AuthorAuthError.keychainWriteFailed
        }
        if let allowed = Self.loadConfiguration()?.authorEmail,
           let email = Self.email(from: credentials.idToken),
           email.caseInsensitiveCompare(allowed) != .orderedSame {
            _ = manager.clear()
            throw AuthorAuthError.notAuthor
        }
    }

    private func refreshProfile() async {
        guard let manager = credentialsManager else { return }
        do {
            let credentials = try await manager.credentials()
            applyProfile(from: credentials.idToken)
        } catch {
            _ = manager.clear()
            isAuthenticated = false
        }
    }

    private func applyProfile(from idToken: String) {
        let claims = Self.claims(from: idToken)
        authorEmail = claims?.email
        authorName = claims?.name ?? claims?.email
    }

    private struct IDTokenClaims: Decodable {
        var email: String?
        var name: String?
        var sub: String?
    }

    private struct WebSessionBody: Encodable {
        var accessToken: String
        var idToken: String
    }

    private static func claims(from idToken: String) -> IDTokenClaims? {
        let parts = idToken.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var payload = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = payload.count % 4
        if remainder > 0 {
            payload += String(repeating: "=", count: 4 - remainder)
        }
        guard let data = Data(base64Encoded: payload) else { return nil }
        return try? JSONDecoder().decode(IDTokenClaims.self, from: data)
    }
}
