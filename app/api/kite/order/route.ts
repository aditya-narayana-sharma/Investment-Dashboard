import { currentKiteSession, placeKiteOrder, restoreKiteSession, type KiteOrderRequest } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";

export const dynamic = "force-dynamic";

type OrderBody = KiteOrderRequest & { confirmation: string };

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Kite rejected the order.";
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return Response.json({ status: "invalid", message: "Order requests must use JSON." }, { status: 415 });
    }
    const storedSession = readCookie(request, "kite_dashboard_session");
    if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);

    const body = await request.json() as OrderBody;
    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    const side = String(body.side ?? "").toUpperCase();
    const quantity = Number(body.quantity);
    const expectedConfirmation = `${side} ${quantity} ${symbol}`;
    if (body.confirmation?.trim().toUpperCase() !== expectedConfirmation) {
      return Response.json({ status: "confirmation_required", message: `Type ${expectedConfirmation} exactly to place this order.` }, { status: 400 });
    }

    const result = await placeKiteOrder({
      symbol,
      side: side as KiteOrderRequest["side"],
      quantity,
      product: body.product,
      orderType: body.orderType,
      price: body.price === undefined ? undefined : Number(body.price),
      triggerPrice: body.triggerPrice === undefined ? undefined : Number(body.triggerPrice),
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
