import { createSatyaSpeech, installSatyaSpeech, type SatyaSpeechApi } from "../satya/speech";

/**
 * Speech-controller glue for the Satya companion, extracted from
 * `SatyaPresence.tsx` to hold that file under the 1000-line rule.
 */
export type SpeechController = {
  startListening: (onResult: (text: string) => void, onError?: (error: string) => void) => void;
  stopListening: () => void;
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
};

function bindSatyaSpeech(api: SatyaSpeechApi): SpeechController {
  return {
    startListening(onResult, onError) {
      api.onPartial = onResult;
      api.onFinal = onResult;
      try {
        api.start();
      } catch (cause) {
        onError?.(cause instanceof Error ? cause.message : "Could not start listening.");
      }
    },
    stopListening() {
      api.stop();
    },
    speak(text, onEnd) {
      api.onSpeechEnd = () => onEnd?.();
      api.speak(text);
    },
    cancel() {
      api.cancel();
    },
  };
}

let cachedSpeech: SpeechController | null = null;

export function resolveSpeech(): SpeechController {
  if (cachedSpeech) return cachedSpeech;
  const api = typeof window !== "undefined" ? installSatyaSpeech(window) : createSatyaSpeech();
  cachedSpeech = bindSatyaSpeech(api);
  return cachedSpeech;
}
