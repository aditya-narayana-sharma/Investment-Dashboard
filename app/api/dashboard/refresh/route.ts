import type { ContentDigestSnapshot } from "../../../content-types";
import type { DashboardRefreshResult, FreshnessState, SourceFreshness } from "../../../dashboard-types";
import { buildEarningsSnapshot, latestCompletedIstDateKey } from "../../../earnings-verify";
import { readAppleHealthSnapshot } from "../../../health-import-server";
import { currentKiteSession, getKiteSnapshot, restoreKiteSession } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";
import { earningsCalendar } from "../../../portfolio-data";
import { getSectorBenchmarkSnapshot } from "../../../sector-benchmark-server";
import { writeStartupProgress } from "../../../startup-progress-server";

export const dynamic = "force-dynamic";

function istDate(daysAgo = 0) {
  return new Date(Date.now() + (5.5 * 60 * 60 * 1000) - daysAgo * 86400000).toISOString().slice(0, 10);
}

async function loadHealthForDashboardRefresh() {
  // Hot-path native/browser refresh must not block on Health ZIP import.
  // Startup audit (`refresh-dashboard-data.sh`) remains the ZIP refresh.
  return readAppleHealthSnapshot();
}

function cookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

async function jsonFetch<T>(url: string, timeoutMs = 75_000): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
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
  const requestUrl = new URL(request.url);
  const reportMode = requestUrl.searchParams.has("report");
  const forceContent = requestUrl.searchParams.get("force") === "1" || requestUrl.searchParams.has("startup");
  const storedSession = cookie(request, "kite_dashboard_session");
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);
  const refreshedAt = new Date().toISOString();
  // force=1 / startup: wait for Mail, Axis Research, Podcasts, Calendar, Reminders.
  // Unforced focus/visibility keeps the 15-minute digest cache so tab switches do not re-read Mail.app.
  const contentBase = process.env.CONTENT_DIGEST_URL ?? "http://127.0.0.1:3003/refresh";
  const contentUrl = `${contentBase}${contentBase.includes("?") ? "&" : "?"}force=${forceContent ? "1" : "0"}`;
  const contentTimeoutMs = forceContent ? 160_000 : 75_000;
  writeStartupProgress({ stage: "kite", state: "start", label: "Refreshing Kite holdings, positions, orders, GTT, margins, and quotes…" });
  if (!reportMode) {
    writeStartupProgress({ stage: "health", state: "start", label: "Refreshing Health snapshot…" });
    writeStartupProgress({ stage: "sectors", state: "start", label: "Refreshing sector snapshots…" });
  }
  const [kiteResult, contentResult, healthResult, benchmarkResult] = await Promise.allSettled([
    getKiteSnapshot().then((value) => {
      writeStartupProgress({
        stage: "kite",
        state: value.status === "live" || value.status === "partial" ? "ok" : "failed",
        label: value.status === "live" || value.status === "partial" ? "Kite snapshot received." : "Kite snapshot stale or unavailable.",
      });
      return value;
    }).catch((error) => {
      writeStartupProgress({ stage: "kite", state: "failed", label: "Kite snapshot stale or unavailable." });
      throw error;
    }),
    jsonFetch<ContentDigestSnapshot>(contentUrl, contentTimeoutMs).then((value) => {
      const apple: Array<[string, string, { status?: string } | undefined]> = [
        ["calendar", "Apple Calendar", value.sources.calendar],
        ["mail", "iCloud Newsletters", value.sources.newsletters],
        ["axis", "iCloud Axis Research", value.sources.axisResearch],
        ["reminders", "Apple Reminders", value.sources.reminders],
        ["podcasts", "Apple Podcasts", value.sources.podcasts],
      ];
      for (const [stage, label, source] of apple) {
        const ok = source?.status === "live" || source?.status === "verified" || source?.status === "cached" || source?.status === "partial";
        writeStartupProgress({
          stage,
          state: ok ? "ok" : "failed",
          label: ok ? `${label} received.` : `${label} stale or unavailable.`,
        });
      }
      return value;
        }).catch((error) => {
      writeStartupProgress({ stage: "calendar", state: "failed", label: "Apple Calendar stale or unavailable." });
      writeStartupProgress({ stage: "mail", state: "failed", label: "iCloud Newsletters stale or unavailable." });
      writeStartupProgress({ stage: "axis", state: "failed", label: "Axis Research mailbox stale or unavailable." });
      writeStartupProgress({ stage: "reminders", state: "failed", label: "Apple Reminders stale or unavailable." });
      writeStartupProgress({ stage: "podcasts", state: "failed", label: "Apple Podcasts stale or unavailable." });
      throw error;
    }),
    reportMode ? Promise.resolve(undefined) : loadHealthForDashboardRefresh().then((value) => {
      const ok = value?.status === "live" || value?.status === "partial" || value?.status === "cached";
      writeStartupProgress({
        stage: "health",
        state: ok ? "ok" : "failed",
        label: ok ? "Health snapshot received." : "Health snapshot stale or unavailable.",
      });
      return value;
    }).catch((error) => {
      writeStartupProgress({ stage: "health", state: "failed", label: "Health snapshot stale or unavailable." });
      throw error;
    }),
    reportMode ? Promise.resolve(undefined) : getSectorBenchmarkSnapshot().then((value) => {
      const ok = value?.status === "live" || value?.status === "partial" || value?.status === "cached";
      writeStartupProgress({
        stage: "sectors",
        state: ok ? "ok" : "failed",
        label: ok ? "Sector snapshots received." : "Sector snapshots stale or unavailable.",
      });
      return value;
    }).catch((error) => {
      writeStartupProgress({ stage: "sectors", state: "failed", label: "Sector snapshots stale or unavailable." });
      throw error;
    }),
  ]);
  const earningsThrough = latestCompletedIstDateKey();
  writeStartupProgress({ stage: "earnings", state: "start", label: "Refreshing earnings calendar…" });
  const earnings = buildEarningsSnapshot(earningsCalendar, earningsThrough);
  writeStartupProgress({
    stage: "earnings",
    state: earnings.status === "verified" ? "ok" : "failed",
    label: earnings.status === "verified" ? "Earnings snapshot received." : "Earnings snapshot stale or unverified.",
  });
  const sources: SourceFreshness[] = [];
  const kite = kiteResult.status === "fulfilled" ? kiteResult.value : undefined;
  sources.push(freshness("Kite", mapKiteFreshness(kite?.status), kite?.asOf ?? refreshedAt, "5 minutes", true, kite?.message ?? String(kiteResult.status === "rejected" ? kiteResult.reason : "Kite unavailable")));
  const content = contentResult.status === "fulfilled" ? contentResult.value : undefined;
  for (const [key, label, required] of [["newsletters", "iCloud / Newsletters", true], ["axisResearch", "iCloud / Axis Research", true], ["reminders", "Apple Reminders", true], ["calendar", "Apple Calendar", true], ["podcasts", "Apple Podcasts", false]] as const) {
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
  if (!reportMode) {
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
  }
  sources.push(freshness("Earnings", earnings.status === "verified" ? "verified" : earnings.status === "stale" ? "stale" : "unavailable", earnings.asOf, `through ${earningsThrough}`, true, earnings.message));
  const benchmarks = benchmarkResult.status === "fulfilled" ? benchmarkResult.value : undefined;
  if (!reportMode) {
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
  }
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
