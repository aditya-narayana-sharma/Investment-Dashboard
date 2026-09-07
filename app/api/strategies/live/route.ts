import { currentKiteSession, restoreKiteSession } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";
import { handleTreeLivePreview } from "../../../strategy/strategy-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export async function POST(request: Request) {
  const storedSession = readCookie(request, "kite_dashboard_session");
  if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);
  const response = await handleTreeLivePreview(request);
  const sessionId = currentKiteSession();
  if (!sessionId) return response;
  const headers = new Headers(response.headers);
  headers.set("Set-Cookie", kiteSessionCookie(sessionId));
  return new Response(response.body, { status: response.status, headers });
}
