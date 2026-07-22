import type { ContentDigestSnapshot } from "../../../content-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(process.env.CONTENT_DIGEST_URL ?? "http://127.0.0.1:3003/refresh", { cache: "no-store", signal: AbortSignal.timeout(75000) });
    const snapshot = await response.json() as ContentDigestSnapshot;
    return Response.json(snapshot, { status: response.ok ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ status: "unavailable", message: error instanceof Error ? error.message : "Content digest service unavailable." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
