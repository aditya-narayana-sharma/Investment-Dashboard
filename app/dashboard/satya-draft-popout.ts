import { getSatyaThread, onSatyaThreadNotify, type SatyaThreadTurn } from "./satya-client.ts";

type NativeDraftHandler = {
  postMessage: (message: unknown) => void;
};

let satyaDraftPopoutOpen = false;
let satyaDraftPopoutDrafting = false;
const satyaDraftPopoutListeners = new Set<() => void>();

function nativeSatyaDraftHandler(): NativeDraftHandler | null {
  if (typeof window === "undefined") return null;
  const webkit = (window as Window & {
    webkit?: { messageHandlers?: { satyaDraft?: NativeDraftHandler } };
  }).webkit;
  return webkit?.messageHandlers?.satyaDraft ?? null;
}

export function hasNativeSatyaDraftPopout(): boolean {
  return nativeSatyaDraftHandler() != null;
}

export type SatyaDraftPopoutPayload = {
  action: "open" | "update" | "close";
  sessionId: string | null;
  drafting: boolean;
  turns: SatyaThreadTurn[];
};

export function currentSatyaTurn(turns: SatyaThreadTurn[]): SatyaThreadTurn[] {
  let lastUser = -1;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index]?.role === "user") {
      lastUser = index;
      break;
    }
  }
  return lastUser < 0 ? [] : turns.slice(lastUser);
}

export function satyaDraftPopoutPayload(action: SatyaDraftPopoutPayload["action"]): SatyaDraftPopoutPayload {
  return {
    action,
    sessionId: getSatyaThread().sessionId,
    drafting: satyaDraftPopoutDrafting,
    turns: currentSatyaTurn(getSatyaThread().turns),
  };
}

function notifySatyaDraftPopout() {
  for (const listener of satyaDraftPopoutListeners) listener();
}

function postNativeSatyaDraft(action: SatyaDraftPopoutPayload["action"]) {
  nativeSatyaDraftHandler()?.postMessage(satyaDraftPopoutPayload(action));
}

export function isSatyaDraftPopoutOpen() {
  return satyaDraftPopoutOpen;
}

export function isSatyaDraftPopoutDrafting() {
  return satyaDraftPopoutDrafting;
}

/** Open the current Satya turn in the native NSPanel (Stratji.app) or the web parity dialog. */
export function openSatyaDraftPopout(options?: { drafting?: boolean }) {
  satyaDraftPopoutOpen = true;
  if (options?.drafting !== undefined) satyaDraftPopoutDrafting = options.drafting;
  notifySatyaDraftPopout();
  postNativeSatyaDraft("open");
}

/** Hide the pop-out. Does not clear or replace the Satya thread. */
export function closeSatyaDraftPopout() {
  const wasOpen = satyaDraftPopoutOpen;
  satyaDraftPopoutOpen = false;
  satyaDraftPopoutDrafting = false;
  notifySatyaDraftPopout();
  if (wasOpen) postNativeSatyaDraft("close");
}

export function syncSatyaDraftPopout(options?: { drafting?: boolean }) {
  if (options?.drafting !== undefined) satyaDraftPopoutDrafting = options.drafting;
  notifySatyaDraftPopout();
  if (satyaDraftPopoutOpen) postNativeSatyaDraft("update");
}

export function subscribeSatyaDraftPopout(listener: () => void) {
  satyaDraftPopoutListeners.add(listener);
  return () => {
    satyaDraftPopoutListeners.delete(listener);
  };
}

export function installSatyaDraftNativeCallbacks(target: Window & { satyaDraft?: { onClose?: () => void } } = window) {
  const existing = target.satyaDraft ?? {};
  existing.onClose = () => {
    satyaDraftPopoutOpen = false;
    satyaDraftPopoutDrafting = false;
    notifySatyaDraftPopout();
  };
  target.satyaDraft = existing;
  return existing;
}

onSatyaThreadNotify(() => {
  notifySatyaDraftPopout();
  if (satyaDraftPopoutOpen) postNativeSatyaDraft("update");
});
