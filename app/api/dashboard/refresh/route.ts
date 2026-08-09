import type { ContentDigestSnapshot } from "../../../content-types";
import type { DashboardRefreshResult, FreshnessState, SourceFreshness } from "../../../dashboard-types";
import { buildEarningsSnapshot, latestCompletedIstDateKey } from "../../../earnings-verify";
import { refreshAppleHealth } from "../../../health-import-server";
import { currentKiteSession, getKiteSnapshot, restoreKiteSession } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";
import { earningsCalendar } from "../../../portfolio-data";
import { getSectorBenchmarkSnapshot } from "../../../sector-benchmark-server";

export const dynamic = "force-dynamic";

function istDate(daysAgo = 0) {
  return new Date(Date.now() + (5.5 * 60 * 60 * 1000) - daysAgo * 86400000).toISOString().slice(0, 10);
}

async function loadHealthForDashboardRefresh() {
  return refreshAppleHealth();
}

function cookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

async function jsonFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(75000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function freshness(source: string, state: FreshnessState, observedAt: string, period: string, required: boolean, message: string): SourceFreshness {
  return { source, state, observedAt, period, required, message };
}

function mapKiteFreshness(status: string | undefined): FreshnessState {
  if (status === "live") return "live";
  if (status === "partial") return "partial";
  if (status === "snapshot") return "cached";
  return "unavailable";
}

export async function GET(request: Request) {
  const storedSession = cookie(request, "kite_dashboard_session");
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);
  const refreshedAt = new Date().toISOString();
  // Hot-path refresh should not force a full Mail/Podcasts re-read on every
  // browser open/focus. Startup audit and explicit Refresh already force sources.
  const contentUrl = `${process.env.CONTENT_DIGEST_URL ?? "http://127.0.0.1:3003/refresh"}?force=0`;
  const [kiteResult, contentResult, healthResult, benchmarkResult] = await Promise.allSettled([
    getKiteSnapshot(),
    jsonFetch<ContentDigestSnapshot>(contentUrl),
    loadHealthForDashboardRefresh(),
    getSectorBenchmarkSnapshot(),
  ]);
  const earningsThrough = latestCompletedIstDateKey();
  const earnings = buildEarningsSnapshot(earningsCalendar, earningsThrough);
  const sources: SourceFreshness[] = [];
  const kite = kiteResult.status === "fulfilled" ? kiteResult.value : undefined;
  sources.push(freshness("Kite", mapKiteFreshness(kite?.status), kite?.asOf ?? refreshedAt, "5 minutes", true, kite?.message ?? String(kiteResult.status === "rejected" ? kiteResult.reason : "Kite unavailable")));
  const content = contentResult.status === "fulfilled" ? contentResult.value : undefined;
  for (const [key, label, required] of [["newsletters", "iCloud / Newsletters", true], ["axisResearch", "iCloud / Axis Research", true], ["reminders", "Apple Reminders", true], ["calendar", "Apple Calendar", true], ["healthNote", " Health Daily note", true], ["podcasts", "Apple Podcasts", false]] as const) {
    const state = content?.sources[key];
    const mapped: FreshnessState = state?.status === "live" ? "live"
      : state?.status === "cached" ? "cached"
        : state?.status === "stale" ? "stale"
          : state?.status === "permission_required" ? "permission_required"
            : "unavailable";
    sources.push(freshness(label, mapped, state?.observedAt ?? refreshedAt, key === "podcasts" ? "30 minutes" : "15 minutes", required, state?.message ?? `${state?.count ?? 0} items`));
  }
  if (content?.sources.marketCalendar) {
    const state = content.sources.marketCalendar;
    sources.push(freshness(
      "NSE / US market calendars",
      state.status === "live" ? "live" : state.status === "cached" ? "cached" : "unavailable",
      state.observedAt ?? refreshedAt,
      state.status === "live" || state.status === "cached" ? "canonical config adapter" : "configured authoritative adapter",
      false,
      state.message ?? `${state.count} holiday rows`,
    ));
  }
  const health = healthResult.status === "fulfilled" ? healthResult.value : undefined;
  const healthFresh: FreshnessState = health?.status === "live" ? "verified"
    : health?.status === "cached" ? "cached"
      : health?.status === "partial" ? "partial"
        : health?.status === "stale" ? "stale"
          : "unavailable";
  sources.push(freshness(
    "Apple Health export",
    healthFresh,
    health?.capturedAt ?? refreshedAt,
    `${health?.targetLabel ?? "operational target"} · ${health?.requiredThrough ?? health?.targetDate ?? health?.dataDate ?? "unknown"}`,
    true,
    health?.message ?? String(healthResult.status === "rejected" ? healthResult.reason : "Health unavailable"),
  ));
  sources.push(freshness("Earnings", earnings.status === "verified" ? "verified" : earnings.status === "stale" ? "stale" : "unavailable", earnings.asOf, `through ${earningsThrough}`, true, earnings.message));
  const benchmarks = benchmarkResult.status === "fulfilled" ? benchmarkResult.value : undefined;
  sources.push(freshness(
    "NSE benchmarks",
    benchmarks?.status === "live" ? "live" : benchmarks?.status === "partial" ? "partial" : benchmarks?.status === "cached" ? "cached" : "unavailable",
    benchmarks?.asOf ?? refreshedAt,
    benchmarks?.status === "live"
      ? "official or exact-index EOD · daily history"
      : "supported EOD · daily history",
    false,
    benchmarks?.message ?? String(benchmarkResult.status === "rejected" ? benchmarkResult.reason : "Benchmarks unavailable"),
  ));
  const requiredFailed = sources.some((source) => source.required && ["cached", "unavailable", "permission_required", "stale", "partial"].includes(source.state));
  const result: DashboardRefreshResult = {
    status: requiredFailed ? "partial" : "current",
    refreshedAt,
    axisResearchLastFetchedAt: content?.investment.axisLastFetchedAt ?? content?.sources.axisResearch.observedAt,
    analysisDate: istDate(),
    completedHealthThrough: health?.completedThrough ?? health?.dataDate ?? istDate(1),
    partialToday: Boolean(health?.partialToday),
    sources,
    kite,
    content,
    earnings,
    health,
    benchmarks,
  };
  const headers: Record<string, string> = { "Cache-Control": "no-store, max-age=0" };
  const sessionId = currentKiteSession();
  if (sessionId) headers["Set-Cookie"] = kiteSessionCookie(sessionId);
  return Response.json(result, { status: 200, headers });
}
