"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AxisResearchCategoryId } from "../content-types";
import { DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS } from "../satya/axis-categories.ts";
import { axisCategoryAskPrompt, SATYA_BRIEFING_SUGGESTIONS, type SatyaSuggestion } from "./satya-suggestions";
import {
  fetchSatyaSources,
  fetchSatyaStatus,
  getSatyaThread,
  openSatyaChats,
  SATYA_SOURCE_CHIPS,
  satyaCorpusHealthFromStatus,
  satyaShouldSpeak,
  setSatyaFocus,
  setSatyaPopupOpen,
  setSatyaThread,
  streamSatyaChat,
  type SatyaCitation,
  type SatyaCorpusHealth,
  type SatyaSourceFamily,
  type SatyaThreadTurn,
} from "./satya-client";
import { currentSatyaTurn, openSatyaDraftPopout, syncSatyaDraftPopout } from "./satya-draft-popout";
import { SatyaCitationIcons } from "./satya-citation-icons";
import { SatyaDraftStatusLine } from "./SatyaDraftStatusLine";
import { SatyaAxisCategoryChips, SatyaPresence, type SatyaPresenceState } from "./SatyaPresence";
import { SatyaFullBody } from "./SatyaAvatar";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { installSatyaSpeech } from "../satya/speech";

export type { SatyaSourceFamily };


export { SATYA_BRIEFING_SUGGESTIONS };

export function SatyaBriefingRoom({
  className = "",
  subtitle,
  suggestions = SATYA_BRIEFING_SUGGESTIONS,
  stale = false,
  familyCounts,
}: {
  className?: string;
  subtitle: string;
  suggestions?: SatyaSuggestion[];
  stale?: boolean;
  familyCounts?: Partial<Record<SatyaSourceFamily, number>>;
}) {
  const [state, setState] = useState<SatyaPresenceState>(stale ? "stale" : "idle");
  const reducedMotion = usePrefersReducedMotion();
  const [prompt, setPrompt] = useState("");
  const [canvasTurns, setCanvasTurns] = useState<SatyaThreadTurn[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Grounded on the Satya corpus.");
  const [selectedFamilies, setSelectedFamilies] = useState<SatyaSourceFamily[]>(() => SATYA_SOURCE_CHIPS.map((chip) => chip.id));
  const [selectedAxisCategories, setSelectedAxisCategories] = useState<AxisResearchCategoryId[]>(
    () => [...DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS],
  );
  const abortRef = useRef<AbortController | null>(null);
  const visitRef = useRef<{ sessionId: string | null; turns: SatyaThreadTurn[] }>({ sessionId: null, turns: [] });
  const [fetchedCounts, setFetchedCounts] = useState<Partial<Record<SatyaSourceFamily, number>>>({});
  const [axisCategoryCounts, setAxisCategoryCounts] = useState<Partial<Record<AxisResearchCategoryId, number>>>({});
  const [corpusHealth, setCorpusHealth] = useState<SatyaCorpusHealth>({
    documentCount: null,
    ingestError: null,
    families: {},
  });
  const sourceCounts = { ...familyCounts, ...corpusHealth.families, ...fetchedCounts };
  const visibleTurns = currentSatyaTurn(canvasTurns);
  const presenceState = state === "idle" && stale ? "stale" : state;
  const axisFamilySelected = selectedFamilies.includes("axis_research");

  useEffect(() => {
    const abort = new AbortController();
    void fetchSatyaStatus(abort.signal).then((payload) => {
      const unavailable = payload.enabled === false || payload.available === false || payload.disabled === true;
      setDisabled(unavailable);
      if (typeof payload.message === "string" && payload.message.trim()) setStatusMessage(payload.message);
      if (payload.stale || stale) setState("stale");
      setCorpusHealth(satyaCorpusHealthFromStatus(payload));
    });
    void fetchSatyaSources(abort.signal).then((payload) => {
      if (Object.keys(payload.families).length) {
        setFetchedCounts((current) => ({ ...current, ...payload.families }));
      }
      if (Object.keys(payload.axisCategories).length) {
        setAxisCategoryCounts((current) => ({ ...current, ...payload.axisCategories }));
      }
    });
    return () => abort.abort();
  }, [stale]);

  useEffect(() => {
    setSatyaFocus({
      families: selectedFamilies,
      axisCategories: selectedAxisCategories,
    });
  }, [selectedFamilies, selectedAxisCategories]);

  const busyRef = useRef(false);

  const commitVisit = useCallback((turns: SatyaThreadTurn[], persist = false) => {
    visitRef.current = { sessionId: visitRef.current.sessionId, turns };
    setCanvasTurns(currentSatyaTurn(turns));
    if (visitRef.current.sessionId) {
      setSatyaThread({ sessionId: visitRef.current.sessionId, turns }, persist);
    } else {
      setSatyaThread({ sessionId: getSatyaThread().sessionId, turns }, persist);
    }
  }, []);

  const run = useCallback(async (
    nextPrompt: string,
    voice = false,
    retrieve?: { families?: SatyaSourceFamily[]; axisCategories?: AxisResearchCategoryId[] },
  ) => {
    const text = nextPrompt.trim();
    if (!text || busyRef.current) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setState("thinking");
    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;
    const userTurn: SatyaThreadTurn = { id: userId, role: "user", text, citations: [] as SatyaCitation[] };
    const assistantTurn: SatyaThreadTurn = { id: assistantId, role: "assistant", text: "", citations: [] };
    const shared = getSatyaThread();
    const sessionId = shared.sessionId;
    const visitTurns = [...shared.turns, userTurn, assistantTurn];
    visitRef.current = { sessionId, turns: visitTurns };
    setCanvasTurns(currentSatyaTurn(visitTurns));
    setSatyaThread({ sessionId, turns: visitTurns });
    openSatyaDraftPopout({ drafting: true });
    let assembled = "";
    const history = shared.turns
      .filter((turn) => turn.text.trim())
      .slice(-8)
      .map((turn) => ({ role: turn.role, content: turn.text }));
    const families = retrieve?.families ?? selectedFamilies;
    const axisCategories = retrieve?.axisCategories ?? selectedAxisCategories;
    await streamSatyaChat(
      {
        prompt: text,
        families,
        axisCategories,
        workspace: "intelligence",
        sessionId: sessionId ?? undefined,
        voice,
        history,
      },
      {
        onStatus: (next) => setState(next),
        onToken: (token) => {
          assembled += token;
          commitVisit(visitRef.current.turns.map((turn) => (
            turn.id === assistantId ? { ...turn, text: assembled } : turn
          )));
        },
        onCitation: (citation) => {
          setState("citing");
          commitVisit(visitRef.current.turns.map((turn) => (
            turn.id === assistantId ? { ...turn, citations: [...turn.citations, citation] } : turn
          )));
        },
        onSession: (id) => {
          visitRef.current = { ...visitRef.current, sessionId: id };
          setSatyaThread({ sessionId: id, turns: visitRef.current.turns }, true);
        },
        onDone: (finalText) => {
          const complete = finalText || assembled;
          if (complete) {
            commitVisit(visitRef.current.turns.map((turn) => (
              turn.id === assistantId ? { ...turn, text: complete } : turn
            )), true);
          }
          syncSatyaDraftPopout({ drafting: false });
          if (satyaShouldSpeak({ voice })) {
            setState("speaking");
            if (typeof window !== "undefined") {
              const speech = installSatyaSpeech(window);
              speech.onSpeechEnd = () => setState(stale ? "stale" : "idle");
              speech.speak(complete);
            } else {
              setState(stale ? "stale" : "idle");
            }
          } else {
            setState(stale ? "stale" : "idle");
          }
        },
        onError: (message) => {
          setError(message);
          syncSatyaDraftPopout({ drafting: false });
          setState("error");
        },
      },
      abort.signal,
    );
    busyRef.current = false;
    setBusy(false);
  }, [commitVisit, selectedAxisCategories, selectedFamilies, stale]);

  const toggleFamily = (family: SatyaSourceFamily) => {
    setSelectedFamilies((current) => {
      if (current.includes(family)) {
        const next = current.filter((item) => item !== family);
        return next.length ? next : current;
      }
      return [...current, family];
    });
  };

  const toggleAxisCategory = (id: AxisResearchCategoryId) => {
    setSelectedAxisCategories((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        return next.length ? next : current;
      }
      return [...current, id];
    });
  };

  return (
    <section className={["satya-briefing", "satya-m2-canvas", "llm-assist-span", className].filter(Boolean).join(" ")} data-state={presenceState}>
      <header className="satya-briefing-header">
        <SatyaFullBody state={presenceState} reducedMotion={reducedMotion} className="satya-briefing-avatar" />
        <div>
          <h3>Satya</h3>
          <p>{subtitle}</p>
          <p className="satya-briefing-disclaimer">
            Grounded on the Satya corpus. Machine-drafted, never a source for numbers. Mail, Axis PDFs, podcasts, and verified earnings KPIs remain the source of truth.
          </p>
          <p
            className="satya-corpus-health"
            data-ingest={corpusHealth.ingestError ? "error" : "ok"}
            data-document-count={corpusHealth.documentCount ?? undefined}
          >
            {typeof corpusHealth.documentCount === "number"
              ? `${corpusHealth.documentCount} documents`
              : "Corpus count pending"}
            {SATYA_SOURCE_CHIPS.map((chip) => {
              const count = sourceCounts[chip.id];
              return typeof count === "number" ? (
                <span key={chip.id}>{chip.label} {count}</span>
              ) : null;
            })}
            {corpusHealth.ingestError ? <span role="status">{corpusHealth.ingestError}</span> : null}
          </p>
        </div>
      </header>
      <SatyaPresence
        variant="briefing"
        state={presenceState}
        prompt={prompt}
        onPromptChange={setPrompt}
        disabled={disabled || busy}
        onStateChange={setState}
        onSubmitPrompt={(text, options) => {
          setPrompt(text);
          void run(text, options?.voice === true);
        }}
      />
      <div className="satya-source-chips" role="group" aria-label="Satya source families">
        {SATYA_SOURCE_CHIPS.map((chip) => {
          const count = sourceCounts[chip.id];
          const pressed = selectedFamilies.includes(chip.id);
          return (
            <button
              type="button"
              key={chip.id}
              className="satya-source-chip"
              aria-pressed={pressed}
              onClick={() => toggleFamily(chip.id)}
            >
              {chip.label}
              {typeof count === "number" ? <span>{count}</span> : null}
            </button>
          );
        })}
      </div>
      {axisFamilySelected ? (
        <SatyaAxisCategoryChips
          selected={selectedAxisCategories}
          counts={axisCategoryCounts}
          disabled={busy}
          onToggle={toggleAxisCategory}
          onAsk={(id, label) => {
            setSelectedAxisCategories([id]);
            setSelectedFamilies((current) => (
              current.includes("axis_research") ? current : [...current, "axis_research"]
            ));
            const ask = axisCategoryAskPrompt(label);
            setPrompt(ask);
            const families = selectedFamilies.includes("axis_research")
              ? selectedFamilies
              : [...selectedFamilies, "axis_research"];
            void run(ask, false, { families, axisCategories: [id] });
          }}
        />
      ) : null}
      <div className="satya-suggestion-chips" role="group" aria-label="Smart Suggestions" data-satya-workspace="intelligence">
        <em>Smart Suggestions</em>
        {suggestions.map((item) => (
          <button
            type="button"
            key={item.id}
            className="satya-suggestion-chip"
            disabled={busy}
            aria-pressed={prompt === item.prompt}
            onClick={() => setPrompt(item.prompt)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="satya-transcript" role="log" aria-live="polite" aria-label="Satya current turn">
        {visibleTurns.length === 0 ? (
          <p className="satya-transcript-empty">{statusMessage} Ask from Newsletters, Axis Research (mail and PDFs), Podcasts, and verified earnings KPIs. Older threads live in Chats.</p>
        ) : visibleTurns.map((turn) => (
          <article key={turn.id} className={`satya-turn satya-turn-${turn.role}`} data-role={turn.role}>
            <strong>{turn.role === "user" ? "You" : "Satya"}</strong>
            {turn.text ? <pre data-labeled={turn.role === "assistant" ? "machine-drafted" : undefined}>{turn.text}</pre> : (
              turn.role === "assistant"
                ? (busy
                  ? <SatyaDraftStatusLine active />
                  : <p className="satya-transcript-empty">Waiting for Satya.</p>)
                : null
            )}
            {turn.role === "assistant" ? <SatyaCitationIcons citations={turn.citations} /> : null}
          </article>
        ))}
      </div>
      {error ? <p className="satya-briefing-error" role="alert">{error}</p> : null}
      <div className="satya-briefing-composer">
        <button
          type="button"
          className="satya-send"
          disabled={disabled || busy || !prompt.trim()}
          onClick={() => void run(prompt, false)}
        >
          {busy ? <SatyaDraftStatusLine active as="span" className="" live={false} /> : "Ask Satya"}
        </button>
        <button
          type="button"
          className="satya-open-chats"
          onClick={() => openSatyaChats()}
        >
          Open Chats
        </button>
        <button
          type="button"
          className="satya-open-draft"
          disabled={!visibleTurns.length}
          onClick={() => openSatyaDraftPopout({ drafting: busy })}
        >
          Pop out
        </button>
        <button
          type="button"
          className="satya-launcher satya-open-popup"
          onClick={() => setSatyaPopupOpen(true)}
        >
          SATYA
        </button>
      </div>
    </section>
  );
}

export { SatyaCitationIcons } from "./satya-citation-icons";
