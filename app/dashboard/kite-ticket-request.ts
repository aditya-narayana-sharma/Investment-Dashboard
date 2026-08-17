export type KiteTicketPayload = {
  status?: string;
  message?: string;
  result?: unknown;
};

function isDocumentPayload(raw: string) {
  const trimmed = raw.trim();
  return !trimmed || trimmed.startsWith("<") || /^<!doctype/i.test(trimmed);
}

/** Parse a Kite write response. HTML means the native shell stole the POST as a page load. */
export function readKiteTicketResponse(raw: string, status: number, action: string): KiteTicketPayload {
  if (isDocumentPayload(raw)) {
    throw new Error(
      `Failed to ${action}: the request never reached Kite as JSON. The native window treated the POST as a page load. Stay on Portfolio Overview, authenticate Kite, and retry.`,
    );
  }
  let payload: KiteTicketPayload;
  try {
    payload = JSON.parse(raw) as KiteTicketPayload;
  } catch {
    throw new Error(`Failed to ${action}: Kite returned a non-JSON response (${status}).`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(payload.message || `Failed to ${action} (${status}).`);
  }
  return payload;
}

export async function postKiteTicket(path: string, body: unknown, action = "place order"): Promise<KiteTicketPayload> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  return readKiteTicketResponse(raw, response.status, action);
}
