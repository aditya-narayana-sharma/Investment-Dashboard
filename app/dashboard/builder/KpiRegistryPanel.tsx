"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  KPI_BUCKETS,
  KPI_REGISTRY_COUNT,
  kpiDefinitions,
  type KpiBucketId,
  type KpiDefinition,
} from "../../../packages/kpi-registry";
import type { TreeLivePreview } from "../../strategy/tree-live";
import { AssetInstrumentPicker } from "./AssetInstrumentPicker";

function formatKpi(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(1);
  if (abs >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function allKpiIds(): string[] {
  return kpiDefinitions.map((kpi) => kpi.id);
}

function bucketKpiIds(bucket: KpiBucketId): string[] {
  return kpiDefinitions.filter((kpi) => kpi.bucket === bucket).map((kpi) => kpi.id);
}

function isBucketFullySelected(selected: ReadonlySet<string>, bucket: KpiBucketId): boolean {
  return bucketKpiIds(bucket).every((id) => selected.has(id));
}

function toggleKpiId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function toggleBucket(selected: ReadonlySet<string>, bucket: KpiBucketId): Set<string> {
  const next = new Set(selected);
  const ids = bucketKpiIds(bucket);
  if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  return next;
}

function filterTriggerLabel(selected: ReadonlySet<string>): string {
  if (selected.size === 0) return "None";
  if (selected.size === KPI_REGISTRY_COUNT) return `All ${KPI_REGISTRY_COUNT}`;
  const full = KPI_BUCKETS.filter((bucket) => isBucketFullySelected(selected, bucket.id));
  const covered = full.reduce((sum, bucket) => sum + bucketKpiIds(bucket.id).length, 0);
  if (full.length > 0 && full.length <= 2 && covered === selected.size) {
    return full.map((bucket) => bucket.label).join(", ");
  }
  return `${selected.size} of ${KPI_REGISTRY_COUNT}`;
}

function visibleDefinitions(selected: ReadonlySet<string>): KpiDefinition[] {
  return kpiDefinitions.filter((kpi) => selected.has(kpi.id));
}

export function KpiRegistryPanel({
  symbol,
  name,
  live,
  disabled = false,
  onSymbolChange,
}: {
  symbol: string;
  name?: string;
  live?: TreeLivePreview;
  disabled?: boolean;
  onSymbolChange: (next: { symbol: string; name: string }) => void;
}) {
  const filterId = useId();
  const filterRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(allKpiIds()));
  const needle = symbol.trim().toUpperCase();
  const visible = useMemo(() => visibleDefinitions(selectedIds), [selectedIds]);
  const allSelected = selectedIds.size === KPI_REGISTRY_COUNT;
  const needleQuery = query.trim().toLowerCase();
  const searchable = useMemo(
    () => (needleQuery
      ? kpiDefinitions.filter((kpi) =>
        kpi.id.toLowerCase().includes(needleQuery)
        || kpi.label.toLowerCase().includes(needleQuery)
        || kpi.bucket.includes(needleQuery)
      )
      : kpiDefinitions),
    [needleQuery],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
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
    <section className="kpi-registry-panel" aria-label={`${KPI_REGISTRY_COUNT} KPI registry`}>
      <header className="kpi-registry-head">
        <div>
          <h3>KPI registry · {KPI_REGISTRY_COUNT}</h3>
          <p>
            {visible.length} of {KPI_REGISTRY_COUNT}
            {visible.length === KPI_REGISTRY_COUNT ? " · 8×16" : ""}
            {" "}
            live or unavailable · never fabricated
          </p>
        </div>
        <div className="kpi-registry-toolbar">
          <AssetInstrumentPicker
            symbol={needle}
            label={name}
            disabled={disabled}
            live={live}
            ariaLabel="KPI registry instrument"
            onChange={onSymbolChange}
          />
          <div className="kpi-registry-filter" ref={filterRef} data-testid="kpi-registry-filter">
            <button
              type="button"
              className="kpi-registry-filter-trigger"
              aria-label="Filter KPI registry"
              aria-haspopup="true"
              aria-expanded={open}
              aria-controls={filterId}
              data-testid="kpi-registry-filter-dropdown"
              onClick={() => setOpen((current) => !current)}
            >
              <span>{filterTriggerLabel(selectedIds)}</span>
            </button>
            {open && (
              <div className="kpi-registry-filter-menu" id={filterId} onClick={(event) => event.stopPropagation()}>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder="Search 128 KPIs"
                  aria-label="Search KPI registry filter"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <ul className="kpi-registry-filter-options" role="group" aria-label="KPI registry filter">
                  <li>
                    <label>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelectedIds(allSelected ? new Set() : new Set(allKpiIds()))}
                      />
                      All {KPI_REGISTRY_COUNT}
                    </label>
                  </li>
                  {KPI_BUCKETS.map((bucket) => (
                    <li key={bucket.id}>
                      <label data-bucket={bucket.id}>
                        <input
                          type="checkbox"
                          checked={isBucketFullySelected(selectedIds, bucket.id)}
                          onChange={() => setSelectedIds((current) => toggleBucket(current, bucket.id))}
                        />
                        {bucket.label}
                        {" · "}
                        {bucketKpiIds(bucket.id).length}
                      </label>
                    </li>
                  ))}
                </ul>
                <ul className="kpi-registry-filter-kpis" role="group" aria-label="Individual KPIs">
                  {searchable.map((kpi) => (
                    <li key={kpi.id}>
                      <label data-kpi-id={kpi.id}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(kpi.id)}
                          onChange={() => setSelectedIds((current) => toggleKpiId(current, kpi.id))}
                        />
                        {kpi.label}
                        <small>{kpi.bucket.toUpperCase()}</small>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>
      {visible.length === 0 ? (
        <p className="kpi-registry-empty">No KPIs selected — engine still has {KPI_REGISTRY_COUNT} ids.</p>
      ) : (
        <ol className="kpi-registry-grid">
          {visible.map((kpi) => {
            const liveValue = needle ? live?.kpis?.[`${kpi.id}:${needle}`] : undefined;
            const status = liveValue?.status ?? "unavailable";
            return (
              <li key={kpi.id} data-kpi-id={kpi.id} data-status={status} title={liveValue?.reason ?? kpi.description}>
                <small>{kpi.label}</small>
                <b>{formatKpi(liveValue?.value)}</b>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
