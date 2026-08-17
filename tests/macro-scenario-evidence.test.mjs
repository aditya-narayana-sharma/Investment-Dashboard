import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleScenarioEvidence,
  evidenceCardLabel,
  kpiEvidenceItems,
  MIN_SCENARIO_EVIDENCE,
  scenarioBandForItem,
  scenarioEvidenceItems,
  scenarioEvidenceSentence,
} from "../app/macro-scenario-evidence.ts";

const deescalation = {
  source: "Bloomberg",
  time: "10 Aug",
  title: "Diplomacy over escalation",
  summary: "President Donald Trump signaled he is prepared to let economic pressure on Iran build rather than launch fresh military strikes.",
};
const controlled = {
  source: "Groww Digest",
  time: "10 Aug",
  title: "Russian crude oil imports at record high",
  summary: "India's imports of Russian crude oil rose to a record high while supply remained available.",
};
const disruption = {
  source: "Axis Research",
  time: "11 Aug",
  title: "Hormuz disruption stress test",
  summary: "A Strait of Hormuz shipping disruption would create an oil supply shock and a broad risk-off move.",
};
const unrelated = {
  source: "CFO Journal",
  time: "11 Aug",
  title: "Chicken surplus squeezes poultry companies",
  summary: "Poultry oversupply is a commodity market dynamic.",
};

const oilFramework = {
  label: "Crude + geopolitics",
  evidence: "Import bill, INR and inflation are the principal India transmission channels.",
  sectors: "Support: telecom, domestic power · Pressure: chemicals, transport, discretionary",
  trigger: "Escalate controls if Brent remains above $90 for two weeks.",
  bands: {
    supportive: { label: "De-escalation", range: "Brent $70-75", summary: "Lower imported inflation and a steadier rupee support domestic risk appetite.", action: "Use staged additions within target weights." },
    base: { label: "Controlled conflict", range: "Brent $78-90", summary: "Elevated volatility with manageable earnings damage and repeated headline shocks.", action: "Stagger additions; monitor INR, yields and FII persistence." },
    stress: { label: "Hormuz disruption", range: "Brent $100-120", summary: "Import costs, inflation, INR and yields create a broad India risk-off shock.", action: "Preserve liquidity and avoid high-beta additions." },
  },
};

function frameworkFor(label) {
  return { ...oilFramework, label };
}

const candidates = [deescalation, controlled, disruption, unrelated];

const sampleDigest = [
  deescalation,
  controlled,
  disruption,
  {
    source: "The Economic Times",
    time: "16 Aug",
    title: "Silicon Valley clout, Hormuz shocks and India’s LPG Plan B",
    summary: "Indian oil-ship captain, trapped 75 days at sea, recounts his ordeal.",
    bullets: ["Hormuz shocks and India’s LPG Plan B", "Indian oil-ship captain, trapped 75 days at sea, recounts his ordeal"],
  },
  {
    source: "The Economic Times",
    time: "15 Aug",
    title: "Nifty50 can hit 28,615 if crude cools",
    summary: "Nifty50 can hit 28,615 if crude cools as supply relief returns.",
  },
  {
    source: "Axis Direct",
    time: "17 Aug",
    title: "Top Conviction Ideas — Metals & Mining",
    summary: "LME aluminium prices increased, supported by supply disruptions and geopolitical developments.",
    bullets: ["Geopolitical developments, international freight rates and changes in global trade policies remain key external risks."],
  },
  {
    source: "TLDR Hardware",
    time: "17 Aug",
    title: "Nvidia discloses stake in SpaceX",
    summary: "Nvidia Discloses $21bn Stake in SpaceX, Ties It Deeper Into Musk's Data Center Buildout.",
  },
  {
    source: "The Daily Brief by Zerodha",
    time: "17 Aug",
    title: "India’s data fortress is a maze of conflicts",
    summary: "What are the incentives behind India’s efforts to localize its data?",
  },
  {
    source: "Menaka Doshi at Bloomberg",
    time: "17 Aug",
    title: "RBI pivot",
    summary: "In June, the Reserve Bank of India announced measures to stem a rapid decline in the rupee. We do hope to get good, healthy flows going forward. Bonds fell as the earlier closure means less rupee liquidity.",
  },
  {
    source: "NSE India",
    time: "24 Jul",
    title: "FII/FPI & DII trading activity",
    summary: "Primary exchange report for capital-market FII/FPI and DII buy/sell/net values.",
    evidenceKind: "web",
  },
  {
    source: "CNBC TV18",
    time: "24 Jul",
    title: "FIIs keep selling, DIIs continue to hold the fort",
    summary: "Provisional exchange data: FII net sell continues while DIIs nearly offset outflows with fresh buying.",
    evidenceKind: "web",
  },
  {
    source: "Groww Digest",
    time: "17 Aug",
    title: "India's unemployment rate at 4-month low",
    summary: "Nifty 50 closed lower. India’s wholesale price inflation fell. RBI advanced the FCNR deadline after inflows. Markets closed lower compared to Friday’s closing point.",
    bullets: ["Nifty 50 has fallen between 0% and 1% about 466 times in the last 5 years.", "Markets closed lower compared to Friday’s closing point.", "India’s wholesale price inflation fell to 9.78% year-on-year in July."],
  },
  {
    source: "Axis Direct",
    time: "17 Aug",
    title: "Daily Technical Outlook",
    summary: "Our trend score analysis of the Nifty and Bank Nifty suggests a mild bearish outlook for both benchmarks.",
  },
  {
    source: "Axis Direct",
    time: "17 Aug",
    title: "Result Updates - Q1FY27",
    summary: "HG Infra Engineering Ltd - Result Update; BUY. Strong H2 turnaround expected. We maintain our BUY recommendation on the stock.",
    bullets: ["Company Outlook & Guidance: For FY27, the company has guided for Revenue in the range of Rs 6100-6500Cr.", "We maintain our BUY recommendation on the stock."],
  },
  {
    source: "Axis Direct",
    time: "14 Aug",
    title: "Result Updates - Man Infra",
    summary: "We cut our pre-sales estimates to account for slower bookings and maintain our BUY rating.",
  },
  {
    source: "Morning Brew",
    time: "16 Aug",
    title: "Major shift",
    summary: "How AI is upending college major choices. Cryptocurrency data as of 3:30pm ET.",
  },
];

const eventKeys = ["oilWar", "flows", "rates", "breadth", "earnings"];
const bandKeys = ["supportive", "base", "stress"];

test("oil scenarios use mutually exclusive evidence pools", () => {
  assert.deepEqual(scenarioEvidenceItems(candidates, "oilWar", "supportive").map((item) => item.source), ["Bloomberg"]);
  assert.deepEqual(scenarioEvidenceItems(candidates, "oilWar", "base").map((item) => item.source), ["Groww Digest"]);
  assert.deepEqual(scenarioEvidenceItems(candidates, "oilWar", "stress").map((item) => item.source), ["Axis Research"]);
});

test("scenario summaries extract only a sentence supporting the selected range", () => {
  assert.match(scenarioEvidenceSentence(deescalation, "oilWar", "supportive"), /economic pressure on Iran/);
  assert.match(scenarioEvidenceSentence(controlled, "oilWar", "base"), /imports of Russian crude oil/);
  assert.match(scenarioEvidenceSentence(disruption, "oilWar", "stress"), /Hormuz shipping disruption/);
  assert.equal(scenarioEvidenceSentence(unrelated, "oilWar", "base"), "");
});

test("a range with no direct Mail support does not borrow another range as proof", () => {
  assert.deepEqual(scenarioEvidenceItems([deescalation, controlled], "oilWar", "stress"), []);
  const assembled = assembleScenarioEvidence([deescalation, controlled], "oilWar", "stress", oilFramework);
  assert.equal(assembled.filter((item) => item.rangeSupport === "supports-range").length, 0);
  assert.ok(assembled.every((item) => item.kind === "framework" || item.rangeSupport === "context"));
  assert.ok(assembled.length >= MIN_SCENARIO_EVIDENCE);
});

test("one source item cannot appear as range-support in more than one range", () => {
  for (const item of candidates) {
    const memberships = bandKeys.filter((band) => scenarioEvidenceItems([item], "oilWar", band).length);
    assert.ok(memberships.length <= 1, `${item.title} appeared in ${memberships.join(", ")}`);
  }
});

test("false-positive Mail is not bucketed as oil or rates evidence", () => {
  const oil = kpiEvidenceItems(sampleDigest, "oilWar").map((item) => item.title);
  assert.ok(!oil.some((title) => /SpaceX|data fortress/i.test(title)));
  const rates = kpiEvidenceItems(sampleDigest, "rates").map((item) => item.title);
  assert.ok(!rates.some((title) => /Major shift/i.test(title)));
  assert.equal(
    kpiEvidenceItems([{
      source: "The Economic Times",
      time: "17 Aug",
      title: "Defence gets fat cheques",
      summary: "BJP Revamp: Smriti Irani, Piyush Goyal get key roles. Yes Bank.",
    }], "oilWar").length,
    0,
  );
});

test("every macro KPI scenario assembles at least four labelled evidence cards from a live-like digest", () => {
  for (const eventKey of eventKeys) {
    for (const bandKey of bandKeys) {
      const cards = assembleScenarioEvidence(sampleDigest, eventKey, bandKey, frameworkFor(eventKey));
      assert.ok(cards.length >= MIN_SCENARIO_EVIDENCE, `${eventKey}/${bandKey} had ${cards.length}`);
      for (const card of cards) {
        const label = evidenceCardLabel(card);
        if (card.kind === "mail") {
          assert.match(label, /Mail/);
          assert.doesNotMatch(card.source, /Framework note/i);
        }
        if (card.kind === "framework") {
          assert.match(label, /Framework note/);
          assert.match(label, /not a range proof/);
        }
        if (card.rangeSupport === "context" && card.kind === "mail") {
          assert.match(label, /not a range proof/);
        }
      }
    }
  }
});

test("Hormuz and crude-cools Mail attach to oil stress and supportive without claiming the wrong Brent range", () => {
  const supportive = assembleScenarioEvidence(sampleDigest, "oilWar", "supportive", oilFramework);
  const stress = assembleScenarioEvidence(sampleDigest, "oilWar", "stress", oilFramework);
  const base = assembleScenarioEvidence(sampleDigest, "oilWar", "base", oilFramework);
  assert.ok(supportive.some((item) => /crude cools/i.test(item.title) && item.rangeSupport === "supports-range"));
  assert.ok(stress.some((item) => /Hormuz/i.test(item.title) && item.rangeSupport === "supports-range"));
  assert.equal(scenarioBandForItem(sampleDigest.find((item) => /Hormuz shocks/i.test(item.title)), "oilWar"), "stress");
  assert.ok(!base.some((item) => /Hormuz shocks/i.test(item.title) && item.rangeSupport === "supports-range"));
  assert.ok(base.length >= MIN_SCENARIO_EVIDENCE);
});

test("an empty digest still yields four framework notes and never fabricates Mail", () => {
  for (const bandKey of bandKeys) {
    const cards = assembleScenarioEvidence([], "oilWar", bandKey, oilFramework);
    assert.equal(cards.length, MIN_SCENARIO_EVIDENCE);
    assert.ok(cards.every((item) => item.kind === "framework" && item.source === "Framework note"));
  }
});
