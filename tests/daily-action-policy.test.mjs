import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ACTION_BOARD_CAPS,
  ACTION_DETAIL_MAX,
  ACTION_TITLE_MAX,
  actionKeysCollide,
  finalizeDailyActions,
  isRelevantActionCopy,
  normalizeActionKey,
  SMART_ACTIONS_LABEL,
  shortenActionDetail,
  shortenActionTitle,
} from "../app/dashboard/daily-action-policy.ts";
test("normalized titles collapse Satya LLM Engine clones", () => {
  assert.equal(
    normalizeActionKey("Satya: LLM Engine status"),
    normalizeActionKey("Satya: LLM Engine status 12"),
  );
  assert.equal(
    normalizeActionKey("Stale · Newsletter · Groww Digest · IRCTC result wrap"),
    normalizeActionKey("IRCTC result wrap"),
  );
  assert.equal(
    actionKeysCollide(
      normalizeActionKey("The Economic Times · A $2tn investment rethink; India’s long road to…"),
      normalizeActionKey("A $2tn investment rethink; India’s long road to the Moon & more"),
    ),
    true,
  );
});

test("copy stays one-line titles and two short sentences", () => {
  const title = shortenActionTitle("A very long research title that should not wrap across the card chrome or force the lane to scroll forever today");
  assert.ok(title.length <= ACTION_TITLE_MAX);
  assert.ok(title.endsWith("…"));
  const detail = shortenActionDetail(
    "First sentence stays. Second sentence also stays. Third sentence must drop. Fourth is an essay.",
  );
  assert.match(detail, /First sentence stays/);
  assert.match(detail, /Second sentence also stays/);
  assert.doesNotMatch(detail, /Third sentence/);
  assert.ok(detail.length <= ACTION_DETAIL_MAX);
});

test("promo and webinar copy is not relevant", () => {
  assert.equal(isRelevantActionCopy("You're invited! Join us for a McKinsey Live virtual event"), false);
  assert.equal(isRelevantActionCopy("Daily Morning Note & Trade Setup for the Day"), false);
  assert.equal(isRelevantActionCopy("Dreaming of a worry-free retirement?"), false);
  assert.equal(isRelevantActionCopy("A $2tn investment rethink"), true);
});

test("finalize caps lanes, labels Smart Actions, and keeps source-backed chrome", () => {
  const flood = Array.from({ length: 20 }, (_, index) => ({
    id: `intel-corpus-2026-08-21-satya-${index}`,
    title: index % 2 === 0 ? "Satya: LLM Engine status" : `Satya: LLM Engine status ${index}`,
    detail: "Indexed Satya corpus title for this trading day. Open Satya on M-2 for extractive context. Do not invent KPIs. Calendar rows are scheduling evidence only.",
    numericAdvantage: "corpus as-of",
    strategicAdvantage: "Corpus-backed M-1 card; numbers stay in Mail/PDF/earnings SoT",
    sourceKind: "smart",
    lane: "monitor",
    tone: "blue",
  }));
  const mixed = [
    {
      id: "intel-axis-result-2026-08-21-irctc",
      title: "IRCTC result update",
      detail: "IRCTC reported catering growth. Axis kept a BUY stance in the mail.",
      numericAdvantage: "result update",
      strategicAdvantage: "Unpublished figures stay blank",
      sourceLabel: "Mail",
      sourceKind: "source",
      lane: "today",
      tone: "blue",
    },
    ...flood,
  ];
  const finalized = finalizeDailyActions(mixed);
  assert.ok(finalized.filter((item) => item.lane === "today").length <= ACTION_BOARD_CAPS.today);
  assert.ok(finalized.filter((item) => item.lane === "monitor").length <= ACTION_BOARD_CAPS.monitor);
  const smart = finalized.filter((item) => item.sourceKind === "smart");
  assert.equal(smart.length, 1);
  assert.ok(smart.every((item) => item.sourceLabel === SMART_ACTIONS_LABEL));
  assert.ok(smart.every((item) => item.numericAdvantage === SMART_ACTIONS_LABEL));
  const mail = finalized.find((item) => item.id.includes("intel-axis-result"));
  assert.equal(mail?.sourceLabel, "Mail");
  assert.notEqual(mail?.numericAdvantage, SMART_ACTIONS_LABEL);
});

test("operational catalogs keep source labels after finalize", () => {
  const items = finalizeDailyActions([
    {
      id: "inv-kite",
      title: "Refresh Kite and validate holdings",
      detail: "Reconcile holdings, positions, orders and GTTs before acting.",
      numericAdvantage: "100% live coverage",
      strategicAdvantage: "Prevents stale decisions",
      sourceLabel: "Kite",
      sourceKind: "source",
      lane: "today",
      tone: "blue",
    },
    {
      id: "health-sync",
      title: "Verify the operational Health target",
      detail: "After 8 PM, confirm the newest archive advances the target date.",
      numericAdvantage: "8 PM date roll",
      strategicAdvantage: "Keeps the record auditable",
      sourceLabel: "Health",
      sourceKind: "source",
      lane: "today",
      tone: "green",
    },
  ]);
  assert.equal(items[0]?.sourceLabel, "Kite");
  assert.equal(items[1]?.sourceLabel, "Health");
  assert.ok(items.every((item) => item.sourceLabel !== SMART_ACTIONS_LABEL));
});

test("five operational workspace catalogs keep source labels and short copy", async () => {
  const utils = await readFile(new URL("../app/dashboard/utils.ts", import.meta.url), "utf8");
  for (const label of ["Kite", "Sectors", "Health", "Canvas", "Library"]) {
    assert.match(utils, new RegExp(`sourceLabel: "${label}"`));
  }
  assert.doesNotMatch(utils, /sourceKind: "smart"/);
  assert.match(utils, /kanbanItems[\s\S]*\binvestment\s*:[\s\S]*\bsectors\s*:[\s\S]*\bhealth\s*:[\s\S]*\bbuilder\s*:[\s\S]*\bstrategies\s*:/);
});
