"use client";

import { useCallback, useEffect, useState } from "react";
import type { StrategyGraphV2 } from "../strategy/graph-types";
import { createSeedGraph } from "../strategy/seed-graph";
import { AlgorithmBuilder } from "./builder/AlgorithmBuilder";
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
  const [graph, setGraph] = useState<StrategyGraphV2>(() => createSeedGraph());
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    const sync = () => setActiveSection(builderSectionFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
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

  const applyJson = useCallback((next: StrategyGraphV2) => {
    setGraph(next);
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
        <CollapsibleSection number={builderSectionNumber("canvas")} title="Canvas" note="Typed StrategyGraphV2 node graph · 20px snap · desktop editing">
          <AlgorithmBuilder key={canvasKey} initialGraph={graph} onGraphChange={setGraph} />
        </CollapsibleSection>
      </div>

      <div id="builder-json" className="workspace-section">
        <CollapsibleSection number={builderSectionNumber("json")} title="JSON" note="Lossless StrategyGraphV2 view and edit · ids, positions, params and pins">
          <BuilderJsonPanel graph={graph} disabled={false} onApply={applyJson} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
