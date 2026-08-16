"use client";

import { useState } from "react";
import {
  configureBacktest,
  saveStrategyToLibrary,
  validateStrategyOnServer,
  type BacktestConfigureStatus,
  type SaveStatus,
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
  onValidation,
}: {
  graph: StrategyGraphV2;
  disabled?: boolean;
  onValidation?: (result: GraphValidation) => void;
}) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [backtestStatus, setBacktestStatus] = useState<BacktestConfigureStatus>("idle");
  const [backtestMessage, setBacktestMessage] = useState("");

  const busy = saveStatus === "saving" || backtestStatus === "configuring";

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
      setSaveMessage(`Saved ${result.strategy?.name ?? graph.name} to SQLite.`);
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
        `Configured ${result.request?.benchmark ?? "NIFTYBEES"} · cash ${result.request?.initialCash ?? 100000}. No run.`,
      );
    } catch (error) {
      setBacktestStatus("error");
      setBacktestMessage(error instanceof Error ? error.message : "Backtest configure failed.");
    }
  };

  const validateRemote = async () => {
    try {
      const result = await validateStrategyOnServer(graph);
      onValidation?.(result);
      if (result.status === "failed") {
        setSaveMessage(result.message ?? result.stripDetail);
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Server validate failed.");
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
      <button
        type="button"
        data-state={backtestStatus}
        disabled={disabled || busy}
        onClick={() => void configure()}
      >{backtestLabel(backtestStatus)}</button>
      <button type="button" disabled={disabled || busy} onClick={() => void validateRemote()}>
        Validate on server
      </button>
      {(saveMessage || backtestMessage) && (
        <small role="status" data-state={saveStatus === "error" || backtestStatus === "error" ? "error" : "ok"}>
          {[saveMessage, backtestMessage].filter(Boolean).join(" · ")}
        </small>
      )}
    </div>
  );
}
