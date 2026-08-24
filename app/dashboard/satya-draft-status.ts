/** Process labels only — never a claim that a source was read or a KPI exists.
 *  Index 0-2 are pinned by tests/satya-draft-status.test.mjs; keep them first. */
export const SATYA_DRAFT_STATUS_PHRASES = [
  "Thinking…",
  "Going through Research…",
  "Analyzing KPIs…",
  "Loading…",
  "Sizing it up…",
  "Fetching…",
] as const;

/** One accent per phrase (same index order); drives the fig-8 loader + text tint. */
export const SATYA_DRAFT_STATUS_COLORS = [
  "#7c5fd4", // Thinking… — violet
  "#3b6bff", // Going through Research… — blue
  "#2eb8a0", // Analyzing KPIs… — teal
  "#e8a317", // Loading… — amber
  "#35b6c8", // Sizing it up… — cyan
  "#e2556d", // Fetching… — rose
] as const;

export const SATYA_DRAFT_STATUS_INTERVAL_MS = 2500;
export const SATYA_DRAFT_STATUS_REDUCED = "Thinking…";
export const SATYA_DRAFT_STATUS_COLOR_REDUCED = SATYA_DRAFT_STATUS_COLORS[0];

export type SatyaDraftStatusStage = "retrieve" | "generate" | "unknown";

let lastSseMessage = "";
const listeners = new Set<() => void>();

function notifySatyaDraftStatusListeners() {
  for (const listener of listeners) listener();
}

export function publishSatyaDraftStatusMessage(message: string) {
  lastSseMessage = message.trim();
  notifySatyaDraftStatusListeners();
}

export function getSatyaDraftStatusMessage() {
  return lastSseMessage;
}

export function clearSatyaDraftStatusMessage() {
  if (!lastSseMessage) return;
  lastSseMessage = "";
  notifySatyaDraftStatusListeners();
}

export function subscribeSatyaDraftStatusMessage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function satyaDraftStatusStageFromSse(message: string): SatyaDraftStatusStage {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("empty") || normalized.includes("no matching")) return "unknown";
  if (
    normalized.includes("draft")
    || normalized.includes("passage")
    || normalized.includes("generat")
    || normalized === "thinking…"
    || normalized === "thinking..."
  ) {
    return "generate";
  }
  if (
    normalized.includes("retriev")
    || normalized.includes("going through research")
  ) {
    return "retrieve";
  }
  return "unknown";
}

export function satyaDraftStatusPinnedPhrase(stage: SatyaDraftStatusStage): string | null {
  switch (stage) {
    case "retrieve":
      return "Going through Research…";
    case "generate":
      return null;
    case "unknown":
      return null;
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export function satyaDraftStatusPhraseFromSse(message: string): string | null {
  return satyaDraftStatusPinnedPhrase(satyaDraftStatusStageFromSse(message));
}

export function satyaDraftStatusPhrase(
  tick: number,
  options?: { reducedMotion?: boolean; stageMessage?: string },
): string {
  if (options?.reducedMotion) return SATYA_DRAFT_STATUS_REDUCED;
  const pinned = options?.stageMessage
    ? satyaDraftStatusPhraseFromSse(options.stageMessage)
    : null;
  if (pinned) return pinned;
  const count = SATYA_DRAFT_STATUS_PHRASES.length;
  const index = ((tick % count) + count) % count;
  return SATYA_DRAFT_STATUS_PHRASES[index] ?? SATYA_DRAFT_STATUS_REDUCED;
}

/** Accent for a phrase string; falls back to the reduced-motion accent. */
export function satyaDraftStatusColorForPhrase(phrase: string): string {
  const index = SATYA_DRAFT_STATUS_PHRASES.indexOf(phrase as (typeof SATYA_DRAFT_STATUS_PHRASES)[number]);
  return SATYA_DRAFT_STATUS_COLORS[index] ?? SATYA_DRAFT_STATUS_COLOR_REDUCED;
}

/** Accent matching the phrase that satyaDraftStatusPhrase() would show. */
export function satyaDraftStatusColor(
  tick: number,
  options?: { reducedMotion?: boolean; stageMessage?: string },
): string {
  return satyaDraftStatusColorForPhrase(satyaDraftStatusPhrase(tick, options));
}
