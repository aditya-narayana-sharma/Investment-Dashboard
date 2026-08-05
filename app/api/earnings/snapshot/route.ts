import { earningsCalendar } from "../../../portfolio-data";
import { buildEarningsSnapshot } from "../../../earnings-verify";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = buildEarningsSnapshot(earningsCalendar);

  return Response.json(snapshot, {
    status: snapshot.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
