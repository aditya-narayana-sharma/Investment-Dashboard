import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

export const REFRESH_STAGES = Object.freeze([
  "service",
  "kite",
  "calendar",
  "mail",
  "axis",
  "reminders",
  "podcasts",
  "sectors",
  "earnings",
  "health",
  "hydrate",
]);

const SOURCE_STAGES = REFRESH_STAGES.filter((stage) => stage !== "hydrate");

export function defaultProgressPaths() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const artifact = process.env.PORTFOLIO_STARTUP_PROGRESS_PATH
    ?? join(root, "artifacts", "private", "startup-progress.json");
  const logCopy = join(homedir(), "Library", "Logs", "PortfolioIntelligence", "startup-progress.json");
  return { artifact, logCopy };
}

export function emptyProgressSnapshot() {
  return {
    schemaVersion: 1,
    stage: "service",
    state: "start",
    label: "Starting Stratji…",
    fraction: 0,
    completed: [],
    failed: [],
    percent: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function percentFromSnapshot(snapshot) {
  const completed = new Set(snapshot?.completed ?? []);
  if (completed.has("hydrate")) return 1;
  const done = SOURCE_STAGES.filter((stage) => completed.has(stage)).length;
  const current = snapshot?.stage;
  const fraction = Number(snapshot?.fraction ?? 0);
  const inProgress = current && current !== "hydrate" && !completed.has(current)
    ? Math.min(Math.max(fraction, 0), 0.99)
    : 0;
  return Number(((done + inProgress) / REFRESH_STAGES.length).toFixed(4));
}

export function mergeProgress(current, event) {
  const stage = String(event.stage || current?.stage || "service");
  const state = String(event.state || "start");
  let completed;
  let failed;
  if (stage === "service" && (state === "start" || state === "ok" || state === "failed")) {
    completed = new Set(state === "start" ? [] : ["service"]);
    failed = new Set(state === "failed" ? ["service"] : []);
  } else {
    completed = new Set(current?.completed ?? []);
    failed = new Set(current?.failed ?? []);
    if (stage !== "service") completed.add("service");
    if (state === "ensure" || state === "ensure-failed") {
      if (!completed.has(stage)) {
        completed.add(stage);
        if (state === "ensure-failed") failed.add(stage);
      }
    } else if (state === "ok" || state === "failed") {
      completed.add(stage);
      if (state === "failed") failed.add(stage);
      else failed.delete(stage);
    }
  }
  const fraction = state === "ok" || state === "failed" || state === "ensure" || state === "ensure-failed"
    ? 1
    : Number.isFinite(Number(event.fraction))
      ? Number(event.fraction)
      : 0;
  const snapshot = {
    schemaVersion: 1,
    stage,
    state: (state === "failed" || state === "ensure-failed") && failed.has(stage)
      ? "failed"
      : (state === "ok" || state === "ensure" || state === "ensure-failed" ? "ok" : state),
    label: event.label || current?.label || "",
    fraction,
    completed: REFRESH_STAGES.filter((item) => completed.has(item)),
    failed: REFRESH_STAGES.filter((item) => failed.has(item)),
    updatedAt: new Date().toISOString(),
  };
  snapshot.percent = percentFromSnapshot(snapshot);
  return snapshot;
}

export function parseProgressLog(text) {
  let snapshot = emptyProgressSnapshot();
  let found = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    const parts = line.split("\t");
    if (parts[0] !== "PROGRESS" || parts.length < 3) continue;
    found = true;
    snapshot = mergeProgress(snapshot, {
      stage: parts[1],
      state: parts[2],
      label: parts.slice(3).join("\t"),
    });
  }
  return found ? snapshot : null;
}

function readSnapshot(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return emptyProgressSnapshot();
  }
}

function writeSnapshotFile(path, snapshot) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(snapshot, null, 2)}\n`);
  renameSync(temp, path);
}

export function readStartupProgress(paths = defaultProgressPaths()) {
  return readSnapshot(paths.artifact);
}

export function writeStartupProgress(event, paths = defaultProgressPaths()) {
  try {
    const current = readSnapshot(paths.artifact);
    const snapshot = mergeProgress(current, event);
    writeSnapshotFile(paths.artifact, snapshot);
    try {
      writeSnapshotFile(paths.logCopy, snapshot);
    } catch {
      // Log-directory copy is best-effort for the native splash.
    }
    return snapshot;
  } catch {
    return mergeProgress(emptyProgressSnapshot(), event);
  }
}

export async function reportContentStage(stage, label, task) {
  writeStartupProgress({ stage, state: "start", label });
  try {
    const value = await task();
    writeStartupProgress({ stage, state: "ok", label: `${label} received.` });
    return { status: "fulfilled", value };
  } catch (reason) {
    writeStartupProgress({ stage, state: "failed", label: `${label} unavailable.` });
    return { status: "rejected", reason };
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const [, , stage, state, ...labelParts] = process.argv;
  if (!stage || !state) {
    process.stderr.write("usage: node scripts/startup-progress.mjs <stage> <start|ok|failed|ensure> [label] [fraction]\n");
    process.exit(1);
  }
  const fractionArg = labelParts.at(-1);
  const hasFraction = fractionArg != null && /^\d+(?:\.\d+)?$/.test(fractionArg);
  const label = (hasFraction ? labelParts.slice(0, -1) : labelParts).join(" ");
  const snapshot = writeStartupProgress({
    stage,
    state,
    label,
    fraction: hasFraction ? Number(fractionArg) : undefined,
  });
  process.stdout.write(`${JSON.stringify(snapshot)}\n`);
}
