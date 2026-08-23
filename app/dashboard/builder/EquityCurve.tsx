"use client";

export type EquityCurvePoint = {
  date: string;
  equity: number;
  benchmark?: number;
};

export function EquityCurve({
  curve,
  className = "symphony-curve",
  label = "Backtest equity curve",
}: {
  curve: readonly EquityCurvePoint[];
  className?: string;
  label?: string;
}) {
  if (curve.length < 2) return null;
  const width = 240;
  const height = 120;
  const min = Math.min(...curve.map((point) => Math.min(point.equity, point.benchmark ?? point.equity)));
  const max = Math.max(...curve.map((point) => Math.max(point.equity, point.benchmark ?? point.equity)));
  const span = max - min || 1;
  const path = (key: "equity" | "benchmark") => curve
    .map((point, index) => {
      const value = key === "equity" ? point.equity : point.benchmark;
      if (value === undefined) return "";
      const x = (index / (curve.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path("benchmark")} fill="none" stroke="#64748b" strokeWidth="1.5" />
      <path d={path("equity")} fill="none" stroke="#86efac" strokeWidth="2" />
    </svg>
  );
}
