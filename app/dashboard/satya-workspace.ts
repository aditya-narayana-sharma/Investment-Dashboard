"use client";

import { useEffect } from "react";
import { setSatyaTaskContext, type SatyaTaskContext } from "./satya-client";

export type { SatyaTaskContext };

export function useSatyaTaskContext(slot: string, payload: SatyaTaskContext) {
  const suggestionKey = (payload.suggestions ?? []).map((item) => `${item.id}:${item.label}`).join("|");
  useEffect(() => {
    setSatyaTaskContext(slot, {
      task: payload.task,
      hint: payload.hint,
      context: payload.context,
      placeholder: payload.placeholder,
      suggestions: payload.suggestions,
      disabled: payload.disabled,
      onApplyTree: payload.onApplyTree,
    });
    return () => setSatyaTaskContext(slot, null);
  }, [
    slot,
    payload.task,
    payload.hint,
    payload.context,
    payload.placeholder,
    payload.disabled,
    payload.onApplyTree,
    payload.suggestions,
    suggestionKey,
  ]);
}
