import assert from "node:assert/strict";
import test from "node:test";
import { sectorCompanies } from "../app/sector-company-data.ts";
import { sectors } from "../app/sector-data.ts";
import {
  buildInvestabilityFactors,
  factorMedian,
  investabilityComposite,
} from "../app/sector-investability.ts";

function marketFor(sectorId) {
  return {
    status: "live",
    sectorId,
    asOf: "test",
    message: "fixture",
    companies: (sectorCompanies[sectorId] ?? []).map((company, index) => ({
      symbol: company.symbol,
      price: 100,
      previousClose: 99,
      returns: {
        day: 1,
        week: index % 2 ? -1 : 2,
        month: index % 3 ? 4 : -2,
        quarter: 5,
      },
    })),
  };
}

test("every configured industry maps all six investability factors", () => {
  const allFactors = sectors.map((sector) => buildInvestabilityFactors(
    sector,
    sectorCompanies[sector.id] ?? [],
    marketFor(sector.id),
  ));

  for (const [index, factors] of allFactors.entries()) {
    assert.equal(factors.length, 6, sectors[index].name);
    assert.deepEqual(
      factors.map((factor) => factor.id),
      ["growth", "earnings", "valuation", "macro", "momentum", "balance"],
    );
    assert.ok(factors.every((factor) => factor.score !== null));
    assert.ok(factors.every((factor) => factor.score >= 1 && factor.score <= 5));
    assert.ok(factors.every((factor) => factor.basis.length > 12));
    assert.ok(investabilityComposite(factors) >= 1);
  }

  for (const factor of allFactors[0]) {
    assert.notEqual(factorMedian(allFactors, factor.id), null);
  }
});

test("missing market history is explicit and does not corrupt other factors", () => {
  const sector = sectors[0];
  const factors = buildInvestabilityFactors(
    sector,
    sectorCompanies[sector.id] ?? [],
    undefined,
  );

  assert.equal(factors.find((factor) => factor.id === "momentum")?.score, null);
  assert.match(
    factors.find((factor) => factor.id === "momentum")?.basis ?? "",
    /Unavailable/,
  );
  assert.ok(factors.filter((factor) => factor.id !== "momentum").every((factor) => factor.score !== null));
  assert.ok(Number.isFinite(investabilityComposite(factors)));
});
