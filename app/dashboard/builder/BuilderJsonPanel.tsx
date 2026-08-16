"use client";

import { useState } from "react";
import { exportStrategyGraphJson, importStrategyGraphJson } from "../../strategy/persist";
import type { StrategyGraphV2 } from "../../strategy/graph-types";

export function BuilderJsonPanel({
  graph,
  disabled,
  onApply,
}: {
  graph: StrategyGraphV2;
  disabled: boolean;
  onApply: (graph: StrategyGraphV2) => void;
}) {
  const serialized = exportStrategyGraphJson(graph);
  const [draft, setDraft] = useState(serialized);
  const [source, setSource] = useState(serialized);
  const [error, setError] = useState("");
  if (serialized !== source) {
    setSource(serialized);
    setDraft(serialized);
    setError("");
  }

  const apply = () => {
    try {
      const parsed = importStrategyGraphJson(draft);
      setError("");
      onApply(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid StrategyGraphV2 JSON");
    }
  };

  return (
    <section className="builder-json-panel" aria-label="StrategyGraphV2 JSON">
      <header>
        <div>
          <h2>StrategyGraphV2</h2>
          <p>Lossless editor — ids, positions, params and pinned versions are preserved.</p>
        </div>
        <button type="button" disabled={disabled} onClick={apply}>Apply JSON</button>
      </header>
      {error && <p className="builder-json-error" role="alert">{error}</p>}
      <textarea
        spellCheck={false}
        disabled={disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label="StrategyGraphV2 JSON document"
      />
    </section>
  );
}
