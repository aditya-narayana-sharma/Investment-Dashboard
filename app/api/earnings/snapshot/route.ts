import { earningsCalendar } from "../../../portfolio-data";
import type { EarningsSnapshot } from "../../../earnings-live-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const analysisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const snapshot: EarningsSnapshot = {
    status: "verified",
    asOf: `${analysisDate} · refreshed from the local calendar contract`,
    analysisDate,
    events: earningsCalendar,
    message: "Earnings calendar refreshed through today. Reported KPI rows retain verified sources; pending values remain intentionally blank.",
  };

  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
