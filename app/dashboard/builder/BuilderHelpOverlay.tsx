"use client";

import type { ReactNode } from "react";

export const TUTORIAL_STORAGE_KEY = "algorithm-canvas-tutorial-dismissed";

export type HelpMode = "tutorial" | "shortcuts";
export type TourZone = "palette" | "canvas" | "inspector" | "toolbar";

export type TutorialStep = {
  title: string;
  body: string;
  zone: TourZone;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "This is a flowchart",
    body: "Boxes are steps. Lines carry data between them. Build left to right: start with stocks, then a number, then a yes/no check, then buy or sell.",
    zone: "canvas",
  },
  {
    title: "Drag from the left palette",
    body: "The left column is the palette. Drag a Structure block or a KPI onto the white grid. Boxes snap to a 20px grid so they line up.",
    zone: "palette",
  },
  {
    title: "Start with UNIVERSE",
    body: "Every useful path starts at UNIVERSE. That box picks which stocks: Equity, ETF, or Cash. Select the box, then tick classes in the right inspector.",
    zone: "palette",
  },
  {
    title: "Add a KPI and connect it",
    body: "Drop a KPI such as RSI 14 or CLOSE. Click UNIVERSE’s right handle (blue = series, a stream of numbers), then the KPI’s left handle. Mismatched colors will not connect.",
    zone: "canvas",
  },
  {
    title: "Add COMPARATOR",
    body: "Drop COMPARATOR from Structure. In the inspector, set a check such as < 30. Connect the KPI’s blue output to the comparator’s left input. The comparator’s right handle is amber (a yes/no condition).",
    zone: "inspector",
  },
  {
    title: "Entry and exit triggers",
    body: "Drop ENTRY TRIGGER (green) and EXIT TRIGGER (pink). Connect the comparator’s amber handle to entry. Repeat, or add another condition, for exit. Green lines are triggers — “do this now”.",
    zone: "canvas",
  },
  {
    title: "Optional AND / OR",
    body: "AND/OR combines two amber conditions into one. Connect two comparators into AND/OR, then connect that box to a trigger.",
    zone: "palette",
  },
  {
    title: "Allocation",
    body: "Drop ALLOCATION. In the inspector, set weightage % (how much of the sleeve). Connect a trigger’s green handle to allocation. That line is cyan (a size / weight).",
    zone: "inspector",
  },
  {
    title: "Optional risk and paper",
    body: "Add RISK LIMIT after allocation if you want a cap. Then PAPER ACTION to practice the path. Paper action does not place live broker orders.",
    zone: "palette",
  },
  {
    title: "Validate and undo",
    body: "Click VALIDATE. A green strip that says VALIDATION: NO ISSUES means the path is typed correctly. Use Undo if you mess up. Reopen this guide anytime from Tutorial or Shortcuts.",
    zone: "toolbar",
  },
];

export function readTutorialDismissed(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTutorialDismissed(dismissed: boolean) {
  try {
    if (dismissed) window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
    else window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function BuilderHelpOverlay({
  mode,
  stepIndex,
  dontShowAgain,
  onMode,
  onStep,
  onDontShowAgain,
  onClose,
}: {
  mode: HelpMode;
  stepIndex: number;
  dontShowAgain: boolean;
  onMode: (mode: HelpMode) => void;
  onStep: (index: number) => void;
  onDontShowAgain: (value: boolean) => void;
  onClose: () => void;
}) {
  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  const last = TUTORIAL_STEPS.length - 1;
  const dialogLabel = mode === "tutorial" ? "Canvas tutorial" : "Canvas shortcuts";

  let body: ReactNode;
  switch (mode) {
    case "tutorial":
      body = (
        <div className="builder-tutorial">
          <p className="builder-tutorial-step">Step {stepIndex + 1} of {TUTORIAL_STEPS.length}</p>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
          <p className="builder-tutorial-legend">
            Line colors: <b className="series">blue series</b> (numbers),
            {" "}<b className="boolean">amber condition</b> (yes/no),
            {" "}<b className="trigger">green trigger</b> (act),
            {" "}<b className="allocation">cyan allocation</b> (size).
          </p>
          <div className="builder-tutorial-nav">
            <button type="button" disabled={stepIndex <= 0} onClick={() => onStep(stepIndex - 1)}>Back</button>
            <button type="button" disabled={stepIndex >= last} onClick={() => onStep(stepIndex + 1)}>Next</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          <label className="builder-tutorial-dismiss">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => onDontShowAgain(event.target.checked)}
            />
            Do not show again
          </label>
        </div>
      );
      break;
    case "shortcuts":
      body = (
        <>
          <h3>Shortcuts</h3>
          <ul>
            <li><kbd>?</kbd> Toggle this overlay</li>
            <li><kbd>Esc</kbd> Deselect / cancel a connection / close</li>
            <li><kbd>Del</kbd> Delete selected node</li>
            <li><kbd>⌘Z</kbd> Undo · <kbd>⌘⇧Z</kbd> Redo</li>
            <li>Drag palette blocks or KPIs onto the canvas (20px snap)</li>
            <li>Click an output handle (right), then a matching input handle (left)</li>
            <li>Colors must match. Mismatched ports will not connect</li>
          </ul>
          <div className="builder-tutorial-nav">
            <button type="button" onClick={() => onMode("tutorial")}>Open tutorial</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </>
      );
      break;
    default: {
      const _never: never = mode;
      body = _never;
    }
  }

  return (
    <div className="builder-shortcuts" role="dialog" aria-label={dialogLabel}>
      <div className="builder-help-tabs" role="tablist" aria-label="Help">
        <button type="button" role="tab" aria-selected={mode === "tutorial"} onClick={() => onMode("tutorial")}>Tutorial</button>
        <button type="button" role="tab" aria-selected={mode === "shortcuts"} onClick={() => onMode("shortcuts")}>Shortcuts</button>
      </div>
      {body}
    </div>
  );
}
