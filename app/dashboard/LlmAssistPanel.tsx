"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { KeyRound, Sparkles, X } from "lucide-react";
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

const WORKSPACE_PANEL_ID = "dashboard-workspace-panel";
const LLM_DOCK_Z = 24;

function defaultSuggestions(task: LlmAssistTask): LlmAssistSuggestion[] {
  switch (task) {
    case "composite":
      return [
        {
          id: "target-vs-buy",
          label: "Target achieved vs BUY",
          prompt: "What stands out in Target achieved versus active BUY rows in the supplied analyst matrix? Do not invent CMP or targets. Missing fields stay missing.",
        },
        {
          id: "hold-watch",
          label: "HOLD rows to watch",
          prompt: "Which supplied HOLD rows look most important to monitor, and why? Do not change composite scores or invent missing CMP/targets.",
        },
        {
          id: "leaders-laggards",
          label: "Leaders vs laggards",
          prompt: "Compare Performance Leaders and Laggards using only supplied rows. If a CMP or target is missing, say it is missing.",
        },
        {
          id: "trading-technical",
          label: "Trading vs Technical BUY",
          prompt: "How do supplied Trading BUY and Technical BUY rows differ from plain BUY? Do not invent prices or unpublished targets.",
        },
        {
          id: "missing-fields",
          label: "Missing CMP / targets",
          prompt: "Which supplied analyst-matrix rows are missing CMP or target, and what does that imply for the commentary? Never fill missing numbers.",
        },
      ];
    case "industry":
      return [
        {
          id: "vs-nifty",
          label: "vs Nifty 50",
          prompt: "How does the selected industry compare with Nifty 50 using only the supplied snapshot and EOD benchmarks? Do not invent index levels. If a level is missing, say unavailable.",
        },
        {
          id: "breadth",
          label: "Session breadth",
          prompt: "Summarize advancers vs decliners and median 1M return from the supplied industry snapshot only. Missing quotes stay blank.",
        },
        {
          id: "leaders-laggards",
          label: "Leaders vs laggards",
          prompt: "Who are the supplied leaders and laggards? Use only supplied rank values. Do not invent returns or KPIs.",
        },
        {
          id: "composite-pulse",
          label: "Composite vs pulse",
          prompt: "What do the supplied composite score and pulse imply? Do not change scores or invent missing KPIs.",
        },
        {
          id: "owned-names",
          label: "Owned names",
          prompt: "Which supplied constituents are marked owned, and what does the supplied P&L say? Do not invent quantities or prices.",
        },
      ];
    case "framework":
      return [
        {
          id: "gate-change",
          label: "Monitor → allocate",
          prompt: "What supplied evidence would need to change for this gate to move from monitor to allocate? Do not replace the rule-based composite or invent index levels.",
        },
        {
          id: "closest-trigger",
          label: "Closest macro trigger",
          prompt: "Which supplied macro trigger is closest to a sizing change? Trigger distance is context, not an automatic trade. Missing levels stay unavailable.",
        },
        {
          id: "vs-benchmarks",
          label: "Vs selected indices",
          prompt: "How does this sector compare to the selected EOD benchmarks using only supplied levels and returns? Delayed series stay delayed.",
        },
        {
          id: "evidence-watch",
          label: "Evidence vs watch",
          prompt: "Restate the supplied evidence, monitor, and invalidation lines. If a factor is unavailable, say unavailable.",
        },
        {
          id: "missing-levels",
          label: "Unavailable levels",
          prompt: "Which supplied benchmark or factor values are unavailable, and how should that constrain the commentary? Never invent levels.",
        },
      ];
    case "summarize":
      return [
        {
          id: "overnight-themes",
          label: "Overnight themes",
          prompt: "What were the main overnight newsletter themes in the supplied digest? Ignore ads, CTAs, and promotions. Do not invent numbers.",
        },
        {
          id: "axis-vs-holdings",
          label: "Axis vs holdings",
          prompt: "How do Axis Research conviction ideas compare with current holdings in the supplied digest? Do not invent prices, quantities, or unpublished KPIs.",
        },
        {
          id: "podcast-overlap",
          label: "Podcast overlap",
          prompt: "Where do podcast summaries overlap with Axis Research? Treat transcript-derived items as transcripts and description-only items as descriptions. Do not invent quotes.",
        },
        {
          id: "verified-prints",
          label: "Verified prints",
          prompt: "What did independently verified reported KPIs say? Unpublished fields stay blank. Calendar rows stay scheduling evidence only.",
        },
        {
          id: "cautionary",
          label: "Cautionary notes",
          prompt: "Flag risks, downgrades, or cautionary notes in the supplied evidence. Never invent prices or KPIs.",
        },
      ];
    case "builder":
      return [
        {
          id: "core-satellite",
          label: "Core-satellite sleeve",
          prompt: "Draft a StrategyTreeV1 core-satellite with an HDFCBANK quality sleeve. Use only NSE-style symbols. Return JSON only. If it cannot be expressed as a tree, return {\"error\":\"cannot_draft\"}.",
        },
        {
          id: "reliance-gate",
          label: "RELIANCE trend gate",
          prompt: "Draft a StrategyTreeV1 with a RELIANCE trend If/Else gate over an equal-weight quality sleeve. Indian market only. Return JSON only.",
        },
        {
          id: "equal-weight",
          label: "Equal-weight names",
          prompt: "Draft a StrategyTreeV1 that equal-weights a small NSE sleeve (TCS, INFY, HDFCBANK). treeVersion must be \"1\". Return JSON only.",
        },
        {
          id: "any-all-filter",
          label: "Any/All quality filter",
          prompt: "Draft a StrategyTreeV1 that uses any_all plus a filter block for a quality sleeve. No US tickers. Return JSON only.",
        },
        {
          id: "invalid-json",
          label: "Keep canvas if invalid",
          prompt: "If this request cannot be a valid StrategyTreeV1, return {\"error\":\"cannot_draft\"} so the canvas stays as-is. Do not invent backtest KPIs.",
        },
      ];
    case "strategy":
      return [
        {
          id: "quality-momentum",
          label: "Quality vs momentum",
          prompt: "Compare quality vs momentum sleeves in the supplied public library. Missing KPIs stay —. Do not invent backtest figures.",
        },
        {
          id: "verify-canvas",
          label: "Verify on canvas",
          prompt: "What should be verified on Algorithm Canvas for the top supplied cards? Missing KPIs stay —. Indian market only.",
        },
        {
          id: "mine-vs-public",
          label: "Mine vs public",
          prompt: "How do My library trees differ from the supplied public cards? Do not invent live KPI values.",
        },
        {
          id: "risks",
          label: "Sleeve risks",
          prompt: "List idea, sleeves, and risks for the supplied library cards. If a KPI is missing, write —.",
        },
        {
          id: "indian-only",
          label: "Indian market only",
          prompt: "Which supplied notes assume Indian-market symbols, and what would you verify before editing on Algorithm Canvas? Never invent KPIs.",
        },
      ];
    default: {
      const _exhaustive: never = task;
      return _exhaustive;
    }
  }
}

function hostIsVisible(node: HTMLElement | null): boolean {
  if (!node?.isConnected) return false;
  let current: HTMLElement | null = node.parentElement;
  while (current) {
    if (current.hidden || current.getAttribute("hidden") !== null) return false;
    current = current.parentElement;
  }
  return true;
}

type WorkspaceDockRect = {
  top: number;
  left: number;
  width: number;
  bottom: number;
  height: number;
};

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
  defaultOpen?: boolean;
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
  defaultOpen = true,
  onApplyTree,
}: LlmAssistPanelProps) {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [hostVisible, setHostVisible] = useState(false);
  const [dockRect, setDockRect] = useState<WorkspaceDockRect | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const chips = useMemo(
    () => (suggestions && suggestions.length > 0 ? suggestions : defaultSuggestions(task)),
    [suggestions, task],
  );

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

  useLayoutEffect(() => {
    const node = anchorRef.current;
    if (!node) return;
    const update = () => setHostVisible(hostIsVisible(node));
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    let current: HTMLElement | null = node;
    while (current) {
      observer.observe(current, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
      current = current.parentElement;
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!hostVisible || typeof document === "undefined") return;
    const panel = document.getElementById(WORKSPACE_PANEL_ID);
    if (!panel) return;
    const update = () => {
      const box = panel.getBoundingClientRect();
      setDockRect({
        top: box.top,
        left: box.left,
        width: box.width,
        bottom: box.bottom,
        height: box.height,
      });
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [hostVisible]);

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
  const showOverlay = hostVisible && dockRect !== null && typeof document !== "undefined";

  const dockStyle: CSSProperties | undefined = dockRect
    ? open
      ? {
          top: dockRect.top,
          left: dockRect.left,
          width: dockRect.width,
          maxHeight: Math.min(dockRect.height * 0.78, 680),
        }
      : {
          top: "auto",
          bottom: Math.max(8, window.innerHeight - dockRect.bottom + 8),
          left: dockRect.left,
          width: dockRect.width,
        }
    : undefined;

  const panel = (
    <aside
      className={["llm-assist", "llm-assist-span", open ? "llm-assist-open" : "llm-assist-collapsed", className].filter(Boolean).join(" ")}
      data-enabled={enabled ? "true" : "false"}
      data-task={task}
      data-title-tone={titleTone}
      data-open={open ? "true" : "false"}
    >
      {open ? (
        <>
          <header>
            <Sparkles size={14} aria-hidden="true" />
            <div>
              {llmAssistHeading(title, titleTone)}
              {subtitle ? <span>{subtitle}</span> : null}
              <span>Machine-drafted · never a source for numbers</span>
            </div>
            <button
              type="button"
              className="llm-assist-toggle"
              aria-expanded="true"
              aria-label="Close Interrogate LLM"
              onClick={() => setOpen(false)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </header>
          <p>{hint}</p>
          {!enabled && (
            <p className="llm-assist-cta">
              {status?.message || "LLM assist is disabled until a key is pasted."}
              {" "}
              <Link href={href}><KeyRound size={12} /> Settings</Link>
            </p>
          )}
          <div className="llm-assist-suggestions" role="group" aria-label="Smart Suggestions">
            <em>Smart Suggestions</em>
            {chips.map((item) => (
              <button
                type="button"
                key={item.id}
                className="llm-assist-suggestion"
                disabled={busy}
                aria-pressed={prompt === item.prompt}
                onClick={() => setPrompt(item.prompt)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label>
            Prompt
            <textarea
              className="llm-assist-composer"
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
        </>
      ) : (
        <button
          type="button"
          className="llm-assist-launcher"
          aria-expanded="false"
          aria-label="Open Interrogate LLM"
          onClick={() => setOpen(true)}
        >
          <Sparkles size={14} aria-hidden="true" />
          Interrogate LLM
        </button>
      )}
    </aside>
  );

  return (
    <>
      <div
        ref={anchorRef}
        className={["llm-assist-anchor", className].filter(Boolean).join(" ")}
        data-llm-task={task}
        aria-hidden="true"
      />
      {showOverlay
        ? createPortal(
          <div
            className="llm-assist-dock"
            data-open={open ? "true" : "false"}
            data-llm-overlay="true"
            data-task={task}
            style={{ ...dockStyle, zIndex: LLM_DOCK_Z }}
          >
            {panel}
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
