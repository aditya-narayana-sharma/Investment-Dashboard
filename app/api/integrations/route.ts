import { catalogCards, publicBroker } from "../../integrations/registry";
import { resolveBrokerAdapter } from "../../integrations/broker";
import { loadCsvHoldings } from "../../integrations/broker/csv";
import { listIntegrationGuides } from "../../integrations/guides";
import { loadIntegrationsConfig, saveIntegrationsConfig } from "../../integrations/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadIntegrationsConfig();
  const adapter = resolveBrokerAdapter(config.broker.id);
  const csv = loadCsvHoldings();
  const ist = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  return Response.json({
    status: "live",
    asOf: ist,
    config,
    broker: publicBroker(adapter),
    cards: catalogCards(config, ist),
    csvHoldings: csv,
    guides: listIntegrationGuides(),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function PUT(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return Response.json({ status: "invalid", message: "Integrations updates must use JSON." }, { status: 415 });
    }
    const body = await request.json() as { config?: unknown } & Record<string, unknown>;
    const config = saveIntegrationsConfig(body.config ?? body);
    const adapter = resolveBrokerAdapter(config.broker.id);
    const ist = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date());
    return Response.json({
      status: "saved",
      asOf: ist,
      config,
      broker: publicBroker(adapter),
      cards: catalogCards(config, ist),
      message: "Saved to artifacts/private/integrations.json. Kite tokens were not written.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({
      status: "invalid",
      message: error instanceof Error ? error.message : "Integrations config was rejected.",
    }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
