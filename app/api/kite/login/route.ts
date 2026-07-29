import { currentKiteSession, requestKiteLoginUrl, restoreKiteSession } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export async function GET(request: Request) {
  const storedSession = readCookie(request, "kite_dashboard_session");
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const redirect = url.searchParams.get("redirect") === "1";

  try {
    const loginUrl = await requestKiteLoginUrl(force);
    const sessionId = currentKiteSession();
    const headers: Record<string, string> = { "Cache-Control": "no-store, max-age=0" };
    if (sessionId) headers["Set-Cookie"] = kiteSessionCookie(sessionId);
    if (redirect) {
      headers.Location = loginUrl;
      return new Response(null, { status: 302, headers });
    }
    return Response.json({ status: "ok", force, loginUrl }, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create a Kite login URL";
    return Response.json({ status: "error", message }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
