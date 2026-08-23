import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { StoredIntegrationsConfig } from "./integrations-types";

export type LocalLlmSecrets = {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  cursorApiKey?: string;
  ollamaModel?: string;
  ollamaUrl?: string;
};

export type LocalLlmProviderName = "OpenAI" | "Claude" | "Gemini" | "Cursor" | "Ollama";

const ENV_ALIASES: Record<keyof Pick<LocalLlmSecrets, "openaiApiKey" | "anthropicApiKey" | "geminiApiKey" | "cursorApiKey">, readonly string[]> = {
  openaiApiKey: ["OPENAI_API_KEY", "OPENAI_KEY"],
  anthropicApiKey: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY"],
  geminiApiKey: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_GEMINI_API_KEY"],
  cursorApiKey: ["CURSOR_API_KEY", "CURSOR_API_TOKEN"],
};

const OLLAMA_MODEL_KEYS = ["OLLAMA_MODEL", "LOCAL_LLM_MODEL", "PODCAST_SUMMARIZER_MODEL", "ollamaModel"] as const;
const OLLAMA_URL_KEYS = ["OLLAMA_HOST", "OLLAMA_URL", "PODCAST_SUMMARIZER_URL", "ollamaUrl"] as const;

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

function usableOllamaValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length < 2) return undefined;
  if (/^(your[-_]?|changeme|placeholder|xxx+|todo|replace)/i.test(trimmed)) return undefined;
  return trimmed;
}

function takeOllama(record: Record<string, unknown>, into: LocalLlmSecrets): void {
  if (!into.ollamaModel) {
    for (const key of OLLAMA_MODEL_KEYS) {
      const model = usableOllamaValue(record[key]);
      if (model) {
        into.ollamaModel = model;
        break;
      }
    }
  }
  if (!into.ollamaUrl) {
    for (const key of OLLAMA_URL_KEYS) {
      const url = usableOllamaValue(record[key]);
      if (url) {
        into.ollamaUrl = url;
        break;
      }
    }
  }
}

function takeFromRecord(record: Record<string, unknown>, into: LocalLlmSecrets): void {
  for (const field of Object.keys(ENV_ALIASES) as Array<keyof typeof ENV_ALIASES>) {
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
  takeOllama(record, into);
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

export type CallableLlmProvider = "Claude" | "OpenAI" | "Gemini" | "Ollama";

/** Process-level skip: provider → hash of key last-4. Never log the key or last-4. */
const skippedAuthProviders = new Map<CallableLlmProvider, string>();
/** Process-level skip: `provider\tmodel` → hash of that provider's key last-4. */
const skippedModels = new Map<string, string>();

function providerSecretValue(secrets: LocalLlmSecrets, provider: CallableLlmProvider): string | undefined {
  switch (provider) {
    case "Claude":
      return secrets.anthropicApiKey;
    case "OpenAI":
      return secrets.openaiApiKey;
    case "Gemini":
      return secrets.geminiApiKey;
    case "Ollama":
      return [secrets.ollamaUrl, secrets.ollamaModel].filter(Boolean).join("|") || undefined;
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

/** Hash of the last 4 characters of a secret. Never log `value` or the last-4 slice. */
function secretFingerprint(value: string | undefined): string {
  const last4 = (value ?? "").trim().slice(-4);
  return createHash("sha256").update(last4).digest("hex").slice(0, 16);
}

function modelSkipKey(provider: CallableLlmProvider, model: string): string {
  return `${provider}\t${model.trim()}`;
}

export function rememberLlmAuthFailure(provider: CallableLlmProvider, secrets: LocalLlmSecrets): void {
  skippedAuthProviders.set(provider, secretFingerprint(providerSecretValue(secrets, provider)));
}

export function rememberLlmMissingModel(
  provider: CallableLlmProvider,
  model: string,
  secrets: LocalLlmSecrets,
): void {
  const id = model.trim();
  if (!id) return;
  skippedModels.set(modelSkipKey(provider, id), secretFingerprint(providerSecretValue(secrets, provider)));
}

export function isLlmProviderCircuitBroken(provider: CallableLlmProvider, secrets: LocalLlmSecrets): boolean {
  const stored = skippedAuthProviders.get(provider);
  if (!stored) return false;
  const current = secretFingerprint(providerSecretValue(secrets, provider));
  if (stored !== current) {
    skippedAuthProviders.delete(provider);
    return false;
  }
  return true;
}

export function isLlmModelCircuitBroken(
  provider: CallableLlmProvider,
  model: string,
  secrets: LocalLlmSecrets,
): boolean {
  const id = model.trim();
  if (!id) return false;
  const key = modelSkipKey(provider, id);
  const stored = skippedModels.get(key);
  if (!stored) return false;
  const current = secretFingerprint(providerSecretValue(secrets, provider));
  if (stored !== current) {
    skippedModels.delete(key);
    return false;
  }
  return true;
}

export function resetLlmCircuitBreaks(): void {
  skippedAuthProviders.clear();
  skippedModels.clear();
}

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
  if (secrets.ollamaModel) names.push("Ollama");
  return names;
}

/** Completions prefer Claude, then OpenAI, then Gemini, then on-device Ollama. Cursor is stored only. */
export function selectPreferredLocalLlmProvider(secrets: LocalLlmSecrets): CallableLlmProvider | null {
  return liveCallableProvidersInPreferenceOrder(secrets)[0] ?? null;
}

export function callableProvidersInPreferenceOrder(secrets: LocalLlmSecrets): CallableLlmProvider[] {
  const names: CallableLlmProvider[] = [];
  if (secrets.anthropicApiKey) names.push("Claude");
  if (secrets.openaiApiKey) names.push("OpenAI");
  if (secrets.geminiApiKey) names.push("Gemini");
  if (secrets.ollamaModel) names.push("Ollama");
  return names;
}

/** Configured callable providers that are not auth-circuit-broken for the current key fingerprint. */
export function liveCallableProvidersInPreferenceOrder(secrets: LocalLlmSecrets): CallableLlmProvider[] {
  return callableProvidersInPreferenceOrder(secrets).filter(
    (provider) => !isLlmProviderCircuitBroken(provider, secrets),
  );
}

/** Cloud providers first; on-device Ollama is always last so unauthorized/stale cloud keys cannot block Satya. */
export function completionProvidersInPreferenceOrder(secrets: LocalLlmSecrets): CallableLlmProvider[] {
  const names = callableProvidersInPreferenceOrder(secrets)
    .filter((provider) => provider !== "Ollama")
    .filter((provider) => !isLlmProviderCircuitBroken(provider, secrets));
  if (!isLlmProviderCircuitBroken("Ollama", secrets)) names.push("Ollama");
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
  const cloudConfigured = configured.some((name) => name === "OpenAI" || name === "Claude" || name === "Gemini");
  const cursorOnly = configured.includes("Cursor") && !cloudConfigured && !configured.includes("Ollama");
  if (cursorOnly) {
    return {
      enabled: false,
      provider: null,
      configured,
      settingsHref: LLM_SETTINGS_HREF,
      message: "A Cursor key is stored, but completions use Claude, OpenAI, Gemini, or on-device Ollama. Paste a cloud key or set OLLAMA_MODEL.",
    };
  }
  if (cloudConfigured) {
    return {
      enabled: true,
      provider: null,
      configured,
      settingsHref: LLM_SETTINGS_HREF,
      message: "Cloud keys are stored but not callable. Satya will try on-device Ollama if it is running. Numbers stay source-backed.",
    };
  }
  return {
    enabled: false,
    provider: null,
    configured,
    settingsHref: LLM_SETTINGS_HREF,
    message: "LLM assist is disabled. Paste a Claude, OpenAI, or Gemini key in Settings, or set OLLAMA_MODEL — empty keys never invent analysis.",
  };
}

export const STRATJI_LOCAL_OPERATOR_HEADER = "x-stratji-local-operator";

/**
 * True only for the author Mac talking to Next.
 *
 * Flask sets X-Stratji-Local-Operator from TCP remote_addr (never from Host).
 * A Flask hop without that header is not an operator even if Host is 127.0.0.1.
 * Direct Next on localhost (no X-Forwarded-For) remains operator for local `next start`.
 */
export function isLocalOperatorRequest(request: Request): boolean {
  const forwarded = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() ?? "";
  const operator = request.headers.get(STRATJI_LOCAL_OPERATOR_HEADER) === "1";
  if (operator) {
    return !forwarded || isLoopbackHost(forwarded);
  }
  if (forwarded) return false;
  return isLoopbackHost(request.headers.get("host")) || isLoopbackHost(safeHostname(request.url));
}

/** @deprecated Use isLocalOperatorRequest. Host-OR loopback is not a secret gate. */
export function isLoopbackRequest(request: Request): boolean {
  return isLocalOperatorRequest(request);
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
