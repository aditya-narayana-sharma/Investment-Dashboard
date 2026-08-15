type JsonObject = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function positionKey(position: JsonObject, index: number): string {
  const exchange = text(position.exchange).toUpperCase();
  const symbol = text(position.tradingsymbol).toUpperCase();
  const product = text(position.product).toUpperCase();
  return symbol ? `${exchange}:${symbol}:${product}` : `unknown-position-${index}`;
}

/**
 * Prefer Kite's explicit net book. The current MCP adapter may instead flatten
 * `[...day, ...net]`; keeping the final row per instrument removes the repeated
 * Day copy while retaining the Net position.
 */
export function netPositionsFromKitePayload(payload: unknown): JsonObject[] {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const net = (payload as JsonObject).net;
    return Array.isArray(net)
      ? net.filter((row): row is JsonObject => Boolean(row) && typeof row === "object" && !Array.isArray(row))
      : [];
  }

  if (!Array.isArray(payload)) return [];

  const netByInstrument = new Map<string, JsonObject>();
  payload.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    const position = row as JsonObject;
    netByInstrument.set(positionKey(position, index), position);
  });
  return [...netByInstrument.values()];
}
