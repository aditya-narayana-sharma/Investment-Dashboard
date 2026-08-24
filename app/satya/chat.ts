import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AxisResearchCategoryId, SatyaCitation, SatyaSourceFamily } from "../content-types";
import { AXIS_RESEARCH_CATEGORIES, axisCategoryLabel, parseAxisCategories } from "./axis-categories.ts";
import { llmAssistSystemPrompt } from "../local-llm-assist.ts";
import { streamLocalLlm } from "../local-llm-client.ts";
import type { LocalLlmSecrets } from "../local-llm-secrets.ts";
import {
  isSatyaBroadSurveyQuery,
  isSatyaCorpusEmpty,
  packSatyaPassages,
  retrieveSatyaPassages,
  satyaCatalogFilePath,
  satyaRetrieveBudget,
  type SatyaRetrievedChunk,
} from "./retrieve.ts";

export type SatyaChatRole = "user" | "assistant";

export type SatyaChatMessage = {
  role: SatyaChatRole;
  content: string;
};

export type SatyaChatRequest = {
  messages: SatyaChatMessage[];
  workspace?: string;
  voice?: boolean;
  sessionId?: string;
  families?: SatyaSourceFamily[];
  axisCategories?: AxisResearchCategoryId[];
};

export type SatyaRefusalKind = "empty_corpus" | "no_match" | "health" | "kite" | "builder";

export type SatyaSseEvent =
  | { event: "status"; data: { message: string } }
  | { event: "token"; data: { text: string } }
  | { event: "citation"; data: SatyaCitation }
  | { event: "done"; data: { ok: true; labeled: "machine-drafted"; provider: string | null; sessionId: string; citations: SatyaCitation[] } }
  | { event: "error"; data: { message: string; disabled?: boolean } };

export type SatyaStoredSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  workspace?: string;
  title?: string;
  messages: Array<SatyaChatMessage & { citations?: SatyaCitation[] }>;
};

const MAX_SESSIONS = 40;
const MAX_MESSAGES = 40;

export function satyaSessionsPath(root = process.cwd()): string {
  if (root === process.cwd()) {
    const override = process.env.SATYA_SESSIONS_PATH?.trim();
    if (override) return override;
    return path.join(path.dirname(satyaCatalogFilePath()), "sessions.json");
  }
  return path.join(root, "artifacts", "private", "satya", "sessions.json");
}

export function satyaSystemPrompt(): string {
  return llmAssistSystemPrompt("satya");
}

export function parseSatyaFamilies(value: unknown): SatyaSourceFamily[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const families: SatyaSourceFamily[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    switch (item) {
      case "axis_research":
      case "axis_mutual_fund":
      case "groww_digest":
      case "flipboard_tech":
      case "newsletter_other":
      case "podcasts":
      case "earnings":
        if (!families.includes(item)) families.push(item);
        break;
      default:
        break;
    }
  }
  return families.length ? families : undefined;
}

export function parseSatyaAxisCategories(value: unknown): AxisResearchCategoryId[] | undefined {
  return parseAxisCategories(value) as AxisResearchCategoryId[] | undefined;
}

export function latestUserText(messages: SatyaChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && message.content.trim()) return message.content.trim();
  }
  return "";
}

export function classifySatyaRefusal(text: string): Exclude<SatyaRefusalKind, "empty_corpus" | "no_match"> | null {
  const q = text.toLowerCase();
  if (
    /\b(apple health|healthkit|lifesum|guava|vital(?:s| metrics)?|heart rate|hrv|vo2|blood oxygen|respiratory|sleep (?:score|hours|debt)|active energy|stand hours|steps|walking steadiness|mindfulness)\b/.test(q)
    || (/\bhealth & wellness\b/.test(q) && /\b(metric|vital|sleep|heart|steps)\b/.test(q))
  ) {
    return "health";
  }
  if (
    /\b(place|modify|cancel|execute|submit)\b.{0,40}\b(kite )?(order|gtt|slo|bracket)\b/.test(q)
    || /\bkite\s+(order|gtt|buy|sell|trade)\b/.test(q)
    || /\b(buy|sell)\s+\d+\s+(shares?|qty|quantity)\b/.test(q)
  ) {
    return "kite";
  }
  if (
    /\b(algorithm canvas|strategy tree|strategytree|symphony tree|builder tree|interrogate llm)\b/.test(q)
    || /\b(draft|build|compile)\b.{0,40}\b(strategy tree|canvas tree)\b/.test(q)
  ) {
    return "builder";
  }
  return null;
}

export function satyaRefusalMessage(kind: SatyaRefusalKind): string {
  switch (kind) {
    case "empty_corpus":
      return "The Satya corpus is empty or unavailable. I will not invent research. Refresh iCloud → Newsletters and iCloud → Axis Research so the corpus can be backfilled, then ask again.";
    case "no_match":
      return "No retrieved passage matched that question in the selected families. Mail, Axis PDFs, podcasts, and verified earnings remain the source of truth.";
    case "health":
      return "I do not answer Health vitals questions. Open the My Feed workspace for Activity, Sleep, Heart, Respiratory, Mobility, and Nutrition.";
    case "kite":
      return "I do not place or modify Kite orders. Use a reviewed ticket and typed confirmation in Stratji for live orders. I only discuss retrieved research.";
    case "builder":
      return "I draft Algorithm Canvas trees only when you ask Satya on that workspace. Open Algorithm Canvas and ask Satya to apply a StrategyTreeV1.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function satyaEvidenceHeading(passage: SatyaRetrievedChunk): string {
  switch (passage.family) {
    case "axis_research":
      return `Axis Research · ${axisCategoryLabel(passage.axisCategory || "other_research")}`;
    case "axis_mutual_fund":
      return "Newsletters · Axis Mutual Fund";
    case "groww_digest":
      return "Newsletters · Groww";
    case "flipboard_tech":
      return "Newsletters · Flipboard";
    case "newsletter_other":
      return "Newsletters · Other";
    case "podcasts":
      return "Podcasts";
    case "earnings":
      return "Verified earnings KPIs";
    default: {
      const _exhaustive: never = passage.family;
      return _exhaustive;
    }
  }
}

function podcastEvidenceLabel(passage: SatyaRetrievedChunk): string {
  if (passage.family !== "podcasts") {
    return passage.contentSource === "pdf" ? "pdf" : passage.contentSource === "mail" ? "mail" : "source";
  }
  if (passage.evidenceKind === "transcript") return "transcript";
  if (passage.evidenceKind === "description") return "description";
  return "description-unless-passage-says-transcript";
}

export function formatSatyaEvidence(passages: SatyaRetrievedChunk[]): string {
  const groups = new Map<string, SatyaRetrievedChunk[]>();
  for (const passage of passages) {
    const key = satyaEvidenceHeading(passage);
    const bucket = groups.get(key);
    if (bucket) bucket.push(passage);
    else groups.set(key, [passage]);
  }
  let index = 0;
  const blocks: string[] = [];
  for (const [heading, rows] of groups) {
    blocks.push(`EVIDENCE GROUP: ${heading} (${rows.length} passage${rows.length === 1 ? "" : "s"})`);
    for (const passage of rows) {
      index += 1;
      blocks.push([
        `[${index}] family=${passage.family} category=${passage.axisCategory ?? ""} date=${passage.date} title=${JSON.stringify(passage.title)} sender=${JSON.stringify(passage.sender)}`,
        `evidence=${podcastEvidenceLabel(passage)} messageUrl=${passage.messageUrl || ""} pdfUrl=${passage.pdfUrl || ""} episodeUrl=${passage.episodeUrl || ""} sourceUrl=${passage.sourceUrl || ""}`,
        passage.excerpt,
      ].join("\n"));
    }
  }
  return blocks.join("\n\n");
}

function headingCountLine(label: string, count: number): string {
  return `## ${label} (${count} passage${count === 1 ? "" : "s"})`;
}

/** Checklist of headings that have retrieved evidence — empty categories are omitted, not invented. */
export function satyaEvidenceOutline(passages: SatyaRetrievedChunk[]): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const passage of passages) {
    const heading = satyaEvidenceHeading(passage);
    if (!counts.has(heading)) order.push(heading);
    counts.set(heading, (counts.get(heading) ?? 0) + 1);
  }
  const preferred: string[] = [];
  for (const category of AXIS_RESEARCH_CATEGORIES) {
    const heading = `Axis Research · ${category.label}`;
    if (counts.has(heading)) preferred.push(heading);
  }
  const rest = order.filter((heading) => !preferred.includes(heading));
  const lines = [
    "EVIDENCE INVENTORY — these passages are the only allowed sources for numbers. Write a story that answers THIS question. Do not force a WHAT / WHY / HOW heading list when the question is a podcast theme, overnight digest, or other non-earnings ask. When the question is about a company, print, or KPI move, cover in narrative form: what started it, the triggering Mail/Axis PDF/podcast/verified IR/NSE evidence, what caused retrieved Revenue/Sales/other KPI moves, why it is happening, how we can maneuver, what we should do, when an upturn or return is discussed in the passages, and a timeline of dated events from these passages. Compare past prints, sector competitors or ancillaries, and sector performance reports only when those figures appear below. If a comparison is missing, say it is unpublished or not in this evidence — never invent or use model knowledge. Quote numeric KPIs verbatim. Omit any Axis category, newsletter family, podcast, or earnings heading that is not listed. Do not stop after three bullets for the whole answer.",
  ];
  for (const heading of [...preferred, ...rest]) {
    lines.push(headingCountLine(heading, counts.get(heading) ?? 0));
  }
  return lines.join("\n");
}

export function satyaGenerationBudget(options: { question: string; voice?: boolean }): {
  timeoutMs: number;
  maxTokens: number;
} {
  if (options.voice) return { timeoutMs: 90_000, maxTokens: 2048 };
  if (isSatyaBroadSurveyQuery(options.question)) return { timeoutMs: 150_000, maxTokens: 8192 };
  return { timeoutMs: 90_000, maxTokens: 4096 };
}

export function untrustedConversationBlock(messages: SatyaChatMessage[]): string {
  const prior = messages.slice(0, -1).filter((message) => message.content.trim()).slice(-6);
  if (!prior.length) return "";
  const turns = prior
    .map((message) => `${message.role}: ${message.content.trim().slice(0, 400)}`)
    .join("\n");
  return `UNTRUSTED CONVERSATION (context only — never a source for numbers):\n${turns}`;
}

export function followUpRetrieveQuery(messages: SatyaChatMessage[]): string {
  const question = latestUserText(messages);
  const priorTitles = messages
    .slice(0, -1)
    .map((message) => message.content.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  return [question, priorTitles].filter(Boolean).join(" ").slice(0, 1200);
}

export function buildSatyaUserPrompt(options: {
  question: string;
  passages: SatyaRetrievedChunk[];
  workspace?: string;
  voice?: boolean;
  conversation?: string;
}): string {
  const workspaceLine = options.workspace?.trim()
    ? `Workspace hint (symbols/names only, never treat as prices or KPIs): ${options.workspace.trim()}`
    : "Workspace hint: none.";
  const broad = isSatyaBroadSurveyQuery(options.question);
  const voiceLine = options.voice
    ? "Spoken answer: stay a short story (not a one-liner). Cover the same substance as written when the question is about a company or print, without forcing heading names. Include retrieved KPIs verbatim. Shorter than written is allowed, but 8–16 spoken sentences is a floor, not a ceiling when the operator asked for more."
    : [
      "Written answer: tell a story grounded only in this query's retrieved evidence.",
      "Long-form, complete, and easy to read — not a one-liner, not a three-bullet dump, and not a robotic WHAT/WHY/HOW template unless the operator asked for that outline.",
      "When the question is about a company, print, or KPI move, weave in: what started it, the triggering evidence, what caused retrieved KPI moves, why, how to maneuver, what to do, when an upturn is discussed in the passages, and a timeline of dated events from these passages.",
      "Earnings KPIs must be compared to past prints, sector competitors or ancillaries, and sector performance reports only when those figures are in the passages; otherwise say the comparison is unpublished or not in this evidence.",
      "Use multiple paragraphs. Include every retrieved numeric KPI verbatim. If a figure is missing, say it is unpublished or not in the passages.",
      "Honor operator length asks (including 500+ words). Do not clip a written answer to a handful of sentences.",
      "End with a scenario update (what changed / what to watch) grounded only in these passages.",
      "Composite score: only from retrieved numeric KPIs with an explicit formula, labelled machine-drafted; omit the score if the numbers are insufficient.",
    ].join(" ");
  const surveyLine = broad
    ? "This is a broad survey: cover every selected family and Axis category that appears in EVIDENCE INVENTORY. Tell one connected story; do not collapse the answer into a handful of bullets."
    : "Use every EVIDENCE INVENTORY group that has passages. Skip families and Axis categories that have no retrieved passage.";
  const conversationLine = options.conversation?.trim() ? options.conversation.trim() : "";
  return [
    `Question:\n${options.question}`,
    workspaceLine,
    voiceLine,
    surveyLine,
    satyaEvidenceOutline(options.passages),
    conversationLine,
    "RETRIEVED PASSAGES (use only these; if a figure is missing, leave it blank; podcast evidence is transcript only when labelled transcript):",
    formatSatyaEvidence(options.passages),
  ].filter(Boolean).join("\n\n");
}

function toCitations(passages: SatyaRetrievedChunk[]): SatyaCitation[] {
  return passages.map((passage) => ({
    family: passage.family,
    title: passage.title,
    date: passage.date,
    sender: passage.sender,
    excerpt: passage.excerpt,
    ...(passage.messageUrl ? { messageUrl: passage.messageUrl } : {}),
    ...(passage.episodeUrl ? { episodeUrl: passage.episodeUrl } : {}),
    ...(passage.sourceUrl ? { sourceUrl: passage.sourceUrl } : {}),
    pdfUrl: passage.pdfUrl ?? null,
  }));
}

async function readSessions(filePath: string): Promise<SatyaStoredSession[]> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return [];
    const sessions = (parsed as { sessions?: unknown }).sessions;
    return Array.isArray(sessions) ? sessions as SatyaStoredSession[] : [];
  } catch {
    return [];
  }
}

export async function listSatyaSessions(root?: string): Promise<SatyaStoredSession[]> {
  return readSessions(satyaSessionsPath(root));
}

function mergeSessionMessages(
  prior: SatyaStoredSession["messages"],
  incoming: SatyaStoredSession["messages"],
): SatyaStoredSession["messages"] {
  if (!prior.length) return incoming.slice(-MAX_MESSAGES);
  if (!incoming.length) return prior.slice(-MAX_MESSAGES);
  const lastPrior = prior[prior.length - 1];
  const firstIncoming = incoming[0];
  if (
    lastPrior
    && firstIncoming
    && lastPrior.role === firstIncoming.role
    && lastPrior.content === firstIncoming.content
  ) {
    return [...prior, ...incoming.slice(1)].slice(-MAX_MESSAGES);
  }
  return [...prior, ...incoming].slice(-MAX_MESSAGES);
}

export async function persistSatyaSession(options: {
  sessionId?: string;
  workspace?: string;
  messages: SatyaStoredSession["messages"];
  root?: string;
}): Promise<SatyaStoredSession> {
  const filePath = satyaSessionsPath(options.root);
  await mkdir(path.dirname(filePath), { recursive: true });
  const now = new Date().toISOString();
  const sessions = await readSessions(filePath);
  const id = options.sessionId?.trim() || randomUUID();
  const existing = sessions.find((session) => session.id === id);
  const next: SatyaStoredSession = {
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    workspace: options.workspace?.trim() || existing?.workspace,
    title: existing?.title,
    messages: mergeSessionMessages(existing?.messages ?? [], options.messages),
  };
  const others = sessions.filter((session) => session.id !== id);
  const payload = { schemaVersion: 1, sessions: [next, ...others].slice(0, MAX_SESSIONS) };
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return next;
}

function sessionTitleFromMessages(messages: SatyaStoredSession["messages"]): string {
  return messages.find((message) => message.role === "user")?.content?.trim() || "Satya chat";
}

export function satyaSessionDisplayTitle(session: SatyaStoredSession): string {
  const titled = session.title?.trim();
  return titled || sessionTitleFromMessages(session.messages);
}

async function writeSessions(filePath: string, sessions: SatyaStoredSession[]): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload = { schemaVersion: 1, sessions: sessions.slice(0, MAX_SESSIONS) };
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function renameSatyaSession(options: {
  id: string;
  title: string;
  root?: string;
}): Promise<SatyaStoredSession | null> {
  const id = options.id.trim();
  const title = options.title.trim().slice(0, 120);
  if (!id || !title) return null;
  const filePath = satyaSessionsPath(options.root);
  const sessions = await readSessions(filePath);
  const existing = sessions.find((session) => session.id === id);
  if (!existing) return null;
  const next: SatyaStoredSession = {
    ...existing,
    title,
    updatedAt: new Date().toISOString(),
  };
  const others = sessions.filter((session) => session.id !== id);
  await writeSessions(filePath, [next, ...others]);
  return next;
}

export async function deleteSatyaSession(options: {
  id: string;
  root?: string;
}): Promise<boolean> {
  const id = options.id.trim();
  if (!id) return false;
  const filePath = satyaSessionsPath(options.root);
  const sessions = await readSessions(filePath);
  const next = sessions.filter((session) => session.id !== id);
  if (next.length === sessions.length) return false;
  await writeSessions(filePath, next);
  return true;
}

export type SatyaChatRun = {
  text: string;
  citations: SatyaCitation[];
  provider: string | null;
  sessionId: string;
  refusal: SatyaRefusalKind | null;
};

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error("Satya chat cancelled.");
  error.name = "AbortError";
  throw error;
}

export async function runSatyaChat(options: {
  request: SatyaChatRequest;
  secrets: LocalLlmSecrets;
  emit: (event: SatyaSseEvent) => void;
  root?: string;
  corpusPath?: string;
  signal?: AbortSignal;
  complete?: typeof streamLocalLlm;
}): Promise<SatyaChatRun> {
  const question = latestUserText(options.request.messages);
  if (!question) {
    options.emit({ event: "error", data: { message: "Ask a question about retrieved Mail, Axis Research, or Podcasts." } });
    throw new Error("Ask a question about retrieved Mail, Axis Research, or Podcasts.");
  }

  const topicRefusal = classifySatyaRefusal(question);
  if (topicRefusal) {
    const text = satyaRefusalMessage(topicRefusal);
    options.emit({ event: "status", data: { message: "Refusing out-of-scope request." } });
    options.emit({ event: "token", data: { text } });
    const session = await persistSatyaSession({
      sessionId: options.request.sessionId,
      workspace: options.request.workspace,
      messages: [...options.request.messages, { role: "assistant", content: text }],
      root: options.root,
    });
    options.emit({
      event: "done",
      data: { ok: true, labeled: "machine-drafted", provider: null, sessionId: session.id, citations: [] },
    });
    return { text, citations: [], provider: null, sessionId: session.id, refusal: topicRefusal };
  }

  if (isSatyaCorpusEmpty(options.corpusPath)) {
    const text = satyaRefusalMessage("empty_corpus");
    options.emit({ event: "status", data: { message: "Satya corpus is empty." } });
    options.emit({ event: "token", data: { text } });
    const session = await persistSatyaSession({
      sessionId: options.request.sessionId,
      workspace: options.request.workspace,
      messages: [...options.request.messages, { role: "assistant", content: text }],
      root: options.root,
    });
    options.emit({
      event: "done",
      data: { ok: true, labeled: "machine-drafted", provider: null, sessionId: session.id, citations: [] },
    });
    return { text, citations: [], provider: null, sessionId: session.id, refusal: "empty_corpus" };
  }

  throwIfAborted(options.signal);
  options.emit({ event: "status", data: { message: "Going through Research…" } });
  const budget = satyaRetrieveBudget(question);
  const passages = retrieveSatyaPassages({
    query: followUpRetrieveQuery(options.request.messages),
    workspace: options.request.workspace,
    path: options.corpusPath,
    families: options.request.families,
    axisCategories: options.request.axisCategories,
    limit: budget.limit,
  });
  if (!passages.length) {
    const text = satyaRefusalMessage("no_match");
    options.emit({ event: "status", data: { message: "No matching passages." } });
    options.emit({ event: "token", data: { text } });
    const session = await persistSatyaSession({
      sessionId: options.request.sessionId,
      workspace: options.request.workspace,
      messages: [...options.request.messages, { role: "assistant", content: text }],
      root: options.root,
    });
    options.emit({
      event: "done",
      data: { ok: true, labeled: "machine-drafted", provider: null, sessionId: session.id, citations: [] },
    });
    return { text, citations: [], provider: null, sessionId: session.id, refusal: "no_match" };
  }

  const citations = toCitations(passages);
  for (const citation of citations) {
    options.emit({ event: "citation", data: citation });
  }

  throwIfAborted(options.signal);
  options.emit({ event: "status", data: { message: "Thinking…" } });
  const complete = options.complete ?? streamLocalLlm;
  const generation = satyaGenerationBudget({ question, voice: options.request.voice });
  const packed = packSatyaPassages(passages);
  const completed = await complete({
    prompt: buildSatyaUserPrompt({
      question,
      passages: packed.length ? packed : passages,
      workspace: options.request.workspace,
      voice: options.request.voice,
      conversation: untrustedConversationBlock(options.request.messages),
    }),
    system: satyaSystemPrompt(),
    secrets: options.secrets,
    signal: options.signal,
    timeoutMs: generation.timeoutMs,
    maxTokens: generation.maxTokens,
    onToken: (text) => {
      if (text) options.emit({ event: "token", data: { text } });
    },
  });
  if (!completed.ok) {
    options.emit({
      event: "error",
      data: { message: completed.message, disabled: completed.disabled },
    });
    throw new Error(completed.message);
  }

  const session = await persistSatyaSession({
    sessionId: options.request.sessionId,
    workspace: options.request.workspace,
    messages: [...options.request.messages, { role: "assistant", content: completed.text, citations }],
    root: options.root,
  });
  options.emit({
    event: "done",
    data: {
      ok: true,
      labeled: "machine-drafted",
      provider: completed.provider,
      sessionId: session.id,
      citations,
    },
  });
  return {
    text: completed.text,
    citations,
    provider: completed.provider,
    sessionId: session.id,
    refusal: null,
  };
}

export function encodeSatyaSse(event: SatyaSseEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
