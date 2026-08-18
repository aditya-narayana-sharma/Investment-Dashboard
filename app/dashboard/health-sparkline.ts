/** Calendar-window sparkline geometry for H-3 tiles. Missing days stay gaps — never interpolated. */

export type HealthSparkPoint = {
  date: string;
  value: number;
};

export type SparkFilamentPoint = {
  date: string;
  value: number;
  x: number;
  y: number;
  /** Zero-based index in the calendar window (not the measured-only series). */
  index: number;
};

export const SPARK_WIDTH = 64;
export const SPARK_HEIGHT = 18;
export const SPARK_PAD = 2;

function isoDay(endDate: string, offset: number): string | null {
  const date = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Oldest → newest ISO dates covering `days` ending on `endDate`. */
export function sparkFilamentWindow(endDate: string, days: number): string[] {
  if (!endDate || days < 1) return [];
  const window: string[] = [];
  for (let offset = 1 - days; offset <= 0; offset += 1) {
    const day = isoDay(endDate, offset);
    if (!day) return [];
    window.push(day);
  }
  return window;
}

export function sparkFilamentMissingDates(
  series: HealthSparkPoint[] | undefined,
  endDate: string,
  days: number,
): string[] {
  const present = new Set((series ?? []).map((point) => point.date));
  return sparkFilamentWindow(endDate, days).filter((date) => !present.has(date));
}

export function sparkFilamentPoints(
  series: HealthSparkPoint[] | undefined,
  options: {
    endDate?: string;
    windowDays?: number;
    width?: number;
    height?: number;
    pad?: number;
  } = {},
): SparkFilamentPoint[] | null {
  const width = options.width ?? SPARK_WIDTH;
  const height = options.height ?? SPARK_HEIGHT;
  const pad = options.pad ?? SPARK_PAD;
  const measured = (series ?? []).filter((point) => Number.isFinite(point.value));
  if (!measured.length) return null;

  const lastSeriesDate = measured.reduce((latest, point) => (point.date > latest ? point.date : latest), measured[0]!.date);
  const endDate = options.endDate || lastSeriesDate;
  const windowDays = options.windowDays && options.windowDays > 1 ? options.windowDays : Math.max(measured.length, 2);
  const window = sparkFilamentWindow(endDate, windowDays);
  if (window.length < 2) return null;

  const byDate = new Map(measured.map((point) => [point.date, point.value]));
  const values = window.flatMap((date) => {
    const value = byDate.get(date);
    return value === undefined ? [] : [value];
  });
  if (!values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lastIndex = window.length - 1;

  return window.flatMap((date, index) => {
    const value = byDate.get(date);
    if (value === undefined) return [];
    return [{
      date,
      value,
      index,
      x: pad + (index / lastIndex) * (width - pad * 2),
      y: height - pad - ((value - min) / span) * (height - pad * 2),
    }];
  });
}

/** Polyline with `M` (lift pen) when calendar slots are not adjacent — no interpolated gap fill. */
export function sparkFilamentPathFromPoints(points: SparkFilamentPoint[]): string | null {
  if (!points.length) return null;
  return points.map((point, offset) => {
    const consecutive = offset > 0 && point.index === points[offset - 1]!.index + 1;
    return `${consecutive ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

export function sparkFilamentPath(
  series: HealthSparkPoint[] | undefined,
  options: {
    endDate?: string;
    windowDays?: number;
    width?: number;
    height?: number;
    pad?: number;
  } = {},
): string | null {
  const points = sparkFilamentPoints(series, options);
  return points ? sparkFilamentPathFromPoints(points) : null;
}

export function sparkFilamentGapXs(
  missingDates: string[],
  endDate: string,
  windowDays: number,
  width = SPARK_WIDTH,
  pad = SPARK_PAD,
): number[] {
  const window = sparkFilamentWindow(endDate, windowDays);
  const lastIndex = window.length - 1;
  if (lastIndex <= 0) return [];
  const missing = new Set(missingDates);
  return window.flatMap((date, index) => (
    missing.has(date) ? [pad + (index / lastIndex) * (width - pad * 2)] : []
  ));
}
