"use client";

import { type CSSProperties, useEffect, useState, useSyncExternalStore } from "react";
import { SatyaInfinityLoader } from "./SatyaInfinityLoader";
import {
  SATYA_DRAFT_STATUS_INTERVAL_MS,
  clearSatyaDraftStatusMessage,
  getSatyaDraftStatusMessage,
  satyaDraftStatusColorForPhrase,
  satyaDraftStatusPhrase,
  subscribeSatyaDraftStatusMessage,
} from "./satya-draft-status";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * External-store adapters. These used to be `useState` seeded from an effect
 * that called `setState` synchronously, which React flags as a cascading render
 * (`react-hooks/set-state-in-effect`) — the store is the source of truth, so
 * subscribing to it directly is both correct and cheaper.
 */
function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedMotionSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function reducedMotionServerSnapshot(): boolean {
  return false;
}

export function SatyaDraftStatusLine({
  active,
  as = "p",
  className = "satya-transcript-empty",
  live = true,
  stageMessage,
}: {
  active: boolean;
  as?: "p" | "span";
  className?: string;
  live?: boolean;
  stageMessage?: string;
}) {
  const [tick, setTick] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    reducedMotionServerSnapshot,
  );
  const streamedMessage = useSyncExternalStore(
    subscribeSatyaDraftStatusMessage,
    getSatyaDraftStatusMessage,
    getSatyaDraftStatusMessage,
  );
  // An explicit `stageMessage` prop wins over the stream; derive it rather than
  // mirroring the prop into state.
  const sseMessage = stageMessage ?? streamedMessage;
  // The phrase restarts whenever the line goes inactive, so an inactive tick is
  // derived rather than reset through an effect.
  const effectiveTick = active ? tick : 0;

  useEffect(() => {
    if (!active || reducedMotion) return undefined;
    const id = window.setInterval(() => {
      setTick((current) => current + 1);
    }, SATYA_DRAFT_STATUS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, reducedMotion]);

  useEffect(() => {
    if (!active) clearSatyaDraftStatusMessage();
  }, [active]);

  if (!active) return null;

  const phrase = satyaDraftStatusPhrase(effectiveTick, {
    reducedMotion,
    stageMessage: sseMessage,
  });
  const accent = satyaDraftStatusColorForPhrase(phrase);
  const Tag = as;

  return (
    <Tag
      className={["satya-draft-status", className].filter(Boolean).join(" ")}
      style={{ "--satya-loader-accent": accent, "--satya-accent": accent } as CSSProperties}
      aria-live={live ? "polite" : undefined}
      aria-atomic={live ? "true" : undefined}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <SatyaInfinityLoader className="satya-draft-status-loader" reducedMotion={reducedMotion} />
      <span key={phrase} className="satya-draft-status-phrase">
        {phrase}
      </span>
    </Tag>
  );
}
