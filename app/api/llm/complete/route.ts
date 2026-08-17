import { compileTreeToGraph } from "../../../strategy/tree-compile";
import {
  isLlmAssistTask,
  llmAssistSystemPrompt,
  parseTreeFromLlmText,
} from "../../../local-llm-assist.ts";
import { completeLocalLlm } from "../../../local-llm-client.ts";
import { llmAssistAvailability, readLocalLlmSecrets } from "../../../local-llm-secrets.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET() {
  const availability = llmAssistAvailability(await readLocalLlmSecrets());
  return Response.json({
    enabled: availability.enabled,
    provider: availability.provider,
    configured: availability.configured,
    settingsHref: availability.settingsHref,
    message: availability.message,
  }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      task?: string;
      prompt?: string;
      context?: string;
    };
    const task = typeof body.task === "string" && isLlmAssistTask(body.task) ? body.task : null;
    if (!task) {
      return Response.json({ ok: false, disabled: false, error: "task must be summarize, composite, framework, builder, or strategy." }, { status: 400, headers: NO_STORE });
    }
    const prompt = [typeof body.prompt === "string" ? body.prompt.trim() : "", typeof body.context === "string" ? body.context.trim() : ""]
      .filter(Boolean)
      .join("\n\nSOURCE EVIDENCE:\n");
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
    const completed = await completeLocalLlm({
      prompt,
      system: llmAssistSystemPrompt(task),
      secrets,
    });
    if (!completed.ok) {
      if (!completed.disabled) {
        console.warn("[llm-complete]", {
          ok: false,
          provider: completed.provider,
          status: completed.status ?? null,
          errorType: completed.errorType ?? null,
          attempts: completed.attempts ?? [],
        });
      }
      return Response.json({
        ok: false,
        disabled: completed.disabled,
        settingsHref: availability.settingsHref,
        message: completed.message,
        provider: completed.provider,
        status: completed.status ?? null,
        errorType: completed.errorType ?? null,
        attempts: completed.attempts ?? [],
      }, { status: completed.disabled ? 409 : 502, headers: NO_STORE });
    }
    if (task !== "builder") {
      return Response.json({
        ok: true,
        labeled: "machine-drafted",
        provider: completed.provider,
        text: completed.text,
      }, { headers: NO_STORE });
    }
    try {
      const tree = parseTreeFromLlmText(completed.text);
      return Response.json({
        ok: true,
        labeled: "machine-drafted",
        provider: completed.provider,
        text: completed.text,
        tree,
        graph: compileTreeToGraph(tree),
      }, { headers: NO_STORE });
    } catch (error) {
      return Response.json({
        ok: false,
        disabled: false,
        provider: completed.provider,
        message: error instanceof Error ? error.message : "The model did not return a valid StrategyTreeV1. The canvas is unchanged.",
      }, { status: 422, headers: NO_STORE });
    }
  } catch (error) {
    return Response.json({
      ok: false,
      disabled: false,
      error: error instanceof Error ? error.message : "Could not complete LLM assist.",
    }, { status: 400, headers: NO_STORE });
  }
}
