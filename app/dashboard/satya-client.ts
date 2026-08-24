import type { AxisResearchCategoryId, SatyaCitation, SatyaSourceFamily } from "../content-types";
import type { LlmAssistTask } from "../local-llm-assist";
import type { StrategyTreeV1 } from "../../packages/contracts/src/strategy-tree.ts";
import {
  AXIS_RESEARCH_CATEGORIES,
  isAxisResearchCategoryId,
  resolveResultUpdateRetrieval,
} from "../satya/axis-categories.ts";
import type { WorkspaceKey } from "./types";
import type { SatyaSuggestion } from "./satya-suggestions";
import { clearSatyaDraftStatusMessage, publishSatyaDraftStatusMessage } from "./satya-draft-status.ts";

export const SATYA_SOURCE_CHIPS: Array<{ id: SatyaSourceFamily; label: string }> = [
  { id: "axis_research", label: "Axis Research" },
  { id: "axis_mutual_fund", label: "Axis Mutual Fund" },
  { id: "groww_digest", label: "Groww" },
  { id: "flipboard_tech", label: "Flipboard" },
  { id: "newsletter_other", label: "Other newsletters" },
  { id: "podcasts", label: "Podcasts" },
  { id: "earnings", label: "Earnings KPIs" },
];

export const DEFAULT_SATYA_FAMILIES: SatyaSourceFamily[] = SATYA_SOURCE_CHIPS.map((chip) => chip.id);

export type { SatyaCitation, SatyaSourceFamily };
export type { AxisResearchCategoryId };
export type SatyaPresenceState = "idle" | "listening" | "thinking" | "speaking" | "citing" | "error" | "stale";

export type SatyaStatusPayload = {
  enabled?: boolean;
  available?: boolean;
  stale?: boolean;
  disabled?: boolean;
  message?: string;
  operator?: boolean;
  corpus?: {
    documentCount?: number;
    families?: Partial<Record<SatyaSourceFamily, number>> | Record<string, number>;
    pdfIngest?: "pending" | "ok" | "error" | "idle";
    lastPdfIngestAt?: string | null;
    ingestError?: string | null;
  };
};

export type SatyaAxisChipGroup = {
  id: "research" | "webinars";
  label: string;
  hint?: string;
  categories: Array<{
    id: AxisResearchCategoryId;
    label: string;
    colorToken: string;
    defaultRetrieve: boolean;
  }>;
};

/** Axis chips grouped by default retrieve vs live webinars (off unless selected). */
export function groupedAxisResearchCategories(): SatyaAxisChipGroup[] {
  const research: SatyaAxisChipGroup["categories"] = [];
  const webinars: SatyaAxisChipGroup["categories"] = [];
  for (const category of AXIS_RESEARCH_CATEGORIES) {
    const row = {
      id: category.id as AxisResearchCategoryId,
      label: category.label,
      colorToken: category.colorToken,
      defaultRetrieve: category.defaultRetrieve,
    };
    if (category.id === "live_webinars" || !category.defaultRetrieve) webinars.push(row);
    else research.push(row);
  }
  return [
    { id: "research", label: "Axis research", categories: research },
    {
      id: "webinars",
      label: "Live Webinars",
      hint: "Webinars off unless selected.",
      categories: webinars,
    },
  ];
}

/** Typed composers stay silent. Push-to-talk may speak a successful grounded reply. Errors never speak. */
export function satyaShouldSpeak(options: { voice: boolean; error?: boolean }): boolean {
  return options.voice === true && options.error !== true;
}

export type SatyaCorpusHealth = {
  documentCount: number | null;
  ingestError: string | null;
  families: Partial<Record<SatyaSourceFamily, number>>;
};

export function satyaCorpusHealthFromStatus(payload: SatyaStatusPayload): SatyaCorpusHealth {
  const corpus = payload.corpus;
  const documentCount = typeof corpus?.documentCount === "number" && Number.isFinite(corpus.documentCount)
    ? corpus.documentCount
    : null;
  const ingestError = typeof corpus?.ingestError === "string" && corpus.ingestError.trim()
    ? corpus.ingestError.trim()
    : null;
  const families: Partial<Record<SatyaSourceFamily, number>> = {};
  const raw = corpus?.families;
  if (raw && typeof raw === "object") {
    for (const chip of SATYA_SOURCE_CHIPS) {
      const count = raw[chip.id];
      if (typeof count === "number" && Number.isFinite(count)) families[chip.id] = count;
    }
  }
  return { documentCount, ingestError, families };
}

export type SatyaChatHandlers = {
  onStatus?: (state: SatyaPresenceState) => void;
  onToken?: (text: string) => void;
  onCitation?: (citation: SatyaCitation) => void;
  onSession?: (sessionId: string) => void;
  onDone?: (text: string) => void;
  onError?: (message: string) => void;
};

type SatyaSseKind = "status" | "token" | "citation" | "done" | "error";

function parseJsonRecord(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function asSseKind(value: string): SatyaSseKind | null {
  switch (value) {
    case "status":
    case "token":
    case "citation":
    case "done":
    case "error":
      return value;
    default:
      return null;
  }
}

function asSourceFamily(value: unknown): SatyaSourceFamily | undefined {
  switch (value) {
    case "axis_research":
    case "axis_mutual_fund":
    case "groww_digest":
    case "flipboard_tech":
    case "newsletter_other":
    case "podcasts":
    case "earnings":
      return value;
    default:
      return undefined;
  }
}

function asAxisCategory(value: unknown): AxisResearchCategoryId | undefined {
  return typeof value === "string" && isAxisResearchCategoryId(value) ? value : undefined;
}

function citationFromUnknown(value: unknown): SatyaCitation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const family = asSourceFamily(record.family) ?? "newsletter_other";
  const title = typeof record.title === "string" ? record.title : "";
  const sender = typeof record.sender === "string" ? record.sender : "";
  const messageUrl = typeof record.messageUrl === "string" ? record.messageUrl : undefined;
  const pdfUrl = typeof record.pdfUrl === "string" ? record.pdfUrl : record.pdfUrl === null ? null : undefined;
  const episodeUrl = typeof record.episodeUrl === "string" ? record.episodeUrl : undefined;
  const sourceUrl = typeof record.sourceUrl === "string" ? record.sourceUrl : undefined;
  if (!title && !sender && !messageUrl && !pdfUrl && !episodeUrl && !sourceUrl) return null;
  return {
    family,
    title: title || sender || "Citation",
    date: typeof record.date === "string" ? record.date : "",
    sender,
    excerpt: typeof record.excerpt === "string" ? record.excerpt : "",
    messageUrl,
    pdfUrl,
    ...(episodeUrl ? { episodeUrl } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}

export type SatyaCitationKind = "mail" | "pdf" | "podcast" | "earnings";

export type SatyaCitationLink = {
  kind: SatyaCitationKind;
  href: string;
  label: string;
};

export type SatyaCitationBadge = {
  kind: SatyaCitationKind;
  label: string;
  count: number;
  titles: string[];
  hrefs: string[];
};

function citationOpenerLabel(kind: SatyaCitationKind, title: string): string {
  const suffix = title.trim();
  switch (kind) {
    case "mail":
      return suffix ? `Open in Mail: ${suffix}` : "Open in Mail";
    case "pdf":
      return suffix ? `Open PDF: ${suffix}` : "Open PDF";
    case "podcast":
      return suffix ? `Open episode: ${suffix}` : "Open episode";
    case "earnings":
      return suffix ? `Open earnings source: ${suffix}` : "Open earnings source";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** One compact opener per cited URL — combined icon cluster, not a title wall. */
export function compactCitationLinks(citations: SatyaCitation[]): SatyaCitationLink[] {
  const seen = new Set<string>();
  const links: SatyaCitationLink[] = [];
  const push = (kind: SatyaCitationKind, href: string | undefined, title: string) => {
    const url = href?.trim();
    if (!url) return;
    const key = `${kind}:${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ kind, href: url, label: citationOpenerLabel(kind, title) });
  };
  for (const citation of citations) {
    const title = citation.title.trim();
    const mail = citation.messageUrl?.trim();
    if (mail) {
      const kind: SatyaCitationKind = citation.family === "podcasts"
        ? "podcast"
        : citation.family === "earnings"
          ? "earnings"
          : "mail";
      push(kind, mail, title);
    }
    push("pdf", citation.pdfUrl ?? undefined, title);
    push("podcast", citation.episodeUrl, title);
    push("earnings", citation.sourceUrl, title);
  }
  const order: SatyaCitationKind[] = ["mail", "pdf", "podcast", "earnings"];
  return order.flatMap((kind) => links.filter((link) => link.kind === kind));
}

const CITATION_BADGE_LABELS: Record<SatyaCitationKind, string> = {
  mail: "Mail",
  pdf: "PDFs",
  podcast: "Podcasts",
  earnings: "Earnings KPIs",
};

/** One badge per source kind with a count — not one icon per cited document. */
export function citationSourceBadges(citations: SatyaCitation[]): SatyaCitationBadge[] {
  const links = compactCitationLinks(citations);
  const order: SatyaCitationKind[] = ["mail", "pdf", "podcast", "earnings"];
  const badges: SatyaCitationBadge[] = [];
  for (const kind of order) {
    const rows = links.filter((link) => link.kind === kind);
    if (!rows.length) continue;
    badges.push({
      kind,
      label: CITATION_BADGE_LABELS[kind],
      count: rows.length,
      titles: rows.map((row) => row.label),
      hrefs: rows.map((row) => row.href),
    });
  }
  return badges;
}

/** Parse one SSE frame. Server contract is `event: status|token|citation|done|error` plus JSON `data`. */
export function dispatchSatyaEvent(eventName: string, data: string, handlers: SatyaChatHandlers, assembled: { text: string }) {
  const kind = asSseKind(eventName.trim().toLowerCase());
  if (!kind) return;
  const record = parseJsonRecord(data);

  switch (kind) {
    case "status": {
      handlers.onStatus?.("thinking");
      const message = typeof record?.message === "string" ? record.message.trim() : "";
      if (message) publishSatyaDraftStatusMessage(message);
      return;
    }
    case "token": {
      const token = typeof record?.text === "string" ? record.text : "";
      if (token) {
        assembled.text += token;
        handlers.onToken?.(token);
      }
      return;
    }
    case "citation": {
      const citation = citationFromUnknown(record);
      if (citation) {
        handlers.onStatus?.("citing");
        handlers.onCitation?.(citation);
      }
      return;
    }
    case "done": {
      clearSatyaDraftStatusMessage();
      const finalText = assembled.text;
      if (typeof record?.sessionId === "string" && record.sessionId.trim()) {
        handlers.onSession?.(record.sessionId.trim());
      }
      handlers.onDone?.(finalText);
      return;
    }
    case "error": {
      clearSatyaDraftStatusMessage();
      const message = typeof record?.message === "string"
        ? record.message
        : data || "Satya failed. Mail, Axis PDFs, podcasts, and verified earnings remain the source of truth.";
      handlers.onError?.(message);
      return;
    }
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
    }
  }
}

export async function streamSatyaChat(
  payload: {
    prompt: string;
    families?: SatyaSourceFamily[];
    axisCategories?: AxisResearchCategoryId[];
    workspace?: string;
    voice?: boolean;
    sessionId?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  },
  handlers: SatyaChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const content = payload.prompt.trim();
  const resolved = resolveResultUpdateRetrieval({
    query: content,
    families: payload.families ?? DEFAULT_SATYA_FAMILIES,
    axisCategories: payload.axisCategories,
  });
  const prior = (payload.history ?? [])
    .filter((turn) => turn.content.trim())
    .slice(-8)
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, 1200) }));
  let response: Response;
  try {
    response = await fetch("/api/satya/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream, application/json",
      },
      body: JSON.stringify({
        messages: [...prior, { role: "user", content }],
        workspace: payload.workspace ?? "intelligence",
        voice: payload.voice === true,
        sessionId: payload.sessionId,
        families: resolved.families ?? payload.families ?? DEFAULT_SATYA_FAMILIES,
        axisCategories: resolved.axisCategories ?? payload.axisCategories,
      }),
      signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (signal?.aborted) return;
    handlers.onError?.(cause instanceof Error ? cause.message : "Could not reach Satya.");
    return;
  }

  if (response.status === 404) {
    handlers.onError?.("Satya is not available yet. Mail, Axis PDFs, podcasts, and verified earnings remain the source of truth.");
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream") && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const assembled = { text: "" };
    let buffer = "";
    let sawDone = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        const data = dataLines.join("\n");
        if (!data && eventName === "message") continue;
        dispatchSatyaEvent(eventName, data, handlers, assembled);
        if (eventName.trim().toLowerCase() === "done") sawDone = true;
      }
    }
    if (!sawDone) handlers.onDone?.(assembled.text);
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    handlers.onError?.(response.ok ? "Satya returned an empty response." : `Satya failed (${response.status}). Mail, Axis PDFs, podcasts, and verified earnings remain the source of truth.`);
    return;
  }

  if (!response.ok || body.ok === false || body.disabled) {
    handlers.onError?.(
      typeof body.message === "string"
        ? body.message
        : "Satya is disabled. Mail, Axis PDFs, podcasts, and verified earnings remain the source of truth.",
    );
    return;
  }

  const text = typeof body.text === "string" ? body.text : "";
  const citations = Array.isArray(body.citations) ? body.citations : [];
  if (text) handlers.onToken?.(text);
  for (const item of citations) {
    const citation = citationFromUnknown(item);
    if (citation) handlers.onCitation?.(citation);
  }
  if (typeof body.sessionId === "string" && body.sessionId.trim()) {
    handlers.onSession?.(body.sessionId.trim());
  }
  handlers.onDone?.(text);
}

export type SatyaCorpusPreview = {
  family: SatyaSourceFamily;
  title: string;
  receivedAt: string;
  axisCategory?: string | null;
};

export type SatyaSourcesPayload = {
  families: Partial<Record<SatyaSourceFamily, number>>;
  axisCategories: Partial<Record<AxisResearchCategoryId, number>>;
  recent?: SatyaCorpusPreview[];
};

export type SatyaTaskContext = {
  task: LlmAssistTask;
  hint: string;
  context: string;
  placeholder?: string;
  suggestions?: SatyaSuggestion[];
  subject?: string;
  disabled?: boolean;
  onApplyTree?: (tree: StrategyTreeV1) => void;
};

export function isDashboardSatyaTask(task: LlmAssistTask): boolean {
  switch (task) {
    case "composite":
    case "industry":
    case "framework":
    case "builder":
    case "strategy":
    case "summarize":
      return true;
    case "satya":
      return false;
    default: {
      const _exhaustive: never = task;
      return _exhaustive;
    }
  }
}

export function resolveSatyaWorkspaceSlot(workspace: WorkspaceKey, search = ""): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const section = new URLSearchParams(query).get("section") ?? "";
  switch (workspace) {
    case "investment":
      return "investment";
    case "sectors":
      return section === "s3" ? "sectors-s3" : "sectors-s2";
    case "intelligence":
      return section === "m3" ? "intelligence-m3" : "satya";
    case "builder":
      return "builder";
    case "strategies":
      return "strategies";
    case "health":
      return "health";
    default: {
      const _exhaustive: never = workspace;
      return _exhaustive;
    }
  }
}

export type SatyaFocusSnapshot = {
  families?: SatyaSourceFamily[];
  axisCategories?: AxisResearchCategoryId[];
};

let satyaFocus: SatyaFocusSnapshot = { families: [...DEFAULT_SATYA_FAMILIES] };
const satyaFocusListeners = new Set<() => void>();
const satyaTaskContexts = new Map<string, SatyaTaskContext>();
const satyaTaskListeners = new Set<() => void>();

export function getSatyaTaskContext(slot: string): SatyaTaskContext | null {
  return satyaTaskContexts.get(slot) ?? null;
}

export function setSatyaTaskContext(slot: string, next: SatyaTaskContext | null) {
  if (next) satyaTaskContexts.set(slot, next);
  else satyaTaskContexts.delete(slot);
  for (const listener of satyaTaskListeners) listener();
}

export function subscribeSatyaTaskContext(listener: () => void) {
  satyaTaskListeners.add(listener);
  return () => {
    satyaTaskListeners.delete(listener);
  };
}

export function getSatyaFocus(): SatyaFocusSnapshot {
  return satyaFocus;
}

export function setSatyaFocus(next: SatyaFocusSnapshot) {
  satyaFocus = {
    families: next.families,
    axisCategories: next.axisCategories,
  };
  for (const listener of satyaFocusListeners) listener();
}

export function subscribeSatyaFocus(listener: () => void) {
  satyaFocusListeners.add(listener);
  return () => {
    satyaFocusListeners.delete(listener);
  };
}

export async function completeSatyaWorkspaceTask(
  payload: {
    task: LlmAssistTask;
    prompt: string;
    context?: string;
  },
  handlers: SatyaChatHandlers & { onTree?: (tree: StrategyTreeV1) => void },
  signal?: AbortSignal,
): Promise<void> {
  const prompt = payload.prompt.trim();
  if (!prompt) return;
  handlers.onStatus?.("thinking");
  let response: Response;
  try {
    response = await fetch("/api/llm/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: payload.task,
        prompt,
        context: payload.context ?? "",
      }),
      signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (signal?.aborted) return;
    handlers.onError?.(cause instanceof Error ? cause.message : "Could not reach Satya.");
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    handlers.onError?.(
      response.ok
        ? "Satya returned an empty response."
        : `Satya failed (${response.status}). Source-backed content is unchanged.`,
    );
    return;
  }

  if (!response.ok || body.ok === false || body.disabled) {
    handlers.onError?.(
      typeof body.message === "string"
        ? body.message
        : "Satya is disabled. Paste a Claude, OpenAI, or Gemini key in Settings.",
    );
    return;
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text) handlers.onToken?.(text);
  if (body.tree && typeof body.tree === "object" && !Array.isArray(body.tree)) {
    handlers.onTree?.(body.tree as StrategyTreeV1);
  }
  handlers.onDone?.(text);
}

export async function fetchSatyaSources(signal?: AbortSignal): Promise<SatyaSourcesPayload> {
  const empty: SatyaSourcesPayload = { families: {}, axisCategories: {} };
  try {
    const response = await fetch("/api/satya/sources", { cache: "no-store", signal });
    if (response.status === 404 || !response.ok) return empty;
    const payload = (await response.json()) as {
      families?: unknown;
      counts?: unknown;
      axisCategories?: unknown;
      recent?: unknown;
    };
    const families: Partial<Record<SatyaSourceFamily, number>> = {};
    if (Array.isArray(payload.families)) {
      for (const row of payload.families) {
        if (!row || typeof row !== "object") continue;
        const record = row as { family?: unknown; id?: unknown; count?: unknown };
        const family = asSourceFamily(record.family ?? record.id);
        const count = typeof record.count === "number" ? record.count : Number(record.count);
        if (family && Number.isFinite(count)) families[family] = count;
      }
    } else if (payload.counts && typeof payload.counts === "object") {
      for (const [id, count] of Object.entries(payload.counts as Record<string, unknown>)) {
        const family = asSourceFamily(id);
        const value = typeof count === "number" ? count : Number(count);
        if (family && Number.isFinite(value)) families[family] = value;
      }
    }
    const axisCategories: Partial<Record<AxisResearchCategoryId, number>> = {};
    if (Array.isArray(payload.axisCategories)) {
      for (const row of payload.axisCategories) {
        if (!row || typeof row !== "object") continue;
        const record = row as { id?: unknown; count?: unknown };
        const id = asAxisCategory(record.id);
        const count = typeof record.count === "number" ? record.count : Number(record.count);
        if (id && Number.isFinite(count)) axisCategories[id] = count;
      }
    }
    const recent: SatyaCorpusPreview[] = [];
    if (Array.isArray(payload.recent)) {
      for (const row of payload.recent) {
        if (!row || typeof row !== "object") continue;
        const record = row as { family?: unknown; title?: unknown; receivedAt?: unknown; axisCategory?: unknown };
        const family = asSourceFamily(record.family);
        const title = typeof record.title === "string" ? record.title.trim() : "";
        const receivedAt = typeof record.receivedAt === "string" ? record.receivedAt : "";
        if (!family || !title || !receivedAt) continue;
        recent.push({
          family,
          title,
          receivedAt,
          axisCategory: typeof record.axisCategory === "string" ? record.axisCategory : null,
        });
      }
    }
    return { families, axisCategories, recent };
  } catch {
    return empty;
  }
}

export async function fetchSatyaStatus(signal?: AbortSignal): Promise<SatyaStatusPayload> {
  try {
    const response = await fetch("/api/satya/status", { cache: "no-store", signal });
    if (response.status === 404) {
      return { enabled: false, available: false, disabled: true, message: "Satya is not available yet." };
    }
    const payload = (await response.json()) as SatyaStatusPayload;
    return payload && typeof payload === "object" ? payload : { enabled: false, available: false };
  } catch {
    return { enabled: false, available: false, message: "Satya status is unreachable." };
  }
}

export type SatyaThreadTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: SatyaCitation[];
};

export type SatyaChatListItem = {
  id: string;
  title: string;
  updatedAt: string;
  turns: SatyaThreadTurn[];
};

export type SatyaThreadState = {
  sessionId: string | null;
  turns: SatyaThreadTurn[];
};

const SATYA_VOICE_STORAGE = "satya-voice-uri";
const SATYA_SESSIONS_STORAGE = "satya-sessions-local";

let satyaPopupOpen = false;
const satyaPopupListeners = new Set<() => void>();
let satyaChatsOpen = false;
const satyaChatsListeners = new Set<() => void>();
let satyaThread: SatyaThreadState = { sessionId: null, turns: [] };
const satyaThreadListeners = new Set<() => void>();
let satyaThreadChanged: (() => void) | null = null;

function notifySatyaPopup() {
  for (const listener of satyaPopupListeners) listener();
}

function notifySatyaChats() {
  for (const listener of satyaChatsListeners) listener();
}

export function isSatyaPopupOpen() {
  return satyaPopupOpen;
}

export function setSatyaPopupOpen(open: boolean) {
  satyaPopupOpen = open;
  const chatsWereOpen = satyaChatsOpen;
  if (!open) satyaChatsOpen = false;
  notifySatyaPopup();
  if (!open && chatsWereOpen) notifySatyaChats();
}

export function subscribeSatyaPopup(listener: () => void) {
  satyaPopupListeners.add(listener);
  return () => {
    satyaPopupListeners.delete(listener);
  };
}

export function isSatyaChatsOpen() {
  return satyaChatsOpen;
}

export function setSatyaChatsOpen(open: boolean) {
  satyaChatsOpen = open;
  if (open && !satyaPopupOpen) {
    satyaPopupOpen = true;
    notifySatyaPopup();
  }
  notifySatyaChats();
}

/** Open the global companion on the Chats (Assistant) list. Does not change M-2 canvas. */
export function openSatyaChats() {
  setSatyaChatsOpen(true);
}

export function subscribeSatyaChats(listener: () => void) {
  satyaChatsListeners.add(listener);
  return () => {
    satyaChatsListeners.delete(listener);
  };
}

export function getSatyaThread(): SatyaThreadState {
  return satyaThread;
}

export function onSatyaThreadNotify(listener: () => void) {
  satyaThreadChanged = listener;
}

export function setSatyaThread(next: SatyaThreadState, persist = false) {
  satyaThread = {
    sessionId: next.sessionId,
    turns: next.turns,
  };
  if (persist) persistLocalSatyaSessions(next);
  for (const listener of satyaThreadListeners) listener();
  satyaThreadChanged?.();
}

export function subscribeSatyaThread(listener: () => void) {
  satyaThreadListeners.add(listener);
  return () => {
    satyaThreadListeners.delete(listener);
  };
}

export function satyaThreadTitle(turns: SatyaThreadTurn[]): string {
  const first = turns.find((turn) => turn.role === "user")?.text.trim() ?? "";
  if (!first) return "New chat";
  return first.length > 72 ? `${first.slice(0, 69)}…` : first;
}

function readLocalVoiceUri(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SATYA_VOICE_STORAGE)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function getSatyaVoiceUri(): string {
  return readLocalVoiceUri();
}

export function setSatyaVoiceUri(uri: string) {
  if (typeof window === "undefined") return;
  try {
    if (uri.trim()) window.localStorage.setItem(SATYA_VOICE_STORAGE, uri.trim());
    else window.localStorage.removeItem(SATYA_VOICE_STORAGE);
  } catch {
    /* ignore quota */
  }
}

function turnsFromUnknown(value: unknown, prefix: string): SatyaThreadTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: SatyaThreadTurn[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
    const text = typeof record.text === "string"
      ? record.text
      : typeof record.content === "string"
        ? record.content
        : "";
    if (!role || !text.trim()) return;
    const citations = Array.isArray(record.citations)
      ? record.citations.flatMap((row) => {
        const citation = citationFromUnknown(row);
        return citation ? [citation] : [];
      })
      : [];
    turns.push({
      id: typeof record.id === "string" && record.id.trim() ? record.id : `${prefix}-${role}-${index}`,
      role,
      text,
      citations,
    });
  });
  return turns;
}

function parseChatListItem(value: unknown): SatyaChatListItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;
  const turns = turnsFromUnknown(record.turns ?? record.messages, id);
  const title = typeof record.title === "string" && record.title.trim()
    ? record.title.trim()
    : satyaThreadTitle(turns);
  return {
    id,
    title,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    turns,
  };
}

function readLocalSatyaSessions(): SatyaChatListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SATYA_SESSIONS_STORAGE) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      const item = parseChatListItem(row);
      return item ? [item] : [];
    });
  } catch {
    return [];
  }
}

function sortSessionsNewestFirst(items: SatyaChatListItem[]): SatyaChatListItem[] {
  return [...items].sort((left, right) => {
    const byDate = (right.updatedAt || "").localeCompare(left.updatedAt || "");
    if (byDate !== 0) return byDate;
    return right.id.localeCompare(left.id);
  });
}

function mergeSatyaSessionLists(remote: SatyaChatListItem[], local: SatyaChatListItem[]): SatyaChatListItem[] {
  const byId = new Map<string, SatyaChatListItem>();
  for (const item of local) byId.set(item.id, item);
  for (const item of remote) {
    const prior = byId.get(item.id);
    byId.set(item.id, {
      id: item.id,
      title: item.title || prior?.title || "Satya chat",
      updatedAt: item.updatedAt || prior?.updatedAt || "",
      turns: item.turns.length >= (prior?.turns.length ?? 0) ? item.turns : prior?.turns ?? [],
    });
  }
  return sortSessionsNewestFirst([...byId.values()]).slice(0, 40);
}

function persistLocalSatyaSessions(next: SatyaThreadState, title?: string) {
  if (typeof window === "undefined" || !next.sessionId) return;
  const prior = readLocalSatyaSessions();
  const existing = prior.find((item) => item.id === next.sessionId);
  const items = prior.filter((item) => item.id !== next.sessionId);
  const row: SatyaChatListItem = {
    id: next.sessionId,
    title: title?.trim() || existing?.title || satyaThreadTitle(next.turns),
    updatedAt: new Date().toISOString(),
    turns: next.turns,
  };
  try {
    window.localStorage.setItem(SATYA_SESSIONS_STORAGE, JSON.stringify([row, ...items].slice(0, 40)));
  } catch {
    /* ignore quota */
  }
}

/** Write a session into local Chats storage without loading it onto the M-2 canvas. */
export function persistSatyaThreadLocal(next: SatyaThreadState) {
  persistLocalSatyaSessions(next);
}

export async function fetchSatyaSessions(signal?: AbortSignal): Promise<SatyaChatListItem[]> {
  const local = sortSessionsNewestFirst(readLocalSatyaSessions());
  try {
    const response = await fetch("/api/satya/sessions", { cache: "no-store", signal });
    if (response.status === 403 || response.status === 404 || !response.ok) return local;
    const payload = (await response.json()) as { sessions?: unknown };
    const remote = Array.isArray(payload.sessions)
      ? payload.sessions.flatMap((row) => {
        const item = parseChatListItem(row);
        return item ? [item] : [];
      })
      : [];
    const merged = mergeSatyaSessionLists(remote, local);
    try {
      window.localStorage.setItem(SATYA_SESSIONS_STORAGE, JSON.stringify(merged));
    } catch {
      /* ignore quota */
    }
    return merged;
  } catch {
    return local;
  }
}

function writeLocalSatyaSessions(items: SatyaChatListItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SATYA_SESSIONS_STORAGE,
      JSON.stringify(sortSessionsNewestFirst(items).slice(0, 40)),
    );
  } catch {
    /* ignore quota */
  }
}

export function filterSatyaChatItems(items: SatyaChatListItem[], query: string): SatyaChatListItem[] {
  const needle = query.trim().toLowerCase();
  const sorted = sortSessionsNewestFirst(items);
  if (!needle) return sorted;
  return sorted.filter((item) => item.title.toLowerCase().includes(needle));
}

export async function renameSatyaSession(
  id: string,
  title: string,
  signal?: AbortSignal,
): Promise<SatyaChatListItem[]> {
  const nextTitle = title.trim().slice(0, 120);
  const items = readLocalSatyaSessions();
  if (!id.trim() || !nextTitle) return sortSessionsNewestFirst(items);
  const local = items.map((item) => (item.id === id ? { ...item, title: nextTitle, updatedAt: new Date().toISOString() } : item));
  writeLocalSatyaSessions(local);
  try {
    const response = await fetch("/api/satya/sessions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, title: nextTitle }),
      signal,
      cache: "no-store",
    });
    if (response.status === 403) return sortSessionsNewestFirst(local);
    if (!response.ok) return sortSessionsNewestFirst(local);
  } catch {
    return sortSessionsNewestFirst(local);
  }
  return fetchSatyaSessions(signal);
}

export async function deleteSatyaSession(id: string, signal?: AbortSignal): Promise<SatyaChatListItem[]> {
  const sessionId = id.trim();
  const items = readLocalSatyaSessions();
  if (!sessionId) return sortSessionsNewestFirst(items);
  const local = items.filter((item) => item.id !== sessionId);
  try {
    const response = await fetch(`/api/satya/sessions?id=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      signal,
      cache: "no-store",
    });
    if (response.status === 403) {
      return sortSessionsNewestFirst(items);
    }
    writeLocalSatyaSessions(local);
    if (satyaThread.sessionId === sessionId) {
      setSatyaThread({ sessionId: null, turns: [] });
    }
    if (!response.ok && response.status !== 404) return sortSessionsNewestFirst(local);
  } catch {
    writeLocalSatyaSessions(local);
    if (satyaThread.sessionId === sessionId) {
      setSatyaThread({ sessionId: null, turns: [] });
    }
    return sortSessionsNewestFirst(local);
  }
  return fetchSatyaSessions(signal);
}
