import type { ContentDigestSnapshot } from "../../../content-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1" || url.searchParams.has("startup");
    const base = process.env.CONTENT_DIGEST_URL ?? "http://127.0.0.1:3003/refresh";
    const target = new URL(base);
    if (force) target.searchParams.set("force", "1");
    const response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(300_000) });
    const snapshot = await response.json() as ContentDigestSnapshot;
    return Response.json(snapshot, { status: response.ok ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ status: "unavailable", message: error instanceof Error ? error.message : "Content digest service unavailable." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
