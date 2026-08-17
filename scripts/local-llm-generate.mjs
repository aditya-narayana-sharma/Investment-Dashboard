import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ENV_ALIASES = {
  OPENAI_API_KEY: ["OPENAI_API_KEY", "OPENAI_KEY"],
  ANTHROPIC_API_KEY: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY"],
  GEMINI_API_KEY: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_GEMINI_API_KEY"],
};

function usable(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length < 8) return "";
  if (/^(your[-_]?|changeme|placeholder|xxx+|todo|replace)/i.test(trimmed)) return "";
  return trimmed;
}

function parseEnvText(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function readText(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function take(record, into) {
  for (const [canonical, aliases] of Object.entries(ENV_ALIASES)) {
    if (into[canonical]) continue;
    const direct = usable(record[canonical]);
    if (direct) {
      into[canonical] = direct;
      continue;
    }
    for (const alias of aliases) {
      const value = usable(record[alias]);
      if (value) {
        into[canonical] = value;
        break;
      }
    }
    const camel = {
      OPENAI_API_KEY: "openaiApiKey",
      ANTHROPIC_API_KEY: "anthropicApiKey",
      GEMINI_API_KEY: "geminiApiKey",
    }[canonical];
    if (!into[canonical] && camel) {
      const fromCamel = usable(record[camel]);
      if (fromCamel) into[canonical] = fromCamel;
    }
  }
}

/** File + env keys for Node scripts. Never logs secret values. */
export function readLocalLlmEnv(root = process.cwd()) {
  const secrets = {};
  const jsonPaths = [
    join(root, "artifacts", "private", "integrations-config.json"),
    join(homedir(), "Library", "Application Support", "Stratji", "integrations-config.json"),
  ];
  for (const filePath of jsonPaths) {
    const text = readText(filePath);
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      const record = parsed && typeof parsed === "object" ? parsed : {};
      const llm = record.llm && typeof record.llm === "object" ? record.llm : record;
      take(llm, secrets);
    } catch {
      take(parseEnvText(text), secrets);
    }
  }
  for (const name of [".env", ".env.local"]) {
    take(parseEnvText(readText(join(root, name))), secrets);
  }
  take(process.env, secrets);
  return secrets;
}

function anthropicText(payload) {
  const content = Array.isArray(payload?.content) ? payload.content : [];
  return content.map((block) => String(block?.text ?? "")).filter(Boolean).join("\n").trim();
}

function openaiText(payload) {
  return String(payload?.choices?.[0]?.message?.content ?? "").trim();
}

function geminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => String(part?.text ?? "")).join("\n").trim();
}

/**
 * First callable key wins: Claude, then OpenAI, then Gemini.
 * Cursor keys are ignored for completions.
 */
export function configuredCloudLlm(env = {}, fetchImpl = fetch) {
  const anthropic = usable(env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY);
  const openai = usable(env.OPENAI_API_KEY || env.OPENAI_KEY);
  const gemini = usable(env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GEMINI_API_KEY);
  if (anthropic) {
    return {
      model: "claude-sonnet-4-20250514",
      reason: null,
      async generate(prompt) {
        const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": anthropic,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1200,
            messages: [{ role: "user", content: String(prompt ?? "") }],
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`Claude summarizer returned HTTP ${response.status}`);
        return anthropicText(await response.json());
      },
    };
  }
  if (openai) {
    return {
      model: "gpt-4.1-mini",
      reason: null,
      async generate(prompt) {
        const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${openai}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            temperature: 0.2,
            messages: [{ role: "user", content: String(prompt ?? "") }],
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`OpenAI summarizer returned HTTP ${response.status}`);
        return openaiText(await response.json());
      },
    };
  }
  if (gemini) {
    return {
      model: "gemini-2.0-flash",
      reason: null,
      async generate(prompt) {
        const response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(gemini)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: String(prompt ?? "") }] }],
            }),
            signal: AbortSignal.timeout(45_000),
          },
        );
        if (!response.ok) throw new Error(`Gemini summarizer returned HTTP ${response.status}`);
        return geminiText(await response.json());
      },
    };
  }
  return {
    generate: null,
    model: null,
    reason: "No Claude, OpenAI, or Gemini key in gitignored local config.",
  };
}
