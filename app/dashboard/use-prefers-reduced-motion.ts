"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

function serverSnapshot(): boolean {
  return false;
}

/**
 * Shared `prefers-reduced-motion` reader.
 *
 * Uses `useSyncExternalStore` rather than `useState` + an effect, so no
 * component calls `setState` synchronously during mount to learn the value.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
