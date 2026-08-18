import assert from "node:assert/strict";
import test from "node:test";
import {
  INVESTMENT_SOURCE_CANDIDATES,
  VISUAL_CSS_CANDIDATES,
  readJoined,
} from "./helpers/algorithm-canvas.mjs";

const workspace = await readJoined(INVESTMENT_SOURCE_CANDIDATES);
const visualCss = await readJoined(VISUAL_CSS_CANDIDATES);

test("macro evidence summaries stay source-derived and follow the selected event", () => {
  assert.match(workspace, /function buildMacroEvidenceSummaries/);
  assert.match(workspace, /const evidenceSummaries = buildMacroEvidenceSummaries\(selectedEvidenceItems, eventKey, bandKey\)/);
  assert.match(workspace, /const selectedEvidenceItems = assembleScenarioEvidence\(candidateItems, eventKey, bandKey, event\)/);
  assert.match(workspace, /eventKey === "flows"[\s\S]*fiiDiiFlowsSnapshot\.evidence[\s\S]*content\.axisResearch[\s\S]*content\.newsletters/);
  assert.match(workspace, /<AiEvidenceSummaries summaries=\{evidenceSummaries\}\/\>/);
  assert.match(workspace, /AI-generated evidence summaries/);
  assert.match(workspace, /Source-derived · outcome classified/);
  assert.match(workspace, /scenarioEvidenceSentence\(item, eventKey, bandKey\)/);
});

test("macro evidence summaries use semantic bullets with accessible outcome labels", () => {
  assert.match(workspace, /<ul>\{summaries\.map/);
  assert.match(workspace, /<li key=\{`\$\{summary\.source\}-\$\{summary\.text\}`\}/);
  assert.match(workspace, /aria-label=\{`\$\{summary\.outcome\} outcome`\}/);
  assert.match(workspace, /item\.sentiment === "Positive"/);
  assert.match(workspace, /item\.sentiment === "Negative"/);
  assert.match(workspace, /item\.sentiment === "Neutral"/);
});

test("positive, negative, and neutral boxes use exact 30 percent fills", () => {
  assert.match(visualCss, /li\.outcome-positive\s*\{[\s\S]*?background:\s*rgba\(34, 197, 94, 0\.30\)/);
  assert.match(visualCss, /li\.outcome-negative\s*\{[\s\S]*?background:\s*rgba\(239, 68, 68, 0\.30\)/);
  assert.match(visualCss, /li\.outcome-neutral\s*\{[\s\S]*?background:\s*rgba\(217, 160, 28, 0\.30\)/);
});
