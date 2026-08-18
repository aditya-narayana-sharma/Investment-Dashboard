from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import zipfile
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from health_date_policy import health_target_context  # noqa: E402
from import_apple_health import aggregate, build_snapshot, setup_database  # noqa: E402
from prepare_apple_health_export import MEMBER, prepare_archive  # noqa: E402


def insert_category_day(db: sqlite3.Connection, day: str, suffix: str = "") -> None:
    start = f"{day} 12:00:00 +0530"
    end = f"{day} 13:00:00 +0530"
    records = [
        (f"steps-{day}{suffix}", "StepCount", "Test", day, start, end, "count", 10_000.0, None),
        (f"sleep-{day}{suffix}", "SleepAnalysis", "Test", day, start, end, "", None, "HKCategoryValueSleepAnalysisAsleepCore"),
        (f"heart-{day}{suffix}", "HeartRate", "Test", day, start, end, "count/min", 72.0, None),
        (f"resp-{day}{suffix}", "RespiratoryRate", "Test", day, start, end, "count/min", 16.0, None),
        (f"walk-{day}{suffix}", "WalkingSpeed", "Test", day, start, end, "km/hr", 4.0, None),
        (f"food-{day}{suffix}", "DietaryEnergyConsumed", "Test", day, start, end, "kcal", 1_800.0, None),
    ]
    db.executemany("INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?)", records)
    db.commit()


def valid_health_xml(export_date: str) -> bytes:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<HealthData><ExportDate value="{export_date}"/></HealthData>'
    ).encode()


class HealthDatePolicyTests(unittest.TestCase):
    def test_overlapping_device_cumulative_metrics_use_source_priority(self):
        with tempfile.TemporaryDirectory() as directory:
            db = setup_database(Path(directory) / "health.sqlite3")
            day = "2026-08-14"
            rows = [
                ("watch-1", "StepCount", "Aditya’s Apple Watch", day, f"{day} 10:00:00 +0530", f"{day} 10:01:00 +0530", "count", 100.0, None),
                ("phone-1", "StepCount", "Aditya’s iPhone", day, f"{day} 10:00:05 +0530", f"{day} 10:01:05 +0530", "count", 120.0, None),
                ("phone-gap", "StepCount", "Aditya’s iPhone", day, f"{day} 10:02:00 +0530", f"{day} 10:03:00 +0530", "count", 40.0, None),
            ]
            db.executemany("INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?)", rows)
            db.commit()
            value = aggregate(db, "StepCount", day, "sum")
            db.close()

        # Watch wins the overlapping 10:00 bucket; the five-second iPhone tail
        # and the iPhone-only 10:02 bucket remain represented.
        self.assertAlmostEqual(value, 150.0)

    def test_historical_watch_name_and_single_source_sums_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            db = setup_database(Path(directory) / "health.sqlite3")
            day = "2026-08-14"
            rows = [
                ("watch-old", "FlightsClimbed", "Timepiece", day, f"{day} 09:00:00 +0530", f"{day} 09:01:00 +0530", "count", 2.0, None),
                ("phone", "FlightsClimbed", "Aditya’s iPhone", day, f"{day} 09:00:00 +0530", f"{day} 09:01:00 +0530", "count", 3.0, None),
                ("food-1", "DietaryEnergyConsumed", "Lifesum", day, f"{day} 12:00:00 +0530", f"{day} 12:01:00 +0530", "kcal", 600.0, None),
                ("food-2", "DietaryEnergyConsumed", "Lifesum", day, f"{day} 18:00:00 +0530", f"{day} 18:01:00 +0530", "kcal", 700.0, None),
            ]
            db.executemany("INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?)", rows)
            db.commit()
            flights = aggregate(db, "FlightsClimbed", day, "sum")
            food = aggregate(db, "DietaryEnergyConsumed", day, "sum")
            db.close()

        self.assertEqual(flights, 2.0)
        self.assertEqual(food, 1300.0)

    def test_boundary_policy(self):
        cases = [
            ("2026-07-26T19:59:00+05:30", "2026-07-25", "D_MINUS_1"),
            ("2026-07-26T20:00:00+05:30", "2026-07-26", "D_EVENING"),
            ("2026-07-26T23:59:00+05:30", "2026-07-26", "D_EVENING"),
            ("2026-07-27T00:00:00+05:30", "2026-07-26", "D_OVERNIGHT"),
            ("2026-07-27T01:59:00+05:30", "2026-07-26", "D_OVERNIGHT"),
            ("2026-07-27T02:00:00+05:30", "2026-07-26", "D_MINUS_1"),
            ("2026-07-27T21:00:00+05:30", "2026-07-27", "D_EVENING"),
        ]
        for instant, expected_date, expected_policy in cases:
            context = health_target_context(datetime.fromisoformat(instant))
            self.assertEqual(context.target_date.isoformat(), expected_date)
            self.assertEqual(context.policy, expected_policy)

    def test_midnight_export_is_eligible_only_through_previous_day(self):
        with tempfile.TemporaryDirectory() as directory:
            db = setup_database(Path(directory) / "health.sqlite3")
            insert_category_day(db, "2026-07-24")
            insert_category_day(db, "2026-07-25")
            snapshot = build_snapshot(
                db,
                "2026-07-25 00:45:33 +0530",
                12,
                archive_state={
                    "status": "cached_fallback",
                    "activeArchive": "Apple Health - 24th July.zip",
                    "rejectedArchive": "Apple Health - 25th July.zip",
                    "fallbackReason": "File is not a zip file",
                },
                now=datetime.fromisoformat("2026-07-26T13:00:00+05:30"),
            )
            db.close()

        self.assertEqual(snapshot["requiredThrough"], "2026-07-25")
        self.assertEqual(snapshot["eligibleThrough"], "2026-07-24")
        self.assertEqual(snapshot["dataDate"], "2026-07-24")
        self.assertEqual(snapshot["partialExportDay"], "2026-07-25")
        self.assertEqual(snapshot["status"], "stale")
        self.assertIn("2026-07-25", snapshot["missingDates"])
        iphone_source = next(source for source in snapshot["sources"] if source["source"] == "iPhone Mirroring")
        self.assertIn("operational target 2026-07-25", iphone_source["detail"])
        activity = next(category for category in snapshot["categories"] if category["name"] == "Activity")
        steps = next(metric for metric in activity["metrics"] if metric["label"] == "Steps")
        self.assertEqual(steps["context"], "Apple Health export · 24 Jul 2026")

    def test_evening_export_can_be_live_and_averages_end_on_target(self):
        with tempfile.TemporaryDirectory() as directory:
            db = setup_database(Path(directory) / "health.sqlite3")
            insert_category_day(db, "2026-07-24")
            db.execute("UPDATE records SET value=5000 WHERE record_key='steps-2026-07-24'")
            db.commit()
            insert_category_day(db, "2026-07-25")
            snapshot = build_snapshot(
                db,
                "2026-07-25 21:00:00 +0530",
                12,
                archive_state={"status": "verified_latest", "activeArchive": "health.zip"},
                now=datetime.fromisoformat("2026-07-25T21:30:00+05:30"),
            )
            db.close()

        self.assertEqual(snapshot["status"], "live")
        self.assertEqual(snapshot["targetPolicy"], "D_EVENING")
        self.assertEqual(snapshot["dataDate"], "2026-07-25")
        activity = next(category for category in snapshot["categories"] if category["name"] == "Activity")
        steps = next(metric for metric in activity["metrics"] if metric["label"] == "Steps")
        self.assertEqual(steps["averages"]["weekly"]["value"], "7,500")
        self.assertEqual(snapshot["coverage"]["Steps"]["status"], "available")
        self.assertEqual(
            steps["history"]["weekly"],
            [
                {"date": "2026-07-24", "value": 5000.0},
                {"date": "2026-07-25", "value": 10000.0},
            ],
        )
        self.assertEqual(
            steps["history"]["monthly"],
            [
                {"date": "2026-07-24", "value": 5000.0},
                {"date": "2026-07-25", "value": 10000.0},
            ],
        )
        self.assertEqual(
            snapshot["coverage"]["Steps"]["missingDates7"],
            ["2026-07-23", "2026-07-22", "2026-07-21", "2026-07-20", "2026-07-19"],
        )
        self.assertEqual(snapshot["coverage"]["Cardio fitness"]["status"], "missing_target")
        self.assertIn("2026-07-25", snapshot["coverage"]["Cardio fitness"]["missingDates7"])
        heart = next(category for category in snapshot["categories"] if category["name"] == "Heart")
        heart_rate = next(metric for metric in heart["metrics"] if metric["label"] == "Heart rate")
        self.assertFalse(heart_rate.get("history"))

    def test_history_omits_missing_days_without_interpolating(self):
        with tempfile.TemporaryDirectory() as directory:
            db = setup_database(Path(directory) / "health.sqlite3")
            insert_category_day(db, "2026-07-23")
            insert_category_day(db, "2026-07-25")
            snapshot = build_snapshot(
                db,
                "2026-07-25 21:00:00 +0530",
                12,
                archive_state={"status": "verified_latest", "activeArchive": "health.zip"},
                now=datetime.fromisoformat("2026-07-25T21:30:00+05:30"),
            )
            db.close()

        activity = next(category for category in snapshot["categories"] if category["name"] == "Activity")
        steps = next(metric for metric in activity["metrics"] if metric["label"] == "Steps")
        self.assertEqual(
            steps["history"]["weekly"],
            [
                {"date": "2026-07-23", "value": 10000.0},
                {"date": "2026-07-25", "value": 10000.0},
            ],
        )
        self.assertIn("2026-07-24", snapshot["coverage"]["Steps"]["missingDates7"])
        self.assertNotIn("2026-07-24", [point["date"] for point in steps["history"]["weekly"]])
        sleep = next(category for category in snapshot["categories"] if category["name"] == "Sleep")
        asleep = next(metric for metric in sleep["metrics"] if metric["label"] == "Time asleep")
        self.assertEqual([point["date"] for point in asleep["history"]["weekly"]], ["2026-07-23", "2026-07-25"])


class HealthArchivePreparationTests(unittest.TestCase):
    def test_metadata_timeout_is_an_os_error_and_preserves_existing_xml(self):
        import prepare_apple_health_export as archive_module

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive_path = root / "Apple Health Export.zip"
            export_xml = root / "apple_health_export" / "export.xml"
            prior_export = valid_health_xml("2026-07-24 21:00:00 +0530")
            export_xml.parent.mkdir(parents=True)
            export_xml.write_bytes(prior_export)
            archive_path.write_bytes(b"placeholder")

            original_zip_file = archive_module.zipfile.ZipFile

            def blocked_zip_file(*_args, **_kwargs):
                import time

                time.sleep(2)

            archive_module.zipfile.ZipFile = blocked_zip_file
            try:
                with self.assertRaises(OSError) as raised:
                    archive_module.prepare_archive(archive_path, export_xml, metadata_timeout_seconds=1)
            finally:
                archive_module.zipfile.ZipFile = original_zip_file

            retained = export_xml.read_bytes()

        self.assertIn("timed out", str(raised.exception).lower())
        self.assertEqual(retained, prior_export)

    def test_invalid_newest_archive_preserves_validated_extract_without_using_older_zip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            older = root / "Apple Health - 24th July.zip"
            newer = root / "Apple Health - 25th July.zip"
            export_xml = root / "apple_health_export" / "export.xml"
            state_path = root / "archive-state.json"
            prior_export = valid_health_xml("2026-07-24 21:00:00 +0530")
            export_xml.parent.mkdir(parents=True)
            export_xml.write_bytes(prior_export)
            with zipfile.ZipFile(older, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(MEMBER, valid_health_xml("2026-07-25 00:45:33 +0530"))
            newer.write_bytes(b"PK\x03\x04truncated-without-central-directory")
            os.utime(older, (1_000, 1_000))
            os.utime(newer, (2_000, 2_000))

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "prepare_apple_health_export.py"),
                    "--health-dir",
                    str(root),
                    "--export-xml",
                    str(export_xml),
                    "--state",
                    str(state_path),
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            state = json.loads(state_path.read_text())

            retained = export_xml.read_bytes()

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(state["status"], "invalid_latest")
        self.assertEqual(state["activeArchive"], "")
        self.assertEqual(Path(state["rejectedArchive"]).name, newer.name)
        self.assertIn("central directory", state["fallbackReason"].lower())
        self.assertEqual(retained, prior_export)

    def test_missing_member_crc_failure_and_malformed_xml_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            missing = root / "missing.zip"
            crc_failure = root / "crc-failure.zip"
            malformed = root / "malformed.zip"
            duplicate = root / "duplicate.zip"
            output = root / "apple_health_export" / "export.xml"
            with zipfile.ZipFile(missing, "w") as archive:
                archive.writestr("other.xml", b"<HealthData/>")
            with zipfile.ZipFile(crc_failure, "w", zipfile.ZIP_STORED) as archive:
                archive.writestr(MEMBER, valid_health_xml("2026-07-25 21:00:00 +0530"))
            corrupted = crc_failure.read_bytes().replace(b"<HealthData>", b"<HealthDatX>", 1)
            crc_failure.write_bytes(corrupted)
            with zipfile.ZipFile(malformed, "w") as archive:
                archive.writestr(MEMBER, b"<HealthData><ExportDate")
            with zipfile.ZipFile(duplicate, "w") as archive:
                archive.writestr(MEMBER, valid_health_xml("2026-07-25 21:00:00 +0530"))
                archive.writestr(MEMBER, valid_health_xml("2026-07-25 22:00:00 +0530"))

            with self.assertRaises(zipfile.BadZipFile):
                prepare_archive(missing, output)
            with self.assertRaises(zipfile.BadZipFile):
                prepare_archive(crc_failure, output)
            with self.assertRaises(zipfile.BadZipFile):
                prepare_archive(malformed, output)
            with self.assertRaises(zipfile.BadZipFile):
                prepare_archive(duplicate, output)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
