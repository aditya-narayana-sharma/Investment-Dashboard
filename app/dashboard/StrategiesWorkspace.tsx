"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMPOSER_CATALOG_URL,
  COMPOSER_RESEARCH_AS_OF,
  COMPOSER_STRATEGIES,
  COMPOSER_UNRECONSTRUCTED,
  sortComposerStrategies,
  type ComposerSortKey,
  type ComposerStrategyCard,
} from "../strategy/composer-strategies";
import { listStrategyLibrary, loadStrategyFromLibrary } from "../strategy/persist";
import type { StrategyTreeV1 } from "../strategy/graph-types";
import { CollapsibleSection, DailyKanbanBoard, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import { ReadOnlyTree } from "./strategies/ReadOnlyTree";
import "./strategies/strategies-workspace.css";
import type { StrategiesSection } from "./types";
import { parseStrategiesSection, strategiesSectionNumber } from "./workspace-routing";

const STRATEGIES_SECTIONS = [
  { id: "y1", label: "Action Board" },
  { id: "y2", label: "Library" },
] as const;

function strategiesSectionFromUrl(): StrategiesSection {
  return parseStrategiesSection(new URLSearchParams(window.location.search).get("section"));
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

function openInBuilder(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "builder");
  url.searchParams.set("section", "canvas");
  url.searchParams.set("tree", id);
  url.searchParams.delete("page");
  window.history.pushState({ view: "builder", section: "canvas", tree: id }, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function StrategyCard({ card, featured }: { card: ComposerStrategyCard; featured?: boolean }) {
  return (
    <article className="strategy-card" data-strategy-id={card.id} data-featured={featured ? "true" : "false"}>
      <header className="strategy-card-head">
        <h3>{card.name}</h3>
        <p>{card.description}</p>
      </header>
      <dl className="strategy-card-stats" aria-label="Published Composer out-of-sample stats">
        <div><small>OOS annualized</small><b>{formatPct(card.stats.annualizedReturnPct)}</b></div>
        <div><small>OOS cumulative</small><b>{formatPct(card.stats.cumulativeReturnPct)}</b></div>
        <div><small>OOS Sharpe</small><b>{formatNum(card.stats.sharpe)}</b></div>
        <div><small>OOS max DD</small><b>{formatPct(-Math.abs(card.stats.maxDrawdownPct))}</b></div>
        <div><small>OOS Calmar</small><b>{formatNum(card.stats.calmar)}</b></div>
        <div><small>OOS start</small><b>{card.stats.oosStart}</b></div>
      </dl>
      <ReadOnlyTree tree={card.tree} />
      <div className="strategy-card-notes">
        <p><b>Composer-public reconstruction</b> — {card.reconstructionNote}</p>
        <p>{card.marketNote}</p>
        <p>{card.mappingNote}</p>
        <p>
          Source: <a href={card.sourceUrl} target="_blank" rel="noreferrer">{card.sourceUrl}</a>
          {" · "}as-of {card.asOf}
        </p>
      </div>
      <div className="strategy-card-actions">
        <button type="button" className="vo-pop" onClick={() => openInBuilder(card.id)}>
          Open in Algorithm Canvas
        </button>
      </div>
    </article>
  );
}

export function StrategiesWorkspace() {
  const [activeSection, setActiveSection] = useState<StrategiesSection>("y2");
  const [sortKey, setSortKey] = useState<ComposerSortKey>("annualized");
  const [mine, setMine] = useState<Array<{ id: string; name: string; tree: StrategyTreeV1 }>>([]);
  const sorted = useMemo(() => sortComposerStrategies(COMPOSER_STRATEGIES, sortKey), [sortKey]);
  const featured = sorted[0];

  useEffect(() => {
    let cancelled = false;
    void listStrategyLibrary().then(async (items) => {
      const loaded = await Promise.all(items.filter((item) => item.hasTree).map(async (item) => {
        const document = await loadStrategyFromLibrary(item.id);
        return document.tree ? { id: item.id, name: item.name, tree: document.tree } : null;
      }));
      if (!cancelled) setMine(loaded.filter((item): item is { id: string; name: string; tree: StrategyTreeV1 } => item !== null));
    }).catch(() => {
      if (!cancelled) setMine([]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const sync = () => setActiveSection(strategiesSectionFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const selectSection = useCallback((sectionId: string) => {
    const section = parseStrategiesSection(sectionId);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "strategies");
    url.searchParams.set("section", section);
    url.searchParams.delete("page");
    url.searchParams.delete("tree");
    window.history.pushState({ view: "strategies", section }, "", url);
    setActiveSection(section);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
    document.getElementById(`strategies-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="strategies-workspace-shell investment-workspace-shell" data-workspace="strategies">
      <header className="strategies-workspace-chrome">
        <h2>Strategies</h2>
        <WorkspaceSectionNav
          label="Strategies sections"
          sections={STRATEGIES_SECTIONS}
          activeId={activeSection}
          onSelect={selectSection}
        />
      </header>

      <div id="strategies-y1" className="workspace-section action-board-workspace-section">
        <CollapsibleSection number={strategiesSectionNumber("y1")} title="Action Board" note="Clickable daily actions for the public strategy library">
          <DailyKanbanBoard workspace="strategies"/>
        </CollapsibleSection>
      </div>

      <div id="strategies-y2" className="workspace-section">
        <CollapsibleSection number={strategiesSectionNumber("y2")} title="Library" note="Composer-public reconstructions · complete StrategyTreeV1 · US symbols as published">
          {mine.length > 0 && (
            <section className="strategies-mine" aria-label="My library">
              <h3>My library</h3>
              <div className="strategies-gallery">
                {mine.map((item) => (
                  <article key={item.id} className="strategy-card" data-strategy-id={item.id}>
                    <header className="strategy-card-head">
                      <h3>{item.name}</h3>
                      <p>Saved tree from this dashboard library.</p>
                    </header>
                    <ReadOnlyTree tree={item.tree} />
                    <div className="strategy-card-actions">
                      <button type="button" className="vo-pop" onClick={() => openInBuilder(item.id)}>
                        Open in Algorithm Canvas
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <div className="strategies-library-toolbar">
            <p>
              {COMPOSER_STRATEGIES.length} reconstructable trees from{" "}
              <a href={COMPOSER_CATALOG_URL} target="_blank" rel="noreferrer">composer.trade/trading-strategies</a>
              {" · "}as-of {COMPOSER_RESEARCH_AS_OF}. Sorted by published OOS {sortKey}. Not live broker portfolios.
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
          </div>
          {featured && (
            <div className="strategies-featured">
              <p><b>Featured · highest published OOS {sortKey}</b></p>
              <StrategyCard card={featured} featured />
            </div>
          )}
          <div className="strategies-gallery">
            {sorted.slice(1).map((card) => (
              <StrategyCard key={card.id} card={card} />
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
    </div>
  );
}
