import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { beforeEach } from "node:test";
import { llmAssistSystemPrompt, parseTreeFromLlmText } from "../app/local-llm-assist.ts";
import { completeLocalLlm, formatLlmFailureMessage, formatSatyaLlmOperatorMessage, streamLocalLlm } from "../app/local-llm-client.ts";
import {
  callableProvidersInPreferenceOrder,
  completionProvidersInPreferenceOrder,
  llmAssistAvailability,
  overlayLocalLlmSecrets,
  readLocalLlmSecrets,
  resetLlmCircuitBreaks,
  selectPreferredLocalLlmProvider,
} from "../app/local-llm-secrets.ts";
import { defaultIntegrationsConfig, sanitizeStoredIntegrationsConfig } from "../app/integrations-types.ts";
import { configuredPodcastSummarizer } from "../scripts/podcast-summarizer.mjs";

beforeEach(() => {
  resetLlmCircuitBreaks();
});

test("empty keys disable LLM assist", () => {
  const availability = llmAssistAvailability({});
  assert.equal(availability.enabled, false);
  assert.equal(availability.provider, null);
  assert.equal(selectPreferredLocalLlmProvider({}), null);
  assert.match(availability.message, /disabled/i);
  assert.equal(availability.settingsHref, "/?view=integrations");
});

test("cursor-only keys stay stored but do not enable completions", () => {
  const availability = llmAssistAvailability({ cursorApiKey: "cursor-test-key-value" });
  assert.equal(availability.enabled, false);
  assert.deepEqual(availability.configured, ["Cursor"]);
  assert.match(availability.message, /Claude, OpenAI, Gemini, or on-device Ollama/);
});

test("configured key is read from gitignored config without using process env", async () => {
  const root = await mkdtemp(join(tmpdir(), "stratji-llm-config-"));
  const home = await mkdtemp(join(tmpdir(), "stratji-llm-home-"));
  await mkdir(join(root, "artifacts", "private"), { recursive: true });
  await writeFile(join(root, "artifacts", "private", "integrations-config.json"), `${JSON.stringify({
    llm: { anthropicApiKey: "sk-ant-test-local-key-value" },
  })}\n`);
  const secrets = await readLocalLlmSecrets(root, home);
  assert.equal(secrets.anthropicApiKey, "sk-ant-test-local-key-value");
  assert.equal(secrets.openaiApiKey, undefined);
  assert.equal(selectPreferredLocalLlmProvider(secrets), "Claude");
  assert.equal(llmAssistAvailability(secrets).enabled, true);
  const filled = overlayLocalLlmSecrets(sanitizeStoredIntegrationsConfig(defaultIntegrationsConfig()), secrets);
  assert.equal(filled.llm.anthropicKeyConfigured, true);
  assert.equal(filled.pipelines.llm.status, "partial");
  assert.equal("anthropicApiKey" in filled.llm, true);
});

test("completeLocalLlm fails closed when no callable key exists", async () => {
  const result = await completeLocalLlm({ prompt: "summarize this", secrets: {} });
  assert.equal(result.ok, false);
  assert.equal(result.disabled, true);
});

test("empty keys stay disabled and the complete route maps that to HTTP 409", async () => {
  const result = await completeLocalLlm({ prompt: "summarize this", secrets: {} });
  assert.equal(result.ok, false);
  assert.equal(result.disabled, true);
  assert.match(result.message, /disabled/i);
  const route = await readFile(new URL("../app/api/llm/complete/route.ts", import.meta.url), "utf8");
  assert.match(route, /status: 409/);
  assert.match(route, /completed\.disabled \? 409 : 502/);
});

test("completeLocalLlm prefers Claude and uses the injected fetch", async () => {
  const result = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: {
      anthropicApiKey: "sk-ant-test-local-key-value",
      openaiApiKey: "sk-test-openai-local-key",
    },
    fetchImpl: async () => new Response(JSON.stringify({
      content: [{ type: "text", text: "Machine-drafted bullet from supplied evidence only." }],
    }), { status: 200 }),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.provider, "Claude");
    assert.match(result.text, /Machine-drafted bullet/);
  }
});

test("completeLocalLlm falls back from Claude HTTP 401 to OpenAI without using process env keys", async () => {
  const hosts = [];
  const result = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: {
      anthropicApiKey: "sk-ant-test-local-key-value",
      openaiApiKey: "sk-test-openai-local-key",
    },
    fetchImpl: async (url) => {
      const host = new URL(String(url)).host;
      hosts.push(host);
      if (host === "api.anthropic.com") {
        return new Response(JSON.stringify({ error: { type: "authentication_error", message: "API key is invalid." } }), { status: 401 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Machine-drafted OpenAI fallback from supplied evidence only." } }],
      }), { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.provider, "OpenAI");
    assert.match(result.text, /OpenAI fallback/);
  }
  assert.deepEqual(hosts, ["api.anthropic.com", "api.openai.com"]);
});

test("completeLocalLlm skips unavailable OpenAI models then succeeds", async () => {
  const models = [];
  const result = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: { openaiApiKey: "sk-test-openai-local-key" },
    fetchImpl: async (url, init) => {
      assert.match(String(url), /api\.openai\.com/);
      const body = JSON.parse(String(init?.body ?? "{}"));
      models.push(body.model);
      if (body.model !== "gpt-3.5-turbo") {
        return new Response(JSON.stringify({ error: { code: "model_not_found", type: "invalid_request_error" } }), { status: 403 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Machine-drafted after model fallback from supplied evidence only." } }],
      }), { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.provider, "OpenAI");
  assert.deepEqual(models, ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]);
});

test("completeLocalLlm failure is operator-safe and does not dump HTTP errors", async () => {
  const result = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: {
      anthropicApiKey: "sk-ant-test-local-key-value",
      openaiApiKey: "sk-test-openai-local-key",
    },
    fetchImpl: async (url) => {
      const host = new URL(String(url)).host;
      if (host === "api.anthropic.com") {
        return new Response(JSON.stringify({ error: { type: "authentication_error", message: "API key is invalid." } }), { status: 401 });
      }
      if (host === "api.openai.com") {
        return new Response(JSON.stringify({ error: { code: "insufficient_quota", type: "insufficient_quota" } }), { status: 429 });
      }
      return new Response("ollama down", { status: 500 });
    },
    retryDelaysMs: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.disabled, false);
    assert.match(result.message, /on-device LLM unavailable/i);
    assert.match(result.message, /cloud LLM skipped/i);
    assert.doesNotMatch(result.message, /Claude HTTP 401 authentication_error/);
    assert.doesNotMatch(result.message, /HTTP 429|insufficient_quota/);
    assert.doesNotMatch(result.message, /sk-ant-|sk-test-|Bearer /i);
    assert.ok(result.attempts?.some((attempt) => attempt.provider === "Claude" && attempt.status === 401));
    assert.ok(result.attempts?.some((attempt) => attempt.provider === "OpenAI"));
    assert.ok(result.attempts?.some((attempt) => attempt.provider === "Ollama"));
  }
});

test("completeLocalLlm retries timeout then succeeds on the same provider", async () => {
  let calls = 0;
  const result = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: { openaiApiKey: "sk-test-openai-local-key" },
    retryDelaysMs: [0],
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error("The operation timed out");
        error.name = "TimeoutError";
        throw error;
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Machine-drafted after retry from supplied evidence only." } }],
      }), { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.provider, "OpenAI");
  assert.equal(calls, 2);
});

test("callable provider order is Claude then OpenAI then Gemini", () => {
  assert.deepEqual(callableProvidersInPreferenceOrder({
    openaiApiKey: "sk-test-openai-local-key",
    anthropicApiKey: "sk-ant-test-local-key-value",
    geminiApiKey: "gemini-test-local-key",
  }), ["Claude", "OpenAI", "Gemini"]);
  assert.deepEqual(completionProvidersInPreferenceOrder({
    openaiApiKey: "sk-test-openai-local-key",
    anthropicApiKey: "sk-ant-test-local-key-value",
    geminiApiKey: "gemini-test-local-key",
  }), ["Claude", "OpenAI", "Gemini", "Ollama"]);
});

test("formatLlmFailureMessage never includes secret material", () => {
  const message = formatLlmFailureMessage([
    { provider: "Claude", model: "claude-sonnet-4-6", status: 401, errorType: "authentication_error" },
  ]);
  assert.match(message, /Claude HTTP 401 authentication_error/);
  assert.doesNotMatch(message, /sk-|Bearer |api[_-]?key/i);
  assert.match(formatSatyaLlmOperatorMessage([
    { provider: "Claude", model: "claude-sonnet-4-6", status: 401, errorType: "authentication_error" },
    { provider: "Ollama", model: "qwen2.5:7b-instruct", status: null, errorType: "unavailable" },
  ]), /on-device LLM unavailable/);
});

test("completeLocalLlm skips unusable cloud providers and uses on-device Ollama", async () => {
  const hosts = [];
  const openaiModels = [];
  const result = await completeLocalLlm({
    prompt: "summarize supplied evidence with headed sections",
    secrets: {
      anthropicApiKey: "sk-ant-test-local-key-value",
      openaiApiKey: "sk-test-openai-local-key",
    },
    fetchImpl: async (url, init) => {
      const parsed = new URL(String(url));
      hosts.push(parsed.host);
      if (parsed.host === "api.anthropic.com") {
        return new Response(JSON.stringify({ error: { type: "authentication_error", message: "API key is invalid." } }), { status: 401 });
      }
      if (parsed.host === "api.openai.com") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        openaiModels.push(body.model);
        if (body.model === "gpt-4.1-mini") {
          return new Response(JSON.stringify({ error: { code: "model_not_found", type: "invalid_request_error" } }), { status: 403 });
        }
        return new Response(JSON.stringify({ error: { code: "context_length_exceeded", type: "invalid_request_error" } }), { status: 400 });
      }
      if (parsed.port === "11434" && parsed.pathname === "/api/tags") {
        return new Response(JSON.stringify({ models: [{ name: "qwen2.5:7b-instruct" }] }), { status: 200 });
      }
      if (parsed.port === "11434" && parsed.pathname === "/api/chat") {
        return new Response(JSON.stringify({
          message: { content: "Machine-drafted from retrieved passages. NII ₹320 bn as stated in the note." },
        }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    },
    retryDelaysMs: [],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.provider, "Ollama");
    assert.match(result.text, /NII ₹320 bn/);
  }
  assert.ok(hosts.includes("api.anthropic.com"));
  assert.ok(hosts.includes("api.openai.com"));
  assert.ok(hosts.some((host) => host.includes("127.0.0.1")));
  assert.ok(openaiModels.includes("gpt-4.1-mini"));
  assert.ok(openaiModels.includes("gpt-4o-mini"));
  assert.equal(openaiModels.filter((model) => model === "gpt-4.1-mini").length, 1);
});

test("builder JSON from a model is parsed as StrategyTreeV1", () => {
  const tree = parseTreeFromLlmText(`
\`\`\`json
{"treeVersion":"1","id":"llm-draft","name":"LLM Draft","interval":"month","children":[{"id":"asset-1","kind":"asset","label":"Reliance","params":{"symbol":"RELIANCE"},"children":[]}]}
\`\`\`
`);
  assert.equal(tree.treeVersion, "1");
  assert.equal(tree.name, "LLM Draft");
  assert.equal(tree.children[0]?.kind, "asset");
});

test("podcast summarizer stays disabled without Ollama or cloud keys in the passed env", () => {
  assert.equal(configuredPodcastSummarizer({}).generate, null);
  assert.equal(typeof configuredPodcastSummarizer({
    ANTHROPIC_API_KEY: "sk-ant-test-local-key-value",
  }, async () => new Response(JSON.stringify({ content: [{ text: "{}" }] }))).generate, "function");
});

test("industry assist prompt stays on S-2 snapshot evidence", () => {
  const prompt = llmAssistSystemPrompt("industry");
  assert.match(prompt, /S-2 Industry Analytics/);
  assert.match(prompt, /EOD benchmarks/);
  assert.match(prompt, /Do not use Mail, Podcasts/);
  assert.match(prompt, /Never invent prices, KPIs/);
});

test("completeLocalLlm forwards maxTokens to Claude and defaults to 1200", async () => {
  /** @type {unknown} */
  let captured;
  const result = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: { anthropicApiKey: "sk-ant-test-local-key-value" },
    maxTokens: 8192,
    fetchImpl: async (_url, init) => {
      captured = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({
        content: [{ type: "text", text: "Machine-drafted from supplied evidence only." }],
      }), { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(captured && typeof captured === "object" ? captured.max_tokens : null, 8192);

  /** @type {unknown} */
  let defaultBody;
  await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: { anthropicApiKey: "sk-ant-test-local-key-value" },
    fetchImpl: async (_url, init) => {
      defaultBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({
        content: [{ type: "text", text: "Machine-drafted from supplied evidence only." }],
      }), { status: 200 });
    },
  });
  assert.equal(defaultBody && typeof defaultBody === "object" ? defaultBody.max_tokens : null, 1200);
});

test("satya assist prompt stays on retrieved passages only", () => {
  const prompt = llmAssistSystemPrompt("satya");
  assert.match(prompt, /Use ONLY the retrieved passages/);
  assert.match(prompt, /never invent CMP, targets/i);
  assert.match(prompt, /Calendar rows are scheduling evidence/);
  assert.match(prompt, /never a one-line reply/i);
  assert.match(prompt, /28 named categories/);
  assert.match(prompt, /composite score/);
  assert.match(prompt, /verbatim/);
  assert.match(prompt, /Write a story grounded in this query's context/);
  assert.match(prompt, /Do not force a robotic WHAT\/WHY\/HOW heading template/);
  assert.match(prompt, /Do not stop after three bullets for the whole answer/);
  assert.doesNotMatch(prompt, /keep it brief/i);
  assert.doesNotMatch(prompt, /Prefer short factual bullets over narrative/);
});

test("completeLocalLlm skips a provider after HTTP 401 until the key fingerprint changes", async () => {
  const hosts = [];
  const fetchImpl = async (url) => {
    hosts.push(new URL(String(url)).host);
    if (new URL(String(url)).host === "api.anthropic.com") {
      return new Response(JSON.stringify({ error: { type: "authentication_error", message: "API key is invalid." } }), { status: 401 });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: "Machine-drafted OpenAI fallback from supplied evidence only." } }],
    }), { status: 200 });
  };
  const openaiApiKey = "sk-test-openai-local-key";
  const staleClaude = {
    anthropicApiKey: "sk-ant-test-local-key-aaaa",
    openaiApiKey,
  };
  const first = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: staleClaude,
    fetchImpl,
    retryDelaysMs: [],
  });
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.provider, "OpenAI");
  assert.ok(hosts.includes("api.anthropic.com"));
  hosts.length = 0;
  const second = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: staleClaude,
    fetchImpl,
    retryDelaysMs: [],
  });
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.provider, "OpenAI");
  assert.deepEqual(hosts, ["api.openai.com"]);
  hosts.length = 0;
  const rotated = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: { anthropicApiKey: "sk-ant-test-local-key-bbbb", openaiApiKey },
    fetchImpl,
    retryDelaysMs: [],
  });
  assert.equal(rotated.ok, true);
  assert.ok(hosts.includes("api.anthropic.com"));
  assert.ok(hosts.includes("api.openai.com"));
});

test("llmAssistAvailability never says Machine-drafted via Claude after a Claude 401", async () => {
  const secrets = {
    anthropicApiKey: "sk-ant-test-local-key-value",
    openaiApiKey: "sk-test-openai-local-key",
  };
  await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets,
    fetchImpl: async (url) => {
      if (new URL(String(url)).host === "api.anthropic.com") {
        return new Response(JSON.stringify({ error: { type: "authentication_error", message: "API key is invalid." } }), { status: 401 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Machine-drafted OpenAI fallback from supplied evidence only." } }],
      }), { status: 200 });
    },
    retryDelaysMs: [],
  });
  const availability = llmAssistAvailability(secrets);
  assert.equal(availability.enabled, true);
  assert.equal(availability.provider, "OpenAI");
  assert.match(availability.message, /Machine-drafted via OpenAI/);
  assert.doesNotMatch(availability.message, /Claude/);
  assert.notEqual(selectPreferredLocalLlmProvider(secrets), "Claude");
});

test("completeLocalLlm skips a remembered model id after model_not_found / 403", async () => {
  const models = [];
  const fetchImpl = async (url, init) => {
    if (String(url).includes("11434")) return new Response("ollama down", { status: 500 });
    const body = JSON.parse(String(init?.body ?? "{}"));
    models.push(body.model);
    if (body.model === "gpt-4.1-mini") {
      return new Response(JSON.stringify({ error: { code: "model_not_found", type: "invalid_request_error" } }), { status: 403 });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: "Machine-drafted after model skip from supplied evidence only." } }],
    }), { status: 200 });
  };
  const secrets = { openaiApiKey: "sk-test-openai-local-key" };
  const first = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets,
    fetchImpl,
    retryDelaysMs: [],
  });
  assert.equal(first.ok, true);
  assert.ok(models.includes("gpt-4.1-mini"));
  assert.ok(models.includes("gpt-4o-mini"));
  models.length = 0;
  const second = await completeLocalLlm({
    prompt: "summarize supplied evidence",
    secrets,
    fetchImpl,
    retryDelaysMs: [],
  });
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.provider, "OpenAI");
  assert.deepEqual(models, ["gpt-4o-mini"]);
});

test("streamLocalLlm emits multiple onToken calls from Ollama NDJSON", async () => {
  const tokens = [];
  const chatBodies = [];
  const encoder = new TextEncoder();
  const result = await streamLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: { ollamaModel: "qwen2.5:7b-instruct" },
    fetchImpl: async (url, init) => {
      const parsed = new URL(String(url));
      if (parsed.pathname === "/api/tags") {
        return new Response(JSON.stringify({ models: [{ name: "qwen2.5:7b-instruct" }] }), { status: 200 });
      }
      if (parsed.pathname === "/api/chat") {
        chatBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: "Machine-" }, done: false })}\n`));
            controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: "drafted from " }, done: false })}\n`));
            controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: "retrieved passages." }, done: true })}\n`));
            controller.close();
          },
        }), { status: 200, headers: { "content-type": "application/x-ndjson" } });
      }
      return new Response("unexpected", { status: 500 });
    },
    onToken: (text) => tokens.push(text),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.provider, "Ollama");
    assert.equal(result.text, "Machine-drafted from retrieved passages.");
  }
  assert.deepEqual(tokens, ["Machine-", "drafted from ", "retrieved passages."]);
  assert.ok(tokens.length > 1);
  assert.equal(chatBodies[0]?.stream, true);
});

test("streamLocalLlm honors AbortSignal during an Ollama stream", async () => {
  const controller = new AbortController();
  const tokens = [];
  const result = await streamLocalLlm({
    prompt: "summarize supplied evidence",
    secrets: { ollamaModel: "qwen2.5:7b-instruct" },
    signal: controller.signal,
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname === "/api/tags") {
        return new Response(JSON.stringify({ models: [{ name: "qwen2.5:7b-instruct" }] }), { status: 200 });
      }
      return new Response(new ReadableStream({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode(`${JSON.stringify({ message: { content: "Hi" }, done: false })}\n`));
          controller.abort();
          streamController.enqueue(new TextEncoder().encode(`${JSON.stringify({ message: { content: " there" }, done: true })}\n`));
          streamController.close();
        },
      }), { status: 200 });
    },
    onToken: (text) => tokens.push(text),
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /cancelled/i);
  assert.ok(tokens.length <= 1);
});
