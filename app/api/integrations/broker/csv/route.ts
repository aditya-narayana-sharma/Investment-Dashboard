import { loadCsvHoldings, saveCsvHoldings } from "../../../../integrations/broker/csv";
import { loadIntegrationsConfig } from "../../../../integrations/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(loadCsvHoldings() ?? {
    status: "unavailable",
    message: "No CSV holdings import is stored. CSV is cached only and never labelled live.",
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let text = "";
  if (contentType.includes("application/json")) {
    const body = await request.json() as { csv?: string; text?: string };
    text = String(body.csv ?? body.text ?? "");
  } else {
    text = await request.text();
  }
  if (!text.trim()) {
    return Response.json({ status: "invalid", message: "Paste a CSV with symbol and quantity columns." }, { status: 400 });
  }
  const config = loadIntegrationsConfig();
  const saved = saveCsvHoldings(text, config.broker.id);
  return Response.json(saved, { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } });
}
