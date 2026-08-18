"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, CheckCircle2, ExternalLink, FileText, LogIn, RefreshCw } from "lucide-react";
import { analystCalls, axisRecommendations, portfolioRiskProfiles, type RiskProfile } from "./portfolio-data";
import type { HealthLiveSnapshot } from "./health-live-types";
import { emptySnapshot, type KiteAuthStatus, type KiteSnapshot } from "./live-types";
import { sortDonutHoldings } from "./portfolio-donut";
import type { ContentDigestSnapshot, MailRecommendation } from "./content-types";
import type { EarningsSnapshot } from "./earnings-live-types";
import type { DashboardRefreshResult, SourceFreshness } from "./dashboard-types";
import {
  mergeBenchmarkSnapshot,
  mergeContentSnapshot,
  mergeEarningsSnapshot,
  mergeHealthSnapshot,
  mergeKiteSnapshot,
  mergeSectorMarketSnapshot,
  mergeSectorNewsSnapshot,
  mergeSourceFreshness,
  mergeYfinanceQuotes,
  retainHealthOnFailure,
  retainKiteOnFailure,
} from "./dashboard-refresh-merge";
import { kiteAuthPresentation, kiteLoginHref, openKiteLogin } from "./kite-auth-presentation";
import { sanitizeKiteStatusNote } from "./kite-status-note";
import { sectorCompanies } from "./sector-company-data";
import { emptyBenchmarkSnapshot, emptySectorSnapshot, isUsableSectorMarketStatus, type SectorBenchmarkSnapshot, type SectorMarketSnapshot } from "./sector-live-types";
import { emptySectorNewsSnapshot, type SectorNewsSnapshot } from "./sector-news-types";
import type { MacroBandKey, MacroEventKey, WorkspaceKey } from "./dashboard/types";
import {
  applyCanonicalAppUrl,
  appViewFromPageSearch,
  detectNativeChrome,
  parseBuilderSection,
  parseStrategiesSection,
  type AppView,
} from "./dashboard/workspace-routing";
import {
  analysisWindowLabel,
  buildExposureDrivers,
  exposureFactors,
  fallbackContent,
  fallbackEarnings,
  fallbackHealth,
  latestCompletedHealthDateKey,
  missingHealthDateKeys,
} from "./dashboard/utils";
import { DashboardTabs, DemoCaptionBar, type DashboardAppearance } from "./dashboard/shared-ui";
import { PulseConstellation, resolveSourceWorkspace } from "./dashboard/visual-components";
import { InvestmentWorkspace } from "./dashboard/InvestmentWorkspace";
import { SectorsWorkspace } from "./dashboard/SectorsWorkspace";
import { IntelligenceWorkspace } from "./dashboard/IntelligenceWorkspace";
import { HealthWorkspace } from "./dashboard/HealthWorkspace";
import { BuilderWorkspace } from "./dashboard/BuilderWorkspace";
import { StrategiesWorkspace } from "./dashboard/StrategiesWorkspace";
import { IntegrationsWorkspace } from "./dashboard/IntegrationsWorkspace";
import { LicenseGate } from "./dashboard/LicenseGate";
import { coercePublicLicense, featureForWorkspace, tierAllows, type PublicLicense } from "./license";
import { useLicenseSnapshot } from "./license-snapshot";
import { dedupeAxisCallsBySymbol, mergeHoldingTradingCalls } from "./axis-holding-trading-calls";
import { completeAxisPicks } from "./axis-pick-metrics";

type HomeSearchParams = {
  view?: string | string[];
  section?: string | string[];
  page?: string | string[];
  nativeChrome?: string | string[];
  native?: string | string[];
};

class WorkspaceRenderGuard extends Component<{ label: string; children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.message) {
      return (
        <div className="workspace-render-guard" role="alert">
          <h2>{this.props.label} could not render</h2>
          <p>{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function defaultKiteAuthStatus(status: KiteSnapshot["status"]): KiteAuthStatus {
  switch (status) {
    case "live":
    case "partial":
      return "authenticated";
    case "auth_required":
      return "unauthenticated";
    case "snapshot":
      return "unknown";
    case "unavailable":
      return "unavailable";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function withKiteAuth(data: KiteSnapshot): KiteSnapshot {
  return {
    ...data,
    message: sanitizeKiteStatusNote(data.message),
    authStatus: data.authStatus ?? defaultKiteAuthStatus(data.status),
  };
}

export default function Home({ searchParams: searchParamsProp }: { searchParams?: HomeSearchParams } = {}) {
  const searchParams = useSearchParams();
  const [appView, setAppView] = useState<AppView>(() => (
    appViewFromPageSearch(
      { view: searchParams.get("view") ?? (Array.isArray(searchParamsProp?.view) ? searchParamsProp.view[0] : searchParamsProp?.view) },
      typeof window !== "undefined" ? window.location.search : null,
    )
  ));
  const workspace: WorkspaceKey = appView === "integrations" ? "investment" : appView;
  const nativeChrome = detectNativeChrome({
    searchParams: {
      nativeChrome: searchParams.get("nativeChrome")
        ?? (Array.isArray(searchParamsProp?.nativeChrome) ? searchParamsProp.nativeChrome[0] : searchParamsProp?.nativeChrome),
      native: searchParams.get("native")
        ?? (Array.isArray(searchParamsProp?.native) ? searchParamsProp.native[0] : searchParamsProp?.native),
    },
    locationSearch: typeof window !== "undefined" ? window.location.search : null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  const [macroEventKey, setMacroEventKey] = useState<MacroEventKey>("oilWar");
  const [macroBandKey, setMacroBandKey] = useState<MacroBandKey>("base");
  const [view, setView] = useState<"holdings" | "orders" | "positions" | "gtts" | "tsls" | "alerts">("holdings");
  const [snapshot, setSnapshot] = useState<KiteSnapshot>(emptySnapshot);
  const [content, setContent] = useState<ContentDigestSnapshot>(fallbackContent);
  const [contentError, setContentError] = useState("");
  const [earningsSnapshot, setEarningsSnapshot] = useState<EarningsSnapshot>(fallbackEarnings);
  const [earningsError, setEarningsError] = useState("");
  const [healthSnapshot, setHealthSnapshot] = useState<HealthLiveSnapshot>(fallbackHealth);
  const [healthError, setHealthError] = useState("");
  const [refreshing, setRefreshing] = useState(() => !nativeChrome);
  const [stayMounted, setStayMounted] = useState(false);
  const [sourceFreshness, setSourceFreshness] = useState<SourceFreshness[]>([]);
  const [portfolioRisk, setPortfolioRisk] = useState("ICICIBANK");
  const [axisRisk, setAxisRisk] = useState("RSYSTEMS");
  const [healthIncognito, setHealthIncognito] = useState(false);
  const [appearance, setAppearance] = useState<DashboardAppearance>("black");
  const [appearanceHydrated, setAppearanceHydrated] = useState(false);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [clockMs, setClockMs] = useState(0);
  const demoMode = searchParams.get("demo") === "1";
  const isIntegrationsChrome = appView === "integrations";
  const showWorkspaceShell = !isIntegrationsChrome;
  const [sectorMarket, setSectorMarket] = useState<SectorMarketSnapshot>(() => emptySectorSnapshot("pharma"));
  const [sectorMarketById, setSectorMarketById] = useState<Record<string, SectorMarketSnapshot>>({});
  const [sectorNews, setSectorNews] = useState<SectorNewsSnapshot>(() => emptySectorNewsSnapshot());
  const [sectorBenchmarks, setSectorBenchmarks] = useState<SectorBenchmarkSnapshot>(emptyBenchmarkSnapshot);
  const [yfinanceBySymbol, setYfinanceBySymbol] = useState<Map<string, number>>(new Map());
  const { license, setLicense } = useLicenseSnapshot();
  const selectedSectorRef = useRef<string[]>([]);
  const sectorMarketByIdRef = useRef<Record<string, SectorMarketSnapshot>>({});
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const startupRefreshCompletedRef = useRef(false);
  const autoRefreshStartedRef = useRef(false);
  const hasUsableSectorMarket = isUsableSectorMarketStatus(sectorMarket.status)
    || Object.values(sectorMarketById).some((item) => isUsableSectorMarketStatus(item.status));
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
  const kiteBySymbol = useMemo(() => new Map(snapshot.holdings.filter((holding) => holding.price > 0).map((holding) => [holding.symbol, holding.price] as const)), [snapshot.holdings]);
  const currentBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const [symbol, price] of yfinanceBySymbol) {
      if (price > 0) map.set(symbol, price);
    }
    for (const [symbol, price] of kiteBySymbol) {
      map.set(symbol, price);
    }
    return map;
  }, [kiteBySymbol, yfinanceBySymbol]);
  const mailAxisRecommendations = useMemo<MailRecommendation[]>(() => {
    const base = content.sources.axisResearch.status === "live"
      ? content.investment.axisRecommendations
      : axisRecommendations.map((item) => ({ ...item }));
    return mergeHoldingTradingCalls(base);
  }, [content]);
  const completeMailAxisRecommendations = useMemo(
    () => completeAxisPicks(mailAxisRecommendations, kiteBySymbol, yfinanceBySymbol),
    [kiteBySymbol, mailAxisRecommendations, yfinanceBySymbol],
  );
  const axisCompleteCurrentBySymbol = useMemo(() => {
    const next = new Map(currentBySymbol);
    for (const item of completeMailAxisRecommendations) {
      if (!next.has(item.symbol)) next.set(item.symbol, item.cmp);
    }
    return next;
  }, [completeMailAxisRecommendations, currentBySymbol]);
  const mailWindow = useMemo(() => analysisWindowLabel(content), [content]);
  const analystRows = useMemo(() => {
    // Flat matrix: one logical Axis call per symbol (trading > technical > fundamental).
    const axisUnique = dedupeAxisCallsBySymbol(completeMailAxisRecommendations);
    return [
      ...axisUnique.map((item) => ({
        symbol: item.symbol,
        house: `${item.source} / iCloud Axis Research`,
        rating: item.call,
        target: item.target,
        date: item.date,
        thesis: item.thesis,
        mail: true,
      })),
      ...analystCalls
        .filter((item) => !axisUnique.some((axis) => axis.symbol === item.symbol))
        .map((item) => ({ ...item, mail: false })),
      ...(content.investment.axisTargetAchievements ?? []).map((item) => ({
        symbol: item.symbol,
        house: `${item.origin === "mail" && item.evidenceFile ? "Axis Mail + PDF" : item.origin === "pdf" ? "Axis PDF" : "Axis Mail"} / iCloud Axis Research`,
        rating: item.call,
        target: item.target ?? item.achievedPrice,
        date: item.date,
        thesis: item.thesis,
        mail: true,
        targetAchieved: true,
      })),
    ];
  }, [completeMailAxisRecommendations, content.investment.axisTargetAchievements]);
  const analystMatrixSymbols = useMemo(
    () => [...new Set([
      ...mailAxisRecommendations.filter((row) => row.target != null && row.target > 0).map((row) => row.symbol),
      ...analystCalls.map((row) => row.symbol),
    ])],
    [mailAxisRecommendations],
  );
  // Stable key so Kite price polls (new holdings array identity) do not cancel in-flight yfinance chunks.
  const kiteQuoteSymbolsKey = useMemo(
    () => snapshot.holdings
      .filter((holding) => holding.price > 0)
      .map((holding) => holding.symbol)
      .sort()
      .join(","),
    [snapshot.holdings],
  );
  const missingYfinanceKey = useMemo(() => {
    const kiteSymbols = new Set(kiteQuoteSymbolsKey ? kiteQuoteSymbolsKey.split(",") : []);
    return analystMatrixSymbols
      .filter((symbol) => !kiteSymbols.has(symbol))
      .sort()
      .join(",");
  }, [analystMatrixSymbols, kiteQuoteSymbolsKey]);

  useEffect(() => {
    // CMP for every analyst-matrix symbol: Kite when held, else yfinance. Never invent prices.
    if (!missingYfinanceKey) {
      setYfinanceBySymbol(new Map());
      return;
    }
    const missing = missingYfinanceKey.split(",");
    let cancelled = false;
    const chunkSize = 12;
    (async () => {
      try {
        const chunks: string[][] = [];
        for (let offset = 0; offset < missing.length; offset += chunkSize) {
          chunks.push(missing.slice(offset, offset + chunkSize));
        }
        // Parallel chunks finish faster and shrink the race window vs sequential 90s+ waits.
        const settled = await Promise.all(chunks.map(async (chunk) => {
          const response = await fetch(`/api/quotes/yfinance?symbols=${chunk.join(",")}`, { cache: "no-store" });
          const data = await response.json() as { quotes?: Record<string, { price?: number | null }> };
          if (!response.ok) return [] as Array<[string, number]>;
          return Object.entries(data.quotes ?? {})
            .filter((entry): entry is [string, { price: number }] => entry[1]?.price != null && entry[1].price > 0)
            .map(([symbol, quote]) => [symbol, quote.price] as [string, number]);
        }));
        if (cancelled) return;
        const next = new Map<string, number>();
        for (const entries of settled) {
          for (const [symbol, price] of entries) next.set(symbol, price);
        }
        setYfinanceBySymbol((current) => mergeYfinanceQuotes(current, next));
      } catch {
        // Retain prior quotes on transient failure; never invent prices.
      }
    })();
    return () => { cancelled = true; };
  }, [missingYfinanceKey]);
  const mailAxisProfiles = useMemo<RiskProfile[]>(() => Array.from(new Map(completeMailAxisRecommendations.map((item) => [item.symbol, { symbol: item.symbol, name: item.name, color: item.color, scores: item.scores }])).values()), [completeMailAxisRecommendations]);
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
      const drivers = buildExposureDrivers(holding.symbol, rawScores);
      return {
        symbol: holding.symbol.replace("ICICIBANK", "ICICI").replace("BHARTIARTL", "AIRTEL").replace("JSWENERGY", "JSW").replace("MAXHEALTHCARE", "MAX"),
        fullSymbol: holding.symbol,
        total: Number(total.toFixed(1)),
        weight: holding.weight,
        dayPct: holding.dayPct,
        pnlPct: holding.pnlPct,
        rawScores,
        ...contributions,
        ...drivers,
      };
    });
  }, [portfolioRiskProfiles, snapshot.holdings]);

  const applyHealthSnapshot = useCallback((data: HealthLiveSnapshot) => {
    setHealthSnapshot((current) => mergeHealthSnapshot(current, data));
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
        setSnapshot((current) => mergeKiteSnapshot(current, withKiteAuth(data)));
        return;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    }

    // Downgrade live/partial → snapshot + unknown auth so a failed refresh cannot
    // leave the "Kite authenticated" badge stuck on after the session dies.
    setSnapshot((current) => retainKiteOnFailure(
      current,
      lastError instanceof Error ? lastError.message : "Could not load live Kite data.",
    ));
  }, []);

  const refreshKiteAfterTrade = useCallback(async () => {
    await loadKite();
  }, [loadKite]);

  const loadContent = useCallback(async () => {
    try {
      const response = await fetch(`/api/content/refresh?force=1&refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Content refresh returned ${response.status}`);
      const data = await response.json() as ContentDigestSnapshot;
      setContent((current) => mergeContentSnapshot(current, data));
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
      setEarningsSnapshot((current) => mergeEarningsSnapshot(current, data));
      setEarningsError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Earnings refresh failed.";
      setEarningsError(message);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch(`/_health/snapshot?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as HealthLiveSnapshot & { message?: string };
      if (!response.ok) {
        if (response.status === 404) {
          setHealthSnapshot((current) => mergeHealthSnapshot(current, fallbackHealth));
          return;
        }
        throw new Error(data.message || `Health sync returned ${response.status}`);
      }
      if (data.schemaVersion !== 1 || !Array.isArray(data.categories)) throw new Error("Health sync returned an invalid snapshot");
      applyHealthSnapshot(data);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "HealthKit sync is unavailable.");
      setHealthSnapshot((current) => retainHealthOnFailure(
        current,
        error instanceof Error ? error.message : "HealthKit sync is unavailable.",
      ));
    }
  }, [applyHealthSnapshot]);

  const loadSectorMarket = useCallback(async (sectorId: string) => {
    try {
      const response = await fetch(`/api/sectors/snapshot?sector=${encodeURIComponent(sectorId)}&refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Sector refresh returned ${response.status}`);
      const data = await response.json() as SectorMarketSnapshot;
      setSectorMarketById((current) => {
        const next = { ...current, [data.sectorId]: mergeSectorMarketSnapshot(current[data.sectorId], data) };
        sectorMarketByIdRef.current = next;
        return next;
      });
      const primary = selectedSectorRef.current[selectedSectorRef.current.length - 1];
      if (primary) {
        if (data.sectorId === primary) {
          setSectorMarket((existing) => mergeSectorMarketSnapshot(existing.sectorId === primary ? existing : sectorMarketByIdRef.current[primary], data));
        }
        return;
      }
      // Unfiltered S-2: keep any usable snapshot for header context; never let a late failure wipe live quotes.
      setSectorMarket((existing) => mergeSectorMarketSnapshot(existing, data));
    } catch (error) {
      const failed = { ...emptySectorSnapshot(sectorId), message: error instanceof Error ? error.message : "Sector market refresh failed." };
      setSectorMarketById((current) => {
        const next = { ...current, [sectorId]: mergeSectorMarketSnapshot(current[sectorId], failed) };
        sectorMarketByIdRef.current = next;
        return next;
      });
      const primary = selectedSectorRef.current[selectedSectorRef.current.length - 1];
      // Only pin failures onto the header when that industry is explicitly selected.
      if (primary && sectorId === primary) {
        setSectorMarket((existing) => mergeSectorMarketSnapshot(existing, failed));
      }
    }
  }, []);

  const loadSectorNews = useCallback(async () => {
    try {
      const response = await fetch(`/api/sectors/news?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as SectorNewsSnapshot;
      if (!response.ok || !Array.isArray(data.items) || !Array.isArray(data.sources)) {
        throw new Error(data.message || `Sector news refresh returned ${response.status}`);
      }
      setSectorNews((current) => mergeSectorNewsSnapshot(current, data));
    } catch (error) {
      setSectorNews((current) => mergeSectorNewsSnapshot(current, {
        ...emptySectorNewsSnapshot(),
        message: error instanceof Error ? error.message : "Sector news refresh failed.",
      }));
    }
  }, []);

  const loadBenchmarks = useCallback(async () => {
    try {
      const response = await fetch(`/api/sectors/benchmarks?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Benchmark refresh returned ${response.status}`);
      const data = await response.json() as SectorBenchmarkSnapshot;
      if (!Array.isArray(data.indices)) throw new Error("Benchmark refresh returned an invalid snapshot");
      setSectorBenchmarks((current) => mergeBenchmarkSnapshot(current, data));
    } catch (error) {
      setSectorBenchmarks((current) => mergeBenchmarkSnapshot(current, {
        ...emptyBenchmarkSnapshot(),
        message: error instanceof Error ? error.message : "Benchmark refresh failed.",
      }));
    }
  }, []);

  const refreshAll = useCallback(async (forceContent = false, options?: { silent?: boolean }) => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const silent = options?.silent === true;
    const run = (async () => {
      if (!silent) setRefreshing(true);
      // Surface Kite, S-2 yfinance quotes, S-3 benchmarks, and sector news quickly;
      // the bundled refresh can wait on Mail/content.
      const kiteEarly = loadKite();
      const healthEarly = loadHealth();
      const benchmarksEarly = loadBenchmarks();
      const sectorNewsEarly = loadSectorNews();
      const selectedIds = selectedSectorRef.current;
      const primaryId = selectedIds[selectedIds.length - 1];
      const primarySectorEarly = primaryId ? loadSectorMarket(primaryId) : Promise.resolve();
      const allSectorsEarly = Promise.allSettled(
        Object.keys(sectorCompanies)
          .filter((sectorId) => sectorId !== primaryId)
          .map((sectorId) => loadSectorMarket(sectorId)),
      );
      try {
        try {
          const params = new URLSearchParams({ refresh: String(Date.now()) });
          if (forceContent) params.set("force", "1");
          const response = await fetch(`/api/dashboard/refresh?${params.toString()}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(forceContent ? 300_000 : 90_000),
          });
          const result = await response.json() as DashboardRefreshResult;
          if (!response.ok) throw new Error(`Complete refresh returned ${response.status}`);
          setSourceFreshness((current) => mergeSourceFreshness(current, result.sources));
          if (result.kite) {
            setSnapshot((current) => mergeKiteSnapshot(current, withKiteAuth(result.kite)));
          }
          if (result.content) {
            setContent((current) => mergeContentSnapshot(current, result.content));
            setContentError("");
          }
          if (result.earnings) {
            setEarningsSnapshot((current) => mergeEarningsSnapshot(current, result.earnings));
            setEarningsError("");
          }
          if (result.health) applyHealthSnapshot(result.health);
          if (result.benchmarks) setSectorBenchmarks((current) => mergeBenchmarkSnapshot(current, result.benchmarks));
        } catch (error) {
          setContentError(error instanceof Error ? error.message : "Complete refresh failed; source adapters are retrying.");
          await Promise.allSettled([kiteEarly, benchmarksEarly, sectorNewsEarly, loadContent(), loadEarnings(), loadHealth(), loadBenchmarks()]);
        }
        await Promise.allSettled([kiteEarly, healthEarly, benchmarksEarly, sectorNewsEarly, primarySectorEarly, allSectorsEarly]);
      } finally {
        if (!silent) setRefreshing(false);
        setStayMounted(true);
        startupRefreshCompletedRef.current = true;
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = run;
    return run;
  }, [applyHealthSnapshot, loadBenchmarks, loadContent, loadEarnings, loadHealth, loadKite, loadSectorMarket, loadSectorNews]);

  const selectWorkspace = useCallback((next: WorkspaceKey, historyMode: "push" | "replace" = "push") => {
    setAppView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    if (next === "builder") {
      url.searchParams.set("section", parseBuilderSection(url.searchParams.get("section")));
      url.searchParams.delete("page");
    } else if (next === "strategies") {
      url.searchParams.set("section", parseStrategiesSection(url.searchParams.get("section")));
      url.searchParams.delete("page");
      url.searchParams.delete("tree");
    } else {
      url.searchParams.delete("section");
    }
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
        setSectorMarket((existing) => {
          if (existing.sectorId === primary && isUsableSectorMarketStatus(existing.status)) return existing;
          const retained = sectorMarketByIdRef.current[primary];
          if (retained && isUsableSectorMarketStatus(retained.status)) return retained;
          return existing;
        });
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
      const url = new URL(window.location.href);
      const value = url.searchParams.get("view");
      const { appView: next, rewritten } = applyCanonicalAppUrl(url);
      setAppView(next);
      if (
        value === "market-intelligence"
        || value === "algorithm-canvas"
        || value === "strategy-library"
        || value === "portfolio"
        || value === "portfolio-overview"
        || value === "settings"
        || rewritten
      ) {
        window.history.replaceState({ view: next }, "", url);
      }
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    (window as Window & { __stratjiApplyNativeRoute?: () => void }).__stratjiApplyNativeRoute = fromUrl;
    return () => {
      window.removeEventListener("popstate", fromUrl);
      const holder = window as Window & { __stratjiApplyNativeRoute?: () => void };
      if (holder.__stratjiApplyNativeRoute === fromUrl) delete holder.__stratjiApplyNativeRoute;
    };
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
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("dashboard-appearance");
      const fromDom = document.documentElement.dataset.appearance;
      const next = stored === "black" || stored === "dark" || stored === "sepia"
        ? stored
        : fromDom === "black" || fromDom === "dark" || fromDom === "sepia"
          ? fromDom
          : "black";
      setAppearance(next);
      setHealthIncognito(window.localStorage.getItem("dashboard-health-incognito") === "1");
      setAppearanceHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!appearanceHydrated) return;
    window.localStorage.setItem("dashboard-appearance", appearance);
    document.documentElement.dataset.appearance = appearance;
  }, [appearance, appearanceHydrated]);

  useEffect(() => {
    if (!appearanceHydrated) return;
    window.localStorage.setItem("dashboard-health-incognito", healthIncognito ? "1" : "0");
  }, [appearanceHydrated, healthIncognito]);

  useEffect(() => {
    const onPreferences = (event: Event) => {
      const detail = (event as CustomEvent<{ appearance?: string; healthIncognito?: boolean }>).detail;
      if (detail?.appearance === "black" || detail?.appearance === "dark" || detail?.appearance === "sepia") {
        setAppearance(detail.appearance);
      }
      if (typeof detail?.healthIncognito === "boolean") setHealthIncognito(detail.healthIncognito);
    };
    window.addEventListener("stratji-preferences-changed", onPreferences);
    return () => window.removeEventListener("stratji-preferences-changed", onPreferences);
  }, []);

  useEffect(() => {
    if (!demoMode) {
      delete document.documentElement.dataset.demo;
      return;
    }
    document.documentElement.dataset.demo = "1";
    return () => {
      delete document.documentElement.dataset.demo;
      delete document.documentElement.dataset.demoCaption;
    };
  }, [demoMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("native-chrome-embed", nativeChrome);
    if (nativeChrome) document.documentElement.dataset.nativeChrome = "1";
    else delete document.documentElement.dataset.nativeChrome;
    return () => {
      document.documentElement.classList.remove("native-chrome-embed");
      delete document.documentElement.dataset.nativeChrome;
    };
  }, [nativeChrome]);

  useEffect(() => {
    document.title = isIntegrationsChrome ? "Settings" : "Portfolio Intelligence";
    return () => {
      document.title = "Portfolio Intelligence";
    };
  }, [isIntegrationsChrome]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/license", { cache: "no-store" })
      .then((response) => response.json() as Promise<PublicLicense>)
      .then((payload) => {
        const next = coercePublicLicense(payload);
        if (!cancelled && next) setLicense(next);
      })
      .catch(() => {
        /* Keep the SSR snapshot. Never flash Basic over author Ultra. */
      });
    return () => {
      cancelled = true;
    };
  }, [setLicense]);

  useEffect(() => {
    if (demoMode && (appView === "health" || appView === "integrations")) selectWorkspace("investment", "replace");
  }, [demoMode, appView, selectWorkspace]);

  useEffect(() => {
    if (isIntegrationsChrome) return;
    const onUserRefresh = () => {
      void refreshAll(true);
    };
    window.addEventListener("portfolio-native-refresh", onUserRefresh);

    if (autoRefreshStartedRef.current) {
      return () => window.removeEventListener("portfolio-native-refresh", onUserRefresh);
    }
    autoRefreshStartedRef.current = true;

    if (nativeChrome) {
      // Splash already ran the complete refresh. Hydrate React from that snapshot
      // without the "Refreshing complete dashboard" banner or another force=1 pass.
      void refreshAll(false, { silent: true });
    } else if (!startupRefreshCompletedRef.current) {
      void refreshAll(true);
    }

    return () => window.removeEventListener("portfolio-native-refresh", onUserRefresh);
  }, [isIntegrationsChrome, nativeChrome, refreshAll]);

  const pdfAllowed = tierAllows(license.tier, "pdf") || license.author;
  const showPdfLink = pdfAllowed || license.source !== "default";
  const pdfHref = pdfAllowed ? "/report?export=1" : "/?view=integrations";
  const pdfLabel = pdfAllowed ? "Generate Report PDF" : "PDF is Pro";

  return (
    <main className={`dashboard-app${demoMode ? " demo-mode" : ""}${nativeChrome ? " native-chrome" : ""}${isIntegrationsChrome ? " chrome-page" : ""}`} data-native-chrome={nativeChrome ? "1" : undefined} data-chrome-page={isIntegrationsChrome ? "integrations" : undefined} data-license-tier={license.tier} data-license-source={license.source}>
      {showWorkspaceShell && !nativeChrome && <a className="skip-link" href="#dashboard-workspace-panel">Skip to workspace content</a>}
      {showWorkspaceShell && !nativeChrome && (
      <header className="masthead">
        <div>
          <div className="eyebrow">PORTFOLIO INTELLIGENCE</div>
          <h1>Investment Brief</h1>
          <p>Quarter outlook, oil/geopolitical exposure, flows and analyst positioning</p>
        </div>
        {showPdfLink && (
          <div className="masthead-actions">
            <a className="masthead-pdf" href={pdfHref}><FileText size={15}/> {pdfLabel}</a>
          </div>
        )}
      </header>
      )}
      {showWorkspaceShell && !nativeChrome && <DashboardTabs active={workspace} onChange={selectWorkspace} kiteLive={isLive} contentLive={content.status === "live"} healthIncognito={healthIncognito} healthStatus={healthSnapshot.status} hideHealth={demoMode} licenseTier={license.tier}/>}
      {showWorkspaceShell && <section className={`live-feed-banner ${snapshot.status}`}>
        <div><Activity size={17}/><span><b>{isLive ? "Live Kite Connect data" : isPartial ? "Partial Kite Connect data" : isSnapshot ? "Last validated Kite data" : snapshot.status === "auth_required" ? "Kite authentication required" : "Waiting for live Kite data"}</b><small>{sanitizeKiteStatusNote(snapshot.message)}</small></span></div>
        <div className="live-feed-actions">
          {nativeChrome && showPdfLink && <a className="masthead-pdf" href={pdfHref}><FileText size={15}/> {pdfLabel}</a>}
          {kiteAuthControl === "authenticated"
            ? <button className="kite-auth-control authenticated" type="button" disabled title={tokenExpiryLabel ? `Kite access token is valid until ~${tokenExpiryLabel} (Zerodha daily ~06:00 IST boundary)` : "Kite access token is valid and the latest refresh succeeded"}><CheckCircle2 size={15}/><span>Kite authenticated</span></button>
            : kiteAuthControl === "partial"
              ? <button className="kite-auth-control partial" type="button" disabled title={`Kite session is valid; ${snapshot.unavailableSections?.join(", ") || "one or more portfolio sections"} failed to refresh`}><Activity size={15}/><span>Kite partial</span></button>
              : kiteAuthControl === "cached" && !showAuthAction
                ? <button className="kite-auth-control unavailable" type="button" disabled title="Showing retained Kite data; a confirmed session still exists for the retained snapshot"><Activity size={15}/><span>Kite cached</span></button>
                : <a className="kite-auth-control" href={kiteLoginHref(snapshot.authUrl)} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void openKiteLogin(snapshot.authUrl); }} title={kiteAuthStatus === "expired" ? "Kite session expired at the daily ~06:00 IST boundary — open Zerodha login" : "Open Zerodha Kite login. Stratji.app opens this in Safari so the dashboard stays put."}><LogIn size={15}/><span>{kiteAuthStatus === "expired" ? "Kite expired — re-auth" : "Authenticate Kite"}</span><ExternalLink size={13}/></a>}
          {nearTokenExpiry && (kiteAuthControl === "authenticated" || kiteAuthControl === "partial") && tokenExpiryLabel && <em title="Zerodha requires a fresh login each trading day">Re-auth after ~{tokenExpiryLabel}</em>}
          <button onClick={()=>void refreshAll(true)} disabled={refreshing} title="Refresh Kite, earnings, HealthKit snapshot, Mail, Podcasts and every tracked sector now"><RefreshCw size={15} className={refreshing?"spin":""}/><span>{refreshing?"Refreshing complete dashboard":"Refresh all"}</span></button>
          <em>On request</em>
        </div>
      </section>}
      {showWorkspaceShell && sourceFreshness.length > 0 && (
        <PulseConstellation
          sources={demoMode ? sourceFreshness.filter((source) => resolveSourceWorkspace(source.source) !== "health") : sourceFreshness}
          onNavigate={(next) => {
            if (demoMode && next === "health") return;
            selectWorkspace(next);
          }}
        />
      )}

      {showWorkspaceShell && demoMode && <DemoCaptionBar />}

      <section
        id="dashboard-workspace-panel"
        className="workspace-panel"
        role={nativeChrome || isIntegrationsChrome ? "region" : "tabpanel"}
        aria-labelledby={isIntegrationsChrome ? "integrations-chrome-heading" : nativeChrome ? undefined : `workspace-tab-${workspace}`}
        aria-label={nativeChrome ? "Workspace content" : undefined}
      >

      {isIntegrationsChrome && <IntegrationsWorkspace showDashboardExit={!nativeChrome} />}

      {showWorkspaceShell && (workspace === "investment" || stayMounted) && (
      <div className="workspace-mount" hidden={workspace !== "investment"} data-workspace="investment">
      <InvestmentWorkspace
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
        mailAxisRecommendations={completeMailAxisRecommendations}
        mailAxisProfiles={mailAxisProfiles}
        livePortfolioRiskProfiles={livePortfolioRiskProfiles}
        analystRows={analystRows}
        donutHoldings={donutHoldings}
        exposureComposition={exposureComposition}
        currentBySymbol={axisCompleteCurrentBySymbol}
        kiteBySymbol={kiteBySymbol}
        yfinanceBySymbol={yfinanceBySymbol}
        onKiteRefresh={refreshKiteAfterTrade}
      />
      </div>
      )}

      {showWorkspaceShell && (workspace === "sectors" || stayMounted) && (
      <div className="workspace-mount" hidden={workspace !== "sectors"} data-workspace="sectors">
      <SectorsWorkspace
        selectedSectorIds={selectedSectorIds}
        onToggleSector={toggleSector}
        sectorMarket={sectorMarket}
        sectorMarketById={sectorMarketById}
        sectorNews={sectorNews}
        sectorMarketsLoading={!hasUsableSectorMarket}
        holdings={snapshot.holdings}
        benchmarks={sectorBenchmarks}
        s3Locked={!tierAllows(license.tier, "sectorsS3")}
        license={license}
      />
      </div>
      )}

      {showWorkspaceShell && (workspace === "intelligence" || stayMounted) && (
      <div className="workspace-mount" hidden={workspace !== "intelligence"} data-workspace="intelligence">
      {tierAllows(license.tier, featureForWorkspace("intelligence"))
        ? (
      <IntelligenceWorkspace
        content={content}
        contentError={contentError}
        mailWindow={mailWindow}
        earningsSnapshot={earningsSnapshot}
        earningsError={earningsError}
        holdings={snapshot.holdings}
      />
        )
        : <LicenseGate feature="intelligence" license={license} title="Market Intelligence" />}
      </div>
      )}

      {showWorkspaceShell && !demoMode && (workspace === "health" || stayMounted) && (
      <div className="workspace-mount" hidden={workspace !== "health"} data-workspace="health">
      {tierAllows(license.tier, featureForWorkspace("health"))
        ? (
      <HealthWorkspace
        active={workspace === "health"}
        healthIncognito={healthIncognito}
        setHealthIncognito={setHealthIncognito}
        healthSnapshot={healthSnapshot}
        healthCurrent={healthCurrent}
        healthError={healthError}
        healthRequiredDate={healthRequiredDate}
        healthMissingDates={healthMissingDates}
      />
        )
        : <LicenseGate feature="health" license={license} title="Health & Wellness" />}
      </div>
      )}

      {showWorkspaceShell && (workspace === "builder" || stayMounted) && (
      <div className="workspace-mount" hidden={workspace !== "builder"} data-workspace="builder">
      {tierAllows(license.tier, featureForWorkspace("builder"))
        ? <WorkspaceRenderGuard label="Algorithm Builder"><BuilderWorkspace /></WorkspaceRenderGuard>
        : <LicenseGate feature="builder" license={license} title="Algorithm Canvas" />}
      </div>
      )}

      {showWorkspaceShell && (workspace === "strategies" || stayMounted) && (
      <div className="workspace-mount" hidden={workspace !== "strategies"} data-workspace="strategies">
      {tierAllows(license.tier, featureForWorkspace("strategies"))
        ? <WorkspaceRenderGuard label="Strategies"><StrategiesWorkspace /></WorkspaceRenderGuard>
        : <LicenseGate feature="strategies" license={license} title="Strategies" />}
      </div>
      )}

      </section>

      {isIntegrationsChrome
        ? <footer className="integrations-chrome-footer"><p>Settings / Integrations — Stratji chrome, not a workspace. Secrets stay on this Mac. Writes need confirmation. Live strategy execution is only via Zerodha Streak.</p></footer>
        : <footer><p>Educational portfolio research and private wellness tracking. Not investment or medical advice. Kite orders, GTTs/TSLs, and price alerts require an explicit reviewed ticket and typed confirmation.</p><p>{isLive ? `Live Kite values: ${asOf}` : isPartial ? `Partial Kite values: ${asOf}` : isSnapshot ? `Kite data: ${asOf}` : "Kite values unavailable"} · Sources keep the last validated snapshot until Refresh all · {healthIncognito ? "Health statistics hidden by Incognito." : `HealthKit data through ${healthSnapshot.dataDate} · ${healthSnapshot.targetLabel ?? "operational target"} · ${healthSnapshot.status}.`}</p></footer>}
    </main>
  );
}
