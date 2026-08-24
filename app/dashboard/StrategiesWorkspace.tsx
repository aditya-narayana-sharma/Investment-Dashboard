"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMPOSER_CATALOG_URL,
  COMPOSER_RESEARCH_AS_OF,
  COMPOSER_STRATEGIES,
  COMPOSER_UNRECONSTRUCTED,
  sortComposerStrategies,
  type ComposerPublishedStats,
  type ComposerSortKey,
  type ComposerStrategyCard,
} from "../strategy/composer-strategies";
import { listStrategyLibrary, loadLibraryNseStats, loadStrategyFromLibrary } from "../strategy/persist";
import {
  applyLibraryNseStats,
  bundledLibraryNseStats,
  type LibraryNseStatsCache,
} from "../strategy/library-nse-stats";
import type { StrategyTreeV1 } from "../strategy/graph-types";
import { CollapsibleSection, DailyKanbanBoard, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import { listenToStratjiLocation, stratjiPushState } from "./stratji-navigate";
import { satyaSuggestionsForWorkspace } from "./satya-suggestions";
import { useSatyaTaskContext } from "./satya-workspace";
import { ReadOnlyTree } from "./strategies/ReadOnlyTree";
import { LibraryLab } from "./strategies/LibraryLab";
import "./strategies/strategies-workspace.css";
import type { StrategiesSection } from "./types";
import { isLocationView, parseStrategiesSection, strategiesSectionNumber } from "./workspace-routing";
import { buildStrategiesDailyActions } from "./workspace-daily-actions";

const STRATEGIES_SECTIONS = [
  { id: "y1", label: "Action Board" },
  { id: "y2", label: "Library" },
] as const;

type SavedLibraryItem = { id: string; name: string; tree: StrategyTreeV1 };

type OpenStrategy =
  | { source: "composer"; card: ComposerStrategyCard }
  | { source: "mine"; item: SavedLibraryItem };

function strategiesSectionFromUrl(): StrategiesSection {
  if (typeof window === "undefined") return "y2";
  const requested = new URLSearchParams(window.location.search).get("section");
  return STRATEGIES_SECTIONS.some((section) => section.id === requested) ? parseStrategiesSection(requested) : "y2";
}

function formatPct(value: number | undefined): string {
  if (value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatNum(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toFixed(2);
}

function formatMaxDd(value: number | undefined): string {
  if (value === undefined) return "—";
  return formatPct(-Math.abs(value));
}

function signedClass(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return undefined;
}

function maxDdClass(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Math.abs(value) === 0 ? undefined : "negative";
}

function openInBuilder(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "builder");
  url.searchParams.set("section", "canvas");
  url.searchParams.set("tree", id);
  url.searchParams.delete("page");
  stratjiPushState(url, { view: "builder", section: "canvas", tree: id });
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function OverviewKpiGrid({ stats }: { stats?: ComposerPublishedStats }) {
  return (
    <dl className="strategy-kpi-grid" aria-label="Strategy KPIs">
      <div><small>Annualized</small><b className={signedClass(stats?.annualizedReturnPct)}>{formatPct(stats?.annualizedReturnPct)}</b></div>
      <div><small>Cumulative</small><b className={signedClass(stats?.cumulativeReturnPct)}>{formatPct(stats?.cumulativeReturnPct)}</b></div>
      <div><small>Sharpe</small><b className={signedClass(stats?.sharpe)}>{formatNum(stats?.sharpe)}</b></div>
      <div><small>Max DD</small><b className={maxDdClass(stats?.maxDrawdownPct)}>{formatMaxDd(stats?.maxDrawdownPct)}</b></div>
    </dl>
  );
}

function StrategyOverviewCard({
  id,
  name,
  stats,
  onOpen,
}: {
  id: string;
  name: string;
  stats?: ComposerPublishedStats;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="strategy-card"
      data-strategy-id={id}
      data-testid="strategy-overview-card"
      data-engine-source={stats?.source ?? ""}
      data-kpi-filled={stats?.annualizedReturnPct !== undefined || stats?.cumulativeReturnPct !== undefined || stats?.sharpe !== undefined || stats?.maxDrawdownPct !== undefined ? "true" : "false"}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <header className="strategy-card-head">
        <h3>{name}</h3>
      </header>
      <OverviewKpiGrid stats={stats} />
      {stats?.source === "yfinance" && stats.asOf ? (
        <p className="strategy-card-asof">yfinance NSE · as-of {stats.asOf}</p>
      ) : null}
    </button>
  );
}

function StrategyDetailDialog({
  open,
  onClose,
}: {
  open: OpenStrategy;
  onClose: () => void;
}) {
  const id = open.source === "composer" ? open.card.id : open.item.id;
  const name = open.source === "composer" ? open.card.name : open.item.name;
  const tree = open.source === "composer" ? open.card.tree : open.item.tree;
  const titleId = `strategy-dialog-title-${id}`;
  const [streakBusy, setStreakBusy] = useState(false);
  const [streakNote, setStreakNote] = useState<string | null>(null);

  const exportToStreak = useCallback(async () => {
    setStreakBusy(true);
    setStreakNote(null);
    try {
      const response = await fetch("/api/streak/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree }),
      });
      const payload = await response.json() as { error?: string; placesOrders?: boolean; checklist?: string[] };
      if (!response.ok) {
        setStreakNote(payload.error ?? "Streak export failed.");
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStreakNote(
        payload.placesOrders === false
          ? "Copied Streak scanner JSON. Stratji does not place unattended orders."
          : "Copied Streak scanner JSON.",
      );
    } catch (error) {
      setStreakNote(error instanceof Error ? error.message : "Streak export failed.");
    } finally {
      setStreakBusy(false);
    }
  }, [tree]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="strategy-dialog-backdrop"
      role="presentation"
      data-testid="strategy-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="strategy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="strategy-dialog"
        data-strategy-id={id}
      >
        <header className="strategy-dialog-head">
          <div>
            <h3 id={titleId}>{name}</h3>
            {open.source === "composer" ? <p>{open.card.description}</p> : <p>Saved tree from this dashboard library.</p>}
          </div>
          <button type="button" className="vo-pop" onClick={onClose}>Close</button>
        </header>

        {open.source === "composer" ? (
          <>
            <dl className="strategy-dialog-stats" aria-label="Strategy KPIs">
              <div><small>Annualized</small><b className={signedClass(open.card.stats.annualizedReturnPct)}>{formatPct(open.card.stats.annualizedReturnPct)}</b></div>
              <div><small>Cumulative</small><b className={signedClass(open.card.stats.cumulativeReturnPct)}>{formatPct(open.card.stats.cumulativeReturnPct)}</b></div>
              <div><small>Sharpe</small><b className={signedClass(open.card.stats.sharpe)}>{formatNum(open.card.stats.sharpe)}</b></div>
              <div><small>Max DD</small><b className={maxDdClass(open.card.stats.maxDrawdownPct)}>{formatMaxDd(open.card.stats.maxDrawdownPct)}</b></div>
              <div><small>Calmar</small><b className={signedClass(open.card.stats.calmar)}>{formatNum(open.card.stats.calmar)}</b></div>
              <div><small>Window start</small><b>{open.card.stats.oosStart ?? "—"}</b></div>
            </dl>
            <p className="strategy-engine-note">
              {open.card.stats.unavailableReason
                ? open.card.stats.unavailableReason
                : open.card.stats.source === "yfinance"
                  ? `yfinance NSE tree backtest${open.card.stats.asOf ? ` · as-of ${open.card.stats.asOf}` : ""}. Not Composer published US OOS.`
                  : "Not run yet — KPIs stay blank until the NSE tree backtest completes."}
            </p>
          </>
        ) : (
          <OverviewKpiGrid />
        )}

        <ReadOnlyTree tree={tree} />

        {open.source === "composer" ? (
          <div className="strategy-card-notes">
            <p><b>NSE adaptation</b> — {open.card.reconstructionNote}</p>
            <p>{open.card.marketNote}</p>
            <p>{open.card.mappingNote}</p>
            <p>
              Logic source: <a href={open.card.sourceUrl} target="_blank" rel="noreferrer">{open.card.sourceUrl}</a>
              {" · "}as-of {open.card.asOf}
            </p>
          </div>
        ) : null}

        <div className="strategy-card-actions">
          <button
            type="button"
            className="vo-pop"
            onClick={() => {
              onClose();
              openInBuilder(id);
            }}
          >
            Open in Algorithm Canvas
          </button>
          <button
            type="button"
            className="vo-pop"
            disabled={streakBusy}
            onClick={() => { void exportToStreak(); }}
          >
            {streakBusy ? "Exporting…" : "Export to Streak"}
          </button>
        </div>
        {streakNote ? <p className="strategy-engine-note" role="status">{streakNote}</p> : null}
      </section>
    </div>
  );
}

export function StrategiesWorkspace() {
  const [activeSection, setActiveSection] = useState<StrategiesSection>(strategiesSectionFromUrl);
  const [sortKey, setSortKey] = useState<ComposerSortKey>("annualized");
  const [mine, setMine] = useState<SavedLibraryItem[]>([]);
  const [open, setOpen] = useState<OpenStrategy | null>(null);
  const [engineCache, setEngineCache] = useState<LibraryNseStatsCache>(() => bundledLibraryNseStats());
  const sorted = useMemo(
    () => sortComposerStrategies(applyLibraryNseStats(COMPOSER_STRATEGIES, engineCache), sortKey),
    [engineCache, sortKey],
  );
  const catalogPicks = useMemo(
    () => [
      ...mine.map((item) => ({ id: item.id, name: item.name })),
      ...sorted.map((card) => ({ id: card.id, name: card.name })),
    ],
    [mine, sorted],
  );
  const closeDialog = useCallback(() => setOpen(null), []);

  useEffect(() => {
    let cancelled = false;
    void listStrategyLibrary().then(async (items) => {
      const loaded = await Promise.all(items.filter((item) => item.hasTree).map(async (item) => {
        const document = await loadStrategyFromLibrary(item.id);
        return document.tree ? { id: item.id, name: item.name, tree: document.tree } : null;
      }));
      if (!cancelled) setMine(loaded.filter((item): item is SavedLibraryItem => item !== null));
    }).catch(() => {
      if (!cancelled) setMine([]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadLibraryNseStats().then((cache) => {
      if (!cancelled && cache.strategies) setEngineCache(cache);
    }).catch(() => {
      // Bundled yfinance NSE snapshot stays on screen if the live endpoint is down.
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const sync = () => {
      if (!isLocationView("strategies")) return;
      const section = strategiesSectionFromUrl();
      setActiveSection(section);
      expandDashboardSection(dashboardSectionNumberFromNavId(section));
    };
    sync();
    const retry = window.setTimeout(sync, 0);
    const stopListening = listenToStratjiLocation(sync);
    return () => {
      window.clearTimeout(retry);
      stopListening();
    };
  }, []);

  const strategiesActions = useMemo(
    () => buildStrategiesDailyActions({ libraryCount: COMPOSER_STRATEGIES.length }),
    [],
  );
  const satyaCatalog = satyaSuggestionsForWorkspace("strategies", { section: activeSection });
  useSatyaTaskContext("strategies", {
    task: "strategy",
    hint: satyaCatalog.hint ?? "Strategies library / Y-2 compare language only. Satya will not reconstruct Composer trees.",
    context: `${COMPOSER_STRATEGIES.length} NSE ETF trees as-of ${COMPOSER_RESEARCH_AS_OF}. Mine: ${mine.map((item) => item.name).join(", ") || "none"}. Top cards: ${sorted.slice(0, 8).map((card) => card.name).join("; ")}.`,
    placeholder: satyaCatalog.placeholder ?? "e.g. What Axis Research notes speak to quality versus momentum library themes?",
    suggestions: satyaCatalog.suggestions,
  });

  return (
    <div className="strategies-workspace-shell investment-workspace-shell" data-workspace="strategies" data-active-section={activeSection} data-focus-section={activeSection}>
      <header className="strategies-workspace-chrome">
        <h2>Strategies</h2>
      </header>

      <div id="strategies-y1" className="workspace-section action-board-workspace-section" hidden={activeSection !== "y1"}>
        <CollapsibleSection number={strategiesSectionNumber("y1")} title="Action Board" note="Clickable daily actions for the public strategy library" defaultOpen={activeSection === "y1"}>
          <DailyKanbanBoard workspace="strategies" items={strategiesActions}/>
        </CollapsibleSection>
      </div>

      <div id="strategies-y2" className="workspace-section" hidden={activeSection !== "y2"}>
        <CollapsibleSection number={strategiesSectionNumber("y2")} title="Library" note="NSE ETF adaptations · complete StrategyTreeV1 · Indian market only · live 128-KPI values open on Algorithm Canvas" defaultOpen={activeSection === "y2"}>
          {mine.length > 0 && (
            <section className="strategies-mine" aria-label="My library">
              <h3>My library</h3>
              <div className="strategies-gallery">
                {mine.map((item) => (
                  <StrategyOverviewCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    onOpen={() => setOpen({ source: "mine", item })}
                  />
                ))}
              </div>
            </section>
          )}
          <div className="strategies-library-toolbar">
            <p>
              {COMPOSER_STRATEGIES.length} NSE ETF trees adapted from{" "}
              <a href={COMPOSER_CATALOG_URL} target="_blank" rel="noreferrer">composer.trade/trading-strategies</a>
              {" · "}logic as-of {COMPOSER_RESEARCH_AS_OF}. Indian market only — no US/Nasdaq tickers.
              {" "}KPIs are yfinance NSE tree-backtest results
              {engineCache.asOf ? ` (as-of ${engineCache.asOf})` : ""}
              {engineCache.computedAt ? `, cached ${engineCache.computedAt.slice(0, 10)}` : ""}
              — not Composer published US OOS. {engineCache.message} Live 128-KPI values are fetched on Algorithm Canvas after Open in Algorithm Canvas.
              {" "}Click a card to open the full vertical tree.
            </p>
            <div className="strategies-sort" role="group" aria-label="Sort library">
              {([
                ["annualized", "Most annualized"],
                ["cumulative", "Most cumulative"],
                ["sharpe", "Highest Sharpe"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`vo-pop${sortKey === key ? " active" : ""}`}
                  aria-pressed={sortKey === key}
                  onClick={() => setSortKey(key)}
                >{label}</button>
              ))}
            </div>
            <LibraryLab catalog={catalogPicks} />
          </div>
          <div className="strategies-gallery" data-testid="strategies-gallery">
            {sorted.map((card) => (
              <StrategyOverviewCard
                key={card.id}
                id={card.id}
                name={card.name}
                stats={card.stats}
                onOpen={() => setOpen({ source: "composer", card })}
              />
            ))}
          </div>
          <aside className="strategy-unreconstructed" aria-label="Pages not reconstructed">
            <h3>Not reconstructed</h3>
            <ul>
              {COMPOSER_UNRECONSTRUCTED.map((item) => (
                <li key={item.sourceUrl}>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.name}</a>
                  {" — "}{item.reason}
                </li>
              ))}
            </ul>
          </aside>
        </CollapsibleSection>
      </div>
      {open ? <StrategyDetailDialog open={open} onClose={closeDialog} /> : null}
    </div>
  );
}
