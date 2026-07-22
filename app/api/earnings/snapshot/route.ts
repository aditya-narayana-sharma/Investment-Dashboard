import { earningsCalendar } from "../../../portfolio-data";
import { buildEarningsSnapshot } from "../../../earnings-verify";

export const dynamic = "force-dynamic";

export async function GET() {
  const analysisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const snapshot = buildEarningsSnapshot(earningsCalendar, analysisDate);

  return Response.json(snapshot, {
    status: snapshot.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
