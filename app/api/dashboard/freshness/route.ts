import { readAppleHealthSnapshot } from "../../../health-import-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await readAppleHealthSnapshot();
    return Response.json({
      status: health.status,
      completedHealthThrough: health.completedThrough ?? health.dataDate,
      partialToday: health.partialToday,
      capturedAt: health.capturedAt,
      targetDate: health.targetDate,
      targetPolicy: health.targetPolicy,
      targetLabel: health.targetLabel,
      requiredThrough: health.requiredThrough,
      eligibleThrough: health.eligibleThrough,
      exportCapturedAt: health.exportCapturedAt,
      archiveStatus: health.archiveStatus,
      activeArchive: health.activeArchive,
      rejectedArchive: health.rejectedArchive,
      fallbackReason: health.fallbackReason,
      categoryCoverage: health.categoryCoverage,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ status: "unavailable", message: error instanceof Error ? error.message : String(error) }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
