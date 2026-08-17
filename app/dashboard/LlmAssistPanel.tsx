"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Sparkles } from "lucide-react";
import type { LlmAssistTask } from "../local-llm-assist";
import type { StrategyTreeV1 } from "../../packages/contracts/src/strategy-tree.ts";

type LlmStatus = {
  enabled: boolean;
  provider: string | null;
  settingsHref: string;
  message: string;
};

export type LlmAssistSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

type LlmAssistTitleTone = "brutalist" | "section";

function llmAssistHeading(title: string, titleTone: LlmAssistTitleTone) {
  switch (titleTone) {
    case "section":
      return <h3>{title}</h3>;
    case "brutalist":
      return <b>{title}</b>;
    default: {
      const _exhaustive: never = titleTone;
      return _exhaustive;
    }
  }
}

type LlmAssistPanelProps = {
  task: LlmAssistTask;
  title?: string;
  hint: string;
  context: string;
  placeholder?: string;
  applyLabel?: string;
  disabled?: boolean;
  className?: string;
  subtitle?: string;
  titleTone?: LlmAssistTitleTone;
  suggestions?: LlmAssistSuggestion[];
  onApplyTree?: (tree: StrategyTreeV1) => void;
};

export function LlmAssistPanel({
  task,
  title = "Interrogate LLM",
  hint,
  context,
  placeholder = "What should the draft cover?",
  applyLabel,
  disabled = false,
  className = "",
  subtitle,
  titleTone = "section",
  suggestions,
  onApplyTree,
}: LlmAssistPanelProps) {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/llm/complete", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as LlmStatus;
      if (!cancelled && payload && typeof payload.message === "string") setStatus(payload);
    }).catch(() => {
      if (!cancelled) {
        setStatus({
          enabled: false,
          provider: null,
          settingsHref: "/?view=integrations",
          message: "LLM assist is disabled. Paste a Claude, OpenAI, or Gemini key in Settings.",
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/llm/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, prompt, context }),
      });
      const payload = await response.json() as {
        ok?: boolean;
        disabled?: boolean;
        message?: string;
        text?: string;
        tree?: StrategyTreeV1;
        settingsHref?: string;
      };
      if (!response.ok || payload.ok === false) {
        if (payload.disabled) {
          setStatus({
            enabled: false,
            provider: null,
            settingsHref: payload.settingsHref ?? "/?view=integrations",
            message: payload.message || "LLM assist is disabled.",
          });
          setError("");
          return;
        }
        setError(payload.message || "LLM assist failed. Source-backed content is unchanged.");
        return;
      }
      setDraft(payload.text ?? "");
      if (payload.tree && onApplyTree) onApplyTree(payload.tree);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "LLM assist failed.");
    } finally {
      setBusy(false);
    }
  }, [context, onApplyTree, prompt, task]);

  const enabled = Boolean(status?.enabled) && !disabled;
  const href = status?.settingsHref || "/?view=integrations";

  return (
    <aside
      className={["llm-assist", className].filter(Boolean).join(" ")}
      data-enabled={enabled ? "true" : "false"}
      data-task={task}
      data-title-tone={titleTone}
    >
      <header>
        <Sparkles size={14} aria-hidden="true" />
        <div>
          {llmAssistHeading(title, titleTone)}
          {subtitle ? <span>{subtitle}</span> : null}
          <span>Machine-drafted · never a source for numbers</span>
        </div>
      </header>
      <p>{hint}</p>
      {!enabled && (
        <p className="llm-assist-cta">
          {status?.message || "LLM assist is disabled until a key is pasted."}
          {" "}
          <Link href={href}><KeyRound size={12} /> Settings</Link>
        </p>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="llm-assist-suggestions" role="group" aria-label="Smart Suggestions">
          <em>Smart Suggestions</em>
          {suggestions.map((item) => (
            <button
              type="button"
              key={item.id}
              className="llm-assist-suggestion vo-pop"
              disabled={busy}
              aria-pressed={prompt === item.prompt}
              onClick={() => setPrompt(item.prompt)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <label>
        Prompt
        <textarea
          value={prompt}
          disabled={!enabled || busy}
          placeholder={enabled ? placeholder : "Paste a Claude, OpenAI, or Gemini key in Settings first."}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
        />
      </label>
      <button type="button" className="llm-assist-run" disabled={!enabled || busy || !prompt.trim()} onClick={() => void run()}>
        {busy ? "Drafting…" : applyLabel ?? "Interrogate LLM"}
      </button>
      {enabled && error ? (
        <p className="llm-assist-error" role="alert">
          {error}
          {" "}
          <Link href={href}><KeyRound size={12} /> Settings</Link>
        </p>
      ) : null}
      {draft && (
        <pre className="llm-assist-draft" data-labeled="machine-drafted">{draft}</pre>
      )}
    </aside>
  );
}
