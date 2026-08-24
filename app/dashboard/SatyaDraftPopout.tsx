"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { getSatyaThread, subscribeSatyaThread, type SatyaThreadTurn } from "./satya-client";
import {
  closeSatyaDraftPopout,
  currentSatyaTurn,
  hasNativeSatyaDraftPopout,
  installSatyaDraftNativeCallbacks,
  isSatyaDraftPopoutDrafting,
  isSatyaDraftPopoutOpen,
  subscribeSatyaDraftPopout,
} from "./satya-draft-popout";
import { SatyaCitationIcons } from "./satya-citation-icons";
import { SatyaDraftStatusLine } from "./SatyaDraftStatusLine";
import "./satya-draft-popout.css";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

function DraftTurnLog({ turns, drafting }: { turns: SatyaThreadTurn[]; drafting: boolean }) {
  if (turns.length === 0) {
    return (
      <p className="satya-transcript-empty">
        Ask Satya. This window shows the current turn — closing it keeps the thread on M-2 and the orb.
      </p>
    );
  }
  return (
    <div className="satya-thread-log" role="log" aria-live="polite" aria-label="Satya current chat">
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

/** Web parity for the native Satya NSPanel. Native Stratji.app owns the real window. */
export function SatyaDraftPopout() {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(() => isSatyaDraftPopoutOpen());
  const [drafting, setDrafting] = useState(() => isSatyaDraftPopoutDrafting());
  const [turns, setTurns] = useState<SatyaThreadTurn[]>(() => currentSatyaTurn(getSatyaThread().turns));
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.body);
    installSatyaDraftNativeCallbacks(window);
  }, []);

  useEffect(() => {
    const sync = () => {
      setOpen(isSatyaDraftPopoutOpen());
      setDrafting(isSatyaDraftPopoutDrafting());
      setTurns(currentSatyaTurn(getSatyaThread().turns));
    };
    const stopDraft = subscribeSatyaDraftPopout(sync);
    const stopThread = subscribeSatyaThread(sync);
    return () => {
      stopDraft();
      stopThread();
    };
  }, []);

  useEffect(() => {
    if (!open || hasNativeSatyaDraftPopout()) return undefined;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeSatyaDraftPopout();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previously?.focus();
    };
  }, [open]);

  const onTrap = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => !node.hasAttribute("disabled"));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open || hasNativeSatyaDraftPopout() || !host) return null;

  return createPortal(
    <div className="satya-draft-popout-backdrop" data-testid="satya-draft-popout-backdrop">
      <div
        ref={dialogRef}
        className="satya-draft-popout"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="satya-draft-popout"
        onKeyDown={onTrap}
      >
        <header className="satya-draft-popout-head">
          <div>
            <strong id={titleId}>SATYA</strong>
            {drafting
              ? <SatyaDraftStatusLine active as="span" className="" />
              : <span>Current chat</span>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="satya-sheet-close"
            onClick={() => closeSatyaDraftPopout()}
          >
            Close
          </button>
        </header>
        <div className="satya-draft-popout-body">
          <DraftTurnLog turns={turns} drafting={drafting} />
        </div>
        <p className="satya-draft-popout-foot">
          Grounded on the Satya corpus. Machine-drafted, never a source for numbers. Closing keeps this thread on M-2 and the orb.
        </p>
      </div>
    </div>,
    host,
  );
}
