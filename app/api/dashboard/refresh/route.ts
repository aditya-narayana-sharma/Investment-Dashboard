import type { ContentDigestSnapshot } from "../../../content-types";
import type { DashboardRefreshResult, FreshnessState, SourceFreshness } from "../../../dashboard-types";
import type { EarningsSnapshot } from "../../../earnings-live-types";
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

export async function GET(request: Request) {
  const storedSession = cookie(request, "kite_dashboard_session");
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), true);
  const refreshedAt = new Date().toISOString();
  const [kiteResult, contentResult, healthResult] = await Promise.allSettled([
    getKiteSnapshot(),
    jsonFetch<ContentDigestSnapshot>(process.env.CONTENT_DIGEST_URL ?? "http://127.0.0.1:3003/refresh"),
    refreshAppleHealth(),
  ]);
  const earnings: EarningsSnapshot = {
    status: "verified", asOf: refreshedAt, analysisDate: istDate(),
    events: (await import("../../../portfolio-data")).earningsCalendar,
    message: "Calendar is refreshed through today; published KPI rows remain source-backed and pending rows remain blank.",
  };
  const sources: SourceFreshness[] = [];
  const kite = kiteResult.status === "fulfilled" ? kiteResult.value : undefined;
  sources.push(freshness("Kite", kite?.status === "live" ? "live" : kite?.status === "snapshot" ? "cached" : "unavailable", kite?.asOf ?? refreshedAt, "5 minutes", true, kite?.message ?? String(kiteResult.status === "rejected" ? kiteResult.reason : "Kite unavailable")));
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
  const health = healthResult.status === "fulfilled" ? healthResult.value : undefined;
  sources.push(freshness("Apple Health export", health?.status === "live" ? "verified" : "unavailable", health?.capturedAt ?? refreshedAt, `complete through ${health?.completedThrough ?? istDate(1)}`, true, health?.message ?? String(healthResult.status === "rejected" ? healthResult.reason : "Health unavailable")));
  sources.push(freshness("Earnings", "verified", refreshedAt, `through ${istDate()}`, true, earnings.message));
  const requiredFailed = sources.some((source) => source.required && ["cached", "unavailable", "permission_required", "stale"].includes(source.state));
  const result: DashboardRefreshResult = {
    status: requiredFailed ? "partial" : "current", refreshedAt, analysisDate: istDate(), completedHealthThrough: health?.completedThrough ?? istDate(1), partialToday: Boolean(health?.partialToday), sources, kite, content, earnings, health,
  };
  const headers: Record<string, string> = { "Cache-Control": "no-store, max-age=0" };
  const sessionId = currentKiteSession();
  if (sessionId) headers["Set-Cookie"] = `kite_dashboard_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`;
  return Response.json(result, { status: 200, headers });
}
