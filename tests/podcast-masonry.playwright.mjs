import assert from "node:assert/strict";

/**
 * Playwright geometry contract for the Market Intelligence Podcast masonry.
 * Call this after opening `?view=intelligence` with every Podcast group expanded.
 *
 * @param {{ locator(selector: string): { evaluateAll(callback: (elements: Element[]) => unknown): Promise<unknown> } }} page
 * @param {number} gutter
 */
export async function assertPodcastMasonryGeometry(page, gutter = 8) {
  const cards = /** @type {Array<{ index: number; left: number; top: number; bottom: number; width: number; height: number }>} */ (
    await page.locator(".sender-groups-podcasts .sender-group").evaluateAll((elements) => elements.map((element, index) => {
      const rect = element.getBoundingClientRect();
      return { index, left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    }))
  );

  assert.ok(cards.length > 0, "Podcast sender groups must render");
  cards.forEach((card) => {
    assert.ok(card.width > 0 && card.height > 0, `Podcast sender group ${card.index} must have natural geometry`);
  });

  const columns = new Map();
  cards.forEach((card) => {
    const key = Math.round(card.left);
    columns.set(key, [...(columns.get(key) ?? []), card]);
  });

  const orderedColumns = Array.from(columns.entries()).sort(([leftA], [leftB]) => leftA - leftB);
  orderedColumns.forEach(([, column]) => {
    column.sort((cardA, cardB) => cardA.top - cardB.top);
    for (let index = 1; index < column.length; index += 1) {
      const previous = column[index - 1];
      const current = column[index];
      const gap = current.top - previous.bottom;
      assert.ok(gap >= -0.5, `Podcast sender groups ${previous.index} and ${current.index} overlap by ${Math.abs(gap).toFixed(2)}px`);
      assert.ok(gap <= gutter + 0.5, `Podcast sender groups ${previous.index} and ${current.index} have a ${gap.toFixed(2)}px gap; expected no more than ${gutter}px`);
      assert.ok(current.index > previous.index, "Podcast keyboard/source order must flow downward within each visual column");
    }
  });

  for (let index = 1; index < orderedColumns.length; index += 1) {
    const priorIndexes = orderedColumns[index - 1][1].map((card) => card.index);
    const currentIndexes = orderedColumns[index][1].map((card) => card.index);
    assert.ok(Math.max(...priorIndexes) < Math.min(...currentIndexes), "Podcast source order must finish one visual column before entering the next");
  }
}
