import { KiteAuthRequired } from "./kite-live-server";

export function kiteWriteErrorResponse(error: unknown, fallback: string, action = "place order") {
  const text = error instanceof Error ? error.message : fallback;
  if (error instanceof KiteAuthRequired) {
    return Response.json({
      status: "auth_required",
      message: `Failed to ${action}: Kite is not authenticated. ${text} Open Integrations, authenticate Kite on this Mac (token expires ~06:00 IST), then retry from Portfolio.`,
    }, {
      status: 401,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
  return Response.json({
    status: "failed",
    message: text.startsWith("Failed to ") ? text : `Failed to ${action}: ${text}`,
  }, {
    status: 400,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
