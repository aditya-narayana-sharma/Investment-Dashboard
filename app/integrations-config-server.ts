import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  defaultIntegrationsConfig,
  publicIntegrationsConfig,
  sanitizeStoredIntegrationsConfig,
  type IntegrationsConfig,
  type StoredIntegrationsConfig,
} from "./integrations-types";

const CONFIG_RELATIVE = ["artifacts", "private", "integrations-config.json"] as const;

export {
  applyPipelineAction,
  assertPipelineId,
  mergeApplePermissionsUpdate,
  mergeIntegrationsUpdate,
  parseApplePermissionsAction,
  parsePipelineAction,
  sanitizeIntegrationsConfig,
  sanitizeStoredIntegrationsConfig,
} from "./integrations-types";

export function integrationsConfigPath(root = process.cwd()): string {
  return path.join(root, ...CONFIG_RELATIVE);
}

export async function readStoredIntegrationsConfig(root = process.cwd()): Promise<StoredIntegrationsConfig> {
  try {
    const text = await readFile(integrationsConfigPath(root), "utf8");
    return sanitizeStoredIntegrationsConfig(JSON.parse(text) as unknown);
  } catch {
    return sanitizeStoredIntegrationsConfig(defaultIntegrationsConfig());
  }
}

export async function readIntegrationsConfig(root = process.cwd()): Promise<IntegrationsConfig> {
  return publicIntegrationsConfig(await readStoredIntegrationsConfig(root));
}

export async function writeIntegrationsConfig(
  next: StoredIntegrationsConfig | IntegrationsConfig,
  root = process.cwd(),
): Promise<StoredIntegrationsConfig> {
  const sanitized = sanitizeStoredIntegrationsConfig(next);
  const payload = `${JSON.stringify(sanitized, null, 2)}\n`;
  const filePath = integrationsConfigPath(root);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, payload, { encoding: "utf8", mode: 0o600 });
  try {
    const supportPath = path.join(homedir(), "Library", "Application Support", "Stratji", "integrations-config.json");
    await mkdir(path.dirname(supportPath), { recursive: true });
    await writeFile(supportPath, payload, { encoding: "utf8", mode: 0o600 });
  } catch {
    /* Application Support is optional outside macOS author installs. */
  }
  return sanitized;
}
