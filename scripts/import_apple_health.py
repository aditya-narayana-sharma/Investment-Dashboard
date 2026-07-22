#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union


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


def aggregate(db: sqlite3.Connection, metric_type: str, day: str, mode: str) -> Optional[Union[float, Tuple[float, float]]]:
    if mode == "sum":
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


def build_snapshot(db: sqlite3.Connection, export_date: str, relevant: int, overrides: Optional[dict[str, Any]] = None) -> dict:
    overrides = overrides or {}
    today = datetime.now().astimezone().date()
    completed = today - timedelta(days=1)
    export_day = parse_dt(export_date).date() if export_date else completed
    completed = min(completed, export_day)
    categories: Dict[str, list] = defaultdict(list)
    coverage: Dict[str, dict] = {}

    for category, label, metric_type, mode, unit, tone in METRICS:
        prior_current = aggregate(db, metric_type, completed.isoformat(), mode)
        metric_override = override_value(overrides, completed, "metrics", metric_type)
        current = metric_override if metric_override is not None else prior_current
        if current is None:
            continue
        current = adjusted(metric_type, current)
        week_values = [float(adjusted(metric_type, value)) for value in daily_series(db, metric_type, completed, 7, mode) if not isinstance(adjusted(metric_type, value), tuple)]
        month_values = [float(adjusted(metric_type, value)) for value in daily_series(db, metric_type, completed, 30, mode) if not isinstance(adjusted(metric_type, value), tuple)]
        if metric_override is not None:
            adjusted_prior = adjusted(metric_type, prior_current) if prior_current is not None else None
            week_values = replace_current(week_values, current, adjusted_prior)
            month_values = replace_current(month_values, current, adjusted_prior)
        averages = {}
        weekly = comparison(current, week_values, unit)
        monthly = comparison(current, month_values, unit)
        if weekly: averages["weekly"] = weekly
        if monthly: averages["monthly"] = monthly
        metric_source = "iPhone Mirroring" if metric_override is not None else "Apple Health export"
        categories[category].append({"label": label, "value": fmt(current, unit), "context": f"{metric_source} · {completed.strftime('%d %b %Y')}", "tone": tone, "averages": averages})
        first, last, count = db.execute(
            "SELECT MIN(day), MAX(day), COUNT(*) FROM records WHERE type=? AND day BETWEEN '2010-01-01' AND ?",
            (metric_type, today.isoformat()),
        ).fetchone()
        coverage[label] = {"firstDate": first or "", "lastDate": last or "", "records": count, "weekly": len(week_values) >= 4, "monthly": len(month_values) >= 20}

    sleep_metrics = []
    for label, pattern, tone in (("Time asleep", "Asleep", "blue"), ("Deep sleep", "AsleepDeep", "blue"), ("REM sleep", "AsleepREM", "blue"), ("Core sleep", "AsleepCore", "blue"), ("Awake", "Awake", "amber")):
        prior_value = sleep_hours(db, completed.isoformat(), pattern)
        sleep_override = override_value(overrides, completed, "sleep", pattern)
        value = sleep_override if sleep_override is not None else prior_value
        if value is None: continue
        if isinstance(value, tuple): continue
        weekly_values = [v for offset in range(7) if (v := sleep_hours(db, (completed - timedelta(days=offset)).isoformat(), pattern)) is not None]
        monthly_values = [v for offset in range(30) if (v := sleep_hours(db, (completed - timedelta(days=offset)).isoformat(), pattern)) is not None]
        if sleep_override is not None:
            weekly_values = replace_current(weekly_values, value, prior_value)
            monthly_values = replace_current(monthly_values, value, prior_value)
        sleep_source = "iPhone Mirroring" if sleep_override is not None else "Apple Health export"
        sleep_metrics.append({"label": label, "value": f"{int(value)}h {round((value % 1) * 60):02d}m", "context": f"{sleep_source} · {completed.strftime('%d %b %Y')}", "tone": tone, "averages": {"weekly": comparison(value, weekly_values, "hr"), "monthly": comparison(value, monthly_values, "hr")}})
    categories["Sleep"] = sleep_metrics

    ordered = []
    override_meta = overrides.get(completed.isoformat(), {}).get("meta", {})
    overridden_categories = set(override_meta.get("categories", []))
    for name in ("Activity", "Sleep", "Heart", "Respiratory", "Mobility", "Nutrition"):
        source_note = "Apple Health + iPhone Mirroring" if name in overridden_categories else "Apple Health export"
        ordered.append({"name": name, "note": f"{source_note} · completed through {completed.strftime('%d %b %Y')}", "tone": CATEGORY_TONES[name], "metrics": categories.get(name, [])})

    has_partial = bool(db.execute("SELECT 1 FROM records WHERE day=? LIMIT 1", (today.isoformat(),)).fetchone())
    present_days = {row[0] for row in db.execute("SELECT DISTINCT day FROM records WHERE day BETWEEN ? AND ?", ((completed - timedelta(days=29)).isoformat(), completed.isoformat()))}
    missing = [(completed - timedelta(days=offset)).isoformat() for offset in range(7) if (completed - timedelta(days=offset)).isoformat() not in present_days]
    return {
        "schemaVersion": 1, "status": "live", "source": "Apple Health", "dataDate": completed.isoformat(),
        "completedThrough": completed.isoformat(), "partialToday": has_partial, "missingDates": missing,
        "capturedAt": datetime.now().astimezone().isoformat(), "exportDate": export_date,
        "message": f"Streaming import of {relevant:,} relevant Apple Health records. Complete through {completed.isoformat()}; {today.isoformat()} is {'partial' if has_partial else 'not present'}.{(' Final ' + completed.isoformat() + ' values were reconciled through iPhone Mirroring.') if override_meta else ''}",
        "coverage": coverage, "categories": ordered,
        "sources": [
            {"source": "Apple Health export", "status": "Verified", "detail": f"export.xml parsed incrementally; complete through {completed.isoformat()}", "tone": "green"},
            *([{"source": "iPhone Mirroring", "status": "Verified", "detail": override_meta.get("detail", f"Final completed-day values verified for {completed.isoformat()}"), "tone": "green"}] if override_meta else []),
            *([{"source": " Health Daily Note", "status": "Read", "detail": override_meta.get("noteDetail", f"Exact note contains a {completed.isoformat()} shortcut snapshot; direct Health values take precedence"), "tone": "amber"}] if override_meta else []),
        ],
        "actions": [
            {"tone": "green" if not missing else "amber", "title": "Completed-day coverage", "text": "The last seven completed days are present." if not missing else f"Missing source dates: {', '.join(missing)}."},
            {"tone": "amber", "title": "Current day remains partial", "text": "Today is separated from the completed-day baseline and is not used for optimisation."},
            {"tone": "blue", "title": "Trend interpretation", "text": "Use the direction-aware 7-day and 30-day comparisons; logged nutrition is not verified total intake."},
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", required=True, type=Path)
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--overrides", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    db = setup_database(args.db)
    export_date, relevant, imported = import_xml(args.xml, db, args.force)
    overrides = json.loads(args.overrides.read_text(encoding="utf-8")) if args.overrides and args.overrides.exists() else {}
    snapshot = build_snapshot(db, export_date, relevant, overrides)
    args.snapshot.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.snapshot.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(args.snapshot)
    print(json.dumps({"status": "ok", "imported": imported, "relevantRecords": relevant, "dataDate": snapshot["dataDate"], "partialToday": snapshot["partialToday"]}))


if __name__ == "__main__":
    main()
