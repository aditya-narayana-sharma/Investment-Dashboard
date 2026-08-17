from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "sector_quotes_yfinance",
    ROOT / "scripts" / "fetch-sector-quotes-yfinance.py",
)
assert SPEC and SPEC.loader
QUOTES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(QUOTES)


class YfinanceInstrumentSearchTests(unittest.TestCase):
    def test_nse_tickers_get_ns_suffix_once(self) -> None:
        self.assertEqual(QUOTES.yahoo_symbol("RELIANCE"), "RELIANCE.NS")
        self.assertEqual(QUOTES.yahoo_symbol("RELIANCE.NS"), "RELIANCE.NS")
        self.assertEqual(QUOTES.yahoo_symbol("INFY", "BSE"), "INFY.BO")
        self.assertEqual(QUOTES.yahoo_symbol(""), "")
        self.assertEqual(QUOTES.kite_tradingsymbol("RELIANCE.NS"), "RELIANCE")

    def test_empty_search_query_returns_no_instruments(self) -> None:
        self.assertEqual(QUOTES.search_instruments(""), [])
        self.assertEqual(QUOTES.search_instruments("   "), [])
        code, body, to_stderr = QUOTES.handle_payload({"mode": "search", "query": ""})
        self.assertEqual(code, 0)
        self.assertFalse(to_stderr)
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["instruments"], [])
