import { loadSatyaCorpusStats, readMailFreshness } from "../../../satya/retrieve.ts";
import { probeOllamaReachable } from "../../../local-llm-client.ts";
import { llmAssistAvailability, isLocalOperatorRequest, readLocalLlmSecrets } from "../../../local-llm-secrets.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

/**
 * Status JSON shape (no secrets):
 * enabled, operator, provider, configured, settingsHref, stale, message,
 * corpus, mailFreshness?, ollama?: { reachable?: boolean }
 */
export async function GET(request: Request) {
  const secrets = await readLocalLlmSecrets();
  const availability = llmAssistAvailability(secrets);
  const [corpus, mailFreshness, ollamaReachable] = await Promise.all([
    loadSatyaCorpusStats(),
    readMailFreshness(),
    probeOllamaReachable(secrets),
  ]);
  const ingestError = corpus.ingestError?.trim() || null;
  return Response.json({
    enabled: availability.enabled && isLocalOperatorRequest(request),
    operator: isLocalOperatorRequest(request),
    provider: availability.provider,
    configured: availability.configured,
    settingsHref: availability.settingsHref,
    stale: Boolean(ingestError),
    message: isLocalOperatorRequest(request)
      ? (ingestError
        ? "Satya corpus ingest failed. The extractive digest remains the source of truth."
        : availability.message)
      : "Satya chat is only available on the author Mac.",
    corpus: { ...corpus, ingestError },
    ...(mailFreshness ? { mailFreshness } : {}),
    ollama: { reachable: ollamaReachable },
  }, { headers: NO_STORE });
}
