#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from health_date_policy import IST, health_target_context


TYPE_PREFIX = "HKQuantityTypeIdentifier"
RELEVANT = {
    "ActiveEnergyBurned", "BasalEnergyBurned", "AppleExerciseTime", "AppleStandTime", "StepCount",
    "DistanceWalkingRunning", "FlightsClimbed", "PhysicalEffort", "HeartRate", "RestingHeartRate",
    "WalkingHeartRateAverage", "HeartRateVariabilitySDNN", "VO2Max", "OxygenSaturation", "RespiratoryRate",
    "WalkingSpeed", "WalkingStepLength", "WalkingDoubleSupportPercentage", "WalkingAsymmetryPercentage",
    "StairAscentSpeed", "StairDescentSpeed", "SixMinuteWalkTestDistance", "DietaryEnergyConsumed",
    "DietaryCarbohydrates", "DietaryProtein", "DietaryFatTotal", "DietaryFatSaturated", "DietaryFiber",
    "DietarySugar", "DietarySodium", "DietaryPotassium", "DietaryCholesterol", "DietaryWater", "DietaryCaffeine",
}
SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis"
SUM_TYPES = {
    "ActiveEnergyBurned", "BasalEnergyBurned", "AppleExerciseTime", "AppleStandTime", "StepCount",
    "DistanceWalkingRunning", "FlightsClimbed", "DietaryEnergyConsumed", "DietaryCarbohydrates",
    "DietaryProtein", "DietaryFatTotal", "DietaryFatSaturated", "DietaryFiber", "DietarySugar",
    "DietarySodium", "DietaryPotassium", "DietaryCholesterol", "DietaryWater", "DietaryCaffeine",
}

# Apple Health exports a record for every contributing source. Summing those
# rows directly double-counts cumulative device metrics when an Apple Watch and
# iPhone both observe the same activity. HealthKit resolves that overlap by
# source priority; the XML export does not include the user's source-order
# metadata, so reproduce the normal device precedence deterministically at
# one-minute resolution while retaining lower-priority source-only gaps.
SOURCE_RECONCILED_SUM_TYPES = {
    "ActiveEnergyBurned", "BasalEnergyBurned", "AppleExerciseTime", "AppleStandTime",
    "StepCount", "DistanceWalkingRunning", "FlightsClimbed",
}

METRICS = [
    ("Activity", "Active energy", "ActiveEnergyBurned", "sum", "kcal", "green"),
    ("Activity", "Exercise minutes", "AppleExerciseTime", "sum", "min", "green"),
    ("Activity", "Stand time", "AppleStandTime", "sum", "min", "green"),
    ("Activity", "Steps", "StepCount", "sum", "", "green"),
    ("Activity", "Walking + running", "DistanceWalkingRunning", "sum", "km", "green"),
    ("Activity", "Stairs climbed", "FlightsClimbed", "sum", "floors", "green"),
    ("Activity", "Resting energy", "BasalEnergyBurned", "sum", "kcal", "blue"),
    ("Activity", "Physical effort", "PhysicalEffort", "avg", "METs", "blue"),
    ("Heart", "Heart rate", "HeartRate", "range", "bpm", "red"),
    ("Heart", "Resting heart rate", "RestingHeartRate", "avg", "bpm", "green"),
    ("Heart", "Walking HR avg", "WalkingHeartRateAverage", "avg", "bpm", "blue"),
    ("Heart", "HRV", "HeartRateVariabilitySDNN", "avg", "ms", "green"),
    ("Heart", "Cardio fitness", "VO2Max", "avg", "VO2 max", "red"),
    ("Respiratory", "Blood oxygen", "OxygenSaturation", "range", "%", "green"),
    ("Respiratory", "Respiratory rate", "RespiratoryRate", "range", "breaths/min", "blue"),
    ("Mobility", "Walking speed", "WalkingSpeed", "avg", "km/h", "amber"),
    ("Mobility", "Step length", "WalkingStepLength", "avg", "cm", "amber"),
    ("Mobility", "Double support", "WalkingDoubleSupportPercentage", "avg", "%", "amber"),
    ("Mobility", "Walking asymmetry", "WalkingAsymmetryPercentage", "avg", "%", "green"),
    ("Mobility", "Stair speed up", "StairAscentSpeed", "avg", "m/s", "amber"),
    ("Mobility", "Stair speed down", "StairDescentSpeed", "avg", "m/s", "amber"),
    ("Mobility", "Six-minute walk", "SixMinuteWalkTestDistance", "avg", "m", "blue"),
    ("Nutrition", "Dietary energy", "DietaryEnergyConsumed", "sum", "kcal", "amber"),
    ("Nutrition", "Carbohydrate", "DietaryCarbohydrates", "sum", "g", "blue"),
    ("Nutrition", "Protein", "DietaryProtein", "sum", "g", "amber"),
    ("Nutrition", "Total fat", "DietaryFatTotal", "sum", "g", "blue"),
    ("Nutrition", "Saturated fat", "DietaryFatSaturated", "sum", "g", "amber"),
    ("Nutrition", "Fibre", "DietaryFiber", "sum", "g", "amber"),
    ("Nutrition", "Sugar", "DietarySugar", "sum", "g", "amber"),
    ("Nutrition", "Sodium", "DietarySodium", "sum", "mg", "amber"),
    ("Nutrition", "Potassium", "DietaryPotassium", "sum", "mg", "amber"),
    ("Nutrition", "Dietary cholesterol", "DietaryCholesterol", "sum", "mg", "blue"),
    ("Nutrition", "Water", "DietaryWater", "sum", "ml", "green"),
    ("Nutrition", "Caffeine", "DietaryCaffeine", "sum", "mg", "amber"),
]

CATEGORY_TONES = {"Activity": "green", "Sleep": "blue", "Heart": "red", "Respiratory": "blue", "Mobility": "amber", "Nutrition": "green"}
CATEGORY_TYPES: Dict[str, set[str]] = defaultdict(set)
for metric_category, _, metric_type, *_ in METRICS:
    CATEGORY_TYPES[metric_category].add(metric_type)
CATEGORY_TYPES["Sleep"].add("SleepAnalysis")


def parse_dt(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S %z")


def short_type(value: str) -> str:
    return value.removeprefix(TYPE_PREFIX)


def record_key(attrs: dict[str, str]) -> str:
    raw = "|".join(attrs.get(key, "") for key in ("type", "sourceName", "startDate", "endDate", "unit", "value"))
    return hashlib.sha1(raw.encode()).hexdigest()


def setup_database(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.executescript("""
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS records (
        record_key TEXT PRIMARY KEY, type TEXT NOT NULL, source TEXT NOT NULL, day TEXT NOT NULL,
        start_at TEXT NOT NULL, end_at TEXT NOT NULL, unit TEXT, value REAL, category_value TEXT
      );
      CREATE INDEX IF NOT EXISTS records_type_day ON records(type, day);
      CREATE TABLE IF NOT EXISTS imports (
        path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime_ns INTEGER NOT NULL, export_date TEXT,
        imported_at TEXT NOT NULL, relevant_records INTEGER NOT NULL
      );
    """)
    return db


def import_xml(xml_path: Path, db: sqlite3.Connection, force: bool = False) -> tuple[str, int, bool]:
    stat = xml_path.stat()
    prior = db.execute("SELECT size, mtime_ns, export_date, relevant_records FROM imports WHERE path=?", (str(xml_path),)).fetchone()
    if prior and prior[0] == stat.st_size and prior[1] == stat.st_mtime_ns and not force:
        return prior[2] or "", int(prior[3]), False

    db.execute("DELETE FROM records")
    export_date = ""
    batch: List[tuple] = []
    relevant = 0
    for _, elem in ET.iterparse(xml_path, events=("end",)):
        if elem.tag == "ExportDate":
            export_date = elem.attrib.get("value", "")
        elif elem.tag == "Record":
            attrs = elem.attrib
            raw_type = attrs.get("type", "")
            metric_type = short_type(raw_type)
            if metric_type in RELEVANT or raw_type == SLEEP_TYPE:
                try:
                    value = float(attrs.get("value", "nan")) if raw_type != SLEEP_TYPE else None
                except ValueError:
                    value = None
                start_at = attrs.get("startDate", "")
                end_at = attrs.get("endDate", start_at)
                if start_at:
                    batch.append((record_key(attrs), metric_type if raw_type != SLEEP_TYPE else "SleepAnalysis", attrs.get("sourceName", "Unknown"), start_at[:10], start_at, end_at, attrs.get("unit", ""), value, attrs.get("value") if raw_type == SLEEP_TYPE else None))
                    relevant += 1
            if len(batch) >= 5000:
                db.executemany("INSERT OR IGNORE INTO records VALUES (?,?,?,?,?,?,?,?,?)", batch)
                db.commit()
                batch.clear()
        elem.clear()
    if batch:
        db.executemany("INSERT OR IGNORE INTO records VALUES (?,?,?,?,?,?,?,?,?)", batch)
    db.execute("INSERT OR REPLACE INTO imports VALUES (?,?,?,?,?,?)", (str(xml_path), stat.st_size, stat.st_mtime_ns, export_date, datetime.now().astimezone().isoformat(), relevant))
    db.commit()
    return export_date, relevant, True


def source_priority(source: str) -> tuple[int, str]:
    """Approximate Apple Health's device priority when XML omits source order."""
    normalized = source.replace("\u00a0", " ").strip().casefold()
    if normalized in {"health", "apple health"}:
        return 0, normalized
    if "apple watch" in normalized or "watch" in normalized or "timepiece" in normalized:
        return 1, normalized
    if "iphone" in normalized or "ipad" in normalized or "ipod" in normalized:
        return 2, normalized
    return 3, normalized


def source_reconciled_sum(db: sqlite3.Connection, metric_type: str, day: str) -> Optional[float]:
    """Merge overlapping cumulative records using source priority per minute.

    Each record is distributed across the minute buckets it covers. Values from
    the highest-priority source present in a bucket are retained; lower-priority
    values in that same bucket are excluded as overlapping observations. This
    preserves iPhone-only gaps instead of discarding an entire lower-priority
    daily stream.
    """
    rows = db.execute(
        "SELECT source, start_at, end_at, value FROM records "
        "WHERE type=? AND day=? AND value IS NOT NULL",
        (metric_type, day),
    ).fetchall()
    if not rows:
        return None
    if len({row[0] for row in rows}) == 1:
        return float(sum(row[3] for row in rows))

    buckets: Dict[datetime, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for source, start_raw, end_raw, raw_value in rows:
        start = parse_dt(start_raw)
        end = parse_dt(end_raw)
        value = float(raw_value)
        duration = (end - start).total_seconds()
        if duration <= 0:
            buckets[start.replace(second=0, microsecond=0)][source] += value
            continue
        minute = start.replace(second=0, microsecond=0)
        while minute < end:
            minute_end = minute + timedelta(minutes=1)
            overlap = max(0.0, (min(end, minute_end) - max(start, minute)).total_seconds())
            if overlap:
                buckets[minute][source] += value * overlap / duration
            minute = minute_end

    total = 0.0
    for source_values in buckets.values():
        selected_source = min(source_values, key=source_priority)
        total += source_values[selected_source]
    return total


def has_multiple_sources(db: sqlite3.Connection, metric_type: str, day: str) -> bool:
    rows = db.execute(
        "SELECT DISTINCT source FROM records WHERE type=? AND day=? LIMIT 2",
        (metric_type, day),
    ).fetchall()
    return len(rows) > 1


def aggregate(db: sqlite3.Connection, metric_type: str, day: str, mode: str) -> Optional[Union[float, Tuple[float, float]]]:
    if mode == "sum":
        if metric_type in SOURCE_RECONCILED_SUM_TYPES:
            return source_reconciled_sum(db, metric_type, day)
        row = db.execute("SELECT SUM(value) FROM records WHERE type=? AND day=?", (metric_type, day)).fetchone()
    elif mode == "range":
        row = db.execute("SELECT MIN(value), MAX(value) FROM records WHERE type=? AND day=?", (metric_type, day)).fetchone()
        return (float(row[0]), float(row[1])) if row and row[0] is not None else None
    else:
        row = db.execute("SELECT AVG(value) FROM records WHERE type=? AND day=?", (metric_type, day)).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def daily_series(db: sqlite3.Connection, metric_type: str, end: date, days: int, mode: str) -> List[float]:
    values: List[float] = []
    for offset in range(days):
        result = aggregate(db, metric_type, (end - timedelta(days=offset)).isoformat(), mode)
        if isinstance(result, tuple):
            values.append(sum(result) / 2)
        elif result is not None:
            values.append(result)
    return values


def daily_history(
    db: sqlite3.Connection,
    metric_type: str,
    end: date,
    days: int,
    mode: str,
) -> List[dict]:
    """Chronological (oldest→newest) measured daily points; omit days with no records."""
    points: List[dict] = []
    for offset in range(days - 1, -1, -1):
        day = (end - timedelta(days=offset)).isoformat()
        result = aggregate(db, metric_type, day, mode)
        if result is None:
            continue
        value = adjusted(metric_type, result)
        if isinstance(value, tuple):
            value = sum(value) / 2
        points.append({"date": day, "value": float(value)})
    return points


def sleep_history(db: sqlite3.Connection, end: date, days: int, pattern: str) -> List[dict]:
    points: List[dict] = []
    for offset in range(days - 1, -1, -1):
        day = (end - timedelta(days=offset)).isoformat()
        value = sleep_hours(db, day, pattern)
        if value is None:
            continue
        points.append({"date": day, "value": float(value)})
    return points


def apply_history_override(
    points: List[dict],
    current: Union[float, Tuple[float, float]],
    _prior: Optional[Union[float, Tuple[float, float]]],
    target_day: str,
) -> List[dict]:
    """Replace or insert the target-day override without inventing other missing days."""
    current_point = sum(current) / 2 if isinstance(current, tuple) else float(current)
    updated = [{**point} for point in points]
    for point in updated:
        if point["date"] == target_day:
            point["value"] = current_point
            return updated
    updated.append({"date": target_day, "value": current_point})
    updated.sort(key=lambda point: point["date"])
    return updated


def sleep_hours(db: sqlite3.Connection, day: str, category_pattern: str = "Asleep") -> Optional[float]:
    if category_pattern == "Asleep":
        rows = db.execute(
            "SELECT start_at, end_at FROM records WHERE type='SleepAnalysis' AND day=? "
            "AND (category_value LIKE '%AsleepCore' OR category_value LIKE '%AsleepDeep' OR category_value LIKE '%AsleepREM')",
            (day,),
        ).fetchall()
        if not rows:
            rows = db.execute(
                "SELECT start_at, end_at FROM records WHERE type='SleepAnalysis' AND day=? AND category_value LIKE '%AsleepUnspecified'",
                (day,),
            ).fetchall()
    else:
        rows = db.execute(
            "SELECT start_at, end_at FROM records WHERE type='SleepAnalysis' AND day=? AND category_value LIKE ?",
            (day, f"%{category_pattern}"),
        ).fetchall()
    intervals = sorted((parse_dt(start), parse_dt(end)) for start, end in rows)
    merged: List[Tuple[datetime, datetime]] = []
    for start, end in intervals:
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
        elif end > merged[-1][1]:
            merged[-1] = (merged[-1][0], end)
    seconds = sum(max(0, (end - start).total_seconds()) for start, end in merged)
    return seconds / 3600 if seconds else None


def _parse_delta_percent(delta: Optional[str]) -> Optional[float]:
    if not delta:
        return None
    match = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", delta.replace(",", ""))
    return float(match.group(1)) if match else None


def build_metric_actions(
    categories: List[dict],
    completed: date,
    missing: List[str],
    has_partial: bool,
    partial_export_day: str,
) -> List[dict]:
    """Derive wellness insights from completed-day metrics only — never invent values."""
    higher = {
        "Active energy", "Exercise minutes", "Stand time", "Steps", "Walking + running", "Stairs climbed",
        "Time asleep", "Deep sleep", "REM sleep", "Core sleep", "Cardio fitness", "Walking speed",
        "Step length", "Protein", "Fibre", "Potassium", "Water", "HRV",
    }
    lower = {"Resting heart rate", "Walking asymmetry", "Double support", "Awake", "Sodium", "Sugar", "Saturated fat"}
    priority = [
        "Active energy", "Steps", "Exercise minutes", "Time asleep", "Deep sleep", "REM sleep",
        "Resting heart rate", "HRV", "Cardio fitness", "Dietary energy", "Protein", "Fibre", "Water",
        "Walking asymmetry", "Blood oxygen",
    ]
    actions: List[dict] = []
    if missing:
        actions.append({
            "tone": "amber",
            "title": "Operational-day coverage gap",
            "text": f"Missing source dates: {', '.join(missing)}.",
        })
    else:
        actions.append({
            "tone": "green",
            "title": "Operational-day coverage",
            "text": "The last seven target days are present.",
        })

    date_label = completed.strftime("%d %b %Y")
    for category in categories:
        ranked = sorted(
            category.get("metrics", []),
            key=lambda metric: priority.index(metric["label"]) if metric.get("label") in priority else 99,
        )
        emitted = 0
        for metric in ranked:
            weekly = (metric.get("averages") or {}).get("weekly") or {}
            direction = weekly.get("direction")
            if direction not in {"up", "down"}:
                continue
            delta_pct = _parse_delta_percent(weekly.get("delta"))
            if delta_pct is None or abs(delta_pct) < 8:
                continue
            label = metric.get("label", "")
            if label in higher:
                tone = "green" if direction == "up" else "amber"
            elif label in lower:
                tone = "green" if direction == "down" else "amber"
            else:
                tone = "blue"
            actions.append({
                "tone": tone,
                "title": f"{category.get('name')}: {label}",
                "text": (
                    f"{date_label} recorded {metric.get('value')} "
                    f"({weekly.get('delta') or direction} vs 7-day average {weekly.get('value')}). "
                    "Wellness signal only; not a diagnosis."
                ),
            })
            emitted += 1
            if emitted >= 2:
                break

    nutrition = next((item for item in categories if item.get("name") == "Nutrition"), None)
    energy = next((metric for metric in (nutrition or {}).get("metrics", []) if metric.get("label") == "Dietary energy"), None)
    if energy:
        weekly = (energy.get("averages") or {}).get("weekly") or {}
        delta_pct = _parse_delta_percent(weekly.get("delta"))
        if delta_pct is not None and delta_pct <= -25:
            actions.append({
                "tone": "amber",
                "title": "Nutrition log is incomplete by definition",
                "text": (
                    f"{date_label} logged dietary energy {energy.get('value')} "
                    f"versus 7-day average {weekly.get('value')} ({weekly.get('delta')}). "
                    "Logged nutrition is not verified total intake."
                ),
            })

    actions.append({
        "tone": "amber" if has_partial else "blue",
        "title": "Partial export-day isolation",
        "text": (
            f"{partial_export_day} is excluded from completed-day KPIs."
            if has_partial
            else "No later partial export day is included in optimisation."
        ),
    })
    actions.append({
        "tone": "amber",
        "title": "Livity / mirroring not verified",
        "text": (
            f"Livity, Lifesum and Guava were not mirrored for {date_label}. "
            "Do not treat export-only HealthKit values as cross-app reconciled."
        ),
    })
    # De-dupe by title while preserving order
    seen: set[str] = set()
    unique: List[dict] = []
    for item in actions:
        title = str(item.get("title", ""))
        if title in seen:
            continue
        seen.add(title)
        unique.append(item)
    return unique[:10]


def fmt(value: Union[float, Tuple[float, float]], unit: str) -> str:
    def one(number: float) -> str:
        if unit in {"", "floors", "bpm", "ms", "min", "kcal", "mg", "ml", "m"}:
            return f"{number:,.0f}"
        if unit == "hr":
            return f"{number:.1f}"
        return f"{number:.1f}"
    if isinstance(value, tuple):
        return f"{one(value[0])}-{one(value[1])}{(' ' + unit) if unit else ''}"
    return f"{one(value)}{(' ' + unit) if unit else ''}"


def adjusted(metric_type: str, value: Union[float, Tuple[float, float]]) -> Union[float, Tuple[float, float]]:
    if metric_type in {"OxygenSaturation", "WalkingDoubleSupportPercentage", "WalkingAsymmetryPercentage"}:
        if isinstance(value, tuple): return value[0] * 100, value[1] * 100
        return value * 100
    return value


def comparison(current: Union[float, Tuple[float, float]], values: List[float], unit: str) -> Optional[dict]:
    if not values:
        return None
    current_point = sum(current) / 2 if isinstance(current, tuple) else current
    average = sum(values) / len(values)
    delta = ((current_point / average) - 1) * 100 if average else 0
    direction = "same" if abs(delta) < 1 else "up" if delta > 0 else "down"
    return {"value": fmt(average, unit), "direction": direction, "delta": f"{delta:+.1f}%"}


def override_value(overrides: dict[str, Any], day: date, group: str, key: str) -> Optional[Union[float, Tuple[float, float]]]:
    raw = overrides.get(day.isoformat(), {}).get(group, {}).get(key)
    if isinstance(raw, list) and len(raw) == 2:
        return float(raw[0]), float(raw[1])
    if isinstance(raw, (int, float)):
        return float(raw)
    return None


def replace_current(values: List[float], current: Union[float, Tuple[float, float]], prior: Optional[Union[float, Tuple[float, float]]]) -> List[float]:
    current_point = sum(current) / 2 if isinstance(current, tuple) else current
    if prior is not None and values:
        return [float(current_point), *values[1:]]
    return [float(current_point), *values]


def build_snapshot(
    db: sqlite3.Connection,
    export_date: str,
    relevant: int,
    overrides: Optional[dict[str, Any]] = None,
    archive_state: Optional[dict[str, Any]] = None,
    now: Optional[datetime] = None,
) -> dict:
    overrides = overrides or {}
    archive_state = archive_state or {}
    now = (now or datetime.now(IST)).astimezone(IST)
    target = health_target_context(now)
    export_captured_at = parse_dt(export_date).astimezone(IST) if export_date else now
    eligible = health_target_context(export_captured_at)
    completed = min(target.target_date, eligible.target_date)
    categories: Dict[str, list] = defaultdict(list)
    coverage: Dict[str, dict] = {}

    for category, label, metric_type, mode, unit, tone in METRICS:
        prior_current = aggregate(db, metric_type, completed.isoformat(), mode)
        first, last, count = db.execute(
            "SELECT MIN(day), MAX(day), COUNT(*) FROM records WHERE type=? AND day BETWEEN '2010-01-01' AND ?",
            (metric_type, export_captured_at.date().isoformat()),
        ).fetchone()
        metric_days = {
            row[0] for row in db.execute(
                "SELECT DISTINCT day FROM records WHERE type=? AND day BETWEEN ? AND ?",
                (metric_type, (completed - timedelta(days=29)).isoformat(), completed.isoformat()),
            )
        }
        missing_week = [
            (completed - timedelta(days=offset)).isoformat()
            for offset in range(7)
            if (completed - timedelta(days=offset)).isoformat() not in metric_days
        ]
        missing_month = [
            (completed - timedelta(days=offset)).isoformat()
            for offset in range(30)
            if (completed - timedelta(days=offset)).isoformat() not in metric_days
        ]
        coverage[label] = {
            "firstDate": first or "",
            "lastDate": last or "",
            "records": count,
            "status": "available" if completed.isoformat() in metric_days else "missing_target",
            "weekly": len(missing_week) <= 3,
            "monthly": len(missing_month) <= 10,
            "missingDates7": missing_week,
            "missingDates30": missing_month,
        }
        metric_override = override_value(overrides, completed, "metrics", metric_type)
        current = metric_override if metric_override is not None else prior_current
        if current is None:
            continue
        current = adjusted(metric_type, current)
        week_values = [float(adjusted(metric_type, value)) for value in daily_series(db, metric_type, completed, 7, mode) if not isinstance(adjusted(metric_type, value), tuple)]
        month_values = [float(adjusted(metric_type, value)) for value in daily_series(db, metric_type, completed, 30, mode) if not isinstance(adjusted(metric_type, value), tuple)]
        weekly_history = daily_history(db, metric_type, completed, 7, mode)
        monthly_history = daily_history(db, metric_type, completed, 30, mode)
        if metric_override is not None:
            adjusted_prior = adjusted(metric_type, prior_current) if prior_current is not None else None
            week_values = replace_current(week_values, current, adjusted_prior)
            month_values = replace_current(month_values, current, adjusted_prior)
            target_day = completed.isoformat()
            weekly_history = apply_history_override(weekly_history, current, adjusted_prior, target_day)
            monthly_history = apply_history_override(monthly_history, current, adjusted_prior, target_day)
        averages = {}
        weekly = comparison(current, week_values, unit)
        monthly = comparison(current, month_values, unit)
        if weekly: averages["weekly"] = weekly
        if monthly: averages["monthly"] = monthly
        history = {}
        if weekly_history: history["weekly"] = weekly_history
        if monthly_history: history["monthly"] = monthly_history
        if metric_override is not None:
            metric_source = "iPhone Mirroring"
        elif metric_type in SOURCE_RECONCILED_SUM_TYPES and has_multiple_sources(db, metric_type, completed.isoformat()):
            metric_source = "Apple Health XML · source-reconciled"
        else:
            metric_source = "Apple Health export"
        categories[category].append({
            "label": label,
            "value": fmt(current, unit),
            "context": f"{metric_source} · {completed.strftime('%d %b %Y')}",
            "tone": tone,
            "averages": averages,
            "history": history,
        })
    sleep_metrics = []
    for label, pattern, tone in (("Time asleep", "Asleep", "blue"), ("Deep sleep", "AsleepDeep", "blue"), ("REM sleep", "AsleepREM", "blue"), ("Core sleep", "AsleepCore", "blue"), ("Awake", "Awake", "amber")):
        sleep_days = {
            day
            for offset in range(30)
            if sleep_hours(db, day := (completed - timedelta(days=offset)).isoformat(), pattern) is not None
        }
        missing_week = [
            (completed - timedelta(days=offset)).isoformat()
            for offset in range(7)
            if (completed - timedelta(days=offset)).isoformat() not in sleep_days
        ]
        missing_month = [
            (completed - timedelta(days=offset)).isoformat()
            for offset in range(30)
            if (completed - timedelta(days=offset)).isoformat() not in sleep_days
        ]
        coverage[label] = {
            "firstDate": min(sleep_days) if sleep_days else "",
            "lastDate": max(sleep_days) if sleep_days else "",
            "records": len(sleep_days),
            "status": "available" if completed.isoformat() in sleep_days else "missing_target",
            "weekly": len(missing_week) <= 3,
            "monthly": len(missing_month) <= 10,
            "missingDates7": missing_week,
            "missingDates30": missing_month,
        }
        prior_value = sleep_hours(db, completed.isoformat(), pattern)
        sleep_override = override_value(overrides, completed, "sleep", pattern)
        value = sleep_override if sleep_override is not None else prior_value
        if value is None: continue
        if isinstance(value, tuple): continue
        weekly_values = [v for offset in range(7) if (v := sleep_hours(db, (completed - timedelta(days=offset)).isoformat(), pattern)) is not None]
        monthly_values = [v for offset in range(30) if (v := sleep_hours(db, (completed - timedelta(days=offset)).isoformat(), pattern)) is not None]
        weekly_history = sleep_history(db, completed, 7, pattern)
        monthly_history = sleep_history(db, completed, 30, pattern)
        if sleep_override is not None:
            weekly_values = replace_current(weekly_values, value, prior_value)
            monthly_values = replace_current(monthly_values, value, prior_value)
            target_day = completed.isoformat()
            weekly_history = apply_history_override(weekly_history, value, prior_value, target_day)
            monthly_history = apply_history_override(monthly_history, value, prior_value, target_day)
        sleep_source = "iPhone Mirroring" if sleep_override is not None else "Apple Health export"
        history = {}
        if weekly_history: history["weekly"] = weekly_history
        if monthly_history: history["monthly"] = monthly_history
        sleep_metrics.append({
            "label": label,
            "value": f"{int(value)}h {round((value % 1) * 60):02d}m",
            "context": f"{sleep_source} · {completed.strftime('%d %b %Y')}",
            "tone": tone,
            "averages": {"weekly": comparison(value, weekly_values, "hr"), "monthly": comparison(value, monthly_values, "hr")},
            "history": history,
        })
    categories["Sleep"] = sleep_metrics

    ordered = []
    override_meta = overrides.get(completed.isoformat(), {}).get("meta", {})
    overridden_categories = set(override_meta.get("categories", []))
    for name in ("Activity", "Sleep", "Heart", "Respiratory", "Mobility", "Nutrition"):
        source_note = "Apple Health + iPhone Mirroring" if name in overridden_categories else "Apple Health export"
        ordered.append({"name": name, "note": f"{source_note} · completed through {completed.strftime('%d %b %Y')}", "tone": CATEGORY_TONES[name], "metrics": categories.get(name, [])})

    partial_export_day = export_captured_at.date().isoformat() if export_captured_at.date() > completed else ""
    has_partial = bool(
        partial_export_day
        and db.execute("SELECT 1 FROM records WHERE day=? LIMIT 1", (partial_export_day,)).fetchone()
    )
    operational_end = target.target_date
    present_days = {
        row[0]
        for row in db.execute(
            "SELECT DISTINCT day FROM records WHERE day BETWEEN ? AND ?",
            ((operational_end - timedelta(days=29)).isoformat(), completed.isoformat()),
        )
    }
    missing = [
        (operational_end - timedelta(days=offset)).isoformat()
        for offset in range(7)
        if (operational_end - timedelta(days=offset)).isoformat() not in present_days
    ]
    category_coverage: Dict[str, dict] = {}
    for name in ("Activity", "Sleep", "Heart", "Respiratory", "Mobility", "Nutrition"):
        metric_types = sorted(CATEGORY_TYPES[name])
        placeholders = ",".join("?" for _ in metric_types)
        record_count = db.execute(
            f"SELECT COUNT(*) FROM records WHERE day=? AND type IN ({placeholders})",
            (completed.isoformat(), *metric_types),
        ).fetchone()[0]
        metric_count = len(categories.get(name, []))
        category_coverage[name] = {
            "date": completed.isoformat(),
            "available": record_count > 0 and metric_count > 0,
            "metricCount": metric_count,
            "recordCount": record_count,
        }

    archive_status = str(archive_state.get("status", "verified_export"))
    rejected_archive = str(archive_state.get("rejectedArchive", ""))
    fallback_reason = str(archive_state.get("fallbackReason", ""))
    target_has_records = bool(db.execute("SELECT 1 FROM records WHERE day=? LIMIT 1", (completed.isoformat(),)).fetchone())
    complete_categories = all(item["available"] for item in category_coverage.values())
    if not target_has_records:
        snapshot_status = "unavailable"
    elif eligible.target_date < target.target_date:
        snapshot_status = "stale"
    elif not complete_categories:
        snapshot_status = "partial"
    elif archive_status == "verified_latest":
        snapshot_status = "live"
    elif archive_status in {"cached_fallback", "verified_export", "invalid_latest"}:
        snapshot_status = "cached"
    else:
        snapshot_status = "unavailable"

    status_detail = {
        "live": f"Operational Health target {target.target_date.isoformat()} is verified from the newest archive.",
        "partial": f"Operational Health target {target.target_date.isoformat()} has incomplete category coverage.",
        "cached": f"Operational Health target {target.target_date.isoformat()} is served from a validated fallback export.",
        "stale": f"Health data is eligible through {eligible.target_date.isoformat()}; the current operational target is {target.target_date.isoformat()}.",
        "unavailable": f"No usable Health records were found for {completed.isoformat()}.",
    }[snapshot_status]
    archive_message = str(archive_state.get("message", "")).strip()
    message_parts = [
        f"Streaming import of {relevant:,} relevant Apple Health records.",
        status_detail,
        f"Policy: {target.label}.",
    ]
    if has_partial:
        message_parts.append(f"{partial_export_day} is partial and excluded from completed-day KPIs.")
    if archive_message:
        message_parts.append(archive_message)

    sources = [
        {
            "source": "Apple Health export",
            "status": "Verified" if snapshot_status in {"live", "cached"} else "Fallback",
            "detail": f"export.xml parsed incrementally; eligible through {eligible.target_date.isoformat()}",
            "tone": "green" if snapshot_status in {"live", "cached"} else "amber",
        },
        *([{"source": "iPhone Mirroring", "status": "Verified", "detail": override_meta.get("detail", f"Final operational-day values verified for {completed.isoformat()}"), "tone": "green"}] if override_meta else [{
            "source": "iPhone Mirroring",
            "status": "Unavailable",
            "detail": f"No iPhone Mirroring overrides for operational target {target.target_date.isoformat()}; export values stand alone.",
            "tone": "amber",
        }]),
        *([{"source": " Health Daily Note", "status": "Read", "detail": override_meta.get("noteDetail", f"Exact note contains a {completed.isoformat()} shortcut snapshot; direct Health values take precedence"), "tone": "amber"}] if override_meta else []),
        {
            "source": "Livity",
            "status": "Unavailable" if not override_meta.get("livity") else "Verified",
            "detail": override_meta.get("livityDetail", f"Livity was not mirrored for {target.target_date.isoformat()}; do not invent Livity values."),
            "tone": "amber" if not override_meta.get("livity") else "green",
        },
        {
            "source": "Lifesum",
            "status": "Unavailable" if not override_meta.get("lifesum") else "Verified",
            "detail": override_meta.get("lifesumDetail", f"Lifesum was not mirrored for {target.target_date.isoformat()}."),
            "tone": "amber" if not override_meta.get("lifesum") else "green",
        },
        {
            "source": "Guava",
            "status": "Unavailable" if not override_meta.get("guava") else "Verified",
            "detail": override_meta.get("guavaDetail", f"Guava was not mirrored for {target.target_date.isoformat()}."),
            "tone": "amber" if not override_meta.get("guava") else "green",
        },
    ]
    if archive_state:
        sources.append({
            "source": "Latest Apple Health ZIP",
            "status": "Rejected" if rejected_archive else ("Verified" if archive_status == "verified_latest" else "Fallback"),
            "detail": archive_message or "Archive validation completed.",
            "tone": "red" if rejected_archive else ("green" if archive_status == "verified_latest" else "amber"),
        })

    return {
        "schemaVersion": 1, "status": snapshot_status, "source": "Apple Health", "dataDate": completed.isoformat(),
        "completedThrough": completed.isoformat(), "partialToday": has_partial,
        "partialExportDay": partial_export_day if has_partial else "", "missingDates": missing,
        "capturedAt": now.isoformat(), "exportDate": export_date,
        "exportCapturedAt": export_captured_at.isoformat(),
        "targetDate": target.target_date.isoformat(), "targetPolicy": target.policy, "targetLabel": target.label,
        "requiredThrough": target.target_date.isoformat(), "eligibleThrough": eligible.target_date.isoformat(),
        "archiveStatus": archive_status, "activeArchive": archive_state.get("activeArchive", ""),
        "rejectedArchive": rejected_archive, "fallbackReason": fallback_reason,
        "message": " ".join(message_parts),
        "coverage": coverage, "categoryCoverage": category_coverage, "categories": ordered,
        "sources": sources,
        "actions": build_metric_actions(ordered, completed, missing, has_partial, partial_export_day),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", required=True, type=Path)
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--archive-state", type=Path)
    parser.add_argument("--overrides", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    db = setup_database(args.db)
    export_date, relevant, imported = import_xml(args.xml, db, args.force)
    overrides = json.loads(args.overrides.read_text(encoding="utf-8")) if args.overrides and args.overrides.exists() else {}
    archive_state = json.loads(args.archive_state.read_text(encoding="utf-8")) if args.archive_state and args.archive_state.exists() else {}
    snapshot = build_snapshot(db, export_date, relevant, overrides, archive_state)
    if archive_state:
        snapshot["archive"] = archive_state
    args.snapshot.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.snapshot.with_name(f".{args.snapshot.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(args.snapshot)
    print(json.dumps({"status": "ok", "imported": imported, "relevantRecords": relevant, "dataDate": snapshot["dataDate"], "partialToday": snapshot["partialToday"]}))


if __name__ == "__main__":
    main()
