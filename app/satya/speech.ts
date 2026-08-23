/**
 * SatyaPresence speech contract (`window.satyaSpeech`).
 *
 * Native Stratji Mac WKWebView registers `webkit.messageHandlers.satyaSpeech`.
 * Chrome localhost uses Web Speech (`webkitSpeechRecognition` + `speechSynthesis`).
 *
 * Push-to-talk only — no wake word.
 *
 *   satyaSpeech.start()           begin listen
 *   satyaSpeech.stop()            end listen
 *   satyaSpeech.speak(text)       speak assistant text
 *   satyaSpeech.cancel()          stop listen + TTS
 *   satyaSpeech.voices()          cached voice list
 *   satyaSpeech.listVoices()      refresh voices (native AVSpeech / speechSynthesis)
 *   satyaSpeech.setVoice(id)      persist selected voice URI/identifier
 *   satyaSpeech.onPartial(text)   interim transcript
 *   satyaSpeech.onFinal(text)     final transcript
 *   satyaSpeech.onSpeechEnd()     synthesizer finished
 *   satyaSpeech.onVoices(list)    voice catalog ready
 *
 * Native callbacks are `window.satyaSpeech.onPartial|onFinal|onSpeechEnd`.
 * Commands go to `webkit.messageHandlers.satyaSpeech`. A stop/cancel after
 * start makes that start a no-op (generation token) so a late mic grant cannot listen.
 */
import {
  createNativeSatyaSpeech,
  createSatyaListenGate,
  hasNativeSatyaSpeech,
  shouldBeginSatyaRecognition,
} from "./speech-native.ts";

export {
  createSatyaListenGate,
  finishSatyaListenStart,
  shouldBeginSatyaRecognition,
} from "./speech-native.ts";
export type { SatyaListenGate } from "./speech-native.ts";

export type SatyaSpeechVoice = {
  id: string;
  name: string;
  lang: string;
};

export type SatyaSpeechApi = {
  available: boolean;
  native: boolean;
  start(): void;
  stop(): void;
  cancel(): void;
  speak(text: string): void;
  voices(): SatyaSpeechVoice[];
  listVoices(): void;
  setVoice(id: string): void;
  getVoice(): string;
  onPartial: ((text: string) => void) | null;
  onFinal: ((text: string) => void) | null;
  onSpeechEnd: (() => void) | null;
  onVoices: ((voices: SatyaSpeechVoice[]) => void) | null;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const record = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return record.SpeechRecognition ?? record.webkitSpeechRecognition ?? null;
}

function browserVoices(): SatyaSpeechVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().map((voice) => ({
    id: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
  }));
}

function createWebSatyaSpeech(): SatyaSpeechApi {
  const Ctor = speechRecognitionCtor();
  const gate = createSatyaListenGate();
  let recognition: BrowserSpeechRecognition | null = null;
  let selectedVoice = "";
  const api: SatyaSpeechApi = {
    available: Boolean(Ctor) || (typeof window !== "undefined" && "speechSynthesis" in window),
    native: false,
    start() {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      if (!Ctor) return;
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
      const generation = gate.beginStart();
      recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";
      recognition.onresult = (event) => {
        if (!shouldBeginSatyaRecognition(gate, generation)) return;
        let partial = "";
        let finalText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript?.trim() ?? "";
          if (!transcript) continue;
          if (result.isFinal) finalText = `${finalText} ${transcript}`.trim();
          else partial = `${partial} ${transcript}`.trim();
        }
        if (partial) api.onPartial?.(partial);
        if (finalText) api.onFinal?.(finalText);
      };
      recognition.onerror = () => {
        /* keep available; caller can retry start */
      };
      recognition.onend = () => {
        recognition = null;
      };
      if (!shouldBeginSatyaRecognition(gate, generation)) {
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
        recognition = null;
        return;
      }
      recognition.start();
    },
    stop() {
      try {
        recognition?.stop();
      } catch {
        try {
          recognition?.abort();
        } catch {
          /* ignore */
        }
      }
      recognition = null;
      gate.end();
    },
    cancel() {
      api.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      api.onSpeechEnd?.();
    },
    speak(text: string) {
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
      recognition = null;
      gate.end();
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      if (selectedVoice) {
        const match = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === selectedVoice);
        if (match) utterance.voice = match;
      }
      utterance.onend = () => {
        api.onSpeechEnd?.();
      };
      utterance.onerror = () => {
        api.onSpeechEnd?.();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    voices() {
      return browserVoices();
    },
    listVoices() {
      const list = browserVoices();
      if (list.length) api.onVoices?.(list);
    },
    setVoice(id: string) {
      selectedVoice = id.trim();
    },
    getVoice() {
      return selectedVoice;
    },
    onPartial: null,
    onFinal: null,
    onSpeechEnd: null,
    onVoices: null,
  };
  return api;
}

export function createSatyaSpeech(): SatyaSpeechApi {
  if (hasNativeSatyaSpeech()) return createNativeSatyaSpeech();
  return createWebSatyaSpeech();
}

export function installSatyaSpeech(target: Window & { satyaSpeech?: SatyaSpeechApi } = window): SatyaSpeechApi {
  if (target.satyaSpeech) return target.satyaSpeech;
  const api = createSatyaSpeech();
  target.satyaSpeech = api;
  return api;
}

declare global {
  interface Window {
    satyaSpeech?: SatyaSpeechApi;
  }
}
