import { buildStrategySignals } from "../../../strategy/builtin-signals";
import { loadYfinanceStrategyKpis } from "../../../strategy/yfinance-kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SYMBOLS = 25;

/**
 * Built-in strategy signals for the Y-3 Signals board.
 *
 * Bars come from the existing `loadYfinanceStrategyKpis` loader, which requests
 * `period="2y"` (~500 daily sessions) — above the 220 sessions SMA-220 needs
 * plus a 3-month Bollinger lookback. A symbol with less history returns an
 * ineligible signal carrying its reason; nothing is ever inferred.
 *
 * This route computes signals only. It cannot place, stage or modify an order.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const symbols = [...new Set(requested)].slice(0, MAX_SYMBOLS);

  const headers = { "Cache-Control": "no-store, max-age=0" };
  if (!symbols.length) {
    return Response.json(
      { status: "empty", asOf: new Date().toISOString(), signals: [], message: "No symbols requested." },
      { headers },
    );
  }

  try {
    const loaded = await loadYfinanceStrategyKpis(symbols, { ohlcvOnly: true });
    const bySymbol = new Map(loaded.map((row) => [row.symbol, row]));
    const signals = symbols.flatMap((symbol) => {
      const row = bySymbol.get(symbol);
      return buildStrategySignals(symbol, row?.ohlcv ?? [], "yfinance");
    });
    const eligible = signals.filter((signal) => signal.eligible).length;
    return Response.json({
      status: eligible === signals.length ? "live" : eligible > 0 ? "partial" : "unavailable",
      asOf: new Date().toISOString(),
      signals,
      message: `${eligible}/${signals.length} signals computed from yfinance daily history.`,
    }, { headers });
  } catch (error) {
    // Never substitute a fabricated signal for a failed fetch.
    return Response.json({
      status: "unavailable",
      asOf: new Date().toISOString(),
      signals: [],
      message: error instanceof Error ? error.message : "Strategy signal computation failed.",
    }, { status: 503, headers });
  }
}
