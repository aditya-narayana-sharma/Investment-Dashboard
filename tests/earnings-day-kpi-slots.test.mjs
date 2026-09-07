import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { earningsCalendar } from "../app/portfolio-data.ts";

/** Mirror of EarningsMonthCalendar.dayKpiSlots for regression coverage. */
function dayKpiSlots(events) {
  const slotCount = 4;
  return Array.from({ length: slotCount }, (_, index) => {
    const labels = events
      .map((event) => event.kpis[index]?.label?.trim())
      .filter((label) => Boolean(label));
    const unique = [...new Set(labels)];
    return {
      index,
      header: unique.length ? unique.join(" / ") : "Not published",
    };
  });
}

test("22 Jul mixed Power + Consumer day names every KPI family without first-row assumptions", () => {
  const dayEvents = earningsCalendar.filter((event) => event.date === "22 Jul");
  assert.equal(dayEvents.length, 3);
  assert.deepEqual(
    dayEvents.map((event) => event.symbol),
    ["ADANIGREEN", "ADANIPOWER", "ETERNAL"],
  );

  const columns = dayKpiSlots(dayEvents);
  assert.deepEqual(
    columns.map((column) => column.header),
    [
      "Operational capacity / Reported revenue / Adj. revenue",
      "Energy sales / Reported EBITDA / Adj. EBITDA",
      "EBITDA (power supply) / PAT",
      "Cash profit / Power sales / B2C NOV",
    ],
  );

  for (const event of dayEvents) {
    assert.equal(event.reported, true);
    for (const column of columns) {
      const kpi = event.kpis[column.index];
      assert.ok(kpi?.value?.trim(), `${event.symbol} slot ${column.index} should have a filled value`);
    }
  }

  // Legacy label-match would blank Adani Power / Eternal under Adani Green headers.
  const legacyHeaders = dayEvents[0].kpis.map((kpi) => kpi.label);
  const adaniPowerLegacyHits = legacyHeaders.filter((label) =>
    dayEvents.find((event) => event.symbol === "ADANIPOWER")?.kpis.some((kpi) => kpi.label === label && kpi.value),
  );
  const eternalLegacyHits = legacyHeaders.filter((label) =>
    dayEvents.find((event) => event.symbol === "ETERNAL")?.kpis.some((kpi) => kpi.label === label && kpi.value),
  );
  assert.equal(adaniPowerLegacyHits.length, 0);
  assert.equal(eternalLegacyHits.length, 0);
});

test("13 Aug headers expose the actual company KPI names", () => {
  const dayEvents = earningsCalendar.filter((event) => event.date === "13 Aug");
  assert.deepEqual(dayEvents.map((event) => event.symbol), ["IRCTC", "JUBLFOOD", "TMPV"]);
  assert.deepEqual(
    dayKpiSlots(dayEvents).map((column) => column.header),
    [
      "Revenue / Group revenue",
      "Profit / Operating EBITDA / Group EBITDA",
      "Profit before tax / EBITDA margin",
      "Catering revenue / PAT / PBT before exceptional",
    ],
  );
});

test("earnings rows do not repeat KPI names already carried by headers", () => {
  const component = readFileSync(new URL("../app/dashboard/EarningsMonthCalendar.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /kpi-row-label/);
});
