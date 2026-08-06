import { getSectorNewsSnapshot } from "../../../sector-news-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.has("refresh")
    || new URL(request.url).searchParams.has("startup");
  const headers = { "Cache-Control": "no-store, max-age=0" };
  try {
    return Response.json(await getSectorNewsSnapshot(force), { headers });
  } catch (error) {
    return Response.json({
      status: "unavailable",
      asOf: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Sector news aggregation failed.",
      sources: [],
      items: [],
    }, { status: 503, headers });
  }
}
