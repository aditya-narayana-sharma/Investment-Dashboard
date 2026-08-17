#!/usr/bin/env node
import { mkdir, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { BASE_URL, prepareDemoPage, runDemoTour } from "./demo-tour.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts", "demo");
const mp4Path = path.join(outDir, "stratji-dashboard-demo.mp4");
const webmPath = path.join(outDir, "stratji-dashboard-demo.webm");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

async function assertGateway() {
  const health = await fetch(`${BASE_URL}/_flask/health`).catch(() => null);
  if (health?.ok) return;
  const home = await fetch(`${BASE_URL}/?demo=1`).catch(() => null);
  if (home?.ok) return;
  throw new Error(`Dashboard is not reachable at ${BASE_URL}. Start Vinext (npm start) or scripts/start-flask-app.sh`);
}

async function encodeMp4(inputWebm) {
  try {
    await run("ffmpeg", [
      "-y",
      "-i",
      inputWebm,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Path,
    ]);
    return true;
  } catch (error) {
    console.warn("ffmpeg H.264 encode failed; keeping WebM only.", error instanceof Error ? error.message : error);
    return false;
  }
}

await assertGateway();
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  slowMo: Number(process.env.DEMO_SLOWMO_MS ?? 180),
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: 1920, height: 1080 },
  },
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
await prepareDemoPage(page);

let tourError = null;
try {
  await runDemoTour(page);
} catch (error) {
  tourError = error;
  console.warn("Demo tour ended with an error:", error instanceof Error ? error.message : error);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const recorded = await video.path();
    if (recorded && path.resolve(recorded) !== path.resolve(webmPath)) {
      await copyFile(recorded, webmPath);
    }
  }
}

const encoded = await encodeMp4(webmPath);
console.log(encoded ? `Wrote ${mp4Path}` : `Wrote ${webmPath}`);
if (tourError) {
  process.exitCode = 1;
}
