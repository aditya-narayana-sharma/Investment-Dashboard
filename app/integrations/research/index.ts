import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import type { ResearchProviderConfig } from "../defaults.ts";
import type { IntegrationSemanticStatus } from "../registry.ts";

export type ResearchCatalogEntry = {
  id: string;
  label: string;
  defaultMailbox: string;
  defaultPdfDir: string;
};

export const RESEARCH_CATALOG: ResearchCatalogEntry[] = [
  { id: "axis", label: "Axis Research", defaultMailbox: "Axis Research", defaultPdfDir: "~/Downloads/Axis Research" },
  { id: "hdfc", label: "HDFC Securities", defaultMailbox: "HDFC Research", defaultPdfDir: "~/Downloads/HDFC Research" },
  { id: "sbi", label: "SBI Securities", defaultMailbox: "SBI Research", defaultPdfDir: "~/Downloads/SBI Research" },
  { id: "et-prime", label: "ET Prime", defaultMailbox: "ET Prime", defaultPdfDir: "~/Downloads/ET Prime" },
  { id: "moneycontrol", label: "Moneycontrol", defaultMailbox: "Moneycontrol", defaultPdfDir: "~/Downloads/Moneycontrol" },
];

export function expandUserPath(path: string): string {
  if (!path) return path;
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

export function assertLocalFolder(path: string): string {
  const expanded = expandUserPath(path);
  const resolved = resolve(expanded);
  if (resolved.includes("\0")) throw new Error("Invalid path.");
  return resolved;
}

export function researchProviderStatus(
  row: ResearchProviderConfig | undefined,
  catalog?: ResearchCatalogEntry,
): IntegrationSemanticStatus {
  if (!catalog && !row) return "unavailable";
  if (row && row.enabled === false) return "unconfigured";
  if (row?.id === "axis" && row.enabled !== false) return "live";
  if (!row) return "unconfigured";
  const hasMailbox = Boolean(row.account && row.mailbox);
  const pdfDir = row.pdfDir ? assertLocalFolder(row.pdfDir) : "";
  if (hasMailbox && pdfDir && existsSync(pdfDir)) return "cached";
  if (hasMailbox || (pdfDir && existsSync(pdfDir))) return "partial";
  return "unconfigured";
}

export function listLocalPdfs(pdfDir: string): string[] {
  const root = assertLocalFolder(pdfDir);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => /\.pdf$/i.test(name) && !name.includes(".."))
    .map((name) => {
      const full = normalize(join(root, name));
      const rel = relative(root, full);
      if (rel.startsWith("..") || isAbsolute(rel)) return null;
      return name;
    })
    .filter((name): name is string => Boolean(name));
}
