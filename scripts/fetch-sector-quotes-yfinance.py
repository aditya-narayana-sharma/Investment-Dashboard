#!/usr/bin/env python3
"""Fetch NSE sector constituent quotes via yfinance for Sectoral Analytics."""

from __future__ import annotations

import json
import sys
import warnings
from typing import Any

import yfinance as yf

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*Timestamp.utcnow.*")


def number_or_null(value: Any) -> float | None:
    try:
        if value is None:
            return None
        parsed = float(value)
        return parsed if parsed == parsed else None  # NaN check
    except (TypeError, ValueError):
        return None


def percent(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return round((current / previous - 1) * 100, 2)


# NSE/Yahoo aliases: reconstruction sleeve names that are not Yahoo tickers.
# GILTBEES is the library name for Nippon India ETF Nifty 8-13 yr G-Sec (LTGILTBEES).
YAHOO_ALIASES = {
    "GILTBEES": "LTGILTBEES",
    "MAXHEALTHCARE": "MAXHEALTH",
    "CREDITACCESSGR": "CREDITACC",
    "GRASIMINDUSTRI": "GRASIM",
    "HINDUSTANAERON": "HAL",
    "JKLAKSHMICEMEN": "JKLAKSHMI",
    "ONE97COMMUNICA": "PAYTM",
    "LTIMINDTREE": "LTIM",
    "AVENUESUPERMAR": "DMART",
    "RSYSTEMSINTER": "RSYSTEMS",
    "RAINBOWCHILDRE": "RAINBOW",
    "KALYANISTEELS": "KSL",
    "GLOBALHEALTH": "MEDANTA",
    "BAJAJAUTO": "BAJAJ-AUTO",
}

YAHOO_SUFFIX_BY_EXCHANGE = {
    "NSE": ".NS",
    "NSI": ".NS",
    "BSE": ".BO",
    "BOM": ".BO",
}


def has_yahoo_suffix(symbol: str) -> bool:
    raw = (symbol or "").strip().upper()
    if "." not in raw:
        return False
    suffix = raw.rsplit(".", 1)[-1]
    return suffix.isalpha() and 1 <= len(suffix) <= 4


def yahoo_symbol(symbol: str, exchange: str = "NSE") -> str:
    raw = (symbol or "").strip().upper()
    if not raw:
        return ""
    if raw.startswith("^") or has_yahoo_suffix(raw):
        return raw
    mapped = YAHOO_ALIASES.get(raw, raw)
    suffix = YAHOO_SUFFIX_BY_EXCHANGE.get((exchange or "NSE").strip().upper(), ".NS")
    return f"{mapped}{suffix}"


def kite_tradingsymbol(yahoo: str) -> str:
    raw = (yahoo or "").strip().upper()
    if raw.endswith(".NS") or raw.endswith(".BO"):
        return raw[:-3]
    return raw


def closes_from_series(series) -> list[float]:
    values: list[float] = []
    for value in series.tolist():
        parsed = number_or_null(value)
        if parsed is not None:
            values.append(parsed)
    return values


def market_from_closes(symbol: str, closes: list[float]) -> dict[str, Any]:
    price = closes[-1] if closes else None
    previous_close = closes[-2] if len(closes) > 1 else None

    def at(sessions: int) -> float | None:
        if not closes:
            return None
        if len(closes) > sessions:
            return closes[-(1 + sessions)]
        return closes[0]

    return {
        "symbol": symbol,
        "price": price,
        "previousClose": previous_close,
        "returns": {
            "day": percent(price, previous_close),
            "week": percent(price, at(5)),
            "month": percent(price, at(21)),
            "quarter": percent(price, at(63)),
        },
    }


def ohlcv_from_frame(frame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if frame is None or getattr(frame, "empty", True):
        return rows
    for index, row in frame.iterrows():
        open_px = number_or_null(row.get("Open"))
        high_px = number_or_null(row.get("High"))
        low_px = number_or_null(row.get("Low"))
        close_px = number_or_null(row.get("Close"))
        volume = number_or_null(row.get("Volume"))
        if None in (open_px, high_px, low_px, close_px):
            continue
        if volume is None:
            volume = 0.0
        date = ""
        try:
            date = index.strftime("%Y-%m-%d")
        except Exception:
            date = str(index)
        rows.append({
            "date": date,
            "open": open_px,
            "high": high_px,
            "low": low_px,
            "close": close_px,
            "volume": volume,
        })
    return rows


def fundamentals_from_ticker(ticker: str) -> dict[str, Any]:
    """Return only keys yfinance actually populated. Never invent fundamentals."""
    info: dict[str, Any] = {}
    try:
        payload = yf.Ticker(ticker).info
        if isinstance(payload, dict):
            info = payload
    except Exception:
        return {}

    pe_ttm = number_or_null(info.get("trailingPE"))
    pb = number_or_null(info.get("priceToBook"))
    fcf = number_or_null(info.get("freeCashflow"))
    market_cap = number_or_null(info.get("marketCap"))
    ebit = number_or_null(info.get("ebit"))
    enterprise_value = number_or_null(info.get("enterpriseValue"))
    earnings_yield = number_or_null(info.get("earningsYield"))
    if earnings_yield is None and pe_ttm not in (None, 0):
        earnings_yield = 1 / pe_ttm
    fcf_yield = None
    if fcf is not None and market_cap not in (None, 0):
        fcf_yield = fcf / market_cap
    price_to_fcf = None
    if fcf not in (None, 0) and market_cap is not None:
        price_to_fcf = market_cap / fcf
    book_yield = None
    if pb not in (None, 0):
        book_yield = 1 / pb
    ev_ebit = number_or_null(info.get("enterpriseToEbit"))
    if ev_ebit is None and ebit not in (None, 0) and enterprise_value is not None:
        ev_ebit = enterprise_value / ebit
    mapped = {
        "revenue": number_or_null(info.get("totalRevenue")),
        "sales": number_or_null(info.get("totalRevenue") if info.get("totalRevenue") is not None else info.get("revenue")),
        "operatingMargin": number_or_null(info.get("operatingMargins")),
        "profitMargin": number_or_null(info.get("profitMargins")),
        "pat": number_or_null(info.get("netIncomeToCommon")),
        "ebitda": number_or_null(info.get("ebitda")),
        "salesGrowthYoy": number_or_null(info.get("revenueGrowth")),
        "peTtm": pe_ttm,
        "peFwd": number_or_null(info.get("forwardPE")),
        "pb": pb,
        "psTtm": number_or_null(info.get("priceToSalesTrailing12Months")),
        "evEbitda": number_or_null(info.get("enterpriseToEbitda")),
        "evSales": number_or_null(info.get("enterpriseToRevenue")),
        "dividendYield": number_or_null(info.get("dividendYield")),
        "earningsYield": earnings_yield,
        "fcfYield": fcf_yield,
        "roe": number_or_null(info.get("returnOnEquity")),
        "roce": number_or_null(info.get("returnOnCapital") if info.get("returnOnCapital") is not None else info.get("returnOnAssets")),
        "peg": number_or_null(info.get("pegRatio")),
        "priceToFcf": price_to_fcf,
        "bookYield": book_yield,
        "evEbit": ev_ebit,
        "freeCashflow": fcf,
        "marketCap": market_cap,
    }
    return {key: value for key, value in mapped.items() if value is not None}


def quote_kpis_from_info(symbol: str, yahoo: str, quote: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return only fields yfinance populated. Never invent a price or PE."""
    info: dict[str, Any] = {}
    try:
        payload = yf.Ticker(yahoo).info
        if isinstance(payload, dict):
            info = payload
    except Exception:
        info = {}

    price = number_or_null(
        info.get("currentPrice")
        if info.get("currentPrice") is not None
        else info.get("regularMarketPrice") if info.get("regularMarketPrice") is not None
        else info.get("previousClose")
    )
    previous_close = number_or_null(
        info.get("regularMarketPreviousClose")
        if info.get("regularMarketPreviousClose") is not None
        else info.get("previousClose")
    )
    change_pct = number_or_null(info.get("regularMarketChangePercent"))
    if change_pct is None:
        change_pct = percent(price, previous_close)

    if price is None:
        try:
            history = yf.Ticker(yahoo).history(period="10d", interval="1d", auto_adjust=False)
            if history is not None and not getattr(history, "empty", True) and "Close" in history.columns:
                closes = closes_from_series(history["Close"].dropna())
                if closes:
                    price = closes[-1]
                    if previous_close is None and len(closes) > 1:
                        previous_close = closes[-2]
                    if change_pct is None:
                        change_pct = percent(price, previous_close)
        except Exception:
            pass

    quote = quote or {}
    name = (
        str(quote.get("longname") or quote.get("shortname") or "").strip()
        or str(info.get("longName") or info.get("shortName") or info.get("displayName") or "").strip()
        or symbol
    )
    exchange = str(
        quote.get("exchDisp")
        or quote.get("exchange")
        or info.get("fullExchangeName")
        or info.get("exchange")
        or ""
    ).strip()
    sector = str(quote.get("sector") or info.get("sector") or info.get("sectorDisp") or "").strip()
    currency = str(info.get("currency") or info.get("financialCurrency") or "").strip().upper()
    pe = number_or_null(info.get("trailingPE") if info.get("trailingPE") is not None else info.get("forwardPE"))
    market_cap = number_or_null(info.get("marketCap"))
    as_of = str(info.get("regularMarketTime") or "").strip() or None

    row: dict[str, Any] = {
        "symbol": symbol,
        "tradingsymbol": symbol,
        "yahooTicker": yahoo,
        "name": name,
        "source": "yfinance",
    }
    if exchange:
        row["exchange"] = exchange
    if sector:
        row["sector"] = sector
    if currency:
        row["currency"] = currency
    if price is not None:
        row["price"] = price
        row["lastPrice"] = price
    if change_pct is not None:
        row["changePct"] = change_pct
    if pe is not None:
        row["pe"] = pe
    if market_cap is not None:
        row["marketCap"] = market_cap
    if as_of:
        row["asOf"] = as_of
    return row


def fetch_quote_kpis(symbols: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in symbols:
        symbol = kite_tradingsymbol(raw)
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        yahoo = yahoo_symbol(raw)
        if not yahoo:
            continue
        rows.append(quote_kpis_from_info(symbol, yahoo))
    return rows


def search_instruments(query: str, limit: int = 8) -> list[dict[str, Any]]:
    needle = (query or "").strip()
    if not needle:
        return []
    search = yf.Search(
        needle,
        max_results=max(1, min(int(limit), 12)),
        news_count=0,
        lists_count=0,
        include_research=False,
        raise_errors=False,
    )
    quotes = search.quotes if isinstance(getattr(search, "quotes", None), list) else []
    ranked: list[tuple[int, dict[str, Any]]] = []
    seen: set[str] = set()
    for quote in quotes:
        if not isinstance(quote, dict):
            continue
        quote_type = str(quote.get("quoteType") or quote.get("typeDisp") or "").strip().upper()
        if quote_type and quote_type not in {"EQUITY", "ETF", "INDEX", "NONE", ""}:
            continue
        yahoo = str(quote.get("symbol") or "").strip().upper()
        if not yahoo:
            continue
        exchange = str(quote.get("exchange") or quote.get("exchDisp") or "").strip().upper()
        symbol = kite_tradingsymbol(yahoo)
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        rank = 0 if exchange in {"NSI", "NSE"} else 1 if exchange in {"BSE", "BOM"} else 2
        ranked.append((rank, quote_kpis_from_info(symbol, yahoo_symbol(yahoo, exchange or "NSE"), quote)))
    ranked.sort(key=lambda item: (item[0], item[1].get("symbol") or ""))
    return [row for _rank, row in ranked[: max(1, min(int(limit), 12))]]


def fetch_strategy_kpis(symbols: list[str], ohlcv_only: bool = False) -> list[dict[str, Any]]:
    companies: list[dict[str, Any]] = []
    for symbol in symbols:
        ticker = yahoo_symbol(symbol)
        ohlcv: list[dict[str, Any]] = []
        as_of = None
        try:
            history = yf.Ticker(ticker).history(period="2y", interval="1d", auto_adjust=False)
            ohlcv = ohlcv_from_frame(history)
            if ohlcv:
                as_of = ohlcv[-1]["date"]
        except Exception:
            ohlcv = []
        companies.append({
            "symbol": symbol,
            "asOf": as_of,
            "ohlcv": ohlcv,
            "fundamentals": {} if ohlcv_only else fundamentals_from_ticker(ticker),
        })
    return companies


def fetch_companies(symbols: list[str]) -> list[dict[str, Any]]:
    tickers = [yahoo_symbol(symbol) for symbol in symbols]
    history = yf.download(
        tickers=tickers,
        period="6mo",
        interval="1d",
        group_by="ticker",
        auto_adjust=False,
        threads=True,
        progress=False,
    )

    companies: list[dict[str, Any]] = []
    for symbol, ticker in zip(symbols, tickers):
        closes: list[float] = []
        try:
            if len(symbols) == 1:
                frame = history
            else:
                frame = history[ticker] if ticker in history.columns.get_level_values(0) else None
            if frame is not None and not getattr(frame, "empty", True) and "Close" in frame.columns:
                closes = closes_from_series(frame["Close"].dropna())
        except Exception:
            closes = []

        if not closes:
            # Per-ticker fallback when batch columns are missing for a symbol.
            try:
                solo = yf.Ticker(ticker).history(period="6mo", interval="1d", auto_adjust=False)
                if not solo.empty and "Close" in solo.columns:
                    closes = closes_from_series(solo["Close"].dropna())
            except Exception:
                closes = []

        companies.append(market_from_closes(symbol, closes))
    return companies


def handle_payload(payload: Any) -> tuple[int, dict[str, Any], bool]:
    """Return (exit_code, body, to_stderr). Empty search queries never call Yahoo."""
    if not isinstance(payload, dict):
        return 2, {"error": "stdin must be a JSON object"}, True

    mode = payload.get("mode") if isinstance(payload.get("mode"), str) else "sector"

    if mode == "search":
        query = payload.get("query") if isinstance(payload.get("query"), str) else ""
        if not query.strip():
            return 0, {"source": "yfinance", "mode": "search", "query": "", "status": "ok", "instruments": []}, False
        try:
            limit = payload.get("limit")
            instruments = search_instruments(query.strip(), int(limit) if isinstance(limit, int) else 8)
        except Exception as exc:
            return 1, {"error": f"yfinance search failed: {exc}", "status": "unavailable", "instruments": []}, True
        return 0, {
            "source": "yfinance",
            "mode": "search",
            "query": query.strip(),
            "status": "ok",
            "instruments": instruments,
        }, False

    symbols = payload.get("symbols")
    if not isinstance(symbols, list) or not symbols:
        return 2, {"error": "stdin must include a non-empty symbols array"}, True
    cleaned = [symbol.strip() for symbol in symbols if isinstance(symbol, str) and symbol.strip()]
    if not cleaned:
        return 2, {"error": "stdin must include a non-empty symbols array"}, True

    if mode == "quote_kpis":
        try:
            instruments = fetch_quote_kpis(cleaned)
        except Exception as exc:
            return 1, {"error": f"yfinance quote KPI fetch failed: {exc}", "status": "unavailable", "instruments": []}, True
        return 0, {"source": "yfinance", "mode": "quote_kpis", "status": "ok", "instruments": instruments}, False

    if mode == "strategy_kpis":
        try:
            ohlcv_only = bool(payload.get("ohlcvOnly"))
            companies = fetch_strategy_kpis(cleaned, ohlcv_only=ohlcv_only)
        except Exception as exc:
            return 1, {"error": f"yfinance strategy KPI download failed: {exc}"}, True
        return 0, {"source": "yfinance", "mode": "strategy_kpis", "companies": companies}, False

    try:
        companies = fetch_companies(cleaned)
    except Exception as exc:
        return 1, {"error": f"yfinance download failed: {exc}"}, True

    priced = sum(1 for company in companies if company.get("price") is not None)
    if priced == 0:
        return 1, {"error": "yfinance returned no sector prices", "companies": companies}, True
    return 0, {"source": "yfinance", "companies": companies}, False


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        print(json.dumps({"error": f"Invalid JSON stdin: {exc}"}), file=sys.stderr)
        return 2

    code, body, to_stderr = handle_payload(payload)
    target = sys.stderr if to_stderr else sys.stdout
    json.dump(body, target)
    target.write("\n")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
