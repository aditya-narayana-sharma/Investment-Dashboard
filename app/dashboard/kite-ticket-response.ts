export type KiteTicketResponse = {
  ok: boolean;
  status: number;
  message: string;
  payload: Record<string, unknown> | null;
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string): string {
  return collapseWhitespace(value.replace(/<[^>]+>/g, " "));
}

function messageFromPayload(payload: Record<string, unknown>, fallback: string): string {
  const message = payload.message;
  if (typeof message === "string" && message.trim()) return message.trim();
  const error = payload.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const nested = (error as { message?: unknown }).message;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return fallback;
}

/** Parse a Kite ticket POST. Never collapse HTML/empty/401 bodies into a bare failure. */
export async function readKiteTicketResponse(response: Response, fallbackLabel: string): Promise<KiteTicketResponse> {
  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const fallback = `${fallbackLabel} returned HTTP ${response.status}`;
  const trimmed = raw.trim();

  if (!trimmed) {
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, message: `Kite session required — log in on this Mac (HTTP ${response.status}).`, payload: null };
    }
    return { ok: false, status: response.status, message: `${fallback} with an empty body.`, payload: null };
  }

  const looksJson = contentType.toLowerCase().includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (looksJson) {
    try {
      const payload = JSON.parse(trimmed) as unknown;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return {
          ok: response.ok,
          status: response.status,
          message: messageFromPayload(payload as Record<string, unknown>, fallback),
          payload: payload as Record<string, unknown>,
        };
      }
    } catch {
      return {
        ok: false,
        status: response.status,
        message: `${fallback} with invalid JSON: ${collapseWhitespace(trimmed).slice(0, 180)}`,
        payload: null,
      };
    }
  }

  const snippet = stripHtml(trimmed).slice(0, 180);
  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: response.status, message: `Kite session required — log in on this Mac (HTTP ${response.status}). ${snippet}`, payload: null };
  }
  return {
    ok: false,
    status: response.status,
    message: snippet ? `${fallback} (${contentType || "non-JSON"}): ${snippet}` : `${fallback} (${contentType || "non-JSON"}).`,
    payload: null,
  };
}
