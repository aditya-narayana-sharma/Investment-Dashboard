const APP_SCHEMES = new Set(["podcasts:", "podcast:", "itms-podcasts:", "itms-pcast:", "itpc:"]);

function isApplePodcastsHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "podcasts.apple.com" || host.endsWith(".podcasts.apple.com");
}

/**
 * Convert a stored episode URL into a scheme that always launches Apple Podcasts.
 * Publisher/enclosure HTTPS URLs are rejected so the control never opens a browser.
 */
export function applePodcastsAppUrl(value: string | null | undefined): string {
  try {
    const url = new URL(String(value ?? ""));
    if (APP_SCHEMES.has(url.protocol)) return url.toString();
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (!isApplePodcastsHost(url.hostname)) return "";
    return `podcasts://${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}
