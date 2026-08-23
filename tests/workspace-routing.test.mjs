import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWorkspaceSectionParams,
  defaultSectionForWorkspace,
  isLocationView,
  parseWorkspaceSection,
  parseWorkspaceView,
  WORKSPACE_SECTIONS,
} from "../app/dashboard/workspace-routing.ts";

test("foreign leftover section never maps Intel to S-1", () => {
  assert.equal(parseWorkspaceView("intelligence"), "intelligence");
  assert.equal(parseWorkspaceView("market-intelligence"), "intelligence");
  assert.equal(parseWorkspaceSection("intelligence", "s1"), "m1");
  assert.equal(parseWorkspaceSection("intelligence", "i1"), "m1");
  assert.equal(parseWorkspaceSection("intelligence", "m4"), "m1");
  assert.equal(parseWorkspaceSection("intelligence", "m2"), "m2");
  assert.equal(parseWorkspaceSection("sectors", "m1"), "s1");
  assert.equal(parseWorkspaceSection("sectors", "s2"), "s2");
  assert.equal(defaultSectionForWorkspace("intelligence"), "m1");
  assert.equal(defaultSectionForWorkspace("builder"), "canvas");
  assert.equal(defaultSectionForWorkspace("strategies"), "y2");
});

test("switching workspace writes that workspace's own section, not a leftover chip", () => {
  const fromSectors = new URL("http://127.0.0.1:3000/?view=sectors&section=s1");
  assert.equal(applyWorkspaceSectionParams(fromSectors, "intelligence", null), "m1");
  assert.equal(fromSectors.searchParams.get("view"), "intelligence");
  assert.equal(fromSectors.searchParams.get("section"), "m1");

  const toSatya = new URL("http://127.0.0.1:3000/?view=intelligence&section=m1");
  assert.equal(applyWorkspaceSectionParams(toSatya, "intelligence", "m2"), "m2");
  assert.equal(toSatya.searchParams.get("section"), "m2");

  const toCanvas = new URL("http://127.0.0.1:3000/?view=intelligence&section=m1");
  assert.equal(applyWorkspaceSectionParams(toCanvas, "builder", "canvas"), "canvas");
  assert.equal(toCanvas.searchParams.get("section"), "canvas");

  const toLibrary = new URL("http://127.0.0.1:3000/?view=builder&section=board");
  assert.equal(applyWorkspaceSectionParams(toLibrary, "strategies", "y2"), "y2");
  assert.equal(toLibrary.searchParams.get("section"), "y2");

  const toH4 = new URL("http://127.0.0.1:3000/?view=health&section=h1");
  assert.equal(applyWorkspaceSectionParams(toH4, "health", "h4"), "h4");
  assert.equal(toH4.searchParams.get("section"), "h4");
});

test("every workspace exposes the full chip family", () => {
  assert.deepEqual(WORKSPACE_SECTIONS.investment.map((chip) => chip.label), ["Action Board", "Portfolio", "Risk", "Axis picks"]);
  assert.deepEqual(WORKSPACE_SECTIONS.sectors.map((chip) => chip.label), ["Action Board", "Industry Analytics", "Decision Framework"]);
  assert.deepEqual(WORKSPACE_SECTIONS.intelligence.map((chip) => chip.label), ["Action Board", "Satya", "Earnings Calendar"]);
  assert.deepEqual(WORKSPACE_SECTIONS.health.map((chip) => chip.label), ["Action Board", "Daily Optimism", "Vital Metrics", "Calendar + Reminders"]);
  assert.deepEqual(WORKSPACE_SECTIONS.builder.map((chip) => chip.label), ["Action Board", "Canvas", "JSON"]);
  assert.deepEqual(WORKSPACE_SECTIONS.strategies.map((chip) => chip.label), ["Action Board", "Library"]);
  assert.deepEqual(WORKSPACE_SECTIONS.investment.map((chip) => chip.prefix), ["I-1", "I-2", "I-3", "I-4"]);
  assert.deepEqual(WORKSPACE_SECTIONS.intelligence.map((chip) => chip.prefix), ["M-1", "M-2", "M-3"]);
});

test("isLocationView ignores sibling leftover section params", () => {
  assert.equal(isLocationView("intelligence", "?view=intelligence&section=s1"), true);
  assert.equal(isLocationView("sectors", "?view=intelligence&section=s1"), false);
  assert.equal(isLocationView("intelligence", new URLSearchParams("view=market-intelligence&section=s1")), true);
});
