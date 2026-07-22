import type { ContentDigestSnapshot } from "../../../content-types";
import type { DashboardRefreshResult, FreshnessState, SourceFreshness } from "../../../dashboard-types";
import { buildEarningsSnapshot } from "../../../earnings-verify";
import { refreshAppleHealth } from "../../../health-import-server";
import { currentKiteSession, getKiteSnapshot, restoreKiteSession } from "../../../kite-live-server";

export const dynamic = "force-dynamic";

function istDate(daysAgo = 0) {
  return new Date(Date.now() + (5.5 * 60 * 60 * 1000) - daysAgo * 86400000).toISOString().slice(0, 10);
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

function gateHealthSnapshot<T extends { status?: string; dataDate?: string; completedThrough?: string; message?: string; capturedAt?: string }>(health: T | undefined) {
  if (!health) return undefined;
  const requiredDate = istDate(1);
  const dataDate = health.dataDate ?? health.completedThrough ?? "";
  const current = Boolean(dataDate && dataDate >= requiredDate);
  return {
    ...health,
    status: current ? "live" : "stale",
    message: current
      ? health.message ?? `Latest completed-day Health data is available through ${dataDate}.`
      : `Health data currently stops at ${dataDate || "unknown"}; latest completed day is ${requiredDate}.`,
  } as T;
}

export async function GET(request: Request) {
  const storedSession = cookie(request, "kite_dashboard_session");
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);
  const refreshedAt = new Date().toISOString();
  const contentUrl = `${process.env.CONTENT_DIGEST_URL ?? "http://127.0.0.1:3003/refresh"}?force=1`;
  const [kiteResult, contentResult, healthResult] = await Promise.allSettled([
    getKiteSnapshot(),
    jsonFetch<ContentDigestSnapshot>(contentUrl),
    refreshAppleHealth(),
  ]);
  const { earningsCalendar } = await import("../../../portfolio-data");
  const earnings = buildEarningsSnapshot(earningsCalendar, istDate());
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
  const health = gateHealthSnapshot(healthResult.status === "fulfilled" ? healthResult.value : undefined);
  const healthFresh: FreshnessState = health?.status === "live" ? "verified" : health?.status === "stale" ? "stale" : "unavailable";
  sources.push(freshness("Apple Health export", healthFresh, health?.capturedAt ?? refreshedAt, `complete through ${health?.completedThrough ?? health?.dataDate ?? istDate(1)}`, true, health?.message ?? String(healthResult.status === "rejected" ? healthResult.reason : "Health unavailable")));
  sources.push(freshness("Earnings", earnings.status === "verified" ? "verified" : earnings.status === "stale" ? "stale" : "unavailable", earnings.asOf, `through ${istDate()}`, true, earnings.message));
  const requiredFailed = sources.some((source) => source.required && ["cached", "unavailable", "permission_required", "stale", "partial"].includes(source.state));
  const result: DashboardRefreshResult = {
    status: requiredFailed ? "partial" : "current", refreshedAt, analysisDate: istDate(), completedHealthThrough: health?.completedThrough ?? health?.dataDate ?? istDate(1), partialToday: Boolean(health?.partialToday), sources, kite, content, earnings, health,
  };
  const headers: Record<string, string> = { "Cache-Control": "no-store, max-age=0" };
  const sessionId = currentKiteSession();
  if (sessionId) headers["Set-Cookie"] = `kite_dashboard_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`;
  return Response.json(result, { status: 200, headers });
}
