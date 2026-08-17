import Foundation

enum ApplePodcastsLink {
    static let podcastsBundleIdentifier = "com.apple.podcasts"
    private static let appSchemes: Set<String> = [
        "podcasts",
        "podcast",
        "itms-podcasts",
        "itms-pcast",
        "itpc",
    ]

    static func isPodcastsURL(_ url: URL) -> Bool {
        let scheme = url.scheme?.lowercased() ?? ""
        if appSchemes.contains(scheme) {
            return true
        }
        guard scheme == "http" || scheme == "https" else {
            return false
        }
        let host = url.host?.lowercased() ?? ""
        return host == "podcasts.apple.com" || host.hasSuffix(".podcasts.apple.com")
    }

    static func appURL(from url: URL) -> URL {
        let scheme = url.scheme?.lowercased() ?? ""
        if appSchemes.contains(scheme) {
            return url
        }
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }
        components.scheme = "podcasts"
        return components.url ?? url
    }
}
