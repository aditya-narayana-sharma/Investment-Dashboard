import { getGrowwSnapshot } from "../../../groww-live-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getGrowwSnapshot();
  return Response.json(snapshot, {
    // `partial` still carries real data, so it is a 200 like Kite.
    status: snapshot.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
