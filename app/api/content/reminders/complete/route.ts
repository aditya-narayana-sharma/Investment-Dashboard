export const dynamic = "force-dynamic";

type CompleteBody = {
  id?: string;
  title?: string;
  list?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompleteBody;
    const base = process.env.CONTENT_DIGEST_URL ?? "http://127.0.0.1:3003/refresh";
    const target = new URL(base);
    target.pathname = "/reminders/complete";
    target.search = "";
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: body.id ?? "",
        title: body.title ?? "",
        list: body.list ?? "",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    return Response.json(payload, {
      status: response.ok ? 200 : response.status === 400 ? 400 : 502,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reminders complete service unavailable.",
        blocker:
          "Could not reach the local content digest reminders complete endpoint. The item was NOT marked complete in Apple Reminders.",
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
