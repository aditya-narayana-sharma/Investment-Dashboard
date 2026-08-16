"use client";

import { ASSET_CLASSES, normalizeAssetClasses, type AssetClass } from "../../strategy/asset-classes";
import type { ComparatorOp, LogicalOp, StrategyGraphV2, StrategyNode } from "../../strategy/graph-types";
import { PORT_LEGEND } from "../../strategy/ports";
import type { GraphValidation } from "../../strategy/validate";

const COMPARATOR_OPS: ComparatorOp[] = ["<", "<=", ">", ">=", "==", "!="];
const LOGICAL_OPS: LogicalOp[] = ["and", "or"];

function toggleAssetClass(current: AssetClass[], next: AssetClass): AssetClass[] {
  return current.includes(next) ? current.filter((item) => item !== next) : [...current, next];
}

export function BuilderInspector({
  graph,
  selectedId,
  validation,
  disabled,
  onChangeNode,
  onDelete,
}: {
  graph: StrategyGraphV2;
  selectedId: string | null;
  validation: GraphValidation;
  disabled: boolean;
  onChangeNode: (nodeId: string, patch: Partial<StrategyNode>, params?: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
}) {
  const node = graph.nodes.find((item) => item.id === selectedId) ?? null;
  const storedAssetClasses = node?.kind === "universe" && Array.isArray(node.params.assetClasses);
  const assetClasses = node?.kind === "universe"
    ? (storedAssetClasses ? normalizeAssetClasses(node.params.assetClasses) : ["Equity", "ETF"] as AssetClass[])
    : [];

  return (
    <aside className="builder-inspector" aria-label="Node inspector">
      <header className="builder-port-legend" aria-label="Port legend">
        {PORT_LEGEND.map((port) => (
          <span key={port.kind}><i style={{ background: port.color }} />{port.label}</span>
        ))}
      </header>
      {node ? (
        <div className="builder-inspector-body">
          <label>Label
            <input
              value={node.label ?? ""}
              disabled={disabled}
              onChange={(event) => onChangeNode(node.id, { label: event.target.value })}
            />
          </label>
          <p><span>Kind</span><b>{node.kind}</b></p>
          <p><span>ID</span><code>{node.id}</code></p>
          {node.kind === "allocation" && (
            <label>Weightage
              <input
                type="number"
                min={0}
                max={100}
                disabled={disabled}
                value={typeof node.params.weightagePct === "number" ? node.params.weightagePct : 0}
                onChange={(event) => onChangeNode(node.id, {}, { weightagePct: Number(event.target.value) })}
              />
            </label>
          )}
          {node.kind === "universe" && (
            <div className="builder-asset-classes">
              <span>Asset class</span>
              <div className="builder-asset-chips" role="group" aria-label="Asset class">
                {ASSET_CLASSES.map((item) => {
                  const selected = assetClasses.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      className={selected ? "active" : ""}
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => onChangeNode(node.id, {}, { assetClasses: toggleAssetClass(assetClasses, item) })}
                    >{item}</button>
                  );
                })}
              </div>
            </div>
          )}
          {node.kind === "kpi" && (
            <p><span>KPI</span><code>{String(node.params.kpiId ?? "")}</code></p>
          )}
          {node.kind === "comparator" && (
            <>
              <label>Operator
                <select
                  disabled={disabled}
                  value={String(node.params.op ?? "<")}
                  onChange={(event) => onChangeNode(node.id, {}, { op: event.target.value })}
                >
                  {COMPARATOR_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              </label>
              <label>Value
                <input
                  type="number"
                  disabled={disabled}
                  value={typeof node.params.value === "number" ? node.params.value : 0}
                  onChange={(event) => onChangeNode(node.id, {}, { value: Number(event.target.value) })}
                />
              </label>
            </>
          )}
          {node.kind === "logical_group" && (
            <label>Logic
              <select
                disabled={disabled}
                value={String(node.params.op ?? "and")}
                onChange={(event) => onChangeNode(node.id, {}, { op: event.target.value })}
              >
                {LOGICAL_OPS.map((op) => <option key={op} value={op}>{op.toUpperCase()}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="builder-delete" disabled={disabled} onClick={() => onDelete(node.id)}>Delete</button>
        </div>
      ) : (
        <p className="builder-inspector-empty">Select a node to inspect. Empty canvas click deselects.</p>
      )}
      <section className={`builder-validation ${validation.ok ? "ok" : "err"}`} aria-live="polite">
        <b>{validation.stripTitle}</b>
        <small>{validation.stripDetail}</small>
        {validation.issues.length > 0 && (
          <ul>
            {validation.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className={issue.severity}>{issue.severity}: {issue.message}</li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
