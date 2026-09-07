import { currentKiteSession, placeKiteGtt, restoreKiteSession, type KiteGttRequest } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";

export const dynamic = "force-dynamic";

type GttBody = KiteGttRequest & { confirmation: string };

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Kite rejected the GTT.";
}

function kindLabel(kind: string) {
  return kind === "tsl" ? "TSL" : "GTT";
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return Response.json({ status: "invalid", message: "GTT requests must use JSON." }, { status: 415 });
    }
    const storedSession = readCookie(request, "kite_dashboard_session");
    if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);

    const body = await request.json() as GttBody;
    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    const side = String(body.side ?? "").toUpperCase();
    const quantity = Number(body.quantity);
    const kind = String(body.kind ?? "gtt").toLowerCase() === "tsl" ? "tsl" : "gtt";
    const label = kindLabel(kind);
    const expectedConfirmation = `${label} ${side} ${quantity} ${symbol}`;
    if (body.confirmation?.trim().toUpperCase() !== expectedConfirmation) {
      return Response.json({ status: "confirmation_required", message: `Type ${expectedConfirmation} exactly to create this ${label}.` }, { status: 400 });
    }

    const result = await placeKiteGtt({
      symbol,
      side: side as KiteGttRequest["side"],
      quantity,
      product: body.product,
      triggerPrice: Number(body.triggerPrice),
      limitPrice: Number(body.limitPrice),
      lastPrice: body.lastPrice === undefined ? undefined : Number(body.lastPrice),
      kind,
    });
    const sessionId = currentKiteSession();
    return Response.json({ status: "submitted", message: `${expectedConfirmation} was submitted to Kite.`, result }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...(sessionId ? { "Set-Cookie": kiteSessionCookie(sessionId) } : {}),
      },
    });
  } catch (error) {
    return Response.json({ status: "failed", message: message(error) }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
