"use client";

import { useId } from "react";
import type { SatyaPresenceState } from "./satya-client";

export function presenceStateLabel(state: SatyaPresenceState): string {
  switch (state) {
    case "idle":
      return "Idle";
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking";
    case "speaking":
      return "Speaking";
    case "citing":
      return "Citing";
    case "error":
      return "Error";
    case "stale":
      return "Stale";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function SatyaGlyph({ state, reducedMotion }: { state: SatyaPresenceState; reducedMotion: boolean }) {
  const reactId = useId();
  return (
    <svg
      className="satya-glyph satya-character"
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      data-state={state}
      data-reduced={reducedMotion ? "true" : "false"}
    >
      <title>{`Satya ${presenceStateLabel(state)}`}</title>
      <g className="satya-pet">
        <g className="satya-antenna">
          <line x1="32" y1="11" x2="32" y2="17" />
          <circle className="satya-antenna-tip" cx="32" cy="8" r="3">
            {!reducedMotion ? (
              <animate attributeName="cy" values="8;6;8" dur="2.4s" repeatCount="indefinite" />
            ) : null}
          </circle>
        </g>
        <ellipse className="satya-ear satya-ear-left" cx="15" cy="30" rx="4.5" ry="6.5" />
        <ellipse className="satya-ear satya-ear-right" cx="49" cy="30" rx="4.5" ry="6.5" />
        <ellipse className="satya-head" cx="32" cy="36" rx="18" ry="20" />
        <path className="satya-shine" d="M22 22c5-5 15-5 20 0" />
        <g className="satya-glasses">
          <circle cx="24" cy="36" r="7.2" />
          <circle cx="40" cy="36" r="7.2" />
          <line x1="31.2" y1="36" x2="32.8" y2="36" />
        </g>
        <g className="satya-eyes">
          <circle className="satya-eye satya-eye-left" cx="24" cy="36" r="2.1" />
          <circle className="satya-eye satya-eye-right" cx="40" cy="36" r="2.1" />
          <rect className="satya-lid satya-lid-left" x="17.5" y="29.5" width="13" height="0" rx="2">
            {!reducedMotion ? (
              <animate
                attributeName="height"
                values="0;0;13;0"
                keyTimes="0;0.92;0.96;1"
                dur="4.2s"
                repeatCount="indefinite"
              />
            ) : null}
          </rect>
          <rect className="satya-lid satya-lid-right" x="33.5" y="29.5" width="13" height="0" rx="2">
            {!reducedMotion ? (
              <animate
                attributeName="height"
                values="0;0;13;0"
                keyTimes="0;0.92;0.96;1"
                dur="4.2s"
                repeatCount="indefinite"
              />
            ) : null}
          </rect>
        </g>
        <path className="satya-brow satya-brow-left" d="M18 28h12" />
        <path className="satya-brow satya-brow-right" d="M34 28h12" />
        <path className="satya-mouth" d="M26 47q6 5 12 0" data-talking={state === "speaking" ? "true" : "false"} />
      </g>
      <desc id={reactId}>Stylized bald cartoon tech-assistant with glasses. Not a likeness of any person.</desc>
    </svg>
  );
}

/**
 * Full-body Satya.
 *
 * The compact `SatyaGlyph` is a head only, which is right for the companion
 * launcher but reads as a chat bubble rather than a character. This is the same
 * face on a body, for the surfaces with room for one: the M-2 Briefing Room and
 * the draft pop-out.
 *
 * Motion is CSS, driven by `data-state`, and is restricted to `transform` and
 * `opacity` so every state animates on the compositor. `data-reduced` mirrors
 * `prefers-reduced-motion` and the stylesheet halts all of it. Idle breathing,
 * the speaking arm gesture and the listening lean are all applied to named
 * groups below.
 */
export function SatyaFullBody({
  state,
  reducedMotion,
  className = "",
}: {
  state: SatyaPresenceState;
  reducedMotion: boolean;
  className?: string;
}) {
  const describedBy = useId();
  return (
    <svg
      className={["satya-glyph", "satya-character", "satya-fullbody", className].filter(Boolean).join(" ")}
      viewBox="0 0 64 128"
      role="img"
      aria-hidden="true"
      data-state={state}
      data-reduced={reducedMotion ? "true" : "false"}
      aria-describedby={describedBy}
    >
      <title>{`Satya ${presenceStateLabel(state)}`}</title>
      <g className="satya-body-root">
        <g className="satya-legs">
          <path className="satya-leg satya-leg-left" d="M27 96v18" />
          <path className="satya-leg satya-leg-right" d="M37 96v18" />
          <ellipse className="satya-foot satya-foot-left" cx="25.5" cy="116" rx="5" ry="2.6" />
          <ellipse className="satya-foot satya-foot-right" cx="38.5" cy="116" rx="5" ry="2.6" />
        </g>
        <g className="satya-arms">
          <path className="satya-arm satya-arm-left" d="M20 70q-8 8-7 18" />
          <path className="satya-arm satya-arm-right" d="M44 70q8 8 7 18" />
          <circle className="satya-hand satya-hand-left" cx="13" cy="89" r="3.4" />
          <circle className="satya-hand satya-hand-right" cx="51" cy="89" r="3.4" />
        </g>
        <g className="satya-torso-group">
          <path className="satya-neck" d="M28 56h8v6h-8z" />
          <ellipse className="satya-torso" cx="32" cy="79" rx="12.5" ry="18" />
          <path className="satya-collar" d="M25 63q7 6 14 0" />
        </g>
        <g className="satya-head-group">
          <g className="satya-antenna">
            <line x1="32" y1="11" x2="32" y2="17" />
            <circle className="satya-antenna-tip" cx="32" cy="8" r="3" />
          </g>
          <ellipse className="satya-ear satya-ear-left" cx="15" cy="30" rx="4.5" ry="6.5" />
          <ellipse className="satya-ear satya-ear-right" cx="49" cy="30" rx="4.5" ry="6.5" />
          <ellipse className="satya-head" cx="32" cy="36" rx="18" ry="20" />
          <path className="satya-shine" d="M22 22c5-5 15-5 20 0" />
          <g className="satya-glasses">
            <circle cx="24" cy="36" r="7.2" />
            <circle cx="40" cy="36" r="7.2" />
            <line x1="31.2" y1="36" x2="32.8" y2="36" />
          </g>
          <g className="satya-eyes">
            <circle className="satya-eye satya-eye-left" cx="24" cy="36" r="2.1" />
            <circle className="satya-eye satya-eye-right" cx="40" cy="36" r="2.1" />
          </g>
          <path className="satya-brow satya-brow-left" d="M18 28h12" />
          <path className="satya-brow satya-brow-right" d="M34 28h12" />
          <path className="satya-mouth" d="M26 47q6 5 12 0" data-talking={state === "speaking" ? "true" : "false"} />
        </g>
      </g>
      <desc id={describedBy}>
        Stylized full-body bald cartoon tech-assistant with glasses. Not a likeness of any person.
      </desc>
    </svg>
  );
}
