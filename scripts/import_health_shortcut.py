#!/usr/bin/env python3
"""Import the "Health" Apple Shortcut export (the "Health Stats" table) into the
dashboard's health-overrides.json reconciliation file.

This replaces the deprecated Apple Notes " Health Daily" / "Health Daily v2"
snapshot as the daily reconciliation source. The HealthKit export.xml remains the
primary detailed source (Sleep, Heart, Respiratory, full Nutrition/Mobility); this
importer only supplies the per-day reconciliation values the Shortcut measures.

The output matches the exact schema consumed by scripts/import_apple_health.py
(`--overrides`): a date-keyed object of {"metrics": {...}, "meta": {...}}.

Input formats:
  * .csv   — no third-party dependency (recommended for the on-Mac pipeline;
             have the Shortcut export CSV, or export the Numbers sheet to CSV)
  * .numbers — requires `numbers-parser` (pip install numbers-parser)

Usage:
  python3 import_health_shortcut.py --input "Health Stats.csv" \
      --out artifacts/private/health-overrides.json --merge

  # regenerate a standalone file without touching the live one:
  python3 import_health_shortcut.py --input "Health Stats.numbers" \
      --out artifacts/private/health-overrides.shortcut.json
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional

IST = timezone(timedelta(hours=5, minutes=30))

# Health Stats column keyword  ->  (metric_type consumed by import_apple_health.py, category)
# Keyword is matched against the header with emoji/punctuation stripped, lowercased.
COLUMN_MAP: list[tuple[str, str, str]] = [
    ("active calor",   "ActiveEnergyBurned",     "Activity"),
    ("resting calor",  "BasalEnergyBurned",      "Activity"),
    ("steps",          "StepCount",              "Activity"),
    ("workout dur",    "AppleExerciseTime",      "Activity"),
    ("walking speed",  "WalkingSpeed",           "Mobility"),
    ("dietary calor",  "DietaryEnergyConsumed",  "Nutrition"),
    ("carbohyd",       "DietaryCarbohydrates",   "Nutrition"),
    ("protein",        "DietaryProtein",         "Nutrition"),
    ("sugar",          "DietarySugar",           "Nutrition"),
    ("caffeine",       "DietaryCaffeine",        "Nutrition"),
    ("water",          "DietaryWater",           "Nutrition"),  # litres -> ml unless --water-unit ml
]


def norm_header(text: str) -> str:
    return re.sub(r"[^a-z ]", "", str(text).lower()).strip()


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        f = float(value)
    else:
        s = str(value).strip().replace(",", "")
        if not s:
            return None
        try:
            f = float(s)
        except ValueError:
            return None
    if f != f:  # NaN
        return None
    return f


def to_date_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    s = str(value).strip()
    if not s:
        return None
    # Accept "2026-08-06", "2026-08-06 00:00:00", "06/08/2026", "6 Aug 2026", ISO datetimes
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(s[:19] if len(s) >= 19 and " " in s else s, fmt).date().isoformat()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def read_rows(path: Path) -> list[list[Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as fh:
            return [list(r) for r in csv.reader(fh)]
    if suffix == ".numbers":
        try:
            from numbers_parser import Document  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise SystemExit(
                "Reading a .numbers file needs numbers-parser (pip install numbers-parser).\n"
                "On the Mac pipeline, prefer exporting the Health Stats sheet to CSV instead."
            ) from exc
        doc = Document(str(path))
        table = doc.sheets[0].tables[0]
        return [list(r) for r in table.rows(values_only=True)]
    raise SystemExit(f"Unsupported input type: {suffix} (use .csv or .numbers)")


def build_overrides(rows: list[list[Any]], water_unit: str, capture_note: str) -> dict[str, Any]:
    if not rows:
        raise SystemExit("No rows found in the Health Stats export.")
    header = rows[0]
    norm = [norm_header(h) for h in header]

    date_col = next((i for i, h in enumerate(norm) if "date" in h), None)
    if date_col is None:
        raise SystemExit("Could not find a Date column in the Health Stats export.")

    # Resolve each source column to a metric_type
    col_to_metric: dict[int, tuple[str, str]] = {}
    for i, h in enumerate(norm):
        if i == date_col:
            continue
        for keyword, metric_type, category in COLUMN_MAP:
            if keyword in h:
                col_to_metric[i] = (metric_type, category)
                break

    captured_at = datetime.now(IST).isoformat(timespec="seconds")
    overrides: dict[str, Any] = {}
    for row in rows[1:]:
        if not row or all(c in (None, "") for c in row):
            continue
        day = to_date_iso(row[date_col]) if date_col < len(row) else None
        if not day:
            continue
        metrics: dict[str, float] = {}
        categories: set[str] = set()
        for i, (metric_type, category) in col_to_metric.items():
            if i >= len(row):
                continue
            val = to_float(row[i])
            if val is None:
                continue
            if metric_type == "DietaryWater" and water_unit == "l":
                val = round(val * 1000.0, 2)  # litres -> millilitres
            metrics[metric_type] = val
            categories.add(category)
        if not metrics:
            continue
        overrides[day] = {
            "metrics": metrics,
            "meta": {
                "capturedAt": captured_at,
                "categories": sorted(categories),
                "source": "Health Shortcut (Health Stats)",
                "detail": f"Daily reconciliation from the 'Health' Apple Shortcut (Health Stats export) for {day}.",
                "noteDetail": capture_note,
            },
        }
    return overrides


def deep_merge_existing_wins(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Merge incoming into base without overwriting anything base already has.
    Existing (e.g. hand-verified iPhone Mirroring) days and keys always win."""
    out = json.loads(json.dumps(base))  # deep copy
    for day, day_val in incoming.items():
        if day not in out:
            out[day] = day_val
            continue
        cur = out[day]
        # metrics: add only keys not already present
        cur_metrics = cur.setdefault("metrics", {})
        for k, v in day_val.get("metrics", {}).items():
            cur_metrics.setdefault(k, v)
        # meta: keep existing meta; add Shortcut categories that are new
        cur_meta = cur.setdefault("meta", {})
        inc_cats = set(day_val.get("meta", {}).get("categories", []))
        cur_cats = set(cur_meta.get("categories", []))
        if inc_cats - cur_cats:
            cur_meta["categories"] = sorted(cur_cats | inc_cats)
        cur_meta.setdefault("shortcutMergedAt", day_val.get("meta", {}).get("capturedAt"))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Import the 'Health' Shortcut export into health-overrides.json")
    ap.add_argument("--input", required=True, type=Path, help="Health Stats export (.csv or .numbers)")
    ap.add_argument("--out", required=True, type=Path, help="Output overrides JSON path")
    ap.add_argument("--merge", action="store_true", help="Merge into an existing --out (existing values win)")
    ap.add_argument("--water-unit", choices=["l", "ml"], default="l", help="Unit of the Water column (default: litres)")
    ap.add_argument("--capture-note", default="Daily snapshot from the 'Health' Apple Shortcut (Health Stats); direct HealthKit export values take precedence where they differ.")
    args = ap.parse_args()

    rows = read_rows(args.input)
    overrides = build_overrides(rows, args.water_unit, args.capture_note)

    if args.merge and args.out.exists():
        existing = json.loads(args.out.read_text(encoding="utf-8"))
        merged = deep_merge_existing_wins(existing, overrides)
    else:
        merged = overrides

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")

    days = sorted(overrides.keys())
    metric_counts: dict[str, int] = {}
    for d in overrides.values():
        for k in d["metrics"]:
            metric_counts[k] = metric_counts.get(k, 0) + 1
    print(json.dumps({
        "status": "ok",
        "input": str(args.input),
        "out": str(args.out),
        "merged": bool(args.merge and args.out.exists()),
        "shortcutDays": len(days),
        "dateRange": [days[0], days[-1]] if days else [],
        "totalDaysInOutput": len(merged),
        "metricCoverage": metric_counts,
        "waterUnit": args.water_unit,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
