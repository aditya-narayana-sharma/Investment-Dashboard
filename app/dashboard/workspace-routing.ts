import type { BuilderSection, StrategiesSection, WorkspaceKey } from "./types";

export const WORKSPACE_VIEW_VALUES = ["investment", "sectors", "intelligence", "health", "builder", "strategies"] as const;
export const INTEGRATIONS_VIEW = "integrations";
export const BUILDER_SECTIONS = ["board", "canvas", "json"] as const;
export const STRATEGIES_SECTIONS = ["y1", "y2"] as const;

export function isWorkspaceKey(value: string | null | undefined): value is WorkspaceKey {
  switch (value) {
    case "investment":
    case "sectors":
    case "intelligence":
    case "health":
    case "builder":
    case "strategies":
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

export function isStrategiesSection(value: string | null | undefined): value is StrategiesSection {
  switch (value) {
    case "y1":
    case "y2":
      return true;
    default:
      return false;
  }
}

/** Integrations is chrome (`?view=integrations`), never a seventh Kanban workspace. `settings` is a legacy alias. */
export function isIntegrationsView(value: string | null | undefined): boolean {
  switch (value) {
    case "integrations":
    case "settings":
      return true;
    default:
      return false;
  }
}

/** Canonical `?view=` workspace. Aliases: market-intelligence → intelligence, algorithm-canvas → builder, strategy-library → strategies. */
export function parseWorkspaceView(value: string | null | undefined): WorkspaceKey {
  switch (value) {
    case "investment":
    case "sectors":
    case "intelligence":
    case "health":
    case "builder":
    case "strategies":
      return value;
    case "market-intelligence":
      return "intelligence";
    case "algorithm-canvas":
      return "builder";
    case "strategy-library":
      return "strategies";
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

/** Strategies sections. Missing or foreign values default to the library. */
export function parseStrategiesSection(value: string | null | undefined): StrategiesSection {
  switch (value) {
    case "y1":
    case "board":
      return "y1";
    case "y2":
    case "library":
      return "y2";
    default:
      return "y2";
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

export function strategiesSectionNumber(section: StrategiesSection): "Y-1" | "Y-2" {
  switch (section) {
    case "y1":
      return "Y-1";
    case "y2":
      return "Y-2";
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

function firstQueryValue(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** First-render workspace from RSC searchParams and/or `window.location.search`. */
export function workspaceFromPageSearch(
  searchParams?: { view?: string | string[] } | null,
  locationSearch?: string | null,
): WorkspaceKey {
  const fromProps = firstQueryValue(searchParams?.view);
  if (fromProps) return parseWorkspaceView(fromProps);
  if (locationSearch) {
    const query = locationSearch.startsWith("?") ? locationSearch.slice(1) : locationSearch;
    return parseWorkspaceView(new URLSearchParams(query).get("view"));
  }
  return "investment";
}

export function applyCanonicalWorkspaceUrl(url: URL): { view: WorkspaceKey; rewritten: boolean } {
  const raw = url.searchParams.get("view");
  if (isIntegrationsView(raw)) {
    const rewritten = raw !== INTEGRATIONS_VIEW;
    if (rewritten) url.searchParams.set("view", INTEGRATIONS_VIEW);
    return { view: "investment", rewritten };
  }
  const view = parseWorkspaceView(raw);
  let rewritten = raw !== view;
  if (raw === "algorithm-canvas" && !isBuilderSection(url.searchParams.get("section"))) {
    url.searchParams.set("section", "canvas");
    rewritten = true;
  }
  if (raw === "strategy-library" && !isStrategiesSection(url.searchParams.get("section"))) {
    url.searchParams.set("section", "y2");
    rewritten = true;
  }
  if (rewritten) url.searchParams.set("view", view);
  return { view, rewritten };
}

export function applyCanonicalDashboardUrl(url: URL): {
  chrome: "integrations" | null;
  view: WorkspaceKey;
  rewritten: boolean;
} {
  const raw = url.searchParams.get("view");
  if (isIntegrationsView(raw)) {
    const rewritten = raw !== INTEGRATIONS_VIEW;
    if (rewritten) url.searchParams.set("view", INTEGRATIONS_VIEW);
    return { chrome: "integrations", view: "investment", rewritten };
  }
  const { view, rewritten } = applyCanonicalWorkspaceUrl(url);
  return { chrome: null, view, rewritten };
}
