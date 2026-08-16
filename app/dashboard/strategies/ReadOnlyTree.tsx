"use client";

import type { ReactNode } from "react";
import { kpiById } from "../../../packages/kpi-registry";
import { formatTickerName } from "../../strategy/builder-universe";
import type { ComparatorOp } from "../../strategy/graph-types";
import type { StrategyTreeV1, TreeBlockKind, TreeNode, TreeOperand } from "../../strategy/strategy-tree";
import "./strategies-workspace.css";

function blockTone(kind: TreeBlockKind): string {
  switch (kind) {
    case "weight":
      return "green";
    case "if_else":
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
      return `${label} of ${operand.symbol ? formatTickerName(operand.symbol) : "—"}`;
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

function CompactStack({ nodes }: { nodes: TreeNode[] }) {
  if (nodes.length === 0) {
    return <p className="strategy-vtree-empty">Empty</p>;
  }
  return (
    <div className="strategy-vtree-stack">
      {nodes.map((node) => (
        <CompactBlock key={node.id} node={node} />
      ))}
    </div>
  );
}

function CompactBlock({ node }: { node: TreeNode }) {
  const tone = blockTone(node.kind);
  let body: ReactNode;
  switch (node.kind) {
    case "asset":
      body = <b className="strategy-vtree-symbol">{formatTickerName(node.params.symbol)}</b>;
      break;
    case "group":
      body = <CompactStack nodes={node.children} />;
      break;
    case "weight":
      body = (
        <div className="strategy-vtree-sleeves">
          {node.children.map((child) => (
            <div key={child.node.id} className="strategy-vtree-sleeve">
              {node.params.method === "specified" && (
                <span className="strategy-vtree-percent">{child.percent ?? 0}%</span>
              )}
              <CompactBlock node={child.node} />
            </div>
          ))}
        </div>
      );
      break;
    case "if_else":
      body = (
        <>
          <p className="strategy-vtree-if">
            IF {operandText(node.params.left)} {comparatorWord(node.params.op)} {operandText(node.params.right)}
          </p>
          <div className="strategy-vtree-wells">
            <section className="strategy-vtree-well" aria-label="Then">
              <h4>THEN</h4>
              <CompactStack nodes={node.then} />
            </section>
            <section className="strategy-vtree-well else" aria-label="Else">
              <h4>ELSE</h4>
              <CompactStack nodes={node.else} />
            </section>
          </div>
        </>
      );
      break;
    case "any_all":
      body = <CompactStack nodes={node.children} />;
      break;
    case "filter":
      body = (
        <>
          <p className="strategy-vtree-filter">
            {(node.params.assetClasses.length ? node.params.assetClasses : ["—"]).join(" · ")}
            {node.params.symbols?.length ? ` · ${node.params.symbols.map((symbol) => formatTickerName(symbol)).join(", ")}` : ""}
          </p>
          <CompactStack nodes={node.children} />
        </>
      );
      break;
    default: {
      const _never: never = node;
      body = _never;
    }
  }

  const subtitle = node.kind === "weight"
    ? (node.params.method === "inverse_volatility" ? "Inverse Vol 30d" : "Specified")
    : node.kind === "any_all"
      ? (node.params.op === "or" ? "Any (OR)" : "All (AND)")
      : node.kind !== "asset" && node.kind !== "if_else"
        ? (node.label ?? "")
        : "";

  return (
    <article
      className={`strategy-vtree-block ${tone}`}
      data-block-kind={node.kind}
      data-node-id={node.id}
    >
      <header className="strategy-vtree-head">
        <span>{kindTitle(node.kind)}</span>
        {subtitle ? <small>{subtitle}</small> : null}
        {node.kind === "asset" && node.label && node.label !== node.params.symbol ? (
          <small>{node.label}</small>
        ) : null}
      </header>
      {body}
    </article>
  );
}

/** Compact Discover-style tree. Nested blocks only; top→bottom. No editor canvas, no live KPI fetch. */
export function ReadOnlyTree({ tree }: { tree: StrategyTreeV1 }) {
  return (
    <div
      className="strategy-readonly-tree"
      data-readonly="true"
      data-orientation="vertical"
      aria-label={`${tree.name} tree`}
    >
      <CompactStack nodes={tree.children} />
    </div>
  );
}
