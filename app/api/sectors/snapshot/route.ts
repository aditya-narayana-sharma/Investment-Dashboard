import { getPublicSectorMarketSnapshot, getSectorMarketSnapshot } from "../../../sector-live-server";
import { restoreKiteSession } from "../../../kite-live-server";
import { sectorCompanies } from "../../../sector-company-data";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string) {
  const prefix = name + "=";
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("sector") ?? "pharma";
  const sectorId = requested in sectorCompanies ? requested : "pharma";
  const headers = { "Cache-Control": "no-store, max-age=0" };
  const storedSession = readCookie(request, "kite_dashboard_session");
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);
  try {
    return Response.json(await getSectorMarketSnapshot(sectorId), { headers });
  } catch {
    return Response.json(await getPublicSectorMarketSnapshot(sectorId, "Live Kite sector data is unavailable."), { headers });
  }
}
