import { currentKiteSession, getKiteSnapshot, restoreKiteSession } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export async function GET(request: Request) {
  const storedSession = readCookie(request, "kite_dashboard_session");
  // Adopt cookie only when the process has no MCP session yet (do not clobber live auth).
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);
  const snapshot = await getKiteSnapshot();
  const sessionId = currentKiteSession();
  const headers: Record<string, string> = { "Cache-Control": "no-store, max-age=0" };
  if (sessionId) headers["Set-Cookie"] = kiteSessionCookie(sessionId);
  return Response.json(snapshot, {
    status: snapshot.status === "unavailable" ? 503 : 200,
    headers,
  });
}
