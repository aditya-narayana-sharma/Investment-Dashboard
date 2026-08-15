import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { portfolioRiskProfiles, riskAxes } from "../app/portfolio-data.ts";
import { buildRiskExplanation, riskScoreBand } from "../app/risk-explanations.ts";

const workspacePath = new URL("../app/dashboard/InvestmentWorkspace.tsx", import.meta.url);
const cssPath = new URL("../app/globals.css", import.meta.url);
const visualCssPath = new URL("../app/visual-overhaul.css", import.meta.url);

test("selected-company explanations switch without including unselected companies", () => {
  const icici = buildRiskExplanation(portfolioRiskProfiles.find((profile) => profile.symbol === "ICICIBANK"), riskAxes);
  const eternal = buildRiskExplanation(portfolioRiskProfiles.find((profile) => profile.symbol === "ETERNAL"), riskAxes);
  const iciciText = JSON.stringify(icici);
  const eternalText = JSON.stringify(eternal);

  assert.match(iciciText, /ICICI Bank \(ICICIBANK\)/);
  assert.doesNotMatch(iciciText, /Eternal|ETERNAL/);
  assert.match(eternalText, /Eternal \(ETERNAL\)/);
  assert.doesNotMatch(eternalText, /ICICI Bank|ICICIBANK/);
  assert.notDeepEqual(icici.overview, eternal.overview);
  assert.notDeepEqual(icici.axes.map((item) => item.score), eternal.axes.map((item) => item.score));
});

test("every displayed axis is explained from its real score and band", () => {
  const profile = portfolioRiskProfiles.find((item) => item.symbol === "ICICIBANK");
  const explanation = buildRiskExplanation(profile, riskAxes);

  assert.deepEqual(explanation.axes.map((item) => item.axis), [...riskAxes]);
  assert.deepEqual(explanation.axes.map((item) => item.score), [...profile.scores]);
  explanation.axes.forEach((item, index) => {
    assert.match(item.text, new RegExp(`^${riskAxes[index]} — ${profile.scores[index]}/5, ${riskScoreBand(profile.scores[index])}:`));
    assert.ok(item.text.length > 35);
  });
  assert.equal(riskScoreBand(1), "lower");
  assert.equal(riskScoreBand(2), "lower");
  assert.equal(riskScoreBand(3), "moderate");
  assert.equal(riskScoreBand(4), "elevated");
  assert.equal(riskScoreBand(5), "elevated");
});

test("highest and lowest ties retain displayed axis order", () => {
  const explanation = buildRiskExplanation({
    symbol: "TIE",
    name: "Tie Example",
    scores: [5, 5, 1, 1, 3, 3],
  }, riskAxes);

  assert.match(explanation.overview[0], /Valuation and Sector: 5\/5 \(elevated\)/);
  assert.match(explanation.overview[1], /Liquidity and Volatility: 1\/5 \(lower\)/);

  const allTied = buildRiskExplanation({
    symbol: "ALLTIE",
    name: "All Tie",
    scores: [3, 3, 3, 3, 3, 3],
  }, riskAxes);
  assert.equal(allTied.overview.length, 1);
  assert.match(allTied.overview[0], /tied at 3\/5 \(moderate\)/);
});

test("generated bullets avoid probability and investment-advice claims", () => {
  for (const profile of portfolioRiskProfiles) {
    const explanation = buildRiskExplanation(profile, riskAxes);
    const bullets = [...explanation.overview, ...explanation.axes.map((item) => item.text)].join(" ");
    assert.doesNotMatch(bullets, /\bprobab(?:ility|le)\b|\brecommend(?:ation|ed)?\b|\b(?:buy|sell)\b|\badvice\b/i);
  }
});

test("risk panel uses selected tab semantics and remains content-sized", async () => {
  const [workspace, css, visualCss] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(cssPath, "utf8"),
    readFile(visualCssPath, "utf8"),
  ]);

  assert.match(workspace, /buildRiskExplanation\(profile, riskAxes\)/);
  assert.match(workspace, /role="tablist"[\s\S]*role="tab"[\s\S]*aria-selected=\{item\.symbol === profile\.symbol\}/);
  assert.match(workspace, /onClick=\{\(\) => onSelect\(item\.symbol\)\}/);
  assert.match(workspace, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(workspace, /aria-live="polite"/);
  assert.match(workspace, /<h5>Overview<\/h5>[\s\S]*<h5>Axis explanations<\/h5>/);
  assert.match(workspace, /idPrefix="portfolio-holdings-risk" explainSelected/);
  assert.match(workspace, /<h5>Evidence<\/h5>/);
  assert.match(workspace, /Kite \{evidenceContext\.asOf\}/);
  assert.match(workspace, /evidenceContext=\{\{ holdings, asOf: snapshot\.asOf, classification \}\}/);
  assert.match(workspace, /const chartHeight = explainSelected \? 480 : 620/);
  assert.match(workspace, /riskScoreColor|riskScoreBand/);
  assert.match(workspace, /renderScoreDot|renderAxisTick/);
  assert.match(workspace, /axis-risk-stack/);
  assert.match(workspace, /seriesColor/);
  assert.match(visualCss, /\.risk-panel\.threat-flower:not\(\.holdings-stack\) \.axis-risk-stack/);
  assert.match(visualCss, /\.risk-panel\.threat-flower:not\(\.holdings-stack\) \.risk-chart \{[^}]*min-height:\s*620px/s);
  assert.match(visualCss, /\.risk-panel\.threat-flower:not\(\.holdings-stack\) \.risk-selector button \{[^}]*min-width:\s*78px/s);
  assert.match(workspace, /risk-series-key/);
  assert.match(workspace, /holdings-risk-stack/);
  assert.match(workspace, /risk-selector-names/);
  assert.match(workspace, /selectorLabel|item\.name \|\| item\.symbol/);
  assert.doesNotMatch(workspace, /Selected vs portfolio average/);
  assert.doesNotMatch(workspace, /risk-comparison/);
  assert.match(workspace, /!explainSelected && <Legend/);
  assert.match(workspace, /not a probability of loss or investment recommendation/);

  const riskPanelRule = css.match(/^\.risk-panel\s*\{[^}]*\}/m)?.[0] ?? "";
  const riskGridRule = css.match(/\.investment-risk-grid\s*\{[^}]*\}/)?.[0] ?? "";
  const explanationRules = css.slice(css.indexOf(".risk-explanation"), css.indexOf(".sector-overview"));
  assert.match(riskPanelRule, /align-self:start/);
  assert.match(riskGridRule, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(riskGridRule, /align-items:stretch/);
  assert.match(css, /\.investment-risk-grid>\.exposure-composition-panel\s*\{[^}]*display:flex;[^}]*align-self:stretch;[^}]*flex-direction:column;/s);
  assert.match(css, /\.investment-risk-grid>\.exposure-composition-panel \.exposure-driver-map\s*\{[^}]*display:grid;[^}]*flex:1 1 auto;[^}]*grid-template-rows:auto repeat\(7,minmax\(0,1fr\)\);/s);
  assert.doesNotMatch(riskPanelRule, /(?:min-)?height\s*:/);
  assert.doesNotMatch(explanationRules, /(?:^|[;{]\s*)(?:min-)?height\s*:|100vh|100dvh/);
  assert.match(visualCss, /\.risk-panel\.threat-flower\.holdings-stack \.risk-radar-layout\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(visualCss, /\.risk-panel\.threat-flower\.holdings-stack \.holdings-risk-stack/);
  assert.match(visualCss, /\.risk-panel\.threat-flower\.holdings-stack \.risk-selector(?:-names)?\s*,?[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(visualCss, /\.risk-panel\.threat-flower\.holdings-stack \.risk-explanation\s*\{[^}]*display:\s*flex;/);
  assert.match(visualCss, /\.risk-panel\.threat-flower\.holdings-stack\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  assert.doesNotMatch(visualCss, /\.risk-panel\.threat-flower\.holdings-stack \.risk-comparison\s*\{/);
  assert.match(visualCss, /\.risk-panel\.threat-flower\.holdings-stack \.risk-evidence dl/);
  assert.match(css, /\.macro-regime-card p \{[^}]*font-size:13px/);
  assert.match(css, /\.macro-selected-evidence section p \{[^}]*font-size:13px/);
  assert.match(visualCss, /\.macro-regime-card \.macro-ai-evidence li p[\s\S]*?font-size:\s*13px/);
  assert.match(css, /@media \(max-width:620px\)[\s\S]*?\.risk-axis-list\s*\{\s*grid-template-columns:1fr;/);
});
