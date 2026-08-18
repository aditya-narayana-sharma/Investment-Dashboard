import Foundation
#if os(macOS)
import AppKit
#endif
#if canImport(SwiftUI)
import SwiftUI
#endif

extension Notification.Name {
    static let stratjiAppearanceDidChange = Notification.Name("StratjiAppearanceDidChange")
}

enum StratjiAppearance: String, CaseIterable, Identifiable {
    case black
    case dark
    case sepia

    var id: String { rawValue }

    var title: String {
        switch self {
        case .black: "Black"
        case .dark: "Dark"
        case .sepia: "Sepia"
        }
    }

    /// Black and Dark share dark native chrome; Sepia is the only light paper theme.
    var prefersDarkChrome: Bool {
        switch self {
        case .black, .dark: true
        case .sepia: false
        }
    }

#if os(macOS)
    var nsAppearance: NSAppearance? {
        NSAppearance(named: prefersDarkChrome ? .darkAqua : .aqua)
    }
#endif

#if canImport(SwiftUI)
    var colorScheme: ColorScheme {
        prefersDarkChrome ? .dark : .light
    }
#endif
}

/// Single appearance store shared by Settings and the dashboard WKWebView.
///
/// Native key: `stratji.appearance` (UserDefaults / AppStorage).
/// Web key: `dashboard-appearance` (localStorage) → `document.documentElement.dataset.appearance`.
enum StratjiAppearanceStore {
    static let defaultsKey = "stratji.appearance"
    static let healthIncognitoKey = "stratji.healthIncognito"
    static let webStorageKey = "dashboard-appearance"
    static let webHealthIncognitoKey = "dashboard-health-incognito"
    static let defaultValue = StratjiAppearance.black.rawValue

    static var current: StratjiAppearance {
        StratjiAppearance(rawValue: normalized(UserDefaults.standard.string(forKey: defaultsKey))) ?? .black
    }

    static var healthIncognito: Bool {
        UserDefaults.standard.bool(forKey: healthIncognitoKey)
    }

    static func normalized(_ raw: String?) -> String {
        switch raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case StratjiAppearance.dark.rawValue:
            return StratjiAppearance.dark.rawValue
        case StratjiAppearance.sepia.rawValue:
            return StratjiAppearance.sepia.rawValue
        case StratjiAppearance.black.rawValue:
            return StratjiAppearance.black.rawValue
        default:
            return defaultValue
        }
    }

    static func set(_ raw: String, healthIncognito: Bool? = nil) {
        UserDefaults.standard.set(normalized(raw), forKey: defaultsKey)
        if let healthIncognito {
            UserDefaults.standard.set(healthIncognito, forKey: healthIncognitoKey)
        }
        NotificationCenter.default.post(name: .stratjiAppearanceDidChange, object: current.rawValue)
    }

    /// Runs at `WKUserScript` document-start so FOUC reads the native token, not a stale sepia localStorage.
    static func webBootstrapScript(
        appearance: String? = nil,
        healthIncognito incognito: Bool? = nil
    ) -> String {
        applyJavaScript(
            appearance: appearance ?? current.rawValue,
            healthIncognito: incognito ?? healthIncognito,
            dispatchEvent: false
        )
    }

    /// Re-applies after load and on Settings change so React state follows the native store immediately.
    static func applyJavaScript(
        appearance: String? = nil,
        healthIncognito incognito: Bool? = nil,
        dispatchEvent: Bool = true
    ) -> String {
        let token = normalized(appearance ?? current.rawValue)
        let hidden = incognito ?? healthIncognito
        let incognitoFlag = hidden ? "1" : "0"
        let incognitoBool = hidden ? "true" : "false"
        let event = dispatchEvent
            ? """
            window.dispatchEvent(new CustomEvent('stratji-preferences-changed', {
              detail: { appearance: '\(token)', healthIncognito: \(incognitoBool) }
            }));
            """
            : ""
        return """
        (function(){
          try {
            localStorage.setItem('\(webStorageKey)', '\(token)');
            localStorage.setItem('\(webHealthIncognitoKey)', '\(incognitoFlag)');
            document.documentElement.dataset.appearance = '\(token)';
            \(event)
          } catch (e) {}
        })();
        """
    }
}
