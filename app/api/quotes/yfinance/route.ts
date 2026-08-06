import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const PYTHON = join(ROOT, ".venv-flask", "bin", "python");

/** GET /api/quotes/yfinance?symbols=ETERNAL,ICICIBANK */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))].slice(0, 20);
  if (!symbols.length) {
    return NextResponse.json({ status: "error", message: "symbols query required", quotes: {} }, { status: 400 });
  }

  const script = `
import json, sys
import yfinance as yf
symbols = json.loads(sys.argv[1])
out = {}
for symbol in symbols:
    ticker = symbol + ".NS"
    try:
        info = yf.Ticker(ticker).fast_info
        price = getattr(info, "last_price", None) or getattr(info, "lastPrice", None)
        if price is None:
            hist = yf.Ticker(ticker).history(period="5d")
            price = float(hist["Close"].iloc[-1]) if not hist.empty else None
        if price is not None and float(price) > 0:
            out[symbol] = {"price": float(price), "source": "yfinance", "ticker": ticker}
    except Exception as exc:
        out[symbol] = {"price": None, "source": "yfinance", "error": str(exc)}
print(json.dumps(out))
`;

  const result = spawnSync(PYTHON, ["-c", script, JSON.stringify(symbols)], {
    encoding: "utf8",
    timeout: 45_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return NextResponse.json({
      status: "error",
      message: result.stderr?.trim() || "yfinance quote fetch failed",
      quotes: {},
    }, { status: 502 });
  }
  try {
    const quotes = JSON.parse(result.stdout || "{}") as Record<string, { price: number | null }>;
    return NextResponse.json({ status: "live", quotes, asOf: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "error", message: "invalid yfinance payload", quotes: {} }, { status: 502 });
  }
}
