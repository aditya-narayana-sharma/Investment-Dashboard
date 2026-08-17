import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const GUIDES_DIR = fileURLToPath(new URL("./guides", import.meta.url));

export const INTEGRATION_GUIDE_IDS = [
  "kite-mcp",
  "yfinance",
  "mail-mapping",
  "tailscale",
  "health-pairing",
  "mcp-skills-agents",
  "rejected",
] as const;

export type IntegrationGuideId = (typeof INTEGRATION_GUIDE_IDS)[number];

export function isIntegrationGuideId(value: string): value is IntegrationGuideId {
  return (INTEGRATION_GUIDE_IDS as readonly string[]).includes(value);
}

export function listIntegrationGuides() {
  if (!existsSync(GUIDES_DIR)) return [];
  return readdirSync(GUIDES_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}

export function readIntegrationGuide(id: string): { id: string; title: string; body: string } | null {
  if (!isIntegrationGuideId(id)) return null;
  const path = join(GUIDES_DIR, `${id}.md`);
  if (!existsSync(path)) return null;
  const body = readFileSync(path, "utf8");
  const title = body.split("\n").find((line) => line.startsWith("# "))?.slice(2).trim() || id;
  return { id, title, body };
}
