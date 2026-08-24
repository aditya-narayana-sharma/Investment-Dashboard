"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StrategyGraphV2, StrategyTreeV1 } from "../strategy/graph-types";
import { composerStrategyById } from "../strategy/composer-strategies";
import { loadStrategyFromLibrary } from "../strategy/persist";
import { compileTreeToGraph } from "../strategy/tree-compile";
import { createSeedTree } from "../strategy/seed-tree";
import { SymphonyEditor } from "./builder/SymphonyEditor";
import { BuilderJsonPanel } from "./builder/BuilderJsonPanel";
import { CollapsibleSection, DailyKanbanBoard, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import { listenToStratjiLocation } from "./stratji-navigate";
import type { BuilderSection } from "./types";
import { builderSectionNumber, isLocationView, parseBuilderSection } from "./workspace-routing";
import { buildBuilderDailyActions } from "./workspace-daily-actions";

const BUILDER_SECTIONS = [
  { id: "board", label: "Action Board", prefix: "B1" },
  { id: "canvas", label: "Canvas", prefix: "B2" },
  { id: "json", label: "JSON", prefix: "B3" },
] as const;

function builderSectionFromUrl(): BuilderSection {
  if (typeof window === "undefined") return "canvas";
  const requested = new URLSearchParams(window.location.search).get("section");
  return BUILDER_SECTIONS.some((section) => section.id === requested) ? parseBuilderSection(requested) : "canvas";
}

export function BuilderWorkspace() {
  const [activeSection, setActiveSection] = useState<BuilderSection>(builderSectionFromUrl);
  const [tree, setTree] = useState<StrategyTreeV1>(() => createSeedTree());
  const [graph, setGraph] = useState<StrategyGraphV2>(() => compileTreeToGraph(tree));
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    const sync = () => {
      if (!isLocationView("builder")) return;
      const section = builderSectionFromUrl();
      setActiveSection(section);
      expandDashboardSection(dashboardSectionNumberFromNavId(section));
    };
    sync();
    const retry = window.setTimeout(sync, 0);
    const stopListening = listenToStratjiLocation(sync);
    return () => {
      window.clearTimeout(retry);
      stopListening();
    };
  }, []);

  useEffect(() => {
    const loadTreeFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get("tree");
      if (!id) return;
      const card = composerStrategyById(id);
      if (card) {
        setTree(card.tree);
        setGraph(compileTreeToGraph(card.tree));
        setCanvasKey((current) => current + 1);
        return;
      }
      void loadStrategyFromLibrary(id).then((document) => {
        if (!document.tree) return;
        setTree(document.tree);
        setGraph(document.graph);
        setCanvasKey((current) => current + 1);
      }).catch(() => undefined);
    };
    loadTreeFromUrl();
    const stopListening = listenToStratjiLocation(loadTreeFromUrl);
    return stopListening;
  }, []);

  const builderActions = useMemo(() => buildBuilderDailyActions({ tree }), [tree]);

  const applyDocument = useCallback((nextTree: StrategyTreeV1, nextGraph: StrategyGraphV2) => {
    setTree(nextTree);
    setGraph(nextGraph);
    setCanvasKey((current) => current + 1);
  }, []);

  return (
    <div className="builder-workspace-shell investment-workspace-shell" data-workspace="builder" data-active-section={activeSection} data-focus-section={activeSection}>
      <header className="builder-workspace-chrome">
        <h2>Algorithm Builder</h2>
      </header>

      <div id="builder-board" className="workspace-section action-board-workspace-section" hidden={activeSection !== "board"}>
        <CollapsibleSection number={builderSectionNumber("board")} title="Action Board" note="Clickable daily canvas, validation and export actions" defaultOpen={activeSection === "board"}>
          <DailyKanbanBoard workspace="builder" items={builderActions}/>
        </CollapsibleSection>
      </div>

      <div id="builder-canvas" className="workspace-section builder-canvas-section" hidden={activeSection !== "canvas"}>
        <CollapsibleSection
          number={builderSectionNumber("canvas")}
          title="Canvas"
          note="Details and backtest above a full-width nested tree"
          defaultOpen={activeSection === "canvas"}
        >
          <SymphonyEditor
            key={canvasKey}
            initialTree={tree}
            onDocumentChange={(document) => {
              if (document.tree) setTree(document.tree);
              setGraph(document.graph);
            }}
          />
        </CollapsibleSection>
      </div>

      <div id="builder-json" className="workspace-section" hidden={activeSection !== "json"}>
        <CollapsibleSection number={builderSectionNumber("json")} title="JSON" note="Lossless tree + compiled graph · ids, percents, If/Else, pins" defaultOpen={activeSection === "json"}>
          <BuilderJsonPanel tree={tree} graph={graph} disabled={false} onApply={applyDocument} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
