"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, ExternalLink, FileText, LogIn, RefreshCw } from "lucide-react";
import { analystCalls, axisRecommendations, portfolioRiskProfiles, type RiskProfile } from "./portfolio-data";
import type { HealthLiveSnapshot } from "./health-live-types";
import { emptySnapshot, type KiteAuthStatus, type KiteSnapshot } from "./live-types";
import { sortDonutHoldings } from "./portfolio-donut";
import type { ContentDigestSnapshot, MailRecommendation } from "./content-types";
import type { EarningsSnapshot } from "./earnings-live-types";
import type { DashboardRefreshResult, SourceFreshness } from "./dashboard-types";
import { kiteAuthPresentation } from "./kite-auth-presentation";
import { sectorCompanies } from "./sector-company-data";
import { emptyBenchmarkSnapshot, emptySectorSnapshot, type SectorBenchmarkSnapshot, type SectorMarketSnapshot } from "./sector-live-types";
import type { MacroBandKey, MacroEventKey, WorkspaceKey } from "./dashboard/types";
import {
  analysisWindowLabel,
  exposureContext,
  exposureFactors,
  fallbackContent,
  fallbackEarnings,
  fallbackHealth,
  latestCompletedHealthDateKey,
  missingHealthDateKeys,
  workspaces,
} from "./dashboard/utils";
import { DashboardTabs, HealthIncognitoToggle } from "./dashboard/shared-ui";
import { InvestmentWorkspace } from "./dashboard/InvestmentWorkspace";
import { SectorsWorkspace } from "./dashboard/SectorsWorkspace";
import { IntelligenceWorkspace } from "./dashboard/IntelligenceWorkspace";
import { HealthWorkspace } from "./dashboard/HealthWorkspace";

export default function Home() {
  const [workspace, setWorkspace] = useState<WorkspaceKey>("investment");
  const [macroEventKey, setMacroEventKey] = useState<MacroEventKey>("oilWar");
  const [macroBandKey, setMacroBandKey] = useState<MacroBandKey>("base");
  const [view, setView] = useState<"holdings" | "orders" | "positions" | "gtts" | "tsls">("holdings");
  const [snapshot, setSnapshot] = useState<KiteSnapshot>(emptySnapshot);
  const [content, setContent] = useState<ContentDigestSnapshot>(fallbackContent);
  const [contentError, setContentError] = useState("");
  const [earningsSnapshot, setEarningsSnapshot] = useState<EarningsSnapshot>(fallbackEarnings);
  const [earningsError, setEarningsError] = useState("");
  const [healthSnapshot, setHealthSnapshot] = useState<HealthLiveSnapshot>(fallbackHealth);
  const [healthError, setHealthError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [sourceFreshness, setSourceFreshness] = useState<SourceFreshness[]>([]);
  const [portfolioRisk, setPortfolioRisk] = useState("ICICIBANK");
  const [axisRisk, setAxisRisk] = useState("RSYSTEMS");
  const [healthIncognito, setHealthIncognito] = useState(false);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [clockMs, setClockMs] = useState(0);
  const [sectorMarket, setSectorMarket] = useState<SectorMarketSnapshot>(() => emptySectorSnapshot("pharma"));
  const [sectorMarketById, setSectorMarketById] = useState<Record<string, SectorMarketSnapshot>>({});
  const [sectorBenchmarks, setSectorBenchmarks] = useState<SectorBenchmarkSnapshot>(emptyBenchmarkSnapshot);
  const selectedSectorRef = useRef<string[]>([]);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const { asOf } = snapshot;
  const isLive = snapshot.status === "live";
  const isPartial = snapshot.status === "partial";
  const isSnapshot = snapshot.status === "snapshot";
  const hasPortfolio = isLive || isPartial || isSnapshot;
  // Prefer explicit authStatus from the API; never treat retained/cached holdings as a live session.
  const kiteAuthStatus: KiteAuthStatus = snapshot.authStatus
    ?? (snapshot.status === "live"
      ? "authenticated"
      : snapshot.status === "partial"
        ? "authenticated"
        : snapshot.status === "auth_required"
          ? "unauthenticated"
          : snapshot.status === "snapshot"
            ? "unknown"
            : "unavailable");
  const tokenExpiresAtMs = snapshot.tokenExpiresAt ? Date.parse(snapshot.tokenExpiresAt) : Number.NaN;
  const hoursUntilTokenExpiry = Number.isFinite(tokenExpiresAtMs) && clockMs > 0
    ? (tokenExpiresAtMs - clockMs) / (60 * 60 * 1000)
    : Number.NaN;
  const tokenExpiryLabel = Number.isFinite(tokenExpiresAtMs)
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(tokenExpiresAtMs))
    : undefined;
  const nearTokenExpiry = Number.isFinite(hoursUntilTokenExpiry) && hoursUntilTokenExpiry >= 0 && hoursUntilTokenExpiry <= 2;
  // Badge/action tracks explicit session truth, independent of partial data.
  // This also ignores stale auth URLs or reauth suggestions on partial snapshots.
  const { control: kiteAuthControl, showAuthAction } = kiteAuthPresentation({
    status: snapshot.status,
    authStatus: kiteAuthStatus,
    authUrl: snapshot.authUrl,
    reauthSuggested: snapshot.reauthSuggested,
  });
  const healthCurrent = healthSnapshot.status === "live" && healthSnapshot.dataDate >= latestCompletedHealthDateKey();
  const healthRequiredDate = latestCompletedHealthDateKey();
  const healthMissingDates = useMemo(() => missingHealthDateKeys(healthSnapshot.dataDate, healthRequiredDate), [healthSnapshot.dataDate, healthRequiredDate]);
  const currentBySymbol = useMemo(() => new Map(snapshot.holdings.map((holding) => [holding.symbol, holding.price])), [snapshot.holdings]);
  const mailAxisRecommendations = useMemo<MailRecommendation[]>(() => content.sources.axisResearch.status === "live"
    ? content.investment.axisRecommendations
    : axisRecommendations.map((item) => ({ ...item })), [content]);
  const mailAxisProfiles = useMemo<RiskProfile[]>(() => Array.from(new Map(mailAxisRecommendations.map((item) => [item.symbol, { symbol: item.symbol, name: item.name, color: item.color, scores: item.scores }])).values()), [mailAxisRecommendations]);
  const livePortfolioRiskProfiles = useMemo<RiskProfile[]>(() => {
    const known = new Map(portfolioRiskProfiles.map((profile) => [profile.symbol, profile]));
    return snapshot.holdings.map((holding) => known.get(holding.symbol) ?? {
      symbol: holding.symbol,
      name: holding.name,
      color: holding.color,
      scores: [
        3,
        Math.max(1, Math.min(5, Math.round((holding.oil + holding.flow) / 2))),
        /large/i.test(holding.marketCap) ? 1 : /mid/i.test(holding.marketCap) ? 3 : 4,
        /high/i.test(holding.risk) ? 4 : /low/i.test(holding.risk) ? 2 : 3,
        Math.max(holding.oil, holding.flow),
        3,
      ] as RiskProfile["scores"],
    });
  }, [snapshot.holdings]);
  const mailWindow = useMemo(() => analysisWindowLabel(content), [content]);
  const analystRows = useMemo(() => [
    ...mailAxisRecommendations.map((item) => ({ symbol: item.symbol, house: `${item.source} / iCloud Axis Research`, rating: item.call, target: item.target, date: item.date, thesis: item.thesis, mail: true })),
    ...analystCalls.filter((item) => !mailAxisRecommendations.some((axis) => axis.symbol === item.symbol)).map((item) => ({ ...item, mail: false })),
  ], [mailAxisRecommendations]);
  const donutHoldings = useMemo(() => sortDonutHoldings(snapshot.holdings), [snapshot.holdings]);
  const exposureComposition = useMemo(() => {
    const profileBySymbol = new Map(portfolioRiskProfiles.map((profile) => [profile.symbol, profile]));
    return snapshot.holdings.map((holding) => {
      const scores = profileBySymbol.get(holding.symbol)?.scores ?? [3, 3, 3, 3, 3, 3];
      const rawScores = {
        oilWar: holding.oil,
        fiiFlow: holding.flow,
        valuation: scores[0],
        liquidity: scores[2],
        volatility: scores[3],
        leverage: scores[5],
      };
      const contributions = Object.fromEntries(
        Object.entries(rawScores).map(([key, score]) => [key, Number((score / exposureFactors.length).toFixed(3))]),
      );
      const total = Object.values(rawScores).reduce((sum, score) => sum + score, 0) / exposureFactors.length;
      return {
        symbol: holding.symbol.replace("ICICIBANK", "ICICI").replace("BHARTIARTL", "AIRTEL").replace("JSWENERGY", "JSW").replace("MAXHEALTHCARE", "MAX"),
        fullSymbol: holding.symbol,
        total: Number(total.toFixed(1)),
        rawScores,
        ...contributions,
        ...(exposureContext[holding.symbol] ?? { event: "Company and macro events", kpis: "Earnings, valuation and balance-sheet KPIs" }),
      };
    });
  }, [snapshot.holdings]);

  const applyHealthSnapshot = useCallback((data: HealthLiveSnapshot) => {
    setHealthSnapshot(data);
    setHealthError("");
  }, []);

  const loadKite = useCallback(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`/api/kite/snapshot?refresh=${Date.now()}-${attempt}`, { cache: "no-store" });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Kite refresh returned ${response.status} ${contentType || "without JSON"}`);
        }
        const data = await response.json() as KiteSnapshot;
        if (!response.ok) throw new Error(data.message || `Kite refresh returned ${response.status}`);
        // Harden older/partial payloads that omit authStatus so the UI cannot
        // keep claiming Authenticated from a bare `status: "live"` cache.
        setSnapshot({
          ...data,
          authStatus: data.authStatus
            ?? (data.status === "live"
              ? "authenticated"
              : data.status === "partial"
                ? "authenticated"
                : data.status === "auth_required"
                  ? "unauthenticated"
                  : data.status === "snapshot"
                    ? "unknown"
                    : "unavailable"),
        });
        return;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    }

    // Downgrade live/partial → snapshot + unknown auth so a failed refresh cannot
    // leave the "Kite authenticated" badge stuck on after the session dies.
    setSnapshot((current) => current.status === "live" || current.status === "partial" || current.status === "snapshot"
      ? {
          ...current,
          status: "snapshot",
          authStatus: "unknown",
          message: `${current.message} Latest refresh failed; retaining the last validated values.`,
        }
      : { ...emptySnapshot, message: lastError instanceof Error ? lastError.message : "Could not load live Kite data." });
  }, []);

  const loadContent = useCallback(async () => {
    try {
      const response = await fetch(`/api/content/refresh?force=1&refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Content refresh returned ${response.status}`);
      const data = await response.json() as ContentDigestSnapshot;
      setContent(data);
      setContentError("");
    } catch (error) {
      setContentError(error instanceof Error ? error.message : "Mail and Podcasts refresh failed.");
    }
  }, []);

  const loadEarnings = useCallback(async () => {
    try {
      const response = await fetch(`/api/earnings/snapshot?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as EarningsSnapshot;
      if (!response.ok || !Array.isArray(data.events)) throw new Error(data.message || `Earnings refresh returned ${response.status}`);
      setEarningsSnapshot(data);
      setEarningsError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Earnings refresh failed.";
      setEarningsError(message);
      setEarningsSnapshot((current) => ({ ...current, status: "stale", message: `${current.message} Latest refresh failed: ${message}` }));
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch(`/_health/snapshot?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as HealthLiveSnapshot & { message?: string };
      if (!response.ok) {
        if (response.status === 404) {
          setHealthSnapshot(fallbackHealth);
          setHealthError("");
          return;
        }
        throw new Error(data.message || `Health sync returned ${response.status}`);
      }
      if (data.schemaVersion !== 1 || !Array.isArray(data.categories)) throw new Error("Health sync returned an invalid snapshot");
      applyHealthSnapshot(data);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "HealthKit sync is unavailable.");
      setHealthSnapshot((current) => ({
        ...current,
        status: "stale",
        message: current === fallbackHealth
          ? fallbackHealth.message
          : "The latest HealthKit refresh failed; retaining the last validated snapshot.",
      }));
    }
  }, [applyHealthSnapshot]);

  const loadSectorMarket = useCallback(async (sectorId: string) => {
    try {
      const response = await fetch(`/api/sectors/snapshot?sector=${encodeURIComponent(sectorId)}&refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Sector refresh returned ${response.status}`);
      const data = await response.json() as SectorMarketSnapshot;
      setSectorMarketById((current) => ({ ...current, [data.sectorId]: data }));
      const primary = selectedSectorRef.current[selectedSectorRef.current.length - 1];
      if (!primary || data.sectorId === primary) setSectorMarket(data);
    } catch (error) {
      const failed = { ...emptySectorSnapshot(sectorId), message: error instanceof Error ? error.message : "Sector market refresh failed." };
      setSectorMarketById((current) => ({ ...current, [sectorId]: failed }));
      const primary = selectedSectorRef.current[selectedSectorRef.current.length - 1];
      if (!primary || sectorId === primary) setSectorMarket(failed);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const run = (async () => {
      setRefreshing(true);
      // Surface Kite quickly; the bundled refresh can wait on Mail/content.
      const kiteEarly = loadKite();
      try {
        try {
          const response = await fetch(`/api/dashboard/refresh?refresh=${Date.now()}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(90_000),
          });
          const result = await response.json() as DashboardRefreshResult;
          if (!response.ok) throw new Error(`Complete refresh returned ${response.status}`);
          setSourceFreshness(result.sources);
          if (result.kite) setSnapshot(result.kite);
          if (result.content) { setContent(result.content); setContentError(""); }
          if (result.earnings) { setEarningsSnapshot(result.earnings); setEarningsError(""); }
          if (result.health) applyHealthSnapshot(result.health);
          if (result.benchmarks) setSectorBenchmarks(result.benchmarks);
        } catch (error) {
          setContentError(error instanceof Error ? error.message : "Complete refresh failed; source adapters are retrying.");
          await Promise.allSettled([kiteEarly, loadContent(), loadEarnings(), loadHealth()]);
        }
        await kiteEarly;
        const selectedIds = selectedSectorRef.current;
        const primaryId = selectedIds[selectedIds.length - 1];
        if (primaryId) await loadSectorMarket(primaryId);
        await Promise.allSettled(
          Object.keys(sectorCompanies)
            .filter((sectorId) => sectorId !== primaryId)
            .map((sectorId) => loadSectorMarket(sectorId)),
        );
      } finally {
        setRefreshing(false);
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = run;
    return run;
  }, [applyHealthSnapshot, loadContent, loadEarnings, loadHealth, loadKite, loadSectorMarket]);

  const selectWorkspace = useCallback((next: WorkspaceKey, historyMode: "push" | "replace" = "push") => {
    setWorkspace(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history[historyMode === "push" ? "pushState" : "replaceState"]({ view: next }, "", url);
  }, []);

  const toggleSector = useCallback((sectorId: string) => {
    setSelectedSectorIds((current) => {
      const next = current.includes(sectorId)
        ? current.filter((id) => id !== sectorId)
        : [...current, sectorId];
      selectedSectorRef.current = next;
      const primary = next[next.length - 1];
      if (primary) {
        setSectorMarket((existing) => existing.sectorId === primary ? existing : emptySectorSnapshot(primary));
        void loadSectorMarket(primary);
      } else {
        void Promise.allSettled(Object.keys(sectorCompanies).map((id) => loadSectorMarket(id)));
      }
      return next;
    });
  }, [loadSectorMarket]);

  useEffect(() => {
    const tick = () => setClockMs(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const fromUrl = () => {
      const value = new URL(window.location.href).searchParams.get("view");
      const next = value === "market-intelligence"
        ? "intelligence"
        : workspaces.some((item) => item.key === value) ? value as WorkspaceKey : "investment";
      setWorkspace(next);
      if (value !== next) {
        const url = new URL(window.location.href);
        url.searchParams.set("view", next);
        window.history.replaceState({ view: next }, "", url);
      }
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, []);

  useEffect(() => {
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [workspace]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshAll(), 0);
    const interval = window.setInterval(() => void refreshAll(), 5 * 60 * 1000);
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void refreshAll();
    };
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    window.addEventListener("portfolio-native-refresh", refreshWhenActive);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
      window.removeEventListener("portfolio-native-refresh", refreshWhenActive);
    };
  }, [refreshAll]);

  return (
    <main className="dashboard-app">
      <a className="skip-link" href="#dashboard-workspace-panel">Skip to workspace content</a>
      <header className="masthead">
        <div>
          <div className="eyebrow">PORTFOLIO INTELLIGENCE</div>
          <h1>Investment Brief</h1>
          <p>Quarter outlook, oil/geopolitical exposure, flows and analyst positioning</p>
        </div>
        <div className="status-panel">
          <div><Activity size={16}/><span>Kite snapshot</span><b className={snapshot.status}>{isLive ? "Live" : isPartial ? "Partial" : isSnapshot ? "Snapshot" : snapshot.status === "auth_required" ? "Authenticate" : "Unavailable"}</b></div>
          <small>As of {asOf}</small>
          <HealthIncognitoToggle active={healthIncognito} onChange={setHealthIncognito}/>
          <a href="/report?export=1"><FileText size={15}/> Export Report</a>
        </div>
      </header>

      <section className={`live-feed-banner ${snapshot.status}`}>
        <div><Activity size={17}/><span><b>{isLive ? "Live Kite Connect data" : isPartial ? "Partial Kite Connect data" : isSnapshot ? "Last validated Kite snapshot" : snapshot.status === "auth_required" ? "Kite authentication required" : "Waiting for live Kite data"}</b><small>{snapshot.message}</small></span></div>
        <div className="live-feed-actions">
          {kiteAuthControl === "authenticated"
            ? <button className="kite-auth-control authenticated" type="button" disabled title={tokenExpiryLabel ? `Kite access token is valid until ~${tokenExpiryLabel} (Zerodha daily ~06:00 IST boundary)` : "Kite access token is valid and the latest refresh succeeded"}><CheckCircle2 size={15}/><span>Kite authenticated</span></button>
            : kiteAuthControl === "partial"
              ? <button className="kite-auth-control partial" type="button" disabled title={`Kite session is valid; ${snapshot.unavailableSections?.join(", ") || "one or more portfolio sections"} failed to refresh`}><Activity size={15}/><span>Kite partial</span></button>
              : kiteAuthControl === "authenticate" && showAuthAction
                ? <a className="kite-auth-control" href={snapshot.authUrl || "/api/kite/login?force=1&redirect=1"} target="_blank" rel="noreferrer" title={kiteAuthStatus === "expired" ? "Kite session expired at the daily ~06:00 IST boundary — open Zerodha login" : "Open Zerodha Kite login"}><LogIn size={15}/><span>{kiteAuthStatus === "expired" ? "Kite expired — re-auth" : "Authenticate Kite"}</span><ExternalLink size={13}/></a>
                : kiteAuthControl === "cached"
                  ? <button className="kite-auth-control unavailable" type="button" disabled title="Showing a retained Kite snapshot; auth could not be confirmed on the latest refresh"><Activity size={15}/><span>Kite cached</span></button>
                  : <button className="kite-auth-control unavailable" type="button" disabled title="Kite is unavailable; inspect the displayed source failure before attempting authentication"><Activity size={15}/><span>Kite unavailable</span></button>}
          {nearTokenExpiry && (kiteAuthControl === "authenticated" || kiteAuthControl === "partial") && tokenExpiryLabel && <em title="Zerodha requires a fresh login each trading day">Re-auth after ~{tokenExpiryLabel}</em>}
          <button onClick={()=>void refreshAll()} disabled={refreshing} title="Refresh Kite, earnings, HealthKit snapshot, Mail, Podcasts and every tracked sector now"><RefreshCw size={15} className={refreshing?"spin":""}/><span>{refreshing?"Refreshing complete dashboard":"Refresh all"}</span></button>
          <em>All sources · 5 min</em>
        </div>
      </section>
      {sourceFreshness.length>0&&<section className="source-freshness-strip" aria-label="Complete dashboard source freshness">{sourceFreshness.map((source)=><div key={source.source} title={source.message}><i className={source.state}/><span><b>{source.source}</b><small>{source.state.replaceAll("_"," ")} · {source.period}</small></span></div>)}</section>}

      <DashboardTabs active={workspace} onChange={selectWorkspace} kiteLive={isLive} contentLive={content.status === "live"} healthIncognito={healthIncognito} healthStatus={healthSnapshot.status}/>

      <section id="dashboard-workspace-panel" className="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${workspace}`}>

      {workspace === "investment" && <InvestmentWorkspace
        snapshot={snapshot}
        content={content}
        view={view}
        setView={setView}
        macroEventKey={macroEventKey}
        setMacroEventKey={setMacroEventKey}
        macroBandKey={macroBandKey}
        setMacroBandKey={setMacroBandKey}
        portfolioRisk={portfolioRisk}
        setPortfolioRisk={setPortfolioRisk}
        axisRisk={axisRisk}
        setAxisRisk={setAxisRisk}
        isLive={isLive}
        isPartial={isPartial}
        isSnapshot={isSnapshot}
        hasPortfolio={hasPortfolio}
        mailWindow={mailWindow}
        mailAxisRecommendations={mailAxisRecommendations}
        mailAxisProfiles={mailAxisProfiles}
        livePortfolioRiskProfiles={livePortfolioRiskProfiles}
        analystRows={analystRows}
        donutHoldings={donutHoldings}
        exposureComposition={exposureComposition}
        currentBySymbol={currentBySymbol}
        onKiteRefresh={loadKite}
      />}

      {workspace === "sectors" && <SectorsWorkspace
        selectedSectorIds={selectedSectorIds}
        onToggleSector={toggleSector}
        sectorMarket={sectorMarket}
        sectorMarketById={sectorMarketById}
        holdings={snapshot.holdings}
        benchmarks={sectorBenchmarks}
      />}

      {workspace === "intelligence" && <IntelligenceWorkspace
        content={content}
        contentError={contentError}
        mailWindow={mailWindow}
        earningsSnapshot={earningsSnapshot}
        earningsError={earningsError}
        holdings={snapshot.holdings}
      />}

      {workspace === "health" && <HealthWorkspace
        healthIncognito={healthIncognito}
        setHealthIncognito={setHealthIncognito}
        healthSnapshot={healthSnapshot}
        healthCurrent={healthCurrent}
        healthError={healthError}
        healthRequiredDate={healthRequiredDate}
        healthMissingDates={healthMissingDates}
        healthNote={content.healthNote}
        healthNoteSource={content.sources.healthNote}
      />}

      </section>

      <footer><p>Educational portfolio research and private wellness tracking. Not investment or medical advice. Kite orders require an explicit reviewed order ticket and typed confirmation.</p><p>{isLive ? `Live Kite values: ${asOf}` : isPartial ? `Partial Kite values: ${asOf}` : isSnapshot ? `Kite snapshot: ${asOf}` : "Kite values unavailable"} · All refresh-capable sources refresh on open, focus and every five minutes · {healthIncognito ? "Health statistics hidden by Incognito." : `HealthKit data through ${healthSnapshot.dataDate} · ${healthSnapshot.targetLabel ?? "operational target"} · ${healthSnapshot.status}.`}</p></footer>
    </main>
  );
}
