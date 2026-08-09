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


if __name__ == "__main__":
    unittest.main()
