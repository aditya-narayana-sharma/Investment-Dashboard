import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const REFRESH_STAGES = [
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
] as const;

export type RefreshStageId = (typeof REFRESH_STAGES)[number];

const SOURCE_STAGES = REFRESH_STAGES.filter((stage) => stage !== "hydrate");

export type StartupProgressEvent = {
  stage: string;
  state: "start" | "ok" | "failed" | "ensure" | "ensure-failed";
  label?: string;
  fraction?: number;
};

export type StartupProgressSnapshot = {
  schemaVersion: number;
  stage: string;
  state: string;
  label: string;
  fraction: number;
  completed: string[];
  failed: string[];
  percent: number;
  updatedAt: string;
};

function progressPaths() {
  const root = process.env.STRATJI_REPO_ROOT || process.cwd();
  return {
    artifact: process.env.PORTFOLIO_STARTUP_PROGRESS_PATH
      ?? join(root, "artifacts", "private", "startup-progress.json"),
    logCopy: join(homedir(), "Library", "Logs", "PortfolioIntelligence", "startup-progress.json"),
  };
}

export function percentFromSnapshot(snapshot: Pick<StartupProgressSnapshot, "completed" | "stage" | "fraction">): number {
  const completed = new Set(snapshot.completed ?? []);
  if (completed.has("hydrate")) return 1;
  const done = SOURCE_STAGES.filter((stage) => completed.has(stage)).length;
  const current = snapshot.stage;
  const fraction = Number(snapshot.fraction ?? 0);
  const inProgress = current && current !== "hydrate" && !completed.has(current)
    ? Math.min(Math.max(fraction, 0), 0.99)
    : 0;
  return Number(((done + inProgress) / REFRESH_STAGES.length).toFixed(4));
}

function readSnapshot(path: string): StartupProgressSnapshot {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as StartupProgressSnapshot;
  } catch {
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
}

function writeSnapshotFile(path: string, snapshot: StartupProgressSnapshot) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(snapshot, null, 2)}\n`);
  renameSync(temp, path);
}

export function writeStartupProgress(event: StartupProgressEvent): StartupProgressSnapshot | null {
  try {
    const paths = progressPaths();
    const current = readSnapshot(paths.artifact);
    const stage = event.stage || current.stage || "service";
    let completed: Set<string>;
    let failed: Set<string>;
    if (stage === "service" && (event.state === "start" || event.state === "ok" || event.state === "failed")) {
      completed = new Set(event.state === "start" ? [] : ["service"]);
      failed = new Set(event.state === "failed" ? ["service"] : []);
    } else {
      completed = new Set(current.completed ?? []);
      failed = new Set(current.failed ?? []);
      if (stage !== "service") completed.add("service");
      if (event.state === "ensure" || event.state === "ensure-failed") {
        if (!completed.has(stage)) {
          completed.add(stage);
          if (event.state === "ensure-failed") failed.add(stage);
        }
      } else if (event.state === "ok" || event.state === "failed") {
        completed.add(stage);
        if (event.state === "failed") failed.add(stage);
        else failed.delete(stage);
      }
    }
    const fraction = event.state === "ok" || event.state === "failed" || event.state === "ensure" || event.state === "ensure-failed"
      ? 1
      : Number.isFinite(event.fraction)
        ? Number(event.fraction)
        : 0;
    const snapshot: StartupProgressSnapshot = {
      schemaVersion: 1,
      stage,
      state: (event.state === "failed" || event.state === "ensure-failed") && failed.has(stage)
        ? "failed"
        : (event.state === "ok" || event.state === "ensure" || event.state === "ensure-failed" ? "ok" : event.state),
      label: event.label || current.label || "",
      fraction,
      completed: REFRESH_STAGES.filter((item) => completed.has(item)),
      failed: REFRESH_STAGES.filter((item) => failed.has(item)),
      percent: 0,
      updatedAt: new Date().toISOString(),
    };
    snapshot.percent = percentFromSnapshot(snapshot);
    writeSnapshotFile(paths.artifact, snapshot);
    try {
      writeSnapshotFile(paths.logCopy, snapshot);
    } catch {
      // Log-directory copy is best-effort for the native splash.
    }
    return snapshot;
  } catch {
    return null;
  }
}
