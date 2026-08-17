import { testNotesAdapter } from "../../../../integrations/notes";
import { loadIntegrationsConfig } from "../../../../integrations/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadIntegrationsConfig();
  const adapters = ["notes:obsidian", "notes:apple", "notes:notion", "notes:onenote", "tasks:google"] as const;
  return Response.json({
    status: "live",
    adapters: adapters.map((id) => testNotesAdapter(id, config)),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
