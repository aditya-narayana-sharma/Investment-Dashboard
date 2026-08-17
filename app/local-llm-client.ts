import {
  callableProvidersInPreferenceOrder,
  llmAssistAvailability,
  type CallableLlmProvider,
  type LocalLlmSecrets,
} from "./local-llm-secrets.ts";

export type LocalLlmCompleteOk = {
  ok: true;
  text: string;
  provider: CallableLlmProvider;
};

export type LlmProviderAttempt = {
  provider: CallableLlmProvider;
  model: string;
  status: number | null;
  errorType: string | null;
};

export type LocalLlmCompleteErr = {
  ok: false;
  disabled: boolean;
  message: string;
  provider: CallableLlmProvider | null;
  status?: number | null;
  errorType?: string | null;
  attempts?: LlmProviderAttempt[];
};

export type LocalLlmCompleteResult = LocalLlmCompleteOk | LocalLlmCompleteErr;

const ANTHROPIC_MODELS = ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-sonnet-4-20250514"] as const;
const OPENAI_MODELS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] as const;
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"] as const;
const UNCHANGED = "Existing non-LLM digest, scores, and trees are unchanged.";
const DEFAULT_RETRY_DELAYS_MS = [400, 800];

class LlmProviderHttpError extends Error {
  readonly provider: CallableLlmProvider;
  readonly model: string;
  readonly status: number | null;
  readonly errorType: string;

  constructor(options: {
    provider: CallableLlmProvider;
    model: string;
    status: number | null;
    errorType: string;
  }) {
    super(`${options.provider} HTTP ${options.status ?? "network"} ${options.errorType}`);
    this.name = "LlmProviderHttpError";
    this.provider = options.provider;
    this.model = options.model;
    this.status = options.status;
    this.errorType = options.errorType;
  }
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeErrorType(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
  return cleaned || "provider_error";
}

function providerErrorType(payload: unknown, fallback: string): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const err = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : {};
  const raw = asText(err.code) || asText(err.type) || asText(err.status) || asText(record.status) || fallback;
  return sanitizeErrorType(raw);
}

function anthropicText(payload: unknown): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const content = Array.isArray(record.content) ? record.content : [];
  const parts = content.map((item) => {
    if (!item || typeof item !== "object") return "";
    const block = item as Record<string, unknown>;
    return asText(block.text);
  }).filter(Boolean);
  return parts.join("\n").trim();
}

function openaiText(payload: unknown): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : {};
  const message = first.message && typeof first.message === "object" ? first.message as Record<string, unknown> : {};
  return asText(message.content).trim();
}

function geminiText(payload: unknown): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];
  const first = candidates[0] && typeof candidates[0] === "object" ? candidates[0] as Record<string, unknown> : {};
  const content = first.content && typeof first.content === "object" ? first.content as Record<string, unknown> : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  return parts.map((part) => {
    if (!part || typeof part !== "object") return "";
    return asText((part as Record<string, unknown>).text);
  }).join("\n").trim();
}

function isAuthFailure(error: LlmProviderHttpError): boolean {
  if (error.status === 401) return true;
  return error.errorType === "authentication_error" || error.errorType === "invalid_api_key" || error.errorType === "unauthorized";
}

function isMissingModel(error: LlmProviderHttpError): boolean {
  if (error.errorType === "model_not_found" || error.errorType === "not_found_error" || error.errorType === "not_found") return true;
  if (error.status === 404) return true;
  return error.status === 403 && !isAuthFailure(error);
}

function isRetryable(error: LlmProviderHttpError): boolean {
  if (error.errorType === "timeout" || error.errorType === "network") return true;
  if (error.status === 429) return true;
  return error.status != null && error.status >= 500;
}

function logLlmFailure(details: Record<string, unknown>): void {
  console.warn("[llm-complete]", details);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatLlmFailureMessage(attempts: LlmProviderAttempt[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const attempt of attempts) {
    const status = attempt.status == null ? "network" : `HTTP ${attempt.status}`;
    const part = `${attempt.provider} ${status} ${attempt.errorType ?? "provider_error"}`.trim();
    if (seen.has(part)) continue;
    seen.add(part);
    unique.push(part);
  }
  const detail = unique.length ? ` (${unique.join("; ")})` : "";
  return `LLM call failed${detail}. ${UNCHANGED}`;
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  meta: { provider: CallableLlmProvider; model: string },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : "";
    throw new LlmProviderHttpError({
      provider: meta.provider,
      model: meta.model,
      status: null,
      errorType: name === "TimeoutError" ? "timeout" : "network",
    });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LlmProviderHttpError({
      provider: meta.provider,
      model: meta.model,
      status: response.status,
      errorType: providerErrorType(payload, `http_${response.status}`),
    });
  }
  return payload;
}

async function postJsonWithRetries(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  retryDelaysMs: number[],
  meta: { provider: CallableLlmProvider; model: string },
): Promise<unknown> {
  let lastError: LlmProviderHttpError | null = null;
  const tries = retryDelaysMs.length + 1;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await postJson(fetchImpl, url, headers, body, timeoutMs, meta);
    } catch (cause) {
      if (!(cause instanceof LlmProviderHttpError) || !isRetryable(cause)) throw cause;
      lastError = cause;
      const delayMs = retryDelaysMs[attempt];
      if (delayMs == null) break;
      logLlmFailure({
        provider: meta.provider,
        model: meta.model,
        status: cause.status,
        errorType: cause.errorType,
        retry: attempt + 1,
        retriesLeft: retryDelaysMs.length - attempt - 1,
      });
      if (delayMs > 0) await sleep(delayMs);
    }
  }
  throw lastError ?? new LlmProviderHttpError({ ...meta, status: null, errorType: "provider_error" });
}

type ProviderCall = {
  models: readonly string[];
  request: (model: string) => { url: string; headers: Record<string, string>; body: unknown };
  readText: (payload: unknown) => string;
};

function providerCall(provider: CallableLlmProvider, secrets: LocalLlmSecrets, prompt: string, system: string): ProviderCall {
  switch (provider) {
    case "Claude":
      return {
        models: ANTHROPIC_MODELS,
        request: (model) => ({
          url: "https://api.anthropic.com/v1/messages",
          headers: {
            "content-type": "application/json",
            "x-api-key": secrets.anthropicApiKey ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: {
            model,
            max_tokens: 1200,
            system,
            messages: [{ role: "user", content: prompt }],
          },
        }),
        readText: anthropicText,
      };
    case "OpenAI":
      return {
        models: OPENAI_MODELS,
        request: (model) => ({
          url: "https://api.openai.com/v1/chat/completions",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${secrets.openaiApiKey ?? ""}`,
          },
          body: {
            model,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          },
        }),
        readText: openaiText,
      };
    case "Gemini":
      return {
        models: GEMINI_MODELS,
        request: (model) => ({
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(secrets.geminiApiKey ?? "")}`,
          headers: { "content-type": "application/json" },
          body: {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          },
        }),
        readText: geminiText,
      };
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

async function completeWithProvider(options: {
  provider: CallableLlmProvider;
  prompt: string;
  system: string;
  secrets: LocalLlmSecrets;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  retryDelaysMs: number[];
  attempts: LlmProviderAttempt[];
}): Promise<string> {
  const { provider, prompt, system, secrets, fetchImpl, timeoutMs, retryDelaysMs, attempts } = options;
  const call = providerCall(provider, secrets, prompt, system);
  let lastError: LlmProviderHttpError | null = null;
  for (const model of call.models) {
    const request = call.request(model);
    try {
      const payload = await postJsonWithRetries(
        fetchImpl,
        request.url,
        request.headers,
        request.body,
        timeoutMs,
        retryDelaysMs,
        { provider, model },
      );
      return call.readText(payload);
    } catch (cause) {
      if (!(cause instanceof LlmProviderHttpError)) throw cause;
      lastError = cause;
      attempts.push({ provider, model, status: cause.status, errorType: cause.errorType });
      logLlmFailure({ provider, model, status: cause.status, errorType: cause.errorType });
      if (isAuthFailure(cause) || !isMissingModel(cause)) throw cause;
    }
  }
  throw lastError ?? new LlmProviderHttpError({ provider, model: call.models[0] ?? "", status: null, errorType: "provider_error" });
}

export async function completeLocalLlm(options: {
  prompt: string;
  system?: string;
  secrets: LocalLlmSecrets;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelaysMs?: number[];
}): Promise<LocalLlmCompleteResult> {
  const availability = llmAssistAvailability(options.secrets);
  const providers = callableProvidersInPreferenceOrder(options.secrets);
  if (!providers.length || !availability.enabled) {
    return {
      ok: false,
      disabled: true,
      provider: null,
      message: availability.message,
    };
  }
  const prompt = options.prompt.trim();
  if (!prompt) {
    return { ok: false, disabled: false, provider: providers[0] ?? null, message: "Write a prompt first." };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const system = options.system?.trim() || "You are a careful on-device research assistant. Never invent missing source data.";
  const attempts: LlmProviderAttempt[] = [];
  for (const provider of providers) {
    try {
      const text = await completeWithProvider({
        provider,
        prompt,
        system,
        secrets: options.secrets,
        fetchImpl,
        timeoutMs,
        retryDelaysMs,
        attempts,
      });
      if (!text) {
        attempts.push({ provider, model: "", status: 200, errorType: "empty_draft" });
        continue;
      }
      if (attempts.length) {
        logLlmFailure({ ok: true, provider, fallbackAfter: attempts });
      }
      return { ok: true, text, provider };
    } catch (cause) {
      if (cause instanceof LlmProviderHttpError) {
        if (!attempts.some((attempt) => attempt.provider === cause.provider && attempt.model === cause.model && attempt.status === cause.status)) {
          attempts.push({ provider: cause.provider, model: cause.model, status: cause.status, errorType: cause.errorType });
        }
        continue;
      }
      logLlmFailure({ provider, status: null, errorType: "unexpected" });
      attempts.push({ provider, model: "", status: null, errorType: "unexpected" });
    }
  }
  const last = attempts.at(-1);
  logLlmFailure({ ok: false, provider: last?.provider ?? providers[0] ?? null, status: last?.status ?? null, errorType: last?.errorType ?? "provider_error", attempts });
  return {
    ok: false,
    disabled: false,
    provider: last?.provider ?? providers[0] ?? null,
    status: last?.status ?? null,
    errorType: last?.errorType ?? "provider_error",
    attempts,
    message: formatLlmFailureMessage(attempts),
  };
}
