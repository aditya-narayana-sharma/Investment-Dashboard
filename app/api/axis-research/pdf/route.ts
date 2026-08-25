import { createReadStream, existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { findAxisPdf } from "../../../axis-pdf-roots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve a previously matched Axis Research PDF from the local roots only.
 *
 * Resolution spans both the curated archive and the mailbox attachment store
 * (`axisPdfRoots`); serving only the former left every mail-attachment-only
 * report un-openable from a Satya citation.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";
  const resolved = findAxisPdf(file);
  if (!resolved || !existsSync(resolved)) {
    return NextResponse.json({ error: "Axis Research PDF was not found in the local archive or the mailbox attachment store." }, { status: 404 });
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
