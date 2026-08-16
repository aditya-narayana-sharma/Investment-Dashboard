import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

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

export async function firstExisting(urls) {
  for (const url of urls) {
    const text = await readOptional(url);
    if (text) return { url, text };
  }
  return { url: null, text: "" };
}
