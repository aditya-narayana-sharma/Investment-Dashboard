import type { BuilderSection, WorkspaceKey } from "./types";

export const WORKSPACE_VIEW_VALUES = ["investment", "sectors", "intelligence", "health", "builder"] as const;
export const BUILDER_SECTIONS = ["board", "canvas", "json"] as const;

export function isWorkspaceKey(value: string | null | undefined): value is WorkspaceKey {
  switch (value) {
    case "investment":
    case "sectors":
    case "intelligence":
    case "health":
    case "builder":
      return true;
    default:
      return false;
  }
}

export function isBuilderSection(value: string | null | undefined): value is BuilderSection {
  switch (value) {
    case "board":
    case "canvas":
    case "json":
      return true;
    default:
      return false;
  }
}

/** Canonical `?view=` workspace. Aliases: market-intelligence → intelligence, algorithm-canvas → builder. */
export function parseWorkspaceView(value: string | null | undefined): WorkspaceKey {
  switch (value) {
    case "investment":
    case "sectors":
    case "intelligence":
    case "health":
    case "builder":
      return value;
    case "market-intelligence":
      return "intelligence";
    case "algorithm-canvas":
      return "builder";
    default:
      return "investment";
  }
}

/** Builder sections. Missing or foreign values default to the product canvas surface. */
export function parseBuilderSection(value: string | null | undefined): BuilderSection {
  switch (value) {
    case "board":
    case "canvas":
    case "json":
      return value;
    default:
      return "canvas";
  }
}

export function builderSectionNumber(section: BuilderSection): "B-1" | "B-2" | "B-3" {
  switch (section) {
    case "board":
      return "B-1";
    case "canvas":
      return "B-2";
    case "json":
      return "B-3";
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

export function applyCanonicalWorkspaceUrl(url: URL): { view: WorkspaceKey; rewritten: boolean } {
  const raw = url.searchParams.get("view");
  const view = parseWorkspaceView(raw);
  let rewritten = raw !== view;
  if (raw === "algorithm-canvas" && !isBuilderSection(url.searchParams.get("section"))) {
    url.searchParams.set("section", "canvas");
    rewritten = true;
  }
  if (rewritten) url.searchParams.set("view", view);
  return { view, rewritten };
}
