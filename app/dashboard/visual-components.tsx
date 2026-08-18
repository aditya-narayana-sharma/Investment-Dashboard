"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SourceFreshness } from "../dashboard-types";
import type { WorkspaceKey } from "./types";
import {
  SPARK_HEIGHT,
  SPARK_WIDTH,
  sparkFilamentGapXs,
  sparkFilamentMissingDates,
  sparkFilamentPathFromPoints,
  sparkFilamentPoints as mapSparkFilamentPoints,
  type SparkFilamentPoint,
} from "./health-sparkline";

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

export type { SparkFilamentPoint };

/** Map measured daily points onto the calendar window. Missing days are skipped, not interpolated. */
export function sparkFilamentPoints(
  series: Array<{ date: string; value: number }>,
  width = SPARK_WIDTH,
  height = SPARK_HEIGHT,
  pad = 2,
  endDate?: string,
  windowDays?: number,
): SparkFilamentPoint[] | null {
  return mapSparkFilamentPoints(series, { width, height, pad, endDate, windowDays });
}

export function sparkFilamentPath(
  series: Array<{ date: string; value: number }>,
  width = SPARK_WIDTH,
  height = SPARK_HEIGHT,
  pad = 2,
  endDate?: string,
  windowDays?: number,
): string | null {
  const points = mapSparkFilamentPoints(series, { width, height, pad, endDate, windowDays });
  return points ? sparkFilamentPathFromPoints(points) : null;
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
  endDate,
  windowDays,
}: {
  tone?: "good" | "bad" | "neutral";
  /** Chronological measured daily points for this metric only. Missing dates are omitted. */
  series?: Array<{ date: string; value: number }>;
  /** Unit suffix from the live metric label (e.g. kcal, min) — never invented. */
  unit?: string;
  /** Health target / completed-through date that ends the 7-day or 30-day window. */
  endDate?: string;
  windowDays?: number;
}) {
  const points = mapSparkFilamentPoints(series, { endDate, windowDays });
  const path = points ? sparkFilamentPathFromPoints(points) : null;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<SparkFilamentPoint | null>(null);
  const [hoverSeries, setHoverSeries] = useState(series);
  if (series !== hoverSeries) {
    setHoverSeries(series);
    setHover(null);
  }

  if (!points?.length) return null;
  const resolvedEnd = endDate || points[points.length - 1]!.date;
  const resolvedDays = windowDays && windowDays > 1 ? windowDays : Math.max(points.length, 2);
  const missingDates = sparkFilamentMissingDates(series, resolvedEnd, resolvedDays);
  const gapXs = sparkFilamentGapXs(missingDates, resolvedEnd, resolvedDays);
  const color = tone === "good" ? "#22c55e" : tone === "bad" ? "#ef4444" : "#93c5fd";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const missingLabel = missingDates.length
    ? ` · missing ${missingDates.map(formatSparkDate).join(", ")}`
    : "";
  const ariaLabel = `History ${formatSparkDate(first.date)} to ${formatSparkDate(last.date)} · ${points.length} measured day${points.length === 1 ? "" : "s"}${missingLabel}`;

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
        {gapXs.map((x) => (
          <line key={`gap-${x}`} className="spark-filament-gap" x1={x} y1={SPARK_HEIGHT - 3.4} x2={x} y2={SPARK_HEIGHT} />
        ))}
        {path ? <path className="spark-filament-trace" d={path} pathLength={1} /> : null}
        {path ? <path className="spark-filament-line" d={path} pathLength={1} /> : null}
        {points.map((point) => (
          <circle
            key={point.date}
            className={`spark-filament-mark${hover?.date === point.date ? " active" : ""}`}
            cx={point.x}
            cy={point.y}
            r={hover?.date === point.date ? 2.1 : 1.15}
          />
        ))}
        {hover ? <line className="spark-filament-guide" x1={hover.x} y1={0} x2={hover.x} y2={SPARK_HEIGHT} /> : null}
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
