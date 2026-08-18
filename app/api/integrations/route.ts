import {
  applyPipelineAction,
  assertPipelineId,
  mergeApplePermissionsUpdate,
  mergeIntegrationsUpdate,
  parseApplePermissionsAction,
  parsePipelineAction,
  readStoredIntegrationsConfig,
  writeIntegrationsConfig,
} from "../../integrations-config-server";
import { publicIntegrationsConfig } from "../../integrations-types";
import {
  isLocalOperatorRequest,
  overlayLocalLlmSecrets,
  readLocalLlmSecrets,
} from "../../local-llm-secrets";
import { detectRuntimeTools } from "../../runtime-tools-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET(request: Request) {
  const existing = await readStoredIntegrationsConfig();
  const stored = overlayLocalLlmSecrets(existing, await readLocalLlmSecrets());
  const runtime = await detectRuntimeTools();
  const localOperator = isLocalOperatorRequest(request);
  const wantSecrets = new URL(request.url).searchParams.get("secrets") === "1" && localOperator;
  if (wantSecrets) {
    const before = JSON.stringify(publicIntegrationsConfig(existing).llm);
    const after = JSON.stringify(publicIntegrationsConfig(stored).llm);
    if (before !== after) {
      await writeIntegrationsConfig(stored);
    }
  }
  const payload = publicIntegrationsConfig(stored);
  return Response.json({ ...payload, runtime }, { headers: NO_STORE });
}

export async function PUT(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return Response.json(
      { error: "Integrations writes are only available on the author Mac." },
      { status: 403, headers: NO_STORE },
    );
  }
  try {
    const body = await request.json() as unknown;
    const merged = mergeIntegrationsUpdate(await readStoredIntegrationsConfig(), body);
    const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const saved = await writeIntegrationsConfig(
      record.clearLlmKeys === true
        ? merged
        : overlayLocalLlmSecrets(merged, await readLocalLlmSecrets()),
    );
    const payload = publicIntegrationsConfig(saved);
    return Response.json(payload, { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save integrations config." },
      { status: 400, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { pipelineId?: string; action?: string };
    if (parseApplePermissionsAction(body.action)) {
      const saved = await writeIntegrationsConfig(mergeApplePermissionsUpdate(await readStoredIntegrationsConfig(), body));
      return Response.json(publicIntegrationsConfig(saved), { headers: NO_STORE });
    }
    const pipelineId = assertPipelineId(body.pipelineId);
    const action = parsePipelineAction(body.action);
    if (!pipelineId || !action) {
      return Response.json({ error: "pipelineId and action (connect|disconnect|test|apple-permissions) are required." }, { status: 400, headers: NO_STORE });
    }
    const saved = await writeIntegrationsConfig(applyPipelineAction(await readStoredIntegrationsConfig(), pipelineId, action));
    return Response.json(publicIntegrationsConfig(saved), { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update pipeline." },
      { status: 400, headers: NO_STORE },
    );
  }
}
