import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sectorCompanies, sectorUniverseLabels } from "../app/sector-company-data.ts";
import { alignSectorImpactRows, lifeCyclePoints, marketStructurePoints, sectorImpactExtras } from "../app/sector-analytics-data.ts";
import { sectorCatalogIds, sectors } from "../app/sector-data.ts";

const catalogIds = sectors.map((sector) => sector.id);
const catalogNames = Object.fromEntries(sectors.map((sector) => [sector.id, sector.name]));

test("S-2 Industry Selection, S-2A impact matrix, and S-3 share one industry catalog", async () => {
  assert.deepEqual(catalogIds, sectorCatalogIds);
  assert.ok(catalogIds.includes("it"));
  assert.equal(catalogNames.it, "IT / Tech");
  assert.ok(catalogIds.includes("metals"));
  assert.equal(catalogNames.metals, "Metals");
  assert.ok(catalogIds.includes("nbfc"));
  assert.equal(catalogNames.nbfc, "NBFC");

  const impactRows = alignSectorImpactRows(sectors);
  assert.deepEqual(
    impactRows.map((row) => row.id),
    catalogIds,
    "S-2A impact-matrix ids must equal Industry Selection ids, in the same order",
  );
  assert.deepEqual(
    impactRows.map((row) => row.name),
    sectors.map((sector) => sector.name),
    "S-2A impact-matrix labels must equal Industry Selection labels",
  );
  assert.deepEqual(
    Object.keys(sectorImpactExtras).sort(),
    catalogIds.slice().sort(),
    "Impact extras must cover the catalog and must not introduce extra ids",
  );

  const utils = await readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8");
  const newsServer = await readFile(new URL("../app/sector-news-server.ts", import.meta.url), "utf8");
  for (const id of catalogIds) {
    assert.ok((sectorCompanies[id] ?? []).length > 0, `${id} missing company universe`);
    assert.ok(sectorUniverseLabels[id], `${id} missing universe label`);
    assert.match(utils, new RegExp(`^\\s+${id}: \\[`, "m"), `${id} missing search terms`);
    assert.match(newsServer, new RegExp(`\\["${id}",`), `${id} missing news matcher`);
    assert.ok(lifeCyclePoints.some((point) => point.id === id), `${id} missing life-cycle anchor`);
    assert.ok(marketStructurePoints.some((point) => point.id === id), `${id} missing market-structure anchor`);
  }
});

test("S-2 selector, S-2A matrix, and S-3 local options consume sectors, not a shorter list", async () => {
  const [analytics, decisionLab, workspace, intelligence] = await Promise.all([
    readFile(new URL("../app/dashboard/SectoralAnalytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorDecisionLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntelligenceWorkspace.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(analytics, /sectors\.map\(\(sector\) => \{/);
  assert.match(analytics, /aria-label="Filter every Sectoral Analytics section by industry"/);
  assert.match(analytics, /alignSectorImpactRows\(sectors\)/);
  assert.doesNotMatch(analytics, /reference-only|aria-disabled=\{!selectable\}/);
  assert.match(decisionLab, /\{sectors\.map\(\(item\) => <button type="button" role="tab"/);
  assert.match(decisionLab, /const \[sectorId, setSectorId\] = useState\("pharma"\)/);
  assert.doesNotMatch(decisionLab, /selectedSectorIds|selectedIds/);
  const s3Render = workspace.split("\n").find((line) => line.includes("<SectorDecisionLab"));
  assert.ok(s3Render);
  assert.doesNotMatch(s3Render, /selectedSector/);
  assert.doesNotMatch(intelligence, /sector-intelligence-filter/);
  assert.doesNotMatch(intelligence, /sector-dimmed/);
  assert.doesNotMatch(intelligence, /selectedSectorId/);
});

test("native S-2 catalog matches the web industry ids and labels", async () => {
  const native = await readFile(new URL("../apple-app/InvestmentDashboard/NativeDashboardModels.swift", import.meta.url), "utf8");
  const block = native.match(/static let all: \[\(id: String, title: String\)\] = \[([\s\S]*?)\]/)?.[1] ?? "";
  const nativeEntries = [...block.matchAll(/\("([^"]+)", "([^"]+)"\)/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(
    nativeEntries,
    sectors.map((sector) => [sector.id, sector.name]),
  );
});
