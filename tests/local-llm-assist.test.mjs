import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { llmAssistSystemPrompt, parseTreeFromLlmText } from "../app/local-llm-assist.ts";
import { completeLocalLlm, formatLlmFailureMessage } from "../app/local-llm-client.ts";
import {
  callableProvidersInPreferenceOrder,
  llmAssistAvailability,
  overlayLocalLlmSecrets,
  readLocalLlmSecrets,
  selectPreferredLocalLlmProvider,
} from "../app/local-llm-secrets.ts";
import { defaultIntegrationsConfig, sanitizeStoredIntegrationsConfig } from "../app/integrations-types.ts";
import { configuredPodcastSummarizer } from "../scripts/podcast-summarizer.mjs";

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
  assert.match(availability.message, /Claude, OpenAI, or Gemini/);
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

test("completeLocalLlm failure names provider and HTTP status without secrets", async () => {
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
      return new Response(JSON.stringify({ error: { code: "insufficient_quota", type: "insufficient_quota" } }), { status: 429 });
    },
    retryDelaysMs: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.disabled, false);
    assert.match(result.message, /Claude HTTP 401 authentication_error/);
    assert.match(result.message, /OpenAI HTTP 429 insufficient_quota/);
    assert.doesNotMatch(result.message, /sk-ant-|sk-test-|Bearer /i);
    assert.equal(result.status, 429);
    assert.equal(result.errorType, "insufficient_quota");
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
});

test("formatLlmFailureMessage never includes secret material", () => {
  const message = formatLlmFailureMessage([
    { provider: "Claude", model: "claude-sonnet-4-6", status: 401, errorType: "authentication_error" },
  ]);
  assert.match(message, /Claude HTTP 401 authentication_error/);
  assert.doesNotMatch(message, /sk-|Bearer |api[_-]?key/i);
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
