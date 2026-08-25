"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS } from "../satya/axis-categories.ts";
import { STRATJI_NAVIGATE_EVENT } from "./stratji-navigate";
import { SatyaGlyph, presenceStateLabel } from "./SatyaAvatar";
import { resolveSpeech } from "./satya-speech-controller";
import { SatyaAxisCategoryChips } from "./SatyaAxisCategoryChips";

export { presenceStateLabel, SatyaGlyph, SatyaFullBody } from "./SatyaAvatar";
export { SatyaAxisCategoryChips } from "./SatyaAxisCategoryChips";
import type { WorkspaceKey } from "./types";
import {
  completeSatyaWorkspaceTask,
  SATYA_SOURCE_CHIPS,
  DEFAULT_SATYA_FAMILIES,
  deleteSatyaSession,
  fetchSatyaSessions,
  fetchSatyaSources,
  fetchSatyaStatus,
  filterSatyaChatItems,
  getSatyaFocus,
  getSatyaTaskContext,
  getSatyaThread,
  getSatyaVoiceUri,
  isDashboardSatyaTask,
  isSatyaChatsOpen,
  isSatyaPopupOpen,
  renameSatyaSession,
  resolveSatyaWorkspaceSlot,
  satyaShouldSpeak,
  setSatyaChatsOpen,
  setSatyaFocus,
  setSatyaPopupOpen,
  setSatyaThread,
  setSatyaVoiceUri,
  streamSatyaChat,
  subscribeSatyaChats,
  subscribeSatyaFocus,
  subscribeSatyaPopup,
  subscribeSatyaTaskContext,
  subscribeSatyaThread,
  type AxisResearchCategoryId,
  type SatyaChatListItem,
  type SatyaCitation,
  type SatyaPresenceState,
  type SatyaSourceFamily,
  type SatyaTaskContext,
  type SatyaThreadState,
  type SatyaThreadTurn,
} from "./satya-client";
import { currentSatyaTurn, openSatyaDraftPopout, syncSatyaDraftPopout } from "./satya-draft-popout";
import { axisCategoryAskPrompt, isSatyaCorpusSuggestionPrompt, satyaSuggestionsForWorkspace } from "./satya-suggestions";
import { SatyaCitationIcons } from "./satya-citation-icons";
import { SatyaDraftPopout } from "./SatyaDraftPopout";
import { SatyaDraftStatusLine } from "./SatyaDraftStatusLine";
import { WaveformStrip } from "./visual-components";

export type { SatyaCitation, SatyaPresenceState, SatyaSourceFamily, SatyaStatusPayload } from "./satya-client";
export { fetchSatyaSources, fetchSatyaStatus, streamSatyaChat } from "./satya-client";

function briefingHref(): string {
  if (typeof window === "undefined") return "/?view=intelligence&section=m2";
  const url = new URL(window.location.href);
  url.searchParams.set("view", "intelligence");
  url.searchParams.set("section", "m2");
  url.searchParams.delete("page");
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function SatyaThreadLog({
  turns,
  empty,
  label,
  drafting = false,
}: {
  turns: SatyaThreadTurn[];
  empty: string;
  label: string;
  drafting?: boolean;
}) {
  if (turns.length === 0) {
    return <p className="satya-transcript-empty">{empty}</p>;
  }
  return (
    <div className="satya-thread-log" role="log" aria-live="polite" aria-label={label}>
      {turns.map((turn) => (
        <article key={turn.id} className={`satya-turn satya-turn-${turn.role}`} data-role={turn.role}>
          <strong>{turn.role === "user" ? "You" : "Satya"}</strong>
          {turn.text ? (
            <pre data-labeled={turn.role === "assistant" ? "machine-drafted" : undefined}>{turn.text}</pre>
          ) : (
            turn.role === "assistant"
              ? (drafting
                ? <SatyaDraftStatusLine active />
                : <p className="satya-transcript-empty">Waiting for Satya.</p>)
              : null
          )}
          {turn.role === "assistant" ? <SatyaCitationIcons citations={turn.citations} /> : null}
        </article>
      ))}
    </div>
  );
}

export function SatyaPresence({
  variant,
  state = "idle",
  onStateChange,
  onTranscript,
  onSubmitPrompt,
  disabled = false,
  compactLabel = false,
  prompt: promptProp,
  onPromptChange,
  workspace = "intelligence",
}: {
  variant: "companion" | "briefing";
  state?: SatyaPresenceState;
  onStateChange?: (state: SatyaPresenceState) => void;
  onTranscript?: (text: string) => void;
  onSubmitPrompt?: (text: string, options?: { voice: boolean }) => void;
  disabled?: boolean;
  compactLabel?: boolean;
  prompt?: string;
  onPromptChange?: (value: string) => void;
  workspace?: WorkspaceKey;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(() => isSatyaChatsOpen());
  const [chatsView, setChatsView] = useState<"list" | "thread">("list");
  const [chatItems, setChatItems] = useState<SatyaChatListItem[]>([]);
  const [chatQuery, setChatQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [thread, setThread] = useState<SatyaThreadState>(() => getSatyaThread());
  const [familyCounts, setFamilyCounts] = useState<Partial<Record<SatyaSourceFamily, number>>>({});
  const [axisCategoryCounts, setAxisCategoryCounts] = useState<Partial<Record<AxisResearchCategoryId, number>>>({});
  const [voices, setVoices] = useState<SatyaSpeechVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState(() => getSatyaVoiceUri());
  const [promptDraft, setPromptDraft] = useState("");
  const prompt = promptProp ?? promptDraft;
  const setPrompt = useCallback((value: string) => {
    if (promptProp === undefined) setPromptDraft(value);
    onPromptChange?.(value);
  }, [onPromptChange, promptProp]);
  const [localState, setLocalState] = useState<SatyaPresenceState>(state);
  const [reply, setReply] = useState("");
  const [citations, setCitations] = useState<SatyaCitation[]>([]);
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  const [nativeEmbed] = useState(() => (
    typeof document !== "undefined" && document.documentElement.classList.contains("native-chrome-embed")
  ));
  const [companionDisabled, setCompanionDisabled] = useState(disabled);
  const [statusNote, setStatusNote] = useState("");
  const [portalHost] = useState<HTMLElement | null>(() => (
    typeof document === "undefined" ? null : document.body
  ));
  const [focus, setFocus] = useState(() => getSatyaFocus());
  const [routeSearch, setRouteSearch] = useState(() => (
    typeof window === "undefined" ? "" : window.location.search
  ));
  const [taskRevision, setTaskRevision] = useState(0);
  const holdRef = useRef(false);
  const listeningRef = useRef(false);
  const promptRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    return subscribeSatyaFocus(() => setFocus(getSatyaFocus()));
  }, []);

  useEffect(() => {
    return subscribeSatyaTaskContext(() => setTaskRevision((current) => current + 1));
  }, []);

  useEffect(() => {
    return subscribeSatyaPopup(() => setSheetOpen(isSatyaPopupOpen()));
  }, []);

  useEffect(() => {
    return subscribeSatyaThread(() => setThread(getSatyaThread()));
  }, []);

  const openPopup = useCallback(() => {
    setSatyaPopupOpen(true);
    setSheetOpen(true);
  }, []);

  const closePopup = useCallback(() => {
    setSatyaChatsOpen(false);
    setChatsView("list");
    setSatyaPopupOpen(false);
    setSheetOpen(false);
  }, []);

  useEffect(() => {
    return subscribeSatyaChats(() => {
      const open = isSatyaChatsOpen();
      setChatsOpen(open);
      if (open) {
        setSheetOpen(true);
        setChatsView("list");
        setChatQuery("");
        setRenamingId(null);
        void fetchSatyaSessions().then(setChatItems);
      }
    });
  }, []);

  useEffect(() => {
    if (variant !== "companion" || !sheetOpen) return undefined;
    const abort = new AbortController();
    void fetchSatyaSources(abort.signal).then((payload) => {
      if (Object.keys(payload.families).length) setFamilyCounts(payload.families);
      if (Object.keys(payload.axisCategories).length) setAxisCategoryCounts(payload.axisCategories);
    });
    return () => abort.abort();
  }, [sheetOpen, variant]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const api = installSatyaSpeech(window);
    api.onVoices = (list) => {
      if (list.length) setVoices(list);
    };
    api.listVoices();
    if (api.native) return undefined;
    if (typeof window.speechSynthesis === "undefined") return undefined;
    const sync = () => {
      const list = api.voices();
      if (list.length) setVoices(list);
    };
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    const timeout = window.setTimeout(sync, 0);
    return () => {
      window.clearTimeout(timeout);
      window.speechSynthesis.removeEventListener("voiceschanged", sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !voiceUri) return;
    installSatyaSpeech(window).setVoice(voiceUri);
  }, [voiceUri]);

  useEffect(() => {
    if (variant !== "companion") return;
    const sync = () => setRouteSearch(window.location.search);
    window.addEventListener("popstate", sync);
    window.addEventListener(STRATJI_NAVIGATE_EVENT, sync);
    sync();
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(STRATJI_NAVIGATE_EVENT, sync);
    };
  }, [variant]);

  const slot = variant === "companion" ? resolveSatyaWorkspaceSlot(workspace, routeSearch) : "satya";
  const taskContext: SatyaTaskContext | null = variant === "companion" ? getSatyaTaskContext(slot) : null;
  void taskRevision;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);


  useLayoutEffect(() => {
    if (variant !== "companion" || !sheetOpen) return;
    composerRef.current?.focus();
  }, [sheetOpen, variant]);

  useEffect(() => {
    if (variant !== "companion") return;
    const abort = new AbortController();
    void fetchSatyaStatus(abort.signal).then((payload) => {
      const unavailable = payload.enabled === false || payload.available === false || payload.disabled === true;
      setCompanionDisabled(unavailable);
      if (typeof payload.message === "string" && payload.message.trim()) {
        setStatusNote(payload.message.trim());
      }
      if (payload.stale) {
        setLocalState("stale");
        onStateChange?.("stale");
      }
    }).catch(() => {
      /* Keep the launcher visible. Status failure only disables chat. */
    });
    return () => abort.abort();
  }, [onStateChange, variant]);

  const publishState = useCallback((next: SatyaPresenceState) => {
    setLocalState(next);
    onStateChange?.(next);
  }, [onStateChange]);

  const setListening = useCallback((active: boolean) => {
    listeningRef.current = active;
    publishState(active ? "listening" : "idle");
  }, [publishState]);

  const submitPrompt = useCallback(async (text: string, options?: { voice: boolean }) => {
    const value = text.trim();
    if (!value) return;
    const voice = options?.voice === true;
    onSubmitPrompt?.(value, { voice });
    if (variant !== "companion" || onSubmitPrompt) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setReply("");
    setCitations([]);
    publishState("thinking");
    const search = window.location.search;
    const section = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("section") ?? "";
    const active = getSatyaTaskContext(resolveSatyaWorkspaceSlot(workspace, search));
    const catalog = satyaSuggestionsForWorkspace(workspace, { section, subject: active?.subject });
    const speakDone = (spoken: string) => {
      if (!satyaShouldSpeak({ voice })) {
        publishState("idle");
        return;
      }
      publishState("speaking");
      if (typeof window !== "undefined" && voiceUri) {
        installSatyaSpeech(window).setVoice(voiceUri);
      }
      resolveSpeech().speak(spoken, () => publishState("idle"));
    };
    const prior = getSatyaThread();
    const userTurn: SatyaThreadTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      text: value,
      citations: [],
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantTurn: SatyaThreadTurn = { id: assistantId, role: "assistant", text: "", citations: [] };
    setSatyaThread({ sessionId: prior.sessionId, turns: [...prior.turns, userTurn, assistantTurn] });
    if (active && isDashboardSatyaTask(active.task) && !isSatyaCorpusSuggestionPrompt(value, catalog)) {
      let appliedTree = false;
      await completeSatyaWorkspaceTask(
        { task: active.task, prompt: value, context: active.context },
        {
          onStatus: publishState,
          onToken: (token) => setReply((current) => current + token),
          onTree: (tree) => {
            appliedTree = true;
            active.onApplyTree?.(tree);
          },
          onDone: (finalText) => {
            if (finalText) setReply(finalText);
            const spoken = active.task === "builder" && appliedTree
              ? "Applied a drafted StrategyTreeV1 to Algorithm Canvas."
              : finalText || "";
            speakDone(spoken);
          },
          onError: (message) => {
            if (message) setReply(message);
            publishState("error");
          },
        },
        abort.signal,
      );
      return;
    }
    openSatyaDraftPopout({ drafting: true });
    let assembled = "";
    const liveFocus = getSatyaFocus();
    await streamSatyaChat(
      {
        prompt: value,
        families: liveFocus.families ?? DEFAULT_SATYA_FAMILIES,
        axisCategories: liveFocus.axisCategories ?? [...DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS],
        workspace,
        sessionId: prior.sessionId ?? undefined,
        voice,
        history: prior.turns
          .filter((turn) => turn.text.trim())
          .map((turn) => ({ role: turn.role, content: turn.text })),
      },
      {
        onStatus: publishState,
        onToken: (token) => {
          assembled += token;
          setReply(assembled);
          const latest = getSatyaThread();
          setSatyaThread({
            sessionId: latest.sessionId,
            turns: latest.turns.map((turn) => (turn.id === assistantId ? { ...turn, text: assembled } : turn)),
          });
        },
        onCitation: (citation) => {
          setCitations((current) => [...current, citation]);
          publishState("citing");
          const latest = getSatyaThread();
          setSatyaThread({
            sessionId: latest.sessionId,
            turns: latest.turns.map((turn) => (
              turn.id === assistantId ? { ...turn, citations: [...turn.citations, citation] } : turn
            )),
          });
        },
        onSession: (sessionId) => {
          const latest = getSatyaThread();
          setSatyaThread({ sessionId, turns: latest.turns }, true);
        },
        onDone: (finalText) => {
          const complete = finalText || assembled;
          if (complete) {
            setReply(complete);
            const latest = getSatyaThread();
            setSatyaThread({
              sessionId: latest.sessionId,
              turns: latest.turns.map((turn) => (turn.id === assistantId ? { ...turn, text: complete } : turn)),
            }, true);
          }
          syncSatyaDraftPopout({ drafting: false });
          speakDone(complete);
        },
        onError: (message) => {
          if (message) setReply(message);
          syncSatyaDraftPopout({ drafting: false });
          publishState("error");
        },
      },
      abort.signal,
    );
  }, [onSubmitPrompt, publishState, variant, voiceUri, workspace]);

  const startPushToTalk = useCallback(async () => {
    if (disabled || companionDisabled || taskContext?.disabled || listeningRef.current) return;
    const speech = await resolveSpeech();
    setListening(true);
    speech.startListening((text) => {
      setPrompt(text);
      onTranscript?.(text);
    }, (error) => {
      setListening(false);
      publishState("error");
      onTranscript?.(error);
    });
  }, [companionDisabled, disabled, onTranscript, publishState, setListening, setPrompt, taskContext?.disabled]);

  const stopPushToTalk = useCallback(async (submit = false) => {
    const speech = await resolveSpeech();
    speech.stopListening();
    setListening(false);
    if (submit) {
      const text = promptRef.current.trim();
      if (text) void submitPrompt(text, { voice: true });
    }
  }, [setListening, submitPrompt]);

  const cancelAll = useCallback(async () => {
    abortRef.current?.abort();
    const speech = await resolveSpeech();
    speech.cancel();
    setListening(false);
    publishState("idle");
  }, [publishState, setListening]);

  const onOrbPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    holdRef.current = true;
    openPopup();
    const node = event.currentTarget;
    node.setPointerCapture(event.pointerId);
    window.setTimeout(() => {
      if (holdRef.current) void startPushToTalk();
    }, 180);
  };

  const onOrbPointerUp = () => {
    holdRef.current = false;
    if (listeningRef.current) void stopPushToTalk(true);
  };

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void cancelAll();
      closePopup();
      return;
    }
    if (event.key !== " " && event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable || target.tagName === "SELECT")) return;
    event.preventDefault();
    if (!listeningRef.current) void startPushToTalk();
  };

  const onRootKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== " " && event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) return;
    event.preventDefault();
    if (listeningRef.current) void stopPushToTalk(true);
  };

  const displayState = variant === "briefing" && localState !== "listening" ? state : localState;
  const speaking = displayState === "speaking";
  const statusText = presenceStateLabel(displayState);
  const workspaceTask = taskContext && isDashboardSatyaTask(taskContext.task) ? taskContext : null;
  const section = new URLSearchParams(routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch).get("section") ?? "";
  const suggestionCatalog = satyaSuggestionsForWorkspace(workspace, {
    section,
    subject: taskContext?.subject,
  });
  const suggestionChips = suggestionCatalog.suggestions;
  const chatDisabled = disabled || (variant === "companion" && (companionDisabled || Boolean(taskContext?.disabled)));
  const orbDisabled = variant === "briefing" && chatDisabled;
  const visibleChats = filterSatyaChatItems(chatItems, chatQuery);
  const composerPlaceholder = suggestionCatalog.placeholder
    ?? workspaceTask?.placeholder
    ?? "Ask from the Satya corpus. Numbers stay on Mail, PDFs, podcasts, and verified earnings.";

  const mark = (
    <button
      type="button"
      className="satya-orb satya-launcher"
      data-state={displayState}
      aria-pressed={displayState === "listening"}
      aria-expanded={sheetOpen}
      aria-haspopup="dialog"
      aria-label={`SATYA, ${statusText}. Hold or press Space to talk.`}
      disabled={orbDisabled}
      onPointerDown={onOrbPointerDown}
      onPointerUp={onOrbPointerUp}
      onPointerCancel={() => {
        holdRef.current = false;
        if (listeningRef.current) void stopPushToTalk(false);
      }}
      onClick={() => openPopup()}
    >
      <SatyaGlyph state={displayState} reducedMotion={reducedMotion} />
      {speaking && !reducedMotion ? (
        <WaveformStrip seed={displayState.length + 7} bars={12} />
      ) : null}
      <span className="satya-orb-name">SATYA</span>
      <span className="satya-presence-status">{statusText}</span>
    </button>
  );

  const composer = (
    <label className="satya-composer-label">
      Ask Satya
      <textarea
        ref={composerRef}
        className="satya-composer"
        rows={variant === "companion" ? 2 : 3}
        value={prompt}
        disabled={chatDisabled}
        placeholder={composerPlaceholder}
        onChange={(event) => {
          setPrompt(event.target.value);
          onTranscript?.(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const text = prompt.trim();
            if (text) void submitPrompt(text, { voice: false });
          }
        }}
      />
    </label>
  );

  if (variant === "briefing") {
    return (
      <div
        ref={rootRef}
        className={`satya-presence satya-presence-briefing${compactLabel ? " compact" : ""}`}
        data-state={displayState}
        data-reduced-motion={reducedMotion ? "true" : "false"}
        tabIndex={0}
        onKeyDown={onRootKeyDown}
        onKeyUp={onRootKeyUp}
      >
        {mark}
        {composer}
        <button
          type="button"
          className="satya-ptt"
          disabled={chatDisabled}
          onPointerDown={(event) => {
            event.preventDefault();
            void startPushToTalk();
          }}
          onPointerUp={() => void stopPushToTalk(true)}
        >
          Push to talk
        </button>
      </div>
    );
  }

  const companion = (
    <div
      ref={rootRef}
      className={`satya-companion${nativeEmbed ? " satya-companion-native" : ""}`}
      data-state={displayState}
      data-open={sheetOpen ? "true" : "false"}
      data-satya-task={workspaceTask?.task ?? "satya"}
      data-satya-workspace={workspace}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      tabIndex={0}
      onKeyDown={onRootKeyDown}
      onKeyUp={onRootKeyUp}
    >
      {sheetOpen ? (
        <div className="satya-popup satya-talk-sheet" role="dialog" aria-modal="true" aria-label="Satya">
          <header className="satya-popup-head">
            <SatyaGlyph state={displayState} reducedMotion={reducedMotion} />
            <div>
              <strong>SATYA</strong>
              {displayState === "thinking" || displayState === "citing"
                ? <SatyaDraftStatusLine active as="span" className="satya-presence-status" />
                : <span className="satya-presence-status">{statusText}</span>}
            </div>
            {speaking && !reducedMotion ? <WaveformStrip seed={displayState.length + 11} bars={16} /> : null}
            <button type="button" className="satya-sheet-close" onClick={() => { void cancelAll(); closePopup(); }}>
              Close
            </button>
          </header>
          <p className="satya-talk-copy">
            {companionDisabled && statusNote
              ? statusNote
              : suggestionCatalog.hint
                ? `${suggestionCatalog.hint} Machine-drafted, never a source for numbers.`
                : workspaceTask
                  ? `${workspaceTask.hint} Machine-drafted, never a source for numbers.`
                  : "Grounded on the Satya corpus. Machine-drafted, never a source for numbers."}
          </p>
          {chatsOpen ? (
            <div className="satya-chats-panel" role="listbox" aria-label="Chats">
              <header className="satya-chats-head">
                <strong>Chats</strong>
                <span>Assistant</span>
              </header>
              {chatsView === "thread" ? (
                <>
                  <button
                    type="button"
                    className="satya-chats-back"
                    onClick={() => {
                      setChatsView("list");
                      void fetchSatyaSessions().then(setChatItems);
                    }}
                  >
                    All chats
                  </button>
                  <SatyaThreadLog
                    turns={thread.turns}
                    empty="This chat has no turns yet."
                    label="Satya chat transcript"
                  />
                </>
              ) : (
                <>
                  <label className="satya-chats-search-label">
                    Search chats
                    <input
                      type="search"
                      className="satya-chats-search"
                      value={chatQuery}
                      placeholder="Search titles"
                      aria-label="Search chats"
                      onChange={(event) => setChatQuery(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="satya-chats-new"
                    onClick={() => {
                      setSatyaThread({ sessionId: null, turns: [] }, true);
                      setReply("");
                      setCitations([]);
                      setChatsView("list");
                      setRenamingId(null);
                      setSatyaChatsOpen(false);
                    }}
                  >
                    New chat
                  </button>
                  {chatItems.length === 0 ? (
                    <p className="satya-transcript-empty">No saved chats yet.</p>
                  ) : visibleChats.length === 0 ? (
                    <p className="satya-transcript-empty">No chats match that title.</p>
                  ) : visibleChats.map((item) => (
                    <div key={item.id} className="satya-chats-row">
                      {renamingId === item.id ? (
                        <form
                          className="satya-chats-rename-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const nextTitle = renameDraft.trim();
                            if (!nextTitle) return;
                            void renameSatyaSession(item.id, nextTitle).then((items) => {
                              setChatItems(items);
                              setRenamingId(null);
                            });
                          }}
                        >
                          <input
                            className="satya-chats-rename-input"
                            value={renameDraft}
                            aria-label={`Rename ${item.title}`}
                            autoFocus
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setRenamingId(null);
                              }
                            }}
                          />
                          <button type="submit" className="satya-chats-rename">Save</button>
                          <button
                            type="button"
                            className="satya-chats-rename"
                            onClick={() => setRenamingId(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="satya-chats-item"
                          aria-pressed={thread.sessionId === item.id}
                          onClick={() => {
                            setSatyaThread({ sessionId: item.id, turns: item.turns }, true);
                            const last = item.turns.filter((turn) => turn.role === "assistant").at(-1);
                            setReply(last?.text ?? "");
                            setCitations(last?.citations ?? []);
                            setChatsView("thread");
                          }}
                        >
                          <strong>{item.title}</strong>
                          {item.updatedAt ? <span>{item.updatedAt.slice(0, 10)}</span> : null}
                        </button>
                      )}
                      {renamingId === item.id ? null : (
                        <div className="satya-chats-item-actions">
                          <button
                            type="button"
                            className="satya-chats-rename"
                            onClick={() => {
                              setRenamingId(item.id);
                              setRenameDraft(item.title);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="satya-chats-delete"
                            onClick={() => {
                              void deleteSatyaSession(item.id).then((items) => {
                                setChatItems(items);
                                if (thread.sessionId === item.id) {
                                  setReply("");
                                  setCitations([]);
                                }
                              });
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="satya-popup-chat">
              <SatyaThreadLog
                turns={thread.turns.length || reply
                  ? (thread.turns.length ? currentSatyaTurn(thread.turns) : currentSatyaTurn([
                    { id: "user-live", role: "user" as const, text: prompt, citations: [] },
                    { id: "assistant-live", role: "assistant" as const, text: reply, citations },
                  ]))
                  : []}
                empty="Ask Satya. Older threads live in Chats."
                label="Satya chat"
                drafting={displayState === "thinking" || displayState === "citing"}
              />
            </div>
          )}
          {composer}
          {suggestionChips.length || suggestionCatalog.note ? (
            <div
              className="satya-suggestion-chips satya-workspace-chips"
              role="group"
              aria-label="Smart Suggestions"
              data-satya-workspace={workspace}
            >
              <em>Smart Suggestions</em>
              {suggestionCatalog.note ? <p className="satya-suggestion-note">{suggestionCatalog.note}</p> : null}
              {suggestionChips.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="satya-suggestion-chip"
                  disabled={chatDisabled}
                  aria-pressed={prompt === item.prompt}
                  onClick={() => setPrompt(item.prompt)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <details className="satya-sources-disclosure">
              <summary>Sources / Categories</summary>
              <div className="satya-source-chips" role="group" aria-label="Satya source families">
                {SATYA_SOURCE_CHIPS.map((chip) => {
                  const selected = focus.families ?? DEFAULT_SATYA_FAMILIES;
                  const pressed = selected.includes(chip.id);
                  return (
                    <button
                      type="button"
                      key={chip.id}
                      className="satya-source-chip"
                      aria-pressed={pressed}
                      onClick={() => {
                        const current = focus.families ?? DEFAULT_SATYA_FAMILIES;
                        const next = current.includes(chip.id)
                          ? current.filter((item) => item !== chip.id)
                          : [...current, chip.id];
                        setSatyaFocus({
                          families: next.length ? next : current,
                          axisCategories: focus.axisCategories,
                        });
                      }}
                    >
                      {chip.label}
                      {typeof familyCounts[chip.id] === "number" ? <span>{familyCounts[chip.id]}</span> : null}
                    </button>
                  );
                })}
              </div>
              {focus.families === undefined || focus.families.includes("axis_research") ? (
                <SatyaAxisCategoryChips
                  compact
                  disabled={chatDisabled}
                  selected={focus.axisCategories ?? [...DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS]}
                  counts={axisCategoryCounts}
                  onToggle={(id) => {
                    const current = focus.axisCategories ?? [...DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS];
                    const next = current.includes(id)
                      ? current.filter((item) => item !== id)
                      : [...current, id];
                    setSatyaFocus({
                      families: focus.families,
                      axisCategories: next.length ? next : current,
                    });
                  }}
                  onAsk={(id, label) => {
                    const families = focus.families ?? DEFAULT_SATYA_FAMILIES;
                    setSatyaFocus({
                      families: families.includes("axis_research") ? families : [...families, "axis_research"],
                      axisCategories: [id],
                    });
                    void submitPrompt(axisCategoryAskPrompt(label), { voice: false });
                  }}
                />
              ) : null}
          </details>
          <label className="satya-voice-picker">
            Voice
            <select
              value={voiceUri}
              aria-label="Satya voice"
              onChange={(event) => {
                const next = event.target.value;
                setVoiceUri(next);
                setSatyaVoiceUri(next);
                if (typeof window !== "undefined") installSatyaSpeech(window).setVoice(next);
              }}
            >
              <option value="">Default</option>
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                  {voice.lang ? ` (${voice.lang})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="satya-talk-actions">
            <button
              type="button"
              className="satya-chats"
              aria-pressed={chatsOpen}
              onClick={() => {
                const next = !chatsOpen;
                setSatyaChatsOpen(next);
                if (next) {
                  setChatsView("list");
                  void fetchSatyaSessions().then(setChatItems);
                } else {
                  setChatsView("list");
                }
              }}
            >
              CHATS
            </button>
            <button
              type="button"
              className="satya-ptt"
              disabled={chatDisabled}
              onPointerDown={(event) => {
                event.preventDefault();
                void startPushToTalk();
              }}
              onPointerUp={() => void stopPushToTalk(true)}
            >
              Push to talk
            </button>
            <button
              type="button"
              className="satya-send"
              disabled={chatDisabled || !prompt.trim()}
              onClick={() => void submitPrompt(prompt, { voice: false })}
            >
              Send
            </button>
            <button
              type="button"
              className="satya-open-draft"
              disabled={!thread.turns.length && !reply}
              onClick={() => openSatyaDraftPopout({ drafting: displayState === "thinking" || displayState === "citing" })}
            >
              Pop out
            </button>
            <a className="satya-open-briefing" href={briefingHref()}>Open briefing</a>
          </div>
        </div>
      ) : null}
      {mark}
    </div>
  );

  const sheet = portalHost ? createPortal(companion, portalHost) : companion;
  return (
    <>
      {sheet}
      <SatyaDraftPopout />
    </>
  );
}
