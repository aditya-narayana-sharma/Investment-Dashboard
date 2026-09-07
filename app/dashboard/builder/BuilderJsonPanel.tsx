"use client";

import { useState } from "react";
import { exportStrategyDocumentJson, importStrategyDocumentJson } from "../../strategy/persist";
import type { StrategyGraphV2, StrategyTreeV1 } from "../../strategy/graph-types";
import { compileTreeToGraph } from "../../strategy/tree-compile";

export function BuilderJsonPanel({
  tree,
  graph,
  disabled,
  onApply,
}: {
  tree?: StrategyTreeV1;
  graph: StrategyGraphV2;
  disabled: boolean;
  onApply: (tree: StrategyTreeV1, graph: StrategyGraphV2) => void;
}) {
  const serialized = exportStrategyDocumentJson({ tree, graph });
  const [edited, setEdited] = useState<{ source: string; draft: string } | null>(null);
  const [error, setError] = useState("");
  const draft = edited && edited.source === serialized ? edited.draft : serialized;

  const apply = () => {
    try {
      const parsed = importStrategyDocumentJson(draft);
      if (!parsed.tree) throw new Error("JSON must include a StrategyTreeV1 document — graph-only paste would drop Groups and ELSE.");
      const nextTree = parsed.tree;
      const nextGraph = parsed.graph.tree ? parsed.graph : compileTreeToGraph(nextTree);
      setError("");
      setEdited(null);
      onApply(nextTree, nextGraph);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid strategy JSON");
    }
  };

  return (
    <section className="builder-json-panel" aria-label="Strategy tree and graph JSON">
      <header>
        <div>
          <h2>StrategyTreeV1 + StrategyGraphV2</h2>
          <p>Lossless editor — tree is the source of truth; graph is the compiled schemaVersion 2 document.</p>
        </div>
        <button type="button" disabled={disabled} onClick={apply}>Apply JSON</button>
      </header>
      {error && <p className="builder-json-error" role="alert">{error}</p>}
      <textarea
        spellCheck={false}
        disabled={disabled}
        value={draft}
        onChange={(event) => {
          setEdited({ source: serialized, draft: event.target.value });
          setError("");
        }}
        aria-label="Strategy tree and compiled graph JSON document"
      />
    </section>
  );
}
