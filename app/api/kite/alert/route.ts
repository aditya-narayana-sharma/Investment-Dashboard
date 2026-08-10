import { currentKiteSession, placeKiteAlert, restoreKiteSession, type KiteAlertRequest } from "../../../kite-live-server";
import { kiteSessionCookie } from "../../../kite-session-store";

export const dynamic = "force-dynamic";

type AlertBody = KiteAlertRequest & { confirmation: string };

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Kite rejected the alert.";
}

function directionLabel(direction: string) {
  switch (direction) {
    case "above":
      return "ABOVE";
    case "below":
      return "BELOW";
    default:
      return "";
  }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return Response.json({ status: "invalid", message: "Alert requests must use JSON." }, { status: 415 });
    }
    const storedSession = readCookie(request, "kite_dashboard_session");
    if (storedSession) restoreKiteSession(decodeURIComponent(storedSession), false);

    const body = await request.json() as AlertBody;
    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    const direction = String(body.direction ?? "").trim().toLowerCase();
    const triggerPrice = Number(body.triggerPrice);
    const label = directionLabel(direction);
    const expectedConfirmation = `${label ? `ALERT ${label}` : "ALERT"} ${symbol} ${triggerPrice}`;
    if (!label || body.confirmation?.trim().toUpperCase() !== expectedConfirmation) {
      return Response.json({
        status: "confirmation_required",
        message: label
          ? `Type ${expectedConfirmation} exactly to create this price alert.`
          : "Direction must be above or below.",
      }, { status: 400 });
    }

    const result = await placeKiteAlert({
      symbol,
      exchange: body.exchange,
      direction: direction as KiteAlertRequest["direction"],
      triggerPrice,
      note: body.note,
    });
    const sessionId = currentKiteSession();
    const uuid = result && typeof result === "object" && "uuid" in (result as object)
      ? String((result as { uuid?: string }).uuid ?? "")
      : "";
    return Response.json({
      status: "submitted",
      message: uuid
        ? `${expectedConfirmation} was submitted to Kite (${uuid}).`
        : `${expectedConfirmation} was submitted to Kite.`,
      result,
    }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...(sessionId ? { "Set-Cookie": kiteSessionCookie(sessionId) } : {}),
      },
    });
  } catch (error) {
    const text = message(error);
    const unavailable = /unavailable|unknown tool|tool not found|not (?:found|registered|available)|failed to create alert/i.test(text);
    return Response.json({
      status: unavailable ? "unavailable" : "failed",
      message: unavailable
        ? (text.includes("Unavailable") ? text : `Unavailable: ${text}`)
        : text,
    }, { status: unavailable ? 503 : 400, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
