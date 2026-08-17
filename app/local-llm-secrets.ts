import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { StoredIntegrationsConfig } from "./integrations-types";

export type LocalLlmSecrets = {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  cursorApiKey?: string;
};

export type LocalLlmProviderName = "OpenAI" | "Claude" | "Gemini" | "Cursor";

const ENV_ALIASES: Record<keyof LocalLlmSecrets, readonly string[]> = {
  openaiApiKey: ["OPENAI_API_KEY", "OPENAI_KEY"],
  anthropicApiKey: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY"],
  geminiApiKey: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_GEMINI_API_KEY"],
  cursorApiKey: ["CURSOR_API_KEY", "CURSOR_API_TOKEN"],
};

function usableSecret(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length < 8) return undefined;
  if (/^(your[-_]?|changeme|placeholder|xxx+|todo|replace)/i.test(trimmed)) return undefined;
  return trimmed;
}

function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function takeFromRecord(record: Record<string, unknown>, into: LocalLlmSecrets): void {
  for (const field of Object.keys(ENV_ALIASES) as Array<keyof LocalLlmSecrets>) {
    if (into[field]) continue;
    const direct = usableSecret(record[field]);
    if (direct) {
      into[field] = direct;
      continue;
    }
    for (const alias of ENV_ALIASES[field]) {
      const fromAlias = usableSecret(record[alias]);
      if (fromAlias) {
        into[field] = fromAlias;
        break;
      }
    }
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function mergeEnvFile(filePath: string, into: LocalLlmSecrets): Promise<void> {
  const text = await readText(filePath);
  if (!text) return;
  takeFromRecord(parseEnvText(text), into);
}

async function mergeJsonFile(filePath: string, into: LocalLlmSecrets): Promise<void> {
  const text = await readText(filePath);
  if (!text) return;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return;
    const record = parsed as Record<string, unknown>;
    const llm = record.llm && typeof record.llm === "object" ? record.llm as Record<string, unknown> : record;
    takeFromRecord(llm, into);
  } catch {
    takeFromRecord(parseEnvText(text), into);
  }
}

/** Reads gitignored local files and process env. Never logs secret values. */
export async function readLocalLlmSecrets(root = process.cwd(), home = homedir()): Promise<LocalLlmSecrets> {
  const secrets: LocalLlmSecrets = {};
  await mergeJsonFile(path.join(root, "artifacts", "private", "integrations-config.json"), secrets);
  await mergeJsonFile(path.join(home, "Library", "Application Support", "Stratji", "integrations-config.json"), secrets);
  await mergeEnvFile(path.join(root, ".env"), secrets);
  await mergeEnvFile(path.join(root, ".env.local"), secrets);
  await mergeEnvFile(path.join(root, "artifacts", "private", "auth0.env"), secrets);
  takeFromRecord(process.env as Record<string, unknown>, secrets);
  return secrets;
}

export const LLM_SETTINGS_HREF = "/?view=integrations";

export type CallableLlmProvider = "Claude" | "OpenAI" | "Gemini";

export type LlmAssistAvailability = {
  enabled: boolean;
  provider: CallableLlmProvider | null;
  configured: LocalLlmProviderName[];
  settingsHref: string;
  message: string;
};

export function overlayLocalLlmSecrets(
  stored: StoredIntegrationsConfig,
  local: LocalLlmSecrets,
): StoredIntegrationsConfig {
  const openaiApiKey = stored.llm.openaiApiKey || local.openaiApiKey;
  const anthropicApiKey = stored.llm.anthropicApiKey || local.anthropicApiKey;
  const geminiApiKey = stored.llm.geminiApiKey || local.geminiApiKey;
  const cursorApiKey = stored.llm.cursorApiKey || local.cursorApiKey;
  const secrets: LocalLlmSecrets = { openaiApiKey, anthropicApiKey, geminiApiKey, cursorApiKey };
  const providers = filledLocalLlmProviders(secrets);
  const callable = selectPreferredLocalLlmProvider(secrets);
  const llmNotes = callable
    ? `On-device drafts via ${callable}. Label output machine-drafted. Numbers stay source-backed.`
    : providers.includes("Cursor")
      ? "A Cursor key is stored; completions need Claude, OpenAI, or Gemini. Paste one in Settings."
      : "Paste Claude, OpenAI, or Gemini in Settings. Empty key = LLM assist disabled, not fake analysis.";
  return {
    ...stored,
    pipelines: {
      ...stored.pipelines,
      llm: {
        ...stored.pipelines.llm,
        connected: providers.length > 0,
        status: callable ? "partial" : providers.length ? "not_configured" : stored.pipelines.llm.status,
        notes: llmNotes,
      },
    },
    llm: {
      ...stored.llm,
      openaiKeyConfigured: Boolean(openaiApiKey),
      anthropicKeyConfigured: Boolean(anthropicApiKey),
      geminiKeyConfigured: Boolean(geminiApiKey),
      cursorKeyConfigured: Boolean(cursorApiKey),
      ...(openaiApiKey ? { openaiApiKey } : {}),
      ...(anthropicApiKey ? { anthropicApiKey } : {}),
      ...(geminiApiKey ? { geminiApiKey } : {}),
      ...(cursorApiKey ? { cursorApiKey } : {}),
    },
  };
}

export function filledLocalLlmProviders(secrets: LocalLlmSecrets): LocalLlmProviderName[] {
  const names: LocalLlmProviderName[] = [];
  if (secrets.openaiApiKey) names.push("OpenAI");
  if (secrets.anthropicApiKey) names.push("Claude");
  if (secrets.geminiApiKey) names.push("Gemini");
  if (secrets.cursorApiKey) names.push("Cursor");
  return names;
}

/** Completions prefer Claude, then OpenAI, then Gemini. Cursor is stored only. */
export function selectPreferredLocalLlmProvider(secrets: LocalLlmSecrets): CallableLlmProvider | null {
  return callableProvidersInPreferenceOrder(secrets)[0] ?? null;
}

export function callableProvidersInPreferenceOrder(secrets: LocalLlmSecrets): CallableLlmProvider[] {
  const names: CallableLlmProvider[] = [];
  if (secrets.anthropicApiKey) names.push("Claude");
  if (secrets.openaiApiKey) names.push("OpenAI");
  if (secrets.geminiApiKey) names.push("Gemini");
  return names;
}

export function llmAssistAvailability(secrets: LocalLlmSecrets): LlmAssistAvailability {
  const configured = filledLocalLlmProviders(secrets);
  const provider = selectPreferredLocalLlmProvider(secrets);
  if (provider) {
    return {
      enabled: true,
      provider,
      configured,
      settingsHref: LLM_SETTINGS_HREF,
      message: `Machine-drafted via ${provider}. Numbers stay source-backed.`,
    };
  }
  if (configured.includes("Cursor")) {
    return {
      enabled: false,
      provider: null,
      configured,
      settingsHref: LLM_SETTINGS_HREF,
      message: "A Cursor key is stored, but completions use Claude, OpenAI, or Gemini. Paste one of those in Settings.",
    };
  }
  return {
    enabled: false,
    provider: null,
    configured,
    settingsHref: LLM_SETTINGS_HREF,
    message: "LLM assist is disabled. Paste a Claude, OpenAI, or Gemini key in Settings — empty keys never invent analysis.",
  };
}

export function isLoopbackRequest(request: Request): boolean {
  const hosts = [
    safeHostname(request.url),
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ];
  return hosts.some((host) => isLoopbackHost(host));
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isLoopbackHost(raw: string | null): boolean {
  if (!raw) return false;
  const host = raw.split(",")[0]?.trim().toLowerCase().replace(/^\[|\]$/g, "") ?? "";
  const hostname = host.split(":")[0] ?? "";
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}
