import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIntelligenceDailyActions,
  intelligenceEvidenceDateKey,
} from "../app/dashboard/intelligence-daily-actions.ts";

const DAY_A = "2026-08-13";
const DAY_B = "2026-08-14";

function sourceState(status, count = 0) {
  return { status, count, displayedCount: count };
}

function emptyInvestment(analysisDate) {
  return {
    policy: "fixture",
    analysisWindowStart: analysisDate,
    analysisDate,
    axisLookbackDays: 1,
    latestAxisAt: analysisDate,
    latestNewsletterAt: analysisDate,
    axisRecommendations: [],
    axisTargetAchievements: [],
    macroEvidence: [],
  };
}

function digestSnapshot({
  date,
  status = "live",
  axisResearch = [],
  newsletters = [],
  podcasts = [],
  axisTargetAchievements = [],
} = {}) {
  return {
    status,
    asOf: `${date} 16:00 IST`,
    newsletters,
    axisResearch,
    podcasts,
    reminders: [],
    calendar: [],
    healthNote: null,
    investment: {
      ...emptyInvestment(date),
      axisTargetAchievements,
    },
    sources: {
      newsletters: sourceState(status, newsletters.length),
      axisResearch: sourceState(status, axisResearch.length),
      podcasts: sourceState(status, podcasts.length),
      reminders: sourceState(status, 0),
      calendar: sourceState(status, 0),
      healthNote: sourceState(status, 0),
    },
  };
}

function earningsSnapshot({ date, status = "verified", events = [] } = {}) {
  return {
    status,
    asOf: `${date} · fixture`,
    analysisDate: date,
    events,
    message: status === "verified" ? "verified fixture" : "stale fixture",
  };
}

function mailItem({ date, title, source = "Axis Research", summary, extra = {} }) {
  return {
    source,
    time: `${date.slice(8)} Aug, 10:00 am`,
    receivedAt: `${date}T04:30:00.000Z`,
    title,
    summary,
    ...extra,
  };
}

function reportedEvent({ date, symbol, name, kpis, extra = {} }) {
  return {
    date: `${Number(date.slice(8))} Aug`,
    dateKey: date,
    day: String(Number(date.slice(8))),
    symbol,
    name,
    state: extra.reported === false ? "Pending" : "Reported",
    portfolio: false,
    period: "Q1 FY27",
    reported: extra.reported ?? true,
    kpis,
    summary: extra.summary,
    source: extra.source ?? "https://www.nseindia.com/",
    ...extra,
  };
}

const dayAContent = digestSnapshot({
  date: DAY_A,
  axisResearch: [
    mailItem({
      date: DAY_A,
      title: "Result Update: IRCTC - Q1FY27",
      summary: "IRCTC reported catering and rail-ticketing growth; Axis kept a BUY stance in the mail.",
      extra: { axisCategory: "result_update" },
    }),
    mailItem({
      date: DAY_A,
      title: "Top Conviction Ideas - August 2026",
      summary: "Axis conviction sleeve highlighted IRCTC against the August basket.",
      extra: { axisCategory: "top_conviction_ideas" },
    }),
    mailItem({
      date: DAY_A,
      title: "Daily Morning Note & Trade Setup for the Day - August 13, 2026",
      summary: "Index setup only; must not mint an action card.",
    }),
  ],
  newsletters: [
    mailItem({
      date: DAY_A,
      source: "Groww Digest",
      title: "IRCTC result wrap",
      summary: "Groww summarised the IRCTC print and the day's breadth.",
      extra: { sourceFamily: "groww_digest" },
    }),
  ],
  podcasts: [
    mailItem({
      date: DAY_A,
      source: "The Daily Brief",
      title: "Thursday markets",
      summary: "Hosts walked through the IRCTC result without quoting unpublished fields.",
      extra: { contentSource: "description" },
    }),
  ],
});

const dayAEarnings = earningsSnapshot({
  date: DAY_A,
  events: [
    reportedEvent({
      date: DAY_A,
      symbol: "IRCTC",
      name: "IRCTC",
      kpis: [
        { label: "Revenue", value: "₹1,168 Cr", change: "+9% YoY", tone: "green" },
        { label: "Profit", value: "₹331 Cr", change: "+8% YoY", tone: "green" },
        { label: "Profit before tax", value: "", change: "", tone: "amber" },
        { label: "Catering revenue", value: "₹512 Cr", change: "+11% YoY", tone: "green" },
      ],
    }),
    reportedEvent({
      date: DAY_A,
      symbol: "PENDINGCO",
      name: "Pending Co",
      kpis: [
        { label: "Revenue", value: "", change: "", tone: "amber" },
        { label: "PAT", value: "", change: "", tone: "amber" },
        { label: "EBITDA", value: "", change: "", tone: "amber" },
        { label: "Guidance", value: "", change: "", tone: "amber" },
      ],
      extra: { reported: false, source: undefined },
    }),
  ],
});

const dayBContent = digestSnapshot({
  date: DAY_B,
  axisResearch: [
    mailItem({
      date: DAY_B,
      title: "Axis Punch - Oberoi Realty Limited",
      summary: "Axis Punch kept Oberoi as a trading idea after the prior session.",
      extra: { axisCategory: "axis_punch" },
    }),
    mailItem({
      date: DAY_B,
      title: "Target Achieved: Cholamandalam Investment and Fin Co Ltd - Axis Punch",
      summary: "Axis closed the Chola Punch call after the target print.",
      extra: { axisCategory: "target_achieved" },
    }),
  ],
  newsletters: [
    mailItem({
      date: DAY_B,
      source: "Flipboard Tech Briefing",
      title: "Friday semiconductor brief",
      summary: "Flipboard collected overnight chip-supply headlines.",
      extra: { sourceFamily: "flipboard_tech" },
    }),
  ],
  podcasts: [
    mailItem({
      date: DAY_B,
      source: "We Study Billionaires",
      title: "Friday episode",
      summary: "Episode description covered positioning, not a result table.",
      extra: { contentSource: "transcript" },
    }),
  ],
});

const dayBEarnings = earningsSnapshot({
  date: DAY_B,
  events: [
    reportedEvent({
      date: DAY_B,
      symbol: "JUBLFOOD",
      name: "Jubilant FoodWorks",
      kpis: [
        { label: "Revenue", value: "₹2,184 Cr", change: "+18% YoY", tone: "green" },
        { label: "Operating EBITDA", value: "₹412 Cr", change: "+9% YoY", tone: "green" },
        { label: "EBITDA margin", value: "18.9%", change: "vs 19.4% YoY", tone: "amber" },
        { label: "PAT", value: "₹176 Cr", change: "+6% YoY", tone: "green" },
      ],
    }),
  ],
});

test("intelligence actions are derived from fixtures and differ across two dates", () => {
  const actionsA = buildIntelligenceDailyActions({
    content: dayAContent,
    earningsSnapshot: dayAEarnings,
    calendarDate: DAY_A,
  });
  const actionsB = buildIntelligenceDailyActions({
    content: dayBContent,
    earningsSnapshot: dayBEarnings,
    calendarDate: DAY_B,
  });

  const idsA = actionsA.map((item) => item.id);
  const idsB = actionsB.map((item) => item.id);
  const titlesA = actionsA.map((item) => item.title).join("\n");
  const titlesB = actionsB.map((item) => item.title).join("\n");

  assert.ok(actionsA.length >= 4, "13 Aug should mint several evidence-backed cards");
  assert.ok(actionsB.length >= 4, "14 Aug should mint several evidence-backed cards");
  assert.deepEqual([...new Set(idsA)].sort(), [...idsA].sort());
  assert.equal(idsA.some((id) => idsB.includes(id)), false);

  assert.match(titlesA, /IRCTC/);
  assert.match(titlesA, /Groww Digest/);
  assert.match(titlesA, /The Daily Brief/);
  assert.match(titlesA, /conviction/i);
  assert.doesNotMatch(titlesA, /Oberoi|Cholamandalam|Jubilant|Flipboard|We Study Billionaires/);
  assert.doesNotMatch(titlesA, /Daily Morning Note/);
  assert.doesNotMatch(titlesA, /Pending Co/);
  assert.doesNotMatch(titlesA, /Refresh exact Mail|concentration|oil, INR|post-result theses/);

  assert.match(titlesB, /Oberoi/);
  assert.match(titlesB, /Cholamandalam/);
  assert.match(titlesB, /Flipboard/);
  assert.match(titlesB, /We Study Billionaires/);
  assert.match(titlesB, /Jubilant FoodWorks/);
  assert.doesNotMatch(titlesB, /IRCTC|Groww Digest|The Daily Brief/);

  const irctcKpis = actionsA.find((item) => item.id.includes("intel-earn") && item.title.includes("IRCTC"));
  assert.ok(irctcKpis);
  assert.match(irctcKpis.detail, /₹1,168 Cr/);
  assert.doesNotMatch(irctcKpis.detail, /invent|fabricat/i);
  assert.equal(irctcKpis.lane, "monitor");

  const resultUpdate = actionsA.find((item) => item.title.includes("result update"));
  const conviction = actionsA.find((item) => item.title.includes("conviction"));
  const punch = actionsB.find((item) => item.title.includes("Punch"));
  const target = actionsB.find((item) => item.title.includes("target achieved"));
  assert.equal(resultUpdate?.lane, "today");
  assert.equal(conviction?.lane, "monitor");
  assert.equal(punch?.lane, "monitor");
  assert.equal(target?.lane, "monitor");

  const transcript = actionsB.find((item) => item.title.includes("We Study Billionaires"));
  assert.equal(transcript?.numericAdvantage, "transcript");
  const description = actionsA.find((item) => item.title.includes("The Daily Brief"));
  assert.equal(description?.numericAdvantage, "description");
});

test("weekend boards reuse last NSE trading day evidence", () => {
  assert.equal(intelligenceEvidenceDateKey("2026-08-15"), DAY_B);
  const weekend = buildIntelligenceDailyActions({
    content: dayBContent,
    earningsSnapshot: dayBEarnings,
    calendarDate: "2026-08-15",
  });
  assert.ok(weekend.some((item) => item.title.includes("Oberoi")));
  assert.ok(weekend.some((item) => item.id.includes(DAY_B)));
  assert.equal(weekend.some((item) => item.id.includes("2026-08-15")), false);
});

test("stale or empty sources label stale and never invent companies", () => {
  const stale = buildIntelligenceDailyActions({
    content: digestSnapshot({ date: DAY_A, status: "stale", axisResearch: dayAContent.axisResearch, newsletters: dayAContent.newsletters, podcasts: dayAContent.podcasts }),
    earningsSnapshot: earningsSnapshot({ date: DAY_A, status: "stale", events: dayAEarnings.events }),
    calendarDate: DAY_A,
  });
  assert.ok(stale.length > 0);
  assert.ok(stale.every((item) => item.title.startsWith("Stale · ") || item.strategicAdvantage.includes("Stale")));
  assert.ok(stale.some((item) => item.title.includes("IRCTC")));
  const staleMail = stale.filter((item) => item.id.includes("intel-newsletter") || item.id.includes("intel-axis-result") || item.id.includes("intel-podcast"));
  assert.ok(staleMail.length > 0);
  assert.ok(staleMail.every((item) => item.lane === "monitor"));
  assert.ok(staleMail.every((item) => item.title.startsWith("Stale · ")));

  const empty = buildIntelligenceDailyActions({
    content: digestSnapshot({ date: DAY_A, status: "live" }),
    earningsSnapshot: earningsSnapshot({ date: DAY_A, status: "unavailable", events: [] }),
    calendarDate: DAY_A,
  });
  assert.deepEqual(empty, []);
  assert.doesNotMatch(JSON.stringify(empty), /RELIANCE|HDFCBANK|TCS|IRCTC|Oberoi/);
});

test("calendar failure does not stale live Newsletter or Axis cards", () => {
  const content = digestSnapshot({
    date: DAY_A,
    status: "partial",
    axisResearch: dayAContent.axisResearch,
    newsletters: dayAContent.newsletters,
  });
  content.sources.newsletters = sourceState("live", content.newsletters.length);
  content.sources.axisResearch = sourceState("live", content.axisResearch.length);
  content.sources.calendar = sourceState("error", 0);
  const actions = buildIntelligenceDailyActions({
    content,
    earningsSnapshot: earningsSnapshot({ date: DAY_A, status: "verified", events: [] }),
    calendarDate: DAY_A,
  });
  const newsletter = actions.find((item) => item.id.includes("intel-newsletter"));
  const result = actions.find((item) => item.id.includes("intel-axis-result"));
  assert.equal(newsletter?.lane, "today");
  assert.doesNotMatch(newsletter?.title ?? "", /^Stale · /);
  assert.equal(result?.lane, "today");
  assert.doesNotMatch(result?.title ?? "", /^Stale · /);
});

test("corpus as-of titles mint monitor cards without duplicating digest titles", () => {
  const actions = buildIntelligenceDailyActions({
    content: digestSnapshot({ date: DAY_A, status: "live" }),
    earningsSnapshot: earningsSnapshot({ date: DAY_A, status: "verified", events: [] }),
    calendarDate: DAY_A,
    corpusDocuments: [
      { family: "axis_research", title: "Sector Update: Cement", receivedAt: `${DAY_A}T04:00:00.000Z` },
    ],
  });
  assert.ok(actions.some((item) => item.title.includes("Sector Update: Cement")));
});
