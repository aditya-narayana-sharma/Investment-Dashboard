import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("the full-body rig has a head, torso, arms and legs", async () => {
  const avatar = await read("../app/dashboard/SatyaAvatar.tsx");
  assert.match(avatar, /export function SatyaFullBody/);
  for (const group of ["satya-head-group", "satya-torso-group", "satya-arms", "satya-legs"]) {
    assert.match(avatar, new RegExp(group), `full-body rig is missing ${group}`);
  }
  // The compact launcher glyph must survive the split unchanged.
  assert.match(avatar, /export function SatyaGlyph/);
});

test("every animated persona group is halted under prefers-reduced-motion", async () => {
  const css = await read("../app/dashboard/satya.css");

  const reduceIndex = css.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(reduceIndex > 0, "satya.css must carry a reduced-motion block");
  const reduceBlock = css.slice(reduceIndex);

  // Collect every selector that starts an animation, then prove each is halted.
  const animated = new Set();
  for (const match of css.matchAll(/\.(satya-[\w-]+)(?:\[[^\]]*\])?\s*\{[^}]*animation:/g)) {
    animated.add(match[1]);
  }
  assert.ok(animated.size >= 4, "expected several animated Satya groups");

  for (const selector of animated) {
    assert.ok(
      reduceBlock.includes(`.${selector},`) || reduceBlock.includes(`.${selector} {`),
      `.${selector} animates but is not halted under prefers-reduced-motion`,
    );
  }
});

test("persona motion is compositor-only — no layout-triggering properties animate", async () => {
  const css = await read("../app/dashboard/satya.css");
  const bodyKeyframes = ["satya-breathe", "satya-head-settle", "satya-lean-in", "satya-gesture"];

  for (const name of bodyKeyframes) {
    const start = css.indexOf(`@keyframes ${name}`);
    assert.ok(start > 0, `missing @keyframes ${name}`);
    const block = css.slice(start, css.indexOf("}", css.indexOf("{", start + name.length) + 1) + 200);
    const frames = block.slice(0, block.lastIndexOf("}"));
    assert.doesNotMatch(
      frames,
      /\b(?:width|height|top|left|right|bottom|margin|padding)\s*:/,
      `${name} animates a layout property; use transform/opacity only`,
    );
  }
});

test("SatyaPresence stays under the 1000-line rule after the persona work", async () => {
  const presence = await read("../app/dashboard/SatyaPresence.tsx");
  const lines = presence.split("\n").length;
  assert.ok(lines < 1000, `SatyaPresence.tsx is ${lines} lines; extract before adding more`);
});

test("the full-body persona is mounted where there is room for it", async () => {
  const [briefing, popout] = await Promise.all([
    read("../app/dashboard/SatyaBriefingRoom.tsx"),
    read("../app/dashboard/SatyaDraftPopout.tsx"),
  ]);
  assert.match(briefing, /SatyaFullBody/, "M-2 Briefing Room should show the character");
  assert.match(popout, /SatyaFullBody/, "the draft pop-out should show the character");
  // Both must pass a real reduced-motion value rather than hardcoding false.
  assert.match(briefing, /reducedMotion=\{reducedMotion\}/);
  assert.match(popout, /reducedMotion=\{reducedMotion\}/);
});

test("reduced motion is read without a synchronous setState in an effect", async () => {
  const hook = await read("../app/dashboard/use-prefers-reduced-motion.ts");
  assert.match(hook, /useSyncExternalStore/);
  assert.doesNotMatch(hook, /useEffect/);
});
