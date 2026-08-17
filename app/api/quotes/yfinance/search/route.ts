import { NextResponse } from "next/server";
import { loadYfinanceQuoteKpis, searchYfinanceInstruments } from "../../../../strategy/yfinance-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, max-age=0" };

/** GET /api/quotes/yfinance/search?query=reliance  or  ?symbols=RELIANCE,TCS */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").trim();
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!query && !symbols.length) {
    return NextResponse.json({
      status: "ok",
      query: "",
      message: "",
      instruments: [],
    }, { headers: HEADERS });
  }

  const snapshot = query
    ? await searchYfinanceInstruments(query)
    : await loadYfinanceQuoteKpis(symbols);
  const httpStatus = snapshot.status === "unavailable" && snapshot.instruments.length === 0 ? 503 : 200;
  return NextResponse.json(snapshot, { status: httpStatus, headers: HEADERS });
}
