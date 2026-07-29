import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fiiDiiFlowsSnapshot,
  fiveDayDiiNetCr,
  fiveDayFiiNetCr,
  flowCompositionSlices,
  formatFlowDeltaCr,
} from "../app/fii-dii-flows.ts";

describe("fii-dii-flows snapshot", () => {
  it("computes five-session FII/DII nets from cited cash prints", () => {
    const fii = fiveDayFiiNetCr(fiiDiiFlowsSnapshot);
    const dii = fiveDayDiiNetCr(fiiDiiFlowsSnapshot);
    assert.equal(Number(fii.toFixed(2)), -7182.08);
    assert.equal(Number(dii.toFixed(2)), 8637.58);
    assert.equal(formatFlowDeltaCr(fii), "−₹7,182cr");
  });

  it("builds absolute composition slices for the latest session", () => {
    const slices = flowCompositionSlices(fiiDiiFlowsSnapshot);
    assert.equal(slices.length, 2);
    assert.equal(slices[0].name, "FII");
    assert.equal(slices[1].name, "DII");
    assert.equal(slices[0].signedNetCr, -3892.77);
    assert.equal(slices[1].signedNetCr, 5453.55);
    assert.equal(slices[0].value, 3892.77);
    assert.equal(slices[1].value, 5453.55);
  });

  it("cites NSE as primary and third-party cross-checks", () => {
    assert.equal(fiiDiiFlowsSnapshot.primarySourceUrl, "https://www.nseindia.com/reports/fii-dii");
    assert.ok(fiiDiiFlowsSnapshot.evidence.some((item) => item.kind === "primary" && item.source.includes("NSE")));
    assert.ok(fiiDiiFlowsSnapshot.evidence.some((item) => item.url.includes("cnbctv18.com")));
    assert.ok(fiiDiiFlowsSnapshot.evidence.some((item) => item.url.includes("moneycontrol.com")));
  });
});
