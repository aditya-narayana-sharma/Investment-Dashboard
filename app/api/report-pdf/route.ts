const MAX_REPORT_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TTL_MS = 5 * 60 * 1000;

type PreparedPdf = {
  bytes: ArrayBuffer;
  createdAt: number;
  filename: string;
};

const preparedPdfs = new Map<string, PreparedPdf>();

function cleanExpired(now = Date.now()) {
  for (const [id, report] of preparedPdfs) {
    if (now - report.createdAt > DOWNLOAD_TTL_MS) preparedPdfs.delete(id);
  }
}

function safeFilename(value: string | null) {
  const fallback = `Portfolio_Investment_Brief_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (!value) return fallback;
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

async function renderToMacDownloads(report: ArrayBuffer, filename: string) {
  try {
    const response = await fetch("http://127.0.0.1:3002/render", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Report-Filename": filename },
      body: report.slice(0),
    });
    if (!response.ok) return { error: await response.text() };
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 5 || bytes.byteLength > MAX_PDF_BYTES || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return { error: "The PDF helper returned an invalid document." };
    }
    return { bytes };
  } catch {
    return { error: "The local PDF helper is unavailable." };
  }
}

export async function POST(request: Request) {
  cleanExpired();
  const report = await request.arrayBuffer();
  if (report.byteLength < 20 || report.byteLength > MAX_REPORT_BYTES) {
    return Response.json({ error: "Invalid report payload size." }, { status: 400 });
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(report)) as { pages?: unknown };
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0 || parsed.pages.length > 12 || parsed.pages.some((page) => typeof page !== "string" || !page.toLowerCase().includes("<html"))) {
      return Response.json({ error: "Payload does not contain valid report pages." }, { status: 415 });
    }
  } catch {
    return Response.json({ error: "Payload is not valid JSON." }, { status: 415 });
  }

  const filename = safeFilename(request.headers.get("X-Report-Filename"));
  const rendered = await renderToMacDownloads(report, filename);
  if (!rendered.bytes) return Response.json({ error: rendered.error || "Could not render the PDF." }, { status: 503 });

  const id = crypto.randomUUID();
  preparedPdfs.set(id, {
    bytes: rendered.bytes,
    createdAt: Date.now(),
    filename,
  });
  if (preparedPdfs.size > 4) preparedPdfs.delete(preparedPdfs.keys().next().value!);

  return Response.json(
    { downloadUrl: `/api/report-pdf?id=${encodeURIComponent(id)}`, filename, savedToDownloads: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  cleanExpired();
  const id = new URL(request.url).searchParams.get("id");
  const report = id ? preparedPdfs.get(id) : undefined;
  if (!id || !report) return new Response("PDF download expired or was not found.", { status: 404 });

  return new Response(report.bytes, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": String(report.bytes.byteLength),
      "Content-Type": "application/pdf",
    },
  });
}
