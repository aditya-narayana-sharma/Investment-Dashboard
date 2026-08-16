import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BUILDER_UNIVERSE_SOURCE,
  BUILDER_UNIVERSE_SOURCE_URL,
  bundledNifty500Cache,
  builderUniverse,
  isBeesSymbol,
  nifty500Equities,
  nifty500Name,
  officialNseIndices,
} from "../app/strategy/builder-universe.ts";
import { COMPOSER_STRATEGIES } from "../app/strategy/composer-strategies.ts";
import { createSeedTree } from "../app/strategy/seed-tree.ts";
import { collectTreeSymbols } from "../app/strategy/tree-instruments.ts";

test("Nifty 500 cache is a labeled NSE fetch, not an invented list", async () => {
  const cache = bundledNifty500Cache();
  const raw = JSON.parse(await readFile(new URL("../app/strategy/builder-universe.cache.json", import.meta.url), "utf8"));
  assert.equal(cache.source, BUILDER_UNIVERSE_SOURCE);
  assert.equal(cache.sourceUrl, BUILDER_UNIVERSE_SOURCE_URL);
  assert.equal(cache.market, "NSE");
  assert.equal(cache.index, "NIFTY 500");
  assert.equal(cache.count, 500);
  assert.equal(cache.equities.length, 500);
  assert.match(cache.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(raw.count, 500);
  assert.equal(nifty500Name("RELIANCE"), "Reliance Industries Ltd.");
  assert.equal(nifty500Name("TCS"), "Tata Consultancy Services Ltd.");
  assert.equal(nifty500Name("HDFCBANK"), "HDFC Bank Ltd.");
  assert.ok(nifty500Equities().every((item) => item.group === "equity" && !isBeesSymbol(item.symbol)));
});

test("builder universe groups official NSE indices and excludes BeES", () => {
  const indices = officialNseIndices();
  const universe = builderUniverse();
  assert.ok(indices.some((item) => item.symbol === "NIFTY 50" && item.group === "broad"));
  assert.ok(indices.some((item) => item.symbol === "NIFTY 500" && item.group === "broad"));
  assert.ok(indices.some((item) => item.symbol === "NIFTY NEXT 50" && item.group === "broad"));
  assert.ok(indices.some((item) => item.symbol === "NIFTY Bank" && item.group === "industry"));
  assert.ok(indices.some((item) => item.symbol === "NIFTY Alpha 50" && item.group === "strategy"));
  assert.ok(indices.some((item) => item.group === "thematic"));
  assert.ok(universe.length >= 500);
  assert.ok(!universe.some((item) => isBeesSymbol(item.symbol)));
  assert.ok(!universe.some((item) => /BEES/i.test(item.symbol)));
});

test("composer library source and trees contain no BeES symbols", async () => {
  const source = await readFile(new URL("../app/strategy/composer-strategies.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /BEES/i);
  for (const card of COMPOSER_STRATEGIES) {
    assert.doesNotMatch(JSON.stringify(card), /BEES/i);
    assert.match(JSON.stringify(card.tree), /RELIANCE|TCS|HDFCBANK|ITC/);
  }
});

test("seed tree uses Nifty 500 equities and no BeES symbols", () => {
  const tree = createSeedTree(new Date("2026-08-16T00:00:00+05:30"));
  const symbols = collectTreeSymbols(tree);
  assert.deepEqual(symbols.sort(), ["BHARTIARTL", "HDFCBANK", "ICICIBANK", "INFY", "ITC", "RELIANCE", "TCS"]);
  for (const symbol of symbols) {
    assert.ok(nifty500Name(symbol), `${symbol} must come from the NSE Nifty 500 cache`);
    assert.equal(isBeesSymbol(symbol), false);
  }
  assert.doesNotMatch(JSON.stringify(tree), /BEES|GOLDBEES|NIFTYBEES|LIQUIDBEES/);
});
