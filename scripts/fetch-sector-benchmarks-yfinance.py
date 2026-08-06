#!/usr/bin/env python3
"""Fetch delayed NSE index histories without substituting ETF proxies."""

from __future__ import annotations

import json
import math
import statistics
import sys
from typing import Any

import yfinance as yf


def number(value: Any) -> float | None:
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def pct(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return round((current / previous - 1) * 100, 2)


def index_record(item: dict[str, Any]) -> dict[str, Any]:
    ticker = str(item.get("ticker") or "")
    if not ticker:
        return {"id": item["id"], "ticker": "", "error": "No exact public ticker configured"}
    try:
        frame = yf.Ticker(ticker).history(period="1y", interval="1d", auto_adjust=False)
    except Exception as exc:
        return {"id": item["id"], "ticker": ticker, "error": str(exc)}
    if frame.empty or "Close" not in frame.columns:
        return {"id": item["id"], "ticker": ticker, "error": "No history returned"}

    closes: list[tuple[str, float]] = []
    for stamp, value in frame["Close"].dropna().items():
        parsed = number(value)
        if parsed is not None:
            closes.append((stamp.strftime("%Y-%m-%d"), parsed))
    if len(closes) < 1:
        return {"id": item["id"], "ticker": ticker, "error": "Insufficient history"}

    values = [value for _, value in closes]
    latest = values[-1]
    multi = len(closes) >= 2

    def prior(sessions: int) -> float | None:
        if not multi:
            return None
        return values[-1 - sessions] if len(values) > sessions else values[0]

    daily = [values[index] / values[index - 1] - 1 for index in range(1, len(values))] if multi else []
    volatility = statistics.pstdev(daily[-63:]) * math.sqrt(252) * 100 if len(daily) >= 2 else None
    peak = values[0]
    max_drawdown = 0.0
    for value in values:
        peak = max(peak, value)
        max_drawdown = min(max_drawdown, value / peak - 1)
    recent = values[-20:]
    squeeze = ((max(recent) - min(recent)) / latest * 100) if multi and recent and latest else None
    base = values[0]
    history = [{"date": date, "value": round(value / base * 100, 2)} for date, value in closes]
    return {
        "id": item["id"],
        "ticker": ticker,
        "level": round(latest, 2),
        "returns": {
            "day": pct(latest, prior(1)),
            "week": pct(latest, prior(5)),
            "month": pct(latest, prior(21)),
            "quarter": pct(latest, prior(63)),
            "halfYear": pct(latest, prior(126)),
            "year": pct(latest, values[0]) if multi else None,
        },
        "indexedHistory": history,
        "volatility": round(volatility, 2) if volatility is not None else None,
        "maxDrawdown": round(max_drawdown * 100, 2) if multi else None,
        "squeezeWidth": round(squeeze, 2) if squeeze is not None else None,
        "observedAt": closes[-1][0],
    }


def main() -> int:
    payload = json.load(sys.stdin)
    registry = payload.get("registry", [])
    json.dump({"indices": [index_record(item) for item in registry]}, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
