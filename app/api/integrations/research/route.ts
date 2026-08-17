import { RESEARCH_CATALOG, listLocalPdfs, researchProviderStatus } from "../../../integrations/research";
import { loadIntegrationsConfig } from "../../../integrations/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadIntegrationsConfig();
  return Response.json({
    status: "live",
    providers: RESEARCH_CATALOG.map((provider) => {
      const row = config.research.find((item) => item.id === provider.id);
      const pdfs = row?.pdfDir ? listLocalPdfs(row.pdfDir) : [];
      return {
        ...provider,
        enabled: row?.enabled !== false && Boolean(row),
        mailbox: row ? `${row.account} → ${row.mailbox}` : null,
        pdfDir: row?.pdfDir ?? provider.defaultPdfDir,
        pdfCount: pdfs.length,
        status: researchProviderStatus(row, provider),
      };
    }),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
