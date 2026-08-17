import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mergeProgress, parseProgressLog, percentFromSnapshot, REFRESH_STAGES } from "../scripts/startup-progress.mjs";

test("startup progress percent moves through named stages and never hits 100 before hydrate", () => {
  assert.deepEqual([...REFRESH_STAGES], [
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

  let snapshot = mergeProgress(null, { stage: "service", state: "ok", label: "Service up." });
  const afterService = percentFromSnapshot(snapshot);
  snapshot = mergeProgress(snapshot, { stage: "kite", state: "start", label: "Refreshing Kite…" });
  const kiteStart = percentFromSnapshot(snapshot);
  snapshot = mergeProgress(snapshot, { stage: "kite", state: "ok", label: "Kite received." });
  const kiteDone = percentFromSnapshot(snapshot);
  snapshot = mergeProgress(snapshot, { stage: "mail", state: "ok", label: "Mail received." });
  const afterMail = percentFromSnapshot(snapshot);
  snapshot = mergeProgress(snapshot, { stage: "calendar", state: "failed", label: "Calendar unavailable." });
  const afterFailedCalendar = percentFromSnapshot(snapshot);

  assert.ok(afterService > 0);
  assert.equal(kiteStart, afterService);
  assert.ok(kiteDone > kiteStart);
  assert.ok(afterMail > kiteDone);
  assert.ok(afterFailedCalendar > afterMail);
  assert.ok(afterFailedCalendar < 1);
  assert.ok(snapshot.failed.includes("calendar"));
  assert.ok(snapshot.completed.includes("calendar"));
  assert.ok(!snapshot.completed.includes("hydrate"));
});

test("PROGRESS log lines parse into multiple named stages", () => {
  const parsed = parseProgressLog([
    "Complete dashboard refresh audit",
    "PROGRESS\tkite\tstart\tRefreshing Kite holdings…",
    "PROGRESS\tkite\tok\tKite snapshot received.",
    "PROGRESS\tmail\tstart\tRefreshing iCloud Newsletters…",
    "PROGRESS\tcalendar\tok\tApple Calendar received.",
    "PROGRESS\treminders\tfailed\tApple Reminders stale or unavailable.",
    "PROGRESS\tpodcasts\tok\tApple Podcasts received.",
  ].join("\n"));

  assert.ok(parsed);
  assert.equal(parsed.stage, "podcasts");
  assert.ok(parsed.completed.includes("kite"));
  assert.ok(parsed.completed.includes("calendar"));
  assert.ok(parsed.completed.includes("reminders"));
  assert.ok(parsed.failed.includes("reminders"));
  assert.ok(percentFromSnapshot(parsed) > percentFromSnapshot({
    completed: ["service", "kite"],
    stage: "mail",
    fraction: 0,
  }));
  assert.ok(percentFromSnapshot(parsed) < 1);
});

test("write-startup-progress.py failed sources still bump percent", async () => {
  const dir = mkdtempSync(join(fileURLToPath(new URL("../artifacts", import.meta.url)), "progress-test-"));
  const artifact = join(dir, "startup-progress.json");
  try {
    const { spawnSync } = await import("node:child_process");
    const script = fileURLToPath(new URL("../scripts/write-startup-progress.py", import.meta.url));
    const env = { ...process.env, PORTFOLIO_STARTUP_PROGRESS_PATH: artifact };
    const kite = spawnSync("python3", [script, dir, "kite", "failed", "Kite unavailable."], { env, encoding: "utf8" });
    assert.equal(kite.status, 0, kite.stderr);
    const mail = spawnSync("python3", [script, dir, "mail", "ok", "Mail received."], { env, encoding: "utf8" });
    assert.equal(mail.status, 0, mail.stderr);
    const snapshot = JSON.parse(readFileSync(artifact, "utf8"));
    assert.ok(snapshot.completed.includes("kite"));
    assert.ok(snapshot.failed.includes("kite"));
    assert.ok(snapshot.completed.includes("mail"));
    assert.ok(snapshot.percent > 0.1);
    assert.ok(snapshot.percent < 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a new service ok resets completed so percent is not stuck at 91%", () => {
  let snapshot = mergeProgress(null, { stage: "service", state: "ok", label: "Service up." });
  for (const stage of ["kite", "mail", "axis", "calendar", "reminders", "podcasts", "sectors", "earnings", "health"]) {
    snapshot = mergeProgress(snapshot, { stage, state: "ok", label: `${stage} received.` });
  }
  const almostDone = percentFromSnapshot(snapshot);
  assert.ok(almostDone > 0.8);
  assert.ok(almostDone < 1);

  snapshot = mergeProgress(snapshot, { stage: "service", state: "ok", label: "Local Stratji service is up." });
  snapshot = mergeProgress(snapshot, { stage: "kite", state: "start", label: "Refreshing Kite holdings…" });
  const kiteRestart = percentFromSnapshot(snapshot);
  assert.ok(kiteRestart < 0.2);
  assert.equal(snapshot.stage, "kite");
  assert.deepEqual(snapshot.completed, ["service"]);
});

test("Mail timeout/fail still increases percent and does not pin 91%", () => {
  let snapshot = mergeProgress(null, { stage: "service", state: "ok", label: "Service up." });
  snapshot = mergeProgress(snapshot, { stage: "kite", state: "ok", label: "Kite received." });
  const afterKite = percentFromSnapshot(snapshot);
  snapshot = mergeProgress(snapshot, { stage: "mail", state: "start", label: "Refreshing iCloud Newsletters…" });
  const mailStart = percentFromSnapshot(snapshot);
  snapshot = mergeProgress(snapshot, { stage: "mail", state: "failed", label: "iCloud Newsletters stale or unavailable." });
  const mailFailed = percentFromSnapshot(snapshot);
  snapshot = mergeProgress(snapshot, { stage: "axis", state: "ok", label: "Axis Research mailbox received." });
  const afterAxis = percentFromSnapshot(snapshot);

  assert.equal(snapshot.stage, "axis");
  assert.ok(snapshot.failed.includes("mail"));
  assert.ok(snapshot.completed.includes("mail"));
  assert.equal(mailStart, afterKite);
  assert.ok(mailFailed > mailStart);
  assert.ok(afterAxis > mailFailed);
  assert.ok(afterAxis < 0.5);
});

test("PROGRESS log resets on a later service line so history does not freeze at 91%", () => {
  const parsed = parseProgressLog([
    "PROGRESS\tservice\tok\tLocal Stratji service is up.",
    "PROGRESS\tkite\tok\tKite snapshot received.",
    "PROGRESS\tmail\tok\tMail received.",
    "PROGRESS\thealth\tfailed\tHealth snapshot stale or unavailable.",
    "Complete dashboard refresh audit",
    "PROGRESS\tservice\tok\tLocal Stratji service is up.",
    "PROGRESS\tkite\tstart\tRefreshing Kite holdings…",
    "PROGRESS\tmail\tstart\tRefreshing iCloud Newsletters…",
  ].join("\n"));

  assert.ok(parsed);
  assert.equal(parsed.stage, "mail");
  assert.ok(!parsed.completed.includes("health"));
  assert.ok(!parsed.completed.includes("mail"));
  assert.ok(percentFromSnapshot(parsed) < 0.25);
});
