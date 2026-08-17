from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "sector_benchmark_fetcher",
    ROOT / "scripts" / "fetch-sector-benchmarks-yfinance.py",
)
assert SPEC and SPEC.loader
FETCHER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FETCHER)


class FakeResponse:
    status_code = 200

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return {
            "data": {
                "indexCloseOnlineRecords": [
                    {"EOD_TIMESTAMP": "07-AUG-2026", "EOD_CLOSE_INDEX_VAL": "12,345.60"},
                    {"EOD_TIMESTAMP": "06-AUG-2026", "EOD_CLOSE_INDEX_VAL": 12300},
                ]
            }
        }


class FakeSession:
    def get(self, *_args, **_kwargs):
        return FakeResponse()


class SectorBenchmarkFetcherTests(unittest.TestCase):
    def test_nse_history_parses_and_sorts_official_eod_rows(self) -> None:
        closes = FETCHER.nse_history(
            {"officialName": "NIFTY200 Alpha 30", "nseIndexName": "NIFTY200 ALPHA 30"},
            FakeSession(),
        )
        self.assertEqual(closes, [("2026-08-06", 12300.0), ("2026-08-07", 12345.6)])

    def test_two_closes_are_required_for_chart_ready_record(self) -> None:
        item = {"id": "nifty-alpha-50", "ticker": "NIFTYALPHA50.NS"}
        insufficient = FETCHER.build_record(
            item,
            [("2026-08-07", 56016.95)],
            "test",
            "https://example.test",
        )
        self.assertIn("Insufficient chart history", insufficient["error"])
        self.assertNotIn("level", insufficient)

        record = FETCHER.build_record(
            item,
            [("2026-08-06", 55000), ("2026-08-07", 56016.95)],
            "NSE official EOD index history",
            FETCHER.NSE_SOURCE_URL,
        )
        self.assertEqual(len(record["indexedHistory"]), 2)
        self.assertEqual(record["indexedHistory"][0]["value"], 100.0)
        self.assertGreater(record["indexedHistory"][1]["value"], 100.0)
        self.assertEqual(record["source"], "NSE official EOD index history")

    def test_close_all_csv_matches_factor_index_names(self) -> None:
        sample = """Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value
Nifty Alpha 50,14-08-2026,56487.25,56573.1,56170.6,56178.55
Nifty200 Alpha 30,14-08-2026,26821.75,26880.25,26715.25,26715.25
Nifty100 Low Volatility 30,14-08-2026,20553.95,20558.25,20486.95,20500.35
"""
        rows = FETCHER.parse_close_all_csv(sample)
        names = {name for name, _stamp, _value in rows}
        self.assertIn(FETCHER.normalize_index_name("NIFTY ALPHA 50"), names)
        self.assertIn(FETCHER.normalize_index_name("NIFTY200 ALPHA 30"), names)
        self.assertIn(FETCHER.normalize_index_name("NIFTY100 LOW VOLATILITY 30"), names)
        alpha = [row for row in rows if row[0] == "NIFTY ALPHA 50"][0]
        self.assertEqual(alpha[1], "2026-08-14")
        self.assertEqual(alpha[2], 56178.55)

        bom_rows = FETCHER.parse_close_all_csv("\ufeff" + sample)
        self.assertEqual(len(bom_rows), 3)

    def test_compact_index_names_resolve_factor_aliases(self) -> None:
        name_to_id = {}
        for item in (
            {"id": "nifty-alpha-50", "nseIndexName": "NIFTY ALPHA 50"},
            {"id": "nifty200-alpha-30", "nseIndexName": "NIFTY200 ALPHA 30"},
            {"id": "nifty100-low-vol-30", "nseIndexName": "NIFTY100 LOW VOLATILITY 30"},
        ):
            for key in FETCHER.index_name_keys(str(item["nseIndexName"])):
                name_to_id[key] = item["id"]
        self.assertEqual(FETCHER.resolve_index_id("Nifty Alpha 50", name_to_id), "nifty-alpha-50")
        self.assertEqual(FETCHER.resolve_index_id("NIFTY ALPHA50", name_to_id), "nifty-alpha-50")
        self.assertEqual(FETCHER.resolve_index_id("Nifty200Alpha30", name_to_id), "nifty200-alpha-30")
        self.assertEqual(FETCHER.resolve_index_id("Nifty100 Low Volatility 30", name_to_id), "nifty100-low-vol-30")

    def test_archive_backfill_starts_from_lookback_when_series_is_short(self) -> None:
        from datetime import date

        today = date(2026, 8, 17)
        lookback = date(2025, 8, 12)
        empty = FETCHER.archive_backfill_start({"nifty-alpha-50": []}, today)
        short = FETCHER.archive_backfill_start({"nifty-alpha-50": [("2026-08-14", 56178.55)]}, today)
        late_start = FETCHER.archive_backfill_start(
            {"nifty-alpha-50": [("2026-07-01", 55000.0), ("2026-08-14", 56178.55)]},
            today,
        )
        complete = FETCHER.archive_backfill_start(
            {"nifty-alpha-50": [("2025-08-12", 50000.0), ("2026-08-14", 56178.55)]},
            today,
        )
        self.assertEqual(empty, lookback)
        self.assertEqual(short, lookback)
        self.assertEqual(late_start, lookback)
        self.assertEqual(complete, date(2026, 8, 15))


if __name__ == "__main__":
    unittest.main()
