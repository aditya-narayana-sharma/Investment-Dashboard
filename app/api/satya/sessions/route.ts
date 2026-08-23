import {
  deleteSatyaSession,
  listSatyaSessions,
  renameSatyaSession,
  satyaSessionDisplayTitle,
} from "../../../satya/chat.ts";
import { isLocalOperatorRequest } from "../../../local-llm-secrets.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

function operatorForbidden() {
  return Response.json(
    { ok: false, error: "Satya chats are only available on the author Mac." },
    { status: 403, headers: NO_STORE },
  );
}

function sessionIdFromUnknown(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return operatorForbidden();
  }
  const sessions = await listSatyaSessions();
  return Response.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      workspace: session.workspace,
      title: satyaSessionDisplayTitle(session),
      messages: session.messages,
    })),
  }, { headers: NO_STORE });
}

export async function PATCH(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return operatorForbidden();
  }
  let body: { id?: unknown; title?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json(
      { ok: false, error: "Rename body must be JSON with id and title." },
      { status: 400, headers: NO_STORE },
    );
  }
  const id = sessionIdFromUnknown(body.id);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!id || !title) {
    return Response.json(
      { ok: false, error: "Rename requires a session id and a non-empty title." },
      { status: 400, headers: NO_STORE },
    );
  }
  const session = await renameSatyaSession({ id, title });
  if (!session) {
    return Response.json(
      { ok: false, error: "Satya chat was not found." },
      { status: 404, headers: NO_STORE },
    );
  }
  return Response.json({
    ok: true,
    session: {
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      workspace: session.workspace,
      title: satyaSessionDisplayTitle(session),
      messages: session.messages,
    },
  }, { headers: NO_STORE });
}

export async function DELETE(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return operatorForbidden();
  }
  const url = new URL(request.url);
  let id = url.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    try {
      const body = await request.json() as { id?: unknown };
      id = sessionIdFromUnknown(body.id);
    } catch {
      id = "";
    }
  }
  if (!id) {
    return Response.json(
      { ok: false, error: "Delete requires a session id." },
      { status: 400, headers: NO_STORE },
    );
  }
  const removed = await deleteSatyaSession({ id });
  if (!removed) {
    return Response.json(
      { ok: false, error: "Satya chat was not found." },
      { status: 404, headers: NO_STORE },
    );
  }
  return Response.json({ ok: true, id }, { headers: NO_STORE });
}
