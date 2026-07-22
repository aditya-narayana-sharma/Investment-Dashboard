const APP_SHELL_VERSION = "portfolio-iphone-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_health/")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => new Response(
        JSON.stringify({ status: "unavailable", message: "The dashboard gateway is temporarily unreachable. Retrying will preserve the last validated data." }),
        { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
      )),
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => new Response(
      `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#050607"><title>Portfolio Intelligence</title><body style="margin:0;background:#050607;color:#f1f2f3;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="padding:28px;text-align:center"><strong>Mac connection unavailable</strong><p style="color:#9ca4ad">Reconnect to the Mac and reopen the app.</p><small>${APP_SHELL_VERSION}</small></main></body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    )),
  );
});
