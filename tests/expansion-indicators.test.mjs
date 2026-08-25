import assert from "node:assert/strict";
import test from "node:test";
import {
  BOLLINGER_PERIOD,
  bollingerExpansion,
  bollingerSeries,
  meanComparison,
  smaSeries,
} from "../app/strategy/expansion-indicators.ts";

/** Build bars from a close series; OHLC collapse to close where unused. */
function barsFromCloses(closes, startDay = 1) {
  return closes.map((close, index) => ({
    date: `2026-01-${String(startDay + index).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));
}

test("smaSeries is null until the window fills, then exact", () => {
  const series = smaSeries([2, 4, 6, 8], 2);
  assert.deepEqual(series, [null, 3, 5, 7]);
  assert.deepEqual(smaSeries([1, 2, 3], 5), [null, null, null]);
  assert.deepEqual(smaSeries([1, 2, 3], 0), [null, null, null]);
});

test("a flat series has zero-width bands — the known-answer base case", () => {
  const bars = barsFromCloses(Array.from({ length: 25 }, () => 100));
  const series = bollingerSeries(bars);
  assert.equal(series.length, 25 - BOLLINGER_PERIOD + 1);
  for (const point of series) {
    assert.equal(point.mid, 100);
    assert.equal(point.width, 0, "zero variance must give zero spread");
  }
});

test("bollingerSeries matches a hand-computed 2-sigma spread", () => {
  // 20 closes alternating 90/110: mean 100, population sigma exactly 10.
  const closes = Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? 90 : 110));
  const [point] = bollingerSeries(barsFromCloses(closes));
  assert.equal(point.mid, 100);
  assert.equal(point.upper, 120, "mid + 2 sigma");
  assert.equal(point.lower, 80, "mid - 2 sigma");
  assert.equal(point.width, 40);
});

test("too few bars yields nulls and a stated reason, never a fabricated number", () => {
  const result = bollingerExpansion(barsFromCloses([1, 2, 3]));
  assert.equal(result.widthAtContraction, null);
  assert.equal(result.state, null);
  assert.match(result.reason, /needs at least 20 bars/);
  assert.deepEqual(bollingerSeries(barsFromCloses([1, 2, 3])), []);
});

test("contraction then expansion: minima, maxima, and the breakout delta", () => {
  // 40 quiet sessions (tight bands), then a widening run.
  const quiet = Array.from({ length: 40 }, (_, index) => 100 + (index % 2 === 0 ? -0.5 : 0.5));
  const widening = Array.from({ length: 20 }, (_, index) => 100 + (index % 2 === 0 ? -1 : 1) * (index + 2));
  const bars = barsFromCloses([...quiet, ...widening]);

  const result = bollingerExpansion(bars);

  assert.ok(result.widthAtContraction > 0);
  assert.ok(result.currentWidth > result.widthAtContraction, "bands must be wider than at the squeeze");
  assert.equal(result.expansionDelta, result.currentWidth - result.widthAtContraction);
  assert.ok(Math.abs(result.expansionPct - (result.expansionDelta / result.widthAtContraction) * 100) < 1e-9);
  assert.equal(result.state, "expanding");
  assert.ok(result.contractionDate, "the contraction session must be identified");

  // The upper-band minimum and lower-band maximum are the squeeze extremes.
  assert.ok(result.upperMin3m <= result.lowerMax3m + result.widthAtContraction + 1e-9);
  assert.ok(result.lowerMax3m >= result.upperMin3m - result.widthAtContraction - 1e-9);
});

test("a still-quiet series reports squeeze, not expansion", () => {
  const bars = barsFromCloses(Array.from({ length: 60 }, (_, index) => 100 + (index % 2 === 0 ? -0.5 : 0.5)));
  const result = bollingerExpansion(bars);
  assert.equal(result.state, "squeeze");
  assert.equal(result.breakoutDirection, null, "a squeeze has no breakout direction");
});

test("narrowing bands report contracting", () => {
  const wide = Array.from({ length: 30 }, (_, index) => 100 + (index % 2 === 0 ? -12 : 12));
  const calm = Array.from({ length: 30 }, (_, index) => 100 + (index % 2 === 0 ? -0.4 : 0.4));
  const result = bollingerExpansion(barsFromCloses([...wide, ...calm]));
  assert.ok(result.state === "contracting" || result.state === "squeeze", `unexpected ${result.state}`);
});

test("a perfectly flat series cannot produce an infinite expansion percentage", () => {
  const bars = barsFromCloses(Array.from({ length: 60 }, () => 100));
  const result = bollingerExpansion(bars);
  assert.equal(result.widthAtContraction, 0);
  assert.equal(result.expansionPct, null, "division by a zero contraction width must be null, not Infinity");
});

test("mean comparison needs 220 sessions and says so when short", () => {
  const result = meanComparison(barsFromCloses(Array.from({ length: 100 }, () => 100)));
  assert.equal(result.state, null);
  assert.equal(result.fast, null);
  assert.match(result.reason, /needs 220 sessions; have 100/);
});

test("a sustained uptrend puts SMA-20 above SMA-220 and reports the gap", () => {
  const closes = Array.from({ length: 300 }, (_, index) => 100 + index);
  const result = meanComparison(barsFromCloses(closes));
  assert.equal(result.state, "bullish");
  assert.ok(result.fast > result.slow);
  assert.ok(result.gapPct > 0);
  assert.ok(Math.abs(result.gapPct - ((result.fast - result.slow) / result.slow) * 100) < 1e-9);
});

test("a sustained downtrend is bearish", () => {
  const closes = Array.from({ length: 300 }, (_, index) => 500 - index);
  const result = meanComparison(barsFromCloses(closes));
  assert.equal(result.state, "bearish");
  assert.ok(result.fast < result.slow);
  assert.ok(result.gapPct < 0);
  assert.equal(result.freshBullishCross, false);
});

test("a flip is detected and dated, and a fresh bullish cross is flagged once", () => {
  // Long decline, then a rally sharp enough to pull SMA-20 back above SMA-220.
  const decline = Array.from({ length: 260 }, (_, index) => 500 - index);
  let closes = [...decline];
  const rally = [];
  for (let step = 1; step <= 120; step += 1) rally.push(240 + step * 6);
  closes = [...closes, ...rally];

  const bars = barsFromCloses(closes);
  const result = meanComparison(bars);
  assert.equal(result.state, "bullish");
  assert.ok(result.daysSinceFlip !== null && result.daysSinceFlip > 0, "the flip must be dated");

  // `daysSinceFlip` counts back from the last bar to the final old-state bar, so
  // `flipIndex` is the first bar carrying the new state. Ending the series there
  // makes that flip session the latest bar, which is the BUY-candidate day.
  const flipIndex = bars.length - result.daysSinceFlip;
  const atFlip = meanComparison(bars.slice(0, flipIndex + 1));
  assert.equal(atFlip.state, "bullish");
  assert.equal(atFlip.daysSinceFlip, 1);
  assert.equal(atFlip.freshBullishCross, true, "the session after the flip is the BUY candidate");

  // And it must not keep firing afterwards.
  assert.equal(result.freshBullishCross, result.daysSinceFlip === 1);
});

test("a never-flipped series reports no flip date rather than zero", () => {
  const result = meanComparison(barsFromCloses(Array.from({ length: 300 }, (_, index) => 100 + index)));
  assert.equal(result.daysSinceFlip, null);
  assert.equal(result.freshBullishCross, false);
});
