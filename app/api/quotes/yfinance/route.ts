import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bundled routes live in dist/server; resolve the repo root from cwd (same as sector-live-server). */
const ROOT = process.cwd();
const PYTHON = join(ROOT, ".venv-flask", "bin", "python");

/**
 * Axis PDF/mail sometimes emits truncated company-name tokens as symbols.
 * Map those to Yahoo NSE tickers for quote fetch; response keys stay on the Axis symbol.
 * Verified NSE identities: RAINBOW = Rainbow Children's Medicare, KSL = Kalyani Steels
 * (both trade as RAINBOW.NS / KSL.NS — no remap). LTIM = LTIMindtree → LTIM.NS.
 */
const YFINANCE_NSE_ALIASES: Record<string, string> = {
  MAXHEALTHCARE: "MAXHEALTH",
  CREDITACCESSGR: "CREDITACC",
  GRASIMINDUSTRI: "GRASIM",
  HINDUSTANAERON: "HAL",
  JKLAKSHMICEMEN: "JKLAKSHMI",
  ONE97COMMUNICA: "PAYTM",
  LTIMINDTREE: "LTIM",
  AVENUESUPERMAR: "DMART",
  RSYSTEMSINTER: "RSYSTEMS",
  RAINBOWCHILDRE: "RAINBOW",
  KALYANISTEELS: "KSL",
  GLOBALHEALTH: "MEDANTA",
  BAJAJAUTO: "BAJAJ-AUTO",
};

/** GET /api/quotes/yfinance?symbols=ETERNAL,ICICIBANK */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
  if (!symbols.length) {
    return NextResponse.json({ status: "error", message: "symbols query required", quotes: {} }, { status: 400 });
  }
  const fetchPairs = symbols.map((symbol) => ({
    symbol,
    yahoo: YFINANCE_NSE_ALIASES[symbol] ?? symbol,
  }));

  const script = `
import json, sys, warnings, logging
warnings.filterwarnings("ignore")
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
import yfinance as yf

pairs = json.loads(sys.argv[1])
out = {}
tickers = [f"{pair['yahoo']}.NS" for pair in pairs]
hist = None
batch_error = None
try:
    # Batch download is far faster than per-symbol Ticker calls for matrix-sized lists.
    hist = yf.download(
        tickers=tickers,
        period="10d",
        interval="1d",
        group_by="ticker",
        auto_adjust=False,
        threads=True,
        progress=False,
    )
except Exception as exc:
    batch_error = str(exc)

def close_from_batch(key):
    try:
        closes = hist[key]["Close"].dropna()
        if len(closes):
            return float(closes.iloc[-1])
    except Exception:
        return None
    return None

def last_price(ticker, yahoo):
    price = None
    if hist is not None and not getattr(hist, "empty", True):
        if len(pairs) == 1:
            try:
                closes = hist["Close"].dropna()
                price = float(closes.iloc[-1]) if len(closes) else None
            except Exception:
                price = None
        else:
            price = close_from_batch(ticker) or close_from_batch(yahoo)
    if price is not None and float(price) > 0:
        return float(price)
    # Prefer history over fast_info: fast_info often raises KeyError('currentTradingPeriod').
    try:
        single = yf.Ticker(ticker).history(period="10d", auto_adjust=False)
        if single is not None and not single.empty:
            closes = single["Close"].dropna()
            if len(closes):
                return float(closes.iloc[-1])
    except Exception:
        pass
    try:
        info = yf.Ticker(ticker).fast_info
        price = getattr(info, "last_price", None) or getattr(info, "lastPrice", None)
        if price is not None and float(price) > 0:
            return float(price)
    except Exception:
        pass
    return None

for pair in pairs:
    symbol = pair["symbol"]
    yahoo = pair["yahoo"]
    ticker = yahoo + ".NS"
    try:
        price = last_price(ticker, yahoo)
        if price is not None and float(price) > 0:
            out[symbol] = {"price": float(price), "source": "yfinance", "ticker": ticker}
        else:
            out[symbol] = {"price": None, "source": "yfinance", "error": batch_error or "no price"}
    except Exception as exc:
        out[symbol] = {"price": None, "source": "yfinance", "error": str(exc)}
print(json.dumps(out), flush=True)
`;

  const result = spawnSync(PYTHON, ["-c", script, JSON.stringify(fetchPairs)], {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim()
      || result.error?.message
      || (result.signal ? `killed by ${result.signal}` : "")
      || "yfinance quote fetch failed";
    return NextResponse.json({
      status: "error",
      message: detail,
      quotes: {},
    }, { status: 502 });
  }
  try {
    const stdout = (result.stdout || "").trim();
    // yfinance may emit warnings on stdout; take the last JSON object line.
    const jsonLine = [...stdout.split(/\r?\n/)].reverse().find((line) => line.trim().startsWith("{")) ?? stdout;
    const quotes = JSON.parse(jsonLine) as Record<string, { price: number | null }>;
    // yfinance NSE last/close is delayed public data — never label as live Kite.
    return NextResponse.json({ status: "public_delayed", quotes, asOf: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "error", message: "invalid yfinance payload", quotes: {} }, { status: 502 });
  }
}
