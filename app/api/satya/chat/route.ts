import { encodeSatyaSse, parseSatyaAxisCategories, parseSatyaFamilies, runSatyaChat, type SatyaChatMessage } from "../../../satya/chat.ts";
import { llmAssistAvailability, isLocalOperatorRequest, readLocalLlmSecrets } from "../../../local-llm-secrets.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;
const SSE_HEADERS = {
  ...NO_STORE,
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no",
  Connection: "keep-alive",
} as const;

function parseMessages(value: unknown): SatyaChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: SatyaChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
    const content = typeof record.content === "string" ? record.content : "";
    if (!role || !content.trim()) continue;
    messages.push({ role, content });
  }
  return messages;
}

export async function POST(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return Response.json(
      { ok: false, disabled: false, error: "Satya chat is only available on the author Mac." },
      { status: 403, headers: NO_STORE },
    );
  }
  let body: {
    messages?: unknown;
    workspace?: unknown;
    voice?: unknown;
    sessionId?: unknown;
    families?: unknown;
    axisCategories?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json(
      { ok: false, disabled: false, error: "Satya chat body must be JSON." },
      { status: 400, headers: NO_STORE },
    );
  }
  const messages = parseMessages(body.messages);
  if (!messages.length) {
    return Response.json(
      { ok: false, disabled: false, error: "messages must include at least one user turn." },
      { status: 400, headers: NO_STORE },
    );
  }
  const secrets = await readLocalLlmSecrets();
  const availability = llmAssistAvailability(secrets);
  if (!availability.enabled) {
    return Response.json({
      ok: false,
      disabled: true,
      settingsHref: availability.settingsHref,
      message: availability.message,
    }, { status: 409, headers: NO_STORE });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = (event: Parameters<typeof encodeSatyaSse>[0]) => {
        controller.enqueue(encoder.encode(encodeSatyaSse(event)));
      };
      void runSatyaChat({
        request: {
          messages,
          workspace: typeof body.workspace === "string" ? body.workspace : undefined,
          voice: body.voice === true,
          sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
          families: parseSatyaFamilies(body.families),
          axisCategories: parseSatyaAxisCategories(body.axisCategories),
        },
        secrets,
        emit,
        signal: request.signal,
      }).then(() => {
        controller.close();
      }).catch((error) => {
        if (request.signal.aborted) {
          try { controller.close(); } catch { /* client already disconnected */ }
          return;
        }
        emit({
          event: "error",
          data: { message: error instanceof Error ? error.message : "Could not complete Satya chat." },
        });
        controller.close();
      });
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
