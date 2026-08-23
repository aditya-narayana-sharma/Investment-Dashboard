import type { SatyaSpeechApi, SatyaSpeechVoice } from "./speech.ts";

type NativeSpeechHandler = {
  postMessage: (message: unknown) => void;
};

export type SatyaListenGate = {
  readonly generation: number;
  readonly listening: boolean;
  beginStart(): number;
  end(): number;
  isCurrent(startGeneration: number): boolean;
};

/**
 * Push-to-talk generation token. `end()` (stop/cancel) makes a captured start a no-op
 * so a late permission grant cannot begin recognition.
 */
export function createSatyaListenGate(): SatyaListenGate {
  let generation = 0;
  let listening = false;
  return {
    get generation() {
      return generation;
    },
    get listening() {
      return listening;
    },
    beginStart() {
      generation += 1;
      listening = true;
      return generation;
    },
    end() {
      generation += 1;
      listening = false;
      return generation;
    },
    isCurrent(startGeneration: number) {
      return listening && startGeneration === generation;
    },
  };
}

/** Same guard as native `listenGeneration` + `wantsListening` after TCC returns. */
export function shouldBeginSatyaRecognition(
  gate: SatyaListenGate,
  startGeneration: number,
): boolean {
  return gate.isCurrent(startGeneration);
}

/**
 * Completes an in-flight start after an awaited permission (or a test delay).
 * Returns false when stop/cancel already invalidated `startGeneration`.
 */
export async function finishSatyaListenStart(
  gate: SatyaListenGate,
  startGeneration: number,
  beginRecognition: () => void,
  permission: Promise<boolean> = Promise.resolve(true),
): Promise<boolean> {
  const allowed = await permission;
  if (!shouldBeginSatyaRecognition(gate, startGeneration)) return false;
  if (!allowed) return false;
  beginRecognition();
  return true;
}

/** Native Stratji WKWebView: `webkit.messageHandlers.satyaSpeech.postMessage({ action, text })`. */
function nativeHandler(): NativeSpeechHandler | null {
  if (typeof window === "undefined") return null;
  const webkit = (window as Window & {
    webkit?: { messageHandlers?: { satyaSpeech?: NativeSpeechHandler } };
  }).webkit;
  return webkit?.messageHandlers?.satyaSpeech ?? null;
}

export function hasNativeSatyaSpeech(): boolean {
  return nativeHandler() != null;
}

export function createNativeSatyaSpeech(
  handler: NativeSpeechHandler | null = nativeHandler(),
  gate: SatyaListenGate = createSatyaListenGate(),
): SatyaSpeechApi {
  const post = (message: unknown) => {
    handler?.postMessage(message);
  };
  let selectedVoice = "";
  let cachedVoices: SatyaSpeechVoice[] = [];
  let voicesListener: ((voices: SatyaSpeechVoice[]) => void) | null = null;
  const api: SatyaSpeechApi = {
    available: true,
    native: true,
    start() {
      gate.beginStart();
      post({ action: "start" });
    },
    stop() {
      gate.end();
      post({ action: "stop" });
    },
    cancel() {
      gate.end();
      post({ action: "cancel" });
    },
    speak(text: string) {
      gate.end();
      post({ action: "speak", text, voice: selectedVoice });
    },
    voices() {
      return cachedVoices;
    },
    listVoices() {
      post({ action: "voices" });
    },
    setVoice(id: string) {
      selectedVoice = id.trim();
      post({ action: "setVoice", voice: selectedVoice });
    },
    getVoice() {
      return selectedVoice;
    },
    onPartial: null,
    onFinal: null,
    onSpeechEnd: null,
    get onVoices() {
      return voicesListener;
    },
    set onVoices(listener: ((voices: SatyaSpeechVoice[]) => void) | null) {
      voicesListener = (voices) => {
        cachedVoices = voices;
        listener?.(voices);
      };
    },
  };
  api.onVoices = null;
  return api;
}
