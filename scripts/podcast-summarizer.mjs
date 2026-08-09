const DEFAULT_CHUNK_CHARS = 9000;
const MIN_TRANSCRIPT_CHARS = 200;

const CONTACT_OR_PROMO = [
  /\b(?:sponsor(?:ed|ship)?|advertis(?:e|ement|ing)|ad break|commercial break)\b/i,
  /\b(?:brought to you by|support for (?:this|the) (?:show|podcast|episode) comes from|paid for by)\b/i,
  /\b(?:promo code|coupon code|use code|limited[- ]time offer|free trial|save \d+%|discount)\b/i,
  /\b(?:subscribe|follow us|follow the show|like and subscribe|rate and review|leave (?:us )?a review|share this episode)\b/i,
  /\b(?:sign up|register now|buy now|shop now|download (?:the|our) app|install (?:the|our) app|join (?:our|the) newsletter)\b/i,
  /\b(?:visit (?:us at|our website)|contact us|email us|call us|text us|find us on)\b/i,
  /\b(?:whatsapp (?:us|me)|dm (?:us|me)|message us on|reach (?:us|out to us)|write to us)\b/i,
  /\b(?:helpline|toll[- ]free|customer care|scan the qr code|book (?:a|your) (?:demo|call|slot)|schedule a (?:call|demo)|request a callback)\b/i,
  /\b(?:patreon|instagram|facebook|linkedin|youtube|tiktok|twitter|x\.com|telegram|discord|snapchat)\b/i,
];

const INTRO_BOILERPLATE = [
  /^(?:hello|hi|welcome)(?:\s+back)?\s+to\b/i,
  /^this is (?:the|your)\b.{0,80}(?:podcast|show|brief|edition)\b/i,
  /^(?:i am|i'm|we are|we're) your hosts?\b/i,
  /^(?:theme|intro) music\b/i,
];

const OUTRO_BOILERPLATE = [
  /\b(?:thanks|thank you) for (?:listening|joining us|tuning in)\b/i,
  /\b(?:see|join|catch) you (?:next time|tomorrow|next week)\b/i,
  /\b(?:that is|that's) (?:all|it) for (?:today|this episode)\b/i,
  /\bproduction credits?\b/i,
];

const EMAIL = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+\b/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
/**
 * Bare domain tokens without a scheme/www prefix — website links must never leak into
 * summary content. Excludes ambiguous short suffixes ("in", "co") that collide with common
 * English words when punctuation is glued to the next word.
 */
const BARE_DOMAIN_INLINE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,}(?:com|org|net|io|gov|edu|info|biz|ai|app|news|xyz|substack)\b(?:\/[^\s)]*)?/gi;
const TIMESTAMP_PREFIX = /^\[((?:\d{1,2}:)?\d{1,2}:\d{2})\]\s*/;

function scrubContacts(value) {
  return String(value ?? "")
    .replace(EMAIL, " ")
    .replace(URL_PATTERN, " ")
    .replace(BARE_DOMAIN_INLINE, " ")
    .replace(PHONE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPromo(value) {
  return CONTACT_OR_PROMO.some((matcher) => matcher.test(value));
}

/**
 * Remove non-editorial transcript cues before any model sees them.
 * A short cooldown removes the body of sponsor reads after their disclosure.
 */
export function sanitizePodcastTranscript(value) {
  const lines = String(value ?? "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const kept = [];
  let promoCooldown = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const timestamp = lines[index].match(TIMESTAMP_PREFIX)?.[0] ?? "";
    const rawBody = lines[index].replace(TIMESTAMP_PREFIX, "").trim();
    const body = scrubContacts(rawBody);
    if (!body) continue;
    const transition = /^(?:back to|now back to|turning (?:now )?to|meanwhile|our next|let(?:'|’)s return to)\b/i.test(body);
    if (isPromo(rawBody)) {
      promoCooldown = 6;
      continue;
    }
    if (promoCooldown > 0 && !transition) {
      promoCooldown -= 1;
      continue;
    }
    promoCooldown = 0;
    if (index < 12 && INTRO_BOILERPLATE.some((matcher) => matcher.test(body))) continue;
    if (index >= Math.max(0, lines.length - 12) && OUTRO_BOILERPLATE.some((matcher) => matcher.test(body))) continue;
    kept.push(`${timestamp}${body}`.trim());
  }
  return kept.join("\n");
}

/** Split on cue boundaries while preserving every sanitized character exactly once. */
export function chunkPodcastTranscript(value, maxChars = DEFAULT_CHUNK_CHARS) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  const chunks = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current && current.length + line.length + 1 > maxChars) {
      chunks.push(current);
      current = "";
    }
    if (line.length > maxChars) {
      for (let offset = 0; offset < line.length; offset += maxChars) {
        if (current) {
          chunks.push(current);
          current = "";
        }
        chunks.push(line.slice(offset, offset + maxChars));
      }
      continue;
    }
    current = current ? `${current}\n${line}` : line;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function normalizeEpisodeTitle(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(?:special|bonus|rerun|encore)\s*[:|-]?\s*/, "")
    .replace(/\s+(?:special|rerun|encore)$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function deduplicatePodcastEpisodes(items) {
  const quality = (item) => (
    item.summaryStatus === "generated" && item.contentSource === "transcript" ? 10_000
      : item.contentSource === "transcript" ? 1000
        : 0
  ) + (item.keyTakeaways?.length ?? 0);
  const unique = new Map();
  for (const item of items) {
    const key = normalizeEpisodeTitle(item.title);
    if (!key) continue;
    const existing = unique.get(key);
    if (!existing || quality(item) > quality(existing)) unique.set(key, item);
  }
  return [...unique.values()];
}

export function sanitizeGeneratedSummary(value) {
  const source = String(value ?? "").trim();
  let candidates = [];
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) candidates = parsed;
    else if (Array.isArray(parsed?.bullets)) candidates = parsed.bullets;
  } catch {
    candidates = source.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[).])\s*/, ""));
  }
  const seen = new Set();
  return candidates.flatMap((candidate) => {
    const raw = String(candidate ?? "");
    if (isPromo(raw)) return [];
    const clean = scrubContacts(raw)
      .replace(/^(?:summary|key takeaway|takeaway)\s*:\s*/i, "")
      .trim();
    const key = clean.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (clean.length < 20 || key.length < 15 || seen.has(key)) return [];
    seen.add(key);
    return [clean.slice(0, 420)];
  }).slice(0, 6);
}

const POSITIVE_OUTCOME = /\b(?:beat|benefit|improv|gain|growth|recover|resilien|strong|support|upside|win)\w*\b/i;
const NEGATIVE_OUTCOME = /\b(?:declin|deteriorat|downside|fail|fell|loss|risk|slow|threat|weak|worsen)\w*\b/i;
const POSITIVE_SENTIMENT = /\b(?:bullish|confiden|constructive|encourag|optimis|positive)\w*\b/i;
const NEGATIVE_SENTIMENT = /\b(?:bearish|cautious|concern|negative|pessimis|skeptic|uncertain|worr)\w*\b/i;

export function classifyPodcastInsight(value) {
  const text = String(value ?? "").trim();
  const positiveOutcome = POSITIVE_OUTCOME.test(text);
  const negativeOutcome = NEGATIVE_OUTCOME.test(text);
  const positiveSentiment = POSITIVE_SENTIMENT.test(text);
  const negativeSentiment = NEGATIVE_SENTIMENT.test(text);
  return {
    text,
    outcome: positiveOutcome === negativeOutcome ? "Mixed" : positiveOutcome ? "Positive" : "Negative",
    sentiment: positiveSentiment === negativeSentiment ? "Neutral" : positiveSentiment ? "Positive" : "Negative",
  };
}

function normalizedLabel(value, allowed, fallback) {
  const label = String(value ?? "").trim().toLowerCase();
  return allowed.find((candidate) => candidate.toLowerCase() === label) ?? fallback;
}

export function sanitizeGeneratedInsights(value) {
  const source = String(value ?? "").trim();
  let candidates = [];
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) candidates = parsed;
    else if (Array.isArray(parsed?.bullets)) candidates = parsed.bullets;
    else if (Array.isArray(parsed?.insights)) candidates = parsed.insights;
  } catch {
    candidates = source.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[).])\s*/, ""));
  }
  const seen = new Set();
  return candidates.flatMap((candidate) => {
    const rawText = typeof candidate === "object" && candidate !== null
      ? candidate.text ?? candidate.bullet ?? candidate.summary ?? ""
      : candidate;
    const cleanItems = sanitizeGeneratedSummary(JSON.stringify({ bullets: [rawText] }));
    if (!cleanItems.length) return [];
    const text = cleanItems[0];
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return [];
    seen.add(key);
    const inferred = classifyPodcastInsight(text);
    return [{
      text,
      outcome: normalizedLabel(candidate?.outcome, ["Positive", "Mixed", "Negative"], inferred.outcome),
      sentiment: normalizedLabel(candidate?.sentiment, ["Positive", "Neutral", "Negative"], inferred.sentiment),
    }];
  }).slice(0, 6);
}

function chunkPrompt(chunk, index, total) {
  return [
    "Summarize this transcript chunk using only claims present in the chunk.",
    "Return JSON: {\"bullets\":[{\"text\":\"...\",\"outcome\":\"Positive|Mixed|Negative\",\"sentiment\":\"Positive|Neutral|Negative\"}]}. Use 2-4 complete substantive bullets.",
    "Outcome classifies the consequence described; sentiment classifies the speaker's expressed stance.",
    "Capture arguments, evidence, conclusions, and disagreements. Omit ads, sponsors, promotions, contacts, and show boilerplate.",
    `Chunk ${index + 1} of ${total}:`,
    chunk,
  ].join("\n\n");
}

function synthesisPrompt(chunkSummaries) {
  return [
    "Create the final summary of one complete podcast from the ordered chunk summaries below.",
    "Return JSON: {\"bullets\":[{\"text\":\"...\",\"outcome\":\"Positive|Mixed|Negative\",\"sentiment\":\"Positive|Neutral|Negative\"}]}. Use 3-6 concise complete bullets.",
    "Outcome classifies the consequence described; sentiment classifies the speaker's expressed stance.",
    "Cover the episode end-to-end: major arguments, evidence, conclusions, and disagreements.",
    "Use only supplied material. Omit ads, sponsors, promotions, contacts, URLs, and follow/subscribe requests.",
    ...chunkSummaries.map((summary, index) => `CHUNK ${index + 1}:\n${summary}`),
  ].join("\n\n");
}

export async function summarizePodcastTranscript(transcript, {
  generate,
  model = "configured-local-model",
  maxChunkChars = DEFAULT_CHUNK_CHARS,
} = {}) {
  if (!String(transcript ?? "").trim()) {
    return { status: "unavailable", reason: "transcript_unavailable", bullets: [], insights: [], model: null, chunkCount: 0 };
  }
  const sanitizedTranscript = sanitizePodcastTranscript(transcript);
  if (sanitizedTranscript.length < MIN_TRANSCRIPT_CHARS) {
    return { status: "unavailable", reason: "transcript_too_short", bullets: [], insights: [], model: null, chunkCount: 0 };
  }
  if (typeof generate !== "function") {
    return { status: "unavailable", reason: "summarizer_not_configured", bullets: [], insights: [], model: null, chunkCount: 0 };
  }
  const chunks = chunkPodcastTranscript(sanitizedTranscript, maxChunkChars);
  const chunkSummaries = [];
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const output = await generate(chunkPrompt(chunks[index], index, chunks.length), {
        phase: "chunk",
        index,
        total: chunks.length,
      });
      const clean = sanitizeGeneratedInsights(output);
      if (!clean.length) throw new Error(`chunk ${index + 1} returned no substantive summary`);
      chunkSummaries.push(clean.map((insight) => insight.text).join("\n"));
    }
    const finalOutput = await generate(synthesisPrompt(chunkSummaries), {
      phase: "synthesis",
      total: chunks.length,
    });
    const insights = sanitizeGeneratedInsights(finalOutput);
    if (insights.length < 3) throw new Error("final synthesis returned fewer than three substantive bullets");
    return {
      status: "generated",
      reason: null,
      bullets: insights.map((insight) => insight.text),
      insights,
      model,
      chunkCount: chunks.length,
      sanitizedChars: sanitizedTranscript.length,
      summarizedChars: chunks.reduce((total, chunk) => total + chunk.length, 0),
    };
  } catch {
    return { status: "error", reason: "summarizer_failed", bullets: [], insights: [], model, chunkCount: chunks.length };
  }
}

export async function summarizePodcastDescription(description, {
  generate,
  model = "configured-local-model",
} = {}) {
  const evidence = sanitizePodcastTranscript(description);
  if (evidence.length < 80) {
    return { status: "unavailable", reason: "evidence_too_short", bullets: [], insights: [], model: null, chunkCount: 0 };
  }
  if (typeof generate !== "function") {
    return { status: "unavailable", reason: "summarizer_not_configured", bullets: [], insights: [], model: null, chunkCount: 0 };
  }
  try {
    const output = await generate([
      "Summarize this publisher episode description using only claims present in the description.",
      "Return JSON: {\"bullets\":[{\"text\":\"...\",\"outcome\":\"Positive|Mixed|Negative\",\"sentiment\":\"Positive|Neutral|Negative\"}]}. Use 2-5 substantive bullets.",
      "Outcome classifies the consequence described; sentiment classifies the expressed stance.",
      "Omit ads, sponsors, promotions, contacts, URLs, credits, and follow/subscribe requests.",
      "DESCRIPTION:",
      evidence,
    ].join("\n\n"), { phase: "description", total: 1 });
    const insights = sanitizeGeneratedInsights(output);
    if (insights.length < 2) throw new Error("description synthesis returned fewer than two substantive bullets");
    return {
      status: "generated",
      reason: null,
      bullets: insights.map((insight) => insight.text),
      insights,
      model,
      chunkCount: 1,
      sanitizedChars: evidence.length,
      summarizedChars: evidence.length,
    };
  } catch {
    return { status: "error", reason: "summarizer_failed", bullets: [], insights: [], model, chunkCount: 1 };
  }
}

function allowedSummarizerUrl(value, allowRemote) {
  try {
    const url = new URL(value);
    const local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!local && !allowRemote) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Ollama-compatible adapter. A model name is required, so no model is pulled or
 * external service contacted implicitly. Remote hosts need an explicit opt-in.
 */
export function configuredPodcastSummarizer(env = process.env, fetchImpl = fetch) {
  const model = String(env.PODCAST_SUMMARIZER_MODEL ?? "").trim();
  if (!model) return { generate: null, model: null, reason: "PODCAST_SUMMARIZER_MODEL is not configured." };
  const url = allowedSummarizerUrl(
    String(env.PODCAST_SUMMARIZER_URL ?? "http://127.0.0.1:11434/api/generate"),
    env.PODCAST_SUMMARIZER_ALLOW_REMOTE === "1",
  );
  if (!url) return { generate: null, model: null, reason: "Podcast summarizer URL is invalid or remote access is not explicitly allowed." };
  return {
    model,
    reason: null,
    async generate(prompt) {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false, format: "json", options: { temperature: 0.1 } }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error(`Local podcast summarizer returned HTTP ${response.status}`);
      const payload = await response.json();
      return String(payload.response ?? "");
    },
  };
}
