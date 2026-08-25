import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("the motion layer is loaded by the app", async () => {
  const layout = await read("../app/layout.tsx");
  assert.match(layout, /import "\.\/motion\.css";/);
});

test("motion tokens define durations and easings in one place", async () => {
  const css = await read("../app/motion.css");
  for (const token of ["--motion-fast", "--motion-base", "--motion-slow", "--motion-ease-standard", "--motion-ease-emphasised"]) {
    assert.match(css, new RegExp(token.replace(/-/g, "\\-")), `missing ${token}`);
  }
});

test("every token-driven animation is compositor-only", async () => {
  const css = await read("../app/motion.css");
  const keyframeBlocks = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\n\}/g)].map((match) => match[1]);
  assert.ok(keyframeBlocks.length >= 3, "expected several keyframes");
  for (const block of keyframeBlocks) {
    assert.doesNotMatch(
      block,
      /\b(?:width|height|top|left|right|bottom|margin|padding)\s*:/,
      "motion.css keyframes must animate transform/opacity only",
    );
  }
});

test("every animated selector is halted under prefers-reduced-motion", async () => {
  const css = await read("../app/motion.css");
  const reduceIndex = css.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(reduceIndex > 0, "motion.css must carry a reduced-motion block");
  const reduceBlock = css.slice(reduceIndex);

  // Parse real rule blocks: split on closing braces so a selector can never
  // swallow the preceding rule.
  const before = css
    .slice(0, reduceIndex)
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const animatedSelectors = [];
  for (const chunk of before.split("}")) {
    const brace = chunk.indexOf("{");
    if (brace < 0) continue;
    const selector = chunk.slice(0, brace).trim();
    const body = chunk.slice(brace + 1);
    if (!/\banimation:/.test(body)) continue;
    if (!selector || selector.startsWith("@") || selector === ":root") continue;
    animatedSelectors.push(selector);
  }

  assert.ok(animatedSelectors.length >= 3, `expected animated selectors, found ${animatedSelectors.length}`);
  for (const selector of animatedSelectors) {
    const head = selector.split(",")[0].trim();
    assert.ok(reduceBlock.includes(head), `${head} animates but is not halted under reduced motion`);
  }
});
