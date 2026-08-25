"use client";

import { useEffect } from "react";

/**
 * Registers the offline-fallback service worker.
 *
 * `public/sw.js` deliberately uses **no** Cache API: every fetch is a
 * network-first passthrough with `cache: "no-store"`, and the worker only
 * synthesises a response when the Mac gateway is unreachable. Nothing is
 * ever stored, so a newly activated worker cannot be serving stale content.
 *
 * That is why this runtime never reloads the page. It previously called
 * `window.location.reload()` on every `controllerchange`, which reloaded the
 * app in two situations:
 *
 *   1. Unconditionally on first load. `sw.js` calls `skipWaiting()` on install
 *      and `clients.claim()` on activate, so an uncontrolled page acquires a
 *      controller (`null` -> worker) moments after load. That transition *is* a
 *      `controllerchange`, so every new origin — `:3000`, `:5050`, the LAN host
 *      and the Tailscale host are four distinct registrations — reloaded itself
 *      once during startup.
 *   2. At unpredictable times mid-session. Registering with
 *      `updateViaCache: "none"` and polling `registration.update()` on a timer,
 *      on `visibilitychange` and on `online` re-fetched `/sw.js` over the
 *      network. Any byte-different response — the Flask 503 shell, a proxy
 *      error page, a changed upstream after a Stratji recycle — installed a
 *      "new" worker that skip-waited, claimed, and reloaded the app mid-use.
 *
 * Since the worker caches nothing, neither reload served any purpose. The
 * explicit update polling is gone too: browsers already check for a worker
 * update on navigation, and re-fetching a static file that stores nothing only
 * created the mid-session reload trigger described above.
 */
export function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    let disposed = false;

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // Registration can resolve after unmount; drop it rather than retaining
        // a worker for a screen that is gone.
        if (disposed) void registration.unregister().catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
