import Foundation
import WebKit

/// JS applied after WKWebView navigation so the SPA honors `section`/`page`
/// even when WebKit treats a query-only change as the same document.
enum DashboardNativeRoute {
    static func applyJavaScript(url: URL, destination: DashboardDestination) -> String {
        let target = destination.clickTarget
        let href = json(url.absoluteString)
        let number = json(target.dashboardSectionNumber ?? "")
        return """
        (function() {
          var href = \(href);
          var number = \(number);
          try {
            var next = new URL(href, location.href);
            history.replaceState(Object.assign({}, history.state || {}, { nativeRoute: true }), "", next.pathname + next.search + next.hash);
          } catch (e) {}
          window.dispatchEvent(new PopStateEvent("popstate"));
          window.dispatchEvent(new Event("stratji:navigate"));
          if (number) {
            window.dispatchEvent(new CustomEvent("dashboard-expand-section", { detail: { number: number } }));
          }
          if (typeof window.__stratjiApplyNativeRoute === "function") {
            window.__stratjiApplyNativeRoute();
          }
          return location.search;
        })();
        """
    }

    static func apply(in webView: WKWebView, url: URL, destination: DashboardDestination) {
        webView.evaluateJavaScript(applyJavaScript(url: url, destination: destination), completionHandler: { _, _ in })
    }

    private static func json(_ value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
        return String(data: data ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
    }
}
