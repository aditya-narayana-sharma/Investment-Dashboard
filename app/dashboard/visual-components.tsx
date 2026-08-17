"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SourceFreshness } from "../dashboard-types";
import type { WorkspaceKey } from "./types";

const SOURCE_WORKSPACE: Record<string, WorkspaceKey> = {
  kite: "investment",
  holdings: "investment",
  positions: "investment",
  orders: "investment",
  margins: "investment",
  mail: "intelligence",
  newsletters: "intelligence",
  "axis research": "intelligence",
  podcasts: "intelligence",
  earnings: "intelligence",
  calendar: "intelligence",
  reminders: "intelligence",
  sectors: "sectors",
  benchmarks: "sectors",
  health: "health",
  healthkit: "health",
};

export function resolveSourceWorkspace(source: string): WorkspaceKey | null {
  const key = source.trim().toLowerCase();
  if (SOURCE_WORKSPACE[key]) return SOURCE_WORKSPACE[key];
  for (const [needle, workspace] of Object.entries(SOURCE_WORKSPACE)) {
    if (key.includes(needle)) return workspace;
  }
  return null;
}

export function PulseConstellation({
  sources,
  onNavigate,
}: {
  sources: SourceFreshness[];
  onNavigate?: (workspace: WorkspaceKey, source: SourceFreshness) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (!sources.length) return null;

  const activeSource = hovered ? sources.find((source) => source.source === hovered) : undefined;
  const activeWorkspace = activeSource ? resolveSourceWorkspace(activeSource.source) : null;

  return (
    <section className="source-freshness-region" aria-label="Complete dashboard source freshness">
      <div className="source-freshness-strip pulse-constellation">
        {sources.map((source) => {
          const failed = source.state === "unavailable" || source.state === "stale" || source.state === "permission_required";
          const workspace = resolveSourceWorkspace(source.source);
          return (
            <button
              key={source.source}
              type="button"
              className={`pulse-node${failed ? " failed" : ""}`}
              title={source.message}
              aria-describedby={hovered === source.source ? "source-freshness-detail" : undefined}
              onMouseEnter={() => setHovered(source.source)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(source.source)}
              onBlur={() => setHovered(null)}
              onClick={() => {
                if (workspace && onNavigate) onNavigate(workspace, source);
              }}
            >
              <i className={`pulse-core ${source.state}`} aria-hidden="true" />
              <span>
                <b>{source.source}</b>
                <small>{source.state.replaceAll("_", " ")} · {source.period}</small>
              </span>
            </button>
          );
        })}
      </div>
      {activeSource && (
        <aside id="source-freshness-detail" className="pulse-detail-lane" role="status" aria-live="polite">
          {activeSource.message}
          {activeWorkspace ? ` · Open ${activeWorkspace}` : ""}
        </aside>
      )}
    </section>
  );
}

export function InstrumentGauge({
  label,
  value,
  detail,
  ratio,
  tone = "neutral",
  redline,
  sensitive = false,
}: {
  label: string;
  value: string;
  detail: string;
  /** 0–1 fill amount for the ring */
  ratio: number;
  tone?: "neutral" | "positive" | "warning" | "danger";
  redline?: string;
  sensitive?: boolean;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const circumference = 2 * Math.PI * 36;
  const offset = circumference * (1 - clamped);

  return (
    <article className={`instrument-gauge ${tone === "neutral" ? "" : tone}`.trim()}>
      {redline && <span className="redline">{redline}</span>}
      <div className="gauge-ring" aria-hidden="true">
        <svg viewBox="0 0 88 88">
          <circle className="track" cx="44" cy="44" r="36" />
          <circle
            className="value"
            cx="44"
            cy="44"
            r="36"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="gauge-center"><b {...(sensitive ? { "data-demo-sensitive": "" } : {})}>{value}</b></div>
      </div>
      <span>{label}</span>
      <small>{detail}</small>
    </article>
  );
}

export function ExplainDwell({
  children,
  explanation,
}: {
  children: ReactNode;
  explanation: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  const start = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 400);
  };
  const stop = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <div className="explain-dwell" onMouseEnter={start} onMouseLeave={stop} onFocus={start} onBlur={stop}>
      {children}
      {open && <aside className="explain-pop" role="status">{explanation}</aside>}
    </div>
  );
}

export function TriggerDial({
  label,
  valueLabel,
  distance,
  triggerAt = 80,
}: {
  label: string;
  valueLabel: string;
  /** 0–100 distance-to-trigger style score */
  distance: number;
  triggerAt?: number;
}) {
  const clamped = Math.max(0, Math.min(100, distance));
  const circumference = 2 * Math.PI * 34;
  const offset = circumference * (1 - clamped / 100);
  const tickAngle = (triggerAt / 100) * 360;

  return (
    <article className="trigger-dial">
      <div className="dial-face" aria-hidden="true">
        <svg viewBox="0 0 84 84">
          <circle className="track" cx="42" cy="42" r="34" />
          <circle
            className="value"
            cx="42"
            cy="42"
            r="34"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <i className="trigger-tick" style={{ transform: `rotate(${tickAngle}deg)` }} />
      </div>
      <b>{label}</b>
      <small>{valueLabel} · {clamped.toFixed(0)}/100</small>
    </article>
  );
}

const SPARK_WIDTH = 64;
const SPARK_HEIGHT = 18;
const SPARK_PAD = 2;

export type SparkFilamentPoint = {
  date: string;
  value: number;
  x: number;
  y: number;
};

/** Map measured daily points into SVG coordinates. Gaps stay omitted — never invent days. */
export function sparkFilamentPoints(
  series: Array<{ date: string; value: number }>,
  width = SPARK_WIDTH,
  height = SPARK_HEIGHT,
  pad = SPARK_PAD,
): SparkFilamentPoint[] | null {
  if (series.length < 2) return null;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const times = series.map((point) => Date.parse(point.date));
  const start = times[0]!;
  const end = times[times.length - 1]!;
  const timeSpan = end - start || 1;
  return series.map((point, index) => ({
    date: point.date,
    value: point.value,
    x: pad + ((times[index]! - start) / timeSpan) * (width - pad * 2),
    y: height - pad - ((point.value - min) / span) * (height - pad * 2),
  }));
}

export function sparkFilamentPath(
  series: Array<{ date: string; value: number }>,
  width = SPARK_WIDTH,
  height = SPARK_HEIGHT,
  pad = SPARK_PAD,
): string | null {
  const points = sparkFilamentPoints(series, width, height, pad);
  if (!points) return null;
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function formatSparkDate(dateKey: string): string {
  const parsed = Date.parse(`${dateKey}T12:00:00`);
  if (!Number.isFinite(parsed)) return dateKey;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(parsed));
}

function formatSparkValue(value: number, unit?: string): string {
  const absolute = Math.abs(value);
  const digits = absolute >= 100 || Number.isInteger(value) ? 0 : absolute >= 10 ? 1 : 2;
  const formatted = value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function SparkFilament({
  tone = "neutral",
  series,
  unit,
}: {
  tone?: "good" | "bad" | "neutral";
  /** Chronological measured daily points for this metric only. */
  series?: Array<{ date: string; value: number }>;
  /** Unit suffix from the live metric label (e.g. kcal, min) — never invented. */
  unit?: string;
}) {
  const points = series ? sparkFilamentPoints(series) : null;
  const path = points
    ? points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")
    : null;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<SparkFilamentPoint | null>(null);
  const [hoverSeries, setHoverSeries] = useState(series);
  if (series !== hoverSeries) {
    setHoverSeries(series);
    setHover(null);
  }

  if (!path || !points) return null;
  const color = tone === "good" ? "#22c55e" : tone === "bad" ? "#ef4444" : "#93c5fd";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const ariaLabel = `History ${formatSparkDate(first.date)} to ${formatSparkDate(last.date)} · ${points.length} measured days`;

  const nearestPoint = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * SPARK_WIDTH;
    let best = points[0]!;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const distance = Math.abs(point.x - x);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best;
  };

  return (
    <span
      className={`spark-filament interactive${hover ? " hovering" : ""}`}
      style={{ color }}
      role="img"
      aria-label={ariaLabel}
      onPointerEnter={(event) => setHover(nearestPoint(event.clientX))}
      onPointerMove={(event) => setHover(nearestPoint(event.clientX))}
      onPointerLeave={() => setHover(null)}
    >
      <svg ref={svgRef} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="none">
        <path className="spark-filament-trace" d={path} pathLength={1} />
        <path className="spark-filament-line" d={path} pathLength={1} />
        {hover ? (
          <>
            <line className="spark-filament-guide" x1={hover.x} y1={0} x2={hover.x} y2={SPARK_HEIGHT} />
            <circle className="spark-filament-dot" cx={hover.x} cy={hover.y} r={2.1} />
          </>
        ) : null}
      </svg>
      {hover ? (
        <em
          className="spark-filament-label"
          style={{ left: `${Math.min(86, Math.max(14, (hover.x / SPARK_WIDTH) * 100))}%` }}
        >
          <b>{formatSparkValue(hover.value, unit)}</b>
          <span>{formatSparkDate(hover.date)}</span>
        </em>
      ) : null}
    </span>
  );
}

export function WaveformStrip({ bars = 18, seed = 1 }: { bars?: number; seed?: number }) {
  const heights = Array.from({ length: bars }, (_, index) => {
    const n = Math.abs(Math.sin((index + 1) * (seed + 1.7))) * 100;
    return 30 + (n % 70);
  });
  return (
    <span className="waveform-strip" aria-hidden="true">
      {heights.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
    </span>
  );
}
