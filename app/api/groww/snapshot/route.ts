import { getGrowwSnapshot } from "../../../groww-live-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getGrowwSnapshot();
  return Response.json(snapshot, {
    status: snapshot.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
