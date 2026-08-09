#!/usr/bin/env python3
"""Fetch exact NSE index histories, with exact-index Yahoo fallbacks only."""

from __future__ import annotations

import json
import math
import statistics
import sys
from datetime import date, datetime, timedelta
from typing import Any

import requests
import yfinance as yf

NSE_HOME_URL = "https://www.nseindia.com/"
NSE_REPORT_URL = "https://www.nseindia.com/reports-indices-historical-index-data"
NSE_HISTORY_URL = "https://www.nseindia.com/api/historical/indicesHistory"
NSE_SOURCE_URL = NSE_REPORT_URL
YAHOO_SOURCE_URL = "https://finance.yahoo.com/markets/world-indices/"
REQUEST_HEADERS = {
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": NSE_REPORT_URL,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
}


def number(value: Any) -> float | None:
    try:
        parsed = float(value.replace(",", "") if isinstance(value, str) else value)
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def pct(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return round((current / previous - 1) * 100, 2)


def normalized_closes(rows: list[tuple[str, float]]) -> list[tuple[str, float]]:
    return sorted({stamp: value for stamp, value in rows if value > 0}.items())


def nse_history(item: dict[str, Any], session: requests.Session) -> list[tuple[str, float]]:
    index_name = str(item.get("nseIndexName") or item.get("officialName") or "").strip()
    if not index_name:
        raise ValueError("No canonical NSE index name configured")
    today = date.today()
    params = {
        "indexType": index_name,
        "from": (today - timedelta(days=370)).strftime("%d-%m-%Y"),
        "to": today.strftime("%d-%m-%Y"),
    }
    response = session.get(NSE_HISTORY_URL, params=params, headers=REQUEST_HEADERS, timeout=20)
    if response.status_code in (401, 403):
        session.get(NSE_HOME_URL, headers=REQUEST_HEADERS, timeout=15)
        response = session.get(NSE_HISTORY_URL, params=params, headers=REQUEST_HEADERS, timeout=20)
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", []) if isinstance(payload, dict) else []
    rows = data.get("indexCloseOnlineRecords", []) if isinstance(data, dict) else data
    closes: list[tuple[str, float]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        raw_date = row.get("EOD_TIMESTAMP") or row.get("TIMESTAMP") or row.get("HistoricalDate") or row.get("Date")
        raw_close = row.get("EOD_CLOSE_INDEX_VAL") or row.get("CLOSE_INDEX_VAL") or row.get("CLOSE") or row.get("Close")
        parsed = number(raw_close)
        if raw_date is None or parsed is None:
            continue
        stamp = str(raw_date).strip()
        for fmt in ("%d-%b-%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y"):
            try:
                stamp = datetime.strptime(stamp, fmt).strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
        if len(stamp) == 10 and stamp[4] == "-" and stamp[7] == "-":
            closes.append((stamp, parsed))
    return normalized_closes(closes)


def yahoo_history(item: dict[str, Any]) -> list[tuple[str, float]]:
    ticker = str(item.get("ticker") or "")
    if not ticker:
        raise ValueError("No exact Yahoo index ticker configured")
    try:
        frame = yf.Ticker(ticker).history(period="1y", interval="1d", auto_adjust=False)
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc
    if frame.empty or "Close" not in frame.columns:
        raise ValueError("No history returned")

    closes: list[tuple[str, float]] = []
    for stamp, value in frame["Close"].dropna().items():
        parsed = number(value)
        if parsed is not None:
            closes.append((stamp.strftime("%Y-%m-%d"), parsed))
    return normalized_closes(closes)


def build_record(
    item: dict[str, Any],
    closes: list[tuple[str, float]],
    source: str,
    source_url: str,
) -> dict[str, Any]:
    ticker = str(item.get("ticker") or "")
    if len(closes) < 2:
        return {
            "id": item["id"],
            "ticker": ticker,
            "error": f"Insufficient chart history: {len(closes)} closing observation(s)",
        }

    values = [value for _, value in closes]
    latest = values[-1]
    def prior(sessions: int) -> float | None:
        return values[-1 - sessions] if len(values) > sessions else values[0]

    daily = [values[index] / values[index - 1] - 1 for index in range(1, len(values))]
    volatility = statistics.pstdev(daily[-63:]) * math.sqrt(252) * 100 if len(daily) >= 2 else None
    peak = values[0]
    max_drawdown = 0.0
    for value in values:
        peak = max(peak, value)
        max_drawdown = min(max_drawdown, value / peak - 1)
    recent = values[-20:]
    squeeze = ((max(recent) - min(recent)) / latest * 100) if recent and latest else None
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
            "year": pct(latest, values[0]),
        },
        "indexedHistory": history,
        "volatility": round(volatility, 2) if volatility is not None else None,
        "maxDrawdown": round(max_drawdown * 100, 2),
        "squeezeWidth": round(squeeze, 2) if squeeze is not None else None,
        "observedAt": closes[-1][0],
        "source": source,
        "sourceUrl": source_url,
        "period": f"{len(closes)} daily closes · up to one year",
    }


def index_record(item: dict[str, Any], session: requests.Session) -> dict[str, Any]:
    errors: list[str] = []
    try:
        closes = nse_history(item, session)
        if len(closes) >= 2:
            return build_record(item, closes, "NSE official EOD index history", NSE_SOURCE_URL)
        errors.append(f"NSE returned {len(closes)} closing observation(s)")
    except Exception as exc:
        errors.append(f"NSE: {exc}")

    try:
        closes = yahoo_history(item)
        if len(closes) >= 2:
            return build_record(item, closes, "Yahoo Finance delayed exact-index history", YAHOO_SOURCE_URL)
        errors.append(f"Yahoo returned {len(closes)} closing observation(s)")
    except Exception as exc:
        errors.append(f"Yahoo: {exc}")
    return {"id": item["id"], "ticker": str(item.get("ticker") or ""), "error": "; ".join(errors)}


def main() -> int:
    payload = json.load(sys.stdin)
    registry = payload.get("registry", [])
    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)
    try:
        session.get(NSE_HOME_URL, headers=REQUEST_HEADERS, timeout=15)
    except requests.RequestException:
        pass
    json.dump({"indices": [index_record(item, session) for item in registry]}, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
