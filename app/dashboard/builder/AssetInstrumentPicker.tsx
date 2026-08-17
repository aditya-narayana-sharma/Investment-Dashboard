"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BUILDER_UNIVERSE_GROUP_LABELS,
  builderUniverse,
  isBeesSymbol,
  type BuilderUniverseGroup,
} from "../../strategy/builder-universe";
import type { TreeLivePreview } from "../../strategy/tree-live";
import type { TreeInstrumentSource } from "../../strategy/tree-instruments";
import { useKiteInstrumentSearch, type KiteInstrumentOption } from "../useKiteInstrumentLookup";
import { useYfinanceInstrumentSearch } from "../useYfinanceInstrumentSearch";
import { formatInstrumentKpis, type InstrumentQuoteKpis } from "../../strategy/yfinance-tickers";

export type AssetOptionOrigin = "holding" | "watchlist" | "catalogue" | "current" | "universe" | "yfinance";

export type AssetInstrumentOption = {
  symbol: string;
  name: string;
  origin: AssetOptionOrigin;
  group?: BuilderUniverseGroup;
  kpis?: InstrumentQuoteKpis;
};

export function formatInstrumentOption(symbol: string, name?: string): string {
  const ticker = symbol.trim().toUpperCase();
  const company = (name ?? "").trim();
  if (!ticker) return "";
  if (!company || company.toUpperCase() === ticker) return ticker;
  return `${ticker} · ${company}`;
}

function originRank(item: AssetInstrumentOption): number {
  switch (item.origin) {
    case "holding":
      return 0;
    case "yfinance":
      return 1;
    case "watchlist":
      return 2;
    case "current":
      return 3;
    case "universe":
      switch (item.group) {
        case "broad":
          return 4;
        case "industry":
          return 5;
        case "thematic":
          return 6;
        case "strategy":
          return 7;
        case "equity":
          return 8;
        case undefined:
          return 8;
        default: {
          const _never: never = item.group;
          return _never;
        }
      }
    case "catalogue":
      return 9;
    default: {
      const _never: never = item.origin;
      return _never;
    }
  }
}

function groupLabel(item: AssetInstrumentOption): string {
  switch (item.origin) {
    case "holding":
      return "Holdings";
    case "yfinance":
      return "yfinance";
    case "watchlist":
      return "Watchlist";
    case "current":
      return "Current";
    case "catalogue":
      return "NSE catalogue";
    case "universe":
      return item.group ? BUILDER_UNIVERSE_GROUP_LABELS[item.group] : "Universe";
    default: {
      const _never: never = item.origin;
      return _never;
    }
  }
}

function liveStatusLabel(live?: TreeLivePreview): string | null {
  if (!live) return null;
  switch (live.status) {
    case "auth_required":
      return "Kite session missing — last known holdings/watchlist";
    case "unavailable":
      return "Kite unavailable — last known holdings/watchlist";
    case "stale":
      return "Stale holdings/watchlist";
    case "live":
      return null;
    default: {
      const _never: never = live.status;
      return _never;
    }
  }
}

function originFromInstrumentSource(source: TreeInstrumentSource): AssetOptionOrigin {
  switch (source) {
    case "holding":
    case "position":
      return "holding";
    case "watchlist":
      return "watchlist";
    case "catalogue":
      return "catalogue";
    default: {
      const _never: never = source;
      return _never;
    }
  }
}

function preferredFromLive(live?: TreeLivePreview): AssetInstrumentOption[] {
  return (live?.instruments ?? []).flatMap((item) => {
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol || isBeesSymbol(symbol)) return [];
    const origin = originFromInstrumentSource(item.source);
    const name = (item.name ?? "").trim();
    return [{ symbol, name: name.toUpperCase() === symbol ? "" : name, origin }];
  });
}

function catalogueOptions(rows: readonly KiteInstrumentOption[]): AssetInstrumentOption[] {
  return rows.flatMap((item) => {
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol || isBeesSymbol(symbol)) return [];
    const name = (item.name ?? "").trim();
    return [{ symbol, name: name.toUpperCase() === symbol ? "" : name, origin: "catalogue" as const }];
  });
}

function universeOptions(): AssetInstrumentOption[] {
  return builderUniverse().flatMap((item) => {
    if (isBeesSymbol(item.symbol)) return [];
    return [{ symbol: item.symbol, name: item.name, origin: "universe" as const, group: item.group }];
  });
}

function yfinanceOptions(rows: readonly { symbol: string; name: string; price?: number; changePct?: number; marketCap?: number; pe?: number; sector?: string; exchange?: string; currency?: string; asOf?: string }[]): AssetInstrumentOption[] {
  return rows.flatMap((item) => {
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol || isBeesSymbol(symbol)) return [];
    const name = (item.name ?? "").trim();
    const kpis: InstrumentQuoteKpis = {};
    if (item.price !== undefined) kpis.price = item.price;
    if (item.changePct !== undefined) kpis.changePct = item.changePct;
    if (item.marketCap !== undefined) kpis.marketCap = item.marketCap;
    if (item.pe !== undefined) kpis.pe = item.pe;
    if (item.sector) kpis.sector = item.sector;
    if (item.exchange) kpis.exchange = item.exchange;
    if (item.currency) kpis.currency = item.currency;
    if (item.asOf) kpis.asOf = item.asOf;
    return [{
      symbol,
      name: name.toUpperCase() === symbol ? "" : name,
      origin: "yfinance" as const,
      ...(Object.keys(kpis).length ? { kpis } : {}),
    }];
  });
}

function mergeOptions(
  preferred: readonly AssetInstrumentOption[],
  catalogue: readonly AssetInstrumentOption[],
  universe: readonly AssetInstrumentOption[],
  yfinance: readonly AssetInstrumentOption[],
  current: AssetInstrumentOption | null,
): AssetInstrumentOption[] {
  const bySymbol = new Map<string, AssetInstrumentOption>();
  for (const item of [...preferred, ...yfinance, ...universe, ...catalogue, ...(current ? [current] : [])]) {
    if (isBeesSymbol(item.symbol) && item.origin !== "current") continue;
    const existing = bySymbol.get(item.symbol);
    if (!existing || originRank(item) < originRank(existing)) {
      bySymbol.set(item.symbol, { ...item, name: item.name || existing?.name || "", group: item.group ?? existing?.group, kpis: item.kpis ?? existing?.kpis });
    } else if (!existing.name && item.name) {
      bySymbol.set(item.symbol, { ...existing, name: item.name, group: existing.group ?? item.group, kpis: existing.kpis ?? item.kpis });
    } else if (!existing.kpis && item.kpis) {
      bySymbol.set(item.symbol, { ...existing, kpis: item.kpis });
    }
  }
  return [...bySymbol.values()].sort((left, right) => {
    const rank = originRank(left) - originRank(right);
    return rank !== 0 ? rank : left.symbol.localeCompare(right.symbol);
  });
}

function matchesQuery(item: AssetInstrumentOption, query: string): boolean {
  const needle = query.trim().toUpperCase();
  if (!needle) return true;
  return item.symbol.includes(needle) || item.name.toUpperCase().includes(needle);
}

export function AssetInstrumentPicker({
  symbol,
  label,
  disabled,
  live,
  ariaLabel = "Asset instrument",
  onChange,
}: {
  symbol: string;
  label?: string;
  disabled: boolean;
  live?: TreeLivePreview;
  ariaLabel?: string;
  onChange: (next: { symbol: string; name: string }) => void;
}) {
  const pickerId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useKiteInstrumentSearch(query, open);
  const yfinance = useYfinanceInstrumentSearch(query, open);
  const ticker = symbol.trim().toUpperCase();
  const preferred = useMemo(() => preferredFromLive(live), [live]);
  const universe = useMemo(() => universeOptions(), []);
  const current = useMemo<AssetInstrumentOption | null>(() => {
    if (!ticker) return null;
    const fromLive = preferred.find((item) => item.symbol === ticker);
    if (fromLive) return fromLive;
    const fromUniverse = universe.find((item) => item.symbol === ticker);
    if (fromUniverse) return fromUniverse;
    const raw = (label ?? "").trim();
    const name = !raw || raw === "Asset" || raw.toUpperCase() === ticker ? "" : raw;
    return { symbol: ticker, name, origin: "current" };
  }, [label, preferred, ticker, universe]);
  const options = useMemo(
    () => mergeOptions(
      preferred,
      catalogueOptions(search.instruments),
      universe,
      yfinanceOptions(yfinance.instruments),
      current,
    ).filter((item) => item.origin === "yfinance" || matchesQuery(item, query)),
    [current, preferred, query, search.instruments, universe, yfinance.instruments],
  );
  const selected = current ?? preferred.find((item) => item.symbol === ticker) ?? null;
  const triggerText = selected ? formatInstrumentOption(selected.symbol, selected.name) : "Select instrument";
  const kiteLabel = liveStatusLabel(live);
  const catalogueLabel = query.trim() && search.status === "unavailable"
    ? "NSE catalogue unavailable"
    : query.trim() && search.status === "checking"
      ? "Searching NSE catalogue…"
      : null;
  const yfinanceLabel = query.trim() && yfinance.status === "unavailable"
    ? (yfinance.message || "Unavailable")
    : query.trim() && yfinance.status === "checking"
      ? "Searching yfinance…"
      : null;
  const emptyLabel = options.length === 0
    ? (query.trim() ? "No matching ticker" : "Search company, ticker, or holdings")
    : null;
  const groupedOptions = useMemo(() => options.map((item, index) => {
    const header = groupLabel(item);
    const previous = index > 0 ? options[index - 1] : undefined;
    return { item, header, showHeader: !previous || groupLabel(previous) !== header };
  }), [options]);

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  return (
    <div className="symphony-asset-picker" ref={rootRef} data-testid="asset-instrument-picker">
      <button
        type="button"
        className="symphony-asset-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={pickerId}
        data-testid="asset-instrument-dropdown"
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          if (open) closeMenu();
          else setOpen(true);
        }}
      >
        <span data-empty={ticker ? "false" : "true"}>{triggerText}</span>
      </button>
      {open && !disabled && (
        <div className="symphony-asset-menu" onClick={(event) => event.stopPropagation()}>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Search company or NSE ticker"
            aria-label="Search instruments"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul id={pickerId} className="symphony-asset-options" role="listbox" aria-label={ariaLabel}>
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!ticker}
                data-origin="empty"
                onClick={() => {
                  onChange({ symbol: "", name: "" });
                  closeMenu();
                }}
              >Select instrument</button>
            </li>
            {groupedOptions.map(({ item, header, showHeader }) => (
                <li key={`${item.origin}-${item.group ?? "none"}-${item.symbol}`}>
                  {showHeader && <p className="symphony-asset-group">{header}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.symbol === ticker}
                    data-symbol={item.symbol}
                    data-origin={item.origin}
                    data-group={item.group ?? item.origin}
                    onClick={() => {
                      onChange({ symbol: item.symbol, name: item.name || item.symbol });
                      closeMenu();
                    }}
                  >
                    <span className="symphony-asset-option-title">{formatInstrumentOption(item.symbol, item.name)}</span>
                    {item.origin === "yfinance" || item.kpis ? (
                      <small className="symphony-asset-option-kpis">{formatInstrumentKpis(item.kpis)}</small>
                    ) : null}
                  </button>
                </li>
            ))}
          </ul>
        </div>
      )}
      {kiteLabel && <small className="symphony-asset-status" data-status={live?.status}>{kiteLabel}</small>}
      {catalogueLabel && open && <small className="symphony-asset-status" data-status="unavailable">{catalogueLabel}</small>}
      {yfinanceLabel && open && <small className="symphony-asset-status" data-status={yfinance.status === "unavailable" ? "unavailable" : undefined}>{yfinanceLabel}</small>}
      {emptyLabel && open && <small className="symphony-asset-status">{emptyLabel}</small>}
    </div>
  );
}
