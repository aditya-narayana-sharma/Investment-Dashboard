"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { KPI_REGISTRY_COUNT } from "../../../packages/kpi-registry";
import {
  cloneGraph,
  isNodeKind,
  SNAP_PX,
  UNDO_DEPTH,
  type NodeKind,
  type StrategyGraphV2,
  type StrategyNode,
} from "../../strategy/graph-types";
import { connectNodes, createNode, GraphHistory, removeNode, snapToGrid } from "../../strategy/graph-ops";
import { importStrategyGraphFromFile, triggerStrategyGraphDownload } from "../../strategy/persist";
import { EDGE_COLORS, incompatibilityReason, inputPortKind, outputPortKind, portsCompatible } from "../../strategy/ports";
import { createSeedGraph } from "../../strategy/seed-graph";
import { validateStrategyGraph } from "../../strategy/validate";
import { BUILDER_DRAG_MIME, BuilderPalette } from "./BuilderPalette";
import { BuilderInspector } from "./BuilderInspector";
import { BuilderLibraryActions } from "./BuilderLibraryActions";
import {
  BuilderHelpOverlay,
  TUTORIAL_STEPS,
  readTutorialDismissed,
  writeTutorialDismissed,
  type HelpMode,
} from "./BuilderHelpOverlay";
import "./algorithm-builder.css";

const NODE_WIDTH = 176;
const NODE_HEIGHT = 76;
const DESKTOP_QUERY = "(min-width: 1080px)";

export type AlgorithmBuilderProps = {
  initialGraph?: StrategyGraphV2;
  onGraphChange?: (graph: StrategyGraphV2) => void;
  forceReadOnly?: boolean;
  hideLibraryActions?: boolean;
};

type DragPayload = { kind: NodeKind; kpiId?: string };
type LinkDraft = { sourceId: string; x: number; y: number };
type MoveDraft = { id: string; origin: StrategyGraphV2; startX: number; startY: number; nodeX: number; nodeY: number };

function nodeTone(kind: NodeKind): string {
  switch (kind) {
    case "universe":
      return "navy";
    case "kpi":
      return "blue";
    case "comparator":
      return "amber";
    case "logical_group":
      return "purple";
    case "entry_trigger":
      return "green";
    case "exit_trigger":
      return "pink";
    case "allocation":
      return "cyan";
    case "rebalance":
      return "teal";
    case "risk_limit":
      return "red";
    case "paper_action":
      return "slate";
    case "broker_preview":
      return "gold";
    case "algorithm_reference":
      return "violet";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function nodeDetail(node: StrategyNode): string {
  switch (node.kind) {
    case "universe": {
      const classes = Array.isArray(node.params.assetClasses)
        ? node.params.assetClasses.filter((item): item is string => typeof item === "string")
        : ["Equity", "ETF"];
      return classes.join(" · ") || "No asset class";
    }
    case "kpi":
      return String(node.params.kpiId ?? "kpi");
    case "comparator":
      return `${String(node.params.op ?? "<")} ${String(node.params.value ?? "")}`;
    case "logical_group":
      return String(node.params.op ?? "and").toUpperCase();
    case "allocation":
      return `Weight ${String(node.params.weightagePct ?? 0)}%`;
    case "entry_trigger":
    case "exit_trigger":
    case "rebalance":
    case "risk_limit":
    case "paper_action":
    case "broker_preview":
    case "algorithm_reference":
      return node.kind.replaceAll("_", " ");
    default: {
      const _never: never = node.kind;
      return _never;
    }
  }
}

function nodeCenter(node: StrategyNode, side: "in" | "out"): { x: number; y: number } {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  return {
    x: side === "out" ? x + NODE_WIDTH : x,
    y: y + NODE_HEIGHT / 2,
  };
}

function parseDragPayload(raw: string): DragPayload | null {
  try {
    const value = JSON.parse(raw) as DragPayload;
    if (!value || !isNodeKind(value.kind)) return null;
    return value;
  } catch {
    return null;
  }
}

export function AlgorithmBuilder({
  initialGraph,
  onGraphChange,
  forceReadOnly = false,
  hideLibraryActions = false,
}: AlgorithmBuilderProps = {}) {
  const seed = useMemo(() => initialGraph ?? createSeedGraph(), [initialGraph]);
  const historyRef = useRef<GraphHistory>(new GraphHistory(seed, UNDO_DEPTH));
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const moveRef = useRef<MoveDraft | null>(null);
  const graphRef = useRef<StrategyGraphV2>(seed);
  const autoOpenedTutorial = useRef(false);
  const [graph, setGraph] = useState<StrategyGraphV2>(seed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMode, setHelpMode] = useState<HelpMode>("tutorial");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [dontShowTutorial, setDontShowTutorial] = useState(false);
  const [desktop, setDesktop] = useState(true);
  const [connectHint, setConnectHint] = useState("");
  const [historyFlags, setHistoryFlags] = useState({ undo: false, redo: false });
  const validation = useMemo(() => validateStrategyGraph(graph), [graph]);
  const readOnly = forceReadOnly || !desktop;

  const publish = useCallback((next: StrategyGraphV2) => {
    graphRef.current = next;
    setGraph(next);
    setHistoryFlags({ undo: historyRef.current.canUndo, redo: historyRef.current.canRedo });
    onGraphChange?.(next);
  }, [onGraphChange]);

  const commit = useCallback((next: StrategyGraphV2) => {
    historyRef.current.push(next);
    publish(next);
  }, [publish]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (forceReadOnly) return;
    if (!window.matchMedia(DESKTOP_QUERY).matches) return;
    if (readTutorialDismissed()) return;
    autoOpenedTutorial.current = true;
    const timer = window.setTimeout(() => {
      setHelpMode("tutorial");
      setTutorialStep(0);
      setHelpOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [forceReadOnly]);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left + canvas.scrollLeft,
      y: clientY - rect.top + canvas.scrollTop,
    };
  }, []);

  const addNode = useCallback((kind: NodeKind, position: { x: number; y: number }, extras?: Record<string, unknown>) => {
    const node = createNode(kind, position, graph.nodes.map((item) => item.id), extras);
    const next = cloneGraph(graph);
    next.nodes.push(node);
    next.updatedAt = new Date().toISOString();
    commit(next);
    setSelectedId(node.id);
  }, [commit, graph]);

  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (readOnly) return;
    const payload = parseDragPayload(event.dataTransfer.getData(BUILDER_DRAG_MIME));
    if (!payload) return;
    const point = canvasPoint(event.clientX, event.clientY);
    addNode(payload.kind, { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 }, payload.kpiId ? { kpiId: payload.kpiId } : undefined);
  };

  const updateNode = (nodeId: string, patch: Partial<StrategyNode>, params?: Record<string, unknown>) => {
    if (readOnly) return;
    const next = cloneGraph(graph);
    next.nodes = next.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        ...patch,
        params: params ? { ...node.params, ...params } : node.params,
      };
    });
    next.updatedAt = new Date().toISOString();
    commit(next);
  };

  const deleteNode = (nodeId: string) => {
    if (readOnly) return;
    commit(removeNode(graph, nodeId));
    setSelectedId((current) => current === nodeId ? null : current);
  };

  const showHint = (message: string, ms = 2200) => {
    setConnectHint(message);
    window.setTimeout(() => setConnectHint(""), ms);
  };

  const beginLink = (event: ReactPointerEvent<HTMLButtonElement>, sourceId: string) => {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPoint(event.clientX, event.clientY);
    if (linkDraft?.sourceId === sourceId) {
      setLinkDraft(null);
      return;
    }
    setLinkDraft({ sourceId, x: point.x, y: point.y });
    setConnectHint("Click a matching input handle (left side) to connect");
  };

  const completeLink = (event: ReactPointerEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly || !linkDraft) return;
    if (linkDraft.sourceId === targetId) {
      setLinkDraft(null);
      return;
    }
    const source = graph.nodes.find((node) => node.id === linkDraft.sourceId);
    const target = graph.nodes.find((node) => node.id === targetId);
    if (!source || !target) {
      setLinkDraft(null);
      return;
    }
    if (!portsCompatible(source.kind, target.kind)) {
      showHint(incompatibilityReason(source.kind, target.kind) ?? "Incompatible ports — connection rejected");
      return;
    }
    const next = connectNodes(graph, source.id, target.id);
    if (next && next !== graph) {
      commit(next);
      showHint("Connected");
    }
    setLinkDraft(null);
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = canvasPoint(event.clientX, event.clientY);
    if (linkDraft) setLinkDraft({ ...linkDraft, x: point.x, y: point.y });
    const move = moveRef.current;
    if (!move || readOnly) return;
    const next = cloneGraph(move.origin);
    next.nodes = next.nodes.map((node) => {
      if (node.id !== move.id) return node;
      return {
        ...node,
        position: {
          x: snapToGrid(move.nodeX + (point.x - move.startX)),
          y: snapToGrid(move.nodeY + (point.y - move.startY)),
        },
      };
    });
    graphRef.current = next;
    setGraph(next);
  };

  const endMove = () => {
    const move = moveRef.current;
    if (!move) return;
    moveRef.current = null;
    if (graphRef.current !== move.origin) commit(graphRef.current);
  };

  const onCanvasPointerUp = () => {
    endMove();
  };

  const beginMove = (event: ReactPointerEvent<HTMLElement>, node: StrategyNode) => {
    if (readOnly || linkDraft) return;
    if ((event.target as HTMLElement).closest("button.builder-port")) return;
    event.stopPropagation();
    setSelectedId(node.id);
    const point = canvasPoint(event.clientX, event.clientY);
    moveRef.current = {
      id: node.id,
      origin: cloneGraph(graph),
      startX: point.x,
      startY: point.y,
      nodeX: node.position?.x ?? 0,
      nodeY: node.position?.y ?? 0,
    };
  };

  const openHelp = (mode: HelpMode) => {
    setHelpMode(mode);
    if (mode === "tutorial") setTutorialStep(0);
    setHelpOpen(true);
  };

  const closeHelp = () => {
    writeTutorialDismissed(dontShowTutorial || autoOpenedTutorial.current);
    autoOpenedTutorial.current = false;
    setHelpOpen(false);
  };

  const undo = () => {
    const previous = historyRef.current.undo();
    if (previous) publish(previous);
  };
  const redo = () => {
    const next = historyRef.current.redo();
    if (next) publish(next);
  };

  const exportGraph = () => {
    triggerStrategyGraphDownload(graph);
  };

  const importGraph = (file: File) => {
    void importStrategyGraphFromFile(file).then((parsed) => {
      historyRef.current.push(parsed);
      publish(parsed);
      setSelectedId(null);
    }).catch((cause: unknown) => {
      setConnectHint(cause instanceof Error ? cause.message : "Import failed");
      window.setTimeout(() => setConnectHint(""), 2400);
    });
  };

  const clearGraph = () => {
    if (readOnly) return;
    const next = cloneGraph(graph);
    next.nodes = [];
    next.edges = [];
    next.pinnedAlgorithmVersions = {};
    next.updatedAt = new Date().toISOString();
    commit(next);
    setSelectedId(null);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      event.preventDefault();
      setHelpOpen((open) => !open);
      return;
    }
    if (event.key === "Escape") {
      if (linkDraft) {
        setLinkDraft(null);
        setConnectHint("");
        return;
      }
      if (helpOpen) {
        closeHelp();
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
      deleteNode(selectedId);
    }
  };

  const bounds = useMemo(() => {
    const xs = graph.nodes.map((node) => node.position?.x ?? 0);
    const ys = graph.nodes.map((node) => node.position?.y ?? 0);
    const maxX = Math.max(400, ...(xs.map((x) => x + NODE_WIDTH)), 0);
    const maxY = Math.max(240, ...(ys.map((y) => y + NODE_HEIGHT)), 0);
    return { maxX, maxY };
  }, [graph.nodes]);

  const sourceForLink = linkDraft ? graph.nodes.find((node) => node.id === linkDraft.sourceId) : null;
  const tourZone = helpOpen && helpMode === "tutorial"
    ? (TUTORIAL_STEPS[tutorialStep] ?? TUTORIAL_STEPS[0]).zone
    : null;
  const svgWidth = Math.max(bounds.maxX + 80, linkDraft ? linkDraft.x + 24 : 0);
  const svgHeight = Math.max(bounds.maxY + 80, linkDraft ? linkDraft.y + 24 : 0);

  return (
    <section
      className={`algorithm-builder${readOnly ? " read-only" : ""}${tourZone ? ` tour-focus-${tourZone}` : ""}`}
      data-edit-desktop-only="true"
      aria-label="Algorithm Builder"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <header className="builder-chrome">
        <div>
          <p className="builder-eyebrow">ALGORITHM CANVAS</p>
          <h2>Algorithm Builder</h2>
        </div>
        <div className="builder-toolbar" role="toolbar" aria-label="Canvas tools">
          <button type="button" disabled={readOnly || !historyFlags.undo} onClick={undo}>Undo</button>
          <button type="button" disabled={readOnly || !historyFlags.redo} onClick={redo}>Redo</button>
          <button type="button" onClick={exportGraph}>Export</button>
          <button type="button" disabled={readOnly} onClick={() => importRef.current?.click()}>Import</button>
          <button type="button" onClick={() => setConnectHint(validation.stripTitle)}>Validate</button>
          <button type="button" disabled={readOnly} onClick={clearGraph}>Clear</button>
          <button type="button" aria-pressed={helpOpen && helpMode === "tutorial"} onClick={() => openHelp("tutorial")}>Tutorial</button>
          <button type="button" aria-pressed={helpOpen && helpMode === "shortcuts"} onClick={() => openHelp("shortcuts")}>Shortcuts</button>
          {!hideLibraryActions && (
            <BuilderLibraryActions
              graph={graph}
              disabled={readOnly}
              onValidation={(result) => {
                setConnectHint(result.stripDetail || result.stripTitle);
                window.setTimeout(() => setConnectHint(""), 2400);
              }}
            />
          )}
        </div>
        <div className="builder-status">
          <em>KPI REGISTRY - {KPI_REGISTRY_COUNT}</em>
          <em>SNAP {SNAP_PX}PX</em>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importGraph(file);
            event.target.value = "";
          }}
        />
      </header>
      {readOnly && <p className="builder-readonly-banner" role="status">Read-only monitor — editing requires desktop width.</p>}
      {connectHint && <p className="builder-connect-hint" role="status">{connectHint}</p>}
      <div className={`builder-zones${tourZone ? ` tour-focus-${tourZone}` : ""}`}>
        <BuilderPalette disabled={readOnly} />
        <div
          ref={canvasRef}
          className={`builder-canvas${linkDraft ? " is-linking" : ""}`}
          data-testid="algorithm-canvas-workarea"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={endMove}
          onClick={(event) => {
            if (event.target !== canvasRef.current) return;
            setSelectedId(null);
            setLinkDraft(null);
          }}
        >
          <svg className="builder-edges" width={svgWidth} height={svgHeight} aria-hidden="true">
            {graph.edges.map((edge) => {
              const source = graph.nodes.find((node) => node.id === edge.source);
              const target = graph.nodes.find((node) => node.id === edge.target);
              if (!source || !target) return null;
              const from = nodeCenter(source, "out");
              const to = nodeCenter(target, "in");
              const mid = (from.x + to.x) / 2;
              return (
                <path
                  key={edge.id}
                  d={`M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`}
                  fill="none"
                  stroke={EDGE_COLORS[edge.kind]}
                  strokeWidth={2.4}
                />
              );
            })}
            {linkDraft && sourceForLink && (
              <path
                d={`M ${nodeCenter(sourceForLink, "out").x} ${nodeCenter(sourceForLink, "out").y} L ${linkDraft.x} ${linkDraft.y}`}
                fill="none"
                stroke="#93c5fd"
                strokeDasharray="6 4"
                strokeWidth={2}
              />
            )}
          </svg>
          {graph.nodes.map((node) => {
            const inKind = inputPortKind(node.kind);
            const outKind = outputPortKind(node.kind);
            const connectState = sourceForLink && inKind
              ? (portsCompatible(sourceForLink.kind, node.kind) ? "connect-ok" : "connect-no")
              : "";
            return (
              <article
                key={node.id}
                className={`builder-node ${nodeTone(node.kind)}${selectedId === node.id ? " selected" : ""}${sourceForLink?.id === node.id ? " linking-source" : ""}`}
                style={{ left: node.position?.x ?? 0, top: node.position?.y ?? 0, width: NODE_WIDTH, height: NODE_HEIGHT }}
                onPointerDown={(event) => beginMove(event, node)}
                onClick={(event) => { event.stopPropagation(); setSelectedId(node.id); }}
              >
                {inKind && (
                  <button
                    type="button"
                    className={`builder-port in ${inKind} ${connectState}`.trim()}
                    data-port="in"
                    data-edge-kind={inKind}
                    aria-label={`${node.label ?? node.kind} ${inKind} input`}
                    title={`${inKind} input`}
                    disabled={readOnly}
                    onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                    onPointerUp={(event) => completeLink(event, node.id)}
                  />
                )}
                <span>{node.kind.replaceAll("_", " ")}</span>
                <b>{node.label ?? node.kind}</b>
                <small>{nodeDetail(node)}</small>
                {outKind && (
                  <button
                    type="button"
                    className={`builder-port out ${outKind}${sourceForLink?.id === node.id ? " active" : ""}`}
                    data-port="out"
                    data-edge-kind={outKind}
                    aria-label={`${node.label ?? node.kind} ${outKind} output`}
                    title={`${outKind} output`}
                    disabled={readOnly}
                    onPointerDown={(event) => beginLink(event, node.id)}
                    onClick={(event) => event.stopPropagation()}
                  />
                )}
              </article>
            );
          })}
          <div className="builder-minimap" aria-hidden="true">
            {graph.nodes.map((node) => (
              <i
                key={node.id}
                className={nodeTone(node.kind)}
                style={{
                  left: `${((node.position?.x ?? 0) / bounds.maxX) * 100}%`,
                  top: `${((node.position?.y ?? 0) / bounds.maxY) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
        <BuilderInspector
          graph={graph}
          selectedId={selectedId}
          validation={validation}
          disabled={readOnly}
          onChangeNode={updateNode}
          onDelete={deleteNode}
        />
      </div>
      {helpOpen && (
        <BuilderHelpOverlay
          mode={helpMode}
          stepIndex={tutorialStep}
          dontShowAgain={dontShowTutorial}
          onMode={setHelpMode}
          onStep={setTutorialStep}
          onDontShowAgain={setDontShowTutorial}
          onClose={closeHelp}
        />
      )}
    </section>
  );
}

export default AlgorithmBuilder;
