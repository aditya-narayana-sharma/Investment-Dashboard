import type { BuilderSection, StrategiesSection, WorkspaceKey } from "./types";

export const WORKSPACE_VIEW_VALUES = ["investment", "sectors", "intelligence", "health", "builder", "strategies"] as const;
export const NATIVE_CHROME_PARAM = "nativeChrome";
export const NATIVE_EMBED_PARAM = "native";

function isNativeChromeFlag(value: string | null | undefined): boolean {
  switch (value) {
    case "1":
    case "true":
      return true;
    default:
      return false;
  }
}

function nativeChromeFromSearchParams(search: URLSearchParams): boolean {
  return isNativeChromeFlag(search.get(NATIVE_CHROME_PARAM))
    || isNativeChromeFlag(search.get(NATIVE_EMBED_PARAM));
}

export function isNativeChromeEnabled(search: URLSearchParams | string | null | undefined): boolean {
  if (search instanceof URLSearchParams) return nativeChromeFromSearchParams(search);
  if (!search) return false;
  const query = search.startsWith("?") ? search.slice(1) : search;
  return nativeChromeFromSearchParams(new URLSearchParams(query));
}

export function isNativeChromeDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("native-chrome-embed")
    || document.documentElement.dataset.nativeChrome === "1";
}

/** WKWebView `applicationNameForUserAgent` is `Stratji/1`, so the UA contains `Stratji/`. */
export function isStratjiNativeUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /\bStratji\//i.test(userAgent);
}

/** Mac Stratji.app overlay owns the workspace droplet. iOS and localhost keep the web cluster. */
export function isStratjiMacOverlayUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /\bStratji\//i.test(userAgent)
    && /Macintosh/i.test(userAgent)
    && !/iPhone|iPad|iPod/i.test(userAgent);
}

export function stratjiMacOverlayOwnsWorkspaceNav(
  userAgent: string | null | undefined = typeof navigator !== "undefined" ? navigator.userAgent : null,
): boolean {
  if (isStratjiMacOverlayUserAgent(userAgent)) return true;
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.nativeOwnsSections === "1";
}

/** Chrome pages are routed with `?view=` but are not `WorkspaceKey` values and must not mount DailyKanbanBoard. */
export const CHROME_VIEW_VALUES = ["integrations"] as const;
export type ChromeView = (typeof CHROME_VIEW_VALUES)[number];
export type AppView = WorkspaceKey | ChromeView;

export const BUILDER_SECTIONS = ["board", "canvas", "json"] as const;
export const STRATEGIES_SECTIONS = ["y1", "y2", "y3"] as const;
export const HEALTH_TOP_SECTIONS = ["h1", "h2", "h3", "h4"] as const;
export const HEALTH_H2_PAGES = ["optimism", "insights", "guidance", "guardrails"] as const;
export const HEALTH_H3_PAGES = ["metrics-overview", "activity", "sleep", "heart", "respiratory", "mobility", "nutrition"] as const;

export type HealthTopSection = (typeof HEALTH_TOP_SECTIONS)[number];
export type HealthH2Page = (typeof HEALTH_H2_PAGES)[number];
export type HealthH3Page = (typeof HEALTH_H3_PAGES)[number];
export type HealthSectionPage = HealthH2Page | HealthH3Page;

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

export function isChromeView(value: string | null | undefined): value is ChromeView {
  switch (value) {
    case "integrations":
      return true;
    default:
      return false;
  }
}

export function isIntegrationsView(value: string | null | undefined): boolean {
  switch (value) {
    case "integrations":
    case "settings":
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
    case "y3":
      return true;
    default:
      return false;
  }
}

/** Canonical `?view=` workspace. Aliases: market-intelligence → intelligence, algorithm-canvas → builder, strategy-library → strategies, feed / my-feed → health, portfolio / portfolio-overview → investment. Chrome aliases (integrations/settings) are not workspaces and fall through to investment here. */
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
    case "feed":
    case "my-feed":
      return "health";
    case "portfolio":
    case "portfolio-overview":
      return "investment";
    default:
      return "investment";
  }
}

/** Workspace or Integration Page chrome. `settings` → integrations. Portfolio aliases → investment. */
export function parseAppView(value: string | null | undefined): AppView {
  if (isIntegrationsView(value)) return "integrations";
  return parseWorkspaceView(value);
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
    case "y3":
    case "signals":
      return "y3";
    default:
      return "y2";
  }
}

/** Health H-1 / H-2 / H-3 / H-4. Aliases: board, optimism, metrics, calendar / calendar-reminders. Callers treat a missing section as exclusive H-1. */
export function parseHealthTopSection(value: string | null | undefined): HealthTopSection | null {
  switch (value) {
    case "h1":
    case "board":
      return "h1";
    case "h2":
    case "optimism":
      return "h2";
    case "h3":
    case "metrics":
      return "h3";
    case "h4":
    case "calendar":
    case "calendar-reminders":
      return "h4";
    default:
      return null;
  }
}

/** Daily Optimism aliases. Combined H-2 renders optimism + insights + guidance + guardrails; these values only scroll to a heading. Missing or foreign values default to Optimism. */
export function parseHealthH2Page(value: string | null | undefined): HealthH2Page {
  switch (value) {
    case "optimism":
    case "insights":
    case "guidance":
    case "guardrails":
      return value;
    default:
      return "optimism";
  }
}

/** Vital Metrics pages. `nutrition-1` / `nutrition-2` alias the combined Nutrition page. */
export function parseHealthH3Page(value: string | null | undefined): HealthH3Page {
  switch (value) {
    case "metrics-overview":
    case "activity":
    case "sleep":
    case "heart":
    case "respiratory":
    case "mobility":
    case "nutrition":
      return value;
    case "nutrition-1":
    case "nutrition-2":
      return "nutrition";
    default:
      return "metrics-overview";
  }
}

export function parseHealthSectionPage(
  section: Exclude<HealthTopSection, "h1" | "h4">,
  value: string | null | undefined,
): HealthSectionPage {
  switch (section) {
    case "h2":
      return parseHealthH2Page(value);
    case "h3":
      return parseHealthH3Page(value);
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
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

export function strategiesSectionNumber(section: StrategiesSection): "Y-1" | "Y-2" | "Y-3" {
  switch (section) {
    case "y1":
      return "Y-1";
    case "y2":
      return "Y-2";
    case "y3":
      return "Y-3";
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

/** Compact glass-bar section chips. In-page pill rows must not duplicate these. */
export type WorkspaceSectionChip = {
  id: string;
  label: string;
  prefix: string;
};

export const WORKSPACE_SECTIONS: Record<WorkspaceKey, readonly WorkspaceSectionChip[]> = {
  investment: [
    { id: "i1", label: "Action Board", prefix: "I-1" },
    { id: "i2", label: "Portfolio", prefix: "I-2" },
    { id: "i3", label: "Risk", prefix: "I-3" },
    { id: "i4", label: "Axis picks", prefix: "I-4" },
  ],
  sectors: [
    { id: "s1", label: "Action Board", prefix: "S-1" },
    { id: "s2", label: "Industry Analytics", prefix: "S-2" },
    { id: "s3", label: "Decision Framework", prefix: "S-3" },
  ],
  intelligence: [
    { id: "m1", label: "Action Board", prefix: "M-1" },
    { id: "m2", label: "Satya", prefix: "M-2" },
    { id: "m3", label: "Earnings Calendar", prefix: "M-3" },
  ],
  health: [
    { id: "h1", label: "Action Board", prefix: "H-1" },
    { id: "h2", label: "Daily Optimism", prefix: "H-2" },
    { id: "h3", label: "Vital Metrics", prefix: "H-3" },
    { id: "h4", label: "Calendar + Reminders", prefix: "H-4" },
  ],
  builder: [
    { id: "board", label: "Action Board", prefix: "B-1" },
    { id: "canvas", label: "Canvas", prefix: "B-2" },
    { id: "json", label: "JSON", prefix: "B-3" },
  ],
  strategies: [
    { id: "y1", label: "Action Board", prefix: "Y-1" },
    { id: "y2", label: "Library", prefix: "Y-2" },
    { id: "y3", label: "Signals", prefix: "Y-3" },
  ],
};

export function defaultSectionForWorkspace(workspace: WorkspaceKey): string {
  switch (workspace) {
    case "investment":
      return "i1";
    case "sectors":
      return "s1";
    case "intelligence":
      return "m1";
    case "health":
      return "h1";
    case "builder":
      return "canvas";
    case "strategies":
      return "y2";
    default: {
      const _exhaustive: never = workspace;
      return _exhaustive;
    }
  }
}

export function workspaceSectionLabel(workspace: WorkspaceKey): string {
  switch (workspace) {
    case "investment":
      return "Investment sections";
    case "sectors":
      return "Sectoral Analytics sections";
    case "intelligence":
      return "Market Intelligence sections";
    case "health":
      return "My Feed sections";
    case "builder":
      return "Algorithm Canvas sections";
    case "strategies":
      return "Strategies sections";
    default: {
      const _exhaustive: never = workspace;
      return _exhaustive;
    }
  }
}

function sectionIdAllowed(workspace: WorkspaceKey, sectionId: string): boolean {
  return WORKSPACE_SECTIONS[workspace].some((section) => section.id === sectionId);
}

/** Canonical section for a workspace, including builder/strategies/health aliases. */
export function parseWorkspaceSection(workspace: WorkspaceKey, value: string | null | undefined): string {
  switch (workspace) {
    case "builder":
      return parseBuilderSection(value);
    case "strategies":
      return parseStrategiesSection(value);
    case "health":
      return parseHealthTopSection(value) ?? defaultSectionForWorkspace(workspace);
    case "investment":
    case "sectors":
    case "intelligence":
      if (value && sectionIdAllowed(workspace, value)) return value;
      return defaultSectionForWorkspace(workspace);
    default: {
      const _exhaustive: never = workspace;
      return _exhaustive;
    }
  }
}

/** True when the current `?view=` (aliases included) is this workspace. Foreign leftover `section=` must not drive a hidden sibling. */
export function isLocationView(workspace: WorkspaceKey, search?: string | URLSearchParams | null): boolean {
  if (search instanceof URLSearchParams) return parseWorkspaceView(search.get("view")) === workspace;
  if (typeof search === "string") {
    const query = search.startsWith("?") ? search.slice(1) : search;
    return parseWorkspaceView(new URLSearchParams(query).get("view")) === workspace;
  }
  if (typeof window === "undefined") return false;
  return parseWorkspaceView(new URLSearchParams(window.location.search).get("view")) === workspace;
}

/** Write view/section/page query items for a workspace section chip. */
export function applyWorkspaceSectionParams(url: URL, workspace: WorkspaceKey, sectionId: string): string {
  const section = parseWorkspaceSection(workspace, sectionId);
  url.searchParams.set("view", workspace);
  url.searchParams.set("section", section);
  switch (workspace) {
    case "sectors":
      if (section === "s2") url.searchParams.set("page", "pulse");
      else if (section === "s3") url.searchParams.set("page", "benchmarks");
      else url.searchParams.delete("page");
      break;
    case "health":
      if (section === "h2") url.searchParams.set("page", "optimism");
      else if (section === "h3") url.searchParams.set("page", "metrics-overview");
      else url.searchParams.delete("page");
      break;
    default:
      url.searchParams.delete("page");
      break;
  }
  if (workspace !== "builder") url.searchParams.delete("tree");
  return section;
}

function firstQueryValue(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** First-render native-embed chrome from RSC searchParams and/or `window.location.search`. */
export function nativeChromeFromPageSearch(
  searchParams?: { nativeChrome?: string | string[]; native?: string | string[] } | null,
  locationSearch?: string | null,
): boolean {
  if (isNativeChromeFlag(firstQueryValue(searchParams?.nativeChrome))) return true;
  if (isNativeChromeFlag(firstQueryValue(searchParams?.native))) return true;
  return isNativeChromeEnabled(locationSearch);
}

/** Native Stratji.app / iOS WKWebView: query flag, Stratji UA, or injected document class. */
export function detectNativeChrome(input: {
  searchParams?: { nativeChrome?: string | string[]; native?: string | string[] } | null;
  locationSearch?: string | null;
  userAgent?: string | null;
} = {}): boolean {
  if (nativeChromeFromPageSearch(input.searchParams, input.locationSearch)) return true;
  if (isStratjiNativeUserAgent(input.userAgent)) return true;
  return isNativeChromeDocument();
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

/** First-render app view including Integration Page chrome. */
export function appViewFromPageSearch(
  searchParams?: { view?: string | string[] } | null,
  locationSearch?: string | null,
): AppView {
  const fromProps = firstQueryValue(searchParams?.view);
  if (fromProps) return parseAppView(fromProps);
  if (locationSearch) {
    const query = locationSearch.startsWith("?") ? locationSearch.slice(1) : locationSearch;
    return parseAppView(new URLSearchParams(query).get("view"));
  }
  return "investment";
}

export function applyCanonicalAppUrl(url: URL): { appView: AppView; rewritten: boolean } {
  const raw = url.searchParams.get("view");
  if (isIntegrationsView(raw)) {
    const rewritten = raw !== "integrations";
    if (rewritten) url.searchParams.set("view", "integrations");
    url.searchParams.delete("section");
    url.searchParams.delete("page");
    url.searchParams.delete("tree");
    return { appView: "integrations", rewritten };
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
  if (view === "intelligence") {
    const section = url.searchParams.get("section");
    if (section === "m4" || section === "calendar" || section === "calendar-reminders") {
      url.searchParams.set("view", "health");
      url.searchParams.set("section", "h4");
      rewritten = true;
      return { appView: "health", rewritten };
    }
  }
  if (view === "health") {
    const section = url.searchParams.get("section");
    if (section === "calendar" || section === "calendar-reminders") {
      url.searchParams.set("section", "h4");
      rewritten = true;
    }
    const page = url.searchParams.get("page");
    if (page === "nutrition-1" || page === "nutrition-2") {
      url.searchParams.set("page", "nutrition");
      rewritten = true;
    }
  }
  if (rewritten) url.searchParams.set("view", view);
  return { appView: view, rewritten };
}

/** Canonical `?view=` workspace. Chrome integrations URLs are left as integrations in the query string; the returned `view` is the last workspace fallback (`investment`) so existing WorkspaceKey callers stay typed. Prefer `applyCanonicalAppUrl` for the shell. */
export function applyCanonicalWorkspaceUrl(url: URL): { view: WorkspaceKey; rewritten: boolean } {
  const raw = url.searchParams.get("view");
  if (isIntegrationsView(raw)) {
    const rewritten = raw !== "integrations";
    if (rewritten) url.searchParams.set("view", "integrations");
    return { view: "investment", rewritten };
  }
  const { appView, rewritten } = applyCanonicalAppUrl(url);
  if (appView === "integrations") return { view: "investment", rewritten };
  return { view: appView, rewritten };
}
