import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.PDF_DOWNLOAD_PORT || "3002", 10);
const MAX_REPORT_BYTES = 12 * 1024 * 1024;
const downloadsDirectory = join(homedir(), "Downloads");
const chromeCandidates = [
  process.env.PDF_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter(Boolean);
const ghostscriptCandidates = [
  process.env.PDF_GHOSTSCRIPT_PATH,
  "/usr/local/bin/gs",
  "/opt/homebrew/bin/gs",
].filter(Boolean);

function respond(response, status, body, headers = {}) {
  response.writeHead(status, { "Cache-Control": "no-store", ...headers });
  response.end(body);
}

function safeFilename(value) {
  const fallback = `Portfolio_Investment_Brief_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (!value) return fallback;
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REPORT_BYTES) throw Object.assign(new Error("Report payload exceeds the 12 MB limit."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw Object.assign(new Error("Google Chrome or Chromium was not found."), { status: 503 });
}

async function findGhostscript() {
  for (const candidate of ghostscriptCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw Object.assign(new Error("Ghostscript was not found."), { status: 503 });
}

async function renderPdf(payload, filename) {
  let pages;
  try {
    pages = JSON.parse(payload.toString("utf8")).pages;
  } catch {
    throw Object.assign(new Error("Payload is not valid JSON."), { status: 415 });
  }
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 12 || pages.some((page) => typeof page !== "string" || !page.toLowerCase().includes("<html"))) {
    throw Object.assign(new Error("Payload does not contain valid report pages."), { status: 415 });
  }

  const chrome = await findChrome();
  const ghostscript = await findGhostscript();
  const workingDirectory = await mkdtemp(join(tmpdir(), "portfolio-report-"));
  const profilePath = join(workingDirectory, "chrome-profile");
  const outputPath = join(downloadsDirectory, filename);
  try {
    await mkdir(downloadsDirectory, { recursive: true });
    try {
      await access(outputPath);
      throw Object.assign(new Error("A report with this timestamp already exists."), { status: 409 });
    } catch (error) {
      if (error?.status === 409) throw error;
    }
    const pagePdfs = [];
    for (const [index, html] of pages.entries()) {
      const sourcePath = join(workingDirectory, `page-${index + 1}.html`);
      const pagePdf = join(workingDirectory, `page-${index + 1}.pdf`);
      await writeFile(sourcePath, html, { mode: 0o600 });
      await execFileAsync(chrome, [
        "--headless=new",
        "--disable-background-networking",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        `--user-data-dir=${profilePath}`,
        `--print-to-pdf=${pagePdf}`,
        pathToFileURL(sourcePath).href,
      ], { maxBuffer: 2 * 1024 * 1024, timeout: 60_000 });
      pagePdfs.push(pagePdf);
    }
    await execFileAsync(ghostscript, [
      "-dBATCH",
      "-dNOPAUSE",
      "-q",
      "-sDEVICE=pdfwrite",
      `-sOutputFile=${outputPath}`,
      ...pagePdfs,
    ], { maxBuffer: 2 * 1024 * 1024, timeout: 60_000 });
    const pdf = await readFile(outputPath);
    if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw Object.assign(new Error("Chrome did not produce a valid PDF."), { status: 500 });
    }
    return pdf;
  } finally {
    await rm(workingDirectory, { force: true, recursive: true });
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    respond(response, 200, "ok", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/render") {
    respond(response, 404, "Not found.", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const filename = safeFilename(request.headers["x-report-filename"]);
    const pdf = await renderPdf(await readBody(request), filename);
    respond(response, 200, pdf, {
      "Content-Length": String(pdf.length),
      "Content-Type": "application/pdf",
      "X-Report-Filename": filename,
    });
  } catch (error) {
    respond(response, error?.status || 500, error?.message || "Could not render the report.", { "Content-Type": "text/plain; charset=utf-8" });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`PDF download helper listening on http://${HOST}:${PORT}\n`);
});
