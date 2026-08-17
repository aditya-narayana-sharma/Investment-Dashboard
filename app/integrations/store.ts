import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_INTEGRATIONS_CONFIG, type IntegrationsConfig } from "./defaults.ts";
import { parseIntegrationsConfig } from "./schema.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function integrationsLivePath() {
  return process.env.INTEGRATIONS_CONFIG_PATH
    || join(ROOT, "artifacts/private/integrations.json");
}

export function integrationsExamplePath() {
  return join(ROOT, "config/integrations.example.json");
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function loadIntegrationsConfig(): IntegrationsConfig {
  for (const path of [integrationsLivePath(), integrationsExamplePath()]) {
    if (!existsSync(path)) continue;
    const parsed = readJson(path);
    if (parsed) return parseIntegrationsConfig(parsed);
  }
  return parseIntegrationsConfig(DEFAULT_INTEGRATIONS_CONFIG);
}

export function saveIntegrationsConfig(raw: unknown): IntegrationsConfig {
  const config = parseIntegrationsConfig(raw);
  const path = integrationsLivePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}
