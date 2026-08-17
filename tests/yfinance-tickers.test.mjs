import assert from "node:assert/strict";
import test from "node:test";
import { fromYahooTicker, toYahooTicker } from "../app/strategy/yfinance-tickers.ts";
import { readFile } from "node:fs/promises";

test("Kite tradingsymbols map to Yahoo NSE .NS without double-suffixing", () => {
  assert.equal(toYahooTicker("RELIANCE"), "RELIANCE.NS");
  assert.equal(toYahooTicker("  infy  "), "INFY.NS");
  assert.equal(toYahooTicker("RELIANCE.NS"), "RELIANCE.NS");
  assert.equal(toYahooTicker("BAJAJ-AUTO"), "BAJAJ-AUTO.NS");
  assert.equal(toYahooTicker("INFY", "BSE"), "INFY.BO");
  assert.equal(toYahooTicker("MAXHEALTHCARE"), "MAXHEALTH.NS");
  assert.equal(toYahooTicker(""), "");
  assert.equal(toYahooTicker("   "), "");
  assert.equal(fromYahooTicker("RELIANCE.NS"), "RELIANCE");
  assert.equal(fromYahooTicker("INFY.BO"), "INFY");
  assert.equal(fromYahooTicker("AAPL"), "AAPL");
  assert.equal(fromYahooTicker(""), "");
});

test("empty yfinance search query returns no instruments without calling Yahoo", async () => {
  const source = await readFile(new URL("../app/strategy/yfinance-search.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!normalized\) \{\s*return \{ status: "ok", query: "", message: "", instruments: \[\] \};/s);
  const route = await readFile(new URL("../app/api/quotes/yfinance/search/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!query && !symbols\.length\)/);
  assert.match(route, /instruments: \[\]/);
});
