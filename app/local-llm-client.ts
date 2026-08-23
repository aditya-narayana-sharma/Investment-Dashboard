import {
  completionProvidersInPreferenceOrder,
  isLlmModelCircuitBroken,
  llmAssistAvailability,
  rememberLlmAuthFailure,
  rememberLlmMissingModel,
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

function ollamaText(payload: unknown): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const message = record.message && typeof record.message === "object" ? record.message as Record<string, unknown> : {};
  return asText(message.content).trim() || asText(record.response).trim();
}

function ollamaStreamDelta(payload: unknown): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const message = record.message && typeof record.message === "object" ? record.message as Record<string, unknown> : {};
  return asText(message.content) || asText(record.response);
}

function ollamaOrigin(secrets: LocalLlmSecrets): string {
  const raw = secrets.ollamaUrl?.trim() || "http://127.0.0.1:11434";
  try {
    const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      return "http://127.0.0.1:11434";
    }
    return url.origin;
  } catch {
    return "http://127.0.0.1:11434";
  }
}

const PREFERRED_OLLAMA_MODELS = ["qwen2.5:7b-instruct", "qwen2.5", "llama3.1", "llama3.2", "mistral"] as const;

function rankOllamaModels(names: string[], preferred?: string): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    unique.push(trimmed);
  };
  if (preferred?.trim()) push(preferred.trim());
  for (const needle of PREFERRED_OLLAMA_MODELS) {
    for (const name of names) {
      if (name === needle || name.startsWith(`${needle}:`) || name.startsWith(`${needle}-`)) push(name);
    }
  }
  for (const name of names) push(name);
  return unique;
}

async function resolveOllamaModels(options: {
  secrets: LocalLlmSecrets;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<string[]> {
  const named = options.secrets.ollamaModel?.trim();
  const origin = ollamaOrigin(options.secrets);
  try {
    const response = await options.fetchImpl(`${origin}/api/tags`, {
      method: "GET",
      signal: combinedAbortSignal(Math.min(options.timeoutMs, 5_000), options.signal),
    });
    if (!response.ok) {
      if (named) return [named];
      return [];
    }
    const payload = await response.json().catch(() => null);
    const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const models = Array.isArray(record.models) ? record.models : [];
    const names = models.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const name = asText((item as Record<string, unknown>).name).trim();
      return name ? [name] : [];
    });
    const ranked = rankOllamaModels(names, named).filter(
      (model) => !isLlmModelCircuitBroken("Ollama", model, options.secrets),
    );
    if (ranked.length) return ranked;
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
  }
  if (named && !isLlmModelCircuitBroken("Ollama", named, options.secrets)) return [named];
  return [];
}

/** Localhost `/api/tags` probe for Satya status. Never returns URLs or secrets. */
export async function probeOllamaReachable(
  secrets: LocalLlmSecrets,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 1_500,
): Promise<boolean> {
  const origin = ollamaOrigin(secrets);
  try {
    const response = await fetchImpl(`${origin}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
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

function isContextOverflow(error: LlmProviderHttpError): boolean {
  if (error.errorType === "context_length_exceeded" || error.errorType === "request_too_large") return true;
  return error.status === 413;
}

/** Auth and context-window failures skip the rest of that provider; missing-model tries the next id. */
function shouldSkipProvider(error: LlmProviderHttpError): boolean {
  return isAuthFailure(error) || isContextOverflow(error) || !isMissingModel(error);
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

function failedLlmLayer(attempts: LlmProviderAttempt[]): string {
  const hasOllama = attempts.some((attempt) => attempt.provider === "Ollama");
  const hasCloud = attempts.some((attempt) => attempt.provider !== "Ollama");
  if (hasCloud && hasOllama) return "cloud LLM skipped; on-device LLM unavailable";
  if (hasOllama) return "on-device LLM unavailable";
  if (hasCloud) return "cloud LLM skipped";
  return "LLM unavailable";
}

/** Operator-safe Satya/status copy — never dump multi-provider HTTP bodies as the answer. */
export function formatSatyaLlmOperatorMessage(attempts: LlmProviderAttempt[]): string {
  return `Satya could not draft (${failedLlmLayer(attempts)}). Mail, Axis PDFs, podcasts, and verified earnings remain the source of truth.`;
}

function combinedAbortSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([timeout, external]);
  return timeout;
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function rememberProviderFailure(error: LlmProviderHttpError, secrets: LocalLlmSecrets): void {
  if (isAuthFailure(error)) rememberLlmAuthFailure(error.provider, secrets);
  if (isMissingModel(error)) rememberLlmMissingModel(error.provider, error.model, secrets);
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  meta: { provider: CallableLlmProvider; model: string },
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: combinedAbortSignal(timeoutMs, signal),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
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
  signal?: AbortSignal,
): Promise<unknown> {
  let lastError: LlmProviderHttpError | null = null;
  const tries = retryDelaysMs.length + 1;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await postJson(fetchImpl, url, headers, body, timeoutMs, meta, signal);
    } catch (cause) {
      if (signal?.aborted) throw cause;
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

function providerCall(
  provider: CallableLlmProvider,
  secrets: LocalLlmSecrets,
  prompt: string,
  system: string,
  maxTokens?: number,
): ProviderCall {
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
            max_tokens: maxTokens ?? 1200,
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
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
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
            generationConfig: {
              temperature: 0.2,
              ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
            },
          },
        }),
        readText: geminiText,
      };
    case "Ollama":
      return {
        models: secrets.ollamaModel ? [secrets.ollamaModel] : ["qwen2.5:7b-instruct"],
        request: (model) => ({
          url: `${ollamaOrigin(secrets)}/api/chat`,
          headers: { "content-type": "application/json" },
          body: {
            model,
            stream: false,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
            options: {
              temperature: 0.2,
              ...(maxTokens ? { num_predict: Math.min(maxTokens, 4096) } : { num_predict: 2048 }),
            },
          },
        }),
        readText: ollamaText,
      };
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

async function consumeOllamaNdjsonLine(
  line: string,
  onToken: (text: string) => void,
): Promise<{ delta: string; parsed: unknown | null }> {
  const trimmed = line.trim();
  if (!trimmed) return { delta: "", parsed: null };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const delta = ollamaStreamDelta(parsed);
    if (delta) onToken(delta);
    return { delta, parsed };
  } catch {
    return { delta: "", parsed: null };
  }
}

async function readOllamaNdjsonStream(
  response: Response,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  const reader = response.body?.getReader();
  if (!reader) {
    const payload = await response.json().catch(() => null);
    const text = ollamaText(payload);
    if (text) onToken(text);
    return text;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const { delta } = await consumeOllamaNdjsonLine(line, onToken);
        full += delta;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const { delta, parsed } = await consumeOllamaNdjsonLine(buffer, onToken);
      if (delta) {
        full += delta;
      } else if (!full && parsed) {
        const text = ollamaText(parsed);
        if (text) {
          onToken(text);
          full = text;
        }
      }
    }
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  }
  return full;
}

async function streamOllamaRequest(options: {
  fetchImpl: typeof fetch;
  url: string;
  body: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
  model: string;
  onToken: (text: string) => void;
}): Promise<string> {
  let response: Response;
  try {
    response = await options.fetchImpl(options.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(options.body),
      signal: combinedAbortSignal(options.timeoutMs, options.signal),
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    const name = cause instanceof Error ? cause.name : "";
    throw new LlmProviderHttpError({
      provider: "Ollama",
      model: options.model,
      status: null,
      errorType: name === "TimeoutError" ? "timeout" : name === "AbortError" ? "aborted" : "network",
    });
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new LlmProviderHttpError({
      provider: "Ollama",
      model: options.model,
      status: response.status,
      errorType: providerErrorType(payload, `http_${response.status}`),
    });
  }
  return readOllamaNdjsonStream(response, options.onToken, options.signal);
}

function ollamaStreamBodies(
  model: string,
  prompt: string,
  system: string,
  maxTokens?: number,
): { chat: unknown; generate: unknown } {
  const options = {
    temperature: 0.2,
    ...(maxTokens ? { num_predict: Math.min(maxTokens, 4096) } : { num_predict: 2048 }),
  };
  return {
    chat: {
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      options,
    },
    generate: {
      model,
      stream: true,
      system,
      prompt,
      options,
    },
  };
}

async function streamOllamaWithProvider(options: {
  prompt: string;
  system: string;
  secrets: LocalLlmSecrets;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  attempts: LlmProviderAttempt[];
  signal?: AbortSignal;
  maxTokens?: number;
  onToken: (text: string) => void;
}): Promise<string> {
  const { prompt, system, secrets, fetchImpl, timeoutMs, attempts, signal, maxTokens, onToken } = options;
  const origin = ollamaOrigin(secrets);
  const models = await resolveOllamaModels({ secrets, fetchImpl, timeoutMs, signal });
  if (!models.length) {
    attempts.push({ provider: "Ollama", model: secrets.ollamaModel ?? "ollama", status: null, errorType: "unavailable" });
    throw new LlmProviderHttpError({
      provider: "Ollama",
      model: secrets.ollamaModel ?? "ollama",
      status: null,
      errorType: "unavailable",
    });
  }
  let lastError: LlmProviderHttpError | null = null;
  for (const model of models) {
    const bodies = ollamaStreamBodies(model, prompt, system, maxTokens);
    try {
      try {
        return await streamOllamaRequest({
          fetchImpl,
          url: `${origin}/api/chat`,
          body: bodies.chat,
          timeoutMs,
          signal,
          model,
          onToken,
        });
      } catch (cause) {
        if (signal?.aborted) throw cause;
        if (!(cause instanceof LlmProviderHttpError)) throw cause;
        if (cause.status !== 404 && cause.status !== 405) throw cause;
        return await streamOllamaRequest({
          fetchImpl,
          url: `${origin}/api/generate`,
          body: bodies.generate,
          timeoutMs,
          signal,
          model,
          onToken,
        });
      }
    } catch (cause) {
      if (!(cause instanceof LlmProviderHttpError)) throw cause;
      lastError = cause;
      attempts.push({ provider: "Ollama", model, status: cause.status, errorType: cause.errorType });
      logLlmFailure({ provider: "Ollama", model, status: cause.status, errorType: cause.errorType });
      rememberProviderFailure(cause, secrets);
      if (shouldSkipProvider(cause)) throw cause;
    }
  }
  throw lastError ?? new LlmProviderHttpError({
    provider: "Ollama",
    model: models[0] ?? secrets.ollamaModel ?? "ollama",
    status: null,
    errorType: "provider_error",
  });
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
  signal?: AbortSignal;
  maxTokens?: number;
}): Promise<string> {
  const { provider, prompt, system, secrets, fetchImpl, timeoutMs, retryDelaysMs, attempts, signal, maxTokens } = options;
  const call = providerCall(provider, secrets, prompt, system, maxTokens);
  let models = [...call.models].filter((model) => !isLlmModelCircuitBroken(provider, model, secrets));
  if (provider === "Ollama") {
    models = await resolveOllamaModels({ secrets, fetchImpl, timeoutMs, signal });
    if (!models.length) {
      attempts.push({ provider, model: secrets.ollamaModel ?? "ollama", status: null, errorType: "unavailable" });
      throw new LlmProviderHttpError({
        provider,
        model: secrets.ollamaModel ?? "ollama",
        status: null,
        errorType: "unavailable",
      });
    }
  }
  if (!models.length) {
    attempts.push({ provider, model: call.models[0] ?? "", status: null, errorType: "no_callable_model" });
    throw new LlmProviderHttpError({
      provider,
      model: call.models[0] ?? "",
      status: null,
      errorType: "no_callable_model",
    });
  }
  let lastError: LlmProviderHttpError | null = null;
  for (const model of models) {
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
        signal,
      );
      return call.readText(payload);
    } catch (cause) {
      if (!(cause instanceof LlmProviderHttpError)) throw cause;
      lastError = cause;
      attempts.push({ provider, model, status: cause.status, errorType: cause.errorType });
      logLlmFailure({ provider, model, status: cause.status, errorType: cause.errorType });
      rememberProviderFailure(cause, secrets);
      if (shouldSkipProvider(cause)) throw cause;
    }
  }
  throw lastError ?? new LlmProviderHttpError({ provider, model: models[0] ?? call.models[0] ?? "", status: null, errorType: "provider_error" });
}

export async function completeLocalLlm(options: {
  prompt: string;
  system?: string;
  secrets: LocalLlmSecrets;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  signal?: AbortSignal;
  maxTokens?: number;
}): Promise<LocalLlmCompleteResult> {
  return runLocalLlmCascade({ ...options, stream: false });
}

type LocalLlmCascadeOptions = {
  prompt: string;
  system?: string;
  secrets: LocalLlmSecrets;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  signal?: AbortSignal;
  maxTokens?: number;
  stream: boolean;
  onToken?: (text: string) => void;
};

async function runLocalLlmCascade(options: LocalLlmCascadeOptions): Promise<LocalLlmCompleteResult> {
  const availability = llmAssistAvailability(options.secrets);
  const providers = completionProvidersInPreferenceOrder(options.secrets);
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
  const emit = options.onToken;
  for (const provider of providers) {
    try {
      let streamed = false;
      let text: string;
      if (options.stream && provider === "Ollama" && emit) {
        text = await streamOllamaWithProvider({
          prompt,
          system,
          secrets: options.secrets,
          fetchImpl,
          timeoutMs,
          attempts,
          signal: options.signal,
          maxTokens: options.maxTokens,
          onToken: emit,
        });
        streamed = true;
      } else {
        text = await completeWithProvider({
          provider,
          prompt,
          system,
          secrets: options.secrets,
          fetchImpl,
          timeoutMs,
          retryDelaysMs,
          attempts,
          signal: options.signal,
          maxTokens: options.maxTokens,
        });
      }
      if (!text) {
        attempts.push({ provider, model: "", status: 200, errorType: "empty_draft" });
        continue;
      }
      if (attempts.length) {
        logLlmFailure({ ok: true, provider, fallbackAfter: attempts });
      }
      if (options.stream && emit && !streamed) {
        for (const chunk of chunkTextForSse(text)) emit(chunk);
      }
      return { ok: true, text, provider };
    } catch (cause) {
      if (options.signal?.aborted) {
        return { ok: false, disabled: false, provider: null, message: "Satya chat cancelled." };
      }
      if (cause instanceof LlmProviderHttpError) {
        rememberProviderFailure(cause, options.secrets);
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
  logLlmFailure({ ok: false, provider: last?.provider ?? providers[0] ?? null, status: last?.status ?? null, errorType: last?.errorType ?? "provider_error", attempts, detail: formatLlmFailureMessage(attempts) });
  return {
    ok: false,
    disabled: false,
    provider: last?.provider ?? providers[0] ?? null,
    status: last?.status ?? null,
    errorType: last?.errorType ?? "provider_error",
    attempts,
    message: formatSatyaLlmOperatorMessage(attempts),
  };
}

/** Split completed text so SSE clients can paint incrementally after the provider returns. */
export function chunkTextForSse(text: string, size = 48): string[] {
  const value = text.trim() ? text : "";
  if (!value) return [];
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

/**
 * Streams tokens as they arrive. Ollama uses NDJSON `/api/chat` (or `/api/generate`).
 * Cloud providers complete, then emit `chunkTextForSse` slices.
 */
export async function streamLocalLlm(options: {
  prompt: string;
  system?: string;
  secrets: LocalLlmSecrets;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  signal?: AbortSignal;
  maxTokens?: number;
  onToken?: (text: string) => void;
}): Promise<LocalLlmCompleteResult> {
  return runLocalLlmCascade({ ...options, stream: true });
}
