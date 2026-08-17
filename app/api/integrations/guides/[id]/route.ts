import { isIntegrationGuideId, readIntegrationGuide } from "../../../../../integrations/guides";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isIntegrationGuideId(id)) {
    return Response.json({ status: "missing", message: "Unknown guide." }, { status: 404 });
  }
  const guide = readIntegrationGuide(id);
  if (!guide) return Response.json({ status: "missing", message: "Guide file was not found." }, { status: 404 });
  return Response.json(guide, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
