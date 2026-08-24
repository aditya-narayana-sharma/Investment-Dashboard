"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { SatyaInfinityLoader } from "./SatyaInfinityLoader";
import {
  SATYA_DRAFT_STATUS_INTERVAL_MS,
  clearSatyaDraftStatusMessage,
  getSatyaDraftStatusMessage,
  satyaDraftStatusColorForPhrase,
  satyaDraftStatusPhrase,
  subscribeSatyaDraftStatusMessage,
} from "./satya-draft-status";

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
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  const [sseMessage, setSseMessage] = useState(() => stageMessage ?? getSatyaDraftStatusMessage());

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (stageMessage !== undefined) {
      setSseMessage(stageMessage);
      return undefined;
    }
    const sync = () => setSseMessage(getSatyaDraftStatusMessage());
    sync();
    return subscribeSatyaDraftStatusMessage(sync);
  }, [stageMessage]);

  useEffect(() => {
    if (!active) {
      setTick(0);
      return undefined;
    }
    if (reducedMotion) return undefined;
    const id = window.setInterval(() => {
      setTick((current) => current + 1);
    }, SATYA_DRAFT_STATUS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, reducedMotion]);

  useEffect(() => {
    if (!active) clearSatyaDraftStatusMessage();
  }, [active]);

  if (!active) return null;

  const phrase = satyaDraftStatusPhrase(tick, {
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
