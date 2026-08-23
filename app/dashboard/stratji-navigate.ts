export const STRATJI_NAVIGATE_EVENT = "stratji:navigate";

export function stratjiPushState(url: string | URL, state: object = {}) {
  window.history.pushState(state, "", url);
  window.dispatchEvent(new Event(STRATJI_NAVIGATE_EVENT));
}

export function stratjiReplaceState(url: string | URL, state: object = {}) {
  window.history.replaceState(state, "", url);
  window.dispatchEvent(new Event(STRATJI_NAVIGATE_EVENT));
}

/** Same-document URL changes: browser back/forward plus Stratji push/replace. */
export function listenToStratjiLocation(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(STRATJI_NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(STRATJI_NAVIGATE_EVENT, onChange);
  };
}
