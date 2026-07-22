export type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  private readonly minLevel: number;

  constructor(level: string | undefined) {
    this.minLevel = levels[(level as LogLevel) || "info"] ?? levels.info;
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
    if (levels[level] < this.minLevel) return;
    const record = {
      ts: new Date().toISOString(),
      level,
      message,
      ...meta
    };
    process.stderr.write(`${JSON.stringify(redact(record))}\n`);
  }
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (/token|secret|authorization|checksum/i.test(key)) return [key, "[REDACTED]"];
      return [key, redact(nested)];
    })
  );
}

export function maskSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
