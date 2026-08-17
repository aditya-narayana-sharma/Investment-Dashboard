#!/usr/bin/env python3
"""Fetch exact NSE index histories, with official archive then exact-index Yahoo fallbacks."""

from __future__ import annotations

import csv
import json
import math
import os
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from io import StringIO
from pathlib import Path
from threading import Lock
from typing import Any

import requests
import yfinance as yf

NSE_HOME_URL = "https://www.nseindia.com/"
NSE_REPORT_URL = "https://www.nseindia.com/reports-indices-historical-index-data"
NSE_HISTORY_URL = "https://www.nseindia.com/api/historical/indicesHistory"
NSE_SOURCE_URL = NSE_REPORT_URL
NSE_ARCHIVE_URL = "https://nsearchives.nseindia.com/content/indices/ind_close_all_{stamp}.csv"
NSE_ARCHIVE_SOURCE_URL = "https://nsearchives.nseindia.com/content/indices/"
YAHOO_SOURCE_URL = "https://finance.yahoo.com/markets/world-indices/"
REQUEST_HEADERS = {
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": NSE_REPORT_URL,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
}
ARCHIVE_LOOKBACK_DAYS = 370
ARCHIVE_WORKERS = 8


def cache_path() -> Path:
    configured = os.environ.get("PORTFOLIO_BENCHMARK_CACHE")
    if configured:
        return Path(configured)
    return Path("artifacts/private/nse-index-close-cache.json")


def normalize_index_name(name: str) -> str:
    return " ".join(str(name).upper().split())


def compact_index_name(name: str) -> str:
    return "".join(ch for ch in normalize_index_name(name) if ch.isalnum())


def index_name_keys(name: str) -> list[str]:
    normalized = normalize_index_name(name)
    compact = compact_index_name(name)
    keys = [normalized]
    if compact and compact not in keys:
        keys.append(compact)
    return [key for key in keys if key]


def resolve_index_id(name: str, name_to_id: dict[str, str]) -> str | None:
    for key in index_name_keys(name):
        found = name_to_id.get(key)
        if found:
            return found
    return None


def weekday_range(start: date, end: date) -> list[date]:
    days: list[date] = []
    cursor = start
    while cursor <= end:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days


def parse_close_all_csv(text: str) -> list[tuple[str, str, float]]:
    rows: list[tuple[str, str, float]] = []
    reader = csv.DictReader(StringIO(text.lstrip("\ufeff")))
    if reader.fieldnames:
        reader.fieldnames = [(name or "").strip() for name in reader.fieldnames]
    for row in reader:
        name = normalize_index_name(row.get("Index Name") or "")
        raw_date = str(row.get("Index Date") or "").strip()
        parsed_close = number(row.get("Closing Index Value") or row.get("Close"))
        if not name or parsed_close is None:
            continue
        stamp = raw_date
        for fmt in ("%d-%m-%Y", "%d-%b-%Y", "%Y-%m-%d"):
            try:
                stamp = datetime.strptime(raw_date, fmt).strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
        if len(stamp) == 10 and stamp[4] == "-" and stamp[7] == "-":
            rows.append((name, stamp, parsed_close))
    return rows


def load_archive_cache() -> dict[str, list[tuple[str, float]]]:
    path = cache_path()
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    closes = payload.get("closes") if isinstance(payload, dict) else None
    if not isinstance(closes, dict):
        return {}
    parsed: dict[str, list[tuple[str, float]]] = {}
    for index_id, rows in closes.items():
        series: list[tuple[str, float]] = []
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, list) or len(row) < 2:
                continue
            value = number(row[1])
            if value is None:
                continue
            series.append((str(row[0]), value))
        parsed[str(index_id)] = normalized_closes(series)
    return parsed


def save_archive_cache(closes: dict[str, list[tuple[str, float]]]) -> None:
    path = cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "closes": {index_id: [[stamp, value] for stamp, value in series] for index_id, series in closes.items()},
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def fetch_archive_csv(day: date) -> list[tuple[str, str, float]]:
    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)
    url = NSE_ARCHIVE_URL.format(stamp=day.strftime("%d%m%Y"))
    try:
        response = session.get(url, timeout=20)
        if response.status_code in (404, 403):
            return []
        if response.status_code == 503:
            response = session.get(url, timeout=20)
        response.raise_for_status()
        if "Index Name" not in response.text[:200]:
            return []
        return parse_close_all_csv(response.text)
    except requests.RequestException:
        return []


def archive_backfill_start(by_id: dict[str, list[tuple[str, float]]], today: date | None = None) -> date:
    today = today or date.today()
    lookback_start = today - timedelta(days=ARCHIVE_LOOKBACK_DAYS)
    starts: list[date] = []
    for series in by_id.values():
        if len(series) < 2:
            starts.append(lookback_start)
            continue
        first = datetime.strptime(series[0][0], "%Y-%m-%d").date()
        last = datetime.strptime(series[-1][0], "%Y-%m-%d").date()
        starts.append(lookback_start if first > lookback_start else last + timedelta(days=1))
    return min(starts) if starts else lookback_start


def nse_archive_histories(registry: list[dict[str, Any]]) -> dict[str, list[tuple[str, float]]]:
    name_to_id: dict[str, str] = {}
    for item in registry:
        index_id = str(item.get("id") or "")
        if not index_id:
            continue
        label = str(item.get("nseIndexName") or item.get("officialName") or "")
        for key in index_name_keys(label):
            name_to_id[key] = index_id
    cached = load_archive_cache()
    by_id: dict[str, list[tuple[str, float]]] = {
        str(item["id"]): list(cached.get(str(item["id"]), []))
        for item in registry
        if item.get("id")
    }
    missing_days = weekday_range(archive_backfill_start(by_id), date.today())
    if missing_days:
        lock = Lock()
        with ThreadPoolExecutor(max_workers=ARCHIVE_WORKERS) as pool:
            futures = [pool.submit(fetch_archive_csv, day) for day in missing_days]
            for future in as_completed(futures):
                rows = future.result()
                with lock:
                    for name, stamp, value in rows:
                        index_id = resolve_index_id(name, name_to_id)
                        if index_id:
                            by_id.setdefault(index_id, []).append((stamp, value))
        for index_id, series in list(by_id.items()):
            by_id[index_id] = normalized_closes(series)
        save_archive_cache(by_id)
    return {index_id: normalized_closes(series) for index_id, series in by_id.items()}


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
    if response.status_code in (401, 403, 503):
        session.get(NSE_HOME_URL, headers=REQUEST_HEADERS, timeout=15)
        response = session.get(NSE_HISTORY_URL, params=params, headers=REQUEST_HEADERS, timeout=20)
    if response.status_code == 503:
        raise RuntimeError("NSE historical API returned 503")
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


def index_record(
    item: dict[str, Any],
    session: requests.Session,
    archive_closes: list[tuple[str, float]] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    try:
        closes = nse_history(item, session)
        if len(closes) >= 2:
            return build_record(item, closes, "NSE official EOD index history", NSE_SOURCE_URL)
        errors.append(f"NSE returned {len(closes)} closing observation(s)")
    except Exception as exc:
        errors.append(f"NSE: {exc}")

    if archive_closes and len(archive_closes) >= 2:
        return build_record(item, archive_closes, "NSE official EOD index archive", NSE_ARCHIVE_SOURCE_URL)

    try:
        closes = yahoo_history(item)
        if len(closes) >= 2:
            return build_record(item, closes, "Yahoo Finance delayed exact-index history", YAHOO_SOURCE_URL)
        errors.append(f"Yahoo returned {len(closes)} closing observation(s)")
    except Exception as exc:
        errors.append(f"Yahoo: {exc}")
    if archive_closes is not None:
        errors.append(f"NSE archive returned {len(archive_closes)} closing observation(s)")
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
    archive_by_id = nse_archive_histories(registry)
    json.dump(
        {
            "indices": [
                index_record(item, session, archive_by_id.get(str(item.get("id") or "")))
                for item in registry
            ]
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
