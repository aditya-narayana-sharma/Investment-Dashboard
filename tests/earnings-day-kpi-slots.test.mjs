import assert from "node:assert/strict";
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
    const homogeneous = unique.length === 1;
    return {
      index,
      header: homogeneous ? unique[0] : `KPI ${index + 1}`,
      showPerRowLabel: !homogeneous,
    };
  });
}

test("22 Jul mixed Power + Consumer day uses positional KPIs, not first-row labels", () => {
  const dayEvents = earningsCalendar.filter((event) => event.date === "22 Jul");
  assert.equal(dayEvents.length, 3);
  assert.deepEqual(
    dayEvents.map((event) => event.symbol),
    ["ADANIGREEN", "ADANIPOWER", "ETERNAL"],
  );

  const columns = dayKpiSlots(dayEvents);
  assert.equal(columns.every((column) => column.showPerRowLabel), true);
  assert.deepEqual(
    columns.map((column) => column.header),
    ["KPI 1", "KPI 2", "KPI 3", "KPI 4"],
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
