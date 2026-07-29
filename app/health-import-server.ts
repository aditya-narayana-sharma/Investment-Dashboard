import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { HealthLiveSnapshot } from "./health-live-types";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const exportRoot = process.env.APPLE_HEALTH_EXPORT_DIR ?? `${process.env.HOME}/Library/Mobile Documents/com~apple~CloudDocs/Health/apple_health_export`;
export const healthSnapshotPath = process.env.PORTFOLIO_HEALTH_SNAPSHOT_PATH ?? path.join(root, "artifacts/private/health-snapshot.json");

export async function refreshAppleHealth(): Promise<HealthLiveSnapshot> {
  await execFileAsync("/bin/bash", [path.join(root, "scripts/refresh-apple-health.sh")], {
    timeout: 30 * 60 * 1000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      APPLE_HEALTH_EXPORT_DIR: exportRoot,
      PORTFOLIO_HEALTH_SNAPSHOT_PATH: healthSnapshotPath,
    },
  });
  return JSON.parse(await readFile(healthSnapshotPath, "utf8")) as HealthLiveSnapshot;
}

export async function readAppleHealthSnapshot(): Promise<HealthLiveSnapshot> {
  return JSON.parse(await readFile(healthSnapshotPath, "utf8")) as HealthLiveSnapshot;
}
