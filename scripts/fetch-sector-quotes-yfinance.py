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


def yahoo_symbol(symbol: str) -> str:
    return f"{symbol}.NS"


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
        if None in (open_px, high_px, low_px, close_px, volume):
            continue
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

    mapped = {
        "revenue": number_or_null(info.get("totalRevenue")),
        "sales": number_or_null(info.get("totalRevenue") if info.get("totalRevenue") is not None else info.get("revenue")),
        "operatingMargin": number_or_null(info.get("operatingMargins")),
        "profitMargin": number_or_null(info.get("profitMargins")),
        "pat": number_or_null(info.get("netIncomeToCommon")),
        "ebitda": number_or_null(info.get("ebitda")),
        "salesGrowthYoy": number_or_null(info.get("revenueGrowth")),
        "peTtm": number_or_null(info.get("trailingPE")),
        "evEbitda": number_or_null(info.get("enterpriseToEbitda")),
    }
    return {key: value for key, value in mapped.items() if value is not None}


def fetch_strategy_kpis(symbols: list[str]) -> list[dict[str, Any]]:
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
            "fundamentals": fundamentals_from_ticker(ticker),
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


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        print(json.dumps({"error": f"Invalid JSON stdin: {exc}"}), file=sys.stderr)
        return 2

    symbols = payload.get("symbols") if isinstance(payload, dict) else None
    mode = payload.get("mode") if isinstance(payload, dict) else "sector"
    if not isinstance(symbols, list) or not symbols:
        print(json.dumps({"error": "stdin must include a non-empty symbols array"}), file=sys.stderr)
        return 2

    cleaned = [symbol.strip() for symbol in symbols if isinstance(symbol, str) and symbol.strip()]
    if not cleaned:
        print(json.dumps({"error": "stdin must include a non-empty symbols array"}), file=sys.stderr)
        return 2

    if mode == "strategy_kpis":
        try:
            companies = fetch_strategy_kpis(cleaned)
        except Exception as exc:
            print(json.dumps({"error": f"yfinance strategy KPI download failed: {exc}"}), file=sys.stderr)
            return 1
        json.dump({"source": "yfinance", "mode": "strategy_kpis", "companies": companies}, sys.stdout)
        sys.stdout.write("\n")
        return 0

    try:
        companies = fetch_companies(cleaned)
    except Exception as exc:
        print(json.dumps({"error": f"yfinance download failed: {exc}"}), file=sys.stderr)
        return 1

    priced = sum(1 for company in companies if company.get("price") is not None)
    if priced == 0:
        print(json.dumps({"error": "yfinance returned no sector prices", "companies": companies}), file=sys.stderr)
        return 1

    json.dump({"source": "yfinance", "companies": companies}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
