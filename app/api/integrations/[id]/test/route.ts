import { testIntegration } from "../../../../integrations/registry";
import { loadIntegrationsConfig } from "../../../../integrations/store";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const decoded = decodeURIComponent(id || "");
  const result = await testIntegration(decoded, loadIntegrationsConfig());
  const status = result.status === "live" || result.status === "cached" || result.status === "partial" ? 200 : 409;
  return Response.json(result, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
