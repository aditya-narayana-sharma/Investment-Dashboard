import assert from "node:assert/strict";
import test from "node:test";
import { securityClassifications } from "../app/portfolio-data.ts";

const gainShades = ["#0f704f", "#178c61", "#23a472", "#39b785", "#63c99e", "#4db88a", "#2d9b6c"];
const LOSS_FILL = "#c33f47";
function holdingOuterFill(pnl, index) {
  if (pnl < 0) return LOSS_FILL;
  return gainShades[index % gainShades.length] ?? gainShades[0];
}

test("outer donut fill never returns undefined for high indices", () => {
  for (let index = 0; index < 20; index += 1) {
    const fill = holdingOuterFill(12.5, index);
    assert.equal(typeof fill, "string");
    assert.match(fill, /^#/);
    assert.equal(fill, gainShades[index % gainShades.length]);
  }
  assert.equal(holdingOuterFill(-1, 0), LOSS_FILL);
  assert.equal(holdingOuterFill(-1, 9), LOSS_FILL);
});

test("LTF and JSWENERGY have verified industry classifications", () => {
  assert.equal(securityClassifications.LTF.sector, "Non Banking Financial Company");
  assert.equal(securityClassifications.LTF.subSector, "Diversified Retail NBFC");
  assert.equal(securityClassifications.LTF.marketCap, "Mid cap");
  assert.equal(securityClassifications.JSWENERGY.sector, "Power Generation");
  assert.equal(securityClassifications.JSWENERGY.subSector, "Integrated Power & Storage");
  assert.equal(securityClassifications.JSWENERGY.marketCap, "Mid cap");
});
