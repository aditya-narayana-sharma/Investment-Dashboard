import { NextResponse } from "next/server";
import { restoreKiteSession, searchKiteCashInstruments } from "../../../kite-live-server";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export async function GET(request: Request) {
  try {
    const storedSession = readCookie(request, "kite_dashboard_session");
    if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") ?? "").trim();
    const exchange = (url.searchParams.get("exchange") ?? "NSE").trim().toUpperCase();
    if (!query) return NextResponse.json({ status: "invalid", message: "query is required", instruments: [] }, { status: 400 });
    const instruments = await searchKiteCashInstruments(query, exchange, 20);
    return NextResponse.json({ status: "live_catalogue", instruments }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({
      status: "unavailable",
      message: error instanceof Error ? error.message : "Kite instrument catalogue unavailable.",
      instruments: [],
    }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
