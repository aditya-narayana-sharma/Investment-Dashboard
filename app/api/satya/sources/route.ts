import { buildEarningsSnapshot } from "../../../earnings-verify";
import { earningsCalendar } from "../../../portfolio-data";
import { intelligenceEvidenceDateKey } from "../../../dashboard/intelligence-daily-actions";
import { listRecentSatyaCorpusDocuments, loadSatyaCatalog } from "../../../satya/retrieve.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

function verifiedEarningsCount() {
  const snapshot = buildEarningsSnapshot(earningsCalendar);
  if (snapshot.status === "unavailable") return 0;
  return snapshot.events.filter((event) => (
    event.reported && event.kpis.some((kpi) => kpi.value.trim())
  )).length;
}

/** Family and Axis category counts for briefing chips. Sender emails stay off Tailscale/LAN clients. */
export async function GET() {
  const catalog = await loadSatyaCatalog();
  const earningsCount = verifiedEarningsCount();
  const recent = listRecentSatyaCorpusDocuments(intelligenceEvidenceDateKey());
  return Response.json({
    asOf: catalog.asOf,
    families: [
      ...catalog.families,
      { family: "earnings", label: "Earnings KPIs", count: earningsCount },
    ],
    axisCategories: catalog.axisCategories ?? [],
    recent,
  }, { headers: NO_STORE });
}
