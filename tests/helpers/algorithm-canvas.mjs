import { access, readFile } from "node:fs/promises";
import { constants, readFileSync } from "node:fs";

const app = (relative) => new URL(`../../app/${relative}`, import.meta.url);

export const GLOBAL_CSS_CANDIDATES = [
  app("globals.css"),
  app("globals-investment.css"),
  app("globals-sectors.css"),
  app("globals-health.css"),
  app("appearance-themes.css"),
  app("appearance-sepia.css"),
];

export const VISUAL_CSS_CANDIDATES = [
  app("visual-overhaul.css"),
  app("visual-overhaul-instruments.css"),
  app("visual-overhaul-sepia.css"),
];

export const INVESTMENT_SOURCE_CANDIDATES = [
  app("dashboard/InvestmentWorkspace.tsx"),
  app("dashboard/InvestmentPanels.tsx"),
];

export const INTELLIGENCE_SOURCE_CANDIDATES = [
  app("dashboard/IntelligenceWorkspace.tsx"),
  app("dashboard/IntelligenceDigest.tsx"),
  app("dashboard/IntelligenceEarnings.tsx"),
];

export const BUILDER_WORKSPACE_CANDIDATES = [
  new URL("../../app/dashboard/BuilderWorkspace.tsx", import.meta.url),
  new URL("../../app/dashboard/builder/BuilderWorkspace.tsx", import.meta.url),
  new URL("../../app/dashboard/AlgorithmCanvasWorkspace.tsx", import.meta.url),
  new URL("../../apps/web/components/workspaces/BuilderWorkspace.tsx", import.meta.url),
];

export const BUILDER_CHROME_CANDIDATES = [
  ...BUILDER_WORKSPACE_CANDIDATES,
  new URL("../../app/dashboard/builder/AlgorithmBuilder.tsx", import.meta.url),
  new URL("../../app/dashboard/builder/BuilderJsonPanel.tsx", import.meta.url),
  new URL("../../app/page.tsx", import.meta.url),
  new URL("../../app/dashboard/utils.ts", import.meta.url),
  new URL("../../app/dashboard/shared-ui.tsx", import.meta.url),
];

export const ROUTING_SOURCE_CANDIDATES = [
  new URL("../../app/page.tsx", import.meta.url),
  new URL("../../app/dashboard/types.ts", import.meta.url),
  new URL("../../app/dashboard/utils.ts", import.meta.url),
  new URL("../../app/dashboard/workspace-view.ts", import.meta.url),
  new URL("../../app/dashboard/workspace-routing.ts", import.meta.url),
  ...BUILDER_WORKSPACE_CANDIDATES,
];

export async function readOptional(url) {
  try {
    await access(url, constants.R_OK);
    return await readFile(url, "utf8");
  } catch {
    return "";
  }
}

export async function readJoined(urls) {
  const parts = await Promise.all(urls.map((url) => readOptional(url)));
  return parts.filter(Boolean).join("\n");
}

export function readJoinedSync(urls) {
  return urls.map((url) => {
    try {
      return readFileSync(url, "utf8");
    } catch {
      return "";
    }
  }).filter(Boolean).join("\n");
}

export async function firstExisting(urls) {
  for (const url of urls) {
    const text = await readOptional(url);
    if (text) return { url, text };
  }
  return { url: null, text: "" };
}
