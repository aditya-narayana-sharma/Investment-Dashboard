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
    if not isinstance(symbols, list) or not symbols:
        print(json.dumps({"error": "stdin must include a non-empty symbols array"}), file=sys.stderr)
        return 2

    cleaned = [symbol.strip() for symbol in symbols if isinstance(symbol, str) and symbol.strip()]
    if not cleaned:
        print(json.dumps({"error": "stdin must include a non-empty symbols array"}), file=sys.stderr)
        return 2

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
