"use client";

import { useCallback, useEffect, useState } from "react";
import type { StrategyGraphV2, StrategyTreeV1 } from "../strategy/graph-types";
import { composerStrategyById } from "../strategy/composer-strategies";
import { loadStrategyFromLibrary } from "../strategy/persist";
import { compileTreeToGraph } from "../strategy/tree-compile";
import { createSeedTree } from "../strategy/seed-tree";
import { SymphonyEditor } from "./builder/SymphonyEditor";
import { BuilderJsonPanel } from "./builder/BuilderJsonPanel";
import { CollapsibleSection, DailyKanbanBoard, WorkspaceSectionNav, dashboardSectionNumberFromNavId, expandDashboardSection } from "./shared-ui";
import type { BuilderSection } from "./types";
import { builderSectionNumber, parseBuilderSection } from "./workspace-routing";

const BUILDER_SECTIONS = [
  { id: "board", label: "Action Board", prefix: "B1" },
  { id: "canvas", label: "Canvas", prefix: "B2" },
  { id: "json", label: "JSON", prefix: "B3" },
] as const;

function builderSectionFromUrl(): BuilderSection {
  return parseBuilderSection(new URLSearchParams(window.location.search).get("section"));
}

export function BuilderWorkspace() {
  const [activeSection, setActiveSection] = useState<BuilderSection>("canvas");
  const [tree, setTree] = useState<StrategyTreeV1>(() => createSeedTree());
  const [graph, setGraph] = useState<StrategyGraphV2>(() => compileTreeToGraph(tree));
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    const sync = () => {
      const section = builderSectionFromUrl();
      setActiveSection(section);
      expandDashboardSection(dashboardSectionNumberFromNavId(section));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
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
    window.addEventListener("popstate", loadTreeFromUrl);
    return () => window.removeEventListener("popstate", loadTreeFromUrl);
  }, []);

  const selectSection = useCallback((sectionId: string) => {
    const section = parseBuilderSection(sectionId);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "builder");
    url.searchParams.set("section", section);
    url.searchParams.delete("page");
    window.history.pushState({ view: "builder", section }, "", url);
    setActiveSection(section);
    expandDashboardSection(dashboardSectionNumberFromNavId(section));
    document.getElementById(`builder-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyDocument = useCallback((nextTree: StrategyTreeV1, nextGraph: StrategyGraphV2) => {
    setTree(nextTree);
    setGraph(nextGraph);
    setCanvasKey((current) => current + 1);
  }, []);

  return (
    <div className="builder-workspace-shell investment-workspace-shell" data-workspace="builder">
      <header className="builder-workspace-chrome">
        <h2>Algorithm Builder</h2>
        <WorkspaceSectionNav
          label="Algorithm Canvas sections"
          sections={BUILDER_SECTIONS}
          activeId={activeSection}
          onSelect={selectSection}
        />
      </header>

      <div id="builder-board" className="workspace-section action-board-workspace-section">
        <CollapsibleSection number={builderSectionNumber("board")} title="Action Board" note="Clickable daily canvas, validation and export actions">
          <DailyKanbanBoard workspace="builder"/>
        </CollapsibleSection>
      </div>

      <div id="builder-canvas" className="workspace-section">
        <CollapsibleSection
          number={builderSectionNumber("canvas")}
          title="Canvas"
          note="Nested tree · Add a Block · compiles to StrategyGraphV2 · desktop editing"
          defaultOpen
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

      <div id="builder-json" className="workspace-section">
        <CollapsibleSection number={builderSectionNumber("json")} title="JSON" note="Lossless tree + compiled graph · ids, percents, If/Else, pins">
          <BuilderJsonPanel tree={tree} graph={graph} disabled={false} onApply={applyDocument} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
