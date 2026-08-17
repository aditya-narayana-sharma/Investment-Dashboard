import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import type { IntegrationsConfig } from "../defaults.ts";
import type { IntegrationSemanticStatus } from "../registry.ts";
import { expandUserPath } from "../research/index.ts";

export type NotesProbe = {
  id: string;
  status: IntegrationSemanticStatus;
  message: string;
  titles?: string[];
};

function safeVaultPath(raw: string): string {
  const expanded = expandUserPath(raw.trim());
  const resolved = resolve(expanded);
  if (!resolved || resolved === "/" || resolved.includes("\0")) {
    throw new Error("Refusing to read an unsafe Obsidian vault path.");
  }
  return resolved;
}

export function listObsidianNotes(vaultPath: string, limit = 40): string[] {
  const root = safeVaultPath(vaultPath);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Obsidian vault was not found: ${root}`);
  }
  const titles: string[] = [];
  const walk = (dir: string) => {
    if (titles.length >= limit) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (titles.length >= limit) return;
      if (entry.name.startsWith(".")) continue;
      const full = normalize(join(dir, entry.name));
      const rel = relative(root, full);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) continue;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.md$/i.test(entry.name)) titles.push(rel.replace(/\\/g, "/"));
    }
  };
  walk(root);
  return titles;
}

export function testNotesAdapter(id: string, config: IntegrationsConfig): NotesProbe {
  if (id === "notes:obsidian") {
    if (!config.notes.obsidianVault) {
      return { id, status: "unconfigured", message: "Set notes.obsidianVault to a local folder you own." };
    }
    try {
      const titles = listObsidianNotes(config.notes.obsidianVault);
      return { id, status: "live", message: `Vault readable · ${titles.length} markdown notes listed.`, titles };
    } catch (error) {
      return { id, status: "unavailable", message: error instanceof Error ? error.message : "Obsidian vault unreadable." };
    }
  }
  if (id === "notes:apple") {
    if (!config.notes.apple.length) {
      return { id, status: "unconfigured", message: "Add exact Apple Notes titles. Health Daily remains deprecated." };
    }
    return {
      id,
      status: "live",
      message: `Will read only: ${config.notes.apple.join(", ")}.`,
      titles: config.notes.apple,
    };
  }
  if (id === "notes:notion") {
    if (!config.notes.notion) {
      return { id, status: "unconfigured", message: "Notion is unavailable until an on-device MCP or token is configured." };
    }
    return { id, status: "cached", message: "Notion config is present. Tokens stay in artifacts/private/." };
  }
  if (id === "notes:onenote") {
    if (!config.notes.onenote) {
      return { id, status: "unavailable", message: "OneNote stays unavailable without a Microsoft Graph token." };
    }
    return { id, status: "cached", message: "Graph config is present. No unofficial OneNote scraping." };
  }
  if (id === "tasks:google") {
    if (!config.googleTasks.enabled) {
      return { id, status: "unavailable", message: "Google Tasks is unavailable until enabled with on-device OAuth." };
    }
    return { id, status: "permission_required", message: "Enable OAuth and store tokens under artifacts/private/. Unconfigured remains unavailable." };
  }
  return { id, status: "unavailable", message: `Unknown notes adapter ${id}.` };
}
