"use client";

import { useEffect, useState } from "react";
import {
  configureBacktest,
  listStrategyLibrary,
  loadStrategyFromLibrary,
  saveStrategyToLibrary,
  validateStrategyOnServer,
  type BacktestConfigureStatus,
  type SaveStatus,
  type StrategyDocument,
  type StrategyLibraryItem,
} from "../../strategy/persist";
import type { GraphValidation, StrategyGraphV2 } from "../../strategy/graph-types";

function saveLabel(status: SaveStatus) {
  switch (status) {
    case "idle":
      return "Save to library";
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function backtestLabel(status: BacktestConfigureStatus) {
  switch (status) {
    case "idle":
      return "Configure backtest";
    case "configuring":
      return "Configuring";
    case "configured":
      return "Configured";
    case "error":
      return "Configure failed";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function BuilderLibraryActions({
  graph,
  disabled,
  hideValidate,
  onLoaded,
  onValidation,
}: {
  graph: StrategyGraphV2;
  disabled?: boolean;
  hideValidate?: boolean;
  onLoaded?: (document: StrategyDocument) => void;
  onValidation?: (result: GraphValidation) => void;
}) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [backtestStatus, setBacktestStatus] = useState<BacktestConfigureStatus>("idle");
  const [backtestMessage, setBacktestMessage] = useState("");
  const [library, setLibrary] = useState<StrategyLibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const busy = saveStatus === "saving" || backtestStatus === "configuring";

  useEffect(() => {
    void listStrategyLibrary().then(setLibrary).catch(() => setLibrary([]));
  }, [saveStatus]);

  const save = async () => {
    setSaveStatus("saving");
    setSaveMessage("");
    try {
      const result = await saveStrategyToLibrary(graph);
      if (result.status !== "saved") {
        setSaveStatus("error");
        setSaveMessage(result.message ?? "Save did not succeed.");
        return;
      }
      setSaveStatus("saved");
      setSaveMessage(`Saved ${result.strategy?.name ?? graph.name} to ${result.store ?? "library"}.`);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(error instanceof Error ? error.message : "Save request failed.");
    }
  };

  const configure = async () => {
    setBacktestStatus("configuring");
    setBacktestMessage("");
    try {
      const result = await configureBacktest(graph);
      if (result.status !== "configured" || result.ran) {
        setBacktestStatus("error");
        setBacktestMessage(result.message ?? "Backtest was not configured.");
        return;
      }
      setBacktestStatus("configured");
      setBacktestMessage(
        `Configured ${result.request?.benchmark ?? "RELIANCE"} · cash ${result.request?.initialCash ?? 100000}. Configure only — no run.`,
      );
    } catch (error) {
      setBacktestStatus("error");
      setBacktestMessage(error instanceof Error ? error.message : "Backtest configure failed.");
    }
  };

  const load = async () => {
    if (!selectedId || !onLoaded) return;
    try {
      onLoaded(await loadStrategyFromLibrary(selectedId));
      setSaveMessage(`Loaded ${selectedId} from library.`);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Library load failed.");
    }
  };

  return (
    <div className="builder-library-actions" role="group" aria-label="Strategy library actions">
      <button
        type="button"
        data-state={saveStatus}
        disabled={disabled || busy}
        onClick={() => void save()}
      >{saveLabel(saveStatus)}</button>
      {onLoaded && (
        <span className="builder-library-load">
          <select
            aria-label="Load from library"
            value={selectedId}
            disabled={disabled || busy}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Load from library</option>
            {library.map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.hasTree ? "" : " (graph only)"}</option>
            ))}
          </select>
          <button type="button" disabled={disabled || busy || !selectedId} onClick={() => void load()}>
            Load
          </button>
        </span>
      )}
      <button
        type="button"
        data-state={backtestStatus}
        disabled={disabled || busy}
        onClick={() => void configure()}
      >{backtestLabel(backtestStatus)}</button>
      {!hideValidate && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => {
            void validateStrategyOnServer(graph).then((result) => {
              onValidation?.(result);
              if (result.status === "failed") setSaveMessage(result.message ?? result.stripDetail);
            }).catch((error: unknown) => {
              setSaveMessage(error instanceof Error ? error.message : "Server validate failed.");
            });
          }}
        >
          Validate on server
        </button>
      )}
      {(saveMessage || backtestMessage) && (
        <small role="status" data-state={saveStatus === "error" || backtestStatus === "error" ? "error" : "ok"}>
          {[saveMessage, backtestMessage].filter(Boolean).join(" · ")}
        </small>
      )}
    </div>
  );
}
