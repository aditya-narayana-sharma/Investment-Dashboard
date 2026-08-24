"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { KPI_BUCKETS, KPI_REGISTRY_COUNT, kpiById, searchKpis, type KpiBucketId } from "../../../packages/kpi-registry";
import { ASSET_CLASSES, type AssetClass } from "../../strategy/asset-classes";
import type { ComparatorOp, TreeBlockKind, TreeNode, TreeOperand, WeightChild } from "../../strategy/graph-types";
import type { TreeLivePreview } from "../../strategy/tree-live";
import { treeAssetWarning } from "../../strategy/tree-instruments";
import type { TreeInsertSlot } from "../../strategy/tree-ops";
import { AssetInstrumentPicker } from "./AssetInstrumentPicker";

export const ADD_BLOCK_ITEMS: Array<{ kind: TreeBlockKind; label: string; detail: string; tone: string }> = [
  { kind: "asset", label: "Asset", detail: "Symbol leaf", tone: "slate" },
  { kind: "group", label: "Group", detail: "Named folder", tone: "slate" },
  { kind: "weight", label: "Weight (Allocation)", detail: "Specified or Inverse Vol", tone: "green" },
  { kind: "if_else", label: "If/Else (Condition)", detail: "Then / else branches", tone: "blue" },
  { kind: "any_all", label: "Any/All (Multiple Conditions)", detail: "AND / OR group", tone: "blue" },
  { kind: "filter", label: "Filter", detail: "Equity / ETF / Cash", tone: "pink" },
];

const COMPARATOR_OPS: ComparatorOp[] = ["<", "<=", ">", ">=", "==", "!="];

function blockTone(kind: TreeBlockKind): string {
  switch (kind) {
    case "weight":
      return "green";
    case "if_else":
      return "blue";
    case "any_all":
      return "blue";
    case "filter":
      return "pink";
    case "asset":
    case "group":
      return "slate";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function kindTitle(kind: TreeBlockKind): string {
  switch (kind) {
    case "asset":
      return "ASSET";
    case "group":
      return "GROUP";
    case "weight":
      return "WEIGHT";
    case "if_else":
      return "IF";
    case "any_all":
      return "ANY / ALL";
    case "filter":
      return "FILTER";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function operandText(operand: TreeOperand): string {
  switch (operand.type) {
    case "number":
      return String(operand.value);
    case "kpi": {
      const label = kpiById(operand.kpiId)?.label ?? operand.kpiId;
      return `${label} of ${operand.symbol || "—"}`;
    }
    default: {
      const _never: never = operand;
      return _never;
    }
  }
}

function comparatorWord(op: ComparatorOp): string {
  switch (op) {
    case ">":
      return ">";
    case ">=":
      return "≥";
    case "<":
      return "<";
    case "<=":
      return "≤";
    case "==":
      return "=";
    case "!=":
      return "≠";
    default: {
      const _never: never = op;
      return _never;
    }
  }
}

export function AddBlockMenu({
  disabled,
  onAdd,
  onClose,
}: {
  disabled: boolean;
  onAdd: (kind: TreeBlockKind) => void;
  onClose: () => void;
}) {
  return (
    <div className="symphony-add-menu" role="menu" aria-label="Add a Block">
      {ADD_BLOCK_ITEMS.map((item) => (
        <button
          key={item.kind}
          type="button"
          role="menuitem"
          className={`symphony-add-item ${item.tone}`}
          disabled={disabled}
          data-block-kind={item.kind}
          onClick={() => {
            onAdd(item.kind);
            onClose();
          }}
        >
          <b>{item.label}</b>
          <small>{item.detail}</small>
        </button>
      ))}
    </div>
  );
}

function AddBlockButton({
  disabled,
  open,
  onToggle,
  onAdd,
}: {
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
  onAdd: (kind: TreeBlockKind) => void;
}) {
  return (
    <div className="symphony-add-wrap">
      <button
        type="button"
        className="symphony-add-block"
        disabled={disabled}
        aria-expanded={open}
        onClick={onToggle}
      >
        + Add a Block
      </button>
      {open && !disabled && (
        <AddBlockMenu disabled={disabled} onAdd={onAdd} onClose={onToggle} />
      )}
    </div>
  );
}

function formatLiveNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function OperandPicker({
  operand,
  disabled,
  allowNumber,
  ariaLabel,
  live,
  onChange,
}: {
  operand: TreeOperand;
  disabled: boolean;
  allowNumber: boolean;
  ariaLabel: string;
  live?: TreeLivePreview;
  onChange: (next: TreeOperand) => void;
}) {
  const pickerId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<KpiBucketId | "all">("all");
  const matches = useMemo(() => searchKpis(query, bucket), [query, bucket]);
  const mode = operand.type;
  const kpiLabel = operand.type === "kpi" ? (kpiById(operand.kpiId)?.label ?? operand.kpiId) : "Select KPI";

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  return (
    <div className="symphony-operand" aria-label={ariaLabel}>
      {allowNumber && (
        <select
          value={mode}
          disabled={disabled}
          aria-label={`${ariaLabel} type`}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "number") onChange({ type: "number", value: 0 });
            else onChange({ type: "kpi", kpiId: "close", symbol: operand.type === "kpi" ? operand.symbol : "" });
          }}
        >
          <option value="kpi">KPI</option>
          <option value="number">Number</option>
        </select>
      )}
      {operand.type === "number" ? (
        <input
          type="number"
          value={operand.value}
          disabled={disabled}
          aria-label={`${ariaLabel} value`}
          onChange={(event) => onChange({ type: "number", value: Number(event.target.value) })}
        />
      ) : (
        <>
          <div className="symphony-kpi-picker" ref={rootRef}>
            <button
              type="button"
              className="symphony-kpi-trigger"
              disabled={disabled}
              aria-label={`${ariaLabel} KPI`}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={pickerId}
              onClick={(event) => {
                event.stopPropagation();
                if (disabled) return;
                if (open) closeMenu();
                else setOpen(true);
              }}
            >
              <span>{kpiLabel}</span>
            </button>
            {open && !disabled && (
              <div className="symphony-kpi-menu" onClick={(event) => event.stopPropagation()}>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder="Search KPIs"
                  aria-label={`${ariaLabel} KPI search`}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="symphony-kpi-buckets" role="group" aria-label="KPI buckets">
                  <button type="button" className={bucket === "all" ? "active" : ""} onClick={() => setBucket("all")}>ALL · {KPI_REGISTRY_COUNT}</button>
                  {KPI_BUCKETS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={bucket === item.id ? "active" : ""}
                      onClick={() => setBucket(item.id)}
                    >{item.label}</button>
                  ))}
                </div>
                <ul id={pickerId} className="symphony-kpi-hits" data-testid="symphony-kpi-picker" role="listbox" aria-label={`${ariaLabel} KPI`}>
                  {matches.map((kpi) => (
                    <li key={kpi.id}>
                      <button
                        type="button"
                        role="option"
                        disabled={disabled}
                        data-kpi-id={kpi.id}
                        aria-selected={kpi.id === operand.kpiId}
                        className={kpi.id === operand.kpiId ? "active" : ""}
                        onClick={() => {
                          onChange({ type: "kpi", kpiId: kpi.id, symbol: operand.symbol });
                          closeMenu();
                        }}
                      >
                        {kpi.label} <small>{kpi.id}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <AssetInstrumentPicker
            symbol={operand.symbol}
            disabled={disabled}
            live={live}
            ariaLabel={`${ariaLabel} symbol`}
            onChange={(next) => onChange({ ...operand, symbol: next.symbol })}
          />
        </>
      )}
    </div>
  );
}

function TreeChildren({
  nodes,
  parentId,
  slot,
  selectedId,
  disabled,
  openMenuKey,
  live,
  onSelect,
  onChange,
  onAdd,
  onDelete,
  onToggleMenu,
}: {
  nodes: TreeNode[];
  parentId: string | null;
  slot: TreeInsertSlot;
  selectedId: string | null;
  disabled: boolean;
  openMenuKey: string | null;
  live?: TreeLivePreview;
  onSelect: (id: string) => void;
  onChange: (node: TreeNode) => void;
  onAdd: (parentId: string | null, kind: TreeBlockKind, slot: TreeInsertSlot) => void;
  onDelete?: (id: string) => void;
  onToggleMenu: (key: string | null) => void;
}) {
  const menuKey = `${parentId ?? "root"}:${slot}`;
  return (
    <div className="symphony-children" data-orientation="vertical" data-stem="l">
      {nodes.map((child) => (
        <div key={child.id} className="symphony-stem">
          <TreeBlockView
            node={child}
            selectedId={selectedId}
            disabled={disabled}
            openMenuKey={openMenuKey}
            live={live}
            onSelect={onSelect}
            onChange={onChange}
            onAdd={onAdd}
            onDelete={onDelete}
            onToggleMenu={onToggleMenu}
          />
        </div>
      ))}
      <AddBlockButton
        disabled={disabled}
        open={openMenuKey === menuKey}
        onToggle={() => onToggleMenu(openMenuKey === menuKey ? null : menuKey)}
        onAdd={(kind) => onAdd(parentId, kind, slot)}
      />
    </div>
  );
}

function WeightBranches({
  parent,
  selectedId,
  disabled,
  openMenuKey,
  live,
  onSelect,
  onChange,
  onAdd,
  onDelete,
  onToggleMenu,
  onPercent,
}: {
  parent: Extract<TreeNode, { kind: "weight" }>;
  selectedId: string | null;
  disabled: boolean;
  openMenuKey: string | null;
  live?: TreeLivePreview;
  onSelect: (id: string) => void;
  onChange: (node: TreeNode) => void;
  onAdd: (parentId: string | null, kind: TreeBlockKind, slot: TreeInsertSlot) => void;
  onDelete?: (id: string) => void;
  onToggleMenu: (key: string | null) => void;
  onPercent: (childId: string, percent: number) => void;
}) {
  const menuKey = `${parent.id}:children`;
  return (
    <div className="symphony-children symphony-weight-children" data-stem-count={parent.children.length} data-orientation="vertical" data-stem="l">
      {parent.children.map((child: WeightChild) => (
        <div key={child.node.id} className="symphony-branch symphony-stem">
          {parent.params.method === "specified" && (
            <label className="symphony-percent">
              <input
                type="number"
                min={0}
                max={100}
                value={child.percent ?? 0}
                disabled={disabled}
                aria-label={`${child.node.label ?? child.node.kind} weight percent`}
                onChange={(event) => onPercent(child.node.id, Number(event.target.value))}
              />
              <span>%</span>
            </label>
          )}
          <TreeBlockView
            node={child.node}
            selectedId={selectedId}
            disabled={disabled}
            openMenuKey={openMenuKey}
            live={live}
            onSelect={onSelect}
            onChange={onChange}
            onAdd={onAdd}
            onDelete={onDelete}
            onToggleMenu={onToggleMenu}
          />
        </div>
      ))}
      <AddBlockButton
        disabled={disabled}
        open={openMenuKey === menuKey}
        onToggle={() => onToggleMenu(openMenuKey === menuKey ? null : menuKey)}
        onAdd={(kind) => onAdd(parent.id, kind, "children")}
      />
    </div>
  );
}

function TreeBlockView({
  node,
  selectedId,
  disabled,
  openMenuKey,
  live,
  onSelect,
  onChange,
  onAdd,
  onDelete,
  onToggleMenu,
}: {
  node: TreeNode;
  selectedId: string | null;
  disabled: boolean;
  openMenuKey: string | null;
  live?: TreeLivePreview;
  onSelect: (id: string) => void;
  onChange: (node: TreeNode) => void;
  onAdd: (parentId: string | null, kind: TreeBlockKind, slot: TreeInsertSlot) => void;
  onDelete?: (id: string) => void;
  onToggleMenu: (key: string | null) => void;
}) {
  const selected = selectedId === node.id;
  const tone = blockTone(node.kind);
  const liveNode = live?.nodes[node.id];
  const leaf = node.kind === "asset";

  const deleteButton = selected && onDelete ? (
    <button
      type="button"
      className="builder-delete"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onDelete(node.id);
      }}
    >Delete</button>
  ) : null;

  const header = (
    <header className="symphony-block-head symphony-chip">
      {node.kind !== "if_else" && node.kind !== "asset" && <span>{kindTitle(node.kind)}</span>}
      {node.kind === "weight" && (
        <select
          value={node.params.method}
          disabled={disabled}
          aria-label="Weight method"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const method = event.target.value === "inverse_volatility" ? "inverse_volatility" : "specified";
            onChange({
              ...node,
              params: method === "inverse_volatility"
                ? { method, lookbackDays: node.params.lookbackDays ?? 30 }
                : { method: "specified" },
            });
          }}
        >
          <option value="specified">Specified</option>
          <option value="inverse_volatility">Inverse Volatility 30d</option>
        </select>
      )}
      {node.kind === "any_all" && (
        <select
          value={node.params.op}
          disabled={disabled}
          aria-label="Any or all"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onChange({ ...node, params: { op: event.target.value === "or" ? "or" : "and" } })}
        >
          <option value="and">All (AND)</option>
          <option value="or">Any (OR)</option>
        </select>
      )}
      {node.kind === "group" && (
        <input
          className="symphony-group-name"
          value={node.label ?? ""}
          disabled={disabled}
          placeholder="Group name"
          aria-label="Group name"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onChange({ ...node, label: event.target.value })}
        />
      )}
      {node.kind === "if_else" && (
        <p className="symphony-if-sentence">
          IF {operandText(node.params.left)} {comparatorWord(node.params.op)} {operandText(node.params.right)}
        </p>
      )}
      {node.kind === "filter" && (
        <div className="builder-asset-chips" role="group" aria-label="Filter asset classes" onClick={(event) => event.stopPropagation()}>
          {ASSET_CLASSES.map((item: AssetClass) => {
            const active = node.params.assetClasses.includes(item);
            return (
              <button
                key={item}
                type="button"
                className={active ? "active" : ""}
                disabled={disabled}
                onClick={() => {
                  const assetClasses = active
                    ? node.params.assetClasses.filter((entry) => entry !== item)
                    : [...node.params.assetClasses, item];
                  onChange({ ...node, params: { ...node.params, assetClasses } });
                }}
              >{item}</button>
            );
          })}
        </div>
      )}
      {node.kind !== "asset" && deleteButton}
    </header>
  );

  let body: ReactNode;
  switch (node.kind) {
    case "asset": {
      const warning = live
        ? treeAssetWarning({
          symbol: node.params.symbol,
          instrument: liveNode?.instrument,
          previewStatus: live.status,
          watchlistStatus: live.watchlist.status,
        })
        : null;
      body = (
        <div className="symphony-fields" onClick={(event) => event.stopPropagation()}>
          <div className="symphony-chip">
            <AssetInstrumentPicker
              symbol={node.params.symbol}
              label={node.label}
              disabled={disabled}
              live={live}
              onChange={(next) => onChange({
                ...node,
                label: next.name || "Asset",
                params: { symbol: next.symbol },
              })}
            />
            {deleteButton}
          </div>
          {liveNode?.instrument && (
            <p className="symphony-live-badge" data-status={live?.kiteStatus ?? "unavailable"}>
              {formatLiveNumber(liveNode.instrument.lastPrice) !== "—" ? `last ${formatLiveNumber(liveNode.instrument.lastPrice)}` : live?.kiteStatus ?? "unavailable"}
              {liveNode.instrument.qty !== undefined ? ` · qty ${formatLiveNumber(liveNode.instrument.qty)}` : ""}
            </p>
          )}
          {warning && (
            <p className="symphony-live-badge" data-status={live?.status === "live" ? "unavailable" : live?.status}>
              {warning}
            </p>
          )}
        </div>
      );
      break;
    }
    case "group":
      body = (
        <TreeChildren
          nodes={node.children}
          parentId={node.id}
          slot="children"
          selectedId={selectedId}
          disabled={disabled}
          openMenuKey={openMenuKey}
          live={live}
          onSelect={onSelect}
          onChange={onChange}
          onAdd={onAdd}
          onDelete={onDelete}
          onToggleMenu={onToggleMenu}
        />
      );
      break;
    case "weight":
      body = (
        <WeightBranches
          parent={node}
          selectedId={selectedId}
          disabled={disabled}
          openMenuKey={openMenuKey}
          live={live}
          onSelect={onSelect}
          onChange={onChange}
          onAdd={onAdd}
          onDelete={onDelete}
          onToggleMenu={onToggleMenu}
          onPercent={(childId, percent) => onChange({
            ...node,
            children: node.children.map((child) => (
              child.node.id === childId ? { ...child, percent } : child
            )),
          })}
        />
      );
      break;
    case "if_else":
      body = (
        <>
          {liveNode && (
            <p className="symphony-live-badge" data-status={liveNode.passed === null ? "unavailable" : live?.kiteStatus ?? "unavailable"}>
              {liveNode.passed === true ? "Condition passes" : liveNode.passed === false ? "Condition fails" : "Condition unavailable"}
              {liveNode.left ? ` · ${liveNode.left.label ?? liveNode.left.kpiId} ${formatLiveNumber(liveNode.left.value)}` : ""}
              {liveNode.right ? ` vs ${liveNode.right.label ?? liveNode.right.kpiId} ${formatLiveNumber(liveNode.right.value)}` : ""}
              {liveNode.left?.asOf ? ` · as-of ${liveNode.left.asOf}` : ""}
            </p>
          )}
          {selected && (
            <div className="symphony-if-operands" onClick={(event) => event.stopPropagation()}>
              <OperandPicker
                operand={node.params.left}
                disabled={disabled}
                allowNumber={false}
                ariaLabel="If left operand"
                live={live}
                onChange={(left) => onChange({ ...node, params: { ...node.params, left } })}
              />
              <select
                value={node.params.op}
                disabled={disabled}
                aria-label="If operator"
                onChange={(event) => onChange({ ...node, params: { ...node.params, op: event.target.value as ComparatorOp } })}
              >
                {COMPARATOR_OPS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <OperandPicker
                operand={node.params.right}
                disabled={disabled}
                allowNumber
                ariaLabel="If right operand"
                live={live}
                onChange={(right) => onChange({ ...node, params: { ...node.params, right } })}
              />
            </div>
          )}
          <div className="symphony-if-wells" data-orientation="vertical">
            <section className="symphony-well" aria-label="Then">
              <h4>THEN</h4>
              <TreeChildren
                nodes={node.then}
                parentId={node.id}
                slot="then"
                selectedId={selectedId}
                disabled={disabled}
                openMenuKey={openMenuKey}
                live={live}
                onSelect={onSelect}
                onChange={onChange}
                onAdd={onAdd}
                onDelete={onDelete}
                onToggleMenu={onToggleMenu}
              />
            </section>
            <section className="symphony-well else" aria-label="Else">
              <h4>ELSE</h4>
              <TreeChildren
                nodes={node.else}
                parentId={node.id}
                slot="else"
                selectedId={selectedId}
                disabled={disabled}
                openMenuKey={openMenuKey}
                live={live}
                onSelect={onSelect}
                onChange={onChange}
                onAdd={onAdd}
                onDelete={onDelete}
                onToggleMenu={onToggleMenu}
              />
            </section>
          </div>
        </>
      );
      break;
    case "any_all":
      body = (
        <TreeChildren
          nodes={node.children}
          parentId={node.id}
          slot="children"
          selectedId={selectedId}
          disabled={disabled}
          openMenuKey={openMenuKey}
          live={live}
          onSelect={onSelect}
          onChange={onChange}
          onAdd={onAdd}
          onDelete={onDelete}
          onToggleMenu={onToggleMenu}
        />
      );
      break;
    case "filter":
      body = (
        <TreeChildren
          nodes={node.children}
          parentId={node.id}
          slot="children"
          selectedId={selectedId}
          disabled={disabled}
          openMenuKey={openMenuKey}
          live={live}
          onSelect={onSelect}
          onChange={onChange}
          onAdd={onAdd}
          onDelete={onDelete}
          onToggleMenu={onToggleMenu}
        />
      );
      break;
    default: {
      const _never: never = node;
      body = _never;
    }
  }

  return (
    <article
      className={`symphony-block ${tone}${selected ? " selected" : ""}${leaf ? " is-leaf" : ""}`}
      data-block-kind={node.kind}
      data-node-id={node.id}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      {node.kind !== "asset" && header}
      {body}
    </article>
  );
}

export function TreeCanvas({
  name,
  nodes,
  selectedId,
  disabled,
  live,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}: {
  name: string;
  nodes: TreeNode[];
  selectedId: string | null;
  disabled: boolean;
  live?: TreeLivePreview;
  onSelect: (id: string | null) => void;
  onChange: (node: TreeNode) => void;
  onAdd: (parentId: string | null, kind: TreeBlockKind, slot: TreeInsertSlot) => void;
  onDelete?: (id: string) => void;
}) {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  return (
    <div
      className="builder-canvas symphony-tree"
      data-testid="algorithm-tree-workarea"
      data-canvas-mode="tree"
      data-tree-orientation="vertical"
      data-tree-style="composer"
      onClick={() => {
        onSelect(null);
        setOpenMenuKey(null);
      }}
    >
      <div className="symphony-root">
        <h3>{name}</h3>
        <TreeChildren
          nodes={nodes}
          parentId={null}
          slot="children"
          selectedId={selectedId}
          disabled={disabled}
          openMenuKey={openMenuKey}
          live={live}
          onSelect={onSelect}
          onChange={onChange}
          onAdd={onAdd}
          onDelete={onDelete}
          onToggleMenu={setOpenMenuKey}
        />
      </div>
    </div>
  );
}
