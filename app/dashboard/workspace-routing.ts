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

/** Chrome pages are routed with `?view=` but are not `WorkspaceKey` values and must not mount DailyKanbanBoard. */
export const CHROME_VIEW_VALUES = ["integrations"] as const;
export type ChromeView = (typeof CHROME_VIEW_VALUES)[number];
export type AppView = WorkspaceKey | ChromeView;

export const BUILDER_SECTIONS = ["board", "canvas", "json"] as const;
export const STRATEGIES_SECTIONS = ["y1", "y2"] as const;
export const HEALTH_TOP_SECTIONS = ["h1", "h2", "h3"] as const;
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
      return true;
    default:
      return false;
  }
}

/** Canonical `?view=` workspace. Aliases: market-intelligence → intelligence, algorithm-canvas → builder, strategy-library → strategies, portfolio / portfolio-overview → investment. Chrome aliases (integrations/settings) are not workspaces and fall through to investment here. */
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
    default:
      return "y2";
  }
}

/** Health H-1 / H-2 / H-3. Aliases: board, optimism, metrics. Legacy Vital Metrics lived at h4. Callers treat a missing section as exclusive H-1. */
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
    case "h4":
      return "h3";
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
  section: Exclude<HealthTopSection, "h1">,
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
  if (view === "health") {
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
