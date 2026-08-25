import type { MacroBandKey, MacroEventKey } from "./dashboard/types";
import { itemText, stableItemKey, type ScenarioEvidenceItem, type ScenarioFrameworkEvent } from "./macro-scenario-evidence";

/**
 * RC-5 - precision layer for macro scenario evidence.
 *
 * The regex rules in `macro-scenario-evidence.ts` are good **recall**: they pull
 * every item that mentions crude, flows, rates, breadth or earnings. They are
 * poor **precision** - their band assignment had to be patched with literal
 * single-article exclusions (`chicken surplus`, `cuddly mascot`, `college
 * major`), and `scenarioBandForItem` returns `null` whenever no band pattern
 * fires. Unbanded items render as `context` in *every* band, so when a band's
 * `supports-range` set is empty all three bands of an event show the same
 * context items and the same framework notes. That is the operator-reported
 * "same source for ALL 3 Oil/War scenarios".
 *
 * This module adds a ranking layer over the *existing candidate pool*. It never
 * introduces a source, and it never trusts the model's word: an assignment
 * survives only when its `groundingSpan` is verbatim present in that item's own
 * text. Anything ungrounded is discarded and the regex verdict stands.
 */

export const MACRO_BAND_KEYS: readonly MacroBandKey[] = ["supportive", "base", "stress"];

export type ScenarioRanking = {
  itemKey: string;
  /** The single band this item supports, or null for context-only. */
  band: MacroBandKey | null;
  /** Model confidence, clamped to 0..1. Used only for ordering. */
  relevance: number;
  /** Verbatim span from the item's own text justifying the band. */
  groundingSpan: string;
};

export type ScenarioRankingIndex = ReadonlyMap<string, ScenarioRanking>;

/** Whitespace/case-insensitive containment, so quoting differences do not fail a real span. */
function normalize(value: string): string {
  return String(value ?? "").toLowerCase().replace(/\s+/gu, " ").trim();
}

export function isGroundedSpan(span: string, item: ScenarioEvidenceItem): boolean {
  const needle = normalize(span);
  // A span shorter than this is not evidence of anything - "oil" appears everywhere.
  if (needle.length < 12) return false;
  return normalize(itemText(item)).includes(needle);
}

function isBandKey(value: unknown): value is MacroBandKey {
  return typeof value === "string" && (MACRO_BAND_KEYS as readonly string[]).includes(value);
}

function clampRelevance(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1, Math.max(0, parsed));
}

/**
 * Validate raw model output against the candidate pool.
 *
 * Drops, rather than repairs, anything that is unknown, duplicated, or whose
 * grounding span is not verbatim in the item. Returns only survivors, so a
 * hallucinating or empty response degrades to the regex path item by item.
 */
export function parseScenarioRanking(
  raw: unknown,
  pool: readonly ScenarioEvidenceItem[],
): ScenarioRankingIndex {
  const byKey = new Map(pool.map((item) => [stableItemKey(item), item] as const));
  const accepted = new Map<string, ScenarioRanking>();
  const rows = raw && typeof raw === "object" && Array.isArray((raw as { rankings?: unknown }).rankings)
    ? (raw as { rankings: unknown[] }).rankings
    : [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const itemKey = typeof record.itemKey === "string" ? record.itemKey : "";
    const item = byKey.get(itemKey);
    // Unknown key: the model invented or mangled an item. Ignore it.
    if (!item) continue;
    // One verdict per item; a second is a contradiction, so keep the first.
    if (accepted.has(itemKey)) continue;

    const band = isBandKey(record.band) ? record.band : null;
    const groundingSpan = typeof record.groundingSpan === "string" ? record.groundingSpan.trim() : "";
    // A band claim without a verbatim span is unfalsifiable - demote to context.
    const grounded = band !== null && isGroundedSpan(groundingSpan, item);

    accepted.set(itemKey, {
      itemKey,
      band: grounded ? band : null,
      relevance: clampRelevance(record.relevance),
      groundingSpan: grounded ? groundingSpan : "",
    });
  }

  return accepted;
}

/** Stable cache key: identical pool + event + model must not re-bill. */
export function scenarioRankingCacheKey(
  pool: readonly ScenarioEvidenceItem[],
  eventKey: MacroEventKey,
  model: string,
): string {
  const keys = pool.map(stableItemKey).sort().join("|");
  let hash = 5381;
  const payload = eventKey + " " + model + " " + keys;
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) + hash + payload.charCodeAt(index)) >>> 0;
  }
  return eventKey + ":" + model + ":" + pool.length + ":" + hash.toString(36);
}

const rankingCache = new Map<string, ScenarioRankingIndex>();
const RANKING_CACHE_LIMIT = 64;

export function readCachedScenarioRanking(key: string): ScenarioRankingIndex | undefined {
  return rankingCache.get(key);
}

export function writeCachedScenarioRanking(key: string, index: ScenarioRankingIndex): void {
  if (rankingCache.size >= RANKING_CACHE_LIMIT) {
    const oldest = rankingCache.keys().next();
    if (!oldest.done) rankingCache.delete(oldest.value);
  }
  rankingCache.set(key, index);
}

export function resetScenarioRankingCache(): void {
  rankingCache.clear();
}

/** Compact prompt payload. Only the candidate pool and the event's own bands. */
export function scenarioRankingPrompt(
  pool: readonly ScenarioEvidenceItem[],
  eventKey: MacroEventKey,
  framework: ScenarioFrameworkEvent,
): string {
  const bands = MACRO_BAND_KEYS.map((bandKey) => {
    const band = framework.bands[bandKey];
    return "- " + bandKey + ": " + band.label + " (" + band.range + ") - " + band.summary + " Response: " + band.action;
  }).join("\n");
  const candidates = pool.map((item) => {
    const text = itemText(item);
    const clipped = text.length > 900 ? text.slice(0, 900) + "..." : text;
    return "- itemKey: " + stableItemKey(item) + "\n  source: " + item.source + " (" + item.time + ")\n  text: " + clipped;
  }).join("\n");
  return [
    "EVENT: " + eventKey + " - " + framework.label,
    "TRANSMISSION: " + framework.evidence,
    "",
    "BANDS:",
    bands,
    "",
    "CANDIDATES:",
    candidates || "- (none)",
  ].join("\n");
}

/**
 * How much of a band's display is actually grounded source evidence rather than
 * framework prose. The UI uses this to say so plainly instead of padding
 * silently to `MIN_SCENARIO_EVIDENCE`.
 */
export function groundedSupportCount(
  pool: readonly ScenarioEvidenceItem[],
  bandKey: MacroBandKey,
  index: ScenarioRankingIndex,
): number {
  let count = 0;
  for (const item of pool) {
    if (index.get(stableItemKey(item))?.band === bandKey) count += 1;
  }
  return count;
}
