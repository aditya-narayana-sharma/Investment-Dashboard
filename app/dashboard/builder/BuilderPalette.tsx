"use client";

import { useMemo, useState, type DragEvent as ReactDragEvent } from "react";
import { KPI_BUCKETS, KPI_REGISTRY_COUNT, searchKpis, type KpiBucketId } from "../../../packages/kpi-registry";
import type { NodeKind } from "../../strategy/graph-types";

export const BUILDER_DRAG_MIME = "application/x-strategy-node";

export const STRUCTURE_BLOCKS: Array<{ kind: NodeKind; label: string; tone: string }> = [
  { kind: "universe", label: "UNIVERSE", tone: "navy" },
  { kind: "comparator", label: "COMPARATOR", tone: "amber" },
  { kind: "entry_trigger", label: "ENTRY TRIGGER", tone: "green" },
  { kind: "exit_trigger", label: "EXIT TRIGGER", tone: "pink" },
  { kind: "allocation", label: "ALLOCATION", tone: "cyan" },
  { kind: "logical_group", label: "AND/OR", tone: "purple" },
  { kind: "risk_limit", label: "RISK LIMIT", tone: "red" },
  { kind: "paper_action", label: "PAPER ACTION", tone: "slate" },
  { kind: "broker_preview", label: "BROKER PREVIEW", tone: "gold" },
  { kind: "rebalance", label: "REBALANCE", tone: "teal" },
];

function setDragPayload(event: ReactDragEvent, payload: { kind: NodeKind; kpiId?: string }) {
  event.dataTransfer.setData(BUILDER_DRAG_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "copy";
}

export function BuilderPalette({ disabled }: { disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<KpiBucketId | "all">("all");
  const kpis = useMemo(() => searchKpis(query, bucket), [query, bucket]);

  return (
    <aside className="builder-palette" aria-label="Algorithm palette">
      <section>
        <h3>Structure</h3>
        <div className="builder-structure-list">
          {STRUCTURE_BLOCKS.map((block) => (
            <button
              key={block.kind}
              type="button"
              className={`builder-block ${block.tone}`}
              draggable={!disabled}
              disabled={disabled}
              onDragStart={(event) => setDragPayload(event, { kind: block.kind })}
            >{block.label}</button>
          ))}
        </div>
      </section>
      <section>
        <h3>KPI search</h3>
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Search 128 KPIs"
          aria-label="Search KPI registry"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="builder-bucket-chips" role="group" aria-label="KPI buckets">
          <button type="button" className={bucket === "all" ? "active" : ""} disabled={disabled} onClick={() => setBucket("all")}>ALL · {KPI_REGISTRY_COUNT}</button>
          {KPI_BUCKETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={bucket === item.id ? "active" : ""}
              disabled={disabled}
              onClick={() => setBucket(item.id)}
            >{item.label}</button>
          ))}
        </div>
        <ul className="builder-kpi-list">
          {kpis.map((kpi) => (
            <li key={kpi.id}>
              <button
                type="button"
                draggable={!disabled}
                disabled={disabled}
                onDragStart={(event) => setDragPayload(event, { kind: "kpi", kpiId: kpi.id })}
              >
                <b>{kpi.label}</b>
                <small>{kpi.id} · {kpi.bucket.toUpperCase()}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
