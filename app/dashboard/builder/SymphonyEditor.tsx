"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { KPI_REGISTRY_COUNT } from "../../../packages/kpi-registry";
import { findTreeNode, type CandleInterval, type StrategyTreeV1, type TreeBlockKind, type TreeNode } from "../../strategy/graph-types";
import {
  exportStrategyDocumentJson,
  importStrategyDocumentJson,
  runTreeBacktestOnServer,
  validateStrategyOnServer,
  type BacktestRunResponse,
  type StrategyDocument,
} from "../../strategy/persist";
import { compileTreeToGraph, validateTree } from "../../strategy/tree-compile";
import {
  TreeHistory,
  addTreeBlock,
  removeTreeNode,
  replaceTreeNode,
  type TreeInsertSlot,
} from "../../strategy/tree-ops";
import { createSeedTree } from "../../strategy/seed-tree";
import { validateStrategyGraph } from "../../strategy/validate";
import { STRATEGIES_LIVE_PATH } from "../../strategy/persist";
import type { TreeLivePreview } from "../../strategy/tree-live";
import { LlmAssistPanel } from "../LlmAssistPanel";
import { AlgorithmBuilder } from "./AlgorithmBuilder";
import { BuilderLibraryActions } from "./BuilderLibraryActions";
import { TreeBrokerConfirm, type TreeBrokerDraft } from "./TreeBrokerConfirm";
import { KpiRegistryPanel } from "./KpiRegistryPanel";
import { TreeCanvas } from "./TreeCanvas";
import "./algorithm-builder.css";

const DESKTOP_QUERY = "(min-width: 1080px)";
const INTERVALS: CandleInterval[] = ["day", "week", "month"];

const TREE_TUTORIAL_STEPS = [
  {
    title: "This is a nested tree",
    body: "Blocks nest top to bottom under parents. There are no wires. Weight percents sit on the stems. Start from the Indian Core-Satellite seed or add your own blocks.",
  },
  {
    title: "Add a Block",
    body: "Every parent has + Add a Block. Choose Asset, Group, Weight, If/Else, Any/All, or Filter. KPI boxes are not a primary block — pick KPIs inside If conditions.",
  },
  {
    title: "Weights and conditions",
    body: "Specified weights use 15 / 30 / 55 style percents on each child. If/Else compares two KPI-registry operands (or a number) and has THEN / ELSE wells.",
  },
  {
    title: "Save and preview",
    body: "Save stores the tree plus a compiled StrategyGraphV2. Configure backtest stores a request without running. Run backtest walks historical OHLCV and only reports ran=true after a real run.",
  },
] as const;

const TREE_SHORTCUTS = [
  { keys: "⌘Z / Ctrl+Z", action: "Undo tree edit" },
  { keys: "⌘⇧Z / Ctrl+Y", action: "Redo tree edit" },
  { keys: "Delete / Backspace", action: "Delete selected block" },
  { keys: "Esc", action: "Deselect or close help" },
  { keys: "?", action: "Toggle tutorial" },
] as const;

export type SymphonyEditorProps = {
  initialTree?: StrategyTreeV1;
  onDocumentChange?: (document: StrategyDocument) => void;
};

function brokerDisabledReason(live: TreeLivePreview | null, kind: "order" | "gtt" | "alert"): string | null {
  if (!live) return null;
  if (live.status === "auth_required") return "Kite session missing — authenticate first.";
  if (live.status === "unavailable") return live.message || "Kite is unavailable.";
  const count = kind === "order" ? live.orders.length : kind === "gtt" ? live.gtts.length : live.alerts.length;
  if (count === 0) {
    if (kind === "gtt") return "No GTT preview — need an If/Else numeric trigger and a last price.";
    if (kind === "alert") return "No alert preview — need an If/Else numeric threshold.";
    return "No order preview — add an Asset symbol that resolves to holdings or watchlist.";
  }
  if (kind === "gtt" && live.gtts.every((item) => item.lastPrice === undefined || item.lastPrice <= 0)) {
    return "GTT needs a Kite last price on the trigger symbol.";
  }
  return null;
}

function EquityCurve({ curve }: { curve: Array<{ date: string; equity: number; benchmark?: number }> }) {
  if (curve.length < 2) return null;
  const width = 240;
  const height = 120;
  const min = Math.min(...curve.map((point) => Math.min(point.equity, point.benchmark ?? point.equity)));
  const max = Math.max(...curve.map((point) => Math.max(point.equity, point.benchmark ?? point.equity)));
  const span = max - min || 1;
  const path = (key: "equity" | "benchmark") => curve
    .map((point, index) => {
      const value = key === "equity" ? point.equity : point.benchmark;
      if (value === undefined) return "";
      const x = (index / (curve.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg className="symphony-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Backtest equity curve">
      <path d={path("benchmark")} fill="none" stroke="#64748b" strokeWidth="1.5" />
      <path d={path("equity")} fill="none" stroke="#86efac" strokeWidth="2" />
    </svg>
  );
}

export function SymphonyEditor({ initialTree, onDocumentChange }: SymphonyEditorProps = {}) {
  const seed = useMemo(() => initialTree ?? createSeedTree(), [initialTree]);
  const historyRef = useRef<TreeHistory>(new TreeHistory(seed));
  const importRef = useRef<HTMLInputElement | null>(null);
  const [tree, setTree] = useState<StrategyTreeV1>(seed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(true);
  const [hint, setHint] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMode, setHelpMode] = useState<"tutorial" | "shortcuts">("tutorial");
  const [helpStep, setHelpStep] = useState(0);
  const [historyFlags, setHistoryFlags] = useState({ undo: false, redo: false });
  const [advancedGraph, setAdvancedGraph] = useState(false);
  const [live, setLive] = useState<TreeLivePreview | null>(null);
  const [liveHint, setLiveHint] = useState("Live preview has not run yet.");
  const [brokerDraft, setBrokerDraft] = useState<TreeBrokerDraft | null>(null);
  const [orderPick, setOrderPick] = useState(0);
  const [gttPick, setGttPick] = useState(0);
  const [alertPick, setAlertPick] = useState(0);
  const [run, setRun] = useState<BacktestRunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [kpiSymbol, setKpiSymbol] = useState("");
  const [kpiName, setKpiName] = useState("");
  const graph = useMemo(() => compileTreeToGraph(tree), [tree]);
  const treeValidation = useMemo(() => validateTree(tree), [tree]);
  const graphValidation = useMemo(() => validateStrategyGraph(graph), [graph]);
  const readOnly = !desktop;
  const selected = selectedId ? findTreeNode(tree, selectedId) : null;

  const publish = useCallback((next: StrategyTreeV1) => {
    setTree(next);
    setHistoryFlags({ undo: historyRef.current.canUndo, redo: historyRef.current.canRedo });
    onDocumentChange?.({ tree: next, graph: compileTreeToGraph(next) });
  }, [onDocumentChange]);

  const commit = useCallback((next: StrategyTreeV1) => {
    historyRef.current.push(next);
    publish(next);
  }, [publish]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch(STRATEGIES_LIVE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree, kpiSymbol }),
      }).then(async (response) => {
        const payload = await response.json() as TreeLivePreview & { message?: string };
        if (cancelled) return;
        if (!response.ok) {
          setLive(null);
          setLiveHint(payload.message || "Live preview unavailable.");
          return;
        }
        setLive(payload);
        setLiveHint(payload.message);
        setOrderPick(0);
        setGttPick(0);
        setAlertPick(0);
      }).catch((error: unknown) => {
        if (cancelled) return;
        setLive(null);
        setLiveHint(error instanceof Error ? error.message : "Live preview unavailable.");
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kpiSymbol, tree]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const showHint = (message: string, ms = 3200) => {
    setHint(message);
    window.setTimeout(() => setHint(""), ms);
  };

  const addBlock = (parentId: string | null, kind: TreeBlockKind, slot: TreeInsertSlot) => {
    if (readOnly) return;
    commit(addTreeBlock(tree, parentId, kind, slot));
  };

  const changeNode = (node: TreeNode) => {
    if (readOnly) return;
    commit(replaceTreeNode(tree, node));
  };

  const deleteSelected = () => {
    if (readOnly || !selectedId) return;
    commit(removeTreeNode(tree, selectedId));
    setSelectedId(null);
  };

  const undo = () => {
    const previous = historyRef.current.undo();
    if (previous) publish(previous);
  };
  const redo = () => {
    const next = historyRef.current.redo();
    if (next) publish(next);
  };

  const exportDocument = () => {
    if (typeof document === "undefined") return;
    const blob = new Blob([exportStrategyDocumentJson({ tree, graph })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tree.id || "strategy"}.strategy.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const applyDocument = (document: StrategyDocument) => {
    const next = document.tree;
    if (!next) {
      showHint("JSON must include a StrategyTreeV1 document — graph-only paste would drop Groups and ELSE.");
      return;
    }
    historyRef.current.reset(next);
    publish(next);
    setSelectedId(null);
  };

  const importDocument = (file: File) => {
    void file.text().then((text) => {
      applyDocument(importStrategyDocumentJson(text));
    }).catch((cause: unknown) => {
      showHint(cause instanceof Error ? cause.message : "Import failed");
    });
  };

  const clearTree = () => {
    if (readOnly) return;
    if (!window.confirm("Clear all blocks? Name and interval stay.")) return;
    commit({ ...tree, children: [], updatedAt: new Date().toISOString() });
    setSelectedId(null);
  };

  const validateAll = async () => {
    if (!treeValidation.ok) {
      showHint(treeValidation.issues[0]?.message ?? "Tree invalid");
      return;
    }
    const remote = await validateStrategyOnServer(graph);
    showHint(remote.ok ? remote.stripTitle : remote.stripDetail || remote.message || graphValidation.stripTitle);
  };

  const runBacktest = async () => {
    setRunning(true);
    try {
      const result = await runTreeBacktestOnServer(tree);
      setRun(result);
      showHint(result.message ?? (result.ran ? "Backtest ran." : "Backtest did not run."));
    } finally {
      setRunning(false);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      event.preventDefault();
      setHelpMode("tutorial");
      setHelpOpen((open) => !open);
      return;
    }
    if (event.key === "Escape") {
      if (helpOpen) {
        setHelpOpen(false);
        return;
      }
      setSelectedId(null);
      return;
    }
    if (readOnly) return;
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (meta && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && selectedId) {
      event.preventDefault();
      deleteSelected();
    }
  };

  const lastHelp = TREE_TUTORIAL_STEPS.length - 1;
  const help = TREE_TUTORIAL_STEPS[helpStep] ?? TREE_TUTORIAL_STEPS[0];
  const orderReason = brokerDisabledReason(live, "order");
  const gttReason = brokerDisabledReason(live, "gtt");
  const alertReason = brokerDisabledReason(live, "alert");
  const order = live?.orders[orderPick] ?? live?.orders[0];
  const gtt = live?.gtts[gttPick] ?? live?.gtts[0];
  const alert = live?.alerts[alertPick] ?? live?.alerts[0];

  return (
    <section
      className={`algorithm-builder symphony-editor${readOnly ? " read-only" : ""}`}
      data-edit-desktop-only="true"
      aria-label="Algorithm Builder"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <header className="builder-chrome">
        <div>
          <p className="builder-eyebrow">EDITOR · TREE</p>
          <h2>{tree.name || "Untitled tree"}</h2>
        </div>
        <div className="builder-toolbar" role="toolbar" aria-label="Tree tools">
          <button type="button" disabled={readOnly || !historyFlags.undo} onClick={undo}>Undo</button>
          <button type="button" disabled={readOnly || !historyFlags.redo} onClick={redo}>Redo</button>
          <button type="button" onClick={exportDocument}>Export</button>
          <button type="button" disabled={readOnly} onClick={() => importRef.current?.click()}>Import</button>
          <button type="button" onClick={() => void validateAll()}>Validate</button>
          <button type="button" disabled={readOnly} onClick={clearTree}>Clear</button>
          <button type="button" aria-pressed={helpOpen && helpMode === "tutorial"} onClick={() => { setHelpMode("tutorial"); setHelpStep(0); setHelpOpen(true); }}>Tutorial</button>
          <button type="button" aria-pressed={helpOpen && helpMode === "shortcuts"} onClick={() => { setHelpMode("shortcuts"); setHelpOpen(true); }}>Shortcuts</button>
          <button
            type="button"
            aria-pressed={advancedGraph}
            data-canvas-advanced="graph"
            onClick={() => setAdvancedGraph((open) => !open)}
          >{advancedGraph ? "Hide advanced graph" : "Advanced graph"}</button>
          <BuilderLibraryActions
            graph={graph}
            disabled={readOnly}
            hideValidate
            onLoaded={applyDocument}
          />
        </div>
        <div className="builder-status">
          <em>TREE VIEW</em>
          <em>KPI REGISTRY - {KPI_REGISTRY_COUNT}</em>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importDocument(file);
            event.target.value = "";
          }}
        />
      </header>
      {readOnly && <p className="builder-readonly-banner" role="status">Read-only monitor — editing requires desktop width.</p>}
      {hint && <p className="builder-connect-hint" role="status">{hint}</p>}
      <div className="builder-zones symphony-zones" data-canvas-mode="tree" data-layout="details-backtest-above-tree">
        <div className="symphony-top">
          <aside className="symphony-details" aria-label="Strategy details">
            <h3>Details</h3>
            <label>
              Name
              <input
                value={tree.name}
                disabled={readOnly}
                onChange={(event) => commit({ ...tree, name: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={tree.description ?? ""}
                disabled={readOnly}
                onChange={(event) => commit({ ...tree, description: event.target.value })}
              />
            </label>
            <label>
              Frequency
              <select
                value={tree.interval}
                disabled={readOnly}
                onChange={(event) => commit({ ...tree, interval: event.target.value as CandleInterval })}
              >
                {INTERVALS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="symphony-selected">
              {selected ? (
                <>
                  <h4>Selected · {selected.kind.replaceAll("_", " ")}</h4>
                  <p>{selected.label ?? selected.id}</p>
                  <button type="button" className="builder-delete" disabled={readOnly} onClick={deleteSelected}>Delete</button>
                </>
              ) : (
                <p>Select a block to inspect or delete it.</p>
              )}
            </div>
            <LlmAssistPanel
              task="builder"
              hint="Draft a StrategyTreeV1 from a prompt. Invalid JSON is rejected and the canvas stays as-is."
              context={`Current tree name: ${tree.name}. Interval: ${tree.interval}. Description: ${tree.description ?? ""}.`}
              placeholder="e.g. Core-satellite with HDFCBANK quality sleeve and a RELIANCE trend gate"
              applyLabel="Interrogate LLM"
              disabled={readOnly}
              onApplyTree={(next) => applyDocument({ tree: next, graph: compileTreeToGraph(next) })}
            />
          </aside>
          <aside className="builder-preview" aria-label="Backtest overview">
            <h3>Backtest overview</h3>
            <p>Results pane for this tree. Run backtest walks historical OHLCV and sets ran=true only after a real engine pass. No curve until then.</p>
            <p className="builder-preview-meta">{tree.name} · {tree.interval}</p>
            <dl className="symphony-backtest-stats" aria-label="Backtest performance">
              <div><small>Return</small><b>{run?.ran ? `${run.totalReturnPct?.toFixed(2) ?? "—"}%` : "—"}</b></div>
              <div><small>Ann.</small><b>{run?.ran ? `${run.annualizedReturnPct?.toFixed(2) ?? "—"}%` : "—"}</b></div>
              <div><small>Max DD</small><b>{run?.ran ? `${run.maxDrawdownPct?.toFixed(2) ?? "—"}%` : "—"}</b></div>
            </dl>
            <button type="button" disabled={running} onClick={() => void runBacktest()}>
              {running ? "Running" : "Run backtest"}
            </button>
            {run?.ran && run.curve && run.curve.length > 1 ? (
              <EquityCurve curve={run.curve} />
            ) : (
              <p className="symphony-disabled-reason">{run?.message ?? "Not run yet."}</p>
            )}
            <p className="symphony-live-status" data-status={live?.status ?? "unavailable"}>{liveHint}</p>
            {live?.watchlist.status === "unavailable" && live.watchlist.message !== liveHint && (
              <p className="symphony-live-status" data-status="unavailable">{live.watchlist.message}</p>
            )}
            {live?.authUrl && (
              <p><a href={live.authUrl} target="_blank" rel="noreferrer">Authenticate Kite</a></p>
            )}
            <div className="symphony-preview-list">
              {live && live.orders.length > 1 && (
                <label>
                  Order
                  <select value={orderPick} onChange={(event) => setOrderPick(Number(event.target.value))}>
                    {live.orders.map((item, index) => (
                      <option key={`${item.nodeId}-${index}`} value={index}>{item.confirmation}</option>
                    ))}
                  </select>
                </label>
              )}
              {live && live.gtts.length > 1 && (
                <label>
                  GTT
                  <select value={gttPick} onChange={(event) => setGttPick(Number(event.target.value))}>
                    {live.gtts.map((item, index) => (
                      <option key={`${item.nodeId}-${index}`} value={index}>{item.confirmation}</option>
                    ))}
                  </select>
                </label>
              )}
              {live && live.alerts.length > 1 && (
                <label>
                  Alert
                  <select value={alertPick} onChange={(event) => setAlertPick(Number(event.target.value))}>
                    {live.alerts.map((item, index) => (
                      <option key={`${item.nodeId}-${index}`} value={index}>{item.confirmation}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="symphony-live-actions">
              <button
                type="button"
                disabled={!order || Boolean(orderReason)}
                onClick={() => order && setBrokerDraft({ kind: "order", preview: order })}
              >Place Kite order</button>
              <button
                type="button"
                disabled={!gtt || Boolean(gttReason) || !gtt.lastPrice}
                onClick={() => gtt && setBrokerDraft({ kind: "gtt", preview: gtt })}
              >Create GTT</button>
              <button
                type="button"
                disabled={!alert || Boolean(alertReason)}
                onClick={() => alert && setBrokerDraft({ kind: "alert", preview: alert })}
              >Create alert</button>
            </div>
            {orderReason && orderReason !== liveHint && <p className="symphony-disabled-reason">{orderReason}</p>}
            {gttReason && gttReason !== liveHint && gttReason !== orderReason && (
              <p className="symphony-disabled-reason">{gttReason}</p>
            )}
            {alertReason && alertReason !== liveHint && alertReason !== orderReason && alertReason !== gttReason && (
              <p className="symphony-disabled-reason">{alertReason}</p>
            )}
            <KpiRegistryPanel
              symbol={kpiSymbol}
              name={kpiName}
              live={live ?? undefined}
              disabled={readOnly}
              onSymbolChange={(next) => {
                setKpiSymbol(next.symbol.trim().toUpperCase());
                setKpiName(next.name.trim());
              }}
            />
          </aside>
        </div>
        <TreeCanvas
          name={tree.name}
          nodes={tree.children}
          selectedId={selectedId}
          disabled={readOnly}
          live={live ?? undefined}
          onSelect={setSelectedId}
          onChange={changeNode}
          onAdd={addBlock}
          onDelete={(id) => {
            if (readOnly) return;
            commit(removeTreeNode(tree, id));
            setSelectedId(null);
          }}
        />
      </div>
      {advancedGraph && (
        <details className="symphony-advanced-graph" open>
          <summary>Advanced graph — read-only compiled snapshot. Edits here do not change the tree.</summary>
          <AlgorithmBuilder initialGraph={graph} forceReadOnly hideLibraryActions />
        </details>
      )}
      {brokerDraft && (
        <TreeBrokerConfirm
          draft={brokerDraft}
          authUrl={live?.authUrl}
          equityMargin={live?.equityMargin}
          marginsKnown={live?.marginsKnown}
          estimatedPrice={brokerDraft.kind === "order"
            ? live?.instruments.find((item) => item.symbol === brokerDraft.preview.symbol)?.lastPrice ?? 0
            : 0}
          onClose={() => setBrokerDraft(null)}
        />
      )}
      {helpOpen && (
        <div className="builder-shortcuts" role="dialog" aria-label={helpMode === "shortcuts" ? "Tree shortcuts" : "Tree tutorial"}>
          {helpMode === "shortcuts" ? (
            <div className="builder-tutorial">
              <h3>Tree shortcuts</h3>
              <ul>
                {TREE_SHORTCUTS.map((item) => (
                  <li key={item.keys}><b>{item.keys}</b> — {item.action}</li>
                ))}
              </ul>
              <button type="button" onClick={() => setHelpOpen(false)}>Close</button>
            </div>
          ) : (
            <div className="builder-tutorial">
              <p className="builder-tutorial-step">Step {helpStep + 1} of {TREE_TUTORIAL_STEPS.length}</p>
              <h3>{help.title}</h3>
              <p>{help.body}</p>
              <div className="builder-tutorial-nav">
                <button type="button" disabled={helpStep <= 0} onClick={() => setHelpStep((step) => step - 1)}>Back</button>
                <button type="button" disabled={helpStep >= lastHelp} onClick={() => setHelpStep((step) => step + 1)}>Next</button>
                <button type="button" onClick={() => setHelpOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
