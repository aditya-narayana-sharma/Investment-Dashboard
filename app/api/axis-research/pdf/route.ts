import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function archiveRoot() {
  return process.env.AXIS_PDF_ARCHIVE_PATH
    ?? `${process.env.HOME ?? ""}/Downloads/Axis Research`;
}

function findPdfInArchive(root: string, fileName: string): string | null {
  const base = basename(fileName);
  if (!root || !base || !/\.pdf$/i.test(base) || base.includes("..") || base.includes(sep)) return null;
  const stack = [resolve(root)];
  const rootResolved = stack[0];
  while (stack.length) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "Icon\r") continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (/duplicates|_try/i.test(entry.name)) continue;
        stack.push(path);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase() === base.toLowerCase()) {
        const resolvedPath = resolve(path);
        if (resolvedPath === rootResolved || resolvedPath.startsWith(`${rootResolved}${sep}`)) {
          return resolvedPath;
        }
      }
    }
  }
  return null;
}

/** Serve a previously matched Axis Research PDF from the local archive only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";
  const resolved = findPdfInArchive(archiveRoot(), file);
  if (!resolved || !existsSync(resolved)) {
    return NextResponse.json({ error: "Axis Research PDF was not found in the local archive." }, { status: 404 });
  }

  let size = 0;
  try {
    size = statSync(resolved).size;
  } catch {
    return NextResponse.json({ error: "Axis Research PDF is unreadable." }, { status: 404 });
  }

  const stream = createReadStream(resolved);
  const body = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${basename(resolved).replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}
