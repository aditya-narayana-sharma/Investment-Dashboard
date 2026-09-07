/** Client and server used to append this on every failed 5-minute tick. */
const CLIENT_REFRESH_FAILURE_NOTE = /Latest refresh failed; retaining the last validated values\.?/gi;

/** Server retained-snapshot copy that replaced the holdings description. */
const SERVER_RETAINED_FAILURE_NOTES = [
  /Kite refresh failed\b[\s\S]*?Retaining the last validated Kite snapshot until the next five-minute refresh\.?/gi,
  /Zerodha rate limit reached; retaining the last validated Kite snapshot until the next five-minute refresh\.?/gi,
  /Retaining the last validated Kite snapshot until the next five-minute refresh\.?/gi,
];

/**
 * Strip Kite refresh-failure warnings and collapse a note that was appended
 * across refresh ticks. Keeps the last validated holdings description.
 */
export function sanitizeKiteStatusNote(note: string | undefined): string {
  if (!note) return "";
  let cleaned = note.replace(CLIENT_REFRESH_FAILURE_NOTE, " ");
  for (const pattern of SERVER_RETAINED_FAILURE_NOTES) {
    cleaned = cleaned.replace(pattern, " ");
  }
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    if (CLIENT_REFRESH_FAILURE_NOTE.test(part) || /retaining the last validated kite snapshot/i.test(part)) {
      CLIENT_REFRESH_FAILURE_NOTE.lastIndex = 0;
      continue;
    }
    CLIENT_REFRESH_FAILURE_NOTE.lastIndex = 0;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique.join(" ").replace(/\s+/g, " ").trim();
}
