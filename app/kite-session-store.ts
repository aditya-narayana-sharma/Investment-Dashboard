import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SESSION_FILE = process.env.KITE_DASHBOARD_SESSION_PATH
  ?? join(process.cwd(), "artifacts", "private", "kite-session.json");

type StoredKiteSession = {
  sessionId: string;
  savedAt: string;
  expiresAt: string;
};

function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** Next Zerodha daily access-token boundary (~06:00 Asia/Kolkata). */
export function nextKiteDailyExpiry(now = new Date()): Date {
  const ist = istParts(now);
  const utcMillis = Date.UTC(ist.year, ist.month - 1, ist.day, ist.hour, ist.minute, ist.second);
  const offset = utcMillis - now.getTime();
  let boundaryUtc = Date.UTC(ist.year, ist.month - 1, ist.day, 6, 0, 0) - offset;
  if (now.getTime() >= boundaryUtc) boundaryUtc += 24 * 60 * 60 * 1000;
  return new Date(boundaryUtc);
}

export function secondsUntilNextKiteExpiry(now = new Date()) {
  return Math.max(60, Math.floor((nextKiteDailyExpiry(now).getTime() - now.getTime()) / 1000));
}

export function kiteSessionCookie(sessionId: string) {
  const maxAge = secondsUntilNextKiteExpiry();
  return `kite_dashboard_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function readPersistedKiteSession(): string | undefined {
  try {
    const raw = readFileSync(SESSION_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredKiteSession;
    if (!parsed.sessionId || !parsed.expiresAt) return undefined;
    if (Date.now() >= Date.parse(parsed.expiresAt)) return undefined;
    return parsed.sessionId;
  } catch {
    return undefined;
  }
}

export function persistKiteSession(sessionId: string | undefined) {
  if (!sessionId) return;
  const payload: StoredKiteSession = {
    sessionId,
    savedAt: new Date().toISOString(),
    expiresAt: nextKiteDailyExpiry().toISOString(),
  };
  mkdirSync(dirname(SESSION_FILE), { recursive: true });
  const temporary = `${SESSION_FILE}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, SESSION_FILE);
}

export function clearPersistedKiteSession() {
  try {
    writeFileSync(SESSION_FILE, "", { mode: 0o600 });
  } catch {
    // ignore missing file
  }
}
