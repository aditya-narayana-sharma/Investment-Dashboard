"use client";

import type { StrategyTreeV1 } from "../../strategy/strategy-tree";
import { TreeCanvas } from "../builder/TreeCanvas";
import "../builder/algorithm-builder.css";
import "./strategies-workspace.css";

/** Read-only Symphony tree. Reuses TreeCanvas; hides Add a Block. Does not edit the canvas. */
export function ReadOnlyTree({ tree }: { tree: StrategyTreeV1 }) {
  return (
    <div className="strategy-readonly-tree" data-readonly="true" aria-label={`${tree.name} tree`}>
      <TreeCanvas
        name={tree.name}
        nodes={tree.children}
        selectedId={null}
        disabled
        onSelect={() => undefined}
        onChange={() => undefined}
        onAdd={() => undefined}
      />
    </div>
  );
}
